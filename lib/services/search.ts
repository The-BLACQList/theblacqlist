import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import {
  resolveFacetParams,
  searchFacetedIds,
  categoryWithChildren,
  hasUnresolved,
  SORT_KEYS,
  type SortKey,
  type UnresolvedFacets,
} from '@/lib/listings/facets'
import { typeOrFilter } from '@/lib/listings/type-shortcuts'
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
    ownership: params.ownership,
    price: params.price,
    attrs: params.attrs,
    open_now: params.open_now,
    lat: params.lat,
    lng: params.lng,
    radius: params.radius,
  })

  if (hasUnresolved(unresolved)) throw new UnknownFilterValueError(unresolved)

  const cityId = resolved.p_city_id
  const categoryId = resolved.p_category_id

  // Deep facets (attributes / price / open-now / radius) are implemented only in
  // search_listings_faceted — PostgREST cannot express them against this table.
  // Requests that use one go through the RPC.
  //
  // `q` is in this condition as of 20260922000000_search_recall.sql. It used to
  // take the PostgREST branch below, which ran a bare
  // websearch_to_tsquery('english') and then patched thin results with a
  // separate search_by_similarity RPC. That is a SECOND, different definition of
  // "what matches", and it drifted from the one /discover uses: the founder's
  // "dentist" query returned nothing here while /discover's RPC path was the
  // thing actually being fixed. Recall now lives in exactly one place — the
  // function — so a query can never mean two things depending on which page
  // asked. The old pg_trgm fallback is gone with it; the RPC's
  // word_similarity() clause is its replacement and is strictly wider (it reads
  // tagline and category name, not just name).
  //
  // That fallback was also dead code, not a working feature being traded away:
  // search_by_similarity is defined in no migration in this repo and does not
  // exist in the production database — `select proname from pg_proc where
  // proname like '%similarity%'` returns only pg_trgm's own functions
  // [Measured — production SQL, 2026-09-22]. Every call it made errored, was
  // swallowed, and added nothing. The comment it carried ("the typeahead
  // depends on it") was false in production.
  //
  // sort=distance is in this condition for the same reason as the radius: the
  // PostgREST branch below has no distance to order by, so it would answer 200
  // with an arbitrary order for a sort the caller explicitly asked for.
  // searchSchema already rejects sort=distance without coordinates, so reaching
  // here with it means the coordinates are present and the RPC can honor it.
  if (
    q ||
    resolved.p_attribute_values ||
    resolved.p_price_ranges ||
    resolved.p_open_now ||
    resolved.p_radius_miles !== null ||
    params.sort === 'distance'
  ) {
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
      const { data: facetRows } = await supabase
        .from('listings')
        .select(SELECT)
        .in('id', faceted.ids)
      const byId = new Map<string, SearchResult>()
      for (const raw of (facetRows as unknown as RawSearchRow[]) ?? [])
        byId.set(raw.id, mapRow(raw))
      // .in() does not preserve order — restore the RPC's ranking.
      results = faceted.ids.map((id) => byId.get(id)).filter((r): r is SearchResult => !!r)
    }

    // Coordinates are deliberately NOT passed here and must never be added.
    // They are precise enough to place a person at an address; the query is the
    // only thing entitled to see them, and analytics_events is retained. City
    // and category are the coarse location signal this event is allowed to
    // carry. See data-privacy.md ("minimize what you pull").
    void logSearchEvent(q, faceted.total, cityId, categoryId)
    return { results, total: faceted.total }
  }

  // Reached only when there is NO query string: a plain browse by city,
  // category, type, trust tier, or location type. PostgREST expresses all of
  // those exactly, and with no `q` there is no relevance to compute, so there is
  // nothing here that could disagree with the RPC.
  let query = supabase
    .from('listings')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('flag_status', 'none')

  if (cityId) query = query.eq('city_id', cityId)
  // A parent category means itself plus its subcategories, and a Type shortcut
  // means its mapped categories and location types, both exactly as the RPC
  // reads them. Browsing Food & Dining used to miss every listing filed under a
  // Food & Dining subcategory, and ?type=restaurant matched nothing at all.
  // [Decision — founder, 2026-09-24] "Type shortcuts map to categories."
  if (categoryId) query = query.in('category_id', await categoryWithChildren(supabase, categoryId))
  if (params.type) {
    query =
      resolved.p_type_category_ids || resolved.p_type_location_types
        ? query.or(typeOrFilter(params.type, resolved.p_type_category_ids ?? []))
        : query.eq('entity_type', params.type)
  }
  if (params.trust_tier) query = query.eq('trust_tier', params.trust_tier)
  // `.in()` on a guarded length: `.in('x', [])` matches nothing, so an empty
  // array would empty the page rather than leave the filter off.
  if (params.location_type?.length) {
    query = query.in('location_type', params.location_type)
  }
  // The Ownership facet. Both paths carry it: the RPC branch above gets it via
  // resolveFacetParams, this branch gets it here. Adding it to only one would
  // leave it dead on half the requests, and which half depends on whether a
  // deep facet happens to be present — the worst kind of filter bug to find.
  // Note this is the EQUALITY filter; the .order() calls below are the
  // editorial ordering and are a separate concern.
  if (params.ownership) query = query.eq('ownership_label', params.ownership)

  // Mirrors search_listings_faceted's ORDER BY for the no-keyword case, which is
  // exactly the case this branch handles: sponsored first, then how active and
  // well-kept a listing is, then the same stable tiebreakers.
  // [Decision — founder, 2026-09-21 / refined 2026-09-23] Browse pages with no
  // keyword are pure activity order. The ownership label is shown on every
  // listing and no longer affects order, so the `ownership_label` key that used
  // to sit here is gone.
  // The RPC's match_band and rank keys are constant with no keyword, and its
  // tier_weight key is NULL with no keyword, so they collapse out and these four
  // keys are the whole order in both paths.
  query = query
    .order('is_featured', { ascending: false })
    .order('activity_score', { ascending: false })
    .order('save_count', { ascending: false })
    .order('published_at', { ascending: false })

  const { data, count } = await query.range(offset, offset + limit - 1)
  const results: SearchResult[] = data ? (data as unknown as RawSearchRow[]).map(mapRow) : []
  const total = count ?? 0

  void logSearchEvent(q, total, cityId, categoryId)
  return { results, total }
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
