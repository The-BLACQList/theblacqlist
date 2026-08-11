'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type DeleteMediaState = { success: true } | { error: string } | null

export async function deleteMediaAction(
  _prev: DeleteMediaState,
  formData: FormData
): Promise<DeleteMediaState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to delete media.' }

  const mediaId = formData.get('media_id')?.toString().trim() ?? ''
  if (!mediaId) return { error: 'Missing media ID.' }

  const supabase = await createClient()

  const { data: media } = await supabase
    .from('media_attachments')
    .select('id, file_path, entity_id, entity_type')
    .eq('id', mediaId)
    .maybeSingle()

  if (!media) return { error: 'Media not found.' }

  // Verify ownership: this attachment must belong to a listing owned by the user
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, city_id, cover_image_path, cities(slug)')
    .eq('id', media.entity_id)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'You do not have permission to delete this media.' }

  // If this photo is the cover, drop the cover with it. Leaving the column
  // pointing at a removed storage object renders a broken image instead of
  // falling back to the brand tile.
  if (listing.cover_image_path && listing.cover_image_path === media.file_path) {
    await supabase.from('listings').update({ cover_image_path: null }).eq('id', listing.id)
  }

  // Delete DB row first
  const { error: dbError } = await supabase.from('media_attachments').delete().eq('id', mediaId)

  if (dbError) return { error: 'Failed to delete media. Please try again.' }

  // Delete from storage via service client (best-effort — don't fail if storage delete fails)
  const serviceClient = createServiceClient()
  await serviceClient.storage.from('listing-media').remove([media.file_path])

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true }
}
