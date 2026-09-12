import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  emptyWorkspace,
  applyCommand,
  newInvoice,
  buildClientPortalView,
  getAttentionQueueItems,
  totals,
  type Workspace,
  type Invoice,
  type Command,
} from '../src/shared/domain'

function cmd(w: Workspace, command: Command): Workspace {
  const next = applyCommand(w, command)
  Object.assign(w, next)
  return w
}

function createTestWorkspace(): Workspace {
  const w = emptyWorkspace()
  w.business = {
    name: 'Acme Advisory Ltd',
    email: 'billing@acme.example',
    address: '100 King Street, London EC2V 8AU',
    bank: 'Bank: NatWest\nAccount: 12345678\nSort Code: 60-00-01',
    currency: 'GBP',
    terms: 14,
    prefix: 'ACM',
    accent: '#bef264',
    template: 'studio',
    timezone: 'Europe/London',
    autoReminders: false,
    taxId: 'GB999888777',
    footer: 'Thank you for your business.',
    logo: '',
    onboardingDismissed: true,
  }
  return w
}

describe('Wave D: D02 Installable Mobile App Experience', () => {
  it('validates web app manifest for standalone mobile installation', () => {
    const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)

    expect(manifest.name).toBe('InvoiceUI')
    expect(manifest.short_name).toBe('InvoiceUI')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#18181b')
    expect(manifest.background_color).toBe('#f8f8f6')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it('validates privacy-first service worker cache rules and exclusions', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js')
    expect(fs.existsSync(swPath)).toBe(true)

    const swContent = fs.readFileSync(swPath, 'utf8')

    // Must handle skip waiting
    expect(swContent).toContain('SKIP_WAITING')

    // Must explicitly exclude API endpoints from cache
    expect(swContent).toContain('/api/')

    // Must explicitly exclude PDF downloads and previews from cache
    expect(swContent).toContain('.pdf')
    expect(swContent).toContain("searchParams.has('download')")

    // Must cache only shell static assets
    expect(swContent).toContain('SHELL_ASSETS')
  })
})

