// =============================================================================
// Bot and spam guards on the public write paths (2026-10-01)
// =============================================================================
// Founder asked whether the live site is protected against bot and spam
// sign-ups. Account sign-up already was (Supabase Auth checks Turnstile). The
// audit found the rest open:
//
//   * Report a correction: no account, no Turnstile, no limit, writes to the
//     admin moderation queue with the service-role client.
//   * The waitlist forms: only a per-IP ledger that fails open.
//   * Reviews, listing submissions, /api/upload and /join: no per-account or
//     per-IP cap once a person is past the front door.
//
// The correction action is exercised against doubles. The rest are pinned as
// source contracts, the same way problem-reports.test.ts does it, plus
// behaviour tests in subscribe-rate-limit.test.ts and upload-route.test.ts.
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HONEYPOT_FIELD, isHoneypotTripped } from '@/lib/security/honeypot'

const ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

const LISTING_ID = '44444444-4444-4444-8444-444444444444'

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: { id: '44444444-4444-4444-8444-444444444444' } as { id: string } | null,
    turnstileOk: true,
    rateAllowed: true,
    inserted: [] as Record<string, unknown>[],
    turnstileCalls: 0,
    rateCalls: [] as { bucket: string; identifier: string; limit: number; windowSeconds?: number }[],
  }
  return { state }
})

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }),
}))

vi.mock('@/lib/security/turnstile', () => ({
  TURNSTILE_ERROR: 'Verification failed. Please try again.',
  verifyTurnstileFormData: async () => {
    h.state.turnstileCalls++
    return h.state.turnstileOk
  },
}))

vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return {
    getClientIp: real.getClientIp,
    checkRateLimit: async (opts: (typeof h.state.rateCalls)[number]) => {
      h.state.rateCalls.push(opts)
      return h.state.rateAllowed
    },
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.state.user } }) },
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        is: () => b,
        maybeSingle: async () => ({ data: h.state.listing, error: null }),
      }
      return b
    },
  }),
  createServiceClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        h.state.inserted.push(row)
        return { error: null }
      },
    }),
  }),
}))

const { submitCorrectionAction } = await import('@/lib/actions/corrections/submitCorrection')

