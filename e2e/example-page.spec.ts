// =============================================================================
// Ticket 184 — the Test Business 123 sample pages
// =============================================================================
// Three promises the fixtures and the registry make that only a browser can
// check: every section the registry lists is on the page, in its order; the
// page is marked noindex and carries the sample banner; and nothing on it
// leaves or writes — links that would go to the (fictional) business or to a
// related listing are held, Save and Share are inert, and no request reaches
// the save, analytics or Supabase REST endpoints.
//
// The section list is read from the registry, not retyped, so a section added
// to a template without a registry entry (or the reverse) fails here and in
// tests/entity-page-sections.test.ts for the same reason. The same goes for
// the nested marks (1B): the ids the registry knows but no template orders.
// =============================================================================

import { expect, test, type Page } from '@playwright/test'

import {
  ENTITY_SECTIONS,
  TEMPLATE_SECTION_ORDER,
  type TemplateKey,
} from '../lib/entity-page/sections'

const NAME = 'Test Business 123'

const VARIANTS: { variant: string; template: TemplateKey; cta: string }[] = [
  { variant: 'storefront', template: 'storefront', cta: 'Order Now' },
  { variant: 'professional', template: 'professional', cta: 'Book a discovery call' },
  { variant: 'creative', template: 'creative', cta: 'Commission Work' },
]

/**
 * Marks that render inside another section — the logo and facts line in the
 * hero, the map and special hours in the Visit block, the documents row in a
 * section heading, the album chips in the gallery. Registered so ticket 188
 * can target them, never in a template's order, so the order check skips them
 * and a separate check wants each one on the page exactly once.
 */
const NESTED_MARKS = new Set<string>(
  ENTITY_SECTIONS.map((s) => s.id).filter(
    (id) => !Object.values(TEMPLATE_SECTION_ORDER).some((order) => order.includes(id))
  )
)

/** Endpoints a live listing page may call that a sample page never may. */
const WRITE_PATHS = /\/api\/saves|\/api\/analytics|\/api\/messages/
const SUPABASE_REST = /\/rest\/v1\//

function watchWrites(page: Page): string[] {
  const hits: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (WRITE_PATHS.test(url)) hits.push(`${req.method()} ${url}`)
    if (SUPABASE_REST.test(url) && req.method() !== 'GET') hits.push(`${req.method()} ${url}`)
  })
  return hits
}

