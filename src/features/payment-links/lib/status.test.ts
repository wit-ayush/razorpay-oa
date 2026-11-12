import { describe, expect, it } from 'vitest'
import type { PaymentLink } from '../types'
import { amountDuePaise, countByStatus, filterLinks, getStatus, sortNewestFirst } from './status'

const NOW = new Date('2026-11-12T10:00:00.000Z')
const PAST = '2026-11-12T09:00:00.000Z'
const FUTURE = '2026-11-12T11:00:00.000Z'

const link = (overrides: Partial<PaymentLink>): PaymentLink => ({
  id: 'l1',
  amountPaise: 10_000,
  amountPaidPaise: 0,
  allowPartial: true,
  minFirstPaymentPaise: 1_000,
  description: 'Test',
  customer: { email: 'a@b.co' },
  createdAt: '2026-11-12T08:00:00.000Z',
  ...overrides,
})

describe('getStatus precedence (AC-15)', () => {
  it('is Active when nothing is paid and there is no expiry or it is in the future', () => {
    expect(getStatus(link({}), NOW)).toBe('active')
    expect(getStatus(link({ expiresAt: FUTURE }), NOW)).toBe('active')
  })

  it('is Partially paid when something but not everything is paid', () => {
    expect(getStatus(link({ amountPaidPaise: 1 }), NOW)).toBe('partially_paid')
    expect(getStatus(link({ amountPaidPaise: 9_999, expiresAt: FUTURE }), NOW)).toBe('partially_paid')
  })

  it('is Paid when paid in full', () => {
    expect(getStatus(link({ amountPaidPaise: 10_000 }), NOW)).toBe('paid')
  })

  it('Paid never expires: Paid beats Expired', () => {
    expect(getStatus(link({ amountPaidPaise: 10_000, expiresAt: PAST }), NOW)).toBe('paid')
  })

  it('Expired beats Active and Partially paid once expiry passes (including exactly now)', () => {
    expect(getStatus(link({ expiresAt: PAST }), NOW)).toBe('expired')
    expect(getStatus(link({ amountPaidPaise: 5_000, expiresAt: PAST }), NOW)).toBe('expired')
    expect(getStatus(link({ amountPaidPaise: 9_999, expiresAt: NOW.toISOString() }), NOW)).toBe('expired')
  })
})

describe('amountDuePaise', () => {
  it('is the integer remainder', () => {
    expect(amountDuePaise(link({ amountPaidPaise: 2_550 }))).toBe(7_450)
    expect(amountDuePaise(link({ amountPaidPaise: 10_000 }))).toBe(0)
  })
})

describe('filtering and counting', () => {
  const active = link({ id: 'active', createdAt: '2026-11-12T09:00:00.000Z' })
  const partial = link({ id: 'partial', amountPaidPaise: 2_500, createdAt: '2026-11-12T09:10:00.000Z' })
  const paid = link({ id: 'paid', amountPaidPaise: 10_000, createdAt: '2026-11-12T08:00:00.000Z' })
  const expired = link({ id: 'expired', expiresAt: PAST, createdAt: '2026-11-12T09:45:00.000Z' })
  const all = [active, partial, paid, expired]

  it('returns every link for "all"', () => {
    expect(filterLinks(all, 'all', NOW)).toHaveLength(4)
  })

  it.each([
    ['active', ['active']],
    ['partially_paid', ['partial']],
    ['paid', ['paid']],
    ['expired', ['expired']],
  ] as const)('returns only %s links', (filter, ids) => {
    expect(filterLinks(all, filter, NOW).map((l) => l.id)).toEqual(ids)
  })

  it('counts links per status', () => {
    expect(countByStatus(all, NOW)).toEqual({ all: 4, active: 1, partially_paid: 1, paid: 1, expired: 1 })
    expect(countByStatus([], NOW)).toEqual({ all: 0, active: 0, partially_paid: 0, paid: 0, expired: 0 })
  })

  it('sorts newest first without mutating the input', () => {
    const input = [...all]
    expect(sortNewestFirst(input).map((l) => l.id)).toEqual(['expired', 'partial', 'active', 'paid'])
    expect(input.map((l) => l.id)).toEqual(['active', 'partial', 'paid', 'expired'])
  })
})
