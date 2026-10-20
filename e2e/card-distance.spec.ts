import { test, expect, type Page } from '@playwright/test'

// Ticket 141: "About N mi from you" on Discover and Search cards.
// A list never prompts for location, and the position never leaves the browser.

// Union Station, Washington DC. Staging has DC Metro listings with pins (#251).
const HERE = { latitude: 38.8973, longitude: -77.0063 }
const DISTANCE = /(About [\d.]+ mi|Less than 0\.1 mi) from you/

const results = (page: Page) => page.locator('section[aria-label="Discovery results"]')

/** Counts calls to getCurrentPosition, so a test can prove the list never asked. */
async function countLocationCalls(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __locationCalls: number }
    w.__locationCalls = 0
    const geo = navigator.geolocation
    if (!geo) return
    const original = geo.getCurrentPosition.bind(geo)
    geo.getCurrentPosition = (...args: Parameters<Geolocation['getCurrentPosition']>) => {
      w.__locationCalls++
      return original(...args)
    }
  })
}

const locationCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __locationCalls: number }).__locationCalls)

test.describe('141 — location already allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: HERE })

  test('Discover cards show the distance, and the position is never sent', async ({ page }) => {
    const sent: string[] = []
    page.on('request', (req) => {
      const body = req.postData() ?? ''
      if (req.url().includes('38.897') || body.includes('38.897')) sent.push(req.url())
    })

    await page.goto('/discover')
    await expect(results(page).getByText(DISTANCE).first()).toBeVisible({ timeout: 20_000 })
    expect(sent, 'requests that carried the position').toEqual([])
    expect(page.url()).not.toContain('lat=')
  })

  test('Search cards show the distance', async ({ page }) => {
    await page.goto('/search?q=restaurant')
    await expect(results(page).getByText(DISTANCE).first()).toBeVisible({ timeout: 20_000 })
  })

  test('the home page shows no distance line', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    // Give a would-be provider time to resolve before checking it stayed quiet.
    await page.waitForTimeout(1_500)
    await expect(page.getByText(DISTANCE)).toHaveCount(0)
  })
})

test.describe('141 — location not allowed', () => {
  test('Discover never asks and shows no distance line', async ({ page }) => {
    await countLocationCalls(page)
    await page.goto('/discover')
    await results(page).waitFor()
    await page.waitForTimeout(1_500)
    await expect(results(page).getByText(DISTANCE)).toHaveCount(0)
    expect(await locationCalls(page)).toBe(0)
  })

  test('a Near You search uses the URL point without asking', async ({ page }) => {
    await countLocationCalls(page)
    await page.goto(`/discover?lat=${HERE.latitude}&lng=${HERE.longitude}&radius=25`)
    await expect(results(page).getByText(DISTANCE).first()).toBeVisible({ timeout: 20_000 })
    expect(await locationCalls(page)).toBe(0)
  })
})
