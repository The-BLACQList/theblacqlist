import { test, expect } from '@playwright/test'

// Ownership label pivot (Black-Owned / Ally).
// NOTE: requires migration 20260707000000_listings_ownership_label applied to the
// local DB (adds listings.ownership_label + the faceted RPC's ownership arg).
// Without it, discover/search queries error — the same prerequisite as any other
// schema change in this repo.

test.describe('Ownership label — Black-Owned / Ally', () => {
  test('Terms §4 ships both ownership definitions', async ({ request }) => {
    const res = await request.get('/terms')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Black-Owned/i)
    expect(html).toMatch(/Ally/i)
  })

  test('About page describes the Ally label', async ({ request }) => {
    const res = await request.get('/about')
    expect(res.status()).toBe(200)
    expect(await res.text()).toMatch(/Ally/i)
  })

  test('Discover exposes the Ownership filter control', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByText('Ownership', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Black-Owned' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ally' }).first()).toBeVisible()
  })

  test('Selecting the Black-Owned facet filters and shows the badge', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'Black-Owned' }).first().click()
    await expect(page).toHaveURL(/ownership=black_owned/)
    // All seeded listings are Black-Owned, so results and the badge remain.
    await expect(page.getByText('Black-Owned').first()).toBeVisible()
  })

  test('Selecting the Ally facet updates the URL', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'Ally' }).first().click()
    await expect(page).toHaveURL(/ownership=ally/)
  })
})
