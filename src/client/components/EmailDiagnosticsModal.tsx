import { useState, useMemo } from 'react'
import { Modal, Button, Field, Badge } from './ui'
import { Send, Check, Copy, Sparkles, RefreshCw } from './ui/AnimatedIcon'
import { api } from '../workspace'
import {
  renderDiagnosticsTestEmailHtml,
  renderInvoiceEmailHtml,
  renderReminderEmailHtml,
  renderMagicLinkEmailHtml,
} from '../../shared/emailTemplate'
import { today, type Workspace, type Invoice } from '../../shared/domain'

export interface EmailDiagnosticsModalProps {
  open: boolean
  onClose: () => void
  workspace: Workspace
  ownerEmail?: string
  emailEnabled: boolean
  demo: boolean
}

type ScenarioKey = 'smoke' | 'invoice' | 'reminder' | 'magic-link'

interface TestResult {
  ok: boolean
  id?: string
  to?: string
  from?: string
  subject?: string
  scenario?: string
  headers?: Record<string, string>
  latencyMs?: number
  timestamp?: string
  error?: string
  diagnostic?: {
    suggestion?: string
  }
}

export function EmailDiagnosticsModal({
  open,
  onClose,
  workspace: w,
  ownerEmail = 'humzab1711@hotmail.com',
  emailEnabled,
  demo,
}: EmailDiagnosticsModalProps) {
  const [scenario, setScenario] = useState<ScenarioKey>('smoke')
  const [recipient, setRecipient] = useState<string>(ownerEmail)
  const [customNote, setCustomNote] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'configure' | 'preview'>('configure')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const biz = w.business

  const sampleInvoice: Invoice = useMemo(() => {
    return (
      w.invoices[0] || {
        id: 'sample-inv',
        number: `${biz.prefix || 'INV'}-2026-0001`,
        clientId: 'client-sample',
        projectId: '',
        client: {
          id: 'client-sample',
          name: 'Acme Global Ltd',
          email: recipient || ownerEmail,
          address: '742 Evergreen Terrace\nLondon\nEC1A 1BB',
        },
        issueDate: today(biz.timezone),
        dueDate: today(biz.timezone),
        currency: biz.currency || 'GBP',
        lines: [
          { id: '1', description: 'Web Application Design & Architecture', quantity: 1, rate: '850.00', unit: 'unit' },
          { id: '2', description: 'Performance & Security Hardening', quantity: 4, rate: '95.00', unit: 'hour' },
        ],
        notes: 'Thank you for your business. Please quote invoice number on bank transfer.',
        terms: 14,
        tax: 0,
        deposit: '0',
        discount: '0',
        payments: [],
        history: [],
        reminder: { enabled: true, days: 7 },
        lifecycle: 'issued',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    )
  }, [w.invoices, biz, recipient, ownerEmail])

  const previewHtml = useMemo(() => {
    const appUrl = window.location.origin
    if (scenario === 'smoke') {
      return renderDiagnosticsTestEmailHtml({
        recipient: recipient || ownerEmail,
        scenario: 'smoke',
        appUrl,
        senderFrom: `${biz.name || 'InvoiceUI'} <invoices@humza.website>`,
        note: customNote || undefined,
        businessName: biz.name || 'InvoiceUI Workspace',
      })
    }
    if (scenario === 'invoice') {
      return renderInvoiceEmailHtml({
        invoice: sampleInvoice,
        business: biz,
        client: sampleInvoice.client,
        message: {
          kind: 'invoice',
          subject: `Invoice ${sampleInvoice.number} from ${biz.name || 'InvoiceUI'}`,
          body:
            customNote ||
            `Hello,\n\nPlease find attached invoice ${sampleInvoice.number} for your recent project milestones.\n\nBest regards,\n${biz.name || 'The Team'}`,
        },
        appUrl,
      })
    }
    if (scenario === 'reminder') {
      return renderReminderEmailHtml({
        invoice: sampleInvoice,
        business: biz,
        client: sampleInvoice.client,
        appUrl,
      })
    }
    if (scenario === 'magic-link') {
      return renderMagicLinkEmailHtml({
        email: recipient || ownerEmail,
        url: `${appUrl}/?test_magic_link_preview=true`,
        appUrl,
        expiresInMinutes: 10,
      })
    }
    return ''
  }, [scenario, recipient, ownerEmail, biz, sampleInvoice, customNote])

  const handleSendTest = async () => {
    if (demo) {
      setResult({
        ok: false,
        error: 'Local preview demo mode cannot dispatch real outbound emails. Deploy to Worker or connect backend.',
        diagnostic: {
          suggestion: 'Sign in to your live workspace on Cloudflare Workers to send real test emails via Resend.',
        },
      })
      return
    }

    if (!emailEnabled) {
      setResult({
        ok: false,
        error: 'RESEND_API_KEY is not configured on the server environment.',
        diagnostic: {
          suggestion: 'Set RESEND_API_KEY in Cloudflare Worker secrets: npx wrangler secret put RESEND_API_KEY',
        },
      })
      return
    }

    setBusy(true)
    setResult(null)

    try {
      const res = await api<TestResult>('/api/private/dev/test-email', {
        method: 'POST',
        body: JSON.stringify({
          to: recipient.trim() || ownerEmail,
          scenario,
          customNote: customNote.trim() || undefined,
        }),
      })
      setResult(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test email could not be sent'
      setResult({
        ok: false,
        error: msg,
        diagnostic: {
          suggestion: msg.toLowerCase().includes('domain')
            ? 'The sending domain may not be verified in Resend yet. Check DNS records at resend.com/domains.'
            : 'Check Resend dashboard logs or Cloudflare Worker secrets.',
        },
      })
    } finally {
      setBusy(false)
    }
  }

  const copyHtmlSnippet = () => {
    void navigator.clipboard.writeText(previewHtml).then(() => {
      setCopiedHtml(true)
      setTimeout(() => setCopiedHtml(false), 2000)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email Developer Tools & Deliverability"
      description="Send test emails and verify Resend deliverability, anti-spam headers, and HTML layout."
    >
      <div className="space-y-4">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">Resend Provider:</span>
            {emailEnabled ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                Connected
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                Key Missing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <span>Sender:</span>
            <code className="text-[11px] font-mono bg-[var(--card)] px-1.5 py-0.5 rounded border border-[var(--line)]">
              invoices@humza.website
            </code>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
          <div className="flex gap-1.5 p-1 bg-[var(--soft)] rounded-xl">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'configure'
                  ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('configure')}
            >
              Test Setup & Dispatch
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('preview')}
            >
              <Sparkles size={12} animateOnHover />
              Live HTML Preview
            </button>
          </div>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-2">
              <div className="flex bg-[var(--soft)] p-1 rounded-lg text-[11px]">
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    previewDevice === 'desktop'
                      ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  onClick={() => setPreviewDevice('desktop')}
                >
                  Desktop (620px)
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    previewDevice === 'mobile'
                      ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  onClick={() => setPreviewDevice('mobile')}
                >
                  Mobile (375px)
                </button>
              </div>
              <Button type="button" variant="secondary" className="text-xs h-7 px-2.5" onClick={copyHtmlSnippet}>
                {copiedHtml ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} animateOnHover />}
                {copiedHtml ? 'Copied' : 'Copy HTML'}
              </Button>
            </div>
          )}
        </div>

        {activeTab === 'configure' ? (
          <div className="space-y-4">
            {/* Scenario selector */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] block mb-1.5">Select Email Scenario</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    key: 'smoke',
                    title: 'Smoke Test (Ping)',
                    desc: 'Outbound connectivity check with deliverability audit table.',
                  },
                  {
                    key: 'invoice',
                    title: 'Sample Invoice Notification',
                    desc: 'Full HTML invoice email with line items and pay links.',
                  },
                  {
                    key: 'reminder',
                    title: 'Overdue Payment Reminder',
                    desc: 'Polite reminder with calendar event and unsubscribe headers.',
                  },
                  {
                    key: 'magic-link',
                    title: 'Authentication Magic Link',
                    desc: 'Sign-in token template with security callout boxes.',
                  },
                ].map(s => {
                  const isSelected = scenario === s.key
                  return (
                    <div
                      key={s.key}
                      role="button"
                      tabIndex={0}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                          : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--muted)]'
                      }`}
                      onClick={() => setScenario(s.key as ScenarioKey)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') setScenario(s.key as ScenarioKey)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[var(--ink)]">{s.title}</span>
                        {isSelected && <span className="text-emerald-600 text-xs">✓</span>}
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-1">{s.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-1">
              <Field label="Target Recipient Email" hint="Where the test email will be delivered">
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1"
                  />
                  {ownerEmail && recipient !== ownerEmail && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs shrink-0"
                      onClick={() => setRecipient(ownerEmail)}
                    >
                      Use owner email
                    </Button>
                  )}
                </div>
              </Field>
            </div>

            {/* Optional developer note */}
            <Field label="Custom Note (Optional)" hint="Included in test email body to verify dynamic variables">
              <input
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="e.g. Testing DNS propagation after updating SPF records"
              />
            </Field>

            {/* Dispatch Action */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <div className="text-xs text-[var(--muted)]">
                {busy ? 'Sending test via Resend API…' : 'Transmitted using verified deliverability headers'}
              </div>
              <Button
                variant="primary"
                disabled={busy || !recipient.trim()}
                onClick={() => void handleSendTest()}
                className="min-w-[140px]"
              >
                {busy ? (
                  <RefreshCw size={13} className="animate-spin mr-1.5 inline" />
                ) : (
                  <Send size={13} animateOnHover className="mr-1.5 inline" />
                )}
                {busy ? 'Sending…' : 'Send test email'}
              </Button>
            </div>

            {/* Diagnostic Results */}
            {result && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all ${
                  result.ok
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500/40 text-rose-900 dark:text-rose-200'
                }`}
                role="status"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>{result.ok ? '✓ Test Email Dispatched Successfully' : '✕ Delivery Rejected by Provider'}</span>
                  </div>
                  {result.latencyMs !== undefined && (
                    <span className="font-mono text-[11px] opacity-80">{result.latencyMs}ms latency</span>
                  )}
                </div>

                {result.ok ? (
                  <>
                    <div className="space-y-1 font-mono text-[11px] opacity-90">
                      <div>
                        <strong>Resend Message ID:</strong> {result.id}
                      </div>
                      <div>
                        <strong>Delivered to:</strong> {result.to}
                      </div>
                      <div>
                        <strong>Sender From:</strong> {result.from}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-emerald-500/20 text-[11px] space-y-1">
                      <p className="font-semibold">Deliverability Verification Checklist:</p>
                      <ul className="list-disc list-inside space-y-0.5 opacity-90">
                        <li>Auto-Submitted header applied (auto-generated)</li>
                        <li>Vacation auto-reply loop suppression enabled</li>
                        <li>Check your inbox and spam folder for SPF/DKIM verification details</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{result.error}</p>
                    {result.diagnostic?.suggestion && (
                      <p className="text-[11px] opacity-90 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                        <strong>Troubleshooting:</strong> {result.diagnostic.suggestion}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* HTML Preview Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-[var(--soft)] px-3 py-2 rounded-xl">
              <span>Rendered HTML preview for scenario: {scenario.toUpperCase()}</span>
              <span className="font-mono text-[11px]">
                {previewDevice === 'desktop' ? 'Desktop (620px)' : 'Mobile (375px)'}
              </span>
            </div>
            <div className="flex justify-center bg-zinc-100 dark:bg-zinc-950 p-4 rounded-2xl border border-[var(--border)] overflow-hidden">
              <div
                className="transition-all duration-300 shadow-lg rounded-xl overflow-hidden bg-white"
                style={{ width: previewDevice === 'desktop' ? '100%' : '375px', maxWidth: '620px' }}
              >
                <iframe
                  title="Test Email Preview"
                  srcDoc={previewHtml}
                  className="w-full h-[460px] border-0 block bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
