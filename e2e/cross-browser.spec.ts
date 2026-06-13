import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'
import { trackConsoleErrors } from './helpers/console'

// L. Cross-Browser — representative critical paths run across 3 projects
// (chromium=Chrome desktop, webkit-desktop=Safari engine, chromium-mobile=375px).
// Covers functional completion + zero console errors. NOT covered by automation:
// visual "layout" judgment (needs human eyes) and real Safari.app / real device.
// C/D/E paths are manual — see docs/blacqlist/qa/cross-browser-and-launch-gates-guide.md.

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
