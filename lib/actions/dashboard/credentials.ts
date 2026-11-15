'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  CREDENTIAL_COLUMNS,
  checkCredentialAdd,
  parseCredential,
  toOwnerCredentials,
  type OwnerCredential,
} from '@/lib/listings/credentials'

// Credentials, awards and press (ticket 192). The owner adds, edits, reorders
// and removes the items on their page. Writes run on the owner's own client,
// so the listing_credentials RLS policies apply as well as the checks here.
// Every action returns the page's items as saved. Adding needs Starter;
// editing, reordering and removing are always allowed, so an owner who moved
// down a plan can still tidy what they have.

export type CredentialsState = { success: true; items: OwnerCredential[] } | { error: string }

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
  // A job or an event has no credentials block.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readItems(supabase: Supabase, listingId: string): Promise<OwnerCredential[] | null> {
  const { data, error } = await supabase
    .from('listing_credentials')
    .select(CREDENTIAL_COLUMNS)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return null
  return toOwnerCredentials(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/credentials`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<CredentialsState> {
  revalidate(listing)
  const items = await readItems(supabase, listing.id)
  return items ? { success: true, items } : { error: TRY_AGAIN }
}

export interface SaveCredentialInput {
  listingId: unknown
  /** Left out for a new item. */
  id?: unknown
  kind: unknown
  title: unknown
  issuer: unknown
  year: unknown
  url: unknown
}

/** Adds or edits one item. Adding is checked against the plan. */
export async function saveCredentialAction(input: SaveCredentialInput): Promise<CredentialsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }

  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id))) {
    return { error: ITEM_NOT_FOUND }
  }
  const existing = id ? items.find((c) => c.id === id) : undefined
  if (id && !existing) return { error: ITEM_NOT_FOUND }

  const parsed = parseCredential(input)
  if (!parsed.ok) return { error: parsed.error }

  if (!existing) {
    const refusal = checkCredentialAdd(listing.tier, items.length)
    if (refusal) return { error: refusal }
  }

  const nextOrder = items.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1
  const { error } = existing
    ? await supabase
        .from('listing_credentials')
        .update(parsed.value)
        .eq('id', existing.id)
        .eq('listing_id', listing.id)
    : await supabase
        .from('listing_credentials')
        .insert({ listing_id: listing.id, sort_order: nextOrder, ...parsed.value })
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Puts the items in the order given. The ids must be exactly the page's items. */
export async function reorderCredentialsAction(input: {
  listingId: unknown
  ids: unknown
}): Promise<CredentialsState> {
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
    !ids.every((x) => typeof x === 'string' && items.some((c) => c.id === x))
  ) {
    return { error: 'Your list changed in another tab. Reload the page and try again.' }
  }

  const moves = (ids as string[])
    .map((itemId, order) => ({ itemId, order }))
    .filter(({ itemId, order }) => items.find((c) => c.id === itemId)?.sort_order !== order)
  const results = await Promise.all(
    moves.map(({ itemId, order }) =>
      supabase
        .from('listing_credentials')
        .update({ sort_order: order })
        .eq('id', itemId)
        .eq('listing_id', listing.id)
    )
  )
  if (results.some((r) => r.error)) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Removes one item. Always allowed. */
export async function deleteCredentialAction(input: {
  listingId: unknown
  id: unknown
}): Promise<CredentialsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: ITEM_NOT_FOUND }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_credentials')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}
