import { test, expect } from '@playwright/test'
import { expectNoCriticalViolations } from './helpers/axe'
import { loginAsAdmin } from './helpers/auth'

// QA test plan — Section J. Accessibility (P1): axe scan, zero Critical violations.
// Note: we wait for concrete page elements rather than 'networkidle' — Sentry and
// Vercel Analytics keep connections open, so networkidle may never settle.

test.describe('J. Accessibility — axe scans (zero Critical violations)', () => {
  test('J1 — homepage', async ({ page }) => {
    await page.goto('/')
    await page.locator('main').first().waitFor()
    await expectNoCriticalViolations(page, 'J1 Homepage (/)')
  })

  test('J2 — search results', async ({ page }) => {
    await page.goto('/discover')
    // Wait for the discovery results region (grid, empty, or error state).
    await page.locator('section[aria-label="Discovery results"], [role="alert"]').first().waitFor()
    await expectNoCriticalViolations(page, 'J2 Search results (/discover)')
  })

  test('J3 — BLACQList listing page', async ({ page }) => {
    await page.goto('/discover')
    const grid = page.locator('section[aria-label="Discovery results"]')
    await grid.waitFor()
    // Click through to the first listing rather than hardcoding a slug.
    const firstListing = grid.getByRole('link', { name: 'View Page' }).first()
    await expect(
      firstListing,
      'No seeded listings on /discover — run `npx supabase db reset`'
    ).toBeVisible()
    await firstListing.click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    await page.locator('main').first().waitFor()
    await expectNoCriticalViolations(page, `J3 Listing page (${new URL(page.url()).pathname})`)
  })

  test('J4 — sign-up form', async ({ page }) => {
    await page.goto('/sign-up')
    await page.locator('form').first().waitFor()
    await expectNoCriticalViolations(page, 'J4 Sign-up form (/sign-up)')
  })

  test('J5 — admin claims queue', async ({ page }) => {
    await loginAsAdmin(page)
    await page.locator('main').first().waitFor()
    await expectNoCriticalViolations(page, 'J5 Admin claims queue (/admin/claims)')
  })
})
