import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { FacetSidebar } from '@/components/discovery/FacetSidebar'
import { MobileFilterSheet } from '@/components/discovery/MobileFilterSheet'
import { SortDropdown } from '@/components/discovery/SortDropdown'
import { ActiveFilterChips } from '@/components/discovery/ActiveFilterChips'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Discover Black-Owned Businesses | The BLACQList',
  description:
    'Browse Black-owned businesses across every city, industry, and category. Filter by identity, amenities, price, and hours. Find exactly what you need and support who matters.',
}

interface DiscoverPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    category?: string
    city?: string
    trust_tier?: string
    location_type?: string
    price?: string
    attrs?: string
    open_now?: string
    sort?: string
    page?: string
  }>
}

async function DiscoverContent({
  searchParams,
}: {
  searchParams: DiscoverPageProps['searchParams']
}) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)

  const supabase = await createClient()
  const [result, { data: cities }, { data: categories }] = await Promise.all([
    queryListings({
      q: params.q,
      type: params.type,
      category: params.category,
      city: params.city,
      trust_tier: params.trust_tier,
      location_type: params.location_type,
      price: params.price ? params.price.split(',').filter(Boolean) : undefined,
      attrs: params.attrs ? params.attrs.split(',').filter(Boolean) : undefined,
      open_now: params.open_now === '1' || params.open_now === 'true',
      sort: params.sort,
      page,
      withFacets: true,
    }),
    supabase.from('cities').select('name, slug').order('name'),
    supabase
      .from('categories')
      .select('name, slug')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('display_order'),
  ])

  const groups = result.facets?.groups ?? []
  const counts = result.facets?.counts ?? { attribute: {}, price: {}, openNow: 0 }

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE ? buildPageUrl(params, page + 1) : undefined

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
        />
      </div>
    </div>
  )
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  return (
    <>
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
