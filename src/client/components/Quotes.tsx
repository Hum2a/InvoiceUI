import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  quoteTotals,
  quoteStatus,
  newQuote,
  blankClient,
  money,
  today,
  addDays,
  COMMON_COUNTRIES,
  getCountryFieldLabels,
  formatClientAddress,
  type Workspace,
  type Quote,
  type Command,
  type Envelope,
  type Client,
  type Line,
  type Business,
} from '../../shared/domain'
import { Button, StateButton, Field, Modal, Badge, Empty, useConfirm } from './ui'
import { NumberTicker } from './ui/NumberTicker'
import { ShinyText } from './ui/ShinyText'
import { downloadBlob } from '../workspace'

export interface QuotesProps {
  workspace: Workspace
  onCommand: (c: Command) => Promise<Envelope>
  onSelectInvoice: (id: string) => void
  setNotice: (msg: string) => void
  demo?: boolean
}

type FilterStatus = 'all' | 'draft' | 'sent' | 'accepted' | 'converted' | 'expired' | 'declined'

export function Quotes({
  workspace: w,
  onCommand,
  onSelectInvoice,
  setNotice,
}: QuotesProps) {
  const { confirm } = useConfirm()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [acceptanceModalQuote, setAcceptanceModalQuote] = useState<Quote | null>(null)
  const [acceptanceDate, setAcceptanceDate] = useState(today(w.business.timezone))
  const [acceptanceMethod, setAcceptanceMethod] = useState<'email' | 'in_person' | 'verbal' | 'signed_document' | 'other'>('email')
  const [acceptanceReference, setAcceptanceReference] = useState('')
  const [acceptanceNotes, setAcceptanceNotes] = useState('')
  const [declineModalQuote, setDeclineModalQuote] = useState<Quote | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [reviseModalQuote, setReviseModalQuote] = useState<Quote | null>(null)
  const [expandedQuoteNumbers, setExpandedQuoteNumbers] = useState<Set<string>>(new Set())
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Composer form state
  const [formClientId, setFormClientId] = useState('')
  const [formClient, setFormClient] = useState<Client>(blankClient())
  const [formIssueDate, setFormIssueDate] = useState(today(w.business.timezone))
  const [formExpiryDate, setFormExpiryDate] = useState(addDays(today(w.business.timezone), 30))
  const [formCurrency, setFormCurrency] = useState(w.business.currency)
  const [formLines, setFormLines] = useState<Line[]>([
    { id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' },
  ])
  const [formTax, setFormTax] = useState('0')
  const [formDiscount, setFormDiscount] = useState('0')
  const [formDiscountType, setFormDiscountType] = useState<'amount' | 'percent'>('amount')
  const [formScope, setFormScope] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formError, setFormError] = useState('')

  const quotes = w.quotes || []
  const day = today(w.business.timezone)

  // Group quotes by quoteNumber to display revision trees
  const groupedQuotes = useMemo(() => {
    const map = new Map<string, Quote[]>()
    for (const q of quotes) {
      const list = map.get(q.quoteNumber) || []
      list.push(q)
      map.set(q.quoteNumber, list)
    }
    // Sort revisions within each group descending (highest revision first)
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => b.revision - a.revision)
      map.set(key, list)
    }
    return map
  }, [quotes])

  // Filtered quote groups
  const filteredGroups = useMemo(() => {
    const results: Array<{ quoteNumber: string; latest: Quote; revisions: Quote[] }> = []
    const qLower = query.trim().toLowerCase()

    for (const [quoteNumber, revisions] of groupedQuotes.entries()) {
      const latest = revisions[0]
      const st = latest.convertedInvoiceId ? 'converted' : quoteStatus(latest, day)

      // Filter by status
      if (filter !== 'all') {
        if (filter === 'converted') {
          if (!latest.convertedInvoiceId) continue
        } else if (filter === 'draft') {
          if (latest.status !== 'draft' || latest.convertedInvoiceId) continue
        } else if (filter === 'sent') {
          if (latest.status !== 'sent' || latest.convertedInvoiceId) continue
        } else if (filter === 'accepted') {
          if (latest.status !== 'accepted') continue
        } else if (filter === 'expired') {
          if (st !== 'expired' || latest.convertedInvoiceId) continue
        } else if (filter === 'declined') {
          if (latest.status !== 'declined') continue
        }
      }

      // Filter by search query
      if (qLower) {
        const matchesQuery =
          quoteNumber.toLowerCase().includes(qLower) ||
          latest.client.name.toLowerCase().includes(qLower) ||
          (latest.scope || '').toLowerCase().includes(qLower) ||
          (latest.notes || '').toLowerCase().includes(qLower) ||
          revisions.some(r => r.lines.some(l => l.description.toLowerCase().includes(qLower)))
        if (!matchesQuery) continue
      }

      results.push({ quoteNumber, latest, revisions })
    }

    // Sort by latest quote updated date descending
    return results.sort((a, b) => b.latest.updated.localeCompare(a.latest.updated))
  }, [groupedQuotes, filter, query, day])

  // Financial overview metrics
  const metrics = useMemo(() => {
    let openCount = 0
    let openTotal = 0
    let acceptedCount = 0
    let acceptedTotal = 0
    let convertedCount = 0
    let convertedTotal = 0

    for (const [, revisions] of groupedQuotes.entries()) {
      const latest = revisions[0]
      const t = quoteTotals(latest)
      const numTotal = Number(t.total) || 0
      const st = quoteStatus(latest, day)

      if (latest.convertedInvoiceId) {
        convertedCount += 1
        convertedTotal += numTotal
      } else if (st === 'accepted') {
        acceptedCount += 1
        acceptedTotal += numTotal
      } else if (st === 'draft' || st === 'sent') {
        openCount += 1
        openTotal += numTotal
      }
    }

    return {
      openCount,
      openTotal,
      acceptedCount,
      acceptedTotal,
      convertedCount,
      convertedTotal,
    }
  }, [groupedQuotes, day])

  const openComposer = (quoteToEdit?: Quote) => {
    setFormError('')
    if (quoteToEdit) {
      setEditingQuote(quoteToEdit)
      setFormClientId(quoteToEdit.clientId)
      setFormClient(structuredClone(quoteToEdit.client))
      setFormIssueDate(quoteToEdit.issueDate)
      setFormExpiryDate(quoteToEdit.expiryDate)
      setFormCurrency(quoteToEdit.currency)
      setFormLines(structuredClone(quoteToEdit.lines))
      setFormTax(quoteToEdit.tax)
      setFormDiscount(quoteToEdit.discount)
      setFormDiscountType(quoteToEdit.discountType)
      setFormScope(quoteToEdit.scope || '')
      setFormNotes(quoteToEdit.notes || '')
    } else {
      const template = newQuote(w)
      setEditingQuote(null)
      setFormClientId('')
      setFormClient(blankClient())
      setFormIssueDate(template.issueDate)
      setFormExpiryDate(template.expiryDate)
      setFormCurrency(template.currency)
      setFormLines([{ id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' }])
      setFormTax(template.tax)
      setFormDiscount(template.discount)
      setFormDiscountType(template.discountType)
      setFormScope(template.scope || '')
      setFormNotes(template.notes || '')
    }
    setComposerOpen(true)
  }

  const handleSelectClient = (clientId: string) => {
    setFormClientId(clientId)
    const existing = w.clients.find(c => c.id === clientId)
    if (existing) {
      setFormClient(structuredClone(existing))
      if (existing.currency) setFormCurrency(existing.currency)
    }
  }

  const handleSaveQuote = async () => {
    if (!formClient.name.trim()) {
      setFormError('Client name is required')
      return
    }
    if (formLines.length === 0 || formLines.some(l => !l.description.trim() || Number(l.quantity) <= 0)) {
      setFormError('Each line item requires a valid description and positive quantity')
      return
    }
    if (formExpiryDate < formIssueDate) {
      setFormError('Expiry date cannot precede quote issue date')
      return
    }

    setLoadingAction('save')
    try {
      if (editingQuote) {
        await onCommand({
          type: 'updateQuote',
          value: {
            id: editingQuote.id,
            clientId: formClientId,
            client: formClient,
            issueDate: formIssueDate,
            expiryDate: formExpiryDate,
            currency: formCurrency,
            lines: formLines,
            tax: formTax,
            discount: formDiscount,
            discountType: formDiscountType,
            scope: formScope,
            notes: formNotes,
            template: editingQuote.template,
            accent: editingQuote.accent,
          },
        })
        setNotice(`Quote ${editingQuote.quoteNumber} (Rev ${editingQuote.revision}) updated.`)
      } else {
        const freshId = crypto.randomUUID()
        await onCommand({
          type: 'createQuote',
          value: {
            id: freshId,
            clientId: formClientId,
            client: formClient,
            issueDate: formIssueDate,
            expiryDate: formExpiryDate,
            currency: formCurrency,
            lines: formLines,
            tax: formTax,
            discount: formDiscount,
            discountType: formDiscountType,
            scope: formScope,
            notes: formNotes,
            template: w.business.template,
            accent: w.business.accent,
          },
        })
        setNotice('New quote draft created.')
      }
      setLoadingAction('saved')
      await new Promise(r => setTimeout(r, 600))
      setComposerOpen(false)
      setEditingQuote(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save quote')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSendQuote = async (q: Quote) => {
    setLoadingAction(`send-${q.id}`)
    try {
      await onCommand({ type: 'sendQuote', id: q.id })
      setNotice(`Quote ${q.quoteNumber} marked as sent.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not send quote')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReviseQuote = async () => {
    if (!reviseModalQuote) return
    setLoadingAction(`revise-${reviseModalQuote.id}`)
    try {
      const newRevId = crypto.randomUUID()
      await onCommand({
        type: 'reviseQuote',
        id: reviseModalQuote.id,
        newId: newRevId,
      })
      setNotice(`Created revision ${reviseModalQuote.revision + 1} of quote ${reviseModalQuote.quoteNumber}. Previous revision preserved as superseded.`)
      setReviseModalQuote(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not revise quote')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRecordAcceptance = async () => {
    if (!acceptanceModalQuote) return
    setLoadingAction(`accept-${acceptanceModalQuote.id}`)
    try {
      await onCommand({
        type: 'acceptQuote',
        id: acceptanceModalQuote.id,
        acceptance: {
          date: acceptanceDate,
          method: acceptanceMethod,
          reference: acceptanceReference.trim() || undefined,
          notes: acceptanceNotes.trim() || undefined,
          recordedAt: new Date().toISOString(),
        },
      })
      setNotice(`Acceptance recorded for ${acceptanceModalQuote.quoteNumber} (Rev ${acceptanceModalQuote.revision}).`)
      setAcceptanceModalQuote(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not record acceptance')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeclineQuote = async () => {
    if (!declineModalQuote) return
    setLoadingAction(`decline-${declineModalQuote.id}`)
    try {
      await onCommand({
        type: 'declineQuote',
        id: declineModalQuote.id,
        reason: declineReason.trim() || 'Client declined without specifying a reason',
      })
      setNotice(`Quote ${declineModalQuote.quoteNumber} marked as declined.`)
      setDeclineModalQuote(null)
      setDeclineReason('')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not decline quote')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleConvertToInvoice = async (q: Quote) => {
    setLoadingAction(`convert-${q.id}`)
    try {
      const updatedEnvelope = await onCommand({
        type: 'convertQuoteToInvoice',
        id: q.id,
      })
      const convertedQuote = (updatedEnvelope.data.quotes || []).find(item => item.id === q.id)
      const targetInvoiceId = convertedQuote?.convertedInvoiceId || updatedEnvelope.data.invoices.find(inv => inv.convertedFromQuoteId === q.id)?.id

      setNotice(`Quote ${q.quoteNumber} successfully converted to an unissued draft invoice.`)
      if (targetInvoiceId) {
        onSelectInvoice(targetInvoiceId)
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not convert quote to invoice')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeleteQuote = async (q: Quote) => {
    const ok = await confirm({
      title: 'Delete quote?',
      description: `Delete quote ${q.quoteNumber} (Rev ${q.revision})? This will permanently remove this quotation.`,
      confirmText: 'Delete quote',
      confirmVariant: 'danger',
    })
    if (!ok) return
    setLoadingAction(`delete-${q.id}`)
    try {
      await onCommand({ type: 'deleteQuote', id: q.id })
      setNotice(`Quote ${q.quoteNumber} deleted.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not delete quote')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDownloadPDF = async (q: Quote) => {
    setDownloadingId(q.id)
    try {
      const { renderQuotePDF, filenameQuote } = await import('../../shared/pdf')
      const font = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer())
      const pdfBytes = await renderQuotePDF(q, w.business, font)
      downloadBlob(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), filenameQuote(q))
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'PDF generation failed')
    } finally {
      setDownloadingId(null)
    }
  }

  const toggleGroupExpansion = (num: string) => {
    setExpandedQuoteNumbers(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  // Calculate live preview totals for composer
  const composerTotals = useMemo(() => {
    return quoteTotals({
      lines: formLines,
      currency: formCurrency,
      tax: formTax,
      discount: formDiscount,
      discountType: formDiscountType,
    })
  }, [formLines, formCurrency, formTax, formDiscount, formDiscountType])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">Quotes & Estimates</p>
          <h1>Agreements made clear.</h1>
          <p className="muted">
            Draft versioned estimates, record client acceptance, and safely convert accepted revisions to unissued invoices.
          </p>
        </div>
        <div className="actions">
          <Button variant="primary" onClick={() => openComposer()}>
            + New quote
          </Button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="metrics">
        <div
          className={`metric transition-all ${filter === 'draft' || filter === 'sent' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setFilter(filter === 'draft' ? 'all' : 'draft')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilter(filter === 'draft' ? 'all' : 'draft')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Open / Under Review</p>
            {(filter === 'draft' || filter === 'sent') && (
              <ShinyText className="text-[10px] uppercase font-bold">Active filter x</ShinyText>
            )}
          </div>
          <p className="metric-value">
            <NumberTicker value={metrics.openTotal} currency={w.business.currency} />
          </p>
          <p className="fine-print">{metrics.openCount} quotes in draft or awaiting response</p>
        </div>

        <div
          className={`metric transition-all ${filter === 'accepted' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setFilter(filter === 'accepted' ? 'all' : 'accepted')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilter(filter === 'accepted' ? 'all' : 'accepted')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Accepted (Ready to Bill)</p>
            {filter === 'accepted' && (
              <ShinyText className="text-[10px] uppercase font-bold">Active filter x</ShinyText>
            )}
          </div>
          <p className="metric-value">
            <NumberTicker value={metrics.acceptedTotal} currency={w.business.currency} />
          </p>
          <p className="fine-print">{metrics.acceptedCount} quotes accepted with proof</p>
        </div>

        <div
          className={`metric transition-all ${filter === 'converted' ? 'ring-2 ring-lime-500 bg-[var(--soft)]' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => setFilter(filter === 'converted' ? 'all' : 'converted')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilter(filter === 'converted' ? 'all' : 'converted')}
        >
          <div className="flex justify-between items-center">
            <p className="eyebrow">Converted to Invoices</p>
            {filter === 'converted' && (
              <ShinyText className="text-[10px] uppercase font-bold">Active filter x</ShinyText>
            )}
          </div>
          <p className="metric-value">
            <NumberTicker value={metrics.convertedTotal} currency={w.business.currency} />
          </p>
          <p className="fine-print">{metrics.convertedCount} quotes linked to draft invoices</p>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <section className="panel">
        <div className="list-toolbar">
          <input
            className="search"
            aria-label="Search quotes"
            placeholder="Search by quote number, client, scope or notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select
            aria-label="Filter quote status"
            value={filter}
            onChange={e => setFilter(e.target.value as FilterStatus)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft only</option>
            <option value="sent">Sent only</option>
            <option value="accepted">Accepted (unconverted)</option>
            <option value="converted">Converted to invoice</option>
            <option value="expired">Expired</option>
            <option value="declined">Declined</option>
          </select>
          {filter !== 'all' && (
            <Button variant="ghost" onClick={() => setFilter('all')}>
              Clear filter
            </Button>
          )}
        </div>

        {filteredGroups.length === 0 ? (
          <Empty
            title={quotes.length ? 'No matching quotes found' : 'No quotes or estimates created yet'}
            detail={
              quotes.length
                ? 'Try adjusting your search terms or filter selection.'
                : 'Create your first versioned estimate. Quotes keep their own sequence and can be converted into unissued invoices upon acceptance.'
            }
            action={
              <Button variant="primary" onClick={() => openComposer()}>
                + Create first quote
              </Button>
            }
          />
        ) : (
          <div className="space-y-4 mt-4">
            {filteredGroups.map(({ quoteNumber, latest, revisions }) => {
              const latestTotals = quoteTotals(latest)
              const latestStatus = latest.convertedInvoiceId ? 'converted' : quoteStatus(latest, day)
              const hasMultipleRevisions = revisions.length > 1
              const isExpanded = expandedQuoteNumbers.has(quoteNumber)

              return (
                <div
                  key={quoteNumber}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-all shadow-xs hover:border-[var(--accent)]"
                >
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-base">{latest.quoteNumber}</span>
                        <Badge className="bg-[var(--soft)] text-[var(--ink)]">
                          Rev {latest.revision}
                        </Badge>
                        {latest.convertedInvoiceId ? (
                          <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            Converted to invoice
                          </Badge>
                        ) : (
                          <Badge>{latestStatus}</Badge>
                        )}
                        {hasMultipleRevisions && (
                          <button
                            type="button"
                            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline ml-1 cursor-pointer"
                            onClick={() => toggleGroupExpansion(quoteNumber)}
                          >
                            {revisions.length} revisions {isExpanded ? '▲ hide' : '▼ show history'}
                          </button>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mt-1">{latest.client.name || 'Untitled Client'}</h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Issued: {latest.issueDate} · Valid until: {latest.expiryDate}{' '}
                        {latestStatus === 'expired' && !latest.convertedInvoiceId && (
                          <span className="text-rose-600 font-medium">(Expired)</span>
                        )}
                      </p>
                      {latest.scope && (
                        <p className="text-sm text-[var(--ink)] mt-2 line-clamp-2 max-w-2xl bg-[var(--soft)] p-2.5 rounded-lg border border-[var(--line)]">
                          <span className="font-medium text-xs text-[var(--muted)] block mb-0.5">Scope summary:</span>
                          {latest.scope}
                        </p>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-2xl font-bold tracking-tight">
                        {money(latestTotals.total, latest.currency)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {latest.lines.length} {latest.lines.length === 1 ? 'item' : 'items'} · Tax {latest.tax}%
                      </p>
                    </div>
                  </div>

                  {/* Acceptance Details Banner */}
                  {latest.status === 'accepted' && latest.acceptance && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span>
                          <strong>Accepted:</strong> {latest.acceptance.date} via{' '}
                          {latest.acceptance.method.replace('_', ' ')}
                          {latest.acceptance.reference ? ` (Ref: ${latest.acceptance.reference})` : ''}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Recorded {latest.acceptance.recordedAt.slice(0, 10)}
                        </span>
                      </div>
                      {latest.acceptance.notes && (
                        <p className="mt-1 text-emerald-700 dark:text-emerald-400">
                          Notes: {latest.acceptance.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Declined Banner */}
                  {latest.status === 'declined' && (
                    <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300">
                      <strong>Declined:</strong> {latest.declinedReason || 'No reason specified'}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-[var(--line)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="secondary"
                        onClick={() => void handleDownloadPDF(latest)}
                        disabled={downloadingId === latest.id}
                      >
                        {downloadingId === latest.id ? 'Generating...' : '↓ Download PDF'}
                      </Button>

                      {latest.status === 'draft' && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => openComposer(latest)}
                          >
                            Edit draft
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => void handleSendQuote(latest)}
                            disabled={loadingAction === `send-${latest.id}`}
                          >
                            Mark sent ↗
                          </Button>
                        </>
                      )}

                      {(latest.status === 'sent' || latest.status === 'draft' || latestStatus === 'expired') && (
                        <Button
                          variant="secondary"
                          className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          onClick={() => {
                            setAcceptanceModalQuote(latest)
                            setAcceptanceDate(today(w.business.timezone))
                            setAcceptanceMethod('email')
                            setAcceptanceReference('')
                            setAcceptanceNotes('')
                          }}
                        >
                          Record acceptance
                        </Button>
                      )}

                      {latest.status === 'accepted' && !latest.convertedInvoiceId && (
                        <Button
                          variant="primary"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => void handleConvertToInvoice(latest)}
                          disabled={loadingAction === `convert-${latest.id}`}
                        >
                          Convert to draft invoice →
                        </Button>
                      )}

                      {latest.convertedInvoiceId && (
                        <Button
                          variant="secondary"
                          className="border-blue-500/40 text-blue-700 dark:text-blue-300"
                          onClick={() => onSelectInvoice(latest.convertedInvoiceId!)}
                        >
                          View draft invoice ↗
                        </Button>
                      )}

                      {(latest.status === 'sent' || latest.status === 'expired' || latest.status === 'declined') && (
                        <Button
                          variant="secondary"
                          onClick={() => setReviseModalQuote(latest)}
                        >
                          Revise quote (Rev {latest.revision + 1})
                        </Button>
                      )}

                      {(latest.status === 'sent' || latest.status === 'draft') && (
                        <Button
                          variant="ghost"
                          className="text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => {
                            setDeclineModalQuote(latest)
                            setDeclineReason('')
                          }}
                        >
                          Decline
                        </Button>
                      )}
                    </div>

                    {!latest.convertedInvoiceId && (
                      <Button
                        variant="ghost"
                        className="text-xs text-rose-600"
                        onClick={() => void handleDeleteQuote(latest)}
                        disabled={loadingAction === `delete-${latest.id}`}
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  {/* Expandable Revisions Tree */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-[var(--line)] space-y-3"
                      >
                        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                          Revision history for {quoteNumber}
                        </p>
                        <div className="table-scroll">
                          <table className="dashboard-table text-xs">
                            <thead>
                              <tr>
                                <th>Revision</th>
                                <th>Status</th>
                                <th>Issued</th>
                                <th>Total</th>
                                <th>Superseded</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revisions.map(rev => {
                                const revTotals = quoteTotals(rev)
                                return (
                                  <tr key={rev.id} className={rev.id === latest.id ? 'bg-[var(--soft)] font-medium' : ''}>
                                    <td>
                                      Rev {rev.revision} {rev.id === latest.id && '(Current)'}
                                    </td>
                                    <td>
                                      <Badge>{rev.convertedInvoiceId ? 'converted' : rev.status}</Badge>
                                    </td>
                                    <td>{rev.issueDate}</td>
                                    <td>{money(revTotals.total, rev.currency)}</td>
                                    <td>{rev.supersededAt ? rev.supersededAt.slice(0, 10) : '-'}</td>
                                    <td>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          className="text-xs py-0 h-6 px-2"
                                          onClick={() => void handleDownloadPDF(rev)}
                                        >
                                          Download PDF
                                        </Button>
                                        {!rev.convertedInvoiceId && (
                                          <Button
                                            variant="ghost"
                                            className="text-xs py-0 h-6 px-2 text-rose-600 hover:text-rose-700"
                                            onClick={() => void handleDeleteQuote(rev)}
                                            disabled={loadingAction === `delete-${rev.id}`}
                                          >
                                            Delete
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Quote Composer Modal */}
      {composerOpen && (
        <Modal
          open={composerOpen}
          onClose={() => {
            setComposerOpen(false)
            setEditingQuote(null)
          }}
          title={editingQuote ? `Edit Quote ${editingQuote.quoteNumber} (Rev ${editingQuote.revision})` : 'New Quote / Estimate'}
          description="Estimates use a distinct numbering sequence and can be converted into an unissued invoice upon acceptance."
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="form-grid two">
              <Field label="Client selector">
                <select
                  value={formClientId}
                  onChange={e => handleSelectClient(e.target.value)}
                >
                  <option value="">Choose saved client or type below...</option>
                  {w.clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Client name *">
                <input
                  value={formClient.name}
                  onChange={e => setFormClient({ ...formClient, name: e.target.value })}
                  placeholder="e.g. Acme Innovations Ltd"
                  required
                />
              </Field>

              {(() => {
                const countryLabels = getCountryFieldLabels(formClient.country)
                const updateClientField = (field: keyof Client, val: string) => {
                  const updatedClient = { ...formClient, [field]: val }
                  const formattedAddress = formatClientAddress(updatedClient)
                  setFormClient({ ...updatedClient, address: formattedAddress })
                }
                return (
                  <>
                    <div className="form-grid">
                      <Field label="Primary contact (optional)" hint="Person or department to address">
                        <input
                          value={formClient.contact || ''}
                          onChange={e => setFormClient({ ...formClient, contact: e.target.value })}
                          placeholder="e.g. Sarah Jenkins"
                        />
                      </Field>
                      <Field label="Phone number (optional)">
                        <input
                          type="tel"
                          value={formClient.phone || ''}
                          onChange={e => setFormClient({ ...formClient, phone: e.target.value })}
                          placeholder={countryLabels.phonePlaceholder}
                        />
                      </Field>
                    </div>

                    <Field label="Client email">
                      <input
                        type="email"
                        value={formClient.email}
                        onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                        placeholder="accounts@example.com"
                      />
                    </Field>

                    <Field label="Country" hint="Adapts address format and tax identifier labels">
                      <input
                        list="quote-client-countries"
                        value={formClient.country || ''}
                        onChange={e => {
                          const nextCountry = e.target.value
                          const updatedClient = { ...formClient, country: nextCountry }
                          const formattedAddress = formatClientAddress(updatedClient)
                          setFormClient({ ...updatedClient, address: formattedAddress })
                        }}
                        placeholder="e.g. United Kingdom"
                      />
                      <datalist id="quote-client-countries">
                        {COMMON_COUNTRIES.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </Field>

                    <Field label="Address line 1">
                      <input
                        value={formClient.addressLine1 || ''}
                        onChange={e => updateClientField('addressLine1', e.target.value)}
                        placeholder="Street address, building or suite"
                      />
                    </Field>

                    <Field label="Address line 2 (optional)">
                      <input
                        value={formClient.addressLine2 || ''}
                        onChange={e => updateClientField('addressLine2', e.target.value)}
                        placeholder="Apartment, unit, suite, floor"
                      />
                    </Field>

                    <div className="form-grid three">
                      <Field label="City / Town">
                        <input
                          value={formClient.city || ''}
                          onChange={e => updateClientField('city', e.target.value)}
                          placeholder="e.g. London"
                        />
                      </Field>
                      <Field label={countryLabels.stateLabel}>
                        <input
                          value={formClient.state || ''}
                          onChange={e => updateClientField('state', e.target.value)}
                          placeholder={countryLabels.statePlaceholder}
                        />
                      </Field>
                      <Field label={countryLabels.postalCodeLabel}>
                        <input
                          value={formClient.postalCode || ''}
                          onChange={e => updateClientField('postalCode', e.target.value)}
                          placeholder={countryLabels.postalCodePlaceholder}
                        />
                      </Field>
                    </div>

                    <Field label={countryLabels.taxIdLabel} hint="Client Tax/VAT ID for quotation">
                      <input
                        value={formClient.taxId || ''}
                        onChange={e => setFormClient({ ...formClient, taxId: e.target.value })}
                        placeholder={countryLabels.taxIdPlaceholder}
                      />
                    </Field>

                    {!formClient.addressLine1 && formClient.address && (
                      <Field label="Legacy unseparated address" hint="This quote has an older unseparated address. Entering separated fields above will update it.">
                        <textarea
                          rows={2}
                          value={formClient.address}
                          onChange={e => setFormClient({ ...formClient, address: e.target.value })}
                        />
                      </Field>
                    )}
                  </>
                )
              })()}

              <Field label="Currency">
                <select
                  value={formCurrency}
                  onChange={e => setFormCurrency(e.target.value as Business['currency'])}
                >
                  {(['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'] as const).map(curr => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Issue date">
                <input
                  type="date"
                  value={formIssueDate}
                  onChange={e => setFormIssueDate(e.target.value)}
                />
              </Field>

              <Field label="Valid until / Expiry date">
                <input
                  type="date"
                  value={formExpiryDate}
                  onChange={e => setFormExpiryDate(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Scope of work / Project description" hint="Clear deliverables and specifications for the client">
              <textarea
                rows={3}
                value={formScope}
                onChange={e => setFormScope(e.target.value)}
                placeholder="Describe project objectives, key milestones, and deliverable specifications..."
              />
            </Field>

            {/* Line items table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="field-label font-semibold text-xs text-[var(--muted)]">
                  Line Items & Estimated Services
                </label>
                <Button
                  variant="ghost"
                  className="text-xs h-7 py-0 px-2"
                  onClick={() =>
                    setFormLines([
                      ...formLines,
                      { id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' },
                    ])
                  }
                >
                  + Add line item
                </Button>
              </div>

              <div className="space-y-2">
                {formLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-[var(--soft)] border border-[var(--line)]"
                  >
                    <div className="col-span-6">
                      <input
                        className="w-full text-sm"
                        placeholder="Description of work or service"
                        value={line.description}
                        onChange={e => {
                          const next = [...formLines]
                          next[idx] = { ...next[idx], description: e.target.value }
                          setFormLines(next)
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="w-full text-sm text-right"
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={e => {
                          const next = [...formLines]
                          next[idx] = { ...next[idx], quantity: e.target.value }
                          setFormLines(next)
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        className="w-full text-sm text-right"
                        type="number"
                        step="any"
                        placeholder="Rate"
                        value={line.rate}
                        onChange={e => {
                          const next = [...formLines]
                          next[idx] = { ...next[idx], rate: e.target.value }
                          setFormLines(next)
                        }}
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        disabled={formLines.length === 1}
                        className="text-rose-500 hover:text-rose-700 disabled:opacity-30 text-base"
                        onClick={() => {
                          if (formLines.length > 1) {
                            setFormLines(formLines.filter((_, i) => i !== idx))
                          }
                        }}
                        title="Remove line"
                      >
                        x
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial summary calculations */}
            <div className="p-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] space-y-2">
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>Subtotal:</span>
                <span>{money(composerTotals.subtotal, formCurrency)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Field label="Discount">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      className="text-right"
                      value={formDiscount}
                      onChange={e => setFormDiscount(e.target.value)}
                    />
                    <select
                      value={formDiscountType}
                      onChange={e => setFormDiscountType(e.target.value as 'amount' | 'percent')}
                      className="w-24"
                    >
                      <option value="amount">{formCurrency}</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </Field>

                <Field label="Tax percentage (%)">
                  <input
                    type="number"
                    step="any"
                    className="text-right"
                    value={formTax}
                    onChange={e => setFormTax(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--line)]">
                <span>Estimated Total:</span>
                <span>{money(composerTotals.total, formCurrency)}</span>
              </div>
            </div>

            <Field label="Notes, payment terms & assumptions">
              <textarea
                rows={2}
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Payment is 50% upfront, remaining upon completion. Quote valid for 30 days."
              />
            </Field>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
              {editingQuote && !editingQuote.convertedInvoiceId ? (
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    await handleDeleteQuote(editingQuote)
                    setComposerOpen(false)
                    setEditingQuote(null)
                  }}
                  disabled={loadingAction === `delete-${editingQuote.id}`}
                >
                  Delete quote
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setComposerOpen(false)
                    setEditingQuote(null)
                  }}
                >
                  Cancel
                </Button>
                <StateButton
                  variant="primary"
                  onClick={() => void handleSaveQuote()}
                  status={loadingAction === 'save' ? 'saving' : loadingAction === 'saved' ? 'saved' : undefined}
                  idleText={editingQuote ? 'Save changes' : 'Create quote draft'}
                  savingText="Saving quote..."
                  savedText={editingQuote ? 'Changes saved!' : 'Quote created!'}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Acceptance Modal */}
      {acceptanceModalQuote && (
        <Modal
          open={Boolean(acceptanceModalQuote)}
          onClose={() => setAcceptanceModalQuote(null)}
          title={`Record Acceptance - ${acceptanceModalQuote.quoteNumber}`}
          description={`Record owner-verified acceptance for revision ${acceptanceModalQuote.revision}. This locks the agreed terms before conversion.`}
        >
          <div className="space-y-4">
            <Field label="Acceptance date">
              <input
                type="date"
                value={acceptanceDate}
                onChange={e => setAcceptanceDate(e.target.value)}
                required
              />
            </Field>

            <Field label="Acceptance method">
              <select
                value={acceptanceMethod}
                onChange={e =>
                  setAcceptanceMethod(
                    e.target.value as 'email' | 'in_person' | 'verbal' | 'signed_document' | 'other'
                  )
                }
              >
                <option value="email">Email confirmation</option>
                <option value="signed_document">Signed document / contract</option>
                <option value="in_person">In-person agreement</option>
                <option value="verbal">Verbal approval</option>
                <option value="other">Other written record</option>
              </select>
            </Field>

            <Field label="Reference / Documentation identifier (optional)" hint="e.g. Email message ID, purchase order, or agreement reference">
              <input
                value={acceptanceReference}
                onChange={e => setAcceptanceReference(e.target.value)}
                placeholder="PO-7849 or email subject"
              />
            </Field>

            <Field label="Notes (optional)">
              <textarea
                rows={2}
                value={acceptanceNotes}
                onChange={e => setAcceptanceNotes(e.target.value)}
                placeholder="Client agreed to timeline and initial deposit terms."
              />
            </Field>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
              Recording acceptance marks Revision {acceptanceModalQuote.revision} as accepted and unlocks conversion to an unissued draft invoice.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <Button variant="ghost" onClick={() => setAcceptanceModalQuote(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => void handleRecordAcceptance()}
                disabled={loadingAction === `accept-${acceptanceModalQuote.id}`}
              >
                {loadingAction === `accept-${acceptanceModalQuote.id}` ? 'Recording...' : 'Confirm acceptance'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Decline Modal */}
      {declineModalQuote && (
        <Modal
          open={Boolean(declineModalQuote)}
          onClose={() => setDeclineModalQuote(null)}
          title={`Decline Quote - ${declineModalQuote.quoteNumber}`}
          description="Mark this estimate as declined by the client and record the reason."
        >
          <div className="space-y-4">
            <Field label="Reason for declining">
              <textarea
                rows={3}
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="e.g. Project postponed, budget constraints, or competitor chosen..."
                autoFocus
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <Button variant="ghost" onClick={() => setDeclineModalQuote(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleDeclineQuote()}
                disabled={loadingAction === `decline-${declineModalQuote.id}`}
              >
                {loadingAction === `decline-${declineModalQuote.id}` ? 'Saving...' : 'Mark as declined'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revise Modal */}
      {reviseModalQuote && (
        <Modal
          open={Boolean(reviseModalQuote)}
          onClose={() => setReviseModalQuote(null)}
          title={`Revise Quote - ${reviseModalQuote.quoteNumber}`}
          description={`Create Revision ${reviseModalQuote.revision + 1} of this quote.`}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--ink)]">
              This will preserve Revision {reviseModalQuote.revision} immutably as <strong>superseded</strong>, and generate an editable <strong>Revision {reviseModalQuote.revision + 1}</strong> pre-populated with the current scope and line items.
            </p>

            <div className="p-3 rounded-lg bg-[var(--soft)] border border-[var(--line)] text-xs text-[var(--muted)]">
              Quote Number: <strong>{reviseModalQuote.quoteNumber}</strong>
              <br />
              Client: <strong>{reviseModalQuote.client.name}</strong>
              <br />
              New Revision: <strong>Revision {reviseModalQuote.revision + 1} (Draft)</strong>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <Button variant="ghost" onClick={() => setReviseModalQuote(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleReviseQuote()}
                disabled={loadingAction === `revise-${reviseModalQuote.id}`}
              >
                {loadingAction === `revise-${reviseModalQuote.id}` ? 'Creating...' : `Create Revision ${reviseModalQuote.revision + 1}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
