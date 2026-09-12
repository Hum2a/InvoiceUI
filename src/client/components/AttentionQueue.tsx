import { useState } from 'react'
import {
  getAttentionQueueItems,
  addDays,
  today,
  type Workspace,
  type Invoice,
  type AttentionItem,
  type Command,
  type Envelope,
} from '../../shared/domain'
import { Button, Badge } from './ui'

export function AttentionQueue({
  workspace: w,
  onSelectInvoice,
  onAction,
  onCommand,
}: {
  workspace: Workspace
  onSelectInvoice: (i: Invoice) => void
  onAction: (actionName: string, i: Invoice) => void
  onCommand: (c: Command) => Promise<Envelope>
}) {
  const [filterKind, setFilterKind] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const items = getAttentionQueueItems(w)
  const filteredItems = items.filter(item => {
    if (filterKind === 'all') return true
    return item.kind === filterKind
  })

  async function handleQuickPause(invoiceId: string, days: number) {
    setBusyId(invoiceId)
    setError('')
    try {
      const pausedUntil = addDays(today(w.business.timezone), days)
      await onCommand({
        type: 'pauseReminder',
        id: invoiceId,
        pausedUntil,
        pauseReason: `Quick pause from attention queue (${days} days)`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pause reminders')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResumeReminders(invoiceId: string) {
    setBusyId(invoiceId)
    setError('')
    try {
      await onCommand({
        type: 'pauseReminder',
        id: invoiceId,
        pausedUntil: undefined,
        pauseReason: undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resume reminders')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Owner Attention Queue
            {items.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational inbox highlighting delivery failures, unsent invoices, overdue accounts, and pauseable reminders.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="muted">Filter:</span>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              filterKind === 'all'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-[var(--soft)] hover:bg-[var(--line)]'
            }`}
            onClick={() => setFilterKind('all')}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              filterKind === 'delivery_failed'
                ? 'bg-red-500 text-white font-medium'
                : 'bg-[var(--soft)] hover:bg-[var(--line)]'
            }`}
            onClick={() => setFilterKind('delivery_failed')}
          >
            Failed ({items.filter(i => i.kind === 'delivery_failed').length})
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              filterKind === 'overdue'
                ? 'bg-amber-500 text-white font-medium'
                : 'bg-[var(--soft)] hover:bg-[var(--line)]'
            }`}
            onClick={() => setFilterKind('overdue')}
          >
            Overdue ({items.filter(i => i.kind === 'overdue').length})
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              filterKind === 'unsent'
                ? 'bg-blue-500 text-white font-medium'
                : 'bg-[var(--soft)] hover:bg-[var(--line)]'
            }`}
            onClick={() => setFilterKind('unsent')}
          >
            Unsent ({items.filter(i => i.kind === 'unsent').length})
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              filterKind === 'payment_notice'
                ? 'bg-emerald-500 text-white font-medium'
                : 'bg-[var(--soft)] hover:bg-[var(--line)]'
            }`}
            onClick={() => setFilterKind('payment_notice')}
          >
            Payments ({items.filter(i => i.kind === 'payment_notice').length})
          </button>
        </div>
      </div>

      {error && <div className="alert text-xs" role="alert">{error}</div>}

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-xl bg-[var(--soft)]/30">
          <div className="text-3xl mb-2">✓</div>
          <h3 className="text-sm font-semibold text-foreground">All caught up</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            No invoices currently require urgent attention. All deliveries are healthy and reminders are on schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const invoice = item.invoiceId ? w.invoices.find(inv => inv.id === item.invoiceId) : undefined
            const isPaused = Boolean(
              (item.pausedUntil || invoice?.reminder?.pausedUntil) &&
                (item.pausedUntil || invoice?.reminder?.pausedUntil || '') >= today(w.business.timezone)
            )

            const kindBadge =
              item.kind === 'delivery_failed' ? (
                <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                  Delivery failed
                </Badge>
              ) : item.kind === 'overdue' ? (
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  Overdue
                </Badge>
              ) : item.kind === 'unsent' ? (
                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
                  Unsent
                </Badge>
              ) : item.kind === 'payment_notice' ? (
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  Payment reported
                </Badge>
              ) : (
                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30">
                  Review draft
                </Badge>
              )

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.kind === 'delivery_failed'
                    ? 'border-red-500/40 bg-red-500/5'
                    : item.kind === 'overdue'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-[var(--border)] bg-card'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm">{item.title}</strong>
                    {kindBadge}
                    {item.invoiceNumber && (
                      <span className="text-xs font-mono font-medium text-foreground">
                        {item.invoiceNumber}
                      </span>
                    )}
                    {item.clientName && (
                      <span className="text-xs text-muted-foreground">· {item.clientName}</span>
                    )}
                    {isPaused && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
                        Reminders paused until {item.pausedUntil || invoice?.reminder?.pausedUntil}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                  {isPaused && (item.pauseReason || invoice?.reminder?.pauseReason) && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      Pause reason: {item.pauseReason || invoice?.reminder?.pauseReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {invoice && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => onSelectInvoice(invoice)}
                    >
                      Open invoice
                    </Button>
                  )}

                  {invoice && (item.kind === 'unsent' || item.kind === 'delivery_failed') && (
                    <Button
                      type="button"
                      variant="primary"
                      className="text-xs"
                      onClick={() => onAction('email', invoice)}
                    >
                      {item.kind === 'delivery_failed' ? 'Review delivery' : 'Send email'}
                    </Button>
                  )}

                  {invoice && item.kind === 'overdue' && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="primary"
                        className="text-xs"
                        onClick={() => onAction('reminder', invoice)}
                      >
                        Reminder settings
                      </Button>
                      {isPaused ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-blue-600 dark:text-blue-400"
                          disabled={busyId === invoice.id}
                          onClick={() => void handleResumeReminders(invoice.id)}
                        >
                          Resume
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs"
                          disabled={busyId === invoice.id}
                          onClick={() => void handleQuickPause(invoice.id, 7)}
                        >
                          Pause 7d
                        </Button>
                      )}
                    </div>
                  )}

                  {invoice && item.kind === 'unreviewed_draft' && (
                    <Button
                      type="button"
                      variant="primary"
                      className="text-xs"
                      onClick={() => onSelectInvoice(invoice)}
                    >
                      Review draft
                    </Button>
                  )}

                  {item.kind === 'payment_notice' && item.clientId && item.paymentNoticeId && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await onCommand({
                            type: 'dismissPaymentNotice',
                            clientId: item.clientId!,
                            noticeId: item.paymentNoticeId!,
                          })
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Could not dismiss notice')
                        }
                      }}
                    >
                      Dismiss notice
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
