// =============================================================================
// Tester Tour — the rail's mount contract (M4.6)
// =============================================================================
// TourRailMount sits in the ROOT layout. Everything below follows from that
// one fact, and every failure mode it guards is sitewide rather than
// tour-shaped:
//
//   1. It runs on every request from every visitor, enrolled or not, signed in
//      or not. So it must return null at the cheapest gate available and never
//      pay for the next one: flag off costs no Supabase client and no
//      `auth.getUser()` round-trip; signed out costs no enrollment query.
//      Getting this wrong does not break anything — it just quietly adds a
//      network round-trip to every page on the site.
//
//   2. It must not throw. A throw here is not a missing rail, it is a 500 on
//      the public marketplace for a visitor who has never heard of the tour.
//      `resolveTourViewer` wraps its whole body in try/catch for that reason;
//      these tests fail every read, in every way a read can fail, and assert
//      the mount still resolves to null.
//
//   3. The rail must never appear over the admin console, the coming-soon
//      gate, or an auth flow — and route hiding is by PREFIX, deliberately
//      unlike ChromeGate's exact equality, because /admin has children. The
//      table below is the whole policy, including the near-misses a bare
//      `startsWith` would swallow.
//
// The z-index assertion is source-text for the same reason
// tests/tester-tour-render-mode.test.ts's are: a rail that renders above the
// z-50 header breaks no build, throws no error, and is only ever caught by a
// human looking at a screenshot.
//
// What is NOT here: per-step rendering. The rail is deliberately dumb — every
// verdict arrives pre-resolved from GET /api/tour/state, and the logic that
// produces those verdicts is tested at tests/tester-tour-evidence.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { HIDDEN_PREFIXES, isHiddenPath } from '@/lib/tour/routes'

const TESTER = 'tester-user-id'

type Filter = { kind: 'eq' | 'is'; col: string; val: unknown }

