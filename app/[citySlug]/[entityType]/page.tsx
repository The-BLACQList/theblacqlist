import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { Container } from '@/components/layout/container'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'

export const revalidate = 86400
export const dynamicParams = true

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ citySlug: string; entityType: string }>
  searchParams: Promise<{ page?: string }>
}

type CityRow = {
  id: string
  name: string
  slug: string
  states: { name: string; code: string } | null
}

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
}

// ─── Static Params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  // createServiceClient is sync and doesn't need cookies — safe at build time
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('listings')
    .select(
      `
      cities!listings_city_id_fkey(slug),
      categories!listings_category_id_fkey(slug)
    `
    )
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(500)

  if (!data) return []

  const seen = new Set<string>()
  const pairs: { citySlug: string; entityType: string }[] = []

  for (const row of data) {
    const city = row.cities as { slug: string } | null
    const category = row.categories as { slug: string } | null
    if (!city || !category) continue
    const key = `${city.slug}:${category.slug}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ citySlug: city.slug, entityType: category.slug })
  }

  return pairs
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getCity(slug: string): Promise<CityRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cities')
    .select('id, name, slug, states!cities_state_id_fkey(name, code)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data as CityRow | null
}

async function getCategory(slug: string): Promise<CategoryRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data as CategoryRow | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug, entityType } = await params
  const [city, category] = await Promise.all([getCity(citySlug), getCategory(entityType)])
  if (!city || !category) return { title: 'Not Found | The BLACQList' }

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const canonicalUrl = `${BASE_URL}/${citySlug}/${entityType}`
  const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name

  const title = `${category.name} in ${locationLabel}: Black-Owned Businesses | The BLACQList`
  const description = `Discover Black-owned ${category.name.toLowerCase()} businesses in ${locationLabel}. Browse and support local on The BLACQList.`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${category.name} in ${locationLabel}`,
      description,
      url: canonicalUrl,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Content ──────────────────────────────────────────────────────────────────

async function CategoryContent({
  city,
  category,
  searchParams,
}: {
  city: CityRow
  category: CategoryRow
  searchParams: PageProps['searchParams']
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  const result = await queryListings({ city: city.slug, category: category.slug, page })

  if (result.entities.length === 0 && page === 1) {
    const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name
    return (
      <div className="rounded-xl bg-pale-lavender px-8 py-10 text-center space-y-4">
        <p className="font-headline text-xl text-brand-black">
          No {category.name} listings in {city.name} yet
        </p>
        <p className="font-body text-sm text-charcoal leading-relaxed">
          This category is growing. Check back soon, or browse all businesses in {locationLabel}.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href={`/discover/${city.slug}`}
            className="inline-block rounded-full bg-amber-gold px-5 py-2 font-subhead text-sm font-semibold text-brand-black hover:bg-light-gold transition-colors"
          >
            Browse all in {city.name}
          </Link>
          <Link
            href="/add-business"
            className="inline-block rounded-full border border-amber-gold px-5 py-2 font-subhead text-sm font-semibold text-amber hover:bg-amber-gold hover:text-brand-black transition-colors"
          >
            Add your business
          </Link>
        </div>
      </div>
    )
  }

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE
      ? `/${city.slug}/${category.slug}${page + 1 > 1 ? `?page=${page + 1}` : ''}`
      : undefined

  return (
    <DiscoveryGrid
      entities={result.entities}
      total={result.total}
      nextPageUrl={nextPageUrl}
      currentPage={page}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CityCategoryPage({ params, searchParams }: PageProps) {
  const { citySlug, entityType } = await params
  const [city, category] = await Promise.all([getCity(citySlug), getCategory(entityType)])

  if (!city || !category) notFound()

  const locationLabel = city.states ? `${city.name}, ${city.states.code}` : city.name

  return (
    <>
      {/* Page header */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-5">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft mb-2"
          >
            <Link href="/" className="hover:text-charcoal transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <Link href={`/discover/${city.slug}`} className="hover:text-charcoal transition-colors">
              {locationLabel}
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="text-brand-black font-semibold">{category.name}</span>
          </nav>

          <h1 className="font-headline text-2xl md:text-3xl text-brand-black">
            {category.name} in {city.name}
          </h1>

          {category.description && (
            <p className="font-body text-sm text-charcoal-soft mt-1 max-w-xl">
              {category.description}
            </p>
          )}
        </Container>
      </div>

      {/* Listings */}
      <Container className="py-8">
        <Suspense fallback={<DiscoveryGrid entities={[]} total={0} isLoading />}>
          <CategoryContent city={city} category={category} searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
