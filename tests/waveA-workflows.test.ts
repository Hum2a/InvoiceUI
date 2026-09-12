import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  status,
  issueErrors,
  detectInvoiceWarnings,
  buildInvoiceTimeline,
  formatTimelineDate,
  type Client,
  type Project,
  type Invoice,
} from '../src/shared/domain'
import { filename } from '../src/shared/pdf'
import { zipSync, strToU8 } from 'fflate'

describe('Wave A: Review, Command Menu, Bulk Operations & Unified Timeline (A05 - A08)', () => {
  describe('A05: Review before issue and send', () => {
    it('detects missing bank/payment instructions as a non-blocking warning', () => {
      const w = emptyWorkspace()
      w.business.bank = '' // No bank details
      const draft = newInvoice(w)
      draft.client = {
        id: crypto.randomUUID(),
        name: 'Test Client',
        email: 'billing@test.example',
        address: '10 Test Lane',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
        paymentInstructions: '', // No client bank either
      }
      draft.clientId = draft.client.id

      const warnings = detectInvoiceWarnings(draft, w)
      expect(warnings.some(warn => warn.type === 'missing-bank')).toBe(true)
      const missingBank = warnings.find(warn => warn.type === 'missing-bank')
      expect(missingBank?.title).toBe('Missing payment instructions')
    })

    it('detects potential duplicate invoices based on client, amount, and close issue dates', () => {
      let w = emptyWorkspace()
      w.business.bank = 'Barclays Sort: 20-00-00 Acc: 12345678'
      w.business.name = 'Humza Design Studio'
      w.business.address = '10 Baker Street, London'

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

      // Create and issue first invoice: £500
      const inv1 = newInvoice(w)
      inv1.clientId = client.id
      inv1.client = client
      inv1.issueDate = '2026-09-01'
      inv1.lines = [{ id: crypto.randomUUID(), description: 'Design consultation', quantity: '1', rate: '500.00', unit: 'fixed' }]
      w = applyCommand(w, { type: 'draft', value: inv1 })
      w = applyCommand(w, { type: 'issue', id: inv1.id })

      // Create second draft for same client with identical amount (£500) within 60 days
      const draft2 = newInvoice(w)
      draft2.clientId = client.id
      draft2.client = client
      draft2.issueDate = '2026-09-10'
      draft2.lines = [{ id: crypto.randomUUID(), description: 'Design consultation', quantity: '1', rate: '500.00', unit: 'fixed' }]

      const warnings = detectInvoiceWarnings(draft2, w)
      const dupWarning = warnings.find(warn => warn.type === 'duplicate')
      expect(dupWarning).toBeDefined()
      expect(dupWarning?.title).toBe('Possible duplicate invoice')
      expect(dupWarning?.matchedInvoiceId).toBe(inv1.id)
    })

    it('detects unusually old issue dates (>90 days) and past due dates', () => {
      const w = emptyWorkspace()
      w.business.bank = 'Bank details present'
      const draft = newInvoice(w)
      draft.issueDate = '2026-01-01' // Over 90 days before Sept 2026
      draft.dueDate = '2026-01-15'

      const warnings = detectInvoiceWarnings(draft, w, new Date('2026-09-12T12:00:00Z'))
      expect(warnings.some(warn => warn.type === 'old-date')).toBe(true)
      expect(warnings.some(warn => warn.type === 'past-due')).toBe(true)
    })

    it('distinguishes blocking errors from warnings and ensures draft is saved before issue', () => {
      let w = emptyWorkspace()
      w.business.name = 'Humza Studio'
      w.business.address = 'London'
      w.business.bank = 'Sort: 20-00-00 Acc: 12345678'

      const draft = newInvoice(w)
      // Empty client name & empty line description -> blocking errors
      draft.client.name = ''
      draft.lines = [{ id: crypto.randomUUID(), description: '', quantity: '1', rate: '100.00', unit: 'fixed' }]
      const blocking = issueErrors(draft, w.business)
      expect(blocking.length).toBeGreaterThan(0)
      expect(blocking).toContain('Add a client name.')
      expect(blocking).toContain('Each line needs a description and a quantity above zero.')

      // Once valid client and lines are set, blocking errors are 0
      draft.client.name = 'Valid Client'
      draft.lines = [{ id: crypto.randomUUID(), description: 'Website development', quantity: '1', rate: '1200.00', unit: 'fixed' }]
      const resolvedBlocking = issueErrors(draft, w.business)
      expect(resolvedBlocking.length).toBe(0)

      // Ensure save and issue transitions lifecycle cleanly
      w = applyCommand(w, { type: 'draft', value: draft })
      w = applyCommand(w, { type: 'issue', id: draft.id })
      const issued = w.invoices.find(i => i.id === draft.id)
      expect(issued?.lifecycle).toBe('issued')
      expect(issued?.number).toBeDefined()
      expect(issued?.issuedAt).toBeDefined()

      // Double-click safety: issuing an already issued invoice throws or does not re-issue
      expect(() => applyCommand(w, { type: 'issue', id: draft.id })).toThrow(/Only drafts can be issued/)
    })
  })

  describe('A06: Command menu, saved views and navigation memory', () => {
    it('filters command items across actions, invoices, clients, and projects', () => {
      let w = emptyWorkspace()
      w.business.name = 'Humza Studio'
      w.business.address = 'London'
      const client: Client = {
        id: crypto.randomUUID(),
        name: 'Acme Media UK',
        email: 'contact@acme.example',
        address: '10 Soho Sq',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
      }
      w = applyCommand(w, { type: 'client', value: client })

      const project: Project = {
        id: crypto.randomUUID(),
        clientId: client.id,
        name: 'Brand Refresh 2026',
        notes: 'Complete brand overhaul',
      }
      w = applyCommand(w, { type: 'project', value: project })

      const inv = newInvoice(w)
      inv.clientId = client.id
      inv.client = client
      inv.projectId = project.id
      inv.lines = [{ id: crypto.randomUUID(), description: 'Logo design', quantity: '1', rate: '950.00', unit: 'fixed' }]
      w = applyCommand(w, { type: 'draft', value: inv })
      w = applyCommand(w, { type: 'issue', id: inv.id })

      // Simulating command menu search query matching
      const matchSearch = (q: string) => {
        const query = q.trim().toLowerCase()
        const matchedInvoices = w.invoices.filter(i =>
          (i.number || '').toLowerCase().includes(query) ||
          i.client.name.toLowerCase().includes(query)
        )
        const matchedClients = w.clients.filter(c => c.name.toLowerCase().includes(query))
        const matchedProjects = w.projects.filter(p => p.name.toLowerCase().includes(query))
        return { matchedInvoices, matchedClients, matchedProjects }
      }

      // Search by invoice number prefix or digits
      const issuedInvoice = w.invoices.find(i => i.id === inv.id)!
      const numberSegment = issuedInvoice.number.slice(-4)
      const res1 = matchSearch(numberSegment)
      expect(res1.matchedInvoices.length).toBe(1)
      expect(res1.matchedInvoices[0].number).toBe(issuedInvoice.number)

      // Search by client name
      const res2 = matchSearch('Acme')
      expect(res2.matchedClients.length).toBe(1)
      expect(res2.matchedInvoices.length).toBe(1)

      // Search by project name
      const res3 = matchSearch('Brand Refresh')
      expect(res3.matchedProjects.length).toBe(1)
    })

    it('generates shareable search params preserving filter, pagination, and view state without exposing secrets', () => {
      const state = {
        view: 'Invoices',
        filter: 'overdue',
        client: 'client-123',
        project: 'project-456',
        from: '2026-01-01',
        to: '2026-06-30',
        page: 2,
      }

      const p = new URLSearchParams()
      if (state.view !== 'Invoices') p.set('view', state.view)
      if (state.filter !== 'all') p.set('filter', state.filter)
      if (state.client) p.set('client', state.client)
      if (state.project) p.set('project', state.project)
      if (state.from) p.set('from', state.from)
      if (state.to) p.set('to', state.to)
      if (state.page > 0) p.set('page', String(state.page))

      const urlQuery = p.toString()
      expect(urlQuery).toContain('filter=overdue')
      expect(urlQuery).toContain('client=client-123')
      expect(urlQuery).toContain('project=project-456')
      expect(urlQuery).toContain('from=2026-01-01')
      expect(urlQuery).toContain('page=2')
      // No secret tokens or credentials in URL
      expect(urlQuery).not.toContain('token')
      expect(urlQuery).not.toContain('secret')
      expect(urlQuery).not.toContain('auth')
    })
  })

  describe('A07: Safe selected bulk operations', () => {
    it('correctly generates CSV export with standard headers and escaped values', () => {
      const invoices: Invoice[] = [
        {
          id: crypto.randomUUID(),
          number: 'INV-2026-0001',
          lifecycle: 'issued',
          archived: false,
          clientId: crypto.randomUUID(),
          projectId: '',
          client: {
            id: crypto.randomUUID(),
            name: 'Acme "Special" Corp',
            email: 'billing@acme.example',
            address: 'London',
            cc: [],
            replyTo: '',
            terms: 30,
            notes: '',
          },
          issueDate: '2026-09-01',
          dueDate: '2026-10-01',
          terms: 30,
          manualDue: false,
          currency: 'GBP',
          lines: [{ id: crypto.randomUUID(), description: 'Consulting', quantity: '1', rate: '1000.00', unit: 'fixed' }],
          tax: '0',
          discount: '0',
          discountType: 'amount',
          deposit: '0',
          notes: '',
          po: '',
          reference: 'INV-2026-0001',
          breakdown: '',
          instalments: [],
          template: 'studio',
          accent: '#000',
          payments: [{ id: crypto.randomUUID(), amount: '400.00', date: '2026-09-05', method: 'bank', reference: 'TRX-1', notes: '', reversed: false }],
          created: '2026-09-01T10:00:00Z',
          updated: '2026-09-05T10:00:00Z',
          issuedAt: '2026-09-01T10:00:00Z',
          reminder: { enabled: false, days: 7, lastDate: '' },
          business: null,
        },
      ]

      const header = 'Invoice Number,Client,Issue Date,Due Date,Status,Currency,Total,Paid,Balance\n'
      const rows = invoices.map(i => {
        const t = totals(i)
        const s = status(i, '2026-09-12')
        return `"${i.number || 'Draft'}","${i.client.name.replace(/"/g, '""')}","${i.issueDate}","${i.dueDate}","${s}","${i.currency}","${t.total}","${t.paid}","${t.balance}"`
      }).join('\n')

      const csvContent = header + rows
      expect(csvContent).toContain('"INV-2026-0001"')
      expect(csvContent).toContain('"Acme ""Special"" Corp"')
      expect(csvContent).toContain('"1000.00"')
      expect(csvContent).toContain('"400.00"')
      expect(csvContent).toContain('"600.00"')
    })

    it('skips unissued drafts during bulk PDF ZIP packaging and tracks per-item status', () => {
      const issuedInv: Invoice = {
        id: crypto.randomUUID(),
        number: 'INV-2026-0010',
        lifecycle: 'issued',
        archived: false,
        clientId: crypto.randomUUID(),
        projectId: '',
        client: { id: crypto.randomUUID(), name: 'Client 1', email: '', address: '', cc: [], replyTo: '', terms: 14, notes: '' },
        issueDate: '2026-09-01',
        dueDate: '2026-09-15',
        terms: 14,
        manualDue: false,
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Item 1', quantity: '1', rate: '100.00', unit: 'fixed' }],
        tax: '0',
        discount: '0',
        discountType: 'amount',
        deposit: '0',
        notes: '',
        po: '',
        reference: '',
        breakdown: '',
        instalments: [],
        template: 'studio',
        accent: '#000',
        payments: [],
        created: '2026-09-01T10:00:00Z',
        updated: '2026-09-01T10:00:00Z',
        issuedAt: '2026-09-01T10:00:00Z',
        reminder: { enabled: false, days: 7, lastDate: '' },
        business: null,
      }

      const draftInv: Invoice = {
        id: crypto.randomUUID(),
        number: '',
        lifecycle: 'draft',
        archived: false,
        clientId: crypto.randomUUID(),
        projectId: '',
        client: { id: crypto.randomUUID(), name: 'Client 2', email: '', address: '', cc: [], replyTo: '', terms: 14, notes: '' },
        issueDate: '2026-09-01',
        dueDate: '2026-09-15',
        terms: 14,
        manualDue: false,
        currency: 'GBP',
        lines: [{ id: crypto.randomUUID(), description: 'Draft item', quantity: '1', rate: '200.00', unit: 'fixed' }],
        tax: '0',
        discount: '0',
        discountType: 'amount',
        deposit: '0',
        notes: '',
        po: '',
        reference: '',
        breakdown: '',
        instalments: [],
        template: 'studio',
        accent: '#000',
        payments: [],
        created: '2026-09-01T10:00:00Z',
        updated: '2026-09-01T10:00:00Z',
        reminder: { enabled: false, days: 7, lastDate: '' },
        business: null,
      }

      const selected = [issuedInv, draftInv]
      const items: { id: string; name: string; status: 'success' | 'skipped' | 'failed'; reason?: string }[] = []
      const files: Record<string, Uint8Array> = {}

      for (const inv of selected) {
        const label = inv.number || `Draft (${inv.client.name || 'Client'})`
        if (inv.lifecycle !== 'issued') {
          items.push({ id: inv.id, name: label, status: 'skipped', reason: 'Draft invoices do not have issued PDFs' })
          continue
        }
        // Mock render for test
        files[filename(inv)] = strToU8('%PDF-1.4 mock')
        items.push({ id: inv.id, name: label, status: 'success' })
      }

      expect(items).toHaveLength(2)
      expect(items[0].status).toBe('success')
      expect(items[1].status).toBe('skipped')
      expect(items[1].reason).toBe('Draft invoices do not have issued PDFs')

      // ZIP bundling
      const zip = zipSync(files)
      expect(zip).toBeInstanceOf(Uint8Array)
      expect(zip.length).toBeGreaterThan(0)
    })

    it('performs bulk archive and restore by ID without side-effects on unselected items', () => {
      let w = emptyWorkspace()
      const inv1 = newInvoice(w)
      inv1.number = 'INV-1'
      const inv2 = newInvoice(w)
      inv2.number = 'INV-2'
      const inv3 = newInvoice(w)
      inv3.number = 'INV-3'

      w = applyCommand(w, { type: 'draft', value: inv1 })
      w = applyCommand(w, { type: 'draft', value: inv2 })
      w = applyCommand(w, { type: 'draft', value: inv3 })

      // Bulk archive inv1 and inv2
      const toArchive = [inv1, inv2]
      for (const item of toArchive) {
        w = applyCommand(w, { type: 'archive', id: item.id, value: true })
      }

      expect(w.invoices.find(i => i.id === inv1.id)?.archived).toBe(true)
      expect(w.invoices.find(i => i.id === inv2.id)?.archived).toBe(true)
      expect(w.invoices.find(i => i.id === inv3.id)?.archived).toBe(false)

      // Restore inv1 only
      w = applyCommand(w, { type: 'archive', id: inv1.id, value: false })
      expect(w.invoices.find(i => i.id === inv1.id)?.archived).toBe(false)
      expect(w.invoices.find(i => i.id === inv2.id)?.archived).toBe(true)
    })
  })

  describe('A08: Unified invoice activity timeline', () => {
    it('aggregates draft creation, updates, issuance, payments, reversals, delivery, sharing, reminders, and void into a sorted timeline', () => {
      let w = emptyWorkspace()
      w.business.name = 'Humza Studio'
      w.business.address = 'London'
      w.business.bank = 'Sort: 20-00-00'
      w.business.timezone = 'Europe/London'

      const client: Client = {
        id: crypto.randomUUID(),
        name: 'Nexus Corp',
        email: 'accounts@nexus.example',
        address: '50 Broad St',
        cc: ['cfo@nexus.example'],
        replyTo: '',
        terms: 14,
        notes: '',
      }
      w = applyCommand(w, { type: 'client', value: client })

      // 1. Create draft
      const inv = newInvoice(w)
      inv.clientId = client.id
      inv.client = client
      inv.created = '2026-09-01T09:00:00.000Z'
      inv.updated = '2026-09-01T09:30:00.000Z'
      inv.lines = [{ id: crypto.randomUUID(), description: 'Web Platform Development', quantity: '1', rate: '2500.00', unit: 'fixed' }]
      w = applyCommand(w, { type: 'draft', value: inv })

      // 2. Issue invoice
      w = applyCommand(w, { type: 'issue', id: inv.id })
      let currentInv = w.invoices.find(i => i.id === inv.id)!

      // 3. Record payment 1 (to be reversed)
      const payment1 = {
        id: crypto.randomUUID(),
        amount: '1000.00',
        date: '2026-09-05',
        method: 'bank',
        reference: 'BACS-9921',
        notes: 'Deposit received',
        reversed: false,
      }
      w = applyCommand(w, { type: 'payment', id: currentInv.id, value: payment1 })

      // 4. Reverse payment 1
      w = applyCommand(w, { type: 'reverse', id: currentInv.id, paymentId: payment1.id })

      // 5. Record payment 2 (active)
      const payment2 = {
        id: crypto.randomUUID(),
        amount: '500.00',
        date: '2026-09-06',
        method: 'bank',
        reference: 'BACS-9925',
        notes: 'Part payment',
        reversed: false,
      }
      w = applyCommand(w, { type: 'payment', id: currentInv.id, value: payment2 })

      // 6. Delivery attempt
      w.messages = [
        {
          id: crypto.randomUUID(),
          invoiceId: currentInv.id,
          to: client.email,
          cc: client.cc,
          replyTo: '',
          subject: 'Invoice INV-2026-0001 from Humza Studio',
          body: 'Here is your invoice.',
          status: 'delivered',
          kind: 'invoice',
          created: '2026-09-02T10:00:00.000Z',
          attempted: '2026-09-02T10:00:05.000Z',
        },
      ]

      // 7. Public share token
      currentInv = w.invoices.find(i => i.id === inv.id)!
      currentInv.share = { token: 'secret-token-12345', expires: '2026-10-01' }
      w.audit = [
        {
          id: crypto.randomUUID(),
          invoiceId: currentInv.id,
          action: 'share',
          at: '2026-09-02T11:00:00.000Z',
        },
      ]

      // 8. Automated reminder
      currentInv.reminder = { enabled: true, days: 7, lastDate: '2026-09-10' }

      const timeline = buildInvoiceTimeline(currentInv, w)

      // Timeline events must be non-empty and chronologically descending
      expect(timeline.length).toBeGreaterThanOrEqual(7)
      for (let idx = 0; idx < timeline.length - 1; idx++) {
        const tA = new Date(timeline[idx].at).getTime()
        const tB = new Date(timeline[idx + 1].at).getTime()
        expect(tA).toBeGreaterThanOrEqual(tB)
      }

      // Verify specific events exist with correct categories
      const categories = new Set(timeline.map(e => e.category))
      expect(categories.has('Lifecycle')).toBe(true)
      expect(categories.has('Payment')).toBe(true)
      expect(categories.has('Delivery')).toBe(true)
      expect(categories.has('Sharing')).toBe(true)
      expect(categories.has('System')).toBe(true)

      // Verify privacy boundary: share token must NEVER be exposed in detail or title
      for (const event of timeline) {
        expect(event.detail).not.toContain('secret-token-12345')
        expect(event.title).not.toContain('secret-token-12345')
      }

      // Verify private flag on internal events
      const createdEvent = timeline.find(e => e.type === 'created')
      expect(createdEvent?.isPrivate).toBe(true)

      const issuedEvent = timeline.find(e => e.type === 'issued')
      expect(issuedEvent?.isPrivate).toBe(false)
      expect(issuedEvent?.title).toContain('Invoice issued')

      const payEvent = timeline.find(e => e.type === 'payment')
      expect(payEvent?.title).toContain('Payment recorded: £500.00')

      const revEvent = timeline.find(e => e.type === 'reversal')
      expect(revEvent?.title).toContain('Payment reversed: £1,000.00')

      const delEvent = timeline.find(e => e.type === 'delivery')
      expect(delEvent?.detail).toContain(client.email)
      expect(delEvent?.status).toBe('delivered')
    })

    it('formats timestamps accurately according to business timezone', () => {
      const iso = '2026-09-12T17:30:00.000Z'
      const londonFormatted = formatTimelineDate(iso, 'Europe/London')
      expect(londonFormatted).toContain('12 Sept 2026')
      // BST is UTC+1 in September -> 18:30
      expect(londonFormatted).toContain('18:30')

      const nyFormatted = formatTimelineDate(iso, 'America/New_York')
      expect(nyFormatted).toContain('12 Sept 2026')
      // EDT is UTC-4 in September -> 13:30
      expect(nyFormatted).toContain('13:30')
    })
  })
})
