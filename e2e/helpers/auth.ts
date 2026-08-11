import { type Page } from '@playwright/test'

export const ADMIN_EMAIL = process.env.A11Y_ADMIN_EMAIL ?? 'a11y-admin@test.local'
export const ADMIN_PASSWORD = process.env.A11Y_ADMIN_PASSWORD ?? 'A11yTest1234!'

/**
 * Signs in through the real sign-in form (cookie-based @supabase/ssr session)
 * as the admin user provisioned in global-setup, then lands on /admin/claims.
 * Using the UI login produces the exact cookie set the app's requireAdmin()
 * guard expects, rather than faking the chunked SSR cookies.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/sign-in?next=/admin/claims')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // requireAdmin() redirects non-admins to '/', so reaching /admin/claims
  // confirms both authentication and the admin role.
  // Match on pathname only — a glob/regex would otherwise match the
  // `?next=/admin/claims` query param while still on /sign-in.
  try {
    await page.waitForURL((url) => url.pathname === '/admin/claims', { timeout: 30_000 })
  } catch (error) {
    // A rejected credential is not a navigation problem: the server action
    // answers 200 with an error state and the page simply stays put, so the
    // only symptom is a 30s timeout that reads like a slow app. The sign-in
    // page renders that state in a role="alert" (app/(auth)/sign-in/page.tsx:62)
    // — surface it, so the next reader gets the reason instead of a trace dig.
    const alerts = await page
      .getByRole('alert')
      .allTextContents()
      .catch(() => [] as string[])
    const rendered = alerts.map((t) => t.trim()).filter(Boolean)
    if (rendered.length > 0) {
      throw new Error(
        `loginAsAdmin: sign-in was rejected for ${ADMIN_EMAIL} — ${rendered.join(' / ')}. ` +
          'global-setup provisions this account and reconciles its password on every run, ' +
          'so this usually means it ran against a different Supabase project than the test.'
      )
    }
    throw error
  }
}
