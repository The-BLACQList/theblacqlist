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
import { ownTier } from '@/lib/services/billing/locationTiers'

// Multi-location accounts, the owner's side (ticket 110). One Premium plan
// covers the page it is on (the primary) and up to 2 linked locations.
//
// Ownership, the plan and the limit are checked on the owner's own client,
// then the link and the linked page's tier are written with the service
// client: the entitlement guard stops an owner's client from changing a tier,
// and the link table has no write policy. Unlinking works on every plan and
// returns the page to Free (or to its own plan, if it has one).

export type LocationActionState = { success: true } | { error: string }

const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'
const LIVE_STATUSES = ['active', 'trialing', 'past_due']

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

/** Links one of the owner's pages to a Premium page, so the plan covers it. */
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
  const planTier = primary.tier
  if (!planTier || !coversLocations(planTier)) {
    return { error: 'Linking locations comes with Premium.' }
  }

  const { data: linkData, error: linkError } = await supabase
    .from('listing_location_links')
    .select(LOCATION_LINK_COLUMNS)
    .eq('owner_user_id', owner.user.id)
  if (linkError) return { error: TRY_AGAIN }
  const links = toLocationLinkRows(linkData)

  if (links.some((l) => l.location_listing_id === primary.id)) {
    return { error: `${primary.name} is covered by another page’s plan. Link from that page.` }
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
  const slots = linkedSlots(primary.tier)
  if (used >= slots) {
    return { error: `Premium covers ${slots + 1} locations: this page and ${slots} more.` }
  }

  const { data: ownSubs, error: subError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('listing_id', location.id)
    .in('status', LIVE_STATUSES)
    .limit(1)
  if (subError) return { error: TRY_AGAIN }
  if (ownSubs && ownSubs.length > 0) {
    return {
      error: `${location.name} has its own plan. Cancel it under Manage Subscription first, then link it here.`,
    }
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

  const { error: tierError } = await service
    .from('listings')
    .update({ tier: planTier })
    .eq('id', location.id)
  if (tierError) {
    // Without the tier the link means nothing; take it back so the owner can retry.
    await service.from('listing_location_links').delete().eq('location_listing_id', location.id)
    return { error: TRY_AGAIN }
  }

  await writeSystemAuditLog({
    actorUserId: owner.user.id,
    action: 'location_linked',
    targetTable: 'listing_location_links',
    targetId: location.id,
    beforeState: { tier: location.tier },
    afterState: { tier: planTier, primary_listing_id: primary.id },
  })

  revalidatePage(primary)
  revalidatePage(location)
  return { success: true }
}

/**
 * Takes a page out of its group. Works from either page and on every plan; the
 * page goes back to Free, or to its own plan if it has one.
 */
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
  let backTo: string
  try {
    backTo = await ownTier(service, location.id)
  } catch {
    return { error: TRY_AGAIN }
  }

  const { error: deleteError } = await service
    .from('listing_location_links')
    .delete()
    .eq('location_listing_id', location.id)
    .eq('owner_user_id', owner.user.id)
  if (deleteError) return { error: TRY_AGAIN }

  const { error: tierError } = await service
    .from('listings')
    .update({ tier: backTo })
    .eq('id', location.id)
  if (tierError) {
    // The link is gone but the tier wasn't reset: put the link back rather
    // than leave a page on Premium that nothing pays for.
    await service.from('listing_location_links').insert({
      location_listing_id: location.id,
      primary_listing_id: link.primary_listing_id,
      owner_user_id: owner.user.id,
    })
    return { error: TRY_AGAIN }
  }

  await writeSystemAuditLog({
    actorUserId: owner.user.id,
    action: 'location_unlinked',
    targetTable: 'listing_location_links',
    targetId: location.id,
    beforeState: { tier: location.tier, primary_listing_id: link.primary_listing_id },
    afterState: { tier: backTo },
  })

  revalidatePage(location)
  const { pages: primaries } = await ownedPages(owner.user.id, [link.primary_listing_id])
  const primary = primaries?.[0]
  if (primary) revalidatePage(primary)
  else revalidatePath(`/dashboard/pages/${link.primary_listing_id}/locations`)
  return { success: true }
}
