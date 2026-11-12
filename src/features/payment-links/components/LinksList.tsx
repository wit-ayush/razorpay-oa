import { formatINR } from '../lib/amount'
import { getStatus } from '../lib/status'
import type { LinkStatus, PaymentLink } from '../types'

const STATUS_LABEL: Record<LinkStatus, string> = { active: 'Active', paid: 'Paid', expired: 'Expired' }
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

interface LinksListProps {
  links: PaymentLink[]
  now: Date
  onMarkPaid: (id: string) => void
}

export function LinksList({ links, now, onMarkPaid }: LinksListProps) {
  return (
    <ul className="links" aria-label="Payment links">
      {links.map((link) => {
        const status = getStatus(link, now)
        return (
          <li key={link.id} className="link-card">
            <div className="link-card__head">
              <span className="link-card__amount">{formatINR(link.amountPaise)}</span>
              <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
            </div>
            <p className="link-card__description">{link.description}</p>
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
            {status === 'active' && (
              <button type="button" className="link-card__action" onClick={() => onMarkPaid(link.id)} aria-label={`Mark as paid: ${link.description}`}>
                Mark as paid
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
