import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
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
      description: 'Design Deliverables Sprint 1',
      quantity: '1',
      rate: '1500',
      unit: 'fixed',
    },
  ]
  i.issueDate = '2026-09-01'
  i.terms = client.terms
  i.dueDate = '2026-09-15'
  w = applyCommand(w, { type: 'draft', value: i })

  return { w, i: w.invoices[0] }
}

describe('Resend & Edit Issued Invoices', () => {
  it('allows updating an issued invoice via updateIssuedInvoice and preserves number and payments', () => {
    let { w, i } = fixture()
    // Issue the invoice
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]
    expect(issued.lifecycle).toBe('issued')
    expect(issued.number).toMatch(/^INV-\d{4}-\d{4}$/)
    const origNumber = issued.number
    const origIssuedAt = issued.issuedAt

    // Standard draft edit must throw
    expect(() =>
      applyCommand(w, { type: 'draft', value: { ...issued, notes: 'Modified notes' } })
    ).toThrow('Issued invoices cannot be edited. Duplicate or void it.')

    // Update issued invoice via updateIssuedInvoice
    const updatedDraft = {
      ...issued,
      notes: 'Updated payment terms and delivery scope',
      lines: [
        {
          id: crypto.randomUUID(),
          description: 'Design Deliverables Sprint 1 & 2 (Revised)',
          quantity: '2',
          rate: '1500',
          unit: 'fixed' as const,
        },
      ],
      po: 'PO-2026-99',
    }

    w = applyCommand(w, {
      type: 'updateIssuedInvoice',
      id: issued.id,
      value: updatedDraft,
    })

    const updated = w.invoices.find(x => x.id === issued.id)!
    expect(updated.number).toBe(origNumber) // Sequence number preserved
    expect(updated.issuedAt).toBe(origIssuedAt) // Issued timestamp preserved
    expect(updated.notes).toBe('Updated payment terms and delivery scope')
    expect(updated.lines).toHaveLength(1)
    expect(updated.lines[0].description).toBe('Design Deliverables Sprint 1 & 2 (Revised)')
    expect(totals(updated).total).toBe('3000.00')
    expect(updated.po).toBe('PO-2026-99')

    // Verify audit log entry
    expect(w.audit[0].action).toBe('updateIssuedInvoice')
    expect(w.audit[0].invoiceId).toBe(issued.id)
  })

  it('rejects updateIssuedInvoice on unissued draft invoices', () => {
    const { w, i } = fixture()
    expect(i.lifecycle).toBe('draft')

    expect(() =>
      applyCommand(w, {
        type: 'updateIssuedInvoice',
        id: i.id,
        value: i,
      })
    ).toThrow('Only issued invoices can be updated')
  })

  it('rejects lowering invoice total below already recorded payments', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    // Record partial payment of 500
    w = applyCommand(w, {
      type: 'payment',
      id: issued.id,
      value: {
        id: crypto.randomUUID(),
        amount: '500.00',
        date: '2026-09-05',
        method: 'Bank transfer',
        reference: 'TX-12345',
        notes: 'Deposit paid',
        reversed: false,
      },
    })

    const paidInv = w.invoices[0]
    expect(totals(paidInv).paid).toBe('500.00')

    // Try to update invoice with new total of 300 (less than 500 recorded payment)
    const invalidDraft = {
      ...paidInv,
      lines: [
        {
          id: crypto.randomUUID(),
          description: 'Reduced Scope',
          quantity: '1',
          rate: '300.00',
          unit: 'fixed' as const,
        },
      ],
    }

    expect(() =>
      applyCommand(w, {
        type: 'updateIssuedInvoice',
        id: paidInv.id,
        value: invalidDraft,
      })
    ).toThrow('cannot be less than already recorded payments')
  })

  it('rejects changing currency if recorded payments exist', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    w = applyCommand(w, {
      type: 'payment',
      id: issued.id,
      value: {
        id: crypto.randomUUID(),
        amount: '200.00',
        date: '2026-09-05',
        method: 'Bank transfer',
        reference: 'TX-1',
        notes: '',
        reversed: false,
      },
    })

    const paidInv = w.invoices[0]
    const currencyChangeDraft = {
      ...paidInv,
      currency: 'USD' as const,
    }

    expect(() =>
      applyCommand(w, {
        type: 'updateIssuedInvoice',
        id: paidInv.id,
        value: currencyChangeDraft,
      })
    ).toThrow('Cannot change currency of an invoice with recorded payments or credit notes')
  })

  it('allows full invoice resending workflow with delivery history tracking', () => {
    let { w, i } = fixture()
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    // 1. Initial Send
    const firstMsgId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'message',
      value: {
        id: firstMsgId,
        invoiceId: issued.id,
        kind: 'invoice',
        to: issued.client.email,
        cc: issued.client.cc,
        replyTo: issued.client.replyTo,
        subject: `Invoice ${issued.number}`,
        body: 'Please find attached your invoice.',
        status: 'draft',
        created: '2026-09-01T10:00:00Z',
      },
    })
    w = applyCommand(w, { type: 'send', id: firstMsgId })
    expect(w.messages[0].status).toBe('queued')

    // Simulate successful provider delivery
    w.messages[0].status = 'sent'

    // 2. Client asks for modified PO number and line description
    const updatedDraft = {
      ...issued,
      po: 'PO-CLIENT-REQ-42',
      lines: [
        {
          id: crypto.randomUUID(),
          description: 'Sprint 1 Deliverables (PO-CLIENT-REQ-42)',
          quantity: '1',
          rate: '1500',
          unit: 'fixed' as const,
        },
      ],
    }

    w = applyCommand(w, {
      type: 'updateIssuedInvoice',
      id: issued.id,
      value: updatedDraft,
    })

    // 3. Resend the updated invoice to client with fresh message record
    const resendMsgId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'message',
      value: {
        id: resendMsgId,
        invoiceId: issued.id,
        kind: 'invoice',
        to: issued.client.email,
        cc: issued.client.cc,
        replyTo: issued.client.replyTo,
        subject: `Invoice ${issued.number} (Updated)`,
        body: 'Please find attached the updated copy of invoice with PO-CLIENT-REQ-42.',
        status: 'draft',
        created: '2026-09-02T14:00:00Z',
      },
    })
    w = applyCommand(w, { type: 'send', id: resendMsgId })

    // Verify both original send and resend exist in delivery history
    const history = w.messages.filter(m => m.invoiceId === issued.id)
    expect(history).toHaveLength(2)
    expect(history.find(m => m.id === firstMsgId)?.status).toBe('sent')
    expect(history.find(m => m.id === resendMsgId)?.status).toBe('queued')
    expect(history.find(m => m.id === resendMsgId)?.subject).toBe(`Invoice ${issued.number} (Updated)`)
  })
})
