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
        completedAt: string | null
        trialGrantedAt: string | null
      }
    } | null,
    // Active plan rows by plan_key, as the plan guard sees them.
    plans: {} as Record<string, Record<string, unknown> | null>,
    row: {
      id: 'enr-1',
      trial_granted_at: null as string | null,
      stripe_checkout_session_id: null as string | null,
    },
    // subscriptions rows the live-plan guard sees for the listing.
    liveSubs: [] as { id: string }[],
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

  function runUpdate(q: { table: string; payload: Record<string, unknown>; filters: Filter[]; wantsRows: boolean }) {
    state.updates.push({ table: q.table, payload: q.payload, filters: q.filters })
    if ('trial_granted_at' in q.payload) {
      state.log.push(q.payload.trial_granted_at === null ? 'release' : 'cas')
    } else if ('stripe_checkout_session_id' in q.payload) {
      state.log.push('persist')
    }

    const row = state.row as unknown as Record<string, unknown>
    const matches = q.filters.every((f) =>
      f.kind === 'is' ? row[f.col] === f.val : row[f.col] === f.val
    )
    if (matches) Object.assign(row, q.payload)
    return { data: q.wantsRows ? (matches ? [{ id: state.row.id }] : []) : null, error: null }
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
            const key = q.filters.find((f) => f.col === 'plan_key')?.val as string
            return { data: state.plans[key] ?? null, error: null }
          }
          if (q.table === 'tour_enrollments') {
            return {
              data: { stripe_checkout_session_id: state.row.stripe_checkout_session_id },
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
          onFulfilled?: (v: { data: unknown; error: null }) => unknown,
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

  return { state, resolveTrialClaimer, createSession, retrieveSession, expireSession, createServiceClient }
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
  },
}))

import { POST as claimRoute } from '@/app/api/tour/claim/route'

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
  h.state.row = { id: 'enr-1', trial_granted_at: null, stripe_checkout_session_id: null }
  h.state.liveSubs = []
  h.state.updates = []
  h.state.log = []
  h.createSession.mockImplementation(async () => {
    h.state.log.push('stripe:create')
    return { id: 'cs_tour_1', url: 'https://checkout.stripe.test/tour' }
  })
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

describe('POST /api/tour/claim — trial vs paid', () => {
  it('409 ALREADY_SUBSCRIBED when the listing already has a live plan, WITHOUT burning the claim', async () => {
    h.state.liveSubs = [{ id: 'sub-row-1' }]
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_SUBSCRIBED')
    // The guard runs before the compare-and-set, so the claim is intact and
    // Stripe was never called.
    expect(h.state.log).not.toContain('cas')
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.trial_granted_at).toBeNull()
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('runs the live-plan check before the compare-and-set', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.state.log.indexOf('live-check')).toBeLessThan(h.state.log.indexOf('cas'))
  })

  it('refuses a recovery-path trial too when the listing picked up a plan meanwhile', async () => {
    h.state.viewer!.enrollment.trialGrantedAt = '2026-08-31T00:00:00Z'
    h.state.row.trial_granted_at = '2026-08-31T00:00:00Z'
    h.state.liveSubs = [{ id: 'sub-row-1' }]
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_SUBSCRIBED')
    expect(h.createSession).not.toHaveBeenCalled()
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
    expect(h.state.log).toEqual(['live-check', 'cas', 'stripe:create', 'release'])
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

  it('a tester already paying is refused WITHOUT spending the month (saved for ticket 136)', async () => {
    h.state.plans.growth = { id: 'plan-growth', stripe_price_id_monthly: 'price_growth_monthly' }
    h.state.liveSubs = [{ id: 'sub-row-1' }]
    const res = await POST({ plan: 'growth' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ALREADY_SUBSCRIBED')
    expect(body.error).toMatch(/saving your free month/)
    expect(h.state.log).not.toContain('cas')
    expect(h.state.row.trial_granted_at).toBeNull()
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
