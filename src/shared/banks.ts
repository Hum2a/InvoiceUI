export interface BankOption {
  id: string
  name: string
  category: 'uk' | 'international' | 'custom'
  domain?: string
  iconKey?: 'SiBarclays' | 'SiHsbc' | 'SiMonzo' | 'SiStarlingbank' | 'SiRevolut' | 'SiChase' | 'SiWise' | 'SiBankofamerica' | 'SiDeutschebank' | 'SiCaixabank' | 'SiCommerzbank'
  brandColor: string
  sortCodeExample?: string
}

export const BANK_CATALOG: BankOption[] = [
  // Top UK Banks
  { id: 'monzo', name: 'Monzo Bank', category: 'uk', domain: 'monzo.com', iconKey: 'SiMonzo', brandColor: '#ff4d5a', sortCodeExample: '04-00-04' },
  { id: 'starling', name: 'Starling Bank', category: 'uk', domain: 'starlingbank.com', iconKey: 'SiStarlingbank', brandColor: '#6935ff', sortCodeExample: '60-83-71' },
  { id: 'revolut', name: 'Revolut', category: 'uk', domain: 'revolut.com', iconKey: 'SiRevolut', brandColor: '#0075eb', sortCodeExample: '04-00-75' },
  { id: 'barclays', name: 'Barclays', category: 'uk', domain: 'barclays.co.uk', iconKey: 'SiBarclays', brandColor: '#00aeef', sortCodeExample: '20-00-00' },
  { id: 'hsbc', name: 'HSBC UK', category: 'uk', domain: 'hsbc.co.uk', iconKey: 'SiHsbc', brandColor: '#db0011', sortCodeExample: '40-00-00' },
  { id: 'lloyds', name: 'Lloyds Bank', category: 'uk', domain: 'lloydsbank.com', brandColor: '#006a4e', sortCodeExample: '30-00-00' },
  { id: 'natwest', name: 'NatWest', category: 'uk', domain: 'natwest.com', brandColor: '#4f145b', sortCodeExample: '60-00-01' },
  { id: 'santander', name: 'Santander UK', category: 'uk', domain: 'santander.co.uk', brandColor: '#ec0000', sortCodeExample: '09-01-26' },
  { id: 'chase-uk', name: 'Chase UK', category: 'uk', domain: 'chase.co.uk', iconKey: 'SiChase', brandColor: '#117aca', sortCodeExample: '60-84-07' },
  { id: 'nationwide', name: 'Nationwide Building Society', category: 'uk', domain: 'nationwide.co.uk', brandColor: '#002b66', sortCodeExample: '07-00-93' },
  { id: 'halifax', name: 'Halifax', category: 'uk', domain: 'halifax.co.uk', brandColor: '#003a8f', sortCodeExample: '11-00-01' },
  { id: 'rbs', name: 'Royal Bank of Scotland (RBS)', category: 'uk', domain: 'rbs.co.uk', brandColor: '#0a2540', sortCodeExample: '83-00-00' },
  { id: 'tsb', name: 'TSB Bank', category: 'uk', domain: 'tsb.co.uk', brandColor: '#0019a8', sortCodeExample: '77-00-01' },
  { id: 'metro-bank', name: 'Metro Bank', category: 'uk', domain: 'metrobankonline.co.uk', brandColor: '#e31837', sortCodeExample: '23-05-80' },
  { id: 'co-op', name: 'The Co-operative Bank', category: 'uk', domain: 'co-operativebank.co.uk', brandColor: '#002d72', sortCodeExample: '08-90-00' },
  { id: 'first-direct', name: 'First Direct', category: 'uk', domain: 'firstdirect.com', brandColor: '#1a1a1a', sortCodeExample: '40-47-58' },
  { id: 'bank-of-scotland', name: 'Bank of Scotland', category: 'uk', domain: 'bankofscotland.co.uk', brandColor: '#002e6d', sortCodeExample: '80-00-00' },
  { id: 'virgin-money', name: 'Virgin Money', category: 'uk', domain: 'virginmoney.com', brandColor: '#e10a0a', sortCodeExample: '08-60-01' },
  { id: 'clydesdale', name: 'Clydesdale Bank', category: 'uk', domain: 'cbonline.co.uk', brandColor: '#c8102e', sortCodeExample: '82-00-00' },
  { id: 'wise', name: 'Wise', category: 'uk', domain: 'wise.com', iconKey: 'SiWise', brandColor: '#2ed06e', sortCodeExample: '23-14-70' },
  { id: 'tide', name: 'Tide Business', category: 'uk', domain: 'tide.co', brandColor: '#1d2238', sortCodeExample: '04-06-05' },
  { id: 'coutts', name: 'Coutts & Co', category: 'uk', domain: 'coutts.com', brandColor: '#2b2b2a', sortCodeExample: '18-00-02' },
  { id: 'triodos', name: 'Triodos Bank', category: 'uk', domain: 'triodos.co.uk', brandColor: '#005550', sortCodeExample: '16-58-10' },

  // Leading International Banks
  { id: 'bank-of-america', name: 'Bank of America', category: 'international', domain: 'bankofamerica.com', iconKey: 'SiBankofamerica', brandColor: '#e31837' },
  { id: 'chase-us', name: 'J.P. Morgan Chase (US)', category: 'international', domain: 'chase.com', iconKey: 'SiChase', brandColor: '#117aca' },
  { id: 'citibank', name: 'Citibank', category: 'international', domain: 'citi.com', brandColor: '#003b70' },
  { id: 'wells-fargo', name: 'Wells Fargo', category: 'international', domain: 'wellsfargo.com', brandColor: '#d71e28' },
  { id: 'deutsche-bank', name: 'Deutsche Bank', category: 'international', domain: 'db.com', iconKey: 'SiDeutschebank', brandColor: '#0018a8' },
  { id: 'bnp-paribas', name: 'BNP Paribas', category: 'international', domain: 'group.bnpparibas', brandColor: '#00915a' },
  { id: 'ubs', name: 'UBS', category: 'international', domain: 'ubs.com', brandColor: '#e60000' },
  { id: 'ing', name: 'ING Bank', category: 'international', domain: 'ing.com', brandColor: '#ff6200' },
  { id: 'n26', name: 'N26', category: 'international', domain: 'n26.com', brandColor: '#36a18b' },

  // Custom fallback
  { id: 'custom', name: 'Other / Custom Bank', category: 'custom', brandColor: '#6366f1' },
]

