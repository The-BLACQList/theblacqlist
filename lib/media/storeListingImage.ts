import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkPhotoAdd } from '@/lib/stripe/planChecks'
import { offerGrowthTo } from '@/lib/marketplace/entitlements'
import type { PreparedImage } from '@/lib/media/prepareImage'

// =============================================================================
// Storing a listing photo: the one path for uploads and site imports
// =============================================================================
// Lifted out of POST /api/upload so the site import (ticket 127) cannot drift
// from it. Everything the upload route learned stays true for both:
//
//   * `listingId` may name a row that does not exist yet. /add-business picks
//     the id before the listing is created and stores photos against it. A
//     missing row is normal; a row owned by someone else is always refused.
//   * The plan photo limit (ticket 119) counts gallery photos only. Logo and
//     cover never get a media_attachments row, so they never count. Before the
//     row exists the Free limit applies, since every new listing starts there.
//   * The extension and content-type come from the re-encoded image, never
//     from a filename or a client string.
//   * If the row insert fails, the stored object is removed rather than left
//     as an orphan nothing points at.
// =============================================================================

export type ListingImageRole = 'logo' | 'cover' | 'gallery'

export type StoreListingImageResult =
  | { ok: true; path: string; mediaId: string | null }
  | { ok: false; error: string; code: 'FORBIDDEN' | 'PLAN_LIMIT' | 'UPLOAD_FAILED' | 'SERVER_ERROR'; status: number }

type UserClient = Awaited<ReturnType<typeof createClient>>

/** The largest stored file for each role. Uploads check the file sent; imports check the re-encoded file. */
export function listingImageLimit(role: ListingImageRole): number {
  if (role === 'logo') return 2 * 1024 * 1024
  if (role === 'cover') return 5 * 1024 * 1024
  return 3 * 1024 * 1024
}

export async function storeListingImage(args: {
  supabase: UserClient
  userId: string
  listingId: string
  role: ListingImageRole
  image: PreparedImage
}): Promise<StoreListingImageResult> {
  const { supabase, userId, listingId, role, image } = args

  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_user_id, tier')
    .eq('id', listingId)
    .is('deleted_at', null)
    .maybeSingle()

  if (listing && listing.owner_user_id !== userId) {
    return {
      ok: false,
      error: 'You do not have permission to upload media for this listing.',
      code: 'FORBIDDEN',
      status: 403,
    }
  }

  const serviceClient = createServiceClient()
  const isGallery = role === 'gallery'

  if (isGallery) {
    const { count } = await serviceClient
      .from('media_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'listing')
      .eq('entity_id', listingId)

    const limitError = checkPhotoAdd(
      listing?.tier ?? 'free',
      count ?? 0,
      await offerGrowthTo(listing?.tier ?? null)
    )
    if (limitError) return { ok: false, error: limitError, code: 'PLAN_LIMIT', status: 400 }
  }

  const path = `listings/${listingId}/${role}/${crypto.randomUUID()}.${image.ext}`
  const { error: uploadError } = await serviceClient.storage
    .from('listing-media')
    .upload(path, image.bytes, { contentType: image.contentType, upsert: false })

  if (uploadError) return { ok: false, error: 'Upload failed.', code: 'UPLOAD_FAILED', status: 500 }
  if (!isGallery) return { ok: true, path, mediaId: null }

  // Ordering is appended, not assumed. Two uploads racing for the same slot is
  // a display bug; a lost object is a support ticket.
  const { data: last } = await serviceClient
    .from('media_attachments')
    .select('display_order')
    .eq('entity_type', 'listing')
    .eq('entity_id', listingId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: media, error: insertError } = await serviceClient
    .from('media_attachments')
    .insert({
      entity_type: 'listing',
      entity_id: listingId,
      file_path: path,
      file_type: image.contentType,
      file_size_bytes: image.bytes.length,
      uploaded_by: userId,
      display_order: (last?.display_order ?? -1) + 1,
    })
    .select('id')
    .single()

  if (insertError || !media) {
    await serviceClient.storage.from('listing-media').remove([path])
    return { ok: false, error: 'Upload failed. Please try again.', code: 'SERVER_ERROR', status: 500 }
  }

  return { ok: true, path, mediaId: media.id }
}
