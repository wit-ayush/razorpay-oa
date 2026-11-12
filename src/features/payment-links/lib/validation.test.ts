import { describe, expect, it } from 'vitest'
import type { LinkFormValues } from '../types'
import { DESCRIPTION_MAX, firstInvalidField, validateLinkForm } from './validation'

const NOW = new Date('2026-11-12T10:00:00')

const valid: LinkFormValues = {
  amount: '1499.50',
  description: 'Invoice #42',
  email: 'buyer@example.com',
  phone: '',
  expiresAt: '',
  allowPartial: false,
  minFirstPayment: '',
}

const errorsFor = (overrides: Partial<LinkFormValues>) => {
  const result = validateLinkForm({ ...valid, ...overrides }, NOW)
  return result.ok ? {} : result.errors
}

describe('validateLinkForm', () => {
  it('returns normalised input for a valid form', () => {
    expect(
      validateLinkForm({ ...valid, description: '  Invoice #42  ', phone: '+91 98765-43210' }, NOW),
    ).toEqual({
      ok: true,
      value: {
        amountPaise: 149950,
        description: 'Invoice #42',
        customer: { email: 'buyer@example.com', phone: '+919876543210' },
        expiresAt: undefined,
        allowPartial: false,
        minFirstPaymentPaise: undefined,
      },
    })
  })

  it('reports amount errors from the amount parser', () => {
    expect(errorsFor({ amount: '0' }).amount).toBe('Amount must be greater than ₹0')
  })

  describe('description', () => {
    it('is required and whitespace-only does not count', () => {
      expect(errorsFor({ description: '' }).description).toBe('Description is required')
      expect(errorsFor({ description: '    ' }).description).toBe('Description is required')
    })

    it(`allows exactly ${DESCRIPTION_MAX} characters and rejects ${DESCRIPTION_MAX + 1}`, () => {
      expect(errorsFor({ description: 'a'.repeat(DESCRIPTION_MAX) }).description).toBeUndefined()
      expect(errorsFor({ description: 'a'.repeat(DESCRIPTION_MAX + 1) }).description).toBe(
        'Description must be 100 characters or fewer',
      )
    })

    it('measures length after trimming', () => {
      expect(errorsFor({ description: `  ${'a'.repeat(DESCRIPTION_MAX)}  ` }).description).toBeUndefined()
    })
  })

  describe('customer email or phone', () => {
    it('requires at least one of email or phone', () => {
      expect(errorsFor({ email: '', phone: '' }).customer).toBe('Enter a customer email or phone number')
      expect(errorsFor({ email: '  ', phone: ' ' }).customer).toBe('Enter a customer email or phone number')
    })

    it('accepts phone only', () => {
      expect(errorsFor({ email: '', phone: '9876543210' })).toEqual({})
    })

    it.each(['buyer@', 'buyer@example', '@example.com', 'buyer example@x.com'])('rejects email %j', (email) => {
      expect(errorsFor({ email }).email).toBe('Enter a valid email address')
    })

    it.each(['98765', '5876543210', '98765432100', '+9198765', 'abcdefghij', '+1 9876543210'])(
      'rejects phone %j',
      (phone) => {
        expect(errorsFor({ email: '', phone }).phone).toBe('Enter a valid 10-digit Indian mobile number')
      },
    )

    it.each(['9876543210', '+919876543210', '+91 98765 43210', '6000000000'])('accepts phone %j', (phone) => {
      expect(errorsFor({ email: '', phone }).phone).toBeUndefined()
    })

    it('validates both when both are given', () => {
      const errors = errorsFor({ email: 'buyer@example.com', phone: '123' })
      expect(errors.phone).toBe('Enter a valid 10-digit Indian mobile number')
      expect(errors.customer).toBeUndefined()
    })
  })

  describe('expiry', () => {
    it('is optional', () => {
      expect(errorsFor({ expiresAt: '' }).expiresAt).toBeUndefined()
    })

    it('must be strictly in the future', () => {
      expect(errorsFor({ expiresAt: '2026-11-12T09:59' }).expiresAt).toBe('Expiry must be in the future')
      expect(errorsFor({ expiresAt: '2026-11-12T10:00' }).expiresAt).toBe('Expiry must be in the future')
      expect(errorsFor({ expiresAt: '2026-11-12T10:01' }).expiresAt).toBeUndefined()
    })

    it('rejects an unparseable date', () => {
      expect(errorsFor({ expiresAt: 'not-a-date' }).expiresAt).toBe('Enter a valid expiry date and time')
    })

    it('converts a valid local expiry into an ISO timestamp', () => {
      const result = validateLinkForm({ ...valid, expiresAt: '2026-11-13T18:30' }, NOW)
      expect(result.ok && result.value.expiresAt).toBe(new Date('2026-11-13T18:30').toISOString())
    })
  })
})

describe('minimum first payment (AC-13)', () => {
  const partial = (minFirstPayment: string, amount = '1000') => errorsFor({ allowPartial: true, minFirstPayment, amount })

  it('is required when partial payments are allowed', () => {
    expect(partial('').minFirstPayment).toBe('Minimum first payment is required')
  })

  it('must be > 0 with at most 2 decimals', () => {
    expect(partial('0').minFirstPayment).toBe('Minimum first payment must be greater than ₹0')
    expect(partial('10.001').minFirstPayment).toBe('Minimum first payment can have at most 2 decimal places')
  })

  it('may equal the amount but not exceed it', () => {
    expect(partial('1000').minFirstPayment).toBeUndefined()
    expect(partial('1000.01').minFirstPayment).toBe('Minimum first payment cannot exceed the amount')
  })

  it('is ignored when partial payments are not allowed', () => {
    expect(errorsFor({ allowPartial: false, minFirstPayment: '99999999' }).minFirstPayment).toBeUndefined()
  })

  it('is converted to paise in the output', () => {
    const result = validateLinkForm({ ...valid, allowPartial: true, minFirstPayment: '200.50' }, NOW)
    expect(result.ok && result.value).toMatchObject({ allowPartial: true, minFirstPaymentPaise: 20050 })
  })
})

describe('firstInvalidField', () => {
  it('follows form order and maps the customer group error to the email field', () => {
    expect(firstInvalidField({ expiresAt: 'x', description: 'x' })).toBe('description')
    expect(firstInvalidField({ minFirstPayment: 'x', description: 'x' })).toBe('minFirstPayment')
    expect(firstInvalidField({ customer: 'x', expiresAt: 'x' })).toBe('email')
    expect(firstInvalidField({})).toBeUndefined()
  })
})
