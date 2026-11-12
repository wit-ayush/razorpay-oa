import { useCallback, useEffect, useState } from 'react'
import type { PaymentLinksApi } from '../api/paymentLinksApi'
import type { NewLinkInput, PaymentLink } from '../types'

export type LinksState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; links: PaymentLink[] }

const toMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong')

/** Loads links from the API and exposes create / mark-paid / retry. */
export function usePaymentLinks(api: PaymentLinksApi) {
  const [state, setState] = useState<LinksState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.listLinks().then(
      (links) => {
        if (!cancelled) setState({ status: 'success', links })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toMessage(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [api, reloadKey])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  /** Throws on failure so the form can keep the user's input and show the error. */
  const createLink = useCallback(
    async (input: NewLinkInput) => {
      const created = await api.createLink(input)
      setState((current) => (current.status === 'success' ? { ...current, links: [...current.links, created] } : current))
      return created
    },
    [api],
  )

  /** Throws on failure so the payment form can show the error inline. */
  const recordPayment = useCallback(
    async (id: string, amountPaise: number) => {
      const updated = await api.recordPayment(id, amountPaise)
      setState((current) =>
        current.status === 'success'
          ? { ...current, links: current.links.map((link) => (link.id === id ? updated : link)) }
          : current,
      )
    },
    [api],
  )

  return { state, retry, createLink, recordPayment }
}

export { toMessage }
