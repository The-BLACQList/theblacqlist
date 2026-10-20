import { describe, it, expect, vi, beforeEach } from 'vitest'

// The claim route's contract (tester-tour-spec.md §4.3), tested against a
// service-client double with REAL compare-and-set semantics: updates evaluate
// their filters against an in-memory enrollment row, so two concurrent claims
// genuinely race and exactly one wins — the test proves the protocol, not a
// mock's opinion of it.
//
// lib/tour/trial.ts is deliberately NOT mocked: every session Stripe receives
// here passed the real assertTrialCancels, so these tests also prove the claim
// route can never send params that produce a card-less trial surviving day 30.

const h = vi.hoisted(() => {
  type Filter = { kind: 'eq' | 'is'; col: string; val: unknown }
  type UpdateRecord = { table: string; payload: Record<string, unknown>; filters: Filter[] }

  const state = {
    viewer: null as {
      userId: string
      email: string | null
      enrollment: {
        id: string
        listingId: string | null
        isOwner?: boolean
        completedAt: string | null
        trialGrantedAt: string | null
      }
    } | null,
    // Active plan rows by plan_key, as the plan guard sees them.
    plans: {} as Record<string, Record<string, unknown> | null>,
    row: {
      id: 'enr-1',
      listing_id: 'l1' as string | null,
      trial_granted_at: null as string | null,
      stripe_checkout_session_id: null as string | null,
      stripe_subscription_schedule_id: null as string | null,
      upgrade_trial_ends_at: null as string | null,
    },
    // What the claim compare-and-set returns instead, e.g. a unique-index hit.
    casError: null as { code: string; message: string } | null,
    // subscriptions rows the live-plan guard sees for the listing.
    liveSubs: [] as { stripe_subscription_id: string | null }[],
    // The listing row the ownership recheck reads, and whether that read fails.
    listing: { owner_user_id: 'u1', deleted_at: null, status: 'published' } as {
      owner_user_id: string | null
      deleted_at: string | null
      status?: string
    } | null,
    listingError: null as { message: string } | null,
    updates: [] as UpdateRecord[],
    // Ordered log of the operations that matter: 'cas', 'stripe:create',
    // 'persist', 'release'. Pushed at execution time, so ordering assertions
    // reflect what actually ran first.
    log: [] as string[],
  }

  const resolveTrialClaimer = vi.fn(async () => state.viewer)
  const createSession = vi.fn()
  const retrieveSession = vi.fn()
  const expireSession = vi.fn()
  // Ticket 136: the month on a page that already pays.
  const retrieveSubscription = vi.fn()
  const createSchedule = vi.fn()
  const updateSchedule = vi.fn()
  const retrieveSchedule = vi.fn()

  function runUpdate(q: { table: string; payload: Record<string, unknown>; filters: Filter[]; wantsRows: boolean }) {
    state.updates.push({ table: q.table, payload: q.payload, filters: q.filters })
    if ('trial_granted_at' in q.payload) {
      state.log.push(q.payload.trial_granted_at === null ? 'release' : 'cas')
      if (q.payload.trial_granted_at !== null && state.casError) {
        return { data: null, error: state.casError }
      }
    } else if ('stripe_checkout_session_id' in q.payload) {
      state.log.push('persist')
    } else if ('stripe_subscription_schedule_id' in q.payload) {
      state.log.push('persist-schedule')
    }

    const row = state.row as unknown as Record<string, unknown>
    // Timestamps compare as instants, the way Postgres compares timestamptz,
    // so '…00Z' and '…00.000Z' are the same claim.
    const same = (x: unknown, y: unknown) =>
      x === y ||
      (typeof x === 'string' && typeof y === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) &&
        Date.parse(x) === Date.parse(y))
    const matches = q.filters.every((f) =>
      f.kind === 'is' ? row[f.col] === f.val : same(row[f.col], f.val)
    )
    if (matches) Object.assign(row, q.payload)
    return {
      data: q.wantsRows ? (matches ? [{ id: state.row.id }] : []) : null,
      error: null as { code: string; message: string } | null,
    }
  }

  const createServiceClient = vi.fn(() => ({
    from(table: string) {
      const q = {
        table,
        op: 'select' as 'select' | 'update',
        payload: {} as Record<string, unknown>,
        filters: [] as Filter[],
        wantsRows: false,
        select() {
          if (q.op === 'update') q.wantsRows = true
          return q
        },
        update(payload: Record<string, unknown>) {
          q.op = 'update'
          q.payload = payload
          return q
        },
        eq(col: string, val: unknown) {
          q.filters.push({ kind: 'eq', col, val })
          return q
        },
        is(col: string, val: unknown) {
          q.filters.push({ kind: 'is', col, val })
          return q
        },
        in() {
          return q
        },
        limit() {
          return q
        },
        async maybeSingle() {
          if (q.table === 'plans') {
            const key = q.filters.find((f) => f.col === 'plan_key')?.val as string | undefined
            if (key !== undefined) return { data: state.plans[key] ?? null, error: null }
            // The upgrade path looks a plan up by the price the page pays.
            const price = q.filters.find((f) => f.col === 'stripe_price_id_monthly')?.val
            const hit = Object.entries(state.plans).find(
              ([, p]) => p !== null && p.stripe_price_id_monthly === price
            )
            return { data: hit ? { ...hit[1], plan_key: hit[0] } : null, error: null }
          }
          if (q.table === 'listings') {
            state.log.push('owner-check')
            return { data: state.listingError ? null : state.listing, error: state.listingError }
          }
          if (q.table === 'tour_enrollments') {
            return {
              data: {
                stripe_checkout_session_id: state.row.stripe_checkout_session_id,
                stripe_subscription_schedule_id: state.row.stripe_subscription_schedule_id,
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        // Updates are awaited directly (with or without a trailing .select()),
        // so the builder is thenable. The row mutation happens here, inside
        // one microtask — which is exactly the atomicity a single UPDATE
        // statement has, making the concurrency test honest.
        then(
          onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
          onRejected?: (e: unknown) => unknown
        ) {
          if (q.op === 'select' && q.table === 'subscriptions') {
            state.log.push('live-check')
            return Promise.resolve({ data: state.liveSubs, error: null }).then(onFulfilled, onRejected)
          }
          return Promise.resolve(runUpdate(q)).then(onFulfilled, onRejected)
        },
      }
      return q
    },
  }))

  return {
    state,
    resolveTrialClaimer,
    createSession,
    retrieveSession,
    expireSession,
    retrieveSubscription,
    createSchedule,
    updateSchedule,
    retrieveSchedule,
    createServiceClient,
  }
})

// Only the resolver is doubled; LIVE_STATUSES stays the real list. The real
// resolver never reads FEATURE_TESTER_TOUR, which is what lets the claim
// outlive the tour (founder answer 3, 2026-10-10).
vi.mock('@/lib/tour/freeMonth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tour/freeMonth')>()),
  resolveTrialClaimer: h.resolveTrialClaimer,
}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: {
      sessions: { create: h.createSession, retrieve: h.retrieveSession, expire: h.expireSession },
    },
    subscriptions: { retrieve: h.retrieveSubscription },
    subscriptionSchedules: {
      create: h.createSchedule,
      update: h.updateSchedule,
      retrieve: h.retrieveSchedule,
    },
  },
}))

