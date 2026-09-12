import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  status,
  money,
  clientAvailableCredit,
  suggestPaymentAllocations,
  buildInvoiceTimeline,
  type Workspace,
  type Invoice,
  type Client,
} from '../src/shared/domain'
import { renderCreditNotePDF, filenameCreditNote } from '../src/shared/pdf'

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

function setupWorkspace(): { w: Workspace; client: Client; client2: Client } {
  let w = emptyWorkspace()
  w.business.name = 'Apex Design Studio Ltd'
  w.business.email = 'billing@apexstudio.co.uk'
  w.business.address = '100 Brick Lane\nLondon E1 6RU'
  w.business.bank = 'Apex Studio Ltd\nSort: 04-00-04\nAcc: 12345678'
  w.business.currency = 'GBP'
  w.business.terms = 30
  w.business.prefix = 'APX'

  const client: Client = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Horizon Retail Ltd',
    email: 'accounts@horizon.co.uk',
    address: '42 Oxford Street\nLondon W1D 1BS',
    cc: [],
    replyTo: '',
    terms: 14,
    notes: 'Important client',
  }
  w.clients.push(client)

  const client2: Client = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Vanguard Media Group',
    email: 'finance@vanguard.co.uk',
    address: '88 Kingsway\nLondon WC2B 6AA',
    cc: [],
    replyTo: '',
    terms: 30,
    notes: 'Second client',
  }
  w.clients.push(client2)

  return { w, client, client2 }
}

