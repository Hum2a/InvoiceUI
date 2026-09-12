import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  applyCommand,
  newInvoice,
  calculateOverviewMetrics,
  diffDays,
  getPeriodRange,
  type Workspace,
  type Invoice,
  type Command,
} from '../src/shared/domain'

function cmd(w: Workspace, command: Command): Workspace {
  const next = applyCommand(w, command)
  Object.assign(w, next)
  return w
}

function createTestWorkspace(): Workspace {
  const w = emptyWorkspace()
  w.business = {
    name: 'Acme Advisory Ltd',
    email: 'billing@acme.example',
    address: '100 King Street, London EC2V 8AU',
    bank: 'Bank: NatWest\nAccount: 12345678\nSort Code: 60-00-01',
    currency: 'GBP',
    terms: 14,
    prefix: 'ACM',
    accent: '#bef264',
    template: 'studio',
    timezone: 'Europe/London',
    autoReminders: false,
    taxId: 'GB999888777',
    footer: 'Thank you for your business.',
    logo: '',
    onboardingDismissed: true,
  }
  return w
}

function issueTestInvoice(
  w: Workspace,
  opts: {
    id?: string
    clientName?: string
    issueDate: string
    dueDate: string
    amount: string
    currency?: 'GBP' | 'USD' | 'EUR'
    tax?: string
  }
): Invoice {
  const clientId = crypto.randomUUID()
  const invId = opts.id || crypto.randomUUID()
  const currency = opts.currency || 'GBP'

  cmd(w, {
    type: 'client',
    value: {
      id: clientId,
      name: opts.clientName || 'Test Client',
      email: 'client@example.com',
      address: '1 Main St, London',
      cc: [],
      replyTo: '',
      terms: 14,
      notes: '',
      currency,
    },
  })

  const client = w.clients.find(c => c.id === clientId)!
  const inv = newInvoice(w)
  inv.id = invId
  inv.clientId = clientId
  inv.client = client
  inv.issueDate = opts.issueDate
  inv.dueDate = opts.dueDate
  inv.currency = currency
  inv.lines = [
    {
      id: crypto.randomUUID(),
      description: 'Consulting services',
      quantity: '1',
      rate: opts.amount,
      unit: 'fixed',
    },
  ]
  inv.tax = opts.tax || '0'

  cmd(w, { type: 'draft', value: inv })
  cmd(w, { type: 'issue', id: invId })

  return w.invoices.find(i => i.id === invId)!
}

