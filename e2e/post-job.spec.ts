import { test, expect } from '@playwright/test'

/**
 * Ticket 152: post a job in four steps.
 *
 * Skips cleanly without Supabase env (the page reads the session and the user's
 * businesses) and when posting is not open (FEATURE_POSTING_SUBMISSIONS off makes
 * /add-job a 404). It checks the signed-out path only; the signed-in steps are
 * covered by the unit tests and the QA notes on the PR, because a hermetic sign-in
 * fixture does not exist in this suite yet.
 */

const HAS_SUPABASE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)

test.describe('post a job', () => {
  test.skip(!HAS_SUPABASE, 'needs Supabase env')

  test('a signed-out visitor is sent to sign in and brought back', async ({ page }) => {
    const res = await page.goto('/add-job')
    test.skip(res?.status() === 404, 'posting submissions are not open')
    await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)add-job/)
  })
})
