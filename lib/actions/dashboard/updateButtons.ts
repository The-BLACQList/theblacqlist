'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkButtonAdd } from '@/lib/stripe/planChecks'
import { offerGrowthTo, offerPremiumTo } from '@/lib/marketplace/entitlements'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { moveButton, parseExtraButton, toExtraButtons, type ExtraButton } from '@/lib/listings/pageButtons'

// Extra buttons (owner-experience round 2, part B). The owner adds, removes
// and reorders the buttons beyond the main one. Writes run on the owner's own
// client, so the listing_buttons RLS policies apply as well as the checks here.
// Every action returns the page's buttons as saved, so the editor shows the truth.

export type ButtonsState = { success: true; buttons: ExtraButton[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save your buttons. Please try again.'

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
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readButtons(supabase: Supabase, listingId: string): Promise<ExtraButton[] | null> {
  const { data, error } = await supabase
    .from('listing_buttons')
    .select('id, type, value, label_override, position')
    .eq('listing_id', listingId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return null
  return toExtraButtons(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listing.id)
}

async function done(
  supabase: Supabase,
  listing: OwnedListing
): Promise<ButtonsState> {
  revalidate(listing)
  const buttons = await readButtons(supabase, listing.id)
  return buttons ? { success: true, buttons } : { error: TRY_AGAIN }
}

/** Adds one extra button at the end, within the plan's limit. */
export async function addExtraButtonAction(input: {
  listingId: unknown
  type: unknown
  value: unknown
  label: unknown
}): Promise<ButtonsState> {
  const parsed = parseExtraButton(input?.type, input?.value, input?.label)
  if (!parsed.ok) return { error: parsed.error }

  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const existing = await readButtons(supabase, listing.id)
  if (!existing) return { error: TRY_AGAIN }
  const [growthOpen, premiumOpen] = await Promise.all([offerGrowthTo(listing.tier), offerPremiumTo(listing.tier)])
  const limitError = checkButtonAdd(listing.tier, existing.length, growthOpen, premiumOpen)
  if (limitError) return { error: limitError }

  const position = existing.reduce((max, b) => Math.max(max, b.position), -1) + 1
  const { error } = await supabase
    .from('listing_buttons')
    .insert({ listing_id: listing.id, ...parsed.value, position })
  if (error) return { error: TRY_AGAIN }

  return done(supabase, listing)
}

/** Removes one extra button. Always allowed. */
export async function deleteExtraButtonAction(input: { listingId: unknown; id: unknown }): Promise<ButtonsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Button not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase.from('listing_buttons').delete().eq('id', input.id).eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }

  return done(supabase, listing)
}

/**
 * Moves one extra button up or down a place. Always allowed, even over the
 * limit: after a downgrade, this is how the owner picks which ones show.
 */
export async function moveExtraButtonAction(input: {
  listingId: unknown
  id: unknown
  direction: unknown
}): Promise<ButtonsState> {
  if (input?.direction !== 'up' && input?.direction !== 'down') return { error: TRY_AGAIN }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const existing = await readButtons(supabase, listing.id)
  if (!existing) return { error: TRY_AGAIN }
  const order = typeof input.id === 'string' ? moveButton(existing, input.id, input.direction) : null
  if (!order) return done(supabase, listing)

  // Renumber 0..n-1 so the saved order is always the shown order.
  const results = await Promise.all(
    order.map((id, position) =>
      supabase.from('listing_buttons').update({ position }).eq('id', id).eq('listing_id', listing.id)
    )
  )
  if (results.some((r) => r.error)) return { error: TRY_AGAIN }

  return done(supabase, listing)
}
