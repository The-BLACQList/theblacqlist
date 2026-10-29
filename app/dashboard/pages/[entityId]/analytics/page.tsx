import { notFound } from 'next/navigation'
import { BarChart2, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { canAccess } from '@/lib/stripe/features'
import { getWritingAllowance } from '@/lib/ai/allowance'
import { bucketTrend, periodsFor, resolvePeriod, type TrendPoint } from '@/lib/analytics/periods'
import { PeriodToggle } from './_components/PeriodToggle'
import { ExplainNumbers } from './_components/ExplainNumbers'

interface Props {
  params: Promise<{ entityId: string }>
  searchParams: Promise<{ period?: string }>
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4">
      <p className="font-body text-xs text-charcoal-soft">{label}</p>
      <p className="font-headline text-2xl text-brand-black mt-1">{value}</p>
      {sub && <p className="font-body text-[11px] text-charcoal-faint mt-0.5">{sub}</p>}
    </div>
  )
}

function TrendBar({ value, max, point }: { value: number; max: number; point: TrendPoint }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      className="flex flex-col items-center gap-1 flex-1 min-w-0"
      title={`${point.title}: ${value}`}
    >
      <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
        <div
          className="w-full bg-amber-gold/70 rounded-t-sm transition-all"
          style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="font-body text-[9px] text-charcoal-faint truncate w-full text-center">
        {point.label}
      </span>
    </div>
  )
}

