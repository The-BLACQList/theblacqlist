import { test, expect } from '@playwright/test'

// Ownership label: Black-owned is the default and goes unsaid; Ally is quiet.
// Founder decision 2026-10-16: no Black-Owned pill on cards, no Ownership
// filter, and the card pill slot carries a category chip that filters
// /discover. The legal pages still define both labels. Since 2026-10-23 the
// site's own copy names Ally only on Terms, Privacy and the add-business path.
// NOTE: requires migration 20260707000000_listings_ownership_label applied to the
// local DB (adds listings.ownership_label + the faceted RPC's ownership arg).

test.describe('Ownership label and card category chips', () => {
  test('Terms §4 ships both ownership definitions', async ({ request }) => {
    const res = await request.get('/terms')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Black-Owned/i)
    expect(html).toMatch(/Ally/i)
  })

  // Founder 2026-10-23: no Ally listings yet, so About stops naming Ally but
  // still says listing and every plan are open to every business.
  test('About page says every business can list, without naming Ally', async ({ request }) => {
    const res = await request.get('/about')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/open to every business/i)
    expect(html).not.toMatch(/\bAlly\b/)
  })

  test('Discover has no Ownership filter and cards carry no Black-Owned pill', async ({ page }) => {
    await page.goto('/discover')
    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ownership' })).toHaveCount(0)
    await expect(cards.getByText('Black-Owned', { exact: true })).toHaveCount(0)
    await expect(cards.getByText('Unclaimed', { exact: true })).toHaveCount(0)
  })

  test('A card category chip filters discover', async ({ page }) => {
    await page.goto('/discover')
    const chip = page.locator('article').getByRole('link', { name: /^More in / }).first()
    await expect(chip).toBeVisible()
    const name = (await chip.textContent())?.trim() ?? ''
    await chip.click()
    await expect(page).toHaveURL(/[?&]category=/)
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  })

  test('An old ?ownership= link still loads with a removable chip', async ({ page }) => {
    await page.goto('/discover?ownership=ally')
    await expect(page.getByRole('button', { name: /^Ally Remove filter$/ }).first()).toBeVisible()
  })
})