import { POST as claimRoute } from '@/app/api/tour/claim/route'
import { FREE_MONTH_STARTED_URL } from '@/lib/tour/upgrade'

const NOW = 1_792_000_000
const DAY = 86_400

/** A plain monthly Starter subscription on l1, the kind the month can go on. */
function liveStarter(over: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        { price: { id: 'price_starter_monthly', recurring: { interval: 'month', interval_count: 1 } } },
      ],
    },
    metadata: { user_id: 'u1', listing_id: 'l1' },
    schedule: null,
    ...over,
  }
}

/** The schedule Stripe makes from the subscription: one phase, no metadata. */
function pristineSchedule() {
  return {
    id: 'sub_sched_1',
    status: 'active',
    end_behavior: 'release',
    metadata: {},
    current_phase: { start_date: NOW - 10 * DAY, end_date: NOW + 20 * DAY },
    phases: [
      {
        start_date: NOW - 10 * DAY,
        end_date: NOW + 20 * DAY,
        trial_end: null,
        metadata: {},
        items: [{ price: 'price_starter_monthly', quantity: 1 }],
      },
    ],
  }
}

/** The same schedule once the free-month phases are set. */
function markedSchedule() {
  return {
    id: 'sub_sched_1',
    status: 'active',
    end_behavior: 'release',
    metadata: {
      tour_enrollment_id: 'enr-1',
      tour_phases: 'set',
      upgrade_tier: 'growth',
      return_tier: 'starter',
      return_price_id: 'price_starter_monthly',
    },
    phases: [
      {
        start_date: NOW,
        end_date: NOW + 30 * DAY,
        trial_end: NOW + 30 * DAY,
        metadata: { plan_slug: 'growth' },
        items: [{ price: 'price_growth_monthly', quantity: 1 }],
      },
      {
        start_date: NOW + 30 * DAY,
        end_date: NOW + 61 * DAY,
        trial_end: null,
        metadata: { plan_slug: 'starter' },
        items: [{ price: 'price_starter_monthly', quantity: 1 }],
      },
    ],
  }
}

function openGrowth() {
  h.state.plans.growth = { id: 'plan-growth', stripe_price_id_monthly: 'price_growth_monthly' }
}

