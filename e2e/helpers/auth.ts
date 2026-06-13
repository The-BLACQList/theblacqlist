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
  await page.waitForURL((url) => url.pathname === '/admin/claims', { timeout: 30_000 })
}
