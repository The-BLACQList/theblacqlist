import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Direct test of the subscription lifecycle handlers with the REAL handlers and
// a hand-built fake Supabase service client. The whole-handler mock in
// stripe-webhook.test.ts stubs these out.
//
// Since ticket 238 a plan belongs to the owner, and every tier write happens in
// one database function, sync_owner_plan_tiers (its rules, including "a second
// live subscription still counts" and "a lapse keeps the covered pages", are
// pinned by tests/migrations/owner-plan-pages.test.ts). What is pinned here:
//
//   * The plan comes from the LIVE price, not checkout-time metadata
//     (Finding 3), and a price no plan sells is flagged loudly.
//   * When empty slots are filled: a new subscription, a different plan, or a
//     plan coming back. Not on a plain renewal, not when the plan ends.
//   * The checkout page is the anchor only while it exists.
//   * The owner comes from metadata, else the stored row, else the page.
//   * Failure posture (E-7): an error throws (the route records it and Stripe
//     retries); a skipped sync doesn't; the audit row records what the
//     database did, never what was intended.
//
// Neutralized side effects: next/cache revalidatePath (asserted), the email
// sender, and writeSystemAuditLog (asserted).
const h = vi.hoisted(() => {
  const writeSystemAuditLog = vi.fn(
    async (_entry: { action: string; targetId: string | null; afterState: Record<string, unknown> }) => {}
  )
  const revalidatePath = vi.fn()

  const state: {
    planRow: Record<string, unknown> | null
    /** The stored row for this Stripe subscription, before the event. */
    prevRow: { plan_id: string | null; status: string; user_id?: string } | null
    prevReadError: { message: string } | null
    /** The anchor page (null = deleted). Also what revalidation reads. */
    listing: Record<string, unknown> | null
    otherLive: { stripe_subscription_id: string }[]
    subscriptionWriteError: { message: string } | null
    rpcResult: unknown
    rpcError: { message: string } | null
  } = {
    planRow: null,
    prevRow: null,
    prevReadError: null,
    listing: null,
    otherLive: [],
    subscriptionWriteError: null,
    rpcResult: null,
    rpcError: null,
  }

  const captured: {
    subscriptionUpsert: Record<string, unknown> | null
    subscriptionUpdate: Record<string, unknown> | null
    rpc: { fn: string; args: Record<string, unknown> } | null
    order: string[]
  } = { subscriptionUpsert: null, subscriptionUpdate: null, rpc: null, order: [] }

  return { writeSystemAuditLog, revalidatePath, state, captured }
})

vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import {
  handleSubscriptionUpsert,
  handleSubscriptionDeleted,
} from '@/lib/services/billing/webhookHandlers'
import type Stripe from 'stripe'

function makeFakeClient() {
  function from(table: string) {
    let isWrite = false
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      in: () => builder,
      or: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      upsert: (row: Record<string, unknown>) => {
        h.captured.order.push(`upsert:${table}`)
        if (table === 'subscriptions') h.captured.subscriptionUpsert = row
        return Promise.resolve({ data: null, error: h.state.subscriptionWriteError })
      },
      update: (row: Record<string, unknown>) => {
        isWrite = true
        h.captured.order.push(`update:${table}`)
        if (table === 'subscriptions') h.captured.subscriptionUpdate = row
        return builder
      },
      maybeSingle: async () => {
        if (table === 'plans') return { data: h.state.planRow, error: null }
        if (table === 'listings') return { data: h.state.listing, error: null }
        if (table === 'subscriptions') {
          return { data: h.state.prevReadError ? null : h.state.prevRow, error: h.state.prevReadError }
        }
        return { data: null, error: null }
      },
      then: (onFulfilled: (v: unknown) => unknown) => {
        const result =
          table === 'subscriptions' && isWrite
            ? { data: null, error: h.state.subscriptionWriteError }
            : table === 'subscriptions'
              ? { data: h.state.otherLive, error: null }
              : { data: null, error: null }
        return Promise.resolve(result).then(onFulfilled)
      },
    }
    return builder
  }
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    h.captured.order.push(`rpc:${fn}`)
    h.captured.rpc = { fn, args }
    return { data: h.state.rpcError ? null : h.state.rpcResult, error: h.state.rpcError }
  }
  return { from, rpc } as unknown as Parameters<typeof handleSubscriptionUpsert>[0]
}

