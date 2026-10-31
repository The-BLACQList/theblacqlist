/**
 * The data Cue's tools read on the server (ticket 169).
 *
 * Kept apart from `tools.ts` so the tools run in tests without a database.
 * Every read is the public, anon-key view of published listings: a listing
 * that was unpublished since the last turn simply stops coming back.
 */

import 'server-only'

import type { AssistantCategory } from '@/lib/ai/assistant'
import { businessPage, NO_PAGE, staticPage, type PageContext, type PageRef } from '@/lib/assistant/page'
import { parseWeeklyHours } from '@/lib/listings/hours'
import { mapRow, NESTED_SELECT, queryListings, type RawRow } from '@/lib/listings/query'
import type { AssistCity } from '@/lib/search/assist'
import { lookupPlace } from '@/lib/search/placeLookup'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'

import type { CueName } from './guard'
import type { CueToolDeps } from './tools'

/** OpenStreetMap calls per hour across the site, shared with the old assistant. */
const PLACE_UPSTREAM_LIMIT = 50

/** The card select, plus weekly hours for follow-up questions. */
const DETAIL_SELECT = NESTED_SELECT.replace(
  'listing_details_business(description, lat, lng)',
  'listing_details_business(description, lat, lng, hours)'
)

async function loadByIds(ids: readonly string[]): Promise<DiscoveryEntity[]> {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select(NESTED_SELECT)
    .in('id', [...ids])
    .eq('status', 'published')
  if (error) throw new Error('CUE_LOAD_FAILED')
  const byId = new Map<string, DiscoveryEntity>()
  for (const raw of (data as unknown as RawRow[]) ?? []) byId.set(raw.id, mapRow(raw))
  return ids.map((id) => byId.get(id)).filter((e): e is DiscoveryEntity => !!e)
}

export const cueDeps: CueToolDeps = {
  async search(params) {
    const { entities } = await queryListings(params)
    return entities
  },

  loadByIds,

  async loadDetails(id) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listings')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw new Error('CUE_LOAD_FAILED')
    if (!data) return null
    const raw = data as unknown as RawRow & { listing_details_business: { hours?: unknown } | null }
    return {
      entity: mapRow(raw),
      hours: parseWeeklyHours(raw.listing_details_business?.hours),
    }
  },

  async locate(place, cities) {
    try {
      const { place: hit } = await lookupPlace(place, cities, {
        allowUpstream: () =>
          checkRateLimit({
            bucket: 'place_lookup_upstream',
            identifier: 'nominatim',
            limit: PLACE_UPSTREAM_LIMIT,
          }),
      })
      return hit ? { label: hit.label, point: { lat: hit.lat, lng: hit.lng } } : null
    } catch {
      // OpenStreetMap is a nice-to-have. Cue can still ask which city.
      return null
    }
  },
}

// ─── Lists ───────────────────────────────────────────────────────────────────

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  states: { code: string } | null
}

export interface CueLists {
  categories: AssistantCategory[]
  /** Every city row, live or not, so a place we don't cover still has a point. */
  cities: AssistCity[]
}

/** Active categories and every city. Null when either read fails. */
export async function loadLists(): Promise<CueLists | null> {
  const supabase = await createClient()
  const [categories, cities] = await Promise.all([
    supabase.from('categories').select('id, name, slug, parent_id').eq('is_active', true),
    supabase
      .from('cities')
      .select('id, name, slug, is_active, latitude, longitude, states!cities_state_id_fkey(code)'),
  ])
  if (categories.error || cities.error) return null
  return {
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      parentId: c.parent_id ?? null,
    })),
    cities: ((cities.data as unknown as CityRow[] | null) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.is_active,
      lat: c.latitude == null ? null : Number(c.latitude),
      lng: c.longitude == null ? null : Number(c.longitude),
      stateCode: c.states?.code ?? null,
    })),
  }
}

// ─── Listing names, for the reply check ──────────────────────────────────────

const NAMES_TTL_MS = 10 * 60_000
const NAMES_PAGE = 1000
let namesCache: { at: number; names: CueName[] } | null = null

/**
 * Every published listing's id and name, so a reply that names a listed
 * business no tool returned can be caught. Held for ten minutes per server
 * instance; a stale list only means a brand-new name goes unchecked for a bit.
 * Null when the read fails; the route then falls back, as it does when the
 * lists fail, so no reply goes out unchecked.
 */
export async function listingNames(): Promise<CueName[] | null> {
  if (namesCache && Date.now() - namesCache.at < NAMES_TTL_MS) return namesCache.names
  const supabase = await createClient()
  const names: CueName[] = []
  for (let from = 0; ; from += NAMES_PAGE) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, name')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('id')
      .range(from, from + NAMES_PAGE - 1)
    if (error) return null
    for (const row of data ?? []) names.push({ id: row.id, name: row.name })
    if (!data || data.length < NAMES_PAGE) break
  }
  namesCache = { at: Date.now(), names }
  return names
}

// ─── The page ────────────────────────────────────────────────────────────────

interface BusinessRow {
  id: string
  name: string
  entity_type: string
  owner_user_id: string | null
  avg_rating: number | null
  review_count: number | null
  categories: { name: string } | null
  cities: { name: string; slug: string; states: { code: string } | null } | null
  listing_details_business: {
    address_line_1: string | null
    zip: string | null
    phone: string | null
    website_url: string | null
    hours: unknown
    lat: number | null
    lng: number | null
  } | null
}

function hasHours(hours: unknown): boolean {
  if (!hours || typeof hours !== 'object') return false
  return Object.keys(hours).length > 0
}

/**
 * What Cue knows about the page the visitor is on. A business page is read
 * from the database (published rows only, through RLS), so the facts and every
 * href come from us, never from the client. Any failure means no page.
 */
export async function loadPage(ref: PageRef | null): Promise<PageContext> {
  if (!ref) return NO_PAGE
  if (ref.kind !== 'business') return staticPage(ref)
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listings')
      .select(
        `id, name, entity_type, owner_user_id, avg_rating, review_count,
        categories!listings_category_id_fkey(name),
        cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
        listing_details_business(address_line_1, zip, phone, website_url, hours, lat, lng)`
      )
      .eq('slug', ref.listingSlug)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !data) return NO_PAGE
    const row = data as unknown as BusinessRow
    if (row.entity_type !== ref.entityType) return NO_PAGE
    if (row.cities && row.cities.slug !== ref.citySlug) return NO_PAGE
    const det = row.listing_details_business
    return businessPage({
      id: row.id,
      name: row.name,
      entityType: row.entity_type,
      claimed: row.owner_user_id !== null,
      avgRating: row.avg_rating,
      reviewCount: row.review_count ?? 0,
      categoryName: row.categories?.name ?? null,
      cityName: row.cities?.name ?? null,
      stateCode: row.cities?.states?.code ?? null,
      street: det?.address_line_1 ?? null,
      zip: det?.zip ?? null,
      phone: det?.phone ?? null,
      website: det?.website_url ?? null,
      hasHours: hasHours(det?.hours),
      lat: det?.lat ?? null,
      lng: det?.lng ?? null,
    })
  } catch {
    return NO_PAGE
  }
}
