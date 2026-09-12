import { useState, useEffect } from 'react'
import {
  blankClient,
  money,
  totals,
  status,
  clientAvailableCredit,
  projectFinancials,
  today,
  COMMON_COUNTRIES,
  getCountryFieldLabels,
  formatClientAddress,
  formatAddress,
  type Workspace,
  type Client,
  type Service,
  type Project,
  type Starter,
  type Business,
  type Command,
  type Envelope,
  type CreditNote,
  type ClientPayment,
  type WorkEntry,
  type Milestone,
} from '../../shared/domain'
import { Button, StateButton, type ButtonStatus, Field, Modal, Empty, Badge, useConfirm } from './ui'
import { NumberTicker } from './ui/NumberTicker'
import { PaymentAllocationModal } from './PaymentAllocationModal'
import { RefundModal } from './RefundModal'
import { StatementModal } from './StatementModal'
import { ClientPortalModal } from './ClientPortalModal'
import { BankInstructionsEditor } from './BankInstructionsEditor'
import { Mail } from './ui/AnimatedIcon'

type Props = {
  workspace: Workspace
  owner?: string
  onCommand: (c: Command) => Promise<Envelope>
  onFilter: (kind: string, id: string) => void
  onSelectInvoice?: (id: string) => void
  onCreateInvoice?: (clientId?: string, projectId?: string) => Promise<void>
  onOpenPreview?: (token: string) => void
}

