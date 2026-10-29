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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3">
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

  // Only zero-result searches are logged (ticket 142, founder 2026-10-20), so
  // this page reads search_events directly and has no "top queries" table: it
  // would show the same rows under a wrong name. The two RPCs this page used to
  // try first (get_top_search_queries_filtered, get_zero_result_queries) were
  // never defined in any migration, so every load errored into this path anyway.
  let zeroQuery = service
    .from('search_events')
    .select('query, created_at')
    .eq('result_count', 0)
    .gte('created_at', since)
  if (cityId) zeroQuery = zeroQuery.eq('city_id', cityId)

  const [zeroResult, citiesResult] = await Promise.all([
    zeroQuery.limit(5000),
    supabase.from('cities').select('slug, name').order('name'),
  ])

  type ZeroQueryRow = { query: string; count: number; last_searched: string }
  const byQuery: Record<string, { count: number; last: string }> = {}
  for (const row of zeroResult.data ?? []) {
    const seen = byQuery[row.query]
    if (!seen) byQuery[row.query] = { count: 1, last: row.created_at }
    else {
      seen.count++
      if (row.created_at > seen.last) seen.last = row.created_at
    }
  }
  const zeroQueries: ZeroQueryRow[] = Object.entries(byQuery)
    .map(([query, { count, last }]) => ({ query, count, last_searched: last }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
  const loadFailed = Boolean(zeroResult.error)

  const cities = citiesResult.data ?? []

  const exportParams = new URLSearchParams()
  exportParams.set('period', period)
  if (citySlug) exportParams.set('city', citySlug)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1 font-body text-xs text-charcoal-soft hover:text-brand-black transition-colors mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" /> Analytics
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Search Analytics</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Searches that found nothing: the gaps in the directory. Logged without
          who searched, and deleted after 90 days.
        </p>
      </div>

      {/* Filters */}
      <SearchFilters cities={cities} period={period} city={citySlug ?? ''} />

      {/* Zero-result queries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>
            Zero-result queries, last {PERIOD_DAYS[period]} days
            {cityRow?.data ? ` · ${cityRow.data.name}` : ''}
          </SectionHeading>
          <a
            href={`/api/admin/analytics/search/export?table=zero&${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black transition-colors"
            aria-label="Download zero-result queries as CSV"
          >
            <Download className="size-3" aria-hidden="true" /> CSV
          </a>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {loadFailed ? (
            <p role="alert" className="font-body text-sm text-charcoal-soft text-center py-8 px-4">
              Couldn&apos;t load search data. Refresh the page to try again.
            </p>
          ) : zeroQueries.length === 0 ? (
            <p className="font-body text-sm text-charcoal-soft text-center py-8 px-4">
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
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide w-8">#</th>
                    <th scope="col" className="text-left px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">Query</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">Count</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">Last searched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {zeroQueries.map((row, i) => (
                    <tr
                      key={row.query}
                      className={`hover:bg-[#f9f9fb] ${row.count > 10 ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-body text-xs text-charcoal-faint">{i + 1}</td>
                      <td className="px-4 py-2.5 font-subhead text-sm text-brand-black max-w-xs truncate" title={row.query}>
                        {row.query.length > 80 ? `${row.query.slice(0, 80)}…` : row.query}
                        {row.count > 10 && (
                          <span className="ml-2 font-body text-[10px] text-amber-700 font-semibold">
                            High frequency
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal-soft">
                        {row.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-body text-sm text-charcoal-soft hidden md:table-cell">
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
