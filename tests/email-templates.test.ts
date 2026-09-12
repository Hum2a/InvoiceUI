import { describe, it, expect } from 'vitest'
import {
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
  renderMagicLinkEmailHtml,
  renderMagicLinkEmailText,
  renderQuoteEmailHtml,
  renderQuoteEmailText,
  type EmailTemplateOptions,
  type MagicLinkEmailOptions,
  type QuoteEmailTemplateOptions,
} from '../src/shared/emailTemplate'
import { emptyWorkspace, newInvoice, totals, type Invoice, type Business, type Quote } from '../src/shared/domain'

function createSampleQuote(): { quote: Quote; business: Business } {
  const { invoice, business } = createSampleInvoice()
  const quote: Quote = {
    id: crypto.randomUUID(),
    quoteNumber: 'Q-2026-0015',
    revision: 1,
    status: 'sent',
    clientId: invoice.client.id,
    client: invoice.client,
    issueDate: '2026-09-15',
    expiryDate: '2026-10-15',
    currency: 'GBP',
    lines: [
      {
        id: crypto.randomUUID(),
        description: 'Brand Architecture and Design System Strategy',
        quantity: '1',
        rate: '3200.00',
        unit: 'fixed',
        group: 'Deliverables',
      },
      {
        id: crypto.randomUUID(),
        description: 'Interactive Prototyping and Motion Systems',
        quantity: '20',
        rate: '110.00',
        unit: 'hour',
        group: 'Engineering',
      },
    ],
    tax: '20',
    discount: '10',
    discountType: 'percent',
    scope: 'Comprehensive rebranding and digital product architecture specification.',
    notes: 'Quote valid for 30 days. Work begins upon acceptance.',
    template: 'studio',
    accent: '#863bff',
    created: '2026-09-15T09:00:00Z',
    updated: '2026-09-15T09:00:00Z',
  }
  return { quote, business }
}

function createSampleInvoice(): { invoice: Invoice; business: Business } {
  const w = emptyWorkspace()
  const b: Business = {
    name: 'Apex Studio Ltd',
    email: 'billing@apexstudio.co.uk',
    address: '100 Innovation Way\nLondon\nEC1A 1BB\nUnited Kingdom',
    bank: 'Apex Studio Ltd\nBank: Monzo Business\nSort Code: 04-00-04\nAccount: 12345678\nIBAN: GB29MONZ04000412345678',
    footer: 'Thank you for choosing Apex Studio.',
    taxId: 'GB987654321',
    logo: '',
    currency: 'GBP',
    terms: 14,
    prefix: 'INV',
    accent: '#863bff',
    template: 'studio',
    timezone: 'Europe/London',
    autoReminders: false,
  }

  const i = newInvoice(w)
  i.number = 'INV-2026-0042'
  i.issueDate = '2026-09-15'
  i.dueDate = '2026-09-29'
  i.terms = 14
  i.currency = 'GBP'
  i.accent = '#863bff'
  i.template = 'studio'
  i.po = 'PO-88219'
  i.reference = 'Q3 Design Sprint'
  i.notes = 'All IP rights transfer upon complete settlement of balance due.'
  i.client = {
    id: crypto.randomUUID(),
    name: 'Mentage Global Media',
    email: 'accounts@mentage.com',
    contact: 'Sarah Jenkins',
    address: '42 Regent Street\nCambridge\nCB2 1AB\nUnited Kingdom',
    taxId: 'GB112233445',
    cc: ['finance@mentage.com'],
    replyTo: 'billing@apexstudio.co.uk',
    terms: 14,
    notes: '',
  }
  i.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Brand Identity Design System & Guidelines',
      quantity: '1',
      rate: '2400.00',
      unit: 'fixed',
      group: 'Phase 1',
    },
    {
      id: crypto.randomUUID(),
      description: 'Senior UX / UI Consultation',
      quantity: '16',
      rate: '95.00',
      unit: 'hour',
      group: 'Phase 2',
    },
  ]
  i.tax = '20'
  i.discount = '5'
  i.discountType = 'percent'
  i.breakdown = 'Phase 1 breakdown notes'
  i.attachments = [
    {
      id: crypto.randomUUID(),
      name: 'design-spec-v2.pdf',
      size: 245000,
      mimeType: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,sample',
      visibility: 'client',
      created: '2026-09-15T10:00:00Z',
    },
    {
      id: crypto.randomUUID(),
      name: 'internal-brief.pdf',
      size: 110000,
      mimeType: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,sample',
      visibility: 'internal',
      created: '2026-09-15T10:00:00Z',
    },
  ]

  return { invoice: i, business: b }
}

