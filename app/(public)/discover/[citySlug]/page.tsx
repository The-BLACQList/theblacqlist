import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { Container } from '@/components/layout/container'
import { SearchBar } from '@/components/discovery/SearchBar'
import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ citySlug: string }>
  searchParams: Promise<{
    q?: string
    type?: string
    category?: string
    page?: string
  }>
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
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  const result = await queryListings({
    city: city.slug,
    q: params.q,
    type: params.type,
    category: params.category,
    page,
  })

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE
      ? `/discover/${city.slug}${buildPageUrl(
          { q: params.q, type: params.type, category: params.category },
          page + 1
        )}`
      : undefined

  return (
    <div className="flex gap-6 lg:gap-8 items-start">
      <div className="hidden md:block w-48 lg:w-56 shrink-0">
        <DiscoveryFilters hideCityFilter cities={[]} />
      </div>
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

      {/* Mobile filter note */}
      <div className="md:hidden border-b border-charcoal/10 bg-white">
        <Container className="py-3">
          <p className="text-xs font-subhead text-charcoal-soft">
            Filters available on desktop · Full mobile filters coming soon
          </p>
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
