'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkVideo } from '@/lib/stripe/planChecks'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'

export type UpdateListingVideoState = { success: true; savedAt: string } | { error: string } | null

const VIDEO_HOSTS = ['youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com']

export async function updateListingVideoAction(
  _prev: UpdateListingVideoState,
  formData: FormData
): Promise<UpdateListingVideoState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this page.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  // Empty clears the video; otherwise require a YouTube/Vimeo URL.
  const raw = formData.get('video_embed_url')?.toString().trim() ?? ''
  let value: string | null = null
  if (raw) {
    let host = ''
    try {
      host = new URL(raw).hostname.replace(/^www\./, '')
    } catch {
      return { error: 'Enter a valid URL (or leave it blank).' }
    }
    if (!VIDEO_HOSTS.includes(host)) {
      return { error: 'Only YouTube or Vimeo links are supported.' }
    }
    value = raw
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  const sb = supabase as unknown as SupabaseClient

  // Plan gate (ticket 119): adding or changing a video is Starter. Removing
  // one, or saving the same link again, is always allowed.
  if (value) {
    const { data: current } = await sb
      .from('listing_details_business')
      .select('video_embed_url')
      .eq('listing_id', listingId)
      .maybeSingle()
    const previous = (current as { video_embed_url: string | null } | null)?.video_embed_url
    const limitError = checkVideo(listing.tier, value, previous)
    if (limitError) return { error: limitError }
  }

  const { error } = await sb
    .from('listing_details_business')
    .update({ video_embed_url: value })
    .eq('listing_id', listingId)

  if (error) return { error: 'Could not save the video. Please try again.' }

  const city = listing.cities as { slug: string } | null
  const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)
  if (publicUrl) revalidatePath(publicUrl)
  revalidateOwnerEditors(listingId)

  return { success: true, savedAt: new Date().toISOString() }
}
