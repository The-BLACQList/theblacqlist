'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { checkAlbumFile, parseAlbumName, toAlbumMap } from '@/lib/listings/photoAlbums'

// Photo albums (ticket 193). The owner files a photo under an album, takes it
// out, or renames an album (every photo in it). Ownership is checked on the
// owner's own client; the write uses the service client, scoped to this page's
// photos, because the media update policy covers only photos the owner
// uploaded themselves and a page's imported photos should be fileable too.
//
// Filing under an album needs Growth. Unfiling and renaming work on every
// plan, so an owner who moved down a plan can still tidy what they have.

export type AlbumActionState = { success: true } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'

interface OwnedListing {
  id: string
  slug: string
  status: string | null
  entity_type: string
  tier: string | null
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<{ ok: false; error: string } | { ok: true; listing: OwnedListing }> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
    return { ok: false, error: NOT_FOUND }
  }
  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  return { ok: true, listing: listing as OwnedListing }
}

type Service = ReturnType<typeof createServiceClient>

/** The page's photos with their albums, or null when the read fails. */
async function pagePhotos(
  service: Service,
  listingId: string
): Promise<{ ids: string[]; byId: Record<string, string> } | null> {
  const { data, error } = await service
    .from('media_attachments')
    .select('id, album')
    .eq('entity_type', 'listing')
    .eq('entity_id', listingId)
  if (error) return null
  const rows = (data ?? []) as { id: string }[]
  return { ids: rows.map((r) => r.id), byId: toAlbumMap(rows) }
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/media`)
  revalidateOwnerEditors(listing.id)
}

/** Files one photo under an album, or takes it out of its album (blank). */
export async function setPhotoAlbumAction(input: {
  listingId: unknown
  mediaId: unknown
  album: unknown
}): Promise<AlbumActionState> {
  if (typeof input?.mediaId !== 'string' || !UUID_RE.test(input.mediaId)) {
    return { error: 'Photo not found.' }
  }
  const parsed = parseAlbumName(input.album)
  if (!parsed.ok) return { error: parsed.error }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { listing } = owned

  const service = createServiceClient()
  const photos = await pagePhotos(service, listing.id)
  if (!photos) return { error: TRY_AGAIN }
  if (!photos.ids.includes(input.mediaId)) return { error: 'Photo not found.' }
  if (photos.byId[input.mediaId] === (parsed.value ?? undefined)) return { success: true }

  if (parsed.value !== null) {
    const others = Object.entries(photos.byId)
      .filter(([id]) => id !== input.mediaId)
      .map(([, album]) => album)
    const refusal = checkAlbumFile(listing.tier, parsed.value, others)
    if (refusal) return { error: refusal }
  }

  const { error } = await service
    .from('media_attachments')
    .update({ album: parsed.value })
    .eq('id', input.mediaId)
    .eq('entity_type', 'listing')
    .eq('entity_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  revalidate(listing)
  return { success: true }
}

/** Renames an album on every photo in it; a blank name takes them all out of it. */
export async function renameAlbumAction(input: {
  listingId: unknown
  from: unknown
  to: unknown
}): Promise<AlbumActionState> {
  const from = parseAlbumName(input?.from)
  if (!from.ok || from.value === null) return { error: 'Album not found.' }
  const to = parseAlbumName(input.to)
  if (!to.ok) return { error: to.error }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { listing } = owned

  const service = createServiceClient()
  const photos = await pagePhotos(service, listing.id)
  if (!photos) return { error: TRY_AGAIN }
  if (!Object.values(photos.byId).includes(from.value)) return { error: 'Album not found.' }
  if (to.value === from.value) return { success: true }

  const { error } = await service
    .from('media_attachments')
    .update({ album: to.value })
    .eq('entity_type', 'listing')
    .eq('entity_id', listing.id)
    .eq('album', from.value)
  if (error) return { error: TRY_AGAIN }
  revalidate(listing)
  return { success: true }
}