describe('Wave B: B01 Immutable Invoice Corrections and Credit Notes', () => {
  it('creates full credit note and links replacement draft', () => {
    let { w, client } = setupWorkspace()

    // 1. Create and issue invoice
    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [
      { id: crypto.randomUUID(), description: 'Brand Identity Strategy', quantity: '1', rate: '1000.00', unit: 'fixed' },
      { id: crypto.randomUUID(), description: 'Design Guidelines', quantity: '1', rate: '500.00', unit: 'fixed' },
    ]
    inv.tax = '20'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })

    const issued = w.invoices.find(x => x.id === inv.id)!
    expect(issued.lifecycle).toBe('issued')
    expect(issued.number).toBe('APX-2026-0001')
    const tBefore = totals(issued, w.creditNotes)
    expect(tBefore.total).toBe('1800.00')
    expect(tBefore.balance).toBe('1800.00')

    // 2. Issue full credit note with replacement requested
    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: issued.id,
      reason: 'Billing address error on original invoice - reissue required',
      lines: issued.lines,
      tax: '20',
      replacement: true,
    })

    // Verify credit note
    expect(w.creditNotes).toHaveLength(1)
    const cn = w.creditNotes![0]
    expect(cn.number).toBe('APX-CR-2026-0001')
    expect(cn.invoiceId).toBe(issued.id)
    expect(cn.invoiceNumber).toBe('APX-2026-0001')
    expect(cn.total).toBe('1800.00')
    expect(cn.subtotal).toBe('1500.00')
    expect(cn.taxAmount).toBe('300.00')
    expect(cn.reason).toContain('Billing address error')
    expect(cn.replacementDraftId).toBeDefined()

    // Verify original invoice state
    const afterCredit = w.invoices.find(x => x.id === issued.id)!
    expect(afterCredit.creditNoteIds).toContain(cn.id)
    expect(afterCredit.replacementDraftId).toBe(cn.replacementDraftId)
    const tAfter = totals(afterCredit, w.creditNotes)
    expect(tAfter.credited).toBe('1800.00')
    expect(tAfter.adjustedTotal).toBe('0.00')
    expect(tAfter.balance).toBe('0.00')
    expect(status(afterCredit, undefined, w.creditNotes)).toBe('credited')

    // Verify replacement draft
    const replacementDraft = w.invoices.find(x => x.id === cn.replacementDraftId)!
    expect(replacementDraft).toBeDefined()
    expect(replacementDraft.lifecycle).toBe('draft')
    expect(replacementDraft.number).toBe('')
    expect(replacementDraft.replacementOf).toBe(issued.id)
    expect(replacementDraft.lines).toHaveLength(2)
    expect(replacementDraft.tax).toBe('20')
    expect(totals(replacementDraft).total).toBe('1800.00')
  })

  it('handles partial credit note reducing line items and tax with remaining balance', () => {
    let { w, client } = setupWorkspace()

    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [
      { id: 'line-1', description: 'Consulting Day 1', quantity: '1', rate: '600.00', unit: 'fixed' },
      { id: 'line-2', description: 'Consulting Day 2', quantity: '1', rate: '600.00', unit: 'fixed' },
    ]
    inv.tax = '20'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })

    const issued = w.invoices.find(x => x.id === inv.id)!
    expect(totals(issued, w.creditNotes).total).toBe('1440.00')

    // Credit only Day 2 (£600 + 20% tax = £720 credit)
    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: issued.id,
      reason: 'Day 2 rescheduled and credited',
      lines: [{ id: crypto.randomUUID(), description: 'Consulting Day 2', quantity: '1', rate: '600.00', unit: 'fixed' }],
      tax: '20',
      replacement: false,
    })

    const afterCredit = w.invoices.find(x => x.id === issued.id)!
    const t = totals(afterCredit, w.creditNotes)
    expect(t.total).toBe('1440.00')
    expect(t.credited).toBe('720.00')
    expect(t.adjustedTotal).toBe('720.00')
    expect(t.balance).toBe('720.00')
    expect(status(afterCredit, undefined, w.creditNotes)).toBe('unpaid')
  })

  it('enforces ceiling guard: rejects credit exceeding eligible invoice balance', () => {
    let { w, client } = setupWorkspace()

    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [{ id: crypto.randomUUID(), description: 'Development work', quantity: '10', rate: '50.00', unit: 'hour' }]
    inv.tax = '0'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })

    const issued = w.invoices.find(x => x.id === inv.id)!
    expect(totals(issued, w.creditNotes).total).toBe('500.00')

    // Attempting credit for £600 on a £500 invoice
    expect(() => {
      applyCommand(w, {
        type: 'creditNote',
        invoiceId: issued.id,
        reason: 'Excessive credit request',
        lines: [{ id: crypto.randomUUID(), description: 'Development work', quantity: '12', rate: '50.00', unit: 'hour' }],
        tax: '0',
        replacement: false,
      })
    }).toThrow(/Credit amount exceeds remaining eligible invoice balance/)
  })

  it('returns excess paid amount to client unallocated credit when crediting already-paid invoice', () => {
    let { w, client } = setupWorkspace()

    // 1. Issue invoice for £500
    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [{ id: crypto.randomUUID(), description: 'Workshop facilitation', quantity: '1', rate: '500.00', unit: 'fixed' }]
    inv.tax = '0'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })
    const issued = w.invoices.find(x => x.id === inv.id)!

    // 2. Client pays £500
    const paymentId = '33333333-3333-4333-8333-333333333333'
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: paymentId,
        clientId: client.id,
        currency: 'GBP',
        amount: '500.00',
        date: '2026-09-02',
        method: 'Bank transfer',
        reference: 'TRX-100',
        notes: 'Full payment received',
        allocations: [{ invoiceId: issued.id, amount: '500.00' }],
      },
    })

    const paidInvoice = w.invoices.find(x => x.id === issued.id)!
    expect(totals(paidInvoice, w.creditNotes).balance).toBe('0.00')
    expect(status(paidInvoice, undefined, w.creditNotes)).toBe('paid')
    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('0.00')

    // 3. Issue full credit note for £500
    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: issued.id,
      reason: 'Workshop cancelled due to emergency - full credit issued',
      lines: issued.lines,
      tax: '0',
      replacement: false,
    })

    // Invoice should be credited, adjustedTotal = 0, balance = 0
    const creditedInvoice = w.invoices.find(x => x.id === issued.id)!
    const t = totals(creditedInvoice, w.creditNotes)
    expect(t.credited).toBe('500.00')
    expect(t.adjustedTotal).toBe('0.00')
    expect(t.balance).toBe('0.00')
    expect(status(creditedInvoice, undefined, w.creditNotes)).toBe('credited')

    // Client's payment should now have £500 returned to unallocated credit pool!
    const clientPayment = w.payments!.find(p => p.id === paymentId)!
    expect(clientPayment.unallocated).toBe('500.00')
    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('500.00')
  })

  it('renders credit note PDF with dedicated header and original reference', async () => {
    const { w, client } = setupWorkspace()
    const fontBytes = await loadFont()

    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [{ id: crypto.randomUUID(), description: 'UX Research Sprint', quantity: '1', rate: '1200.00', unit: 'fixed' }]
    inv.tax = '20'
    w.invoices.unshift(inv)
    const afterIssue = applyCommand(w, { type: 'issue', id: inv.id })
    const issued = afterIssue.invoices.find(x => x.id === inv.id)!

    const afterCredit = applyCommand(afterIssue, {
      type: 'creditNote',
      invoiceId: issued.id,
      reason: 'Scope adjustment agreed in sprint retrospective',
      lines: issued.lines,
      tax: '20',
      replacement: false,
    })

    const cn = afterCredit.creditNotes![0]
    const pdfBytes = await renderCreditNotePDF(cn, w.business, fontBytes)
    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(1000)

    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toContain('Credit Note')

    const cleanFilename = filenameCreditNote(cn)
    expect(cleanFilename).toMatch(/^APX-CR-2026-0001-Horizon-Retail-Ltd\.pdf$/)
  })
})

