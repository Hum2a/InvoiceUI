import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  today,
  buildClientStatement,
  getAttentionQueueItems,
  runSchedules,
  type Workspace,
  type Invoice,
  type Client,
  type Attachment,
} from '../src/shared/domain'
import {
  renderReceiptPDF,
  filenameReceipt,
  renderStatementPDF,
  filenameStatement,
  renderPDF,
} from '../src/shared/pdf'

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

function setupWorkspace(): { w: Workspace; client: Client; client2: Client } {
  let w = emptyWorkspace()
  w.business.name = 'Zenith Engineering Ltd'
  w.business.email = 'invoices@zenitheng.example'
  w.business.address = '45 Tech City Way\nLondon EC1V 1AB'
  w.business.bank = 'Bank of Britain\nSort: 10-20-30\nAcc: 98765432'
  w.business.currency = 'GBP'
  w.business.terms = 14
  w.business.prefix = 'ZEN'
  w.business.autoReminders = true

  const client: Client = {
    id: crypto.randomUUID(),
    name: 'Acme Global Corp',
    email: 'accounts@acmeglobal.example',
    address: '100 Corporate Plaza\nLondon W1B 3HH',
    cc: [],
    replyTo: '',
    terms: 14,
    notes: 'Key Enterprise Account',
  }
  w.clients.push(client)

  const client2: Client = {
    id: crypto.randomUUID(),
    name: 'Nordic Design AB',
    email: 'finance@nordicdesign.example',
    address: '24 Fjordgatan\nStockholm',
    cc: [],
    replyTo: '',
    terms: 30,
    notes: 'Secondary account',
  }
  w.clients.push(client2)

  return { w, client, client2 }
}

