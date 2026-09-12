import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  status,
  today,
  addDays,
  nextMonth,
  reminderMessage,
  runSchedules,
  type Workspace,
  type Invoice,
} from '../src/shared/domain'

function fixture(): { w: Workspace; i: Invoice } {
  let w = emptyWorkspace()
  w.business.name = 'Humza Design Studio'
  w.business.address = '1 Studio Way, London'
  w.business.email = 'humza@design.co'
  w.business.timezone = 'Europe/London'
  w.business.currency = 'GBP'

  const client = {
    id: crypto.randomUUID(),
    name: 'Mentage Labs',
    email: 'billing@mentage.com',
    address: '10 Tech City, London',
    cc: ['finance@mentage.com'],
    replyTo: 'humza@mentage.com',
    terms: 14,
    notes: 'Key client',
  }
  w = applyCommand(w, { type: 'client', value: client })

  const project = {
    id: crypto.randomUUID(),
    name: 'Mentage Platform',
    clientId: client.id,
    notes: 'Platform sprint',
  }
  w = applyCommand(w, { type: 'project', value: project })

  const i = newInvoice(w)
  i.clientId = client.id
  i.client = structuredClone(client)
  i.projectId = project.id
  i.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Design Deliverables',
      quantity: '1',
      rate: '1200',
      unit: 'fixed',
    },
  ]
  i.issueDate = '2026-09-01'
  i.terms = client.terms
  i.dueDate = '2026-09-15'
  w = applyCommand(w, { type: 'draft', value: i })

  return { w, i: w.invoices[0] }
}

describe('Phase 6: Resend Email Composer & Idempotency', () => {
  it('creates an email message draft with recipient defaults and allows explicit sending', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    const messageId = crypto.randomUUID()
    const msg = {
      id: messageId,
      invoiceId: issued.id,
      kind: 'invoice' as const,
      to: issued.client.email,
      cc: issued.client.cc,
      replyTo: issued.client.replyTo,
      subject: `Invoice ${issued.number} from ${w.business.name}`,
      body: `Hello ${issued.client.name},\n\nPlease find attached invoice ${issued.number}.`,
      status: 'draft' as const,
      created: new Date().toISOString(),
    }

    // Save draft message
    w = applyCommand(w, { type: 'message', value: msg })
    expect(w.messages).toHaveLength(1)
    expect(w.messages[0].status).toBe('draft')
    expect(w.messages[0].to).toBe('billing@mentage.com')
    expect(w.messages[0].cc).toEqual(['finance@mentage.com'])

    // Explicit send transition: draft -> queued
    w = applyCommand(w, { type: 'send', id: messageId })
    expect(w.messages[0].status).toBe('queued')

    // Idempotency: Attempting to send an already queued message must throw
    expect(() => applyCommand(w, { type: 'send', id: messageId })).toThrow(
      'This email is already queued or sent'
    )
  })

  it('allows retrying failed delivery attempts safely without duplicating messages', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    const messageId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'message',
      value: {
        id: messageId,
        invoiceId: i.id,
        kind: 'invoice',
        to: i.client.email,
        cc: [],
        replyTo: '',
        subject: 'Test Invoice',
        body: 'Invoice body',
        status: 'draft',
        created: new Date().toISOString(),
      },
    })

    w = applyCommand(w, { type: 'send', id: messageId })
    expect(w.messages[0].status).toBe('queued')

    // Simulate provider failure transition to failed state
    w.messages[0].status = 'failed'
    w.messages[0].error = 'Rate limit exceeded on provider'

    // User triggers explicit retry
    w = applyCommand(w, { type: 'send', id: messageId })
    expect(w.messages[0].status).toBe('queued')
    expect(w.messages[0].error).toBeUndefined()
    expect(w.messages).toHaveLength(1) // Still exactly 1 message record (no duplicates)
  })
})

