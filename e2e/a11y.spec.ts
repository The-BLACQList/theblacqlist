import { test, expect } from '@playwright/test'
import { expectNoCriticalViolations } from './helpers/axe'
import { loginAsAdmin } from './helpers/auth'

// QA test plan — Section J. Accessibility (P1): axe scan, zero Critical violations.
// Extended for ticket 087 from the original 5 screens to the full reachable set:
// every no-login public/auth/legal screen + the admin screens (via loginAsAdmin).
// Owner-dashboard and supporter-account screens require owner/supporter test
// fixtures that aren't provisioned yet — they're tracked in the audit report.
//
// Note: we wait for a concrete page element (h1/main/form) rather than
// 'networkidle' — Sentry and Vercel Analytics keep connections open, so
// networkidle may never settle.

const READY = 'h1, main, form'

// ── No-login screens (public, auth, legal) ──────────────────────────────────
const PUBLIC_SCREENS: { label: string; path: string }[] = [
  { label: 'Homepage (/)', path: '/' },
  { label: 'Discover (/discover)', path: '/discover' },
  { label: 'Search (/search)', path: '/search' },
  { label: 'Collections index (/collections)', path: '/collections' },
  { label: 'For Business (/for-business)', path: '/for-business' },
  { label: 'About (/about)', path: '/about' },
  { label: 'Sign in (/sign-in)', path: '/sign-in' },
  { label: 'Sign up (/sign-up)', path: '/sign-up' },
  { label: 'Forgot password (/forgot-password)', path: '/forgot-password' },
  { label: 'Reset password (/reset-password)', path: '/reset-password' },
  { label: 'Verify email (/verify-email)', path: '/verify-email' },
  { label: 'Privacy (/privacy)', path: '/privacy' },
  { label: 'Terms (/terms)', path: '/terms' },
  { label: 'Cookies (/cookies)', path: '/cookies' },
  { label: 'How ranking works (/how-ranking-works)', path: '/how-ranking-works' },
]

test.describe('J. Accessibility — axe scans (no-login screens)', () => {
  for (const screen of PUBLIC_SCREENS) {
    test(`axe — ${screen.label}`, async ({ page }) => {
      await page.goto(screen.path)
      await page.locator(READY).first().waitFor()
      await expectNoCriticalViolations(page, screen.label)
    })
  }

  test('axe — Business listing page (click-through)', async ({ page }) => {
    await page.goto('/discover')
    const grid = page.locator('section[aria-label="Discovery results"]')
    await grid.waitFor()
    const firstListing = grid.getByRole('link', { name: 'View Page' }).first()
    await expect(
      firstListing,
      'No seeded listings on /discover — run `npx supabase db reset` or seed staging'
    ).toBeVisible()
    await firstListing.click()
    await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    await page.locator('main').first().waitFor()
    await expectNoCriticalViolations(page, `Listing page (${new URL(page.url()).pathname})`)
  })

  test('axe — Collection detail page (click-through)', async ({ page }) => {
    await page.goto('/collections')
    await page.locator(READY).first().waitFor()
    const firstCollection = page.locator('a[href^="/collections/"]').first()
    await expect(
      firstCollection,
      'No published collections — seed at least one active collection on staging'
    ).toBeVisible()
    await firstCollection.click()
    await page.waitForURL((url) => /^\/collections\/[^/]+/.test(url.pathname), { timeout: 60_000 })
    await page.locator('main').first().waitFor()
    await expectNoCriticalViolations(page, `Collection detail (${new URL(page.url()).pathname})`)
  })
})

// ── Admin screens (single login, then walk) ─────────────────────────────────
const ADMIN_SCREENS: { label: string; path: string }[] = [
  { label: 'Admin claims queue (/admin/claims)', path: '/admin/claims' },
  { label: 'Admin overview (/admin)', path: '/admin' },
  { label: 'Admin listings (/admin/listings)', path: '/admin/listings' },
  { label: 'Admin collections (/admin/collections)', path: '/admin/collections' },
  { label: 'Admin receipts (/admin/receipts)', path: '/admin/receipts' },
]

test.describe('J. Accessibility — axe scans (admin)', () => {
  test('axe — admin screens', async ({ page }) => {
    await loginAsAdmin(page) // lands on /admin/claims
    for (const screen of ADMIN_SCREENS) {
      await page.goto(screen.path)
      await page.locator(`${READY}, table`).first().waitFor()
      await expectNoCriticalViolations(page, screen.label)
    }
  })
})
