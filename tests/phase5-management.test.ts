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
  type Workspace,
  type Invoice,
} from '../src/shared/domain'

function fixture(): { w: Workspace; i: Invoice } {
  let w = emptyWorkspace()
  w.business.name = 'Humza Design Studio'
  w.business.address = '1 Studio Way, London'
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
    notes: 'Key enterprise client',
  }
  w = applyCommand(w, { type: 'client', value: client })

  const project = {
    id: crypto.randomUUID(),
    name: 'Mentage — Sprint 2',
    clientId: client.id,
    notes: 'Core platform design sprint',
  }
  w = applyCommand(w, { type: 'project', value: project })

  const i = newInvoice(w)
  i.clientId = client.id
  i.client = structuredClone(client)
  i.projectId = project.id
  i.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Design Sprint deliverables',
      quantity: '1',
      rate: '1000',
      unit: 'fixed',
    },
  ]
  i.issueDate = '2026-09-01'
  i.dueDate = '2026-09-15'
  w = applyCommand(w, { type: 'draft', value: i })

  return { w, i: w.invoices[0] }
}

describe('Phase 5: Payment Ledger, Partial Payments & Reversals', () => {
  it('correctly derives unpaid, partially paid, and paid status from the payment ledger', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const day = '2026-09-10' // Before due date (2026-09-15)

    // 1. Initial issued status is 'unpaid'
    expect(status(w.invoices[0], day)).toBe('unpaid')
    expect(totals(w.invoices[0])).toMatchObject({
      total: '1000.00',
      paid: '0.00',
      balance: '1000.00',
    })

    // 2. Partial payment of £350
    const payment1Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: payment1Id,
        amount: '350.00',
        date: '2026-09-05',
        method: 'Bank transfer',
        reference: 'TXN-001',
        notes: 'Deposit advance payment',
        reversed: false,
      },
    })
    expect(status(w.invoices[0], day)).toBe('partially paid')
    expect(totals(w.invoices[0])).toMatchObject({
      total: '1000.00',
      paid: '350.00',
      balance: '650.00',
    })

    // 3. Second payment completing the balance of £650
    const payment2Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: payment2Id,
        amount: '650.00',
        date: '2026-09-10',
        method: 'Bank transfer',
        reference: 'TXN-002',
        notes: 'Final balance settlement',
        reversed: false,
      },
    })
    expect(status(w.invoices[0], day)).toBe('paid')
    expect(totals(w.invoices[0])).toMatchObject({
      total: '1000.00',
      paid: '1000.00',
      balance: '0.00',
    })

    // 4. Reverse the second payment: status should revert to 'partially paid'
    w = applyCommand(w, { type: 'reverse', id: i.id, paymentId: payment2Id })
    expect(status(w.invoices[0], day)).toBe('partially paid')
    expect(totals(w.invoices[0])).toMatchObject({
      total: '1000.00',
      paid: '350.00',
      balance: '650.00',
    })
    expect(w.invoices[0].payments.find(p => p.id === payment2Id)?.reversed).toBe(true)

    // 5. Reverse the first payment: status should revert to 'unpaid'
    w = applyCommand(w, { type: 'reverse', id: i.id, paymentId: payment1Id })
    expect(status(w.invoices[0], day)).toBe('unpaid')
    expect(totals(w.invoices[0])).toMatchObject({
      total: '1000.00',
      paid: '0.00',
      balance: '1000.00',
    })

    // 6. Attempting to reverse an already reversed payment should throw
    expect(() => applyCommand(w, { type: 'reverse', id: i.id, paymentId: payment1Id })).toThrow(
      'Payment is already reversed'
    )
  })

  it('rejects payments exceeding the balance or with invalid decimals', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })

    // Payment exceeding balance £1000.01
    expect(() =>
      applyCommand(w, {
        type: 'payment',
        id: i.id,
        value: {
          id: crypto.randomUUID(),
          amount: '1000.01',
          date: '2026-09-05',
          method: 'Bank',
          reference: '',
          notes: '',
          reversed: false,
        },
      })
    ).toThrow('no greater than the outstanding balance')

    // Payment on draft invoice should be rejected
    const draft = newInvoice(w)
    w = applyCommand(w, { type: 'draft', value: draft })
    expect(() =>
      applyCommand(w, {
        type: 'payment',
        id: draft.id,
        value: {
          id: crypto.randomUUID(),
          amount: '50.00',
          date: '2026-09-05',
          method: 'Bank',
          reference: '',
          notes: '',
          reversed: false,
        },
      })
    ).toThrow('Issue the invoice before recording payment')
  })
})

