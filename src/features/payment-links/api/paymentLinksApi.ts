import { applyPayment, paymentError } from '../lib/payments'
import type { NewLinkInput, PaymentLink } from '../types'

export interface PaymentLinksApi {
  listLinks(): Promise<PaymentLink[]>
  createLink(input: NewLinkInput): Promise<PaymentLink>
  recordPayment(id: string, amountPaise: number): Promise<PaymentLink>
}

export interface MockPaymentLinksApi extends PaymentLinksApi {
  /** Makes the next request reject, to exercise error states. */
  failNextRequest(message?: string): void
}

/** The subset of the Web Storage API we use (window.localStorage in the app, a fake in tests). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface MockApiOptions {
  latencyMs?: number
  seed?: PaymentLink[]
  now?: () => Date
  /** When given, links are loaded from and saved to this storage so they survive reloads. */
  storage?: KeyValueStorage
}

export const STORAGE_KEY = 'payment-links:v1'
const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Demo data relative to `now`: one link in each status. */
export function createSeedLinks(now: Date): PaymentLink[] {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()
  return [
    {
      id: 'plink_seed_active',
      amountPaise: 249900,
      amountPaidPaise: 0,
      allowPartial: true,
      minFirstPaymentPaise: 50000,
      description: 'Annual subscription renewal',
      customer: { email: 'priya@example.com' },
      expiresAt: at(7 * 24 * HOUR),
      createdAt: at(-2 * HOUR),
    },
    {
      id: 'plink_seed_partial',
      amountPaise: 1000000,
      amountPaidPaise: 250000,
      allowPartial: true,
      minFirstPaymentPaise: 200000,
      description: 'Website redesign milestone',
      customer: { email: 'studio@example.com' },
      createdAt: at(-4 * HOUR),
    },
    {
      id: 'plink_seed_paid',
      amountPaise: 50000,
      amountPaidPaise: 50000,
      allowPartial: false,
      description: 'Consultation fee',
      customer: { phone: '9876543210' },
      createdAt: at(-5 * HOUR),
    },
    {
      id: 'plink_seed_expired',
      amountPaise: 1200050,
      amountPaidPaise: 0,
      allowPartial: false,
      description: 'Bulk order #1043',
      customer: { email: 'orders@acme.in', phone: '+919812345678' },
      expiresAt: at(-1 * HOUR),
      createdAt: at(-26 * HOUR),
    },
  ]
}

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string'
const isPaise = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Runtime guard for data read back from storage (it may be stale, edited or corrupt). */
export function isPaymentLink(value: unknown): value is PaymentLink {
  if (typeof value !== 'object' || value === null) return false
  const link = value as Record<string, unknown>
  const customer = link.customer as Record<string, unknown> | null | undefined
  return (
    typeof link.id === 'string' &&
    isPaise(link.amountPaise) &&
    isPaise(link.amountPaidPaise) &&
    link.amountPaidPaise <= link.amountPaise &&
    typeof link.allowPartial === 'boolean' &&
    (link.minFirstPaymentPaise === undefined || isPaise(link.minFirstPaymentPaise)) &&
    typeof link.description === 'string' &&
    typeof customer === 'object' &&
    customer !== null &&
    isOptionalString(customer.email) &&
    isOptionalString(customer.phone) &&
    isOptionalString(link.expiresAt) &&
    typeof link.createdAt === 'string'
  )
}

/** Returns stored links, or undefined when nothing valid is stored (missing, corrupt JSON or wrong shape). */
export function loadStoredLinks(storage: KeyValueStorage): PaymentLink[] | undefined {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  return Array.isArray(parsed) && parsed.every(isPaymentLink) ? parsed : undefined
}

/** In-memory mock backend, optionally persisted. Returns copies so callers can never mutate the store. */
export function createMockPaymentLinksApi(options: MockApiOptions = {}): MockPaymentLinksApi {
  const { latencyMs = 0, now = () => new Date(), storage } = options
  const initial = (storage && loadStoredLinks(storage)) ?? options.seed ?? []
  let store: PaymentLink[] = initial.map((link) => structuredClone(link))
  let nextId = 1
  let pendingFailure: string | undefined

  const persist = () => storage?.setItem(STORAGE_KEY, JSON.stringify(store))

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
          amountPaidPaise: 0,
          createdAt: now().toISOString(),
        }
        store = [...store, link]
        persist()
        return link
      }),

    recordPayment: (id, amountPaise) =>
      respond(() => {
        const link = store.find((candidate) => candidate.id === id)
        if (!link) throw new Error('Payment link not found')
        const error = paymentError(link, amountPaise, now())
        if (error) throw new Error(error)
        const updated = applyPayment(link, amountPaise)
        store = store.map((candidate) => (candidate.id === id ? updated : candidate))
        persist()
        return updated
      }),

    failNextRequest: (message = 'Network error. Please try again.') => {
      pendingFailure = message
    },
  }
}
