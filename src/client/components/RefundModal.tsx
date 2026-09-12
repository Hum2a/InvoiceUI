import { useState } from 'react'
import Decimal from 'decimal.js'
import { money, precision, type ClientPayment } from '../../shared/domain'
import { Modal, Button } from './ui'

export function RefundModal({
  open,
  payment,
  onClose,
  onRefund,
}: {
  open: boolean
  payment: ClientPayment
  onClose: () => void
  onRefund: (refund: { amount: string; date: string; reference: string; notes: string }) => Promise<void>
}) {
  const [amount, setAmount] = useState(payment.unallocated)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const dp = precision(payment.currency)
  const available = new Decimal(payment.unallocated)
  const refundAmountNum = new Decimal(amount || 0)
  const exceedsAvailable = refundAmountNum.gt(available) || refundAmountNum.lte(0)

  const handleSubmit = async () => {
    if (exceedsAvailable || busy) return
    setBusy(true)
    setError('')
    try {
      await onRefund({
        amount: refundAmountNum.toFixed(dp),
        date,
        reference: reference.trim(),
        notes: notes.trim(),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund Client Credit"
      description="Record a refund paid out from unallocated credit."
    >
      <div className="space-y-4 text-xs">
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <div className="p-3 bg-[var(--soft)] border border-[var(--line)] rounded-xl flex justify-between items-center">
          <span className="text-[var(--muted)]">Available credit on this payment:</span>
          <strong className="text-sm text-emerald-600 dark:text-emerald-400">
            {money(payment.unallocated, payment.currency)}
          </strong>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Refund amount ({payment.currency})</span>
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Refund date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Reference / Transaction ID</span>
          <input
            placeholder="e.g. REF-4091"
            value={reference}
            onChange={e => setReference(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Notes / Reason</span>
          <input
            placeholder="e.g. Overpayment returned to client bank"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </label>

        {exceedsAvailable && (
          <p className="text-red-600">
            Refund amount must be greater than zero and cannot exceed available credit ({money(payment.unallocated, payment.currency)}).
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={exceedsAvailable || busy}
          >
            {busy ? 'Processing refund…' : 'Record Refund ↗'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
