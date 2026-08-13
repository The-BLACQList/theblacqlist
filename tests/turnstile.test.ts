// =============================================================================
// Checkpoint 6.1 — CAPTCHA on sign-up, claims, reviews
// =============================================================================
// lib/security/turnstile.ts guards the two surfaces Supabase Auth does NOT
// cover: claim submission and review submission. The three auth actions pass
// their token to Supabase instead (single-use token — verifying it twice
// fails), so they are not exercised here.
//
// What these tests pin down:
//   * with no secret configured the guard is SKIPPED, not failed — local dev
//     and CI must keep working without a Cloudflare credential
//   * once the secret is set the guard is FAIL-CLOSED: a missing, empty,
//     rejected, non-200, or unreachable response all return false
//   * the secret is sent to Cloudflare and never to the caller
//   * remoteip is only included when supplied
//   * the FormData wrapper reads the exact field name the widget injects
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  TURNSTILE_TOKEN_FIELD,
  isTurnstileEnabled,
  verifyTurnstileFormData,
  verifyTurnstileToken,
} from '@/lib/security/turnstile'

const SECRET = 'test-secret-key'

function mockFetch(impl: () => Promise<unknown>) {
  const spy = vi.fn(impl as unknown as typeof fetch)
  vi.stubGlobal('fetch', spy)
  return spy
}

/** The (url, init) pair of the first siteverify call. Throws if it never happened. */
function firstCall(spy: ReturnType<typeof mockFetch>): [string, RequestInit] {
  const call = spy.mock.calls[0]
  if (!call) throw new Error('fetch was never called')
  return call as unknown as [string, RequestInit]
}

function ok(success: boolean) {
  return async () => ({ ok: true, json: async () => ({ success }) })
}

beforeEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.TURNSTILE_SECRET_KEY
})

describe('turnstile — degrade when unconfigured', () => {
  it('reports disabled and skips the check when TURNSTILE_SECRET_KEY is unset', async () => {
    const spy = mockFetch(ok(true))

    expect(isTurnstileEnabled()).toBe(false)
    // Even with no token at all: skipped, not rejected.
    await expect(verifyTurnstileToken(null)).resolves.toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports enabled once the secret is set', () => {
    process.env.TURNSTILE_SECRET_KEY = SECRET
    expect(isTurnstileEnabled()).toBe(true)
  })
})

describe('turnstile — fail closed once configured', () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = SECRET
  })

  it('rejects a missing token without calling Cloudflare', async () => {
    const spy = mockFetch(ok(true))
    await expect(verifyTurnstileToken(null)).resolves.toBe(false)
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false)
    await expect(verifyTurnstileToken('')).resolves.toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('accepts a token Cloudflare confirms', async () => {
    mockFetch(ok(true))
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(true)
  })

  it('rejects a token Cloudflare denies (reused, expired, forged)', async () => {
    mockFetch(ok(false))
    await expect(verifyTurnstileToken('bad-token')).resolves.toBe(false)
  })

  it('rejects a non-200 siteverify response', async () => {
    mockFetch(async () => ({ ok: false, json: async () => ({ success: true }) }))
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(false)
  })

  it('rejects when Cloudflare is unreachable — an outage is not a bypass', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED')
    })
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(false)
  })

  it('rejects a malformed siteverify body', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => {
        throw new Error('not json')
      },
    }))
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(false)
  })

  it('posts the secret and token to the siteverify endpoint', async () => {
    const spy = mockFetch(ok(true))
    await verifyTurnstileToken('good-token')

    const [url, init] = firstCall(spy)
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')

    const body = init.body as URLSearchParams
    expect(body.get('secret')).toBe(SECRET)
    expect(body.get('response')).toBe('good-token')
    // Not sent unless the caller supplies it.
    expect(body.get('remoteip')).toBeNull()
  })

  it('includes remoteip only when supplied', async () => {
    const spy = mockFetch(ok(true))
    await verifyTurnstileToken('good-token', '203.0.113.7')
    const [, init] = firstCall(spy)
    expect((init.body as URLSearchParams).get('remoteip')).toBe('203.0.113.7')
  })
})

describe('turnstile — FormData wrapper', () => {
  it('reads the exact field name the widget injects', async () => {
    process.env.TURNSTILE_SECRET_KEY = SECRET
    const spy = mockFetch(ok(true))

    const fd = new FormData()
    fd.append(TURNSTILE_TOKEN_FIELD, 'from-widget')
    await expect(verifyTurnstileFormData(fd)).resolves.toBe(true)

    const [, init] = firstCall(spy)
    expect((init.body as URLSearchParams).get('response')).toBe('from-widget')
  })

  it('rejects a form with no token field once configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = SECRET
    mockFetch(ok(true))
    await expect(verifyTurnstileFormData(new FormData())).resolves.toBe(false)
  })

  it('field name matches Cloudflare’s documented hidden input', () => {
    expect(TURNSTILE_TOKEN_FIELD).toBe('cf-turnstile-response')
  })
})
