'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { isUploadedLogoPath } from '@/lib/media/logo'

// =============================================================================
// Setting or removing the logo (ticket 185)
// =============================================================================
// The logo uploader posts the file to POST /api/upload with media_role=logo,
// which checks ownership, re-encodes it and stores it under
// listings/{id}/logo/ with no media row. This makes that file the logo, or
// clears the logo when `path` is null. Same shape as setBannerAction.
//
// A logo the owner uploaded earlier, now replaced or removed, is deleted:
// nothing else points at it. A logo set some other way (a seed, the site
// import's first draft) is left in storage.
// =============================================================================

export type SetLogoResult = { ok: true } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Makes `path` (an uploaded logo) the page's logo, or removes the logo when `path` is null. */
export async function setLogoAction(input: {
  listingId: unknown
  path: unknown
}): Promise<SetLogoResult> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }

  const listingId = typeof input?.listingId === 'string' ? input.listingId : ''
  if (!UUID_RE.test(listingId)) return { ok: false, error: 'Page not found, or you can’t edit it.' }
  const path =
    input?.path === null ? null : typeof input?.path === 'string' ? input.path : undefined
  if (path === undefined || (path !== null && !isUploadedLogoPath(listingId, path))) {
    return { ok: false, error: 'Something went wrong with that logo. Please try again.' }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, logo_path, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: 'Page not found, or you can’t edit it.' }

  const service = createServiceClient()
  if (path) {
    // The file must be there: only the owner can upload into this folder.
    const folder = `listings/${listingId}/logo`
    const name = path.slice(folder.length + 1)
    const { data: found } = await service.storage
      .from('listing-media')
      .list(folder, { search: name, limit: 1 })
    if (!found?.some((f) => f.name === name)) {
      return { ok: false, error: 'We couldn’t find that logo. Please upload it again.' }
    }
  }

  const { error } = await supabase.from('listings').update({ logo_path: path }).eq('id', listingId)
  if (error) return { ok: false, error: 'We couldn’t save your logo. Please try again.' }

  const previous = listing.logo_path
  if (previous && previous !== path && isUploadedLogoPath(listingId, previous)) {
    await service.storage.from('listing-media').remove([previous])
  }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug)
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listingId)
  return { ok: true }
}
