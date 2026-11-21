import type { SupabaseClient } from '@supabase/supabase-js'
import { TIER_RANK } from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'

// Ticket 237: the plan an owner sees on the dashboard home.
//
// Plans are still billed per page today (ticket 110 links up to 2 location
// pages to a Premium page). The founder decided on 2026-11-21 that plans move to
// the owner (ticket 238). Until then the owner's plan is the highest tier across
// their pages, which is also what it will be once every covered page carries the
// owner's tier.

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

export interface OwnerPlan {
  tier: PlanSlug
  /** A live subscription is past_due: the page keeps its plan, the card failed. */
  paymentDue: boolean
  /** There is a live subscription the Stripe portal can open. */
  canManage: boolean
  /** The page whose subscription the portal opens (past_due first). */
  manageListingId: string | null
}

const LIVE = ['active', 'trialing', 'past_due'] as const

function asSlug(tier: string | null | undefined): PlanSlug {
  return tier && tier in TIER_RANK ? (tier as PlanSlug) : 'free'
}

/** The highest plan across the owner's pages. Unknown or missing tiers count as Free. */
export function highestTier(listings: ReadonlyArray<{ tier: string | null }>): PlanSlug {
  let best: PlanSlug = 'free'
  for (const { tier } of listings) {
    const slug = asSlug(tier)
    if ((TIER_RANK[slug] ?? 0) > (TIER_RANK[best] ?? 0)) best = slug
  }
  return best
}

/**
 * Reads the owner's live subscriptions (owner-only RLS on `subscriptions`). A
 * failed read keeps the plan name and drops the payment state and the portal
 * button: the strip never shows an error.
 */
export async function getOwnerPlan(
  supabase: AnyClient,
  userId: string,
  listings: ReadonlyArray<{ tier: string | null }>
): Promise<OwnerPlan> {
  const tier = highestTier(listings)
  const plan: OwnerPlan = { tier, paymentDue: false, canManage: false, manageListingId: null }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('listing_id, status, created_at')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .in('status', [...LIVE])
    .order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return plan

  const rows = data as Array<{ listing_id: string | null; status: string }>
  const due = rows.find((r) => r.status === 'past_due')
  return {
    tier,
    paymentDue: !!due,
    canManage: true,
    manageListingId: (due ?? rows[0])?.listing_id ?? null,
  }
}
