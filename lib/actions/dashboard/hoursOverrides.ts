'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  HOURS_OVERRIDE_COLUMNS,
  checkHoursOverrideAdd,
  futureDateKey,
  isDateKey,
  parseHoursOverride,
  toHoursOverrides,
} from '@/lib/listings/hoursOverrides'
import type { HoursOverride } from '@/types'

// Holiday and special hours (ticket 196). The owner sets a date as closed or
// open with its own times, changes it, or removes it. All plans: hours are
// basic. Writes run on the owner's own client, so the listing_hours_overrides
// RLS policies apply as well as the checks here. Every action returns the
// page's upcoming dates as saved.

export type HoursOverridesState = { success: true; items: HoursOverride[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'

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
): Promise<{ ok: false; error: string } | { ok: true; supabase: Supabase; listing: OwnedListing }> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
    return { ok: false, error: NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // A job or an event has no weekly hours to override.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

/** The page's dates from yesterday on (a day's slack for time zones). */
async function readItems(supabase: Supabase, listingId: string): Promise<HoursOverride[] | null> {
  const { data, error } = await supabase
    .from('listing_hours_overrides')
    .select(HOURS_OVERRIDE_COLUMNS)
    .eq('listing_id', listingId)
    .gte('date', futureDateKey(new Date(), -1))
    .order('date', { ascending: true })
  if (error) return null
  return toHoursOverrides(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/special-hours`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<HoursOverridesState> {
  revalidate(listing)
  const items = await readItems(supabase, listing.id)
  return items ? { success: true, items } : { error: TRY_AGAIN }
}

export interface SaveHoursOverrideInput {
  listingId: unknown
  date: unknown
  closed: unknown
  open: unknown
  close: unknown
  label: unknown
  /** The date being edited, when the owner moved it to another day. */
  previousDate?: unknown
}

/** Sets one date's hours. Saving a date already set replaces it. */
export async function saveHoursOverrideAction(
  input: SaveHoursOverrideInput
): Promise<HoursOverridesState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const parsed = parseHoursOverride(input, new Date())
  if (!parsed.ok) return { error: parsed.error }
  const value = parsed.value

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }
  const previous =
    isDateKey(input.previousDate) && input.previousDate !== value.date ? input.previousDate : null
  const others = previous ? items.filter((o) => o.date !== previous) : items
  const refusal = checkHoursOverrideAdd(others, value.date)
  if (refusal) return { error: refusal }

  const { error } = await supabase
    .from('listing_hours_overrides')
    .upsert({ listing_id: listing.id, ...value }, { onConflict: 'listing_id,date' })
  if (error) return { error: TRY_AGAIN }

  if (previous) {
    const { error: moveError } = await supabase
      .from('listing_hours_overrides')
      .delete()
      .eq('listing_id', listing.id)
      .eq('date', previous)
    if (moveError) return { error: TRY_AGAIN }
  }
  return done(supabase, listing)
}

/** Removes one date, so the weekly hours apply again. Always allowed. */
export async function deleteHoursOverrideAction(input: {
  listingId: unknown
  date: unknown
}): Promise<HoursOverridesState> {
  if (!isDateKey(input?.date)) return { error: 'That date wasn’t found. Reload and try again.' }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_hours_overrides')
    .delete()
    .eq('listing_id', listing.id)
    .eq('date', input.date)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}
