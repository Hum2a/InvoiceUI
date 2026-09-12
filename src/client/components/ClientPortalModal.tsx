import { useState } from 'react'
import {
  today,
  addDays,
  money,
  type Workspace,
  type Command,
  type Envelope,
} from '../../shared/domain'
import { Modal, Button, StateButton, Badge, useConfirm } from './ui'

export function ClientPortalModal({
  workspace: w,
  clientId,
  owner,
  onCommand,
  onClose,
  onOpenPreview,
  onRecordPayment,
}: {
  workspace: Workspace
  clientId: string
  owner?: string
  onCommand: (c: Command) => Promise<Envelope>
  onClose: () => void
  onOpenPreview?: (token: string) => void
  onRecordPayment?: (notice: { amount?: string; reference?: string; date?: string }) => void
}) {
  const { confirm } = useConfirm()
  const client = w.clients.find(c => c.id === clientId)
  const defaultExpiry = addDays(today(w.business.timezone), 90)

  const [expires, setExpires] = useState(client?.portal?.expires || defaultExpiry)
  const [allowStatements, setAllowStatements] = useState(client?.portal?.allowStatements ?? true)
  const [allowAttachments, setAllowAttachments] = useState(client?.portal?.allowAttachments ?? true)
  const [restrictInvoices, setRestrictInvoices] = useState(
    Boolean(client?.portal?.allowedInvoiceIds && client.portal.allowedInvoiceIds.length > 0)
  )
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(
    client?.portal?.allowedInvoiceIds || []
  )
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!client) return null

  const issuedInvoices = (w.invoices || []).filter(
    i => i.clientId === client.id && i.lifecycle === 'issued'
  )
  const isPortalActive = Boolean(
    client.portal && client.portal.token && client.portal.expires >= today(w.business.timezone)
  )
  const portalUrl = client.portal?.token
    ? `${window.location.origin}/?portal=true&token=${encodeURIComponent(client.portal.token)}${owner ? `&owner=${encodeURIComponent(owner)}` : ''}`
    : ''

  async function handleShare() {
    setBusy(true)
    setError('')
    try {
      await onCommand({
        type: 'sharePortal',
        clientId: client!.id,
        expires,
        allowStatements,
        allowAttachments,
        allowedInvoiceIds: restrictInvoices ? selectedInvoiceIds : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not configure portal')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    const ok = await confirm({
      title: 'Revoke portal access?',
      description: 'Revoke portal access for this client? Existing links will stop working immediately.',
      confirmText: 'Revoke access',
      confirmVariant: 'danger',
    })
    if (!ok) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await onCommand({
        type: 'revokePortal',
        clientId: client!.id,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke portal access')
    } finally {
      setBusy(false)
    }
  }

  async function handleDismissNotice(noticeId: string) {
    setBusy(true)
    setError('')
    try {
      await onCommand({
        type: 'dismissPaymentNotice',
        clientId: client!.id,
        noticeId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dismiss payment notice')
    } finally {
      setBusy(false)
    }
  }

  function toggleInvoiceSelection(invId: string) {
    setSelectedInvoiceIds(prev =>
      prev.includes(invId) ? prev.filter(id => id !== invId) : [...prev, invId]
    )
  }

  return (
    <Modal open onClose={onClose} title={`Client Portal - ${client.name}`}>
      <div className="space-y-5 text-xs">
        {error && <div className="alert" role="alert">{error}</div>}

        {/* Portal Status Card */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--soft)]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Portal Status</span>
            {isPortalActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                Active
              </Badge>
            ) : client.portal?.token ? (
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                Expired
              </Badge>
            ) : (
              <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30">
                Not configured
              </Badge>
            )}
          </div>

          {isPortalActive ? (
            <div className="space-y-2">
              <label className="block text-[11px] text-muted-foreground">Shareable Portal Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={portalUrl}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
                />
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(portalUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2">
                {onOpenPreview && (
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => onOpenPreview(client.portal!.token)}
                  >
                    Preview Portal →
                  </Button>
                )}
                <Button
                  variant="danger"
                  className="text-xs"
                  onClick={handleRevoke}
                  disabled={busy}
                >
                  Revoke Link
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-[11px]">
              Provide your client with a private, read-only portal to view invoices, download PDFs, access statements, and submit payment confirmations.
            </p>
          )}
        </div>

        {/* Portal Access Settings */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-sm">Configuration & Permissions</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">
                Link Expiry Date
              </label>
              <input
                type="date"
                value={expires}
                min={today(w.business.timezone)}
                onChange={e => setExpires(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-foreground"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStatements}
                  onChange={e => setAllowStatements(e.target.checked)}
                />
                <span className="font-medium text-foreground">Include Statement of Account</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAttachments}
                  onChange={e => setAllowAttachments(e.target.checked)}
                />
                <span className="font-medium text-foreground">Include Client Attachments</span>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={restrictInvoices}
                onChange={e => setRestrictInvoices(e.target.checked)}
              />
              <span className="font-medium text-foreground">
                Restrict to specific invoices only (default shows all issued)
              </span>
            </label>

            {restrictInvoices && (
              <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded-lg p-2 space-y-1 bg-[var(--soft)]/20">
                {issuedInvoices.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-center">No issued invoices available for this client.</p>
                ) : (
                  issuedInvoices.map(inv => (
                    <label key={inv.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-[var(--soft)]">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(inv.id)}
                        onChange={() => toggleInvoiceSelection(inv.id)}
                      />
                      <span className="font-medium text-foreground">{inv.number}</span>
                      <span className="text-muted-foreground">
                        ({inv.issueDate} - {money(inv.lines.reduce((a, b) => a + Number(b.rate) * Number(b.quantity), 0), inv.currency)})
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reported Payment Notices Section */}
        {client.portal?.paymentNotices && client.portal.paymentNotices.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              Payment Reports from Client
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-bold">
                {client.portal.paymentNotices.length}
              </span>
            </h4>

            <div className="space-y-2">
              {client.portal.paymentNotices.map(notice => (
                <div
                  key={notice.id}
                  className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      Reported {notice.amount ? money(notice.amount, client.currency || w.business.currency) : 'payment'} on {notice.date}
                    </p>
                    {notice.reference && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Ref: {notice.reference}
                      </p>
                    )}
                    {notice.notes && (
                      <p className="text-[11px] text-muted-foreground">
                        Note: {notice.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onRecordPayment && (
                      <Button
                        variant="primary"
                        className="text-xs"
                        onClick={() => {
                          onRecordPayment({
                            amount: notice.amount,
                            reference: notice.reference,
                            date: notice.date,
                          })
                        }}
                      >
                        Record Payment
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => handleDismissNotice(notice.id)}
                      disabled={busy}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <StateButton
            variant="primary"
            onClick={handleShare}
            saving={busy}
            idleText={isPortalActive ? 'Update Portal Settings' : 'Generate Portal Link'}
            savingText="Saving settings..."
            savedText="Portal updated!"
          />
        </div>
      </div>
    </Modal>
  )
}
