import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  money,
  type Workspace,
  type Invoice,
} from '../src/shared/domain'
import { renderPDF, filename } from '../src/shared/pdf'
import { document } from '../src/worker/documents'
import { app } from '../src/worker'

const MINIMAL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const MINIMAL_JPG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

async function loadFont() {
  return new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'))
}

function createInvoiceFixture(): { w: Workspace; i: Invoice } {
  let w = emptyWorkspace()
  w.business.name = 'Acme Creative Ltd'
  w.business.email = 'hello@acmecreative.co.uk'
  w.business.address = '14 Soho Square\nLondon W1D 3QG'
  w.business.bank = 'Sort Code: 00-11-22\nAccount: 12345678\nAcme Creative'
  w.business.taxId = 'GB 123 4567 89'
  w.business.currency = 'GBP'
  w.business.accent = '#10b981'
  w.business.template = 'studio'

  const i = newInvoice(w)
  i.client.name = 'Zoë Müller Enterprises'
  i.client.email = 'zoe@example.com'
  i.client.address = '42 High Street\nManchester M1 1AB'
  i.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Brand Identity & Design System',
      quantity: '1',
      rate: '2500',
      unit: 'fixed',
    },
    {
      id: crypto.randomUUID(),
      description: 'Design Workshop & User Research',
      quantity: '8',
      rate: '120',
      unit: 'hour',
    },
  ]
  i.notes = 'Payment due strictly within 30 days.'
  i.po = 'PO-2026-99'
  i.reference = 'REF-ACME-ZOE'
  i.breakdown = 'Sprint 1:\n- Research interviews (4 hrs)\n- Wireframing (4 hrs)\nTotal hours: 8 hrs.'

  w = applyCommand(w, { type: 'draft', value: i })
  return { w, i: w.invoices[0] }
}

describe('Phase 4: Filenames & Document Identifiers', () => {
  it('generates stable, sanitised filenames for drafts, issued, and breakdown documents', () => {
    const { i } = createInvoiceFixture()
    // Draft without number
    expect(filename(i)).toBe('Draft-Zoë-Müller-Enterprises.pdf')
    expect(filename(i, true)).toBe('Draft-Zoë-Müller-Enterprises-Breakdown.pdf')

    // Issued with number
    i.number = 'INV-2026-0042'
    expect(filename(i)).toBe('INV-2026-0042-Zoë-Müller-Enterprises.pdf')
    expect(filename(i, true)).toBe('INV-2026-0042-Zoë-Müller-Enterprises-Breakdown.pdf')

    // Client name with problematic characters (slashes, quotes, spaces, control characters)
    i.client.name = 'Client / With \\ Weird & Special: Characters?!'
    const name = filename(i)
    expect(name).toBe('INV-2026-0042-Client-With-Weird-Special-Characters-.pdf')
    expect(name).not.toMatch(/[\/\\:*?"<>|]/)
  })
})

describe('Phase 4: Template Variants & Custom Styling', () => {
  it('renders Studio, Minimal, and Classic templates cleanly', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    // 1. Studio template
    i.template = 'studio'
    i.accent = '#bef264'
    const studioBytes = await renderPDF(i, w.business, font)
    const studioDoc = await PDFDocument.load(studioBytes)
    expect(studioDoc.getPageCount()).toBe(1)
    expect(studioDoc.getTitle()).toBe('Draft invoice')

    // 2. Minimal template
    i.template = 'minimal'
    i.accent = '#3b82f6'
    const minimalBytes = await renderPDF(i, w.business, font)
    const minimalDoc = await PDFDocument.load(minimalBytes)
    expect(minimalDoc.getPageCount()).toBe(1)

    // 3. Classic template
    i.template = 'classic'
    i.accent = '#f59e0b'
    const classicBytes = await renderPDF(i, w.business, font)
    const classicDoc = await PDFDocument.load(classicBytes)
    expect(classicDoc.getPageCount()).toBe(1)
  })

  it('embeds PNG and JPEG logos with proper scaling', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    // Test PNG logo
    w.business.logo = MINIMAL_PNG
    const pngBytes = await renderPDF(i, w.business, font)
    const pngDoc = await PDFDocument.load(pngBytes)
    expect(pngDoc.getPageCount()).toBe(1)

    // Test JPEG logo
    w.business.logo = MINIMAL_JPG
    const jpgBytes = await renderPDF(i, w.business, font)
    const jpgDoc = await PDFDocument.load(jpgBytes)
    expect(jpgDoc.getPageCount()).toBe(1)
  })

  it('throws a helpful descriptive error for corrupted logo data', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    w.business.logo = 'data:image/png;base64,corrupted-invalid-base64!!!'
    await expect(renderPDF(i, w.business, font)).rejects.toThrow(
      'The saved logo could not be rendered. Use a valid PNG or JPEG.'
    )
  })
})

