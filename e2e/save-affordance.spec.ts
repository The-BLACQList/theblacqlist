import { test, expect, type Page } from '@playwright/test'

import { loginAsOwner } from './helpers/auth'
import { FIXTURE_CLAIMABLE_NAME, FIXTURE_CLAIMABLE_SLUG, fixtureListingUrl } from './helpers/fixtures'

// M4.14 item 1 — one save metaphor, one visible saved state.
//
// The founder's complaint was that the discover card and the listing page look
// like two different actions. They are one action (POST/DELETE /api/saves), so
// the thing to prove in a browser is that ONE toggle produces the SAME state in
// both places, and that the state survives a reload.
//
// tests/save-controls.test.ts pins the source-level fixes (one icon family, the
// surface prop the caller cannot override, the empty live region). None of that
// can answer "does the card and the page agree after a real save" — only this
// can, because the two controls are different components reading the same row.
//
// FIXTURE_CLAIMABLE, not FIXTURE_OWNED: loginAsOwner owns the latter, and a
// self-owned save is a confusing target (tour verification refuses it outright,
// verify.ts:116-132). Saving a listing you do not own is the ordinary case.

const LISTING_URL = fixtureListingUrl(FIXTURE_CLAIMABLE_SLUG)

/** The card control, in either state — its aria-label flips with `saved`. */
function cardSaveButton(page: Page) {
  return page.getByRole('button', {
    name: new RegExp(`^(Save ${FIXTURE_CLAIMABLE_NAME}|Remove ${FIXTURE_CLAIMABLE_NAME} from saved)$`),
  })
}

/**
 * The hero pill on the listing page. All three page-level SaveButtons share one
 * aria-label, so the pill is identified by the word it renders — which is the
 * variant swap this PR made, and the reason the two surfaces now read alike.
 */
function heroSaveButton(page: Page) {
  return page
    .getByRole('button', { name: /^(Save this business|Remove from saved businesses)$/ })
    .filter({ hasText: /^(Save|Saved)$/ })
}

/** Leave the fixture unsaved regardless of how a previous run exited. */
async function ensureUnsaved(button: ReturnType<typeof cardSaveButton>) {
  await expect(button).toBeVisible()
  if ((await button.getAttribute('aria-pressed')) === 'true') {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
  }
}

test.describe('Save affordance', () => {
  test('a card save shows, persists, and agrees with the listing page', async ({ page }) => {
    await loginAsOwner(page)

    await page.goto(`/discover?q=${encodeURIComponent(FIXTURE_CLAIMABLE_NAME)}`)

    const card = cardSaveButton(page)
    await ensureUnsaved(card)

    // The card control is a real toggle, not a link to a saved page.
    await expect(card).toHaveAttribute('aria-pressed', 'false')
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')

    // Persistence: the optimistic flip above would pass on a broken write, so
    // the reload is what proves the row landed.
    await page.reload()
    const cardAfterReload = cardSaveButton(page)
    await expect(cardAfterReload).toHaveAttribute('aria-pressed', 'true')

    // The heart-vs-bookmark question, answered end to end: the same save, made
    // on a card, has to read as saved on the listing page.
    await page.goto(LISTING_URL)
    const hero = heroSaveButton(page)
    await expect(hero).toBeVisible()
    await expect(hero).toHaveAttribute('aria-pressed', 'true')
    await expect(hero).toHaveText(/Saved/)

    // Unsave from the page, and confirm the card follows. Also leaves the
    // fixture clean for the next run — the assertion and the teardown are the
    // same action on purpose.
    await hero.click()
    await expect(hero).toHaveAttribute('aria-pressed', 'false')
    await expect(hero).toHaveText(/^Save$/)

    await page.goto(`/discover?q=${encodeURIComponent(FIXTURE_CLAIMABLE_NAME)}`)
    await expect(cardSaveButton(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('saved and unsaved differ by more than a glyph swap', async ({ page }) => {
    // "The highlights aren't obvious enough for me." The fix is a background
    // change, not a different icon — so the test reads the computed background
    // and requires the two states to actually differ. A filled-vs-outline glyph
    // would pass an aria-pressed check and still be invisible across the room.
    await loginAsOwner(page)
    await page.goto(`/discover?q=${encodeURIComponent(FIXTURE_CLAIMABLE_NAME)}`)

    const card = cardSaveButton(page)
    await ensureUnsaved(card)

    const unsavedBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor)

    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    const savedBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor)

    expect(savedBg, 'the saved state must not reuse the unsaved background').not.toBe(unsavedBg)

    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'false')
  })
})
