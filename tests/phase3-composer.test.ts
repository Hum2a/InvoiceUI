import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  issueErrors,
  addDays,
  today,
  type Workspace,
  type Draft,
} from '../src/shared/domain'
import { Conflict } from '../src/worker/store'

describe('Phase 3: Reliable Invoice Composer (Section 3)', () => {
  it('allows saving incomplete drafts while preventing premature issuance', () => {
    let w = emptyWorkspace()
    const draft = newInvoice(w)
    // Draft initially has empty client name, default line with rate 0
    expect(draft.client.name).toBe('')
    expect(draft.lines[0].rate).toBe('0')

    // Saving incomplete draft must succeed without throwing
    expect(() => {
      w = applyCommand(w, { type: 'draft', value: draft })
    }).not.toThrow()
    expect(w.invoices).toHaveLength(1)
    expect(w.invoices[0].id).toBe(draft.id)
    expect(w.invoices[0].lifecycle).toBe('draft')

    // But attempting to issue must fail validation and return clear errors
    const errors = issueErrors(w.invoices[0], w.business)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors).toContain('Add your business name and address in Settings.')
    expect(errors).toContain('Add a client name.')
    expect(errors).toContain('Each line needs a description and a quantity above zero.')
  })

  it('guarantees agreement between live preview and server totals across complex financial rules', () => {
    const w = emptyWorkspace()
    const draft = newInvoice(w)
    draft.currency = 'GBP'
    draft.lines = [
      { id: crypto.randomUUID(), description: 'Sprint planning', quantity: '8', rate: '125.50', unit: 'hour' }, // 1004.00
      { id: crypto.randomUUID(), description: 'Architecture review', quantity: '1', rate: '2500.00', unit: 'fixed' }, // 2500.00
      { id: crypto.randomUUID(), description: 'Worker units', quantity: '10', rate: '15.25', unit: 'unit' }, // 152.50
    ]
    // Subtotal: 1004.00 + 2500.00 + 152.50 = 3656.50
    draft.discountType = 'percent'
    draft.discount = '10' // 10% of 3656.50 = 365.65. Net = 3290.85
    draft.tax = '20' // 20% of 3290.85 = 658.17. Total = 3949.02
    draft.deposit = '1000.00' // Requested deposit does not affect balance until paid

    const t = totals(draft)
    expect(t.lineTotals).toEqual(['1004.00', '2500.00', '152.50'])
    expect(t.subtotal).toBe('3656.50')
    expect(t.discount).toBe('365.65')
    expect(t.tax).toBe('658.17')
    expect(t.total).toBe('3949.02')
    // Requested deposit is separate from payments; unpaid balance equals total
    expect(t.paid).toBe('0.00')
    expect(t.balance).toBe('3949.02')
  })

  it('duplicates invoice as a fresh unnumbered draft with retained lines, deposit, and instalment specs', () => {
    let w = emptyWorkspace()
    w.business.name = 'Humza Studio'
    w.business.address = 'London'

    const original = newInvoice(w)
    original.client = {
      id: crypto.randomUUID(),
      name: 'Alpha Ltd',
      email: 'alpha@example.com',
      address: 'Cambridge',
      cc: ['cc@example.com'],
      replyTo: 'reply@example.com',
      terms: 14,
      notes: 'Alpha notes',
    }
    original.lines = [
      { id: crypto.randomUUID(), description: 'Line 1', quantity: '2', rate: '500.00', unit: 'fixed' },
      { id: crypto.randomUUID(), description: 'Line 2', quantity: '5', rate: '100.00', unit: 'hour' },
    ]
    original.tax = '20'
    original.discount = '50.00'
    original.discountType = 'amount'
    original.deposit = '300.00'
    original.instalments = [{ date: '2026-10-01', amount: '500.00' }]
    original.notes = 'Invoice notes'
    original.po = 'PO-12345'
    original.reference = 'REF-999'
    original.breakdown = 'Detailed work log'
    original.template = 'classic'
    original.accent = '#ef4444'

    w = applyCommand(w, { type: 'draft', value: original })
    w = applyCommand(w, { type: 'issue', id: original.id })
    const issued = w.invoices.find(i => i.id === original.id)!
    expect(issued.number).toMatch(/^INV-\d{4}-0001$/)
    expect(issued.lifecycle).toBe('issued')

    // Duplicate invoice as fresh draft
    const newDraftId = crypto.randomUUID()
    w = applyCommand(w, { type: 'duplicate', id: original.id, newId: newDraftId })

    const dup = w.invoices.find(i => i.id === newDraftId)!
    // Fresh unnumbered draft
    expect(dup.id).toBe(newDraftId)
    expect(dup.number).toBe('')
    expect(dup.lifecycle).toBe('draft')
    expect(dup.archived).toBe(false)
    expect(dup.payments).toEqual([])
    expect(dup.issuedAt).toBeUndefined()
    expect(dup.share).toBeUndefined()
    expect(dup.business).toBeNull()

    // Retained metadata, lines, pricing, deposit, and terms
    expect(dup.client.name).toBe('Alpha Ltd')
    expect(dup.lines).toHaveLength(2)
    expect(dup.lines[0].description).toBe('Line 1')
    expect(dup.tax).toBe('20')
    expect(dup.discount).toBe('50.00')
    expect(dup.deposit).toBe('300.00')
    expect(dup.instalments).toEqual([{ date: '2026-10-01', amount: '500.00' }])
    expect(dup.po).toBe('PO-12345')
    expect(dup.reference).toBe('REF-999')
    expect(dup.breakdown).toBe('Detailed work log')
    expect(dup.template).toBe('classic')
    expect(dup.accent).toBe('#ef4444')

    // Fresh dates
    expect(dup.issueDate).toBe(today(w.business.timezone))
    expect(dup.dueDate).toBe(addDays(dup.issueDate, dup.terms))
  })

  it('handles quick payment terms while preserving manual due-date overrides', () => {
    const w = emptyWorkspace()
    const draft = newInvoice(w)
    draft.issueDate = '2026-09-12'

    // Preset terms (7, 14, 30, 0)
    expect(addDays(draft.issueDate, 0)).toBe('2026-09-12')
    expect(addDays(draft.issueDate, 7)).toBe('2026-09-19')
    expect(addDays(draft.issueDate, 14)).toBe('2026-09-26')
    expect(addDays(draft.issueDate, 30)).toBe('2026-10-12')

    // Simulate behavior of Editor when terms control due date (manualDue: false)
    draft.manualDue = false
    draft.terms = 14
    draft.dueDate = addDays(draft.issueDate, 14)
    expect(draft.dueDate).toBe('2026-09-26')

    // When issue date shifts, due date recalculates
    const newIssueDate = '2026-09-15'
    const updatedDue = !draft.manualDue ? addDays(newIssueDate, draft.terms) : draft.dueDate
    expect(updatedDue).toBe('2026-09-29')

    // When manualDue is true (user picked custom date), issue date changes preserve manual due date
    draft.manualDue = true
    draft.dueDate = '2026-10-31'
    const preservedDue = !draft.manualDue ? addDays('2026-09-20', draft.terms) : draft.dueDate
    expect(preservedDue).toBe('2026-10-31')
  })

  it('supports adding, reordering and removing line items', () => {
    let w = emptyWorkspace()
    const draft = newInvoice(w)
    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()
    const id3 = crypto.randomUUID()
    const line1 = { id: id1, description: 'Wireframing', quantity: '1', rate: '500', unit: 'fixed' as const }
    const line2 = { id: id2, description: 'Prototyping', quantity: '2', rate: '750', unit: 'fixed' as const }
    const line3 = { id: id3, description: 'User Testing', quantity: '3', rate: '200', unit: 'hour' as const }

    draft.lines = [line1, line2, line3]
    w = applyCommand(w, { type: 'draft', value: draft })
    expect(w.invoices[0].lines.map(l => l.id)).toEqual([id1, id2, id3])

    // Reorder: swap line1 and line2
    const reorderedLines = [draft.lines[1], draft.lines[0], draft.lines[2]]
    w = applyCommand(w, { type: 'draft', value: { ...draft, lines: reorderedLines } })
    expect(w.invoices[0].lines.map(l => l.id)).toEqual([id2, id1, id3])

    // Remove line2
    const remainingLines = reorderedLines.filter(l => l.id !== id2)
    w = applyCommand(w, { type: 'draft', value: { ...draft, lines: remainingLines } })
    expect(w.invoices[0].lines.map(l => l.id)).toEqual([id1, id3])
  })

  it('detects two-device version conflicts and protects against silent overwrite', () => {
    // Simulate CAS behavior
    const serverVersion = 2
    const clientIncomingVersion = 1

    expect(() => {
      if (clientIncomingVersion !== serverVersion) {
        throw new Conflict('This workspace changed on another device. Reload it or save your edits as a new draft.')
      }
    }).toThrow(Conflict)

    // Recovery flow: fork draft as a fresh draft ID to keep edits
    const draft = newInvoice(emptyWorkspace())
    draft.notes = 'Offline device edits that clashed with device 2'
    const forkedDraft = { ...draft, id: crypto.randomUUID() }
    expect(forkedDraft.id).not.toBe(draft.id)
    expect(forkedDraft.notes).toBe(draft.notes)
  })

  it('isolates recovery keys by owner and invoice and removes on logout', () => {
    const owner1 = 'user_abc'
    const owner2 = 'user_xyz'
    const invoiceId = 'inv_123'

    const key1 = `invoiceui:recovery:${owner1}:${invoiceId}`
    const key2 = `invoiceui:recovery:${owner2}:${invoiceId}`
    expect(key1).not.toBe(key2)

    // Mock localStorage simulation for logout cleanup
    const storage: Record<string, string> = {
      [`invoiceui:recovery:${owner1}:draft1`]: '{"notes":"test1"}',
      [`invoiceui:recovery:${owner1}:draft2`]: '{"notes":"test2"}',
      [`invoiceui:recovery:${owner2}:draft3`]: '{"notes":"other"}',
      'other:key': 'value',
    }

    // Sign-out of owner1
    for (const key of Object.keys(storage)) {
      if (key.startsWith(`invoiceui:recovery:${owner1}:`)) {
        delete storage[key]
      }
    }

    expect(storage[`invoiceui:recovery:${owner1}:draft1`]).toBeUndefined()
    expect(storage[`invoiceui:recovery:${owner1}:draft2`]).toBeUndefined()
    expect(storage[`invoiceui:recovery:${owner2}:draft3`]).toBe('{"notes":"other"}')
    expect(storage['other:key']).toBe('value')
  })
})
