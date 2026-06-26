import { test } from '@playwright/test'
import { expectNoLabelViolations } from './helpers/axe'
import { loginAsAdmin } from './helpers/auth'

// J14 — every form control has an associated <label> or accessible name.
// Scope (per decision): key form-bearing routes, not all 37 screens.

const PUBLIC_FORM_ROUTES = [
  { path: '/sign-up', label: 'J14 Sign-up form' },
  { path: '/sign-in', label: 'J14 Sign-in form' },
  { path: '/forgot-password', label: 'J14 Forgot-password form' },
  { path: '/discover', label: 'J14 Discover (search)' },
]

test.describe('J. Accessibility — form labels (J14)', () => {
  for (const route of PUBLIC_FORM_ROUTES) {
    test(`${route.label} (${route.path})`, async ({ page }) => {
      await page.goto(route.path)
      await page.locator('main, form').first().waitFor()
      await expectNoLabelViolations(page, route.label)
    })
  }

  test('J14 Admin claims queue (authenticated)', async ({ page }) => {
    await loginAsAdmin(page)
    await page.locator('main').first().waitFor()
    await expectNoLabelViolations(page, 'J14 Admin claims queue')
  })

  test('J14 Listing page (report-correction form fields)', async ({ page }) => {
    await page.goto('/discover')
    await page
      .locator('section[aria-label="Discovery results"]')
      .getByRole('link', { name: 'View Page' })
      .first()
      .click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    // Open the report-correction dialog so its inputs are present in the DOM.
    await page.getByRole('button', { name: 'Report incorrect information' }).click()
    await page.locator('[role="dialog"]').first().waitFor()
    await expectNoLabelViolations(page, 'J14 Report-correction form')
  })
})
