import { test, expect } from '@playwright/test'
import { loginAsOwner } from './helpers/auth'
import {
  FIXTURE_ABSENT_ID,
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_OWNED_ID,
  FIXTURE_OWNED_NAME,
} from './helpers/fixtures'

/**
 * Owner dashboard — TA-10, TA-11, TA-12, TA-14, TA-16, TA-18 step 2.
 *
 * These stay chromium-only on purpose. The cross-browser cells for path E live
 * in cross-browser.spec.ts, which playwright.config.ts scopes to webkit-desktop
 * and chromium-mobile; everything here is authorization and server-validation
 * behaviour, which does not vary by engine and would just run 3x for nothing.
 *
 * Every case below was a manual step until the owner fixture landed in
 * global-setup — they were blocked on an authenticated identity that owned
 * exactly one listing and did NOT own two others.
 */

test.describe('owner dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page) // lands on /dashboard
  })

  test('TA-10 step 3 — My Pages lists the listing the owner owns', async ({ page }) => {
    await page.goto('/dashboard/pages')
    await expect(page.getByRole('heading', { name: 'My Pages', level: 1 })).toBeVisible()
    await expect(page.getByText(FIXTURE_OWNED_NAME).first()).toBeVisible()
  })

  test('TA-10 step 6 — /dashboard/pages/{id} redirects to the editor', async ({ page }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}`)
    await page.waitForURL(`**/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)
    await expect(page.getByRole('heading', { name: FIXTURE_OWNED_NAME, level: 1 })).toBeVisible()
  })

  test('TA-10 step 4 — editing a listing that does not exist 404s', async ({ page }) => {
    const res = await page.goto(`/dashboard/pages/${FIXTURE_ABSENT_ID}/edit`)
    expect(res?.status()).toBe(404)
  })

  test('TA-10 step 5 — editing a listing owned by someone else 404s', async ({ page }) => {
    // The claimable fixture has owner_user_id = null, so it is "not mine" in
    // exactly the way another owner's listing is: the editor query filters on
    // .eq('owner_user_id', session.user.id) and then calls notFound().
    const res = await page.goto(`/dashboard/pages/${FIXTURE_CLAIMABLE_ID}/edit`)
    expect(res?.status()).toBe(404)
  })

  test('TA-11 — basic info saves, and the required name is enforced', async ({ page }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)

    // Scoped to the section's own form — the editor renders ~11 sections, each
    // with its own "Save" button, so an unscoped role query is ambiguous.
    const basicInfo = page.locator('form').filter({ has: page.locator('#bi-name') })

    // Client-side first: name is required, so clearing it must block submission
    // rather than round-trip an empty name to the server.
    await page.locator('#bi-name').fill('')
    await basicInfo.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('#bi-name')).toHaveJSProperty('validity.valueMissing', true)
    await expect(basicInfo.getByText('Saved.', { exact: true })).toHaveCount(0)

    // Then a real save. Tagline, not name: the name is asserted by
    // cross-browser.spec.ts and global-setup only reconciles it between runs.
    await page.locator('#bi-name').fill(FIXTURE_OWNED_NAME)
    await page.locator('#bi-tagline').fill('Fixture tagline set by e2e.')
    await basicInfo.getByRole('button', { name: 'Save' }).click()
    await expect(basicInfo.getByText('Saved.', { exact: true })).toBeVisible()
  })

  test('TA-12 — contact section rejects a non-https website server-side', async ({ page }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)
    const contact = page.locator('form').filter({ has: page.locator('#c-website') })

    // #c-website is a plain text input — nothing client-side stops this value.
    // The guard is updateListingContent.ts, which is the point of the case.
    await page.locator('#c-website').fill('http://insecure.example.com')
    await contact.getByRole('button', { name: 'Save' }).click()
    await expect(contact.getByRole('alert')).toContainText('must start with https://')

    await page.locator('#c-website').fill('https://fixture.example.com')
    await contact.getByRole('button', { name: 'Save' }).click()
    await expect(contact.getByText('Saved.', { exact: true })).toBeVisible()
  })

  test('TA-14 — services manager renders and guards unknown services', async ({ page }) => {
    await page.goto('/dashboard/services')
    await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible()

    await page.goto('/dashboard/services/new')
    await expect(page.getByRole('heading', { name: 'Add service', level: 1 })).toBeVisible()

    const res = await page.goto(`/dashboard/services/${FIXTURE_ABSENT_ID}/edit`)
    expect(res?.status()).toBe(404)
  })

  test('TA-16 — owner analytics renders, filters by period, and is owner-scoped', async ({
    page,
  }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/analytics`)
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible()
    // 30d is the default and is expressed by the ABSENCE of ?period. exact:true
    // because the search-queries section heading reads "Top search queries,
    // last 30 days" and would otherwise match too.
    await expect(page.getByRole('heading', { name: 'Last 30 days', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '7 days' }).click()
    await page.waitForURL(/[?&]period=7d/)
    await expect(page.getByRole('heading', { name: 'Last 7 days', exact: true })).toBeVisible()

    // Asserted on the rendered not-found UI, not the HTTP status. The guard
    // is the same .eq('owner_user_id', …) + notFound() the editor uses, but
    // this route streams its shell before the query resolves, so the response
    // has already committed 200 by the time notFound() fires. The 404 page is
    // what the user gets either way; the status code is not the contract here.
    await page.goto(`/dashboard/pages/${FIXTURE_CLAIMABLE_ID}/analytics`)
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toHaveCount(0)
  })

  test('TA-18 step 2 — a signed-in non-admin is bounced off /admin', async ({ page }) => {
    // Not a sign-in redirect: requireAdmin() sends an authenticated user with
    // no admin role to "/", so a /sign-in landing here would be a real failure.
    await page.goto('/admin')
    await page.waitForURL((url) => url.pathname === '/')
    expect(page.url()).not.toContain('/sign-in')
  })
})
