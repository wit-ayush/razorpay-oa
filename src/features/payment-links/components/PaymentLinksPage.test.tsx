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

describe('PaymentLinksPage', () => {
  it('loads links and filters them by status, including via keyboard', async () => {
    const { user } = renderPage()
    expect(screen.getByText('Loading payment links…')).toBeInTheDocument()
    expect(await screen.findByText('Annual subscription renewal')).toBeInTheDocument()
    expect(linkItems()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Paid (1)' }))
    expect(linkItems()).toHaveLength(1)
    expect(linkItems()[0]).toHaveTextContent('Consultation fee')
    expect(linkItems()[0]).toHaveTextContent('Paid')

    screen.getByRole('button', { name: 'Expired (1)' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Expired (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(linkItems()).toHaveLength(1)
    expect(linkItems()[0]).toHaveTextContent('Bulk order #1043')
    expect(linkItems()[0]).toHaveTextContent('Expired')
  })

  it('shows validation errors on an empty submit and focuses the first invalid field', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(screen.getByText('Description is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a customer email or phone number')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (₹)')).toHaveFocus()
    expect(screen.getByLabelText('Amount (₹)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Amount (₹)')).toHaveAccessibleDescription('Amount is required')
    expect(linkItems()).toHaveLength(3)
  })

  it('creates a valid link, shows it first as Active, announces success and resets the form', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.type(screen.getByLabelText('Amount (₹)'), '1499.50')
    await user.type(screen.getByLabelText('Description'), 'Website design deposit')
    await user.type(screen.getByLabelText('Phone'), '+91 98765 43210')
    await user.click(screen.getByRole('button', { name: 'Create payment link' }))

    expect(await screen.findByText('Payment link for ₹1,499.50 created.')).toBeInTheDocument()
    expect(linkItems()).toHaveLength(4)
    expect(linkItems()[0]).toHaveTextContent('Website design deposit')
    expect(linkItems()[0]).toHaveTextContent('₹1,499.50')
    expect(linkItems()[0]).toHaveTextContent('Active')
    expect(linkItems()[0]).toHaveTextContent('+919876543210')
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Active (2)' })).toBeInTheDocument()
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
    expect(linkItems()).toHaveLength(3)
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

  it('marks an active link as paid, then shows the per-filter empty state', async () => {
    const { user } = renderPage()
    await screen.findByText('Annual subscription renewal')

    await user.click(screen.getByRole('button', { name: 'Mark as paid: Annual subscription renewal' }))
    expect(await screen.findByRole('button', { name: 'Paid (2)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Active (0)' }))
    expect(screen.getByText('No active links.')).toBeInTheDocument()
  })

  it('shows the empty state when there are no links', async () => {
    renderPage(createMockPaymentLinksApi())
    expect(await screen.findByText('No payment links yet. Create one using the form above.')).toBeInTheDocument()
  })
})
