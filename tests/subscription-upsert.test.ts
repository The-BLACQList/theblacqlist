import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Direct regression test for the subscription lifecycle handlers. The
// whole-handler mock in stripe-webhook.test.ts stubs these functions out, so the
// live-price -> plans tier resolution (the Finding 3 fix) has no coverage there.
// Here we import the REAL handlers and feed them a hand-built fake Supabase
// service client.
//
// The file name predates the second describe block: it now covers
// handleSubscriptionDeleted as well, because the two handlers share the tier
// write and its failure posture, and splitting them would duplicate the fake.
//
// What the second block exists for (E-7): the tier writes used to discard both
// the error and the matched-row count, and the audit log was written
// unconditionally afterwards. That meant a failed or no-op downgrade still
// produced an audit row asserting the new tier — a log that reads as evidence of
// something that never happened. Since the audit log is the only durable record
// a human could ever check, the verification was unverifiable. These tests pin
// the two failure modes apart:
//
//   error     → throw, so the route records a `failed_webhooks` row and Stripe
//               genuinely retries
//   zero rows → do NOT throw (retrying can't resurrect a deleted listing), log a
//               distinct signature, and record the audit row honestly
//
// Vitest runs `environment: 'node'` with no Supabase available, so the client is
// a fake that records its calls — the right instrument here, since what's being
// asserted is which calls the handler makes and how it reacts to their results.
//
// Neutralize import-time / call-time side effects:
//  - next/cache revalidatePath (no Next runtime in the test)
//  - @/lib/email/resend sendEmail (payment-failed path only, but the module imports it)
//  - @/lib/audit/system writeSystemAuditLog (hoisted so we can assert the afterState)
const h = vi.hoisted(() => {
  // Typed on the one field these tests read back, so `.mock.calls[0][0]` is a
  // real object rather than a never-indexable empty tuple.
  const writeSystemAuditLog = vi.fn(async (_entry: { afterState: Record<string, unknown> }) => {})

  // Per-test state: what plans.maybeSingle resolves to, and how the two write
  // paths behave. Defaults are the happy path, so existing cases are unaffected.
  const state: {
    planRow: Record<string, unknown> | null
    tierWriteError: { message: string } | null
    tierWriteMatches: boolean
    subscriptionWriteError: { message: string } | null
  } = {
    planRow: null,
    tierWriteError: null,
    tierWriteMatches: true,
    subscriptionWriteError: null,
  }

  // Captured writes, so tests can assert what the handler tried to persist.
  const captured: {
    listingUpdate: Record<string, unknown> | null
    subscriptionUpsert: Record<string, unknown> | null
    subscriptionUpdate: Record<string, unknown> | null
  } = { listingUpdate: null, subscriptionUpsert: null, subscriptionUpdate: null }

  return { writeSystemAuditLog, state, captured }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import { handleSubscriptionUpsert, handleSubscriptionDeleted } from '@/lib/services/billing/webhookHandlers'
import type Stripe from 'stripe'

// A minimal awaitable, table-aware fake of the Supabase service client.
//
// Reads are chains ending in `.maybeSingle()`. Writes are `upsert(...)` or
// `update(...).eq(...)`, optionally followed by `.select('id')` — so the builder
// is itself thenable and resolves to the write result. Every read path in the
// handler terminates in `.maybeSingle()`, so nothing ever awaits the builder by
// accident.
function makeFakeClient() {
  function from(table: string) {
    const settleWrite = () => {
      if (table === 'listings') {
        if (h.state.tierWriteError) return { data: null, error: h.state.tierWriteError }
        // `.select('id')` returns the matched rows; an empty array is a filtered
        // UPDATE that matched nothing, which Postgres reports without an error.
        return { data: h.state.tierWriteMatches ? [{ id: 'l1' }] : [], error: null }
      }
      if (table === 'subscriptions') {
        return { data: null, error: h.state.subscriptionWriteError }
      }
      return { data: null, error: null }
    }

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      or: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      upsert: (row: Record<string, unknown>) => {
        if (table === 'subscriptions') h.captured.subscriptionUpsert = row
        return Promise.resolve({ data: null, error: h.state.subscriptionWriteError })
      },
      update: (row: Record<string, unknown>) => {
        if (table === 'listings') h.captured.listingUpdate = row
        if (table === 'subscriptions') h.captured.subscriptionUpdate = row
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
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(settleWrite()).then(onFulfilled),
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

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  h.state.planRow = null
  h.state.tierWriteError = null
  h.state.tierWriteMatches = true
  h.state.subscriptionWriteError = null
  h.captured.listingUpdate = null
  h.captured.subscriptionUpsert = null
  h.captured.subscriptionUpdate = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
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

describe('handleSubscriptionUpsert — the tier write is observed, not assumed (E-7)', () => {
  it('throws when the tier write errors, so the route can record it and Stripe retries', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.tierWriteError = { message: 'connection reset' }

    await expect(handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))).rejects.toThrow(
      /listing tier write failed/
    )
  })

  it('writes no audit row at all when the tier write errors', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.tierWriteError = { message: 'connection reset' }

    await expect(handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))).rejects.toThrow()

    // The throw happens before the audit write. An audit row here would claim a
    // tier change that definitively did not happen, and the Stripe retry would
    // then produce a second one.
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('throws when the subscriptions upsert errors, before touching the listing tier', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.subscriptionWriteError = { message: 'unique violation' }

    await expect(handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))).rejects.toThrow(
      /subscriptions upsert failed/
    )
    expect(h.captured.listingUpdate).toBeNull()
  })

  it('does not throw when the tier write matches no listing — a retry cannot fix that', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.tierWriteMatches = false

    // Throwing here would put the event into Stripe's retry schedule for days
    // against a condition that will never clear.
    await expect(
      handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      '[webhook] tier write matched no listing:',
      expect.objectContaining({ listingId: 'l1', intendedTier: 'premium' })
    )
  })

  it('records the tier that actually survived, not the one it intended, when no row matched', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.tierWriteMatches = false

    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))

    // Before E-7 this asserted `tier: 'premium'` — the intended value — which is
    // exactly what made the audit log unusable as evidence.
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeState: { tier: 'growth' },
        afterState: expect.objectContaining({
          tier: 'growth',
          tier_write: 'no_matching_listing',
          intended_tier: 'premium',
        }),
      })
    )
  })

  it('leaves the successful path clean — no failure marker, nothing logged', async () => {
    h.state.planRow = PREMIUM_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))

    const afterState = h.writeSystemAuditLog.mock.calls[0]?.[0].afterState
    expect(afterState).toBeDefined()
    expect(afterState).not.toHaveProperty('tier_write')
    expect(afterState).not.toHaveProperty('intended_tier')
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionDeleted — the downgrade is observed, not assumed (E-7)', () => {
  function makeCanceledSub(): Stripe.Subscription {
    return {
      ...makeSub('price_prem_yearly'),
      status: 'canceled',
      canceled_at: 1_702_600_000,
    } as unknown as Stripe.Subscription
  }

  it('downgrades the listing to free on the happy path', async () => {
    await handleSubscriptionDeleted(makeFakeClient(), makeCanceledSub())

    expect(h.captured.subscriptionUpdate).toEqual(
      expect.objectContaining({ status: 'canceled' })
    )
    expect(h.captured.listingUpdate).toEqual({ tier: 'free' })
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({ tier: 'free', status: 'canceled' }),
      })
    )
  })

  it('throws when the downgrade errors — the expensive direction of this bug', async () => {
    h.state.tierWriteError = { message: 'statement timeout' }

    // A silently failed downgrade leaves a listing holding paid placement after
    // the money stopped, and nothing else in the system would ever notice.
    await expect(handleSubscriptionDeleted(makeFakeClient(), makeCanceledSub())).rejects.toThrow(
      /listing downgrade failed/
    )
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('records honestly when the downgrade matches no listing', async () => {
    h.state.tierWriteMatches = false

    await expect(handleSubscriptionDeleted(makeFakeClient(), makeCanceledSub())).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      '[webhook] downgrade matched no listing:',
      expect.objectContaining({ listingId: 'l1' })
    )
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({
          tier: 'growth',
          tier_write: 'no_matching_listing',
          intended_tier: 'free',
        }),
      })
    )
  })

  it('throws when the subscriptions cancel write errors, before touching the tier', async () => {
    h.state.subscriptionWriteError = { message: 'connection reset' }

    await expect(handleSubscriptionDeleted(makeFakeClient(), makeCanceledSub())).rejects.toThrow(
      /subscription cancel write failed/
    )
    expect(h.captured.listingUpdate).toBeNull()
  })
})
