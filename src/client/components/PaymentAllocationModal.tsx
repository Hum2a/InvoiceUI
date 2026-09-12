import { useState, useMemo, useEffect } from 'react'
import Decimal from 'decimal.js'
import {
  totals,
  money,
  precision,
  suggestPaymentAllocations,
  type Client,
  type Workspace,
  type Business,
} from '../../shared/domain'
import { Modal, Button } from './ui'

export function PaymentAllocationModal({
  open,
  client,
  workspace: w,
  onClose,
  onRecordPayment,
}: {
  open: boolean
  client: Client
  workspace: Workspace
  onClose: () => void
  onRecordPayment: (paymentData: {
    id: string
    clientId: string
    currency: Business['currency']
    amount: string
    date: string
    method: string
    reference: string
    notes: string
    allocations: { invoiceId: string; amount: string }[]
  }) => Promise<void>
}) {
  const [currency, setCurrency] = useState<Business['currency']>(
    client.currency || w.business.currency
  )
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('bank')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const dp = precision(currency)

  // Invoices eligible for payment allocation: must match client, currency, issued, balance > 0
  const eligibleInvoices = useMemo(() => {
    return w.invoices
      .filter(
        i =>
          i.clientId === client.id &&
          i.currency === currency &&
          i.lifecycle === 'issued' &&
          new Decimal(totals(i, w.creditNotes).balance).gt(0)
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [w.invoices, client.id, currency, w.creditNotes])

  // Total amount allocated
  const totalAllocated = useMemo(() => {
    let sum = new Decimal(0)
    for (const [invId, val] of Object.entries(allocations)) {
      const inv = eligibleInvoices.find(x => x.id === invId)
      if (inv && val && Number(val) > 0) {
        sum = sum.add(val)
      }
    }
    return sum
  }, [allocations, eligibleInvoices])

  const paymentAmountNum = useMemo(() => {
    const clean = amount.trim()
    if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) return new Decimal(0)
    return new Decimal(clean)
  }, [amount])

  const unallocatedAmount = useMemo(() => {
    return paymentAmountNum.sub(totalAllocated)
  }, [paymentAmountNum, totalAllocated])

  const exceedsPayment = totalAllocated.gt(paymentAmountNum)

  // Auto-allocate suggest function
  const handleAutoAllocate = () => {
    if (paymentAmountNum.lte(0)) return
    const suggestions = suggestPaymentAllocations(
      paymentAmountNum.toFixed(dp),
      currency,
      w.invoices.filter(i => i.clientId === client.id),
      w.creditNotes
    )
    const next: Record<string, string> = {}
    for (const s of suggestions) {
      next[s.invoiceId] = s.amount
    }
    setAllocations(next)
  }

  const canSubmit =
    paymentAmountNum.gt(0) &&
    !exceedsPayment &&
    !busy &&
    Boolean(date) &&
    Boolean(method.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      const builtAllocations: { invoiceId: string; amount: string }[] = []
      for (const [invId, val] of Object.entries(allocations)) {
        if (val && Number(val) > 0) {
          builtAllocations.push({
            invoiceId: invId,
            amount: new Decimal(val).toFixed(dp),
          })
        }
      }

      await onRecordPayment({
        id: crypto.randomUUID(),
        clientId: client.id,
        currency,
        amount: paymentAmountNum.toFixed(dp),
        date,
        method: method.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
        allocations: builtAllocations,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record Payment for ${client.name}`}
      description="Record a received payment and allocate it across outstanding invoices. Any excess is retained as unapplied credit."
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Payment currency</span>
            <select
              value={currency}
              onChange={e => {
                setCurrency(e.target.value as Business['currency'])
                setAllocations({})
              }}
            >
              {['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Payment amount received</span>
            <input
              type="text"
              placeholder="e.g. 1500.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              required
            />
          </label>
        </div>

        <div className="form-grid three">
          <label className="field">
            <span>Payment date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Payment method</span>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank">Bank Transfer (BACS/Faster)</option>
              <option value="card">Debit/Credit Card</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="field">
            <span>Reference (optional)</span>
            <input
              placeholder="e.g. TRX-90421"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Payment notes (optional)</span>
          <input
            placeholder="e.g. Deposit for Q4 work, client cleared balance"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </label>

        {/* Invoice Allocation Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-xs">
              Allocate across open invoices ({eligibleInvoices.length}):
            </span>
            {eligibleInvoices.length > 0 && paymentAmountNum.gt(0) && (
              <button
                type="button"
                className="underline text-[11px] text-lime-600 dark:text-lime-400 hover:opacity-80"
                onClick={handleAutoAllocate}
              >
                Auto-allocate (oldest due first) ⚡
              </button>
            )}
          </div>

          {eligibleInvoices.length === 0 ? (
            <p className="text-[var(--muted)] p-3 bg-[var(--soft)] rounded-xl">
              No outstanding invoices in {currency} for this client. The entire payment will be saved as unallocated client credit.
            </p>
          ) : (
            <div className="table-scroll max-h-48 border border-[var(--line)] rounded-lg">
              <table className="dashboard-table text-xs">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Due Date</th>
                    <th>Balance Due</th>
                    <th style={{ width: '110px' }}>Allocate ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleInvoices.map(inv => {
                    const bal = totals(inv, w.creditNotes).balance
                    const currentVal = allocations[inv.id] || ''
                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.number}</strong>
                        </td>
                        <td>{inv.dueDate}</td>
                        <td className="text-lime-600 dark:text-lime-400">
                          {money(bal, inv.currency)}
                        </td>
                        <td>
                          <input
                            className="w-24 px-1.5 py-0.5 border rounded"
                            placeholder="0.00"
                            value={currentVal}
                            onChange={e => {
                              const val = e.target.value
                              setAllocations(prev => ({
                                ...prev,
                                [inv.id]: val,
                              }))
                            }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Reconciliation Summary */}
        <div className="p-3 bg-[var(--soft)] border border-[var(--line)] rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Total payment received:</span>
            <strong>{money(paymentAmountNum.toFixed(dp), currency)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Total allocated to invoices:</span>
            <span>{money(totalAllocated.toFixed(dp), currency)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1 border-t border-[var(--line)]">
            <span>Remaining unapplied credit:</span>
            <span className={exceedsPayment ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}>
              {money(unallocatedAmount.toFixed(dp), currency)}
            </span>
          </div>
          {exceedsPayment && (
            <p className="text-red-600 font-semibold mt-1">
              Error: Sum of allocations exceeds total payment amount received.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {busy ? 'Saving payment…' : 'Record Payment & Allocations ↗'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
