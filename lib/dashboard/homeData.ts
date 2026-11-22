import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { pagePeriodCounts } from '@/lib/analytics/pageCounts'
import { summarizeInsights } from '@/lib/analytics/advanced'
import { dailySeries, type DailySeries } from '@/lib/dashboard/home'

type Client = Awaited<ReturnType<typeof createClient>>

export interface HomeSnapshot {
  views: number
  taps: number
  saves: number
  series: DailySeries
}

const DAYS = 30

/**
 * The last 30 days for Business Home (ticket 253). Totals come from the same
 * live counts as Insights, taps included storefront clicks, so the two pages
 * agree. The small trend lines come from the nightly rollup. Call it only for
 * plans with analytics: Free gets a locked preview and no reads.
 */
export async function loadHomeSnapshot(
  supabase: Client,
  listingId: string,
  now: Date = new Date()
): Promise<HomeSnapshot> {
  const since = new Date(now.getTime() - DAYS * 86_400_000)
  const sinceIso = since.toISOString()
  const nowIso = now.toISOString()
  const [counts, insights, daily] = await Promise.all([
    pagePeriodCounts(supabase, listingId, sinceIso, nowIso),
    supabase.rpc('owner_listing_insights', {
      p_listing_id: listingId,
      p_since: sinceIso,
      p_until: nowIso,
    }),
    supabase
      .from('entity_analytics_daily')
      .select('snapshot_date, page_views, cta_clicks, saves')
      .eq('listing_id', listingId)
      .gte('snapshot_date', sinceIso.slice(0, 10))
      .order('snapshot_date', { ascending: true }),
  ])
  const storefront = insights.error ? 0 : summarizeInsights(insights.data ?? []).storefront.clicks
  return {
    views: counts.views,
    taps: counts.taps + storefront,
    saves: counts.saves,
    series: dailySeries(daily.data ?? [], DAYS, now),
  }
}

/** Published reviews on the page with no owner reply yet. 0 on a failed read. */
export async function countReviewsToAnswer(supabase: Client, listingId: string): Promise<number> {
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('status', 'published')
    .is('owner_response', null)
  return error ? 0 : (count ?? 0)
}