export function findBank(idOrName?: string): BankOption | undefined {
  if (!idOrName) return undefined
  const cleaned = idOrName.trim().toLowerCase()
  return (
    BANK_CATALOG.find(b => b.id.toLowerCase() === cleaned) ||
    BANK_CATALOG.find(b => b.name.toLowerCase() === cleaned) ||
    BANK_CATALOG.find(b => b.domain && b.domain.toLowerCase() === cleaned)
  )
}

/**
 * Format raw string into UK sort code pattern XX-XX-XX
 */
export function formatSortCode(val: string): string {
  if (!val) return ''
  // Strip non-alphanumeric characters
  const raw = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)
  if (raw.length <= 2) return raw
  if (raw.length <= 4) return `${raw.slice(0, 2)}-${raw.slice(2)}`
  return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`
}

/**
 * Format raw string into Account Number (digits only, max 8 digits standard for UK, up to 12 allowed)
 */
export function formatAccountNumber(val: string): string {
  if (!val) return ''
  return val.replace(/\D/g, '').slice(0, 12)
}

export interface StructuredBankDetails {
  bankName?: string
  bankId?: string
  accountName?: string
  accountNumber?: string
  sortCode?: string
  iban?: string
  bic?: string
  bankLogo?: string
  notes?: string
}

/**
 * Generate human-readable bank transfer instructions from structured fields.
 */
export function formatBankInstructions(details: StructuredBankDetails): string {
  const lines: string[] = []

  if (details.bankName?.trim()) {
    lines.push(`Bank: ${details.bankName.trim()}`)
  }
  if (details.accountName?.trim()) {
    lines.push(`Account Name: ${details.accountName.trim()}`)
  }
  if (details.sortCode?.trim()) {
    lines.push(`Sort Code: ${formatSortCode(details.sortCode.trim())}`)
  }
  if (details.accountNumber?.trim()) {
    lines.push(`Account Number: ${details.accountNumber.trim()}`)
  }
  if (details.iban?.trim()) {
    lines.push(`IBAN: ${details.iban.trim().toUpperCase()}`)
  }
  if (details.bic?.trim()) {
    lines.push(`BIC / SWIFT: ${details.bic.trim().toUpperCase()}`)
  }
  if (details.notes?.trim()) {
    lines.push(details.notes.trim())
  }

  return lines.join('\n')
}

/**
 * Attempt to parse existing raw bank instructions text to extract structured values.
 */
export function parseExistingBankString(raw?: string): StructuredBankDetails {
  if (!raw || !raw.trim()) {
    return {}
  }

  const result: StructuredBankDetails = {}
  const text = raw.trim()

  // Match Sort Code (e.g., "Sort Code: 00-11-22" or "Sort: 00 11 22" or "00-11-22")
  const sortCodeMatch = text.match(/(?:sort(?:\s*code)?|s\/c)[:\s]*([0-9]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{2})/i)
  if (sortCodeMatch && sortCodeMatch[1]) {
    result.sortCode = formatSortCode(sortCodeMatch[1])
  }

  // Match Account Number (e.g., "Account Number: 12345678" or "Account: 12345678" or "Acc No: 12345678")
  const accMatch = text.match(/(?:account(?:\s*number|\s*no)?|acc(?:\s*no)?|a\/c)[:\s]*([0-9]{6,12})/i)
  if (accMatch && accMatch[1]) {
    result.accountNumber = accMatch[1].trim()
  }

  // Match Bank Name (e.g., "Bank: Monzo" or "Bank Name: Barclays")
  const bankMatch = text.match(/(?:bank(?:\s*name)?|institution)[:\s]*([^\n\r]+)/i)
  if (bankMatch && bankMatch[1]) {
    const rawBankName = bankMatch[1].trim()
    result.bankName = rawBankName
    const matched = findBank(rawBankName)
    if (matched) {
      result.bankId = matched.id
      result.bankName = matched.name
    }
  } else {
    // Check if any catalog bank name is in the text
    for (const b of BANK_CATALOG) {
      if (b.id !== 'custom' && text.toLowerCase().includes(b.name.toLowerCase())) {
        result.bankId = b.id
        result.bankName = b.name
        break
      }
    }
  }

  // Match Account Name / Beneficiary (e.g., "Account Name: Acme Ltd" or "Beneficiary: Acme Ltd" or "Name: Acme Ltd")
  const nameMatch = text.match(/(?:account\s*name|beneficiary|payee)[:\s]*([^\n\r]+)/i)
  if (nameMatch && nameMatch[1]) {
    result.accountName = nameMatch[1].trim()
  }

  // Match IBAN
  const ibanMatch = text.match(/IBAN[:\s]*([A-Z]{2}[0-9]{2}[A-Z0-9\s]{10,30})/i)
  if (ibanMatch && ibanMatch[1]) {
    result.iban = ibanMatch[1].replace(/\s+/g, '').toUpperCase()
  }

  // Match BIC / SWIFT
  const bicMatch = text.match(/(?:BIC|SWIFT)[:\s]*([A-Z0-9]{8,11})/i)
  if (bicMatch && bicMatch[1]) {
    result.bic = bicMatch[1].trim().toUpperCase()
  }

  return result
}

/**
 * Returns a high-resolution logo URL from unavatar.io for a bank domain,
 * with fallback mechanisms.
 */
export function getBankDomainLogoUrl(domain: string): string {
  return `https://unavatar.io/${encodeURIComponent(domain)}?fallback=false`
}
