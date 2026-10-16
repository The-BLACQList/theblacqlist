import { test, expect } from '@playwright/test'

// Business levels: Growers, Makers, Suppliers, Local businesses.
// Spec: docs/blacqlist/product/business-levels-2026-10.md.
// NOTE: requires migration 20261017000000_business_levels applied to the
// database the app reads (adds the level columns and the RPCs' p_levels).

test.describe('Business levels', () => {
  test('Discover shows a Level filter with all four levels', async ({ page }) => {
    await page.goto('/discover')
    const group = page.getByRole('group', { name: 'Filter by level' })
    await expect(group).toBeVisible()
    for (const name of ['Growers & raw goods', 'Makers', 'Suppliers', 'Local businesses']) {
      await expect(group.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
    }
  })

  test('Picking a level puts it in the URL', async ({ page }) => {
    await page.goto('/discover')
    const group = page.getByRole('group', { name: 'Filter by level' })
    await group.getByRole('button', { name: /^Makers/ }).click()
    await expect(page).toHaveURL(/[?&]level=maker\b/)
    await expect(group.getByRole('button', { name: /^Makers/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('?level=maker shows a removable Makers chip', async ({ page }) => {
    await page.goto('/discover?level=maker')
    const chip = page.getByRole('button', { name: /^Makers Remove filter$/ }).first()
    await expect(chip).toBeVisible()
    await chip.click()
    await expect(page).not.toHaveURL(/[?&]level=/)
  })

  test('A level with no matches says so, never the whole directory', async ({ page }) => {
    await page.goto('/discover?level=supplier')
    const empty = page.getByText(/^No .*suppliers listed yet$/)
    const count = page.getByText(/^(Showing [\d,]+ of [\d,]+ results|1 result)$/)
    await expect(empty.or(count).first()).toBeVisible()
    if ((await empty.count()) > 0) {
      await expect(page.getByRole('link', { name: 'Add a business' }).first()).toBeVisible()
    }
  })

  test('A typo in ?level= is refused, not widened', async ({ page }) => {
    await page.goto('/discover?level=suplier')
    await expect(page.locator('article')).toHaveCount(0)
  })

  test('Local businesses carry no level pill on cards', async ({ page }) => {
    await page.goto('/discover?level=local')
    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
    await expect(cards.getByText('Local business', { exact: true })).toHaveCount(0)
  })
})
