import { createClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'

export const LISTINGS_PAGE_SIZE = 24

export interface ListingsParams {
  q?: string
  type?: string
  category?: string
  city?: string
  page?: number
}

export interface ListingsResult {
  entities: DiscoveryEntity[]
  total: number
  page: number
  pageSize: number
}

type RawRow = {
  id: string
  slug: string
  name: string
  tagline: string | null
  entity_type: string
  location_type: string
  trust_tier: string
  tier: string
  is_featured: boolean
  is_sponsored: boolean
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  categories: { name: string; slug: string } | null
  cities: { name: string; slug: string; states: { code: string } | null } | null
  listing_details_business: { description: string | null } | null
}

function mapRow(raw: RawRow): DiscoveryEntity {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline ?? '',
    description: raw.listing_details_business?.description ?? '',
    entity_type: raw.entity_type as DiscoveryEntity['entity_type'],
    location_type: raw.location_type as DiscoveryEntity['location_type'],
    trust_tier: raw.trust_tier as DiscoveryEntity['trust_tier'],
    tier: raw.tier as DiscoveryEntity['tier'],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    category: raw.categories ?? { name: 'General', slug: 'general' },
    city: raw.cities
      ? {
          name: raw.cities.name,
          slug: raw.cities.slug,
          state_abbr: raw.cities.states?.code ?? '',
        }
      : null,
  }
}

export async function queryListings(params: ListingsParams): Promise<ListingsResult> {
  const supabase = await createClient()
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * LISTINGS_PAGE_SIZE

  // Resolve category slug → ID (parallel with city lookup)
  const [categoryResult, cityResult] = await Promise.all([
    params.category
      ? supabase.from('categories').select('id').eq('slug', params.category).single()
      : Promise.resolve({ data: null }),
    params.city
      ? supabase.from('cities').select('id').eq('slug', params.city).single()
      : Promise.resolve({ data: null }),
  ])

  let query = supabase
    .from('listings')
    .select(
      `
      id, slug, name, tagline, entity_type, location_type, trust_tier, tier,
      is_featured, is_sponsored, logo_path, cover_image_path,
      avg_rating, review_count, save_count,
      categories!listings_category_id_fkey(name, slug),
      cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
      listing_details_business(description)
    `,
      { count: 'exact' }
    )
    .eq('status', 'published')
    .is('deleted_at', null)

  // Full-text search on weighted search_vector column
  if (params.q?.trim()) {
    query = query.textSearch('search_vector', params.q.trim(), {
      type: 'websearch',
      config: 'english',
    })
  }

  if (params.type) {
    query = query.eq('entity_type', params.type)
  }

  if (categoryResult.data?.id) {
    query = query.eq('category_id', categoryResult.data.id)
  }

  if (cityResult.data?.id) {
    query = query.eq('city_id', cityResult.data.id)
  }

  const { data, count } = await query
    .order('is_featured', { ascending: false })
    .order('save_count', { ascending: false })
    .range(offset, offset + LISTINGS_PAGE_SIZE - 1)

  const organicEntities: DiscoveryEntity[] = data ? (data as unknown as RawRow[]).map(mapRow) : []

  // Inject sponsored placements on page 1 only.
  if (page === 1) {
    const now = new Date().toISOString()
    let spQuery = supabase
      .from('sponsored_placements')
      .select(
        `
        position,
        listings!sponsored_placements_listing_id_fkey(
          id, slug, name, tagline, entity_type, location_type, trust_tier, tier,
          is_featured, is_sponsored, logo_path, cover_image_path,
          avg_rating, review_count, save_count,
          categories!listings_category_id_fkey(name, slug),
          cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
          listing_details_business(description)
        )
      `
      )
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('position', { ascending: true })
      .limit(3)

    if (cityResult.data?.id) {
      spQuery = spQuery.or(`city_id.eq.${cityResult.data.id},city_id.is.null`)
    }
    if (categoryResult.data?.id) {
      spQuery = spQuery.or(`category_id.eq.${categoryResult.data.id},category_id.is.null`)
    }

    const { data: spRows } = await spQuery

    if (spRows && spRows.length > 0) {
      const sponsoredIds = new Set<string>()
      const toInject: Array<{ position: number; entity: DiscoveryEntity }> = []

      for (const sp of spRows) {
        const raw = sp.listings as unknown as RawRow | null
        if (!raw) continue
        const entity = { ...mapRow(raw), is_sponsored: true }
        sponsoredIds.add(entity.id)
        toInject.push({ position: sp.position ?? 1, entity })
      }

      // Remove sponsored listings from organic results to avoid duplicates
      const filtered = organicEntities.filter((e) => !sponsoredIds.has(e.id))

      // Splice sponsored entries at their configured 1-based positions
      const result = [...filtered]
      for (const { position, entity } of toInject.sort((a, b) => a.position - b.position)) {
        const idx = Math.min(position - 1, result.length)
        result.splice(idx, 0, entity)
      }

      return {
        entities: result,
        total: count ?? 0,
        page,
        pageSize: LISTINGS_PAGE_SIZE,
      }
    }
  }

  return {
    entities: organicEntities,
    total: count ?? 0,
    page,
    pageSize: LISTINGS_PAGE_SIZE,
  }
}
