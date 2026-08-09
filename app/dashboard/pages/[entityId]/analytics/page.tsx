import { notFound } from 'next/navigation'
import { BarChart2, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { canAccess } from '@/lib/stripe/features'
import { PeriodToggle } from './_components/PeriodToggle'

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

function TrendBar({ value, max, date }: { value: number; max: number; date: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <div
      className="flex flex-col items-center gap-1 flex-1 min-w-0"
      title={`${label}: ${value}`}
    >
      <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
        <div
          className="w-full bg-amber-gold/70 rounded-t-sm transition-all"
          style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="font-body text-[9px] text-charcoal-faint truncate w-full text-center">
        {label.split(' ')[1]}
      </span>
    </div>
  )
}

function MiniChart({
  rows,
  valueKey,
  label,
}: {
  rows: { snapshot_date: string; page_views: number; cta_clicks: number; saves: number; shares: number }[]
  valueKey: 'page_views' | 'cta_clicks' | 'saves' | 'shares'
  label: string
}) {
  const max = rows.reduce((m, r) => Math.max(m, r[valueKey]), 0)
  if (rows.length === 0 || max === 0) {
    return (
      <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-6 text-center">
        <p className="font-body text-xs text-charcoal-faint">No {label.toLowerCase()} data yet.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
      <div className="flex items-end gap-0.5 w-full">
        {rows.map((row) => (
          <TrendBar
            key={row.snapshot_date}
            value={row[valueKey]}
            max={max}
            date={row.snapshot_date}
          />
        ))}
      </div>
    </div>
  )
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { entityId } = await params
  const { period: periodParam } = await searchParams
  const period: '7d' | '30d' = periodParam === '7d' ? '7d' : '30d'
  const days = period === '7d' ? 7 : 30

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
            Upgrade to Starter or above to see page views, CTA clicks, saves, shares, and your
            trend charts.
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

  const now = new Date()
  const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000)
  const sinceDateStr = sinceDate.toISOString().slice(0, 10)
  const sinceIso = sinceDate.toISOString()

  const [viewsCount, ctaClicksCount, sharesCount, savesCount, dailyResult, searchQueriesResult] =
    await Promise.all([
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
        .gte('created_at', sinceIso),

      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .in('event_name', [
          ANALYTICS_EVENTS.CTA_CLICK,
          ANALYTICS_EVENTS.HERO_CTA_CLICK,
          ANALYTICS_EVENTS.ACTION_BAR_CTA_CLICK,
          ANALYTICS_EVENTS.MARKETPLACE_CTA_CLICK,
        ])
        .gte('created_at', sinceIso),

      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .eq('event_name', ANALYTICS_EVENTS.SHARE_INITIATED)
        .gte('created_at', sinceIso),

      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .eq('event_name', ANALYTICS_EVENTS.SAVE_TOGGLED)
        .gte('created_at', sinceIso),

      supabase
        .from('entity_analytics_daily')
        .select('snapshot_date, page_views, cta_clicks, saves, shares')
        .eq('listing_id', entityId)
        .gte('snapshot_date', sinceDateStr)
        .order('snapshot_date', { ascending: true }),

      // Queries that led to a click on this listing from search results
      supabase
        .from('search_events')
        .select('query')
        .eq('clicked_listing_id', entityId)
        .gte('created_at', sinceIso)
        .limit(200),
    ])

  const views = viewsCount.count ?? 0
  const cta = ctaClicksCount.count ?? 0
  const sh = sharesCount.count ?? 0
  const sv = savesCount.count ?? 0

  const dailyRows = dailyResult.data ?? []

  // Aggregate top search queries client-side
  const queryCounts: Record<string, number> = {}
  for (const row of searchQueriesResult.data ?? []) {
    queryCounts[row.query] = (queryCounts[row.query] ?? 0) + 1
  }
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }))

  const periodLabel = period === '7d' ? 'last 7 days' : 'last 30 days'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Analytics</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        </div>
        <PeriodToggle period={period} />
      </div>

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
          {periodLabel === 'last 7 days' ? 'Last 7 days' : 'Last 30 days'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Page views" value={views} />
          <StatCard label="CTA clicks" value={cta} />
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
              Page views — daily
            </h2>
            <MiniChart rows={dailyRows} valueKey="page_views" label="Page views" />
          </div>
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              CTA clicks — daily
            </h2>
            <MiniChart rows={dailyRows} valueKey="cta_clicks" label="CTA clicks" />
          </div>
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Saves — daily
            </h2>
            <MiniChart rows={dailyRows} valueKey="saves" label="Saves" />
          </div>
          <div>
            <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
              Shares — daily
            </h2>
            <MiniChart rows={dailyRows} valueKey="shares" label="Shares" />
          </div>
        </div>
      )}

      {/* Top search queries */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3">
          Top search queries — {periodLabel}
        </h2>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {topQueries.length === 0 ? (
            <p className="font-body text-sm text-charcoal-soft text-center py-8 px-4">
              No search click data yet for this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                  <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide w-8">
                    #
                  </th>
                  <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    Query
                  </th>
                  <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    Clicks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {topQueries.map((row, i) => (
                  <tr key={row.query} className="hover:bg-[#f9f9fb]">
                    <td className="px-4 py-2.5 font-body text-xs text-charcoal-faint">{i + 1}</td>
                    <td className="px-4 py-2.5 font-subhead text-sm text-brand-black truncate max-w-[200px]">
                      {row.query}
                    </td>
                    <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal-soft">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
