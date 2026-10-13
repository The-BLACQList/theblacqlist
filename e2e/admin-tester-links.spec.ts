import { test, expect } from '@playwright/test'

import { loginAsAdmin } from './helpers/auth'

/**
 * /admin/testers one-tap links: an owner link with no page (2026-10-11).
 *
 * Most test owners don't have a BLACQList page yet. The Listing box is now
 * optional for an owner link, and a blank one must still make a link instead
 * of refusing with "Pick a listing".
 *
 * The minted link is a sign-in credential, so the spec only checks its shape.
 * Never log or attach its value.
 *
 * Errors are found by text, not role="alert": Next's route announcer is also
 * an alert, so getByRole('alert') always matches one element.
 *
 * ⚠ This spec WRITES tester_invites rows and makes a throwaway account. Run it against a local database,
 * never staging or production. It is not in the CI e2e list for that reason.
 */

test.describe('admin tester links', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('an owner link with no page makes a link', async ({ page }) => {
    await page.goto('/admin/testers')
    // The form sits behind the header button since ticket 137.
    await page.getByRole('button', { name: 'Make a link' }).click()

    await page.getByRole('radio', { name: 'Listing owner' }).check()
    const listing = page.getByLabel('Listing ID or slug (optional)')
    await expect(listing).toBeVisible()
    await expect(listing).toHaveValue('')

    const label = `E2E-${Date.now().toString(36).slice(-6)}`
    await page.getByLabel('Label', { exact: true }).fill(label)
    await page.getByRole('button', { name: 'Make link' }).click()

    await expect(page.getByText(`Link for ${label}. It shows once, so copy it now.`)).toBeVisible()
    const link = page.getByRole('textbox', { name: 'One-tap link' })
    await expect(link).toHaveValue(/\/t#/)
    await expect(page.getByText(/Failed to make the link|Pick a listing/)).toHaveCount(0)
  })

  test('the owner taps it, types an email and lands on the create-your-page choices', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/testers')
    // The form sits behind the header button since ticket 137.
    await page.getByRole('button', { name: 'Make a link' }).click()
    await page.getByRole('radio', { name: 'Listing owner' }).check()
    await page.getByLabel('Label', { exact: true }).fill(`E2E-${Date.now().toString(36).slice(-6)}`)
    await page.getByRole('button', { name: 'Make link' }).click()
    const link = await page.getByRole('textbox', { name: 'One-tap link' }).inputValue()
    expect(link).toMatch(/\/t#/)

    // A fresh browser with no session, like the owner's phone.
    const owner = await browser.newContext()
    const ownerPage = await owner.newPage()
    try {
      await ownerPage.goto(link)
      await ownerPage
        .getByLabel('Your email')
        .fill(`owner-e2e-${Date.now().toString(36)}@example.com`)
      await ownerPage.getByRole('button', { name: 'Start' }).click()

      await ownerPage.waitForURL(/\/dashboard(\?|$)/)
      await expect(ownerPage.getByRole('link', { name: 'Find my business to claim' })).toBeVisible()
      await expect(ownerPage.getByRole('link', { name: 'Create a new page' })).toBeVisible()
    } finally {
      await owner.close()
    }
  })

  test('an owner link with a page and an email is refused', async ({ page }) => {
    await page.goto('/admin/testers')
    // The form sits behind the header button since ticket 137.
    await page.getByRole('button', { name: 'Make a link' }).click()

    await page.getByRole('radio', { name: 'Listing owner' }).check()
    await page.getByLabel('Label', { exact: true }).fill('E2E-both')
    await page.getByLabel('Listing ID or slug (optional)').fill('any-page')
    await page.getByLabel('Owner email (optional)').fill('owner@example.com')
    await page.getByRole('button', { name: 'Make link' }).click()

    await expect(page.getByText(/Leave the email blank/)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'One-tap link' })).toHaveCount(0)
  })

  // Shared link (founder, 2026-10-13): one link, up to 15 testers, and each
  // person picks owner or supporter.
  test('a shared link asks no email, and each person picks their tour', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/testers')
    // The form sits behind the header button since ticket 137.
    await page.getByRole('button', { name: 'Make a link' }).click()
    await page.getByRole('radio', { name: 'Shared (up to 15 people)' }).check()
    await expect(page.getByLabel(/email \(optional\)/)).toHaveCount(0)
    await page.getByLabel('Label', { exact: true }).fill(`E2E-${Date.now().toString(36).slice(-6)}`)
    await page.getByRole('button', { name: 'Make link' }).click()
    await expect(page.getByText(/safe to share/)).toBeVisible()
    const link = await page.getByRole('textbox', { name: 'One-tap link' }).inputValue()
    expect(link).toMatch(/\/t#/)

    const people = [
      { role: /I own a business/, lands: /\/dashboard(\?|$)/ },
      { role: /I support Black-owned businesses/, lands: /\/search(\?|$)/ },
    ]
    for (const person of people) {
      const context = await browser.newContext()
      const tester = await context.newPage()
      try {
        await tester.goto(link)
        await tester.getByRole('radio', { name: person.role }).check()
        await tester
          .getByLabel('Your email')
          .fill(`shared-e2e-${Date.now().toString(36)}@example.com`)
        await tester.getByRole('button', { name: 'Start' }).click()
        await tester.waitForURL(person.lands)
      } finally {
        await context.close()
      }
    }
  })
})