describe('Spectacular HTML Email Templates', () => {
  it('renders embedded HTML invoice element with full financial breakdown, parties, and bank details', () => {
    const { invoice, business } = createSampleInvoice()
    const options: EmailTemplateOptions = {
      invoice,
      business,
      message: {
        kind: 'invoice',
        subject: `Invoice ${invoice.number} from ${business.name}`,
        body: 'Hi Sarah,\n\nIt was a pleasure working with your team on this design sprint. Attached is your invoice for review.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice',
    }

    const html = renderInvoiceEmailHtml(options)

    // Structural elements
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Tax Invoice Details')
    expect(html).toContain('INV-2026-0042')

    // Parties verification
    expect(html).toContain('Apex Studio Ltd')
    expect(html).toContain('100 Innovation Way')
    expect(html).toContain('Tax ID: GB987654321')
    expect(html).toContain('Mentage Global Media')
    expect(html).toContain('Sarah Jenkins')
    expect(html).toContain('42 Regent Street')
    expect(html).toContain('Tax ID: GB112233445')

    // Line items
    expect(html).toContain('Brand Identity Design System &amp; Guidelines')
    expect(html).toContain('Senior UX / UI Consultation')
    expect(html).toContain('16 <span style="font-size:11px;color:#a1a1aa;">hr</span>')

    // Financial totals
    const t = totals(invoice)
    expect(html).toContain('Subtotal')
    expect(html).toContain('Discount (5%)')
    expect(html).toContain('Tax / VAT (20%)')
    expect(html).toContain('Total Amount')
    expect(html).toContain('Balance Due')

    // Bank instructions card
    expect(html).toContain('Payment Instructions')
    expect(html).toContain('Bank: Monzo Business')
    expect(html).toContain('Sort Code: 04-00-04')
    expect(html).toContain('Account: 12345678')

    // Personal message callout card
    expect(html).toContain('Message from Apex Studio Ltd')
    expect(html).toContain('pleasure working with your team')

    // One-click action buttons
    expect(html).toContain('View & Download PDF Invoice &rarr;')
    expect(html).toContain('https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice')

    // Cool feature: Google Calendar due date reminder link
    expect(html).toContain('Add Due Date to Calendar')
    expect(html).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(html).toContain('20260929/20260930')

    // Deliverables showcase
    expect(html).toContain('INV-2026-0042.pdf')
    expect(html).toContain('INV-2026-0042-breakdown.pdf')
    expect(html).toContain('design-spec-v2.pdf')
    expect(html).not.toContain('internal-brief.pdf') // Internal attachments must not appear in client email
  })

  it('renders payment reminder alert mode when message kind is reminder', () => {
    const { invoice, business } = createSampleInvoice()
    const options: EmailTemplateOptions = {
      invoice,
      business,
      message: {
        kind: 'reminder',
        subject: `Overdue Payment Reminder: Invoice ${invoice.number}`,
        body: 'This is a friendly reminder regarding your outstanding invoice.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice',
    }

    const html = renderInvoiceEmailHtml(options)
    expect(html).toContain('Payment Reminder')
    expect(html).toContain('🔔')
    expect(html).toContain('2026')
    expect(html).toContain('An outstanding balance of')
  })

  it('supports minimal and classic visual template styles', () => {
    const { invoice, business } = createSampleInvoice()

    // Minimal template
    invoice.template = 'minimal'
    const minimalHtml = renderInvoiceEmailHtml({ invoice, business })
    expect(minimalHtml).toContain("'Helvetica Neue', Helvetica, Arial, sans-serif")

    // Classic template
    invoice.template = 'classic'
    const classicHtml = renderInvoiceEmailHtml({ invoice, business })
    expect(classicHtml).toContain("Georgia, Cambria, 'Times New Roman', Times, serif")
  })

  it('escapes user strings to prevent HTML injection in emails', () => {
    const { invoice, business } = createSampleInvoice()
    invoice.client.name = 'ACME Corp <script>alert(1)</script>'
    invoice.lines[0].description = 'Security Audit & <Penetration> "Test"'

    const html = renderInvoiceEmailHtml({ invoice, business })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Security Audit &amp; &lt;Penetration&gt; &quot;Test&quot;')
  })

  it('renders structured plain-text fallback counterpart', () => {
    const { invoice, business } = createSampleInvoice()
    const options: EmailTemplateOptions = {
      invoice,
      business,
      message: {
        kind: 'invoice',
        subject: `Invoice ${invoice.number}`,
        body: 'Please find attached your invoice.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice',
    }

    const text = renderInvoiceEmailText(options)
    expect(text).toContain('INVOICE: INV-2026-0042')
    expect(text).toContain('FROM:\nApex Studio Ltd')
    expect(text).toContain('BILLED TO:\nMentage Global Media')
    expect(text).toContain('ITEMS:')
    expect(text).toContain('Brand Identity Design System & Guidelines')
    expect(text).toContain('Subtotal:')
    expect(text).toContain('BALANCE DUE:')
    expect(text).toContain('PAYMENT INSTRUCTIONS:')
    expect(text).toContain('Monzo Business')
    expect(text).toContain('https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice')
  })

  it('renders spectacular magic link authentication email with secure CTA and fallback URL', () => {
    const options: MagicLinkEmailOptions = {
      email: 'owner@example.com',
      url: 'https://invoiceui.humza.website/api/auth/verify?token=secureToken12345',
      expiresInMinutes: 10,
    }

    const html = renderMagicLinkEmailHtml(options)
    const text = renderMagicLinkEmailText(options)

    // Structural elements
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Sign in to InvoiceUI')
    expect(html).toContain('▤')
    expect(html).toContain('InvoiceUI Private Access')

    // Copy and email address escaping
    expect(html).toContain('Sign in to your private workspace')
    expect(html).toContain('owner@example.com')
    expect(html).toContain('A little less admin. A lot more headspace.')

    // Primary CTA button
    expect(html).toContain('Sign in to InvoiceUI &rarr;')
    expect(html).toContain('https://invoiceui.humza.website/api/auth/verify?token=secureToken12345')

    // Security callout and expiry
    expect(html).toContain('Security &amp; Expiry Information')
    expect(html).toContain('10 minutes')

    // Fallback monospace URL
    expect(html).toContain('Button not working? Copy and paste this URL into your browser:')

    // Plain text version
    expect(text).toContain('Sign in to InvoiceUI')
    expect(text).toContain('Hello owner@example.com,')
    expect(text).toContain('https://invoiceui.humza.website/api/auth/verify?token=secureToken12345')
    expect(text).toContain('expires in 10 minutes')
  })

  it('renders quote email with scope, line items, totals breakdown, and calendar link', () => {
    const { quote, business } = createSampleQuote()
    const options: QuoteEmailTemplateOptions = {
      quote,
      business,
      message: {
        subject: `Proposal Q-2026-0015 from ${business.name}`,
        body: 'Here is the detailed quotation for your upcoming project.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/quoteToken/quote',
    }

    const html = renderQuoteEmailHtml(options)
    const text = renderQuoteEmailText(options)

    // Structural and header checks
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Formal Quotation')
    expect(html).toContain('Valid Until:')

    // Parties
    expect(html).toContain('Apex Studio Ltd')
    expect(html).toContain('Mentage Global Media')

    // Scope and line items
    expect(html).toContain('Comprehensive rebranding and digital product architecture specification.')
    expect(html).toContain('Brand Architecture and Design System Strategy')
    expect(html).toContain('Interactive Prototyping and Motion Systems')

    // Totals
    expect(html).toContain('Total Quote')

    // Calendar link
    expect(html).toContain('Add Expiry Date to Calendar')
    expect(html).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')

    // Plain text version
    expect(text).toContain('QUOTATION: Q-2026-0015')
    expect(text).toContain('PREPARED BY:\nApex Studio Ltd')
    expect(text).toContain('PREPARED FOR:\nMentage Global Media')
    expect(text).toContain('TOTAL QUOTE AMOUNT: £5,832.00')
  })

  it('strictly contains zero em dashes or en dashes across rendered templates', () => {
    const { invoice, business } = createSampleInvoice()
    const invoiceOptions: EmailTemplateOptions = {
      invoice,
      business,
      message: {
        kind: 'reminder',
        subject: `Reminder - Invoice ${invoice.number}`,
        body: 'Friendly reminder - please settle at your earliest convenience.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/tokenABC/invoice',
    }

    const invoiceHtml = renderInvoiceEmailHtml(invoiceOptions)
    const invoiceText = renderInvoiceEmailText(invoiceOptions)

    const magicOptions: MagicLinkEmailOptions = {
      email: 'owner@example.com',
      url: 'https://invoiceui.humza.website/api/auth/verify?token=123',
      expiresInMinutes: 10,
    }
    const magicHtml = renderMagicLinkEmailHtml(magicOptions)
    const magicText = renderMagicLinkEmailText(magicOptions)

    const { quote } = createSampleQuote()
    const quoteOptions: QuoteEmailTemplateOptions = {
      quote,
      business,
      message: {
        subject: `Quote ${quote.quoteNumber}`,
        body: 'Please review our quote.',
      },
      publicUrl: 'https://invoiceui.humza.website/api/public/owner123/quote123/quote',
    }
    const quoteHtml = renderQuoteEmailHtml(quoteOptions)
    const quoteText = renderQuoteEmailText(quoteOptions)

    // Verify zero em dash (U+2014) and en dash (U+2013)
    expect(invoiceHtml).not.toMatch(/[\u2013\u2014]/)
    expect(invoiceText).not.toMatch(/[\u2013\u2014]/)
    expect(magicHtml).not.toMatch(/[\u2013\u2014]/)
    expect(magicText).not.toMatch(/[\u2013\u2014]/)
    expect(quoteHtml).not.toMatch(/[\u2013\u2014]/)
    expect(quoteText).not.toMatch(/[\u2013\u2014]/)
  })
})
