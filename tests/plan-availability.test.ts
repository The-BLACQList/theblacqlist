// =============================================================================
// C3 — plan availability is derived from the live `plans` table
// =============================================================================
// Whether a tier can be bought is a DATA fact, not a code fact: null out the
// two Stripe price IDs and the tier goes dark on /pricing and
// /dashboard/upgrade at once, with no deploy. Both surfaces import this module
// so they cannot drift into disagreeing about what is for sale.
//
// The property that matters most here is the failure direction. A read error
// must render every paid tier as Coming Soon, never as purchasable — a buy
// button we cannot honor sends a visitor through sign-in to a checkout that
// 422s for want of a price ID.
// =============================================================================

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { getPlanAvailability, isPlanPurchasable } from '@/lib/stripe/availability'

type PlanRow = {
  plan_key: string | null
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
}

// Mirrors the shape getPlanAvailability actually uses: .from().select().eq().
function fakeClient(result: { data: PlanRow[] | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(result),
      }),
    }),
  } as unknown as SupabaseClient<Database>
}

describe('getPlanAvailability', () => {
  it('marks a tier available per cycle from its price IDs', async () => {
    const availability = await getPlanAvailability(
      fakeClient({
        data: [
          {
            plan_key: 'starter',
            stripe_price_id_monthly: 'price_m',
            stripe_price_id_yearly: 'price_y',
          },
          { plan_key: 'growth', stripe_price_id_monthly: null, stripe_price_id_yearly: null },
          {
            plan_key: 'premium',
            stripe_price_id_monthly: 'price_m',
            stripe_price_id_yearly: null,
          },
        ],
      })
    )

    expect(availability).toEqual({
      starter: { monthly: true, annual: true },
      growth: { monthly: false, annual: false },
      premium: { monthly: true, annual: false },
    })
  })

  it('fails CLOSED when the read returns nothing', async () => {
    const availability = await getPlanAvailability(fakeClient({ data: null }))

    expect(availability).toEqual({})
    // Every paid tier reads as withheld rather than purchasable.
    expect(isPlanPurchasable(availability, 'starter', 'monthly')).toBe(false)
    expect(isPlanPurchasable(availability, 'growth', 'annual')).toBe(false)
  })

  it('skips a row with no plan_key rather than keying the map on null', async () => {
    const availability = await getPlanAvailability(
      fakeClient({
        data: [
          { plan_key: null, stripe_price_id_monthly: 'price_m', stripe_price_id_yearly: 'price_y' },
        ],
      })
    )

    expect(availability).toEqual({})
  })
})

describe('isPlanPurchasable', () => {
  const availability = {
    starter: { monthly: true, annual: true },
    growth: { monthly: true, annual: false },
  }

  it('reads the cycle asked for, not whichever is set', () => {
    expect(isPlanPurchasable(availability, 'growth', 'monthly')).toBe(true)
    expect(isPlanPurchasable(availability, 'growth', 'annual')).toBe(false)
  })

  it('is false for a tier absent from the map', () => {
    expect(isPlanPurchasable(availability, 'premium', 'monthly')).toBe(false)
  })

  it('is never true for free — it has no Stripe price and never will', () => {
    expect(
      isPlanPurchasable({ free: { monthly: true, annual: true } }, 'free', 'monthly')
    ).toBe(false)
  })
})
