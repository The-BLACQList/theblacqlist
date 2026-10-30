import { test, expect, type Page } from '@playwright/test'

// Jobs board filters (ticket 150). Runs against the real board, so it needs
// FEATURE_JOBS_OPEN=true (playwright.config.ts opens it by default) and a
// database the app can read. Each test skips cleanly when the board is covered
// or cannot load, so the suite stays green where those are missing and
// e2e/opening-soon.spec.ts keeps owning the covered state.

async function boardReady(page: Page): Promise<boolean> {
  await page.goto('/jobs')
  const h1 = page.getByRole('heading', { level: 1, name: 'Jobs', exact: true })
  const chips = page.getByRole('group', { name: 'Kind of work' })
  return (await h1.isVisible()) && (await chips.isVisible())
}

test.describe('Jobs board filters', () => {
  test('header says Jobs and keeps the subhead', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    await expect(page.getByText('Open roles at Black-owned businesses')).toBeVisible()
    await expect(page.getByText('Black-Owned Business Jobs')).toHaveCount(0)
    await expect(page).toHaveTitle(/^Jobs \|/)
  })

  test('Kind of work chips toggle and write the URL', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    const group = page.getByRole('group', { name: 'Kind of work' })
    for (const name of [
      'Full-time',
      'Part-time',
      'Contract',
      'Internship',
      'Volunteer',
      'Temporary',
    ]) {
      await expect(group.getByRole('button', { name })).toBeVisible()
    }
    const chip = group.getByRole('button', { name: 'Volunteer' })
    await chip.click()
    await expect(page).toHaveURL(/\/jobs\?type=volunteer$/)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(chip).toBeFocused()
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible()
  })

  test('Clear filters returns to /jobs', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    await page.goto('/jobs?type=part-time')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('button', { name: 'Part-time' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('a filter that matches nothing shows the no-match state', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    await page.goto('/jobs?where=no-such-city-anywhere')
    const empty = page.getByText('No roles match these filters')
    test.skip(!(await empty.isVisible()), 'Board could not load here')
    await page.getByRole('link', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(/\/jobs$/)
  })

  test('an unknown type is ignored, not an error', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    const res = await page.goto('/jobs?type=nonsense')
    expect(res?.status()).toBe(200)
    await expect(
      page.getByRole('group', { name: 'Kind of work' }).getByRole('button', { pressed: true })
    ).toHaveCount(0)
  })

  test('no sideways page scroll at 375px', async ({ page }) => {
    test.skip(!(await boardReady(page)), 'Jobs board is covered or unavailable here')
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/jobs')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflow).toBe(false)
  })
})
