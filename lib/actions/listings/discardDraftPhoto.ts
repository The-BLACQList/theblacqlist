'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

// Add-business uploads gallery photos before the listing row exists, and each
// upload writes a media_attachments row right away. Removing a photo in the
// form used to drop it from the screen only, so the row stayed, the photo still
// showed up on the new page, and it counted against the plan photo limit
// (ticket 119). With a Free limit of 1, an owner who swapped a photo was
// blocked. This removes the row and the stored file.
//
// Only for drafts: the caller must be the uploader, and no listing may exist
// yet for the id. Once the listing exists, the dashboard's deleteMediaAction
// owns removal and its ownership check.

export type DiscardDraftPhotoResult = { success: true } | { error: string }

export async function discardDraftPhotoAction(mediaId: string): Promise<DiscardDraftPhotoResult> {
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return { error: 'Invalid photo.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const serviceClient = createServiceClient()

  const { data: media } = await serviceClient
    .from('media_attachments')
    .select('id, entity_id, file_path')
    .eq('id', mediaId)
    .eq('entity_type', 'listing')
    .eq('uploaded_by', user.id)
    .maybeSingle()

  if (!media) return { error: 'Photo not found.' }

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id')
    .eq('id', media.entity_id)
    .maybeSingle()

  if (listing) return { error: 'Remove this photo from your dashboard instead.' }

  const { error } = await serviceClient.from('media_attachments').delete().eq('id', media.id)
  if (error) return { error: 'Could not remove the photo. Please try again.' }

  // Best effort, same as deleteMediaAction: a leftover file is invisible.
  await serviceClient.storage.from('listing-media').remove([media.file_path])

  return { success: true }
}
