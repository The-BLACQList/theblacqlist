import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Faceted-search support: attribute taxonomy loaders, slug → id resolution,
 * and the two Postgres RPC wrappers (search_listings_faceted, facet_counts).
 *
 * The Supabase generated types do not yet include the new RPCs, so calls go
 * through a thin cast (the same pattern lib/services/search.ts uses for
 * search_by_similarity).
 */

export type PriceRange = '$' | '$$' | '$$$' | '$$$$'
export const PRICE_RANGES: PriceRange[] = ['$', '$$', '$$$', '$$$$']

export type SortKey =
  | 'relevance'
  | 'rating'
  | 'reviews'
  | 'newest'
  | 'name'
  | 'saves'
  | 'distance'

/**
 * The always-available sort choices, in dropdown order.
 *
 * 'distance' is deliberately NOT here: it is only meaningful once the visitor
 * has shared a location, so the UI adds it conditionally (C3.3). SORT_KEYS is
 * the acceptance list and DOES include it — the two used to be the same array,
 * and keeping them identical would have meant either offering a sort that
 * returns an arbitrary order or rejecting a URL the server can honor.
 */
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'newest', label: 'Newest' },
  { value: 'saves', label: 'Most saved' },
  { value: 'name', label: 'Name (A–Z)' },
]

/** The sort option offered only when coordinates are present. */
export const DISTANCE_SORT_OPTION: { value: SortKey; label: string } = {
  value: 'distance',
  label: 'Nearest',
}

export const SORT_KEYS: SortKey[] = [...SORT_OPTIONS.map((o) => o.value), 'distance']

export interface FacetValue {
  id: string
  name: string
  slug: string
  icon: string | null
}

export interface FacetGroupData {
  id: string
  name: string
  slug: string
  input_type: 'checkbox' | 'radio'
  applies_to: string[]
  values: FacetValue[]
}

export interface FacetCounts {
  /** attribute_value id → count */
  attribute: Record<string, number>
  /** price symbol → count */
  price: Record<string, number>
  /** count of listings open now under the current filters */
  openNow: number
  /**
   * True when the counts are absent rather than genuinely zero.
   *
   * The sidebar disables any control whose count is 0, so an all-zero object
   * reads to the visitor as "every one of these filters matches nothing" and
   * greys out the entire panel with no explanation. That is exactly what an
   * unreachable `facet_counts` RPC produced before this flag existed, and it is
   * indistinguishable at the UI from the legitimate all-zero case.
   *
   * When it is set, the controls stay enabled and the count badges are hidden:
   * a filter that might work beats a filter that is definitely dead. Same
   * principle as `radiusUnavailable` on ListingsResult — do not let a failure
   * impersonate an answer.
   */
  countsUnavailable?: boolean
}

/** Raw (URL) facet inputs before slug → id resolution. */
export interface RawFacetParams {
  q?: string
  category?: string
  city?: string
  type?: string
  trust_tier?: string
  /**
   * Multi-select. One URL key holding a CSV, validated elementwise upstream
   * (searchSchema), so an unknown value is a 400 rather than a filter that
   * quietly disappears and widens the page.
   */
  location_type?: string[]
  ownership?: string
  price?: string[]
  attrs?: string[]
  open_now?: boolean
  /** "Near You" — all three or none. Validated upstream (searchSchema). */
  lat?: number
  lng?: number
  radius?: number
}

/**
 * Slugs the caller asked to filter by that do not exist.
 *
 * This type exists because "not asked for" and "asked for, but no such thing"
 * both used to collapse to `null` in ResolvedFacetParams — and `null` means
 * "apply no filter" in search_listings_faceted. So `?city=not-a-real-city`
 * silently dropped the city filter and returned the entire index, which reads
 * to a caller as "every listing is in that city." Keeping the misses separate
 * is what lets a caller answer 400 instead of 200-with-wrong-data.
 */
export interface UnresolvedFacets {
  city?: string
  category?: string
  attrs?: string[]
}

/**
 * The result of resolution: RPC args plus whatever failed to resolve.
 *
 * Deliberately a wrapper rather than extra keys on ResolvedFacetParams —
 * searchFacetedIds and getFacetCounts spread that object straight into the RPC
 * call, and PostgREST rejects an unknown parameter. A wrapper makes that
 * mistake unrepresentable instead of relying on every future RPC wrapper
 * remembering to strip a field.
 */
export interface FacetResolution {
  params: ResolvedFacetParams
  unresolved: UnresolvedFacets
}

/** True when any requested slug failed to resolve. */
export function hasUnresolved(u: UnresolvedFacets): boolean {
  return !!(u.city || u.category || (u.attrs && u.attrs.length > 0))
}

