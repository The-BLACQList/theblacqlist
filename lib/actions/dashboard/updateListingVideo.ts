'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkVideo } from '@/lib/stripe/planChecks'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { checkRateLimit } from '@/lib/security/rate-limit'
import {
  matchesDeclaredType,
  SIGNATURE_HEADER_BYTES,
  SIGNATURE_MISMATCH_ERROR,
} from '@/lib/security/file-signature'
import {
  LISTING_VIDEO_BUCKET,
  LISTING_VIDEO_MAX_BYTES,
  buildListingVideoPath,
  formatMegabytes,
  isListingVideoPath,
  isListingVideoType,
  listingVideoFolder,
  listingVideoPublicUrl,
} from '@/lib/video/listingVideo'

// A page has one video: a YouTube/Vimeo link (video_embed_url) or a file the
// owner uploaded (video_path, ticket 130). Saving either one clears the other,
// and any uploaded file the page no longer uses is removed from storage.

export type UpdateListingVideoState = { success: true; savedAt: string } | { error: string } | null

export type StartVideoUploadResult = { path: string; signedUrl: string } | { error: string }
export type VideoChangeResult = { success: true } | { error: string }

const VIDEO_HOSTS = ['youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com']

// Each upload can be 50 MB. Ten an hour covers an owner retrying a few times
// on a bad connection and still caps what one account can push into storage.
const VIDEO_UPLOAD_RATE_LIMIT = 10
const VIDEO_UPLOAD_RATE_WINDOW_SECONDS = 60 * 60

type OwnedListing = {
  id: string
  slug: string
  entity_type: string
  tier: string | null
  cities: { slug: string } | null
}

type CurrentVideo = { video_embed_url: string | null; video_path: string | null }

async function loadOwnedListing(
  listingId: string
): Promise<{ sb: SupabaseClient; listing: OwnedListing; userId: string } | { error: string }> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this page.' }
  if (!listingId) return { error: 'Missing listing ID.' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or you do not have permission to edit it.' }

  return {
    sb: supabase as unknown as SupabaseClient,
    listing: listing as unknown as OwnedListing,
    userId: owner.user.id,
  }
}

async function readCurrentVideo(sb: SupabaseClient, listingId: string): Promise<CurrentVideo> {
  const { data } = await sb
    .from('listing_details_business')
    .select('video_embed_url, video_path')
    .eq('listing_id', listingId)
    .maybeSingle()
  const row = data as Partial<CurrentVideo> | null
  return { video_embed_url: row?.video_embed_url ?? null, video_path: row?.video_path ?? null }
}

/**
 * Saves the page's video columns. Returns false when no details row was
 * updated, so a page without one reports an error instead of a silent success.
 */
async function saveVideo(sb: SupabaseClient, listingId: string, next: CurrentVideo) {
  const { data, error } = await sb
    .from('listing_details_business')
    .update(next)
    .eq('listing_id', listingId)
    .select('listing_id')
  return !error && Array.isArray(data) && data.length > 0
}

/**
 * Removes every uploaded video for this listing except `keep`. That covers the
 * one being replaced and any upload an owner started and never finished.
 * Best effort: a leftover file costs storage, not correctness.
 */
async function removeStoredVideos(listingId: string, keep: string | null): Promise<void> {
  try {
    const storage = createServiceClient().storage.from(LISTING_VIDEO_BUCKET)
    const folder = listingVideoFolder(listingId)
    const { data } = await storage.list(folder, { limit: 100 })
    const stale = (data ?? []).map((o) => `${folder}/${o.name}`).filter((p) => p !== keep)
    if (stale.length > 0) await storage.remove(stale)
  } catch {
    // Storage unreachable or the bucket not created yet. Nothing to clean.
  }
}

function revalidateListing(listing: OwnedListing) {
  const publicUrl = buildEntityUrl(listing.entity_type, listing.cities?.slug, listing.slug)
  if (publicUrl) revalidatePath(publicUrl)
  revalidateOwnerEditors(listing.id)
}

// -----------------------------------------------------------------------------
// Link
// -----------------------------------------------------------------------------

export async function updateListingVideoAction(
  _prev: UpdateListingVideoState,
  formData: FormData
): Promise<UpdateListingVideoState> {
  const listingId = formData.get('listing_id')?.toString().trim() ?? ''

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
      return { error: 'Links work from YouTube or Vimeo. To use another video, upload the file.' }
    }
    value = raw
  }

  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  // Plan gate (ticket 119): adding or changing a video is Starter. Removing
  // one, or saving the same link again, is always allowed.
  if (value) {
    const current = await readCurrentVideo(sb, listingId)
    const limitError = checkVideo(listing.tier, value, current.video_embed_url)
    if (limitError) return { error: limitError }
  }

  if (!(await saveVideo(sb, listingId, { video_embed_url: value, video_path: null }))) {
    return { error: 'Could not save the video. Please try again.' }
  }
  await removeStoredVideos(listingId, null)

  revalidateListing(listing)
  return { success: true, savedAt: new Date().toISOString() }
}

