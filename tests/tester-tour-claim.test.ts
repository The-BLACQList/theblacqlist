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
        listingId: string
        completedAt: string | null
        trialGrantedAt: string | null
      }
    } | null,
    plan: null as Record<string, unknown> | null,
    row: {
      id: 'enr-1',
      trial_granted_at: null as string | null,
      stripe_checkout_session_id: null as string | null,
    },
    updates: [] as UpdateRecord[],
    // Ordered log of the operations that matter: 'cas', 'stripe:create',
    // 'persist', 'release'. Pushed at execution time, so ordering assertions
    // reflect what actually ran first.
    log: [] as string[],
  }

  const resolveTourViewer = vi.fn(async () => state.viewer)
  const createSession = vi.fn()
  const retrieveSession = vi.fn()

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
        async maybeSingle() {
          if (q.table === 'plans') return { data: state.plan, error: null }
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
          return Promise.resolve(runUpdate(q)).then(onFulfilled, onRejected)
        },
      }
      return q
    },
  }))

  return { state, resolveTourViewer, createSession, retrieveSession, createServiceClient }
})

vi.mock('@/lib/tour/witness', () => ({ resolveTourViewer: h.resolveTourViewer }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: { sessions: { create: h.createSession, retrieve: h.retrieveSession } },
  },
}))

import { POST } from '@/app/api/tour/claim/route'

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
  h.state.plan = { id: 'plan-starter', stripe_price_id_monthly: 'price_starter_monthly' }
  h.state.row = { id: 'enr-1', trial_granted_at: null, stripe_checkout_session_id: null }
  h.state.updates = []
  h.state.log = []
  h.createSession.mockImplementation(async () => {
    h.state.log.push('stripe:create')
    return { id: 'cs_tour_1', url: 'https://checkout.stripe.test/tour' }
  })
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
})

describe('POST /api/tour/claim — gates before the claim', () => {
  it('404 when the viewer does not resolve (flag off / signed out / not enrolled)', async () => {
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

  it('422 for a missing Starter price WITHOUT burning the claim (§4.3.2)', async () => {
    h.state.plan = { id: 'plan-starter', stripe_price_id_monthly: null }
    const res = await POST()
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('UNPROCESSABLE')
    // The whole point of guard-before-CAS: no update ever ran, so the one
    // claim is intact and a later request can still succeed.
    expect(h.state.updates).toHaveLength(0)
    expect(h.state.row.trial_granted_at).toBeNull()
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
    expect(h.state.log).toEqual(['cas', 'stripe:create', 'release'])
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
