import { test, expect } from '@playwright/test'
import { FIXTURE_CLAIMABLE_ID } from './helpers/fixtures'

/**
 * Middleware route guards — TA-05 step 1, TA-09 step 1, TA-18 step 1, plus the
 * rest of the protected prefix list.
 *
 * `proxy.ts` guards six prefixes; the test plan spot-checks three of them. The
 * failure mode this catches is a prefix silently dropped from
 * AUTH_REQUIRED_PREFIXES, which exposes a whole authenticated surface while
 * every guarded page still renders correctly for the people who test it signed
 * in. Asserting the `?next=` round-trip as well, because a guard that redirects
 * but loses the destination turns every deep link into a dead end.
 */

const PROTECTED_ROUTES: { label: string; path: string; caseRef: string }[] = [
  { label: 'owner dashboard', path: '/dashboard', caseRef: 'TA-10' },
  { label: 'account', path: '/account', caseRef: 'TA-04' },
  { label: 'add business', path: '/add-business', caseRef: 'TA-05 step 1' },
  { label: 'claim', path: `/claim/${FIXTURE_CLAIMABLE_ID}`, caseRef: 'TA-09 step 1' },
  { label: 'onboarding', path: '/onboarding', caseRef: '—' },
  { label: 'admin', path: '/admin', caseRef: 'TA-18 step 1' },
  { label: 'admin collections', path: '/admin/collections', caseRef: 'TA-23 step 6' },
]

test.describe('Middleware guards on protected routes (anonymous)', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.label} (${route.path}) redirects to sign-in — ${route.caseRef}`, async ({
      page,
    }) => {
      await page.goto(route.path)

      await expect(page).toHaveURL(/\/sign-in\?/)
      const next = new URL(page.url()).searchParams.get('next')
      expect(next, `${route.path} must survive the redirect as ?next=`).toBe(route.path)
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    })
  }
})

test.describe('Public routes stay public', () => {
  // The mirror assertion. A guard applied too broadly is as much a regression
  // as one applied too narrowly, and it fails silently for signed-in testers.
  for (const path of ['/', '/discover', '/cities', '/collections']) {
    test(`${path} renders for an anonymous visitor`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `${path} status`).toBeLessThan(400)
      await expect(page).not.toHaveURL(/\/sign-in/)
    })
  }
})