function correction(extra: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('listing_id', LISTING_ID)
  fd.append('issue_type', 'hours_wrong')
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

describe('isHoneypotTripped', () => {
  it('is false when the field is absent or blank, true when anything is in it', () => {
    const fd = new FormData()
    expect(isHoneypotTripped(fd)).toBe(false)
    fd.set(HONEYPOT_FIELD, '   ')
    expect(isHoneypotTripped(fd)).toBe(false)
    fd.set(HONEYPOT_FIELD, 'buy now')
    expect(isHoneypotTripped(fd)).toBe(true)
  })

  it('uses a field name browser autofill will not fill', () => {
    // Names like "website", "email2" or "phone" get autofilled for real people,
    // which would silently drop their submission.
    expect(HONEYPOT_FIELD).not.toMatch(/name|email|phone|url|website|address|company/i)
  })
})

describe('HoneypotField', () => {
  // Comments stripped: the file explains why it avoids display:none.
  const src = read('components/security/HoneypotField.tsx').replace(/\/\/.*$/gm, '')

  it('is hidden from people, keyboards and assistive tech, but not display:none', () => {
    expect(src).toContain('aria-hidden="true"')
    expect(src).toContain('tabIndex={-1}')
    expect(src).toContain('autoComplete="off"')
    expect(src).toContain('name={HONEYPOT_FIELD}')
    // Some bots skip fields that are display:none or carry the `hidden` class.
    expect(src).not.toMatch(/display:\s*none/)
    expect(src).not.toMatch(/className="(?:[^"]*\s)?hidden(?:\s[^"]*)?"/)
  })
})

describe('submitCorrectionAction', () => {
  beforeEach(() => {
    Object.assign(h.state, {
      user: null,
      listing: { id: LISTING_ID },
      turnstileOk: true,
      rateAllowed: true,
      inserted: [],
      turnstileCalls: 0,
      rateCalls: [],
    })
  })

  it('files a correction from a signed-out visitor, limited by IP', async () => {
    expect(await submitCorrectionAction(null, correction())).toEqual({ success: true })
    expect(h.state.inserted).toHaveLength(1)
    expect(h.state.inserted[0]).toMatchObject({ queue_type: 'correction', submitted_by: null })
    expect(h.state.rateCalls).toEqual([
      { bucket: 'correction', identifier: 'ip:203.0.113.9', limit: 5, windowSeconds: 600 },
    ])
  })

  it('limits a signed-in person by account, not IP', async () => {
    h.state.user = { id: 'u-1' }
    expect(await submitCorrectionAction(null, correction())).toEqual({ success: true })
    expect(h.state.rateCalls[0]?.identifier).toBe('user:u-1')
    expect(h.state.inserted[0]).toMatchObject({ submitted_by: 'u-1' })
  })

  it('answers a filled honeypot with success and does nothing else', async () => {
    expect(await submitCorrectionAction(null, correction({ [HONEYPOT_FIELD]: 'x' }))).toEqual({ success: true })
    expect(h.state.inserted).toEqual([])
    expect(h.state.turnstileCalls).toBe(0)
    expect(h.state.rateCalls).toEqual([])
  })

  it('refuses a failed Turnstile check before charging the limit', async () => {
    h.state.turnstileOk = false
    expect(await submitCorrectionAction(null, correction())).toEqual({
      error: 'Verification failed. Please try again.',
    })
    expect(h.state.inserted).toEqual([])
    expect(h.state.rateCalls).toEqual([])
  })

  it('refuses over the limit and writes nothing', async () => {
    h.state.rateAllowed = false
    const result = await submitCorrectionAction(null, correction())
    expect(result).toEqual({ error: expect.stringMatching(/few minutes/) })
    expect(h.state.inserted).toEqual([])
  })

  it('charges the limit even for a malformed submission', async () => {
    const fd = new FormData()
    expect(await submitCorrectionAction(null, fd)).toEqual({ error: 'Missing listing ID.' })
    expect(h.state.rateCalls).toHaveLength(1)
  })
})

describe('forms carry the honeypot and a resetting Turnstile widget', () => {
  const FORMS = [
    'components/entity-page/ReportCorrectionForm.tsx',
    'app/coming-soon/coming-soon-form.tsx',
    'components/marketing/LaunchWaitlist.tsx',
  ]
  for (const rel of FORMS) {
    it(rel, () => {
      const src = read(rel)
      expect(src).toMatch(/<HoneypotField \/>/)
      const widgets = src.match(/<TurnstileWidget[^>]*\/>/g) ?? []
      expect(widgets).toHaveLength(1)
      // A token is single-use; see turnstile-reset-after-submit.test.ts.
      expect(widgets[0]).toMatch(/resetKey=\{state\}/)
    })
  }
})

describe('signed-in writes are rate limited per account', () => {
  it.each([
    ['lib/actions/reviews/createReview.ts', 'review'],
    ['lib/actions/listings/createListing.ts', 'listing_submit'],
    ['lib/actions/listings/submitListing.ts', 'listing_submit'],
    ['app/api/upload/route.ts', 'upload'],
  ])('%s charges the %s bucket by user id, after the auth check', (rel, bucket) => {
    const src = read(rel)
    const authAt = src.indexOf('auth.getUser()')
    const limitAt = src.indexOf(`bucket: '${bucket}'`)
    expect(authAt).toBeGreaterThan(-1)
    expect(limitAt).toBeGreaterThan(authAt)
    expect(src.slice(limitAt, limitAt + 120)).toMatch(/identifier: user\.id/)
  })

  it('/join charges the join bucket by IP before comparing the code', () => {
    const src = read('app/join/route.ts')
    const limitAt = src.indexOf("bucket: 'join'")
    expect(limitAt).toBeGreaterThan(-1)
    expect(limitAt).toBeLessThan(src.indexOf('codeMatches(candidate'))
    expect(src).toMatch(/identifier: getClientIp\(request\.headers\)/)
  })
})

// prune_rate_limit_counters() (20260816000000_rate_limit_counters.sql) deletes
// every counter whose window started over an hour ago. A longer window would
// be wiped partway through and quietly let the caller back in.
describe('no rate limit window outlives the hourly prune', () => {
  function sources(dir: string): string[] {
    return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
      const rel = path.join(dir, name)
      if (statSync(path.join(ROOT, rel)).isDirectory()) return sources(rel)
      return /\.tsx?$/.test(name) ? [rel] : []
    })
  }

  it('every RATE_WINDOW_SECONDS style constant is at most 3600', () => {
    const offenders: string[] = []
    for (const rel of [...sources('lib'), ...sources('app')]) {
      const src = read(rel)
      if (!src.includes('checkRateLimit(')) continue
      for (const m of src.matchAll(/const \w*WINDOW_SECONDS = ([\d\s*]+)/g)) {
        const seconds = m[1]!.split('*').reduce((acc, n) => acc * Number(n.trim()), 1)
        if (seconds > 3600) offenders.push(`${rel}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
