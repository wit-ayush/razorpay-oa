import { getStatus } from '../lib/status'
import type { NewLinkInput, PaymentLink } from '../types'

export interface PaymentLinksApi {
  listLinks(): Promise<PaymentLink[]>
  createLink(input: NewLinkInput): Promise<PaymentLink>
  markPaid(id: string): Promise<PaymentLink>
}

export interface MockPaymentLinksApi extends PaymentLinksApi {
  /** Makes the next request reject, to exercise error states. */
  failNextRequest(message?: string): void
}

export interface MockApiOptions {
  latencyMs?: number
  seed?: PaymentLink[]
  now?: () => Date
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Demo data relative to `now`: one active, one paid, one expired link. */
export function createSeedLinks(now: Date): PaymentLink[] {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()
  return [
    {
      id: 'plink_seed_active',
      amountPaise: 249900,
      description: 'Annual subscription renewal',
      customer: { email: 'priya@example.com' },
      expiresAt: at(7 * 24 * HOUR),
      createdAt: at(-2 * HOUR),
    },
    {
      id: 'plink_seed_paid',
      amountPaise: 50000,
      description: 'Consultation fee',
      customer: { phone: '9876543210' },
      paidAt: at(-3 * HOUR),
      createdAt: at(-5 * HOUR),
    },
    {
      id: 'plink_seed_expired',
      amountPaise: 1200050,
      description: 'Bulk order #1043',
      customer: { email: 'orders@acme.in', phone: '+919812345678' },
      expiresAt: at(-1 * HOUR),
      createdAt: at(-26 * HOUR),
    },
  ]
}

/** In-memory mock backend. Returns copies so callers can never mutate the store. */
export function createMockPaymentLinksApi(options: MockApiOptions = {}): MockPaymentLinksApi {
  const { latencyMs = 0, now = () => new Date() } = options
  const store: PaymentLink[] = (options.seed ?? []).map((link) => structuredClone(link))
  let nextId = 1
  let pendingFailure: string | undefined

  const respond = <T,>(produce: () => T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (pendingFailure !== undefined) {
          const message = pendingFailure
          pendingFailure = undefined
          reject(new Error(message))
          return
        }
        try {
          resolve(structuredClone(produce()))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }, latencyMs)
    })

  return {
    listLinks: () => respond(() => store),

    createLink: (input) =>
      respond(() => {
        const link: PaymentLink = {
          id: `plink_${Date.now().toString(36)}_${nextId++}`,
          ...structuredClone(input),
          createdAt: now().toISOString(),
        }
        store.push(link)
        return link
      }),

    markPaid: (id) =>
      respond(() => {
        const link = store.find((candidate) => candidate.id === id)
        if (!link) throw new Error('Payment link not found')
        if (getStatus(link, now()) !== 'active') throw new Error('Only active links can be marked as paid')
        link.paidAt = now().toISOString()
        return link
      }),

    failNextRequest: (message = 'Network error. Please try again.') => {
      pendingFailure = message
    },
  }
}
