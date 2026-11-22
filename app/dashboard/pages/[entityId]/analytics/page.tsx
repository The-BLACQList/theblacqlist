import { notFound } from 'next/navigation'
import { BarChart2, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { ANALYTICS_EVENTS, SERVER_ONLY_EVENTS } from '@/lib/analytics/constants'
import { isFeatureEnabled } from '@/lib/env'
import { canAccess } from '@/lib/stripe/features'
import { getPlanAvailability, isTierOpen } from '@/lib/stripe/availability'
import {
  advancedPreviewLines,
  canCompare,
  changeLabel,
  changeText,
  periodChange,
  summarizeInsights,
  type InsightItem,
  type PeriodChange,
} from '@/lib/analytics/advanced'
import { getWritingAllowance } from '@/lib/ai/allowance'
import { bucketTrend, periodsFor, resolvePeriod, type TrendPoint } from '@/lib/analytics/periods'
import { PeriodToggle } from './_components/PeriodToggle'
import { ExplainNumbers } from './_components/ExplainNumbers'

interface Props {
  params: Promise<{ entityId: string }>
  searchParams: Promise<{ period?: string }>
}

function StatCard({
  label,
  value,
  sub,
  change,
  days,
}: {
  label: string
  value: number | string
  sub?: string
  /** Ticket 241: Growth and Premium only, and only when the plan holds the period before. */
  change?: PeriodChange | null
  days?: number
}) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4">
      <p className="font-body text-xs text-charcoal-soft">{label}</p>
      <p className="font-headline text-2xl text-brand-black mt-1">{value}</p>
      {change && days && (
        <p
          className={`font-body text-[11px] font-semibold mt-0.5 ${
            change.direction === 'up' ? 'text-success' : 'text-charcoal-soft'
          }`}
        >
          <span aria-hidden="true">{changeText(change)}</span>
          <span className="sr-only">{changeLabel(change, days)}</span>
        </p>
      )}
      {sub && <p className="font-body text-[11px] text-charcoal-faint mt-0.5">{sub}</p>}
    </div>
  )
}

const KIND_LABEL: Record<InsightItem['kind'], string> = {
  product: 'Product',
  service: 'Service',
  event: 'Event',
  job: 'Job',
}

