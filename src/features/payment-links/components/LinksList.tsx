import { formatINR } from '../lib/amount'
import { amountDuePaise, getStatus } from '../lib/status'
import type { LinkStatus, PaymentLink } from '../types'
import { RecordPaymentForm } from './RecordPaymentForm'

const STATUS_LABEL: Record<LinkStatus, string> = {
  active: 'Active',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  expired: 'Expired',
}
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

interface LinksListProps {
  links: PaymentLink[]
  now: Date
  onRecordPayment: (id: string, amountPaise: number) => Promise<void>
}

export function LinksList({ links, now, onRecordPayment }: LinksListProps) {
  return (
    <ul className="links" aria-label="Payment links">
      {links.map((link) => {
        const status = getStatus(link, now)
        const canPay = status === 'active' || status === 'partially_paid'
        return (
          <li key={link.id} className="link-card">
            <div className="link-card__head">
              <span className="link-card__amount">{formatINR(link.amountPaise)}</span>
              <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
            </div>
            <p className="link-card__description">{link.description}</p>
            <p className="link-card__progress">
              Paid {formatINR(link.amountPaidPaise)} / Due {formatINR(amountDuePaise(link))}
            </p>
            <dl className="link-card__meta">
              <div>
                <dt>Customer</dt>
                <dd>{[link.customer.email, link.customer.phone].filter(Boolean).join(' · ')}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  <time dateTime={link.createdAt}>{dateTime.format(new Date(link.createdAt))}</time>
                </dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>
                  {link.expiresAt ? <time dateTime={link.expiresAt}>{dateTime.format(new Date(link.expiresAt))}</time> : 'Never'}
                </dd>
              </div>
            </dl>
            {canPay && <RecordPaymentForm link={link} now={now} onRecordPayment={onRecordPayment} />}
          </li>
        )
      })}
    </ul>
  )
}