describe('Wave D: D01 Honest Overview Metrics', () => {
  it('calculates calendar day differences accurately via diffDays', () => {
    expect(diffDays('2026-09-12', '2026-09-12')).toBe(0)
    expect(diffDays('2026-09-12', '2026-09-11')).toBe(1)
    expect(diffDays('2026-09-12', '2026-08-13')).toBe(30)
    expect(diffDays('2026-09-12', '2026-08-12')).toBe(31)
    expect(diffDays('2026-09-12', '2026-07-14')).toBe(60)
    expect(diffDays('2026-09-12', '2026-07-13')).toBe(61)
    expect(diffDays('2026-09-12', '2026-06-14')).toBe(90)
    expect(diffDays('2026-09-12', '2026-06-13')).toBe(91)
    expect(diffDays('2026-09-12', '2026-09-20')).toBe(-8)
  })

  it('computes exact period ranges for calendar intervals via getPeriodRange', () => {
    const todayStr = '2026-09-12'

    // All time
    expect(getPeriodRange('all', todayStr)).toEqual({ startDate: undefined, endDate: undefined })

    // This month (September has 30 days)
    expect(getPeriodRange('this-month', todayStr)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    })

    // Last month (August has 31 days)
    expect(getPeriodRange('last-month', todayStr)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })

    // Year boundary for last month (January -> December)
    expect(getPeriodRange('last-month', '2026-01-15')).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    })

    // This quarter (September is Q3: July 1 to September 30)
    expect(getPeriodRange('this-quarter', todayStr)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })

    // This year
    expect(getPeriodRange('this-year', todayStr)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })

    // Custom
    expect(getPeriodRange('custom', todayStr, '2026-05-10', '2026-05-25')).toEqual({
      startDate: '2026-05-10',
      endDate: '2026-05-25',
    })
  })

  it('separates invoiced by issueDate and cash received by payment date', () => {
    const w = createTestWorkspace()

    // Invoice 1: Issued in August, payment received in September
    const inv1 = issueTestInvoice(w, {
      issueDate: '2026-08-15',
      dueDate: '2026-08-29',
      amount: '1000.00',
    })

    // Record payment in September
    cmd(w, {
      type: 'payment',
      id: inv1.id,
      value: {
        id: crypto.randomUUID(),
        amount: '1000.00',
        date: '2026-09-05',
        method: 'Bank Transfer',
        reference: 'TX-001',
        notes: '',
        reversed: false,
      },
    })

    // Invoice 2: Issued in September, unpaid
    issueTestInvoice(w, {
      issueDate: '2026-09-10',
      dueDate: '2026-09-24',
      amount: '2500.00',
    })

    // 1. Report for August 2026
    const augustReport = calculateOverviewMetrics(w, {
      period: 'last-month',
      asOfDate: '2026-09-12',
    })
    const gbpAug = augustReport.currencies['GBP']
    // August invoiced: 1000.00 (inv1)
    expect(gbpAug.invoiced.amount).toBe('1000.00')
    expect(gbpAug.invoiced.count).toBe(1)
    // August cash received: 0.00 (payment was in Sept)
    expect(gbpAug.cashReceived.amount).toBe('0.00')
    expect(gbpAug.cashReceived.count).toBe(0)

    // 2. Report for September 2026
    const septReport = calculateOverviewMetrics(w, {
      period: 'this-month',
      asOfDate: '2026-09-12',
    })
    const gbpSept = septReport.currencies['GBP']
    // September invoiced: 2500.00 (inv2)
    expect(gbpSept.invoiced.amount).toBe('2500.00')
    expect(gbpSept.invoiced.count).toBe(1)
    // September cash received: 1000.00 (from inv1 payment)
    expect(gbpSept.cashReceived.amount).toBe('1000.00')
    expect(gbpSept.cashReceived.count).toBe(1)
    // September outstanding: 2500.00 (inv2 is unpaid)
    expect(gbpSept.outstanding.amount).toBe('2500.00')
    expect(gbpSept.outstanding.count).toBe(1)
  })

  it('correctly subtracts credit notes from invoiced totals and excludes voids', () => {
    const w = createTestWorkspace()

    // Invoice A: 2000.00 with 500.00 credit note
    const invA = issueTestInvoice(w, {
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      amount: '2000.00',
    })
    cmd(w, {
      type: 'creditNote',
      invoiceId: invA.id,
      reason: 'Partial courtesy discount',
      lines: [
        {
          id: crypto.randomUUID(),
          description: 'Courtesy credit',
          quantity: '1',
          rate: '500.00',
          unit: 'fixed',
        },
      ],
      tax: '0',
    })

    // Invoice B: 800.00, then voided
    const invB = issueTestInvoice(w, {
      issueDate: '2026-09-02',
      dueDate: '2026-09-16',
      amount: '800.00',
    })
    cmd(w, {
      type: 'void',
      id: invB.id,
      reason: 'Drafted in error',
    })

    // Invoice C: Unissued draft (should be completely excluded)
    const draft = newInvoice(w)
    draft.clientId = invA.clientId
    draft.client = invA.client
    draft.issueDate = '2026-09-03'
    draft.lines = [{ id: crypto.randomUUID(), description: 'Draft line', quantity: '1', rate: '3000.00', unit: 'fixed' }]
    cmd(w, { type: 'draft', value: draft })

    const report = calculateOverviewMetrics(w, {
      period: 'this-month',
      asOfDate: '2026-09-12',
    })
    const gbp = report.currencies['GBP']

    // Invoiced should be 1500.00 (2000 total - 500 credit note), excluding void (800) and draft (3000)
    expect(gbp.invoiced.amount).toBe('1500.00')
    expect(gbp.invoiced.count).toBe(1)
    expect(gbp.invoiced.invoiceIds).toEqual([invA.id])

    // Outstanding should be 1500.00 (net remaining on invA)
    expect(gbp.outstanding.amount).toBe('1500.00')
    expect(gbp.outstanding.count).toBe(1)
    expect(gbp.outstanding.invoiceIds).toEqual([invA.id])
  })

  it('excludes reversed payments and accounts for payment refunds in cash received', () => {
    const w = createTestWorkspace()

    const inv = issueTestInvoice(w, {
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      amount: '2000.00',
    })

    // 1. Payment 1: 500.00, then reversed
    const payment1Id = crypto.randomUUID()
    cmd(w, {
      type: 'payment',
      id: inv.id,
      value: {
        id: payment1Id,
        amount: '500.00',
        date: '2026-09-02',
        method: 'Bank',
        reference: 'BOUNCE-1',
        notes: '',
        reversed: false,
      },
    })
    cmd(w, {
      type: 'reverse',
      id: inv.id,
      paymentId: payment1Id,
    })

    // 2. Client Payment 2: 1200.00 with 200.00 refunded
    const payment2Id = crypto.randomUUID()
    cmd(w, {
      type: 'clientPayment',
      value: {
        id: payment2Id,
        clientId: inv.clientId,
        currency: 'GBP',
        amount: '1200.00',
        date: '2026-09-04',
        method: 'Transfer',
        reference: 'REF-2',
        notes: '',
        allocations: [{ invoiceId: inv.id, amount: '1000.00' }],
      },
    })
    cmd(w, {
      type: 'refundPayment',
      paymentId: payment2Id,
      refund: {
        amount: '200.00',
        date: '2026-09-06',
        reference: 'REFUND-1',
        notes: 'Overpayment refund',
      },
    })

    const report = calculateOverviewMetrics(w, {
      period: 'this-month',
      asOfDate: '2026-09-12',
    })
    const gbp = report.currencies['GBP']

    // Cash received: 1200 - 200 refund = 1000.00 (Payment 1 was reversed so 0)
    expect(gbp.cashReceived.amount).toBe('1000.00')
    expect(gbp.cashReceived.count).toBe(1)
  })

  it('places overdue invoices into precise ageing buckets at explicit boundaries', () => {
    const w = createTestWorkspace()
    const asOfDate = '2026-09-12'

    // Due today: 2026-09-12 (0 days overdue - not overdue!)
    const inv0 = issueTestInvoice(w, {
      issueDate: '2026-08-29',
      dueDate: '2026-09-12',
      amount: '100.00',
    })

    // 1 day overdue: due 2026-09-11 (boundary: 1-30 days)
    const inv1 = issueTestInvoice(w, {
      issueDate: '2026-08-28',
      dueDate: '2026-09-11',
      amount: '200.00',
    })

    // 30 days overdue: due 2026-08-13 (boundary: 1-30 days)
    const inv30 = issueTestInvoice(w, {
      issueDate: '2026-07-30',
      dueDate: '2026-08-13',
      amount: '300.00',
    })

    // 31 days overdue: due 2026-08-12 (boundary: 31-60 days)
    const inv31 = issueTestInvoice(w, {
      issueDate: '2026-07-29',
      dueDate: '2026-08-12',
      amount: '400.00',
    })

    // 60 days overdue: due 2026-07-14 (boundary: 31-60 days)
    const inv60 = issueTestInvoice(w, {
      issueDate: '2026-06-30',
      dueDate: '2026-07-14',
      amount: '500.00',
    })

    // 61 days overdue: due 2026-07-13 (boundary: 61-90 days)
    const inv61 = issueTestInvoice(w, {
      issueDate: '2026-06-29',
      dueDate: '2026-07-13',
      amount: '600.00',
    })

    // 90 days overdue: due 2026-06-14 (boundary: 61-90 days)
    const inv90 = issueTestInvoice(w, {
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      amount: '700.00',
    })

    // 91 days overdue: due 2026-06-13 (boundary: 91+ days)
    const inv91 = issueTestInvoice(w, {
      issueDate: '2026-05-30',
      dueDate: '2026-06-13',
      amount: '800.00',
    })

    // 120 days overdue: due 2026-05-15 (91+ days)
    const inv120 = issueTestInvoice(w, {
      issueDate: '2026-05-01',
      dueDate: '2026-05-15',
      amount: '900.00',
    })

    const report = calculateOverviewMetrics(w, {
      period: 'all',
      asOfDate,
    })
    const gbp = report.currencies['GBP']

    // Due today is not overdue
    expect(gbp.overdue.invoiceIds).not.toContain(inv0.id)

    // Total overdue count should be 8 (inv1, inv30, inv31, inv60, inv61, inv90, inv91, inv120)
    expect(gbp.overdue.count).toBe(8)
    expect(gbp.overdue.amount).toBe('4400.00')

    // 1-30 days bucket: inv1 (200) + inv30 (300) = 500.00
    expect(gbp.ageing['1-30'].count).toBe(2)
    expect(gbp.ageing['1-30'].amount).toBe('500.00')
    expect(gbp.ageing['1-30'].invoiceIds).toEqual(expect.arrayContaining([inv1.id, inv30.id]))

    // 31-60 days bucket: inv31 (400) + inv60 (500) = 900.00
    expect(gbp.ageing['31-60'].count).toBe(2)
    expect(gbp.ageing['31-60'].amount).toBe('900.00')
    expect(gbp.ageing['31-60'].invoiceIds).toEqual(expect.arrayContaining([inv31.id, inv60.id]))

    // 61-90 days bucket: inv61 (600) + inv90 (700) = 1300.00
    expect(gbp.ageing['61-90'].count).toBe(2)
    expect(gbp.ageing['61-90'].amount).toBe('1300.00')
    expect(gbp.ageing['61-90'].invoiceIds).toEqual(expect.arrayContaining([inv61.id, inv90.id]))

    // 91+ days bucket: inv91 (800) + inv120 (900) = 1700.00
    expect(gbp.ageing['91+'].count).toBe(2)
    expect(gbp.ageing['91+'].amount).toBe('1700.00')
    expect(gbp.ageing['91+'].invoiceIds).toEqual(expect.arrayContaining([inv91.id, inv120.id]))
  })

  it('keeps metrics isolated per currency without mixing or converting balances', () => {
    const w = createTestWorkspace()

    // GBP invoice: 1000.00
    issueTestInvoice(w, {
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      amount: '1000.00',
      currency: 'GBP',
    })

    // USD invoice: 1500.00
    issueTestInvoice(w, {
      issueDate: '2026-09-02',
      dueDate: '2026-09-16',
      amount: '1500.00',
      currency: 'USD',
    })

    // EUR invoice: 2200.00
    issueTestInvoice(w, {
      issueDate: '2026-09-03',
      dueDate: '2026-09-17',
      amount: '2200.00',
      currency: 'EUR',
    })

    const report = calculateOverviewMetrics(w, {
      period: 'this-month',
      asOfDate: '2026-09-12',
    })

    expect(report.allCurrencies).toContain('GBP')
    expect(report.allCurrencies).toContain('USD')
    expect(report.allCurrencies).toContain('EUR')

    expect(report.currencies['GBP'].invoiced.amount).toBe('1000.00')
    expect(report.currencies['USD'].invoiced.amount).toBe('1500.00')
    expect(report.currencies['EUR'].invoiced.amount).toBe('2200.00')

    expect(report.currencies['GBP'].outstanding.amount).toBe('1000.00')
    expect(report.currencies['USD'].outstanding.amount).toBe('1500.00')
    expect(report.currencies['EUR'].outstanding.amount).toBe('2200.00')
  })
})