// A subscription whose LIVE price may differ from its checkout-time metadata
// ('growth'), as after a Customer Portal switch (Finding 3).
function makeSub(livePriceId: string, overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
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
    ...overrides,
  } as unknown as Stripe.Subscription
}

const PREMIUM_ROW = {
  id: 'plan_premium',
  plan_key: 'premium',
  stripe_price_id_monthly: 'price_prem_monthly',
  stripe_price_id_yearly: 'price_prem_yearly',
}
const GROWTH_ROW = {
  id: 'plan_growth',
  plan_key: 'growth',
  stripe_price_id_monthly: 'price_growth_monthly',
  stripe_price_id_yearly: 'price_growth_yearly',
}
const STARTER_ROW = {
  id: 'plan_starter',
  plan_key: 'starter',
  stripe_price_id_monthly: 'price_starter_monthly',
  stripe_price_id_yearly: 'price_starter_yearly',
}

const PUBLISHED_PAGE = {
  id: 'l1',
  status: 'published',
  slug: 'joes',
  entity_type: 'business',
  cities: { slug: 'atlanta' },
}

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  h.state.planRow = null
  h.state.prevRow = null
  h.state.prevReadError = null
  h.state.listing = { id: 'l1', status: 'draft', slug: null, entity_type: 'business', cities: null }
  h.state.otherLive = []
  h.state.subscriptionWriteError = null
  h.state.rpcResult = { tier: 'growth', cap: 2, covered: ['l1'], changes: [] }
  h.state.rpcError = null
  h.captured.subscriptionUpsert = null
  h.captured.subscriptionUpdate = null
  h.captured.rpc = null
  h.captured.order = []
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
})

const audit = () => h.writeSystemAuditLog.mock.calls[0]?.[0]

