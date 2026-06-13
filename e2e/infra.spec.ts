import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

// K. Infrastructure & Monitoring — the locally-runnable checks (K1, K3).
// K2 (degraded health) and K6 (Sentry PII scrub) are unit-tested in tests/.
// K4, K5, K7 are production/dashboard checks — see
// docs/blacqlist/qa/infra-monitoring-test-guide.md.

test.describe('K. Infrastructure & Monitoring', () => {
  test('K1 — health endpoint reports ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.supabase).toBe('ok')
  })

  test('K3 — middleware redirects an authenticated user away from /sign-in', async ({ page }) => {
    await loginAsAdmin(page) // ends on /admin/claims with a valid session
    await page.goto('/sign-in')
    // Code redirects authenticated users to /account (spec said /account/saved;
    // tracked as a deliberate difference — see infra-monitoring-test-guide.md).
    await page.waitForURL('**/account', { timeout: 30_000 })
    expect(new URL(page.url()).pathname).toBe('/account')
  })
})
