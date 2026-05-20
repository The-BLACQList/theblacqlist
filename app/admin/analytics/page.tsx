import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Analytics' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function weekLabel(weeksAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - weeksAgo * 7)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildWeeklyBuckets(
  rows: { created_at: string }[],
  numWeeks: number
): { label: string; count: number }[] {
  const now = Date.now()
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const buckets = Array.from({ length: numWeeks }, (_, i) => ({
    label: weekLabel(numWeeks - 1 - i),
    count: 0,
  }))

  for (const row of rows) {
    const ageMs = now - new Date(row.created_at).getTime()
    const weeksAgo = Math.floor(ageMs / MS_PER_WEEK)
    const idx = numWeeks - 1 - weeksAgo
    if (idx >= 0 && idx < numWeeks) {
      buckets[idx]!.count++
    }
  }
  return buckets
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4">
      <p className="font-body text-xs text-charcoal/50">{label}</p>
      <p className="font-headline text-2xl text-brand-black mt-1">{value}</p>
      {sub && <p className="font-body text-[11px] text-charcoal/40 mt-0.5">{sub}</p>}
    </div>
  )
}

function TrendBar({ count, max, label }: { count: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${label}: ${count}`}>
      <div className="w-full flex items-end justify-center" style={{ height: 56 }}>
        <div
          className="w-full bg-amber-gold/70 rounded-t-sm"
          style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="font-body text-[9px] text-charcoal/40 truncate w-full text-center">
        {label}
      </span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
      {children}
    </h2>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const service = createServiceClient()

  const now = new Date()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since56d = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString()
  const since7dDate = since7d.slice(0, 10)

  const [
    totalUsersResult,
    recentProfilesResult,
    totalClaimsResult,
    claimsWeekResult,
    totalSavesResult,
    savesWeekResult,
    searchesWeekResult,
    pageViewsWeekResult,
    topListingsResult,
    topQueriesResult,
    jobLogResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),

    supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', since56d)
      .order('created_at', { ascending: true }),

    supabase.from('claims').select('id', { count: 'exact', head: true }),

    supabase.from('claims').select('id', { count: 'exact', head: true }).gte('created_at', since7d),

    supabase.from('saves').select('id', { count: 'exact', head: true }),

    supabase.from('saves').select('id', { count: 'exact', head: true }).gte('created_at', since7d),

    service
      .from('search_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7d),

    service.from('entity_analytics_daily').select('page_views').gte('snapshot_date', since7dDate),

    // New functions not yet in generated types — cast through any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).rpc('get_top_listings_by_views', { limit_n: 10, days_back: 30 }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).rpc('get_top_search_queries', { limit_n: 10, days_back: 30 }),

    // analytics_job_log not yet in generated types — cast through any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service.from('analytics_job_log' as any) as any)
      .select('run_date, listings_processed, duration_ms, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const totalUsers = totalUsersResult.count ?? 0
  const totalClaims = totalClaimsResult.count ?? 0
  const claimsWeek = claimsWeekResult.count ?? 0
  const totalSaves = totalSavesResult.count ?? 0
  const savesWeek = savesWeekResult.count ?? 0
  const searchesWeek = searchesWeekResult.count ?? 0

  const pageViewsWeek = (pageViewsWeekResult.data ?? []).reduce(
    (sum, r) => sum + (r.page_views ?? 0),
    0
  )

  const recentProfiles = recentProfilesResult.data ?? []
  const weeklyBuckets = buildWeeklyBuckets(recentProfiles, 8)
  const maxWeekCount = Math.max(...weeklyBuckets.map((b) => b.count), 1)

  const topListings = ((topListingsResult.data as unknown) ?? []) as {
    listing_id: string
    listing_name: string
    city_name: string | null
    total_views: number
  }[]

  const topQueries = ((topQueriesResult.data as unknown) ?? []) as {
    query: string
    search_count: number
    avg_results: number | null
  }[]

  const jobLog = ((jobLogResult.data as unknown) ?? []) as {
    run_date: string
    listings_processed: number
    duration_ms: number | null
    status: string
    created_at: string
  }[]

  const lastJob = jobLog[0]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Analytics</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Platform-level activity and growth metrics.
        </p>
      </div>

      {/* Platform health */}
      <div>
        <SectionHeading>Platform health</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Registered users" value={totalUsers.toLocaleString()} />
          <StatCard
            label="Total claims"
            value={totalClaims.toLocaleString()}
            sub={`+${claimsWeek} this week`}
          />
          <StatCard
            label="Total saves"
            value={totalSaves.toLocaleString()}
            sub={`+${savesWeek} this week`}
          />
          <StatCard label="Searches" value={searchesWeek.toLocaleString()} sub="this week" />
          <StatCard label="Page views" value={pageViewsWeek.toLocaleString()} sub="this week" />
          <StatCard
            label="Last aggregation"
            value={lastJob ? lastJob.run_date : '—'}
            sub={lastJob ? lastJob.status : 'no runs yet'}
          />
        </div>
      </div>

      {/* Weekly registrations chart */}
      <div>
        <SectionHeading>New registrations — last 8 weeks</SectionHeading>
        <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
          <div className="flex items-end gap-1 w-full">
            {weeklyBuckets.map((b, i) => (
              <TrendBar key={i} count={b.count} max={maxWeekCount} label={b.label} />
            ))}
          </div>
        </div>
      </div>

      {/* Top content + top searches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeading>Top pages by views — last 30 days</SectionHeading>
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            {topListings.length === 0 ? (
              <p className="font-body text-sm text-charcoal/50 text-center py-8 px-4">
                No aggregated data yet. Run a backfill to populate.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                    <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide w-8">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                      Listing
                    </th>
                    <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                      Views
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {topListings.map((row, i) => (
                    <tr key={row.listing_id} className="hover:bg-[#f9f9fb]">
                      <td className="px-4 py-2.5 font-body text-xs text-charcoal/40">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-subhead text-sm text-brand-black truncate max-w-[180px]">
                          {row.listing_name}
                        </p>
                        {row.city_name && (
                          <p className="font-body text-xs text-charcoal/50">{row.city_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/70">
                        {row.total_views.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <SectionHeading>Top searches — last 30 days</SectionHeading>
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            {topQueries.length === 0 ? (
              <p className="font-body text-sm text-charcoal/50 text-center py-8 px-4">
                No search data yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                    <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide w-8">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                      Query
                    </th>
                    <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                      Searches
                    </th>
                    <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                      Avg results
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {topQueries.map((row, i) => (
                    <tr key={row.query} className="hover:bg-[#f9f9fb]">
                      <td className="px-4 py-2.5 font-body text-xs text-charcoal/40">{i + 1}</td>
                      <td className="px-4 py-2.5 font-subhead text-sm text-brand-black truncate max-w-[180px]">
                        {row.query}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/70">
                        {row.search_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/50 hidden md:table-cell">
                        {row.avg_results ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Aggregation job log */}
      <div>
        <SectionHeading>Aggregation job log — last 5 runs</SectionHeading>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {jobLog.length === 0 ? (
            <p className="font-body text-sm text-charcoal/50 text-center py-8 px-4">
              No aggregation runs yet. Run{' '}
              <code className="font-mono text-xs bg-charcoal/5 px-1 rounded">
                SELECT aggregate_entity_analytics()
              </code>{' '}
              in the SQL editor.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                  <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Listings
                  </th>
                  <th className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Duration
                  </th>
                  <th className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {jobLog.map((run) => (
                  <tr key={run.created_at} className="hover:bg-[#f9f9fb]">
                    <td className="px-4 py-2.5 font-body text-sm text-brand-black">
                      {run.run_date}
                    </td>
                    <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/70">
                      {run.listings_processed.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/50">
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          run.status === 'success'
                            ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-subhead bg-green-50 text-green-700 border border-green-200'
                            : run.status === 'failed'
                              ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-subhead bg-red-50 text-red-700 border border-red-200'
                              : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-subhead bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }
                      >
                        {run.status}
                      </span>
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