function ItemTable({
  items,
  clicksLabel,
  showRate,
}: {
  items: InsightItem[]
  clicksLabel: string
  showRate: boolean
}) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
      <table className="w-full font-body text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-soft border-b border-charcoal/10">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Item
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold text-right">
              Views
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold text-right">
              {clicksLabel}
            </th>
            {showRate && (
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                Rate
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-charcoal/5 last:border-0">
              <td className="px-4 py-2.5 min-w-0">
                <span className="block truncate max-w-[11rem] sm:max-w-xs text-brand-black">
                  {item.name}
                </span>
                <span className="block text-[11px] text-charcoal-faint">
                  {KIND_LABEL[item.kind]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.views}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.clicks}</td>
              {showRate && (
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {item.rate === null ? <span aria-label="No views">-</span> : `${item.rate}%`}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SECTION_HEADING =
  'font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3'

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
            Analytics Is a Paid Feature
          </h2>
          <p className="font-body text-sm text-charcoal-soft max-w-sm mx-auto mb-6">
            Upgrade to Starter or above to see page views, CTA clicks, saves, shares, and your trend
            charts.
          </p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors"
          >
            View Upgrade Options
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
  const DAY_MS = 24 * 60 * 60 * 1_000
  const sinceDate = new Date(now.getTime() - period.days * DAY_MS)
  const sinceDateStr = sinceDate.toISOString().slice(0, 10)
  const sinceIso = sinceDate.toISOString()
  const nowIso = now.toISOString()

  // Ticket 241: advanced analytics on Growth and Premium. The period before is
  // read only when the plan holds it (2 x days of history), so 12 months on
  // Growth shows no arrows rather than reading 24 months.
  const advanced = canAccess(listing.tier, 'analytics_advanced')
  const compare = advanced && canCompare(period.days, listing.tier)
  const prevSinceIso = new Date(sinceDate.getTime() - period.days * DAY_MS).toISOString()
  const marketplaceOpen = isFeatureEnabled('marketplaceOpen')
  const jobsOpen = isFeatureEnabled('jobsOpen')

  // Happening now counts (part F). Only read while the feature is on.
  const showPosts = isFeatureEnabled('happeningNow')
  const countEvent = (eventName: string) =>
    showPosts
      ? supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('entity_id', entityId)
          .eq('event_name', eventName)
          .gte('created_at', sinceIso)
      : Promise.resolve({ count: 0 })

  // The four period cards, for any window. Listing-scoped rows only: the owner
  // read policy covers entity_type 'listing' rows of their own listings.
  const pageCounts = async (from: string, to: string) => {
    const base = () =>
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .gte('created_at', from)
        .lt('created_at', to)
    const [views, taps, shares, saves] = await Promise.all([
      base().eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW),
      // Website, call and directions taps from the hero, the quick-action bar
      // and At a Glance (lib/analytics/contactTap.ts), emitted since
      // 2026-10-05. MARKETPLACE_CTA_CLICK is deliberately not here: the
      // marketplace emits plain `cta_click` on the product or service row,
      // which the insights function below attributes to this page.
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

  // Storefront items, and the events and jobs this owner posted from the page.
  // Their rows are entity_type 'product', 'service' or another listing, which
  // the owner read policy does not cover, so they come from a function that
  // checks ownership itself and joins the real tables
  // (20261203000000_owner_listing_insights.sql). Until ticket 241 the
  // "from marketplace" count read these rows under RLS and was always 0.
  const insights = (from: string, to: string) =>
    supabase.rpc('owner_listing_insights', {
      p_listing_id: entityId,
      p_since: from,
      p_until: to,
    })

  const [
    current,
    previous,
    insightsNow,
    insightsBefore,
    dailyResult,
    writingAllowance,
    postViewsCount,
    postClicksCount,
    availability,
  ] = await Promise.all([
    pageCounts(sinceIso, nowIso),
    compare ? pageCounts(prevSinceIso, sinceIso) : Promise.resolve(null),
    insights(sinceIso, nowIso),
    compare ? insights(prevSinceIso, sinceIso) : Promise.resolve(null),

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

    // Views count each time a post is shown: the top of the page counts the
    // first post, the city strip counts every card.
    countEvent(SERVER_ONLY_EVENTS.POST_VIEW),
    countEvent(SERVER_ONLY_EVENTS.POST_CLICK),

    // Starter's locked card shows only while Growth or Premium is for sale.
    advanced ? Promise.resolve(null) : getPlanAvailability(supabase),
  ])

  const items = summarizeInsights(insightsNow.data ?? [])
  const insightsFailed = !!insightsNow.error
  const marketplaceCta = items.storefront.clicks
  const views = current.views
  const cta = current.taps + marketplaceCta
  const sh = current.shares
  const sv = current.saves

  // Arrows only when both periods really were read.
  const before =
    previous && insightsBefore && !insightsBefore.error && !insightsFailed
      ? {
          ...previous,
          cta: previous.taps + summarizeInsights(insightsBefore.data ?? []).storefront.clicks,
        }
      : null
  const changeOf = (cur: number, key: 'views' | 'cta' | 'saves' | 'shares') =>
    before ? periodChange(cur, before[key]) : null

  // Storefront numbers only while the marketplace is open and the page has
  // items; events and jobs only when the owner posted some. Nothing untracked
  // is shown as a zero.
  const showStorefront = advanced && marketplaceOpen && items.storefront.itemCount > 0
  const showPostings = advanced && items.postings.length > 0
  const showLocked =
    !advanced &&
    !!availability &&
    (isTierOpen(availability, 'growth') || isTierOpen(availability, 'premium'))

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
          All Time
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Views" value={listing.view_count ?? 0} />
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
          <StatCard
            label="Page Views"
            value={views}
            change={changeOf(views, 'views')}
            days={period.days}
          />
          <StatCard
            label="CTA Clicks"
            value={cta}
            change={changeOf(cta, 'cta')}
            days={period.days}
            sub={marketplaceCta > 0 ? `${marketplaceCta} from your storefront` : undefined}
          />
          <StatCard label="Saves" value={sv} change={changeOf(sv, 'saves')} days={period.days} />
          <StatCard label="Shares" value={sh} change={changeOf(sh, 'shares')} days={period.days} />
        </div>
        {before && (
          <p className="font-body text-[11px] text-charcoal-faint mt-2">
            Arrows compare with the {period.days} days before. No arrow means there was nothing to
            compare with.
          </p>
        )}
      </div>

      {showStorefront && (
        <div>
          <h2 className={SECTION_HEADING}>Storefront, {period.heading.toLowerCase()}</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Item Views" value={items.storefront.views} />
            <StatCard label="Item Clicks" value={items.storefront.clicks} />
            <StatCard
              label="Click Rate"
              value={items.storefront.rate === null ? '-' : `${items.storefront.rate}%`}
              sub="Clicks per view"
            />
          </div>
          <h3 className="font-body text-sm font-semibold text-brand-black mt-5 mb-2">Top Items</h3>
          {items.storefront.top.length > 0 ? (
            <ItemTable items={items.storefront.top} clicksLabel="Clicks" showRate />
          ) : (
            <p className="font-body text-xs text-charcoal-faint">
              No views on your storefront items in this period yet.
            </p>
          )}
        </div>
      )}

      {showPostings && (
        <div>
          <h2 className={SECTION_HEADING}>
            {items.postings.some((p) => p.kind === 'job') ? 'Events and Jobs' : 'Events'},{' '}
            {period.heading.toLowerCase()}
          </h2>
          <ItemTable items={items.postings} clicksLabel="Taps" showRate={false} />
          <p className="font-body text-[11px] text-charcoal-faint mt-2">
            Posted from this page. Taps count the website, call, and directions links on each one.
          </p>
        </div>
      )}

      {advanced && insightsFailed && (
        <p className="font-body text-xs text-charcoal-faint">
          Storefront, event, and job numbers could not load right now. Try again in a minute.
        </p>
      )}

      {showLocked && (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-6">
          <div className="flex items-start gap-3">
            <Lock className="size-5 text-charcoal/30 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-headline text-lg text-brand-black">
                Advanced Analytics Comes with Growth
              </h2>
              <ul className="font-body text-sm text-charcoal-soft mt-2 space-y-1 list-disc pl-4">
                {advancedPreviewLines({ marketplaceOpen, jobsOpen }).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link
                href="/dashboard/upgrade"
                className="inline-flex items-center justify-center h-9 px-5 mt-4 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors"
              >
                See Plans
              </Link>
            </div>
          </div>
        </div>
      )}

      {showPosts && (
        <div>
          <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3">
            Happening Now, {period.heading.toLowerCase()}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Post Views"
              value={postViewsCount.count ?? 0}
              sub="On your page and city pages"
            />
            <StatCard label="Post Clicks" value={postClicksCount.count ?? 0} />
          </div>
        </div>
      )}

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
              Page Views, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="page_views" label="Page Views" />
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
            page performance; a product click on a storefront is a different
            measurement. The combined figure comes from owner_listing_insights
            above, which is why the tile can read higher than the sum of these bars.
          */}
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Page CTA Clicks, {trendCadence}
            </h2>
            <MiniChart points={trend} valueKey="cta_clicks" label="Page CTA Clicks" />
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
