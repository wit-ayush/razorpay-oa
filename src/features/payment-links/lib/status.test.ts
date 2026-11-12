import { describe, expect, it } from 'vitest'
import type { PaymentLink } from '../types'
import { countByStatus, filterLinks, getStatus, sortNewestFirst } from './status'

const NOW = new Date('2026-11-12T10:00:00.000Z')

const link = (overrides: Partial<PaymentLink>): PaymentLink => ({
  id: 'l1',
  amountPaise: 1000,
  description: 'Test',
  customer: { email: 'a@b.co' },
  createdAt: '2026-11-12T09:00:00.000Z',
  ...overrides,
})

describe('getStatus', () => {
  it('is active with no expiry', () => {
    expect(getStatus(link({}), NOW)).toBe('active')
  })

  it('is active while expiry is in the future', () => {
    expect(getStatus(link({ expiresAt: '2026-11-12T10:00:01.000Z' }), NOW)).toBe('active')
  })

  it('is expired once expiry has passed, including exactly now', () => {
    expect(getStatus(link({ expiresAt: '2026-11-12T09:59:59.000Z' }), NOW)).toBe('expired')
    expect(getStatus(link({ expiresAt: NOW.toISOString() }), NOW)).toBe('expired')
  })

  it('is paid when paid, even if the expiry has since passed (paid wins)', () => {
    expect(getStatus(link({ paidAt: '2026-11-12T08:00:00.000Z' }), NOW)).toBe('paid')
    expect(
      getStatus(link({ paidAt: '2026-11-12T08:00:00.000Z', expiresAt: '2026-11-12T09:00:00.000Z' }), NOW),
    ).toBe('paid')
  })
})

describe('filtering and counting', () => {
  const active = link({ id: 'active', createdAt: '2026-11-12T09:00:00.000Z' })
  const paid = link({ id: 'paid', paidAt: '2026-11-12T09:30:00.000Z', createdAt: '2026-11-12T08:00:00.000Z' })
  const expired = link({ id: 'expired', expiresAt: '2026-11-12T09:00:00.000Z', createdAt: '2026-11-12T09:45:00.000Z' })
  const all = [active, paid, expired]

  it('returns every link for "all"', () => {
    expect(filterLinks(all, 'all', NOW)).toHaveLength(3)
  })

  it.each([
    ['active', ['active']],
    ['paid', ['paid']],
    ['expired', ['expired']],
  ] as const)('returns only %s links', (filter, ids) => {
    expect(filterLinks(all, filter, NOW).map((l) => l.id)).toEqual(ids)
  })

  it('counts links per status', () => {
    expect(countByStatus(all, NOW)).toEqual({ all: 3, active: 1, paid: 1, expired: 1 })
    expect(countByStatus([], NOW)).toEqual({ all: 0, active: 0, paid: 0, expired: 0 })
  })

  it('sorts newest first without mutating the input', () => {
    const input = [...all]
    expect(sortNewestFirst(input).map((l) => l.id)).toEqual(['expired', 'active', 'paid'])
    expect(input.map((l) => l.id)).toEqual(['active', 'paid', 'expired'])
  })
})
