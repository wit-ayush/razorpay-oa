export type LinkStatus = 'active' | 'paid' | 'expired'
export type StatusFilter = 'all' | LinkStatus

export interface Customer {
  email?: string
  phone?: string
}

export interface PaymentLink {
  id: string
  /** Amount in integer paise (₹1 = 100 paise). Never a float. */
  amountPaise: number
  description: string
  customer: Customer
  /** ISO timestamp; absent means the link never expires. */
  expiresAt?: string
  /** ISO timestamp; present means the link has been paid. */
  paidAt?: string
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
}

export type LinkFormField = keyof LinkFormValues
/** `customer` is the "at least one of email/phone" group error. */
export type LinkFormErrors = Partial<Record<LinkFormField | 'customer', string>>

/** Validated, normalised input for creating a link. */
export interface NewLinkInput {
  amountPaise: number
  description: string
  customer: Customer
  expiresAt?: string
}