describe('handleSubscriptionUpsert — the plan follows the live price (Finding 3)', () => {
  it('records the premium plan when the live price is premium, despite stale growth metadata', async () => {
    h.state.planRow = PREMIUM_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_yearly'))
    expect(h.captured.subscriptionUpsert).toMatchObject({
      plan_id: 'plan_premium',
      user_id: 'u1',
      listing_id: 'l1',
      status: 'active',
    })
    expect(audit()?.afterState).toMatchObject({ plan_slug: 'premium', billing_cycle: 'annual' })
  })

  it('falls back to the metadata plan when the live price matches no plans row', async () => {
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_unknown'))
    expect(h.captured.subscriptionUpsert?.plan_id).toBe('plan_growth')
  })

  it('flags a live price no plan sells, in the error log and on the audit row', async () => {
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_unknown'))
    expect(errorSpy).toHaveBeenCalledWith(
      '[webhook] subscription is on a price no plan sells:',
      expect.objectContaining({ priceId: 'price_unknown' })
    )
    expect(audit()?.afterState.price_unresolved).toBe('price_unknown')
  })

  it('does not flag a price that resolves to a plan', async () => {
    h.state.planRow = PREMIUM_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_monthly'))
    expect(audit()?.afterState).not.toHaveProperty('price_unresolved')
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionUpsert — the owner sync (ticket 238)', () => {
  it('records the subscription, then syncs the owner with the checkout page as anchor', async () => {
    h.state.planRow = GROWTH_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(h.captured.order.indexOf('upsert:subscriptions')).toBeLessThan(
      h.captured.order.indexOf('rpc:sync_owner_plan_tiers')
    )
    expect(h.captured.rpc).toEqual({
      fn: 'sync_owner_plan_tiers',
      args: { p_owner: 'u1', p_fill: true, p_anchor: 'l1' },
    })
  })

  it('fills empty slots for a new subscription', async () => {
    h.state.planRow = GROWTH_ROW
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(h.captured.rpc?.args.p_fill).toBe(true)
    expect(audit()?.afterState.filled).toBe(true)
  })

  it('does not fill on a renewal of the same live plan', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.prevRow = { plan_id: 'plan_growth', status: 'active' }
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(h.captured.rpc?.args.p_fill).toBe(false)
  })

  it('fills on a plan change', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.prevRow = { plan_id: 'plan_growth', status: 'active' }
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_monthly'))
    expect(h.captured.rpc?.args.p_fill).toBe(true)
  })

  it('fills when a plan comes back to live', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.prevRow = { plan_id: 'plan_growth', status: 'inactive' }
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(h.captured.rpc?.args.p_fill).toBe(true)
  })

  it('never fills when the status is not live', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.rpcResult = {
      tier: 'free',
      cap: 0,
      covered: ['l1'],
      changes: [{ id: 'l1', from: 'growth', to: 'free' }],
    }
    await handleSubscriptionUpsert(
      makeFakeClient(),
      makeSub('price_growth_monthly', { status: 'incomplete_expired' })
    )
    expect(h.captured.subscriptionUpsert?.status).toBe('canceled')
    expect(h.captured.rpc?.args.p_fill).toBe(false)
  })

  it('leaves the anchor out when the checkout page is gone', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.listing = null
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(h.captured.subscriptionUpsert).not.toHaveProperty('listing_id')
    expect(h.captured.rpc?.args).not.toHaveProperty('p_anchor')
    expect(audit()?.targetId).toBeNull()
  })

  it('takes the owner from the stored row when metadata has none', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.prevRow = { plan_id: 'plan_growth', status: 'active', user_id: 'u9' }
    const sub = makeSub('price_growth_monthly')
    sub.metadata = { listing_id: 'l1' }
    await handleSubscriptionUpsert(makeFakeClient(), sub)
    expect(h.captured.subscriptionUpsert?.user_id).toBe('u9')
    expect(h.captured.rpc?.args.p_owner).toBe('u9')
  })

  it('does nothing when no owner can be found', async () => {
    h.state.listing = null
    const sub = makeSub('price_growth_monthly')
    sub.metadata = {}
    await handleSubscriptionUpsert(makeFakeClient(), sub)
    expect(h.captured.subscriptionUpsert).toBeNull()
    expect(h.captured.rpc).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('flags a second live subscription for the same owner', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.otherLive = [{ stripe_subscription_id: 'sub_other' }]
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    expect(errorSpy).toHaveBeenCalledWith(
      '[webhook] owner has more than one live subscription:',
      expect.objectContaining({ others: ['sub_other'] })
    )
    expect(audit()?.afterState.other_live_subscriptions).toEqual(['sub_other'])
  })

  it('records what the database did and revalidates each changed published page', async () => {
    h.state.planRow = PREMIUM_ROW
    h.state.listing = PUBLISHED_PAGE
    h.state.rpcResult = {
      tier: 'premium',
      cap: 3,
      covered: ['l1', 'l2'],
      changes: [
        { id: 'l1', from: 'free', to: 'premium' },
        { id: 'l2', from: 'free', to: 'premium' },
      ],
    }
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_prem_monthly'))
    expect(audit()?.afterState).toMatchObject({
      owner_tier: 'premium',
      cap: 3,
      pages: ['l1', 'l2'],
      changes: [
        { id: 'l1', from: 'free', to: 'premium' },
        { id: 'l2', from: 'free', to: 'premium' },
      ],
    })
    expect(h.revalidatePath).toHaveBeenCalledTimes(2)
    expect(h.revalidatePath).toHaveBeenCalledWith('/atlanta/business/joes')
  })
})