/** POST the claim. No argument sends an empty body (the old one-button call). */
function POST(body?: unknown) {
  return claimRoute(
    new Request('http://app.test/api/tour/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.state.viewer = {
    userId: 'u1',
    email: 'tester@example.com',
    enrollment: {
      id: 'enr-1',
      listingId: 'l1',
      completedAt: '2026-09-01T00:00:00Z',
      trialGrantedAt: null,
    },
  }
  // Today only Starter is open; Growth and Premium have no price yet.
  h.state.plans = {
    starter: { id: 'plan-starter', stripe_price_id_monthly: 'price_starter_monthly' },
    growth: { id: 'plan-growth', stripe_price_id_monthly: null },
    premium: null,
  }
  h.state.row = {
    id: 'enr-1',
    listing_id: 'l1',
    trial_granted_at: null,
    stripe_checkout_session_id: null,
    stripe_subscription_schedule_id: null,
    upgrade_trial_ends_at: null,
  }
  h.state.casError = null
  h.state.liveSubs = []
  h.state.listing = { owner_user_id: 'u1', deleted_at: null, status: 'published' }
  h.state.listingError = null
  h.state.updates = []
  h.state.log = []
  h.createSession.mockImplementation(async () => {
    h.state.log.push('stripe:create')
    return { id: 'cs_tour_1', url: 'https://checkout.stripe.test/tour' }
  })
  h.createSchedule.mockImplementation(async () => {
    h.state.log.push('schedule:create')
    return pristineSchedule()
  })
  h.updateSchedule.mockImplementation(async () => {
    h.state.log.push('schedule:update')
    return markedSchedule()
  })
  h.retrieveSchedule.mockImplementation(async () => pristineSchedule())
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
})

describe('POST /api/tour/claim — gates before the claim', () => {
  it('404 when the viewer does not resolve (signed out / not enrolled)', async () => {
    h.state.viewer = null
    const res = await POST()
    expect(res.status).toBe(404)
    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.state.updates).toHaveLength(0)
  })

  it('422 TOUR_NOT_COMPLETE when the tour is unfinished, touching nothing', async () => {
    h.state.viewer!.enrollment.completedAt = null
    const res = await POST()
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('TOUR_NOT_COMPLETE')
    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.state.updates).toHaveLength(0)
  })

  it('422 NO_LISTING_FOR_TRIAL for a supporter tester, touching nothing', async () => {
    h.state.viewer!.enrollment.listingId = null
    const res = await POST()
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('NO_LISTING_FOR_TRIAL')
    expect(h.state.log).toEqual([])
    expect(h.state.updates).toHaveLength(0)
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('422 PLAN_NOT_OPEN for a missing Starter price WITHOUT burning the claim (§4.3.2)', async () => {
    h.state.plans.starter = { id: 'plan-starter', stripe_price_id_monthly: null }
    const res = await POST()
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('PLAN_NOT_OPEN')
    // The whole point of guard-before-CAS: no update ever ran, so the one
    // claim is intact and a later request can still succeed.
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.trial_granted_at).toBeNull()
  })
})

