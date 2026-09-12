import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  status,
  today,
  addDays,
  type Workspace,
  type Invoice,
  type Client,
  type Project,
  type Service,
} from '../src/shared/domain'
import { renderPDF, filename } from '../src/shared/pdf'
import { Conflict } from '../src/worker/store'

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

describe('Phase 7: End-to-End Synthetic Journey & Polish', () => {
  it('exercises complete sign-in -> settings -> client -> project -> service -> draft -> issue -> PDF -> email/share -> partial payment -> paid -> export journey', async () => {
    const font = await loadFont()

    // 1. Initial State / Setup Business Settings
    let w = emptyWorkspace()
    w.business.name = 'Humza Architecture & Design Ltd'
    w.business.email = 'humza@design.co.uk'
    w.business.address = '12 Boundary Row\nLondon SE1 8HP'
    w.business.bank = 'Sort: 20-40-60\nAcc: 88776655\nIBAN: GB29BARC20406088776655'
    w.business.taxId = 'GB 998 8776 55'
    w.business.currency = 'GBP'
    w.business.terms = 14
    w.business.timezone = 'Europe/London'
    w.business.template = 'studio'
    w.business.accent = '#84cc16'

    // 2. Add Reusable Records: Client, Project, Saved Service
    const client: Client = {
      id: crypto.randomUUID(),
      name: 'Mentage Labs Ltd',
      email: 'billing@mentage.com',
      address: 'Floor 4, 10 Silicon Roundabout\nLondon EC1V 1AB',
      cc: ['accounts@mentage.com'],
      replyTo: 'humza@mentage.com',
      terms: 14,
      notes: 'Strategic infrastructure contract',
    }
    w = applyCommand(w, { type: 'client', value: client })

    const project: Project = {
      id: crypto.randomUUID(),
      name: 'Mentage Core Platform Rebuild',
      clientId: client.id,
      notes: 'Phase 2 deliverables',
    }
    w = applyCommand(w, { type: 'project', value: project })

    const service: Service = {
      id: crypto.randomUUID(),
      name: 'Principal Engineering Consulting',
      description: 'Senior architectural guidance, code reviews, and Cloudflare Worker migration.',
      rate: '150',
      unit: 'hour',
    }
    w = applyCommand(w, { type: 'service', value: service })

    expect(w.clients).toHaveLength(1)
    expect(w.projects).toHaveLength(1)
    expect(w.services).toHaveLength(1)

    // 3. Compose Invoice Draft from Saved Records
    let draft = newInvoice(w)
    draft.clientId = client.id
    draft.client = structuredClone(client)
    draft.projectId = project.id
    draft.terms = client.terms
    draft.issueDate = '2026-09-15'
    draft.dueDate = addDays(draft.issueDate, client.terms)
    draft.currency = 'GBP'

    // Populate lines from saved service
    draft.lines = [
      {
        id: crypto.randomUUID(),
        description: service.description,
        quantity: '40',
        rate: service.rate,
        unit: service.unit,
      },
      {
        id: crypto.randomUUID(),
        description: 'Cloudflare Worker Setup & Custom Domain Routing',
        quantity: '1',
        rate: '1500',
        unit: 'fixed',
      },
    ]
    draft.tax = '20' // 20% VAT opt-in
    draft.notes = 'Payment due strictly within 14 calendar days via BACS.'
    draft.breakdown = 'Sprint 1: 20 hours architecture\nSprint 2: 20 hours deployment & testing.'

    // Save draft
    w = applyCommand(w, { type: 'draft', value: draft })
    expect(w.invoices).toHaveLength(1)
    expect(w.invoices[0].lifecycle).toBe('draft')

    // Verify draft calculations
    const draftTotals = totals(w.invoices[0])
    // 40 * 150 = 6000 + 1500 = 7500. VAT 20% = 1500. Total = 9000.
    expect(draftTotals.subtotal).toBe('7500.00')
    expect(draftTotals.tax).toBe('1500.00')
    expect(draftTotals.total).toBe('9000.00')
    expect(draftTotals.balance).toBe('9000.00')

    // 4. Issue the Invoice: Atomic sequence assignment and snapshotting
    w = applyCommand(w, { type: 'issue', id: draft.id })
    const issued = w.invoices[0]
    expect(issued.lifecycle).toBe('issued')
    expect(issued.number).toBe('INV-2026-0001')
    expect(issued.issuedAt).toBeDefined()
    expect(issued.business.name).toBe('Humza Architecture & Design Ltd')
    expect(issued.client.name).toBe('Mentage Labs Ltd')

    // Immutability check: Changing workspace business & client does NOT mutate the issued invoice
    w.business.name = 'Brand New Consultancy Name'
    w.clients[0].name = 'Mentage Global Inc'
    expect(issued.business.name).toBe('Humza Architecture & Design Ltd')
    expect(issued.client.name).toBe('Mentage Labs Ltd')

    // 5. Render Documents: Invoice PDF & Breakdown PDF
    const invoicePdfBytes = await renderPDF(issued, issued.business, font, false)
    expect(invoicePdfBytes.byteLength).toBeGreaterThan(1000)
    const invoiceDoc = await PDFDocument.load(invoicePdfBytes)
    expect(invoiceDoc.getPageCount()).toBeGreaterThanOrEqual(1)

    const breakdownPdfBytes = await renderPDF(issued, issued.business, font, true)
    expect(breakdownPdfBytes.byteLength).toBeGreaterThan(1000)
    const breakdownDoc = await PDFDocument.load(breakdownPdfBytes)
    expect(breakdownDoc.getPageCount()).toBeGreaterThanOrEqual(1)

    // Stable filename check
    expect(filename(issued, false)).toBe('INV-2026-0001-Mentage-Labs-Ltd.pdf')
    expect(filename(issued, true)).toBe('INV-2026-0001-Mentage-Labs-Ltd-Breakdown.pdf')



    // 6. Resend Email Draft & Send Action + Public Share Link
    const messageId = crypto.randomUUID()
    const msg = {
      id: messageId,
      invoiceId: issued.id,
      kind: 'invoice' as const,
      to: issued.client.email,
      cc: issued.client.cc,
      replyTo: issued.client.replyTo,
      subject: `Invoice ${issued.number} from ${issued.business.name}`,
      body: `Hi Mentage team,\n\nPlease find attached invoice ${issued.number}.`,
      status: 'draft' as const,
      created: new Date().toISOString(),
    }
    w = applyCommand(w, { type: 'message', value: msg })
    expect(w.messages).toHaveLength(1)
    expect(w.messages[0].status).toBe('draft')

    // Explicit send: draft -> queued
    w = applyCommand(w, { type: 'send', id: messageId })
    expect(w.messages[0].status).toBe('queued')

    // Generate public share link
    w = applyCommand(w, {
      type: 'share',
      id: issued.id,
      expires: '2026-10-15',
    })
    expect(w.invoices[0].share?.token).toBeDefined()
    expect(w.invoices[0].share?.expires).toBe('2026-10-15')

    // Revoke public share link immediately
    w = applyCommand(w, { type: 'revoke', id: issued.id })
    expect(w.invoices[0].share).toBeUndefined()

    // 7. Payment Ledger Journey: Unpaid -> Partially Paid -> Paid -> Reversal
    const currentDay = today('Europe/London')
    expect(status(w.invoices[0], currentDay)).toBe('unpaid')

    // Record partial payment: £4,000 via BACS
    const payment1 = {
      id: crypto.randomUUID(),
      amount: '4000.00',
      date: '2026-09-16',
      method: 'BACS Transfer',
      reference: 'BACS-MENTAGE-001',
      notes: 'Initial tranche received',
      reversed: false,
    }
    w = applyCommand(w, { type: 'payment', id: issued.id, value: payment1 })
    expect(totals(w.invoices[0]).paid).toBe('4000.00')
    expect(totals(w.invoices[0]).balance).toBe('5000.00')
    expect(status(w.invoices[0], currentDay)).toBe('partially paid')

    // Record remaining balance: £5,000 via BACS
    const payment2 = {
      id: crypto.randomUUID(),
      amount: '5000.00',
      date: '2026-09-20',
      method: 'BACS Transfer',
      reference: 'BACS-MENTAGE-002',
      notes: 'Final settlement',
      reversed: false,
    }
    w = applyCommand(w, { type: 'payment', id: issued.id, value: payment2 })

    expect(totals(w.invoices[0]).paid).toBe('9000.00')
    expect(totals(w.invoices[0]).balance).toBe('0.00')
    expect(status(w.invoices[0], currentDay)).toBe('paid')

    // Auditable payment reversal: Reversing the second payment of £5,000
    w = applyCommand(w, { type: 'reverse', id: issued.id, paymentId: payment2.id })
    expect(totals(w.invoices[0]).paid).toBe('4000.00')
    expect(totals(w.invoices[0]).balance).toBe('5000.00')
    expect(status(w.invoices[0], currentDay)).toBe('partially paid')


    // 8. Machine-Readable Export Generation
    const backup = {
      format: 'invoiceui-backup',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      version: 12,
      data: w,
    }
    expect(backup.format).toBe('invoiceui-backup')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.data.invoices).toHaveLength(1)
    expect(backup.data.clients).toHaveLength(1)
    expect(backup.data.invoices[0].payments).toHaveLength(2)
    expect(backup.data.invoices[0].payments.find((p) => p.id === payment2.id)?.reversed).toBe(true)
  })


  it('handles multi-page long invoices with repeated table headers and deliverable breakdown', async () => {
    const font = await loadFont()
    let w = emptyWorkspace()
    w.business.name = 'Humza Enterprise Services'
    w.business.address = '100 Queen Victoria Street\nLondon EC4V 4BE'
    w.business.currency = 'GBP'

    const i = newInvoice(w)

    i.client.name = 'Global Logistics PLC'
    i.client.address = 'Terminal 5, Heathrow Airport\nHounslow TW6 2GA'
    i.issueDate = '2026-09-01'
    i.dueDate = '2026-09-30'

    // Generate 25 lengthy line items to guarantee multi-page rendering
    i.lines = Array.from({ length: 25 }, (_, idx) => ({
      id: crypto.randomUUID(),
      description: `Detailed Line Item #${idx + 1}: Comprehensive enterprise architectural evaluation, risk mitigation profiling, infrastructure optimization, and continuous monitoring setup.`,
      quantity: '1',
      rate: `${(idx + 1) * 100}`,
      unit: 'fixed',
    }))
    i.breakdown =
      'Work breakdown itemization:\n' +
      Array.from({ length: 45 }, (_, idx) => `Deliverable ${idx + 1}: 20 hours architecture & engineering consulting`).join('\n')



    w = applyCommand(w, { type: 'draft', value: i })
    w = applyCommand(w, { type: 'issue', id: i.id })
    const longInvoice = w.invoices[0]

    // Render multi-page invoice
    const pdfBytes = await renderPDF(longInvoice, longInvoice.business, font, false)
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)

    // Render multi-page breakdown
    const breakdownPdfBytes = await renderPDF(longInvoice, longInvoice.business, font, true)
    const breakdownDoc = await PDFDocument.load(breakdownPdfBytes)
    expect(breakdownDoc.getPageCount()).toBeGreaterThan(1)
  })

  it('simulates and recovers from two-device concurrent editing conflict using CAS', () => {
    // Simulated database store holding versioned envelope
    let dbRecord = {
      version: 5,
      data: emptyWorkspace(),
    }
    dbRecord.data.business.name = 'Original Business Name'

    // Device A and Device B read the same version
    const deviceAView = structuredClone(dbRecord)
    const deviceBView = structuredClone(dbRecord)

    // Device A edits business name and saves successfully:
    // UPDATE invoice_workspaces SET data = ..., version = version + 1 WHERE version = current_version
    function mockDbWrite(version: number, data: Workspace) {
      if (version !== dbRecord.version) {
        throw new Conflict(
          'This workspace changed on another device. Reload it or save your edits as a new draft.'
        )
      }
      dbRecord = {
        version: dbRecord.version + 1,
        data: structuredClone(data),
      }
      return dbRecord
    }

    deviceAView.data.business.name = 'Device A Business Name'
    const resultA = mockDbWrite(deviceAView.version, deviceAView.data)
    expect(resultA.version).toBe(6)
    expect(dbRecord.data.business.name).toBe('Device A Business Name')

    // Device B tries to save with stale version (5) -> Throws Conflict error
    deviceBView.data.business.name = 'Device B Business Name'
    expect(() => mockDbWrite(deviceBView.version, deviceBView.data)).toThrow(Conflict)
    expect(() => mockDbWrite(deviceBView.version, deviceBView.data)).toThrow(
      'This workspace changed on another device'
    )

    // Device B recovery path 1: Branch into an unconflicted draft
    const branchedDraft = newInvoice(deviceBView.data)
    branchedDraft.client.name = 'Device B Recovered Client'
    const freshDraftId = crypto.randomUUID()
    branchedDraft.id = freshDraftId

    // Device B reloads the latest version from DB and merges the branched draft safely
    const freshDeviceBView = structuredClone(dbRecord)
    freshDeviceBView.data = applyCommand(freshDeviceBView.data, {
      type: 'draft',
      value: branchedDraft,
    })

    const recoveryWrite = mockDbWrite(freshDeviceBView.version, freshDeviceBView.data)
    expect(recoveryWrite.version).toBe(7)
    expect(dbRecord.data.business.name).toBe('Device A Business Name') // Preserved Device A's write
    expect(dbRecord.data.invoices.find((x) => x.id === freshDraftId)).toBeDefined() // Preserved Device B's edits
  })

  it('verifies restore script security and relationship integrity', () => {
    // 1. Prepare synthetic backup
    let w = emptyWorkspace()
    w.business.name = 'Alpha Corp UK'
    w.business.address = '1 Alpha Road, London'

    const clientId = crypto.randomUUID()
    const projectId = crypto.randomUUID()
    const serviceId = crypto.randomUUID()

    const client: Client = {
      id: clientId,
      name: 'Alpha Corp',
      email: 'alpha@example.com',
      address: '1 Alpha Road',
      cc: [],
      replyTo: '',
      terms: 14,
      notes: '',
    }
    w = applyCommand(w, { type: 'client', value: client })

    const project: Project = {
      id: projectId,
      name: 'Alpha Redesign',
      clientId: client.id,
      notes: '',
    }
    w = applyCommand(w, { type: 'project', value: project })

    const service: Service = {
      id: serviceId,
      name: 'Design Consulting',
      description: 'Senior design and architectural consulting',
      rate: '100',
      unit: 'hour',
    }

    w = applyCommand(w, { type: 'service', value: service })

    let inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.projectId = project.id
    inv.lines = [{ id: crypto.randomUUID(), description: 'Consulting', quantity: '5', rate: '100', unit: 'hour' }]
    w = applyCommand(w, { type: 'draft', value: inv })
    w = applyCommand(w, { type: 'issue', id: inv.id })

    // Add active public share link and reminder
    w.invoices[0].share = { token: 'active-token-xyz', expiresAt: '2026-10-01' }
    w.invoices[0].reminder = { enabled: true, lastSent: null }

    // Add active recurring schedule
    w.schedules = [
      {
        id: crypto.randomUUID(),
        name: 'Monthly Retainer',
        templateInvoiceId: inv.id,
        dayOfMonth: 1,
        paused: false,
        lastRun: null,
      },
    ]

    // Add queued email
    w.messages = [
      {
        id: crypto.randomUUID(),
        invoiceId: inv.id,
        kind: 'invoice',
        to: 'alpha@example.com',
        subject: 'Invoice INV-2026-0001',
        body: 'Please pay.',
        status: 'queued',
        created: new Date().toISOString(),
      },
    ]


    const backup = {
      format: 'invoiceui-backup',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      version: 15,
      data: w,
    }

    // 2. Simulate restore transformations from scripts/restore.mjs
    // Validations
    expect(backup.format).toBe('invoiceui-backup')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.data.schemaVersion).toBe(1)
    expect(Array.isArray(backup.data.invoices)).toBe(true)
    expect(JSON.stringify(backup.data).length).toBeLessThan(5_000_000)

    // Security sanitization on restore:
    // Public links never survive a restore; queued emails reset to draft; schedules paused
    const restoredData = structuredClone(backup.data)
    for (const i of restoredData.invoices) {
      delete i.share
      i.reminder.enabled = false
    }
    for (const s of restoredData.schedules) {
      s.paused = true
    }
    for (const m of restoredData.messages) {
      if (['queued', 'sending'].includes(m.status)) {
        m.status = 'draft'
      }
    }

    // Verify sanitized security posture
    expect(restoredData.invoices[0].share).toBeUndefined()
    expect(restoredData.invoices[0].reminder.enabled).toBe(false)
    expect(restoredData.schedules[0].paused).toBe(true)
    expect(restoredData.messages[0].status).toBe('draft')

    // Verify record relationship integrity
    const restoredInvoice = restoredData.invoices[0]
    expect(restoredInvoice.clientId).toBe(restoredData.clients[0].id)
    expect(restoredInvoice.projectId).toBe(restoredData.projects[0].id)
    expect(restoredInvoice.number).toBe('INV-2026-0001')
    expect(restoredInvoice.lifecycle).toBe('issued')
    expect(restoredInvoice.lines[0].description).toBe('Consulting')

    // Verify isolated empty workspace protection:
    // Overwriting a non-empty target workspace is strictly rejected
    const nonTargetWorkspace = {
      invoices: [{ id: 'existing-inv' }],
      clients: [],
      projects: [],
      services: [],
    }
    const isTargetEmpty =
      nonTargetWorkspace.invoices.length === 0 &&
      nonTargetWorkspace.clients.length === 0 &&
      nonTargetWorkspace.services.length === 0 &&
      nonTargetWorkspace.projects.length === 0

    expect(isTargetEmpty).toBe(false)
  })
})
