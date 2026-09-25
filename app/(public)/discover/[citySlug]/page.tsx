import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { parseLocationParams } from '@/lib/listings/location-params'
import {
  buildLocationEscapeUrls,
  parseDiscoverParams,
  parsePage,
  type DiscoverSearchParams,
} from '@/lib/listings/discover-params'
import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { FacetSidebar } from '@/components/discovery/FacetSidebar'
import { MobileFilterSheet } from '@/components/discovery/MobileFilterSheet'
import { SortDropdown } from '@/components/discovery/SortDropdown'
import { ActiveFilterChips } from '@/components/discovery/ActiveFilterChips'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ citySlug: string }>
  // The same key set /discover reads. This page used to declare four of them,
  // which meant a facet arriving on a shared or crawled URL was dropped in
  // silence and the page answered wider than the address bar said.
  searchParams: Promise<Omit<DiscoverSearchParams, 'city'>>
}

type CityRow = {
  id: string
  name: string
  slug: string
  metro_area: string | null
  states: { name: string; code: string } | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getCity(slug: string): Promise<CityRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cities')
    .select('id, name, slug, metro_area, states!cities_state_id_fkey(name, code)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data as CityRow | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug } = await params
  const city = await getCity(citySlug)
  if (!city) return { title: 'Not Found | The BLACQList' }

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const canonicalUrl = `${BASE_URL}/discover/${citySlug}`

  const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name

  const title = `Black-Owned Businesses in ${locationLabel} | The BLACQList`
  const description = `Discover and support Black-owned businesses in ${locationLabel}. Browse restaurants, salons, professional services, and more on The BLACQList.`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `Black-Owned Businesses in ${locationLabel}`,
      description: `Discover Black-owned businesses in ${locationLabel} on The BLACQList.`,
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

// ─── Content (awaits searchParams) ────────────────────────────────────────────

async function CityContent({
  city,
  searchParams,
}: {
  city: CityRow
  searchParams: PageProps['searchParams']
}) {
  const params = await searchParams
  const page = parsePage(params.page)

  const supabase = await createClient()
  const [result, { data: categories }] = await Promise.all([
    queryListings({
      ...parseDiscoverParams(params, { withFacets: true }),
      // The route segment is the city, and it overrides whatever `?city=` says.
      // A visitor on /discover/atlanta with a stale `?city=houston` in the URL is
      // on the Atlanta page and gets Atlanta.
      city: city.slug,
    }),
    // Same sidebar as /discover, so the same full category list.
    supabase.from('categories').select('id, name, slug, parent_id').eq('is_active', true),
  ])

  const groups = result.facets?.groups ?? []
  const counts = result.facets?.counts ?? { attribute: {}, price: {}, openNow: 0 }

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE
      ? // Every param travels to page 2, not just the three this page used to
        // know about — otherwise paging silently widened the result set.
        `/discover/${city.slug}${buildPageUrl({ ...params, city: undefined }, page + 1)}`
      : undefined

  // A city page can still carry a Near You triple: the visitor filtered on
  // /discover and clicked through. The escape links resolve relative to this
  // route, so the base path is the city page, not /discover.
  const basePath = `/discover/${city.slug}`
  const location = parseLocationParams(params)
  const { widerRadiusUrl, clearLocationUrl } = buildLocationEscapeUrls(params, basePath)

  return (
    <div className="flex gap-6 lg:gap-8 items-start">
      {/* The same sidebar as /discover, minus the city picker: the route is the city. */}
      <div className="hidden md:block w-56 lg:w-64 shrink-0">
        <FacetSidebar hideCityFilter categories={categories ?? []} groups={groups} counts={counts} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="md:hidden">
            <MobileFilterSheet
              hideCityFilter
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
          <ActiveFilterChips hideCityFilter groups={groups} categories={categories ?? []} />
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
          clearFiltersUrl={basePath}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CityPage({ params, searchParams }: PageProps) {
  const { citySlug } = await params
  const city = await getCity(citySlug)
  if (!city) notFound()

  const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name

  return (
    <>
      {/* Search bar */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-4">
          <Suspense>
            <SearchBar
              placeholder={`Search businesses in ${city.name}…`}
              targetPath={`/discover/${citySlug}`}
            />
          </Suspense>
        </Container>
      </div>

      {/* City header */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-5">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft mb-2"
          >
            <Link href="/cities" className="hover:text-charcoal transition-colors">
              Cities
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="text-brand-black font-semibold">{locationLabel}</span>
          </nav>
          <h1 className="font-headline text-2xl md:text-3xl text-brand-black">
            Black-Owned Businesses in {city.name}
          </h1>
          {city.metro_area && (
            <p className="font-body text-sm text-charcoal-soft mt-1">{city.metro_area}</p>
          )}
        </Container>
      </div>

      {/* Listings */}
      <Container className="py-8">
        <Suspense fallback={<DiscoveryGrid entities={[]} total={0} isLoading />}>
          <CityContent city={city} searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
