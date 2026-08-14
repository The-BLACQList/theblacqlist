import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const createPortal = vi.fn()
  const state: {
    session: { user: { id: string; email: string } } | null
    sub: Record<string, unknown> | null
    error: { message: string } | null
  } = { session: null, sub: null, error: null }

  const getOwnerSession = vi.fn(async () => state.session)

  const createClient = vi.fn(async () => ({
    from() {
      const builder = {
        select: () => builder,
        not: () => builder,
        neq: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: state.sub, error: state.error }),
      }
      return builder
    },
  }))

  return { createPortal, state, getOwnerSession, createClient }
})

vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { billingPortal: { sessions: { create: h.createPortal } } },
}))

import { createPortalSession } from '@/lib/actions/billing/createPortalSession'

beforeEach(() => {
  vi.clearAllMocks()
  h.state.session = { user: { id: 'u1', email: 'owner@example.com' } }
  h.state.sub = { stripe_customer_id: 'cus_123', listing_id: 'l1', created_at: '2026-01-01' }
  h.state.error = null
  h.createPortal.mockResolvedValue({ url: 'https://billing.stripe.test/portal' })
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
})

describe('createPortalSession', () => {
  it('returns UNAUTHORIZED when there is no session', async () => {
    h.state.session = null
    const res = await createPortalSession()
    expect(res).toEqual({ ok: false, code: 'UNAUTHORIZED', message: expect.any(String) })
    expect(h.createPortal).not.toHaveBeenCalled()
  })

  it('returns a portal url for an owner with a Stripe customer', async () => {
    const res = await createPortalSession({ listingId: 'l1' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.url).toBe('https://billing.stripe.test/portal')
    expect(h.createPortal).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.test/dashboard/upgrade',
    })
  })

  it('returns NO_CUSTOMER when the owner has no subscription', async () => {
    h.state.sub = null
    const res = await createPortalSession()
    expect(res).toMatchObject({ ok: false, code: 'NO_CUSTOMER' })
    expect(h.createPortal).not.toHaveBeenCalled()
  })

  it('returns SERVER_ERROR when the lookup errors', async () => {
    h.state.sub = null
    h.state.error = { message: 'boom' }
    const res = await createPortalSession()
    expect(res).toMatchObject({ ok: false, code: 'SERVER_ERROR' })
  })

  it('resolves the portal return_url from VERCEL_URL when NEXT_PUBLIC_APP_URL is unset', async () => {
    // The Preview scenario: no explicit app URL, only Vercel's injected host.
    // Before this action used getAppUrl(), its inline fallback pointed the
    // billing-portal return_url at http://localhost:3000.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('VERCEL_URL', 'preview-abc123.vercel.app')
    try {
      const res = await createPortalSession({ listingId: 'l1' })
      expect(res.ok).toBe(true)
      expect(h.createPortal).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://preview-abc123.vercel.app/dashboard/upgrade',
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
