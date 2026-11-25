import { test, expect } from '@playwright/test'

// Ticket 285: the phone sheet used to cover the map on short screens. /map is
// full with made-up listings here, so the test doesn't lean on seed data.
const features = Array.from({ length: 40 }, (_, i) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-120 + (i % 8) * 6, 30 + Math.floor(i / 8) * 3] },
  properties: {
    id: `e2e-${i}`,
    name: `Sample Business ${i + 1}`,
    entityType: 'business',
    href: '/example',
    category: 'Restaurants',
    categorySlug: 'restaurants',
    citySlug: 'detroit',
    cityName: 'Detroit',
    street: null,
    state: 'MI',
    zip: null,
    trustTier: 'unclaimed',
    logoSrc: null,
    logoPin: false,
    ownershipLabel: 'black_owned',
    avgRating: null,
    reviewCount: 0,
    isFeatured: false,
    isSponsored: false,
    priceRange: null,
    hours: null,
    coverSrc: null,
  },
}))

for (const [width, height, share] of [
  [390, 844, 35],
  [390, 664, 45],
  [844, 390, 50],
  [667, 375, 50],
  [320, 256, 30],
] as const) {
  test(`/map at ${width}x${height} leaves ${share}% map, and List works`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height }, hasTouch: true })
    const page = await context.newPage()
    await page.route('**/api/map/listings', (route) =>
      route.fulfill({ json: { type: 'FeatureCollection', features } })
    )
    await page.goto('/map')
    const sheet = page.locator('[data-map-sheet]')
    await expect(sheet.locator('h2')).toContainText('in view', { timeout: 40_000 })

    const seen = await page.evaluate(() => {
      const top = document.querySelector('[data-tour="map"]')!.getBoundingClientRect().top
      let map = 0
      let all = 0
      for (let y = top + 2; y < innerHeight; y += 4) {
        for (let x = 2; x < innerWidth; x += 4) {
          all++
          if (document.elementFromPoint(x, y)?.closest('.maplibregl-canvas-container')) map++
        }
      }
      return Math.round((100 * map) / all)
    })
    expect(seen).toBeGreaterThanOrEqual(share)

    // A real click, so a button under something else fails.
    const list = sheet.locator('button[aria-expanded]')
    await list.click({ timeout: 4000 })
    await expect(list).toHaveAttribute('aria-expanded', 'true')
    await list.click({ timeout: 4000 })
    await expect(list).toHaveAttribute('aria-expanded', 'false')
    await context.close()
  })
}
