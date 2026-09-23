import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { parseLocationParams } from '@/lib/listings/location-params'
import {
  buildLocationEscapeUrls,
  parseDiscoverParams,
  parsePage,
  type DiscoverSearchParams,
} from '@/lib/listings/discover-params'
import { TourWitness } from '@/components/tour/TourWitness'

export const metadata: Metadata = {
  title: 'Search | The BLACQList',
  description:
    'Search for Black-owned businesses by name, category, city, or keyword across The BLACQList national directory.',
}

interface SearchPageProps {
  // The same key set /discover reads — see lib/listings/discover-params.ts.
  searchParams: Promise<DiscoverSearchParams>
}

async function SearchResults({ searchParams }: { searchParams: SearchPageProps['searchParams'] }) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''

  if (!query) {
    return (
      <div className="py-16 text-center">
        <p className="font-headline text-xl text-brand-black mb-2">What are you looking for?</p>
        <p className="font-subhead text-sm text-charcoal">
          Enter a name, category, or keyword above to search the directory.
        </p>
        <p className="font-subhead text-sm text-charcoal mt-4">
          Or{' '}
          <Link
            href="/discover"
            className="text-amber underline underline-offset-2 hover:text-light-gold"
          >
            browse all businesses
          </Link>{' '}
          to explore by category or type.
        </p>
      </div>
    )
  }

  const page = parsePage(params.page)

  const result = await queryListings({
    ...parseDiscoverParams(params),
    // `query` is the trimmed form the empty-state check above already ran on.
    q: query,
  })

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE ? buildPageUrl(params, page + 1) : undefined

  // Read again for the empty-state copy; parseDiscoverParams ran the same parse
  // for the query itself. Both escape links keep `q` — dropping the location is
  // not the same as abandoning the search.
  const location = parseLocationParams(params)
  const { widerRadiusUrl, clearLocationUrl } = buildLocationEscapeUrls(params, '/search')

  return (
    <>
      {/* Tour evidence: a real search ran in this render. Sits after the
          empty-query early return — visiting /search is not searching. */}
      <TourWitness step="search_ran" />
      <DiscoveryGrid
        entities={result.entities}
        total={result.total}
        query={query}
        nextPageUrl={nextPageUrl}
        currentPage={page}
        radiusMiles={location?.radius ?? null}
        radiusUnavailable={result.radiusUnavailable ?? false}
        filtersUnavailable={result.filtersUnavailable ?? false}
        widerRadiusUrl={widerRadiusUrl}
        clearLocationUrl={clearLocationUrl}
        clearFiltersUrl={`/search?q=${encodeURIComponent(query)}`}
      />
    </>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <>
      {/* Search bar */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-4">
          <Suspense>
            <SearchBar
              placeholder="Search businesses, categories, or cities…"
              targetPath="/search"
            />
          </Suspense>
        </Container>
      </div>

      {/* Results */}
      <Container className="py-8">
        <Suspense fallback={<DiscoveryGrid entities={[]} total={0} isLoading />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
