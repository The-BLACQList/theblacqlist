import { createClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'
import {
  resolveFacetParams,
  searchFacetedIds,
  legacyFacetedIds,
  getFacetCounts,
  loadAttributeGroups,
  SORT_KEYS,
  type SortKey,
  type FacetGroupData,
  type FacetCounts,
} from '@/lib/listings/facets'

export const LISTINGS_PAGE_SIZE = 24

export interface ListingsParams {
  q?: string
  type?: string
  category?: string
  city?: string
  trust_tier?: string
  location_type?: string
  ownership?: string
  price?: string[]
  attrs?: string[]
  open_now?: boolean
  sort?: string
  page?: number
  /** When true, also load attribute groups + facet counts for the sidebar. */
  withFacets?: boolean
}

export interface ListingsResult {
  entities: DiscoveryEntity[]
  total: number
  page: number
  pageSize: number
  facets?: { groups: FacetGroupData[]; counts: FacetCounts }
}

export type RawRow = {
  id: string
  slug: string
  name: string
  tagline: string | null
  entity_type: string
  location_type: string
  trust_tier: string
  tier: string
  ownership_label: string
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

export const NESTED_SELECT = `
  id, slug, name, tagline, entity_type, location_type, trust_tier, tier,
  ownership_label,
  is_featured, is_sponsored, logo_path, cover_image_path,
  avg_rating, review_count, save_count,
  categories!listings_category_id_fkey(name, slug),
  cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
  listing_details_business(description)
`

const IDENTITY_GROUP_ID = 'a1000000-0000-0000-0000-000000000001'

export function mapRow(raw: RawRow): DiscoveryEntity {
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
    ownership_label: raw.ownership_label as DiscoveryEntity['ownership_label'],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    identity_chips: [],
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

// listing_attributes is a newer table. Query it SEPARATELY (not embedded in the
// listings select) so a database without the attributes migration still returns
// listings — the embed would otherwise error and zero out discovery results.
// Fails soft: if the table/data is absent, entities keep their empty chip list.
type LooseAttrQuery = {
  from: (t: string) => {
    select: (q: string) => {
      in: (c: string, v: string[]) => Promise<{ data: unknown; error: unknown }>
    }
  }
}

async function attachIdentityChips(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entities: DiscoveryEntity[]
): Promise<void> {
  if (entities.length === 0) return
  const ids = entities.map((e) => e.id)
  const { data, error } = await (supabase as unknown as LooseAttrQuery)
    .from('listing_attributes')
    .select('listing_id, attribute_values(name, slug, group_id)')
    .in('listing_id', ids)
  if (error || !data) return

  const byListing = new Map<string, string[]>()
  for (const row of data as Array<{
    listing_id: string
    attribute_values: { name: string; slug: string; group_id: string } | null
  }>) {
    const v = row.attribute_values
    if (!v || v.group_id !== IDENTITY_GROUP_ID || v.slug === 'black-owned') continue
    const arr = byListing.get(row.listing_id) ?? []
    if (arr.length < 2) arr.push(v.name)
    byListing.set(row.listing_id, arr)
  }
  for (const e of entities) e.identity_chips = byListing.get(e.id) ?? []
}

// Event start dates fetched separately (same fail-soft pattern) so event cards can
// show a date without joining listing_details_event into the discovery select.
async function attachEventStartDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entities: DiscoveryEntity[]
): Promise<void> {
  const eventIds = entities.filter((e) => e.entity_type === 'event').map((e) => e.id)
  if (eventIds.length === 0) return
  const { data, error } = await (supabase as unknown as LooseAttrQuery)
    .from('listing_details_event')
    .select('listing_id, starts_at')
    .in('listing_id', eventIds)
  if (error || !data) return
  const byListing = new Map<string, string>()
  for (const row of data as Array<{ listing_id: string; starts_at: string }>) {
    byListing.set(row.listing_id, row.starts_at)
  }
  for (const e of entities) {
    if (e.entity_type === 'event') e.event_starts_at = byListing.get(e.id) ?? null
  }
}

// Per-user save state fetched separately (fail-soft) so discover cards show the
// correct saved/unsaved icon. Anon users (no userId) get isSaved=false.
async function attachSavedState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
  entities: DiscoveryEntity[]
): Promise<void> {
  if (entities.length === 0) return
  if (!userId) {
    for (const e of entities) e.isSaved = false
    return
  }
  const ids = entities.map((e) => e.id)
  const { data, error } = await supabase
    .from('saves')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', ids)
  if (error || !data) {
    for (const e of entities) e.isSaved = false
    return
  }
  const saved = new Set((data as Array<{ listing_id: string }>).map((r) => r.listing_id))
  for (const e of entities) e.isSaved = saved.has(e.id)
}

export async function queryListings(params: ListingsParams): Promise<ListingsResult> {
  const supabase = await createClient()
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * LISTINGS_PAGE_SIZE
  const sort: SortKey =
    params.sort && (SORT_KEYS as string[]).includes(params.sort)
      ? (params.sort as SortKey)
      : 'relevance'

  const resolved = await resolveFacetParams(supabase, {
    q: params.q,
    category: params.category,
    city: params.city,
    type: params.type,
    trust_tier: params.trust_tier,
    location_type: params.location_type,
    ownership: params.ownership,
    price: params.price,
    attrs: params.attrs,
    open_now: params.open_now,
  })

  // When the user is actively faceting (attributes / price / open-now), suppress
  // sponsored injection so off-filter sponsored listings don't appear.
  const deepFilter = !!(
    resolved.p_attribute_values ||
    resolved.p_price_ranges ||
    resolved.p_open_now
  )
  const wantFacets = !!params.withFacets

  // Build the sponsored query (page 1, no deep filter) so it runs in parallel.
  let spQueryPromise: Promise<{ data: unknown[] | null }> | null = null
  if (page === 1 && !deepFilter) {
    const now = new Date().toISOString()
    let spQuery = supabase
      .from('sponsored_placements')
      .select(
        `
        position,
        listings!sponsored_placements_listing_id_fkey(${NESTED_SELECT})
      `
      )
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('position', { ascending: true })
      .limit(3)

    if (resolved.p_city_id) {
      spQuery = spQuery.or(`city_id.eq.${resolved.p_city_id},city_id.is.null`)
    }
    if (resolved.p_category_id) {
      spQuery = spQuery.or(`category_id.eq.${resolved.p_category_id},category_id.is.null`)
    }
    spQueryPromise = spQuery as unknown as Promise<{ data: unknown[] | null }>
  }

  const [searchResult, counts, groups, spResult] = await Promise.all([
    searchFacetedIds(supabase, resolved, sort, LISTINGS_PAGE_SIZE, offset),
    wantFacets ? getFacetCounts(supabase, resolved) : Promise.resolve(null),
    wantFacets ? loadAttributeGroups(supabase, params.type) : Promise.resolve(null),
    spQueryPromise ?? Promise.resolve({ data: null }),
  ])

  // Resilience: if the faceted RPC is unavailable (e.g. the migration has not
  // been applied yet), fall back to a basic PostgREST query so browse/search
  // keep working.
  const search = searchResult.error
    ? await legacyFacetedIds(supabase, resolved, LISTINGS_PAGE_SIZE, offset)
    : searchResult

  // Hydrate the page of ids with the rich nested select, then reorder to the
  // RPC's ordering (the .in() filter does not preserve order).
  let organicEntities: DiscoveryEntity[] = []
  if (search.ids.length > 0) {
    const { data } = await supabase.from('listings').select(NESTED_SELECT).in('id', search.ids)
    const byId = new Map<string, DiscoveryEntity>()
    for (const raw of ((data as unknown as RawRow[]) ?? [])) byId.set(raw.id, mapRow(raw))
    organicEntities = search.ids
      .map((id) => byId.get(id))
      .filter((e): e is DiscoveryEntity => !!e)
  }

  const facets = wantFacets && counts && groups ? { groups, counts } : undefined

  let finalEntities = organicEntities

  if (page === 1 && !deepFilter) {
    const { data: spRows } = spResult as { data: unknown[] | null }

    if (spRows && spRows.length > 0) {
      const sponsoredIds = new Set<string>()
      const toInject: Array<{ position: number; entity: DiscoveryEntity }> = []

      for (const sp of spRows as Array<{ position: number | null; listings: unknown }>) {
        const raw = sp.listings as unknown as RawRow | null
        if (!raw) continue
        const entity = { ...mapRow(raw), is_sponsored: true }
        sponsoredIds.add(entity.id)
        toInject.push({ position: sp.position ?? 1, entity })
      }

      const filtered = organicEntities.filter((e) => !sponsoredIds.has(e.id))
      const result = [...filtered]
      for (const { position, entity } of toInject.sort((a, b) => a.position - b.position)) {
        const idx = Math.min(position - 1, result.length)
        result.splice(idx, 0, entity)
      }

      finalEntities = result
    }
  }

  // Identity chips + event dates fetched separately (resilient to missing tables).
  await attachIdentityChips(supabase, finalEntities)
  await attachEventStartDates(supabase, finalEntities)

  // Per-user save state for the card bookmark icon (fail-soft; anon → all false).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await attachSavedState(supabase, user?.id, finalEntities)

  return { entities: finalEntities, total: search.total, page, pageSize: LISTINGS_PAGE_SIZE, facets }
}
