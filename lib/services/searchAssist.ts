// The follow-up questions a thin search asks the database (PR 5).
//
// When a search finds fewer than three listings, the page asks, in order:
//   1. Categories: which categories the words mean, with real counts here and
//      nationwide, and which of those we have nothing in yet.
//   2. Somewhere else: a place we do not cover, the nearest city we do, the
//      same search nationwide, and businesses that work online.
//   3. Keep exploring: popular categories and live cities, when 1 and 2 found
//      nothing at all.
//
// It never shows listings that match only some of the words. A search with no
// match says so, then points somewhere useful.
// [Decision — founder, 2026-10-14: the any-of "close matches" made search feel
// loose. An honest empty result with help beats a page that is never empty.]
//
// Every count comes from published listings through the same RPCs the grid
// uses. Nothing here writes, logs or stores the search.

import { createClient } from '@/lib/supabase/server'
import type { ListingsParams } from '@/lib/listings/query'
import {
  getFacetCounts,
  resolveFacetParams,
  searchFacetedIds,
  type ResolvedFacetParams,
} from '@/lib/listings/facets'
import {
  findPlaces,
  matchCategories,
  meaningfulWords,
  nearestCity,
  type AssistCity,
} from '@/lib/search/assist'

const MAX_EXPLORE_CATEGORIES = 6

export interface AssistChip {
  name: string
  slug: string
  /** Listings in the current place. Null when no place is set. */
  localCount: number | null
  /** Listings everywhere. Null when the counts could not be read. */
  nationalCount: number | null
  href: string
}

export interface NearbyCity {
  name: string
  miles: number
  href: string
}

export interface SearchAssistData {
  query: string
  exactTotal: number
  /** "in Atlanta" or "within 25 miles", for the copy. Null when nationwide. */
  scopeLabel: string | null
  chips: AssistChip[]
  /** Categories the search means that have no listings anywhere yet. */
  gaps: string[]
  /** Places in the search we do not cover yet, with the nearest one we do. */
  uncovered: Array<{ label: string; nearest: NearbyCity | null }>
  /** Near You found nothing: the closest live city, when outside the radius. */
  nearestToYou: NearbyCity | null
  /** The same search with the place taken off. */
  elsewhere: { count: number; href: string } | null
  /** Businesses that work online, matching every word once the place is off. */
  online: { count: number; words: string; href: string } | null
  explore: {
    categories: Array<{ name: string; slug: string; count: number | null }>
    cities: Array<{ name: string; slug: string }>
  } | null
}

const NO_FILTERS: ResolvedFacetParams = {
  p_q: null,
  p_category_id: null,
  p_city_id: null,
  p_entity_type: null,
  p_trust_tier: null,
  p_location_types: null,
  p_ownership_label: null,
  p_price_ranges: null,
  p_attribute_values: null,
  p_open_now: null,
  p_lat: null,
  p_lng: null,
  p_radius_miles: null,
  p_type_category_ids: null,
  p_type_location_types: null,
}

type CategoryRow = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  display_order: number | null
}

// latitude and longitude are numeric(10,6), which can arrive as strings.
type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  states: { code: string } | null
}