for (const { variant, template, cta } of VARIANTS) {
  test.describe(`/example/${variant}`, () => {
    test('renders every registered section in registry order, noindexed, behind the banner', async ({
      page,
    }) => {
      const response = await page.goto(`/example/${variant}`)
      expect(response?.status()).toBe(200)

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
      await expect(page.getByTestId('example-banner')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME)

      const order = TEMPLATE_SECTION_ORDER[template]
      for (const id of order) {
        const section = page.locator(`[data-section="${id}"] > *`).first()
        await section.scrollIntoViewIfNeeded()
        await expect(section, id).toBeVisible()
      }

      // Each nested mark is on the page once, inside its parent, with content.
      expect(NESTED_MARKS.size).toBeGreaterThan(0)
      for (const id of NESTED_MARKS) {
        const mark = page.locator(`[data-section="${id}"]`)
        await expect(mark, id).toHaveCount(1)
        const inner = mark.locator(':scope > *').first()
        await inner.scrollIntoViewIfNeeded()
        await expect(inner, id).toBeVisible()
      }

      const ids = await page
        .locator('[data-section]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')))
      expect(ids.filter((id) => id !== null && !NESTED_MARKS.has(id))).toEqual([...order])
    })

    test('holds every link that would leave the sample, and writes nothing', async ({ page }) => {
      const hits = watchWrites(page)
      await page.goto(`/example/${variant}`)
      const path = `/example/${variant}`

      // The hero CTA points at the fictional business's site.
      const heroCta = page.locator('#hero-cta')
      await expect(heroCta).toHaveText(cta)
      await heroCta.click()
      await expect(page.getByTestId('example-link-note')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe(path)

      // The map's directions link opens a new tab on a live page; here it is held.
      const openInMaps = page
        .locator('[data-section="map"]')
        .getByRole('link', { name: 'Open in Maps' })
      await openInMaps.scrollIntoViewIfNeeded()
      await openInMaps.click()
      expect(new URL(page.url()).pathname).toBe(path)

      // The menu / rate card / commission guide PDF lives on the business's site.
      const document = page.locator('[data-section="documents"] a[href]').first()
      await document.scrollIntoViewIfNeeded()
      await document.click()
      expect(new URL(page.url()).pathname).toBe(path)

      // A related card points at another listing.
      const related = page.locator('[data-section="related"] a[href]').first()
      await related.scrollIntoViewIfNeeded()
      await related.click()
      expect(new URL(page.url()).pathname).toBe(path)

      // Save and Share are rendered, but inert.
      await expect(page.locator('[data-section="hero"] [inert]').first()).toBeAttached()

      // Main's Deals section shows its codes, but Copy code sits inside an
      // inert wrapper, so it cannot record deal_code_copied for a fake page.
      const dealCode = page.locator('[data-section="deals"] [inert] button').first()
      await expect(dealCode).toBeAttached()
      await expect(dealCode).toContainText('Copy code')

      // No held link opened a tab behind the page's back.
      expect(page.context().pages()).toHaveLength(1)

      // Give any stray tracking call time to leave.
      await page.waitForTimeout(500)
      expect(hits).toEqual([])
    })

    test('shows the facts, special hours, map and happening-now posts, filters albums', async ({
      page,
    }) => {
      const hits = watchWrites(page)
      await page.goto(`/example/${variant}`)

      // "Est. 2014 · $$ · …" under the name; special hours and the map in Visit.
      await expect(page.getByTestId('facts-line')).toContainText(/Est\. \d{4}/)
      await expect(page.getByTestId('hours-overrides')).toContainText('Special hours')
      await expect(page.getByTestId('hours-overrides')).toContainText('Closed')
      await expect(page.getByTestId('location-map')).toBeVisible()

      // Main's Happening now band (part F) sits above the hero with the post
      // ending soonest; the rest open under "+N more".
      const band = page.locator(
        '[data-section="happening-now"] section[aria-label="Happening now"]'
      )
      await expect(band).toBeVisible()
      await expect(band).toContainText(/Ends (in \d+ (days|hours)|tomorrow|within the hour)/)
      const more = band.locator('summary')
      await expect(more).toHaveText(/\+\d+ more/)
      await more.click()
      expect(await band.locator('details li').count()).toBeGreaterThanOrEqual(2)

      // Album chips narrow the grid; All brings every photo back.
      const photos = page.locator('[data-section="gallery"] [aria-label^="View photo"]')
      const chips = page.getByTestId('gallery-albums').getByRole('button')
      await chips.first().scrollIntoViewIfNeeded()
      const total = await photos.count()
      expect(total).toBeGreaterThanOrEqual(12)
      await expect(chips.first()).toHaveAttribute('aria-pressed', 'true')
      expect(await chips.count()).toBeGreaterThanOrEqual(3)

      const album = chips.nth(1)
      await album.click()
      await expect(album).toHaveAttribute('aria-pressed', 'true')
      await expect(chips.first()).toHaveAttribute('aria-pressed', 'false')
      await expect(photos).not.toHaveCount(total)
      expect(await photos.count()).toBeGreaterThan(0)

      await chips.first().click()
      await expect(photos).toHaveCount(total)

      await page.waitForTimeout(500)
      expect(hits).toEqual([])
    })
  })
}

test('the banner switches between the three layouts', async ({ page }) => {
  await page.goto('/example/storefront')
  const nav = page.getByRole('navigation', { name: 'Sample page layouts' })
  await expect(nav.getByRole('link', { name: 'Storefront' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await nav.getByRole('link', { name: 'Professional' }).click()
  await page.waitForURL('**/example/professional')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME)
  await expect(nav.getByRole('link', { name: 'Professional' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

test('/example lists the three sample pages', async ({ page }) => {
  const response = await page.goto('/example')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME)
  for (const { variant } of VARIANTS) {
    await expect(page.locator(`a[href="/example/${variant}"]`).first()).toBeVisible()
  }
})

test('an unknown variant is a 404', async ({ page }) => {
  const response = await page.goto('/example/nope')
  expect(response?.status()).toBe(404)
})
