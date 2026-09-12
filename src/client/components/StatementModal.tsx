import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import {
  buildClientStatement,
  money,
  precision,
  today,
  type Workspace,
  type Business,
} from '../../shared/domain'
import { Modal, Button, Field } from './ui'
import { Download } from './ui/AnimatedIcon'

export function StatementModal({
  workspace: w,
  initialClientId,
  onClose,
}: {
  workspace: Workspace
  initialClientId?: string
  onClose: () => void
}) {
  const [clientId, setClientId] = useState<string>(
    initialClientId || w.clients[0]?.id || ''
  )
  const [currency, setCurrency] = useState<Business['currency']>(
    (w.clients.find(c => c.id === clientId)?.currency as Business['currency']) || w.business.currency
  )

  const currentDay = today(w.business.timezone)
  const defaultStart = currentDay.slice(0, 8) + '01' // First of current month
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(currentDay)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const client = w.clients.find(c => c.id === clientId)

  const statement = useMemo(() => {
    if (!clientId || !client) return null
    try {
      return buildClientStatement(w, clientId, currency, startDate, endDate)
    } catch (e) {
      return null
    }
  }, [w, clientId, client, currency, startDate, endDate])

  const setRange = (type: 'thisMonth' | 'last30' | 'last90' | 'ytd' | 'all') => {
    const end = currentDay
    if (type === 'thisMonth') {
      setStartDate(currentDay.slice(0, 8) + '01')
      setEndDate(end)
    } else if (type === 'last30') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setStartDate(d.toISOString().slice(0, 10))
      setEndDate(end)
    } else if (type === 'last90') {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      setStartDate(d.toISOString().slice(0, 10))
      setEndDate(end)
    } else if (type === 'ytd') {
      setStartDate(currentDay.slice(0, 4) + '-01-01')
      setEndDate(end)
    } else if (type === 'all') {
      setStartDate('2020-01-01')
      setEndDate(end)
    }
  }

  async function handleDownload() {
    if (!statement) return
    setDownloading(true)
    setError('')
    try {
      const { renderStatementPDF, filenameStatement } = await import('../../shared/pdf')
      const font = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer())
      const bytes = await renderStatementPDF(statement, w.business, font)
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameStatement(statement)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate statement PDF')
    } finally {
      setDownloading(false)
    }
  }

  const netPayments = statement
    ? new Decimal(statement.periodPayments).sub(statement.periodRefunds).toFixed(precision(currency))
    : '0.00'

  return (
    <Modal
      open
      onClose={onClose}
      title="Client Statement of Account"
      description="Reconciled statement showing opening balance, charges, credits, and net payments."
    >
      <div className="space-y-4">
        {w.clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients available in this workspace.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Client">
                <select
                  value={clientId}
                  onChange={e => {
                    const id = e.target.value
                    setClientId(id)
                    const c = w.clients.find(x => x.id === id)
                    if (c?.currency) setCurrency(c.currency as Business['currency'])
                  }}
                >
                  {w.clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Unnamed client'}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Currency">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as Business['currency'])}
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex gap-2 flex-wrap text-xs">
              <span className="muted py-1">Presets:</span>
              <button
                type="button"
                className="px-2 py-1 bg-[var(--soft)] rounded hover:bg-[var(--line)]"
                onClick={() => setRange('thisMonth')}
              >
                This month
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-[var(--soft)] rounded hover:bg-[var(--line)]"
                onClick={() => setRange('last30')}
              >
                Last 30 days
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-[var(--soft)] rounded hover:bg-[var(--line)]"
                onClick={() => setRange('last90')}
              >
                Last 90 days
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-[var(--soft)] rounded hover:bg-[var(--line)]"
                onClick={() => setRange('ytd')}
              >
                Year to date
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-[var(--soft)] rounded hover:bg-[var(--line)]"
                onClick={() => setRange('all')}
              >
                All time
              </button>
            </div>

            {statement && (
              <div className="space-y-4 pt-2">
                {/* Statement Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--soft)] border border-[var(--border)]">
                    <span className="muted block">Opening</span>
                    <strong className="text-sm">{money(statement.openingBalance, currency)}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--soft)] border border-[var(--border)]">
                    <span className="muted block">Invoiced</span>
                    <strong className="text-sm">{money(statement.periodCharges, currency)}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--soft)] border border-[var(--border)]">
                    <span className="muted block">Credits</span>
                    <strong className="text-sm text-amber-600 dark:text-amber-400">
                      −{money(statement.periodCredits, currency)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--soft)] border border-[var(--border)]">
                    <span className="muted block">Net Payments</span>
                    <strong className="text-sm text-lime-700 dark:text-lime-400">
                      −{money(netPayments, currency)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 col-span-2 sm:col-span-1">
                    <span className="muted block font-medium">Closing Due</span>
                    <strong className="text-sm text-primary">{money(statement.closingBalance, currency)}</strong>
                  </div>
                </div>

                {/* Reconciliation Audit Formula */}
                <div className="p-2 rounded bg-muted/40 border border-border text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Reconciliation equation: </span>
                  {money(statement.openingBalance, currency)} (opening) + {money(statement.periodCharges, currency)} (charges) - {money(statement.periodCredits, currency)} (credits) - {money(netPayments, currency)} (net paid) = <strong>{money(statement.closingBalance, currency)}</strong>
                </div>

                {/* Ledger Entries List */}
                <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[var(--soft)] text-muted-foreground uppercase text-[10px] tracking-wider border-b border-[var(--border)] sticky top-0">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Ref</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Charge</th>
                        <th className="p-2 text-right">Credit</th>
                        <th className="p-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                      <tr className="bg-[var(--soft)]/50 text-muted-foreground">
                        <td className="p-2">{startDate}</td>
                        <td className="p-2">OPENING</td>
                        <td className="p-2 font-sans">Opening balance</td>
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right font-semibold">{money(statement.openingBalance, currency)}</td>
                      </tr>
                      {statement.entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-muted-foreground font-sans italic">
                            No ledger activity within this period.
                          </td>
                        </tr>
                      ) : (
                        statement.entries.map(entry => (
                          <tr key={entry.id} className="hover:bg-[var(--soft)]/40 transition-colors">
                            <td className="p-2">{entry.date}</td>
                            <td className="p-2 font-sans font-medium">{entry.reference}</td>
                            <td className="p-2 font-sans text-muted-foreground">{entry.description}</td>
                            <td className="p-2 text-right">
                              {entry.charges ? money(entry.charges, currency) : '-'}
                            </td>
                            <td className="p-2 text-right text-lime-600 dark:text-lime-400">
                              {entry.credits ? `−${money(entry.credits, currency)}` : '-'}
                            </td>
                            <td className="p-2 text-right font-semibold text-foreground">
                              {money(entry.balance, currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-muted-foreground">
                    Generated for {client?.name} · {statement.entries.length} period events
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={downloading}
                      onClick={() => void handleDownload()}
                    >
                      {downloading ? 'Rendering PDF…' : (<><Download size={14} animateOnHover className="mr-1.5 inline" />Download Statement PDF</>)}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="alert text-xs" role="alert">{error}</div>}
      </div>
    </Modal>
  )
}
