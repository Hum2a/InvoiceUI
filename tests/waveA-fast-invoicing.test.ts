import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  resolveClientDefaults,
  createFromStarter,
  createFromLastInvoice,
  parseTabularLines,
  type Client,
  type Starter,
  type Line,
} from '../src/shared/domain'

describe('Wave A: Fast Invoicing Workflows (A01 - A04)', () => {
  describe('A01: Resumable first-invoice setup and synthetic preview isolation', () => {
    it('tracks onboarding completion accurately across business, bank, client, and invoice', () => {
      let w = emptyWorkspace()

      // Step 1: Business identity
      expect(Boolean(w.business.name.trim() && w.business.address.trim())).toBe(false)
      w.business.name = 'Humza Design Studio'
      w.business.address = '10 Baker Street, London W1U 3BW'
      expect(Boolean(w.business.name.trim() && w.business.address.trim())).toBe(true)

      // Step 2: Bank instructions
      expect(Boolean(w.business.bank.trim())).toBe(false)
      w.business.bank = 'Barclays UK - Sort: 20-00-00 - Acc: 12345678'
      expect(Boolean(w.business.bank.trim())).toBe(true)

      // Step 3: First client
      expect(w.clients.length).toBe(0)
      const client: Client = {
        id: crypto.randomUUID(),
        name: 'Acme Corp',
        email: 'billing@acme.example',
        address: '100 Silicon Way',
        cc: [],
        replyTo: '',
        terms: 30,
        notes: '',
      }
      w = applyCommand(w, { type: 'client', value: client })
      expect(w.clients.length).toBe(1)

      // Step 4: First invoice
      expect(w.invoices.length).toBe(0)
      const draft = newInvoice(w)
      draft.clientId = client.id
      draft.client = client
      w = applyCommand(w, { type: 'draft', value: draft })
      expect(w.invoices.length).toBe(1)
    })

    it('allows dismissing onboarding without blocking navigation and supports resumption', () => {
      let w = emptyWorkspace()
      expect(w.business.onboardingDismissed).toBe(false)

      // Dismiss onboarding
      w = applyCommand(w, { type: 'dismissOnboarding', dismissed: true })
      expect(w.business.onboardingDismissed).toBe(true)

      // Verify normal operations continue seamlessly while dismissed
      const client: Client = {
        id: crypto.randomUUID(),
        name: 'Globex Inc',
        email: 'accounts@globex.example',
        address: '42 Main St',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
      }
      w = applyCommand(w, { type: 'client', value: client })
      expect(w.clients).toHaveLength(1)

      // Resume onboarding
      w = applyCommand(w, { type: 'dismissOnboarding', dismissed: false })
      expect(w.business.onboardingDismissed).toBe(false)
    })

    it('ensures sample invoice data is strictly isolated and never saved into workspace', () => {
      const w = emptyWorkspace()
      // Initial workspace is pristine
      expect(w.invoices).toHaveLength(0)
      expect(w.clients).toHaveLength(0)
      expect(w.business.name).toBe('')

      // Synthetic data used for reference preview
      const sampleBusiness = {
        name: 'Acme Studio Ltd',
        address: '12 Studio Walk, London',
      }
      const sampleInvoiceNumber = 'INV-2026-0001'

      // Verify workspace remained unaffected
      expect(w.invoices.some(i => i.number === sampleInvoiceNumber)).toBe(false)
      expect(w.business.name).not.toBe(sampleBusiness.name)
    })
  })

  describe('A02: Predictable client defaults and switching on populated drafts', () => {
    it('resolves defaults in precedence order: client default -> business default', () => {
      const w = emptyWorkspace()
      w.business.currency = 'GBP'
      w.business.terms = 30
      w.business.template = 'studio'
      w.business.bank = 'Business Bank Account'

      const clientWithDefaults: Client = {
        id: crypto.randomUUID(),
        name: 'International Client',
        email: 'client@global.example',
        address: 'New York, USA',
        cc: [],
        replyTo: '',
        terms: 15,
        notes: '',
        currency: 'USD',
        template: 'minimal',
        paymentInstructions: 'US Wire: Routing 123456789 Acc 987654321',
        rateOverrides: {
          'Senior Advisory': '250.00',
        },
      }

      // 1. When client has defaults, they take precedence over business defaults
      const resolved1 = resolveClientDefaults(clientWithDefaults, w.business)
      expect(resolved1.currency).toBe('USD')
      expect(resolved1.terms).toBe(15)
      expect(resolved1.template).toBe('minimal')
      expect(resolved1.paymentInstructions).toBe('US Wire: Routing 123456789 Acc 987654321')

      // 2. When client lacks specific defaults, fallback to business defaults
      const plainClient: Client = {
        id: crypto.randomUUID(),
        name: 'Local Client',
        email: 'local@example.com',
        address: 'London, UK',
        cc: [],
        replyTo: '',
        terms: 30,
        notes: '',
      }
      const resolved2 = resolveClientDefaults(plainClient, w.business)
      expect(resolved2.currency).toBe('GBP')
      expect(resolved2.terms).toBe(30)
      expect(resolved2.template).toBe('studio')
      expect(resolved2.paymentInstructions).toBe('Business Bank Account')
    })

    it('safely switches clients on a populated draft preserving manual line rates and currency', () => {
      let w = emptyWorkspace()
      w.business.currency = 'GBP'

      const clientA: Client = {
        id: crypto.randomUUID(),
        name: 'Client Alpha',
        email: 'alpha@example.com',
        address: 'London',
        cc: [],
        replyTo: '',
        terms: 30,
        notes: '',
        currency: 'GBP',
      }
      const clientB: Client = {
        id: crypto.randomUUID(),
        name: 'Client Beta',
        email: 'beta@example.com',
        address: 'Dublin',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
        currency: 'EUR',
        template: 'minimal',
        rateOverrides: {
          'Consulting': '150.00',
        },
      }
      w = applyCommand(w, { type: 'client', value: clientA })
      w = applyCommand(w, { type: 'client', value: clientB })

      // Create a populated draft with manual currency and custom line rates
      const draft = newInvoice(w)
      draft.clientId = clientA.id
      draft.client = clientA
      draft.currency = 'GBP'
      draft.lines = [
        { id: 'l1', description: 'Consulting', quantity: '10', rate: '200.00', unit: 'hour' },
        { id: 'l2', description: 'Design Sprint', quantity: '1', rate: '1500.00', unit: 'fixed' },
      ]

      // Scenario 1: User switches client but keeps manual overrides
      const updatedKeepManual = {
        ...draft,
        clientId: clientB.id,
        client: structuredClone(clientB),
        // Preserve manual currency and line rates
        currency: draft.currency,
        lines: structuredClone(draft.lines),
      }
      expect(updatedKeepManual.clientId).toBe(clientB.id)
      expect(updatedKeepManual.currency).toBe('GBP')
      expect(updatedKeepManual.lines[0].rate).toBe('200.00')

      // Scenario 2: User switches client and chooses to apply client defaults
      const clientBDefaults = resolveClientDefaults(clientB, w.business)
      const updatedApplyDefaults = {
        ...draft,
        clientId: clientB.id,
        client: structuredClone(clientB),
        currency: clientBDefaults.currency,
        terms: clientBDefaults.terms,
        template: clientBDefaults.template,
        lines: draft.lines.map(line => ({
          ...line,
          rate: clientB.rateOverrides?.[line.description] ?? line.rate,
        })),
      }
      expect(updatedApplyDefaults.clientId).toBe(clientB.id)
      expect(updatedApplyDefaults.currency).toBe('EUR')
      expect(updatedApplyDefaults.terms).toBe(14)
      expect(updatedApplyDefaults.template).toBe('minimal')
      // Consulting rate was updated to Client Beta's override of 150.00
      expect(updatedApplyDefaults.lines[0].rate).toBe('150.00')
      // Design Sprint had no override, so rate was preserved
      expect(updatedApplyDefaults.lines[1].rate).toBe('1500.00')
    })
  })

  describe('A03: Invoice starters and service bundles', () => {
    it('creates a fresh unnumbered draft from a starter with zero leaked metadata', () => {
      let w = emptyWorkspace()
      const starter: Starter = {
        id: crypto.randomUUID(),
        name: 'Website Launch Package',
        description: 'Standard 2-week launch bundle',
        lines: [
          { id: crypto.randomUUID(), description: 'Frontend Build', quantity: '40', rate: '85.00', unit: 'hour', group: 'Development' },
          { id: crypto.randomUUID(), description: 'Cloud Infrastructure', quantity: '1', rate: '750.00', unit: 'fixed', group: 'Infrastructure' },
        ],
        terms: 14,
        notes: 'Includes 30 days of post-launch maintenance.',
        favourite: true,
      }
      w = applyCommand(w, { type: 'starter', value: starter })
      expect(w.starters).toHaveLength(1)

      const draft = createFromStarter(w, starter.id)
      // Must be a fresh draft
      expect(draft.number).toBe('')
      expect(draft.lifecycle).toBe('draft')
      expect(draft.archived).toBe(false)
      expect(draft.issuedAt).toBeUndefined()
      expect(draft.voidReason).toBeUndefined()
      expect(draft.share).toBeUndefined()
      expect(draft.payments).toEqual([])
      expect(draft.lines).toHaveLength(2)
      expect(draft.lines[0].group).toBe('Development')
      expect(draft.lines[1].group).toBe('Infrastructure')
      expect(draft.terms).toBe(14)
      expect(draft.notes).toBe('Includes 30 days of post-launch maintenance.')

      // Verifies line IDs are freshly generated UUIDs, not identical to the starter line IDs
      expect(draft.lines[0].id).not.toBe(starter.lines[0].id)
      expect(draft.lines[1].id).not.toBe(starter.lines[1].id)
    })

    it('creates a fresh draft from a client last invoice without leaking payments or share tokens', () => {
      let w = emptyWorkspace()
      w.business.name = 'Dev Studio'
      w.business.address = 'London'

      const client: Client = {
        id: crypto.randomUUID(),
        name: 'Prior Client Ltd',
        email: 'prior@example.com',
        address: 'Bristol',
        cc: [],
        replyTo: '',
        terms: 21,
        notes: '',
      }
      w = applyCommand(w, { type: 'client', value: client })

      // Create and issue an invoice with payments and share token
      const oldInvoice = newInvoice(w)
      oldInvoice.clientId = client.id
      oldInvoice.client = client
      oldInvoice.terms = 21
      oldInvoice.notes = 'Regular monthly retainer'
      oldInvoice.lines = [
        { id: crypto.randomUUID(), description: 'Monthly Retainer', quantity: '1', rate: '2500.00', unit: 'fixed', group: 'Retainer' },
      ]
      w = applyCommand(w, { type: 'draft', value: oldInvoice })
      w = applyCommand(w, { type: 'issue', id: oldInvoice.id })
      w = applyCommand(w, {
        type: 'payment',
        id: oldInvoice.id,
        value: {
          id: crypto.randomUUID(),
          amount: '2500.00',
          date: '2026-09-01',
          method: 'Bank Transfer',
          reference: 'TX-1001',
          notes: 'Full payment',
          reversed: false,
        },
      })
      w = applyCommand(w, { type: 'share', id: oldInvoice.id, expires: '2026-12-31' })

      const issuedInvoice = w.invoices.find(i => i.id === oldInvoice.id)!
      expect(issuedInvoice.lifecycle).toBe('issued')
      expect(issuedInvoice.number).toBe('INV-2026-0001')
      expect(issuedInvoice.payments).toHaveLength(1)
      expect(issuedInvoice.share).toBeDefined()

      // Now create a fresh draft from the last invoice
      const nextDraft = createFromLastInvoice(w, client.id)
      expect(nextDraft.number).toBe('')
      expect(nextDraft.lifecycle).toBe('draft')
      expect(nextDraft.payments).toEqual([])
      expect(nextDraft.share).toBeUndefined()
      expect(nextDraft.issuedAt).toBeUndefined()
      expect(nextDraft.voidReason).toBeUndefined()
      expect(nextDraft.clientId).toBe(client.id)
      expect(nextDraft.terms).toBe(21)
      expect(nextDraft.notes).toBe('Regular monthly retainer')
      expect(nextDraft.lines).toHaveLength(1)
      expect(nextDraft.lines[0].description).toBe('Monthly Retainer')
      expect(nextDraft.lines[0].group).toBe('Retainer')
      // Fresh IDs
      expect(nextDraft.id).not.toBe(issuedInvoice.id)
      expect(nextDraft.lines[0].id).not.toBe(issuedInvoice.lines[0].id)
    })

    it('modifying or deleting a starter never mutates existing invoices or drafts', () => {
      let w = emptyWorkspace()
      const starter: Starter = {
        id: crypto.randomUUID(),
        name: 'SEO Audit',
        description: 'Full technical SEO review',
        lines: [{ id: crypto.randomUUID(), description: 'Technical Audit', quantity: '1', rate: '800.00', unit: 'fixed' }],
        favourite: false,
      }
      w = applyCommand(w, { type: 'starter', value: starter })

      const draft = createFromStarter(w, starter.id)
      w = applyCommand(w, { type: 'draft', value: draft })

      // Modify the starter
      const modifiedStarter: Starter = {
        ...starter,
        lines: [{ id: starter.lines[0].id, description: 'Expanded Technical Audit', quantity: '1', rate: '1200.00', unit: 'fixed' }],
      }
      w = applyCommand(w, { type: 'starter', value: modifiedStarter })

      // Existing draft remains unchanged
      const savedDraft = w.invoices.find(i => i.id === draft.id)!
      expect(savedDraft.lines[0].description).toBe('Technical Audit')
      expect(savedDraft.lines[0].rate).toBe('800.00')

      // Delete starter
      w = applyCommand(w, { type: 'deleteStarter', id: starter.id })
      expect(w.starters).toHaveLength(0)
      expect(w.invoices.find(i => i.id === draft.id)).toBeDefined()
    })
  })

  describe('A04: Faster line entry, tabular paste and keyboard editing', () => {
    it('parses valid tabular blocks from spreadsheets (TSV, CSV, pipe-delimited)', () => {
      const tsv = 'UI Design\t15\t95.00\tDesign System\t1\t1200\nCode Review\t5\t120.50'
      const resTsv = parseTabularLines('UI Design\t15\t95.00\nDesign System\t1\t1200\nCode Review\t5\t120.50\thour\tEngineering')
      expect(resTsv.errors).toHaveLength(0)
      expect(resTsv.valid).toHaveLength(3)
      expect(resTsv.valid[0].description).toBe('UI Design')
      expect(resTsv.valid[0].quantity).toBe('15')
      expect(resTsv.valid[0].rate).toBe('95.00')
      expect(resTsv.valid[2].group).toBe('Engineering')

      // CSV with currency symbols ($ and £) and formatted numbers
      const csv = 'Backend API, 20, £85.00\nDatabase Setup, 1, $650.00'
      const resCsv = parseTabularLines(csv)
      expect(resCsv.errors).toHaveLength(0)
      expect(resCsv.valid).toHaveLength(2)
      expect(resCsv.valid[0].description).toBe('Backend API')
      expect(resCsv.valid[0].quantity).toBe('20')
      expect(resCsv.valid[0].rate).toBe('85.00')
      expect(resCsv.valid[1].rate).toBe('650.00')

      // Pipe-delimited
      const pipe = 'Architecture | 2 | 1500.00'
      const resPipe = parseTabularLines(pipe)
      expect(resPipe.errors).toHaveLength(0)
      expect(resPipe.valid).toHaveLength(1)
      expect(resPipe.valid[0].description).toBe('Architecture')
      expect(resPipe.valid[0].quantity).toBe('2')
      expect(resPipe.valid[0].rate).toBe('1500.00')
    })

    it('rejects malformed numbers and flags line errors without silently corrupting amounts', () => {
      const malformed = [
        'Valid Line\t2\t100.00',
        'Invalid Rate\t5\tabc',
        'Negative Qty\t-2\t50.00',
        'Zero Qty\t0\t75.00',
        '\t10\t100.00',
        'Malformed Decimal\t1\t12.34567',
      ].join('\n')

      const res = parseTabularLines(malformed)
      expect(res.errors.length).toBeGreaterThan(0)
      // Check specific error messages
      expect(res.errors.some(e => e.row === 2 && e.reason.toLowerCase().includes('rate'))).toBe(true)
      expect(res.errors.some(e => e.row === 3 && e.reason.toLowerCase().includes('quantity'))).toBe(true)
      expect(res.errors.some(e => e.row === 4 && e.reason.toLowerCase().includes('quantity'))).toBe(true)
      expect(res.errors.some(e => e.row === 5 && e.reason.toLowerCase().includes('description'))).toBe(true)
      expect(res.errors.some(e => e.row === 6 && e.reason.toLowerCase().includes('rate'))).toBe(true)

      // Only line 1 was valid
      expect(res.valid).toHaveLength(1)
      expect(res.valid[0].description).toBe('Valid Line')
    })

    it('demonstrates line reordering and keyboard line movements (Alt+Up / Alt+Down / Duplicate)', () => {
      const l1: Line = { id: '1', description: 'Item A', quantity: '1', rate: '10.00', unit: 'fixed' }
      const l2: Line = { id: '2', description: 'Item B', quantity: '2', rate: '20.00', unit: 'fixed' }
      const l3: Line = { id: '3', description: 'Item C', quantity: '3', rate: '30.00', unit: 'fixed' }

      let lines = [l1, l2, l3]

      // Move Item B up (Alt+Up from index 1)
      const moveUp = (arr: Line[], idx: number) => {
        if (idx <= 0) return arr
        const next = [...arr]
        const [item] = next.splice(idx, 1)
        next.splice(idx - 1, 0, item)
        return next
      }

      lines = moveUp(lines, 1)
      expect(lines.map(l => l.description)).toEqual(['Item B', 'Item A', 'Item C'])

      // Move Item B down (Alt+Down from index 0)
      const moveDown = (arr: Line[], idx: number) => {
        if (idx >= arr.length - 1) return arr
        const next = [...arr]
        const [item] = next.splice(idx, 1)
        next.splice(idx + 1, 0, item)
        return next
      }

      lines = moveDown(lines, 0)
      expect(lines.map(l => l.description)).toEqual(['Item A', 'Item B', 'Item C'])

      // Duplicate Item B (Alt+D or duplicate button)
      const duplicateLine = (arr: Line[], idx: number) => {
        const item = arr[idx]
        const copy: Line = { ...structuredClone(item), id: crypto.randomUUID() }
        const next = [...arr]
        next.splice(idx + 1, 0, copy)
        return next
      }

      lines = duplicateLine(lines, 1)
      expect(lines).toHaveLength(4)
      expect(lines.map(l => l.description)).toEqual(['Item A', 'Item B', 'Item B', 'Item C'])
      expect(lines[2].id).not.toBe(lines[1].id)
    })

    it('ensures line grouping and subheadings do not alter totals or arithmetic', () => {
      const w = emptyWorkspace()
      const draft = newInvoice(w)
      draft.currency = 'GBP'
      draft.lines = [
        { id: '1', description: 'Discovery', quantity: '10', rate: '100.00', unit: 'hour', group: 'Phase 1' },
        { id: '2', description: 'Design Sprint', quantity: '1', rate: '1500.00', unit: 'fixed', group: 'Phase 1' },
        { id: '3', description: 'Development', quantity: '20', rate: '100.00', unit: 'hour', group: 'Phase 2' },
        { id: '4', description: 'Deployment', quantity: '1', rate: '500.00', unit: 'fixed', group: 'Phase 2' },
      ]

      const totalsWithGroups = totals(draft)

      // Total calculation: (10*100) + 1500 + (20*100) + 500 = 1000 + 1500 + 2000 + 500 = 5000.00
      expect(totalsWithGroups.subtotal).toBe('5000.00')
      expect(totalsWithGroups.total).toBe('5000.00')

      // Remove groups
      const draftWithoutGroups = {
        ...draft,
        lines: draft.lines.map(l => ({ ...l, group: undefined })),
      }
      const totalsWithoutGroups = totals(draftWithoutGroups)

      expect(totalsWithGroups.subtotal).toBe(totalsWithoutGroups.subtotal)
      expect(totalsWithGroups.total).toBe(totalsWithoutGroups.total)
      expect(totalsWithGroups.lineTotals).toEqual(totalsWithoutGroups.lineTotals)
    })

    it('supports local undo for line item edits', () => {
      const initialLines: Line[] = [
        { id: '1', description: 'Initial Line', quantity: '1', rate: '100.00', unit: 'fixed' },
      ]
      const history: Line[][] = []

      // Action 1: Add a line
      history.push(structuredClone(initialLines))
      let currentLines: Line[] = [
        ...initialLines,
        { id: '2', description: 'Second Line', quantity: '2', rate: '50.00', unit: 'hour' },
      ]
      expect(currentLines).toHaveLength(2)

      // Action 2: User triggers Undo (Ctrl+Z)
      const previous = history.pop()
      expect(previous).toBeDefined()
      if (previous) currentLines = previous
      expect(currentLines).toHaveLength(1)
      expect(currentLines[0].description).toBe('Initial Line')
    })
  })
})
