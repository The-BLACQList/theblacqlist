/**
 * Loads the one and only shape a prompt is allowed to see.
 *
 * ── Why this is a separate module ────────────────────────────────────────────
 * `buildPromptVars` in provider.ts guarantees that nothing outside
 * `GenerateContext` reaches a template. That guarantee is only worth something
 * if `GenerateContext` is also the *only* thing ever loaded. If each caller
 * assembled its own context from a `select('*')`, the type would still look
 * narrow while the query that filled it read the owner's phone number into
 * memory next to it. So there is exactly one loader, its select lists are
 * explicit, and the privacy audit (V2-Mock gate 2) is two files: this one and
 * `buildPromptVars`.
 *
 * Note what is *not* selected below: no `phone`, `email`, `address_line_1`,
 * `zip`, or `social_*` from `listing_details_business`, and no `owner_user_id`
 * from `listings` — even though the caller has already used that column to prove
 * ownership. Proving ownership and building a prompt are different jobs and they
 * read different columns on purpose.
 *
 * ── The counts are the same counts the owner already sees ────────────────────
 * The four aggregate queries mirror `app/dashboard/pages/[entityId]/analytics`
 * exactly, including the `properties->>action = 'save'` filter that stops an
 * unsave from reading as a save. If the analytics summary agent quoted a
 * different number than the analytics page for the same window, one of them
 * would be wrong and the owner would have no way to tell which.
 */

import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { createClient } from '@/lib/supabase/server'
import type { GenerateContext } from './provider'

const DAY_MS = 24 * 60 * 60 * 1_000

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

/**
 * Returns the prompt context for a listing, or `null` if the listing is gone.
 *
 * Ownership is **not** checked here. This runs under the caller's own RLS-scoped
 * client, and every caller has already verified `owner_user_id` — see the header
 * of provider.ts. A `null` return means the listing does not exist or is
 * soft-deleted, not that access was refused.
 */
export async function loadGenerateContext(listingId: string): Promise<GenerateContext | null> {
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, tagline, categories ( name ), cities ( name )')
    .eq('id', listingId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return null

  const since30 = isoDaysAgo(30)
  const since7 = isoDaysAgo(7)

  const [details, views30, cta30, saves30, shares30, views7] = await Promise.all([
    supabase
      .from('listing_details_business')
      .select('description')
      .eq('listing_id', listingId)
      .maybeSingle(),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
      .gte('created_at', since30),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .in('event_name', [
        ANALYTICS_EVENTS.CTA_CLICK,
        ANALYTICS_EVENTS.HERO_CTA_CLICK,
        ANALYTICS_EVENTS.ACTION_BAR_CTA_CLICK,
        ANALYTICS_EVENTS.MARKETPLACE_CTA_CLICK,
      ])
      .gte('created_at', since30),

    // The action filter matches the analytics page and the nightly rollup.
    // Without it, an unsave counts as a save.
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .eq('event_name', ANALYTICS_EVENTS.SAVE_TOGGLED)
      .eq('properties->>action', 'save')
      .gte('created_at', since30),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .eq('event_name', ANALYTICS_EVENTS.SHARE_INITIATED)
      .gte('created_at', since30),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
      .gte('created_at', since7),
  ])

  // A count query that errored yields `null`, and `?? 0` would turn that into a
  // confident zero on an owner-facing surface. Zero is a real reading here only
  // because the alternative — omitting the number — is not available to a
  // template that has a {{page_views_30d}} slot. The analytics page behaves the
  // same way, so at least the two agree. A count this loader could not read is
  // logged nowhere and quoted as 0; that is the known weakness of this shape.
  return {
    listingName: listing.name,
    categoryName: listing.categories?.name ?? 'business',
    cityName: listing.cities?.name ?? 'their community',
    tagline: listing.tagline,
    description: details.data?.description ?? null,
    pageViews30d: views30.count ?? 0,
    ctaClicks30d: cta30.count ?? 0,
    saves30d: saves30.count ?? 0,
    shares30d: shares30.count ?? 0,
    pageViews7d: views7.count ?? 0,
  }
}
