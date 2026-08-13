// =============================================================================
// getAppUrl() — absolute origin for auth redirect links
// =============================================================================
// This resolver exists because of a real P0: NEXT_PUBLIC_APP_URL is scoped to
// Production only in Vercel, so on every Preview the old inline
// `?? 'http://localhost:3000'` fallback fired and confirmation emails pointed at
// the tester's own machine. Nobody could sign in on a Preview to verify a PR.
//
// What these tests pin down:
//   * precedence: explicit config → real deployment → local dev
//   * VERCEL_URL carries no protocol, so https:// must be prepended
//   * a trailing slash in the configured value never produces a double slash
//     (`${getAppUrl()}/auth/callback` is the only way this is ever used)
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const ORIGINAL = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_URL: process.env.VERCEL_URL,
}

// lib/env.ts reads process.env inside the function body, not at module scope,
// so a plain import is enough — no module cache busting required.
import { getAppUrl } from '@/lib/env'

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.VERCEL_URL
})

afterEach(() => {
  if (ORIGINAL.NEXT_PUBLIC_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL.NEXT_PUBLIC_APP_URL
  if (ORIGINAL.VERCEL_URL === undefined) delete process.env.VERCEL_URL
  else process.env.VERCEL_URL = ORIGINAL.VERCEL_URL
})

describe('getAppUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL over everything else', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://theblacqlist.com'
    process.env.VERCEL_URL = 'blacqlist-abc123.vercel.app'
    expect(getAppUrl()).toBe('https://theblacqlist.com')
  })

  it('strips trailing slashes so callers can append a path safely', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://theblacqlist.com//'
    expect(`${getAppUrl()}/auth/callback`).toBe('https://theblacqlist.com/auth/callback')
  })

  it('falls back to VERCEL_URL with an https prefix — this is the Preview fix', () => {
    process.env.VERCEL_URL = 'blacqlist-abc123.vercel.app'
    expect(getAppUrl()).toBe('https://blacqlist-abc123.vercel.app')
  })

  it('ignores an empty NEXT_PUBLIC_APP_URL rather than returning a bare path', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    process.env.VERCEL_URL = 'blacqlist-abc123.vercel.app'
    expect(getAppUrl()).toBe('https://blacqlist-abc123.vercel.app')
  })

  it('falls back to localhost only when neither is set', () => {
    expect(getAppUrl()).toBe('http://localhost:3000')
  })
})
