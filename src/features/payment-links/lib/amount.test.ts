import { describe, expect, it } from 'vitest'
import { formatINR, MAX_AMOUNT_PAISE, parseAmountToPaise } from './amount'

describe('parseAmountToPaise', () => {
  it.each([
    ['1', 100],
    ['0.01', 1],
    ['1499.5', 149950],
    ['1499.50', 149950],
    ['007', 700],
    ['  250  ', 25000],
    ['500000', MAX_AMOUNT_PAISE],
    ['500000.00', MAX_AMOUNT_PAISE],
  ])('accepts %j as %i paise', (input, paise) => {
    expect(parseAmountToPaise(input)).toEqual({ ok: true, paise })
  })

  it.each([
    ['', 'Amount is required'],
    ['   ', 'Amount is required'],
    ['0', 'Amount must be greater than ₹0'],
    ['0.00', 'Amount must be greater than ₹0'],
    ['0.001', 'Amount can have at most 2 decimal places'],
    ['10.999', 'Amount can have at most 2 decimal places'],
    ['500000.01', 'Amount cannot exceed ₹5,00,000'],
    ['1000000', 'Amount cannot exceed ₹5,00,000'],
    ['abc', 'Enter a valid amount, e.g. 1499.50'],
    ['1,000', 'Enter a valid amount, e.g. 1499.50'],
    ['-5', 'Enter a valid amount, e.g. 1499.50'],
    ['1.', 'Enter a valid amount, e.g. 1499.50'],
    ['1e3', 'Enter a valid amount, e.g. 1499.50'],
  ])('rejects %j with %j', (input, error) => {
    expect(parseAmountToPaise(input)).toEqual({ ok: false, error })
  })

  it('does not suffer float rounding (0.29 * 100 !== 29 in floats)', () => {
    expect(parseAmountToPaise('0.29')).toEqual({ ok: true, paise: 29 })
    expect(parseAmountToPaise('4.35')).toEqual({ ok: true, paise: 435 })
  })
})

describe('formatINR', () => {
  it('formats paise as Indian rupees with lakh grouping', () => {
    expect(formatINR(MAX_AMOUNT_PAISE)).toBe('₹5,00,000.00')
    expect(formatINR(149950)).toBe('₹1,499.50')
    expect(formatINR(1)).toBe('₹0.01')
  })
})