describe('POST /api/tour/claim — the listing must still be the tester\'s', () => {
  it('403 NOT_LISTING_OWNER when someone else owns the listing now, spending nothing', async () => {
    h.state.listing = { owner_user_id: 'someone-else', deleted_at: null }
    const res = await POST()
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('NOT_LISTING_OWNER')
    expect(h.state.log).toEqual(['owner-check'])
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('403 when the listing was released and has no owner', async () => {
    h.state.listing = { owner_user_id: null, deleted_at: null }
    const res = await POST()
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('NOT_LISTING_OWNER')
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('403 when the listing was deleted', async () => {
    h.state.listing = { owner_user_id: 'u1', deleted_at: '2026-10-01T00:00:00Z' }
    const res = await POST()
    expect(res.status).toBe(403)
    expect(h.state.updates).toHaveLength(0)
  })

  it('refuses a resume of an open checkout too, without reading Stripe', async () => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-08-31T00:00:00Z'
    h.state.row.trial_granted_at = '2026-08-31T00:00:00Z'
    h.state.row.stripe_checkout_session_id = 'cs_open'
    h.state.listing = { owner_user_id: 'someone-else', deleted_at: null }
    const res = await POST()
    expect(res.status).toBe(403)
    expect(h.retrieveSession).not.toHaveBeenCalled()
    expect(h.expireSession).not.toHaveBeenCalled()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('500 and nothing spent when the ownership read fails', async () => {
    h.state.listingError = { message: 'boom' }
    const res = await POST()
    expect(res.status).toBe(500)
    expect(h.state.updates).toHaveLength(0)
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('checks ownership before the live-plan check and the compare-and-set', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.state.log.indexOf('owner-check')).toBeLessThan(h.state.log.indexOf('live-check'))
    expect(h.state.log.indexOf('owner-check')).toBeLessThan(h.state.log.indexOf('cas'))
  })
})

describe('POST /api/tour/claim — an owner link with no page picks one', () => {
  const PAGE = '22222222-3333-4444-8555-666666666666'

  beforeEach(() => {
    h.state.viewer!.enrollment.listingId = null
    h.state.viewer!.enrollment.isOwner = true
    h.state.row.listing_id = null
  })

  it('writes the page and the claim in one compare-and-set, then opens the checkout on that page', async () => {
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(200)
    const cas = h.state.updates.find((u) => 'trial_granted_at' in u.payload && u.payload.trial_granted_at !== null)!
    expect(cas.payload).toEqual({ listing_id: PAGE, trial_granted_at: expect.any(String) })
    expect(cas.filters).toEqual([
      { kind: 'eq', col: 'id', val: 'enr-1' },
      { kind: 'is', col: 'trial_granted_at', val: null },
      { kind: 'is', col: 'listing_id', val: null },
    ])
    expect(h.state.row.listing_id).toBe(PAGE)
    expect(h.state.log).toEqual(['owner-check', 'live-check', 'cas', 'stripe:create', 'persist'])
    const params = h.createSession.mock.calls[0]![0] as { metadata: Record<string, string> }
    expect(params.metadata.listing_id).toBe(PAGE)
  })

  it('422 LISTING_REQUIRED without a page, touching nothing', async () => {
    const res = await POST({ plan: 'starter' })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('LISTING_REQUIRED')
    expect(h.state.log).toEqual([])
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('400 for a page id that is not a uuid', async () => {
    const res = await POST({ plan: 'starter', listingId: 'not-a-uuid' })
    expect(res.status).toBe(400)
    expect(h.state.log).toEqual([])
  })

  it.each([
    ['someone else\'s page', { owner_user_id: 'someone-else', deleted_at: null, status: 'published' }],
    ['a page that is not live yet', { owner_user_id: 'u1', deleted_at: null, status: 'pending' }],
    ['a deleted page', { owner_user_id: 'u1', deleted_at: '2026-10-01T00:00:00Z', status: 'published' }],
    ['a missing page', null],
  ])('403 for %s, spending nothing', async (_name, listing) => {
    h.state.listing = listing
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('NOT_LISTING_OWNER')
    expect(body.error).toMatch(/live page you own/)
    expect(h.state.log).toEqual(['owner-check'])
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.listing_id).toBeNull()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('409 LISTING_TRIAL_USED when the page already had a tester month, and Stripe is never called', async () => {
    h.state.casError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "tour_enrollments_one_trial_per_listing_idx"',
    }
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('LISTING_TRIAL_USED')
    expect(h.state.row.listing_id).toBeNull()
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('409 ALREADY_CLAIMED when the per-tester index fires', async () => {
    h.state.casError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "tour_enrollments_one_trial_per_tester_idx"',
    }
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_CLAIMED')
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('500 for any other compare-and-set error', async () => {
    h.state.casError = { code: '40001', message: 'could not serialize access' }
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(500)
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('409 when another request attached a page first', async () => {
    h.state.row.listing_id = 'l-other'
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_CLAIMED')
    expect(h.state.row.listing_id).toBe('l-other')
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('keeps the page when Stripe fails and only the claim is released', async () => {
    h.createSession.mockRejectedValueOnce(new Error('stripe down'))
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(500)
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.state.row.listing_id).toBe(PAGE)
  })

  it('a supporter tester still gets NO_LISTING_FOR_TRIAL even when naming a page', async () => {
    h.state.viewer!.enrollment.isOwner = false
    const res = await POST({ plan: 'starter', listingId: PAGE })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('NO_LISTING_FOR_TRIAL')
    expect(h.state.log).toEqual([])
  })
})

describe('POST /api/tour/claim — an enrollment with a listing', () => {
  it('accepts its own listing named in the body', async () => {
    const res = await POST({ plan: 'starter', listingId: '33333333-4444-4555-8666-777777777777' })
    expect(res.status).toBe(400)
    h.state.viewer!.enrollment.listingId = '33333333-4444-4555-8666-777777777777'
    h.state.row.listing_id = '33333333-4444-4555-8666-777777777777'
    const ok = await POST({ plan: 'starter', listingId: '33333333-4444-4555-8666-777777777777' })
    expect(ok.status).toBe(200)
  })

  it('never rewrites the listing in the compare-and-set', async () => {
    await POST({ plan: 'starter' })
    const cas = h.state.updates.find((u) => 'trial_granted_at' in u.payload)!
    expect(cas.payload).toEqual({ trial_granted_at: expect.any(String) })
    expect(cas.filters.some((f) => f.col === 'listing_id')).toBe(false)
  })
})

describe('POST /api/tour/claim — trial vs paid', () => {
  it('a paying page asks for the next tier up, and waits WITHOUT burning the claim while it is closed', async () => {
    h.state.liveSubs = [{ stripe_subscription_id: 'sub_1' }]
    h.retrieveSubscription.mockResolvedValue(liveStarter())
    const res = await POST()
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('PLAN_NOT_OPEN')
    expect(body.error).toMatch(/^Growth isn’t open yet/)
    // The guard runs before the compare-and-set, so the claim is intact and
    // Stripe was never asked to change anything.
    expect(h.state.log).not.toContain('cas')
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.createSchedule).not.toHaveBeenCalled()
  })

  it('runs the live-plan check before the compare-and-set', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.state.log.indexOf('live-check')).toBeLessThan(h.state.log.indexOf('cas'))
  })

  it('a recovery-path claim goes on the plan when the listing picked one up meanwhile', async () => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-08-31T00:00:00Z'
    h.state.row.trial_granted_at = '2026-08-31T00:00:00Z'
    openGrowth()
    h.state.liveSubs = [{ stripe_subscription_id: 'sub_1' }]
    h.retrieveSubscription.mockResolvedValue(liveStarter())
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: FREE_MONTH_STARTED_URL } })
    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.state.row.stripe_subscription_schedule_id).toBe('sub_sched_1')
    // Keyed on the stored claim, so a retry reaches the same schedule.
    expect(h.createSchedule.mock.calls[0]![1]).toEqual({
      idempotencyKey: 'tour-upgrade:enr-1:2026-08-31T00:00:00.000Z',
    })
  })
})

describe('POST /api/tour/claim — the claim protocol', () => {
  it('claims via compare-and-set BEFORE calling Stripe (ordered log)', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.state.log.indexOf('cas')).toBeLessThan(h.state.log.indexOf('stripe:create'))
  })

  it('two concurrent claims → one 200, one 409, createSession called exactly once', async () => {
    const [a, b] = await Promise.all([POST(), POST()])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(h.createSession).toHaveBeenCalledTimes(1)
    const loser = a.status === 409 ? a : b
    expect((await loser.json()).code).toBe('ALREADY_CLAIMED')
  })

  it('uses the stable idempotency key tour-trial:<enrollmentId>', async () => {
    await POST()
    expect(h.createSession.mock.calls[0]![1]).toEqual({ idempotencyKey: 'tour-trial:enr-1' })
  })

  it('returns the enveloped checkout url and persists the session id', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: 'https://checkout.stripe.test/tour' } })
    expect(h.state.row.stripe_checkout_session_id).toBe('cs_tour_1')
    expect(h.state.log.indexOf('stripe:create')).toBeLessThan(h.state.log.indexOf('persist'))
  })

  it('sends Stripe the real trial params: 30 days, cancel on missing card, no purpose key', async () => {
    await POST()
    const args = h.createSession.mock.calls[0]![0]
    // These passed the REAL assertTrialCancels on the way here.
    expect(args.subscription_data.trial_period_days).toBe(30)
    expect(args.subscription_data.trial_settings.end_behavior.missing_payment_method).toBe('cancel')
    expect(args.payment_method_collection).toBe('if_required')
    // No `purpose` key on either metadata — webhookHandlers.ts must treat this
    // as an ordinary Starter subscription (spec §4.2).
    expect('purpose' in args.metadata).toBe(false)
    expect('purpose' in args.subscription_data.metadata).toBe(false)
    expect(args.metadata.plan_slug).toBe('starter')
    expect(args.subscription_data.metadata.listing_id).toBe('l1')
    expect(args.customer_email).toBe('tester@example.com')
    expect(args.payment_method_types).toBeUndefined()
  })
})

