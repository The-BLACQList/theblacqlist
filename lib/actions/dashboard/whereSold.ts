'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { VALID_LOCATION_TYPES, type LocationType } from '@/lib/constants/listing'
import {
  ORDER_PLATFORM_IDS,
  STOCKISTS_MAX,
  STOCKIST_SELECT,
  parseOrderUrl,
  parseServiceArea,
  parseStockist,
  toOrderLinks,
  toRetailChains,
  toStockists,
  type OrderLink,
  type Stockist,
} from '@/lib/listings/whereSold'

// "Order on" platforms, "Find us at" stores and where the business operates
// (owner-experience round 2, part D). Writes run on the owner's own client, so
// the RLS policies on listing_order_platforms, listing_stockists and
// listing_stockist_areas apply as well as the checks here. No plan check.

export type OrderLinksState = { success: true; links: OrderLink[] } | { error: string }
export type StockistsState = { success: true; stockists: Stockist[] } | { error: string }
export type LocationState =
  | {
      success: true
      locationType: LocationType
      serviceArea: string | null
      shipsNationwide: boolean
    }
  | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'
const OFF = 'This isn’t available yet.'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedListing {
  id: string
  slug: string
  status: string | null
  entity_type: string
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: Supabase; listing: OwnedListing; userId: string }
> {
  if (!isFeatureEnabled('orderWhereSold')) return { ok: false, error: OFF }
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId))
    return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // Jobs and events are postings, not businesses.
  if (listing.entity_type === 'job' || listing.entity_type === 'event')
    return { ok: false, error: NOT_FOUND }
  return { ok: true, supabase, listing: listing as OwnedListing, userId: owner.user.id }
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug)
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listing.id)
}

// ── Order on ────────────────────────────────────────────────────────────────

/**
 * Saves the page's order links. `links` maps a platform to its link; a blank
 * or missing one removes that platform. Every link is checked before anything
 * is written.
 */
export async function saveOrderLinksAction(input: {
  listingId: unknown
  links: unknown
}): Promise<OrderLinksState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const given =
    input.links && typeof input.links === 'object' ? (input.links as Record<string, unknown>) : {}
  const keep: { listing_id: string; platform: string; url: string }[] = []
  const drop: string[] = []
  for (const platform of ORDER_PLATFORM_IDS) {
    const raw = given[platform]
    if (typeof raw !== 'string' || !raw.trim()) {
      drop.push(platform)
      continue
    }
    const parsed = parseOrderUrl(platform, raw)
    if (!parsed.ok) return { error: parsed.error }
    keep.push({ listing_id: listing.id, platform, url: parsed.value })
  }

  if (keep.length > 0) {
    const { error } = await supabase
      .from('listing_order_platforms')
      .upsert(keep, { onConflict: 'listing_id,platform' })
    if (error) return { error: TRY_AGAIN }
  }
  if (drop.length > 0) {
    const { error } = await supabase
      .from('listing_order_platforms')
      .delete()
      .eq('listing_id', listing.id)
      .in('platform', drop)
    if (error) return { error: TRY_AGAIN }
  }

  revalidate(listing)
  const { data, error } = await supabase
    .from('listing_order_platforms')
    .select('platform, url')
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return { success: true, links: toOrderLinks(data) }
}

// ── Find us at ──────────────────────────────────────────────────────────────

async function readStockists(supabase: Supabase, listingId: string): Promise<Stockist[] | null> {
  const { data, error } = await supabase
    .from('listing_stockists')
    .select(STOCKIST_SELECT)
    .eq('listing_id', listingId)
  if (error) return null
  return toStockists(data)
}

async function stockistsDone(supabase: Supabase, listing: OwnedListing): Promise<StockistsState> {
  revalidate(listing)
  const stockists = await readStockists(supabase, listing.id)
  return stockists ? { success: true, stockists } : { error: TRY_AGAIN }
}

export interface SaveStockistInput {
  listingId: unknown
  /** Left out for a new store. */
  id?: unknown
  /** A chain slug from the list, or the name the owner typed. */
  store: unknown
  nationwide: unknown
  /** Zips and "City, ST", one per entry. */
  areas: unknown
}

