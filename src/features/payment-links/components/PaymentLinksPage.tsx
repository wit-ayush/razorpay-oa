import { useState } from 'react'
import type { PaymentLinksApi } from '../api/paymentLinksApi'
import { useNow } from '../hooks/useNow'
import { usePaymentLinks } from '../hooks/usePaymentLinks'
import { countByStatus, filterLinks, sortNewestFirst } from '../lib/status'
import type { StatusFilter } from '../types'
import { CreateLinkForm } from './CreateLinkForm'
import { LinksList } from './LinksList'
import { emptyStateMessage } from '../lib/filters'
import { StatusFilterBar } from './StatusFilterBar'

interface PaymentLinksPageProps {
  api: PaymentLinksApi
  getNow?: () => Date
}

export function PaymentLinksPage({ api, getNow }: PaymentLinksPageProps) {
  const { state, retry, createLink, recordPayment } = usePaymentLinks(api)
  const now = useNow()
  const [filter, setFilter] = useState<StatusFilter>('all')

  return (
    <main>
      <h1>Payment Links</h1>

      <section aria-labelledby="create-heading" className="panel">
        <h2 id="create-heading">Create a payment link</h2>
        <CreateLinkForm onCreate={createLink} getNow={getNow} />
      </section>

      <section aria-labelledby="links-heading" className="panel">
        <h2 id="links-heading">Your payment links</h2>

        {state.status === 'loading' && <output className="loading">Loading payment links…</output>}

        {state.status === 'error' && (
          <div role="alert" className="error-state">
            <p>Couldn't load payment links: {state.message}</p>
            <button type="button" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <>
            <StatusFilterBar value={filter} counts={countByStatus(state.links, now)} onChange={setFilter} />
            <LinkResults links={sortNewestFirst(filterLinks(state.links, filter, now))} filter={filter} now={now} onRecordPayment={recordPayment} />
          </>
        )}
      </section>
    </main>
  )
}

function LinkResults({
  links,
  filter,
  now,
  onRecordPayment,
}: {
  links: Parameters<typeof LinksList>[0]['links']
  filter: StatusFilter
  now: Date
  onRecordPayment: (id: string, amountPaise: number) => Promise<void>
}) {
  if (links.length > 0) return <LinksList links={links} now={now} onRecordPayment={onRecordPayment} />
  return <p className="empty-state">{emptyStateMessage(filter)}</p>
}