describe('POST /api/tour/claim — release on failure', () => {
  it('releases the claim when Stripe throws, guarded by timestamp and null session id', async () => {
    h.createSession.mockImplementation(async () => {
      h.state.log.push('stripe:create')
      throw new Error('stripe down')
    })
    const res = await POST()
    expect(res.status).toBe(500)

    // The release ran, after the failed create…
    expect(h.state.log).toEqual(['owner-check', 'live-check', 'cas', 'stripe:create', 'release'])
    // …and actually returned the row to claimable.
    expect(h.state.row.trial_granted_at).toBeNull()

    // The guard: it releases ONLY the exact timestamp this request wrote and
    // only while no session id is persisted (§4.3.4).
    const release = h.state.updates.find((u) => u.payload.trial_granted_at === null)!
    const cas = h.state.updates.find(
      (u) => typeof u.payload.trial_granted_at === 'string'
    )!
    expect(release.filters).toContainEqual({
      kind: 'eq',
      col: 'trial_granted_at',
      val: cas.payload.trial_granted_at,
    })
    expect(release.filters).toContainEqual({
      kind: 'is',
      col: 'stripe_checkout_session_id',
      val: null,
    })
  })

  it('a release cannot clobber a claim whose session id was already persisted', async () => {
    // Simulate the wedge: this request's create fails, but by release time the
    // row carries a session id (e.g. a concurrent recovery consummated it).
    h.createSession.mockImplementation(async () => {
      h.state.log.push('stripe:create')
      h.state.row.stripe_checkout_session_id = 'cs_from_elsewhere'
      throw new Error('stripe down')
    })
    const res = await POST()
    expect(res.status).toBe(500)
    // The `.is('stripe_checkout_session_id', null)` guard made the release a
    // no-op — the consummated claim stands.
    expect(h.state.row.trial_granted_at).not.toBeNull()
    expect(h.state.row.stripe_checkout_session_id).toBe('cs_from_elsewhere')
  })
})

