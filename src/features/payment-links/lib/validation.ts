import type { LinkFormErrors, LinkFormField, LinkFormValues, NewLinkInput } from '../types'
import { parseAmountToPaise } from './amount'

export const DESCRIPTION_MAX = 100

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Indian mobile: optional +91, then 10 digits starting 6-9. */
const INDIAN_MOBILE = /^(?:\+91)?[6-9]\d{9}$/

export type ValidationResult = { ok: true; value: NewLinkInput } | { ok: false; errors: LinkFormErrors }

/** Removes spaces and hyphens people commonly type in phone numbers. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

/** Validates the whole create-link form. `now` is injected so the expiry rule is deterministic. */
export function validateLinkForm(values: LinkFormValues, now: Date): ValidationResult {
  const errors: LinkFormErrors = {}

  const amount = parseAmountToPaise(values.amount)
  if (!amount.ok) errors.amount = amount.error

  const description = values.description.trim()
  if (description === '') errors.description = 'Description is required'
  else if (description.length > DESCRIPTION_MAX) errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer`

  const email = values.email.trim()
  const phone = normalizePhone(values.phone)
  if (email === '' && phone === '') errors.customer = 'Enter a customer email or phone number'
  if (email !== '' && !EMAIL.test(email)) errors.email = 'Enter a valid email address'
  if (phone !== '' && !INDIAN_MOBILE.test(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number'

  let minFirstPaymentPaise: number | undefined
  if (values.allowPartial) {
    const min = parseAmountToPaise(values.minFirstPayment)
    if (!min.ok) errors.minFirstPayment = min.error.replace(/^Amount/, 'Minimum first payment')
    else if (amount.ok && min.paise > amount.paise) errors.minFirstPayment = 'Minimum first payment cannot exceed the amount'
    else minFirstPaymentPaise = min.paise
  }

  let expiresAt: string | undefined
  if (values.expiresAt.trim() !== '') {
    const expiry = new Date(values.expiresAt)
    if (Number.isNaN(expiry.getTime())) errors.expiresAt = 'Enter a valid expiry date and time'
    else if (expiry.getTime() <= now.getTime()) errors.expiresAt = 'Expiry must be in the future'
    else expiresAt = expiry.toISOString()
  }

  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      amountPaise: amount.paise,
      description,
      customer: { ...(email && { email }), ...(phone && { phone }) },
      expiresAt,
      allowPartial: values.allowPartial,
      minFirstPaymentPaise,
    },
  }
}

const FIELD_ORDER: LinkFormField[] = ['amount', 'minFirstPayment', 'description', 'email', 'phone', 'expiresAt']

/** The field that should receive focus after a failed submit (form order). */
export function firstInvalidField(errors: LinkFormErrors): LinkFormField | undefined {
  return FIELD_ORDER.find((field) => errors[field] || (field === 'email' && errors.customer))
}
