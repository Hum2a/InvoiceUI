import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  type Workspace,
  type Message,
} from '../src/shared/domain'
import {
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
  formatSenderFrom,
  getDeliverabilityHeaders,
} from '../src/shared/emailTemplate'

function fixture(): { w: Workspace } {
  let w = emptyWorkspace()
  w.business = {
    name: 'Apex Design Ltd',
    email: 'billing@apexdesign.example',
    address: '10 High Street, London, EC1A 1BB, United Kingdom',
    bank: 'Monzo\nAccount: 12345678\nSort: 04-00-04',
    footer: 'Thank you for your valued custom.',
    taxId: 'GB123456789',
    logo: '',
    currency: 'GBP',
    terms: 14,
    prefix: 'APX',
    accent: '#bef264',
    template: 'studio',
    timezone: 'Europe/London',
    autoReminders: true,
    onboardingDismissed: true,
  }

  const client = {
    id: crypto.randomUUID(),
    name: 'Mentage Global Media',
    email: 'accounts@mentage.example',
    contact: 'Sarah Jenkins',
    phone: '+44 20 7946 0991',
    address: '45 Creative Square, Manchester, M1 1AA, United Kingdom',
    terms: 14,
    taxId: '',
    cc: ['finance@mentage.example'],
    replyTo: '',
    notes: '',
  }
  w.clients.push(client)

  const inv = newInvoice(w)
  inv.clientId = client.id
  inv.client = client
  inv.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Brand Identity Design',
      quantity: '1',
      rate: '2500',
      unit: 'fixed',
    },
  ]
  w.invoices.push(inv)
  w = applyCommand(w, { type: 'issue', id: inv.id })

  return { w }
}

