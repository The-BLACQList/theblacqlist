'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  HIGHLIGHT_COLUMNS,
  checkHighlightAdd,
  isHighlightKind,
  kindForNew,
  parseHighlight,
  toOwnerHighlights,
  type OwnerHighlight,
} from '@/lib/listings/highlights'

// Highlights and process steps (ticket 195). The owner adds, edits, reorders
// and removes them, and picks the page's style: icon bullets ("Why Choose
// Us") or numbered steps ("How It Works"). Writes run on the owner's own
// client, so the listing_highlights RLS policies apply as well as the checks
// here. Every action returns the page's items as saved. Adding needs room
// under the plan's limit; everything else always works, so an owner who moved
// down a plan can choose which ones still show.

export type HighlightsState = { success: true; items: OwnerHighlight[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'
const ITEM_NOT_FOUND = 'That item wasn’t found. Reload the page and try again.'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedListing {
  id: string
  slug: string
  status: string | null
  entity_type: string
  tier: string | null
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<{ ok: false; error: string } | { ok: true; supabase: Supabase; listing: OwnedListing }> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
    return { ok: false, error: NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // A job or an event has no highlights block.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readItems(supabase: Supabase, listingId: string): Promise<OwnerHighlight[] | null> {
  const { data, error } = await supabase
    .from('listing_highlights')
    .select(HIGHLIGHT_COLUMNS)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return null
  return toOwnerHighlights(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/highlights`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<HighlightsState> {
  revalidate(listing)
  const items = await readItems(supabase, listing.id)
  return items ? { success: true, items } : { error: TRY_AGAIN }
}

export interface SaveHighlightInput {
  listingId: unknown
  /** Left out for a new item. */
  id?: unknown
  /** The style for the first item on an empty page; later items take the page's. */
  kind?: unknown
  icon: unknown
  title: unknown
  text: unknown
}

/** Adds or edits one item. Adding is checked against the plan. */
export async function saveHighlightAction(input: SaveHighlightInput): Promise<HighlightsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }

  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id))) {
    return { error: ITEM_NOT_FOUND }
  }
  const existing = id ? items.find((h) => h.id === id) : undefined
  if (id && !existing) return { error: ITEM_NOT_FOUND }

  const parsed = parseHighlight(input)
  if (!parsed.ok) return { error: parsed.error }

  if (!existing) {
    const refusal = checkHighlightAdd(listing.tier, items.length)
    if (refusal) return { error: refusal }
  }

  const nextOrder = items.reduce((max, h) => Math.max(max, h.sort_order), -1) + 1
  const { error } = existing
    ? await supabase
        .from('listing_highlights')
        .update(parsed.value)
        .eq('id', existing.id)
        .eq('listing_id', listing.id)
    : await supabase.from('listing_highlights').insert({
        listing_id: listing.id,
        kind: kindForNew(items, input.kind),
        sort_order: nextOrder,
        ...parsed.value,
      })
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Switches the page between bullets and steps. Every item takes the new kind. */
export async function setHighlightsKindAction(input: {
  listingId: unknown
  kind: unknown
}): Promise<HighlightsState> {
  if (!isHighlightKind(input?.kind)) return { error: 'Choose bullets or steps.' }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_highlights')
    .update({ kind: input.kind })
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Puts the items in the order given. The ids must be exactly the page's items. */
export async function reorderHighlightsAction(input: {
  listingId: unknown
  ids: unknown
}): Promise<HighlightsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }

  const ids = input.ids
  if (
    !Array.isArray(ids) ||
    ids.length !== items.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((x) => typeof x === 'string' && items.some((h) => h.id === x))
  ) {
    return { error: 'Your list changed in another tab. Reload the page and try again.' }
  }

  const moves = (ids as string[])
    .map((itemId, order) => ({ itemId, order }))
    .filter(({ itemId, order }) => items.find((h) => h.id === itemId)?.sort_order !== order)
  const results = await Promise.all(
    moves.map(({ itemId, order }) =>
      supabase
        .from('listing_highlights')
        .update({ sort_order: order })
        .eq('id', itemId)
        .eq('listing_id', listing.id)
    )
  )
  if (results.some((r) => r.error)) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Removes one item. Always allowed. */
export async function deleteHighlightAction(input: {
  listingId: unknown
  id: unknown
}): Promise<HighlightsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: ITEM_NOT_FOUND }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_highlights')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}
