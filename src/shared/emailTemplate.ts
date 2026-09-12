import {
  money,
  totals,
  quoteTotals,
  formatClientAddressLines,
  type Invoice,
  type Business,
  type Message,
  type Client,
  type CreditNote,
  type Attachment,
  type Quote,
} from './domain'

export interface EmailTemplateOptions {
  invoice: Invoice
  business: Business
  message?: Message | { kind: 'invoice' | 'reminder'; subject: string; body: string }
  client?: Client
  creditNotes?: CreditNote[]
  publicUrl?: string
  appUrl?: string
}

export interface MagicLinkEmailOptions {
  email: string
  url: string
  appUrl?: string
  expiresInMinutes?: number
}

export interface QuoteEmailTemplateOptions {
  quote: Quote
  business: Business
  message?: { subject?: string; body?: string }
  publicUrl?: string
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return ''
  try {
    const parts = isoDate.split('-').map(Number)
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return isoDate
  }
}

function addDaysToIso(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days, 12, 0, 0))
  return date.toISOString().slice(0, 10)
}

function buildGoogleCalendarUrl(invoice: Invoice, business: Business, balanceDue: string): string {
  if (!invoice.dueDate) return ''
  const cleanDue = invoice.dueDate.replace(/-/g, '')
  const nextDayIso = addDaysToIso(invoice.dueDate, 1).replace(/-/g, '')
  const dates = `${cleanDue}/${nextDayIso}`
  const title = `Payment Due: Invoice ${invoice.number || 'Invoice'} (${business.name || 'Invoice'})`
  const details = `Invoice: ${invoice.number || 'Draft'}\nAmount Due: ${money(balanceDue, invoice.currency)}\nDue Date: ${invoice.dueDate}\nPayee: ${business.name}\n\nPlease check your email for the attached invoice PDF and payment details.`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}`
}

function buildQuoteCalendarUrl(quote: Quote, business: Business): string {
  if (!quote.expiryDate) return ''
  const cleanExpiry = quote.expiryDate.replace(/-/g, '')
  const nextDayIso = addDaysToIso(quote.expiryDate, 1).replace(/-/g, '')
  const dates = `${cleanExpiry}/${nextDayIso}`
  const title = `Quote Expiry: ${quote.quoteNumber || 'Quotation'} (${business.name || 'Quote'})`
  const details = `Quotation: ${quote.quoteNumber || 'Draft'} (Rev ${quote.revision || 1})\nExpiry Date: ${quote.expiryDate}\nProvider: ${business.name}\n\nPlease review and confirm acceptance prior to expiry.`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}`
}

function isLightColor(hexColor: string): boolean {
  if (!hexColor || !hexColor.startsWith('#')) return false
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 155
}

