import { useState, useMemo } from 'react'
import {
  type Workspace,
  type Message,
  type Invoice,
  type Command,
  type Envelope,
  money,
  totals,
} from '../../shared/domain'
import {
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
} from '../../shared/emailTemplate'
import { Button, Badge, Empty, Modal } from './ui'
import { NumberTicker } from './ui/NumberTicker'
import { ShinyText } from './ui/ShinyText'
import {
  Mail,
  Search,
  RefreshCw,
  ExternalLink,
  Send,
  Check,
  Copy,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from './ui/AnimatedIcon'

export function Emails({
  workspace: w,
  onSelectInvoice,
  onCommand,
  setNotice,
  demo = false,
}: {
  workspace: Workspace
  onSelectInvoice: (id: string) => void
  onCommand: (c: Command) => Promise<Envelope>
  setNotice: (msg: string) => void
  demo?: boolean
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('')
  const [page, setPage] = useState(0)
  const [activeMessage, setActiveMessage] = useState<Message | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // Map messages and enrich with invoice data
  const messages = useMemo(() => {
    return (w.messages || []).slice().sort((a, b) => {
      const timeA = new Date(a.created).getTime()
      const timeB = new Date(b.created).getTime()
      return timeB - timeA
    })
  }, [w.messages])

  // Overview metrics
  const metrics = useMemo(() => {
    const total = messages.length
    const delivered = messages.filter(m => m.status === 'delivered').length
    const sent = messages.filter(m => m.status === 'sent').length
    const queued = messages.filter(m => ['queued', 'sending'].includes(m.status)).length
    const issues = messages.filter(m => ['failed', 'bounced'].includes(m.status)).length
    const drafts = messages.filter(m => m.status === 'draft').length
    const attempted = total - drafts
    const deliveryRate = attempted > 0 ? Math.round(((delivered + sent) / attempted) * 100) : 100

    return { total, delivered, sent, queued, issues, drafts, deliveryRate }
  }, [messages])

  // Filtered messages
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return messages.filter(m => {
      const inv = (w.invoices || []).find(i => i.id === m.invoiceId)
      const clientName = inv?.client?.name || ''
      const invNumber = inv?.number || ''

      // Search match
      if (q) {
        const matchSubject = m.subject.toLowerCase().includes(q)
        const matchTo = m.to.toLowerCase().includes(q)
        const matchCc = (m.cc || []).some(c => c.toLowerCase().includes(q))
        const matchClient = clientName.toLowerCase().includes(q)
        const matchInv = invNumber.toLowerCase().includes(q)
        const matchProvider = (m.providerId || '').toLowerCase().includes(q)
        if (!matchSubject && !matchTo && !matchCc && !matchClient && !matchInv && !matchProvider) {
          return false
        }
      }

      // Status filter
      if (statusFilter === 'delivered' && m.status !== 'delivered') return false
      if (statusFilter === 'sent' && m.status !== 'sent') return false
      if (statusFilter === 'queued' && !['queued', 'sending'].includes(m.status)) return false
      if (statusFilter === 'issues' && !['failed', 'bounced'].includes(m.status)) return false
      if (statusFilter === 'draft' && m.status !== 'draft') return false
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'issues' &&
        statusFilter !== 'queued' &&
        m.status !== statusFilter
      ) {
        return false
      }

      // Kind filter
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false

      // Client filter
      if (clientFilter && inv?.clientId !== clientFilter) return false

      return true
    })
  }, [messages, query, statusFilter, kindFilter, clientFilter, w.invoices])

  const pageSize = 15
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize)

  // Handle Retry Send
  const handleRetry = async (m: Message) => {
    setRetryingId(m.id)
    try {
      await onCommand({ type: 'send', id: m.id })
      setNotice(`Email "${m.subject}" re-queued for delivery.`)
      if (activeMessage && activeMessage.id === m.id) {
        setActiveMessage({ ...activeMessage, status: 'queued', error: undefined })
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not retry delivery')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">Outbox & delivery history</p>
          <h1>Sent Emails & Activity</h1>
          <p className="muted">
            Inspect every invoice delivery, payment reminder and system email dispatched from your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {demo && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Demo mode: emails are recorded locally
            </span>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="metrics-five">
        <div
          className={`metric transition-all ${statusFilter === 'all' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter('all')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setStatusFilter('all')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">All Dispatches</p>
            {statusFilter === 'all' && <ShinyText className="text-[10px] uppercase font-bold">Active ×</ShinyText>}
          </div>
          <p className="metric-value">
            <NumberTicker value={metrics.total} />
          </p>
          <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
            <p className="fine-print">Total system emails created</p>
            <span className="text-[11px] font-medium">{metrics.total} total</span>
          </div>
        </div>

        <div
          className={`metric transition-all ${statusFilter === 'delivered' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Delivered</p>
            {statusFilter === 'delivered' && <ShinyText className="text-[10px] uppercase font-bold">Active ×</ShinyText>}
          </div>
          <p className="metric-value text-emerald-600 dark:text-emerald-400">
            <NumberTicker value={metrics.delivered} />
          </p>
          <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
            <p className="fine-print">Confirmed at recipient inbox</p>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{metrics.deliveryRate}% rate</span>
          </div>
        </div>

        <div
          className={`metric transition-all ${statusFilter === 'sent' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Sent to Mailbox</p>
            {statusFilter === 'sent' && <ShinyText className="text-[10px] uppercase font-bold">Active ×</ShinyText>}
          </div>
          <p className="metric-value text-blue-600 dark:text-blue-400">
            <NumberTicker value={metrics.sent} />
          </p>
          <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
            <p className="fine-print">Dispatched to mail provider</p>
            <span className="text-[11px] font-medium">{metrics.sent} in transit</span>
          </div>
        </div>

        <div
          className={`metric transition-all ${statusFilter === 'queued' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter(statusFilter === 'queued' ? 'all' : 'queued')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setStatusFilter(statusFilter === 'queued' ? 'all' : 'queued')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Queued / Sending</p>
            {statusFilter === 'queued' && <ShinyText className="text-[10px] uppercase font-bold">Active ×</ShinyText>}
          </div>
          <p className="metric-value text-amber-600 dark:text-amber-400">
            <NumberTicker value={metrics.queued} />
          </p>
          <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
            <p className="fine-print">Awaiting background execution</p>
            <span className="text-[11px] font-medium">{metrics.queued} queued</span>
          </div>
        </div>

        <div
          className={`metric transition-all ${statusFilter === 'issues' ? 'ring-2 ring-rose-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter(statusFilter === 'issues' ? 'all' : 'issues')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setStatusFilter(statusFilter === 'issues' ? 'all' : 'issues')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Delivery Issues</p>
            {statusFilter === 'issues' && <ShinyText className="text-[10px] uppercase font-bold text-rose-500">Active ×</ShinyText>}
          </div>
          <p className="metric-value text-rose-600 dark:text-rose-400">
            <NumberTicker value={metrics.issues} />
          </p>
          <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
            <p className="fine-print">Failed or bounced dispatches</p>
            <span className={`text-[11px] font-semibold ${metrics.issues > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
              {metrics.issues > 0 ? `${metrics.issues} need review` : 'All clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Outbox Table and Filtering Panel */}
      <section className="panel">
        <div className="list-toolbar">
          <div className="relative flex-1 max-w-md">
            <input
              className="search pl-8"
              aria-label="Search sent emails"
              placeholder="Search recipient, subject, invoice or client…"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setPage(0)
              }}
            />
          </div>

          <select
            aria-label="Filter by delivery status"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
          >
            <option value="all">All statuses</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued / Sending</option>
            <option value="issues">Issues (Failed / Bounced)</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
            <option value="draft">Draft</option>
          </select>

          <select
            aria-label="Filter by email type"
            value={kindFilter}
            onChange={e => {
              setKindFilter(e.target.value)
              setPage(0)
            }}
          >
            <option value="all">All email types</option>
            <option value="invoice">Invoice dispatches</option>
            <option value="reminder">Payment reminders</option>
          </select>

          {w.clients && w.clients.length > 0 && (
            <select
              aria-label="Filter by client"
              value={clientFilter}
              onChange={e => {
                setClientFilter(e.target.value)
                setPage(0)
              }}
            >
              <option value="">All clients</option>
              {w.clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {(query || statusFilter !== 'all' || kindFilter !== 'all' || clientFilter) && (
            <Button
              variant="ghost"
              className="text-xs h-9 px-2"
              onClick={() => {
                setQuery('')
                setStatusFilter('all')
                setKindFilter('all')
                setClientFilter('')
                setPage(0)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Results / Empty state */}
        {!filtered.length ? (
          <Empty
            title={messages.length ? 'No emails match your filter' : 'No emails sent yet'}
            detail={
              messages.length
                ? 'Try adjusting your search terms or clearing status filters.'
                : 'Emails are dispatched when you send an invoice or an automated payment reminder to a client.'
            }
            action={
              messages.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setStatusFilter('all')
                    setKindFilter('all')
                    setClientFilter('')
                  }}
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Recipient & Client</th>
                    <th>Subject</th>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Sent date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(m => {
                    const inv = (w.invoices || []).find(i => i.id === m.invoiceId)
                    const isIssue = ['failed', 'bounced'].includes(m.status)
                    const isQueued = ['queued', 'sending'].includes(m.status)

                    return (
                      <tr
                        key={m.id}
                        className={`transition cursor-pointer hover:bg-[var(--soft)] ${
                          activeMessage?.id === m.id ? 'bg-[var(--soft)]' : ''
                        }`}
                        onClick={() => setActiveMessage(m)}
                      >
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                m.status === 'delivered'
                                  ? 'bg-emerald-500'
                                  : m.status === 'sent'
                                  ? 'bg-blue-500'
                                  : isQueued
                                  ? 'bg-amber-500 animate-pulse'
                                  : isIssue
                                  ? 'bg-rose-500'
                                  : 'bg-zinc-400'
                              }`}
                            />
                            <Badge className={m.status}>{m.status}</Badge>
                          </div>
                          {m.error && !/^[a-f0-9-]{36}$/.test(m.error) && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block truncate max-w-[140px] mt-0.5" title={m.error}>
                              {m.error}
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="font-medium text-[var(--ink)]">{m.to}</div>
                          <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                            <span>{inv?.client?.name || 'Client'}</span>
                            {m.cc && m.cc.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--soft)] border border-[var(--line)]">
                                +{m.cc.length} CC
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="font-semibold text-[var(--ink)] truncate max-w-[260px]" title={m.subject}>
                            {m.subject}
                          </div>
                          <div className="text-xs text-[var(--muted)] truncate max-w-[260px]">
                            {m.body ? m.body.slice(0, 60).replace(/\n/g, ' ') + '…' : 'No preview text'}
                          </div>
                        </td>

                        <td>
                          {inv ? (
                            <div>
                              <button
                                type="button"
                                className="invoice-link text-xs font-semibold"
                                onClick={e => {
                                  e.stopPropagation()
                                  onSelectInvoice(inv.id)
                                }}
                                title="Open invoice in editor"
                              >
                                {inv.number || 'Draft'}
                              </button>
                              <div className="text-[11px] text-[var(--muted)]">
                                {money(totals(inv, w.creditNotes).total, inv.currency)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">Invoice #{m.invoiceId.slice(0, 8)}</span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                              m.kind === 'reminder'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            }`}
                          >
                            {m.kind === 'reminder' ? 'Reminder' : 'Invoice'}
                          </span>
                        </td>

                        <td>
                          <div className="text-xs text-[var(--ink)]">
                            {new Date(m.created).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-[var(--muted)]">
                            {new Date(m.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            {isIssue && (
                              <Button
                                variant="ghost"
                                className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                disabled={retryingId === m.id}
                                onClick={() => void handleRetry(m)}
                                title="Retry sending this email"
                              >
                                <RefreshCw size={11} animateOnHover className="mr-1 inline" />
                                {retryingId === m.id ? 'Retrying…' : 'Retry'}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              className="text-xs h-7 px-2.5"
                              onClick={() => setActiveMessage(m)}
                              title="Inspect full email content and headers"
                            >
                              <ExternalLink size={12} animateOnHover className="mr-1 inline" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span className="muted">
                {filtered.length} {filtered.length === 1 ? 'email' : 'emails'} found · Page {page + 1} of{' '}
                {Math.max(1, Math.ceil(filtered.length / pageSize))}
              </span>
              <div className="actions">
                <Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ArrowLeft size={12} animateOnHover className="mr-1 inline" />
                  Previous
                </Button>
                <Button disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage(p => p + 1)}>
                  Next
                  <ArrowRight size={12} animateOnHover className="ml-1 inline" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Email Detail Inspector Modal */}
      {activeMessage && (
        <EmailDetailModal
          message={activeMessage}
          workspace={w}
          onClose={() => setActiveMessage(null)}
          onSelectInvoice={onSelectInvoice}
          onRetry={handleRetry}
          isRetrying={retryingId === activeMessage.id}
        />
      )}
    </div>
  )
}

function EmailDetailModal({
  message: m,
  workspace: w,
  onClose,
  onSelectInvoice,
  onRetry,
  isRetrying,
}: {
  message: Message
  workspace: Workspace
  onClose: () => void
  onSelectInvoice: (id: string) => void
  onRetry: (m: Message) => Promise<void>
  isRetrying: boolean
}) {
  const [tab, setTab] = useState<'html' | 'text' | 'headers'>('html')
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [copiedText, setCopiedText] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const inv = (w.invoices || []).find(i => i.id === m.invoiceId)
  const activeBiz = inv?.business || w.business

  // Re-render HTML & Text representation
  const emailHtml = useMemo(() => {
    if (!inv) return `<div style="font-family:sans-serif;padding:30px;color:#27272a;"><h3>${m.subject}</h3><p style="white-space:pre-wrap;">${m.body}</p></div>`
    return renderInvoiceEmailHtml({
      invoice: inv,
      business: activeBiz,
      message: m,
      client: inv.client,
      creditNotes: w.creditNotes,
      publicUrl: inv.share ? `/api/public/demo/${inv.share.token}/invoice` : undefined,
    })
  }, [inv, activeBiz, m, w.creditNotes])

  const emailText = useMemo(() => {
    if (!inv) return m.body
    return renderInvoiceEmailText({
      invoice: inv,
      business: activeBiz,
      message: m,
      client: inv.client,
      creditNotes: w.creditNotes,
      publicUrl: inv.share ? `/api/public/demo/${inv.share.token}/invoice` : undefined,
    })
  }, [inv, activeBiz, m, w.creditNotes])

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(emailText)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    } catch {
      // Ignore clipboard fallback
    }
  }

  const handleCopyProviderId = async () => {
    if (!m.providerId) return
    try {
      await navigator.clipboard.writeText(m.providerId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {
      // Ignore fallback
    }
  }

  const isIssue = ['failed', 'bounced'].includes(m.status)

  return (
    <Modal
      open
      onClose={onClose}
      title={m.subject}
      description={`Sent to ${m.to} · Dispatched on ${new Date(m.created).toLocaleString()}`}
    >
      <div className="space-y-4 max-w-2xl">
        {/* Envelope Meta Strip */}
        <div className="p-3.5 bg-[var(--soft)] rounded-xl border border-[var(--line)] space-y-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-[var(--muted)] font-medium block">From:</span>
              <span className="font-medium text-[var(--ink)]">
                "{activeBiz.name} via InvoiceUI" &lt;billing@humza.website&gt;
              </span>
            </div>
            <div>
              <span className="text-[var(--muted)] font-medium block">Recipient (To):</span>
              <span className="font-semibold text-[var(--ink)]">{m.to}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[var(--line)]">
            <div>
              <span className="text-[var(--muted)] font-medium block">Reply-To:</span>
              <span className="text-[var(--ink)]">{m.replyTo || activeBiz.email || 'None specified'}</span>
            </div>
            {m.cc && m.cc.length > 0 && (
              <div>
                <span className="text-[var(--muted)] font-medium block">CC Recipients:</span>
                <span className="text-[var(--ink)]">{m.cc.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-[var(--muted)] font-medium block">Provider Reference ID:</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span>{m.providerId || 'None (Local / pending)'}</span>
                {m.providerId && (
                  <button
                    type="button"
                    onClick={handleCopyProviderId}
                    className="opacity-70 hover:opacity-100 p-0.5"
                    title="Copy provider message ID"
                  >
                    {copiedId ? <Check size={11} animateOnHover /> : <Copy size={11} animateOnHover />}
                  </button>
                )}
              </div>
            </div>
            {inv && (
              <div>
                <span className="text-[var(--muted)] font-medium block">Associated Document:</span>
                <button
                  type="button"
                  className="invoice-link text-xs font-semibold"
                  onClick={() => {
                    onClose()
                    onSelectInvoice(inv.id)
                  }}
                >
                  {inv.number || 'Draft invoice'} ({money(totals(inv, w.creditNotes).total, inv.currency)}) →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Callout Banner */}
        {isIssue && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
            <div>
              <strong className="block">Delivery status: {m.status.toUpperCase()}</strong>
              <span>{m.error && !/^[a-f0-9-]{36}$/.test(m.error) ? m.error : 'The destination mail server rejected transmission.'}</span>
            </div>
            <Button
              variant="secondary"
              className="text-xs h-7 px-3 shrink-0"
              disabled={isRetrying}
              onClick={() => void onRetry(m)}
            >
              <RefreshCw size={11} animateOnHover className="mr-1 inline" />
              {isRetrying ? 'Retrying…' : 'Retry sending'}
            </Button>
          </div>
        )}

        {m.status === 'delivered' && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <Check size={14} animateOnHover className="text-emerald-600 dark:text-emerald-400" />
            <span>Delivered: Mail server acknowledged receipt and confirmed inbox delivery.</span>
          </div>
        )}

        {m.status === 'sent' && (
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Send size={14} animateOnHover className="text-blue-600 dark:text-blue-400" />
            <span>Sent: Dispatched through verified Resend SMTP relay and awaiting destination webhook.</span>
          </div>
        )}

        {['queued', 'sending'].includes(m.status) && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>In flight: This message is currently queued for delivery.</span>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
          <div className="flex gap-1.5 p-1 bg-[var(--soft)] rounded-xl">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === 'html'
                  ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setTab('html')}
            >
              <Sparkles size={11} animateOnHover className="mr-1 inline" />
              Spectacular HTML
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === 'text'
                  ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setTab('text')}
            >
              Plain text
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === 'headers'
                  ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setTab('headers')}
            >
              Anti-spam diagnostics
            </button>
          </div>

          {tab === 'html' && (
            <div className="flex bg-[var(--soft)] p-1 rounded-lg text-[11px]">
              <button
                type="button"
                className={`px-2 py-0.5 rounded font-medium transition ${
                  viewport === 'desktop'
                    ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => setViewport('desktop')}
              >
                Desktop (620px)
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 rounded font-medium transition ${
                  viewport === 'mobile'
                    ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => setViewport('mobile')}
              >
                Mobile (375px)
              </button>
            </div>
          )}

          {tab === 'text' && (
            <Button variant="secondary" className="text-xs h-7 px-2.5" onClick={handleCopyText}>
              {copiedText ? (
                <>
                  <Check size={12} animateOnHover className="mr-1 inline" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} animateOnHover className="mr-1 inline" />
                  Copy text
                </>
              )}
            </Button>
          )}
        </div>

        {/* Tab 1: Spectacular HTML Live Preview */}
        {tab === 'html' && (
          <div className="flex justify-center bg-zinc-100 dark:bg-zinc-950 p-3 rounded-2xl border border-[var(--border)] overflow-hidden">
            <div
              className="transition-all duration-300 shadow-md rounded-xl overflow-hidden bg-white"
              style={{ width: viewport === 'desktop' ? '100%' : '375px', maxWidth: '620px' }}
            >
              <iframe
                title="Sent Email HTML Preview"
                srcDoc={emailHtml}
                className="w-full h-[460px] border-0 block bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Plain Text Alternative */}
        {tab === 'text' && (
          <div className="p-4 bg-[var(--soft)] rounded-xl border border-[var(--line)] font-mono text-xs whitespace-pre-wrap max-h-[460px] overflow-y-auto leading-relaxed text-[var(--ink)]">
            {emailText}
          </div>
        )}

        {/* Tab 3: Anti-Spam & Deliverability Diagnostics */}
        {tab === 'headers' && (
          <div className="space-y-3 text-xs max-h-[460px] overflow-y-auto p-1">
            <div className="p-3 bg-[var(--soft)] rounded-xl border border-[var(--line)] space-y-2">
              <h4 className="font-semibold text-sm text-[var(--ink)]">RFC & Mail Server Headers Injected</h4>
              <p className="text-[var(--muted)] text-xs">
                These headers were transmitted with the email to prevent vacation loops, satisfy SpamAssassin rules and comply with Google and Yahoo 2024 standards:
              </p>
              <div className="font-mono text-[11px] p-2.5 bg-[var(--card)] rounded-lg border border-[var(--line)] space-y-1 text-[var(--ink)]">
                <div>Auto-Submitted: auto-generated</div>
                <div>X-Auto-Response-Suppress: OOF, AutoReply</div>
                <div>X-Entity-Ref-ID: invoiceui/{w.business.name.toLowerCase().replace(/[^a-z0-9]/g, '')}/{m.id}</div>
                {m.kind === 'reminder' && (
                  <>
                    <div>List-Unsubscribe: &lt;mailto:{activeBiz.email || 'billing@humza.website'}?subject=Unsubscribe%20Reminders&gt;</div>
                    <div>List-Unsubscribe-Post: List-Unsubscribe=One-Click</div>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 bg-[var(--soft)] rounded-xl border border-[var(--line)] space-y-2">
              <h4 className="font-semibold text-sm text-[var(--ink)]">Anti-Spam Verification Checklist</h4>
              <ul className="space-y-1 text-[var(--muted)] list-disc pl-4">
                <li><strong>Invisible Preheader</strong>: Prevents inbox preview text leakage in Gmail and Apple Mail.</li>
                <li><strong>CAN-SPAM Address</strong>: Registered postal address included in both HTML and text payloads.</li>
                <li><strong>Multipart Parity</strong>: Plain-text payload provides full matching invoice breakdown.</li>
                <li><strong>SPF & DKIM Signing</strong>: Authenticated against your verified sending domain in Resend.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--line)]">
          <div className="text-xs text-[var(--muted)]">
            Status: <Badge className={m.status}>{m.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {inv && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose()
                  onSelectInvoice(inv.id)
                }}
              >
                Open invoice in editor
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
