import { test, expect } from '@playwright/test'
import { FIXTURE_OWNED_SLUG, FIXTURE_OWNED_NAME, fixtureListingUrl } from './helpers/fixtures'

/**
 * TA-06 step 3, TA-07 steps 2 and 5, TA-08 steps 1–3.
 *
 * ⚠ TA-08 step 1 in the test plan navigates to a bare `/[citySlug]`
 * (e.g. `/atlanta`). No such route exists — `app/[citySlug]/[entityType]`
 * needs two segments, and the city landing page lives at
 * `/discover/[citySlug]`. Corrected here; see the 2d doc corrections.
 *
 * The city slug is discovered from /cities rather than hard-coded, so this
 * suite keeps working against any seeded database instead of pinning one row.
 */

const CATEGORY_SLUG = 'food-dining' // a seeded top-level category (supabase/seed.sql)

async function firstCitySlug(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/cities')
  const href = await page.locator('a[href^="/discover/"]').first().getAttribute('href')
  expect(href, '/cities must link at least one city').toBeTruthy()
  return href!.replace('/discover/', '')
}

test.describe('TA-06 — Business page', () => {
  test('step 3 — Save while signed out sends the visitor to sign-in and remembers the listing', async ({
    page,
  }) => {
    await page.goto(fixtureListingUrl(FIXTURE_OWNED_SLUG))
    await expect(page.getByRole('heading', { name: FIXTURE_OWNED_NAME, level: 1 })).toBeVisible()

    await page.getByRole('button', { name: 'Save this business' }).first().click()
    await page.waitForURL(/\/sign-in\?/)

    const params = new URL(page.url()).searchParams
    expect(params.get('next'), 'the listing must be the post-sign-in destination').toContain(
      FIXTURE_OWNED_SLUG
    )
    expect(params.get('action'), 'the intent survives the detour').toBe('save')
    expect(params.get('listing_id'), 'the listing id survives the detour').toBeTruthy()
  })
})

test.describe('TA-07 — Search and discovery', () => {
  test('step 2 — special characters in a query do not crash the page', async ({ page }) => {
    // SQL-ish and regex-ish input through the same faceted RPC the UI uses.
    for (const q of ["' OR 1=1 --", '%_%', '<script>alert(1)</script>', 'café ñ 東京']) {
      const response = await page.goto(`/discover?q=${encodeURIComponent(q)}`)
      expect(response?.status(), `query ${q}`).toBeLessThan(400)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('step 5 — a query with no matches shows the named empty state, not a blank grid', async ({
    page,
  }) => {
    const q = 'zzzzz-no-such-business-zzzzz'
    await page.goto(`/discover?q=${encodeURIComponent(q)}`)

    // Located by text, not by role: EmptyState in DiscoveryGrid.tsx renders a
    // plain <div>. Only RadiusEmptyState carries role="alert". Asserting the
    // role here would pass for the wrong reason if the grid ever swapped in
    // the radius variant.
    await expect(page.getByText(`No results for "${q}"`)).toBeVisible()
  })
})

test.describe('TA-08 — City and category landing pages', () => {
  test('step 1 — the city landing page renders at /discover/[citySlug]', async ({ page }) => {
    const slug = await firstCitySlug(page)
    await page.goto(`/discover/${slug}`)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Black-Owned Businesses in')
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Discovery results' })).toBeVisible()
  })

  test('step 2 — the city + category page renders at /[citySlug]/[categorySlug]', async ({
    page,
  }) => {
    const slug = await firstCitySlug(page)
    const response = await page.goto(`/${slug}/${CATEGORY_SLUG}`)

    expect(response?.status(), `/${slug}/${CATEGORY_SLUG}`).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('step 3 — an unknown city slug 404s rather than 500s', async ({ page }) => {
    const response = await page.goto('/discover/no-such-city-zzzz')
    expect(response?.status()).toBe(404)
  })

  test('step 3b — an unknown category under a real city 404s rather than 500s', async ({
    page,
  }) => {
    const slug = await firstCitySlug(page)
    const response = await page.goto(`/${slug}/no-such-category-zzzz`)
    expect(response?.status()).toBe(404)
  })

  test('step 4 — the city landing page declares a canonical URL', async ({ page }) => {
    const slug = await firstCitySlug(page)
    await page.goto(`/discover/${slug}`)

    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', new RegExp(`/discover/${slug}$`))
  })
})
