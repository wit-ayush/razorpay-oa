import { expect, test } from '@playwright/test'

// Toolchain smoke test: proves Playwright + dev server are wired. Replace with the real happy-path E2E.
test('app loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
