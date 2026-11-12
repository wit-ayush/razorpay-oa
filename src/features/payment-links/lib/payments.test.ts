import { describe, expect, it } from 'vitest'
import type { PaymentLink } from '../types'
import { applyPayment, paymentError, validateRecordPayment } from './payments'
import { amountDuePaise, getStatus } from './status'

const NOW = new Date('2026-11-12T10:00:00.000Z')

const link = (overrides: Partial<PaymentLink>): PaymentLink => ({
  id: 'l1',
  amountPaise: 100_000, // ₹1,000
  amountPaidPaise: 0,
  allowPartial: true,
  minFirstPaymentPaise: 20_000, // ₹200
  description: 'Test',
  customer: { email: 'a@b.co' },
  createdAt: '2026-11-12T08:00:00.000Z',
  ...overrides,
})

const err = (l: PaymentLink, raw: string) => {
  const result = validateRecordPayment(l, raw, NOW)
  return result.ok ? undefined : result.error
}

describe('validateRecordPayment (AC-14)', () => {
  it('accepts a payment equal to the amount due', () => {
    expect(validateRecordPayment(link({ amountPaidPaise: 30_000 }), '700', NOW)).toEqual({ ok: true, paise: 70_000 })
  })

  it('rejects a payment greater than the amount due (by one paisa)', () => {
    expect(err(link({ amountPaidPaise: 30_000 }), '700.01')).toBe('Payment cannot exceed the amount due (₹700.00)')
  })

  it.each([
    ['', 'Payment amount is required'],
    ['0', 'Payment amount must be greater than ₹0'],
    ['0.001', 'Payment amount can have at most 2 decimal places'],
    ['-5', 'Enter a valid amount, e.g. 1499.50'],
  ])('rejects %j', (raw, message) => {
    expect(err(link({}), raw)).toBe(message)
  })

  it('enforces the minimum on the first payment only', () => {
    expect(err(link({}), '199.99')).toBe('First payment must be at least ₹200.00')
    expect(err(link({}), '200')).toBeUndefined()
    expect(err(link({ amountPaidPaise: 20_000 }), '0.01')).toBeUndefined()
  })

  it('allows a first payment below the minimum if it clears the full amount', () => {
    expect(err(link({ amountPaise: 15_000, minFirstPaymentPaise: 15_000 }), '150')).toBeUndefined()
  })

  it('requires the full amount when partial payments are not allowed', () => {
    const full = link({ allowPartial: false, minFirstPaymentPaise: undefined })
    expect(err(full, '500')).toBe('This link needs the full amount due (₹1,000.00) in one payment')
    expect(err(full, '1000')).toBeUndefined()
  })

  it('only allows payments on Active or Partially paid links', () => {
    expect(err(link({ expiresAt: '2026-11-12T09:00:00.000Z' }), '200')).toBe(
      'Payments can only be recorded on active or partially paid links',
    )
    expect(err(link({ amountPaidPaise: 100_000 }), '1')).toBe(
      'Payments can only be recorded on active or partially paid links',
    )
  })

  it('paymentError checks paise directly (shared with the API)', () => {
    expect(paymentError(link({}), 100_001, NOW)).toBe('Payment cannot exceed the amount due (₹1,000.00)')
    expect(paymentError(link({}), 20_000, NOW)).toBeUndefined()
  })
})

describe('applyPayment and money totals (AC-16)', () => {
  it('₹0.10 + ₹0.20 on a ₹0.30 link is exactly Paid with ₹0.00 due (no float drift)', () => {
    const tiny = link({ amountPaise: 30, minFirstPaymentPaise: 10 })
    expect(0.1 + 0.2).not.toBe(0.3) // the float trap we avoid

    const first = validateRecordPayment(tiny, '0.10', NOW)
    expect(first).toEqual({ ok: true, paise: 10 })
    const afterFirst = applyPayment(tiny, 10)

    const second = validateRecordPayment(afterFirst, '0.20', NOW)
    expect(second).toEqual({ ok: true, paise: 20 })
    const afterSecond = applyPayment(afterFirst, 20)

    expect(afterSecond.amountPaidPaise).toBe(30)
    expect(amountDuePaise(afterSecond)).toBe(0)
    expect(getStatus(afterSecond, NOW)).toBe('paid')
  })

  it('does not mutate the original link', () => {
    const original = link({})
    applyPayment(original, 20_000)
    expect(original.amountPaidPaise).toBe(0)
  })

  it('a partial payment moves Active → Partially paid, the rest moves it to Paid', () => {
    const partial = applyPayment(link({}), 25_000)
    expect(getStatus(partial, NOW)).toBe('partially_paid')
    expect(getStatus(applyPayment(partial, 75_000), NOW)).toBe('paid')
  })
})
