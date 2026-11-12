export type LinkStatus = 'active' | 'partially_paid' | 'paid' | 'expired'
export type StatusFilter = 'all' | LinkStatus

export interface Customer {
  email?: string
  phone?: string
}

export interface PaymentLink {
  id: string
  /** Amount in integer paise (₹1 = 100 paise). Never a float. */
  amountPaise: number
  /** Total recorded payments in integer paise. Paid in full when equal to amountPaise. */
  amountPaidPaise: number
  allowPartial: boolean
  /** Only meaningful when allowPartial is true. */
  minFirstPaymentPaise?: number
  description: string
  customer: Customer
  /** ISO timestamp; absent means the link never expires. */
  expiresAt?: string
  createdAt: string
}

/** Raw form values exactly as typed by the user. */
export interface LinkFormValues {
  amount: string
  description: string
  email: string
  phone: string
  /** `datetime-local` value (YYYY-MM-DDTHH:mm, local time) or ''. */
  expiresAt: string
  allowPartial: boolean
  minFirstPayment: string
}

/** Text inputs of the form (the checkbox is handled separately). */
export type LinkFormField = Exclude<keyof LinkFormValues, 'allowPartial'>
/** `customer` is the "at least one of email/phone" group error. */
export type LinkFormErrors = Partial<Record<LinkFormField | 'customer', string>>

/** Validated, normalised input for creating a link. */
export interface NewLinkInput {
  amountPaise: number
  description: string
  customer: Customer
  expiresAt?: string
  allowPartial: boolean
  minFirstPaymentPaise?: number
}
