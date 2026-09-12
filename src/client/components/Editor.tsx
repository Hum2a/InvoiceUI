import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  draftSchema,
  addDays,
  today,
  issueErrors,
  totals,
  money,
  parseTabularLines,
  createFromLastInvoice,
  buildInvoiceTimeline,
  COMMON_COUNTRIES,
  getCountryFieldLabels,
  formatClientAddress,
  type Invoice,
  type Envelope,
  type Command,
  type Workspace,
  type Client,
  type Starter,
  type Attachment,
} from '../../shared/domain'
import { Button, StateButton, Field, Badge, Modal, useConfirm } from './ui'
import { Copy, Download, Send, ArrowRight, Trash2, Sparkles } from './ui/AnimatedIcon'
import { InvoicePreview } from './InvoicePreview'
import { ReviewIssueModal } from './ReviewIssueModal'
import { CorrectionModal } from './CorrectionModal'
import { ActivityTimeline } from './ActivityTimeline'
import type { CreditNote } from '../../shared/domain'

export function Editor({
  invoice,
  workspace,
  owner,
  onCommand,
  onDownload,
  onAction,
}: {
  invoice: Invoice
  workspace: Workspace
  owner: string
  onCommand: (c: Command) => Promise<Envelope>
  onDownload: (i: Invoice, breakdown?: boolean) => Promise<void>
  onAction: (name: string, i: Invoice) => void
}) {
  const { confirm } = useConfirm()
  const recoveryKey = `invoiceui:recovery:${owner}:${invoice.id}`
  const [draft, setDraft] = useState<Invoice>(() => {
    if (invoice.lifecycle !== 'draft') return invoice
    try {
      const raw = localStorage.getItem(recoveryKey)
      if (raw) {
        const recovered = draftSchema.parse(JSON.parse(raw))
        return { ...invoice, ...recovered }
      }
    } catch {}
    return invoice
  })
  const [saved, setSaved] = useState(JSON.stringify(invoice))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [lineHistory, setLineHistory] = useState<Array<typeof draft.lines>>([])

  // Modal states for Wave A
  const [pendingClient, setPendingClient] = useState<Client | null>(null)
  const [tabularOpen, setTabularOpen] = useState(false)
  const [tabularText, setTabularText] = useState('')
  const [tabularMode, setTabularMode] = useState<'append' | 'replace'>('append')
  const [startersOpen, setStartersOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  const serial = JSON.stringify(draft)
  const dirty = serial !== saved
  const [editingIssued, setEditingIssued] = useState(false)
  const sentMessages = (workspace.messages || []).filter(
    m => m.invoiceId === invoice.id && ['sent', 'delivered'].includes(m.status)
  )
  const hasBeenSent = sentMessages.length > 0
  const editable = invoice.lifecycle === 'draft' || editingIssued
  const pending = useRef<Promise<Envelope> | null>(null)
  const latest = useRef(serial)
  latest.current = serial

  const pushLineHistory = (lines: typeof draft.lines) => {
    setLineHistory(h => [structuredClone(lines), ...h.slice(0, 19)])
  }

  const undoLines = () => {
    if (!lineHistory.length) return
    const [prev, ...rest] = lineHistory
    setLineHistory(rest)
    change({ lines: prev }, false)
  }

  const change = (patch: Partial<Invoice>, trackLines = true) => {
    setError('')
    if (trackLines && patch.lines && patch.lines !== draft.lines) {
      pushLineHistory(draft.lines)
    }
    setDraft(d => ({ ...d, ...patch }))
  }

  const [issuedInternalNotes, setIssuedInternalNotes] = useState(invoice.internalNotes || '')
  const [savingInternalNotes, setSavingInternalNotes] = useState(false)
  const [internalNotesNotice, setInternalNotesNotice] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('File size exceeds 4MB limit')
      return
    }
    const mime: 'application/pdf' | 'image/png' | 'image/jpeg' =
      file.type === 'application/pdf'
        ? 'application/pdf'
        : file.type === 'image/jpeg'
        ? 'image/jpeg'
        : 'image/png'
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const att: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mimeType: mime,
        dataUrl,
        visibility: 'client',
        created: today(workspace.business.timezone),
      }
      if (editable) {
        change({ attachments: [...(draft.attachments || []), att] })
      } else {
        try {
          await onCommand({ type: 'attachment', invoiceId: invoice.id, value: att })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save attachment')
        }
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDeleteAttachment = async (attId: string) => {
    if (editable) {
      change({ attachments: (draft.attachments || []).filter(a => a.id !== attId) })
    } else {
      try {
        await onCommand({ type: 'deleteAttachment', invoiceId: invoice.id, attachmentId: attId })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove attachment')
      }
    }
  }

  const handleToggleVisibility = async (attId: string, vis: 'client' | 'internal') => {
    if (editable) {
      change({
        attachments: (draft.attachments || []).map(a =>
          a.id === attId ? { ...a, visibility: vis } : a
        ),
      })
    } else {
      try {
        await onCommand({
          type: 'updateAttachmentVisibility',
          invoiceId: invoice.id,
          attachmentId: attId,
          visibility: vis,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update visibility')
      }
    }
  }

  const handleSaveIssuedNotes = async () => {
    setSavingInternalNotes(true)
    setInternalNotesNotice('')
    try {
      await onCommand({
        type: 'updateInternalNotes',
        invoiceId: invoice.id,
        notes: issuedInternalNotes,
      })
      setInternalNotesNotice('Private notes saved.')
      setTimeout(() => setInternalNotesNotice(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save internal notes')
    } finally {
      setSavingInternalNotes(false)
    }
  }

  async function save() {
    if (pending.current) {
      await pending.current
    }
    const target = latest.current
    if (target === saved) return
    setSaving(true)
    setError('')
    const val = JSON.parse(target)
    const cmd: Command =
      invoice.lifecycle === 'draft'
        ? { type: 'draft', value: val }
        : { type: 'updateIssuedInvoice', id: invoice.id, value: val }
    const p = onCommand(cmd)
    pending.current = p
    try {
      await p
      setSaved(target)
      if (latest.current === target) localStorage.removeItem(recoveryKey)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setError(message)
      throw e
    } finally {
      pending.current = null
      setSaving(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!editable || !dirty) return
    try {
      localStorage.setItem(recoveryKey, serial)
    } catch {
      setError('Local recovery storage is full. Please save before leaving.')
    }
    const timer = setTimeout(() => {
      if (navigator.onLine) void saveRef.current().catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [serial, dirty, editable, recoveryKey])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const online = () => {
      if (dirty) void saveRef.current().catch(() => {})
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('beforeunload', handler)
      window.removeEventListener('online', online)
    }
  }, [dirty])

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void saveRef.current().catch(() => {})
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        void download()
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          // Allow native undo inside inputs
          return
        }
        if (lineHistory.length) {
          e.preventDefault()
          undoLines()
        }
      }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [draft, lineHistory])

  async function download(breakdown = false) {
    try {
      if (editable) await save()
      await onDownload(draft, breakdown)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  async function issue() {
    try {
      await save()
      const errors = issueErrors(draft, workspace.business)
      if (errors.length) {
        setError(errors.join(' '))
        return
      }
      await onCommand({ type: 'issue', id: invoice.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue invoice')
    }
  }

  const updateLine = (id: string, field: string, value: string) => {
    const next = draft.lines.map(l => (l.id === id ? { ...l, [field]: value } : l))
    change({ lines: next }, false)
  }

  const duplicateLine = (idx: number) => {
    const target = draft.lines[idx]
    const clone = { ...structuredClone(target), id: crypto.randomUUID() }
    const next = [...draft.lines.slice(0, idx + 1), clone, ...draft.lines.slice(idx + 1)]
    change({ lines: next })
  }

  const insertLineAbove = (idx: number) => {
    const fresh = {
      id: crypto.randomUUID(),
      description: '',
      quantity: '1',
      rate: '0',
      unit: 'fixed' as const,
      group: draft.lines[idx]?.group,
    }
    const next = [...draft.lines.slice(0, idx), fresh, ...draft.lines.slice(idx)]
    change({ lines: next })
  }

  const insertLineBelow = (idx: number) => {
    const fresh = {
      id: crypto.randomUUID(),
      description: '',
      quantity: '1',
      rate: '0',
      unit: 'fixed' as const,
      group: draft.lines[idx]?.group,
    }
    const next = [...draft.lines.slice(0, idx + 1), fresh, ...draft.lines.slice(idx + 1)]
    change({ lines: next })
  }

  const moveLine = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= draft.lines.length) return
    const next = [...draft.lines]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    change({ lines: next })
  }

  const handleLineKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, idx: number) => {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      moveLine(idx, idx - 1)
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      moveLine(idx, idx + 1)
    } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      duplicateLine(idx)
    }
  }

  const numberInput = (value: string, onChange: (v: string) => void, props: Record<string, unknown> = {}) => (
    <input
      inputMode="decimal"
      value={value}
      onChange={e => {
        if (/^\d{0,9}(\.\d{0,4})?$/.test(e.target.value)) onChange(e.target.value === '.' ? '0.' : e.target.value || '0')
      }}
      {...props}
    />
  )

  const action = (name: string) => {
    void (async () => {
      try {
        if (editable) await save()
        onAction(name, draft)
      } catch {}
    })()
  }

  // A02: Client selection and precedence resolution
  const handleClientSelect = (clientName: string) => {
    if (!clientName) {
      change({ clientId: '' })
      return
    }
    const client = workspace.clients.find(c => c.name === clientName)
    if (!client) return

    const isPopulated =
      draft.lines.length > 1 ||
      draft.lines.some(l => l.description.trim() || Number(l.rate) > 0) ||
      draft.currency !== workspace.business.currency ||
      draft.terms !== workspace.business.terms

    if (!isPopulated) {
      // Clean draft: directly apply client defaults
      const targetCurrency = client.currency || workspace.business.currency
      const targetTerms = client.terms ?? workspace.business.terms
      const targetTemplate = client.template || workspace.business.template
      change({
        clientId: client.id,
        client: structuredClone(client),
        terms: targetTerms,
        dueDate: addDays(draft.issueDate, targetTerms),
        manualDue: false,
        currency: targetCurrency,
        template: targetTemplate,
        projectId: '',
      })
    } else {
      // Populated draft: explain changes and confirm
      setPendingClient(client)
    }
  }

  const applyClientDefaults = (client: Client, recalculateRates: boolean) => {
    const targetCurrency = client.currency || workspace.business.currency
    const targetTerms = client.terms ?? workspace.business.terms
    const targetTemplate = client.template || workspace.business.template

    let nextLines = draft.lines
    if (recalculateRates && client.rateOverrides) {
      nextLines = draft.lines.map(line => {
        const matched = workspace.services.find(s => s.description === line.description || s.name === line.description)
        if (matched && client.rateOverrides?.[matched.id]) {
          return { ...line, rate: client.rateOverrides[matched.id] }
        }
        return line
      })
    }

    change({
      clientId: client.id,
      client: structuredClone(client),
      terms: targetTerms,
      dueDate: addDays(draft.issueDate, targetTerms),
      manualDue: false,
      currency: targetCurrency,
      template: targetTemplate,
      lines: nextLines,
      projectId: '',
    })
    setPendingClient(null)
  }

  const keepManualOverrides = (client: Client) => {
    change({
      clientId: client.id,
      client: structuredClone(client),
      projectId: '',
    })
    setPendingClient(null)
  }

  // A03: Starter and Create from last invoice actions
  const applyStarter = (starter: Starter) => {
    const freshLines = starter.lines.map(l => ({ ...structuredClone(l), id: crypto.randomUUID() }))
    const replace = draft.lines.length === 1 && !draft.lines[0].description.trim()
    const patch: Partial<Invoice> = {
      lines: replace ? freshLines : [...draft.lines, ...freshLines],
    }
    if (starter.terms !== undefined && !draft.manualDue && draft.terms === workspace.business.terms) {
      patch.terms = starter.terms
      patch.dueDate = addDays(draft.issueDate, starter.terms)
    }
    if (starter.notes && !draft.notes) {
      patch.notes = starter.notes
    }
    change(patch)
    setStartersOpen(false)
  }

  const handleFillFromLast = () => {
    if (!draft.clientId) return
    try {
      const fromLast = createFromLastInvoice(workspace, draft.clientId)
      change({
        lines: fromLast.lines,
        tax: fromLast.tax,
        discount: fromLast.discount,
        discountType: fromLast.discountType,
        notes: fromLast.notes || draft.notes,
        terms: fromLast.terms,
        dueDate: addDays(draft.issueDate, fromLast.terms),
        template: fromLast.template,
        accent: fromLast.accent,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load last invoice')
    }
  }

  // A04: Tabular paste handling
  const tabularParsed = parseTabularLines(tabularText)

  const handleInsertTabular = () => {
    if (!tabularParsed.valid.length) return
    const next = tabularMode === 'replace' ? tabularParsed.valid : [...draft.lines, ...tabularParsed.valid]
    change({ lines: next })
    setTabularOpen(false)
    setTabularText('')
  }

  const t = totals(draft, workspace.creditNotes)
  const appliedCreditNotes = (workspace.creditNotes || []).filter(cn => cn.invoiceId === invoice.id)
  const clientHasHistory =
    Boolean(draft.clientId) && workspace.invoices.some(i => i.clientId === draft.clientId && i.id !== draft.id)

  async function downloadCreditNote(cn: CreditNote) {
    try {
      const { renderCreditNotePDF, filenameCreditNote } = await import('../../shared/pdf')
      const font = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer())
      const bytes = await renderCreditNotePDF(cn, workspace.business, font)
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameCreditNote(cn)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credit note download failed')
    }
  }

  return (
    <>
      {invoice.replacementOf && (
        <div className="p-3 mb-4 rounded-xl bg-lime-500/10 border border-lime-500/30 text-xs text-lime-800 dark:text-lime-300">
          This draft is a replacement created following a credit note on invoice{' '}
          <strong>{workspace.invoices.find(x => x.id === invoice.replacementOf)?.number || 'original invoice'}</strong>.
        </div>
      )}
      {invoice.convertedFromQuoteNumber && (
        <div className="p-3 mb-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
          <span>
            This draft was converted from Quote <strong>{invoice.convertedFromQuoteNumber}</strong>.
          </span>
          <Badge className="bg-blue-500/20 text-blue-800 dark:text-blue-300">
            From Quote
          </Badge>
        </div>
      )}
      {draft.reservedWorkEntryIds && draft.reservedWorkEntryIds.length > 0 && (
        <div className="p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div>
            <strong>Reserved billable work:</strong> This draft reserves {draft.reservedWorkEntryIds.length} work {draft.reservedWorkEntryIds.length === 1 ? 'entry' : 'entries'}. {editable ? 'Issuing will atomically mark them as billed.' : 'These entries are billed.'}
          </div>
          {editable && (
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5 h-auto"
              onClick={async () => {
                try {
                  await onCommand({ type: 'releaseWorkEntries', draftId: draft.id })
                  change({ reservedWorkEntryIds: undefined })
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not release reservation')
                }
              }}
            >
              Release reservation
            </Button>
          )}
        </div>
      )}
      {draft.reservedMilestoneId && (
        <div className="p-3 mb-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-800 dark:text-purple-300 flex items-center justify-between flex-wrap gap-2">
          <div>
            <strong>Reserved project milestone:</strong> This draft is reserved for a project milestone. {editable ? 'Issuing will atomically mark the milestone as billed.' : 'This milestone is billed.'}
          </div>
          {editable && (
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5 h-auto"
              onClick={async () => {
                try {
                  await onCommand({ type: 'releaseMilestone', draftId: draft.id })
                  change({ reservedMilestoneId: undefined })
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not release reservation')
                }
              }}
            >
              Release reservation
            </Button>
          )}
        </div>
      )}
      {editingIssued && (
        <div className="p-3.5 mb-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span>✏️</span> Editing issued invoice {invoice.number}
            </p>
            <p className="text-[11px] text-blue-800 dark:text-blue-400">
              You can modify line items, client address, notes, payment terms, or discounts. Saved edits will immediately update the live preview, PDF, and delivery email for resending.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-xs h-7 py-0 px-2.5"
              onClick={() => {
                setDraft(invoice)
                setSaved(JSON.stringify(invoice))
                setEditingIssued(false)
                setError('')
              }}
            >
              Cancel editing
            </Button>
            <StateButton
              variant="secondary"
              className="text-xs h-7 py-0 px-3"
              disabled={!dirty}
              saving={saving}
              onClick={() => save()}
              idleText="Save changes"
              savingText="Saving..."
              savedText="Saved!"
            />
            <StateButton
              variant="primary"
              className="text-xs h-7 py-0 px-3"
              disabled={saving}
              onClick={async () => {
                try {
                  if (dirty) await save()
                  setEditingIssued(false)
                  onAction('email', draft)
                } catch {}
              }}
              idleIcon={<Send size={12} animateOnHover className="mr-1 inline" />}
              idleText="Save & resend"
              savingText="Saving..."
              savedText="Saved!"
            />
          </div>
        </div>
      )}
      <div className="page-heading">
        <div>
          <div className="flex gap-2 items-center flex-wrap">
            <p className="eyebrow">{invoice.number || 'New invoice'}</p>
            <Badge>{invoice.lifecycle}</Badge>
            {hasBeenSent && (
              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
                Sent {sentMessages.length > 1 ? `(${sentMessages.length}x)` : ''}
              </Badge>
            )}
            {appliedCreditNotes.length > 0 && (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Credited ({money(t.credited, invoice.currency)})
              </Badge>
            )}
          </div>
          <h1>{invoice.lifecycle === 'draft' ? 'Make the boring bit beautiful.' : invoice.client.name}</h1>
          <p className="muted" role="status">
            {invoice.lifecycle === 'issued' && !editingIssued
              ? hasBeenSent
                ? `Issued and sent (${sentMessages[0]?.created ? new Date(sentMessages[0].created).toLocaleDateString() : 'sent'}). Click "Edit invoice to resend" to update details.`
                : 'Issued details are preserved. Click "Edit invoice" to make updates.'
              : error
                ? 'Changes need attention'
                : saving
                  ? 'Saving…'
                  : dirty
                    ? navigator.onLine
                      ? 'Unsaved changes'
                      : 'Offline · edits kept on this device'
                    : 'All changes saved'}
          </p>
        </div>
        <div className="actions">
          <Button onClick={() => action('duplicate')}>
            <Copy size={13} animateOnHover className="mr-1 inline" />
            Duplicate
          </Button>
          <Button onClick={() => setPreview(v => !v)} className="mobile-preview">
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={() => void download()}>
            <Download size={13} animateOnHover className="mr-1 inline" />
            Download PDF
          </Button>
          {invoice.lifecycle === 'draft' ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete draft invoice?',
                    description: 'Are you sure you want to delete this unissued draft? All draft changes will be discarded.',
                    confirmText: 'Delete draft',
                    confirmVariant: 'danger',
                  })
                  if (ok) {
                    try {
                      await onCommand({ type: 'deleteDraft', id: invoice.id })
                      localStorage.removeItem(recoveryKey)
                      action('deleted')
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Could not delete draft')
                    }
                  }
                }}
              >
                <Trash2 size={13} animateOnHover className="mr-1 inline" />
                Delete draft
              </Button>
              <Button variant="primary" onClick={() => setReviewOpen(true)} disabled={saving}>
                Review & issue <ArrowRight size={13} animateOnHover className="ml-1 inline" />
              </Button>
            </>
          ) : (
            invoice.lifecycle === 'issued' && (
              <>
                {editingIssued ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDraft(invoice)
                        setSaved(JSON.stringify(invoice))
                        setEditingIssued(false)
                        setError('')
                      }}
                    >
                      Cancel editing
                    </Button>
                    <StateButton
                      variant="secondary"
                      disabled={!dirty}
                      saving={saving}
                      onClick={() => save()}
                      idleText="Save changes"
                      savingText="Saving..."
                      savedText="Saved!"
                    />
                    <StateButton
                      variant="primary"
                      disabled={saving}
                      onClick={async () => {
                        try {
                          if (dirty) await save()
                          setEditingIssued(false)
                          onAction('email', draft)
                        } catch {}
                      }}
                      idleIcon={<Send size={13} animateOnHover className="mr-1 inline" />}
                      idleText="Save & resend"
                      savingText="Saving..."
                      savedText="Saved!"
                    />
                  </>
                ) : (
                  <>
                    <Button onClick={() => setEditingIssued(true)}>
                      <Sparkles size={13} animateOnHover className="mr-1 inline" />
                      {hasBeenSent ? 'Edit invoice to resend' : 'Edit invoice'}
                    </Button>
                    <Button onClick={() => setCorrectionOpen(true)}>
                      Correct invoice / Credit
                    </Button>
                    <Button variant="primary" onClick={() => action('email')}>
                      <Send size={13} animateOnHover className="mr-1 inline" />
                      {hasBeenSent ? 'Resend invoice' : 'Email invoice'}
                    </Button>
                  </>
                )}
              </>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="alert" role="alert">
          {error}
          <div className="actions mt-3">
            <Button onClick={() => void save().catch(() => {})}>Retry save</Button>
            <StateButton
              variant="secondary"
              onClick={async () => {
                const copy = { ...draft, id: crypto.randomUUID() }
                try {
                  await onCommand({ type: 'draft', value: draftSchema.parse(copy) })
                  localStorage.removeItem(recoveryKey)
                  setError('Recovered as a separate draft. Open it from Invoices.')
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Recovery failed')
                }
              }}
              idleText="Save as another draft"
              savingText="Saving..."
              savedText="Draft saved!"
            />
          </div>
        </div>
      )}

      {invoice.lifecycle === 'void' && (
        <div className="alert" role="status">
          <p className="font-semibold">Invoice Voided</p>
          <p className="text-xs mt-1">
            This invoice has been voided and excluded from receivables. Historical number and audit records are preserved.
          </p>
          {invoice.voidReason && (
            <p className="text-xs mt-1">
              <strong>Reason:</strong> {invoice.voidReason}
            </p>
          )}
        </div>
      )}

      <div className={`editor-grid ${preview ? 'preview-open' : ''}`}>
        <aside className="editor-card">
          <fieldset disabled={!editable} className="space-y-6">
            <section>
              <div className="section-heading">
                <h2>Invoice details</h2>
                {editable && (
                  <StateButton
                    variant="ghost"
                    className="text-xs h-7 py-0 px-2.5"
                    disabled={!dirty}
                    saving={saving}
                    onClick={() => save().catch(() => {})}
                    idleText="Save"
                    savingText="Saving..."
                    savedText="Saved!"
                  />
                )}
              </div>
              <div className="form-grid">
                <Field label="Issue date">
                  <input
                    type="date"
                    value={draft.issueDate}
                    onChange={e =>
                      e.target.value &&
                      change({
                        issueDate: e.target.value,
                        ...(!draft.manualDue ? { dueDate: addDays(e.target.value, draft.terms) } : {}),
                      })
                    }
                  />
                </Field>
                <Field label="Payment terms">
                  <select
                    value={draft.manualDue ? 'custom' : String(draft.terms)}
                    onChange={e =>
                      e.target.value === 'custom'
                        ? change({ manualDue: true })
                        : change({
                            manualDue: false,
                            terms: Number(e.target.value),
                            dueDate: addDays(draft.issueDate, Number(e.target.value)),
                          })
                    }
                  >
                    <option value="0">Due on receipt</option>
                    {[7, 14, 30].map(d => (
                      <option key={d} value={d}>
                        {d} days
                      </option>
                    ))}
                    {![0, 7, 14, 30].includes(draft.terms) && <option value={draft.terms}>{draft.terms} days</option>}
                    <option value="custom">Custom date</option>
                  </select>
                </Field>
                <Field label="Due date" hint={draft.dueDate < draft.issueDate ? 'Due date must not precede issue date' : undefined}>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={e => e.target.value && change({ dueDate: e.target.value, manualDue: true })}
                  />
                </Field>
                <Field label="Currency">
                  <select
                    value={draft.currency}
                    onChange={e => change({ currency: e.target.value as Invoice['currency'] })}
                  >
                    {['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section>
              <div className="section-heading">
                <h2>Bill to</h2>
                {clientHasHistory && editable && (
                  <Button variant="ghost" onClick={handleFillFromLast}>
                    From last invoice
                  </Button>
                )}
              </div>
              <Field label="Saved client">
                <input
                  list="clients-list"
                  placeholder="Search by client name…"
                  value={workspace.clients.find(x => x.id === draft.clientId)?.name || ''}
                  onChange={e => handleClientSelect(e.target.value)}
                />
                <datalist id="clients-list">
                  {workspace.clients.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Client / Company name" hint={!draft.client.name.trim() && error ? 'Client name is required to issue' : undefined}>
                <input
                  value={draft.client.name}
                  onChange={e => change({ client: { ...draft.client, name: e.target.value } })}
                  placeholder="e.g. Acme Studio Ltd"
                />
              </Field>

              {(() => {
                const countryLabels = getCountryFieldLabels(draft.client.country)
                const updateClientField = (field: keyof Client, val: string) => {
                  const updatedClient = { ...draft.client, [field]: val }
                  const formattedAddress = formatClientAddress(updatedClient)
                  change({ client: { ...updatedClient, address: formattedAddress } })
                }
                return (
                  <>
                    <div className="form-grid">
                      <Field label="Primary contact (optional)" hint="Key person or department to address">
                        <input
                          value={draft.client.contact || ''}
                          onChange={e => change({ client: { ...draft.client, contact: e.target.value } })}
                          placeholder="e.g. Sarah Jenkins"
                        />
                      </Field>
                      <Field label="Phone number (optional)">
                        <input
                          type="tel"
                          value={draft.client.phone || ''}
                          onChange={e => change({ client: { ...draft.client, phone: e.target.value } })}
                          placeholder={countryLabels.phonePlaceholder}
                        />
                      </Field>
                    </div>

                    <Field label="Billing email">
                      <input
                        type="email"
                        value={draft.client.email}
                        onChange={e => change({ client: { ...draft.client, email: e.target.value } })}
                        placeholder="accounts@example.com"
                      />
                    </Field>

                    <Field label="Country" hint="Adapts address format and tax identifier labels">
                      <input
                        list="editor-client-countries"
                        value={draft.client.country || ''}
                        onChange={e => {
                          const nextCountry = e.target.value
                          const updatedClient = { ...draft.client, country: nextCountry }
                          const formattedAddress = formatClientAddress(updatedClient)
                          change({ client: { ...updatedClient, address: formattedAddress } })
                        }}
                        placeholder="e.g. United Kingdom"
                      />
                      <datalist id="editor-client-countries">
                        {COMMON_COUNTRIES.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </Field>

                    <Field label="Address line 1">
                      <input
                        value={draft.client.addressLine1 || ''}
                        onChange={e => updateClientField('addressLine1', e.target.value)}
                        placeholder="Street address, building or suite"
                      />
                    </Field>

                    <Field label="Address line 2 (optional)">
                      <input
                        value={draft.client.addressLine2 || ''}
                        onChange={e => updateClientField('addressLine2', e.target.value)}
                        placeholder="Apartment, unit, suite, floor"
                      />
                    </Field>

                    <div className="form-grid three">
                      <Field label="City / Town">
                        <input
                          value={draft.client.city || ''}
                          onChange={e => updateClientField('city', e.target.value)}
                          placeholder="e.g. London"
                        />
                      </Field>
                      <Field label={countryLabels.stateLabel}>
                        <input
                          value={draft.client.state || ''}
                          onChange={e => updateClientField('state', e.target.value)}
                          placeholder={countryLabels.statePlaceholder}
                        />
                      </Field>
                      <Field label={countryLabels.postalCodeLabel}>
                        <input
                          value={draft.client.postalCode || ''}
                          onChange={e => updateClientField('postalCode', e.target.value)}
                          placeholder={countryLabels.postalCodePlaceholder}
                        />
                      </Field>
                    </div>

                    <Field label={countryLabels.taxIdLabel} hint="Client Tax/VAT ID displayed on invoice">
                      <input
                        value={draft.client.taxId || ''}
                        onChange={e => change({ client: { ...draft.client, taxId: e.target.value } })}
                        placeholder={countryLabels.taxIdPlaceholder}
                      />
                    </Field>

                    {!draft.client.addressLine1 && draft.client.address && (
                      <Field label="Legacy unseparated address" hint="This invoice has an older unseparated address. Entering separated fields above will update it.">
                        <textarea
                          rows={2}
                          value={draft.client.address}
                          onChange={e => change({ client: { ...draft.client, address: e.target.value } })}
                        />
                      </Field>
                    )}
                  </>
                )
              })()}
              <Field label="Project">
                <select value={draft.projectId} onChange={e => change({ projectId: e.target.value })}>
                  <option value="">No project</option>
                  {workspace.projects
                    .filter(p => !p.clientId || p.clientId === draft.clientId)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
            </section>

            <section>
              <div className="section-heading">
                <h2>Line items</h2>
                <div className="actions">
                  {lineHistory.length > 0 && (
                    <Button variant="ghost" onClick={undoLines} aria-label="Undo last line edit">
                      ↶ Undo
                    </Button>
                  )}
                  {(workspace.starters || []).length > 0 && (
                    <Button variant="ghost" onClick={() => setStartersOpen(true)}>
                      ★ Starter
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setTabularOpen(true)}>
                    📋 Paste rows
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      change({
                        lines: [
                          ...draft.lines,
                          { id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' },
                        ],
                      })
                    }
                  >
                    + Add
                  </Button>
                </div>
              </div>
              <Field label="Saved service">
                <input
                  list="services-list"
                  placeholder="Search saved services…"
                  onChange={e => {
                    const service = workspace.services.find(s => s.name === e.target.value)
                    if (service) {
                      // Apply client rate override if configured
                      const rate =
                        (draft.client.rateOverrides && draft.client.rateOverrides[service.id]) || service.rate
                      const line = {
                        id: crypto.randomUUID(),
                        description: service.description || service.name,
                        quantity: '1',
                        rate,
                        unit: service.unit,
                      }
                      change({
                        lines: draft.lines.length === 1 && !draft.lines[0].description ? [line] : [...draft.lines, line],
                      })
                      e.target.value = ''
                    }
                  }}
                />
                <datalist id="services-list">
                  {workspace.services.map(s => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </Field>

              {draft.lines.map((line, n) => (
                <div
                  className="line-editor"
                  key={line.id}
                  tabIndex={0}
                  onKeyDown={e => handleLineKeyDown(e, n)}
                  aria-label={`Line item ${n + 1}: ${line.description || 'Untitled'}`}
                >
                  <div className="section-heading">
                    <div className="flex items-center gap-2">
                      <span className="eyebrow">Item {n + 1}</span>
                      {line.group && <span className="group-badge">{line.group}</span>}
                    </div>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        aria-label={`Insert line above item ${n + 1}`}
                        onClick={() => insertLineAbove(n)}
                      >
                        + Above
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Duplicate item ${n + 1}`}
                        onClick={() => duplicateLine(n)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Move item ${n + 1} up`}
                        disabled={n === 0}
                        onClick={() => moveLine(n, n - 1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Move item ${n + 1} down`}
                        disabled={n === draft.lines.length - 1}
                        onClick={() => moveLine(n, n + 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Remove item ${n + 1}`}
                        disabled={draft.lines.length === 1}
                        onClick={() => change({ lines: draft.lines.filter(l => l.id !== line.id) })}
                      >
                        ×
                      </Button>
                    </div>
                  </div>

                  <Field label="Description" hint={!line.description.trim() && error ? 'Description is required to issue' : undefined}>
                    <textarea
                      value={line.description}
                      onChange={e => updateLine(line.id, 'description', e.target.value)}
                      rows={2}
                    />
                  </Field>

                  <div className="form-grid three">
                    <Field label="Qty" hint={Number(line.quantity) <= 0 ? 'Must be > 0' : undefined}>
                      {numberInput(line.quantity, v => updateLine(line.id, 'quantity', v))}
                    </Field>
                    <Field label="Rate">{numberInput(line.rate, v => updateLine(line.id, 'rate', v))}</Field>
                    <Field label="Unit">
                      <select value={line.unit} onChange={e => updateLine(line.id, 'unit', e.target.value)}>
                        <option value="fixed">Fixed</option>
                        <option value="hour">Hours</option>
                        <option value="unit">Units</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Group / phase (optional)" hint="Grouped lines display together with subheadings in preview and PDF.">
                    <input
                      placeholder="e.g. Discovery, Phase 1, Design System"
                      value={line.group || ''}
                      onChange={e => updateLine(line.id, 'group', e.target.value)}
                    />
                  </Field>
                </div>
              ))}
            </section>

            <details>
              <summary>Tax, discounts & deposits</summary>
              <div className="form-grid">
                <Field label="Tax (%)" hint={Number(draft.tax) > 100 ? 'Cannot exceed 100%' : undefined}>
                  {numberInput(draft.tax, v => change({ tax: v }))}
                </Field>
                <Field
                  label="Requested deposit"
                  hint={Number(draft.deposit) > Number(totals(draft).total) ? 'Deposit exceeds total' : undefined}
                >
                  {numberInput(draft.deposit, v => change({ deposit: v }))}
                </Field>
                <Field
                  label="Discount"
                  hint={
                    draft.discountType === 'percent' && Number(draft.discount) > 100
                      ? 'Percentage exceeds 100%'
                      : Number(totals(draft).discount) > Number(totals(draft).subtotal)
                        ? 'Discount exceeds subtotal'
                        : undefined
                  }
                >
                  {numberInput(draft.discount, v => change({ discount: v }))}
                </Field>
                <Field label="Discount type">
                  <select
                    value={draft.discountType}
                    onChange={e => change({ discountType: e.target.value as 'amount' | 'percent' })}
                  >
                    <option value="amount">Fixed amount</option>
                    <option value="percent">Percentage</option>
                  </select>
                </Field>
              </div>
              <div className="section-heading mt-4">
                <h3>Instalments</h3>
                <Button
                  variant="ghost"
                  onClick={() => change({ instalments: [...draft.instalments, { date: draft.dueDate, amount: '0' }] })}
                >
                  + Add
                </Button>
              </div>
              {draft.instalments.map((x, n) => (
                <div className="flex gap-2 mb-2" key={n}>
                  <input
                    aria-label="Instalment date"
                    type="date"
                    value={x.date}
                    onChange={e =>
                      e.target.value &&
                      change({
                        instalments: draft.instalments.map((item, k) => (k === n ? { ...item, date: e.target.value } : item)),
                      })
                    }
                  />
                  {numberInput(
                    x.amount,
                    v =>
                      change({
                        instalments: draft.instalments.map((item, k) => (k === n ? { ...item, amount: v } : item)),
                      }),
                    { 'aria-label': 'Instalment amount' }
                  )}
                  <Button
                    aria-label="Remove instalment"
                    onClick={() => change({ instalments: draft.instalments.filter((_, k) => k !== n) })}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </details>

            <details>
              <summary>Notes, references & breakdown</summary>
              <Field label="Purchase order">
                <input value={draft.po} onChange={e => change({ po: e.target.value })} />
              </Field>
              <Field label="Payment reference">
                <input value={draft.reference} onChange={e => change({ reference: e.target.value })} />
              </Field>
              <Field label="Notes on invoice">
                <textarea rows={3} value={draft.notes} onChange={e => change({ notes: e.target.value })} />
              </Field>
              <Field label="Detailed work breakdown" hint="Downloaded as a separate document and included when emailing.">
                <textarea rows={6} value={draft.breakdown} onChange={e => change({ breakdown: e.target.value })} />
              </Field>
            </details>

            <details>
              <summary>Template & appearance</summary>
              <div className="template-options">
                {(['studio', 'minimal', 'classic'] as const).map(t => (
                  <button
                    type="button"
                    key={t}
                    className={draft.template === t ? 'selected' : ''}
                    onClick={() => change({ template: t })}
                  >
                    <span className={`template-swatch swatch-${t}`} /> {t}
                  </button>
                ))}
              </div>
              <Field label="Accent colour">
                <input type="color" value={draft.accent} onChange={e => change({ accent: e.target.value })} />
              </Field>
            </details>
          </fieldset>

          {/* Private Internal Notes & Attachments (B04) */}
          <details className="panel mt-6" open>
            <summary className="font-semibold text-sm cursor-pointer select-none py-1">
              Internal notes & supporting attachments
            </summary>
            <div className="space-y-4 pt-3">
              <Field
                label="Private internal notes"
                hint="Strictly confidential. Never rendered on invoice PDFs, sent to clients, or exposed in public links."
              >
                {editable ? (
                  <textarea
                    rows={3}
                    placeholder="e.g. Budget approved with client lead, PO pending procurement sign-off, client pays Net 15..."
                    value={draft.internalNotes || ''}
                    onChange={e => change({ internalNotes: e.target.value })}
                  />
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="e.g. Budget approved with client lead, PO pending procurement sign-off, client pays Net 15..."
                      value={issuedInternalNotes}
                      onChange={e => setIssuedInternalNotes(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <StateButton
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        disabled={issuedInternalNotes === (invoice.internalNotes || '')}
                        saving={savingInternalNotes}
                        onClick={() => handleSaveIssuedNotes()}
                        idleText="Save private note"
                        savingText="Saving..."
                        savedText="Note saved!"
                      />
                      {internalNotesNotice && (
                        <span className="text-xs text-lime-600 dark:text-lime-400 font-medium">
                          {internalNotesNotice}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Field>

              <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--soft)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Supporting attachments ({(editable ? (draft.attachments || []) : (invoice.attachments || [])).length})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Attach signed scopes, PO sheets, or timesheets with explicit visibility boundaries.
                    </p>
                  </div>
                  <label className="btn text-xs cursor-pointer inline-flex items-center gap-1.5 py-1 px-2.5 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90">
                    <span>+ Upload attachment</span>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {((editable ? (draft.attachments || []) : (invoice.attachments || [])).length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">
                    No files attached to this invoice yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(editable ? (draft.attachments || []) : (invoice.attachments || [])).map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded bg-background border border-[var(--border)] text-xs gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <strong className="truncate block font-medium">{att.name}</strong>
                            <Badge
                              className={
                                att.visibility === 'client'
                                  ? 'bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/30 text-[10px]'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]'
                              }
                            >
                              {att.visibility === 'client' ? 'Client visible' : 'Private internal'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            {(att.size / 1024).toFixed(1)} KB · Uploaded {att.created}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={att.visibility}
                            onChange={e =>
                              void handleToggleVisibility(
                                att.id,
                                e.target.value as 'client' | 'internal'
                              )
                            }
                            className="text-xs py-1 px-2 border rounded bg-background"
                          >
                            <option value="client">Client visible (Emailed)</option>
                            <option value="internal">Private (Internal only)</option>
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-red-500 hover:text-red-700 p-1"
                            title="Remove attachment"
                            onClick={() => void handleDeleteAttachment(att.id)}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* Sticky Total Bar for Fast Line Entry (A04) */}
          <div className="sticky-total-bar" role="region" aria-label="Running invoice totals">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-semibold">{draft.lines.length} {draft.lines.length === 1 ? 'item' : 'items'}</span>
              <span className="muted">Subtotal: <strong>{money(t.subtotal, draft.currency)}</strong></span>
              {Number(t.discount) > 0 && <span className="muted">Discount: <strong>−{money(t.discount, draft.currency)}</strong></span>}
              {Number(draft.tax) > 0 && <span className="muted">Tax: <strong>{money(t.tax, draft.currency)}</strong></span>}
              <span className="font-bold text-sm">Total: {money(t.total, draft.currency)}</span>
            </div>
            <div className="actions">
              {editable && (
                <StateButton
                  variant="ghost"
                  onClick={() => save().catch(() => {})}
                  disabled={!dirty && !saving}
                  status={saving ? 'saving' : !dirty ? 'saved' : 'idle'}
                  idleText="Save draft"
                  savingText="Saving..."
                  savedText="Saved"
                />
              )}
              {editable && (
                <Button variant="primary" onClick={() => void issue()} disabled={saving}>
                  Issue ↗
                </Button>
              )}
            </div>
          </div>

          {!editable && (
            <section className="space-y-3 mt-6">
              <h2>Manage invoice</h2>
              {invoice.lifecycle === 'issued' && (
                <div className="flex justify-between items-center bg-[var(--soft)] p-3 rounded-xl text-xs mb-3">
                  <div>
                    <span className="muted">Total:</span> <strong>{money(totals(invoice).total, invoice.currency)}</strong>
                  </div>
                  <div>
                    <span className="muted">Paid:</span> <strong>{money(totals(invoice).paid, invoice.currency)}</strong>
                  </div>
                  <div>
                    <span className="muted">Balance:</span>{' '}
                    <strong className="text-lime-700 dark:text-lime-400">{money(totals(invoice).balance, invoice.currency)}</strong>
                  </div>
                </div>
              )}
              <div className="actions">
                {invoice.lifecycle === 'issued' && (
                  <>
                    <Button onClick={() => action('payment')}>Record payment</Button>
                    <Button onClick={() => action('share')}>Share link</Button>
                    <Button onClick={() => action('reminder')}>Reminders</Button>
                  </>
                )}
                {invoice.lifecycle === 'void' && (
                  <Button onClick={() => action('payment')}>View payment history ({invoice.payments.length})</Button>
                )}
                <Button onClick={() => action('schedule')}>Recurring draft</Button>
                <Button onClick={() => action('archive')}>{invoice.archived ? 'Restore' : 'Archive'}</Button>
                {invoice.lifecycle === 'issued' && (
                  <Button variant="danger" onClick={() => action('void')}>
                    Void invoice
                  </Button>
                )}
              </div>
            </section>
          )}

          {draft.breakdown && (
            <Button className="w-full mt-4" onClick={() => void download(true)}>
              ↓ Download breakdown
            </Button>
          )}
        </aside>

        <div className="preview-panel">
          <p className="eyebrow preview-label">Live preview · {draft.currency}</p>
          <InvoicePreview invoice={draft} business={workspace.business} />
        </div>
      </div>

      {/* A02: Client Switching Confirmation Modal */}
      {pendingClient && (
        <Modal
          open={true}
          onClose={() => setPendingClient(null)}
          title={`Switch client to ${pendingClient.name}?`}
          description="This draft already has line items or custom settings. Choose how you want to handle client defaults."
        >
          <div className="space-y-4 text-xs">
            <div className="panel space-y-2">
              <div className="flex justify-between">
                <span className="muted">Currency:</span>
                <span>
                  Current <strong>{draft.currency}</strong> → Client default{' '}
                  <strong>{pendingClient.currency || workspace.business.currency}</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="muted">Payment terms:</span>
                <span>
                  Current <strong>{draft.terms} days</strong> → Client default{' '}
                  <strong>{pendingClient.terms ?? workspace.business.terms} days</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="muted">Template:</span>
                <span>
                  Current <strong>{draft.template}</strong> → Client default{' '}
                  <strong>{pendingClient.template || workspace.business.template}</strong>
                </span>
              </div>
              {pendingClient.rateOverrides && Object.keys(pendingClient.rateOverrides).length > 0 && (
                <div className="flex justify-between">
                  <span className="muted">Service rate overrides:</span>
                  <span>{Object.keys(pendingClient.rateOverrides).length} custom rate(s) configured</span>
                </div>
              )}
            </div>

            <div className="modal-actions flex-col gap-2 sm:flex-row">
              <Button onClick={() => setPendingClient(null)}>Cancel</Button>
              <Button onClick={() => keepManualOverrides(pendingClient)}>
                Keep manual line rates & currency
              </Button>
              <Button variant="primary" onClick={() => applyClientDefaults(pendingClient, true)}>
                Apply client defaults & recalculate rates
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* A04: Tabular Paste Modal */}
      {tabularOpen && (
        <Modal
          open={true}
          onClose={() => setTabularOpen(false)}
          title="Paste lines from spreadsheet"
          description="Copy tabular rows from Excel, Google Sheets or CSV (columns: Description, Quantity, Rate, Unit, Group)."
        >
          <div className="space-y-4">
            <Field label="Paste tabular rows (TSV or CSV)">
              <textarea
                rows={6}
                placeholder={`Brand identity sprint\t1\t1,500.00\tfixed\tBranding\nUI components\t10\t85.00\thour\tFrontend`}
                value={tabularText}
                onChange={e => setTabularText(e.target.value)}
              />
            </Field>

            <div className="flex gap-4 items-center">
              <span className="eyebrow">Import mode:</span>
              <label className="check">
                <input
                  type="radio"
                  name="tabular-mode"
                  checked={tabularMode === 'append'}
                  onChange={() => setTabularMode('append')}
                />
                Append to current lines
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="tabular-mode"
                  checked={tabularMode === 'replace'}
                  onChange={() => setTabularMode('replace')}
                />
                Replace current lines
              </label>
            </div>

            {tabularText.trim() && (
              <div className="table-scroll max-h-56">
                <table className="dashboard-table text-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Group</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Unit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabularParsed.valid.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.group || '-'}</td>
                        <td className="max-w-xs truncate">{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.rate, draft.currency)}</td>
                        <td>{item.unit}</td>
                        <td>
                          <Badge className="bg-lime-100 text-lime-800">Valid</Badge>
                        </td>
                      </tr>
                    ))}
                    {tabularParsed.errors.map((err, idx) => (
                      <tr key={`err-${idx}`} className="bg-red-50 dark:bg-red-950/20">
                        <td>{err.row}</td>
                        <td colSpan={5} className="text-red-600 font-mono text-[11px] truncate">
                          {err.raw}
                        </td>
                        <td>
                          <Badge className="bg-red-100 text-red-800">{err.reason}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <Button onClick={() => setTabularOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!tabularParsed.valid.length}
                onClick={handleInsertTabular}
              >
                Insert {tabularParsed.valid.length} valid {tabularParsed.valid.length === 1 ? 'line' : 'lines'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* A03: Content Starters Modal */}
      {startersOpen && (
        <Modal
          open={true}
          onClose={() => setStartersOpen(false)}
          title="Insert starter bundle"
          description="Choose a reusable multi-line content starter for this invoice."
        >
          <div className="space-y-3">
            {!(workspace.starters || []).length ? (
              <p className="muted">No starters saved yet. Create reusable starter bundles in the Services section.</p>
            ) : (
              (workspace.starters || []).map(s => (
                <article
                  key={s.id}
                  className="panel flex justify-between items-center p-3 hover:bg-[var(--soft)] cursor-pointer"
                  onClick={() => applyStarter(s)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.name}</h3>
                      {s.favourite && <span className="text-amber-500 text-xs">★ Favourite</span>}
                    </div>
                    <p className="muted text-xs">{s.description || `${s.lines.length} items`}</p>
                    {s.terms !== undefined && <p className="fine-print">Default terms: {s.terms} days</p>}
                  </div>
                  <Button variant="ghost">Apply bundle →</Button>
                </article>
              ))
            )}
            <div className="modal-actions">
              <Button onClick={() => setStartersOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {reviewOpen && (
        <ReviewIssueModal
          open={reviewOpen}
          draft={draft}
          workspace={workspace}
          onClose={() => setReviewOpen(false)}
          onIssueAndDownload={async () => {
            await save()
            await onCommand({ type: 'issue', id: draft.id })
            const updated = workspace.invoices.find(x => x.id === draft.id) ?? { ...draft, lifecycle: 'issued' as const }
            await onDownload(updated, false)
          }}
          onIssueAndEmail={async () => {
            await save()
            await onCommand({ type: 'issue', id: draft.id })
            const updated = workspace.invoices.find(x => x.id === draft.id) ?? { ...draft, lifecycle: 'issued' as const }
            onAction('email', updated)
          }}

        />
      )}

      {correctionOpen && (
        <CorrectionModal
          open={correctionOpen}
          invoice={invoice}
          workspace={workspace}
          onClose={() => setCorrectionOpen(false)}
          onCredit={async (reason, lines, tax, replacement) => {
            await onCommand({
              type: 'creditNote',
              invoiceId: invoice.id,
              reason,
              lines,
              tax,
              replacement,
            })
          }}
        />
      )}

      {appliedCreditNotes.length > 0 && (
        <section className="panel mt-6 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold">Credit notes applied ({appliedCreditNotes.length})</h2>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Total credited: {money(t.credited, invoice.currency)} · Adjusted total: {money(t.adjustedTotal, invoice.currency)}
            </span>
          </div>
          <div className="space-y-2">
            {appliedCreditNotes.map(cn => (
              <div
                key={cn.id}
                className="p-3 bg-[var(--soft)] border border-[var(--line)] rounded-xl flex justify-between items-center text-xs"
              >
                <div>
                  <strong className="block text-sm">{cn.number}</strong>
                  <span className="text-[var(--muted)]">Issued {cn.issueDate} · Reason: {cn.reason}</span>
                  {cn.replacementDraftId && (
                    <span className="text-lime-600 dark:text-lime-400 block mt-0.5 font-medium">
                      Linked replacement draft created
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <strong className="text-amber-600 dark:text-amber-400 text-sm">
                    −{money(cn.total, cn.currency)}
                  </strong>
                  <Button variant="ghost" className="text-xs" onClick={() => void downloadCreditNote(cn)}>
                    <Download size={13} animateOnHover className="mr-1 inline" />
                    Download PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="panel mt-6" open={invoice.lifecycle !== 'draft'}>
        <summary className="font-semibold text-sm cursor-pointer select-none py-1">
          Invoice activity & timeline ({buildInvoiceTimeline(invoice, workspace).length} events)
        </summary>
        <ActivityTimeline invoice={invoice} workspace={workspace} />
      </details>
    </>
  )
}