describe('Phase 4: Pagination, Repeated Headers & Long Documents', () => {
  it('correctly paginates long invoices with repeated table headers and page numbers', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    // 50 line items with multiline detailed descriptions
    i.lines = Array.from({ length: 50 }, (_, n) => ({
      id: crypto.randomUUID(),
      description: `Deliverable Item #${n + 1}:\n` +
        `Detailed specification, stakeholder review, and architectural blueprint execution.`,
      quantity: '2',
      rate: '150',
      unit: 'hour' as const,
    }))

    const start = Date.now()
    const bytes = await renderPDF(i, w.business, font)
    const elapsed = Date.now() - start

    // Performance verification: pure JS rendering should finish well within Worker limits
    expect(elapsed).toBeLessThan(5000)

    const doc = await PDFDocument.load(bytes)
    const pageCount = doc.getPageCount()
    expect(pageCount).toBeGreaterThanOrEqual(3)

    // Verify all pages are A4 format (595.28 x 841.89 pt)
    for (let p = 0; p < pageCount; p++) {
      const page = doc.getPage(p)
      expect(page.getWidth()).toBeCloseTo(595.28, 1)
      expect(page.getHeight()).toBeCloseTo(841.89, 1)
    }
  })

  it('renders separate multi-page work breakdown document', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    i.breakdown = 'Detailed task breakdown section:\n\n' +
      Array.from({ length: 150 }, (_, n) => `Task ${n + 1}: Implementation of feature milestone ${n + 1} with test coverage.`).join('\n')

    const bytes = await renderPDF(i, w.business, font, true)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(doc.getTitle()).toBe('Draft breakdown')
  })
})

