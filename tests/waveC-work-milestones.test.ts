import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  applyCommand,
  projectFinancials,
  formatWorkBreakdown,
  today,
  type Workspace,
  type Client,
  type Project,
  type WorkEntry,
  type Milestone,
} from '../src/shared/domain'
import { renderPDF, filename } from '../src/shared/pdf'

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

function setupWorkspace(): { w: Workspace; client: Client; project: Project } {
  const w = emptyWorkspace()
  w.business.name = 'Apex Systems Ltd'
  w.business.email = 'billing@apexsystems.example'
  w.business.address = '10 Silicon Way\nLondon EC2A 4NE'
  w.business.bank = 'Metro Bank\nSort: 20-40-60\nAcc: 12345678'
  w.business.currency = 'GBP'
  w.business.terms = 30
  w.business.prefix = 'APX'

  const client: Client = {
    id: crypto.randomUUID(),
    name: 'Omni Retail Global',
    email: 'finance@omniretail.example',
    address: '88 High Street\nLondon W1D 3PU',
    cc: [],
    replyTo: '',
    terms: 30,
    notes: 'Key Retail Account',
  }
  w.clients.push(client)

  const project: Project = {
    id: crypto.randomUUID(),
    name: 'E-Commerce Platform Replatforming',
    clientId: client.id,
    notes: 'Full replatforming sprint',
    agreedAmount: '12000.00',
    currency: 'GBP',
    milestones: [],
  }
  w.projects.push(project)

  return { w, client, project }
}

