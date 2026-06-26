import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import type { Json } from '@/lib/supabase/types'
import type { SearchQueryParams } from '@/lib/validations/search'

export interface SearchResult {
  id: string
  name: string
  slug: string
  entity_type: string
  tagline: string | null
  city: { name: string; slug: string } | null
  category: { name: string; slug: string }
  trust_tier: string
  listing_tier: string
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  status: 'published'
  published_at: string
}

type RawSearchRow = {
  id: string
  slug: string
  name: string
  tagline: string | null
  entity_type: string
  trust_tier: string
  tier: string
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  published_at: string | null
  status: string
  categories: { name: string; slug: string } | null
  cities: { name: string; slug: string } | null
}

const SELECT = `
  id, slug, name, tagline, entity_type, trust_tier, tier,
  logo_path, cover_image_path, avg_rating, review_count, save_count,
  published_at, status,
  categories!listings_category_id_fkey(name, slug),
  cities!listings_city_id_fkey(name, slug)
`

function mapRow(raw: RawSearchRow): SearchResult {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline,
    entity_type: raw.entity_type,
    trust_tier: raw.trust_tier,
    listing_tier: raw.tier,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    status: 'published',
    published_at: raw.published_at ?? '',
    city: raw.cities ?? null,
    category: raw.categories ?? { name: 'General', slug: 'general' },
  }
}

export async function searchListings(
  params: SearchQueryParams
): Promise<{ results: SearchResult[]; total: number }> {
  const supabase = await createClient()
  const q = params.q?.trim() || undefined
  const limit = params.limit
  const offset = (params.page - 1) * limit

  const [cityResult, categoryResult] = await Promise.all([
    params.city
      ? supabase
          .from('cities')
          .select('id')
          .eq('slug', params.city)
          .eq('is_active', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    params.category
      ? supabase
          .from('categories')
          .select('id')
          .eq('slug', params.category)
          .eq('is_active', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let query = supabase
    .from('listings')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('flag_status', 'none')

  if (cityResult.data?.id) query = query.eq('city_id', cityResult.data.id)
  if (categoryResult.data?.id) query = query.eq('category_id', categoryResult.data.id)
  if (params.type) query = query.eq('entity_type', params.type)
  if (params.trust_tier) query = query.eq('trust_tier', params.trust_tier)
  if (params.location_type) query = query.eq('location_type', params.location_type)

  if (q) {
    query = query
      .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
      .order('published_at', { ascending: false })
  } else {
    query = query
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false })
  }

  const { data, count } = await query.range(offset, offset + limit - 1)
  const ftsResults: SearchResult[] = data ? (data as unknown as RawSearchRow[]).map(mapRow) : []
  const ftsTotal = count ?? 0

  // pg_trgm fallback: when FTS returns < 5 results and a query was provided.
  // Requires the pg_trgm extension and search_by_similarity function in Supabase.
  // Falls back to ilike partial matching if the function is unavailable.
  if (q && ftsResults.length < 5) {
    const ftsIds = new Set(ftsResults.map((r) => r.id))
    const fallbackLimit = limit - ftsResults.length
    let fallbackResults: SearchResult[] = []

    try {
      const { data: simIds, error } = await (
        supabase.rpc as (
          fn: string,
          args: Record<string, unknown>
        ) => ReturnType<typeof supabase.rpc>
      )('search_by_similarity', {
        name_query: q,
        threshold: 0.25,
        exclude_ids: Array.from(ftsIds),
        result_limit: fallbackLimit,
      })

      if (error) throw error

      if (simIds && Array.isArray(simIds) && simIds.length > 0) {
        const ids = (simIds as Array<{ id: string }>).map((r) => r.id)
        const { data: simRows } = await supabase
          .from('listings')
          .select(SELECT)
          .in('id', ids)
          .eq('status', 'published')
          .is('deleted_at', null)
          .eq('flag_status', 'none')
        fallbackResults = simRows ? (simRows as unknown as RawSearchRow[]).map(mapRow) : []
      }
    } catch {
      // pg_trgm not available — use ilike for partial name matching
      const { data: ilikeRows } = await supabase
        .from('listings')
        .select(SELECT)
        .ilike('name', `%${q}%`)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('flag_status', 'none')
        .order('published_at', { ascending: false })
        .limit(fallbackLimit)

      fallbackResults = ilikeRows
        ? (ilikeRows as unknown as RawSearchRow[])
            .map(mapRow)
            .filter((r) => !ftsIds.has(r.id))
        : []
    }

    const combined = [...ftsResults, ...fallbackResults]
    void logSearchEvent(q, combined.length, cityResult.data?.id, categoryResult.data?.id)
    return { results: combined, total: Math.max(ftsTotal, combined.length) }
  }

  void logSearchEvent(q, ftsTotal, cityResult.data?.id, categoryResult.data?.id)
  return { results: ftsResults, total: ftsTotal }
}

function logSearchEvent(
  query: string | undefined,
  resultCount: number,
  cityId: string | undefined | null,
  categoryId: string | undefined | null
): void {
  try {
    const serviceClient = createServiceClient()
    void serviceClient.from('analytics_events').insert({
      event_name: ANALYTICS_EVENTS.SEARCH_PERFORMED,
      properties: {
        query: query ?? null,
        result_count: resultCount,
        city_id: cityId ?? null,
        category_id: categoryId ?? null,
      } as Json,
    })
  } catch {
    // Analytics failures must not affect search responses
  }
}
