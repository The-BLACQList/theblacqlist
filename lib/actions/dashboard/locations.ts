'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { isUuid } from '@/lib/listings/booking'
import { writeSystemAuditLog } from '@/lib/audit/system'
import {
  LOCATION_LINK_COLUMNS,
  coversLocations,
  linkedSlots,
  toLocationLinkRows,
} from '@/lib/listings/locations'
import { highestTier } from '@/lib/services/billing/ownerPlan'

// Multi-location accounts, the owner's side (ticket 110). On Premium an owner
// links up to 3 of their business pages as locations of one business, and
// each shows the others under Also At.
//
// Since ticket 238 a link is display only: which pages a plan covers is the
// owner's choice under Pages On Your Plan, and no tier is written here.
// Ownership, the plan and the limit are checked on the owner's own client;
// the link is written with the service client because the link table has no
// write policy. Unlinking works on every plan.

export type LocationActionState = { success: true } | { error: string }

const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'

interface OwnedPage {
  id: string
  name: string
  slug: string
  status: string | null
  entity_type: string
  tier: string | null
  cities: unknown
}

function isBusinessPage(p: OwnedPage): boolean {
  return p.entity_type !== 'job' && p.entity_type !== 'event'
}

function revalidatePage(p: OwnedPage): void {
  if (p.status === 'published' && p.slug) {
    const citySlug = (p.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(p.entity_type, citySlug, p.slug))
  }
  revalidatePath(`/dashboard/pages/${p.id}/locations`)
}

/** The owner's plan: the highest tier across their pages (ticket 238). */
async function ownerTier(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('tier')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
  if (error) return null
  return highestTier((data ?? []) as { tier: string | null }[])
}

async function ownedPages(userId: string, ids: string[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id, name, slug, status, entity_type, tier, cities(slug)')
    .in('id', ids)
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
  return { supabase, pages: error ? null : ((data ?? []) as OwnedPage[]) }
}

/** Links one of the owner's business pages to another as a location (Premium). */
export async function linkLocationAction(input: {
  primaryId: unknown
  locationId: unknown
}): Promise<LocationActionState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'Please sign in again.' }
  const { primaryId, locationId } = input ?? {}
  if (!isUuid(primaryId) || !isUuid(locationId)) return { error: NOT_FOUND }
  if (primaryId === locationId) return { error: 'Pick another of your pages.' }

  const { supabase, pages } = await ownedPages(owner.user.id, [primaryId, locationId])
  if (!pages) return { error: TRY_AGAIN }
  const primary = pages.find((p) => p.id === primaryId)
  const location = pages.find((p) => p.id === locationId)
  if (!primary || !location) return { error: NOT_FOUND }
  if (!isBusinessPage(primary) || !isBusinessPage(location)) {
    return { error: 'Only business pages can be linked as locations.' }
  }
  const planTier = await ownerTier(owner.user.id)
  if (planTier === null) return { error: TRY_AGAIN }
  if (!coversLocations(planTier)) {
    return { error: 'Linking locations comes with Premium.' }
  }

  const { data: linkData, error: linkError } = await supabase
    .from('listing_location_links')
    .select(LOCATION_LINK_COLUMNS)
    .eq('owner_user_id', owner.user.id)
  if (linkError) return { error: TRY_AGAIN }
  const links = toLocationLinkRows(linkData)

  if (links.some((l) => l.location_listing_id === primary.id)) {
    return { error: `${primary.name} is linked to another page. Link from that page.` }
  }
  const existing = links.find((l) => l.location_listing_id === location.id)
  if (existing) {
    return {
      error:
        existing.primary_listing_id === primary.id
          ? `${location.name} is already linked.`
          : `${location.name} is linked to another page. Unlink it there first.`,
    }
  }
  if (links.some((l) => l.primary_listing_id === location.id)) {
    return { error: `${location.name} has its own linked locations, so it can’t be linked here.` }
  }
  const used = links.filter((l) => l.primary_listing_id === primary.id).length
  const slots = linkedSlots(planTier)
  if (used >= slots) {
    return { error: `Premium links up to ${slots + 1} locations: this page and ${slots} more.` }
  }

  const service = createServiceClient()
  const { error: insertError } = await service.from('listing_location_links').insert({
    location_listing_id: location.id,
    primary_listing_id: primary.id,
    owner_user_id: owner.user.id,
  })
  if (insertError) {
    return insertError.code === '23505'
      ? { error: `${location.name} is already linked.` }
      : { error: TRY_AGAIN }
  }

  await writeSystemAuditLog({
    actorUserId: owner.user.id,
    action: 'location_linked',
    targetTable: 'listing_location_links',
    targetId: location.id,
    afterState: { primary_listing_id: primary.id },
  })

  revalidatePage(primary)
  revalidatePage(location)
  return { success: true }
}

/** Takes a page out of its group. Works from either page and on every plan. */
export async function unlinkLocationAction(input: {
  locationId: unknown
}): Promise<LocationActionState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'Please sign in again.' }
  const locationId = input?.locationId
  if (!isUuid(locationId)) return { error: NOT_FOUND }

  const { supabase, pages } = await ownedPages(owner.user.id, [locationId])
  if (!pages) return { error: TRY_AGAIN }
  const location = pages[0]
  if (!location) return { error: NOT_FOUND }

  const { data: link, error: linkError } = await supabase
    .from('listing_location_links')
    .select(LOCATION_LINK_COLUMNS)
    .eq('location_listing_id', location.id)
    .eq('owner_user_id', owner.user.id)
    .maybeSingle()
  if (linkError) return { error: TRY_AGAIN }
  if (!link) return { error: `${location.name} isn’t linked.` }

  const service = createServiceClient()
  const { error: deleteError } = await service
    .from('listing_location_links')
    .delete()
    .eq('location_listing_id', location.id)
    .eq('owner_user_id', owner.user.id)
  if (deleteError) return { error: TRY_AGAIN }

  await writeSystemAuditLog({
    actorUserId: owner.user.id,
    action: 'location_unlinked',
    targetTable: 'listing_location_links',
    targetId: location.id,
    beforeState: { primary_listing_id: link.primary_listing_id },
  })

  revalidatePage(location)
  const { pages: primaries } = await ownedPages(owner.user.id, [link.primary_listing_id])
  const primary = primaries?.[0]
  if (primary) revalidatePage(primary)
  else revalidatePath(`/dashboard/pages/${link.primary_listing_id}/locations`)
  return { success: true }
}
