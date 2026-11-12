import { describe, expect, it } from 'vitest'
import type { NewLinkInput } from '../types'
import { createMockPaymentLinksApi, createSeedLinks, STORAGE_KEY, type KeyValueStorage } from './paymentLinksApi'

const NOW = new Date('2026-11-12T10:00:00.000Z')
const input: NewLinkInput = {
  amountPaise: 1000,
  description: 'Tea',
  customer: { email: 'a@b.co' },
  allowPartial: true,
  minFirstPaymentPaise: 300,
}

const fakeStorage = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

describe('mock payment links API', () => {
  it('creates a link with nothing paid, and lists it', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const created = await api.createLink(input)

    expect(created).toMatchObject({ ...input, amountPaidPaise: 0, createdAt: NOW.toISOString() })
    expect(await api.listLinks()).toEqual([created])
  })

  it('returns copies so callers cannot mutate the store', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const created = await api.createLink(input)
    created.description = 'mutated'

    expect((await api.listLinks())[0].description).toBe('Tea')
  })

  it('records partial then final payments as integer paise', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const { id } = await api.createLink(input)

    expect((await api.recordPayment(id, 300)).amountPaidPaise).toBe(300)
    expect((await api.recordPayment(id, 700)).amountPaidPaise).toBe(1000)
  })

  it('enforces payment rules server-side too (payment > due, below minimum, expired link)', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW) })
    const { id } = await api.createLink(input)

    await expect(api.recordPayment(id, 1001)).rejects.toThrow('Payment cannot exceed the amount due (₹10.00)')
    await expect(api.recordPayment(id, 299)).rejects.toThrow('First payment must be at least ₹3.00')
    await expect(api.recordPayment('plink_seed_expired', 100)).rejects.toThrow(
      'Payments can only be recorded on active or partially paid links',
    )
    await expect(api.recordPayment('missing', 100)).rejects.toThrow('Payment link not found')
  })

  it('fails only the next request after failNextRequest, then recovers', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW) })
    api.failNextRequest('Server unavailable')

    await expect(api.listLinks()).rejects.toThrow('Server unavailable')
    expect(await api.listLinks()).toHaveLength(4)
  })
})

describe('persistence (AC-18)', () => {
  it('survives a "reload": a new API instance on the same storage sees links and payments', async () => {
    const storage = fakeStorage()
    const first = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW), storage })
    const { id } = await first.createLink(input)
    await first.recordPayment(id, 400)

    const afterReload = createMockPaymentLinksApi({ now: () => NOW, seed: [], storage })
    const links = await afterReload.listLinks()
    expect(links).toHaveLength(5)
    expect(links.find((link) => link.id === id)?.amountPaidPaise).toBe(400)
  })

  it.each([
    ['corrupt JSON', '{not json'],
    ['wrong shape', JSON.stringify([{ id: 1 }])],
    ['float money', JSON.stringify([{ ...createSeedLinks(NOW)[0], amountPaise: 0.3 }])],
    ['paid more than amount', JSON.stringify([{ ...createSeedLinks(NOW)[0], amountPaidPaise: 999_999_999 }])],
    ['not an array', JSON.stringify({ links: [] })],
  ])('falls back to seed data on %s instead of crashing', async (_case, stored) => {
    const storage = fakeStorage({ [STORAGE_KEY]: stored })
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW), storage })
    expect(await api.listLinks()).toHaveLength(4)
  })
})
