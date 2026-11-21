import type { SupabaseClient } from '@supabase/supabase-js'
import { TIER_RANK, pageCap } from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'

// Ticket 237: the plan an owner sees on the dashboard home.
//
// Since ticket 238 a plan belongs to the owner and covers up to Starter 1 /
// Growth 2 / Premium 3 of their pages. Every covered page carries the owner's
// tier, so the owner's plan is the highest tier across their pages.

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

export interface OwnerPlan {
  tier: PlanSlug
  /** A live subscription is past_due: the page keeps its plan, the card failed. */
  paymentDue: boolean
  /** There is a live subscription the Stripe portal can open. */
  canManage: boolean
  /** Pages on the plan, out of how many it covers. Null on Free or when unread. */
  coverage: { pageIds: string[]; count: number; cap: number } | null
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
  const read = tier === 'free' ? null : await readCoverage(supabase, userId, tier)
  // Covered pages show when there are some, or when the owner pays and has
  // none yet (e.g. a plan bought on a page that can't be covered), so they can
  // add one. A comped owner with no billing and no rows shows nothing.
  const withCoverage = (canManage: boolean): OwnerPlan['coverage'] =>
    read && (read.count > 0 || canManage) ? read : null

  const plan: OwnerPlan = { tier, paymentDue: false, canManage: false, coverage: withCoverage(false) }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, created_at')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .in('status', [...LIVE])
    .order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return plan

  const rows = data as Array<{ status: string }>
  return {
    tier,
    paymentDue: rows.some((r) => r.status === 'past_due'),
    canManage: true,
    coverage: withCoverage(true),
  }
}

/**
 * How many pages the plan covers (owner-read RLS on plan_covered_pages). The
 * cap never shows below the count: a hand-set plan can cover more. Null when
 * the read fails.
 */
async function readCoverage(
  supabase: AnyClient,
  userId: string,
  tier: PlanSlug
): Promise<OwnerPlan['coverage']> {
  const { data, error } = await supabase
    .from('plan_covered_pages')
    .select('listing_id')
    .eq('owner_user_id', userId)
  if (error || !data) return null
  const pageIds = (data as Array<{ listing_id: string }>).map((r) => r.listing_id)
  return { pageIds, count: pageIds.length, cap: Math.max(pageCap(tier), pageIds.length) }
}