function MiniChart({
  points,
  valueKey,
  label,
}: {
  points: TrendPoint[]
  valueKey: 'page_views' | 'cta_clicks' | 'saves' | 'shares'
  label: string
}) {
  const max = points.reduce((m, r) => Math.max(m, r[valueKey]), 0)
  if (points.length === 0 || max === 0) {
    return (
      <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-6 text-center">
        <p className="font-body text-xs text-charcoal-faint">No {label.toLowerCase()} data yet.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
      <div className="flex items-end gap-0.5 w-full">
        {points.map((point) => (
          <TrendBar key={point.key} value={point[valueKey]} max={max} point={point} />
        ))}
      </div>
    </div>
  )
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { entityId } = await params
  const { period: periodParam } = await searchParams

  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, tier, view_count, save_count, review_count')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()

  if (!canAccess(listing.tier, 'analytics')) {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Analytics</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white px-8 py-12 text-center">
          <Lock className="size-10 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
          <h2 className="font-headline text-xl text-brand-black mb-2">
            Analytics is a paid feature
          </h2>
          <p className="font-body text-sm text-charcoal-soft max-w-sm mx-auto mb-6">
            Upgrade to Starter or above to see page views, CTA clicks, saves, shares, and your trend
            charts.
          </p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors"
          >
            View upgrade options
          </Link>
        </div>
      </div>
    )
  }

  // The window comes from the plan (ticket 105): Starter reads up to 30 days,
  // Growth and Premium up to 12 months. A range the plan does not include
  // falls back to 30 days instead of reading more history than the plan holds.
  const period = resolvePeriod(periodParam, listing.tier)
  const now = new Date()
  const sinceDate = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1_000)
  const sinceDateStr = sinceDate.toISOString().slice(0, 10)
  const sinceIso = sinceDate.toISOString()

  const [
    viewsCount,
    ctaClicksCount,
    marketplaceCtaCount,
    sharesCount,
    savesCount,
    dailyResult,
    writingAllowance,
  ] = await Promise.all([
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
      .gte('created_at', sinceIso),

    // Listing-scoped CTA clicks: website, call and directions taps from the
    // hero, the quick-action bar and At a Glance (lib/analytics/contactTap.ts),
    // emitted since 2026-10-05. MARKETPLACE_CTA_CLICK
    // is deliberately NOT in this list: the marketplace emits plain
    // `cta_click` (app/api/marketplace/cta-click/route.ts), so asking for
    // `marketplace_cta_click` here matched nothing and the constant's presence
    // only made the omission look handled.
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .in('event_name', [
        ANALYTICS_EVENTS.CTA_CLICK,
        ANALYTICS_EVENTS.HERO_CTA_CLICK,
        ANALYTICS_EVENTS.ACTION_BAR_CTA_CLICK,
      ])
      .gte('created_at', sinceIso),

    // Marketplace CTA clicks, attributed back to this listing.
    //
    // WHY THIS IS A SEPARATE QUERY. A marketplace CTA click writes
    // `entity_id` = the product/service id, not the listing id — the click
    // happened on a product, and rewriting entity_id to the listing would
    // lose which product converted. The owner still needs the click, so the
    // listing arrives in `properties.listing_id` and is read back out here.
    // Without this, the "CTA clicks" tile below counted zero for every
    // listing on the site while real purchase-intent clicks were being
    // recorded and discarded from the owner's view.
    //
    // The entity_type filter keeps this double-count-safe: if a
    // listing-scoped `cta_click` is ever added that also carries
    // properties.listing_id, it will be counted by the query above and must
    // not be counted again here.
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', ANALYTICS_EVENTS.CTA_CLICK)
      .in('entity_type', ['product', 'service'])
      .eq('properties->>listing_id', entityId)
      .gte('created_at', sinceIso),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.SHARE_INITIATED)
      .gte('created_at', sinceIso),

    // The action filter is required, not optional: save_toggled covers both
    // directions, and without it an unsave would read as a save. It also keeps
    // this live count consistent with the nightly rollup, which filters the
    // same way (20260515000000_analytics_aggregation.sql).
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.SAVE_TOGGLED)
      .eq('properties->>action', 'save')
      .gte('created_at', sinceIso),

    supabase
      .from('entity_analytics_daily')
      .select('snapshot_date, page_views, cta_clicks, saves, shares')
      .eq('listing_id', entityId)
      .gte('snapshot_date', sinceDateStr)
      .order('snapshot_date', { ascending: true }),

    // No "Top search queries" panel (founder 2026-10-28, ticket 143). Nothing
    // writes search_events.clicked_listing_id and owners have no RLS read on
    // it, so the panel was always empty. Bring it back with the feature.

    // Off or locked means no "Explain my numbers" card (ticket 138).
    getWritingAllowance(listing.id, listing.tier),
  ])

  const views = viewsCount.count ?? 0
  const marketplaceCta = marketplaceCtaCount.count ?? 0
  const cta = (ctaClicksCount.count ?? 0) + marketplaceCta
  const sh = sharesCount.count ?? 0
  const sv = savesCount.count ?? 0

  const dailyRows = dailyResult.data ?? []
  // Daily bars up to 30 days, weekly for 90 days, monthly for 12 months, so a
  // long range still fits the card on a phone.
  const trend = bucketTrend(dailyRows, period.bucket)
  const trendCadence =
    period.bucket === 'day' ? 'daily' : period.bucket === 'week' ? 'weekly' : 'monthly'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Analytics</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        </div>
        <PeriodToggle
          period={period.key}
          options={periodsFor(listing.tier).map(({ key, label }) => ({ key, label }))}
        />
      </div>

      {writingAllowance.state === 'ready' && (
        <ExplainNumbers listingId={listing.id} allowance={writingAllowance} />
      )}

      {/* Lifetime totals */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3">
          All time
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total views" value={listing.view_count ?? 0} />
          <StatCard label="Saves" value={listing.save_count ?? 0} />
          <StatCard label="Reviews" value={listing.review_count ?? 0} />
        </div>
      </div>

      {/* Period metric cards */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3">
          {period.heading}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Page views" value={views} />
          <StatCard
            label="CTA clicks"
            value={cta}
            sub={marketplaceCta > 0 ? `${marketplaceCta} from marketplace` : undefined}
          />
          <StatCard label="Saves" value={sv} />
          <StatCard label="Shares" value={sh} />
        </div>
      </div>

      {/* Trend charts */}
      {dailyRows.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
          <BarChart2 className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
          <p className="font-body text-sm text-charcoal-soft">Data collection has started.</p>
          <p className="font-body text-xs text-charcoal-faint mt-1">
            Daily trend charts will appear here after the first aggregation run (tonight at 2 AM
            UTC).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Page views, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="page_views" label="Page views" />
          </div>
          {/*
            DELIBERATELY NARROWER THAN THE TILE ABOVE, AND LABELLED TO SAY SO.
            `entity_analytics_daily` is keyed on listing_id and its rollup counts
            only rows where entity_type = 'listing'
            (20260515000000_analytics_aggregation.sql). Marketplace CTA rows are
            entity_type 'product'/'service', so they are invisible to this chart
            BY DESIGN — the rollup would have to re-derive the listing from
            properties->>listing_id to see them.

            Do not "fix" the rollup to fold them in. The daily table is per-listing
            page performance; a product click on a shared storefront is a different
            measurement. The combined figure comes from the live query above, which
            is why the tile can read higher than the sum of these bars.
          */}
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Page CTA clicks, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="cta_clicks" label="Page CTA clicks" />
          </div>
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Saves, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="saves" label="Saves" />
          </div>
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Shares, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="shares" label="Shares" />
          </div>
        </div>
      )}
    </div>
  )
}
