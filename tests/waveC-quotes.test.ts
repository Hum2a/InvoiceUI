import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  applyCommand,
  quoteTotals,
  quoteStatus,
  newQuote,
  today,
  addDays,
  type Workspace,
  type Client,
  type Quote,
} from '../src/shared/domain'
import {
  renderQuotePDF,
  filenameQuote,
} from '../src/shared/pdf'

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

function setupWorkspace(): { w: Workspace; client: Client } {
  const w = emptyWorkspace()
  w.business.name = 'Zenith Engineering Ltd'
  w.business.email = 'invoices@zenitheng.example'
  w.business.address = '45 Tech City Way\nLondon EC1V 1AB'
  w.business.bank = 'Bank of Britain\nSort: 10-20-30\nAcc: 98765432'
  w.business.currency = 'GBP'
  w.business.terms = 14
  w.business.prefix = 'ZEN'

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

  return { w, client }
}

describe('Wave C: C01 Versioned Quotes, Acceptance & Invoice Conversion', () => {
  it('creates quotes with sequential separate numbering and calculates accurate totals', () => {
    let { w, client } = setupWorkspace()
    const q1Id = crypto.randomUUID()
    const issueDate = '2026-09-12'
    const expiryDate = '2026-10-12'

    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: q1Id,
        clientId: client.id,
        client,
        issueDate,
        expiryDate,
        currency: 'GBP',
        lines: [
          { id: crypto.randomUUID(), description: 'Technical Architecture Design', quantity: '1', rate: '2500.00', unit: 'fixed' },
          { id: crypto.randomUUID(), description: 'API Implementation', quantity: '20', rate: '100.00', unit: 'hour' },
        ],
        tax: '20',
        discount: '500.00',
        discountType: 'amount',
        scope: 'Phase 1 Core Infrastructure and API Gateway',
        notes: 'Valid for 30 days from issue.',
        template: 'studio',
        accent: '#7c3aed',
      },
    }, new Date('2026-09-12T10:00:00Z'))

    expect(w.quotes).toBeDefined()
    expect(w.quotes?.length).toBe(1)
    const q1 = w.quotes![0]

    // Separate sequential numbering: prefix-QT-YEAR-0001
    expect(q1.quoteNumber).toBe('ZEN-QT-2026-0001')
    expect(q1.revision).toBe(1)
    expect(q1.status).toBe('draft')
    expect(q1.client.name).toBe('Acme Global Corp')

    // Totals verification:
    // Subtotal: 2500 + 2000 = 4500.00
    // Discount: 500.00 -> Net: 4000.00
    // Tax (20%): 800.00
    // Total: 4800.00
    const t1 = quoteTotals(q1)
    expect(t1.subtotal).toBe('4500.00')
    expect(t1.discount).toBe('500.00')
    expect(t1.tax).toBe('800.00')
    expect(t1.total).toBe('4800.00')

    // Create a second quote - verifies sequence increment
    const q2Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: q2Id,
        clientId: client.id,
        client,
        issueDate,
        expiryDate,
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Advisory Consultation', quantity: '5', rate: '150.00', unit: 'hour' }],
        tax: '0',
        discount: '10',
        discountType: 'percent',
        scope: 'Technical audit',
        notes: 'Standard rates apply.',
        template: 'minimal',
        accent: '#2563eb',
      },
    }, new Date('2026-09-12T11:00:00Z'))

    expect(w.quotes?.length).toBe(2)
    const q2 = w.quotes![0]
    expect(q2.quoteNumber).toBe('ZEN-QT-2026-0002')
    expect(q2.revision).toBe(1)

    // Subtotal: 750.00
    // Discount 10%: 75.00 -> Net: 675.00
    // Tax 0%: 0.00
    // Total: 675.00
    const t2 = quoteTotals(q2)
    expect(t2.subtotal).toBe('750.00')
    expect(t2.discount).toBe('75.00')
    expect(t2.tax).toBe('0.00')
    expect(t2.total).toBe('675.00')
  })

  it('updates draft quotes and enforces editing constraints', () => {
    let { w, client } = setupWorkspace()
    const qId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: qId,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-12',
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Initial Scope', quantity: '1', rate: '1000.00', unit: 'fixed' }],
        tax: '20',
        discount: '0',
        discountType: 'amount',
        scope: 'Initial scoping',
        notes: 'Terms pending',
        template: 'studio',
        accent: '#7c3aed',
      },
    })

    // Update draft quote
    w = applyCommand(w, {
      type: 'updateQuote',
      value: {
        id: qId,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-20',
        currency: 'GBP',
        lines: [
          { id: crypto.randomUUID(), description: 'Expanded Architecture Scope', quantity: '2', rate: '1200.00', unit: 'fixed' },
        ],
        tax: '20',
        discount: '200.00',
        discountType: 'amount',
        scope: 'Updated architecture scope',
        notes: 'Extended expiry granted',
        template: 'studio',
        accent: '#7c3aed',
      },
    })

    const updated = w.quotes!.find(q => q.id === qId)!
    expect(updated.expiryDate).toBe('2026-10-20')
    expect(updated.scope).toBe('Updated architecture scope')
    expect(quoteTotals(updated).subtotal).toBe('2400.00')

    // Mark sent
    w = applyCommand(w, { type: 'sendQuote', id: qId })
    const sent = w.quotes!.find(q => q.id === qId)!
    expect(sent.status).toBe('sent')

    // Attempting to update a sent quote is rejected (must revise instead)
    expect(() => {
      applyCommand(w, {
        type: 'updateQuote',
        value: {
          id: qId,
          clientId: client.id,
          client,
          issueDate: '2026-09-12',
          expiryDate: '2026-10-30',
          currency: 'GBP',
          lines: updated.lines,
          tax: '20',
          discount: '0',
          discountType: 'amount',
          notes: 'Try edit sent',
          template: 'studio',
          accent: '#7c3aed',
        },
      })
    }).toThrow(/Only draft quotes can be edited/)
  })

  it('preserves superseded revisions immutably when revising a quote', () => {
    let { w, client } = setupWorkspace()
    const q1Id = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: q1Id,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-12',
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Revision 1 Item', quantity: '1', rate: '2000.00', unit: 'fixed' }],
        tax: '20',
        discount: '0',
        discountType: 'amount',
        scope: 'Revision 1 original scope',
        notes: 'First draft',
        template: 'studio',
        accent: '#7c3aed',
      },
    })

    // Mark sent
    w = applyCommand(w, { type: 'sendQuote', id: q1Id })

    // Revise quote: creates Revision 2, supersedes Revision 1
    const q2Id = crypto.randomUUID()
    const reviseTimestamp = '2026-09-15T14:00:00.000Z'
    w = applyCommand(w, {
      type: 'reviseQuote',
      id: q1Id,
      newId: q2Id,
    }, new Date(reviseTimestamp))

    expect(w.quotes?.length).toBe(2)
    const rev1 = w.quotes!.find(q => q.id === q1Id)!
    const rev2 = w.quotes!.find(q => q.id === q2Id)!

    // Revision 1 is immutably superseded
    expect(rev1.quoteNumber).toBe(rev2.quoteNumber)
    expect(rev1.revision).toBe(1)
    expect(rev1.status).toBe('superseded')
    expect(rev1.supersededBy).toBe(q2Id)
    expect(rev1.supersededAt).toBe(reviseTimestamp)

    // Revision 2 is a new draft ready for editing
    expect(rev2.revision).toBe(2)
    expect(rev2.status).toBe('draft')
    expect(rev2.lines[0].description).toBe('Revision 1 Item')
    expect(rev2.lines[0].id).not.toBe(rev1.lines[0].id) // fresh line UUID

    // Cannot revise a superseded quote again
    expect(() => {
      applyCommand(w, {
        type: 'reviseQuote',
        id: q1Id,
        newId: crypto.randomUUID(),
      })
    }).toThrow(/already superseded/)

    // Cannot accept or decline a superseded quote
    expect(() => {
      applyCommand(w, {
        type: 'acceptQuote',
        id: q1Id,
        acceptance: {
          date: '2026-09-16',
          method: 'email',
          recordedAt: new Date().toISOString(),
        },
      })
    }).toThrow(/Cannot accept a superseded quote/)

    expect(() => {
      applyCommand(w, {
        type: 'declineQuote',
        id: q1Id,
        reason: 'Too expensive',
      })
    }).toThrow(/Cannot decline a superseded quote/)
  })

  it('records owner acceptance with verifiable evidence and supports decline', () => {
    let { w, client } = setupWorkspace()
    const qId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: qId,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-12',
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Agreed Deliverables', quantity: '1', rate: '3500.00', unit: 'fixed' }],
        tax: '20',
        discount: '0',
        discountType: 'amount',
        notes: 'Payment net 14',
        template: 'studio',
        accent: '#7c3aed',
      },
    })
    w = applyCommand(w, { type: 'sendQuote', id: qId })

    // Record owner acceptance
    const acceptTime = '2026-09-14T09:30:00Z'
    w = applyCommand(w, {
      type: 'acceptQuote',
      id: qId,
      acceptance: {
        date: '2026-09-14',
        method: 'email',
        reference: 'EMAIL-MSG-4482',
        notes: 'Client confirmed agreement to proposal via email from VP of Engineering',
        recordedAt: acceptTime,
      },
    })

    const acceptedQuote = w.quotes!.find(q => q.id === qId)!
    expect(acceptedQuote.status).toBe('accepted')
    expect(acceptedQuote.acceptance).toBeDefined()
    expect(acceptedQuote.acceptance?.method).toBe('email')
    expect(acceptedQuote.acceptance?.reference).toBe('EMAIL-MSG-4482')
    expect(acceptedQuote.acceptance?.notes).toContain('VP of Engineering')

    // Cannot accept an already accepted quote
    expect(() => {
      applyCommand(w, {
        type: 'acceptQuote',
        id: qId,
        acceptance: {
          date: '2026-09-15',
          method: 'verbal',
          recordedAt: new Date().toISOString(),
        },
      })
    }).toThrow(/Quote is already accepted/)

    // Cannot decline an accepted quote
    expect(() => {
      applyCommand(w, {
        type: 'declineQuote',
        id: qId,
        reason: 'Change of mind',
      })
    }).toThrow(/Cannot decline an accepted quote/)

    // Test declining on another quote
    const declineQId = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: declineQId,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-12',
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Declined Project', quantity: '1', rate: '5000.00', unit: 'fixed' }],
        tax: '0',
        discount: '0',
        discountType: 'amount',
        notes: '',
        template: 'studio',
        accent: '#7c3aed',
      },
    })
    w = applyCommand(w, { type: 'declineQuote', id: declineQId, reason: 'Budget constraints for Q3' })
    const declined = w.quotes!.find(q => q.id === declineQId)!
    expect(declined.status).toBe('declined')
    expect(declined.declinedReason).toBe('Budget constraints for Q3')
  })

  it('safely and idempotently converts accepted quotes to unissued draft invoices', () => {
    let { w, client } = setupWorkspace()
    const qId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createQuote',
      value: {
        id: qId,
        clientId: client.id,
        client,
        issueDate: '2026-09-12',
        expiryDate: '2026-10-12',
        currency: 'GBP',
        lines: [
          { id: crypto.randomUUID(), description: 'Cloud Migration Strategy', quantity: '1', rate: '3000.00', unit: 'fixed', group: 'Consulting' },
          { id: crypto.randomUUID(), description: 'Kubernetes Cluster Setup', quantity: '2', rate: '1500.00', unit: 'fixed', group: 'Infrastructure' },
        ],
        tax: '20',
        discount: '500.00',
        discountType: 'amount',
        scope: 'Full migration to managed cloud services',
        notes: 'Net 14 payment terms agreed.',
        template: 'studio',
        accent: '#7c3aed',
      },
    })

    // Unaccepted quote conversion is rejected
    expect(() => {
      applyCommand(w, { type: 'convertQuoteToInvoice', id: qId })
    }).toThrow(/Only accepted quotes can be converted/)

    // Mark sent, then accept
    w = applyCommand(w, { type: 'sendQuote', id: qId })
    w = applyCommand(w, {
      type: 'acceptQuote',
      id: qId,
      acceptance: {
        date: '2026-09-14',
        method: 'signed_document',
        reference: 'CONTRACT-AGR-098',
        recordedAt: new Date().toISOString(),
      },
    })

    // Convert to unissued draft invoice
    const initialInvoiceCount = w.invoices.length
    w = applyCommand(w, { type: 'convertQuoteToInvoice', id: qId })

    expect(w.invoices.length).toBe(initialInvoiceCount + 1)
    const convertedInvoice = w.invoices[0]

    // Verify unissued draft state
    expect(convertedInvoice.lifecycle).toBe('draft')
    expect(convertedInvoice.number).toBe('') // unissued
    expect(convertedInvoice.clientId).toBe(client.id)
    expect(convertedInvoice.client.name).toBe('Acme Global Corp')
    expect(convertedInvoice.lines.length).toBe(2)
    expect(convertedInvoice.lines[0].description).toBe('Cloud Migration Strategy')
    expect(convertedInvoice.tax).toBe('20')
    expect(convertedInvoice.discount).toBe('500.00')
    expect(convertedInvoice.breakdown).toBe('Full migration to managed cloud services')
    expect(convertedInvoice.notes).toBe('Net 14 payment terms agreed.')

    // Verify bidirectional traceability
    expect(convertedInvoice.convertedFromQuoteId).toBe(qId)
    expect(convertedInvoice.convertedFromQuoteNumber).toContain('ZEN-QT-2026-0001 (Rev 1)')
    const quoteAfter = w.quotes!.find(q => q.id === qId)!
    expect(quoteAfter.convertedInvoiceId).toBe(convertedInvoice.id)

    // IDEMPOTENCY CHECK:
    // Retrying conversion must NOT create a duplicate draft invoice!
    w = applyCommand(w, { type: 'convertQuoteToInvoice', id: qId })
    expect(w.invoices.length).toBe(initialInvoiceCount + 1)
    expect(w.quotes!.find(q => q.id === qId)!.convertedInvoiceId).toBe(convertedInvoice.id)

    // Converted quotes cannot be deleted
    expect(() => {
      applyCommand(w, { type: 'deleteQuote', id: qId })
    }).toThrow(/Converted quotes cannot be deleted/)
  })

  it('correctly calculates expiry status based on quote expiry date', () => {
    const { w, client } = setupWorkspace()
    const qId = crypto.randomUUID()

    const q: Quote = {
      id: qId,
      quoteNumber: 'ZEN-QT-2026-0001',
      revision: 1,
      status: 'sent',
      clientId: client.id,
      client,
      issueDate: '2026-08-01',
      expiryDate: '2026-09-01', // Expired relative to 2026-09-12
      currency: 'GBP',
      lines: [{ id: crypto.randomUUID(), description: 'Consulting', quantity: '1', rate: '500.00', unit: 'fixed' }],
      tax: '0',
      discount: '0',
      discountType: 'amount',
      notes: '',
      template: 'studio',
      accent: '#7c3aed',
      created: '2026-08-01T10:00:00Z',
      updated: '2026-08-01T10:00:00Z',
    }

    // Past expiry date computes to 'expired'
    expect(quoteStatus(q, '2026-09-12')).toBe('expired')
    // Before expiry date computes to 'sent'
    expect(quoteStatus(q, '2026-08-15')).toBe('sent')

    // If quote was accepted, it remains 'accepted' even after expiry date
    q.status = 'accepted'
    expect(quoteStatus(q, '2026-09-12')).toBe('accepted')

    // If quote was superseded, it remains 'superseded'
    q.status = 'superseded'
    expect(quoteStatus(q, '2026-09-12')).toBe('superseded')
  })

  it('renders quotation PDF with dedicated styling, revision info and acceptance banner', async () => {
    const { w, client } = setupWorkspace()
    const font = await loadFont()

    const q: Quote = {
      id: crypto.randomUUID(),
      quoteNumber: 'ZEN-QT-2026-0001',
      revision: 2,
      status: 'accepted',
      clientId: client.id,
      client,
      issueDate: '2026-09-12',
      expiryDate: '2026-10-12',
      currency: 'GBP',
      lines: [
        { id: crypto.randomUUID(), description: 'Core Application Architecture', quantity: '1', rate: '4000.00', unit: 'fixed' },
        { id: crypto.randomUUID(), description: 'Continuous Delivery Pipeline', quantity: '1', rate: '1500.00', unit: 'fixed' },
      ],
      tax: '20',
      discount: '500.00',
      discountType: 'amount',
      scope: 'Detailed technical specification and automated release pipeline.',
      notes: 'Payment terms: 50% upon contract signing, 50% upon final sign-off.',
      acceptance: {
        date: '2026-09-13',
        method: 'signed_document',
        reference: 'AGR-7829',
        notes: 'Signed and countersigned master service agreement.',
        recordedAt: '2026-09-13T16:00:00Z',
      },
      template: 'studio',
      accent: '#7c3aed',
      created: '2026-09-12T10:00:00Z',
      updated: '2026-09-13T16:00:00Z',
    }

    const pdfBytes = await renderQuotePDF(q, w.business, font)
    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(1000)

    // Load PDF back to verify PDF structure integrity
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toBe('ZEN-QT-2026-0001 Rev 2 Estimate')
    expect(doc.getAuthor()).toBe('Zenith Engineering Ltd')

    // Filename sanitizer test
    const fname = filenameQuote(q)
    expect(fname).toBe('ZEN-QT-2026-0001-Rev2-Acme-Global-Corp.pdf')
  })
})