describe('Phase 5: Receivables & Exclusion of Drafts and Void Invoices', () => {
  it('excludes drafts and void invoices from receivables while calculating separate totals per currency', () => {
    let w = emptyWorkspace()
    w.business.name = 'Multi Currency Studio'
    w.business.address = '1 Multi Way, London'

    // 1. Draft invoice for £500 (GBP) - MUST BE EXCLUDED
    const draft = newInvoice(w)
    draft.currency = 'GBP'
    draft.lines = [{ id: crypto.randomUUID(), description: 'Draft item', quantity: '1', rate: '500', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: draft })

    // 2. Issued invoice for £1,200 (GBP) - MUST BE INCLUDED
    const issuedGbp = newInvoice(w)
    issuedGbp.client.name = 'Client UK'
    issuedGbp.currency = 'GBP'
    issuedGbp.lines = [{ id: crypto.randomUUID(), description: 'UK work', quantity: '1', rate: '1200', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: issuedGbp })
    w = applyCommand(w, { type: 'issue', id: issuedGbp.id })

    // 3. Issued invoice for $2,000 (USD) with $500 partial payment - balance $1,500 MUST BE INCLUDED
    const issuedUsd = newInvoice(w)
    issuedUsd.client.name = 'Client US'
    issuedUsd.currency = 'USD'
    issuedUsd.lines = [{ id: crypto.randomUUID(), description: 'US work', quantity: '1', rate: '2000', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: issuedUsd })
    w = applyCommand(w, { type: 'issue', id: issuedUsd.id })
    w = applyCommand(w, {
      type: 'payment',
      id: issuedUsd.id,
      value: {
        id: crypto.randomUUID(),
        amount: '500.00',
        date: '2026-09-05',
        method: 'Wire',
        reference: '',
        notes: '',
        reversed: false,
      },
    })

    // 4. Issued then voided invoice for €3,000 (EUR) - MUST BE EXCLUDED
    const voidedEur = newInvoice(w)
    voidedEur.client.name = 'Client EU'
    voidedEur.currency = 'EUR'
    voidedEur.lines = [{ id: crypto.randomUUID(), description: 'EU work', quantity: '1', rate: '3000', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: voidedEur })
    w = applyCommand(w, { type: 'issue', id: voidedEur.id })
    w = applyCommand(w, { type: 'void', id: voidedEur.id, reason: 'Contract cancelled before commencement' })

    // Receivables calculation logic (as implemented in App.tsx dashboard metrics)
    const day = '2026-09-12'
    const balances: Record<string, { outstanding: number; dueSoon: number; overdue: number }> = {}

    for (const inv of w.invoices.filter(i => i.lifecycle === 'issued')) {
      const balance = Number(totals(inv).balance)
      if (balance <= 0) continue
      balances[inv.currency] ??= { outstanding: 0, dueSoon: 0, overdue: 0 }
      balances[inv.currency].outstanding += balance
    }

    // GBP: Exactly £1,200 (draft excluded)
    expect(balances.GBP.outstanding).toBe(1200)
    // USD: Exactly $1,500 ($500 partial payment deducted)
    expect(balances.USD.outstanding).toBe(1500)
    // EUR: Voided invoice is completely excluded
    expect(balances.EUR).toBeUndefined()
  })
})

