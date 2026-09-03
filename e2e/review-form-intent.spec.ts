import { test, expect } from '@playwright/test'

import { loginAsOwner } from './helpers/auth'
import { FIXTURE_CLAIMABLE_SLUG, fixtureListingUrl } from './helpers/fixtures'

// M4.14 item 2b — the review form, and therefore Turnstile, mounts on intent.
//
// This is the only test that can prove the founder's complaint is fixed. The
// unit assertions in tests/turnstile.test.ts read source text (vitest has no
// jsdom here); only a browser can answer "did this page call Cloudflare".
//
// The fixture matters. `EntityReviewsSection` renders nothing unless the viewer
// can review or reviews exist, and `canReview` requires a signed-in non-owner
// who has not reviewed. loginAsOwner owns FIXTURE_OWNED — so this navigates to
// FIXTURE_CLAIMABLE, which that account does not own. On the old code that page
// booted a captcha on load.

const LISTING_URL = fixtureListingUrl(FIXTURE_CLAIMABLE_SLUG)
const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)

test.describe('Review form mounts on intent', () => {
  test('no Cloudflare request until "Write a review" is clicked', async ({ page }) => {
    await loginAsOwner(page)

    // Counting starts AFTER sign-in on purpose: /sign-in legitimately renders
    // its own widget, and those requests are not what is being measured.
    let cloudflareRequests = 0
    await page.route('**/challenges.cloudflare.com/**', (route) => {
      cloudflareRequests += 1
      return route.continue()
    })

    await page.goto(LISTING_URL)

    const trigger = page.getByRole('button', { name: /^(Write a review|Be the first to review)$/ })
    await expect(trigger).toBeVisible()
    // The form is genuinely absent, not hidden — a hidden form still mounts.
    await expect(page.locator('#review-body')).toHaveCount(0)

    // The widget polls every 200ms for up to 10s once mounted
    // (TurnstileWidget.tsx:71-72); a second is more than enough for the script
    // request to have fired if it were going to.
    await page.waitForTimeout(1000)
    expect(cloudflareRequests, 'Cloudflare was called before the tester asked to review').toBe(0)

    await trigger.click()
    await expect(page.locator('#review-body')).toBeVisible()

    if (TURNSTILE_ENABLED) {
      // Only assertable where the widget is configured. Without a site key
      // TurnstileWidget returns null (TurnstileWidget.tsx:90) — which is exactly
      // why CI and local dev never surfaced this bug in the first place.
      await expect
        .poll(() => cloudflareRequests, { timeout: 15_000 })
        .toBeGreaterThanOrEqual(1)
    }
  })

  test('deep link to #review-body opens the form', async ({ page }) => {
    // Tour step 5 and any emailed review link both aim at `#review-body`, which
    // does not exist while the form is closed. Without the hash handling they
    // would land on a page with nothing on it.
    await loginAsOwner(page)
    await page.goto(`${LISTING_URL}#review-body`)
    await expect(page.locator('#review-body')).toBeVisible()
  })
})
