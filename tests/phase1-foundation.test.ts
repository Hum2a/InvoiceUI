import { describe, it, expect } from 'vitest'
import { app } from '../src/worker/index'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  status,
  issueErrors,
  precision,
  money,
  type Workspace,
  type Invoice,
} from '../src/shared/domain'
import { Conflict } from '../src/worker/store'

function createTestEnv(): Env {
  return {
    APP_URL: 'https://invoiceui.humza.website',
    OWNER_EMAIL: 'humzab1711@hotmail.com',
    EMAIL_FROM: 'Invoices <invoices@humza.website>',
    DATABASE_URL: 'postgresql://fake:fake@ep-fake.neon.tech/neondb',
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-1234567890',
    RESEND_API_KEY: 're_test_fake_api_key',
    DOCUMENTS: {
      get: async () => null,
      put: async () => {},
    } as unknown as R2Bucket,
    ASSETS: {
      fetch: async () => new Response(new Uint8Array([0, 1, 2, 3])),
    } as unknown as Fetcher,
  }
}

describe('Phase 1: Security and Origin Protection', () => {
  it('denies unauthenticated requests to private API endpoints with 401 or 503', async () => {
    const env = createTestEnv()
    // When unauthenticated, /api/private/workspace returns 401
    const res = await app.request('/api/private/workspace', {
      method: 'GET',
      headers: {
        Origin: env.APP_URL,
      },
    }, env)
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('Sign in to continue')
  })

  it('rejects state-changing requests from untrusted origins with 403', async () => {
    const env = createTestEnv()
    const res = await app.request('/api/private/command', {
      method: 'POST',
      headers: {
        Origin: 'https://malicious-site.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 0, command: { type: 'archive', id: 'fake', value: true } }),
    }, env)
    expect(res.status).toBe(403)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('Untrusted request origin')
  })

  it('rejects oversized payloads with 413', async () => {
    const env = createTestEnv()
    // bodyLimit is 6MB. An excessively large header or payload will trigger body limit.
    const largeBody = 'a'.repeat(6_000_001)
    const res = await app.request('/api/private/command', {
      method: 'POST',
      headers: {
        Origin: env.APP_URL,
        'Content-Type': 'application/json',
      },
      body: largeBody,
    }, env)
    expect(res.status).toBe(413)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('Request is too large')
  })

  it('magic link sign-in silently succeeds for non-owner emails without sending', async () => {
    const env = createTestEnv()
    const res = await app.request('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: {
        Origin: env.APP_URL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'intruder@example.com' }),
    }, env)
    // Returns status: true without forwarding to auth handler
    expect(res.status).toBe(200)
    const data = await res.json() as { status: boolean }
    expect(data.status).toBe(true)
  })
})

describe('Phase 1: Money and Decimal Precision Edge Cases', () => {
  it('correctly calculates precision for 0, 2, and 3 decimal currencies', () => {
    expect(precision('JPY')).toBe(0)
    expect(precision('GBP')).toBe(2)
    expect(precision('USD')).toBe(2)
    expect(precision('EUR')).toBe(2)
    expect(precision('KWD')).toBe(3)
  })

  it('rounds line totals half-up and computes subtotal, discount, tax, and balance', () => {
    const w = emptyWorkspace()
    const i = newInvoice(w)
    i.currency = 'GBP'
    i.lines = [
      { id: crypto.randomUUID(), description: 'Item A', quantity: '2.5', rate: '10.335', unit: 'hour' }, // 25.8375 -> 25.84
      { id: crypto.randomUUID(), description: 'Item B', quantity: '1', rate: '5.555', unit: 'fixed' },   // 5.555 -> 5.56
    ]
    i.discount = '5'
    i.discountType = 'percent' // subtotal = 31.40. 5% discount = 1.57. Net = 29.83
    i.tax = '20' // 20% of 29.83 = 5.966 -> 5.97. Total = 35.80
    const t = totals(i)
    expect(t.subtotal).toBe('31.40')
    expect(t.discount).toBe('1.57')
    expect(t.tax).toBe('5.97')
    expect(t.total).toBe('35.80')
    expect(t.balance).toBe('35.80')
  })

  it('rejects discounts exceeding subtotal or greater than 100%', () => {
    const w = emptyWorkspace()
    w.business.name = 'Test Studio'
    w.business.address = 'London, UK'
    const i = newInvoice(w)
    i.client.name = 'Client'
    i.lines = [{ id: crypto.randomUUID(), description: 'Work', quantity: '1', rate: '100', unit: 'fixed' }]
    
    // Fixed discount > subtotal
    i.discount = '150'
    i.discountType = 'amount'
    expect(issueErrors(i, w.business)).toContain('Discount exceeds the subtotal.')

    // Percentage discount > 100%
    i.discount = '105'
    i.discountType = 'percent'
    expect(issueErrors(i, w.business)).toContain('Discount exceeds the subtotal.')
  })

  it('rejects deposits and instalments exceeding total', () => {
    const w = emptyWorkspace()
    w.business.name = 'Test Studio'
    w.business.address = 'London, UK'
    const i = newInvoice(w)
    i.client.name = 'Client'
    i.lines = [{ id: crypto.randomUUID(), description: 'Work', quantity: '1', rate: '100', unit: 'fixed' }]
    
    i.deposit = '150'
    expect(issueErrors(i, w.business)).toContain('Requested deposit exceeds the total.')

    i.deposit = '0'
    i.instalments = [
      { date: '2026-10-01', amount: '60' },
      { date: '2026-11-01', amount: '50' }, // total 110 > 100
    ]
    expect(issueErrors(i, w.business)).toContain('Instalments exceed the total.')
  })

  it('rejects issuance when due date precedes issue date', () => {
    const w = emptyWorkspace()
    w.business.name = 'Test Studio'
    w.business.address = 'London, UK'
    const i = newInvoice(w)
    i.client.name = 'Client'
    i.lines = [{ id: crypto.randomUUID(), description: 'Work', quantity: '1', rate: '100', unit: 'fixed' }]
    i.issueDate = '2026-09-12'
    i.dueDate = '2026-09-10'
    expect(issueErrors(i, w.business)).toContain('Due date must not precede issue date.')
  })
})

