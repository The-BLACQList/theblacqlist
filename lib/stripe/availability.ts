import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import type { BillingCycle, PlanSlug } from './plans'

// Which tiers can actually be bought, right now, per billing cycle.
//
// A tier is purchasable when its `plans` row is active AND carries the Stripe
// price ID for the cycle in question. That makes withholding a tier a DATA
// change — null out the two price IDs and the tier goes dark everywhere — with
// no deploy and no code change. `app/api/stripe/create-checkout-session/route.ts`
// reads the same row the same way and returns 422 without a price ID, so the
// server refuses the purchase independently of what any button renders.
//
// This lives here rather than inline in a page because there are two surfaces
// (`/pricing` and `/dashboard/upgrade`) and two copies of the derivation is
// exactly how the public page and the dashboard drift into disagreeing about
// what is for sale.

export type PlanAvailability = Record<string, { monthly: boolean; annual: boolean }>

export async function getPlanAvailability(
  supabase: SupabaseClient<Database>
): Promise<PlanAvailability> {
  const { data } = await supabase
    .from('plans')
    .select('plan_key, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('is_active', true)

  // Fails CLOSED on purpose: a read error leaves `data` null, the map stays
  // empty, and every paid tier renders as Coming Soon. Showing a buy button we
  // cannot honor is the worse failure — checkout would 422 after sign-in.
  const availability: PlanAvailability = {}
  for (const p of data ?? []) {
    if (!p.plan_key) continue
    availability[p.plan_key] = {
      monthly: !!p.stripe_price_id_monthly,
      annual: !!p.stripe_price_id_yearly,
    }
  }
  return availability
}

// Free is never "purchasable" — it has no Stripe price and never will. Callers
// that render a Free card handle its CTA separately.
export function isPlanPurchasable(
  availability: PlanAvailability,
  slug: PlanSlug,
  cycle: BillingCycle
): boolean {
  if (slug === 'free') return false
  const entry = availability[slug]
  if (!entry) return false
  return cycle === 'annual' ? entry.annual : entry.monthly
}