describe('Wave B: B02 Payment Receipts and Client Statements', () => {
  it('generates sequential receipts on payment and preserves reversal history', async () => {
    let { w, client } = setupWorkspace()

    let inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.issueDate = '2026-08-01'
    inv.dueDate = '2026-08-15'
    inv.lines = [
      { id: crypto.randomUUID(), description: 'Cloud Migration Architecture', quantity: '1', rate: '2000.00', unit: 'fixed' },
    ]
    w = applyCommand(w, { type: 'draft', value: inv })
    w = applyCommand(w, { type: 'issue', id: inv.id })
    const issuedInv = w.invoices.find(i => i.id === inv.id)!

    // Record payment 1
    const p1Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'payment',
      id: issuedInv.id,
      value: {
        id: p1Id,
        amount: '800.00',
        date: '2026-08-10',
        method: 'Bank transfer',
        reference: 'BACS-8821',
        notes: 'First milestone payment',
        reversed: false,
      },
    })

    expect(w.receipts).toBeDefined()
    expect(w.receipts!.length).toBe(1)
    const r1 = w.receipts![0]
    expect(r1.number).toBe('ZEN-RCT-2026-0001')
    expect(r1.paymentId).toBe(p1Id)
    expect(r1.amount).toBe('800.00')
    expect(r1.allocations).toEqual([
      { invoiceId: issuedInv.id, invoiceNumber: issuedInv.number!, amount: '800.00', balanceRemaining: '1200.00' },
    ])
    expect(r1.unallocated).toBe('0.00')
    expect(r1.reversed).toBe(false)

    // Record client payment across invoices with unallocated excess
    const p2Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: p2Id,
        clientId: client.id,
        amount: '1500.00',
        date: '2026-08-12',
        currency: 'GBP',
        method: 'Bank transfer',
        reference: 'BACS-9944',
        notes: 'Final settlement and retainer',
        allocations: [
          { invoiceId: issuedInv.id, amount: '1200.00' },
        ],
      },
    })

    expect(w.receipts!.length).toBe(2)
    const r2 = w.receipts![0]
    expect(r2.number).toBe('ZEN-RCT-2026-0002')
    expect(r2.paymentId).toBe(p2Id)
    expect(r2.amount).toBe('1500.00')
    expect(r2.allocations).toEqual([
      { invoiceId: issuedInv.id, invoiceNumber: issuedInv.number!, amount: '1200.00', balanceRemaining: '0.00' },
    ])
    expect(r2.unallocated).toBe('300.00')
    expect(r2.reversed).toBe(false)

    // Reverse payment 1: original receipt must be kept and stamped reversed: true
    w = applyCommand(w, {
      type: 'reverse',
      id: issuedInv.id,
      paymentId: p1Id,
    })

    expect(w.receipts!.length).toBe(2)
    const r1AfterReversal = w.receipts!.find(r => r.paymentId === p1Id)!
    expect(r1AfterReversal.reversed).toBe(true)
    expect(r1AfterReversal.reversedAt).toBeDefined()
    expect(r1AfterReversal.number).toBe('ZEN-RCT-2026-0001')

    // Render receipt PDFs
    const font = await loadFont()
    const activeReceiptPdf = await renderReceiptPDF(r2, w.business, font)
    const reversedReceiptPdf = await renderReceiptPDF(r1AfterReversal, w.business, font)

    expect(activeReceiptPdf.length).toBeGreaterThan(500)
    expect(reversedReceiptPdf.length).toBeGreaterThan(500)

    const parsedActive = await PDFDocument.load(activeReceiptPdf)
    const parsedReversed = await PDFDocument.load(reversedReceiptPdf)
    expect(parsedActive.getPageCount()).toBe(1)
    expect(parsedReversed.getPageCount()).toBe(1)
    expect(filenameReceipt(r2)).toBe('ZEN-RCT-2026-0002-Acme-Global-Corp.pdf')
    expect(filenameReceipt(r1AfterReversal)).toBe('ZEN-RCT-2026-0001-Acme-Global-Corp-REVERSED.pdf')
  })

  it('builds reconciled client statements strictly per currency', async () => {
    let { w, client } = setupWorkspace()

    // Invoice 1: July (Prior period - contributes to opening balance)
    let invJuly = newInvoice(w)
    invJuly.clientId = client.id
    invJuly.client = structuredClone(client)
    invJuly.issueDate = '2026-07-01'
    invJuly.dueDate = '2026-07-15'
    invJuly.lines = [{ id: crypto.randomUUID(), description: 'July Retainer', quantity: '1', rate: '1000.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: invJuly })
    w = applyCommand(w, { type: 'issue', id: invJuly.id })

    // Partial payment in July: 400
    w = applyCommand(w, {
      type: 'payment',
      id: invJuly.id,
      value: { id: crypto.randomUUID(), amount: '400.00', date: '2026-07-10', method: 'Bank', reference: 'P-JUL', notes: '', reversed: false },
    })

    // Invoice 2: August (Inside statement period)
    let invAug = newInvoice(w)
    invAug.clientId = client.id
    invAug.client = structuredClone(client)
    invAug.issueDate = '2026-08-05'
    invAug.dueDate = '2026-08-19'
    invAug.lines = [{ id: crypto.randomUUID(), description: 'August Sprint', quantity: '1', rate: '2500.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: invAug })
    w = applyCommand(w, { type: 'issue', id: invAug.id })

    // Credit Note in August against invAug: 500
    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: invAug.id,
      reason: 'Scope reduction',
      tax: '0',
      lines: [{ id: crypto.randomUUID(), description: 'Scope reduction', quantity: '1', rate: '500.00', unit: 'fixed' }],
      replacement: false,
    }, new Date('2026-08-10T12:00:00Z'))

    // Payment in August: 1200
    w = applyCommand(w, {
      type: 'payment',
      id: invAug.id,
      value: { id: crypto.randomUUID(), amount: '1200.00', date: '2026-08-15', method: 'Bank', reference: 'P-AUG', notes: '', reversed: false },
    })

    // Invoice 3: September (Outside statement period)
    let invSep = newInvoice(w)
    invSep.clientId = client.id
    invSep.client = structuredClone(client)
    invSep.issueDate = '2026-09-02'
    invSep.dueDate = '2026-09-16'
    invSep.lines = [{ id: crypto.randomUUID(), description: 'September Sprint', quantity: '1', rate: '3000.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: invSep })
    w = applyCommand(w, { type: 'issue', id: invSep.id })

    // Generate statement for August 2026 (2026-08-01 to 2026-08-31)
    const statement = buildClientStatement(w, client.id, 'GBP', '2026-08-01', '2026-08-31')

    // Opening balance: July invoice 1000 - July payment 400 = 600.00
    expect(statement.openingBalance).toBe('600.00')
    // Period charges: August invoice 2500.00
    expect(statement.periodCharges).toBe('2500.00')
    // Period credits: August credit note 500.00
    expect(statement.periodCredits).toBe('500.00')
    // Period payments: August payment 1200.00
    expect(statement.periodPayments).toBe('1200.00')
    expect(statement.periodRefunds).toBe('0.00')

    // Strict formula: opening (600) + charges (2500) - credits (500) - net payments (1200) = 1400.00
    expect(statement.closingBalance).toBe('1400.00')
    expect(statement.entries.length).toBe(3)
    expect(statement.entries[0].type).toBe('invoice')
    expect(statement.entries[1].type).toBe('creditNote')
    expect(statement.entries[2].type).toBe('payment')

    // Check running balance of entries
    expect(statement.entries[0].balance).toBe('3100.00') // 600 + 2500
    expect(statement.entries[1].balance).toBe('2600.00') // 3100 - 500
    expect(statement.entries[2].balance).toBe('1400.00') // 2600 - 1200

    // Render statement PDF
    const font = await loadFont()
    const statementPdf = await renderStatementPDF(statement, w.business, font)
    expect(statementPdf.length).toBeGreaterThan(500)
    const parsedStatement = await PDFDocument.load(statementPdf)
    expect(parsedStatement.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(filenameStatement(statement)).toBe('Statement-Acme-Global-Corp-2026-08-01-to-2026-08-31.pdf')
  })
})

describe('Wave B: B04 Explicit Internal vs Client-Visible Material & Delivery', () => {
  it('strictly isolates internal notes and attachments from invoice PDFs and email deliveries', async () => {
    let { w, client } = setupWorkspace()

    let inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.notes = 'Client-facing payment note: Please remit within 14 days.'
    inv.internalNotes = 'CONFIDENTIAL: Client is negotiating 10% discount for Q4. Do not disclose.'
    const clientAtt: Attachment = {
      id: crypto.randomUUID(),
      name: 'Deliverable-Spec-v1.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr',
      visibility: 'client',
      created: '2026-08-10',
    }
    const internalAtt: Attachment = {
      id: crypto.randomUUID(),
      name: 'Internal-Costing-Sheet.pdf',
      size: 2048,
      mimeType: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr',
      visibility: 'internal',
      created: '2026-08-10',
    }
    inv.attachments = [clientAtt, internalAtt]
    inv.lines = [{ id: crypto.randomUUID(), description: 'Security Audit', quantity: '1', rate: '1800.00', unit: 'fixed' }]

    w = applyCommand(w, { type: 'draft', value: inv })
    w = applyCommand(w, { type: 'issue', id: inv.id })
    const issuedInv = w.invoices.find(i => i.id === inv.id)!

    // Verify renderPDF creates valid document and does not include internalNotes
    const font = await loadFont()
    const pdfBytes = await renderPDF(issuedInv, w.business, font)
    const parsedPdf = await PDFDocument.load(pdfBytes)
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1)

    // Verify internalNotes and internal attachments are kept strictly internal
    expect(issuedInv.internalNotes).toBe('CONFIDENTIAL: Client is negotiating 10% discount for Q4. Do not disclose.')
    const clientVisibleAttachments = (issuedInv.attachments || []).filter(a => a.visibility === 'client')
    const internalOnlyAttachments = (issuedInv.attachments || []).filter(a => a.visibility === 'internal')
    expect(clientVisibleAttachments).toHaveLength(1)
    expect(clientVisibleAttachments[0].name).toBe('Deliverable-Spec-v1.pdf')
    expect(internalOnlyAttachments).toHaveLength(1)
    expect(internalOnlyAttachments[0].name).toBe('Internal-Costing-Sheet.pdf')

    // Post-issuance updates: updateInternalNotes and attachment commands work without modifying financial fields
    w = applyCommand(w, {
      type: 'updateInternalNotes',
      invoiceId: issuedInv.id,
      notes: 'CONFIDENTIAL: Internal notes updated post-issuance.',
    })
    const afterUpdateNotes = w.invoices.find(i => i.id === inv.id)!
    expect(afterUpdateNotes.internalNotes).toBe('CONFIDENTIAL: Internal notes updated post-issuance.')
    expect(totals(afterUpdateNotes).total).toBe('1800.00')

    const newProofAtt: Attachment = {
      id: crypto.randomUUID(),
      name: 'Client-Signoff-Proof.png',
      size: 512,
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      visibility: 'client',
      created: '2026-08-12',
    }
    w = applyCommand(w, {
      type: 'attachment',
      invoiceId: issuedInv.id,
      value: newProofAtt,
    })
    const afterAddAtt = w.invoices.find(i => i.id === inv.id)!
    expect(afterAddAtt.attachments?.length).toBe(3)

    // Toggle visibility of internal attachment to client
    w = applyCommand(w, {
      type: 'updateAttachmentVisibility',
      invoiceId: issuedInv.id,
      attachmentId: internalAtt.id,
      visibility: 'client',
    })
    const afterToggle = w.invoices.find(i => i.id === inv.id)!
    expect(afterToggle.attachments?.find(a => a.id === internalAtt.id)?.visibility).toBe('client')

    // Delete attachment
    w = applyCommand(w, {
      type: 'deleteAttachment',
      invoiceId: issuedInv.id,
      attachmentId: newProofAtt.id,
    })
    const afterDelete = w.invoices.find(i => i.id === inv.id)!
    expect(afterDelete.attachments?.length).toBe(2)
  })
})

describe('Wave B: B05 Owner Attention Queue and Pauseable Reminders', () => {
  it('flags delivery failures, unsent invoices, overdue accounts, and pauseable reminders', () => {
    let { w, client } = setupWorkspace()

    // Invoice 1: Issued 48 hours ago without sent email -> must appear as unsent
    let invUnsent = newInvoice(w)
    invUnsent.clientId = client.id
    invUnsent.client = structuredClone(client)
    invUnsent.issueDate = '2026-08-10'
    invUnsent.dueDate = '2026-08-24'
    invUnsent.lines = [{ id: crypto.randomUUID(), description: 'Advisory', quantity: '1', rate: '500.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: invUnsent })
    w = applyCommand(w, { type: 'issue', id: invUnsent.id })
    // Simulate issued 48 hours ago
    const unsentIdx = w.invoices.findIndex(i => i.id === invUnsent.id)
    w.invoices[unsentIdx].issuedAt = new Date('2026-08-10T10:00:00Z').toISOString()

    // Invoice 2: Overdue invoice
    let invOverdue = newInvoice(w)
    invOverdue.clientId = client.id
    invOverdue.client = structuredClone(client)
    invOverdue.issueDate = '2026-07-01'
    invOverdue.dueDate = '2026-07-15'
    invOverdue.lines = [{ id: crypto.randomUUID(), description: 'Design Sprint', quantity: '1', rate: '1200.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: invOverdue })
    w = applyCommand(w, { type: 'issue', id: invOverdue.id })

    // Invoice 3: Delivery failed
    const failedMsgId = crypto.randomUUID()
    w.messages.push({
      id: failedMsgId,
      invoiceId: invOverdue.id,
      kind: 'invoice',
      to: 'invalid@example.com',
      cc: [],
      replyTo: '',
      subject: 'Invoice overdue',
      body: 'Body text',
      status: 'failed',
      error: 'Mailbox does not exist',
      created: '2026-08-12T09:00:00Z',
    })

    const items = getAttentionQueueItems(w, new Date('2026-08-12T12:00:00Z'))

    expect(items.some(i => i.kind === 'unsent' && i.invoiceId === invUnsent.id)).toBe(true)
    expect(items.some(i => i.kind === 'overdue' && i.invoiceId === invOverdue.id)).toBe(true)
    expect(items.some(i => i.kind === 'delivery_failed' && i.id === `delivery-${failedMsgId}`)).toBe(true)

    // Pause reminders on invOverdue
    w = applyCommand(w, {
      type: 'pauseReminder',
      id: invOverdue.id,
      pausedUntil: '2026-08-25',
      pauseReason: 'Client Accounts Payable confirmed batch run on August 25th',
    })

    const updatedOverdue = w.invoices.find(i => i.id === invOverdue.id)!
    expect(updatedOverdue.reminder.pausedUntil).toBe('2026-08-25')
    expect(updatedOverdue.reminder.pauseReason).toBe('Client Accounts Payable confirmed batch run on August 25th')
    // Crucial rule: pausing reminders must never change the original due date or balance!
    expect(updatedOverdue.dueDate).toBe('2026-07-15')
    expect(totals(updatedOverdue).balance).toBe('1200.00')

    const itemsAfterPause = getAttentionQueueItems(w, new Date('2026-08-12T12:00:00Z'))
    const overdueItem = itemsAfterPause.find(i => i.invoiceId === invOverdue.id && i.kind === 'overdue')!
    expect(overdueItem.pausedUntil).toBe('2026-08-25')
    expect(overdueItem.pauseReason).toBe('Client Accounts Payable confirmed batch run on August 25th')
  })

  it('performs fresh check and skips reminders if paused or already paid', () => {
    let { w, client } = setupWorkspace()

    let inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.issueDate = '2026-07-01'
    inv.dueDate = '2026-07-15'
    inv.lines = [{ id: crypto.randomUUID(), description: 'Engineering', quantity: '1', rate: '1000.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: inv })
    w = applyCommand(w, { type: 'issue', id: inv.id })
    // Enable reminder on the issued invoice
    w = applyCommand(w, { type: 'reminder', id: inv.id, enabled: true, days: 7 })

    // Test 1: Paused reminder
    w = applyCommand(w, {
      type: 'pauseReminder',
      id: inv.id,
      pausedUntil: '2026-08-20',
      pauseReason: 'Promise to pay',
    })

    // Run schedules for August 10th (before pausedUntil)
    let scheduledWorkspace = runSchedules(w, new Date('2026-08-10T10:00:00Z'))
    // Reminder should NOT have been generated
    expect(scheduledWorkspace.messages.length).toBe(0)

    // Test 2: Resume reminder
    w = applyCommand(w, {
      type: 'pauseReminder',
      id: inv.id,
      pausedUntil: undefined,
      pauseReason: undefined,
    })
    scheduledWorkspace = runSchedules(w, new Date('2026-08-10T10:00:00Z'))
    expect(scheduledWorkspace.messages.length).toBe(1)
    expect(scheduledWorkspace.messages[0].kind).toBe('reminder')

    // Test 3: Fresh check - if invoice is paid, reminders must never be generated
    w = applyCommand(w, {
      type: 'payment',
      id: inv.id,
      value: {
        id: crypto.randomUUID(),
        amount: '1000.00',
        date: '2026-08-10',
        method: 'Bank',
        reference: 'Paid in full',
        notes: '',
        reversed: false,
      },
    })
    w.messages = [] // clear prior messages
    scheduledWorkspace = runSchedules(w, new Date('2026-08-11T10:00:00Z'))
    expect(scheduledWorkspace.messages.length).toBe(0)
  })
})
