// =============================================================================
// Ticket 231 — the chapters layout on real Storefront listings
// =============================================================================
// The gate first: a listing without enough to fill the chapters (the e2e
// fixtures: no cover, no gallery) keeps today's page even with
// ?layout=chapters, and ?layout=stack always gives today's page.
//
// Then the key actions on an eligible listing. The fixtures are deliberately
// bare, so that half needs a real eligible listing's path in
// E2E_CHAPTERS_LISTING (for example the staging demo storefront) and skips
// without it. The opt-in works on `pnpm dev`, which is what Playwright starts.
// =============================================================================

import { expect, test } from '@playwright/test'

import { expectNoCriticalViolations } from './helpers/axe'
import { FIXTURE_CLAIMABLE_SLUG, fixtureListingUrl } from './helpers/fixtures'

const THIN = fixtureListingUrl(FIXTURE_CLAIMABLE_SLUG)
const ELIGIBLE = process.env.E2E_CHAPTERS_LISTING

test.describe('Listing chapters: the gate', () => {
  test('a thin listing keeps today’s page even when chapters are asked for', async ({ page }) => {
    await page.goto(`${THIN}?layout=chapters`)
    await expect(page.locator('main, body').first()).toBeVisible()
    await expect(page.locator('#lp-root')).toHaveCount(0)
  })
})

test.describe('Listing chapters: an eligible listing', () => {
  test.skip(!ELIGIBLE, 'Set E2E_CHAPTERS_LISTING to an eligible listing path to run these')

  const url = `${ELIGIBLE}?layout=chapters`

  test('renders the chapters, and ?layout=stack gives today’s page', async ({ page }) => {
    await page.goto(url)
    await expect(page.locator('#lp-root')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.goto(`${ELIGIBLE}?layout=stack`)
    await expect(page.locator('#lp-root')).toHaveCount(0)
  })

  test('the chapter nav only links to chapters on the page', async ({ page }) => {
    await page.goto(url)
    const ids = await page
      .locator('.cnav ol a[data-nav]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('data-nav')))
    expect(ids.length).toBeGreaterThan(2)
    for (const id of ids) await expect(page.locator(`section#${id}`)).toHaveCount(1)
    // Nothing on a live page is held back as a sample.
    await expect(page.locator('#lp-root [data-off]')).toHaveCount(0)
  })

  test('Save sends a signed-out visitor to sign in', async ({ page }) => {
    await page.goto(url)
    await page.locator('#lp-root [data-tour="save-listing"]').first().click()
    await page.waitForURL(/\/sign-in\?next=/)
  })

  test('Share opens the share sheet', async ({ page }) => {
    await page.goto(url)
    await page.locator('.hero-acts').getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('a signed-out visitor is asked to sign in to review', async ({ page }) => {
    await page.goto(url)
    const link = page.getByRole('link', { name: 'Sign In to Write a Review' })
    await expect(link).toHaveAttribute('href', /\/sign-in\?next=.*%23reviews/)
  })

  test('Report an Error opens the report form', async ({ page }) => {
    await page.goto(url)
    await page.locator('.pfoot').getByRole('button', { name: 'Report an Error' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('directions go to a maps link in a new tab', async ({ page }) => {
    await page.goto(url)
    const dir = page.locator('#visit').getByRole('link', { name: /Get Directions/ })
    test.skip((await dir.count()) === 0, 'This listing has no street address')
    await expect(dir.first()).toHaveAttribute('href', /maps/)
    await expect(dir.first()).toHaveAttribute('target', '_blank')
  })

  test('axe finds no critical violation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url)
    await expectNoCriticalViolations(page, 'listing chapters')
  })
})

// Ticket 233 (Creative F11, QA233-03): no photo shows twice on a chapters page.
// The cover, the duo, the interludes and the menu photo are left out of the
// gallery, and the sample's posts, Shop items, review and team photos are their
// own photos. Images go through next/image, so compare the source url param.
const PHOTO_SLOTS = [
  '.s-hero-photo',
  '.s-duo',
  '.il',
  '.s-menu',
  '.glide-track',
  '.hn-strip',
  '.s-shop',
  '.rev-ph',
  '.team',
]
  .map((slot) => `#lp-root ${slot} img`)
  .join(', ')

async function photoSources(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator(PHOTO_SLOTS).evaluateAll((imgs) =>
    imgs.map((img) => {
      const src = (img as HTMLImageElement).getAttribute('src') ?? ''
      try {
        return new URL(src, location.origin).searchParams.get('url') ?? src
      } catch {
        return src
      }
    })
  )
}

test.describe('Listing chapters: no photo repeats (ticket 233)', () => {
  test('the sample storefront shows each photo once', async ({ page }) => {
    await page.goto('/example/storefront')
    await expect(page.locator('#lp-root')).toBeVisible()
    const srcs = await photoSources(page)
    expect(srcs.length).toBeGreaterThan(3)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  test('an eligible listing shows each photo once', async ({ page }) => {
    test.skip(!ELIGIBLE, 'Set E2E_CHAPTERS_LISTING to an eligible listing path to run this')
    await page.goto(`${ELIGIBLE}?layout=chapters`)
    await expect(page.locator('#lp-root')).toBeVisible()
    const srcs = await photoSources(page)
    expect(new Set(srcs).size).toBe(srcs.length)
  })
})
