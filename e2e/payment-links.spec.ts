import { expect, test } from '@playwright/test'

test.describe('Payment links manager', () => {
  test('create a link, then filter by status', async ({ page }) => {
    await page.goto('/')
    const list = page.getByRole('list', { name: 'Payment links' })
    await expect(list.getByRole('listitem')).toHaveCount(4)

    await page.getByLabel('Amount (₹)', { exact: true }).fill('1499.50')
    await page.getByLabel('Description').fill('E2E website deposit')
    await page.getByLabel('Email').fill('buyer@example.com')
    await page.getByRole('button', { name: 'Create payment link' }).click()

    await expect(page.getByText('Payment link for ₹1,499.50 created.')).toBeVisible()
    const newLink = list.getByRole('listitem').filter({ hasText: 'E2E website deposit' })
    await expect(newLink).toContainText('₹1,499.50')
    await expect(newLink).toContainText('Active')
    await expect(list.getByRole('listitem').first()).toContainText('E2E website deposit')

    await page.getByRole('button', { name: 'Paid (1)', exact: true }).click()
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await expect(newLink).toHaveCount(0)

    await page.getByRole('button', { name: 'Active (2)', exact: true }).click()
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(newLink).toBeVisible()
  })

  test('blocks an invalid submission and focuses the first invalid field', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Amount (₹)', { exact: true }).fill('500000.01')
    await page.getByRole('button', { name: 'Create payment link' }).click()

    await expect(page.getByText('Amount cannot exceed ₹5,00,000')).toBeVisible()
    await expect(page.getByText('Description is required')).toBeVisible()
    await expect(page.getByLabel('Amount (₹)', { exact: true })).toBeFocused()
  })

  test('is usable at mobile width without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.getByRole('list', { name: 'Payment links' }).getByRole('listitem')).toHaveCount(4)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('partial payment survives a reload, then paying the rest makes it Paid', async ({ page }) => {
    await page.goto('/')
    const list = page.getByRole('list', { name: 'Payment links' })
    await expect(list.getByRole('listitem')).toHaveCount(4)

    await page.getByLabel('Amount (₹)', { exact: true }).fill('1000')
    await page.getByLabel('Allow partial payments').check()
    await page.getByLabel('Minimum first payment (₹)').fill('200')
    await page.getByLabel('Description').fill('E2E partial deposit')
    await page.getByLabel('Email').fill('buyer@example.com')
    await page.getByRole('button', { name: 'Create payment link' }).click()

    const link = list.getByRole('listitem').filter({ hasText: 'E2E partial deposit' })
    await link.getByLabel('Payment amount (₹)').fill('300')
    await link.getByRole('button', { name: 'Record payment' }).click()
    await expect(link).toContainText('Partially paid')
    await expect(link).toContainText('Paid ₹300.00 / Due ₹700.00')

    await page.reload()
    await expect(list.getByRole('listitem')).toHaveCount(5)
    await expect(link).toContainText('Partially paid')
    await expect(link).toContainText('Paid ₹300.00 / Due ₹700.00')

    await page.getByRole('button', { name: 'Partially paid (2)' }).click()
    await expect(link).toBeVisible()

    await link.getByLabel('Payment amount (₹)').fill('700')
    await link.getByRole('button', { name: 'Record payment' }).click()
    await page.getByRole('button', { name: 'Paid (2)', exact: true }).click()
    await expect(link).toContainText('Paid ₹1,000.00 / Due ₹0.00')
  })
})
