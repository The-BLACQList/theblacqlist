import { test, expect } from '@playwright/test'
import { loginAsOwner } from './helpers/auth'
import {
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_CLAIMABLE_NAME,
  FIXTURE_NAME_QUERY,
  FIXTURE_OWNED_ID,
  FIXTURE_PENDING_CLAIM_ID,
  FIXTURE_PENDING_CLAIM_NAME,
} from './helpers/fixtures'

/**
 * Claim workflow — TA-09 steps 2/3/4/5/7/8.
 *
 * Step 1 (anonymous → /sign-in?next=/claim/{id}) is asserted in
 * route-guards.spec.ts; the cross-browser cells are in cross-browser.spec.ts.
 *
 * ⚠ Nothing here SUBMITS a claim. A submitted claim would flip the claimable
 * fixture into the "pending" branch, and cross-browser.spec.ts — which sorts
 * after this file and walks that exact listing — would fail on a state this
 * spec created. global-setup only reconciles claims between runs, not between
 * files. The three branch pages are covered by three separate fixtures instead:
 * unclaimed, already-claimed, and already-pending.
 */

test.describe('claim workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('TA-09 steps 2–3 — search finds a claimable listing and opens its form', async ({
    page,
  }) => {
    await page.goto('/claim')
    await expect(page.getByRole('heading', { name: 'Claim a listing', level: 1 })).toBeVisible()

    await page.getByLabel('Search for a business to claim').fill(FIXTURE_NAME_QUERY)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForURL(/\/claim\?q=/)
    await expect(page.getByText(FIXTURE_CLAIMABLE_NAME).first()).toBeVisible()

    await page
      .locator('div', { hasText: FIXTURE_CLAIMABLE_NAME })
      .getByRole('link', { name: 'Claim' })
      .first()
      .click()
    await page.waitForURL(`**/claim/${FIXTURE_CLAIMABLE_ID}`)
    await expect(page.getByRole('heading', { name: 'Submit a claim', level: 1 })).toBeVisible()
  })

  test('TA-09 step 4 — the claim form will not submit without a verification email', async ({
    page,
  }) => {
    await page.goto(`/claim/${FIXTURE_CLAIMABLE_ID}`)
    const email = page.locator('#verification_email')
    await expect(email).toBeVisible()

    await email.fill('')
    await page.getByRole('button', { name: /submit/i }).click()

    // Native constraint validation blocks it — assert the browser's own verdict
    // rather than an error string, and assert we never left the page.
    await expect(email).toHaveJSProperty('validity.valueMissing', true)
    await expect(page).toHaveURL(new RegExp(`/claim/${FIXTURE_CLAIMABLE_ID}$`))
  })

  test('TA-09 step 5 — an already-claimed listing offers no claim form', async ({ page }) => {
    await page.goto(`/claim/${FIXTURE_OWNED_ID}`)
    await expect(
      page.getByRole('heading', { name: 'This listing has already been claimed', level: 1 })
    ).toBeVisible()
    await expect(page.locator('#verification_email')).toHaveCount(0)
  })

  test('TA-09 step 7 — a second claim on the same listing is refused', async ({ page }) => {
    await page.goto(`/claim/${FIXTURE_PENDING_CLAIM_ID}`)
    await expect(
      page.getByRole('heading', { name: 'You already have a pending claim', level: 1 })
    ).toBeVisible()
    await expect(page.locator('#verification_email')).toHaveCount(0)
  })

  test('TA-09 step 8 — the pending claim appears in the claimant account', async ({ page }) => {
    await page.goto('/account/claims')
    await expect(page.getByRole('heading', { name: 'My claims', level: 1 })).toBeVisible()
    await expect(page.getByText(FIXTURE_PENDING_CLAIM_NAME).first()).toBeVisible()
    await expect(page.getByText('Pending review').first()).toBeVisible()
  })
})
