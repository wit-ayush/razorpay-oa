import { describe, expect, it } from 'vitest'
import type { NewLinkInput } from '../types'
import { createMockPaymentLinksApi, createSeedLinks } from './paymentLinksApi'

const NOW = new Date('2026-11-12T10:00:00.000Z')
const input: NewLinkInput = { amountPaise: 1000, description: 'Tea', customer: { email: 'a@b.co' } }

describe('mock payment links API', () => {
  it('creates a link with an id and createdAt, and lists it', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const created = await api.createLink(input)

    expect(created).toMatchObject({ ...input, createdAt: NOW.toISOString() })
    expect(created.id).toMatch(/^plink_/)
    expect(await api.listLinks()).toEqual([created])
  })

  it('returns copies so callers cannot mutate the store', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const created = await api.createLink(input)
    created.description = 'mutated'

    expect((await api.listLinks())[0].description).toBe('Tea')
  })

  it('marks an active link as paid', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW })
    const created = await api.createLink(input)

    expect((await api.markPaid(created.id)).paidAt).toBe(NOW.toISOString())
  })

  it('refuses to mark expired or already-paid links as paid', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW) })

    await expect(api.markPaid('plink_seed_expired')).rejects.toThrow('Only active links can be marked as paid')
    await expect(api.markPaid('plink_seed_paid')).rejects.toThrow('Only active links can be marked as paid')
    await expect(api.markPaid('missing')).rejects.toThrow('Payment link not found')
  })

  it('fails only the next request after failNextRequest, then recovers', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW) })
    api.failNextRequest('Server unavailable')

    await expect(api.listLinks()).rejects.toThrow('Server unavailable')
    expect(await api.listLinks()).toHaveLength(3)
  })

  it('seeds one active, one paid and one expired link', async () => {
    const api = createMockPaymentLinksApi({ now: () => NOW, seed: createSeedLinks(NOW) })
    const ids = (await api.listLinks()).map((link) => link.id)
    expect(ids).toEqual(['plink_seed_active', 'plink_seed_paid', 'plink_seed_expired'])
  })
})