describe('Wave B: B03 Canonical Client Payments with Allocations and Refunds', () => {
  it('suggests payment allocations oldest-due first and distributes correctly', () => {
    let { w, client } = setupWorkspace()

    // Create 2 issued invoices with different due dates
    const inv1 = newInvoice(w)
    inv1.clientId = client.id
    inv1.client = structuredClone(client)
    inv1.issueDate = '2026-09-01'
    inv1.dueDate = '2026-09-20'
    inv1.lines = [{ id: crypto.randomUUID(), description: 'Sprint 1', quantity: '1', rate: '300.00', unit: 'fixed' }]
    inv1.tax = '0'
    w.invoices.unshift(inv1)
    w = applyCommand(w, { type: 'issue', id: inv1.id })

    const inv2 = newInvoice(w)
    inv2.clientId = client.id
    inv2.client = structuredClone(client)
    inv2.issueDate = '2026-09-10'
    inv2.dueDate = '2026-09-30'
    inv2.lines = [{ id: crypto.randomUUID(), description: 'Sprint 2', quantity: '1', rate: '400.00', unit: 'fixed' }]
    inv2.tax = '0'
    w.invoices.unshift(inv2)
    w = applyCommand(w, { type: 'issue', id: inv2.id })

    // Test suggestPaymentAllocations for £450
    const suggestions = suggestPaymentAllocations('450.00', 'GBP', w.invoices, w.creditNotes)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].invoiceId).toBe(inv1.id)
    expect(suggestions[0].amount).toBe('300.00') // Full balance of oldest
    expect(suggestions[1].invoiceId).toBe(inv2.id)
    expect(suggestions[1].amount).toBe('150.00') // Partial balance of newer

    // Apply client payment based on suggestions
    const paymentId = '44444444-4444-4444-8444-444444444444'
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: paymentId,
        clientId: client.id,
        currency: 'GBP',
        amount: '450.00',
        date: '2026-09-01',
        method: 'BACS',
        reference: 'INV-BUNDLE-01',
        notes: 'Payment for sprints 1 and partial 2',
        allocations: [
          { invoiceId: inv1.id, amount: '300.00' },
          { invoiceId: inv2.id, amount: '150.00' },
        ],
      },
    })

    const afterInv1 = w.invoices.find(x => x.id === inv1.id)!
    const afterInv2 = w.invoices.find(x => x.id === inv2.id)!

    expect(totals(afterInv1, w.creditNotes).balance).toBe('0.00')
    expect(status(afterInv1, undefined, w.creditNotes)).toBe('paid')

    expect(totals(afterInv2, w.creditNotes).balance).toBe('250.00')
    expect(status(afterInv2, undefined, w.creditNotes)).toBe('partially paid')

    const p = w.payments!.find(x => x.id === paymentId)!
    expect(p.unallocated).toBe('0.00')
  })

  it('retains unapplied credit and supports subsequent allocation to new invoices', () => {
    let { w, client } = setupWorkspace()

    // 1. Client has invoice for £200
    const inv1 = newInvoice(w)
    inv1.clientId = client.id
    inv1.client = structuredClone(client)
    inv1.lines = [{ id: crypto.randomUUID(), description: 'Discovery session', quantity: '1', rate: '200.00', unit: 'fixed' }]
    inv1.tax = '0'
    w.invoices.unshift(inv1)
    w = applyCommand(w, { type: 'issue', id: inv1.id })

    // 2. Client pays £500 (£300 overpayment)
    const paymentId = '55555555-5555-4555-8555-555555555555'
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: paymentId,
        clientId: client.id,
        currency: 'GBP',
        amount: '500.00',
        date: '2026-09-05',
        method: 'Wire transfer',
        reference: 'ADVANCE-500',
        notes: 'Deposit in advance of ongoing work',
        allocations: [{ invoiceId: inv1.id, amount: '200.00' }],
      },
    })

    const p = w.payments!.find(x => x.id === paymentId)!
    expect(p.unallocated).toBe('300.00')
    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('300.00')

    // 3. New invoice issued later for £250
    const inv2 = newInvoice(w)
    inv2.clientId = client.id
    inv2.client = structuredClone(client)
    inv2.lines = [{ id: crypto.randomUUID(), description: 'Sprint deliverables', quantity: '1', rate: '250.00', unit: 'fixed' }]
    inv2.tax = '0'
    w.invoices.unshift(inv2)
    w = applyCommand(w, { type: 'issue', id: inv2.id })

    // 4. Allocate £250 from unallocated credit
    w = applyCommand(w, {
      type: 'allocatePayment',
      paymentId: p.id,
      allocations: [{ invoiceId: inv2.id, amount: '250.00' }],
    })

    const afterInv2 = w.invoices.find(x => x.id === inv2.id)!
    expect(totals(afterInv2, w.creditNotes).balance).toBe('0.00')
    expect(status(afterInv2, undefined, w.creditNotes)).toBe('paid')

    const pUpdated = w.payments!.find(x => x.id === paymentId)!
    expect(pUpdated.unallocated).toBe('50.00')
    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('50.00')
  })

  it('rejects cross-client and cross-currency allocations', () => {
    let { w, client, client2 } = setupWorkspace()

    // Create GBP invoice for Client 1
    const invClient1 = newInvoice(w)
    invClient1.clientId = client.id
    invClient1.client = structuredClone(client)
    invClient1.lines = [{ id: crypto.randomUUID(), description: 'Task', quantity: '1', rate: '100.00', unit: 'fixed' }]
    w.invoices.unshift(invClient1)
    w = applyCommand(w, { type: 'issue', id: invClient1.id })

    // 1. Attempting cross-client payment allocation
    expect(() => {
      applyCommand(w, {
        type: 'clientPayment',
        value: {
          id: '66666666-6666-4666-8666-666666666666',
          clientId: client2.id, // Client 2 paying
          currency: 'GBP',
          amount: '100.00',
          date: '2026-09-01',
          method: 'Bank transfer',
          reference: 'CROSS-CLIENT',
          notes: 'Test cross client',
          allocations: [{ invoiceId: invClient1.id, amount: '100.00' }], // But allocated to Client 1 invoice!
        },
      })
    }).toThrow(/Cross-client allocation is rejected/)

    // 2. Attempting cross-currency payment allocation
    expect(() => {
      applyCommand(w, {
        type: 'clientPayment',
        value: {
          id: '77777777-7777-4777-8777-777777777777',
          clientId: client.id,
          currency: 'USD', // Paying in USD
          amount: '100.00',
          date: '2026-09-01',
          method: 'Card',
          reference: 'CROSS-CURR',
          notes: 'Test cross currency',
          allocations: [{ invoiceId: invClient1.id, amount: '100.00' }], // But invoice is GBP!
        },
      })
    }).toThrow(/Cross-currency allocation is rejected/)
  })

  it('supports recording refunds against unallocated credit with ceiling enforcement', () => {
    let { w, client } = setupWorkspace()

    const paymentId = '88888888-8888-4888-8888-888888888888'
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: paymentId,
        clientId: client.id,
        currency: 'GBP',
        amount: '200.00',
        date: '2026-09-01',
        method: 'Bank transfer',
        reference: 'PREPAY',
        notes: 'Prepayment for future sprint',
        allocations: [], // Zero allocations -> full £200 unallocated
      },
    })

    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('200.00')

    // Attempt refunding £250 (exceeds available £200)
    expect(() => {
      applyCommand(w, {
        type: 'refundPayment',
        paymentId,
        refund: {
          amount: '250.00',
          date: '2026-09-05',
          reference: 'REF-ERR',
          notes: 'Over refund attempt',
        },
      })
    }).toThrow(/exceeds available unallocated credit/)

    // Refunding £150 succeeds
    w = applyCommand(w, {
      type: 'refundPayment',
      paymentId,
      refund: {
        amount: '150.00',
        date: '2026-09-05',
        reference: 'REF-001',
        notes: 'Partial refund upon client request',
      },
    })

    const p = w.payments!.find(x => x.id === paymentId)!
    expect(p.unallocated).toBe('50.00')
    expect(p.refunds).toHaveLength(1)
    expect(p.refunds[0].amount).toBe('150.00')
    expect(p.refunds[0].reference).toBe('REF-001')
    expect(clientAvailableCredit(client.id, 'GBP', w.payments)).toBe('50.00')
  })

  it('reverses client payment and cleanly restores invoice balance', () => {
    let { w, client } = setupWorkspace()

    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [{ id: crypto.randomUUID(), description: 'Quarterly retainer', quantity: '1', rate: '1500.00', unit: 'fixed' }]
    inv.tax = '0'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })

    const paymentId = '99999999-9999-4999-8999-999999999999'
    w = applyCommand(w, {
      type: 'clientPayment',
      value: {
        id: paymentId,
        clientId: client.id,
        currency: 'GBP',
        amount: '1500.00',
        date: '2026-09-01',
        method: 'Cheque',
        reference: 'CHQ-889',
        notes: 'Cheque received',
        allocations: [{ invoiceId: inv.id, amount: '1500.00' }],
      },
    })

    const afterPay = w.invoices.find(x => x.id === inv.id)!
    expect(totals(afterPay, w.creditNotes).balance).toBe('0.00')

    // Cheque bounced - reverse payment
    w = applyCommand(w, {
      type: 'reverseClientPayment',
      paymentId,
    })

    const p = w.payments!.find(x => x.id === paymentId)!
    expect(p.reversed).toBe(true)
    expect(p.unallocated).toBe('0.00')

    const afterRev = w.invoices.find(x => x.id === inv.id)!
    expect(totals(afterRev, w.creditNotes).balance).toBe('1500.00')
    expect(status(afterRev, undefined, w.creditNotes)).toBe('unpaid')
  })

  it('integrates credit notes and replacement drafts into unified invoice timeline', () => {
    let { w, client } = setupWorkspace()

    const inv = newInvoice(w)
    inv.clientId = client.id
    inv.client = structuredClone(client)
    inv.lines = [{ id: crypto.randomUUID(), description: 'Advisory', quantity: '1', rate: '800.00', unit: 'fixed' }]
    inv.tax = '0'
    w.invoices.unshift(inv)
    w = applyCommand(w, { type: 'issue', id: inv.id })

    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: inv.id,
      reason: 'Rate renegotiated',
      lines: inv.lines,
      tax: '0',
      replacement: true,
    })

    const originalInvoice = w.invoices.find(x => x.id === inv.id)!
    const timeline = buildInvoiceTimeline(originalInvoice, w)
    const creditEvent = timeline.find(e => e.type === 'void' && e.status === 'credited')
    expect(creditEvent).toBeDefined()
    expect(creditEvent?.title).toContain('Credit note issued')
    expect(creditEvent?.detail).toContain('Rate renegotiated')

    // Check replacement draft timeline
    const repDraft = w.invoices.find(x => x.replacementOf === originalInvoice.id)!
    expect(repDraft).toBeDefined()
    const draftTimeline = buildInvoiceTimeline(repDraft, w)
    const createdEvent = draftTimeline.find(e => e.type === 'created')
    expect(createdEvent?.title).toBe('Replacement draft created')
    expect(createdEvent?.detail).toContain(originalInvoice.number)
  })
})