describe('POST /api/tour/claim — already granted at entry', () => {
  beforeEach(() => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-08-31T00:00:00Z'
    h.state.row.trial_granted_at = '2026-08-31T00:00:00Z'
  })

  it('resumes a still-open checkout session instead of dead-ending', async () => {
    h.state.row.stripe_checkout_session_id = 'cs_prior'
    h.retrieveSession.mockResolvedValue({
      status: 'open',
      url: 'https://checkout.stripe.test/resume',
    })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: 'https://checkout.stripe.test/resume' } })
    expect(h.retrieveSession).toHaveBeenCalledWith('cs_prior')
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('409 ALREADY_CLAIMED when the prior session completed', async () => {
    h.state.row.stripe_checkout_session_id = 'cs_prior'
    h.retrieveSession.mockResolvedValue({ status: 'complete', url: null })
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_CLAIMED')
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('creates a fresh session when the prior one expired', async () => {
    h.state.row.stripe_checkout_session_id = 'cs_prior'
    h.retrieveSession.mockResolvedValue({ status: 'expired', url: null })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.createSession).toHaveBeenCalledTimes(1)
    // No second compare-and-set on the recovery path.
    expect(h.state.log).not.toContain('cas')
    expect(h.state.row.stripe_checkout_session_id).toBe('cs_tour_1')
    // Keyed on the session it replaces, so Stripe can't hand back the dead one.
    expect(h.createSession.mock.calls[0]![1]).toEqual({
      idempotencyKey: 'tour-trial:enr-1:cs_prior',
    })
  })

  it('recovers a claim whose session was never persisted (lost response)', async () => {
    // trial_granted_at set, session id null: a prior attempt crashed between
    // Stripe and the persist. The idempotency key hands back the same session.
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: 'https://checkout.stripe.test/tour' } })
    expect(h.createSession).toHaveBeenCalledTimes(1)
    expect(h.createSession.mock.calls[0]![1]).toEqual({ idempotencyKey: 'tour-trial:enr-1' })
    expect(h.state.log).not.toContain('cas')
    // And never a release — this request performed no compare-and-set.
    expect(h.state.log).not.toContain('release')
  })

  it('does not release on a recovery-path Stripe failure (it owns no claim)', async () => {
    h.createSession.mockRejectedValue(new Error('stripe down'))
    const res = await POST()
    expect(res.status).toBe(500)
    expect(h.state.log).not.toContain('release')
    expect(h.state.row.trial_granted_at).toBe('2026-08-31T00:00:00Z')
  })
})

describe('POST /api/tour/claim — the request body', () => {
  it('400 on a body that is not JSON, touching nothing', async () => {
    const res = await POST('{not json')
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
    expect(h.state.updates).toHaveLength(0)
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('400 on a tier that is not a paid tier', async () => {
    const res = await POST({ plan: 'free' })
    expect(res.status).toBe(400)
    expect(h.state.updates).toHaveLength(0)
  })

  it('400 on an unknown key', async () => {
    const res = await POST({ plan: 'starter', trial_days: 300 })
    expect(res.status).toBe(400)
    expect(h.state.updates).toHaveLength(0)
  })

  it('no plan named lands a fresh claim on Starter', async () => {
    await POST({})
    expect(h.createSession.mock.calls[0]![0].metadata.plan_slug).toBe('starter')
  })
})

describe('POST /api/tour/claim — any paid tier (founder, 2026-10-10)', () => {
  it('checks out on the tier the tester picked, with that tier’s price', async () => {
    h.state.plans.growth = { id: 'plan-growth', stripe_price_id_monthly: 'price_growth_monthly' }
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.line_items).toEqual([{ price: 'price_growth_monthly', quantity: 1 }])
    expect(args.metadata.plan_slug).toBe('growth')
    expect(args.metadata.plan_id).toBe('plan-growth')
    expect(args.subscription_data.metadata.plan_slug).toBe('growth')
    // Same safety on every tier: these passed the real assertTrialCancels.
    expect(args.subscription_data.trial_settings.end_behavior.missing_payment_method).toBe('cancel')
    // The first-session key carries no tier.
    expect(h.createSession.mock.calls[0]![1]).toEqual({ idempotencyKey: 'tour-trial:enr-1' })
  })

  it.each(['growth', 'premium'] as const)(
    '422 PLAN_NOT_OPEN for %s before it opens, and the month keeps waiting',
    async (plan) => {
      const res = await POST({ plan })
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.code).toBe('PLAN_NOT_OPEN')
      expect(body.error).toMatch(/free month will wait/)
      expect(h.state.updates).toHaveLength(0)
      expect(h.state.row.trial_granted_at).toBeNull()
      expect(h.createSession).not.toHaveBeenCalled()
    }
  )

  it('a held month can still be used on Starter after a Growth refusal', async () => {
    expect((await POST({ plan: 'growth' })).status).toBe(422)
    const res = await POST({ plan: 'starter' })
    expect(res.status).toBe(200)
    expect(h.createSession).toHaveBeenCalledTimes(1)
  })

  it('a tester already paying gets the month on the bigger plan, with no checkout (ticket 136)', async () => {
    openGrowth()
    h.state.liveSubs = [{ stripe_subscription_id: 'sub_1' }]
    h.retrieveSubscription.mockResolvedValue(liveStarter())
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: FREE_MONTH_STARTED_URL } })
    expect(h.createSession).not.toHaveBeenCalled()
  })
})

