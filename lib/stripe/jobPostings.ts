import type { SupabaseClient } from '@supabase/supabase-js'

import { eventLimit, jobLimit, TIER_RANK } from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'

/**
 * E-2 · Model C — job postings on an included allowance plus paid overflow, and
 * the newly-enforced events cap.
 *
 * `[Decision — founder, 2026-08-21]`, superseding the Model A decision of
 * 2026-08-17. Growth includes 1 job posting per rolling 30 days and Premium
 * includes 3; free and starter include 0. Anyone, at any tier, can buy
 * additional postings. Nothing about jobs is tier-locked — only tier-discounted.
 *
 * Everything here is inert until `FEATURE_PAID_POSTINGS` is on. The call sites
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
 * What the dashboard tells an owner an extra posting costs.
 *
 * ⚠ Display copy, NOT the enforcement boundary — the same relationship
 * `lib/stripe/plans.ts` has with its price fields: "marketing copy, not the
 * enforcement boundary". What the customer is actually charged comes from the
 * Stripe price behind `STRIPE_JOB_POSTING_PRICE_ID`, and what gets recorded
 * comes from `session.amount_total`. Nothing reads this constant to decide
 * anything.
 *
 * It exists because the quota line has to name a price before checkout opens,
 * and the alternative — a Stripe price lookup on every dashboard render — is a
 * network call to display a number that changes once a year.
 *
 * **Keep in sync by hand with the Stripe price created at GATE-SPEND
 * (§2C3 ①).** `[Decision — founder, 2026-08-21]` $9.99 per 30 days.
 */
export const JOB_POSTING_PRICE_DISPLAY = '$9.99'

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

/**
 * The moment the job allowance starts applying. Same shape as the events cutoff
 * above, same reason: jobs were free and uncapped, and Model C turns them into a
 * sold entitlement. A job listing created before this instant is invisible to the
 * check — neither blocked nor counted.
 *
 * ⚠ This constant is fixed when the code merges; enforcement actually begins at
 * the later `FEATURE_PAID_POSTINGS` flip. Jobs created in that gap are already
 * past the cutoff and so DO count. That direction is the safe one — a constant
 * set in the future would fail open — but it means the gap must be counted
 * before flipping the flag. See §2B5 step 4 in the founder completion plan.
 *
 * `[Decision — founder, 2026-08-21]` grandfather, same as events.
 */
export const JOB_LIMIT_ENFORCED_FROM = '2026-08-21T00:00:00.000Z'

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

export type JobQuota = {
  /** Included postings per rolling 30 days. null means unlimited (no tier is). */
  limit: number | null
  /** Included postings whose 30-day window is still open. */
  used: number
  /** True when the next posting would have to be purchased. */
  atLimit: boolean
  tier: PlanSlug | 'free'
}

/**
 * How many included job postings this owner is currently using, against what
 * allowance.
 *
 * "Used" means *window still open*, not *ever granted*: an included posting
 * occupies a slot for {@link JOB_POSTING_DURATION_DAYS} days, the nightly sweep
 * unpublishes it, and the slot refills. That is what makes the allowance a
 * rolling one, and it is the same expiry test {@link hasPaidJobPosting} applies —
 * a null `expires_at` counts as still open in both, so the two cannot disagree.
 *
 * Only `source = 'entitlement'` rows count. A posting the owner *bought* never
 * consumes their allowance; that would charge them twice for one posting.
 *
 * No grandfather filter is applied here on purpose: entitlement rows cannot
 * predate {@link JOB_LIMIT_ENFORCED_FROM}, because nothing wrote them before the
 * feature existed. The grandfather check belongs on the job listing's own
 * `created_at`, at the call site, before this function is reached.
 *
 * Inherits {@link ownerPlanTier}'s named `[Assumption]` — tier lives on
 * `listings`, not on the user, and a job is itself a listing created at
 * `tier: 'free'`, so reading the job's own tier would give every owner a limit of
 * 0 and make the Growth entitlement unreachable. Highest-tier-wins is the reading
 * that matches the pricing copy.
 */
export async function jobQuotaFor(supabase: AnyClient, userId: string): Promise<JobQuota> {
  const tier = await ownerPlanTier(supabase, userId)
  const limit = jobLimit(tier)

  if (limit === null) {
    return { limit: null, used: 0, atLimit: false, tier }
  }
  if (limit === 0) {
    // Nothing to count — free and starter have no allowance to spend.
    return { limit: 0, used: 0, atLimit: true, tier }
  }

  const { data } = await supabase
    .from('job_posting_purchases')
    .select('id, expires_at')
    .eq('purchased_by', userId)
    .eq('status', 'paid')
    .eq('source', 'entitlement')

  const now = Date.now()
  const used = (data ?? []).filter((row) => {
    const expiresAt = (row as { expires_at: string | null }).expires_at
    return !expiresAt || new Date(expiresAt).getTime() > now
  }).length

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

/**
 * The idempotency key for an included posting: `<listing_id>:<YYYY-MM-DD>` in UTC.
 *
 * Mirrors what the Stripe session id does for a purchase. A double-submit on the
 * same day collides and is ignored; a genuine renewal 30 days later produces a
 * different key and is allowed. A unique index on `listing_id` alone would have
 * blocked renewals, and an index predicate over `now()` is not immutable.
 */
export function jobEntitlementKey(listingId: string, at: Date): string {
  return `${listingId}:${at.toISOString().slice(0, 10)}`
}

export type GrantResult = { ok: true } | { ok: false; error: string }

/**
 * Spend one of the owner's included postings: write a $0, 30-day row into the
 * same ledger a purchase writes to.
 *
 * One lifecycle, deliberately `[Decision — founder, 2026-08-21]`. The row is
 * `status: 'paid'` with `amount_cents: 0` and `source: 'entitlement'`, so
 * `hasPaidJobPosting`, the partial index, and `unpublishExpiredJobPostings` all
 * treat it identically to a purchase and need no knowledge that it was free.
 * `source` — not the amount — is what separates revenue from entitlement, because
 * `amount_cents = 0` would be ambiguous with a fully-discounted purchase.
 *
 * `supabase` MUST be a service-role client: `job_posting_purchases` has no
 * INSERT policy by design (a client that could insert a `paid` row could publish
 * a job without paying for it). The caller is responsible for having verified
 * ownership, draft status, the grandfather cutoff, and the remaining allowance
 * before calling — this function checks none of that.
 *
 * Returns a result rather than throwing, and never falls through to checkout on
 * failure: charging someone who was entitled to a free posting is the worse
 * error, so the caller surfaces a retry instead.
 */
export async function grantIncludedJobPosting(
  supabase: AnyClient,
  params: { listingId: string; userId: string; now?: Date }
): Promise<GrantResult> {
  const grantedAt = params.now ?? new Date()

  // Same narrowing the webhook uses (`webhookHandlers.ts`): `job_posting_purchases`
  // is absent from the generated `Database` types until the migration is applied.
  // Regenerate types after the apply and this cast comes out.
  const { error } = await (supabase as unknown as SupabaseClient)
    .from('job_posting_purchases')
    .upsert(
      {
        listing_id: params.listingId,
        purchased_by: params.userId,
        source: 'entitlement',
        entitlement_key: jobEntitlementKey(params.listingId, grantedAt),
        amount_cents: 0,
        currency: 'usd',
        status: 'paid',
        paid_at: grantedAt.toISOString(),
        expires_at: jobPostingExpiryFrom(grantedAt),
      },
      { onConflict: 'entitlement_key', ignoreDuplicates: true }
    )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