describe('Sent Emails & Outbox Activity', () => {
  it('records dispatched emails in workspace messages with all delivery metadata', () => {
    let { w } = fixture()
    const inv = w.invoices[0]

    const msgId = crypto.randomUUID()
    const msg: Message = {
      id: msgId,
      invoiceId: inv.id,
      kind: 'invoice',
      to: inv.client.email,
      cc: inv.client.cc,
      replyTo: w.business.email,
      subject: `Invoice ${inv.number} from ${w.business.name}`,
      body: `Hello ${inv.client.name},\n\nPlease find attached your invoice.`,
      status: 'draft',
      created: new Date().toISOString(),
    }

    w = applyCommand(w, { type: 'message', value: msg })
    expect(w.messages).toHaveLength(1)
    expect(w.messages[0].id).toBe(msgId)
    expect(w.messages[0].status).toBe('draft')

    // Queue for sending
    w = applyCommand(w, { type: 'send', id: msgId })
    expect(w.messages[0].status).toBe('queued')
  })

  it('filters and categorizes messages across delivered, queued, sent, and failed states', () => {
    let { w } = fixture()
    const inv = w.invoices[0]

    // Create delivered invoice message
    const msg1: Message = {
      id: crypto.randomUUID(),
      invoiceId: inv.id,
      kind: 'invoice',
      to: 'sarah@mentage.example',
      cc: [],
      replyTo: '',
      subject: `Invoice ${inv.number}`,
      body: 'Body text',
      status: 'delivered',
      providerId: 'msg_resend_123',
      created: '2026-09-10T10:00:00.000Z',
    }

    // Create queued reminder message
    const msg2: Message = {
      id: crypto.randomUUID(),
      invoiceId: inv.id,
      kind: 'reminder',
      to: 'sarah@mentage.example',
      cc: [],
      replyTo: '',
      subject: `Reminder: Invoice ${inv.number}`,
      body: 'Reminder body text',
      status: 'queued',
      created: '2026-09-11T12:00:00.000Z',
    }

    // Create failed reminder message
    const msg3: Message = {
      id: crypto.randomUUID(),
      invoiceId: inv.id,
      kind: 'reminder',
      to: 'bounced@mentage.example',
      cc: [],
      replyTo: '',
      subject: `Reminder: Invoice ${inv.number}`,
      body: 'Reminder body text',
      status: 'failed',
      error: 'Mailbox does not exist',
      created: '2026-09-12T09:00:00.000Z',
    }

    w.messages = [msg1, msg2, msg3]

    // Verify status queries
    const delivered = w.messages.filter(m => m.status === 'delivered')
    expect(delivered).toHaveLength(1)
    expect(delivered[0].providerId).toBe('msg_resend_123')

    const queued = w.messages.filter(m => ['queued', 'sending'].includes(m.status))
    expect(queued).toHaveLength(1)

    const failed = w.messages.filter(m => ['failed', 'bounced'].includes(m.status))
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toBe('Mailbox does not exist')

    // Verify invoice association
    const invMessages = w.messages.filter(m => m.invoiceId === inv.id)
    expect(invMessages).toHaveLength(3)
  })

  it('allows safe retry of failed delivery without duplicating message rows', () => {
    let { w } = fixture()
    const inv = w.invoices[0]

    const msgId = crypto.randomUUID()
    const msg: Message = {
      id: msgId,
      invoiceId: inv.id,
      kind: 'invoice',
      to: inv.client.email,
      cc: [],
      replyTo: '',
      subject: `Invoice ${inv.number}`,
      body: 'Invoice details',
      status: 'failed',
      error: 'Connection timed out',
      created: new Date().toISOString(),
    }
    w.messages = [msg]

    // Retry sending
    w = applyCommand(w, { type: 'send', id: msgId })
    expect(w.messages).toHaveLength(1)
    expect(w.messages[0].status).toBe('queued')
    expect(w.messages[0].error).toBeUndefined()
  })

  it('includes friendly sender name and anti-spam headers across outgoing dispatches', () => {
    let { w } = fixture()
    const inv = w.invoices[0]

    const fromHeader = formatSenderFrom(`${w.business.name} via InvoiceUI`, 'billing@humza.website')
    expect(fromHeader).toBe('"Apex Design Ltd via InvoiceUI" <billing@humza.website>')

    const msgId = crypto.randomUUID()
    const headers = getDeliverabilityHeaders({
      ownerId: 'owner_abc',
      messageId: msgId,
      kind: 'reminder',
      invoiceNumber: inv.number,
      unsubscribeEmail: w.business.email,
    })

    expect(headers['Auto-Submitted']).toBe('auto-generated')
    expect(headers['X-Auto-Response-Suppress']).toBe('OOF, AutoReply')
    expect(headers['X-Entity-Ref-ID']).toBe(`invoiceui/owner_abc/${msgId}`)
    expect(headers['List-Unsubscribe']).toBeDefined()
  })

  it('strictly ensures zero em dashes and en dashes across all email preview text and HTML', () => {
    let { w } = fixture()
    const inv = w.invoices[0]

    const msg: Message = {
      id: crypto.randomUUID(),
      invoiceId: inv.id,
      kind: 'invoice',
      to: inv.client.email,
      cc: inv.client.cc,
      replyTo: w.business.email,
      subject: `Invoice ${inv.number} from ${w.business.name}`,
      body: 'Please review and settle the attached invoice at your convenience.',
      status: 'sent',
      created: new Date().toISOString(),
    }

    const html = renderInvoiceEmailHtml({
      invoice: inv,
      business: w.business,
      message: msg,
      client: inv.client,
      creditNotes: w.creditNotes,
      publicUrl: 'https://invoiceui.humza.website/api/public/demo/token/invoice',
    })

    const text = renderInvoiceEmailText({
      invoice: inv,
      business: w.business,
      message: msg,
      client: inv.client,
      creditNotes: w.creditNotes,
      publicUrl: 'https://invoiceui.humza.website/api/public/demo/token/invoice',
    })

    expect(html).not.toMatch(/[\u2013\u2014]/)
    expect(text).not.toMatch(/[\u2013\u2014]/)
  })
})
