import { useRef, useState, type SubmitEvent, type ReactNode, type RefObject } from 'react'
import { toMessage } from '../hooks/usePaymentLinks'
import { formatINR } from '../lib/amount'
import { DESCRIPTION_MAX, firstInvalidField, validateLinkForm } from '../lib/validation'
import type { LinkFormField, LinkFormValues, NewLinkInput, PaymentLink } from '../types'

interface CreateLinkFormProps {
  onCreate: (input: NewLinkInput) => Promise<PaymentLink>
  /** Injected clock so the "expiry must be in the future" rule is testable. */
  getNow?: () => Date
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const EMPTY: LinkFormValues = {
  amount: '',
  description: '',
  email: '',
  phone: '',
  expiresAt: '',
  allowPartial: false,
  minFirstPayment: '',
}
const defaultNow = () => new Date()

export function CreateLinkForm({ onCreate, getNow = defaultNow }: CreateLinkFormProps) {
  const [values, setValues] = useState<LinkFormValues>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<LinkFormField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' })

  const refs: Record<LinkFormField, RefObject<HTMLInputElement | null>> = {
    amount: useRef<HTMLInputElement>(null),
    minFirstPayment: useRef<HTMLInputElement>(null),
    description: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    expiresAt: useRef<HTMLInputElement>(null),
  }

  const validation = validateLinkForm(values, getNow())
  const errors = validation.ok ? {} : validation.errors
  const errorFor = (field: LinkFormField) => (submitted || touched[field] ? errors[field] : undefined)
  const customerError = submitted || (touched.email && touched.phone) ? errors.customer : undefined
  const submitting = submitState.status === 'submitting'

  const update = (field: LinkFormField, value: string) => setValues((current) => ({ ...current, [field]: value }))
  const markTouched = (field: LinkFormField) => setTouched((current) => ({ ...current, [field]: true }))

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const result = validateLinkForm(values, getNow())
    if (!result.ok) {
      setSubmitState({ status: 'idle' })
      const field = firstInvalidField(result.errors)
      if (field) refs[field].current?.focus()
      return
    }

    setSubmitState({ status: 'submitting' })
    try {
      const created = await onCreate(result.value)
      setValues(EMPTY)
      setTouched({})
      setSubmitted(false)
      setSubmitState({ status: 'success', message: `Payment link for ${formatINR(created.amountPaise)} created.` })
      refs.amount.current?.focus()
    } catch (error) {
      setSubmitState({ status: 'error', message: `Could not create the link: ${toMessage(error)}` })
    }
  }

  const fieldProps = (field: LinkFormField, error?: string, extraDescribedBy?: string) => ({
    id: `link-${field}`,
    ref: refs[field],
    value: values[field],
    onChange: (event: { target: { value: string } }) => update(field, event.target.value),
    onBlur: () => markTouched(field),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [error ? `link-${field}-error` : undefined, extraDescribedBy].filter(Boolean).join(' ') || undefined,
  })

  return (
    <form className="link-form" noValidate onSubmit={handleSubmit}>
      <Field label="Amount (₹)" field="amount" error={errorFor('amount')}>
        <input {...fieldProps('amount', errorFor('amount'))} inputMode="decimal" autoComplete="off" placeholder="1499.50" />
      </Field>

      <div className="field field--checkbox">
        <input
          id="link-allowPartial"
          type="checkbox"
          checked={values.allowPartial}
          onChange={(event) => setValues((current) => ({ ...current, allowPartial: event.target.checked }))}
        />
        <label htmlFor="link-allowPartial">Allow partial payments</label>
      </div>

      {values.allowPartial && (
        <Field label="Minimum first payment (₹)" field="minFirstPayment" error={errorFor('minFirstPayment')}>
          <input {...fieldProps('minFirstPayment', errorFor('minFirstPayment'))} inputMode="decimal" autoComplete="off" />
        </Field>
      )}

      <Field label="Description" field="description" error={errorFor('description')}>
        <input {...fieldProps('description', errorFor('description'), 'link-description-count')} autoComplete="off" />
        <span id="link-description-count" className="field__hint">
          {values.description.trim().length}/{DESCRIPTION_MAX} characters
        </span>
      </Field>

      <fieldset className="link-form__customer" aria-describedby={customerError ? 'link-customer-error' : undefined}>
        <legend>Customer (email or phone, at least one)</legend>
        <Field label="Email" field="email" error={errorFor('email')}>
          <input
            {...fieldProps('email', errorFor('email'), customerError ? 'link-customer-error' : undefined)}
            type="email"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" field="phone" error={errorFor('phone')}>
          <input
            {...fieldProps('phone', errorFor('phone'), customerError ? 'link-customer-error' : undefined)}
            type="tel"
            autoComplete="tel"
            placeholder="98765 43210"
          />
        </Field>
        {customerError && (
          <p id="link-customer-error" className="field__error">
            {customerError}
          </p>
        )}
      </fieldset>

      <Field label="Expiry (optional)" field="expiresAt" error={errorFor('expiresAt')}>
        <input {...fieldProps('expiresAt', errorFor('expiresAt'))} type="datetime-local" />
      </Field>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create payment link'}
      </button>

      <output aria-live="polite" className="link-form__status">
        {submitState.status === 'success' ? submitState.message : ''}
      </output>
      {submitState.status === 'error' && (
        <p role="alert" className="field__error">
          {submitState.message}
        </p>
      )}
    </form>
  )
}

interface FieldProps {
  children: ReactNode
  label: string
  field: LinkFormField
  error?: string
}

function Field({ label, field, error, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={`link-${field}`}>{label}</label>
      {children}
      {error && (
        <p id={`link-${field}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}