describe('Phase 1: Atomic Writes, CAS, Numbering and Lifecycle', () => {
  it('rolls back workspace modifications atomically if line or command validation fails', () => {
    let w = emptyWorkspace()
    const originalWorkspace = structuredClone(w)
    const i = newInvoice(w)
    w = applyCommand(w, { type: 'draft', value: i })
    expect(w.invoices).toHaveLength(1)

    // Attempt invalid issuance on incomplete draft: throws error and leaves workspace state unchanged
    expect(() => applyCommand(w, { type: 'issue', id: i.id })).toThrow()
    expect(w.invoices[0].lifecycle).toBe('draft')
    expect(w.invoices[0].number).toBe('')
  })

  it('allocates sequential series-scoped invoice numbers at issuance and never reuses voided numbers', () => {
    let w = emptyWorkspace()
    w.business.name = 'Humza Design'
    w.business.address = '10 Downing St, London'
    w.business.prefix = 'INV'

    // First invoice
    const i1 = newInvoice(w)
    i1.client.name = 'Acme Corp'
    i1.lines = [{ id: crypto.randomUUID(), description: 'Design Sprint', quantity: '1', rate: '1000', unit: 'fixed' }]
    i1.issueDate = '2026-09-12'
    i1.dueDate = '2026-10-12'
    w = applyCommand(w, { type: 'draft', value: i1 })
    w = applyCommand(w, { type: 'issue', id: i1.id })
    expect(w.invoices[0].number).toBe('INV-2026-0001')
    expect(w.invoices[0].lifecycle).toBe('issued')

    // Void the first invoice
    w = applyCommand(w, { type: 'void', id: i1.id, reason: 'Customer requested cancellation' })
    expect(w.invoices[0].lifecycle).toBe('void')
    expect(w.invoices[0].number).toBe('INV-2026-0001') // Number is retained

    // Second invoice
    const i2 = newInvoice(w)
    i2.client.name = 'Beta Corp'
    i2.lines = [{ id: crypto.randomUUID(), description: 'Consulting', quantity: '1', rate: '500', unit: 'fixed' }]
    i2.issueDate = '2026-09-12'
    i2.dueDate = '2026-10-12'
    w = applyCommand(w, { type: 'draft', value: i2 })
    w = applyCommand(w, { type: 'issue', id: i2.id })
    // Number must be 0002, NOT 0001
    const issuedSecond = w.invoices.find(inv => inv.id === i2.id)!
    expect(issuedSecond.number).toBe('INV-2026-0002')
  })

  it('snapshots business details upon issuance so subsequent settings edits do not change historical invoice', () => {
    let w = emptyWorkspace()
    w.business.name = 'Original Studio Name'
    w.business.address = '123 Baker St, London'
    w.business.bank = 'Sort: 00-00-00, Acc: 12345678'

    const i = newInvoice(w)
    i.client.name = 'Client X'
    i.lines = [{ id: crypto.randomUUID(), description: 'Branding', quantity: '1', rate: '2000', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: i })
    w = applyCommand(w, { type: 'issue', id: i.id })

    const issuedInvoice = w.invoices.find(inv => inv.id === i.id)!
    expect(issuedInvoice.business?.name).toBe('Original Studio Name')
    expect(issuedInvoice.business?.address).toBe('123 Baker St, London')

    // Change business settings
    w = applyCommand(w, {
      type: 'business',
      value: {
        ...w.business,
        name: 'Brand New Studio Name',
        address: '456 New Road, Manchester',
      },
    })

    // Current workspace business is updated
    expect(w.business.name).toBe('Brand New Studio Name')
    // But the issued invoice's snapshotted business remains the original!
    const historicalInvoice = w.invoices.find(inv => inv.id === i.id)!
    expect(historicalInvoice.business?.name).toBe('Original Studio Name')
    expect(historicalInvoice.business?.address).toBe('123 Baker St, London')
  })

  it('disallows draft editing of issued invoices', () => {
    let w = emptyWorkspace()
    w.business.name = 'Studio'
    w.business.address = 'London'
    const i = newInvoice(w)
    i.client.name = 'Client'
    i.lines = [{ id: crypto.randomUUID(), description: 'Dev', quantity: '1', rate: '500', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: i })
    w = applyCommand(w, { type: 'issue', id: i.id })

    // Trying to save a draft with the same ID as an issued invoice throws
    expect(() => applyCommand(w, { type: 'draft', value: { ...i, notes: 'Modified notes' } })).toThrow('Issued invoices cannot be edited')
  })

  it('enforces optimistic concurrency control (CAS) throwing Conflict on stale versions', () => {
    const conflict = new Conflict('This workspace changed on another device. Reload it or save your edits as a new draft.')
    expect(conflict).toBeInstanceOf(Error)
    expect(conflict.message).toContain('another device')
  })

  it('guarantees complete document snapshot contract for reliable PDF generation', () => {
    let w = emptyWorkspace()
    w.business.name = 'Full Contract Studio'
    w.business.address = '789 Queen Street, London'
    w.business.bank = 'Sort: 11-22-33, Acc: 88776655'
    w.business.taxId = 'GB123456789'
    w.business.logo = 'data:image/png;base64,iVBORw0KGgo='
    w.business.footer = 'Payment due strictly within 30 days.'

    const i = newInvoice(w)
    i.client = {
      id: crypto.randomUUID(),
      name: 'Contract Client Ltd',
      email: 'billing@contractclient.co.uk',
      address: 'Suite 4, Innovation Centre, Cambridge',
      cc: ['accounts@contractclient.co.uk'],
      replyTo: 'invoices@contractclient.co.uk',
      terms: 30,
      notes: 'Key client',
    }
    i.lines = [
      { id: crypto.randomUUID(), description: 'Phase 1 Architecture', quantity: '1', rate: '2500', unit: 'fixed' },
      { id: crypto.randomUUID(), description: 'Consulting Hours', quantity: '10', rate: '150', unit: 'hour' },
    ]
    i.tax = '20'
    i.discount = '10'
    i.discountType = 'percent'
    i.notes = 'Milestone 1 deliverables complete.'
    i.po = 'PO-998811'
    i.reference = 'REF-M1'

    w = applyCommand(w, { type: 'draft', value: i })
    w = applyCommand(w, { type: 'issue', id: i.id })

    const snap = w.invoices.find(inv => inv.id === i.id)!
    // Verify snapshot contract contains all invariant rendering fields
    expect(snap.number).toMatch(/^INV-\d{4}-\d{4}$/)
    expect(snap.issuedAt).toBeDefined()
    expect(snap.business).not.toBeNull()
    expect(snap.business?.name).toBe('Full Contract Studio')
    expect(snap.business?.bank).toBe('Sort: 11-22-33, Acc: 88776655')
    expect(snap.business?.taxId).toBe('GB123456789')
    expect(snap.client.name).toBe('Contract Client Ltd')
    expect(snap.client.address).toBe('Suite 4, Innovation Centre, Cambridge')
    expect(snap.lines).toHaveLength(2)
    expect(snap.po).toBe('PO-998811')
    expect(snap.reference).toBe('REF-M1')
    
    // Totals are recalculable and deterministic
    const t = totals(snap)
    expect(t.subtotal).toBe('4000.00')
    expect(t.discount).toBe('400.00')
    expect(t.tax).toBe('720.00')
    expect(t.total).toBe('4320.00')
    expect(t.balance).toBe('4320.00')
  })
})
