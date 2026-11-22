import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, loginAsOwner } from './helpers/auth'
import {
  FIXTURE_ABSENT_ID,
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_OWNED_ID,
  FIXTURE_OWNED_NAME,
  FIXTURE_OWNED_SLUG,
  fixtureListingUrl,
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

  // The editor has one save bar for the whole page (ticket 140). It reads
  // "Save Changes" on a draft and "Publish Changes" on a live page (Title Case,
  // ticket 205), and its result line confirms once for every card it saved.
  const saveBar = (page: Page) => page.getByRole('button', { name: /^(Save|Publish) Changes$/ })
  const SAVED = /^(Saved\.|Published\. Your changes are on your page now\.)$/

  test('TA-11 — basic info saves, and the required name is enforced', async ({ page }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)

    // Client-side first: name is required, so clearing it must block the save
    // rather than round-trip an empty name to the server.
    await page.locator('#bi-name').fill('')
    await saveBar(page).click()
    await expect(page.locator('#bi-name')).toHaveJSProperty('validity.valueMissing', true)
    await expect(page.getByText('Check Basics first.', { exact: true })).toBeVisible()
    await expect(page.getByText(SAVED)).toHaveCount(0)

    // Then a real save. Tagline, not name: the name is asserted by
    // cross-browser.spec.ts and global-setup only reconciles it between runs.
    await page.locator('#bi-name').fill(FIXTURE_OWNED_NAME)
    await page.locator('#bi-tagline').fill('Fixture tagline set by e2e.')
    await saveBar(page).click()
    await expect(page.getByText(SAVED)).toBeVisible()
  })

  test('TA-12 — contact section rejects a non-https website server-side', async ({ page }) => {
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit`)
    // The editor is in tabs; Contact sits under "Contact & Buttons".
    await page.getByRole('tab', { name: 'Contact & Buttons' }).click()
    const contact = page.locator('form').filter({ has: page.locator('#c-website') })

    // #c-website is a plain text input — nothing client-side stops this value.
    // The guard is updateListingContent.ts, which is the point of the case.
    await page.locator('#c-website').fill('http://insecure.example.com')
    await saveBar(page).click()
    await expect(contact.getByRole('alert')).toContainText('must start with https://')
    await expect(page.getByText(/^Couldn't save Contact/)).toBeVisible()

    await page.locator('#c-website').fill('https://fixture.example.com')
    await saveBar(page).click()
    await expect(page.getByText(SAVED)).toBeVisible()
  })

  // Ticket 185: the owner uploads a logo under Photos and the public page shows
  // it beside the name. The owned fixture is claimed, so the logo is allowed.
  // Cleans up after itself so the fixture keeps no logo between runs.
  test('ticket 185 — an uploaded logo shows in the page hero', async ({ page }) => {
    // A 1 x 1 PNG: enough for the server to decode and re-encode.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit?tab=media#photos`)
    const panel = page.getByTestId('logo-panel')
    await expect(panel).toBeVisible()
    await panel
      .getByLabel('Choose a logo')
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
    await expect(panel.getByRole('button', { name: 'Upload a New Logo' })).toBeVisible()

    await page.goto(fixtureListingUrl(FIXTURE_OWNED_SLUG))
    await expect(page.getByRole('img', { name: `${FIXTURE_OWNED_NAME} logo` })).toBeVisible()

    await page.goto(`/dashboard/pages/${FIXTURE_OWNED_ID}/edit?tab=media#photos`)
    page.once('dialog', (d) => d.accept())
    await page.getByTestId('logo-panel').getByRole('button', { name: 'Remove' }).click()
    await expect(
      page.getByTestId('logo-panel').getByRole('button', { name: 'Upload a Logo' })
    ).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Last 30 Days', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '7 days' }).click()
    await page.waitForURL(/[?&]period=7d/)
    await expect(page.getByRole('heading', { name: 'Last 7 Days', exact: true })).toBeVisible()

    // Asserted on the rendered not-found UI, not the HTTP status. The guard
    // is the same .eq('owner_user_id', …) + notFound() the editor uses, but
    // this route streams its shell before the query resolves, so the response
    // has already committed 200 by the time notFound() fires. The 404 page is
    // what the user gets either way; the status code is not the contract here.
    await page.goto(`/dashboard/pages/${FIXTURE_CLAIMABLE_ID}/analytics`)
    await expect(page.getByRole('heading', { name: /isn.t on the list/, level: 1 })).toBeVisible()
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

/**
 * Ticket 050 "no listing" state. The admin fixture is the one signed-in account
 * global-setup gives no listing, so it stands in for a business owner who
 * hasn't claimed or added their page yet. Nothing here uses admin powers.
 */
test.describe('signed in with no listing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('the dashboard offers both ways in: claim or create', async ({ page }) => {
    for (const path of ['/dashboard', '/dashboard/pages']) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { name: 'Create Your Page on The BLACQList' })
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Find my business to claim' })).toHaveAttribute(
        'href',
        '/claim'
      )
      await expect(page.getByRole('link', { name: 'Create a new page' })).toHaveAttribute(
        'href',
        '/add-business'
      )
    }
  })

  test('the menu hides the tools that need a listing', async ({ page }) => {
    await page.goto('/dashboard')
    // One signed-in menu for members and owners (ticket 252).
    const nav = page.getByRole('navigation', { name: 'Account Navigation' })
    await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible()
    for (const name of ['Home', 'Edit Page', 'Insights', 'Products', 'Services', 'Plan']) {
      await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('link', { name: 'Claim My Business' })).toBeVisible()
  })
})

test('an owner sees You, their business and the tools by job', async ({ page }) => {
  await loginAsOwner(page)
  await page.goto('/dashboard')
  const nav = page.getByRole('navigation', { name: 'Account Navigation' })
  for (const name of ['Home', 'Edit Page', 'Insights', 'Plan']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByTestId('page-switcher')).toBeVisible()
  const tools = page.getByTestId('account-nav-group-offer')
  if ((await tools.getAttribute('aria-expanded')) !== 'true') await tools.click()
  for (const name of ['Products', 'Services']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
})
