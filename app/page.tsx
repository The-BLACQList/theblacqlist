import type { Metadata } from 'next'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NESTED_SELECT, mapRow, type RawRow } from '@/lib/listings/query'
import { buildEntityUrl } from '@/lib/listings/url'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { PRODUCTS_SERVICES_LOCATION_TYPES } from '@/lib/constants/listing'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeTriptych } from '@/components/home/HomeTriptych'
import { TheAvenues, type AvenueCounts } from '@/components/home/TheAvenues'
import { HomeCategories, type CategoryTile } from '@/components/home/HomeCategories'
import { FreshFinds } from '@/components/home/FreshFinds'
import { CityChapters, type CityChapter } from '@/components/home/CityChapters'
import { MicrositeShowcase } from '@/components/home/MicrositeShowcase'
import type { ShowcaseItem } from '@/components/home/ShowcaseCarousel'
import { ImpactBand } from '@/components/home/ImpactBand'
import { BlacqlightFeature, type FeaturedArticle } from '@/components/home/BlacqlightFeature'
import { EditorialRail, type RailArticle, type RailGuide } from '@/components/home/EditorialRail'
import { OwnerCta } from '@/components/home/OwnerCta'
import { Reveal } from '@/components/motion/Reveal'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Find & Be Found. | The BLACQList',
  description:
    'The national directory for Black-owned businesses. Built by community, powered by culture. Discover, support, and connect across every city.',
}

interface ShowcaseRaw {
  id: string
  name: string
  slug: string
  entity_type: string
  tagline: string | null
  cover_image_path: string | null
  categories: { name: string } | null
  cities: { slug: string } | null
  services: Array<{ name: string; price_display: string | null; display_order: number }>
}

