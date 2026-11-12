export const MAX_AMOUNT_PAISE = 500_000 * 100

export type AmountResult = { ok: true; paise: number } | { ok: false; error: string }

const DECIMAL_NUMBER = /^\d+(\.\d+)?$/
const AT_MOST_TWO_DECIMALS = /^\d+(\.\d{1,2})?$/

/**
 * Parses a user-typed rupee amount into integer paise using string arithmetic,
 * so values like "0.29" never go through float multiplication.
 */
export function parseAmountToPaise(raw: string): AmountResult {
  const value = raw.trim()
  if (value === '') return { ok: false, error: 'Amount is required' }
  if (!DECIMAL_NUMBER.test(value)) return { ok: false, error: 'Enter a valid amount, e.g. 1499.50' }
  if (!AT_MOST_TWO_DECIMALS.test(value)) return { ok: false, error: 'Amount can have at most 2 decimal places' }

  const [rupees, fraction = ''] = value.split('.')
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))

  if (paise <= 0) return { ok: false, error: 'Amount must be greater than ₹0' }
  if (paise > MAX_AMOUNT_PAISE) return { ok: false, error: 'Amount cannot exceed ₹5,00,000' }
  return { ok: true, paise }
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

/** Display only: converts paise to a formatted rupee string, e.g. ₹1,499.50. */
export function formatINR(paise: number): string {
  return inrFormatter.format(paise / 100)
}