describe('Wave C: C02 Manual Billable Work Entries & Reservations', () => {
  it('creates, edits, and deletes billable work entries with validations', () => {
    let { w, client, project } = setupWorkspace()
    const entryId = crypto.randomUUID()

    // 1. Create work entry
    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: entryId,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-10',
        description: 'Architecture review & data modelling',
        quantity: '8.5',
        rate: '120.00',
        unit: 'hour',
        billable: true,
      },
    })

    const entry = (w.workEntries || []).find(e => e.id === entryId)
    expect(entry).toBeDefined()
    expect(entry?.description).toBe('Architecture review & data modelling')
    expect(entry?.status).toBe('unbilled')
    expect(entry?.quantity).toBe('8.5')
    expect(entry?.rate).toBe('120.00')

    // 2. Update unbilled work entry
    w = applyCommand(w, {
      type: 'updateWorkEntry',
      value: {
        id: entryId,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-10',
        description: 'Architecture review & performance tuning',
        quantity: '9.0',
        rate: '120.00',
        unit: 'hour',
        billable: true,
      },
    })

    const updated = (w.workEntries || []).find(e => e.id === entryId)
    expect(updated?.description).toBe('Architecture review & performance tuning')
    expect(updated?.quantity).toBe('9.0')

    // 3. Delete unbilled work entry
    w = applyCommand(w, {
      type: 'deleteWorkEntry',
      id: entryId,
    })
    expect((w.workEntries || []).find(e => e.id === entryId)).toBeUndefined()
  })

  it('prevents duplicate billing with persisted draft reservations and formats itemized breakdown', () => {
    let { w, client, project } = setupWorkspace()

    const e1Id = crypto.randomUUID()
    const e2Id = crypto.randomUUID()
    const nonBillableId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: e1Id,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-08',
        description: 'Frontend component migration',
        quantity: '6',
        rate: '100.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: e2Id,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-09',
        description: 'API integration endpoints',
        quantity: '4',
        rate: '110.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: nonBillableId,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-09',
        description: 'Internal retrospective',
        quantity: '2',
        rate: '0.00',
        unit: 'hour',
        billable: false,
      },
    })

    // Rejects billing non-billable entries
    expect(() => {
      applyCommand(w, {
        type: 'billWorkEntries',
        entryIds: [nonBillableId],
      })
    }).toThrow('Cannot bill non-billable work entry')

    // Bill valid entries into a draft invoice
    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [e1Id, e2Id],
    })

    const draft = w.invoices.find(i => i.lifecycle === 'draft')
    expect(draft).toBeDefined()
    expect(draft?.lines.length).toBe(2)
    expect(draft?.reservedWorkEntryIds).toEqual([e1Id, e2Id])
    expect(draft?.breakdown).toContain('Work log breakdown:')
    expect(draft?.breakdown).toContain('Frontend component migration')
    expect(draft?.breakdown).toContain('API integration endpoints')

    // Verify entries are now 'reserved' with reservedDraftId set
    const e1 = (w.workEntries || []).find(e => e.id === e1Id)
    const e2 = (w.workEntries || []).find(e => e.id === e2Id)
    expect(e1?.status).toBe('reserved')
    expect(e1?.reservedDraftId).toBe(draft?.id)
    expect(e2?.status).toBe('reserved')
    expect(e2?.reservedDraftId).toBe(draft?.id)

    // DUPLICATE BILLING PREVENTION: Concurrent billing attempt must fail
    expect(() => {
      applyCommand(w, {
        type: 'billWorkEntries',
        entryIds: [e1Id],
      })
    }).toThrow('already reserved')

    // Cannot edit or delete reserved work entry
    expect(() => {
      applyCommand(w, {
        type: 'updateWorkEntry',
        value: {
          id: e1Id,
          clientId: client.id,
          date: '2026-09-08',
          description: 'Attempted edit while reserved',
          quantity: '10',
          rate: '100.00',
          unit: 'hour',
          billable: true,
        },
      })
    }).toThrow('Reserved work entries cannot be edited')

    expect(() => {
      applyCommand(w, {
        type: 'deleteWorkEntry',
        id: e1Id,
      })
    }).toThrow('Reserved work entries cannot be deleted')
  })

  it('releases reservation when draft is released or discarded', () => {
    let { w, client, project } = setupWorkspace()
    const eId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: eId,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-11',
        description: 'Database schema migration',
        quantity: '5',
        rate: '95.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [eId],
    })

    const draft = w.invoices.find(i => i.lifecycle === 'draft')!
    expect((w.workEntries || []).find(e => e.id === eId)?.status).toBe('reserved')

    // Release reservation
    w = applyCommand(w, {
      type: 'releaseWorkEntries',
      draftId: draft.id,
    })

    const released = (w.workEntries || []).find(e => e.id === eId)
    expect(released?.status).toBe('unbilled')
    expect(released?.reservedDraftId).toBeUndefined()

    // Can now be billed again without error
    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [eId],
    })
    expect((w.workEntries || []).find(e => e.id === eId)?.status).toBe('reserved')
  })

  it('atomically transitions entries to billed upon issue and enforces void/credit non-rebill guarantee', () => {
    let { w, client, project } = setupWorkspace()
    const eId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: eId,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-12',
        description: 'Security penetration review',
        quantity: '10',
        rate: '150.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [eId],
    })

    const draft = w.invoices.find(i => i.lifecycle === 'draft')!

    // Issue invoice atomically
    w = applyCommand(w, {
      type: 'issue',
      id: draft.id,
    })

    const issuedInv = w.invoices.find(i => i.id === draft.id)!
    expect(issuedInv.lifecycle).toBe('issued')
    expect(issuedInv.number).toBe('APX-2026-0001')

    const billedEntry = (w.workEntries || []).find(e => e.id === eId)!
    expect(billedEntry.status).toBe('billed')
    expect(billedEntry.billedInvoiceId).toBe(issuedInv.id)
    expect(billedEntry.billedAt).toBeDefined()
    expect(billedEntry.reservedDraftId).toBeUndefined()

    // Cannot edit or delete billed entry
    expect(() => {
      applyCommand(w, {
        type: 'updateWorkEntry',
        value: {
          id: eId,
          clientId: client.id,
          date: '2026-09-12',
          description: 'Hacked description',
          quantity: '20',
          rate: '150.00',
          unit: 'hour',
          billable: true,
        },
      })
    }).toThrow('Billed work entries cannot be edited')

    expect(() => {
      applyCommand(w, {
        type: 'deleteWorkEntry',
        id: eId,
      })
    }).toThrow('Billed work entries cannot be deleted')

    // Cannot re-bill an already billed entry
    expect(() => {
      applyCommand(w, {
        type: 'billWorkEntries',
        entryIds: [eId],
      })
    }).toThrow('already billed')

    // VOID NON-REBILL GUARANTEE:
    // When an invoice is voided, billed work entries STAY billed so they are never silently re-billed.
    w = applyCommand(w, {
      type: 'void',
      id: issuedInv.id,
      reason: 'Client requested commercial cancellation',
    })

    const afterVoidEntry = (w.workEntries || []).find(e => e.id === eId)!
    expect(afterVoidEntry.status).toBe('billed')

    // CREDIT NOTE NON-REBILL GUARANTEE:
    // Create another entry and issue a second invoice
    const e2Id = crypto.randomUUID()
    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: e2Id,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-13',
        description: 'Post-launch stabilisation',
        quantity: '8',
        rate: '125.00',
        unit: 'hour',
        billable: true,
      },
    })
    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [e2Id],
    })
    const draft2 = w.invoices.find(i => i.lifecycle === 'draft')!
    w = applyCommand(w, {
      type: 'issue',
      id: draft2.id,
    })
    const issuedInv2 = w.invoices.find(i => i.id === draft2.id)!
    expect((w.workEntries || []).find(e => e.id === e2Id)?.status).toBe('billed')

    // Issue credit note
    w = applyCommand(w, {
      type: 'creditNote',
      invoiceId: issuedInv2.id,
      reason: 'Scope adjustment discount',
      lines: issuedInv2.lines,
      tax: issuedInv2.tax,
      replacement: false,
    })

    // Entry remains billed
    const afterCreditEntry = (w.workEntries || []).find(e => e.id === e2Id)!
    expect(afterCreditEntry.status).toBe('billed')
  })
})

