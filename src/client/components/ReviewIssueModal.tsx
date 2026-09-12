import { useState } from 'react'
import {
  totals,
  money,
  issueErrors,
  detectInvoiceWarnings,
  formatClientAddress,
  type Invoice,
  type Workspace,
} from '../../shared/domain'
import { Modal, Button } from './ui'
import { Download, ArrowRight } from './ui/AnimatedIcon'

export function ReviewIssueModal({
  open,
  draft,
  workspace,
  onClose,
  onIssueAndDownload,
  onIssueAndEmail,
  onJumpToField,
}: {
  open: boolean
  draft: Invoice
  workspace: Workspace
  onClose: () => void
  onIssueAndDownload: () => Promise<void>
  onIssueAndEmail: () => Promise<void>
  onJumpToField?: (field: string) => void
}) {
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [actionError, setActionError] = useState('')

  const t = totals(draft)
  const blockingErrors = issueErrors(draft, workspace.business)
  const warnings = detectInvoiceWarnings(draft, workspace)
  const canIssue = blockingErrors.length === 0 && (warnings.length === 0 || warningsAcknowledged) && !issuing

  const handleIssueDownload = async () => {
    if (!canIssue) return
    setIssuing(true)
    setActionError('')
    try {
      await onIssueAndDownload()
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Issuance failed')
    } finally {
      setIssuing(false)
    }
  }

  const handleIssueEmail = async () => {
    if (!canIssue) return
    setIssuing(true)
    setActionError('')
    try {
      await onIssueAndEmail()
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Issuance failed')
    } finally {
      setIssuing(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review before issuing invoice"
      description="Review recipient details, line items, and payment instructions. Once issued, invoice numbers and financial totals are permanently locked."
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {actionError && (
          <div className="alert" role="alert">
            {actionError}
          </div>
        )}

        {/* Blocking Errors */}
        {blockingErrors.length > 0 && (
          <div className="review-error-box" role="alert">
            <p className="font-semibold text-sm mb-1">
              Required corrections ({blockingErrors.length}) - Please resolve before issuing:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1">
              {blockingErrors.map((err, idx) => (
                <li key={idx} className="flex justify-between items-center gap-2">
                  <span>{err}</span>
                  {onJumpToField && (
                    <button
                      type="button"
                      className="underline text-[11px] font-semibold hover:opacity-80"
                      onClick={() => {
                        onClose()
                        onJumpToField(err)
                      }}
                    >
                      Edit field →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Non-blocking Warnings */}
        {warnings.length > 0 && (
          <div className="review-warning-box">
            <p className="font-semibold text-sm mb-1">
              Warnings to verify ({warnings.length}):
            </p>
            <ul className="text-xs space-y-1.5 mb-3">
              {warnings.map(w => (
                <li key={w.id} className="flex flex-col gap-0.5">
                  <span className="font-semibold">{w.title}</span>
                  <span className="opacity-90">{w.message}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2 border-t border-amber-300/40 dark:border-amber-700/40">
              <input
                type="checkbox"
                checked={warningsAcknowledged}
                onChange={e => setWarningsAcknowledged(e.target.checked)}
              />
              <span>I have reviewed these warnings and confirm this invoice is ready to issue.</span>
            </label>
          </div>
        )}

        {/* Review Summary Grid */}
        <div className="review-grid">
          <div className="review-section space-y-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)]">
              Client & recipient
            </h4>
            <div className="review-row">
              <span className="text-[var(--muted)]">Client name:</span>
              <span className="font-medium">{draft.client.name || 'Not specified'}</span>
            </div>
            {draft.client.contact && (
              <div className="review-row">
                <span className="text-[var(--muted)]">Contact:</span>
                <span>{draft.client.contact}</span>
              </div>
            )}
            <div className="review-row">
              <span className="text-[var(--muted)]">Email:</span>
              <span>{draft.client.email || 'None'}</span>
            </div>
            {draft.client.phone && (
              <div className="review-row">
                <span className="text-[var(--muted)]">Phone:</span>
                <span>{draft.client.phone}</span>
              </div>
            )}
            {draft.client.cc.length > 0 && (
              <div className="review-row">
                <span className="text-[var(--muted)]">CC:</span>
                <span>{draft.client.cc.join(', ')}</span>
              </div>
            )}
            {draft.client.taxId && (
              <div className="review-row">
                <span className="text-[var(--muted)]">Tax / VAT ID:</span>
                <span className="font-mono">{draft.client.taxId}</span>
              </div>
            )}
            <div className="review-row">
              <span className="text-[var(--muted)]">Address:</span>
              <span className="text-right whitespace-pre-line truncate max-w-[200px]">
                {formatClientAddress(draft.client) || 'None'}
              </span>
            </div>
          </div>

          <div className="review-section space-y-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)]">
              Dates & terms
            </h4>
            <div className="review-row">
              <span className="text-[var(--muted)]">Issue date:</span>
              <span className="font-medium">{draft.issueDate}</span>
            </div>
            <div className="review-row">
              <span className="text-[var(--muted)]">Due date:</span>
              <span className="font-medium">{draft.dueDate}</span>
            </div>
            <div className="review-row">
              <span className="text-[var(--muted)]">Terms:</span>
              <span>{draft.terms === 0 ? 'Due on receipt' : `${draft.terms} days`}</span>
            </div>
            <div className="review-row">
              <span className="text-[var(--muted)]">Currency:</span>
              <span className="font-semibold">{draft.currency}</span>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="review-section space-y-2">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)]">
            Financial totals ({draft.lines.length} {draft.lines.length === 1 ? 'line' : 'lines'})
          </h4>
          <div className="review-row">
            <span>Subtotal</span>
            <span>{money(t.subtotal, draft.currency)}</span>
          </div>
          {Number(t.discount) > 0 && (
            <div className="review-row text-emerald-600 dark:text-emerald-400">
              <span>Discount {draft.discountType === 'percent' ? `(${draft.discount}%)` : ''}</span>
              <span>-{money(t.discount, draft.currency)}</span>
            </div>
          )}
          {Number(draft.tax) > 0 && (
            <div className="review-row">
              <span>Tax ({draft.tax}%)</span>
              <span>{money(t.tax, draft.currency)}</span>
            </div>
          )}
          <div className="review-row font-bold text-base border-t border-[var(--line)] pt-2 mt-1">
            <span>Total amount due</span>
            <span className="text-lime-600 dark:text-lime-400">{money(t.total, draft.currency)}</span>
          </div>
          {Number(draft.deposit) > 0 && (
            <div className="review-row text-xs text-[var(--muted)]">
              <span>Requested advance deposit:</span>
              <span>{money(draft.deposit, draft.currency)}</span>
            </div>
          )}
        </div>

        {/* Payment Instructions Preview */}
        <div className="review-section">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
            Payment instructions
          </h4>
          <p className="text-xs whitespace-pre-line text-[var(--muted)]">
            {draft.client.paymentInstructions || workspace.business.bank || 'No payment instructions specified.'}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[var(--line)] flex-wrap">
          <Button variant="ghost" onClick={onClose} disabled={issuing}>
            Back to edit
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleIssueDownload()}
            disabled={!canIssue}
          >
            {issuing ? 'Issuing…' : (<><Download size={13} animateOnHover className="mr-1 inline" />Issue and download PDF</>)}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleIssueEmail()}
            disabled={!canIssue}
          >
            {issuing ? 'Issuing…' : (<>Issue and prepare email <ArrowRight size={13} animateOnHover className="ml-1 inline" /></>)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