// -----------------------------------------------------------------------------
// Upload: the browser sends the file straight to storage. A server function
// body tops out near 4.5 MB on Vercel, far under a phone video. So the server
// hands out a one-time upload URL for a path it chose, the browser uploads to
// it, and then the server checks what arrived before the page points at it.
// -----------------------------------------------------------------------------

export async function startListingVideoUploadAction(
  listingId: string,
  mime: string,
  size: number
): Promise<StartVideoUploadResult> {
  if (!isListingVideoType(mime)) {
    return { error: 'Choose an MP4, MOV, or WebM video.' }
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { error: 'That video looks empty. Choose another file.' }
  }
  if (size > LISTING_VIDEO_MAX_BYTES) {
    return { error: `Videos can be up to ${formatMegabytes(LISTING_VIDEO_MAX_BYTES)}.` }
  }

  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { listing, userId } = owned

  // A new upload is always a change, so only Starter and up get past here.
  const limitError = checkVideo(listing.tier, 'upload', null)
  if (limitError) return { error: limitError }

  if (
    !(await checkRateLimit({
      bucket: 'video_upload',
      identifier: userId,
      limit: VIDEO_UPLOAD_RATE_LIMIT,
      windowSeconds: VIDEO_UPLOAD_RATE_WINDOW_SECONDS,
    }))
  ) {
    return { error: 'Too many video uploads. Please wait a while and try again.' }
  }

  const path = buildListingVideoPath(listing.id, mime)
  if (!path) return { error: 'Choose an MP4, MOV, or WebM video.' }

  const { data, error } = await createServiceClient()
    .storage.from(LISTING_VIDEO_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) return { error: 'Could not start the upload. Please try again.' }

  return { path, signedUrl: data.signedUrl }
}

/** Reads the first bytes of the uploaded object back from storage. */
async function readStoredHeader(path: string): Promise<Uint8Array | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const res = await fetch(listingVideoPublicUrl(base, path), {
      headers: { Range: `bytes=0-${SIGNATURE_HEADER_BYTES - 1}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    return bytes.slice(0, SIGNATURE_HEADER_BYTES)
  } catch {
    return null
  }
}

export async function finishListingVideoUploadAction(
  listingId: string,
  path: string
): Promise<VideoChangeResult> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  // Only a path this listing could have been issued. Anything else is not
  // ours to point a page at.
  if (!isListingVideoPath(path, listing.id)) return { error: 'That upload is not for this page.' }

  const limitError = checkVideo(listing.tier, path, null)
  if (limitError) return { error: limitError }

  const storage = createServiceClient().storage.from(LISTING_VIDEO_BUCKET)
  const folder = listingVideoFolder(listing.id)
  const name = path.slice(folder.length + 1)
  const { data: found } = await storage.list(folder, { search: name, limit: 1 })
  const object = (found ?? []).find((o) => o.name === name)
  if (!object) return { error: 'The upload did not finish. Please try again.' }

  // The bucket already enforced type and size on the way in. These are the
  // same checks against what storage says it holds, plus the bytes themselves.
  const meta = (object.metadata ?? {}) as { size?: number; mimetype?: string }
  const fail = async (error: string): Promise<VideoChangeResult> => {
    await storage.remove([path])
    return { error }
  }
  if (!meta.mimetype || !isListingVideoType(meta.mimetype)) {
    return fail('Choose an MP4, MOV, or WebM video.')
  }
  if (typeof meta.size === 'number' && meta.size > LISTING_VIDEO_MAX_BYTES) {
    return fail(`Videos can be up to ${formatMegabytes(LISTING_VIDEO_MAX_BYTES)}.`)
  }
  const header = await readStoredHeader(path)
  if (!header) return fail('Could not check the upload. Please try again.')
  if (!matchesDeclaredType(header, meta.mimetype)) return fail(SIGNATURE_MISMATCH_ERROR)

  if (!(await saveVideo(sb, listing.id, { video_embed_url: null, video_path: path }))) {
    return fail('Could not save the video. Please try again.')
  }
  await removeStoredVideos(listing.id, path)

  revalidateListing(listing)
  return { success: true }
}

/** Removing a video is always allowed, on every plan. */
export async function removeListingVideoAction(listingId: string): Promise<VideoChangeResult> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  if (!(await saveVideo(sb, listing.id, { video_embed_url: null, video_path: null }))) {
    return { error: 'Could not remove the video. Please try again.' }
  }
  await removeStoredVideos(listing.id, null)

  revalidateListing(listing)
  return { success: true }
}
