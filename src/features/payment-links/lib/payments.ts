import type { PaymentLink } from '../types'
import { formatINR, parseAmountToPaise } from './amount'
import { amountDuePaise, getStatus } from './status'

export type RecordPaymentResult = { ok: true; paise: number } | { ok: false; error: string }

/**
 * Business rules for a payment already in paise. Shared by the UI and the API.
 * Returns an error message, or undefined when the payment is allowed.
 */
export function paymentError(link: PaymentLink, paise: number, now: Date): string | undefined {
  const status = getStatus(link, now)
  if (status !== 'active' && status !== 'partially_paid') return 'Payments can only be recorded on active or partially paid links'
  if (!Number.isInteger(paise) || paise <= 0) return 'Payment amount must be greater than ₹0'

  const due = amountDuePaise(link)
  if (paise > due) return `Payment cannot exceed the amount due (${formatINR(due)})`
  if (!link.allowPartial && paise !== due) return `This link needs the full amount due (${formatINR(due)}) in one payment`

  const isFirstPayment = link.amountPaidPaise === 0
  const minimum = link.minFirstPaymentPaise ?? 0
  if (link.allowPartial && isFirstPayment && paise < minimum && paise !== due) {
    return `First payment must be at least ${formatINR(minimum)}`
  }
  return undefined
}

/** Parses a typed rupee amount and applies the payment rules. */
export function validateRecordPayment(link: PaymentLink, raw: string, now: Date): RecordPaymentResult {
  const parsed = parseAmountToPaise(raw)
  if (!parsed.ok) return { ok: false, error: parsed.error.replace(/^Amount/, 'Payment amount') }
  const error = paymentError(link, parsed.paise, now)
  return error ? { ok: false, error } : { ok: true, paise: parsed.paise }
}

/** Returns a new link with the payment added (integer paise, no float maths). */
export function applyPayment(link: PaymentLink, paise: number): PaymentLink {
  return { ...link, amountPaidPaise: link.amountPaidPaise + paise }
}
