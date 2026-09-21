// /join is the flyer / QR door into the gated site (pre-invite item 6,
// 2026-09-21). It is the one route a stranger can hit with a guess, so the
// tests here are about what a wrong guess learns: nothing.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const FLYER = 'fake-flyer-code-for-tests'
const BYPASS = 'fake-bypass-token-for-tests'

// lib/env reads TESTER_FLYER_CODE at import time, so the env must be set before
// the route module loads. The bypass token is read per request by the route.
process.env.TESTER_FLYER_CODE = FLYER

const { GET } = await import('@/app/join/route')
const { codeMatches } = await import('@/lib/auth/flyer-code')
const { proxy } = await import('@/proxy')

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}))

function request(path: string, cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(`https://example.test${path}`, { headers })
}

function redirectedTo(res: Response): string | null {
  const loc = res.headers.get('location')
  return loc ? new URL(loc).pathname : null
}

beforeEach(() => {
  process.env.COMING_SOON_MODE = 'true'
  process.env.COMING_SOON_BYPASS_TOKEN = BYPASS
})

afterEach(() => {
  delete process.env.COMING_SOON_MODE
  delete process.env.COMING_SOON_BYPASS_TOKEN
})

describe('GET /join', () => {
  it('admits a correct code: bl_preview + bl_src cookies, then /sign-up', async () => {
    const res = await GET(request(`/join?code=${FLYER}`))
    expect(redirectedTo(res)).toBe('/sign-up')
    const preview = res.cookies.get('bl_preview')
    expect(preview?.value).toBe(BYPASS)
    expect(preview?.httpOnly).toBe(true)
    expect(preview?.sameSite).toBe('lax')
    expect(preview?.path).toBe('/')
    expect(preview?.maxAge).toBe(60 * 60 * 24 * 30)
    expect(res.cookies.get('bl_src')?.value).toBe('flyer')
  })

  it('sends a wrong code to /coming-soon with no cookies and no explanation', async () => {
    const res = await GET(request('/join?code=not-the-code'))
    expect(redirectedTo(res)).toBe('/coming-soon')
    expect(res.headers.get('location')).not.toContain('code')
    expect(res.headers.get('location')).not.toContain('error')
    expect(res.cookies.get('bl_preview')).toBeUndefined()
    expect(res.cookies.get('bl_src')).toBeUndefined()
  })

  it('treats a missing code the same as a wrong one', async () => {
    const res = await GET(request('/join'))
    expect(redirectedTo(res)).toBe('/coming-soon')
    expect(res.cookies.get('bl_preview')).toBeUndefined()
  })

  it('never echoes the submitted code back in the response', async () => {
    const res = await GET(request('/join?code=probe-value-xyz'))
    const headerText = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')
    expect(headerText).not.toContain('probe-value-xyz')
    expect(await res.text()).not.toContain('probe-value-xyz')
  })

  it('the admitted cookie is the one the coming-soon gate already honors', async () => {
    // End to end in memory: the cookie /join sets is what proxy.ts checks.
    const admitted = await GET(request(`/join?code=${FLYER}`))
    const cookie = `bl_preview=${admitted.cookies.get('bl_preview')?.value}`
    const res = await proxy(request('/sign-up', cookie))
    expect(redirectedTo(res)).toBeNull()
  })
})

describe('codeMatches', () => {
  it('is closed when the expected code is empty, even for an empty candidate', () => {
    expect(codeMatches('', '')).toBe(false)
    expect(codeMatches('anything', '')).toBe(false)
  })

  it('matches only the exact code', () => {
    expect(codeMatches(FLYER, FLYER)).toBe(true)
    expect(codeMatches(FLYER.toUpperCase(), FLYER)).toBe(false)
    expect(codeMatches(`${FLYER} `, FLYER)).toBe(false)
    expect(codeMatches(FLYER.slice(0, -1), FLYER)).toBe(false)
  })

  it('compares in constant time rather than with === or startsWith', () => {
    const src = readFileSync(join(process.cwd(), 'lib/auth/flyer-code.ts'), 'utf8')
    expect(src).toContain('timingSafeEqual')
    expect(src).not.toMatch(/candidate\s*===\s*expected/)
    expect(src).not.toContain('startsWith')
  })
})

describe('the gate', () => {
  it('lets /join through while coming-soon mode is on', async () => {
    const res = await proxy(request('/join?code=whatever'))
    expect(redirectedTo(res)).not.toBe('/coming-soon')
  })

  it('still does not allowlist /sign-up itself', async () => {
    const res = await proxy(request('/sign-up'))
    expect(redirectedTo(res)).toBe('/coming-soon')
  })

  it('routes /join through the route handler, not the proxy, so the flyer code is never in a proxy-set cookie', () => {
    const src = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
    // The comment may name the variable; the code must not read it.
    expect(src).not.toMatch(/process\.env\.TESTER_FLYER_CODE|import[^\n]*TESTER_FLYER_CODE/)
    expect(src).toContain("'/join'")
  })
})

describe('no committed file carries a real code', () => {
  it('the route, env, and this test only reference the env var name', () => {
    for (const f of ['app/join/route.ts', 'lib/env.ts', 'lib/auth/flyer-code.ts']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src).not.toMatch(/code=[A-Za-z0-9]{6,}/)
    }
  })
})