export function renderInvoiceEmailHtml(options: EmailTemplateOptions): string {
  const { invoice: i, business: b, message: m, creditNotes = [], publicUrl } = options
  const client = i.client || options.client
  const t = totals(i, creditNotes)
  const isReminder = m?.kind === 'reminder'
  const accent = i.accent || b.accent || '#863bff'
  const textColorOnAccent = isLightColor(accent) ? '#0f172a' : '#ffffff'
  const templateStyle = i.template || b.template || 'studio'
  const currency = i.currency || b.currency || 'GBP'
  const formattedBalance = money(t.balance, currency)
  const formattedTotal = money(t.total, currency)
  const formattedSubtotal = money(t.subtotal, currency)
  const formattedPaid = money(t.paid, currency)
  const formattedDiscount = money(t.discount, currency)
  const formattedTax = money(t.tax, currency)
  const hasPayments = Number(t.paid) > 0
  const hasDiscount = Number(t.discount) > 0
  const hasTax = Number(t.tax) > 0
  const calendarUrl = buildGoogleCalendarUrl(i, b, t.balance)
  const clientAddressLines = formatClientAddressLines(client)
  const businessAddressLines = b.address ? b.address.split('\n').map((l) => l.trim()).filter(Boolean) : []
  const clientVisibleAttachments: Attachment[] = (i.attachments || []).filter((a) => a.visibility === 'client')

  // Personal message note filtering
  const customMessageBody = m?.body?.trim() || ''

  // Font choices based on template
  const fontFamily =
    templateStyle === 'classic'
      ? "Georgia, Cambria, 'Times New Roman', Times, serif"
      : templateStyle === 'minimal'
      ? "'Helvetica Neue', Helvetica, Arial, sans-serif"
      : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(m?.subject || `Invoice ${i.number || 'Draft'} from ${b.name}`)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td, th {
      padding: 0;
    }
    img {
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      max-width: 100%;
    }
    a {
      color: ${accent};
      text-decoration: none;
    }
    .hover-opacity:hover {
      opacity: 0.9 !important;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        width: 100% !important;
        padding: 12px !important;
      }
      .col-party {
        display: block !important;
        width: 100% !important;
        padding-bottom: 16px !important;
      }
      .stack-mobile {
        display: block !important;
        width: 100% !important;
      }
      .hide-mobile {
        display: none !important;
      }
      .mobile-center {
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:18px;border:1px solid #e4e4e7;box-shadow:0 10px 30px rgba(0,0,0,0.06);overflow:hidden;" class="email-wrapper">
          
          <!-- Top Accent Band -->
          <tr>
            <td style="height:6px;background-color:${accent};"></td>
          </tr>

          ${
            isReminder
              ? `
          <!-- Overdue / Payment Reminder Alert Banner -->
          <tr>
            <td style="background-color:#fffbeb;border-bottom:1px solid #fef3c7;padding:16px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:28px;vertical-align:middle;font-size:18px;">🔔</td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;letter-spacing:0.02em;text-transform:uppercase;">
                      Payment Reminder
                    </p>
                    <p style="margin:2px 0 0 0;font-size:13px;color:#b45309;line-height:1.4;">
                      This invoice had a scheduled due date of <strong>${formatDisplayDate(i.dueDate)}</strong>. An outstanding balance of <strong>${formattedBalance}</strong> remains payable.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Header Section -->
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    ${
                      b.logo
                        ? `<img src="${b.logo}" alt="${escapeHtml(b.name)}" style="height:44px;max-width:180px;object-fit:contain;display:block;" />`
                        : `<div style="display:inline-block;padding:8px 14px;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:700;border-radius:10px;letter-spacing:0.04em;">${escapeHtml(
                            b.name || 'INVOICE'
                          )}</div>`
                    }
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;${
                      Number(t.balance) <= 0
                        ? 'background-color:#dcfce7;color:#15803d;'
                        : isReminder
                        ? 'background-color:#fef3c7;color:#b45309;'
                        : 'background-color:#f4f4f5;color:#3f3f46;'
                    }">
                      ${Number(t.balance) <= 0 ? 'Paid' : isReminder ? 'Payment Due' : 'Issued'}
                    </div>
                    <div style="margin-top:6px;font-size:16px;font-weight:800;color:#18181b;letter-spacing:-0.01em;">
                      ${escapeHtml(i.number || 'DRAFT')}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            customMessageBody
              ? `
          <!-- Custom Personal Message Callout -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background-color:#fafafa;border-left:4px solid ${accent};border-radius:0 12px 12px 0;padding:16px 20px;">
                <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
                  Message from ${escapeHtml(b.name || 'Sender')}
                </p>
                <div style="margin:0;font-size:14px;line-height:1.6;color:#27272a;white-space:pre-line;">
                  ${escapeHtml(customMessageBody)}
                </div>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Embedded Invoice Card -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;background-color:#ffffff;">
                
                <!-- Card Header Strip -->
                <tr>
                  <td style="background-color:#fafafa;border-bottom:1px solid #e4e4e7;padding:14px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
                          Tax Invoice Details
                        </td>
                        <td align="right" style="font-size:12px;font-weight:600;color:#52525b;">
                          Ref: ${escapeHtml(i.number || 'Draft')}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Parties: From and Bill To -->
                <tr>
                  <td style="padding:20px;border-bottom:1px solid #f4f4f5;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Issuer Details -->
                        <td class="col-party" style="width:50%;vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;">
                            From
                          </p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">
                            ${escapeHtml(b.name)}
                          </p>
                          ${
                            b.email
                              ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">${escapeHtml(b.email)}</p>`
                              : ''
                          }
                          ${businessAddressLines
                            .map(
                              (line) =>
                                `<p style="margin:2px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(
                                  line
                                )}</p>`
                            )
                            .join('')}
                          ${
                            b.taxId
                              ? `<p style="margin:4px 0 0 0;font-size:11px;color:#71717a;font-weight:500;">Tax ID: ${escapeHtml(
                                  b.taxId
                                )}</p>`
                              : ''
                          }
                        </td>

                        <!-- Client Details -->
                        <td class="col-party" style="width:50%;vertical-align:top;padding-left:12px;">
                          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;">
                            Billed To
                          </p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">
                            ${escapeHtml(client.name || 'Client')}
                          </p>
                          ${
                            client.contact
                              ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">Attn: ${escapeHtml(
                                  client.contact
                                )}</p>`
                              : ''
                          }
                          ${
                            client.email
                              ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">${escapeHtml(client.email)}</p>`
                              : ''
                          }
                          ${clientAddressLines
                            .map(
                              (line) =>
                                `<p style="margin:2px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(
                                  line
                                )}</p>`
                            )
                            .join('')}
                          ${
                            client.taxId
                              ? `<p style="margin:4px 0 0 0;font-size:11px;color:#71717a;font-weight:500;">Tax ID: ${escapeHtml(
                                  client.taxId
                                )}</p>`
                              : ''
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Key Dates & Meta Ribbon -->
                <tr>
                  <td style="background-color:#fafafa;padding:14px 20px;border-bottom:1px solid #e4e4e7;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="vertical-align:top;width:25%;">
                          <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Issue Date</span>
                          <strong style="display:block;font-size:13px;color:#18181b;margin-top:2px;">${formatDisplayDate(
                            i.issueDate
                          )}</strong>
                        </td>
                        <td style="vertical-align:top;width:25%;">
                          <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Due Date</span>
                          <strong style="display:block;font-size:13px;color:${
                            isReminder ? '#b45309' : '#18181b'
                          };margin-top:2px;">${formatDisplayDate(i.dueDate)}</strong>
                        </td>
                        <td style="vertical-align:top;width:25%;">
                          <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Payment Terms</span>
                          <span style="display:block;font-size:13px;color:#3f3f46;margin-top:2px;">${
                            i.terms ? `${i.terms} days` : 'Due on receipt'
                          }</span>
                        </td>
                        <td align="right" style="vertical-align:top;width:25%;">
                          <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">PO / Reference</span>
                          <span style="display:block;font-size:13px;color:#3f3f46;margin-top:2px;">${
                            i.po ? escapeHtml(i.po) : i.reference ? escapeHtml(i.reference) : 'None'
                          }</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Line Items Table -->
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <thead>
                        <tr style="border-bottom:1px solid #e4e4e7;background-color:#ffffff;">
                          <th align="left" style="padding:12px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">
                            Description
                          </th>
                          <th align="center" style="padding:12px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:60px;">
                            Qty
                          </th>
                          <th align="right" style="padding:12px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:80px;">
                            Rate
                          </th>
                          <th align="right" style="padding:12px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:95px;">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        ${i.lines
                          .map((line, idx) => {
                            const lineTotal = t.lineTotals[idx] || '0.00'
                            const unitLabel = line.unit === 'hour' ? 'hr' : line.unit === 'unit' ? 'unit' : ''
                            return `
                        <tr style="border-bottom:1px solid #f4f4f5;background-color:${
                          idx % 2 === 1 ? '#fafafa' : '#ffffff'
                        };">
                          <td style="padding:14px 20px;font-size:13px;color:#18181b;vertical-align:top;line-height:1.4;">
                            <div style="font-weight:600;">${escapeHtml(line.description)}</div>
                            ${
                              line.group
                                ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#71717a;margin-top:2px;">Group: ${escapeHtml(
                                    line.group
                                  )}</div>`
                                : ''
                            }
                          </td>
                          <td align="center" style="padding:14px 10px;font-size:13px;color:#52525b;vertical-align:top;">
                            ${line.quantity}${unitLabel ? ` <span style="font-size:11px;color:#a1a1aa;">${unitLabel}</span>` : ''}
                          </td>
                          <td align="right" style="padding:14px 10px;font-size:13px;color:#52525b;vertical-align:top;white-space:nowrap;">
                            ${money(line.rate, currency)}
                          </td>
                          <td align="right" style="padding:14px 20px;font-size:13px;font-weight:600;color:#18181b;vertical-align:top;white-space:nowrap;">
                            ${money(lineTotal, currency)}
                          </td>
                        </tr>
                        `
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <!-- Totals Section -->
                <tr>
                  <td style="padding:20px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left Spacer / Notes summary -->
                        <td style="vertical-align:top;width:45%;padding-right:20px;">
                          ${
                            i.notes
                              ? `
                          <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">
                            Invoice Notes
                          </p>
                          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.4;white-space:pre-line;">
                            ${escapeHtml(i.notes)}
                          </p>
                          `
                              : ''
                          }
                        </td>

                        <!-- Right Totals Breakdown -->
                        <td style="vertical-align:top;width:55%;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Subtotal</td>
                              <td align="right" style="font-size:12px;color:#18181b;font-weight:600;padding:3px 0;">${formattedSubtotal}</td>
                            </tr>
                            ${
                              hasDiscount
                                ? `
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Discount ${
                                i.discountType === 'percent' ? `(${i.discount}%)` : ''
                              }</td>
                              <td align="right" style="font-size:12px;color:#16a34a;font-weight:600;padding:3px 0;">-${formattedDiscount}</td>
                            </tr>
                            `
                                : ''
                            }
                            ${
                              hasTax
                                ? `
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Tax / VAT (${i.tax}%)</td>
                              <td align="right" style="font-size:12px;color:#18181b;font-weight:600;padding:3px 0;">+${formattedTax}</td>
                            </tr>
                            `
                                : ''
                            }
                            <tr style="border-top:1px solid #e4e4e7;">
                              <td style="font-size:13px;color:#18181b;font-weight:700;padding:8px 0 4px 0;">Total Amount</td>
                              <td align="right" style="font-size:14px;color:#18181b;font-weight:800;padding:8px 0 4px 0;">${formattedTotal}</td>
                            </tr>
                            ${
                              hasPayments
                                ? `
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Payments Received</td>
                              <td align="right" style="font-size:12px;color:#16a34a;font-weight:600;padding:3px 0;">-${formattedPaid}</td>
                            </tr>
                            `
                                : ''
                            }
                            <tr>
                              <td colspan="2" style="padding-top:10px;">
                                <!-- Highlighted Balance Due Box -->
                                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#18181b;border-radius:10px;padding:10px 14px;">
                                  <tr>
                                    <td style="color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">
                                      Balance Due
                                    </td>
                                    <td align="right" style="color:#ffffff;font-size:16px;font-weight:800;">
                                      ${formattedBalance}
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bank Transfer & Settlement Instructions Card -->
          ${
            b.bank
              ? `
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:18px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="width:24px;vertical-align:top;font-size:16px;">🏦</td>
                    <td style="vertical-align:top;padding-left:10px;">
                      <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#52525b;">
                        Payment Instructions
                      </p>
                      <div style="font-size:13px;line-height:1.5;color:#27272a;white-space:pre-line;font-family:-apple-system,BlinkMacSystemFont,monospace;">${escapeHtml(
                        b.bank
                      )}</div>
                      <p style="margin:8px 0 0 0;font-size:11px;color:#71717a;">
                        Please quote invoice reference <strong>${escapeHtml(
                          i.number || 'Invoice'
                        )}</strong> on payment.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Cool Actions Section: Direct PDF Download & Google Calendar Reminder -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        ${
                          publicUrl
                            ? `
                        <!-- Primary CTA: View & Download Online -->
                        <td style="padding:4px 6px;">
                          <a href="${publicUrl}" target="_blank" style="display:inline-block;padding:13px 24px;background-color:${accent};color:${textColorOnAccent};font-size:13px;font-weight:700;border-radius:10px;text-align:center;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,0.12);" class="hover-opacity">
                            View & Download PDF Invoice &rarr;
                          </a>
                        </td>
                        `
                            : ''
                        }
                        ${
                          calendarUrl && Number(t.balance) > 0
                            ? `
                        <!-- Secondary CTA: Add Due Date to Google Calendar -->
                        <td style="padding:4px 6px;">
                          <a href="${calendarUrl}" target="_blank" style="display:inline-block;padding:13px 18px;background-color:#f4f4f5;color:#27272a;border:1px solid #d4d4d8;font-size:13px;font-weight:600;border-radius:10px;text-align:center;text-decoration:none;" class="hover-opacity">
                            📅 Add Due Date to Calendar
                          </a>
                        </td>
                        `
                            : ''
                        }
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Attached Files Showcase (if deliverables or client attachments exist) -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background-color:#ffffff;border-top:1px dashed #e4e4e7;padding-top:16px;">
                <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">
                  Attached Deliverables
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <!-- Main PDF Badge -->
                      <span style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:6px 12px;font-size:12px;color:#27272a;margin-right:8px;margin-bottom:6px;">
                        📄 ${escapeHtml(i.number || 'Invoice')}.pdf <span style="color:#71717a;font-size:10px;">(Official Tax Invoice)</span>
                      </span>
                      ${
                        i.breakdown
                          ? `
                      <span style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:6px 12px;font-size:12px;color:#27272a;margin-right:8px;margin-bottom:6px;">
                        📊 ${escapeHtml(i.number || 'Invoice')}-breakdown.pdf <span style="color:#71717a;font-size:10px;">(Detailed Work Log)</span>
                      </span>
                      `
                          : ''
                      }
                      ${clientVisibleAttachments
                        .map(
                          (att) => `
                      <span style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:6px 12px;font-size:12px;color:#27272a;margin-right:8px;margin-bottom:6px;">
                        📎 ${escapeHtml(att.name)} <span style="color:#71717a;font-size:10px;">(${Math.round(
                            att.size / 1024
                          )} KB)</span>
                      </span>
                      `
                        )
                        .join('')}
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:24px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:600;color:#27272a;">
                ${escapeHtml(b.name)}
              </p>
              ${
                b.footer
                  ? `<p style="margin:4px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(
                      b.footer
                    )}</p>`
                  : ''
              }
              <p style="margin:12px 0 0 0;font-size:10px;color:#a1a1aa;line-height:1.4;">
                This email and any files transmitted with it are confidential and intended solely for the recipient. If you have received this message in error, please notify the sender immediately.
              </p>
            </td>
          </tr>

        </table>
        
        <!-- Outside Small Branding Note -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;margin:16px auto 0 auto;">
          <tr>
            <td align="center" style="font-size:11px;color:#a1a1aa;">
              Delivered securely via InvoiceUI
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderInvoiceEmailText(options: EmailTemplateOptions): string {
  const { invoice: i, business: b, message: m, creditNotes = [], publicUrl } = options
  const client = i.client || options.client
  const t = totals(i, creditNotes)
  const isReminder = m?.kind === 'reminder'
  const currency = i.currency || b.currency || 'GBP'
  const lines: string[] = []

  if (isReminder) {
    lines.push(`*** PAYMENT REMINDER: INVOICE ${i.number || 'DRAFT'} ***`)
    lines.push(`This invoice had a scheduled due date of ${formatDisplayDate(i.dueDate)}.`)
    lines.push(`Outstanding balance due: ${money(t.balance, currency)}`)
    lines.push('')
  }

  if (m?.body?.trim()) {
    lines.push(m.body.trim())
    lines.push('')
    lines.push('--------------------------------------------------')
  }

  lines.push(`INVOICE: ${i.number || 'Draft'}`)
  lines.push(`Issue Date: ${formatDisplayDate(i.issueDate)}`)
  lines.push(`Due Date: ${formatDisplayDate(i.dueDate)}`)
  if (i.po) lines.push(`PO Number: ${i.po}`)
  if (i.reference) lines.push(`Reference: ${i.reference}`)
  lines.push('')

  lines.push(`FROM:`)
  lines.push(b.name)
  if (b.email) lines.push(b.email)
  if (b.address) lines.push(b.address)
  if (b.taxId) lines.push(`Tax ID: ${b.taxId}`)
  lines.push('')

  lines.push(`BILLED TO:`)
  lines.push(client.name)
  if (client.contact) lines.push(`Attn: ${client.contact}`)
  if (client.email) lines.push(client.email)
  const clientAddress = formatClientAddressLines(client)
  if (clientAddress.length) lines.push(clientAddress.join('\n'))
  if (client.taxId) lines.push(`Tax ID: ${client.taxId}`)
  lines.push('')

  lines.push('ITEMS:')
  i.lines.forEach((l, idx) => {
    const lineTotal = t.lineTotals[idx] || '0.00'
    const unitLabel = l.unit === 'hour' ? 'hr' : l.unit === 'unit' ? 'unit' : ''
    lines.push(`- ${l.description}: ${l.quantity} ${unitLabel} @ ${money(l.rate, currency)} = ${money(lineTotal, currency)}`)
  })
  lines.push('')

  lines.push(`Subtotal: ${money(t.subtotal, currency)}`)
  if (Number(t.discount) > 0) {
    lines.push(`Discount: -${money(t.discount, currency)}`)
  }
  if (Number(t.tax) > 0) {
    lines.push(`Tax (${i.tax}%): +${money(t.tax, currency)}`)
  }
  lines.push(`Total Amount: ${money(t.total, currency)}`)
  if (Number(t.paid) > 0) {
    lines.push(`Payments Received: -${money(t.paid, currency)}`)
  }
  lines.push(`BALANCE DUE: ${money(t.balance, currency)}`)
  lines.push('')

  if (b.bank) {
    lines.push('PAYMENT INSTRUCTIONS:')
    lines.push(b.bank)
    lines.push(`Please quote ${i.number || 'Invoice'} with your payment.`)
    lines.push('')
  }

  if (publicUrl) {
    lines.push(`View and download PDF online: ${publicUrl}`)
    lines.push('')
  }

  if (b.footer) {
    lines.push(b.footer)
  }

  return lines.join('\n')
}

// -----------------------------------------------------------------------------
// Magic Link Authentication Email Templates
// -----------------------------------------------------------------------------

export function renderMagicLinkEmailHtml(options: MagicLinkEmailOptions): string {
  const { email, url, expiresInMinutes = 10 } = options
  const accent = '#863bff' // Sleek InvoiceUI brand violet

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <title>Sign in to InvoiceUI</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td, th {
      padding: 0;
    }
    a {
      color: ${accent};
      text-decoration: none;
    }
    .hover-opacity:hover {
      opacity: 0.9 !important;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        width: 100% !important;
        padding: 16px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;padding:40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;margin:0 auto;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;box-shadow:0 12px 36px rgba(0,0,0,0.06);overflow:hidden;" class="email-wrapper">
          
          <!-- Brand Accent Top Band -->
          <tr>
            <td style="height:6px;background-color:${accent};"></td>
          </tr>

          <!-- Header & Brand Mark -->
          <tr>
            <td style="padding:32px 32px 20px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <div style="width:48px;height:48px;line-height:48px;background-color:#18181b;color:#ffffff;font-size:24px;border-radius:14px;display:inline-block;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.12);">
                      ▤
                    </div>
                    <div style="margin-top:14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#71717a;">
                      InvoiceUI Private Access
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:0 32px 28px 32px;text-align:center;">
              <h1 style="margin:0 0 10px 0;font-size:22px;font-weight:800;color:#18181b;letter-spacing:-0.02em;line-height:1.3;">
                Sign in to your private workspace
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#71717a;line-height:1.5;">
                A little less admin. A lot more headspace.
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;color:#3f3f46;line-height:1.6;text-align:left;">
                Hello <strong>${escapeHtml(email)}</strong>,<br/><br/>
                We received a request to sign in to your InvoiceUI workspace. Click the secure button below to authenticate directly without a password.
              </p>

              <!-- Primary CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:700;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.18);" class="hover-opacity">
                      Sign in to InvoiceUI &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Callout Box -->
              <div style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:16px 18px;text-align:left;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="width:24px;vertical-align:top;font-size:16px;">🔒</td>
                    <td style="vertical-align:top;padding-left:10px;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:#27272a;">
                        Security &amp; Expiry Information
                      </p>
                      <p style="margin:4px 0 0 0;font-size:11px;color:#71717a;line-height:1.5;">
                        This magic link is single-use and will expire in <strong>${expiresInMinutes} minutes</strong>. If you did not request this sign-in link, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Direct URL Fallback -->
              <div style="margin-top:24px;text-align:left;">
                <p style="margin:0 0 6px 0;font-size:11px;color:#71717a;">
                  Button not working? Copy and paste this URL into your browser:
                </p>
                <div style="background-color:#f4f4f5;border-radius:8px;padding:10px 12px;font-size:11px;color:#52525b;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;line-height:1.4;">
                  ${escapeHtml(url)}
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;color:#3f3f46;">
                InvoiceUI · Private Workspace
              </p>
              <p style="margin:4px 0 0 0;font-size:10px;color:#a1a1aa;line-height:1.4;">
                Delivered securely via Resend · Passwordless owner authentication
              </p>
            </td>
          </tr>

        </table>

        <!-- Outer Footer Note -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:540px;margin:16px auto 0 auto;">
          <tr>
            <td align="center" style="font-size:11px;color:#a1a1aa;">
              Protected by single-owner server-verified sessions
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderMagicLinkEmailText(options: MagicLinkEmailOptions): string {
  const { email, url, expiresInMinutes = 10 } = options
  return [
    'Sign in to InvoiceUI',
    '',
    `Hello ${email},`,
    '',
    'Use this link to sign in to your private invoice workspace:',
    url,
    '',
    `This link expires in ${expiresInMinutes} minutes and is single-use only.`,
    '',
    'If you did not request this sign-in link, you can safely ignore this email.',
    '',
    '--------------------------------------------------',
    'InvoiceUI - Private Invoice Workspace',
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Quotation Email Templates
// -----------------------------------------------------------------------------

export function renderQuoteEmailHtml(options: QuoteEmailTemplateOptions): string {
  const { quote: q, business: b, message: m, publicUrl } = options
  const client = q.client
  const t = quoteTotals(q)
  const accent = q.accent || b.accent || '#863bff'
  const textColorOnAccent = isLightColor(accent) ? '#0f172a' : '#ffffff'
  const currency = q.currency || b.currency || 'GBP'
  const formattedTotal = money(t.total, currency)
  const formattedSubtotal = money(t.subtotal, currency)
  const formattedDiscount = money(t.discount, currency)
  const formattedTax = money(t.tax, currency)
  const hasDiscount = Number(t.discount) > 0
  const hasTax = Number(t.tax) > 0
  const calendarUrl = buildQuoteCalendarUrl(q, b)
  const clientAddressLines = formatClientAddressLines(client)
  const businessAddressLines = b.address ? b.address.split('\n').map((l) => l.trim()).filter(Boolean) : []
  const customMessage = m?.body?.trim() || ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(m?.subject || `Quote ${q.quoteNumber} (Rev ${q.revision}) from ${b.name}`)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td, th {
      padding: 0;
    }
    a {
      color: ${accent};
      text-decoration: none;
    }
    .hover-opacity:hover {
      opacity: 0.9 !important;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        width: 100% !important;
        padding: 12px !important;
      }
      .col-party {
        display: block !important;
        width: 100% !important;
        padding-bottom: 16px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:18px;border:1px solid #e4e4e7;box-shadow:0 10px 30px rgba(0,0,0,0.06);overflow:hidden;" class="email-wrapper">
          
          <!-- Top Accent Band -->
          <tr>
            <td style="height:6px;background-color:${accent};"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    ${
                      b.logo
                        ? `<img src="${b.logo}" alt="${escapeHtml(b.name)}" style="height:44px;max-width:180px;object-fit:contain;display:block;" />`
                        : `<div style="display:inline-block;padding:8px 14px;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:700;border-radius:10px;letter-spacing:0.04em;">${escapeHtml(
                            b.name || 'QUOTATION'
                          )}</div>`
                    }
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background-color:#f4f4f5;color:#3f3f46;">
                      ${escapeHtml(q.status)} (Rev ${q.revision})
                    </div>
                    <div style="margin-top:6px;font-size:16px;font-weight:800;color:#18181b;letter-spacing:-0.01em;">
                      ${escapeHtml(q.quoteNumber || 'QUOTE')}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            customMessage
              ? `
          <!-- Custom Note Callout -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background-color:#fafafa;border-left:4px solid ${accent};border-radius:0 12px 12px 0;padding:16px 20px;">
                <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
                  Message from ${escapeHtml(b.name || 'Sender')}
                </p>
                <div style="margin:0;font-size:14px;line-height:1.6;color:#27272a;white-space:pre-line;">
                  ${escapeHtml(customMessage)}
                </div>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Embedded Quote Card -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;background-color:#ffffff;">
                
                <!-- Card Header Strip -->
                <tr>
                  <td style="background-color:#fafafa;border-bottom:1px solid #e4e4e7;padding:14px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
                          Formal Quotation
                        </td>
                        <td align="right" style="font-size:12px;font-weight:600;color:#52525b;">
                          Valid Until: ${formatDisplayDate(q.expiryDate)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Parties: From and Client -->
                <tr>
                  <td style="padding:20px;border-bottom:1px solid #f4f4f5;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td class="col-party" style="width:50%;vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;">Prepared By</p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">${escapeHtml(b.name)}</p>
                          ${b.email ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">${escapeHtml(b.email)}</p>` : ''}
                          ${businessAddressLines.map((l) => `<p style="margin:2px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(l)}</p>`).join('')}
                        </td>
                        <td class="col-party" style="width:50%;vertical-align:top;padding-left:12px;">
                          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;">Prepared For</p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">${escapeHtml(client.name || 'Client')}</p>
                          ${client.contact ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">Attn: ${escapeHtml(client.contact)}</p>` : ''}
                          ${client.email ? `<p style="margin:2px 0 0 0;font-size:12px;color:#52525b;">${escapeHtml(client.email)}</p>` : ''}
                          ${clientAddressLines.map((l) => `<p style="margin:2px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(l)}</p>`).join('')}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Scope summary if provided -->
                ${
                  q.scope
                    ? `
                <tr>
                  <td style="background-color:#fafafa;padding:14px 20px;border-bottom:1px solid #e4e4e7;">
                    <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Scope of Work</span>
                    <p style="margin:4px 0 0 0;font-size:13px;color:#27272a;line-height:1.5;">${escapeHtml(q.scope)}</p>
                  </td>
                </tr>
                `
                    : ''
                }

                <!-- Line Items Table -->
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <thead>
                        <tr style="border-bottom:1px solid #e4e4e7;background-color:#ffffff;">
                          <th align="left" style="padding:12px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Description</th>
                          <th align="center" style="padding:12px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:60px;">Qty</th>
                          <th align="right" style="padding:12px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:80px;">Rate</th>
                          <th align="right" style="padding:12px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;width:95px;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${q.lines
                          .map((line, idx) => {
                            const lineTotal = t.lineTotals[idx] || '0.00'
                            const unitLabel = line.unit === 'hour' ? 'hr' : line.unit === 'unit' ? 'unit' : ''
                            return `
                        <tr style="border-bottom:1px solid #f4f4f5;background-color:${idx % 2 === 1 ? '#fafafa' : '#ffffff'};">
                          <td style="padding:14px 20px;font-size:13px;color:#18181b;vertical-align:top;line-height:1.4;">
                            <div style="font-weight:600;">${escapeHtml(line.description)}</div>
                          </td>
                          <td align="center" style="padding:14px 10px;font-size:13px;color:#52525b;vertical-align:top;">
                            ${line.quantity}${unitLabel ? ` <span style="font-size:11px;color:#a1a1aa;">${unitLabel}</span>` : ''}
                          </td>
                          <td align="right" style="padding:14px 10px;font-size:13px;color:#52525b;vertical-align:top;white-space:nowrap;">
                            ${money(line.rate, currency)}
                          </td>
                          <td align="right" style="padding:14px 20px;font-size:13px;font-weight:600;color:#18181b;vertical-align:top;white-space:nowrap;">
                            ${money(lineTotal, currency)}
                          </td>
                        </tr>
                        `
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <!-- Totals Section -->
                <tr>
                  <td style="padding:20px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="vertical-align:top;width:45%;padding-right:20px;">
                          ${
                            q.notes
                              ? `
                          <p style="margin:0 0 4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Proposal Notes</p>
                          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.4;white-space:pre-line;">${escapeHtml(q.notes)}</p>
                          `
                              : ''
                          }
                        </td>
                        <td style="vertical-align:top;width:55%;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Subtotal</td>
                              <td align="right" style="font-size:12px;color:#18181b;font-weight:600;padding:3px 0;">${formattedSubtotal}</td>
                            </tr>
                            ${
                              hasDiscount
                                ? `
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Discount ${q.discountType === 'percent' ? `(${q.discount}%)` : ''}</td>
                              <td align="right" style="font-size:12px;color:#16a34a;font-weight:600;padding:3px 0;">-${formattedDiscount}</td>
                            </tr>
                            `
                                : ''
                            }
                            ${
                              hasTax
                                ? `
                            <tr>
                              <td style="font-size:12px;color:#71717a;padding:3px 0;">Tax (${q.tax}%)</td>
                              <td align="right" style="font-size:12px;color:#18181b;font-weight:600;padding:3px 0;">+${formattedTax}</td>
                            </tr>
                            `
                                : ''
                            }
                            <tr>
                              <td colspan="2" style="padding-top:10px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#18181b;border-radius:10px;padding:10px 14px;">
                                  <tr>
                                    <td style="color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Total Quote</td>
                                    <td align="right" style="color:#ffffff;font-size:16px;font-weight:800;">${formattedTotal}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        ${
                          publicUrl
                            ? `
                        <td style="padding:4px 6px;">
                          <a href="${publicUrl}" target="_blank" style="display:inline-block;padding:13px 24px;background-color:${accent};color:${textColorOnAccent};font-size:13px;font-weight:700;border-radius:10px;text-align:center;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,0.12);" class="hover-opacity">
                            Review & Accept Quotation &rarr;
                          </a>
                        </td>
                        `
                            : ''
                        }
                        ${
                          calendarUrl
                            ? `
                        <td style="padding:4px 6px;">
                          <a href="${calendarUrl}" target="_blank" style="display:inline-block;padding:13px 18px;background-color:#f4f4f5;color:#27272a;border:1px solid #d4d4d8;font-size:13px;font-weight:600;border-radius:10px;text-align:center;text-decoration:none;" class="hover-opacity">
                            📅 Add Expiry Date to Calendar
                          </a>
                        </td>
                        `
                            : ''
                        }
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:24px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:600;color:#27272a;">${escapeHtml(b.name)}</p>
              ${b.footer ? `<p style="margin:4px 0 0 0;font-size:12px;color:#71717a;line-height:1.4;">${escapeHtml(b.footer)}</p>` : ''}
              <p style="margin:12px 0 0 0;font-size:10px;color:#a1a1aa;line-height:1.4;">
                This quotation is an estimate subject to formal acceptance before the stated expiry date.
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;margin:16px auto 0 auto;">
          <tr>
            <td align="center" style="font-size:11px;color:#a1a1aa;">
              Delivered securely via InvoiceUI
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderQuoteEmailText(options: QuoteEmailTemplateOptions): string {
  const { quote: q, business: b, message: m, publicUrl } = options
  const client = q.client
  const t = quoteTotals(q)
  const currency = q.currency || b.currency || 'GBP'
  const lines: string[] = []

  if (m?.body?.trim()) {
    lines.push(m.body.trim())
    lines.push('')
    lines.push('--------------------------------------------------')
  }

  lines.push(`QUOTATION: ${q.quoteNumber || 'Draft'} (Revision ${q.revision})`)
  lines.push(`Issue Date: ${formatDisplayDate(q.issueDate)}`)
  lines.push(`Valid Until: ${formatDisplayDate(q.expiryDate)}`)
  lines.push(`Status: ${q.status}`)
  lines.push('')

  if (q.scope) {
    lines.push('SCOPE OF WORK:')
    lines.push(q.scope)
    lines.push('')
  }

  lines.push(`PREPARED BY:`)
  lines.push(b.name)
  if (b.email) lines.push(b.email)
  if (b.address) lines.push(b.address)
  lines.push('')

  lines.push(`PREPARED FOR:`)
  lines.push(client.name)
  if (client.contact) lines.push(`Attn: ${client.contact}`)
  if (client.email) lines.push(client.email)
  const clientAddress = formatClientAddressLines(client)
  if (clientAddress.length) lines.push(clientAddress.join('\n'))
  lines.push('')

  lines.push('PROPOSED ITEMS:')
  q.lines.forEach((l, idx) => {
    const lineTotal = t.lineTotals[idx] || '0.00'
    const unitLabel = l.unit === 'hour' ? 'hr' : l.unit === 'unit' ? 'unit' : ''
    lines.push(`- ${l.description}: ${l.quantity} ${unitLabel} @ ${money(l.rate, currency)} = ${money(lineTotal, currency)}`)
  })
  lines.push('')

  lines.push(`Subtotal: ${money(t.subtotal, currency)}`)
  if (Number(t.discount) > 0) {
    lines.push(`Discount: -${money(t.discount, currency)}`)
  }
  if (Number(t.tax) > 0) {
    lines.push(`Tax (${q.tax}%): +${money(t.tax, currency)}`)
  }
  lines.push(`TOTAL QUOTE AMOUNT: ${money(t.total, currency)}`)
  lines.push('')

  if (publicUrl) {
    lines.push(`Review and accept quote online: ${publicUrl}`)
    lines.push('')
  }

  if (b.footer) {
    lines.push(b.footer)
  }

  return lines.join('\n')
}
