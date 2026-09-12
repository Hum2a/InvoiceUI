import { useState, useMemo } from 'react'
import {
  buildInvoiceTimeline,
  totals,
  money,
  type Invoice,
  type Workspace,
  type TimelineEvent,
} from '../../shared/domain'
import { Badge, Button } from './ui'

export function ActivityTimeline({
  invoice: i,
  workspace: w,
}: {
  invoice: Invoice
  workspace: Workspace
}) {
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const t = totals(i)
  const allEvents = useMemo(() => buildInvoiceTimeline(i, w), [i, w])

  const filteredEvents = useMemo(() => {
    if (filterCategory === 'All') return allEvents
    return allEvents.filter(e => e.category === filterCategory)
  }, [allEvents, filterCategory])

  const lastDelivery = (w.messages || []).find(m => m.invoiceId === i.id)

  const getCategoryIcon = (category: TimelineEvent['category']) => {
    switch (category) {
      case 'Lifecycle':
        return '▤'
      case 'Payment':
        return '£'
      case 'Delivery':
        return '✉'
      case 'Sharing':
        return '🔗'
      default:
        return '⚙'
    }
  }

  return (
    <div className="activity-timeline space-y-4">
      {/* Financial & Delivery Summary */}
      <div className="p-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[var(--muted)] block">Total amount</span>
          <strong className="text-sm">{money(t.total, i.currency)}</strong>
        </div>
        <div>
          <span className="text-[var(--muted)] block">Total paid</span>
          <strong className="text-sm text-emerald-600 dark:text-emerald-400">
            {money(t.paid, i.currency)}
          </strong>
        </div>
        <div>
          <span className="text-[var(--muted)] block">Balance due</span>
          <strong className="text-sm text-lime-600 dark:text-lime-400">
            {i.lifecycle === 'issued' ? money(t.balance, i.currency) : '-'}
          </strong>
        </div>
        <div>
          <span className="text-[var(--muted)] block">Last email status</span>
          <strong className="text-sm">
            {lastDelivery ? (
              <Badge>{lastDelivery.status}</Badge>
            ) : (
              <span className="text-[var(--muted)]">Not sent</span>
            )}
          </strong>
        </div>
      </div>

      {/* Category filter buttons */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-[var(--muted)] mr-1">Filter:</span>
        {['All', 'Lifecycle', 'Payment', 'Delivery', 'Sharing'].map(cat => (
          <Button
            key={cat}
            variant={filterCategory === cat ? 'primary' : 'ghost'}
            className="text-xs py-1 px-2.5 h-7"
            onClick={() => setFilterCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Timeline Entries */}
      <div className="timeline-list">
        {filteredEvents.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-4">
            No events recorded under this filter.
          </p>
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className="timeline-entry"
              data-category={event.category}
            >
              <div className="timeline-dot">
                {getCategoryIcon(event.category)}
              </div>
              <div>
                <div className="timeline-header">
                  <div className="flex items-center gap-2">
                    <span className="timeline-title">{event.title}</span>
                    {event.status && <Badge>{event.status}</Badge>}
                    {event.isPrivate && (
                      <span className="text-[10px] uppercase font-semibold text-[var(--muted)] bg-[var(--card)] border border-[var(--line)] rounded px-1.5 py-0.5">
                        Internal
                      </span>
                    )}
                  </div>
                  <span className="timeline-time">{event.formattedDate}</span>
                </div>
                <p className="timeline-detail">{event.detail}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
