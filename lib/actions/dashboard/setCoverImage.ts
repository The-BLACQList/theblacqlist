'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type SetCoverImageState = { success: true } | { error: string } | null

/**
 * Promote an already-uploaded photo to the listing cover, or clear the cover.
 *
 * `listings.cover_image_path` was previously written only at creation time
 * (createListing / SubmitListingForm / PreviewPublishStep), so an owner who
 * claimed a seeded listing had no way to ever get a cover onto it. Rather than
 * add a second upload flow, this promotes a row that already came through
 * POST /api/media/upload — same bucket, same path convention, same plan limits.
 *
 * Pass `media_id` to set, or omit it to clear back to the brand tile.
 */
export async function setCoverImageAction(
  _prev: SetCoverImageState,
  formData: FormData
): Promise<SetCoverImageState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to change your cover image.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const mediaId = formData.get('media_id')?.toString().trim() ?? ''

  if (!listingId) return { error: 'Missing listing ID.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'You do not have permission to edit this listing.' }

  let coverPath: string | null = null

  if (mediaId) {
    // The photo must belong to this listing — otherwise an owner could point
    // their cover at another business's file path.
    const { data: media } = await supabase
      .from('media_attachments')
      .select('id, file_path')
      .eq('id', mediaId)
      .eq('entity_id', listingId)
      .eq('entity_type', 'listing')
      .maybeSingle()

    if (!media) return { error: 'Photo not found.' }
    coverPath = media.file_path
  }

  const { error } = await supabase
    .from('listings')
    .update({ cover_image_path: coverPath })
    .eq('id', listingId)

  if (error) return { error: 'Failed to update your cover image. Please try again.' }

  revalidatePath(`/dashboard/pages/${listingId}/media`)

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true }
}
