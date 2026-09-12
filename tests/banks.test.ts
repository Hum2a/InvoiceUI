import { describe, it, expect } from 'vitest'
import {
  formatSortCode,
  formatAccountNumber,
  formatBankInstructions,
  parseExistingBankString,
  findBank,
  BANK_CATALOG,
} from '../src/shared/banks'
import { businessSchema, emptyWorkspace } from '../src/shared/domain'

describe('Bank Catalog & Utilities', () => {
  it('contains popular UK and international banks with domains and metadata', () => {
    expect(BANK_CATALOG.length).toBeGreaterThan(20)
    const monzo = findBank('monzo')
    expect(monzo).toBeDefined()
    expect(monzo?.name).toBe('Monzo Bank')
    expect(monzo?.domain).toBe('monzo.com')
    expect(monzo?.iconKey).toBe('SiMonzo')

    const barclays = findBank('Barclays')
    expect(barclays).toBeDefined()
    expect(barclays?.id).toBe('barclays')

    const natwest = findBank('natwest')
    expect(natwest).toBeDefined()
    expect(natwest?.domain).toBe('natwest.com')
  })

  it('formats sort code into standard UK XX-XX-XX mask', () => {
    expect(formatSortCode('')).toBe('')
    expect(formatSortCode('040004')).toBe('04-00-04')
    expect(formatSortCode('04-00-04')).toBe('04-00-04')
    expect(formatSortCode('04 00 04')).toBe('04-00-04')
    expect(formatSortCode('12345678')).toBe('12-34-56')
    expect(formatSortCode('04')).toBe('04')
    expect(formatSortCode('0400')).toBe('04-00')
    expect(formatSortCode('04000')).toBe('04-00-0')
  })

  it('formats and cleans account numbers', () => {
    expect(formatAccountNumber('')).toBe('')
    expect(formatAccountNumber('1234 5678')).toBe('12345678')
    expect(formatAccountNumber('1234-5678')).toBe('12345678')
    expect(formatAccountNumber('ABC 12345678 XYZ')).toBe('12345678')
  })

  it('composes clean human-readable bank transfer instructions', () => {
    const instructions = formatBankInstructions({
      bankName: 'Monzo Bank',
      accountName: 'Acme Studio Ltd',
      sortCode: '040004',
      accountNumber: '12345678',
      iban: 'GB29MONZ04000412345678',
      bic: 'MONZGB2L',
      notes: 'Please quote invoice number on payment.',
    })

    expect(instructions).toContain('Bank: Monzo Bank')
    expect(instructions).toContain('Account Name: Acme Studio Ltd')
    expect(instructions).toContain('Sort Code: 04-00-04')
    expect(instructions).toContain('Account Number: 12345678')
    expect(instructions).toContain('IBAN: GB29MONZ04000412345678')
    expect(instructions).toContain('BIC / SWIFT: MONZGB2L')
    expect(instructions).toContain('Please quote invoice number on payment.')
  })

  it('parses existing raw bank instructions text into structured components', () => {
    const raw = `Bank: Barclays
Account Name: Humza Consultancy
Sort Code: 20-00-00
Account Number: 87654321`

    const parsed = parseExistingBankString(raw)
    expect(parsed.bankName).toBe('Barclays')
    expect(parsed.bankId).toBe('barclays')
    expect(parsed.accountName).toBe('Humza Consultancy')
    expect(parsed.sortCode).toBe('20-00-00')
    expect(parsed.accountNumber).toBe('87654321')
  })

  it('supports backwards compatibility in businessSchema with and without structured bank fields', () => {
    const base = emptyWorkspace().business
    // Without structured fields
    const parsed1 = businessSchema.parse(base)
    expect(parsed1.bankName).toBeUndefined()
    expect(parsed1.sortCode).toBeUndefined()

    // With structured fields
    const enriched = {
      ...base,
      bankName: 'Starling Bank',
      bankId: 'starling',
      accountName: 'Design Studio Ltd',
      sortCode: '60-83-71',
      accountNumber: '12345678',
      iban: 'GB33SRLG60837112345678',
      bic: 'SRLGGB2L',
    }
    const parsed2 = businessSchema.parse(enriched)
    expect(parsed2.bankName).toBe('Starling Bank')
    expect(parsed2.bankId).toBe('starling')
    expect(parsed2.sortCode).toBe('60-83-71')
    expect(parsed2.accountNumber).toBe('12345678')
  })
})
