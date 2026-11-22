// =============================================================================
// Ticket 232: today's listing page for a thin listing (no cover photo)
// =============================================================================
// The e2e claimable fixture has no cover, so its hero draws the monogram
// fallback. E2E_THIN_LISTING can point the spec at another thin listing path
// (for example a staging listing on a Preview).
//
// - The monogram never covers the hero text: on the right from 768 up, hidden
//   on phones.
// - The tablet/desktop top bar stays hidden on load and shows once the hero
//   button has scrolled past.
// - The trust panel shows the round DR-004 mark beside the tier name.
// =============================================================================

import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectNoCriticalViolations } from './helpers/axe'
import { FIXTURE_CLAIMABLE_SLUG, fixtureListingUrl } from './helpers/fixtures'

const URL = process.env.E2E_THIN_LISTING ?? fixtureListingUrl(FIXTURE_CLAIMABLE_SLUG)

type Box = { x: number; y: number; width: number; height: number }

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function box(l: Locator): Promise<Box | null> {
  return (await l.count()) ? l.first().boundingBox() : null
}

async function openAt(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(URL)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test.describe('Thin listing page', () => {
  for (const width of [375, 768, 1024, 1280]) {
    test(`the monogram never covers the hero text at ${width}`, async ({ page }) => {
      await openAt(page, width)
      const monogram = page.locator('[data-fallback="aside"] [data-monogram]')
      await expect(monogram).toHaveCount(1)
      if (width < 768) {
        await expect(monogram).toBeHidden()
        return
      }
      await expect(monogram).toBeVisible()
      const m = (await monogram.boundingBox())!
      const texts = [
        page.getByRole('heading', { level: 1 }),
        page.locator('#hero-cta'),
      ]
      for (const t of texts) {
        const b = await box(t)
        if (b) expect(overlaps(m, b), `monogram overlaps ${await t.first().textContent()}`).toBe(false)
      }
    })
  }

  test('the top bar stays hidden on load and shows after scrolling past the hero', async ({ page }) => {
    // A short window puts the hero button below the fold, the case that used to
    // fade the top bar in over the hero.
    await openAt(page, 768, 520)
    const cta = page.locator('#hero-cta')
    test.skip((await cta.count()) === 0, 'This listing has no main button, so there is no bar')
    const bar = page.locator('[data-quick-bar-top]')
    await page.waitForTimeout(400)
    await expect(bar).toHaveAttribute('data-quick-bar-top', 'hidden')
    await page.evaluate(() => {
      const el = document.getElementById('hero-cta')!
      window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 200)
    })
    await expect(bar).toHaveAttribute('data-quick-bar-top', 'shown')
  })

  test('the trust panel shows the round mark beside the tier name', async ({ page }) => {
    await openAt(page, 1024)
    const label = page.locator('#trust-heading').locator('..').locator('[data-trust-tier]')
    await expect(label).toHaveCount(1)
    await expect(label.locator('svg')).toHaveCount(1)
    await expect(label).toHaveText(/Unclaimed|Claimed|Verified|Certified/)
  })

  test('axe finds no critical violation', async ({ page }) => {
    await openAt(page, 1024)
    await expectNoCriticalViolations(page, 'thin listing page')
  })
})
