import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { money } from '../../shared/domain'
import { parseExistingBankString } from '../../shared/banks'
import { Button, Badge } from './ui'
import { BankLogo } from './ui/BankLogo'

export interface ClientPortalProps {
  owner: string
  token: string
  onClose?: () => void
}

interface PortalData {
  clientId: string
  client: {
    name: string
    email: string
    address: string
    contact?: string
    phone?: string
    country?: string
    taxId?: string
    currency?: string
  }
  business: {
    name: string
    email: string
    address: string
    taxId?: string
    currency: string
    logo?: string
    bank?: string
  }
  totalBalanceDue: string
  currency: string
  invoices: Array<{
    id: string
    number: string
    issueDate: string
    dueDate: string
    total: string
    paid: string
    balance: string
    status: string
    currency: string
    hasBreakdown: boolean
  }>
  allowStatements: boolean
  statementSummary?: {
    startDate: string
    endDate: string
    openingBalance: string
    periodCharges: string
    periodCredits: string
    periodPayments: string
    periodRefunds: string
    closingBalance: string
    entries: Array<{
      id: string
      date: string
      type: string
      reference: string
      description: string
      charges: string
      credits: string
      balance: string
    }>
  }
  allowAttachments: boolean
  attachments: Array<{
    id: string
    name: string
    size: number
    mimeType: string
    invoiceNumber: string
    created: string
  }>
  paymentNotices: Array<{
    id: string
    date: string
    amount?: string
    reference?: string
    notes?: string
    created: string
  }>
  expires: string
}

