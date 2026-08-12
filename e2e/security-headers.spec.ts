import { test, expect } from '@playwright/test'
import { SECURITY_HEADERS } from '../lib/security/headers'

// Response security headers.
//
// This spec exists because the previous guarantee was prose. The signed
// security audit (docs/blacqlist/launch/security-audit-report.md) asserted four
// active headers; production served one, and that one was a Vercel default
// nobody in the repo had asked for. Nothing failed, because nothing was
// looking. So the assertion lives here, where CI runs it, rather than in a
// document that agrees with itself.
//
// A failing test here means the headers are genuinely not being served — a real
// regression, not a broken test.

test.describe('Security response headers', () => {
  // Every route response should carry them, including the COMING_SOON_MODE
  // middleware redirect — a header the public never receives is not a
  // protection, and while the gate is on, the 307 IS what the public receives.
  for (const path of ['/', '/coming-soon']) {
    // Counted from the array rather than written out, so adding a header
    // cannot leave a test name asserting a number that is no longer true.
    test(`${path} carries all ${SECURITY_HEADERS.length} security headers`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      const headers = res.headers() // Playwright lower-cases the keys

      for (const { key, value } of SECURITY_HEADERS) {
        expect(headers[key.toLowerCase()], `${path} is missing ${key}`).toBe(value)
      }
    })
  }

  test('x-powered-by is not advertised', async ({ request }) => {
    const res = await request.get('/coming-soon', { maxRedirects: 0 })
    expect(res.headers()['x-powered-by']).toBeUndefined()
  })
})
