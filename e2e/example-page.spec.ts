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
// tests/entity-page-sections.test.ts for the same reason.
// =============================================================================

import { expect, test, type Page } from '@playwright/test'

import { TEMPLATE_SECTION_ORDER, type TemplateKey } from '../lib/entity-page/sections'

const NAME = 'Test Business 123'

const VARIANTS: { variant: string; template: TemplateKey; cta: string }[] = [
  { variant: 'storefront', template: 'storefront', cta: 'Order Now' },
  { variant: 'professional', template: 'professional', cta: 'Book a discovery call' },
  { variant: 'creative', template: 'creative', cta: 'Commission Work' },
]

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
      // The logo sits inside the hero, so it is a mark but not a top-level section.
      await expect(page.locator('[data-section="logo"] > *').first()).toBeVisible()

      const ids = await page
        .locator('[data-section]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')))
      expect(ids.filter((id) => id !== 'logo')).toEqual([...order])
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

      // A related card points at another listing.
      const related = page.locator('[data-section="related"] a[href]').first()
      await related.scrollIntoViewIfNeeded()
      await related.click()
      expect(new URL(page.url()).pathname).toBe(path)

      // Save and Share are rendered, but inert.
      await expect(page.locator('[data-section="hero"] [inert]').first()).toBeAttached()

      // Give any stray tracking call time to leave.
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
