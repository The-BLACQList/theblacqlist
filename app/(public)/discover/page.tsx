import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { DiscoverBanner } from '@/components/discovery/DiscoverBanner'
import { FacetSidebar } from '@/components/discovery/FacetSidebar'
import { MobileFilterSheet } from '@/components/discovery/MobileFilterSheet'
import { SortDropdown } from '@/components/discovery/SortDropdown'
import { ActiveFilterChips } from '@/components/discovery/ActiveFilterChips'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { parseLocationParams } from '@/lib/listings/location-params'
import {
  buildLocationEscapeUrls,
  canonicalOpenNowQuery,
  parseDiscoverParams,
  parsePage,
  type DiscoverSearchParams,
} from '@/lib/listings/discover-params'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Discover Black-Owned Businesses | The BLACQList',
  description:
    'Browse Black-owned businesses across every city, industry, and category. Filter by identity, amenities, price, and hours. Find exactly what you need and support who matters.',
}

interface DiscoverPageProps {
  // The full key set lives in lib/listings/discover-params.ts, which is also
  // what maps it onto queryListings. This page was the only one that read every
  // key; the city page and /search read three of them and dropped the rest.
  searchParams: Promise<DiscoverSearchParams>
}

async function DiscoverContent({
  searchParams,
}: {
  searchParams: DiscoverPageProps['searchParams']
}) {
  const params = await searchParams
  const page = parsePage(params.page)

  // All-or-nothing: a partial or out-of-range location is dropped whole rather
  // than passed through, because the RPC treats a NULL in the triple as "no
  // radius filter" and would answer the entire directory under a Near You label.
  // Read again here for the empty-state links below; parseDiscoverParams runs
  // the same parse for the query itself.
  const location = parseLocationParams(params)

  const supabase = await createClient()
  const [result, { data: cities }, { data: categories }] = await Promise.all([
    queryListings(parseDiscoverParams(params, { withFacets: true })),
    supabase.from('cities').select('name, slug').order('name'),
    // Parents and subcategories both: the sidebar nests them into a tree, and
    // the chips need a subcategory's name or they show its raw slug.
    supabase.from('categories').select('id, name, slug, parent_id').eq('is_active', true),
  ])

  const groups = result.facets?.groups ?? []
  const counts = result.facets?.counts ?? { attribute: {}, price: {}, openNow: 0 }

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE ? buildPageUrl(params, page + 1) : undefined

  // The two ways out of an empty or failed radius search. Shared with the city
  // page and /search, which now receive the radius keys too.
  const { widerRadiusUrl, clearLocationUrl } = buildLocationEscapeUrls(params, '/discover')

  return (
    <div className="flex gap-6 lg:gap-8 items-start">
      {/* Sidebar filters — hidden on mobile, shown on md+ */}
      <div className="hidden md:block w-56 lg:w-64 shrink-0">
        <FacetSidebar
          cities={cities ?? []}
          categories={categories ?? []}
          groups={groups}
          counts={counts}
        />
      </div>

      {/* Results */}
      <div className="flex-1 min-w-0">
        {/* Controls row: mobile filters trigger + sort */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="md:hidden">
            <MobileFilterSheet
              cities={cities ?? []}
              categories={categories ?? []}
              groups={groups}
              counts={counts}
            />
          </div>
          <div className="ml-auto">
            <SortDropdown />
          </div>
        </div>

        <div className="mb-4">
          <ActiveFilterChips groups={groups} categories={categories ?? []} cities={cities ?? []} />
        </div>

        <DiscoveryGrid
          entities={result.entities}
          total={result.total}
          query={params.q}
          nextPageUrl={nextPageUrl}
          currentPage={page}
          radiusMiles={location?.radius ?? null}
          radiusUnavailable={result.radiusUnavailable ?? false}
          filtersUnavailable={result.filtersUnavailable ?? false}
          widerRadiusUrl={widerRadiusUrl}
          clearLocationUrl={clearLocationUrl}
          clearFiltersUrl="/discover"
        />
      </div>
    </div>
  )
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams

  // Old "Open now" links (`?open=now`, `?open_now=true`) land on the canonical
  // `open_now=1` so the sidebar checkbox and chip match the results.
  const canonical = canonicalOpenNowQuery(params)
  if (canonical !== null) redirect(`/discover${canonical}`)

  return (
    <>
      {/* Avenue banner — swaps with the selected type */}
      <DiscoverBanner type={typeof params.type === 'string' ? params.type : null} />

      {/* Search bar header */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-4">
          <Suspense>
            <SearchBar
              placeholder="Search businesses, categories, or cities…"
              targetPath="/discover"
            />
          </Suspense>
        </Container>
      </div>

      {/* Main content */}
      <Container className="py-8">
        <Suspense fallback={<DiscoveryGrid entities={[]} total={0} isLoading />}>
          <DiscoverContent searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
