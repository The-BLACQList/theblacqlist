import { describe, it, expect, vi, beforeEach } from 'vitest'

// Direct regression test for handleSubscriptionUpsert. The whole-handler mock in
// stripe-webhook.test.ts stubs this function out, so the live-price -> plans tier
// resolution (the Finding 3 fix) has no coverage there. Here we import the REAL
// handler and feed it a hand-built fake Supabase service client.
//
// Neutralize import-time / call-time side effects:
//  - next/cache revalidatePath (no Next runtime in the test)
//  - @/lib/email/resend sendEmail (payment-failed path only, but the module imports it)
//  - @/lib/audit/system writeSystemAuditLog (hoisted so we can assert the afterState)
const h = vi.hoisted(() => {
  const writeSystemAuditLog = vi.fn(async () => {})

  // Per-test state: what plans.maybeSingle resolves to.
  const state: { planRow: Record<string, unknown> | null } = { planRow: null }

  // Captured writes, so tests can assert what the handler tried to persist.
  const captured: {
    listingUpdate: Record<string, unknown> | null
    subscriptionUpsert: Record<string, unknown> | null
  } = { listingUpdate: null, subscriptionUpsert: null }

  return { writeSystemAuditLog, state, captured }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import { handleSubscriptionUpsert } from '@/lib/services/billing/webhookHandlers'
import type Stripe from 'stripe'

// A minimal awaitable, table-aware fake of the Supabase service client. Chainable
// filter methods return the builder; terminal reads resolve via maybeSingle; writes
// (upsert / update+eq) are awaited directly, so the builder is itself thenable.
function makeFakeClient() {
  function from(table: string) {
    let pendingWrite: { op: 'upsert' | 'update'; row: Record<string, unknown> } | null = null

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => (pendingWrite ? Promise.resolve({ data: null, error: null }) : builder),
      or: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      upsert: (row: Record<string, unknown>) => {
        h.captured.subscriptionUpsert = row
        return Promise.resolve({ data: null, error: null })
      },
      update: (row: Record<string, unknown>) => {
        if (table === 'listings') h.captured.listingUpdate = row
        pendingWrite = { op: 'update', row }
        return builder
      },
      maybeSingle: async () => {
        if (table === 'plans') return { data: h.state.planRow, error: null }
        if (table === 'listings') {
          // Serves both the prevTier read (.tier) and revalidateListingPage
          // (.status / .slug / .entity_type / .cities). status !== 'published'
          // keeps revalidatePath a no-op regardless.
          return {
            data: { tier: 'growth', status: 'draft', slug: null, entity_type: 'business', cities: null },
            error: null,
          }
        }
        return { data: null, error: null }
      },
    }
    return builder
  }
  return { from } as unknown as Parameters<typeof handleSubscriptionUpsert>[0]
}

// A subscription whose LIVE price is premium-yearly, but whose metadata is stale
// (checkout-time 'growth') — exactly the Customer Portal in-place switch that
// Finding 3 describes.
function makeSub(livePriceId: string): Stripe.Subscription {
  return {
    id: 'sub_test',
    status: 'active',
    customer: 'cus_test',
    canceled_at: null,
    metadata: {
      user_id: 'u1',
      listing_id: 'l1',
      plan_id: 'plan_growth',
      plan_slug: 'growth',
      billing_cycle: 'monthly',
    },
    items: {
      data: [
        {
          price: { id: livePriceId } as Stripe.Price,
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_600_000,
        },
      ],
    },
  } as unknown as Stripe.Subscription
}

const PREMIUM_ROW = {
  id: 'plan_premium',
  plan_key: 'premium',
  stripe_price_id_monthly: 'price_prem_monthly',
  stripe_price_id_yearly: 'price_prem_yearly',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.planRow = null
  h.captured.listingUpdate = null
  h.captured.subscriptionUpsert = null
})

describe('handleSubscriptionUpsert — tier follows the live price (Finding 3)', () => {
  it('syncs the listing to premium when the live price is premium, despite stale growth metadata', async () => {
    h.state.planRow = PREMIUM_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))

    // Listing tier follows the resolved live price, not the stale metadata.
    expect(h.captured.listingUpdate).toEqual({ tier: 'premium' })
    // Subscription row records the resolved plan id.
    expect(h.captured.subscriptionUpsert?.plan_id).toBe('plan_premium')
    // Audit reflects the resolved plan + annual cycle (matched the yearly price).
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({
          tier: 'premium',
          plan_slug: 'premium',
          billing_cycle: 'annual',
        }),
      })
    )
  })

  it('falls back to metadata tier when the live price matches no plans row', async () => {
    h.state.planRow = null // price not found in `plans`
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_unknown'))

    // With no matching plan, the handler keeps the checkout-time metadata tier.
    expect(h.captured.listingUpdate).toEqual({ tier: 'growth' })
    expect(h.captured.subscriptionUpsert?.plan_id).toBe('plan_growth')
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({ tier: 'growth', plan_slug: 'growth' }),
      })
    )
  })
})