function qs(entries: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(entries)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export async function getSearchAssist(args: {
  /** The parsed params of the search the grid just ran, `q` included. */
  params: ListingsParams
  exactTotal: number
}): Promise<SearchAssistData> {
  const { params, exactTotal } = args
  const query = params.q?.trim() ?? ''
  const supabase = await createClient()

  const [{ data: catRows }, { data: cityRows }, national] = await Promise.all([
    supabase.from('categories').select('id, name, slug, parent_id, display_order').eq('is_active', true),
    supabase
      .from('cities')
      .select('id, name, slug, is_active, latitude, longitude, states!cities_state_id_fkey(code)'),
    getFacetCounts(supabase, NO_FILTERS),
  ])

  const categories = ((catRows as CategoryRow[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    order: c.display_order ?? 0,
  }))
  const cities: AssistCity[] = ((cityRows as unknown as CityRow[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.is_active,
    lat: c.latitude == null ? null : Number(c.latitude),
    lng: c.longitude == null ? null : Number(c.longitude),
    stateCode: c.states?.code ?? null,
  }))
  const nationalCounts = national.countsUnavailable ? null : (national.category ?? null)
  const nationalOf = (slug: string): number | null => (nationalCounts ? (nationalCounts[slug] ?? 0) : null)

  // ── Where the search is looking ──────────────────────────────────────────
  const { places, rest } = findPlaces(query, cities)
  const radius =
    params.lat != null && params.lng != null && params.radius != null
      ? { lat: params.lat, lng: params.lng, radius: params.radius }
      : null
  const filterCity = params.city ? cities.find((c) => c.slug === params.city) : undefined
  // A city typed into the search scopes the follow-ups when the page has no
  // place of its own and the name points at exactly one live city.
  const typedCity =
    !filterCity && !radius && places.length === 1 && places[0]!.activeCities.length === 1
      ? places[0]!.activeCities[0]!
      : undefined
  const scopeCity = filterCity ?? typedCity
  const scopeLabel = scopeCity
    ? `in ${scopeCity.name}`
    : radius
      ? `within ${radius.radius} ${radius.radius === 1 ? 'mile' : 'miles'}`
      : null
  const scoped = !!(scopeCity || radius)

  // The search with filler and any place taken off. Every word still has to
  // match, so the online line never widens the search.
  const onlineWords = meaningfulWords(rest).join(' ')

  const localResolved = scoped
    ? (
        await resolveFacetParams(supabase, {
          city: scopeCity?.slug,
          lat: radius?.lat,
          lng: radius?.lng,
          radius: radius?.radius,
        })
      ).params
    : null

  const matches = matchCategories(rest, categories)

  const [local, elsewhereCount, onlineCount] = await Promise.all([
    localResolved && matches.length > 0 ? getFacetCounts(supabase, localResolved) : Promise.resolve(null),
    (filterCity || radius) && query
      ? searchFacetedIds(supabase, { ...NO_FILTERS, p_q: query }, 'relevance', 1, 0)
      : Promise.resolve(null),
    (scoped || places.length > 0) && onlineWords
      ? searchFacetedIds(supabase, { ...NO_FILTERS, p_q: onlineWords, p_location_types: ['virtual'] }, 'relevance', 1, 0)
      : Promise.resolve(null),
  ])

  // ── 1. Categories ────────────────────────────────────────────────────────
  const localCounts = local && !local.countsUnavailable ? (local.category ?? null) : null
  const chips: AssistChip[] = []
  const gaps: string[] = []
  for (const { category } of matches) {
    const nationalCount = nationalOf(category.slug)
    if (nationalCount === 0) {
      gaps.push(category.name)
      continue
    }
    const localCount = localCounts ? (localCounts[category.slug] ?? 0) : null
    const here =
      localCount && scopeCity
        ? { city: scopeCity.slug }
        : localCount && radius
          ? { lat: radius.lat, lng: radius.lng, radius: radius.radius }
          : {}
    chips.push({
      name: category.name,
      slug: category.slug,
      localCount,
      nationalCount,
      href: `/discover${qs({ category: category.slug, ...here })}`,
    })
  }

  // ── 2. Somewhere else ────────────────────────────────────────────────────
  const near = (from: { lat: number; lng: number }): NearbyCity | null => {
    const n = nearestCity(from, cities)
    return n ? { name: n.city.name, miles: n.miles, href: `/discover/${n.city.slug}` } : null
  }
  const uncovered = places
    .filter((p) => p.activeCities.length === 0)
    .map((p) => ({ label: p.label, nearest: p.anchor ? near(p.anchor) : null }))

  let nearestToYou: NearbyCity | null = null
  if (radius) {
    const n = near(radius)
    if (n && n.miles > radius.radius) nearestToYou = n
  }

  const elsewhere =
    elsewhereCount && !elsewhereCount.error && elsewhereCount.total > exactTotal
      ? { count: elsewhereCount.total, href: `/search${qs({ q: query })}` }
      : null
  const online =
    onlineCount && !onlineCount.error && onlineCount.total > 0
      ? {
          count: onlineCount.total,
          words: onlineWords,
          href: `/search${qs({ q: onlineWords, location_type: 'virtual' })}`,
        }
      : null

  // ── 3. Keep exploring ────────────────────────────────────────────────────
  const anyChipHasListings = chips.some((c) => (c.nationalCount ?? 1) > 0)
  const explore =
    !anyChipHasListings && !elsewhere && !online
      ? {
          categories: categories
            .filter((c) => !c.parentId && (nationalOf(c.slug) ?? 1) > 0)
            .sort((a, b) => (nationalOf(b.slug) ?? 0) - (nationalOf(a.slug) ?? 0) || a.order - b.order)
            .slice(0, MAX_EXPLORE_CATEGORIES)
            .map((c) => ({ name: c.name, slug: c.slug, count: nationalOf(c.slug) })),
          cities: cities
            .filter((c) => c.isActive)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => ({ name: c.name, slug: c.slug })),
        }
      : null

  return {
    query,
    exactTotal,
    scopeLabel,
    chips,
    gaps,
    uncovered,
    nearestToYou,
    elsewhere,
    online,
    explore,
  }
}