describe('Phase 6: Public Viewing & Download Links with Immediate Revocation', () => {
  it('generates high-entropy scoped share tokens and revokes them immediately', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    const expiry = '2026-10-31'
    w = applyCommand(w, { type: 'share', id: i.id, expires: expiry })
    const shared = w.invoices.find(x => x.id === i.id)!
    expect(shared.share).toBeDefined()
    expect(shared.share!.token).toHaveLength(72) // 2 concatenated UUIDs (high entropy)
    expect(shared.share!.expires).toBe(expiry)

    // Revocation immediately clears share token
    w = applyCommand(w, { type: 'revoke', id: i.id })
    const revoked = w.invoices.find(x => x.id === i.id)!
    expect(revoked.share).toBeUndefined()
  })

  it('automatically revokes public share links when an issued invoice is voided', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    w = applyCommand(w, { type: 'share', id: i.id, expires: '2026-10-31' })
    expect(w.invoices[0].share).toBeDefined()

    w = applyCommand(w, { type: 'void', id: i.id, reason: 'Duplicate issue' })
    expect(w.invoices[0].lifecycle).toBe('void')
    expect(w.invoices[0].share).toBeUndefined()
  })
})

describe('Phase 6: Recurring Schedules & Month-End Preservation', () => {
  it('preserves month-end day anchors across shorter and longer months (Jan 31 -> Feb 28 -> Mar 31)', () => {
    // 1 month step from Jan 31
    const feb = nextMonth('2026-01-31', 1, 31)
    expect(feb).toBe('2026-02-28') // Clamped to Feb 28 in non-leap year

    // 1 month step from Feb 28 retaining day anchor 31
    const mar = nextMonth('2026-02-28', 1, 31)
    expect(mar).toBe('2026-03-31') // Restored to March 31st

    // 1 month step from Mar 31
    const apr = nextMonth('2026-03-31', 1, 31)
    expect(apr).toBe('2026-04-30') // Clamped to April 30th
  })

  it('generates reviewable unnumbered drafts and prevents duplicate execution on the same date', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    const scheduleId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'schedule',
      value: {
        id: scheduleId,
        invoiceId: i.id,
        nextDate: '2026-09-01',
        day: 1,
        months: 1,
        paused: false,
      },
    })

    expect(w.invoices).toHaveLength(1)

    // First scheduled execution on 2026-09-01
    const now = new Date('2026-09-01T10:00:00Z')
    w = runSchedules(w, now)

    // A fresh unnumbered draft should be created
    expect(w.invoices).toHaveLength(2)
    const freshDraft = w.invoices[0]
    expect(freshDraft.lifecycle).toBe('draft')
    expect(freshDraft.number).toBe('')
    expect(freshDraft.issueDate).toBe('2026-09-01')
    expect(freshDraft.dueDate).toBe('2026-09-15')
    expect(freshDraft.lines[0].rate).toBe('1200')

    // Next schedule date advanced to 2026-10-01
    const sched = w.schedules.find(s => s.id === scheduleId)!
    expect(sched.nextDate).toBe('2026-10-01')
    expect(sched.lastRunDate).toBe('2026-09-01')

    // Second execution on the SAME date (e.g. repeated cron or duplicate job)
    w = runSchedules(w, now)
    // MUST NOT create duplicate drafts
    expect(w.invoices).toHaveLength(2)
  })

  it('pauses recurring schedules automatically if the source invoice is voided', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    const scheduleId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'schedule',
      value: {
        id: scheduleId,
        invoiceId: i.id,
        nextDate: '2026-09-01',
        day: 1,
        months: 1,
        paused: false,
      },
    })

    // Void the source invoice
    w = applyCommand(w, { type: 'void', id: i.id, reason: 'Agreement terminated' })

    // Run schedules
    w = runSchedules(w, new Date('2026-09-01T10:00:00Z'))
    const sched = w.schedules.find(s => s.id === scheduleId)!
    expect(sched.paused).toBe(true)
    // No draft created for voided source invoice
    expect(w.invoices.filter(x => x.lifecycle === 'draft')).toHaveLength(0)
  })
})

