'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { isUploadedBannerPath } from '@/lib/media/banner'

// =============================================================================
// Setting a cropped banner
// =============================================================================
// The banner editor crops in the browser and uploads the crop to POST
// /api/upload with media_role=cover, which stores it under
// listings/{id}/cover/ for the owner only and adds no media row (so it never
// counts toward the plan's photos). This makes that file the cover.
//
// A banner the owner uploaded earlier, now replaced or removed, is deleted:
// nothing else points at it. A gallery photo used as the cover is left alone.
// =============================================================================

export type SetBannerResult = { ok: true } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Makes `path` (an uploaded banner) the cover, or clears the cover when `path` is null. */
export async function setBannerAction(input: { listingId: unknown; path: unknown }): Promise<SetBannerResult> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }

  const listingId = typeof input?.listingId === 'string' ? input.listingId : ''
  if (!UUID_RE.test(listingId)) return { ok: false, error: 'Page not found, or you can’t edit it.' }
  const path = input?.path === null ? null : typeof input?.path === 'string' ? input.path : undefined
  if (path === undefined || (path !== null && !isUploadedBannerPath(listingId, path))) {
    return { ok: false, error: 'Something went wrong with that banner. Please try again.' }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cover_image_path, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: 'Page not found, or you can’t edit it.' }

  const service = createServiceClient()
  if (path) {
    // The file must be there: only the owner can upload into this folder.
    const folder = `listings/${listingId}/cover`
    const name = path.slice(folder.length + 1)
    const { data: found } = await service.storage.from('listing-media').list(folder, { search: name, limit: 1 })
    if (!found?.some((f) => f.name === name)) {
      return { ok: false, error: 'We couldn’t find that banner. Please upload it again.' }
    }
  }

  const { error } = await supabase.from('listings').update({ cover_image_path: path }).eq('id', listingId)
  if (error) return { ok: false, error: 'We couldn’t save your banner. Please try again.' }

  const previous = listing.cover_image_path
  if (previous && previous !== path && isUploadedBannerPath(listingId, previous)) {
    await service.storage.from('listing-media').remove([previous])
  }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listingId)
  return { ok: true }
}
