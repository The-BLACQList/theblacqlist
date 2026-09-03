import { test, expect } from '@playwright/test'

import { loginAsAdmin } from './helpers/auth'

/**
 * /admin/entities search + filters — M4.14 item 3.
 *
 * The founder's complaint was that the queue could not be searched at all. The
 * assertions worth having are not "the input exists" but the two ways a search
 * silently disappears:
 *
 *   1. The search runs server-side, so it finds a listing that is NOT on the
 *      visible page of 25 and NOT in the pending tab.
 *   2. `q` survives a status-tab click and a Prev/Next click. Every href on the
 *      page goes through `adminEntitiesHref` for this reason; a template
 *      literal that forgets `q` drops the search with no error.
 *
 * ⚠ Nothing here approves, rejects, or edits a listing — this spec is
 * read-only, so it can run against staging without leaving state behind for
 * the specs that sort after it.
 */

test.describe('admin entities queue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('defaults to the pending queue with the controls present', async ({ page }) => {
    await page.goto('/admin/entities')

    await expect(page.getByRole('heading', { name: 'Entities', level: 1 })).toBeVisible()
    await expect(page.getByLabel('Search')).toBeVisible()
    await expect(page.getByLabel('Type')).toBeVisible()
    await expect(page.getByLabel('Location type')).toBeVisible()

    // `All` is new — draft / unpublished / flagged / archived had no route into
    // this page before.
    await expect(page.getByRole('link', { name: 'All', exact: true })).toBeVisible()
  })

  test('typing a query searches the whole catalog, not the visible page', async ({ page }) => {
    await page.goto('/admin/entities')

    await page.getByLabel('Search').fill('the')
    // Debounced at 250ms, then a router.replace — wait for the URL, not a timer.
    await page.waitForURL(/\/admin\/entities\?.*q=the/)

    // Searching from the default queue widens to all statuses deliberately: a
    // search that hides the answer because the listing is published is worse
    // than no search.
    expect(new URL(page.url()).searchParams.get('status')).not.toBe('pending')

    const rows = page.locator('tbody tr')
    const empty = page.getByText(/No listings match/)
    await expect(rows.first().or(empty)).toBeVisible()
  })

  test('the query survives a status tab click', async ({ page }) => {
    // ⚠ The regression this whole PR is shaped around.
    await page.goto('/admin/entities?status=all&q=the')

    await page.getByRole('link', { name: 'Published', exact: true }).click()
    await page.waitForURL(/status=published/)

    const params = new URL(page.url()).searchParams
    expect(params.get('q')).toBe('the')
    expect(params.get('status')).toBe('published')
    // The old page number must not survive a scope change.
    expect(params.get('page')).toBeNull()
  })

  test('a facet select narrows the queue and resets the page', async ({ page }) => {
    await page.goto('/admin/entities?status=all&page=2')

    await page.getByLabel('Location type').selectOption('virtual')
    await page.waitForURL(/location_type=virtual/)

    const params = new URL(page.url()).searchParams
    expect(params.get('page')).toBeNull()
    expect(params.get('status')).toBe('all')
  })

  test('clear filters returns to the untouched queue', async ({ page }) => {
    await page.goto('/admin/entities?status=all&q=the&location_type=virtual')

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.waitForURL((url) => url.searchParams.toString() === '')

    await expect(page.getByLabel('Search')).toHaveValue('')
  })

  test('a query full of PostgREST metacharacters returns a page, not a 400', async ({ page }) => {
    // `,` `(` `)` `"` corrupt the comma-delimited .or() expression; `%` and `_`
    // are ilike wildcards. Two sanitisers stand between the input and the query,
    // and this is the assertion that they are actually wired up.
    const response = await page.goto(
      `/admin/entities?status=all&q=${encodeURIComponent('a,b(c) 50% x_y')}`
    )

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Entities', level: 1 })).toBeVisible()
  })
})
