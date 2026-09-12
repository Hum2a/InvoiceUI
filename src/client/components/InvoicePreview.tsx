import { Fragment } from 'react'
import { money, totals, formatClientAddress, formatAddress, type Invoice, type Business } from '../../shared/domain'
import { BankLogo } from './ui/BankLogo'

export function InvoicePreview({ invoice: i, business: current }: { invoice: Invoice; business: Business }) {
  const b = i.business ?? current
  const t = totals(i)
  const clientAddress = formatClientAddress(i.client)
  const businessAddress = formatAddress(b)

  return (
    <article className={`invoice template-${i.template}`} style={{ '--invoice-accent': i.accent } as React.CSSProperties}>
      <div className="invoice-top">
        <div>
          {b.logo ? (
            <img src={b.logo} alt={`${b.name} logo`} className="invoice-logo" />
          ) : (
            <div className="brand-mark">✦</div>
          )}
          <p className="font-semibold">{b.name || 'Your business'}</p>
          <p className="muted whitespace-pre-line">
            {businessAddress || 'Add your address in Settings'}
            {b.email && <><br />{b.email}</>}
            {b.taxId && <><br />Tax ID: {b.taxId}</>}
          </p>
        </div>
        <div className="text-right">
          <h2>INVOICE</h2>
          <p className="invoice-number">{i.number || 'DRAFT'}</p>
          {i.lifecycle === 'void' && <p className="text-red-600">VOID</p>}
        </div>
      </div>

      <div className="invoice-parties">
        <div>
          <p className="eyebrow">Billed to</p>
          <p className="font-medium mt-2">{i.client.name || 'Client name'}</p>
          {i.client.contact && <p className="font-medium text-xs mt-0.5">Attn: {i.client.contact}</p>}
          <div className="muted whitespace-pre-line mt-1">
            {clientAddress && <p>{clientAddress}</p>}
            {i.client.phone && <p>Tel: {i.client.phone}</p>}
            {i.client.email && <p>{i.client.email}</p>}
            {i.client.taxId && <p>Tax ID / VAT: {i.client.taxId}</p>}
          </div>
        </div>
        <div>
          <p className="eyebrow">Payment due</p>
          <p className="font-medium mt-2">
            {new Date(i.dueDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <p className="muted">Issued {i.issueDate}</p>
          {i.po && <p className="muted">PO: {i.po}</p>}
        </div>
      </div>

      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {i.lines.map((line, n) => {
              const showGroup = line.group && (n === 0 || line.group !== i.lines[n - 1].group)
              return (
                <Fragment key={line.id}>
                  {showGroup && (
                    <tr className="invoice-group-row">
                      <td colSpan={4} className="font-semibold text-xs tracking-wider uppercase bg-[var(--soft)] py-1.5 px-3">
                        {line.group}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="whitespace-pre-line">{line.description || 'Untitled service'}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.rate, i.currency)}</td>
                    <td>{money(t.lineTotals[n], i.currency)}</td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(t.subtotal, i.currency)}</span>
        </div>
        {Number(t.discount) > 0 && (
          <div>
            <span>Discount</span>
            <span>-{money(t.discount, i.currency)}</span>
          </div>
        )}
        {Number(i.tax) > 0 && (
          <div>
            <span>Tax ({i.tax}%)</span>
            <span>{money(t.tax, i.currency)}</span>
          </div>
        )}
        <div className="invoice-total">
          <span>Total</span>
          <span>{money(t.total, i.currency)}</span>
        </div>
      </div>

      {Number(i.deposit) > 0 && (
        <p className="muted">Requested deposit: {money(i.deposit, i.currency)}</p>
      )}
      {i.instalments.map((x, n) => (
        <p key={n} className="muted">
          Instalment {x.date}: {money(x.amount, i.currency)}
        </p>
      ))}
      {i.notes && <p className="invoice-notes whitespace-pre-line">{i.notes}</p>}

      <footer className="invoice-footer">
        <p className="font-medium">{b.footer || 'Thank you for your business.'}</p>
        {b.bank && (
          <div className="mt-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--soft)]/50 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <BankLogo bankId={b.bankId} bankName={b.bankName} bankLogo={b.bankLogo} size="xs" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Payment Details</span>
            </div>
            <p className="whitespace-pre-line text-xs leading-relaxed font-mono">{b.bank}</p>
          </div>
        )}
        <p className="mt-2">Reference: {i.reference || i.number || 'Assigned when issued'}</p>
      </footer>
    </article>
  )
}