describe('Phase 5: Archiving, Restoring & Non-destructive Voiding', () => {
  it('retains balances and full payment history after archiving and restoring', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const paymentId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: paymentId,
        amount: '400.00',
        date: '2026-09-05',
        method: 'Bank',
        reference: 'REF-400',
        notes: 'Partial payment',
        reversed: false,
      },
    })

    // Archive invoice
    w = applyCommand(w, { type: 'archive', id: i.id, value: true })
    const archivedInvoice = w.invoices.find(x => x.id === i.id)!
    expect(archivedInvoice.archived).toBe(true)

    // Balances and payment history must remain completely intact
    expect(totals(archivedInvoice)).toMatchObject({
      total: '1000.00',
      paid: '400.00',
      balance: '600.00',
    })
    expect(archivedInvoice.payments).toHaveLength(1)

    // Restore invoice (undo)
    w = applyCommand(w, { type: 'archive', id: i.id, value: false })
    const restoredInvoice = w.invoices.find(x => x.id === i.id)!
    expect(restoredInvoice.archived).toBe(false)
    expect(totals(restoredInvoice).balance).toBe('600.00')
  })

  it('voids issued invoices with retained reason rather than destructive deletion', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const invoiceNumber = w.invoices[0].number
    expect(invoiceNumber).toMatch(/^INV-\d{4}-0001$/)

    // Attempt to void with active payments should throw
    const paymentId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: paymentId,
        amount: '200.00',
        date: '2026-09-05',
        method: 'Bank',
        reference: '',
        notes: '',
        reversed: false,
      },
    })
    expect(() =>
      applyCommand(w, { type: 'void', id: i.id, reason: 'Duplicate billing' })
    ).toThrow('Reverse recorded payments before voiding')

    // Reverse the payment
    w = applyCommand(w, { type: 'reverse', id: i.id, paymentId })

    // Void the invoice with explicit reason
    w = applyCommand(w, {
      type: 'void',
      id: i.id,
      reason: 'Client requested cancellation due to project scope redefinition.',
    })

    const voided = w.invoices.find(x => x.id === i.id)!
    expect(voided.lifecycle).toBe('void')
    expect(voided.number).toBe(invoiceNumber) // Retains allocated sequence number permanently
    expect(voided.voidReason).toBe(
      'Client requested cancellation due to project scope redefinition.'
    )
    expect(voided.payments).toHaveLength(1) // Retains payment history and reversal records
    expect(voided.share).toBeUndefined() // Revokes public share link upon voiding
  })
})

describe('Phase 5: Client & Project Invoice and Payment Aggregation', () => {
  it('correctly aggregates related invoices and payments for client and project detail views', () => {
    let { w, i } = fixture()
    const client = w.clients[0]
    const project = w.projects[0]

    // 1. Issue first invoice for £1,000 and record £250 payment
    w = applyCommand(w, { type: 'issue', id: i.id })
    w = applyCommand(w, {
      type: 'payment',
      id: i.id,
      value: {
        id: crypto.randomUUID(),
        amount: '250.00',
        date: '2026-09-05',
        method: 'Bank',
        reference: 'DEP-1',
        notes: 'Deposit',
        reversed: false,
      },
    })

    // 2. Create and issue second invoice for £1,500 under the same client and project
    const second = newInvoice(w)
    second.clientId = client.id
    second.client = structuredClone(client)
    second.projectId = project.id
    second.lines = [
      { id: crypto.randomUUID(), description: 'Sprint 2 backend', quantity: '1', rate: '1500', unit: 'fixed' },
    ]
    w = applyCommand(w, { type: 'draft', value: second })
    w = applyCommand(w, { type: 'issue', id: second.id })
    w = applyCommand(w, {
      type: 'payment',
      id: second.id,
      value: {
        id: crypto.randomUUID(),
        amount: '1500.00',
        date: '2026-09-12',
        method: 'Card',
        reference: 'TXN-FULL',
        notes: 'Full payment',
        reversed: false,
      },
    })

    // Client Detail Aggregation Verification
    const clientInvoices = w.invoices.filter(inv => inv.clientId === client.id)
    expect(clientInvoices).toHaveLength(2)

    const clientPayments = clientInvoices.flatMap(inv => inv.payments)
    expect(clientPayments).toHaveLength(2)

    const clientBilled = clientInvoices.reduce((sum, inv) => sum.add(totals(inv).total), new Decimal(0))
    const clientPaid = clientInvoices.reduce((sum, inv) => sum.add(totals(inv).paid), new Decimal(0))
    const clientBalance = clientInvoices.reduce((sum, inv) => sum.add(totals(inv).balance), new Decimal(0))

    expect(clientBilled.toFixed(2)).toBe('2500.00')
    expect(clientPaid.toFixed(2)).toBe('1750.00')
    expect(clientBalance.toFixed(2)).toBe('750.00')

    // Project Detail Aggregation Verification
    const projectInvoices = w.invoices.filter(inv => inv.projectId === project.id)
    expect(projectInvoices).toHaveLength(2)

    const projectPayments = projectInvoices.flatMap(inv => inv.payments)
    expect(projectPayments).toHaveLength(2)
  })
})
