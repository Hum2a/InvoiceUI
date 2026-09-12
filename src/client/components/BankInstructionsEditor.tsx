import { useState, useEffect, useMemo } from 'react'
import {
  BANK_CATALOG,
  findBank,
  formatSortCode,
  formatAccountNumber,
  formatBankInstructions,
  parseExistingBankString,
  type BankOption,
  type StructuredBankDetails,
} from '../../shared/banks'
import type { Business } from '../../shared/domain'
import { Field, Button, Badge } from './ui'
import { BankLogo } from './ui/BankLogo'
import { Copy, Check, Sparkles } from './ui/AnimatedIcon'

interface BankInstructionsEditorProps {
  business: Business
  onChange: (updates: Partial<Business>) => void
}

export function BankInstructionsEditor({
  business,
  onChange,
}: BankInstructionsEditorProps) {
  // Initialize from existing structured fields or parse from raw string if structured fields are missing
  const initialParsed = useMemo(() => {
    if (business.accountNumber || business.sortCode || business.bankId) {
      return {
        bankId: business.bankId,
        bankName: business.bankName,
        accountName: business.accountName,
        accountNumber: business.accountNumber,
        sortCode: business.sortCode,
        iban: business.iban,
        bic: business.bic,
      }
    }
    return parseExistingBankString(business.bank)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [bankId, setBankId] = useState<string>(
    business.bankId || initialParsed.bankId || 'monzo'
  )
  const [bankName, setBankName] = useState<string>(
    business.bankName || initialParsed.bankName || 'Monzo Bank'
  )
  const [accountName, setAccountName] = useState<string>(
    business.accountName || initialParsed.accountName || business.name || ''
  )
  const [sortCode, setSortCode] = useState<string>(
    business.sortCode || initialParsed.sortCode || ''
  )
  const [accountNumber, setAccountNumber] = useState<string>(
    business.accountNumber || initialParsed.accountNumber || ''
  )
  const [iban, setIban] = useState<string>(
    business.iban || initialParsed.iban || ''
  )
  const [bic, setBic] = useState<string>(
    business.bic || initialParsed.bic || ''
  )
  const [notes, setNotes] = useState<string>(
    initialParsed.notes || 'Please quote the invoice number as your payment reference.'
  )
  const [manualMode, setManualMode] = useState<boolean>(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [customDomain, setCustomDomain] = useState<string>('')

  const selectedBank = findBank(bankId) || findBank(bankName)

  // Update parent whenever structured fields change
  const syncChanges = (updated: Partial<StructuredBankDetails>) => {
    const nextBankId = updated.bankId !== undefined ? updated.bankId : bankId
    const nextBankName = updated.bankName !== undefined ? updated.bankName : bankName
    const nextAccountName = updated.accountName !== undefined ? updated.accountName : accountName
    const nextSortCode = updated.sortCode !== undefined ? updated.sortCode : sortCode
    const nextAccountNumber = updated.accountNumber !== undefined ? updated.accountNumber : accountNumber
    const nextIban = updated.iban !== undefined ? updated.iban : iban
    const nextBic = updated.bic !== undefined ? updated.bic : bic
    const nextNotes = updated.notes !== undefined ? updated.notes : notes

    const formatted = formatBankInstructions({
      bankName: nextBankName,
      accountName: nextAccountName,
      sortCode: nextSortCode,
      accountNumber: nextAccountNumber,
      iban: nextIban,
      bic: nextBic,
      notes: nextNotes,
    })

    onChange({
      bank: formatted,
      bankId: nextBankId,
      bankName: nextBankName,
      accountName: nextAccountName,
      sortCode: nextSortCode,
      accountNumber: nextAccountNumber,
      iban: nextIban || undefined,
      bic: nextBic || undefined,
    })
  }

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value
    setBankId(nextId)
    const bank = findBank(nextId)
    if (bank && nextId !== 'custom') {
      setBankName(bank.name)
      syncChanges({ bankId: nextId, bankName: bank.name })
    } else {
      syncChanges({ bankId: nextId })
    }
  }

  const handleSortCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSortCode(e.target.value)
    setSortCode(formatted)
    syncChanges({ sortCode: formatted })
  }

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAccountNumber(e.target.value)
    setAccountNumber(formatted)
    syncChanges({ accountNumber: formatted })
  }

  const handleAccountNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setAccountName(val)
    syncChanges({ accountName: val })
  }

  const handleCopy = (key: string, text: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const isSortCodeValid = /^\d{2}-\d{2}-\d{2}$/.test(sortCode)
  const isAccountValid = /^\d{8,12}$/.test(accountNumber)

  return (
    <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 transition-all duration-200">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BankLogo bankId={bankId} bankName={bankName} size="md" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] leading-none">
              Bank & Settlement Instructions
            </h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              Used for client payments on invoices, PDFs, and client portal
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline cursor-pointer transition-colors"
        >
          {manualMode ? 'Switch to structured fields' : 'Edit raw text manually'}
        </button>
      </div>

      {manualMode ? (
        <div className="space-y-2 pt-2">
          <Field
            label="Raw payment instructions text"
            hint="Free-form instructions rendered directly onto invoices and PDFs."
          >
            <textarea
              rows={6}
              value={business.bank}
              onChange={e => onChange({ bank: e.target.value })}
              className="font-mono text-xs"
            />
          </Field>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                const parsed = parseExistingBankString(business.bank)
                if (parsed.bankId) setBankId(parsed.bankId)
                if (parsed.bankName) setBankName(parsed.bankName)
                if (parsed.sortCode) setSortCode(parsed.sortCode)
                if (parsed.accountNumber) setAccountNumber(parsed.accountNumber)
                if (parsed.accountName) setAccountName(parsed.accountName)
                setManualMode(false)
              }}
              className="text-xs"
            >
              Parse into structured fields
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Bank selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="Select your bank"
              hint="Pulls official bank branding and standard formatting"
            >
              <select
                value={bankId}
                onChange={handleBankSelect}
                className="w-full h-9 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 text-sm font-medium focus:ring-2 focus:ring-[var(--accent)]"
              >
                <optgroup label="Popular UK Banks">
                  {BANK_CATALOG.filter(b => b.category === 'uk').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="International Banks">
                  {BANK_CATALOG.filter(b => b.category === 'international').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  <option value="custom">Other / Custom Bank</option>
                </optgroup>
              </select>
            </Field>

            {bankId === 'custom' ? (
              <Field label="Custom bank name">
                <input
                  type="text"
                  value={bankName}
                  onChange={e => {
                    setBankName(e.target.value)
                    syncChanges({ bankName: e.target.value })
                  }}
                  placeholder="e.g. Silicon Valley Bank"
                  className="w-full h-9 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
                />
              </Field>
            ) : (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--soft)] border border-[var(--line)] text-xs">
                <BankLogo bankId={bankId} bankName={bankName} size="sm" />
                <div className="flex-1">
                  <span className="font-medium text-[var(--ink)] block">
                    {selectedBank?.name || bankName}
                  </span>
                  <span className="text-[var(--muted)] text-[11px]">
                    {selectedBank?.domain ? selectedBank.domain : 'Branded transfer details'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Brand verified
                </span>
              </div>
            )}
          </div>

          {/* Account Name */}
          <Field
            label="Account / Beneficiary name"
            hint="Must match the account name for UK Confirmation of Payee verification."
          >
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={accountName}
                onChange={handleAccountNameChange}
                placeholder="e.g. Acme Studio Ltd"
                className="flex-1 h-9 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
              />
              {business.name && business.name !== accountName && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountName(business.name)
                    syncChanges({ accountName: business.name })
                  }}
                  className="text-xs px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--soft)] hover:bg-[var(--line)] transition-colors whitespace-nowrap text-[var(--ink)]"
                >
                  Use business name
                </button>
              )}
            </div>
          </Field>

          {/* Sort Code & Account Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Sort code"
              hint={
                isSortCodeValid
                  ? '✓ Standard 6-digit UK format'
                  : 'Enter 6 digits (e.g. 04-00-04)'
              }
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={sortCode}
                  onChange={handleSortCodeChange}
                  placeholder={selectedBank?.sortCodeExample || '00-00-00'}
                  maxLength={8}
                  className={`w-full h-9 rounded-md border bg-[var(--bg)] px-3 font-mono text-sm tracking-wider ${
                    isSortCodeValid
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : 'border-[var(--line)] focus:border-[var(--accent)]'
                  }`}
                />
                {isSortCodeValid && (
                  <span className="absolute right-2.5 top-2 text-emerald-600 dark:text-emerald-400 text-xs">
                    <Check size={14} animateOnHover />
                  </span>
                )}
              </div>
            </Field>

            <Field
              label="Account number"
              hint={
                isAccountValid
                  ? '✓ Standard UK account number'
                  : 'Typically 8 digits (up to 12 accepted)'
              }
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={handleAccountNumberChange}
                  placeholder="e.g. 12345678"
                  maxLength={12}
                  className={`w-full h-9 rounded-md border bg-[var(--bg)] px-3 font-mono text-sm tracking-wider ${
                    isAccountValid
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : 'border-[var(--line)] focus:border-[var(--accent)]'
                  }`}
                />
                {isAccountValid && (
                  <span className="absolute right-2.5 top-2 text-emerald-600 dark:text-emerald-400 text-xs">
                    <Check size={14} animateOnHover />
                  </span>
                )}
              </div>
            </Field>
          </div>

          {/* Optional International details (IBAN / BIC) */}
          <details className="group rounded-lg border border-[var(--line)] bg-[var(--soft)] p-3 text-xs">
            <summary className="font-semibold cursor-pointer select-none flex items-center justify-between text-[var(--ink)]">
              <span>International wire details (IBAN & BIC / SWIFT)</span>
              <span className="text-[10px] text-[var(--muted)] group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-[var(--line)]">
              <Field label="IBAN (optional)">
                <input
                  type="text"
                  value={iban}
                  onChange={e => {
                    const val = e.target.value.replace(/\s+/g, '').toUpperCase()
                    setIban(val)
                    syncChanges({ iban: val })
                  }}
                  placeholder="e.g. GB29MONZ04000412345678"
                  className="w-full h-8 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2.5 font-mono text-xs"
                />
              </Field>

              <Field label="BIC / SWIFT (optional)">
                <input
                  type="text"
                  value={bic}
                  onChange={e => {
                    const val = e.target.value.trim().toUpperCase()
                    setBic(val)
                    syncChanges({ bic: val })
                  }}
                  placeholder="e.g. MONZGB2L"
                  className="w-full h-8 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2.5 font-mono text-xs"
                />
              </Field>
            </div>
          </details>

          {/* Live Preview Card */}
          <div className="mt-4 pt-3 border-t border-[var(--line)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} animateOnHover /> Client payment details preview
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                Rendered on invoice & portal
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BankLogo bankId={bankId} bankName={bankName} size="sm" />
                  <span className="font-semibold text-sm text-[var(--ink)]">
                    {bankName || 'Bank Transfer'}
                  </span>
                </div>
                <Badge className="text-[10px]">Faster Payments / BACS</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
                <div className="bg-[var(--card)] p-2 rounded border border-[var(--line)]">
                  <span className="text-[10px] text-[var(--muted)] block font-sans">Account Name</span>
                  <span className="font-medium text-[var(--ink)] truncate block">
                    {accountName || 'Not specified'}
                  </span>
                </div>

                <div className="bg-[var(--card)] p-2 rounded border border-[var(--line)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block font-sans">Sort Code</span>
                    <span className="font-bold text-[var(--ink)] tracking-wider">
                      {sortCode || '00-00-00'}
                    </span>
                  </div>
                  {sortCode && (
                    <button
                      type="button"
                      onClick={() => handleCopy('sortCode', sortCode)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded transition-colors"
                      title="Copy sort code"
                    >
                      {copiedKey === 'sortCode' ? (
                        <Check size={12} />
                      ) : (
                        <Copy size={12} animateOnHover />
                      )}
                    </button>
                  )}
                </div>

                <div className="bg-[var(--card)] p-2 rounded border border-[var(--line)] flex items-center justify-between col-span-2 sm:col-span-1">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block font-sans">Account Number</span>
                    <span className="font-bold text-[var(--ink)] tracking-wider">
                      {accountNumber || '00000000'}
                    </span>
                  </div>
                  {accountNumber && (
                    <button
                      type="button"
                      onClick={() => handleCopy('accountNumber', accountNumber)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded transition-colors"
                      title="Copy account number"
                    >
                      {copiedKey === 'accountNumber' ? (
                        <Check size={12} />
                      ) : (
                        <Copy size={12} animateOnHover />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {(iban || bic) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  {iban && (
                    <div className="bg-[var(--card)] p-1.5 px-2 rounded border border-[var(--line)] truncate">
                      <span className="text-[10px] text-[var(--muted)] mr-1 font-sans">IBAN:</span>
                      <span className="font-medium text-[var(--ink)]">{iban}</span>
                    </div>
                  )}
                  {bic && (
                    <div className="bg-[var(--card)] p-1.5 px-2 rounded border border-[var(--line)] truncate">
                      <span className="text-[10px] text-[var(--muted)] mr-1 font-sans">BIC:</span>
                      <span className="font-medium text-[var(--ink)]">{bic}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-[var(--muted)] pt-1">
                Payment reference: <span className="font-medium text-[var(--ink)]">INV-2026-0001</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
