import type { SupabaseClient } from '@supabase/supabase-js'

import { eventLimit, TIER_RANK } from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'

/**
 * E-2 · Model A — paid job postings and the newly-enforced events cap.
 *
 * Everything here is inert until `FEATURE_PAID_POSTINGS` is on. Both call sites
 * check the flag; this module deliberately does not, so the rules stay testable
 * without reaching into the environment.
 */

/**
 * How long one job posting purchase buys.
 *
 * 30 days is the job-board convention, not a measured choice for this product
 * `[Assumption]`. It is a single constant precisely so changing it is a one-line
 * decision rather than an archaeology exercise.
 */
export const JOB_POSTING_DURATION_DAYS = 30

/**
 * The Stripe price to charge for a job posting.
 *
 * Read from configuration, never hardcoded — the same rule the subscription
 * route follows, where price ids come from the `plans` table
 * (`create-checkout-session/route.ts`). A one-off product does not justify a
 * table of its own yet; **if a second one-time product ships (paid event
 * promotion is the obvious next one), promote this to a row rather than adding
 * a second env var.**
 *
 * Returns null when unset, which is the normal state until the Stripe product
 * is created at GATE-SPEND. Callers must treat null as "not for sale yet" and
 * fail closed.
 */
export function jobPostingPriceId(): string | null {
  return process.env.STRIPE_JOB_POSTING_PRICE_ID?.trim() || null
}

/**
 * The moment the events cap starts applying.
 *
 * `TIER_LIMITS.events` has been sold on the pricing page since launch and
 * enforced nowhere — `eventLimit()` had zero call sites until E-2. Turning it on
 * retroactively would put existing owners over a cap they were never told about,
 * so events created before this instant are invisible to the check: they are
 * neither blocked nor counted against the allowance.
 *
 * `[Decision — founder, 2026-08-17]` enforce and grandfather.
 */
export const EVENT_LIMIT_ENFORCED_FROM = '2026-08-17T00:00:00.000Z'

/** Listing statuses that make an event "active" for the purposes of the cap. */
const ACTIVE_EVENT_STATUSES = ['pending', 'published'] as const

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

/**
 * The owner's effective plan tier: the highest tier across every listing they
 * own.
 *
 * `[Assumption]` — worth naming, because the schema does not settle it. Tier
 * lives on `listings`, not on the user, so "the owner's tier" is not a stored
 * fact. An event is itself a listing, and it is always created at `tier: 'free'`
 * (`createListing.ts`), so reading the event's own tier would give every owner a
 * limit of 0 and make the Growth entitlement unreachable — clearly not what the
 * pricing page promises. Highest-tier-wins is the reading that matches the copy:
 * a Growth subscriber gets Growth's event allowance.
 */
export async function ownerPlanTier(
  supabase: AnyClient,
  userId: string
): Promise<PlanSlug | 'free'> {
  const { data } = await supabase
    .from('listings')
    .select('tier')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)

  const rank = (tier: string | null | undefined): number => TIER_RANK[tier ?? 'free'] ?? 0

  let best: PlanSlug | 'free' = 'free'
  for (const row of data ?? []) {
    const tier = (row as { tier: string | null }).tier
    if (rank(tier) > rank(best)) best = (tier ?? 'free') as PlanSlug
  }
  return best
}

export type EventQuota = {
  /** null means unlimited. */
  limit: number | null
  /** Events that count — created at or after the grandfather cutoff. */
  used: number
  /** True when a new event would exceed the allowance. */
  atLimit: boolean
  tier: PlanSlug | 'free'
}

/**
 * How many countable events this owner has, against what allowance.
 *
 * Counts only events created at or after {@link EVENT_LIMIT_ENFORCED_FROM}, so a
 * grandfathered owner with ten pre-cutoff events still gets their full new
 * allowance rather than being permanently locked out. That is deliberately the
 * generous reading of "grandfather" — the alternative (old events consume the
 * allowance) would block exactly the established owners the grace is for.
 */
export async function eventQuotaFor(supabase: AnyClient, userId: string): Promise<EventQuota> {
  const tier = await ownerPlanTier(supabase, userId)
  const limit = eventLimit(tier)

  if (limit === null) {
    return { limit: null, used: 0, atLimit: false, tier }
  }

  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
    .eq('entity_type', 'event')
    .in('status', ACTIVE_EVENT_STATUSES as unknown as string[])
    .is('deleted_at', null)
    .gte('created_at', EVENT_LIMIT_ENFORCED_FROM)

  const used = count ?? 0
  return { limit, used, atLimit: used >= limit, tier }
}

/**
 * Has this job posting been paid for?
 *
 * Reads the purchase ledger rather than a flag on the listing so there is one
 * source of truth for the money. Expiry is checked here — a lapsed purchase
 * stops being a licence to re-submit — and an already-live job is taken down
 * when its window ends by the daily sweep in
 * `lib/services/expiry/sweeps.ts` (`unpublishExpiredJobPostings`), which is
 * written as the exact inverse of this function so the two cannot drift into
 * disagreeing about what "paid" means.
 */
export async function hasPaidJobPosting(supabase: AnyClient, listingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('job_posting_purchases')
    .select('id, expires_at')
    .eq('listing_id', listingId)
    .eq('status', 'paid')

  const now = Date.now()
  return (data ?? []).some((row) => {
    const expiresAt = (row as { expires_at: string | null }).expires_at
    return !expiresAt || new Date(expiresAt).getTime() > now
  })
}

/** The end of the window a purchase completed at `paidAt` buys. */
export function jobPostingExpiryFrom(paidAt: Date): string {
  return new Date(paidAt.getTime() + JOB_POSTING_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