describe('Wave D: D03 Client Account View (Client Portal)', () => {
  it('creates client portal link with separate cryptographic token and expiration', () => {
    const w = createTestWorkspace()
    const clientId = crypto.randomUUID()

    cmd(w, {
      type: 'client',
      value: {
        id: clientId,
        name: 'Nexus Tech Ltd',
        email: 'accounts@nexustech.example',
        address: '42 High Street, Bristol BS1 2AW',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
        currency: 'GBP',
      },
    })

    cmd(w, {
      type: 'sharePortal',
      clientId,
      expires: '2026-12-31',
      allowStatements: true,
      allowAttachments: true,
    })

    const client = w.clients.find(c => c.id === clientId)!
    expect(client.portal).toBeDefined()
    expect(client.portal!.token).toBeTruthy()
    expect(client.portal!.token.length).toBeGreaterThan(30)
    expect(client.portal!.expires).toBe('2026-12-31')
    expect(client.portal!.allowStatements).toBe(true)
    expect(client.portal!.allowAttachments).toBe(true)
  })

  it('provides scoped read-only portal view with strict attachment and document privacy', () => {
    const w = createTestWorkspace()
    const clientId = crypto.randomUUID()
    const otherClientId = crypto.randomUUID()

    cmd(w, {
      type: 'client',
      value: {
        id: clientId,
        name: 'Nexus Tech Ltd',
        email: 'accounts@nexustech.example',
        address: '42 High Street, Bristol BS1 2AW',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: 'Strict internal note about payment history',
        currency: 'GBP',
      },
    })

    cmd(w, {
      type: 'client',
      value: {
        id: otherClientId,
        name: 'Other Client Corp',
        email: 'billing@other.example',
        address: '100 Other St',
        cc: [],
        replyTo: '',
        terms: 30,
        notes: '',
      },
    })

    // Issue invoice 1 for target client with attachments
    const inv1Id = crypto.randomUUID()
    const draft1 = newInvoice(w)
    draft1.id = inv1Id
    draft1.clientId = clientId
    draft1.client = w.clients.find(c => c.id === clientId)!
    draft1.issueDate = '2026-09-01'
    draft1.dueDate = '2026-09-15'
    draft1.lines = [{ id: crypto.randomUUID(), description: 'Cloud Architecture Consulting', quantity: '1', rate: '1500.00', unit: 'fixed' }]
    const clientAttId = crypto.randomUUID()
    const internalAttId = crypto.randomUUID()
    draft1.attachments = [
      {
        id: clientAttId,
        name: 'Signed Scope Document.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,AAAA',
        visibility: 'client',
        created: '2026-09-01T10:00:00.000Z',
      },
      {
        id: internalAttId,
        name: 'Margin Analysis.pdf',
        size: 2048,
        mimeType: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,BBBB',
        visibility: 'internal',
        created: '2026-09-01T10:00:00.000Z',
      },
    ]
    cmd(w, { type: 'draft', value: draft1 })
    cmd(w, { type: 'issue', id: inv1Id })

    // Issue invoice 2 for different client (must not leak)
    const inv2Id = crypto.randomUUID()
    const draft2 = newInvoice(w)
    draft2.id = inv2Id
    draft2.clientId = otherClientId
    draft2.client = w.clients.find(c => c.id === otherClientId)!
    draft2.issueDate = '2026-09-02'
    draft2.dueDate = '2026-09-16'
    draft2.lines = [{ id: crypto.randomUUID(), description: 'Other work', quantity: '1', rate: '2000.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft2 })
    cmd(w, { type: 'issue', id: inv2Id })

    // Configure portal for target client
    cmd(w, {
      type: 'sharePortal',
      clientId,
      expires: '2026-12-31',
      allowStatements: true,
      allowAttachments: true,
    })

    const token = w.clients.find(c => c.id === clientId)!.portal!.token
    const portalView = buildClientPortalView(w, token)

    // Verify authorized client info
    expect(portalView.client.name).toBe('Nexus Tech Ltd')
    expect(portalView.business.name).toBe('Acme Advisory Ltd')

    // Invoices list must only contain target client's issued invoice
    expect(portalView.invoices.length).toBe(1)
    expect(portalView.invoices[0].id).toBe(inv1Id)
    expect(portalView.invoices[0].number).toBe('ACM-2026-0001')
    expect(portalView.invoices[0].total).toBe('1500.00')

    // Attachments must ONLY contain client-visible attachments
    expect(portalView.attachments.length).toBe(1)
    expect(portalView.attachments[0].id).toBe(clientAttId)
    expect(portalView.attachments[0].name).toBe('Signed Scope Document.pdf')

    // Internal notes or private client notes must NOT be present on the portal view
    expect((portalView as unknown as { internalNotes?: string }).internalNotes).toBeUndefined()
    expect((portalView.client as unknown as { notes?: string }).notes).toBeUndefined()

    // Statement summary should be populated
    expect(portalView.allowStatements).toBe(true)
    expect(portalView.statementSummary).toBeDefined()
  })

  it('enforces invoice restrictions and revocation controls', () => {
    const w = createTestWorkspace()
    const clientId = crypto.randomUUID()

    cmd(w, {
      type: 'client',
      value: {
        id: clientId,
        name: 'Restricted Client',
        email: 'restricted@example.com',
        address: '123 Main St',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
      },
    })

    const inv1Id = crypto.randomUUID()
    const draft1 = newInvoice(w)
    draft1.id = inv1Id
    draft1.clientId = clientId
    draft1.client = w.clients.find(c => c.id === clientId)!
    draft1.lines = [{ id: crypto.randomUUID(), description: 'Item 1', quantity: '1', rate: '500.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft1 })
    cmd(w, { type: 'issue', id: inv1Id })

    const inv2Id = crypto.randomUUID()
    const draft2 = newInvoice(w)
    draft2.id = inv2Id
    draft2.clientId = clientId
    draft2.client = w.clients.find(c => c.id === clientId)!
    draft2.lines = [{ id: crypto.randomUUID(), description: 'Item 2', quantity: '1', rate: '750.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft2 })
    cmd(w, { type: 'issue', id: inv2Id })

    // Share portal restricting to inv1Id only
    cmd(w, {
      type: 'sharePortal',
      clientId,
      expires: '2026-12-31',
      allowedInvoiceIds: [inv1Id],
      allowStatements: false,
    })

    const token = w.clients.find(c => c.id === clientId)!.portal!.token
    let view = buildClientPortalView(w, token)
    expect(view.invoices.length).toBe(1)
    expect(view.invoices[0].id).toBe(inv1Id)
    expect(view.allowStatements).toBe(false)

    // Revoke portal access
    cmd(w, { type: 'revokePortal', clientId })
    expect(() => buildClientPortalView(w, token)).toThrow('Client portal link not found or revoked')
  })

  it('records client payment confirmation notice to attention queue without altering ledger balance', () => {
    const w = createTestWorkspace()
    const clientId = crypto.randomUUID()

    cmd(w, {
      type: 'client',
      value: {
        id: clientId,
        name: 'Delta Corp',
        email: 'finance@delta.example',
        address: '88 Innovation Way',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
      },
    })

    const invId = crypto.randomUUID()
    const draft = newInvoice(w)
    draft.id = invId
    draft.clientId = clientId
    draft.client = w.clients.find(c => c.id === clientId)!
    draft.lines = [{ id: crypto.randomUUID(), description: 'System Integration', quantity: '1', rate: '2500.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft })
    cmd(w, { type: 'issue', id: invId })

    cmd(w, {
      type: 'sharePortal',
      clientId,
      expires: '2026-12-31',
    })

    const token = w.clients.find(c => c.id === clientId)!.portal!.token

    // Client reports they have paid
    const noticeId = crypto.randomUUID()
    cmd(w, {
      type: 'recordClientPaymentNotice',
      clientId,
      token,
      notice: {
        id: noticeId,
        date: '2026-09-12',
        amount: '2500.00',
        reference: 'BACS-REF-9921',
        notes: 'Paid via direct bank transfer this afternoon.',
      },
    })

    // 1. Verify ledger remains untouched (balance is still 2500.00, no unverified payments added)
    const inv = w.invoices.find(i => i.id === invId)!
    const invTotals = totals(inv, w.creditNotes)
    expect(invTotals.balance).toBe('2500.00')
    expect(inv.payments.length).toBe(0)

    // 2. Verify notice appears in Attention Queue for owner review
    const queue = getAttentionQueueItems(w)
    const noticeItem = queue.find(item => item.kind === 'payment_notice')
    expect(noticeItem).toBeDefined()
    expect(noticeItem!.title).toContain('Delta Corp')
    expect(noticeItem!.detail).toContain('2,500.00')
    expect(noticeItem!.paymentNoticeId).toBe(noticeId)

    // 3. Owner dismisses the notice after review
    cmd(w, {
      type: 'dismissPaymentNotice',
      clientId,
      noticeId,
    })

    const updatedQueue = getAttentionQueueItems(w)
    expect(updatedQueue.some(item => item.kind === 'payment_notice')).toBe(false)
  })
})

describe('Wave D: D04 Multiple Business Profiles', () => {
  it('initializes default profile and allows creating distinct trading identities', () => {
    const w = createTestWorkspace()
    expect(w.profiles).toBeDefined()
    expect(w.profiles!.length).toBeGreaterThanOrEqual(1)
    expect(w.activeProfileId).toBeDefined()

    const newProfileId = crypto.randomUUID()
    cmd(w, {
      type: 'createBusinessProfile',
      value: {
        id: newProfileId,
        name: 'Studio North',
        business: {
          ...w.business,
          name: 'Studio North Visuals',
          prefix: 'STU',
          currency: 'USD',
          accent: '#3b82f6',
          template: 'minimal',
        },
        switchImmediately: false,
      },
    })

    expect(w.profiles!.length).toBe(2)
    const studioProfile = w.profiles!.find(p => p.id === newProfileId)
    expect(studioProfile).toBeDefined()
    expect(studioProfile!.name).toBe('Studio North')
    expect(studioProfile!.business.currency).toBe('USD')
    expect(studioProfile!.business.prefix).toBe('STU')
  })

  it('isolates numbering series sequences, clients and documents across profiles', () => {
    const w = createTestWorkspace()

    // 1. Issue an invoice in Profile 1 (Acme prefix ACM)
    const client1Id = crypto.randomUUID()
    cmd(w, {
      type: 'client',
      value: {
        id: client1Id,
        name: 'Client In Profile 1',
        email: 'p1@example.com',
        address: '1 Main St',
        cc: [],
        replyTo: '',
        terms: 14,
        notes: '',
      },
    })

    const inv1Id = crypto.randomUUID()
    const draft1 = newInvoice(w)
    draft1.id = inv1Id
    draft1.clientId = client1Id
    draft1.client = w.clients.find(c => c.id === client1Id)!
    draft1.lines = [{ id: crypto.randomUUID(), description: 'Consulting', quantity: '1', rate: '1000.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft1 })
    cmd(w, { type: 'issue', id: inv1Id })

    const issued1 = w.invoices.find(i => i.id === inv1Id)!
    expect(issued1.number).toBe('ACM-2026-0001')

    // 2. Create Profile 2 with switchImmediately = true
    const profile2Id = crypto.randomUUID()
    cmd(w, {
      type: 'createBusinessProfile',
      value: {
        id: profile2Id,
        name: 'Studio North',
        business: {
          ...w.business,
          name: 'Studio North Design',
          prefix: 'STU',
          currency: 'EUR',
          accent: '#ec4899',
          template: 'classic',
        },
        switchImmediately: true,
      },
    })

    expect(w.activeProfileId).toBe(profile2Id)
    expect(w.business.name).toBe('Studio North Design')
    expect(w.business.currency).toBe('EUR')
    expect(w.business.prefix).toBe('STU')

    // Invoices and clients in active workspace are now empty/scoped to Profile 2
    expect(w.invoices.length).toBe(0)
    expect(w.clients.length).toBe(0)

    // 3. Issue invoice in Profile 2 (Sequence starts at STU-2026-0001)
    const client2Id = crypto.randomUUID()
    cmd(w, {
      type: 'client',
      value: {
        id: client2Id,
        name: 'Client In Profile 2',
        email: 'p2@example.com',
        address: '2 Second St',
        cc: [],
        replyTo: '',
        terms: 30,
        notes: '',
      },
    })

    const inv2Id = crypto.randomUUID()
    const draft2 = newInvoice(w)
    draft2.id = inv2Id
    draft2.clientId = client2Id
    draft2.client = w.clients.find(c => c.id === client2Id)!
    draft2.lines = [{ id: crypto.randomUUID(), description: 'Design Retainer', quantity: '1', rate: '2500.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft2 })
    cmd(w, { type: 'issue', id: inv2Id })

    const issued2 = w.invoices.find(i => i.id === inv2Id)!
    expect(issued2.number).toBe('STU-2026-0001')

    // 4. Switch back to Profile 1 and issue a second invoice (ACM-2026-0002)
    const defaultProfileId = w.profiles!.find(p => p.id !== profile2Id)!.id
    cmd(w, { type: 'switchBusinessProfile', profileId: defaultProfileId })

    expect(w.activeProfileId).toBe(defaultProfileId)
    expect(w.business.prefix).toBe('ACM')
    expect(w.invoices.length).toBe(1)
    expect(w.clients.length).toBe(1)
    expect(w.clients[0].name).toBe('Client In Profile 1')

    const inv3Id = crypto.randomUUID()
    const draft3 = newInvoice(w)
    draft3.id = inv3Id
    draft3.clientId = client1Id
    draft3.client = w.clients.find(c => c.id === client1Id)!
    draft3.lines = [{ id: crypto.randomUUID(), description: 'Followup Strategy', quantity: '1', rate: '800.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft3 })
    cmd(w, { type: 'issue', id: inv3Id })

    const issued3 = w.invoices.find(i => i.id === inv3Id)!
    expect(issued3.number).toBe('ACM-2026-0002')
  })

  it('prevents deleting default or non-existent profile', () => {
    const w = createTestWorkspace()
    const defaultProfile = w.profiles!.find(p => p.isDefault)!

    // Cannot delete only profile
    expect(() => cmd(w, { type: 'deleteBusinessProfile', profileId: defaultProfile.id })).toThrow(
      'Cannot delete the only business profile'
    )

    // Add second profile
    const secondId = crypto.randomUUID()
    cmd(w, {
      type: 'createBusinessProfile',
      value: { id: secondId, name: 'Second Profile', switchImmediately: false },
    })

    // Cannot delete default profile even with multiple profiles
    expect(() => cmd(w, { type: 'deleteBusinessProfile', profileId: defaultProfile.id })).toThrow(
      'Cannot delete the default business profile'
    )

    // Deleting non-existent profile throws not found
    expect(() => cmd(w, { type: 'deleteBusinessProfile', profileId: crypto.randomUUID() })).toThrow(
      'Business profile not found'
    )
  })
})
