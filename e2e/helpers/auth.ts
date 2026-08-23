import { type Page } from '@playwright/test'
import { OWNER_EMAIL, OWNER_PASSWORD } from './fixtures'

export const ADMIN_EMAIL = process.env.A11Y_ADMIN_EMAIL ?? 'a11y-admin@test.local'
export const ADMIN_PASSWORD = process.env.A11Y_ADMIN_PASSWORD ?? 'A11yTest1234!'

/**
 * Blocks until Cloudflare has solved the Turnstile challenge and written its
 * token into the form, but only when the widget is actually enabled.
 *
 * Why this has to exist: when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, the widget
 * loads its script lazily and renders on a 200ms poll
 * (components/security/TurnstileWidget.tsx:70-72), so the hidden
 * `cf-turnstile-response` input does not exist at first paint. Submitting
 * before it lands sends no token, and Supabase — which verifies the token
 * itself when project-level CAPTCHA is on — rejects the sign-in with a captcha
 * error that surfaces as the generic TURNSTILE_ERROR alert. That failure looks
 * exactly like a bad password, which is what made it expensive to diagnose the
 * first time — it went red on a comment-only PR that could not have caused it.
 *
 * Gated on the env var rather than on a DOM probe: a `count() > 0` check races
 * the same lazy script it is trying to wait for, and would silently pass
 * straight through on a slow load. Unset key -> no widget -> no-op, which keeps
 * a credential-free local run behaving exactly as it does today.
 */
export async function waitForTurnstileToken(page: Page) {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
      return Boolean(el?.value)
    },
    undefined,
    { timeout: 30_000 }
  )
}

/**
 * The one sign-in path both fixture roles share.
 *
 * Signing in through the real form (cookie-based @supabase/ssr session)
 * produces the exact cookie set the app's server-side guards expect, rather
 * than faking the chunked SSR cookies. `landingPath` is the proof of role: the
 * guards redirect anyone who does not hold it, so arriving there confirms
 * authentication and authorization in one wait.
 */
async function signInAs(
  page: Page,
  email: string,
  password: string,
  landingPath: string,
  label: string
) {
  await page.goto(`/sign-in?next=${landingPath}`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await waitForTurnstileToken(page)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Match on pathname only — a glob/regex would otherwise match the
  // `?next=...` query param while still on /sign-in.
  try {
    await page.waitForURL((url) => url.pathname === landingPath, { timeout: 30_000 })
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
        `${label}: sign-in was rejected for ${email} — ${rendered.join(' / ')}. ` +
          'global-setup provisions this account and reconciles its password on every run, ' +
          'so this usually means it ran against a different Supabase project than the test.'
      )
    }
    throw error
  }
}

/**
 * Signs in as the admin user provisioned in global-setup and lands on
 * /admin/claims. requireAdmin() redirects non-admins to '/', so reaching that
 * path confirms both authentication and the admin role.
 */
export async function loginAsAdmin(page: Page) {
  await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin/claims', 'loginAsAdmin')
}

/**
 * Signs in as the non-admin owner provisioned in global-setup and lands on
 * /dashboard.
 *
 * Unlike /admin/claims, this landing proves authentication only: the dashboard
 * layout and index both guard with getOwnerSession(), which checks for a signed-in
 * user and nothing else — a user who owns no listing still gets the page, with an
 * empty state. Ownership is enforced one level down, by requireOwner() on the
 * per-listing routes, which is where the owner-scoped cases assert it.
 */
export async function loginAsOwner(page: Page) {
  await signInAs(page, OWNER_EMAIL, OWNER_PASSWORD, '/dashboard', 'loginAsOwner')
}
