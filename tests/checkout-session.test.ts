import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const createSession = vi.fn()
  const state: {
    user: { id: string; email: string } | null
    listing: Record<string, unknown> | null
    plan: Record<string, unknown> | null
  } = { user: null, listing: null, plan: null }

  const createClient = vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: async () => ({
          data: table === 'listings' ? state.listing : table === 'plans' ? state.plan : null,
          error: null,
        }),
      }
      return builder
    },
  }))

  return { createSession, state, createClient }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: h.createSession } } },
}))

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
  h.state.listing = { id: 'l1', name: 'Test Biz' }
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
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1' }))
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
    const res = await POST(req({ planSlug: 'free', listingId: 'l1' }))
    expect(res.status).toBe(400)
  })

  it('400 for an invalid billing cycle', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1', billingCycle: 'weekly' }))
    expect(res.status).toBe(400)
  })

  it('404 when the caller does not own the listing', async () => {
    h.state.listing = null
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1' }))
    expect(res.status).toBe(404)
  })

  it('422 when the plan has no price id for the cycle', async () => {
    h.state.plan = { id: 'plan1', name: 'starter', stripe_price_id_monthly: null, stripe_price_id_yearly: null }
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1' }))
    expect(res.status).toBe(422)
  })

  it('uses the monthly price by default and records billing_cycle', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1' }))
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.line_items[0].price).toBe('price_monthly')
    expect(args.metadata.billing_cycle).toBe('monthly')
    expect(args.subscription_data.metadata.plan_slug).toBe('starter')
  })

  it('uses the yearly price when billingCycle is annual', async () => {
    const res = await POST(req({ planSlug: 'starter', listingId: 'l1', billingCycle: 'annual' }))
    expect(res.status).toBe(200)
    const args = h.createSession.mock.calls[0]![0]
    expect(args.line_items[0].price).toBe('price_yearly')
    expect(args.metadata.billing_cycle).toBe('annual')
  })

  it('never sets payment_method_types (dynamic payment methods)', async () => {
    await POST(req({ planSlug: 'starter', listingId: 'l1' }))
    const args = h.createSession.mock.calls[0]![0]
    expect(args.payment_method_types).toBeUndefined()
  })
})
