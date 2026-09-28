import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const createSession = vi.fn()
  const checkRateLimit = vi.fn(async () => true)
  const state: {
    user: { id: string; email: string } | null
    listing: Record<string, unknown> | null
    plan: Record<string, unknown> | null
    // The live-subscription check (`.in('status', …)` then awaited).
    liveSubs: { id: string }[]
    liveError: { message: string } | null
    // The customer-reuse lookup (`subscriptions` … maybeSingle).
    priorSub: { stripe_customer_id: string } | null
  } = { user: null, listing: null, plan: null, liveSubs: [], liveError: null, priorSub: null }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        in: () => builder,
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data:
            table === 'listings'
              ? state.listing
              : table === 'plans'
                ? state.plan
                : table === 'subscriptions'
                  ? state.priorSub
                  : null,
          error: null,
        }),
        // Awaiting the chain without maybeSingle is the live-subscription check.
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === 'subscriptions'
              ? { data: state.liveError ? null : state.liveSubs, error: state.liveError }
              : { data: null, error: null }
          ),
      }
      return builder
    },
  }))

  return { createSession, checkRateLimit, state, createClient }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: h.checkRateLimit }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: h.createSession } } },
}))

const LISTING_ID = '3f1c2b9a-6d4e-4a7b-9c1d-2e5f8a0b7c64'

import { POST } from '@/app/api/stripe/create-checkout-session/route'

function req(body: unknown, raw = false): Request {
  return new Request('http://localhost/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.user = { id: 'u1', email: 'owner@example.com' }
  h.state.listing = { id: LISTING_ID, name: 'Test Biz' }
  h.state.liveSubs = []
  h.state.liveError = null
  h.state.priorSub = null
  h.checkRateLimit.mockResolvedValue(true)
  h.state.plan = {
    id: 'plan1',
    name: 'starter',
    stripe_price_id_monthly: 'price_monthly',
    stripe_price_id_yearly: 'price_yearly',
  }
  h.createSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
})

describe('POST /api/stripe/create-checkout-session', () => {
  it('401 when unauthenticated', async () => {
    h.state.user = null
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(401)
  })

  it('400 on invalid JSON body', async () => {
    const res = await POST(req('not-json', true))
    expect(res.status).toBe(400)
  })

  it('400 when planSlug or listingId is missing', async () => {
    const res = await POST(req({ planSlug: 'starter' }))
    expect(res.status).toBe(400)
  })

  it('400 for a non-paid plan slug', async () => {
    const res = await POST(req({ planSlug: 'free', listingId: LISTING_ID }))
    expect(res.status).toBe(400)
  })

  it('400 for an invalid billing cycle', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID, billingCycle: 'weekly' }))
    expect(res.status).toBe(400)
  })

  it('404 when the caller does not own the listing', async () => {
    h.state.listing = null
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(404)
  })

  it('422 when the plan has no price id for the cycle', async () => {
    h.state.plan = { id: 'plan1', name: 'starter', stripe_price_id_monthly: null, stripe_price_id_yearly: null }
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(422)
  })

  it('uses the monthly price by default and records billing_cycle', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.line_items[0].price).toBe('price_monthly')
    expect(args.metadata.billing_cycle).toBe('monthly')
    expect(args.subscription_data.metadata.plan_slug).toBe('starter')
  })

  it('uses the yearly price when billingCycle is annual', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID, billingCycle: 'annual' }))
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.line_items[0].price).toBe('price_yearly')
    expect(args.metadata.billing_cycle).toBe('annual')
  })

  it('never sets payment_method_types (dynamic payment methods)', async () => {
    await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    const args = h.createSession.mock.calls[0]![0]
    expect(args.payment_method_types).toBeUndefined()
  })

  it('resolves Stripe redirect URLs from VERCEL_URL when NEXT_PUBLIC_APP_URL is unset', async () => {
    // The Preview scenario: no explicit app URL, only Vercel's injected host.
    // Before this route used getAppUrl(), its inline fallback sent the
    // checkout success/cancel redirect to http://localhost:3000 — the tester's
    // own machine. This is the test that would have caught that.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('VERCEL_URL', 'preview-abc123.vercel.app')
    try {
      const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
      expect(res.status).toBe(200)
      const args = h.createSession.mock.calls[0]![0]
      expect(args.success_url).toBe(
        'https://preview-abc123.vercel.app/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}'
      )
      expect(args.cancel_url).toBe('https://preview-abc123.vercel.app/dashboard/upgrade')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('400 when the body carries a price or amount (tampered request)', async () => {
    for (const extra of [{ price: 'price_cheap' }, { amount: 1 }, { priceId: 'price_cheap' }]) {
      const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID, ...extra }))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('400 when listingId is not a uuid', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1' }))
    expect(res.status).toBe(400)
  })

  it('429 when the caller is over the checkout rate limit', async () => {
    h.checkRateLimit.mockResolvedValue(false)
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect(h.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'checkout', identifier: 'u1' })
    )
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('409 when the listing already has a live subscription', async () => {
    h.state.liveSubs = [{ id: 'sub-row-1' }]
    const res = await POST(req({ planSlug: 'growth', listingId: LISTING_ID }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'SUBSCRIPTION_EXISTS' })
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('500 when the live-subscription check errors, without creating a session', async () => {
    h.state.liveError = { message: 'boom' }
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(500)
    expect(h.createSession).not.toHaveBeenCalled()
  })

  it('reuses the caller\'s existing Stripe customer instead of minting a new one', async () => {
    h.state.priorSub = { stripe_customer_id: 'cus_existing' }
    const res = await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.customer).toBe('cus_existing')
    expect(args.customer_email).toBeUndefined()
  })

  it('falls back to customer_email when the caller has no Stripe customer yet', async () => {
    await POST(req({ planSlug: 'starter', listingId: LISTING_ID }))
    const args = h.createSession.mock.calls[0]![0]
    expect(args.customer).toBeUndefined()
    expect(args.customer_email).toBe('owner@example.com')
  })
})
