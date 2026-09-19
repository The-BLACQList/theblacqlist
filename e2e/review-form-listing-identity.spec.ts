import { test, expect, type Page } from '@playwright/test'

import { loginAsOwner } from './helpers/auth'
import {
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_CLAIMABLE_NAME,
  FIXTURE_CLAIMABLE_SLUG,
  FIXTURE_PENDING_CLAIM_ID,
  FIXTURE_PENDING_CLAIM_NAME,
  FIXTURE_PENDING_CLAIM_SLUG,
  fixtureListingUrl,
} from './helpers/fixtures'

// Founder walk, Step 4, Walk A item 10 [Observed — founder, 2026-09-19]:
// opened listing A, opened listing B, pressed Back (URL showed A), wrote a
// review, and the success message thanked them for reviewing B. The staging
// row confirms it: the review sits on B's listing_id.
//
// What this spec pins down is the contract, not the founder's exact path.
// On unfixed code the client-side A → B → Back path below did NOT reproduce
// the wrong listing, in `next dev` or in a production build, whether B was
// reached through `window.next.router.push` or a real related-rail <Link>
// [Observed — Playwright against staging, 2026-09-19]. The keys added in
// page.tsx, EntityReviewsSection.tsx and ReviewFormDisclosure.tsx are a
// guarantee against any client instance outliving its listing; this spec is
// the regression guard for that guarantee and only a browser can run it.
//
// The navigation A → B is client-side on purpose. `page.goto` is a full
// document load, which throws the router state away and proves nothing about
// a Back restore.
//
// No review is submitted. Asserting on the hidden input and the group label is
// enough to know which listing the action would receive, and it keeps the run
// repeatable: a real insert would trip the one-review-per-listing guard on the
// second run and leave rows for global-setup to forget about.
//
// Both fixtures are published and not owned by the owner account, so the
// "Write a review" trigger renders on each (EntityReviewsSection `canReview`).

const A_URL = fixtureListingUrl(FIXTURE_CLAIMABLE_SLUG)
const B_URL = fixtureListingUrl(FIXTURE_PENDING_CLAIM_SLUG)
const TRIGGER = /^(Write a review|Be the first to review)$/

/**
 * Client-side navigation to B. The fixtures share a category, so when the
 * "You might also like" rail on A happens to list B the click is the same one
 * a tester makes; otherwise the app router is driven directly. Either way the
 * document survives and Back is a router restore, not a page load.
 */
async function navigateClientSide(page: Page, href: string): Promise<void> {
  const railLink = page
    .locator(`section[aria-labelledby="related-heading"] a[href="${href}"]`)
    .first()
  if (await railLink.count()) {
    await railLink.click()
  } else {
    await page.evaluate((url) => {
      const w = window as unknown as { next: { router: { push: (u: string) => void } } }
      w.next.router.push(url)
    }, href)
  }
  await expect(page).toHaveURL(new RegExp(`${href}(?:[?#].*)?$`))
}

test.describe('Review form follows the listing in the URL', () => {
  test('A → B → Back → open form: the form belongs to A', async ({ page }) => {
    await loginAsOwner(page)

    await page.goto(A_URL)
    await expect(page.getByRole('button', { name: TRIGGER })).toBeVisible()

    await navigateClientSide(page, B_URL)
    await expect(page.getByRole('heading', { name: FIXTURE_PENDING_CLAIM_NAME }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: TRIGGER })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${A_URL}(?:[?#].*)?$`))
    await expect(page.getByRole('heading', { name: FIXTURE_CLAIMABLE_NAME }).first()).toBeVisible()

    await page.getByRole('button', { name: TRIGGER }).click()
    await expect(page.locator('#review-body')).toBeVisible()

    // The hidden input is what createReviewAction reads (createReview.ts:33).
    // If this says B, the review goes to B no matter what the address bar says.
    await expect(page.locator('input[name="listing_id"]')).toHaveValue(FIXTURE_CLAIMABLE_ID)
    expect(FIXTURE_CLAIMABLE_ID).not.toBe(FIXTURE_PENDING_CLAIM_ID)

    // The group label is the tester-visible half of the same identity.
    await expect(page.locator('#write-review')).toHaveAttribute(
      'aria-label',
      `Write a review of ${FIXTURE_CLAIMABLE_NAME}`
    )
  })

  test("opening the form on B, then Back to A, does not carry B's open form", async ({
    page,
  }) => {
    // The other half of the founder's path: the form was already open, with
    // text in it, on the page they left. Keyed by listing, the disclosure
    // remounts closed on A and a fresh form opens with A's id and no draft.
    await loginAsOwner(page)

    await page.goto(A_URL)
    await expect(page.getByRole('button', { name: TRIGGER })).toBeVisible()

    await navigateClientSide(page, B_URL)
    await page.getByRole('button', { name: TRIGGER }).click()
    await expect(page.locator('#review-body')).toBeVisible()
    await page.locator('#review-body').fill('Draft written on B')
    await expect(page.locator('input[name="listing_id"]')).toHaveValue(FIXTURE_PENDING_CLAIM_ID)
    await expect(page.locator('#write-review')).toHaveAttribute(
      'aria-label',
      `Write a review of ${FIXTURE_PENDING_CLAIM_NAME}`
    )

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${A_URL}(?:[?#].*)?$`))
    await expect(page.getByRole('heading', { name: FIXTURE_CLAIMABLE_NAME }).first()).toBeVisible()

    // Closed again, and for A, with nothing of B's draft in it.
    await expect(page.locator('#review-body')).toHaveCount(0)
    await page.getByRole('button', { name: TRIGGER }).click()
    await expect(page.locator('input[name="listing_id"]')).toHaveValue(FIXTURE_CLAIMABLE_ID)
    await expect(page.locator('#review-body')).toHaveValue('')
  })
})