describe('POST /api/tour/claim — switching tiers on an open checkout', () => {
  beforeEach(() => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-08-31T00:00:00Z'
    h.state.row.trial_granted_at = '2026-08-31T00:00:00Z'
    h.state.row.stripe_checkout_session_id = 'cs_prior'
    h.state.plans.growth = { id: 'plan-growth', stripe_price_id_monthly: 'price_growth_monthly' }
    h.retrieveSession.mockResolvedValue({
      status: 'open',
      url: 'https://checkout.stripe.test/resume',
      metadata: { plan_slug: 'starter' },
    })
  })

  it('same tier hands back the open checkout', async () => {
    const res = await POST({ plan: 'starter' })
    expect(await res.json()).toEqual({ data: { url: 'https://checkout.stripe.test/resume' } })
    expect(h.expireSession).not.toHaveBeenCalled()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('a new tier closes the old checkout first, then opens one keyed on it', async () => {
    h.expireSession.mockImplementation(async () => {
      h.state.log.push('stripe:expire')
      return { id: 'cs_prior', status: 'expired' }
    })
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(h.expireSession).toHaveBeenCalledWith('cs_prior')
    expect(h.state.log.indexOf('stripe:expire')).toBeLessThan(h.state.log.indexOf('stripe:create'))
    expect(h.createSession.mock.calls[0]![0].metadata.plan_slug).toBe('growth')
    expect(h.createSession.mock.calls[0]![1]).toEqual({
      idempotencyKey: 'tour-trial:enr-1:cs_prior',
    })
    expect(h.state.log).not.toContain('cas')
  })

  it('opens nothing new when the old checkout cannot be closed', async () => {
    h.expireSession.mockRejectedValue(new Error('already complete'))
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(500)
    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.state.row.stripe_checkout_session_id).toBe('cs_prior')
  })

  it('does not close the old checkout when the new tier is not open', async () => {
    const res = await POST({ plan: 'premium' })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('PLAN_NOT_OPEN')
    expect(h.expireSession).not.toHaveBeenCalled()
  })

  it('a resume with no tier named stays on the tier of an expired checkout', async () => {
    h.state.plans.growth = { id: 'plan-growth', stripe_price_id_monthly: 'price_growth_monthly' }
    h.retrieveSession.mockResolvedValue({
      status: 'expired',
      url: null,
      metadata: { plan_slug: 'growth' },
    })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.createSession.mock.calls[0]![0].metadata.plan_slug).toBe('growth')
  })
})

