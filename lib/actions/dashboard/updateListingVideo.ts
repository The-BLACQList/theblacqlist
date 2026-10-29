'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkVideoAdd } from '@/lib/stripe/planChecks'
import { offerGrowthTo } from '@/lib/marketplace/entitlements'
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

// A page's videos (ticket 105). Each one is a row in listing_videos: a
// YouTube/Vimeo link or a file the owner uploaded (ticket 130), in the owner's
// order. Adding one checks the plan's video limit (checkVideoAdd), and the
// insert policy checks it again in the database. Removing and reordering are
// allowed on every plan, so an owner on a lower plan can choose which videos
// show. Uploaded files no row points at are removed from storage.

export type AddVideoLinkState = { success: true; savedAt: string } | { error: string } | null

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

type VideoRow = { id: string; kind: 'embed' | 'file'; file_path: string | null; position: number }

// A signed upload URL lasts two hours. A file younger than that with no row
// may be an upload still in flight in another tab, so cleanup leaves it.
const UPLOAD_GRACE_MS = 2 * 60 * 60 * 1000

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

async function readVideos(sb: SupabaseClient, listingId: string): Promise<VideoRow[] | null> {
  const { data, error } = await sb
    .from('listing_videos')
    .select('id, kind, file_path, position')
    .eq('listing_id', listingId)
    .order('position')
    .order('created_at')
  if (error) return null
  return (data ?? []) as VideoRow[]
}

/** Adds a video at the end of the page's list. False when the insert failed. */
async function insertVideo(
  sb: SupabaseClient,
  listingId: string,
  existing: VideoRow[],
  row: { kind: 'embed'; embed_url: string } | { kind: 'file'; file_path: string }
): Promise<boolean> {
  const position = existing.reduce((max, v) => Math.max(max, v.position + 1), 0)
  const { data, error } = await sb
    .from('listing_videos')
    .insert({ listing_id: listingId, position, ...row })
    .select('id')
  return !error && Array.isArray(data) && data.length > 0
}

/**
 * Removes uploaded files for this listing that no listing_videos row points
 * at: a removed video, or an upload an owner started and never finished.
 * Best effort: a leftover file costs storage, not correctness.
 */
async function removeUnusedVideoFiles(sb: SupabaseClient, listingId: string): Promise<void> {
  try {
    const rows = await readVideos(sb, listingId)
    if (!rows) return
    const used = new Set(rows.flatMap((r) => (r.file_path ? [r.file_path] : [])))
    const storage = createServiceClient().storage.from(LISTING_VIDEO_BUCKET)
    const folder = listingVideoFolder(listingId)
    const { data } = await storage.list(folder, { limit: 100 })
    const cutoff = Date.now() - UPLOAD_GRACE_MS
    const stale = (data ?? [])
      .filter((o) => {
        const created = o.created_at ? Date.parse(o.created_at) : NaN
        return Number.isNaN(created) || created < cutoff
      })
      .map((o) => `${folder}/${o.name}`)
      .filter((p) => !used.has(p))
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

export async function addListingVideoLinkAction(
  _prev: AddVideoLinkState,
  formData: FormData
): Promise<AddVideoLinkState> {
  const listingId = formData.get('listing_id')?.toString().trim() ?? ''

  const raw = formData.get('video_embed_url')?.toString().trim() ?? ''
  if (!raw) return { error: 'Paste a YouTube or Vimeo link.' }
  let host = ''
  try {
    host = new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return { error: 'Enter a valid link.' }
  }
  if (!VIDEO_HOSTS.includes(host)) {
    return { error: 'Links work from YouTube or Vimeo. To use another video, upload the file.' }
  }
  if (raw.length > 500) return { error: 'That link is too long. Copy the short share link.' }

  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  const existing = await readVideos(sb, listingId)
  if (!existing) return { error: 'Could not save the video. Please try again.' }
  const limitError = checkVideoAdd(listing.tier, existing.length, await offerGrowthTo(listing.tier))
  if (limitError) return { error: limitError }

  if (!(await insertVideo(sb, listingId, existing, { kind: 'embed', embed_url: raw }))) {
    return { error: 'Could not save the video. Please try again.' }
  }

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
  const { sb, listing, userId } = owned

  // An upload adds a video, so the page needs room for one more.
  const existing = await readVideos(sb, listing.id)
  if (!existing) return { error: 'Could not start the upload. Please try again.' }
  const limitError = checkVideoAdd(listing.tier, existing.length, await offerGrowthTo(listing.tier))
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

  const existing = await readVideos(sb, listing.id)
  if (!existing) return { error: 'Could not save the video. Please try again.' }
  if (existing.some((v) => v.file_path === path)) return { success: true }
  const limitError = checkVideoAdd(listing.tier, existing.length, await offerGrowthTo(listing.tier))
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

  if (!(await insertVideo(sb, listing.id, existing, { kind: 'file', file_path: path }))) {
    return fail('Could not save the video. Please try again.')
  }
  await removeUnusedVideoFiles(sb, listing.id)

  revalidateListing(listing)
  return { success: true }
}

// -----------------------------------------------------------------------------
// Remove and reorder: allowed on every plan
// -----------------------------------------------------------------------------

export async function removeListingVideoAction(
  listingId: string,
  videoId: string
): Promise<VideoChangeResult> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  const { data, error } = await sb
    .from('listing_videos')
    .delete()
    .eq('id', videoId)
    .eq('listing_id', listing.id)
    .select('id')
  if (error || !Array.isArray(data) || data.length === 0) {
    return { error: 'Could not remove the video. Please try again.' }
  }
  await removeUnusedVideoFiles(sb, listing.id)

  revalidateListing(listing)
  return { success: true }
}

/**
 * Moves one video up or down a place. The first videos are the ones a lower
 * plan shows, so this is how an owner chooses what stays on the page.
 */
export async function moveListingVideoAction(
  listingId: string,
  videoId: string,
  direction: 'up' | 'down'
): Promise<VideoChangeResult> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return owned
  const { sb, listing } = owned

  const rows = await readVideos(sb, listing.id)
  if (!rows) return { error: 'Could not move the video. Please try again.' }
  const from = rows.findIndex((r) => r.id === videoId)
  if (from === -1) return { error: 'That video is not on this page.' }
  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= rows.length) return { success: true }

  const order = [...rows]
  const moving = order[from]!
  order[from] = order[to]!
  order[to] = moving
  // Renumber 0..n-1 so ties left by older rows can't hold a move back.
  for (const [position, row] of order.entries()) {
    if (row.position === position) continue
    const { error } = await sb
      .from('listing_videos')
      .update({ position })
      .eq('id', row.id)
      .eq('listing_id', listing.id)
    if (error) return { error: 'Could not move the video. Please try again.' }
  }

  revalidateListing(listing)
  return { success: true }
}