function ClientFormFields({
  client,
  patch,
  defaultCurrency,
  defaultTemplate,
  services,
}: {
  client: Client
  patch: (p: Partial<Client>) => void
  defaultCurrency: string
  defaultTemplate: string
  services: Service[]
}) {
  const countryLabels = getCountryFieldLabels(client.country)

  const handleFieldChange = (field: keyof Client, val: string) => {
    const updated = { ...client, [field]: val }
    const formattedAddress = formatClientAddress(updated)
    patch({ [field]: val, address: formattedAddress })
  }

  return (
    <>
      <Field label="Business / Client name *">
        <input
          required
          value={client.name}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Acme Studio Ltd"
        />
      </Field>

      <div className="form-grid">
        <Field label="Primary contact (optional)" hint="Person or department to address">
          <input
            value={client.contact || ''}
            onChange={e => patch({ contact: e.target.value })}
            placeholder="e.g. Sarah Jenkins"
          />
        </Field>
        <Field label="Phone number (optional)">
          <input
            type="tel"
            value={client.phone || ''}
            onChange={e => patch({ phone: e.target.value })}
            placeholder={countryLabels.phonePlaceholder}
          />
        </Field>
      </div>

      <Field label="Billing email">
        <input
          type="email"
          value={client.email}
          onChange={e => patch({ email: e.target.value })}
          placeholder="accounts@example.com"
        />
      </Field>

      <Field label="Country" hint="Adapts address format and tax identifier labels">
        <input
          list="client-countries-list"
          value={client.country || ''}
          onChange={e => {
            const nextCountry = e.target.value
            const updated = { ...client, country: nextCountry }
            const formattedAddress = formatClientAddress(updated)
            patch({ country: nextCountry, address: formattedAddress })
          }}
          placeholder="e.g. United Kingdom"
        />
        <datalist id="client-countries-list">
          {COMMON_COUNTRIES.map(c => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <Field label="Address line 1">
        <input
          value={client.addressLine1 || ''}
          onChange={e => handleFieldChange('addressLine1', e.target.value)}
          placeholder="Street address, building or suite"
        />
      </Field>

      <Field label="Address line 2 (optional)">
        <input
          value={client.addressLine2 || ''}
          onChange={e => handleFieldChange('addressLine2', e.target.value)}
          placeholder="Apartment, unit, suite, floor"
        />
      </Field>

      <div className="form-grid three">
        <Field label="City / Town">
          <input
            value={client.city || ''}
            onChange={e => handleFieldChange('city', e.target.value)}
            placeholder="e.g. London"
          />
        </Field>
        <Field label={countryLabels.stateLabel}>
          <input
            value={client.state || ''}
            onChange={e => handleFieldChange('state', e.target.value)}
            placeholder={countryLabels.statePlaceholder}
          />
        </Field>
        <Field label={countryLabels.postalCodeLabel}>
          <input
            value={client.postalCode || ''}
            onChange={e => handleFieldChange('postalCode', e.target.value)}
            placeholder={countryLabels.postalCodePlaceholder}
          />
        </Field>
      </div>

      <Field label={countryLabels.taxIdLabel} hint="Included on invoices and receipts for this client">
        <input
          value={client.taxId || ''}
          onChange={e => patch({ taxId: e.target.value })}
          placeholder={countryLabels.taxIdPlaceholder}
        />
      </Field>

      {!client.addressLine1 && client.address && (
        <Field label="Legacy unseparated address" hint="This client has an older unseparated address. Entering separated fields above will update it.">
          <textarea
            rows={2}
            value={client.address}
            onChange={e => patch({ address: e.target.value })}
          />
        </Field>
      )}

      <details className="panel">
        <summary className="text-xs font-semibold">Additional communication & email settings</summary>
        <div className="space-y-3 pt-3">
          <Field label="CC addresses (comma separated)">
            <input
              defaultValue={client.cc.join(', ')}
              onBlur={e =>
                patch({
                  cc: e.target.value
                    .split(',')
                    .map(x => x.trim())
                    .filter(Boolean),
                })
              }
              placeholder="finance@example.com, ops@example.com"
            />
          </Field>
          <Field label="Reply-to (optional)">
            <input
              type="email"
              value={client.replyTo}
              onChange={e => patch({ replyTo: e.target.value })}
              placeholder="custom-reply@example.com"
            />
          </Field>
        </div>
      </details>

      <div className="form-grid">
        <Field label="Default currency (optional)">
          <select
            value={client.currency || ''}
            onChange={e => patch({ currency: (e.target.value as Business['currency']) || undefined })}
          >
            <option value="">Business default ({defaultCurrency})</option>
            {['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'].map(curr => (
              <option key={curr} value={curr}>
                {curr}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default payment terms (days)">
          <input
            type="number"
            min="0"
            max="365"
            value={client.terms}
            onChange={e => patch({ terms: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Preferred template (optional)">
        <select
          value={client.template || ''}
          onChange={e => patch({ template: (e.target.value as Business['template']) || undefined })}
        >
          <option value="">Business default ({defaultTemplate})</option>
          <option value="studio">Studio</option>
          <option value="minimal">Minimal</option>
          <option value="classic">Classic</option>
        </select>
      </Field>

      <Field label="Payment instructions override (optional)" hint="Overrides business bank details on invoices for this client.">
        <textarea
          rows={3}
          value={client.paymentInstructions || ''}
          onChange={e => patch({ paymentInstructions: e.target.value || undefined })}
        />
      </Field>

      {services.length > 0 && (
        <details className="panel">
          <summary className="text-xs font-semibold">Service rate overrides ({Object.keys(client.rateOverrides || {}).length} set)</summary>
          <div className="space-y-3 pt-3">
            <p className="fine-print muted">
              Configure custom rates for this client. When adding saved services in the composer, these rates apply automatically.
            </p>
            {services.map(svc => (
              <Field
                key={svc.id}
                label={`${svc.name} (standard: ${money(svc.rate, defaultCurrency)} / ${svc.unit})`}
              >
                <input
                  inputMode="decimal"
                  placeholder={svc.rate}
                  value={client.rateOverrides?.[svc.id] || ''}
                  onChange={e => {
                    const overrides = { ...(client.rateOverrides || {}) }
                    if (e.target.value) overrides[svc.id] = e.target.value
                    else delete overrides[svc.id]
                    patch({ rateOverrides: Object.keys(overrides).length ? overrides : undefined })
                  }}
                />
              </Field>
            ))}
          </div>
        </details>
      )}

      <Field label="Private notes">
        <textarea value={client.notes} onChange={e => patch({ notes: e.target.value })} />
      </Field>
    </>
  )
}

export function Records({
  kind,
  workspace: w,
  owner,
  onCommand,
  onFilter,
  onSelectInvoice,
  onCreateInvoice,
  onOpenPreview,
}: Props & { kind: 'Clients' | 'Projects' | 'Services' }) {
  const { confirm } = useConfirm()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [value, setValue] = useState<Client | Project | Service | null>(null)
  const [starterValue, setStarterValue] = useState<Starter | null>(null)
  const [serviceSubTab, setServiceSubTab] = useState<'services' | 'starters'>('services')
  const [error, setError] = useState('')
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [refundTargetPayment, setRefundTargetPayment] = useState<ClientPayment | null>(null)
  const [statementClientId, setStatementClientId] = useState<string | null>(null)
  const [portalClientId, setPortalClientId] = useState<string | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [editingWorkEntry, setEditingWorkEntry] = useState<WorkEntry | null>(null)
  const [selectedWorkEntryIds, setSelectedWorkEntryIds] = useState<Set<string>>(new Set())
  const [recordSaveStatus, setRecordSaveStatus] = useState<ButtonStatus>('idle')
  const [starterSaveStatus, setStarterSaveStatus] = useState<ButtonStatus>('idle')
  const [milestoneSaveStatus, setMilestoneSaveStatus] = useState<ButtonStatus>('idle')
  const [workEntrySaveStatus, setWorkEntrySaveStatus] = useState<ButtonStatus>('idle')

  const toggleWorkEntry = (id: string) => {
    setSelectedWorkEntryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function downloadCreditNote(cn: CreditNote) {
    try {
      const { renderCreditNotePDF, filenameCreditNote } = await import('../../shared/pdf')
      const font = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer())
      const bytes = await renderCreditNotePDF(cn, w.business, font)
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

  async function downloadReceipt(paymentId: string) {
    const receipt = (w.receipts || []).find(r => r.paymentId === paymentId)
    if (!receipt) {
      setError('No receipt recorded for this payment.')
      return
    }
    try {
      const { renderReceiptPDF, filenameReceipt } = await import('../../shared/pdf')
      const font = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer())
      const bytes = await renderReceiptPDF(receipt, w.business, font)
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameReceipt(receipt)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receipt download failed')
    }
  }

  const records = kind === 'Clients' ? w.clients : kind === 'Projects' ? w.projects : w.services
  const starters = w.starters || []

  const create = () => {
    setError('')
    if (kind === 'Clients') setValue(blankClient())
    else if (kind === 'Projects') setValue({ id: crypto.randomUUID(), name: '', clientId: '', notes: '' })
    else setValue({ id: crypto.randomUUID(), name: '', description: '', rate: '0', unit: 'fixed' })
  }

  const createStarter = () => {
    setError('')
    setStarterValue({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      favourite: false,
      terms: w.business.terms,
      notes: '',
      lines: [{ id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' }],
    })
  }

  const patch = (p: object) => setValue(v => (v ? { ...v, ...p } : null))
  const patchStarter = (p: Partial<Starter>) => setStarterValue(v => (v ? { ...v, ...p } : null))

  async function save() {
    if (!value) return
    try {
      setRecordSaveStatus('saving')
      await onCommand(
        kind === 'Clients'
          ? { type: 'client', value: value as Client }
          : kind === 'Projects'
            ? { type: 'project', value: value as Project }
            : { type: 'service', value: value as Service }
      )
      setRecordSaveStatus('saved')
      await new Promise(r => setTimeout(r, 600))
      setValue(null)
      setRecordSaveStatus('idle')
    } catch (e) {
      setRecordSaveStatus('error')
      setError(e instanceof Error ? e.message : 'Unable to save')
      setTimeout(() => setRecordSaveStatus('idle'), 2000)
    }
  }

  async function saveStarter() {
    if (!starterValue) return
    try {
      if (!starterValue.name.trim()) throw new Error('Starter name is required')
      if (!starterValue.lines.length) throw new Error('At least one line item is required')
      setStarterSaveStatus('saving')
      await onCommand({ type: 'starter', value: starterValue })
      setStarterSaveStatus('saved')
      await new Promise(r => setTimeout(r, 600))
      setStarterValue(null)
      setStarterSaveStatus('idle')
    } catch (e) {
      setStarterSaveStatus('error')
      setError(e instanceof Error ? e.message : 'Unable to save starter bundle')
      setTimeout(() => setStarterSaveStatus('idle'), 2000)
    }
  }

  async function remove(id: string) {
    try {
      await onCommand(
        kind === 'Clients'
          ? { type: 'deleteClient', id }
          : kind === 'Projects'
            ? { type: 'deleteProject', id }
            : { type: 'deleteService', id }
      )
      setValue(null)
      setSelectedId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete')
    }
  }

  async function removeStarter(id: string) {
    try {
      await onCommand({ type: 'deleteStarter', id })
      setStarterValue(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete starter')
    }
  }

  if (selectedId && kind === 'Clients') {
    const c = w.clients.find(x => x.id === selectedId)
    if (!c) {
      setSelectedId('')
      return null
    }
    const clientInvoices = w.invoices.filter(i => i.clientId === c.id)
    const clientProjects = w.projects.filter(p => p.clientId === c.id)
    const clientCreditNotes = (w.creditNotes || []).filter(cn => cn.clientId === c.id)
    const clientPayments = (w.payments || []).filter(p => p.clientId === c.id)
    const balances: Record<
      string,
      { total: number; credited: number; paid: number; balance: number; unallocated: number }
    > = {}
    for (const inv of clientInvoices.filter(i => i.lifecycle === 'issued')) {
      const t = totals(inv, w.creditNotes)
      balances[inv.currency] ??= { total: 0, credited: 0, paid: 0, balance: 0, unallocated: 0 }
      balances[inv.currency].total += Number(t.total)
      balances[inv.currency].credited += Number(t.credited)
      balances[inv.currency].paid += Number(t.paid)
      balances[inv.currency].balance += Number(t.balance)
    }
    for (const p of clientPayments.filter(p => !p.reversed)) {
      balances[p.currency] ??= { total: 0, credited: 0, paid: 0, balance: 0, unallocated: 0 }
      balances[p.currency].unallocated += Number(p.unallocated || 0)
    }
    const hasUnallocated = Object.values(balances).some(b => b.unallocated > 0)
    const payments = clientInvoices
      .flatMap(inv =>
        inv.payments.map(p => ({
          ...p,
          invoiceId: inv.id,
          invoiceNumber: inv.number || 'Draft',
          currency: inv.currency,
        }))
      )
      .sort((a, b) => b.date.localeCompare(a.date))

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Button variant="ghost" onClick={() => setSelectedId('')}>
            ← Back to clients
          </Button>
          <div className="actions">
            <Button
              onClick={() => {
                setError('')
                setValue(structuredClone(c))
              }}
            >
              Edit client
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete client?',
                  description: `Delete client "${c.name}"? Projects, unbilled entries, and quotes will also be cleaned up.`,
                  confirmText: 'Delete client',
                  confirmVariant: 'danger',
                })
                if (ok) {
                  void remove(c.id)
                }
              }}
            >
              Delete client
            </Button>
            <Button variant="ghost" onClick={() => setStatementClientId(c.id)}>
              Statement of Account
            </Button>
            <Button variant="ghost" onClick={() => setPortalClientId(c.id)}>
              Client Portal
            </Button>
            <Button onClick={() => setAllocationModalOpen(true)}>
              Record payment / Allocate
            </Button>
            <Button variant="primary" onClick={() => onCreateInvoice?.(c.id)}>
              + New invoice for {c.name}
            </Button>
          </div>
        </div>

        <div className="panel flex justify-between items-start flex-wrap gap-6">
          <div className="flex gap-4 items-start">
            <div className="avatar text-lg">{c.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <h1 className="text-2xl font-bold">{c.name}</h1>
              {c.contact && <p className="text-xs font-semibold text-[var(--ink)] mt-0.5">Attn: {c.contact}</p>}
              <p className="muted">{c.email || 'No billing email configured'}</p>
              {c.phone && (
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Tel:{' '}
                  <a href={`tel:${c.phone}`} className="underline hover:text-[var(--ink)]">
                    {c.phone}
                  </a>
                </p>
              )}
              {c.taxId && (
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Tax / VAT ID: <span className="font-mono">{c.taxId}</span>
                </p>
              )}
              {formatClientAddress(c) && (
                <p className="muted whitespace-pre-line mt-2">{formatClientAddress(c)}</p>
              )}
              {c.cc.length > 0 && <p className="fine-print mt-2">CC: {c.cc.join(', ')}</p>}
              {c.replyTo && <p className="fine-print">Reply-to: {c.replyTo}</p>}
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="eyebrow">Payment terms</p>
            <p className="font-semibold">{c.terms === 0 ? 'Due on receipt' : `${c.terms} days`}</p>
            {c.currency && (
              <p className="fine-print mt-1">
                Preferred currency: <strong>{c.currency}</strong>
              </p>
            )}
            {c.template && (
              <p className="fine-print">
                Preferred template: <strong>{c.template}</strong>
              </p>
            )}
            {c.notes && (
              <p className="fine-print max-w-xs text-left whitespace-pre-line mt-2 bg-[var(--soft)] p-2 rounded-lg">
                Notes: {c.notes}
              </p>
            )}
          </div>
        </div>

        {/* Client defaults & rate overrides panel */}
        {(c.paymentInstructions || (c.rateOverrides && Object.keys(c.rateOverrides).length > 0)) && (
          <div className="panel space-y-3">
            <h2 className="text-base font-semibold">Client defaults & custom rates</h2>
            {c.paymentInstructions && (
              <div>
                <p className="eyebrow">Payment instructions override</p>
                <p className="fine-print whitespace-pre-line mt-1 bg-[var(--soft)] p-2 rounded-lg">
                  {c.paymentInstructions}
                </p>
              </div>
            )}
            {c.rateOverrides && Object.keys(c.rateOverrides).length > 0 && (
              <div>
                <p className="eyebrow">Service rate overrides</p>
                <div className="flex gap-2 flex-wrap mt-2">
                  {Object.entries(c.rateOverrides).map(([svcId, customRate]) => {
                    const svc = w.services.find(s => s.id === svcId)
                    return (
                      <span key={svcId} className="badge">
                        {svc ? svc.name : 'Custom service'}: {money(customRate, c.currency || w.business.currency)}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="metrics">
          <div className="metric">
            <p className="eyebrow">Total billed</p>
            {Object.entries(balances).length ? (
              Object.entries(balances).map(([curr, b]) => (
                <p className="metric-value" key={curr}>
                  {money(b.total, curr)}
                </p>
              ))
            ) : (
              <p className="metric-value">{money(0, w.business.currency)}</p>
            )}
            <p className="fine-print">Across issued invoices</p>
          </div>
          <div className="metric">
            <p className="eyebrow">Total paid</p>
            {Object.entries(balances).length ? (
              Object.entries(balances).map(([curr, b]) => (
                <p className="metric-value" key={curr}>
                  {money(b.paid, curr)}
                </p>
              ))
            ) : (
              <p className="metric-value">{money(0, w.business.currency)}</p>
            )}
            <p className="fine-print">Confirmed payments</p>
          </div>
          <div className="metric">
            <p className="eyebrow">Outstanding balance</p>
            {Object.entries(balances).length ? (
              Object.entries(balances).map(([curr, b]) => (
                <p className="metric-value text-lime-700 dark:text-lime-400" key={curr}>
                  {money(b.balance, curr)}
                </p>
              ))
            ) : (
              <p className="metric-value">{money(0, w.business.currency)}</p>
            )}
            <p className="fine-print">Current receivables</p>
          </div>
          {hasUnallocated && (
            <div className="metric">
              <p className="eyebrow">Unapplied credit</p>
              {Object.entries(balances).map(([curr, b]) =>
                b.unallocated > 0 ? (
                  <p className="metric-value text-amber-600 dark:text-amber-400" key={curr}>
                    {money(b.unallocated, curr)}
                  </p>
                ) : null
              )}
              <p className="fine-print">Available for future invoices or refund</p>
            </div>
          )}
        </div>

        {clientProjects.length > 0 && (
          <div className="panel space-y-3">
            <h2 className="text-base font-semibold">Projects ({clientProjects.length})</h2>
            <div className="flex gap-2 flex-wrap">
              {clientProjects.map(p => (
                <span key={p.id} className="badge">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Client billable work log */}
        {(() => {
          const clientWorkEntries = (w.workEntries || []).filter(e => e.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))
          const selectedClientEntries = clientWorkEntries.filter(e => selectedWorkEntryIds.has(e.id))
          return (
            <div className="panel space-y-4">
              <div className="section-heading flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h2>Billable work entries ({clientWorkEntries.length})</h2>
                  <p className="fine-print muted">Logged work and deliverables ready to bill for {c.name}.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedClientEntries.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={async () => {
                        try {
                          const selectedList = selectedClientEntries.map(e => e.id)
                          const res = await onCommand({
                            type: 'billWorkEntries',
                            entryIds: selectedList,
                          })
                          setSelectedWorkEntryIds(new Set())
                          const newDraft = res.data.invoices.find(
                            i => i.lifecycle === 'draft' && i.reservedWorkEntryIds?.some(id => selectedList.includes(id))
                          )
                          if (newDraft) onSelectInvoice?.(newDraft.id)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Could not generate draft from work entries')
                        }
                      }}
                    >
                      Create draft invoice with breakdown ({selectedClientEntries.length} selected)
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingWorkEntry({
                        id: crypto.randomUUID(),
                        clientId: c.id,
                        date: today(w.business.timezone),
                        description: '',
                        quantity: '1',
                        rate: '',
                        unit: 'hour',
                        billable: true,
                        status: 'unbilled',
                        created: today(w.business.timezone),
                        updated: today(w.business.timezone),
                      })
                    }}
                  >
                    + Log work for {c.name}
                  </Button>
                </div>
              </div>
              {!clientWorkEntries.length ? (
                <p className="muted">No work entries logged for this client yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th className="w-10">
                          <span className="sr-only">Select</span>
                        </th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Project</th>
                        <th>Quantity / Unit</th>
                        <th>Rate</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientWorkEntries.map(e => {
                        const lineAmt = Number(e.quantity || 0) * Number(e.rate || 0)
                        const proj = e.projectId ? w.projects.find(p => p.id === e.projectId) : null
                        const reservedDraft = e.reservedDraftId ? w.invoices.find(i => i.id === e.reservedDraftId) : null
                        const billedInv = e.billedInvoiceId ? w.invoices.find(i => i.id === e.billedInvoiceId) : null
                        return (
                          <tr key={e.id}>
                            <td>
                              {e.status === 'unbilled' && e.billable ? (
                                <input
                                  type="checkbox"
                                  checked={selectedWorkEntryIds.has(e.id)}
                                  onChange={() => toggleWorkEntry(e.id)}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td>{e.date}</td>
                            <td>
                              <div className="font-semibold">{e.description}</div>
                              {!e.billable && <Badge className="mt-1">Non-billable</Badge>}
                            </td>
                            <td>{proj ? proj.name : '-'}</td>
                            <td>
                              {e.quantity} {e.unit === 'hour' ? 'hr' : e.unit}
                            </td>
                            <td>{money(e.rate, c.currency || w.business.currency)}</td>
                            <td className="font-semibold">{money(lineAmt, c.currency || w.business.currency)}</td>
                            <td>
                              {e.status === 'unbilled' && <Badge>Unbilled</Badge>}
                              {e.status === 'reserved' && (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                  Reserved in draft
                                </Badge>
                              )}
                              {e.status === 'billed' && (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                  Billed
                                </Badge>
                              )}
                            </td>
                            <td>
                              <div className="actions flex items-center gap-1.5 flex-wrap">
                                {e.status === 'unbilled' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      onClick={() => setEditingWorkEntry(structuredClone(e))}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="danger"
                                      onClick={async () => {
                                        const ok = await confirm({
                                          title: 'Delete work entry?',
                                          description: 'Delete this work entry? This action cannot be undone.',
                                          confirmText: 'Delete entry',
                                          confirmVariant: 'danger',
                                        })
                                        if (ok) {
                                          try {
                                            await onCommand({ type: 'deleteWorkEntry', id: e.id })
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : 'Could not delete entry')
                                          }
                                        }
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </>
                                )}
                                {e.status === 'reserved' && (
                                  <>
                                    {reservedDraft && (
                                      <Button variant="ghost" onClick={() => onSelectInvoice?.(reservedDraft.id)}>
                                        Open draft →
                                      </Button>
                                    )}
                                    <Button
                                      variant="secondary"
                                      onClick={async () => {
                                        try {
                                          await onCommand({
                                            type: 'releaseWorkEntries',
                                            draftId: e.reservedDraftId!,
                                          })
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Could not release reservation')
                                        }
                                      }}
                                    >
                                      Release
                                    </Button>
                                  </>
                                )}
                                {e.status === 'billed' && billedInv && (
                                  <Button variant="ghost" onClick={() => onSelectInvoice?.(billedInv.id)}>
                                    {billedInv.number || 'View invoice'} →
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
              )}
            </div>
          )
        })()}

        <div className="panel space-y-4">
          <div className="section-heading">
            <h2>Related invoices ({clientInvoices.length})</h2>
            <Button variant="ghost" onClick={() => onFilter('Clients', c.id)}>
              View in Invoices tab →
            </Button>
          </div>
          {!clientInvoices.length ? (
            <Empty
              title="No invoices for this client"
              detail="Create an invoice to bill this client."
              action={
                <Button variant="primary" onClick={() => onCreateInvoice?.(c.id)}>
                  + Create invoice
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <button className="invoice-link font-semibold" onClick={() => onSelectInvoice?.(inv.id)}>
                          {inv.number || 'Draft invoice'}
                        </button>
                      </td>
                      <td>
                        <Badge>{status(inv, undefined, w.creditNotes)}</Badge>
                      </td>
                      <td>{inv.issueDate}</td>
                      <td>{inv.dueDate}</td>
                      <td>{money(totals(inv, w.creditNotes).total, inv.currency)}</td>
                      <td>{inv.lifecycle === 'issued' ? money(totals(inv, w.creditNotes).balance, inv.currency) : '-'}</td>
                      <td>
                        <Button variant="ghost" onClick={() => onSelectInvoice?.(inv.id)}>
                          Open →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {clientCreditNotes.length > 0 && (
          <div className="panel space-y-4">
            <div className="section-heading">
              <h2>Credit notes ({clientCreditNotes.length})</h2>
            </div>
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Credit note</th>
                    <th>Date</th>
                    <th>Original invoice</th>
                    <th>Reason</th>
                    <th>Amount credited</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientCreditNotes.map(cn => (
                    <tr key={cn.id}>
                      <td>
                        <span className="font-semibold">{cn.number}</span>
                      </td>
                      <td>{cn.issueDate}</td>
                      <td>{cn.invoiceNumber}</td>
                      <td>
                        <span className="muted">{cn.reason}</span>
                        {cn.replacementDraftId && (
                          <span className="text-lime-600 dark:text-lime-400 block text-xs mt-0.5">
                            Replacement draft created
                          </span>
                        )}
                      </td>
                      <td className="font-semibold text-amber-600 dark:text-amber-400">
                        -{money(cn.total, cn.currency)}
                      </td>
                      <td>
                        <Button variant="ghost" onClick={() => void downloadCreditNote(cn)}>
                          ↓ PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="panel space-y-4">
          <h2>Payment ledger & allocations ({clientPayments.length > 0 ? clientPayments.length : payments.length})</h2>
          {clientPayments.length > 0 ? (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference / notes</th>
                    <th>Total</th>
                    <th>Allocated</th>
                    <th>Unallocated</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientPayments.map(p => {
                    const allocatedSum = p.allocations.reduce((acc, a) => acc + (a.reversed ? 0 : Number(a.amount)), 0)
                    return (
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td>{p.method}</td>
                        <td>
                          <div>
                            {p.reference && <strong>Ref: {p.reference} </strong>}
                            {p.notes && <span className="muted">{p.notes}</span>}
                            {p.refunds && p.refunds.length > 0 && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Refunded:{' '}
                                {money(
                                  p.refunds.reduce((acc, r) => acc + Number(r.amount), 0),
                                  p.currency
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`font-semibold ${p.reversed ? 'line-through opacity-50' : ''}`}>
                          {money(p.amount, p.currency)}
                        </td>
                        <td>{money(allocatedSum, p.currency)}</td>
                        <td>
                          <span className={Number(p.unallocated) > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'muted'}>
                            {money(p.unallocated, p.currency)}
                          </span>
                        </td>
                        <td>{p.reversed ? <Badge>reversed</Badge> : <Badge className="paid">active</Badge>}</td>
                        <td>
                          <div className="flex gap-2">
                            <Button variant="ghost" className="text-xs" onClick={() => void downloadReceipt(p.id)}>
                              ↓ Receipt PDF
                            </Button>
                            {!p.reversed && Number(p.unallocated) > 0 && (
                              <Button variant="ghost" onClick={() => setRefundTargetPayment(p)}>
                                Refund
                              </Button>
                            )}
                            {!p.reversed && (
                              <Button
                                variant="ghost"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Reverse payment?',
                                    description: 'Reverse this client payment? It will restore outstanding invoice balances.',
                                    confirmText: 'Reverse payment',
                                    confirmVariant: 'danger',
                                  })
                                  if (ok) {
                                    void onCommand({ type: 'reverseClientPayment', paymentId: p.id })
                                  }
                                }}
                              >
                                Reverse
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
          ) : !payments.length ? (
            <p className="muted">No payments recorded for this client yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Reference / notes</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td>
                        <button className="invoice-link" onClick={() => onSelectInvoice?.(p.invoiceId)}>
                          {p.invoiceNumber}
                        </button>
                      </td>
                      <td>{p.method}</td>
                      <td>
                        <div>
                          {p.reference && <strong>Ref: {p.reference} </strong>}
                          {p.notes && <span className="muted">{p.notes}</span>}
                        </div>
                      </td>
                      <td>{p.reversed ? <Badge>reversed</Badge> : <Badge className="paid">paid</Badge>}</td>
                      <td className={`font-semibold ${p.reversed ? 'line-through opacity-50' : ''}`}>
                        {money(p.amount, p.currency)}
                      </td>
                      <td>
                        <Button variant="ghost" className="text-xs" onClick={() => void downloadReceipt(p.id)}>
                          ↓ Receipt PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal open={!!value} onClose={() => setValue(null)} title="Edit client">
          {value && (
            <form
              onSubmit={e => {
                e.preventDefault()
                void save()
              }}
              className="space-y-4"
            >
              <ClientFormFields
                client={value as Client}
                patch={patch}
                defaultCurrency={w.business.currency}
                defaultTemplate={w.business.template}
                services={w.services}
              />
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete client?',
                      description: 'Delete this client? Associated projects, unbilled entries, and quotes will also be cleaned up.',
                      confirmText: 'Delete client',
                      confirmVariant: 'danger',
                    })
                    if (ok) void remove(value.id)
                  }}
                >
                  Delete
                </Button>
                <Button onClick={() => setValue(null)}>Cancel</Button>
                <StateButton
                  variant="primary"
                  type="submit"
                  status={recordSaveStatus}
                  idleText="Save client"
                  savingText="Saving client..."
                  savedText="Client saved!"
                />
              </div>
            </form>
          )}
        </Modal>

        {allocationModalOpen && (
          <PaymentAllocationModal
            open={allocationModalOpen}
            client={c}
            workspace={w}
            onClose={() => setAllocationModalOpen(false)}
            onRecordPayment={async (paymentData) => {
              await onCommand({
                type: 'clientPayment',
                value: paymentData,
              })
            }}
          />
        )}

        {refundTargetPayment && (
          <RefundModal
            open={!!refundTargetPayment}
            payment={refundTargetPayment}
            onClose={() => setRefundTargetPayment(null)}
            onRefund={async (refund) => {
              await onCommand({
                type: 'refundPayment',
                paymentId: refundTargetPayment.id,
                refund,
              })
            }}
          />
        )}
      </div>
    )
  }

  if (selectedId && kind === 'Projects') {
    const p = w.projects.find(x => x.id === selectedId)
    if (!p) {
      setSelectedId('')
      return null
    }
    const client = w.clients.find(c => c.id === p.clientId)
    const projectInvoices = w.invoices.filter(i => i.projectId === p.id)
    const fin = projectFinancials(p, w)
    const projectMilestones = (p.milestones || []).slice().sort((a, b) => a.order - b.order)
    const projectWorkEntries = (w.workEntries || []).filter(e => e.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date))
    const payments = projectInvoices
      .flatMap(inv =>
        inv.payments.map(pm => ({
          ...pm,
          invoiceId: inv.id,
          invoiceNumber: inv.number || 'Draft',
          currency: inv.currency,
        }))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Button variant="ghost" onClick={() => setSelectedId('')}>
            ← Back to projects
          </Button>
          <div className="actions">
            <Button
              onClick={() => {
                setError('')
                setValue(structuredClone(p))
              }}
            >
              Edit project
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete project?',
                  description: `Delete project "${p.name}"? This will remove the project record.`,
                  confirmText: 'Delete project',
                  confirmVariant: 'danger',
                })
                if (ok) {
                  void remove(p.id)
                }
              }}
            >
              Delete project
            </Button>
            <Button variant="primary" onClick={() => onCreateInvoice?.(p.clientId, p.id)}>
              + New invoice for {p.name}
            </Button>
          </div>
        </div>
        <div className="panel flex justify-between items-start flex-wrap gap-6">
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <p className="muted">{client ? `Associated with ${client.name}` : 'Independent project'}</p>
            {p.notes && (
              <p className="fine-print whitespace-pre-line mt-3 bg-[var(--soft)] p-3 rounded-lg max-w-md">{p.notes}</p>
            )}
          </div>
          {client && (
            <Button variant="secondary" onClick={() => onFilter('Clients', client.id)}>
              View all {client.name} invoices →
            </Button>
          )}
        </div>
        <div className="metrics">
          <div className="metric">
            <p className="eyebrow">Agreed Value</p>
            <p className="metric-value">
              <NumberTicker value={Number(fin.agreed)} currency={fin.currency} />
            </p>
            <p className="fine-print">Agreed project contract</p>
          </div>
          <div className="metric">
            <p className="eyebrow">Remaining to Bill</p>
            <p className="metric-value text-amber-700 dark:text-amber-400">
              <NumberTicker value={Number(fin.remainingToBill)} currency={fin.currency} />
            </p>
            <p className="fine-print">Uninvoiced project value</p>
          </div>
          <div className="metric">
            <p className="eyebrow">Drafted (Reserved)</p>
            <p className="metric-value">
              <NumberTicker value={Number(fin.drafted)} currency={fin.currency} />
            </p>
            <p className="fine-print">In draft invoices</p>
          </div>
          <div className="metric">
            <p className="eyebrow">Work Invoiced (Net)</p>
            <p className="metric-value">
              <NumberTicker value={Number(fin.issued)} currency={fin.currency} />
            </p>
            <p className="fine-print">
              {Number(fin.credited) > 0 ? `${money(fin.credited, fin.currency)} credited` : 'Issued invoices'}
            </p>
          </div>
          <div className="metric">
            <p className="eyebrow">Cash Received</p>
            <p className="metric-value text-lime-700 dark:text-lime-400">
              <NumberTicker value={Number(fin.received)} currency={fin.currency} />
            </p>
            <p className="fine-print">Confirmed payments</p>
          </div>
        </div>

        {/* Milestones section */}
        <div className="panel space-y-4">
          <div className="section-heading flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2>Project milestones ({projectMilestones.length})</h2>
              <p className="fine-print muted">Structured milestone billing (deposit, progress, and final deliveries) without duplicate charges.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingMilestone({
                  id: crypto.randomUUID(),
                  projectId: p.id,
                  title: '',
                  description: '',
                  amount: '',
                  order: projectMilestones.length + 1,
                  status: 'pending',
                  isDeposit: projectMilestones.length === 0,
                  created: today(w.business.timezone),
                  updated: today(w.business.timezone),
                })
              }}
            >
              + Add milestone
            </Button>
          </div>
          {!projectMilestones.length ? (
            <Empty
              title="No milestones defined"
              detail="Add progress or deposit milestones to track project delivery and bill incrementally."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingMilestone({
                      id: crypto.randomUUID(),
                      projectId: p.id,
                      title: '',
                      description: '',
                      amount: '',
                      order: 1,
                      status: 'pending',
                      isDeposit: true,
                      created: today(w.business.timezone),
                      updated: today(w.business.timezone),
                    })
                  }}
                >
                  + Add first milestone
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Milestone</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMilestones.map(m => {
                    const reservedDraft = m.reservedDraftId ? w.invoices.find(i => i.id === m.reservedDraftId) : null
                    const billedInv = m.billedInvoiceId ? w.invoices.find(i => i.id === m.billedInvoiceId) : null
                    return (
                      <tr key={m.id}>
                        <td>{m.order}</td>
                        <td>
                          <div className="font-semibold flex items-center gap-2">
                            {m.title}
                            {m.isDeposit && (
                              <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300">Deposit</Badge>
                            )}
                          </div>
                          {m.description && <p className="fine-print muted">{m.description}</p>}
                        </td>
                        <td className="font-semibold">{money(m.amount, p.currency || w.business.currency)}</td>
                        <td>
                          {m.status === 'pending' && <Badge>Pending</Badge>}
                          {m.status === 'reserved' && (
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Reserved in draft
                            </Badge>
                          )}
                          {m.status === 'billed' && (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              Billed
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="actions flex items-center gap-1.5 flex-wrap">
                            {m.status === 'pending' && (
                              <>
                                <Button
                                  variant="primary"
                                  onClick={async () => {
                                    try {
                                      const res = await onCommand({
                                        type: 'billMilestone',
                                        milestoneId: m.id,
                                      })
                                      const newDraft = res.data.invoices.find(
                                        i => i.lifecycle === 'draft' && i.reservedMilestoneId === m.id
                                      )
                                      if (newDraft) onSelectInvoice?.(newDraft.id)
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : 'Could not bill milestone')
                                    }
                                  }}
                                >
                                  Bill milestone
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setEditingMilestone(structuredClone(m))}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Delete milestone?',
                                      description: 'Delete this milestone? This action cannot be undone.',
                                      confirmText: 'Delete milestone',
                                      confirmVariant: 'danger',
                                    })
                                    if (ok) {
                                      try {
                                        await onCommand({ type: 'deleteMilestone', id: m.id })
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : 'Could not delete milestone')
                                      }
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                            {m.status === 'reserved' && (
                              <>
                                {reservedDraft && (
                                  <Button variant="ghost" onClick={() => onSelectInvoice?.(reservedDraft.id)}>
                                    Open draft →
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      await onCommand({
                                        type: 'releaseMilestone',
                                        draftId: m.reservedDraftId!,
                                      })
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : 'Could not release reservation')
                                    }
                                  }}
                                >
                                  Release
                                </Button>
                              </>
                            )}
                            {m.status === 'billed' && billedInv && (
                              <Button variant="ghost" onClick={() => onSelectInvoice?.(billedInv.id)}>
                                {billedInv.number || 'View invoice'} →
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
          )}
        </div>

        {/* Billable work log section */}
        <div className="panel space-y-4">
          <div className="section-heading flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2>Billable work entries ({projectWorkEntries.length})</h2>
              <p className="fine-print muted">Log work manually, select unbilled items, and batch into a draft invoice with attached breakdown.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {projectWorkEntries.some(e => selectedWorkEntryIds.has(e.id)) && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      const selectedList = projectWorkEntries.filter(e => selectedWorkEntryIds.has(e.id)).map(e => e.id)
                      const res = await onCommand({
                        type: 'billWorkEntries',
                        entryIds: selectedList,
                      })
                      setSelectedWorkEntryIds(new Set())
                      const newDraft = res.data.invoices.find(
                        i => i.lifecycle === 'draft' && i.reservedWorkEntryIds?.some(id => selectedList.includes(id))
                      )
                      if (newDraft) onSelectInvoice?.(newDraft.id)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not generate draft from work entries')
                    }
                  }}
                >
                  Create draft invoice with breakdown ({projectWorkEntries.filter(e => selectedWorkEntryIds.has(e.id)).length} selected)
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingWorkEntry({
                    id: crypto.randomUUID(),
                    clientId: p.clientId,
                    projectId: p.id,
                    date: today(w.business.timezone),
                    description: '',
                    quantity: '1',
                    rate: '',
                    unit: 'hour',
                    billable: true,
                    status: 'unbilled',
                    created: today(w.business.timezone),
                    updated: today(w.business.timezone),
                  })
                }}
              >
                + Log work
              </Button>
            </div>
          </div>
          {!projectWorkEntries.length ? (
            <Empty
              title="No work logged for this project"
              detail="Log billable hours, units or deliverables manually to generate itemized invoice breakdowns."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingWorkEntry({
                      id: crypto.randomUUID(),
                      clientId: p.clientId,
                      projectId: p.id,
                      date: today(w.business.timezone),
                      description: '',
                      quantity: '1',
                      rate: '',
                      unit: 'hour',
                      billable: true,
                      status: 'unbilled',
                      created: today(w.business.timezone),
                      updated: today(w.business.timezone),
                    })
                  }}
                >
                  + Log first work entry
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Quantity / Unit</th>
                    <th>Rate</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectWorkEntries.map(e => {
                    const lineAmt = Number(e.quantity || 0) * Number(e.rate || 0)
                    const reservedDraft = e.reservedDraftId ? w.invoices.find(i => i.id === e.reservedDraftId) : null
                    const billedInv = e.billedInvoiceId ? w.invoices.find(i => i.id === e.billedInvoiceId) : null
                    return (
                      <tr key={e.id}>
                        <td>
                          {e.status === 'unbilled' && e.billable ? (
                            <input
                              type="checkbox"
                              checked={selectedWorkEntryIds.has(e.id)}
                              onChange={() => toggleWorkEntry(e.id)}
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td>{e.date}</td>
                        <td>
                          <div className="font-semibold">{e.description}</div>
                          {!e.billable && <Badge className="mt-1">Non-billable</Badge>}
                        </td>
                        <td>
                          {e.quantity} {e.unit === 'hour' ? 'hr' : e.unit}
                        </td>
                        <td>{money(e.rate, p.currency || w.business.currency)}</td>
                        <td className="font-semibold">{money(lineAmt, p.currency || w.business.currency)}</td>
                        <td>
                          {e.status === 'unbilled' && <Badge>Unbilled</Badge>}
                          {e.status === 'reserved' && (
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Reserved in draft
                            </Badge>
                          )}
                          {e.status === 'billed' && (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              Billed
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="actions flex items-center gap-1.5 flex-wrap">
                            {e.status === 'unbilled' && (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() => setEditingWorkEntry(structuredClone(e))}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Delete work entry?',
                                      description: 'Delete this work entry? This action cannot be undone.',
                                      confirmText: 'Delete entry',
                                      confirmVariant: 'danger',
                                    })
                                    if (ok) {
                                      try {
                                        await onCommand({ type: 'deleteWorkEntry', id: e.id })
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : 'Could not delete entry')
                                      }
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                            {e.status === 'reserved' && (
                              <>
                                {reservedDraft && (
                                  <Button variant="ghost" onClick={() => onSelectInvoice?.(reservedDraft.id)}>
                                    Open draft →
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      await onCommand({
                                        type: 'releaseWorkEntries',
                                        draftId: e.reservedDraftId!,
                                      })
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : 'Could not release reservation')
                                    }
                                  }}
                                >
                                  Release
                                </Button>
                              </>
                            )}
                            {e.status === 'billed' && billedInv && (
                              <Button variant="ghost" onClick={() => onSelectInvoice?.(billedInv.id)}>
                                {billedInv.number || 'View invoice'} →
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
          )}
        </div>

        <div className="panel space-y-4">
          <div className="section-heading">
            <h2>Project invoices ({projectInvoices.length})</h2>
            <Button variant="ghost" onClick={() => onFilter('Projects', p.id)}>
              View in Invoices tab →
            </Button>
          </div>
          {!projectInvoices.length ? (
            <Empty
              title="No invoices for this project"
              detail="Create an invoice associated with this project."
              action={
                <Button variant="primary" onClick={() => onCreateInvoice?.(p.clientId, p.id)}>
                  + Create invoice
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <button className="invoice-link font-semibold" onClick={() => onSelectInvoice?.(inv.id)}>
                          {inv.number || 'Draft invoice'}
                        </button>
                      </td>
                      <td>
                        <Badge>{status(inv)}</Badge>
                      </td>
                      <td>{inv.issueDate}</td>
                      <td>{inv.dueDate}</td>
                      <td>{money(totals(inv).total, inv.currency)}</td>
                      <td>{inv.lifecycle === 'issued' ? money(totals(inv).balance, inv.currency) : '-'}</td>
                      <td>
                        <Button variant="ghost" onClick={() => onSelectInvoice?.(inv.id)}>
                          Open →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel space-y-4">
          <h2>Payment ledger & history ({payments.length})</h2>
          {!payments.length ? (
            <p className="muted">No payments recorded for this project yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Reference / notes</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(pm => (
                    <tr key={pm.id}>
                      <td>{pm.date}</td>
                      <td>
                        <button className="invoice-link" onClick={() => onSelectInvoice?.(pm.invoiceId)}>
                          {pm.invoiceNumber}
                        </button>
                      </td>
                      <td>{pm.method}</td>
                      <td>
                        <div>
                          {pm.reference && <strong>Ref: {pm.reference} </strong>}
                          {pm.notes && <span className="muted">{pm.notes}</span>}
                        </div>
                      </td>
                      <td>{pm.reversed ? <Badge>reversed</Badge> : <Badge className="paid">paid</Badge>}</td>
                      <td className={`font-semibold ${pm.reversed ? 'line-through opacity-50' : ''}`}>
                        {money(pm.amount, pm.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Modal open={!!value} onClose={() => setValue(null)} title="Edit project">
          {value && (
            <form
              onSubmit={e => {
                e.preventDefault()
                void save()
              }}
              className="space-y-4"
            >
              <Field label="Name">
                <input required value={value.name} onChange={e => patch({ name: e.target.value })} />
              </Field>
              <Field label="Client">
                <select
                  value={(value as Project).clientId}
                  onChange={e => patch({ clientId: e.target.value })}
                >
                  <option value="">No client</option>
                  {w.clients.map(cl => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Private notes">
                <textarea value={(value as Project).notes} onChange={e => patch({ notes: e.target.value })} />
              </Field>
              <Field label="Agreed project value (optional contract amount)">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={(value as Project).agreedAmount || ''}
                  onChange={e => patch({ agreedAmount: e.target.value || undefined })}
                />
              </Field>
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete project?',
                      description: 'Delete this project? This action cannot be undone.',
                      confirmText: 'Delete project',
                      confirmVariant: 'danger',
                    })
                    if (ok) void remove(value.id)
                  }}
                >
                  Delete
                </Button>
                <Button onClick={() => setValue(null)}>Cancel</Button>
                <StateButton
                  variant="primary"
                  type="submit"
                  status={recordSaveStatus}
                  idleText="Save project"
                  savingText="Saving project..."
                  savedText="Project saved!"
                />
              </div>
            </form>
          )}
        </Modal>
      </div>
    )
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>{kind}</h1>
          <p className="muted">
            {kind === 'Clients'
              ? 'The right details, ready for every invoice.'
              : kind === 'Projects'
                ? 'Keep each piece of work together.'
                : 'Your regular work and multi-line starter presets.'}
          </p>
        </div>
        <div className="actions">
          {kind === 'Services' && (
            <Button
              variant={serviceSubTab === 'starters' ? 'primary' : 'secondary'}
              onClick={() => setServiceSubTab(t => (t === 'services' ? 'starters' : 'services'))}
            >
              {serviceSubTab === 'services' ? `View starters (${starters.length})` : 'View services'}
            </Button>
          )}
          <Button variant="primary" onClick={kind === 'Services' && serviceSubTab === 'starters' ? createStarter : create}>
            + Add {kind === 'Services' && serviceSubTab === 'starters' ? 'starter bundle' : kind.slice(0, -1).toLowerCase()}
          </Button>
        </div>
      </div>

      <input
        className="search mb-5"
        aria-label={`Search ${kind}`}
        placeholder={`Search ${kind.toLowerCase()}…`}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {/* Services vs Starters rendering */}
      {kind === 'Services' && serviceSubTab === 'starters' ? (
        !starters.length ? (
          <Empty
            title="No starter bundles yet"
            detail="Save multi-line presets like 'Website sprint' or 'Monthly retainer' to populate drafts instantly."
            action={<Button onClick={createStarter}>Add your first starter bundle</Button>}
          />
        ) : (
          <div className="record-grid">
            {starters
              .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
              .map(s => (
                <article key={s.id} className="record-card">
                  <div className="flex justify-between items-start">
                    <div className="avatar">★</div>
                    {s.favourite && <span className="text-amber-500 font-bold text-xs">Favourite</span>}
                  </div>
                  <h2>{s.name}</h2>
                  <p className="muted">{s.description || `${s.lines.length} items`}</p>
                  {s.terms !== undefined && <p className="fine-print mt-1">Default terms: {s.terms} days</p>}
                  <p className="fine-print">
                    Items:{' '}
                    {s.lines.map(l => l.description || 'Untitled').slice(0, 3).join(', ')}
                    {s.lines.length > 3 ? '...' : ''}
                  </p>
                  <div className="actions mt-5">
                    <Button
                      onClick={() => {
                        setError('')
                        setStarterValue(structuredClone(s))
                      }}
                    >
                      Edit bundle
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void onCommand({
                          type: 'starter',
                          value: { ...s, favourite: !s.favourite },
                        })
                      }
                    >
                      {s.favourite ? '★ Unfavourite' : '☆ Favourite'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete starter bundle?',
                          description: `Delete starter bundle "${s.name}"? It will no longer appear as a preset.`,
                          confirmText: 'Delete bundle',
                          confirmVariant: 'danger',
                        })
                        if (ok) void removeStarter(s.id)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        )
      ) : !records.length ? (
        <Empty
          title={`No ${kind.toLowerCase()} yet`}
          detail="Add your first record to make your next invoice quicker."
          action={<Button onClick={create}>Add your first {kind.slice(0, -1).toLowerCase()}</Button>}
        />
      ) : (
        <div className="record-grid">
          {records
            .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
            .map(r => (
              <article key={r.id} className="record-card">
                <div className="avatar">{r.name.slice(0, 2).toUpperCase()}</div>
                <h2>{r.name}</h2>
                <p className="muted">
                  {'email' in r
                    ? r.email
                    : 'rate' in r
                      ? `${money(r.rate, w.business.currency)} / ${r.unit}`
                      : w.clients.find(c => c.id === r.clientId)?.name || 'Independent project'}
                </p>
                <div className="actions mt-5">
                  {kind !== 'Services' && <Button onClick={() => setSelectedId(r.id)}>View details →</Button>}
                  {kind === 'Clients' && (
                    <Button variant="ghost" onClick={() => setStatementClientId(r.id)}>
                      Statement
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setError('')
                      setValue(structuredClone(r))
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={async () => {
                      const label = kind.slice(0, -1).toLowerCase()
                      const ok = await confirm({
                        title: `Delete ${label}?`,
                        description: `Delete ${label} "${r.name}"? This action cannot be undone.`,
                        confirmText: `Delete ${label}`,
                        confirmVariant: 'danger',
                      })
                      if (ok) void remove(r.id)
                    }}
                  >
                    Delete
                  </Button>
                  {kind !== 'Services' && (
                    <Button variant="ghost" onClick={() => onFilter(kind, r.id)}>
                      Invoices
                    </Button>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}

      {/* Main Record Modal */}
      <Modal
        open={!!value}
        onClose={() => setValue(null)}
        title={`${value && records.some(r => r.id === value.id) ? 'Edit' : 'New'} ${kind.slice(0, -1).toLowerCase()}`}
      >
        {value && (
          <form
            onSubmit={e => {
              e.preventDefault()
              void save()
            }}
            className="space-y-4"
          >
            {'email' in value ? (
              <ClientFormFields
                client={value as Client}
                patch={patch}
                defaultCurrency={w.business.currency}
                defaultTemplate={w.business.template}
                services={w.services}
              />
            ) : (
              <>
                <Field label="Name">
                  <input required value={value.name} onChange={e => patch({ name: e.target.value })} />
                </Field>
                {'clientId' in value && (
                  <Field label="Client">
                    <select value={value.clientId} onChange={e => patch({ clientId: e.target.value })}>
                      <option value="">No client</option>
                      {w.clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {'rate' in value && (
                  <>
                    <Field label="Description">
                      <textarea value={value.description} onChange={e => patch({ description: e.target.value })} />
                    </Field>
                    <div className="form-grid">
                      <Field label="Default rate">
                        <input inputMode="decimal" value={value.rate} onChange={e => patch({ rate: e.target.value })} />
                      </Field>
                      <Field label="Pricing unit">
                        <select value={value.unit} onChange={e => patch({ unit: e.target.value })}>
                          <option value="fixed">Fixed fee</option>
                          <option value="hour">Hour</option>
                          <option value="unit">Unit</option>
                        </select>
                      </Field>
                    </div>
                  </>
                )}
                {'notes' in value && (
                  <Field label="Private notes">
                    <textarea value={value.notes} onChange={e => patch({ notes: e.target.value })} />
                  </Field>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {records.some(r => r.id === value.id) && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${kind.slice(0, -1).toLowerCase()}?`,
                      description: `Are you sure you want to delete this ${kind.slice(0, -1).toLowerCase()}?`,
                      confirmText: 'Delete',
                      confirmVariant: 'danger',
                    })
                    if (ok) void remove(value.id)
                  }}
                >
                  Delete
                </Button>
              )}
              <Button onClick={() => setValue(null)}>Cancel</Button>
              <StateButton
                variant="primary"
                type="submit"
                status={recordSaveStatus}
                idleText={`Save ${kind.slice(0, -1).toLowerCase()}`}
                savingText={`Saving ${kind.slice(0, -1).toLowerCase()}...`}
                savedText={`${kind.slice(0, -1)} saved!`}
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Starter Bundle Modal (A03) */}
      <Modal
        open={!!starterValue}
        onClose={() => setStarterValue(null)}
        title={`${starterValue && starters.some(s => s.id === starterValue.id) ? 'Edit' : 'New'} starter bundle`}
        description="Multi-line bundle preset to quickly populate invoice line items."
      >
        {starterValue && (
          <form
            onSubmit={e => {
              e.preventDefault()
              void saveStarter()
            }}
            className="space-y-4"
          >
            <Field label="Bundle name">
              <input
                required
                placeholder="e.g. Website Sprint, Monthly Maintenance"
                value={starterValue.name}
                onChange={e => patchStarter({ name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                placeholder="What work does this bundle include?"
                value={starterValue.description}
                onChange={e => patchStarter({ description: e.target.value })}
              />
            </Field>

            <div className="form-grid">
              <Field label="Default terms (days, optional)">
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={starterValue.terms ?? ''}
                  onChange={e => patchStarter({ terms: e.target.value ? Number(e.target.value) : undefined })}
                />
              </Field>
              <label className="check mt-6">
                <input
                  type="checkbox"
                  checked={starterValue.favourite ?? false}
                  onChange={e => patchStarter({ favourite: e.target.checked })}
                />
                Mark as favourite preset
              </label>
            </div>

            <Field label="Reusable notes (optional)">
              <textarea
                rows={2}
                value={starterValue.notes || ''}
                onChange={e => patchStarter({ notes: e.target.value || undefined })}
              />
            </Field>

            {/* Line items in starter */}
            <div className="space-y-3">
              <div className="section-heading">
                <h3 className="font-semibold">Line items ({starterValue.lines.length})</h3>
                <Button
                  variant="ghost"
                  onClick={() =>
                    patchStarter({
                      lines: [
                        ...starterValue.lines,
                        { id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' },
                      ],
                    })
                  }
                >
                  + Add line
                </Button>
              </div>

              {starterValue.lines.map((l, idx) => (
                <div key={l.id} className="panel p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="eyebrow">Line {idx + 1}</span>
                    <Button
                      variant="ghost"
                      disabled={starterValue.lines.length === 1}
                      onClick={() =>
                        patchStarter({
                          lines: starterValue.lines.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      × Remove
                    </Button>
                  </div>
                  <Field label="Description">
                    <input
                      required
                      value={l.description}
                      onChange={e =>
                        patchStarter({
                          lines: starterValue.lines.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          ),
                        })
                      }
                    />
                  </Field>
                  <div className="form-grid three">
                    <Field label="Qty">
                      <input
                        inputMode="decimal"
                        value={l.quantity}
                        onChange={e =>
                          patchStarter({
                            lines: starterValue.lines.map((item, i) =>
                              i === idx ? { ...item, quantity: e.target.value } : item
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Rate">
                      <input
                        inputMode="decimal"
                        value={l.rate}
                        onChange={e =>
                          patchStarter({
                            lines: starterValue.lines.map((item, i) =>
                              i === idx ? { ...item, rate: e.target.value } : item
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Unit">
                      <select
                        value={l.unit}
                        onChange={e =>
                          patchStarter({
                            lines: starterValue.lines.map((item, i) =>
                              i === idx ? { ...item, unit: e.target.value as 'fixed' | 'hour' | 'unit' } : item
                            ),
                          })
                        }
                      >
                        <option value="fixed">Fixed</option>
                        <option value="hour">Hour</option>
                        <option value="unit">Unit</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Group / phase (optional)">
                    <input
                      placeholder="e.g. Phase 1, Discovery"
                      value={l.group || ''}
                      onChange={e =>
                        patchStarter({
                          lines: starterValue.lines.map((item, i) =>
                            i === idx ? { ...item, group: e.target.value || undefined } : item
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>

            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {starters.some(s => s.id === starterValue.id) && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete starter bundle?',
                      description: 'Delete this starter bundle? This action cannot be undone.',
                      confirmText: 'Delete starter bundle',
                      confirmVariant: 'danger',
                    })
                    if (ok) void removeStarter(starterValue.id)
                  }}
                >
                  Delete
                </Button>
              )}
              <Button onClick={() => setStarterValue(null)}>Cancel</Button>
              <StateButton
                variant="primary"
                type="submit"
                status={starterSaveStatus}
                idleText="Save starter bundle"
                savingText="Saving bundle..."
                savedText="Bundle saved!"
              />
            </div>
          </form>
        )}
      </Modal>

      {statementClientId && (
        <StatementModal
          workspace={w}
          initialClientId={statementClientId}
          onClose={() => setStatementClientId(null)}
        />
      )}

      {portalClientId && (
        <ClientPortalModal
          workspace={w}
          clientId={portalClientId}
          owner={owner}
          onCommand={onCommand}
          onClose={() => setPortalClientId(null)}
          onOpenPreview={onOpenPreview}
          onRecordPayment={() => {
            setPortalClientId(null)
            setAllocationModalOpen(true)
          }}
        />
      )}

      {editingMilestone && (
        <Modal
          open={!!editingMilestone}
          onClose={() => setEditingMilestone(null)}
          title={w.projects.some(p => (p.milestones || []).some(m => m.id === editingMilestone.id)) ? 'Edit milestone' : 'Add project milestone'}
        >
          <form
            onSubmit={async e => {
              e.preventDefault()
              try {
                const isExisting = w.projects.some(p => (p.milestones || []).some(m => m.id === editingMilestone.id))
                if (isExisting) {
                  await onCommand({
                    type: 'updateMilestone',
                    value: {
                      id: editingMilestone.id,
                      projectId: editingMilestone.projectId,
                      title: editingMilestone.title,
                      description: editingMilestone.description || undefined,
                      amount: editingMilestone.amount,
                      order: Number(editingMilestone.order) || 1,
                      isDeposit: Boolean(editingMilestone.isDeposit),
                    },
                  })
                } else {
                  await onCommand({
                    type: 'createMilestone',
                    value: {
                      id: editingMilestone.id,
                      projectId: editingMilestone.projectId,
                      title: editingMilestone.title,
                      description: editingMilestone.description || undefined,
                      amount: editingMilestone.amount,
                      order: Number(editingMilestone.order) || 1,
                      isDeposit: Boolean(editingMilestone.isDeposit),
                    },
                  })
                }
                setMilestoneSaveStatus('saved')
                await new Promise(r => setTimeout(r, 600))
                setEditingMilestone(null)
                setMilestoneSaveStatus('idle')
              } catch (err) {
                setMilestoneSaveStatus('error')
                setError(err instanceof Error ? err.message : 'Could not save milestone')
                setTimeout(() => setMilestoneSaveStatus('idle'), 2000)
              }
            }}
            className="space-y-4"
          >
            <Field label="Project">
              <select
                value={editingMilestone.projectId}
                onChange={e => setEditingMilestone({ ...editingMilestone, projectId: e.target.value })}
                required
              >
                <option value="">Select project</option>
                {w.projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Milestone title">
              <input
                required
                placeholder="e.g. Deposit / Phase 1 / Final Delivery"
                value={editingMilestone.title}
                onChange={e => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
              />
            </Field>
            <Field label="Amount">
              <input
                required
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={editingMilestone.amount}
                onChange={e => setEditingMilestone({ ...editingMilestone, amount: e.target.value })}
              />
            </Field>
            <Field label="Order index">
              <input
                required
                type="number"
                min="1"
                value={editingMilestone.order}
                onChange={e => setEditingMilestone({ ...editingMilestone, order: parseInt(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                placeholder="Milestone scope or deliverable details"
                value={editingMilestone.description || ''}
                onChange={e => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editingMilestone.isDeposit}
                onChange={e => setEditingMilestone({ ...editingMilestone, isDeposit: e.target.checked })}
              />
              <span>This is an upfront deposit milestone</span>
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            <div className="modal-actions">
              {w.projects.some(p => (p.milestones || []).some(m => m.id === editingMilestone.id)) && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete milestone?',
                      description: 'Delete this milestone? This action cannot be undone.',
                      confirmText: 'Delete milestone',
                      confirmVariant: 'danger',
                    })
                    if (ok) {
                      try {
                        await onCommand({ type: 'deleteMilestone', id: editingMilestone.id })
                        setEditingMilestone(null)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not delete milestone')
                      }
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              <Button onClick={() => setEditingMilestone(null)}>Cancel</Button>
              <StateButton
                variant="primary"
                type="submit"
                status={milestoneSaveStatus}
                idleText="Save milestone"
                savingText="Saving milestone..."
                savedText="Milestone saved!"
              />
            </div>
          </form>
        </Modal>
      )}

      {editingWorkEntry && (
        <Modal
          open={!!editingWorkEntry}
          onClose={() => setEditingWorkEntry(null)}
          title={(w.workEntries || []).some(e => e.id === editingWorkEntry.id) ? 'Edit work entry' : 'Log billable work'}
        >
          <form
            onSubmit={async e => {
              e.preventDefault()
              try {
                const isExisting = (w.workEntries || []).some(e => e.id === editingWorkEntry.id)
                if (isExisting) {
                  await onCommand({
                    type: 'updateWorkEntry',
                    value: {
                      id: editingWorkEntry.id,
                      clientId: editingWorkEntry.clientId,
                      projectId: editingWorkEntry.projectId || undefined,
                      date: editingWorkEntry.date,
                      description: editingWorkEntry.description,
                      quantity: editingWorkEntry.quantity,
                      rate: editingWorkEntry.rate,
                      unit: editingWorkEntry.unit,
                      billable: editingWorkEntry.billable,
                    },
                  })
                } else {
                  await onCommand({
                    type: 'createWorkEntry',
                    value: {
                      id: editingWorkEntry.id,
                      clientId: editingWorkEntry.clientId,
                      projectId: editingWorkEntry.projectId || undefined,
                      date: editingWorkEntry.date,
                      description: editingWorkEntry.description,
                      quantity: editingWorkEntry.quantity,
                      rate: editingWorkEntry.rate,
                      unit: editingWorkEntry.unit,
                      billable: editingWorkEntry.billable,
                    },
                  })
                }
                setWorkEntrySaveStatus('saved')
                await new Promise(r => setTimeout(r, 600))
                setEditingWorkEntry(null)
                setWorkEntrySaveStatus('idle')
              } catch (err) {
                setWorkEntrySaveStatus('error')
                setError(err instanceof Error ? err.message : 'Could not save work entry')
                setTimeout(() => setWorkEntrySaveStatus('idle'), 2000)
              }
            }}
            className="space-y-4"
          >
            <Field label="Client">
              <select
                value={editingWorkEntry.clientId}
                onChange={e => {
                  const newClientId = e.target.value
                  setEditingWorkEntry({
                    ...editingWorkEntry,
                    clientId: newClientId,
                    projectId: '',
                  })
                }}
                required
              >
                <option value="">Select client</option>
                {w.clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project (optional)">
              <select
                value={editingWorkEntry.projectId || ''}
                onChange={e => setEditingWorkEntry({ ...editingWorkEntry, projectId: e.target.value || undefined })}
              >
                <option value="">No specific project</option>
                {w.projects
                  .filter(p => !editingWorkEntry.clientId || p.clientId === editingWorkEntry.clientId)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                required
                value={editingWorkEntry.date}
                onChange={e => setEditingWorkEntry({ ...editingWorkEntry, date: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                placeholder="Work description, deliverable, or task details"
                value={editingWorkEntry.description}
                onChange={e => setEditingWorkEntry({ ...editingWorkEntry, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantity">
                <input
                  required
                  type="number"
                  step="any"
                  min="0.0001"
                  value={editingWorkEntry.quantity}
                  onChange={e => setEditingWorkEntry({ ...editingWorkEntry, quantity: e.target.value })}
                />
              </Field>
              <Field label="Rate">
                <input
                  required
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={editingWorkEntry.rate}
                  onChange={e => setEditingWorkEntry({ ...editingWorkEntry, rate: e.target.value })}
                />
              </Field>
              <Field label="Unit">
                <select
                  value={editingWorkEntry.unit}
                  onChange={e => setEditingWorkEntry({ ...editingWorkEntry, unit: e.target.value as 'hour' | 'fixed' | 'unit' })}
                >
                  <option value="hour">hour</option>
                  <option value="fixed">fixed</option>
                  <option value="unit">unit</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editingWorkEntry.billable}
                onChange={e => setEditingWorkEntry({ ...editingWorkEntry, billable: e.target.checked })}
              />
              <span>Billable to client</span>
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            <div className="modal-actions">
              {(w.workEntries || []).some(e => e.id === editingWorkEntry.id) && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete work entry?',
                      description: 'Delete this work entry? This action cannot be undone.',
                      confirmText: 'Delete work entry',
                      confirmVariant: 'danger',
                    })
                    if (ok) {
                      try {
                        await onCommand({ type: 'deleteWorkEntry', id: editingWorkEntry.id })
                        setEditingWorkEntry(null)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not delete work entry')
                      }
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              <Button onClick={() => setEditingWorkEntry(null)}>Cancel</Button>
              <StateButton
                variant="primary"
                type="submit"
                status={workEntrySaveStatus}
                idleText="Save work entry"
                savingText="Saving work entry..."
                savedText="Work entry saved!"
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export function Settings({
  workspace: w,
  onCommand,
  onExport,
  onOpenEmailDiagnostics,
  emailEnabled = false,
}: Omit<Props, 'onFilter'> & {
  onExport: (zip: boolean) => void
  onOpenEmailDiagnostics?: () => void
  emailEnabled?: boolean
}) {
  const [b, setB] = useState<Business>(w.business)
  const [message, setMessage] = useState('')
  const [businessSaveStatus, setBusinessSaveStatus] = useState<ButtonStatus>('idle')

  useEffect(() => {
    setB(w.business)
  }, [w.business])

  const patch = (p: Partial<Business>) => {
    setMessage('')
    setB(v => ({ ...v, ...p }))
  }

  const countryLabels = getCountryFieldLabels(b.country)

  const handleAddressFieldChange = (field: keyof Business, val: string) => {
    const updated = { ...b, [field]: val }
    const formattedAddress = formatAddress(updated)
    patch({ [field]: val, address: formattedAddress })
  }

  const handleCountryChange = (nextCountry: string) => {
    const updated = { ...b, country: nextCountry }
    const formattedAddress = formatAddress(updated)
    patch({ country: nextCountry, address: formattedAddress })
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Make it yours</p>
          <h1>Business settings</h1>
          <p className="muted">Used for new invoices. Issued documents keep their original details.</p>
        </div>
      </div>
      <form
        className="settings-grid"
        onSubmit={async e => {
          e.preventDefault()
          try {
            setBusinessSaveStatus('saving')
            await onCommand({ type: 'business', value: b })
            setBusinessSaveStatus('saved')
            setMessage('Business details saved.')
            setTimeout(() => setBusinessSaveStatus('idle'), 2500)
          } catch (err) {
            setBusinessSaveStatus('error')
            setMessage(err instanceof Error ? err.message : 'Unable to save settings')
            setTimeout(() => setBusinessSaveStatus('idle'), 2000)
          }
        }}
      >
        <section className="panel space-y-4">
          <h2>Your business</h2>
          <Field label="Business / legal name">
            <input
              required
              value={b.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="e.g. Acme Studio Ltd"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={b.email}
              onChange={e => patch({ email: e.target.value })}
              placeholder="hello@example.com"
            />
          </Field>

          <Field label="Country" hint="Adapts address format and tax identifier labels">
            <input
              list="business-countries-list"
              value={b.country || ''}
              onChange={e => handleCountryChange(e.target.value)}
              placeholder="e.g. United Kingdom"
            />
            <datalist id="business-countries-list">
              {COMMON_COUNTRIES.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="Address line 1">
            <input
              value={b.addressLine1 || ''}
              onChange={e => handleAddressFieldChange('addressLine1', e.target.value)}
              placeholder="Street address, building or suite"
            />
          </Field>

          <Field label="Address line 2 (optional)">
            <input
              value={b.addressLine2 || ''}
              onChange={e => handleAddressFieldChange('addressLine2', e.target.value)}
              placeholder="Apartment, unit, suite, floor"
            />
          </Field>

          <div className="form-grid three">
            <Field label="City / Town">
              <input
                value={b.city || ''}
                onChange={e => handleAddressFieldChange('city', e.target.value)}
                placeholder="e.g. London"
              />
            </Field>
            <Field label={countryLabels.stateLabel}>
              <input
                value={b.state || ''}
                onChange={e => handleAddressFieldChange('state', e.target.value)}
                placeholder={countryLabels.statePlaceholder}
              />
            </Field>
            <Field label={countryLabels.postalCodeLabel}>
              <input
                value={b.postalCode || ''}
                onChange={e => handleAddressFieldChange('postalCode', e.target.value)}
                placeholder={countryLabels.postalCodePlaceholder}
              />
            </Field>
          </div>

          {!b.addressLine1 && b.address && (
            <Field
              label="Legacy unseparated address"
              hint="Your business has an older unseparated address. Entering separated fields above will update it."
            >
              <textarea
                rows={2}
                value={b.address}
                onChange={e => patch({ address: e.target.value })}
              />
            </Field>
          )}

          <Field label="Logo (PNG or JPEG, up to 400KB)">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 400000 || !['image/png', 'image/jpeg'].includes(file.type)) {
                  setMessage('Choose a PNG or JPEG under 400KB')
                  return
                }
                const reader = new FileReader()
                reader.onload = () => patch({ logo: String(reader.result) })
                reader.readAsDataURL(file)
              }}
            />
          </Field>
          {b.logo && (
            <div className="flex items-center gap-4">
              <img src={b.logo} alt="Business logo" className="h-16 max-w-40 object-contain" />
              <Button onClick={() => patch({ logo: '' })}>Remove logo</Button>
            </div>
          )}
          <Field label={countryLabels.taxIdLabel} hint="Displayed on invoices and quotes">
            <input
              value={b.taxId}
              onChange={e => patch({ taxId: e.target.value })}
              placeholder={countryLabels.taxIdPlaceholder}
            />
          </Field>
        </section>

        <section className="panel space-y-4">
          <h2>Payment & invoice defaults</h2>
          <BankInstructionsEditor business={b} onChange={patch} />
          <Field label="Invoice footer">
            <textarea value={b.footer} onChange={e => patch({ footer: e.target.value })} />
          </Field>
          <div className="form-grid">
            <Field label="Currency">
              <select
                value={b.currency}
                onChange={e => patch({ currency: e.target.value as Business['currency'] })}
              >
                {['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'KWD'].map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment terms (days)">
              <input
                type="number"
                min="0"
                max="365"
                value={b.terms}
                onChange={e => patch({ terms: Number(e.target.value) })}
              />
            </Field>
            <Field label="Number prefix">
              <input value={b.prefix} onChange={e => patch({ prefix: e.target.value })} />
            </Field>
            <Field label="Accent colour">
              <input type="color" value={b.accent} onChange={e => patch({ accent: e.target.value })} />
            </Field>
            <Field label="Default template">
              <select
                value={b.template}
                onChange={e => patch({ template: e.target.value as Business['template'] })}
              >
                {['studio', 'minimal', 'classic'].map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <input value={b.timezone} onChange={e => patch({ timezone: e.target.value })} />
            </Field>
          </div>
          <p className="muted">
            Next issued number uses {b.prefix}-YEAR-0001, continuing the existing sequence for that year.
          </p>
        </section>

        <section className="panel space-y-4">
          <h2>Automated follow-ups & reminders</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={b.autoReminders ?? false}
              onChange={e => patch({ autoReminders: e.target.checked })}
            />
            Enable automated overdue reminder sending (opt-in)
          </label>
          <p className="fine-print muted">
            Defaults to off. When enabled, polite overdue reminders are sent automatically to clients with unpaid
            invoices according to each invoice&apos;s reminder schedule. Reminders always recheck outstanding balances
            and lifecycle immediately before sending, and never send to paid, void, or bounced recipients.
          </p>
        </section>

        <div className="settings-footer">
          <p role="status">{message}</p>
          <StateButton
            variant="primary"
            type="submit"
            status={businessSaveStatus}
            idleText="Save business settings"
            savingText="Saving settings..."
            savedText="Settings saved!"
          />
        </div>
      </form>

      <section className="panel mt-6">
        <div className="section-heading">
          <div>
            <h2>Your data, always yours</h2>
            <p className="muted">Export settings, records, invoices, payments and history.</p>
          </div>
          <div className="actions">
            <Button onClick={() => onExport(false)}>Export JSON</Button>
            <Button onClick={() => onExport(true)}>Export with PDFs</Button>
          </div>
        </div>
      </section>

      <section className="panel mt-6">
        <div className="section-heading">
          <div>
            <h2>Developer tools & email deliverability</h2>
            <p className="muted">
              Test outbound email delivery via Resend, verify anti-spam deliverability headers, and preview templates.
            </p>
          </div>
          {onOpenEmailDiagnostics && (
            <div className="actions">
              <Button onClick={onOpenEmailDiagnostics}>
                <Mail size={13} animateOnHover className="mr-1.5 inline" />
                Open email diagnostics
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-xs mt-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">Resend Provider:</span>
            {emailEnabled ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                Connected
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                API Key Missing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <span>Sending Address:</span>
            <code className="text-[11px] font-mono bg-[var(--card)] px-1.5 py-0.5 rounded border border-[var(--line)]">
              invoices@humza.website
            </code>
          </div>
        </div>
      </section>
    </>
  )
}