describe('POST /api/tour/claim — the month on a page that pays (ticket 136)', () => {
  beforeEach(() => {
    openGrowth()
    h.state.liveSubs = [{ stripe_subscription_id: 'sub_1' }]
    h.retrieveSubscription.mockResolvedValue(liveStarter())
  })

  it('claims first, then makes the schedule, records it, and sets the phases', async () => {
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(h.state.log).toEqual([
      'owner-check',
      'live-check',
      'cas',
      'schedule:create',
      'persist-schedule',
      'schedule:update',
    ])
    expect(h.createSchedule.mock.calls[0]![0]).toEqual({ from_subscription: 'sub_1' })
    expect(h.state.row.stripe_subscription_schedule_id).toBe('sub_sched_1')
    expect(h.state.row.upgrade_trial_ends_at).toBe(new Date((NOW + 30 * DAY) * 1000).toISOString())
  })

  it('asks Stripe for 30 free days of Growth, then Starter again, with no proration', async () => {
    await POST({ plan: 'growth' })
    const [id, params, opts] = h.updateSchedule.mock.calls[0]!
    expect(id).toBe('sub_sched_1')
    expect(opts).toEqual({ idempotencyKey: 'tour-upgrade:sub_sched_1:growth' })
    expect(params.end_behavior).toBe('release')
    expect(params.proration_behavior).toBe('none')
    expect(params.metadata.tour_phases).toBe('set')
    const [now, trial, back] = params.phases
    expect(now).toMatchObject({ start_date: NOW - 10 * DAY, end_date: 'now' })
    expect(trial).toMatchObject({
      items: [{ price: 'price_growth_monthly', quantity: 1 }],
      trial: true,
      duration: { interval: 'day', interval_count: 30 },
      proration_behavior: 'none',
    })
    expect(trial.metadata).toMatchObject({ listing_id: 'l1', plan_slug: 'growth', plan_id: 'plan-growth' })
    expect(back).toMatchObject({
      items: [{ price: 'price_starter_monthly', quantity: 1 }],
      billing_cycle_anchor: 'phase_start',
      proration_behavior: 'none',
    })
    expect(back.metadata).toMatchObject({ plan_slug: 'starter', plan_id: 'plan-starter' })
    for (const p of params.phases) expect('purpose' in (p.metadata ?? {})).toBe(false)
  })

  it.each([
    ['an annual plan', { items: { data: [{ price: { id: 'price_starter_annual', recurring: { interval: 'year', interval_count: 1 } } }] } }, 409, 'NOT_MONTHLY'],
    ['a payment past due', { status: 'past_due' }, 409, 'PAYMENT_PAST_DUE'],
    ['a plan set to end', { cancel_at_period_end: true }, 409, 'PLAN_ENDING'],
    ['a plan in its own trial', { status: 'trialing' }, 409, 'PLAN_TRIALING'],
  ])('refuses %s WITHOUT spending the month', async (_label, over, status, code) => {
    h.retrieveSubscription.mockResolvedValue(liveStarter(over))
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(status)
    expect((await res.json()).code).toBe(code)
    expect(h.state.log).not.toContain('cas')
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.createSchedule).not.toHaveBeenCalled()
  })

  it('refuses two live plans on one page', async () => {
    h.state.liveSubs = [{ stripe_subscription_id: 'sub_1' }, { stripe_subscription_id: 'sub_2' }]
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('MULTIPLE_PLANS')
    expect(h.retrieveSubscription).not.toHaveBeenCalled()
    expect(h.state.row.trial_granted_at).toBeNull()
  })

  it('refuses a tier that is not above the one the page has', async () => {
    const res = await POST({ plan: 'starter' })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('NOT_AN_UPGRADE')
    expect(h.state.row.trial_granted_at).toBeNull()
  })

  it('refuses when someone else’s change is already scheduled, and gives the claim back', async () => {
    h.retrieveSubscription.mockResolvedValue(liveStarter({ schedule: 'sub_sched_other' }))
    h.retrieveSchedule.mockResolvedValue({
      ...pristineSchedule(),
      id: 'sub_sched_other',
      phases: [...pristineSchedule().phases, ...pristineSchedule().phases],
    })
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('PLAN_CHANGE_PENDING')
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.updateSchedule).not.toHaveBeenCalled()
  })

  it('adopts a pristine schedule left by a lost create instead of making a second one', async () => {
    h.retrieveSubscription.mockResolvedValue(liveStarter({ schedule: 'sub_sched_1' }))
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(h.createSchedule).not.toHaveBeenCalled()
    expect(h.updateSchedule).toHaveBeenCalledTimes(1)
  })

  it('a Stripe failure before a schedule exists gives the month back', async () => {
    h.createSchedule.mockRejectedValue(new Error('stripe down'))
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(500)
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.state.row.stripe_subscription_schedule_id).toBeNull()
    expect(h.state.log).toContain('release')
  })

  it('a failed phase update keeps the claim, and the next click finishes the same schedule', async () => {
    h.updateSchedule.mockRejectedValueOnce(new Error('timeout'))
    const first = await POST({ plan: 'growth' })
    expect(first.status).toBe(500)
    // Never released once a schedule id is saved (see lib/tour/upgrade.ts).
    expect(h.state.row.trial_granted_at).not.toBeNull()
    expect(h.state.row.stripe_subscription_schedule_id).toBe('sub_sched_1')

    h.state.viewer!.enrollment.trialGrantedAt = h.state.row.trial_granted_at
    const second = await POST({ plan: 'growth' })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ data: { url: FREE_MONTH_STARTED_URL } })
    expect(h.createSchedule).toHaveBeenCalledTimes(1)
    expect(h.updateSchedule).toHaveBeenCalledTimes(2)
  })

  it('an update whose answer was lost but landed counts as done', async () => {
    h.updateSchedule.mockRejectedValueOnce(new Error('timeout'))
    h.retrieveSchedule.mockResolvedValue(markedSchedule())
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(h.state.row.trial_granted_at).not.toBeNull()
  })

  it('a click after the month is on sends the tester to the card, changing nothing', async () => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-10-20T00:00:00Z'
    h.state.row.trial_granted_at = '2026-10-20T00:00:00Z'
    h.state.row.stripe_subscription_schedule_id = 'sub_sched_1'
    h.retrieveSchedule.mockResolvedValue(markedSchedule())
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { url: FREE_MONTH_STARTED_URL } })
    expect(h.retrieveSubscription).not.toHaveBeenCalled()
    expect(h.updateSchedule).not.toHaveBeenCalled()
  })
})