describe('handleSubscriptionUpsert — failures are observed, not assumed (E-7)', () => {
  it('throws when the sync errors, so the route can record it and Stripe retries', async () => {
    h.state.rpcError = { message: 'deadlock detected' }
    await expect(
      handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    ).rejects.toThrow(/owner plan sync failed for u1/)
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('throws when the subscriptions upsert errors, before any sync', async () => {
    h.state.subscriptionWriteError = { message: 'connection reset' }
    await expect(
      handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    ).rejects.toThrow(/subscriptions upsert failed/)
    expect(h.captured.rpc).toBeNull()
  })

  it('throws when the previous row cannot be read, before any write', async () => {
    h.state.prevReadError = { message: 'timeout' }
    await expect(
      handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    ).rejects.toThrow(/subscription read failed/)
    expect(h.captured.subscriptionUpsert).toBeNull()
  })

  it('throws on a sync result it does not understand rather than guess', async () => {
    h.state.rpcResult = { tier: 'platinum', cap: 9 }
    await expect(
      handleSubscriptionUpsert(makeFakeClient(), makeSub('price_growth_monthly'))
    ).rejects.toThrow(/unexpected shape/)
  })

  it('does not throw when the sync skips an unresolved plan, and says so on the audit row', async () => {
    h.state.rpcResult = { skipped: 'plan_unresolved' }
    await handleSubscriptionUpsert(makeFakeClient(), makeSub('price_unknown'))
    expect(audit()?.afterState.tier_write).toBe('skipped_plan_unresolved')
    expect(audit()?.afterState).not.toHaveProperty('owner_tier')
    expect(errorSpy).toHaveBeenCalledWith(
      '[webhook] owner plan left unchanged, a live subscription has no plan:',
      expect.objectContaining({ userId: 'u1' })
    )
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionDeleted', () => {
  const ended = () =>
    makeSub('price_growth_monthly', { status: 'canceled', canceled_at: 1_702_600_000 })

  it('marks the row canceled, then syncs the owner without filling', async () => {
    h.state.rpcResult = {
      tier: 'free',
      cap: 0,
      covered: ['l1'],
      changes: [{ id: 'l1', from: 'growth', to: 'free' }],
    }
    await handleSubscriptionDeleted(makeFakeClient(), ended())
    expect(h.captured.subscriptionUpdate).toMatchObject({ status: 'canceled' })
    expect(h.captured.order.indexOf('update:subscriptions')).toBeLessThan(
      h.captured.order.indexOf('rpc:sync_owner_plan_tiers')
    )
    expect(h.captured.rpc?.args).toEqual({ p_owner: 'u1', p_fill: false })
    expect(audit()).toMatchObject({
      action: 'subscription_canceled',
      afterState: {
        status: 'canceled',
        owner_tier: 'free',
        changes: [{ id: 'l1', from: 'growth', to: 'free' }],
      },
    })
  })

  it('throws when the sync errors — the expensive direction of this bug', async () => {
    h.state.rpcError = { message: 'connection reset' }
    await expect(handleSubscriptionDeleted(makeFakeClient(), ended())).rejects.toThrow(
      /owner plan sync failed/
    )
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('throws when the cancel write errors, before any sync', async () => {
    h.state.subscriptionWriteError = { message: 'connection reset' }
    await expect(handleSubscriptionDeleted(makeFakeClient(), ended())).rejects.toThrow(
      /subscription cancel write failed/
    )
    expect(h.captured.rpc).toBeNull()
  })

  it('finds the owner from the stored row when metadata is empty', async () => {
    h.state.prevRow = { plan_id: 'plan_growth', status: 'canceled', user_id: 'u7' }
    const sub = ended()
    sub.metadata = {}
    await handleSubscriptionDeleted(makeFakeClient(), sub)
    expect(h.captured.rpc?.args.p_owner).toBe('u7')
    expect(audit()?.targetId).toBeNull()
  })

  it('is a quiet no-op after the owner deleted their account (ticket 243)', async () => {
    // deleteAccountAction cancelled the plan and freed the pages first; the
    // user and their rows are gone, so the sync finds no billing and the
    // webhook returns normally (200), with no retry and nothing to revalidate.
    h.state.rpcResult = { skipped: 'no_billing' }
    await expect(handleSubscriptionDeleted(makeFakeClient(), ended())).resolves.toBeUndefined()
    expect(h.captured.rpc?.args).toEqual({ p_owner: 'u1', p_fill: false })
  })
})

describe('the free month on a paid upgrade (ticket 136)', () => {
  function scheduled(status: Stripe.Subscription.Status, priceId: string) {
    const sub = makeSub(priceId, { status })
    return {
      ...sub,
      metadata: { ...sub.metadata, plan_id: 'plan_starter', plan_slug: 'starter' },
    } as Stripe.Subscription
  }

  it('day 0: a trialing subscription on the Growth price records Growth and fills', async () => {
    h.state.planRow = GROWTH_ROW
    h.state.prevRow = { plan_id: 'plan_starter', status: 'active' }
    await handleSubscriptionUpsert(makeFakeClient(), scheduled('trialing', 'price_growth_monthly'))
    expect(h.captured.subscriptionUpsert?.plan_id).toBe('plan_growth')
    expect(h.captured.rpc?.args.p_fill).toBe(true)
  })

  it('day 31: back on the Starter price and active, it records Starter and refits', async () => {
    h.state.planRow = STARTER_ROW
    h.state.prevRow = { plan_id: 'plan_growth', status: 'trialing' }
    await handleSubscriptionUpsert(makeFakeClient(), scheduled('active', 'price_starter_monthly'))
    expect(h.captured.subscriptionUpsert?.plan_id).toBe('plan_starter')
    // A plan change: the database fills to the new cap and trims anything over it.
    expect(h.captured.rpc?.args.p_fill).toBe(true)
  })
})