describe('Wave C: C03 Project Milestone Billing & Financial Distinction', () => {
  it('manages project milestones and bills deposit, progress, and final without duplicate charges', () => {
    let { w, client, project } = setupWorkspace()

    const mDepositId = crypto.randomUUID()
    const mProgressId = crypto.randomUUID()
    const mFinalId = crypto.randomUUID()

    // 1. Create deposit milestone (order 1)
    w = applyCommand(w, {
      type: 'createMilestone',
      value: {
        id: mDepositId,
        projectId: project.id,
        title: 'Project Initiation Deposit (30%)',
        description: 'Upfront deposit to commence architecture and design',
        amount: '3600.00',
        order: 1,
        isDeposit: true,
      },
    })

    // 2. Create progress milestone (order 2)
    w = applyCommand(w, {
      type: 'createMilestone',
      value: {
        id: mProgressId,
        projectId: project.id,
        title: 'Sprint 1 & 2 Core Services Delivery (40%)',
        description: 'Completion and deployment of backend API and data layers',
        amount: '4800.00',
        order: 2,
        isDeposit: false,
      },
    })

    // 3. Create final milestone (order 3)
    w = applyCommand(w, {
      type: 'createMilestone',
      value: {
        id: mFinalId,
        projectId: project.id,
        title: 'Final Acceptance & Handover (30%)',
        description: 'Production cutover, UAT sign-off, and handover documentation',
        amount: '3600.00',
        order: 3,
        isDeposit: false,
      },
    })

    // Check initial project financials
    const finInitial = projectFinancials(project, w)
    expect(finInitial.agreed).toBe('12000.00')
    expect(finInitial.drafted).toBe('0.00')
    expect(finInitial.issued).toBe('0.00')
    expect(finInitial.received).toBe('0.00')
    expect(finInitial.remainingToBill).toBe('12000.00')

    // 4. Bill deposit milestone
    w = applyCommand(w, {
      type: 'billMilestone',
      milestoneId: mDepositId,
    })

    const depositDraft = w.invoices.find(i => i.lifecycle === 'draft')!
    expect(depositDraft).toBeDefined()
    expect(depositDraft.reservedMilestoneId).toBe(mDepositId)
    expect(depositDraft.lines[0].rate).toBe('3600.00')
    expect(depositDraft.lines[0].description).toContain('Project Initiation Deposit (30%)')

    // Duplicate billing prevention: second attempt throws
    expect(() => {
      applyCommand(w, {
        type: 'billMilestone',
        milestoneId: mDepositId,
      })
    }).toThrow('already reserved')

    // Check financials while deposit is in draft
    const updatedProject1 = w.projects.find(p => p.id === project.id)!
    const finWithDraft = projectFinancials(updatedProject1, w)
    expect(finWithDraft.agreed).toBe('12000.00')
    expect(finWithDraft.drafted).toBe('3600.00')
    expect(finWithDraft.issued).toBe('0.00')
    expect(finWithDraft.remainingToBill).toBe('8400.00')

    // 5. Issue deposit invoice atomically
    w = applyCommand(w, {
      type: 'issue',
      id: depositDraft.id,
    })

    const depositMilestoneBilled = w.projects
      .find(p => p.id === project.id)!
      .milestones!.find(m => m.id === mDepositId)!
    expect(depositMilestoneBilled.status).toBe('billed')
    expect(depositMilestoneBilled.billedInvoiceId).toBe(depositDraft.id)

    // Check financials after deposit invoice issued
    const finAfterDeposit = projectFinancials(w.projects.find(p => p.id === project.id)!, w)
    expect(finAfterDeposit.agreed).toBe('12000.00')
    expect(finAfterDeposit.drafted).toBe('0.00')
    expect(finAfterDeposit.issued).toBe('3600.00')
    expect(finAfterDeposit.remainingToBill).toBe('8400.00')
    expect(finAfterDeposit.received).toBe('0.00')

    // 6. Record payment for deposit invoice
    // Confirms that cash received is kept distinct from work invoiced!
    w = applyCommand(w, {
      type: 'payment',
      id: depositDraft.id,
      value: {
        id: crypto.randomUUID(),
        amount: '3600.00',
        date: '2026-09-15',
        method: 'Bank Transfer',
        reference: 'DEP-9812',
        notes: 'Deposit paid in full',
        reversed: false,
      },
    })

    const finAfterDepositPaid = projectFinancials(w.projects.find(p => p.id === project.id)!, w)
    expect(finAfterDepositPaid.agreed).toBe('12000.00')
    expect(finAfterDepositPaid.issued).toBe('3600.00')
    expect(finAfterDepositPaid.received).toBe('3600.00')
    expect(finAfterDepositPaid.remainingToBill).toBe('8400.00')

    // 7. Bill progress milestone (4800.00) and issue it
    w = applyCommand(w, {
      type: 'billMilestone',
      milestoneId: mProgressId,
    })
    const progressDraft = w.invoices.find(i => i.lifecycle === 'draft')!
    w = applyCommand(w, {
      type: 'issue',
      id: progressDraft.id,
    })

    const finAfterProgress = projectFinancials(w.projects.find(p => p.id === project.id)!, w)
    expect(finAfterProgress.issued).toBe('8400.00')
    expect(finAfterProgress.received).toBe('3600.00')
    expect(finAfterProgress.remainingToBill).toBe('3600.00')

    // 8. Bill final settlement milestone (3600.00) and issue it
    w = applyCommand(w, {
      type: 'billMilestone',
      milestoneId: mFinalId,
    })
    const finalDraft = w.invoices.find(i => i.lifecycle === 'draft')!
    w = applyCommand(w, {
      type: 'issue',
      id: finalDraft.id,
    })

    const finCompleted = projectFinancials(w.projects.find(p => p.id === project.id)!, w)
    expect(finCompleted.agreed).toBe('12000.00')
    expect(finCompleted.issued).toBe('12000.00')
    expect(finCompleted.received).toBe('3600.00')
    expect(finCompleted.remainingToBill).toBe('0.00')

    // Check all milestones are marked billed
    const allMilestones = w.projects.find(p => p.id === project.id)!.milestones!
    expect(allMilestones.every(m => m.status === 'billed')).toBe(true)

    // Cannot bill any of them again (duplicate billing prevention)
    expect(() => {
      applyCommand(w, {
        type: 'billMilestone',
        milestoneId: mFinalId,
      })
    }).toThrow('already billed')
  })

  it('releases milestone reservation cleanly when draft is released', () => {
    let { w, client, project } = setupWorkspace()
    const mId = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createMilestone',
      value: {
        id: mId,
        projectId: project.id,
        title: 'Prototype delivery',
        amount: '1500.00',
        order: 1,
        isDeposit: false,
      },
    })

    w = applyCommand(w, {
      type: 'billMilestone',
      milestoneId: mId,
    })

    const draft = w.invoices.find(i => i.lifecycle === 'draft')!
    expect(draft.reservedMilestoneId).toBe(mId)
    const reserved = w.projects.find(p => p.id === project.id)!.milestones!.find(m => m.id === mId)!
    expect(reserved.status).toBe('reserved')

    // Release reservation
    w = applyCommand(w, {
      type: 'releaseMilestone',
      draftId: draft.id,
    })

    const released = w.projects.find(p => p.id === project.id)!.milestones!.find(m => m.id === mId)!
    expect(released.status).toBe('pending')
    expect(released.reservedDraftId).toBeUndefined()
  })

  it('renders invoice and attached breakdown document PDF without double charges', async () => {
    let { w, client, project } = setupWorkspace()
    const font = await loadFont()

    const e1Id = crypto.randomUUID()
    const e2Id = crypto.randomUUID()

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: e1Id,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-01',
        description: 'System design documentation',
        quantity: '10',
        rate: '100.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'createWorkEntry',
      value: {
        id: e2Id,
        clientId: client.id,
        projectId: project.id,
        date: '2026-09-02',
        description: 'Infrastructure provisioning',
        quantity: '5',
        rate: '120.00',
        unit: 'hour',
        billable: true,
      },
    })

    w = applyCommand(w, {
      type: 'billWorkEntries',
      entryIds: [e1Id, e2Id],
    })

    const draft = w.invoices.find(i => i.lifecycle === 'draft')!
    w = applyCommand(w, {
      type: 'issue',
      id: draft.id,
    })

    const issuedInvoice = w.invoices.find(i => i.id === draft.id)!

    // 1. Render primary invoice PDF
    const primaryPdfBytes = await renderPDF(issuedInvoice, w.business, font, false)
    const primaryDoc = await PDFDocument.load(primaryPdfBytes)
    expect(primaryDoc.getPageCount()).toBeGreaterThanOrEqual(1)

    // 2. Render attached breakdown document PDF
    expect(issuedInvoice.breakdown).toBeDefined()
    expect(issuedInvoice.breakdown.length).toBeGreaterThan(0)
    const breakdownPdfBytes = await renderPDF(issuedInvoice, w.business, font, true)
    const breakdownDoc = await PDFDocument.load(breakdownPdfBytes)
    expect(breakdownDoc.getPageCount()).toBeGreaterThanOrEqual(1)

    const baseName = filename(issuedInvoice, false)
    const breakdownName = filename(issuedInvoice, true)
    expect(baseName).toBe('APX-2026-0001-Omni-Retail-Global.pdf')
    expect(breakdownName).toBe('APX-2026-0001-Omni-Retail-Global-Breakdown.pdf')
  })
})
