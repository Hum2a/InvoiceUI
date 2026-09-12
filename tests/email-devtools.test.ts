import { describe, it, expect } from 'vitest'
import {
  renderDiagnosticsTestEmailHtml,
  renderDiagnosticsTestEmailText,
  getDeliverabilityHeaders,
  type DiagnosticsTestEmailOptions,
} from '../src/shared/emailTemplate'

describe('Email Developer Tools & Diagnostics', () => {
  const sampleOptions: DiagnosticsTestEmailOptions = {
    recipient: 'test-recipient@example.com',
    scenario: 'smoke',
    appUrl: 'https://invoiceui.humza.website',
    senderFrom: '"Acme Studio Ltd Test" <invoices@humza.website>',
    timestamp: '2026-09-12T22:00:00.000Z',
    note: 'Verifying DNS SPF and DKIM authentication after domain update.',
    businessName: 'Acme Studio Ltd',
    environment: 'Cloudflare Worker + Resend',
  }

  describe('renderDiagnosticsTestEmailHtml', () => {
    it('renders a valid HTML document with deliverability verification', () => {
      const html = renderDiagnosticsTestEmailHtml(sampleOptions)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Email Delivery Smoke Test')
      expect(html).toContain('✓ Deliverability Verified')
      expect(html).toContain('test-recipient@example.com')
      expect(html).toContain('&quot;Acme Studio Ltd Test&quot; &lt;invoices@humza.website&gt;')
      expect(html).toContain('https://invoiceui.humza.website')
      expect(html).toContain('Verifying DNS SPF and DKIM authentication after domain update.')
      expect(html).toContain('Acme Studio Ltd')
    })

    it('embeds anti-spam hidden preheader with padding', () => {
      const html = renderDiagnosticsTestEmailHtml(sampleOptions)

      expect(html).toContain('<!-- Hidden Anti-Spam Inbox Preview Snippet -->')
      expect(html).toContain('InvoiceUI test email (smoke) sent to test-recipient@example.com.')
      expect(html).toContain('&#847;&zwnj;&nbsp;')
    })

    it('contains deliverability standards audit notes', () => {
      const html = renderDiagnosticsTestEmailHtml(sampleOptions)

      expect(html).toContain('Auto-Submitted Header:')
      expect(html).toContain('Vacation Loop Suppression:')
      expect(html).toContain('Hidden Preheader:')
      expect(html).toContain('Multipart Parity:')
    })

    it('does not contain typographic em dashes or en dashes', () => {
      const html = renderDiagnosticsTestEmailHtml(sampleOptions)
      expect(html).not.toMatch(/[\u2013\u2014]/)
    })
  })

  describe('renderDiagnosticsTestEmailText', () => {
    it('renders plain text diagnostics counterpart with all parameters', () => {
      const text = renderDiagnosticsTestEmailText(sampleOptions)

      expect(text).toContain('INVOICEUI EMAIL DELIVERABILITY SMOKE TEST')
      expect(text).toContain('Scenario: SMOKE')
      expect(text).toContain('Recipient: test-recipient@example.com')
      expect(text).toContain('Sender: "Acme Studio Ltd Test" <invoices@humza.website>')
      expect(text).toContain('DEVELOPER CUSTOM NOTE:')
      expect(text).toContain('Verifying DNS SPF and DKIM authentication after domain update.')
      expect(text).toContain('Auto-Submitted: auto-generated')
    })

    it('does not contain typographic em dashes or en dashes', () => {
      const text = renderDiagnosticsTestEmailText(sampleOptions)
      expect(text).not.toMatch(/[\u2013\u2014]/)
    })
  })

  describe('getDeliverabilityHeaders with diagnostics', () => {
    it('produces transactional headers for diagnostics smoke test', () => {
      const headers = getDeliverabilityHeaders({
        kind: 'diagnostics',
        messageId: 'test-msg-12345',
      })

      expect(headers['Auto-Submitted']).toBe('auto-generated')
      expect(headers['X-Auto-Response-Suppress']).toBe('OOF, AutoReply')
      expect(headers['X-Entity-Ref-ID']).toBe('invoiceui-diagnostics/test-msg-12345')
    })
  })
})
