import type { createServiceClient } from '@/lib/supabase/server'
import { LOCATION_LINK_COLUMNS, linkedTiers, toLocationLinkRows } from '@/lib/listings/locations'
import type { PlanSlug } from '@/lib/stripe/plans'

type ServiceClient = ReturnType<typeof createServiceClient>

const LIVE_DB_STATUSES = ['active', 'trialing', 'past_due']

export interface LocationTierChange {
  id: string
  from: string | null
  to: PlanSlug
}

/**
 * Keeps a primary's linked locations (ticket 110) in step with its tier.
 * Called by the Stripe webhook after it writes the primary's tier, and by the
 * owner's link action. Idempotent: only pages whose tier differs are written,
 * so a redelivered event changes nothing.
 *
 * A linked page that holds a live subscription of its own is left to that
 * subscription. Linking and checkout both refuse that case, so it should only
 * appear if one slipped past them; its own plan is what the owner is paying for.
 *
 * Read or write errors throw: in the webhook that becomes a 500 and Stripe
 * retries, the same posture as the primary's own tier write. A missing table
 * (the migration not applied yet) is treated as "no links".
 */
/**
 * True when a read failed only because the table is not there yet (the
 * migration not applied). Postgres says 42P01; hosted Supabase's API says
 * PGRST205 ("not in the schema cache"), so both count.
 */
export function isMissingTable(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function syncLocationTiers(
  supabase: ServiceClient,
  primaryId: string,
  primaryTier: string | null
): Promise<LocationTierChange[]> {
  const { data, error } = await supabase
    .from('listing_location_links')
    .select(LOCATION_LINK_COLUMNS)
    .eq('primary_listing_id', primaryId)
  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(`location links read failed for ${primaryId}: ${error.message}`)
  }
  const links = toLocationLinkRows(data)
  if (links.length === 0) return []

  const wanted = linkedTiers(primaryTier, links)
  const ids = wanted.map((w) => w.id)

  const [{ data: current, error: readError }, { data: ownSubs, error: subError }] =
    await Promise.all([
      supabase.from('listings').select('id, tier').in('id', ids),
      supabase
        .from('subscriptions')
        .select('listing_id')
        .in('listing_id', ids)
        .in('status', LIVE_DB_STATUSES),
    ])
  if (readError) throw new Error(`linked listings read failed: ${readError.message}`)
  if (subError) throw new Error(`linked subscriptions read failed: ${subError.message}`)

  const tierNow = new Map((current ?? []).map((r) => [r.id as string, (r.tier as string) ?? null]))
  const paysOwnWay = new Set((ownSubs ?? []).map((r) => r.listing_id as string))

  const changes: LocationTierChange[] = []
  for (const w of wanted) {
    if (!tierNow.has(w.id)) continue // the page is gone
    if (paysOwnWay.has(w.id)) continue
    const from = tierNow.get(w.id) ?? null
    if (from === w.tier) continue
    const { error: writeError } = await supabase
      .from('listings')
      .update({ tier: w.tier })
      .eq('id', w.id)
    if (writeError) {
      throw new Error(`linked location tier write failed for ${w.id}: ${writeError.message}`)
    }
    changes.push({ id: w.id, from, to: w.tier })
  }
  return changes
}

/**
 * The tier a page goes back to when it leaves a group: its own live plan if
 * it somehow has one, otherwise Free.
 */
export async function ownTier(supabase: ServiceClient, listingId: string): Promise<PlanSlug> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plans(plan_key)')
    .eq('listing_id', listingId)
    .in('status', LIVE_DB_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`own plan read failed for ${listingId}: ${error.message}`)
  const planKey = (data?.[0]?.plans as { plan_key: string } | null)?.plan_key
  return (planKey as PlanSlug | undefined) ?? 'free'
}
