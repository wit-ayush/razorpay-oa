import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createMockPaymentLinksApi, createSeedLinks } from '../api/paymentLinksApi'
import { PaymentLinksPage } from './PaymentLinksPage'

const seededApi = () => createMockPaymentLinksApi({ seed: createSeedLinks(new Date()) })

const renderPage = (api = seededApi()) => {
  const user = userEvent.setup()
  render(<PaymentLinksPage api={api} />)
  return { api, user }
}

const linkItems = () => within(screen.getByRole('list', { name: 'Payment links' })).getAllByRole('listitem')
const itemFor = (description: string) => {
  const item = linkItems().find((li) => li.textContent?.includes(description))
  if (!item) throw new Error(`No list item for ${description}`)
  return item
}

describe('PaymentLinksPage', () => {
  it('loads links and filters them by status, including Partially paid and via keyboard', async () => {
    const { user } = renderPage()
    expect(screen.getByText('Loading payment links…')).toBeInTheDocument()
    expect(await screen.findByText('Annual subscription renewal')).toBeInTheDocument()
    expect(linkItems()).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: 'Partially paid (1)' }))
    expect(linkItems()).toHaveLength(1)
    expect(linkItems()[0]).toHaveTextContent('Website redesign milestone')
    expect(linkItems()[0]).toHaveTextContent('Paid ₹2,500.00 / Due ₹7,500.00')

    await user.click(screen.getByRole('button', { name: 'Paid (1)' }))
    expect(linkItems()).toHaveLength(1)
    expect(linkItems()[0]).toHaveTextContent('Consultation fee')

    screen.getByRole('button', { name: 'Expired (1)' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Expired (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(linkItems()[0]).toHaveTextContent('Bulk order #1043')
    expect(within(linkItems()[0]).queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  })

  it('shows validation errors on an empty submit and focuses the first invalid field', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(screen.getByText('Description is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a customer email or phone number')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (₹)')).toHaveFocus()
    expect(screen.getByLabelText('Amount (₹)')).toHaveAccessibleDescription('Amount is required')
    expect(linkItems()).toHaveLength(4)
  })

  it('requires a minimum first payment ≤ amount when partial payments are allowed', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    expect(screen.queryByLabelText('Minimum first payment (₹)')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Amount (₹)'), '1000')
    await user.click(screen.getByLabelText('Allow partial payments'))
    await user.type(screen.getByLabelText('Minimum first payment (₹)'), '1000.01')
    await user.type(screen.getByLabelText('Description'), 'Deposit')
    await user.type(screen.getByLabelText('Email'), 'buyer@example.com')
    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(screen.getByText('Minimum first payment cannot exceed the amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum first payment (₹)')).toHaveFocus()
    expect(linkItems()).toHaveLength(4)
  })

  it('creates a partial-payment link, records a partial then final payment, and rejects payment > due', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.type(screen.getByLabelText('Amount (₹)'), '1000')
    await user.click(screen.getByLabelText('Allow partial payments'))
    await user.type(screen.getByLabelText('Minimum first payment (₹)'), '200')
    await user.type(screen.getByLabelText('Description'), 'Website design deposit')
    await user.type(screen.getByLabelText('Phone'), '+91 98765 43210')
    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(await screen.findByText('Payment link for ₹1,000.00 created.')).toBeInTheDocument()
    let item = itemFor('Website design deposit')
    expect(linkItems()[0]).toBe(item)
    expect(item).toHaveTextContent('Active')
    expect(item).toHaveTextContent('Paid ₹0.00 / Due ₹1,000.00')

    const payment = () => within(itemFor('Website design deposit')).getByLabelText('Payment amount (₹)')
    const recordButton = () => within(itemFor('Website design deposit')).getByRole('button', { name: 'Record payment' })

    await user.type(payment(), '150')
    await user.click(recordButton())
    expect(within(itemFor('Website design deposit')).getByRole('alert')).toHaveTextContent(
      'First payment must be at least ₹200.00',
    )

    await user.clear(payment())
    await user.type(payment(), '300')
    await user.click(recordButton())
    item = await screen.findByText('Paid ₹300.00 / Due ₹700.00')
    expect(itemFor('Website design deposit')).toHaveTextContent('Partially paid')

    await user.type(payment(), '700.01')
    await user.click(recordButton())
    expect(within(itemFor('Website design deposit')).getByRole('alert')).toHaveTextContent(
      'Payment cannot exceed the amount due (₹700.00)',
    )

    await user.clear(payment())
    await user.type(payment(), '700')
    await user.click(recordButton())
    expect(await screen.findByText('Paid ₹1,000.00 / Due ₹0.00')).toBeInTheDocument()
    expect(itemFor('Website design deposit')).toHaveTextContent('Paid')
    expect(within(itemFor('Website design deposit')).queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  })

  it('keeps the input and shows an error when creating fails', async () => {
    const { api, user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.type(screen.getByLabelText('Amount (₹)'), '250')
    await user.type(screen.getByLabelText('Description'), 'Retry me')
    await user.type(screen.getByLabelText('Email'), 'buyer@example.com')
    api.failNextRequest('Server unavailable')
    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the link: Server unavailable')
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('250')
    expect(linkItems()).toHaveLength(4)
  })

  it('shows a load error with a working Retry button', async () => {
    const api = seededApi()
    api.failNextRequest('Server unavailable')
    const { user } = renderPage(api)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load payment links: Server unavailable")
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Annual subscription renewal')).toBeInTheDocument()
  })

  it('paying the full amount due on an Active link makes it Paid, then shows the per-filter empty state', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    const item = itemFor('Annual subscription renewal')
    await user.type(within(item).getByLabelText('Payment amount (₹)'), '2499')
    await user.click(within(item).getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByRole('button', { name: 'Paid (2)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Active (0)' }))
    expect(screen.getByText('No active links.')).toBeInTheDocument()
  })

  it('shows the empty state when there are no links', async () => {
    renderPage(createMockPaymentLinksApi())
    expect(await screen.findByText('No payment links yet. Create one using the form above.')).toBeInTheDocument()
  })
})
