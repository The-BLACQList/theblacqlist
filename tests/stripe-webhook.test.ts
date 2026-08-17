import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Stripe client (its module throws at import if STRIPE_SECRET_KEY is
// unset), the Supabase service client, and the lifecycle handlers — so we can
// test the route's signature / idempotency / dispatch / error logic in
// isolation.
const h = vi.hoisted(() => {
  const constructEvent = vi.fn()
  const handleSubscriptionUpsert = vi.fn(async () => {})
  const handleSubscriptionDeleted = vi.fn(async () => {})
  const handlePaymentFailed = vi.fn(async () => {})
  const handleCheckoutSessionCompleted = vi.fn(async () => {})

  const state: { seen: unknown; markInsertError: { code: string } | null } = {
    seen: null,
    markInsertError: null,
  }
  const inserts: { table: string; row: Record<string, unknown> }[] = []

  const createServiceClient = vi.fn(() => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: state.seen, error: null }),
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row })
          return { error: table === 'stripe_events_processed' ? state.markInsertError : null }
        },
      }
      return builder
    },
  }))

  return {
    constructEvent,
    handleSubscriptionUpsert,
    handleSubscriptionDeleted,
    handlePaymentFailed,
    handleCheckoutSessionCompleted,
    createServiceClient,
    state,
    inserts,
  }
})

vi.mock('@/lib/stripe/client', () => ({
  stripe: { webhooks: { constructEvent: h.constructEvent } },
}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/services/billing/webhookHandlers', () => ({
  handleSubscriptionUpsert: h.handleSubscriptionUpsert,
  handleSubscriptionDeleted: h.handleSubscriptionDeleted,
  handlePaymentFailed: h.handlePaymentFailed,
  handleCheckoutSessionCompleted: h.handleCheckoutSessionCompleted,
}))

import { POST } from '@/app/api/stripe/webhook/route'

function makeReq(withSignature = true): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: withSignature ? { 'stripe-signature': 'test_sig' } : {},
    body: 'raw-body',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.seen = null
  h.state.markInsertError = null
  h.inserts.length = 0
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

describe('POST /api/stripe/webhook', () => {
  it('returns 400 when the signature header is missing', async () => {
    const res = await POST(makeReq(false))
    expect(res.status).toBe(400)
    expect(h.handleSubscriptionUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 when signature verification fails', async () => {
    h.constructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const res = await POST(makeReq())
    expect(res.status).toBe(400)
  })

  it('is idempotent — a already-processed event is a no-op with 200', async () => {
    h.constructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      data: { object: {} },
    })
    h.state.seen = { id: 'existing-row' }

    const res = await POST(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.duplicate).toBe(true)
    expect(h.handleSubscriptionUpsert).not.toHaveBeenCalled()
  })

  it('dispatches subscription.created to the upsert handler and marks it processed', async () => {
    h.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1' } },
    })

    const res = await POST(makeReq())

    expect(res.status).toBe(200)
    expect(h.handleSubscriptionUpsert).toHaveBeenCalledTimes(1)
    expect(h.inserts.some((i) => i.table === 'stripe_events_processed')).toBe(true)
  })

  it('records a failed_webhook and returns 500 when a handler throws', async () => {
    h.constructEvent.mockReturnValue({
      id: 'evt_err',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1' } },
    })
    h.handleSubscriptionDeleted.mockRejectedValueOnce(new Error('db down'))

    const res = await POST(makeReq())

    expect(res.status).toBe(500)
    const failed = h.inserts.find((i) => i.table === 'failed_webhooks')
    expect(failed).toBeTruthy()
    expect(failed?.row.error_message).toBe('db down')
    expect(h.inserts.some((i) => i.table === 'stripe_events_processed')).toBe(false)
  })

  it('acknowledges unknown event types with 200 and no handler call', async () => {
    h.constructEvent.mockReturnValue({
      id: 'evt_other',
      type: 'invoice.paid',
      data: { object: {} },
    })

    const res = await POST(makeReq())

    expect(res.status).toBe(200)
    expect(h.handleSubscriptionUpsert).not.toHaveBeenCalled()
    expect(h.handlePaymentFailed).not.toHaveBeenCalled()
    // still marked processed so a redelivery short-circuits
    expect(h.inserts.some((i) => i.table === 'stripe_events_processed')).toBe(true)
  })
})
