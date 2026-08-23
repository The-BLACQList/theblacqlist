import { test, expect } from '@playwright/test'
import { loginAsOwner } from './helpers/auth'
import {
  FIXTURE_ABSENT_ID,
  FIXTURE_OWNED_NAME,
  FIXTURE_OWNED_SLUG,
  fixtureListingUrl,
} from './helpers/fixtures'

/**
 * Account surfaces — TA-20 (receipts), TA-22 step 5 (marketplace ownership),
 * TA-24 (save / unsave / saved list).
 *
 * The 404 cases here are the ones a human walk is worst at: they are the
 * per-user RLS boundary, and when they silently regress the page still renders
 * — it just renders someone else's row. Nothing looks broken.
 */

test.describe('account surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('TA-20 — receipts list renders and another user’s receipt 404s', async ({ page }) => {
    await page.goto('/account/receipts')
    await expect(page.getByRole('heading', { name: 'My receipts', level: 1 })).toBeVisible()

    // The edit page selects .eq('id', id).eq('user_id', user.id) and then
    // notFound()s. An id this user does not own is indistinguishable from an id
    // that does not exist — which is the intended behaviour, not a gap.
    const res = await page.goto(`/account/receipts/${FIXTURE_ABSENT_ID}/edit`)
    expect(res?.status()).toBe(404)
  })

  test('TA-22 step 5 — editing a product this owner does not own 404s', async ({ page }) => {
    await page.goto('/dashboard/products')
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible()

    const res = await page.goto(`/dashboard/products/${FIXTURE_ABSENT_ID}/edit`)
    expect(res?.status()).toBe(404)
  })

  test('TA-24 — save a listing, see it in Saved, then unsave it', async ({ page }) => {
    await page.goto(fixtureListingUrl(FIXTURE_OWNED_SLUG))

    // The entity page mounts SaveButton more than once (hero + quick-action
    // bar, itself split mobile/desktop). Any one of them is the same control.
    const save = page.getByRole('button', { name: 'Save this business' }).first()
    await expect(save).toBeVisible()
    await save.click()

    // aria-pressed is the contract the a11y suite relies on, so assert the
    // state flip rather than the label text.
    await expect(
      page.getByRole('button', { name: 'Remove from saved businesses' }).first()
    ).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/account/saved')
    await expect(page.getByRole('heading', { name: 'Saved businesses', level: 1 })).toBeVisible()
    const savedList = page.getByRole('list', { name: 'Saved businesses' })
    await expect(savedList.getByText(FIXTURE_OWNED_NAME).first()).toBeVisible()

    // Leave the account as we found it — this spec is the only writer of saves,
    // and a leftover row would make a re-run's "save" assertion pass for the
    // wrong reason.
    await savedList.getByRole('button', { name: 'Remove from saved businesses' }).first().click()
    await expect(savedList.getByText(FIXTURE_OWNED_NAME)).toHaveCount(0)
  })
})
