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

export type SortKey = 'relevance' | 'rating' | 'reviews' | 'newest' | 'name' | 'saves'
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'newest', label: 'Newest' },
  { value: 'saves', label: 'Most saved' },
  { value: 'name', label: 'Name (A–Z)' },
]
export const SORT_KEYS = SORT_OPTIONS.map((o) => o.value)

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
}

/** Raw (URL) facet inputs before slug → id resolution. */
export interface RawFacetParams {
  q?: string
  category?: string
  city?: string
  type?: string
  trust_tier?: string
  location_type?: string
  price?: string[]
  attrs?: string[]
  open_now?: boolean
}

/** Resolved RPC arguments (ids instead of slugs). */
export interface ResolvedFacetParams {
  p_q: string | null
  p_category_id: string | null
  p_city_id: string | null
  p_entity_type: string | null
  p_trust_tier: string | null
  p_location_type: string | null
  p_price_ranges: string[] | null
  p_attribute_values: string[] | null
  p_open_now: boolean | null
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

/** Resolves category/city/attribute slugs to ids and assembles the RPC args. */
export async function resolveFacetParams(
  supabase: AnyClient,
  raw: RawFacetParams
): Promise<ResolvedFacetParams> {
  const [categoryRes, cityRes, attrRes] = await Promise.all([
    raw.category
      ? supabase.from('categories').select('id').eq('slug', raw.category).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.city
      ? supabase.from('cities').select('id').eq('slug', raw.city).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.attrs && raw.attrs.length > 0
      ? supabase.from('attribute_values').select('id').in('slug', raw.attrs)
      : Promise.resolve({ data: [] }),
  ])

  const categoryId = (categoryRes.data as { id: string } | null)?.id ?? null
  const cityId = (cityRes.data as { id: string } | null)?.id ?? null
  const attrIds = ((attrRes.data as { id: string }[] | null) ?? []).map((r) => r.id)

  const price = raw.price?.filter((p): p is PriceRange => (PRICE_RANGES as string[]).includes(p)) ?? []

  return {
    p_q: raw.q?.trim() || null,
    p_category_id: categoryId,
    p_city_id: cityId,
    p_entity_type: raw.type || null,
    p_trust_tier: raw.trust_tier || null,
    p_location_type: raw.location_type || null,
    p_price_ranges: price.length > 0 ? price : null,
    p_attribute_values: attrIds.length > 0 ? attrIds : null,
    p_open_now: raw.open_now ? true : null,
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
  if (resolved.p_location_type) q = q.eq('location_type', resolved.p_location_type)
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
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(
    'facet_counts',
    resolved as unknown as Record<string, unknown>
  )

  const counts: FacetCounts = { attribute: {}, price: {}, openNow: 0 }
  if (error) return counts

  const rows = (data as Array<{ facet_kind: string; facet_key: string; facet_count: number }> | null) ?? []
  for (const row of rows) {
    const n = Number(row.facet_count)
    if (row.facet_kind === 'attribute') counts.attribute[row.facet_key] = n
    else if (row.facet_kind === 'price') counts.price[row.facet_key] = n
    else if (row.facet_kind === 'open_now') counts.openNow = n
  }
  return counts
}
