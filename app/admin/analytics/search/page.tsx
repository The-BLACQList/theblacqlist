import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SearchFilters } from './_components/SearchFilters'

interface Props {
  searchParams: Promise<{ period?: string; city?: string }>
}

const VALID_PERIODS = ['7d', '30d', '90d'] as const
type Period = (typeof VALID_PERIODS)[number]

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }

function periodToInterval(period: Period): string {
  return `${PERIOD_DAYS[period]} days`
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
      {children}
    </h2>
  )
}

export default async function SearchAnalyticsPage({ searchParams }: Props) {
  await requireAdmin()
  const { period: periodParam, city: cityParam } = await searchParams

  const period: Period = VALID_PERIODS.includes(periodParam as Period)
    ? (periodParam as Period)
    : '30d'
  const citySlug = typeof cityParam === 'string' && cityParam.length > 0 ? cityParam : null

  const now = new Date()
  const since = new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const service = createServiceClient()

  // Resolve city slug → city_id
  const cityRow = citySlug
    ? await service.from('cities').select('id, name').eq('slug', citySlug).maybeSingle()
    : null
  const cityId = cityRow?.data?.id ?? null
  const interval = periodToInterval(period)

  const [topQueriesResult, zeroResultQueriesResult, citiesResult] = await Promise.all([
    // Top 50 queries by frequency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).rpc('get_top_search_queries_filtered', {
      limit_n: 50,
      interval_text: interval,
      filter_city_id: cityId,
    }),

    // Zero-result queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).rpc('get_zero_result_queries', {
      limit_n: 50,
      interval_text: interval,
      filter_city_id: cityId,
    }),

    // Cities for filter select
    supabase.from('cities').select('slug, name').order('name'),
  ])

  // Fallback: if RPCs don't exist, query directly
  type TopQueryRow = { query: string; count: number; avg_results: number | null }
  type ZeroQueryRow = { query: string; count: number; last_searched: string }

  let topQueries: TopQueryRow[] = []
  let zeroQueries: ZeroQueryRow[] = []

  if (topQueriesResult.error) {
    // Direct query fallback
    let q = service
      .from('search_events')
      .select('query, result_count')
      .gte('created_at', since)
    if (cityId) q = q.eq('city_id', cityId)
    const { data } = await q.limit(5000)
    const map: Record<string, { count: number; totalResults: number }> = {}
    for (const row of data ?? []) {
      if (!map[row.query]) map[row.query] = { count: 0, totalResults: 0 }
      map[row.query]!.count++
      map[row.query]!.totalResults += row.result_count ?? 0
    }
    topQueries = Object.entries(map)
      .map(([query, { count, totalResults }]) => ({
        query,
        count,
        avg_results: count > 0 ? Math.round(totalResults / count) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
  } else {
    topQueries = (topQueriesResult.data as TopQueryRow[]) ?? []
  }

  if (zeroResultQueriesResult.error) {
    let q = service
      .from('search_events')
      .select('query, created_at')
      .eq('result_count', 0)
      .gte('created_at', since)
    if (cityId) q = q.eq('city_id', cityId)
    const { data } = await q.limit(5000)
    const map: Record<string, { count: number; last: string }> = {}
    for (const row of data ?? []) {
      if (!map[row.query] || row.created_at > map[row.query]!.last) {
        map[row.query] = { count: (map[row.query]?.count ?? 0) + 1, last: row.created_at }
      } else {
        map[row.query]!.count++
      }
    }
    zeroQueries = Object.entries(map)
      .map(([query, { count, last }]) => ({ query, count, last_searched: last }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
  } else {
    zeroQueries = (zeroResultQueriesResult.data as ZeroQueryRow[]) ?? []
  }

  const cities = citiesResult.data ?? []

  const exportParams = new URLSearchParams()
  exportParams.set('period', period)
  if (citySlug) exportParams.set('city', citySlug)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1 font-body text-xs text-charcoal/50 hover:text-brand-black transition-colors mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" /> Analytics
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Search Analytics</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Trending queries and content gaps based on zero-result searches.
        </p>
      </div>

      {/* Filters */}
      <SearchFilters cities={cities} period={period} city={citySlug ?? ''} />

      {/* Top queries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>
            Top 50 queries — last {PERIOD_DAYS[period]} days
            {cityRow?.data ? ` · ${cityRow.data.name}` : ''}
          </SectionHeading>
          <a
            href={`/api/admin/analytics/search/export?table=top&${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-brand-black transition-colors"
            aria-label="Download top queries as CSV"
          >
            <Download className="size-3" aria-hidden="true" /> CSV
          </a>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {topQueries.length === 0 ? (
            <p className="font-body text-sm text-charcoal/50 text-center py-8 px-4">
              No search data yet. Data appears after users begin searching.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <caption className="sr-only">
                  Top 50 search queries by volume in the last {PERIOD_DAYS[period]} days
                </caption>
                <thead>
                  <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide w-8">#</th>
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">Query</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">Count</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">Avg results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {topQueries.map((row, i) => (
                    <tr key={row.query} className="hover:bg-[#f9f9fb]">
                      <td className="px-4 py-2.5 font-body text-xs text-charcoal/40">{i + 1}</td>
                      <td className="px-4 py-2.5 font-subhead text-sm text-brand-black max-w-xs truncate" title={row.query}>
                        {row.query.length > 80 ? `${row.query.slice(0, 80)}…` : row.query}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/70">
                        {row.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/50 hidden md:table-cell">
                        {row.avg_results ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Zero-result queries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>
            Zero-result queries — last {PERIOD_DAYS[period]} days
            {cityRow?.data ? ` · ${cityRow.data.name}` : ''}
          </SectionHeading>
          <a
            href={`/api/admin/analytics/search/export?table=zero&${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-brand-black transition-colors"
            aria-label="Download zero-result queries as CSV"
          >
            <Download className="size-3" aria-hidden="true" /> CSV
          </a>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {zeroQueries.length === 0 ? (
            <p className="font-body text-sm text-charcoal/50 text-center py-8 px-4">
              No zero-result searches in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <caption className="sr-only">
                  Zero-result search queries in the last {PERIOD_DAYS[period]} days, sorted by frequency
                </caption>
                <thead>
                  <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide w-8">#</th>
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">Query</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">Count</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">Last searched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {zeroQueries.map((row, i) => (
                    <tr
                      key={row.query}
                      className={`hover:bg-[#f9f9fb] ${row.count > 10 ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-body text-xs text-charcoal/40">{i + 1}</td>
                      <td className="px-4 py-2.5 font-subhead text-sm text-brand-black max-w-xs truncate" title={row.query}>
                        {row.query.length > 80 ? `${row.query.slice(0, 80)}…` : row.query}
                        {row.count > 10 && (
                          <span className="ml-2 font-body text-[10px] text-amber-700 font-semibold">
                            High frequency
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/70">
                        {row.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal/50 hidden md:table-cell">
                        {new Date(row.last_searched).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