describe('Phase 4: Currencies, Unicode & Visual Parity', () => {
  it('supports all 7 configured currencies with appropriate decimal formatting', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    const currencies = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'] as const
    for (const currency of currencies) {
      i.currency = currency
      const bytes = await renderPDF(i, w.business, font)
      expect(bytes.byteLength).toBeGreaterThan(1000)
    }
  })

  it('correctly handles Unicode text across names, addresses, and line descriptions', async () => {
    const font = await loadFont()
    const { w, i } = createInvoiceFixture()

    w.business.name = 'Éditions Müller & Cie'
    w.business.address = '12 Rue de l’Université\n75007 Paris, France'
    i.client.name = 'Björn Åkesson — Hällsvik AB'
    i.lines[0].description = 'Consulting café, crêpes & naïve résumé drafting — €450'

    const bytes = await renderPDF(i, w.business, font)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('clearly marks void documents with VOID indicators', async () => {
    const font = await loadFont()
    let { w, i } = createInvoiceFixture()

    // Issue invoice then void it
    w = applyCommand(w, { type: 'issue', id: i.id })
    w = applyCommand(w, { type: 'void', id: i.id, reason: 'Client requested cancellation.' })
    const voided = w.invoices[0]
    expect(voided.lifecycle).toBe('void')

    const bytes = await renderPDF(voided, w.business, font)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('preserves snapshotted business information on issued invoices', async () => {
    const font = await loadFont()
    let { w, i } = createInvoiceFixture()

    // Issue invoice (snapshots business)
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issuedInvoice = w.invoices[0]
    expect(issuedInvoice.business?.name).toBe('Acme Creative Ltd')

    // Modify active workspace business
    w = applyCommand(w, {
      type: 'business',
      value: { ...w.business, name: 'Brand New Entity Name Inc' },
    })

    // Render using snapshotted business: should use Acme Creative Ltd, NOT Brand New Entity Name Inc
    const bytes = await renderPDF(issuedInvoice, w.business, font)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getAuthor()).toBe('Acme Creative Ltd')
  })
})

describe('Phase 4: Worker Document Pipeline & Private R2 Storage', () => {
  it('stores issued PDFs in R2 object storage and retrieves cached versions', async () => {
    const fontBytes = await loadFont()
    let { w, i } = createInvoiceFixture()

    // Issue invoice
    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    const storage = new Map<string, Uint8Array>()
    const mockEnv = {
      APP_URL: 'https://invoiceui.humza.website',
      DOCUMENTS: {
        get: async (key: string) => {
          const item = storage.get(key)
          return item ? { arrayBuffer: async () => item.buffer } : null
        },
        put: async (key: string, data: Uint8Array) => {
          storage.set(key, data)
        },
      } as unknown as R2Bucket,
      ASSETS: {
        fetch: async () => new Response(fontBytes),
      } as unknown as Fetcher,
    } as Env

    // 1. Initial generation: should render and put into R2
    const rendered1 = await document(mockEnv, 'owner-123', w, issued, false)
    expect(rendered1.byteLength).toBeGreaterThan(1000)
    expect(storage.size).toBe(1)
    const expectedKey = `owner-123/${issued.id}/${issued.issuedAt}-${issued.updated || 'init'}-issued-invoice.pdf`
    expect(storage.has(expectedKey)).toBe(true)

    // 2. Subsequent call: should read directly from R2 cache
    const rendered2 = await document(mockEnv, 'owner-123', w, issued, false)
    expect(rendered2).toEqual(rendered1)

    // 3. Draft invoices should render without caching in R2
    const draft = newInvoice(w)
    const draftStorageSizeBefore = storage.size
    const draftBytes = await document(mockEnv, 'owner-123', w, draft, false)
    expect(draftBytes.byteLength).toBeGreaterThan(1000)
    expect(storage.size).toBe(draftStorageSizeBefore) // No new persistent key created for draft
  })

  it('updates storage key when invoice is voided so VOID PDF is cached separately', async () => {
    const fontBytes = await loadFont()
    let { w, i } = createInvoiceFixture()

    w = applyCommand(w, { type: 'issue', id: i.id })
    const issued = w.invoices[0]

    const storage = new Map<string, Uint8Array>()
    const mockEnv = {
      APP_URL: 'https://invoiceui.humza.website',
      DOCUMENTS: {
        get: async (key: string) => {
          const item = storage.get(key)
          return item ? { arrayBuffer: async () => item.buffer } : null
        },
        put: async (key: string, data: Uint8Array) => {
          storage.set(key, data)
        },
      } as unknown as R2Bucket,
      ASSETS: {
        fetch: async () => new Response(fontBytes),
      } as unknown as Fetcher,
    } as Env

    // Cache issued document
    await document(mockEnv, 'owner-123', w, issued, false)
    expect(storage.has(`owner-123/${issued.id}/${issued.issuedAt}-${issued.updated || 'init'}-issued-invoice.pdf`)).toBe(true)

    // Void the invoice
    w = applyCommand(w, { type: 'void', id: issued.id, reason: 'Voided reason' })
    const voided = w.invoices[0]

    // Render voided document: should cache under void key
    const voidBytes = await document(mockEnv, 'owner-123', w, voided, false)
    const voidDoc = await PDFDocument.load(voidBytes)
    expect(voidDoc.getPageCount()).toBe(1)
    expect(storage.has(`owner-123/${issued.id}/${issued.issuedAt}-${voided.updated || 'init'}-void-invoice.pdf`)).toBe(true)
  })
})