/** Resolved RPC arguments (ids instead of slugs). */
export interface ResolvedFacetParams {
  p_q: string | null
  p_category_id: string | null
  p_city_id: string | null
  p_entity_type: string | null
  p_trust_tier: string | null
  /**
   * The plural arg added by 20260904000000_search_location_types.sql. The
   * singular `p_location_type` still exists in both functions, but nothing here
   * sends it any more — it stays in the database only so the previously
   * deployed code kept working between the migration and this release, and it
   * is dropped in its own migration once that window has closed.
   */
  p_location_types: string[] | null
  p_ownership_label: string | null
  p_price_ranges: string[] | null
  p_attribute_values: string[] | null
  p_open_now: boolean | null
  p_lat: number | null
  p_lng: number | null
  p_radius_miles: number | null
}

// The new tables/RPCs are not in the generated Database types yet, so accept the
// library-default (untyped-schema) client. This lets `.from('attribute_groups')`
// and `.rpc('facet_counts')` resolve without regenerating types.
type AnyClient = SupabaseClient
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

/**
 * Loads active attribute groups with their active values, ordered for display.
 * Filtered to the given entity type via `applies_to` (empty applies_to = all).
 */
export async function loadAttributeGroups(
  supabase: AnyClient,
  entityType?: string
): Promise<FacetGroupData[]> {
  const { data } = await supabase
    .from('attribute_groups')
    .select(
      `id, name, slug, input_type, applies_to, display_order, is_filterable,
       attribute_values(id, name, slug, icon, display_order, is_active)`
    )
    .eq('is_active', true)
    .eq('is_filterable', true)
    .order('display_order')

  const rows = (data ?? []) as unknown as Array<{
    id: string
    name: string
    slug: string
    input_type: 'checkbox' | 'radio'
    applies_to: string[]
    attribute_values: Array<{
      id: string
      name: string
      slug: string
      icon: string | null
      display_order: number
      is_active: boolean
    }> | null
  }>

  return rows
    .filter((g) => {
      if (!entityType) return true
      if (!g.applies_to || g.applies_to.length === 0) return true
      return g.applies_to.includes(entityType)
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      input_type: g.input_type,
      applies_to: g.applies_to ?? [],
      values: (g.attribute_values ?? [])
        .filter((v) => v.is_active)
        .sort((a, b) => a.display_order - b.display_order)
        .map((v) => ({ id: v.id, name: v.name, slug: v.slug, icon: v.icon })),
    }))
    .filter((g) => g.values.length > 0)
}

/**
 * Resolves category/city/attribute slugs to ids and assembles the RPC args,
 * reporting alongside them any requested slug that does not exist.
 *
 * Callers that serve a public contract (app/api/search) should reject on
 * `unresolved` rather than run the query — see UnresolvedFacets.
 */
export async function resolveFacetParams(
  supabase: AnyClient,
  raw: RawFacetParams
): Promise<FacetResolution> {
  const [categoryRes, cityRes, attrRes] = await Promise.all([
    raw.category
      ? supabase.from('categories').select('id').eq('slug', raw.category).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.city
      ? supabase.from('cities').select('id').eq('slug', raw.city).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.attrs && raw.attrs.length > 0
      ? // `slug` is selected as well as `id` so a miss can be named back to the
        // caller — .in() returns only the rows that matched, never the gaps.
        supabase.from('attribute_values').select('id, slug').in('slug', raw.attrs)
      : Promise.resolve({ data: [] }),
  ])

  const categoryId = (categoryRes.data as { id: string } | null)?.id ?? null
  const cityId = (cityRes.data as { id: string } | null)?.id ?? null
  const attrRows = (attrRes.data as { id: string; slug: string }[] | null) ?? []
  const attrIds = attrRows.map((r) => r.id)

  const unresolved: UnresolvedFacets = {}
  if (raw.category && !categoryId) unresolved.category = raw.category
  if (raw.city && !cityId) unresolved.city = raw.city
  if (raw.attrs && raw.attrs.length > 0) {
    const found = new Set(attrRows.map((r) => r.slug))
    const missing = raw.attrs.filter((s) => !found.has(s))
    if (missing.length > 0) unresolved.attrs = missing
  }

  const price = raw.price?.filter((p): p is PriceRange => (PRICE_RANGES as string[]).includes(p)) ?? []

  return {
    params: {
      p_q: raw.q?.trim() || null,
      p_category_id: categoryId,
      p_city_id: cityId,
      p_entity_type: raw.type || null,
      p_trust_tier: raw.trust_tier || null,
      // An empty array is the same as no filter, and it must be sent as NULL:
      // the RPC treats both as inert, but `[]` through PostgREST is a longer
      // way to say nothing and would read as a filter in a logged arg set.
      p_location_types: raw.location_type?.length ? raw.location_type : null,
      p_ownership_label: raw.ownership || null,
      p_price_ranges: price.length > 0 ? price : null,
      p_attribute_values: attrIds.length > 0 ? attrIds : null,
      p_open_now: raw.open_now ? true : null,
      // Passed straight through — there is nothing to resolve, and coordinates
      // must never be persisted. They reach the RPC and stop there; per
      // data-privacy.md they are deliberately absent from logSearchEvent.
      p_lat: raw.lat ?? null,
      p_lng: raw.lng ?? null,
      p_radius_miles: raw.radius ?? null,
    },
    unresolved,
  }
}

