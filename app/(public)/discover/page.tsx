import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Discover Black-Owned Businesses | The BLACQList',
  description:
    'Browse Black-owned businesses across every city, industry, and category. Find exactly what you need and support who matters.',
}

interface DiscoverPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    category?: string
    city?: string
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
  const [result, { data: cities }] = await Promise.all([
    queryListings({
      q: params.q,
      type: params.type,
      category: params.category,
      city: params.city,
      page,
    }),
    supabase.from('cities').select('name, slug').order('name'),
  ])

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE ? buildPageUrl(params, page + 1) : undefined

  return (
    <div className="flex gap-6 lg:gap-8 items-start">
      {/* Sidebar filters — hidden on mobile, shown on md+ */}
      <div className="hidden md:block w-48 lg:w-56 shrink-0">
        <DiscoveryFilters cities={cities ?? []} />
      </div>
      {/* Results */}
      <div className="flex-1 min-w-0">
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
      {/* Search + filter bar header */}
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

      {/* Mobile filter disclosure stub */}
      <div className="md:hidden border-b border-charcoal/10 bg-white">
        <Container className="py-3">
          <p className="text-xs font-subhead text-charcoal/50">
            Filters available on desktop · Full mobile filters coming soon
          </p>
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
