// =============================================================================
// proxy.ts — the coming-soon gate
// =============================================================================
// This file had zero test coverage, and it is the single piece of code standing
// between the public and a site that is not open yet. It also decides whether an
// invite link works: the whole tester path starts with one request through here.
//
// Two properties are pinned, and they pull against each other:
//
//   1. A bad auth link must fail LEGIBLY. An expired or cross-browser
//      confirmation lands on /sign-in?error=…; the gate used to bounce that to
//      /coming-soon and wipe the query, so the person saw a marketing page and
//      no explanation.
//   2. The gate must STILL BE A GATE. `bypass = hasValidToken || !!user` means
//      any authenticated user walks through — so a publicly reachable /sign-up
//      would be a public door. The negative tests below are the important half
//      of this file.
//
// The token here is an obvious fake. The real value never appears in a file.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}))

import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const TOKEN = 'fake-bypass-token-for-tests'
const COOKIE = 'bl_preview'

/** Builds a request for `path`, optionally carrying the bypass token as a query param or cookie. */
function request(path: string, opts: { token?: string; cookie?: string } = {}) {
  const url = new URL(`https://theblacqlist.com${path}`)
  if (opts.token) url.searchParams.set('preview', opts.token)
  const req = new NextRequest(url)
  if (opts.cookie) req.cookies.set(COOKIE, opts.cookie)
  return req
}

/** Where a response sends the browser, or null when it renders the page it was asked for. */
function redirectedTo(res: Response): string | null {
  const location = res.headers.get('location')
  return location ? new URL(location).pathname : null
}

beforeEach(() => {
  getUser.mockReset()
  getUser.mockResolvedValue({ data: { user: null } })
  process.env.COMING_SOON_MODE = 'true'
  process.env.COMING_SOON_BYPASS_TOKEN = TOKEN
})

afterEach(() => {
  delete process.env.COMING_SOON_MODE
  delete process.env.COMING_SOON_BYPASS_TOKEN
})

describe('the invite link', () => {
  it('serves the sign-up page and sets the cookie in one response — no redirect', async () => {
    // This is the first thing every tester does. If it ever costs two requests,
    // or bounces once before landing, the invite is broken.
    const res = await proxy(request('/sign-up', { token: TOKEN }))
    expect(redirectedTo(res)).toBeNull()
    expect(res.cookies.get(COOKIE)?.value).toBe(TOKEN)
  })

  it('keeps serving pages on later visits from the cookie alone', async () => {
    const res = await proxy(request('/dashboard', { cookie: TOKEN }))
    expect(redirectedTo(res)).not.toBe('/coming-soon')
  })

  it('bounces a wrong token like any other stranger', async () => {
    const res = await proxy(request('/sign-up', { token: 'wrong-token' }))
    expect(redirectedTo(res)).toBe('/coming-soon')
  })
})

describe('a failed auth link fails legibly', () => {
  it('renders /sign-in?error=… instead of bouncing to /coming-soon', async () => {
    // The regression this PR exists for. Before the fix the redirect below
    // fired, and `url.search = ''` threw away the reason on the way out.
    const res = await proxy(request('/sign-in?error=auth_callback_failed'))
    expect(redirectedTo(res)).toBeNull()
  })

  it('lets the password-reset pages through with no bypass at all', async () => {
    // These reach real account holders, not just testers. A reset link opened
    // in a different browser has neither cookie nor session.
    for (const path of ['/forgot-password', '/reset-password', '/verify-email']) {
      const res = await proxy(request(path))
      expect(redirectedTo(res), path).toBeNull()
    }
  })

  it('still lets the auth callback and the API through', async () => {
    for (const path of ['/auth/callback', '/api/health', '/coming-soon']) {
      const res = await proxy(request(path))
      expect(redirectedTo(res), path).toBeNull()
    }
  })
})

describe('the gate is still a gate', () => {
  it('does not open sign-up to the public', async () => {
    // Deliberately excluded from the allowlist. Any authenticated user bypasses
    // the gate, so a reachable sign-up page would hand anyone a way in.
    const res = await proxy(request('/sign-up'))
    expect(redirectedTo(res)).toBe('/coming-soon')
  })

  it('bounces the homepage, listings, and search for a visitor with no bypass', async () => {
    for (const path of ['/', '/atlanta/business/some-listing', '/search', '/pricing']) {
      const res = await proxy(request(path))
      expect(redirectedTo(res), path).toBe('/coming-soon')
    }
  })

  it('does not let a near-miss path slip past an allowlisted prefix', async () => {
    // `startsWith('/sign-in')` alone would have allowed this.
    const res = await proxy(request('/sign-inbox'))
    expect(redirectedTo(res)).toBe('/coming-soon')
  })

  it('drops the query string when it does bounce', async () => {
    const res = await proxy(request('/pricing?utm_source=somewhere'))
    expect(res.headers.get('location')).toBe('https://theblacqlist.com/coming-soon')
  })
})

describe('a signed-in user', () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('bypasses the gate without any token', async () => {
    const res = await proxy(request('/'))
    expect(redirectedTo(res)).toBeNull()
  })

  it('is still bounced off /sign-in to /account', async () => {
    const res = await proxy(request('/sign-in'))
    expect(redirectedTo(res)).toBe('/account')
  })

  it('is NOT bounced off /sign-in when the URL carries an error to show', async () => {
    const res = await proxy(request('/sign-in?error=auth_callback_failed'))
    expect(redirectedTo(res)).toBeNull()
  })
})

describe('with the gate off', () => {
  beforeEach(() => {
    process.env.COMING_SOON_MODE = 'false'
  })

  it('serves the public site to everyone', async () => {
    for (const path of ['/', '/search', '/sign-up']) {
      const res = await proxy(request(path))
      expect(redirectedTo(res), path).toBeNull()
    }
  })

  it('still sends an unauthenticated visitor from /dashboard to /sign-in', async () => {
    const res = await proxy(request('/dashboard'))
    expect(redirectedTo(res)).toBe('/sign-in')
  })
})
