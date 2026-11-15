'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkTeamAdd } from '@/lib/stripe/planChecks'
import { teamOffers } from '@/lib/marketplace/entitlements'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  TEAM_COLUMNS,
  TEAM_SAVED_MAX,
  isUploadedTeamPhotoPath,
  parseTeamMember,
  toOwnerTeam,
  type OwnerTeamMember,
} from '@/lib/listings/team'

// Team members (ticket 107). The owner adds, edits, reorders and removes the
// people on their page. Writes run on the owner's own client, so the
// listing_team_members RLS policies apply as well as the checks here. Every
// action returns the page's team as saved. Adding is checked against the
// plan; editing, reordering and removing are always allowed, so an owner who
// moved down a plan can still tidy what they have.

export type TeamState = { success: true; members: OwnerTeamMember[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save your team. Please try again.'
const MEMBER_NOT_FOUND = 'Team member not found.'

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
  // A job or an event has no team block.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readTeam(supabase: Supabase, listingId: string): Promise<OwnerTeamMember[] | null> {
  const { data, error } = await supabase
    .from('listing_team_members')
    .select(TEAM_COLUMNS)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return null
  return toOwnerTeam(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }
  revalidatePath(`/dashboard/pages/${listing.id}/team`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<TeamState> {
  revalidate(listing)
  const members = await readTeam(supabase, listing.id)
  return members ? { success: true, members } : { error: TRY_AGAIN }
}

/** Removes a photo the owner uploaded for a member. Best effort. */
async function removePhoto(listingId: string, path: string | null | undefined): Promise<void> {
  if (!path || !isUploadedTeamPhotoPath(listingId, path)) return
  try {
    await createServiceClient().storage.from('listing-media').remove([path])
  } catch {
    // A leftover file is harmless; no member points at it.
  }
}

/** The uploaded file must be there: only the owner can upload into this folder. */
async function photoExists(listingId: string, path: string): Promise<boolean> {
  const folder = `listings/${listingId}/team`
  const name = path.slice(folder.length + 1)
  const { data } = await createServiceClient()
    .storage.from('listing-media')
    .list(folder, { search: name, limit: 1 })
  return Boolean(data?.some((f) => f.name === name))
}

/** Only one founder card a page: clear the flag on everyone else first. */
async function clearOtherFounders(
  supabase: Supabase,
  listingId: string,
  keepId: string | null
): Promise<boolean> {
  let q = supabase
    .from('listing_team_members')
    .update({ is_founder: false })
    .eq('listing_id', listingId)
    .eq('is_founder', true)
  if (keepId) q = q.neq('id', keepId)
  const { error } = await q
  return !error
}

export interface SaveTeamMemberInput {
  listingId: unknown
  /** Left out for a new member. */
  id?: unknown
  name: unknown
  role: unknown
  bio: unknown
  isFounder: unknown
  /** A new upload's path, null to remove the photo, undefined to keep it. */
  photoPath?: unknown
}

/** Adds or edits one member. Adding is checked against the plan's limit. */
export async function saveTeamMemberAction(input: SaveTeamMemberInput): Promise<TeamState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const members = await readTeam(supabase, listing.id)
  if (!members) return { error: TRY_AGAIN }

  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id))) {
    return { error: MEMBER_NOT_FOUND }
  }
  const existing = id ? members.find((m) => m.id === id) : undefined
  if (id && !existing) return { error: MEMBER_NOT_FOUND }

  const parsed = parseTeamMember(input)
  if (!parsed.ok) return { error: parsed.error }

  if (!existing) {
    if (members.length >= TEAM_SAVED_MAX) {
      return { error: `You have ${TEAM_SAVED_MAX} team members saved. Remove one to add another.` }
    }
    const { growthOpen, premiumOpen } = await teamOffers(listing.tier)
    const limitError = checkTeamAdd(listing.tier, members.length, growthOpen, premiumOpen)
    if (limitError) return { error: limitError }
  }

  let photoPath: string | null = existing?.photo_path ?? null
  if (input.photoPath === null) photoPath = null
  else if (typeof input.photoPath === 'string' && input.photoPath !== existing?.photo_path) {
    if (
      !isUploadedTeamPhotoPath(listing.id, input.photoPath) ||
      !(await photoExists(listing.id, input.photoPath))
    ) {
      return { error: 'We couldn’t find that photo. Please upload it again.' }
    }
    photoPath = input.photoPath
  }

  if (parsed.value.is_founder && !existing?.is_founder) {
    if (!(await clearOtherFounders(supabase, listing.id, existing?.id ?? null))) {
      return { error: TRY_AGAIN }
    }
  }

  const row = { ...parsed.value, photo_path: photoPath }
  const nextOrder = members.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1
  const { error } = existing
    ? await supabase
        .from('listing_team_members')
        .update(row)
        .eq('id', existing.id)
        .eq('listing_id', listing.id)
    : await supabase
        .from('listing_team_members')
        .insert({ listing_id: listing.id, sort_order: nextOrder, ...row })
  if (error) return { error: TRY_AGAIN }

  if (existing?.photo_path && existing.photo_path !== photoPath) {
    await removePhoto(listing.id, existing.photo_path)
  }
  return done(supabase, listing)
}

/** Puts the team in the order given. The ids must be exactly the page's members. */
export async function reorderTeamAction(input: {
  listingId: unknown
  ids: unknown
}): Promise<TeamState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const members = await readTeam(supabase, listing.id)
  if (!members) return { error: TRY_AGAIN }

  const ids = input.ids
  if (
    !Array.isArray(ids) ||
    ids.length !== members.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((x) => typeof x === 'string' && members.some((m) => m.id === x))
  ) {
    return { error: 'Your team changed in another tab. Reload the page and try again.' }
  }

  const moves = (ids as string[])
    .map((memberId, order) => ({ memberId, order }))
    .filter(({ memberId, order }) => members.find((m) => m.id === memberId)?.sort_order !== order)
  const results = await Promise.all(
    moves.map(({ memberId, order }) =>
      supabase
        .from('listing_team_members')
        .update({ sort_order: order })
        .eq('id', memberId)
        .eq('listing_id', listing.id)
    )
  )
  if (results.some((r) => r.error)) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Removes a member and their photo. Always allowed. */
export async function deleteTeamMemberAction(input: {
  listingId: unknown
  id: unknown
}): Promise<TeamState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: MEMBER_NOT_FOUND }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { data: removed, error } = await supabase
    .from('listing_team_members')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
    .select('photo_path')
    .maybeSingle()
  if (error) return { error: TRY_AGAIN }
  await removePhoto(listing.id, removed?.photo_path)
  return done(supabase, listing)
}
