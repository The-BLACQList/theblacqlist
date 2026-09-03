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

import { readFileSync } from 'node:fs'
import path from 'node:path'

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

// =============================================================================
// M4.14 — the widget mounts on intent, not on page load
// =============================================================================
// The founder, walking a listing page on the PR #110 Preview: "Does the
// cloudflare turnstile have to be on every listing page?? I don't like it."
//
// It was not on every listing page — it was on every listing page he was
// ELIGIBLE TO REVIEW, which while signed in is nearly all of them. The form had
// no toggle, so `EntityReviewsSection` mounted `ReviewForm`, which mounts
// `TurnstileWidget`, which injects Cloudflare's script and polls every 200ms for
// up to 10s (TurnstileWidget.tsx:71-72) before anyone touched anything.
//
// Source text is the evidence here because vitest runs with no jsdom
// (vitest.config.ts) — there is no DOM in which to mount a component and count
// network requests. e2e/review-form-intent.spec.ts does that half in a browser;
// these three assertions catch the refactor that quietly undoes it.
// =============================================================================

describe('turnstile mounts on intent', () => {
  const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8')

  it('EntityReviewsSection does not render ReviewForm directly', () => {
    // The regex, not `.toContain`, because `<ReviewFormDisclosure` contains
    // `<ReviewForm` as a prefix — a substring check here can never fail.
    const src = read('components/entity-page/EntityReviewsSection.tsx')
    expect(src).not.toMatch(/<ReviewForm[\s/>]/)
    expect(src).toContain('<ReviewFormDisclosure')
  })

  it('the disclosure holds its own open state and imports ReviewForm itself', () => {
    // ⚠ Both halves matter. A disclosure that took `children` from the server
    // parent would still mount the form on load — the parent creates the child
    // — and the captcha would be back with every test here still green.
    const src = read('components/entity-page/ReviewFormDisclosure.tsx')
    expect(src).toContain('useState')
    expect(src).toContain("import { ReviewForm } from '@/components/entity-page/ReviewForm'")
    expect(src).toContain('<ReviewForm')
    // Neither declared as a prop nor rendered as one.
    expect(src).not.toMatch(/children\s*\??\s*:/)
    expect(src).not.toMatch(/\{\s*children\s*\}/)
  })

  it('ReviewForm still carries the widget once it is open', () => {
    // The fix defers the captcha; it does not remove it. Server verification
    // (createReview.ts) fails closed, so dropping the widget would make every
    // review submission impossible rather than merely unprotected.
    expect(read('components/entity-page/ReviewForm.tsx')).toContain('<TurnstileWidget')
  })
})
