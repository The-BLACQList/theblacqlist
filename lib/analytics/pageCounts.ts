import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

type Client = Awaited<ReturnType<typeof createClient>>

export interface PageCounts {
  views: number
  taps: number
  shares: number
  saves: number
}

/**
 * A page's views, taps, shares and saves for one window, live from
 * analytics_events. Shared by Insights and Business Home (ticket 253) so both
 * show the same numbers. Listing-scoped rows only: the owner read policy
 * covers entity_type 'listing' rows of their own listings.
 */
export async function pagePeriodCounts(
  supabase: Client,
  listingId: string,
  from: string,
  to: string
): Promise<PageCounts> {
  const base = () =>
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .gte('created_at', from)
      .lt('created_at', to)
  const [views, taps, shares, saves] = await Promise.all([
    base().eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW),
    // Website, call and directions taps from the hero, the quick-action bar
    // and At a Glance (lib/analytics/contactTap.ts), emitted since
    // 2026-10-05. MARKETPLACE_CTA_CLICK is deliberately not here: the
    // marketplace emits plain `cta_click` on the product or service row,
    // which owner_listing_insights attributes to this page.
    base().in('event_name', [
      ANALYTICS_EVENTS.CTA_CLICK,
      ANALYTICS_EVENTS.HERO_CTA_CLICK,
      ANALYTICS_EVENTS.ACTION_BAR_CTA_CLICK,
    ]),
    base().eq('event_name', ANALYTICS_EVENTS.SHARE_INITIATED),
    // The action filter is required, not optional: save_toggled covers both
    // directions, and without it an unsave would read as a save. It also
    // keeps this live count consistent with the nightly rollup, which filters
    // the same way (20260515000000_analytics_aggregation.sql).
    base().eq('event_name', ANALYTICS_EVENTS.SAVE_TOGGLED).eq('properties->>action', 'save'),
  ])
  return {
    views: views.count ?? 0,
    taps: taps.count ?? 0,
    shares: shares.count ?? 0,
    saves: saves.count ?? 0,
  }
}
