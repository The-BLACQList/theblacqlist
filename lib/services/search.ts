import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import {
  resolveFacetParams,
  searchFacetedIds,
  hasUnresolved,
  SORT_KEYS,
  type SortKey,
  type UnresolvedFacets,
} from '@/lib/listings/facets'
import type { Json } from '@/lib/supabase/types'
import type { SearchQueryParams } from '@/lib/validations/search'

/**
 * Thrown when the caller filtered by a slug that does not exist.
 *
 * The alternative — dropping the filter and answering 200 — is what
 * `?city=not-a-real-city` used to do, and it returned the entire directory. A
 * caller cannot tell that apart from "every listing really is in that city," so
 * this is a client error and the route turns it into a 400 (api.md).
 */
export class UnknownFilterValueError extends Error {
  readonly fields: Record<string, string>

  constructor(unresolved: UnresolvedFacets) {
    super('Unknown filter value')
    this.name = 'UnknownFilterValueError'
    const fields: Record<string, string> = {}
    if (unresolved.city) fields.city = `No city with slug "${unresolved.city}".`
    if (unresolved.category) fields.category = `No category with slug "${unresolved.category}".`
    if (unresolved.attrs?.length) {
      fields.attrs = `No attribute with slug ${unresolved.attrs.map((s) => `"${s}"`).join(', ')}.`
    }
    this.fields = fields
  }
}

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

  // One resolution pass shared by both paths below. This replaces the two
  // hand-rolled slug lookups this function used to do, so `city`, `category`,
  // and `attrs` now resolve exactly the way /discover resolves them.
  const { params: resolved, unresolved } = await resolveFacetParams(supabase, {
    q,
    category: params.category,
    city: params.city,
    type: params.type,
    trust_tier: params.trust_tier,
    location_type: params.location_type,
    price: params.price,
    attrs: params.attrs,
    open_now: params.open_now,
  })

  if (hasUnresolved(unresolved)) throw new UnknownFilterValueError(unresolved)

  const cityId = resolved.p_city_id
  const categoryId = resolved.p_category_id

  // Deep facets (attributes / price / open-now) are implemented only in
  // search_listings_faceted — PostgREST cannot express them against this table.
  // Requests that use one go through the RPC; every other request keeps the
  // exact code path it had before, including the pg_trgm fallback the typeahead
  // depends on.
  if (resolved.p_attribute_values || resolved.p_price_ranges || resolved.p_open_now) {
    const sort: SortKey =
      params.sort && (SORT_KEYS as string[]).includes(params.sort)
        ? (params.sort as SortKey)
        : 'relevance'

    const faceted = await searchFacetedIds(supabase, resolved, sort, limit, offset)
    // No legacyFacetedIds fallback here on purpose: that path honors only the
    // scalar filters, so falling back would silently drop the very facets the
    // caller asked for — the defect this checkpoint exists to fix.
    if (faceted.error) throw new Error('Faceted search RPC unavailable')

    let results: SearchResult[] = []
    if (faceted.ids.length > 0) {
      const { data: facetRows } = await supabase.from('listings').select(SELECT).in('id', faceted.ids)
      const byId = new Map<string, SearchResult>()
      for (const raw of (facetRows as unknown as RawSearchRow[]) ?? []) byId.set(raw.id, mapRow(raw))
      // .in() does not preserve order — restore the RPC's ranking.
      results = faceted.ids.map((id) => byId.get(id)).filter((r): r is SearchResult => !!r)
    }

    void logSearchEvent(q, faceted.total, cityId, categoryId)
    return { results, total: faceted.total }
  }

  let query = supabase
    .from('listings')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('flag_status', 'none')

  if (cityId) query = query.eq('city_id', cityId)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (params.type) query = query.eq('entity_type', params.type)
  if (params.trust_tier) query = query.eq('trust_tier', params.trust_tier)
  if (params.location_type) query = query.eq('location_type', params.location_type)

  // Editorial centering: Black-Owned ranks ahead of Ally ('black_owned' > 'ally'
  // lexically, so ascending:false centers Black-Owned). Mirrors the ORDER BY in
  // search_listings_faceted; keeps the typeahead API consistent with browse.
  if (q) {
    query = query
      .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
      .order('ownership_label', { ascending: false })
      .order('published_at', { ascending: false })
  } else {
    query = query
      .order('is_featured', { ascending: false })
      .order('ownership_label', { ascending: false })
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
    void logSearchEvent(q, combined.length, cityId, categoryId)
    return { results: combined, total: Math.max(ftsTotal, combined.length) }
  }

  void logSearchEvent(q, ftsTotal, cityId, categoryId)
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
