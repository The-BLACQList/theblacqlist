import { revalidatePath } from 'next/cache'

import type { createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import type { PlanSlug } from '@/lib/stripe/plans'

// Owner-level plans (ticket 238). A plan belongs to the owner and covers up to
// Starter 1 / Growth 2 / Premium 3 of their pages. Which pages, and every
// page's tier, are decided in one place: the database function
// sync_owner_plan_tiers (migration 20261201000000). This file is the app's
// door to it: the Stripe webhook and the owner's "Pages on Your Plan" action
// both come through here.

type ServiceClient = ReturnType<typeof createServiceClient>

export interface PageTierChange {
  id: string
  from: string | null
  to: PlanSlug
}

export type OwnerPlanSync =
  | { skipped: 'no_billing' | 'plan_unresolved' }
  | { skipped?: undefined; tier: PlanSlug; cap: number; covered: string[]; changes: PageTierChange[] }

const SLUGS = new Set<string>(['free', 'starter', 'growth', 'premium'])

/** Reads the function's jsonb result. Anything unexpected throws: a guess here sets tiers. */
export function parseOwnerPlanSync(raw: unknown): OwnerPlanSync {
  if (!raw || typeof raw !== 'object') throw new Error('owner plan sync returned nothing')
  const r = raw as Record<string, unknown>
  if (r.skipped === 'no_billing' || r.skipped === 'plan_unresolved') return { skipped: r.skipped }
  if (typeof r.tier !== 'string' || !SLUGS.has(r.tier) || typeof r.cap !== 'number') {
    throw new Error(`owner plan sync returned an unexpected shape: ${JSON.stringify(raw)}`)
  }
  const covered = Array.isArray(r.covered) ? r.covered.filter((x): x is string => typeof x === 'string') : []
  const changes: PageTierChange[] = []
  for (const c of Array.isArray(r.changes) ? r.changes : []) {
    if (!c || typeof c !== 'object') continue
    const row = c as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.to !== 'string' || !SLUGS.has(row.to)) continue
    changes.push({
      id: row.id,
      from: typeof row.from === 'string' ? row.from : null,
      to: row.to as PlanSlug,
    })
  }
  return { tier: r.tier as PlanSlug, cap: r.cap, covered, changes }
}

/**
 * Sets every page's tier from the owner's plan. `fill` also fills empty slots
 * (a new plan, a plan change, a plan coming back); `anchorId` is the page to
 * cover first. Throws on any error, so the webhook returns 500 and Stripe
 * retries; the function is idempotent, so a retry is safe.
 */
export async function syncOwnerPlan(
  supabase: ServiceClient,
  ownerId: string,
  opts: { fill?: boolean; anchorId?: string | null } = {}
): Promise<OwnerPlanSync> {
  const { data, error } = await supabase.rpc('sync_owner_plan_tiers', {
    p_owner: ownerId,
    p_fill: opts.fill ?? false,
    ...(opts.anchorId ? { p_anchor: opts.anchorId } : {}),
  })
  if (error) throw new Error(`owner plan sync failed for ${ownerId}: ${error.message}`)
  return parseOwnerPlanSync(data)
}

/**
 * The owner a Stripe subscription belongs to: its metadata first (every
 * checkout sets user_id), then the stored row, then the anchor page's owner.
 * Null when none of them say.
 */
export async function resolveSubscriptionOwner(
  supabase: ServiceClient,
  subscriptionId: string,
  metadata: Record<string, string | undefined> | null | undefined
): Promise<string | null> {
  if (metadata?.user_id) return metadata.user_id

  const { data: row } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (row?.user_id) return row.user_id

  if (metadata?.listing_id) {
    const { data: listing } = await supabase
      .from('listings')
      .select('owner_user_id')
      .eq('id', metadata.listing_id)
      .maybeSingle()
    if (listing?.owner_user_id) return listing.owner_user_id
  }
  return null
}

/** Revalidate a published page after its tier changed. Best-effort. */
export async function revalidateListingPage(supabase: ServiceClient, listingId: string): Promise<void> {
  const { data: listing } = await supabase
    .from('listings')
    .select('slug, entity_type, status, cities(slug)')
    .eq('id', listingId)
    .maybeSingle()

  if (listing?.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug ?? null
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
}

export async function revalidateChanged(
  supabase: ServiceClient,
  changes: ReadonlyArray<PageTierChange>
): Promise<void> {
  for (const change of changes) await revalidateListingPage(supabase, change.id)
}

/**
 * True when a read failed only because the table is not there yet (the
 * migration not applied). Postgres says 42P01; hosted Supabase's API says
 * PGRST205 ("not in the schema cache"), so both count.
 */
export function isMissingTable(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
