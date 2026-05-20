import { notFound } from 'next/navigation'
import { BarChart2, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { canAccess } from '@/lib/stripe/features'

interface Props {
  params: Promise<{ entityId: string }>
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4">
      <p className="font-body text-xs text-charcoal/50">{label}</p>
      <p className="font-headline text-2xl text-brand-black mt-1">{value}</p>
      {sub && <p className="font-body text-[11px] text-charcoal/40 mt-0.5">{sub}</p>}
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
      title={`${label}: ${value} views`}
    >
      <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
        <div
          className="w-full bg-amber-gold/70 rounded-t-sm transition-all"
          style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="font-body text-[9px] text-charcoal/40 truncate w-full text-center">
        {label.split(' ')[1]}
      </span>
    </div>
  )
}

export default async function AnalyticsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  // Verify ownership and get listing counts
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
          <p className="font-body text-sm text-charcoal/60 mt-0.5">{listing.name}</p>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white px-8 py-12 text-center">
          <Lock className="size-10 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
          <h2 className="font-headline text-xl text-brand-black mb-2">
            Analytics is a paid feature
          </h2>
          <p className="font-body text-sm text-charcoal/60 max-w-sm mx-auto mb-6">
            Upgrade to Standard or Premium to see page views, CTA clicks, saves, shares, and your
            30-day trend chart.
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
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000).toISOString()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString()
  // date-only string for entity_analytics_daily comparison
  const since30dDate = since30d.slice(0, 10)

  const [views7d, views30d, ctaClicks30d, shares30d, saves30d, dailyResult] = await Promise.all([
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
      .gte('created_at', since7d),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.PAGE_VIEW)
      .gte('created_at', since30d),

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
      .gte('created_at', since30d),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.SHARE_INITIATED)
      .gte('created_at', since30d),

    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('event_name', ANALYTICS_EVENTS.SAVE_TOGGLED)
      .gte('created_at', since30d),

    supabase
      .from('entity_analytics_daily')
      .select('snapshot_date, page_views, cta_clicks, saves, shares')
      .eq('listing_id', entityId)
      .gte('snapshot_date', since30dDate)
      .order('snapshot_date', { ascending: true }),
  ])

  const v7 = views7d.count ?? 0
  const v30 = views30d.count ?? 0
  const cta = ctaClicks30d.count ?? 0
  const sh = shares30d.count ?? 0
  const sv = saves30d.count ?? 0

  const dailyRows = dailyResult.data ?? []
  const maxViews = dailyRows.reduce((m, r) => Math.max(m, r.page_views), 0)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Analytics</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">{listing.name}</p>
      </div>

      {/* Lifetime totals from denormalized listing columns */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
          All time
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total views" value={listing.view_count ?? 0} />
          <StatCard label="Saves" value={listing.save_count ?? 0} />
          <StatCard label="Reviews" value={listing.review_count ?? 0} />
        </div>
      </div>

      {/* Recent event counts from analytics_events */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
          Last 30 days
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Page views" value={v30} sub={`${v7} in last 7 d`} />
          <StatCard label="CTA clicks" value={cta} />
          <StatCard label="Saves" value={sv} />
          <StatCard label="Shares" value={sh} />
        </div>
      </div>

      {/* 30-day trend chart from entity_analytics_daily */}
      <div>
        <h2 className="font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
          Page views — daily trend
        </h2>

        {dailyRows.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
            <BarChart2 className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
            <p className="font-body text-sm text-charcoal/60">Data collection has started.</p>
            <p className="font-body text-xs text-charcoal/40 mt-1">
              Daily trend bars will appear here after the first aggregation run (tonight at 2 AM
              UTC).
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
            <div className="flex items-end gap-0.5 w-full">
              {dailyRows.map((row) => (
                <TrendBar
                  key={row.snapshot_date}
                  value={row.page_views}
                  max={maxViews}
                  date={row.snapshot_date}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