export function ClientPortal({ owner, token, onClose }: ClientPortalProps) {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noticeModalOpen, setNoticeModalOpen] = useState(false)
  const [submittingNotice, setSubmittingNotice] = useState(false)
  const [noticeSuccess, setNoticeSuccess] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    async function fetchPortal() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`/api/public/portal/${encodeURIComponent(owner)}/${encodeURIComponent(token)}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Portal link unavailable' })) as { error?: string }
          throw new Error(errData.error || 'Portal link expired or invalid')
        }
        const json = await res.json() as PortalData
        setData(json)
        setNoticeForm(prev => ({
          ...prev,
          amount: json.totalBalanceDue,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load client portal')
      } finally {
        setLoading(false)
      }
    }
    fetchPortal()
  }, [owner, token])

  async function handleSubmitPaymentNotice(e: React.FormEvent) {
    e.preventDefault()
    if (!noticeForm.date) return
    setSubmittingNotice(true)
    setError('')
    try {
      const res = await fetch(`/api/public/portal/${encodeURIComponent(owner)}/${encodeURIComponent(token)}/notice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticeForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Could not submit notice' })) as { error?: string }
        throw new Error(err.error || 'Failed to submit notice')
      }
      setNoticeSuccess(true)
      setTimeout(() => {
        setNoticeModalOpen(false)
        setNoticeSuccess(false)
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment report')
    } finally {
      setSubmittingNotice(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading client account portal...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold">Portal Link Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {error || 'This client portal link has expired, been revoked, or is invalid.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Please contact the business owner to request a refreshed access link.
          </p>
          {onClose && (
            <Button variant="secondary" onClick={onClose} className="mt-4">
              Return to Workspace
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Navigation Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {data.business.logo ? (
              <img src={data.business.logo} alt={data.business.name} className="h-10 w-auto max-w-[120px] object-contain rounded" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center">
                {data.business.name.slice(0, 2).toUpperCase() || 'UI'}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{data.business.name || 'Client Portal'}</h1>
              <p className="text-xs text-muted-foreground">Client Account: {data.client.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => setNoticeModalOpen(true)}
              className="text-xs font-medium shadow-sm"
            >
              I Have Paid
            </Button>
            {onClose && (
              <Button variant="secondary" className="text-xs" onClick={onClose}>
                Exit Preview
              </Button>
            )}
          </div>
        </header>

        {/* Balance Due & Quick Payment Instructions Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Due</span>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {money(data.totalBalanceDue, data.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding balance across active invoices
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-muted-foreground">
              <span>Access expires:</span>
              <span className="font-mono text-foreground font-medium">{data.expires}</span>
            </div>
          </div>

          <div className="md:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Payment Details</h2>
            {data.business.bank ? (() => {
              const parsed = parseExistingBankString(data.business.bank)
              return (
                <div className="bg-[var(--soft)]/50 rounded-xl p-3.5 border border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <BankLogo bankId={parsed.bankId} bankName={parsed.bankName} size="xs" />
                      <span className="text-xs font-semibold text-foreground">
                        {parsed.bankName || 'Bank Transfer (BACS / Faster Payments)'}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Verified payee
                    </span>
                  </div>
                  <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {data.business.bank}
                  </div>
                </div>
              )
            })() : (
              <p className="text-xs text-muted-foreground">
                Please contact {data.business.email || data.business.name} for direct bank transfer instructions.
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Business inquiries:</span>
              <a href={`mailto:${data.business.email}`} className="text-primary hover:underline font-medium">
                {data.business.email}
              </a>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Invoices</h2>
              <p className="text-xs text-muted-foreground">View and download your official invoice documents</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--soft)] font-medium text-foreground">
              {data.invoices.length} {data.invoices.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>

          {data.invoices.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-xl bg-[var(--soft)]/20">
              <p className="text-xs text-muted-foreground">No invoices currently shared for this account.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
              {data.invoices.map(inv => {
                const isPaid = inv.status === 'paid'
                const isOverdue = inv.status === 'overdue'

                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--soft)]/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{inv.number}</span>
                        <Badge
                          className={
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : isOverdue
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>Issued: {inv.issueDate}</span>
                        <span>Due: {inv.dueDate}</span>
                        <span>Total: {money(inv.total, inv.currency)}</span>
                        {!isPaid && (
                          <span className="text-foreground font-medium">
                            Balance: {money(inv.balance, inv.currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/public/portal/${encodeURIComponent(owner)}/${encodeURIComponent(token)}/invoices/${encodeURIComponent(inv.id)}/pdf?download=true`}
                        download
                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--soft)] hover:bg-[var(--line)] text-foreground transition-colors border border-[var(--border)]"
                      >
                        Download PDF
                      </a>
                      {inv.hasBreakdown && (
                        <a
                          href={`/api/public/portal/${encodeURIComponent(owner)}/${encodeURIComponent(token)}/invoices/${encodeURIComponent(inv.id)}/pdf?breakdown=true&download=true`}
                          download
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--soft)] hover:bg-[var(--line)] text-foreground transition-colors border border-[var(--border)]"
                        >
                          Breakdown PDF
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Statement of Account Section (if enabled) */}
        {data.allowStatements && data.statementSummary && (
          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Statement of Account</h2>
                <p className="text-xs text-muted-foreground">
                  Summary for period: {data.statementSummary.startDate} to {data.statementSummary.endDate}
                </p>
              </div>

              <a
                href={`/api/public/portal/${encodeURIComponent(owner)}/${encodeURIComponent(token)}/statement/pdf?start=${encodeURIComponent(data.statementSummary.startDate)}&end=${encodeURIComponent(data.statementSummary.endDate)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--soft)] hover:bg-[var(--line)] text-foreground transition-colors border border-[var(--border)]"
              >
                Download Statement PDF
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--soft)]/30 p-4 rounded-xl border border-[var(--border)] text-xs">
              <div>
                <span className="text-muted-foreground">Opening Balance</span>
                <p className="font-bold text-sm text-foreground mt-0.5">
                  {money(data.statementSummary.openingBalance, data.currency)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Invoiced Charges</span>
                <p className="font-bold text-sm text-foreground mt-0.5">
                  {money(data.statementSummary.periodCharges, data.currency)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Payments Received</span>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {money(data.statementSummary.periodPayments, data.currency)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Closing Balance</span>
                <p className="font-bold text-sm text-foreground mt-0.5">
                  {money(data.statementSummary.closingBalance, data.currency)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Client-Visible Attachments Section */}
        {data.allowAttachments && data.attachments.length > 0 && (
          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Project Deliverables & Attachments</h2>
              <p className="text-xs text-muted-foreground">Authorized documents provided with your invoices</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.attachments.map(att => (
                <div
                  key={att.id}
                  className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--soft)]/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 overflow-hidden">
                    <p className="font-semibold text-foreground truncate">{att.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(att.size / 1024)} KB · Ref: {att.invoiceNumber}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--line)] text-foreground">
                    Attached
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Payment Notices / Confirmation Status */}
        {data.paymentNotices.length > 0 && (
          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Reported Payments Awaiting Confirmation</h2>
            <div className="space-y-2">
              {data.paymentNotices.map(notice => (
                <div
                  key={notice.id}
                  className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-medium text-foreground">
                      Payment of {notice.amount ? money(notice.amount, data.currency) : 'unspecified amount'}
                    </span>
                    <span className="text-muted-foreground ml-2">on {notice.date}</span>
                    {notice.reference && (
                      <span className="text-muted-foreground ml-2 font-mono">Ref: {notice.reference}</span>
                    )}
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    Awaiting Owner Review
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* "I Have Paid" Report Modal */}
      <AnimatePresence>
        {noticeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <h3 className="text-base font-bold text-foreground">Report Payment</h3>
                <button
                  type="button"
                  onClick={() => setNoticeModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              {noticeSuccess ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto text-lg font-bold">
                    ✓
                  </div>
                  <p className="text-sm font-bold text-foreground">Payment Report Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    Thank you. We have notified {data.business.name} to verify the payment.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitPaymentNotice} className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Let {data.business.name} know that you have sent a bank transfer so they can reconcile your account.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={noticeForm.date}
                      onChange={e => setNoticeForm({ ...noticeForm, date: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Amount Paid ({data.currency})
                    </label>
                    <input
                      type="text"
                      value={noticeForm.amount}
                      onChange={e => setNoticeForm({ ...noticeForm, amount: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
                      placeholder={data.totalBalanceDue}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Transfer Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={noticeForm.reference}
                      onChange={e => setNoticeForm({ ...noticeForm, reference: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
                      placeholder="e.g. Bank transfer ref or invoice number"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={noticeForm.notes}
                      onChange={e => setNoticeForm({ ...noticeForm, notes: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
                      placeholder="Any additional information..."
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setNoticeModalOpen(false)}
                      disabled={submittingNotice}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="text-xs"
                      disabled={submittingNotice}
                    >
                      {submittingNotice ? 'Submitting...' : 'Submit Report'}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