const h = vi.hoisted(() => {
  const state = {
    flagOn: true,
    /** null = signed out. */
    user: null as { id: string; email: string | null } | null,
    /** Make `auth.getUser()` reject rather than resolve. */
    authThrows: false,
    /** Make `createClient()` itself throw — the harshest read failure. */
    clientThrows: false,
    enrollment: null as Record<string, unknown> | null,
    enrollmentError: null as { message: string } | null,
    queries: [] as { table: string; filters: Filter[] }[],
  }

  const createClient = vi.fn(async () => {
    if (state.clientThrows) throw new Error('supabase client unavailable')
    return {
      auth: {
        getUser: async () => {
          if (state.authThrows) throw new Error('auth backend unreachable')
          return { data: { user: state.user }, error: null }
        },
      },
      from(table: string) {
        const filters: Filter[] = []
        const builder = {
          select: () => builder,
          eq: (col: string, val: unknown) => {
            filters.push({ kind: 'eq', col, val })
            return builder
          },
          is: (col: string, val: unknown) => {
            filters.push({ kind: 'is', col, val })
            return builder
          },
          maybeSingle: async () => {
            state.queries.push({ table, filters })
            return { data: state.enrollment, error: state.enrollmentError }
          },
        }
        return builder
      },
    }
  })

  const createServiceClient = vi.fn(() => {
    throw new Error('the layout path must not use the service role')
  })

  const isFeatureEnabled = vi.fn(() => state.flagOn)

  /** Stands in for the client chunk. Referencing it is the "expensive step". */
  const TourRail = vi.fn(() => null)

  return { state, createClient, createServiceClient, isFeatureEnabled, TourRail }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/env', () => ({ isFeatureEnabled: h.isFeatureEnabled }))
vi.mock('@/components/tour/TourRail', () => ({ TourRail: h.TourRail }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn }))

const { TourRailMount } = await import('@/components/tour/TourRailMount')
const { resolveTourViewer } = await import('@/lib/tour/witness')

const ENROLLED = {
  id: 'enrollment-id',
  listing_id: 'listing-id',
  completed_at: null,
  trial_granted_at: null,
}

function reset() {
  h.state.flagOn = true
  h.state.user = { id: TESTER, email: 'tester@example.com' }
  h.state.authThrows = false
  h.state.clientThrows = false
  h.state.enrollment = ENROLLED
  h.state.enrollmentError = null
  h.state.queries = []
}

beforeEach(() => {
  vi.clearAllMocks()
  reset()
})

// ─────────────────────────────────────────────────────────────────────────────
// A. The three gates, cheapest first
// ─────────────────────────────────────────────────────────────────────────────

describe('gate order — each gate refuses before paying for the next', () => {
  it('flag off: no Supabase client is created at all', async () => {
    h.state.flagOn = false

    expect(await resolveTourViewer()).toBeNull()
    // The point of the first gate. Creating the client here would put an
    // `auth.getUser()` round-trip on every request sitewide, for a feature
    // that is off.
    expect(h.createClient).not.toHaveBeenCalled()
  })

  it('signed out: the client is created but no enrollment is read', async () => {
    h.state.user = null

    expect(await resolveTourViewer()).toBeNull()
    expect(h.createClient).toHaveBeenCalledTimes(1)
    expect(h.state.queries).toEqual([])
  })

  it('signed in but not enrolled: one enrollment read, then null', async () => {
    h.state.enrollment = null

    expect(await resolveTourViewer()).toBeNull()
    expect(h.state.queries).toHaveLength(1)
    expect(h.state.queries.at(0)?.table).toBe('tour_enrollments')
  })

  it('enrolled: returns the viewer with the enrollment mapped', async () => {
    const viewer = await resolveTourViewer()

    expect(viewer).toEqual({
      userId: TESTER,
      email: 'tester@example.com',
      enrollment: {
        id: 'enrollment-id',
        listingId: 'listing-id',
        completedAt: null,
        trialGrantedAt: null,
      },
    })
  })

  it('scopes the enrollment read to this tester and to a LIVE enrollment', async () => {
    await resolveTourViewer()

    const filters = h.state.queries.at(0)?.filters ?? []
    expect(filters).toContainEqual({ kind: 'eq', col: 'tester_user_id', val: TESTER })
    // Without `.is('ended_at', null)` an ended tour resurrects its rail — and
    // an ended enrollment is exactly the state a revoked tester is left in.
    expect(filters).toContainEqual({ kind: 'is', col: 'ended_at', val: null })
  })

  it('resolves the viewer with the tester’s OWN client, never the service role', async () => {
    // The tour's SELECT-only RLS grants a tester their own enrollment row, so
    // this read needs no elevation. Reaching for the service role on a path
    // that runs for every visitor would be a much larger blast radius than the
    // read requires.
    await resolveTourViewer()
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B. The mount returns null without referencing the client chunk
// ─────────────────────────────────────────────────────────────────────────────

describe('TourRailMount — null at every gate, and no rail element', () => {
  const causes: [string, () => void][] = [
    ['flag off', () => (h.state.flagOn = false)],
    ['signed out', () => (h.state.user = null)],
    ['not enrolled', () => (h.state.enrollment = null)],
    ['enrollment read failed', () => (h.state.enrollmentError = { message: 'boom' })],
  ]

  for (const [name, arrange] of causes) {
    it(`returns null — ${name}`, async () => {
      arrange()

      const rendered = await TourRailMount()

      expect(rendered).toBeNull()
      // Returning `<TourRail />` and letting the client decide would ship the
      // chunk to every visitor on every page. Null here means the element is
      // never even constructed.
      expect(h.TourRail).not.toHaveBeenCalled()
    })
  }

  it('renders the rail for an enrolled tester', async () => {
    const rendered = await TourRailMount()

    expect(rendered).not.toBeNull()
    expect((rendered as { type: unknown }).type).toBe(h.TourRail)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C. Nothing throws when every read fails
// ─────────────────────────────────────────────────────────────────────────────

describe('never throws — a failure here is a 500 on the public site', () => {
  const failures: [string, () => void][] = [
    ['the Supabase client cannot be created', () => (h.state.clientThrows = true)],
    ['the auth backend is unreachable', () => (h.state.authThrows = true)],
    ['the enrollment read returns a Postgres error', () => (h.state.enrollmentError = { message: 'PGRST' })],
  ]

  for (const [name, arrange] of failures) {
    it(`resolves to null when ${name}`, async () => {
      arrange()

      await expect(TourRailMount()).resolves.toBeNull()
      await expect(resolveTourViewer()).resolves.toBeNull()
    })
  }

  it('a read failure is indistinguishable from not being enrolled — on purpose', async () => {
    // Deliberate asymmetry with lib/tour/verify.ts, where read_failed and
    // no_evidence must NEVER collapse. There, the distinction decides what a
    // tester is told to do. Here there is nothing to tell anyone: the rail is
    // absent either way, and the only alternative to collapsing is a broken
    // page.
    h.state.enrollmentError = { message: 'timeout' }
    const failed = await resolveTourViewer()

    reset()
    h.state.enrollment = null
    const absent = await resolveTourViewer()

    expect(failed).toBe(absent)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// D. Route hiding is by prefix, and stops at a segment boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('isHiddenPath — prefix matching, segment-bounded', () => {
  it('hides every declared prefix and its children', () => {
    for (const prefix of HIDDEN_PREFIXES) {
      expect(isHiddenPath(prefix)).toBe(true)
      expect(isHiddenPath(`${prefix}/anything`)).toBe(true)
      expect(isHiddenPath(`${prefix}/nested/deeper`)).toBe(true)
    }
  })

  it('hides the admin children ChromeGate’s exact equality would miss', () => {
    // components/layout/chrome-gate.tsx matches by equality, which is right
    // for its job and wrong for this one: /admin/claims would keep the rail
    // floating over the moderation queue.
    expect(isHiddenPath('/admin/claims')).toBe(true)
    expect(isHiddenPath('/admin/verification/some-id')).toBe(true)
    expect(isHiddenPath('/admin/testers')).toBe(true)
  })

  it('does not swallow a sibling route that merely shares the prefix string', () => {
    // The failure mode of a bare `startsWith`. None of these exist today; the
    // rule has to hold when one of them does.
    expect(isHiddenPath('/administrators')).toBe(false)
    expect(isHiddenPath('/authors')).toBe(false)
    expect(isHiddenPath('/onboarding-guide')).toBe(false)
    expect(isHiddenPath('/sign-in-help')).toBe(false)
  })

  it('shows the rail on the surfaces the tour actually walks', () => {
    // Every step of the tour happens on one of these. If any becomes hidden,
    // the tour is unwalkable and nothing else fails.
    for (const shown of [
      '/',
      '/search',
      '/discover',
      '/collections',
      '/collections/black-owned-bakeries',
      '/atlanta-ga/business/some-listing',
      '/account/activity',
      '/dashboard',
    ]) {
      expect(isHiddenPath(shown)).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E. Stacking order
// ─────────────────────────────────────────────────────────────────────────────

describe('z-index — the rail stays under the header', () => {
  // Comments stripped: the file's own header explains that z-40 keeps the rail
  // under the z-50 header, and a scan that read prose would fail on the
  // sentence describing the rule it is enforcing.
  const railSrc = readFileSync(
    path.resolve(process.cwd(), 'components/tour/TourRail.tsx'),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  it('positions the rail at z-40', () => {
    expect(railSrc).toMatch(/\bz-40\b/)
  })

  it('declares nothing at z-50 or above', () => {
    // The site header is fixed at z-50. A rail at or above it covers the nav
    // on every public page — including, for a tester, the way out.
    const classTokens = railSrc.match(/\bz-(\d+)\b/g) ?? []
    const arbitrary = railSrc.match(/\bz-\[(\d+)\]/g) ?? []
    const levels = [
      ...classTokens.map((t) => Number(t.slice(2))),
      ...arbitrary.map((t) => Number(t.slice(3, -1))),
    ]

    expect(levels.length).toBeGreaterThan(0)
    expect(Math.max(...levels)).toBeLessThan(50)
  })
})