/** Adds or edits one store, with its cities and zips. */
export async function saveStockistAction(input: SaveStockistInput): Promise<StockistsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const current = await readStockists(supabase, listing.id)
  if (!current) return { error: TRY_AGAIN }
  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id)))
    return { error: 'Store not found.' }
  const existing = id ? current.find((s) => s.id === id) : undefined
  if (id && !existing) return { error: 'Store not found.' }
  if (!existing && current.length >= STOCKISTS_MAX) {
    return { error: `You can list up to ${STOCKISTS_MAX} stores.` }
  }

  const { data: chainRows } = await supabase.from('retail_chains').select('slug, name')
  const parsed = parseStockist(input, toRetailChains(chainRows))
  if (!parsed.ok) return { error: parsed.error }
  const { areas, ...fields } = parsed.value

  if (fields.chain_slug) {
    const dupe = current.find((s) => s.chainSlug === fields.chain_slug && s.id !== existing?.id)
    if (dupe) return { error: `${dupe.name} is already on your list.` }
  }

  let stockistId: string
  if (existing) {
    const { error } = await supabase
      .from('listing_stockists')
      .update(fields)
      .eq('id', existing.id)
      .eq('listing_id', listing.id)
    if (error) return { error: TRY_AGAIN }
    stockistId = existing.id
    const { error: clearError } = await supabase
      .from('listing_stockist_areas')
      .delete()
      .eq('stockist_id', stockistId)
    if (clearError) return { error: TRY_AGAIN }
  } else {
    const position = current.reduce((max, s) => Math.max(max, s.position + 1), 0)
    const { data, error } = await supabase
      .from('listing_stockists')
      .insert({ listing_id: listing.id, ...fields, position })
      .select('id')
      .single()
    if (error || !data) return { error: TRY_AGAIN }
    stockistId = data.id
  }

  const rows = [
    ...areas.cities.map((value) => ({ stockist_id: stockistId, kind: 'city', value })),
    ...areas.zips.map((value) => ({ stockist_id: stockistId, kind: 'zip', value })),
  ]
  if (rows.length > 0) {
    const { error } = await supabase.from('listing_stockist_areas').insert(rows)
    if (error) return { error: TRY_AGAIN }
  }
  return stockistsDone(supabase, listing)
}

/** Removes one store and its cities and zips. */
export async function deleteStockistAction(input: {
  listingId: unknown
  id: unknown
}): Promise<StockistsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Store not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_stockists')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return stockistsDone(supabase, listing)
}

/** Moves one store up or down the list. */
export async function moveStockistAction(input: {
  listingId: unknown
  id: unknown
  direction: unknown
}): Promise<StockistsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Store not found.' }
  if (input.direction !== 'up' && input.direction !== 'down') return { error: TRY_AGAIN }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const current = await readStockists(supabase, listing.id)
  if (!current) return { error: TRY_AGAIN }
  const i = current.findIndex((s) => s.id === input.id)
  if (i < 0) return { error: 'Store not found.' }
  const j = input.direction === 'up' ? i - 1 : i + 1
  const a = current[i]
  const b = current[j]
  if (!a || !b) return { success: true, stockists: current }

  // Renumber the whole list, so positions that were equal still end up in order.
  const order = [...current]
  order[i] = b
  order[j] = a
  for (const [position, s] of order.entries()) {
    if (s.position === position) continue
    const { error } = await supabase
      .from('listing_stockists')
      .update({ position })
      .eq('id', s.id)
      .eq('listing_id', listing.id)
    if (error) return { error: TRY_AGAIN }
  }
  return stockistsDone(supabase, listing)
}

// ── Where the business operates ─────────────────────────────────────────────

/**
 * Saves how the page says it operates: storefront, online, comes to you and so
 * on, the service area line, and whether it ships nationwide. ships_nationwide
 * is on both listings and listing_details_business; the page reads the details
 * row first, so both are written (a page with no details row has only the first).
 */
export async function saveLocationAction(input: {
  listingId: unknown
  locationType: unknown
  serviceArea: unknown
  shipsNationwide: unknown
}): Promise<LocationState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing, userId } = owned

  const locationType = input.locationType
  if (!VALID_LOCATION_TYPES.includes(locationType as LocationType)) {
    return { error: 'Choose how customers find you.' }
  }
  const serviceArea = parseServiceArea(input.serviceArea)
  if (!serviceArea.ok) return { error: serviceArea.error }
  const shipsNationwide = input.shipsNationwide === true

  const { error } = await supabase
    .from('listings')
    .update({
      location_type: locationType as LocationType,
      service_area_description: serviceArea.value,
      ships_nationwide: shipsNationwide,
      last_edited_by_owner_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', listing.id)
    .eq('owner_user_id', userId)
  if (error) return { error: TRY_AGAIN }

  const { error: detailsError } = await supabase
    .from('listing_details_business')
    .update({ ships_nationwide: shipsNationwide })
    .eq('listing_id', listing.id)
  if (detailsError) return { error: TRY_AGAIN }

  revalidate(listing)
  return {
    success: true,
    locationType: locationType as LocationType,
    serviceArea: serviceArea.value,
    shipsNationwide,
  }
}
