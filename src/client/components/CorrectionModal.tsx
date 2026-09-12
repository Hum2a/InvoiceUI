import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import { totals, money, precision, type Invoice, type Workspace, type Line } from '../../shared/domain'
import { Modal, Button } from './ui'

export function CorrectionModal({
  open,
  invoice: inv,
  workspace: w,
  onClose,
  onCredit,
}: {
  open: boolean
  invoice: Invoice
  workspace: Workspace
  onClose: () => void
  onCredit: (reason: string, lines: Line[], tax: string, replacement: boolean) => Promise<void>
}) {
  const [mode, setMode] = useState<'replace' | 'partial'>('replace')
  const [reason, setReason] = useState('')
  const [replacement, setReplacement] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Partial credit line selection state: map line id -> { selected: boolean, qty: string, rate: string }
  const [lineOverrides, setLineOverrides] = useState<Record<string, { selected: boolean; qty: string; rate: string }>>(() => {
    const initial: Record<string, { selected: boolean; qty: string; rate: string }> = {}
    for (const l of inv.lines) {
      initial[l.id] = { selected: true, qty: l.quantity, rate: l.rate }
    }
    return initial
  })

  const t = useMemo(() => totals(inv, w.creditNotes), [inv, w.creditNotes])
  const eligibleAmount = new Decimal(t.adjustedTotal)
  const dp = precision(inv.currency)

  // Calculate proposed credit lines and totals
  const { creditLines, creditSubtotal, creditTaxAmount, creditTotal, exceedsEligible } = useMemo(() => {
    const round = (v: Decimal) => v.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)
    let lines: Line[] = []

    if (mode === 'replace') {
      // Full credit covers original lines proportionally or directly
      lines = inv.lines.map(l => ({
        ...structuredClone(l),
        id: crypto.randomUUID(),
      }))
    } else {
      for (const l of inv.lines) {
        const state = lineOverrides[l.id]
        if (state && state.selected) {
          const cleanQty = state.qty.trim()
          const cleanRate = state.rate.trim()
          if (cleanQty && cleanRate && Number(cleanQty) > 0 && Number(cleanRate) >= 0) {
            lines.push({
              id: crypto.randomUUID(),
              description: l.description,
              quantity: cleanQty,
              rate: cleanRate,
              unit: l.unit,
              group: l.group,
            })
          }
        }
      }
    }

    const lineTotals = lines.map(l => round(new Decimal(l.quantity || 0).mul(l.rate || 0)))
    const subtotal = lineTotals.reduce((a, b) => a.add(b), new Decimal(0))
    const taxAmount = round(subtotal.mul(inv.tax || 0).div(100))
    const total = subtotal.add(taxAmount)
    const exceeds = total.gt(eligibleAmount)

    return {
      creditLines: lines,
      creditSubtotal: subtotal.toFixed(dp),
      creditTaxAmount: taxAmount.toFixed(dp),
      creditTotal: total.toFixed(dp),
      exceedsEligible: exceeds,
    }
  }, [mode, inv, lineOverrides, eligibleAmount, dp])

  const canSubmit =
    Boolean(reason.trim()) &&
    creditLines.length > 0 &&
    new Decimal(creditTotal).gt(0) &&
    !exceedsEligible &&
    !busy

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      await onCredit(reason.trim(), creditLines, inv.tax, mode === 'replace' ? replacement : false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credit note issuance failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Correct Invoice ${inv.number}`}
      description="Issue an immutable credit document. Original invoice bytes and audit history remain permanently preserved."
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {/* Financial Status Banner */}
        <div className="p-3 bg-[var(--soft)] border border-[var(--line)] rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <span className="text-[var(--muted)] block">Original total</span>
            <strong className="text-sm">{money(t.total, inv.currency)}</strong>
          </div>
          <div>
            <span className="text-[var(--muted)] block">Already credited</span>
            <strong className="text-sm">{money(t.credited, inv.currency)}</strong>
          </div>
          <div>
            <span className="text-[var(--muted)] block">Remaining eligible</span>
            <strong className="text-sm text-lime-600 dark:text-lime-400">
              {money(t.adjustedTotal, inv.currency)}
            </strong>
          </div>
          <div>
            <span className="text-[var(--muted)] block">Recorded payments</span>
            <strong className="text-sm text-emerald-600 dark:text-emerald-400">
              {money(t.paid, inv.currency)}
            </strong>
          </div>
        </div>

        {/* Correction Mode Selector */}
        <div className="space-y-2">
          <label className="font-semibold text-sm block">Correction type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-3 text-left rounded-xl border transition-all ${
                mode === 'replace'
                  ? 'border-lime-500 bg-[var(--soft)] ring-1 ring-lime-500'
                  : 'border-[var(--line)] bg-[var(--card)] hover:bg-[var(--soft)]'
              }`}
              onClick={() => setMode('replace')}
            >
              <span className="font-semibold block">Full credit & replace</span>
              <span className="text-[var(--muted)] text-[11px] block mt-0.5">
                Issue a credit note for the entire remaining balance and create a linked replacement draft.
              </span>
            </button>

            <button
              type="button"
              className={`p-3 text-left rounded-xl border transition-all ${
                mode === 'partial'
                  ? 'border-lime-500 bg-[var(--soft)] ring-1 ring-lime-500'
                  : 'border-[var(--line)] bg-[var(--card)] hover:bg-[var(--soft)]'
              }`}
              onClick={() => setMode('partial')}
            >
              <span className="font-semibold block">Partial credit note</span>
              <span className="text-[var(--muted)] text-[11px] block mt-0.5">
                Credit specific line items or reduction amounts without generating a replacement.
              </span>
            </button>
          </div>
        </div>

        {/* Mode-specific configurations */}
        {mode === 'replace' && (
          <div className="p-3 bg-[var(--card)] border border-[var(--line)] rounded-xl space-y-2">
            <label className="check text-xs">
              <input
                type="checkbox"
                checked={replacement}
                onChange={e => setReplacement(e.target.checked)}
              />
              <span>Create linked replacement draft (pre-populated with invoice items)</span>
            </label>
            <p className="text-[11px] text-[var(--muted)]">
              The replacement draft links to {inv.number} and is ready to edit and issue. The original invoice is marked as credited.
            </p>
            {Number(t.paid) > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                Notice: {money(t.paid, inv.currency)} was received for this invoice. When credited, the paid amount returns to the client's unallocated credit balance for re-allocation or refund.
              </p>
            )}
          </div>
        )}

        {mode === 'partial' && (
          <div className="space-y-2">
            <span className="font-semibold text-xs block">Select lines to credit:</span>
            <div className="table-scroll max-h-48 border border-[var(--line)] rounded-lg">
              <table className="dashboard-table text-xs">
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}>Include</th>
                    <th>Description</th>
                    <th>Credited Qty</th>
                    <th>Credited Rate</th>
                    <th>Line Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map(line => {
                    const st = lineOverrides[line.id] ?? { selected: false, qty: line.quantity, rate: line.rate }
                    const lineVal = st.selected
                      ? new Decimal(st.qty || 0).mul(st.rate || 0).toFixed(dp)
                      : '0.00'
                    return (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={st.selected}
                            onChange={e =>
                              setLineOverrides(prev => ({
                                ...prev,
                                [line.id]: { ...st, selected: e.target.checked },
                              }))
                            }
                          />
                        </td>
                        <td>{line.description || 'Untitled item'}</td>
                        <td style={{ width: '80px' }}>
                          <input
                            className="w-16 px-1 py-0.5 border rounded"
                            disabled={!st.selected}
                            value={st.qty}
                            onChange={e =>
                              setLineOverrides(prev => ({
                                ...prev,
                                [line.id]: { ...st, qty: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td style={{ width: '90px' }}>
                          <input
                            className="w-20 px-1 py-0.5 border rounded"
                            disabled={!st.selected}
                            value={st.rate}
                            onChange={e =>
                              setLineOverrides(prev => ({
                                ...prev,
                                [line.id]: { ...st, rate: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td>{money(lineVal, inv.currency)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Credit Reason */}
        <label className="field">
          <span>Reason for credit document (required)</span>
          <input
            placeholder="e.g. Scope adjustment, service defect, cancelled milestone"
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
          />
        </label>

        {/* Credit Summary Calculation */}
        <div className="p-3 bg-[var(--soft)] border border-[var(--line)] rounded-xl space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Credited subtotal:</span>
            <span>{money(creditSubtotal, inv.currency)}</span>
          </div>
          {Number(inv.tax) > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Tax adjustment ({inv.tax}%):</span>
              <span>{money(creditTaxAmount, inv.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-[var(--line)]">
            <span>Total Credit Amount:</span>
            <span className={exceedsEligible ? 'text-red-600' : 'text-amber-600'}>
              {money(creditTotal, inv.currency)}
            </span>
          </div>
          {exceedsEligible && (
            <p className="text-red-600 font-semibold mt-1">
              Error: Proposed credit ({money(creditTotal, inv.currency)}) exceeds remaining eligible balance ({money(eligibleAmount.toFixed(dp), inv.currency)}).
            </p>
          )}
        </div>

        {/* Disclaimer per instructions */}
        <p className="text-[10px] text-[var(--muted)] italic">
          Disclaimer: This system generates commercial credit documents and balance adjustments. It does not constitute formal tax or accounting advice.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {busy ? 'Issuing credit note…' : 'Issue Credit Note ↗'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
