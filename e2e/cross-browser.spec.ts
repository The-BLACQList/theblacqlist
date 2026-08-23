import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsOwner } from './helpers/auth'
import { trackConsoleErrors } from './helpers/console'
import {
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_CLAIMABLE_NAME,
  FIXTURE_NAME_QUERY,
  FIXTURE_OWNED_ID,
  FIXTURE_OWNED_NAME,
} from './helpers/fixtures'

// L. Cross-Browser — representative critical paths run across 3 projects
// (chromium=Chrome desktop, webkit-desktop=Safari engine, chromium-mobile=375px).
// Covers functional completion + zero console errors. NOT covered by automation:
// visual "layout" judgment (needs human eyes) and real Safari.app / real device.
//
// All five paths (B, C, D, E, G) run here, so the 15-cell L grid is machine-
// covered. C/D/E were manual until the owner fixture landed in global-setup —
// they were blocked on an authenticated non-admin identity that owned something,
// not on anything about the paths themselves.
//
// ⚠ These paths MUST live in this file. playwright.config.ts scopes
// webkit-desktop and chromium-mobile with `testMatch: /cross-browser\.spec\.ts/`.
// A path moved into its own spec silently drops to chromium-only and takes two
// L cells with it.

const RESULTS = 'section[aria-label="Discovery results"]'

test.describe('L. Cross-browser critical paths', () => {
  test('B — Discovery flow (home → discover → listing)', async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page)

    await page.goto('/')
    await page.locator('main').first().waitFor()

    await page.goto('/discover')
    const grid = page.locator(RESULTS)
    await grid.waitFor()
    await grid.getByRole('link', { name: 'View Page' }).first().click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    await page.locator('main').first().waitFor()
    await expect(page.locator('h1').first()).toBeVisible()

    expect(errors(), `[${testInfo.project.name}] console errors during Discovery`).toEqual([])
  })

  test('C — Add Business flow (sign in → /add-business → step 1 renders)', async ({
    page,
  }, testInfo) => {
    const errors = trackConsoleErrors(page)

    await loginAsOwner(page) // lands on /dashboard
    await page.goto('/add-business')
    await page.locator('main').first().waitFor()
    await expect(page.getByRole('heading', { name: 'Add your business' })).toBeVisible()

    // Walk step 0 → step 1. A heading assertion alone would pass on a page
    // whose form never mounted; advancing a step proves the wizard is live.
    // (Not `page.locator('form').first()` — the site header carries its own
    // search form, which is collapsed at 375px and would fail the mobile cell
    // for a reason that has nothing to do with this path.)
    await expect(page.getByRole('group', { name: 'Business ownership' })).toBeVisible()
    // Anchored regex, not a substring: the Ally option's description reads
    // "Not Black-owned, but supports Black-owned businesses", so a plain
    // 'Black-Owned' name matches both buttons.
    await page.getByRole('button', { name: /^Black-Owned/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#name')).toBeVisible()

    expect(errors(), `[${testInfo.project.name}] console errors during Add Business`).toEqual([])
  })

  test('D — Claim flow (search → claim a listing → form renders)', async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page)

    await loginAsOwner(page)
    await page.goto('/claim')
    await page.locator('main').first().waitFor()

    await page.getByLabel('Search for a business to claim').fill(FIXTURE_NAME_QUERY)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForURL(/\/claim\?q=/)

    // Reach the claim form through the results list, the way an owner does —
    // navigating straight to /claim/{id} would skip the search entirely.
    await page
      .locator('div', { hasText: FIXTURE_CLAIMABLE_NAME })
      .getByRole('link', { name: 'Claim' })
      .first()
      .click()
    await page.waitForURL(`**/claim/${FIXTURE_CLAIMABLE_ID}`)
    await expect(page.getByRole('heading', { name: 'Submit a claim' })).toBeVisible()
    await expect(page.locator('#verification_email')).toBeVisible()

    expect(errors(), `[${testInfo.project.name}] console errors during Claim`).toEqual([])
  })

  test('E — Owner dashboard flow (dashboard → my pages → page editor)', async ({
    page,
  }, testInfo) => {
    const errors = trackConsoleErrors(page)

    await loginAsOwner(page)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

    await page.goto('/dashboard/pages')
    await page.locator('main').first().waitFor()
    await expect(page.getByRole('heading', { name: 'My Pages', level: 1 })).toBeVisible()

    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)
    await page.locator('main').first().waitFor()
    await expect(page.getByRole('heading', { name: FIXTURE_OWNED_NAME, level: 1 })).toBeVisible()
    // The editor is only useful if its first section is interactive.
    await expect(page.locator('#bi-name')).toHaveValue(FIXTURE_OWNED_NAME)

    expect(errors(), `[${testInfo.project.name}] console errors during Owner dashboard`).toEqual([])
  })

  test('G — Admin workflows (sign in → admin → claims queue)', async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page)

    await loginAsAdmin(page) // lands on /admin/claims
    await page.goto('/admin')
    await page.locator('main').first().waitFor()

    await page.goto('/admin/claims')
    await page.locator('main').first().waitFor()
    // Claims queue renders a heading and a table or an empty-state — assert the
    // page shell is present and interactive, not a crash.
    await expect(page.getByRole('heading').first()).toBeVisible()

    expect(errors(), `[${testInfo.project.name}] console errors during Admin`).toEqual([])
  })
})
