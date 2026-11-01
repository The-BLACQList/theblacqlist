import { test, expect } from '@playwright/test'

// Where Jobs shows up (ticket 154). With Jobs open the home page gets a sixth
// tile that links to the board. Skips when Jobs is covered here; the covered
// state is asserted in e2e/opening-soon.spec.ts.

test.describe('Jobs entry points', () => {
  test('the home Jobs tile links to the board', async ({ page }) => {
    await page.goto('/')
    const tile = page.locator('section[aria-labelledby="avenues-heading"] a[href="/jobs"]')
    test.skip((await tile.count()) === 0, 'Jobs is covered on this server')

    await expect(page.getByText('One list, six avenues')).toBeVisible()
    await expect(tile).toContainText(/open roles?|No open roles yet|Find your next role/)
    await tile.click()
    await expect(page).toHaveURL(/\/jobs$/)
  })
})
