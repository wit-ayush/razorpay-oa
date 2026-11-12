import { useId, useState, type SubmitEvent } from 'react'
import { toMessage } from '../hooks/usePaymentLinks'
import { formatINR } from '../lib/amount'
import { validateRecordPayment } from '../lib/payments'
import { amountDuePaise } from '../lib/status'
import type { PaymentLink } from '../types'

interface RecordPaymentFormProps {
  link: PaymentLink
  now: Date
  onRecordPayment: (id: string, amountPaise: number) => Promise<void>
}

export function RecordPaymentForm({ link, now, onRecordPayment }: RecordPaymentFormProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const id = useId()
  const inputId = `${id}-amount`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const due = amountDuePaise(link)
  const isFirstPayment = link.amountPaidPaise === 0
  const hint = !link.allowPartial
    ? `Full amount only: ${formatINR(due)}`
    : isFirstPayment && link.minFirstPaymentPaise
      ? `Minimum first payment ${formatINR(link.minFirstPaymentPaise)}, up to ${formatINR(due)}`
      : `Up to ${formatINR(due)}`

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateRecordPayment(link, amount, now)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(undefined)
    setSubmitting(true)
    try {
      await onRecordPayment(link.id, result.paise)
      setAmount('')
    } catch (failure) {
      setError(`Could not record the payment: ${toMessage(failure)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="record-payment" noValidate onSubmit={handleSubmit} aria-label={`Record payment for ${link.description}`}>
      <label htmlFor={inputId}>Payment amount (₹)</label>
      <input
        id={inputId}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
      />
      <span id={hintId} className="field__hint">
        {hint}
      </span>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Recording…' : 'Record payment'}
      </button>
      {error && (
        <p id={errorId} role="alert" className="field__error">
          {error}
        </p>
      )}
    </form>
  )
}
