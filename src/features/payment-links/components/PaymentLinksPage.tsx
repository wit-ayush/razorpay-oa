import { useState } from 'react'
import type { PaymentLinksApi } from '../api/paymentLinksApi'
import { useNow } from '../hooks/useNow'
import { toMessage, usePaymentLinks } from '../hooks/usePaymentLinks'
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
  const { state, retry, createLink, markPaid } = usePaymentLinks(api)
  const now = useNow()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [actionError, setActionError] = useState<string>()

  async function handleMarkPaid(id: string) {
    setActionError(undefined)
    try {
      await markPaid(id)
    } catch (error) {
      setActionError(`Could not mark the link as paid: ${toMessage(error)}`)
    }
  }

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
            {actionError && (
              <p role="alert" className="field__error">
                {actionError}
              </p>
            )}
            <LinkResults links={sortNewestFirst(filterLinks(state.links, filter, now))} filter={filter} now={now} onMarkPaid={handleMarkPaid} />
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
  onMarkPaid,
}: {
  links: Parameters<typeof LinksList>[0]['links']
  filter: StatusFilter
  now: Date
  onMarkPaid: (id: string) => void
}) {
  if (links.length > 0) return <LinksList links={links} now={now} onMarkPaid={onMarkPaid} />
  return <p className="empty-state">{emptyStateMessage(filter)}</p>
}
