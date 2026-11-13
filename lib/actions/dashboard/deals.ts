'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkDealAdd } from '@/lib/stripe/planChecks'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  DEALS_SAVED_MAX,
  dealIsOn,
  isLiveDeal,
  parseDeal,
  toOwnerDeals,
  type OwnerDeal,
} from '@/lib/listings/deals'

// Coupons and deals (owner-experience round 2, part G). The owner adds, edits,
// ends and deletes deals for their page. Turning a deal on is Premium only;
// ending, deleting and saving a draft are always allowed, so a page that moved
// down a plan can still tidy up. Writes run on the owner's own client, so the
// listing_deals RLS policies apply as well as the checks here. Every action
// returns the page's deals as saved.

export type DealsState = { success: true; deals: OwnerDeal[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save your deal. Please try again.'
const OFF = 'Deals aren’t available yet.'

const DEAL_COLUMNS = 'id, title, description, code, terms, starts_at, ends_at, status, created_at'

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
  if (!isFeatureEnabled('coupons')) return { ok: false, error: OFF }
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId))
    return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // Jobs and events are postings, not businesses.
  if (listing.entity_type === 'job' || listing.entity_type === 'event')
    return { ok: false, error: NOT_FOUND }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readDeals(supabase: Supabase, listingId: string): Promise<OwnerDeal[] | null> {
  const { data, error } = await supabase
    .from('listing_deals')
    .select(DEAL_COLUMNS)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) return null
  return toOwnerDeals(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug)
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<DealsState> {
  revalidate(listing)
  const deals = await readDeals(supabase, listing.id)
  return deals ? { success: true, deals } : { error: TRY_AGAIN }
}

export interface SaveDealInput {
  listingId: unknown
  /** Left out for a new deal. */
  id?: unknown
  title: unknown
  description: unknown
  code: unknown
  terms: unknown
  startsAt: unknown
  /** Blank for a deal with no end. */
  endsAt: unknown
  /** true puts it on the page (or keeps it on); false saves it as a draft. */
  publish: unknown
}

/** Creates or edits one deal. Turning a deal on is checked against the plan. */
export async function saveDealAction(input: SaveDealInput): Promise<DealsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const deals = await readDeals(supabase, listing.id)
  if (!deals) return { error: TRY_AGAIN }

  const now = new Date()
  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id)))
    return { error: 'Deal not found.' }
  const existing = id ? deals.find((d) => d.id === id) : undefined
  if (id && !existing) return { error: 'Deal not found.' }
  if (!existing && deals.length >= DEALS_SAVED_MAX) {
    return { error: `You have ${DEALS_SAVED_MAX} saved deals. Delete an old one to add another.` }
  }

  // A running deal keeps its start; anything else starts now at the earliest.
  const parsed = parseDeal(
    input,
    now,
    existing && isLiveDeal(existing, now) ? existing.starts_at : null
  )
  if (!parsed.ok) return { error: parsed.error }

  const publish = input.publish === true
  if (publish) {
    // Checked on every publish, an edit of a deal that is already on included:
    // a page that moved down a plan can end or delete deals, not change live ones.
    const on = deals.filter((d) => d.id !== existing?.id && dealIsOn(d, now)).length
    const limitError = checkDealAdd(listing.tier, on)
    if (limitError) return { error: limitError }
  }

  const row = { ...parsed.value, status: publish ? 'active' : 'draft' }
  const { error } = existing
    ? await supabase
        .from('listing_deals')
        .update(row)
        .eq('id', existing.id)
        .eq('listing_id', listing.id)
    : await supabase.from('listing_deals').insert({ listing_id: listing.id, ...row })
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Ends a deal now. Always allowed. */
export async function endDealAction(input: {
  listingId: unknown
  id: unknown
}): Promise<DealsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Deal not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_deals')
    .update({ status: 'ended' })
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Deletes a deal. Always allowed. */
export async function deleteDealAction(input: {
  listingId: unknown
  id: unknown
}): Promise<DealsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Deal not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_deals')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}