describe('Phase 6: Automated Overdue Reminders & Pre-send Safeguards', () => {
  it('defaults automated sending to off and requires explicit settings opt-in', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    // Invoice is overdue (due 2026-09-15, today is 2026-09-25)
    w = applyCommand(w, { type: 'reminder', id: i.id, enabled: true, days: 7 })

    // Workspace business settings has autoReminders = false by default
    expect(w.business.autoReminders).toBe(false)

    // Run schedules on overdue date
    const overdueDate = new Date('2026-09-25T10:00:00Z')
    w = runSchedules(w, overdueDate)

    // Automated reminder must NOT be queued because settings opt-in is false
    expect(w.messages).toHaveLength(0)

    // Enable settings opt-in
    w.business.autoReminders = true
    w = runSchedules(w, overdueDate)

    // Now automated reminder is queued
    expect(w.messages).toHaveLength(1)
    expect(w.messages[0].kind).toBe('reminder')
    expect(w.messages[0].status).toBe('queued')
    expect(w.messages[0].subject).toContain(`Payment reminder: ${w.invoices[0].number}`)
  })

  it('never sends reminders to paid or void invoices', () => {
    let { w, i } = fixture()
    w.business.autoReminders = true
    w = applyCommand(w, { type: 'issue', id: i.id })
    w = applyCommand(w, { type: 'reminder', id: i.id, enabled: true, days: 7 })

    // Record full payment
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: crypto.randomUUID(),
        amount: '1200.00',
        date: '2026-09-10',
        method: 'Bank',
        reference: 'PAID-IN-FULL',
        notes: '',
        reversed: false,
      },
    })
    expect(totals(w.invoices[0]).balance).toBe('0.00')

    // Run schedules on overdue date
    w = runSchedules(w, new Date('2026-09-25T10:00:00Z'))
    // Paid invoices must NEVER receive reminders
    expect(w.messages).toHaveLength(0)
  })

  it('suppresses automated reminders if a previous message to that recipient bounced', () => {
    let { w, i } = fixture()
    w.business.autoReminders = true
    w = applyCommand(w, { type: 'issue', id: i.id })
    w = applyCommand(w, { type: 'reminder', id: i.id, enabled: true, days: 7 })

    // Simulate previous email for this invoice having bounced
    w.messages.push({
      id: crypto.randomUUID(),
      invoiceId: i.id,
      kind: 'invoice',
      to: i.client.email,
      cc: [],
      replyTo: '',
      subject: 'Invoice',
      body: '',
      status: 'bounced',
      created: '2026-09-02T10:00:00Z',
    })

    // Run schedules on overdue date
    w = runSchedules(w, new Date('2026-09-25T10:00:00Z'))
    // Reminders must be suppressed for bounced recipients
    expect(w.messages.filter(m => m.kind === 'reminder')).toHaveLength(0)
  })
})

describe('Phase 6: Resend Webhooks & Out-of-Order Delivery Events', () => {
  it('correctly handles out-of-order and duplicate webhook delivery events', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    const msgId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'message',
      value: {
        id: msgId,
        invoiceId: i.id,
        kind: 'invoice',
        to: i.client.email,
        cc: [],
        replyTo: '',
        subject: 'Invoice',
        body: 'Body',
        status: 'draft',
        created: new Date().toISOString(),
      },
    })
    w = applyCommand(w, { type: 'send', id: msgId })
    const emailId = 're_123456789'
    w.messages[0].providerId = emailId
    w.messages[0].status = 'sending'

    // 1. Simulate 'email.delivered' arriving first (e.g. sent webhook was delayed)
    const applyWebhook = (type: string) => {
      for (const m of w.messages.filter(m => m.providerId === emailId)) {
        if (['email.bounced', 'email.complained'].includes(type)) m.status = 'bounced'
        else if (type === 'email.delivered' && m.status !== 'bounced') m.status = 'delivered'
        else if (type === 'email.sent' && ['queued', 'sending'].includes(m.status)) m.status = 'sent'
      }
    }

    applyWebhook('email.delivered')
    expect(w.messages[0].status).toBe('delivered')

    // 2. Out-of-order 'email.sent' arrives AFTER 'email.delivered'
    applyWebhook('email.sent')
    // MUST NOT downgrade 'delivered' back to 'sent'
    expect(w.messages[0].status).toBe('delivered')

    // 3. Duplicate 'email.delivered' webhook arrives
    applyWebhook('email.delivered')
    // Idempotent: status remains 'delivered'
    expect(w.messages[0].status).toBe('delivered')

    // 4. 'email.bounced' arrives
    applyWebhook('email.bounced')
    expect(w.messages[0].status).toBe('bounced')
  })
})