export default async function HomePage() {
  const supabase = await createClient()
  const service = createServiceClient()

  const [
    categoriesRes,
    listingFacetRes,
    citiesRes,
    freshRes,
    showcaseRes,
    spendRes,
    articlesRes,
    guidesRes,
    guideSectionsRes,
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('listings')
      .select('category_id, city_id, entity_type, location_type')
      .eq('status', 'published')
      .is('deleted_at', null),
    supabase
      .from('cities')
      .select('id, name, slug, is_active, states!cities_state_id_fkey(code)')
      .order('name'),
    // Fresh Finds: newest first, no tier or is_featured gating. `published_at`
    // is nullable, so `created_at` (NOT NULL DEFAULT now()) is the tiebreak
    // floor — same definition of "newest" the search RPC already uses.
    supabase
      .from('listings')
      .select(NESTED_SELECT)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('listings')
      .select(
        'id, name, slug, entity_type, tagline, cover_image_path, categories!listings_category_id_fkey(name), cities!listings_city_id_fkey(slug), services(name, price_display, display_order)'
      )
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('save_count', { ascending: false })
      .limit(12),
    service.from('spend_events').select('amount_cents, listing_id').eq('aggregate_opt_out', false),
    // Editorial: the newest article anchors the `BlacqlightFeature` hero and
    // the rest fall into the rail beneath it, so this needs the hero's one
    // row plus a rail's worth. Both editorial tables carry a
    // `(status, published_at DESC)` index from the foundation migration.
    supabase
      .from('editorial_articles')
      .select('title, slug, subtitle, author_name, published_at, tags')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5),
    supabase
      .from('guides')
      .select('id, title, slug, subtitle, city')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(4),
    // Section counts for the guide cards. Unscoped by guide id on purpose:
    // keeping it in this batch costs no extra round trip, where an `.in()`
    // scoped to the four guides above would have to wait for them. It is a
    // single narrow column off a small table, and the page caches for 30
    // minutes. Revisit if `guide_sections` ever grows large.
    supabase.from('guide_sections').select('guide_id'),
  ])

  // Live counts per category and city from one published-listings scan
  const categoryCounts = new Map<string, number>()
  const cityCounts = new Map<string, number>()
  const typeCounts = new Map<string, number>()
  // Counted separately from typeCounts because this avenue is binned by
  // location_type, not entity_type — see PRODUCTS_SERVICES_LOCATION_TYPES.
  const productsServices: Set<string> = new Set(PRODUCTS_SERVICES_LOCATION_TYPES)
  let productsServicesCount = 0
  for (const row of listingFacetRes.data ?? []) {
    if (row.category_id)
      categoryCounts.set(row.category_id, (categoryCounts.get(row.category_id) ?? 0) + 1)
    if (row.city_id) cityCounts.set(row.city_id, (cityCounts.get(row.city_id) ?? 0) + 1)
    typeCounts.set(row.entity_type, (typeCounts.get(row.entity_type) ?? 0) + 1)
    if (row.location_type && productsServices.has(row.location_type)) productsServicesCount += 1
  }
  const avenueCounts: AvenueCounts = {
    // Brick & Mortar is still entity_type, matching its own unchanged href. The
    // two bins can therefore overlap — an online-only `business` is counted in
    // both — but each tile's number matches the page it links to, which is the
    // only thing either tile has ever claimed.
    brick: (typeCounts.get('business') ?? 0) + (typeCounts.get('restaurant') ?? 0),
    products: productsServicesCount,
    professionals: typeCounts.get('professional') ?? 0,
    creatives: typeCounts.get('creative') ?? 0,
    events: typeCounts.get('event') ?? 0,
  }
  const categories: CategoryTile[] = (categoriesRes.data ?? [])
    .map((c) => ({ name: c.name, slug: c.slug, count: categoryCounts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const cities: CityChapter[] = (citiesRes.data ?? []).map((c) => ({
    name: c.name,
    slug: c.slug,
    stateCode: (c.states as unknown as { code: string } | null)?.code ?? '',
    count: cityCounts.get(c.id) ?? 0,
    isActive: c.is_active,
  }))

  const freshFinds = ((freshRes.data ?? []) as unknown as RawRow[]).map(mapRow)

  // Showcase carousel: real pages, preferring distinct entity types with covers
  const showcaseRaw = (showcaseRes.data ?? []) as unknown as ShowcaseRaw[]
  const withCover = showcaseRaw.filter((l) => l.cover_image_path)
  const pool = withCover.length >= 3 ? withCover : showcaseRaw
  const seenTypes = new Set<string>()
  const picked: ShowcaseRaw[] = []
  for (const listing of pool) {
    if (!seenTypes.has(listing.entity_type)) {
      picked.push(listing)
      seenTypes.add(listing.entity_type)
    }
    if (picked.length === 3) break
  }
  for (const listing of pool) {
    if (picked.length >= 3) break
    if (!picked.includes(listing)) picked.push(listing)
  }
  const showcaseItems: ShowcaseItem[] = picked.map((l) => ({
    id: l.id,
    name: l.name,
    href: buildEntityUrl(l.entity_type, l.cities?.slug, l.slug),
    categoryName: l.categories?.name ?? null,
    coverSrc: resolveCoverImage(l.cover_image_path, l.entity_type, l.id).src,
    offerings: [...(l.services ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .slice(0, 2)
      .map((s) => ({ name: s.name, price: s.price_display })),
    tagline: l.tagline ?? '',
  }))

  const spendRows = spendRes.data ?? []
  const totalAmountCents = spendRows.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  const uniqueBusinesses = new Set(spendRows.map((r) => r.listing_id)).size

  // The newest article anchors the hero; everything after it falls into the rail.
  const articleRows = articlesRes.data ?? []
  const featured = articleRows[0]
  const article: FeaturedArticle | null = featured
    ? {
        title: featured.title,
        slug: featured.slug,
        subtitle: featured.subtitle,
        authorName: featured.author_name,
        publishedAt: featured.published_at,
      }
    : null

  const railArticles: RailArticle[] = articleRows.slice(1).map((a) => ({
    title: a.title,
    slug: a.slug,
    subtitle: a.subtitle,
    authorName: a.author_name,
    publishedAt: a.published_at,
    tags: a.tags,
  }))

  // Same `sectionMap` shape `app/(public)/guides/page.tsx` builds — one pass
  // over the id column rather than a count query per guide.
  const sectionCounts = new Map<string, number>()
  for (const row of guideSectionsRes.data ?? []) {
    sectionCounts.set(row.guide_id, (sectionCounts.get(row.guide_id) ?? 0) + 1)
  }
  const railGuides: RailGuide[] = (guidesRes.data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    subtitle: g.subtitle,
    city: g.city,
    sectionCount: sectionCounts.get(g.id) ?? 0,
  }))

  return (
    <main className="min-h-screen bg-white">
      <HomeHero />
      <Reveal>
        <TheAvenues counts={avenueCounts} />
      </Reveal>
      <Reveal>
        <HomeTriptych />
      </Reveal>
      <Reveal>
        <HomeCategories categories={categories} />
      </Reveal>
      <Reveal>
        <FreshFinds entities={freshFinds} />
      </Reveal>
      <Reveal>
        <CityChapters cities={cities} />
      </Reveal>
      <Reveal>
        <MicrositeShowcase items={showcaseItems} />
      </Reveal>
      <Reveal>
        <ImpactBand
          totalAmountCents={totalAmountCents}
          totalTransactions={spendRows.length}
          uniqueBusinesses={uniqueBusinesses}
        />
      </Reveal>
      <Reveal>
        <BlacqlightFeature article={article} />
      </Reveal>
      <Reveal>
        <EditorialRail articles={railArticles} guides={railGuides} />
      </Reveal>
      <Reveal>
        <OwnerCta />
      </Reveal>
    </main>
  )
}