/**
 * Runs search_listings_faceted: returns the ordered page of listing ids plus
 * the total match count. Hydration of the rich listing rows happens in the
 * caller (reusing the existing nested SELECT).
 */
export async function searchFacetedIds(
  supabase: AnyClient,
  resolved: ResolvedFacetParams,
  sort: SortKey,
  limit: number,
  offset: number
): Promise<{ ids: string[]; total: number; error: boolean }> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('search_listings_faceted', {
    ...resolved,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  } as unknown as Record<string, unknown>)

  if (error) return { ids: [], total: 0, error: true }

  const rows = (data as Array<{ id: string; total_count: number }> | null) ?? []
  return {
    ids: rows.map((r) => r.id),
    total: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
    error: false,
  }
}

/**
 * Fallback id query via PostgREST, used when the faceted RPC is unavailable
 * (e.g. the migration has not been applied yet). Honors the scalar filters and
 * text search but not price / attributes / open-now (which the RPC owns), so
 * basic browse keeps working even before the RPC is deployed.
 */
export async function legacyFacetedIds(
  supabase: AnyClient,
  resolved: ResolvedFacetParams,
  limit: number,
  offset: number
): Promise<{ ids: string[]; total: number }> {
  let q = supabase
    .from('listings')
    .select('id', { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('flag_status', 'none')

  if (resolved.p_category_id) q = q.eq('category_id', resolved.p_category_id)
  if (resolved.p_city_id) q = q.eq('city_id', resolved.p_city_id)
  if (resolved.p_entity_type) q = q.eq('entity_type', resolved.p_entity_type)
  if (resolved.p_trust_tier) q = q.eq('trust_tier', resolved.p_trust_tier)
  // `.in()` rather than `.eq()`, and guarded on length: `.in('x', [])` compiles
  // to `x=in.()`, which matches nothing — so an empty array here would empty
  // the page instead of leaving the filter off, the same trap the RPC's
  // array_length test avoids on the SQL side.
  if (resolved.p_location_types?.length) {
    q = q.in('location_type', resolved.p_location_types)
  }
  if (resolved.p_ownership_label) q = q.eq('ownership_label', resolved.p_ownership_label)
  if (resolved.p_q) {
    q = q.textSearch('search_vector', resolved.p_q, { type: 'websearch', config: 'english' })
  }

  const { data, count } = await q
    .order('is_featured', { ascending: false })
    .order('save_count', { ascending: false })
    .range(offset, offset + limit - 1)

  const ids = ((data as { id: string }[] | null) ?? []).map((r) => r.id)
  return { ids, total: count ?? 0 }
}

/** Runs facet_counts and shapes the result into a FacetCounts map. */
export async function getFacetCounts(
  supabase: AnyClient,
  resolved: ResolvedFacetParams
): Promise<FacetCounts> {
  // facet_counts does not take an ownership arg (the Ownership control shows no
  // per-option counts, like Trust Level). Strip it so PostgREST doesn't reject
  // the call for an unknown parameter. Ownership still filters the actual result
  // set via search_listings_faceted.
  const { p_ownership_label: _ownership, ...countArgs } = resolved
  void _ownership
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(
    'facet_counts',
    countArgs as unknown as Record<string, unknown>
  )

  const counts: FacetCounts = { attribute: {}, price: {}, openNow: 0 }
  // Not zero counts. No counts. The sidebar needs to know which one it got.
  if (error) return { ...counts, countsUnavailable: true }

  const rows = (data as Array<{ facet_kind: string; facet_key: string; facet_count: number }> | null) ?? []
  for (const row of rows) {
    const n = Number(row.facet_count)
    if (row.facet_kind === 'attribute') counts.attribute[row.facet_key] = n
    else if (row.facet_kind === 'price') counts.price[row.facet_key] = n
    else if (row.facet_kind === 'open_now') counts.openNow = n
  }
  return counts
}
