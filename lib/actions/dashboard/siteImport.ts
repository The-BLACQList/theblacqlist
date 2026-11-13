'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { MAX_PHOTOS_PER_IMPORT } from '@/lib/import/limits'
import type { SiteFindings } from '@/lib/import/read-site'
import {
  importPhotosFor,
  readSiteFor,
  type PhotoFailure,
  type PhotoImportOutcome,
  type ReadFailure,
} from '@/lib/import/siteImportCore'

// =============================================================================
// "Import from my website" on the owner edit page (owner-experience round 2, C)
// =============================================================================
// For owners of the page, with no feature flag (the founder turned it on for
// owners, 2026-11-13; step 0 of /add-business stays behind FEATURE_SITE_IMPORT).
// Same reader, robots.txt rules and rate limits as step 0 (siteImportCore).
//
//   readMySiteAction         reads the site. Nothing is saved.
//   importMySitePhotosAction brings in the photos the owner ticked, as gallery
//                            photos, and makes one the cover when the page has
//                            none and the owner chose it.
//
// The text fields the owner ticks are saved by updateListingContentAction, the
// same action as the cards' own Save, so the same checks and plan limits apply.
// =============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NOT_FOUND = 'Page not found, or you can’t edit it.'
const SIGNED_OUT = 'Please sign in again.'

const READ_ERRORS: Record<ReadFailure, string> = {
  invalid: 'Check the web address. It should look like yoursite.com.',
  busy: 'You’ve tried this a few times. Please wait an hour and try again.',
  notFound: 'We couldn’t find that site. Check the address and try again.',
  slow: 'Your site took too long to answer. Please try again.',
  robots: 'Your site asks tools like ours not to read it, so we didn’t.',
  notHtml: 'That address isn’t a web page we can read. Try your home page.',
  nothing: 'We couldn’t find anything to bring in on that page. Try your home page or your About page.',
  failed: 'We couldn’t read that site. Please try again.',
}

const PHOTO_ERRORS: Record<PhotoFailure, string> = {
  rights: 'Confirm you own these photos or have permission to use them.',
  invalid: 'Something went wrong with those photos. Pick them again.',
  tooMany: `Pick up to ${MAX_PHOTOS_PER_IMPORT} photos at a time.`,
  busy: 'You’ve brought in a lot of photos in the last hour. Upload the rest instead.',
}

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedListing {
  id: string
  slug: string
  status: string | null
  entity_type: string
  cover_image_path: string | null
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<{ ok: false; error: string } | { ok: true; supabase: Supabase; userId: string; listing: OwnedListing }> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: SIGNED_OUT }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, cover_image_path, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  return { ok: true, supabase, userId: owner.user.id, listing: listing as OwnedListing }
}

export type ReadMySiteResult = { ok: true; findings: SiteFindings } | { ok: false; error: string }

/** Reads the owner's site for one of their pages. Nothing is saved. */
export async function readMySiteAction(input: { listingId: unknown; url: unknown }): Promise<ReadMySiteResult> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { ok: false, error: owned.error }

  const result = await readSiteFor(owned.userId, input?.url)
  return result.ok ? result : { ok: false, error: READ_ERRORS[result.reason] }
}

export type ImportMyPhotosResult =
  | { ok: true; photos: PhotoImportOutcome[]; coverSet: boolean }
  | { ok: false; error: string }

/**
 * Brings in the ticked photos as gallery photos. `coverUrl`, one of them, also
 * becomes the cover, but only on a page with no cover yet.
 */
export async function importMySitePhotosAction(input: {
  listingId: unknown
  urls: unknown
  coverUrl?: unknown
  rightsConfirmed: unknown
}): Promise<ImportMyPhotosResult> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { ok: false, error: owned.error }
  const { supabase, userId, listing } = owned

  if (!Array.isArray(input.urls)) return { ok: false, error: PHOTO_ERRORS.invalid }
  const picks = input.urls.map((url) => ({ url, role: 'gallery' }))

  const result = await importPhotosFor({
    supabase,
    userId,
    listingId: listing.id,
    picks,
    rightsConfirmed: input.rightsConfirmed,
  })
  if (!result.ok) return { ok: false, error: PHOTO_ERRORS[result.reason] }

  let coverSet = false
  const cover =
    !listing.cover_image_path && typeof input.coverUrl === 'string'
      ? result.photos.find((p) => p.ok && p.url === input.coverUrl)
      : undefined
  if (cover?.ok) {
    const { error } = await supabase
      .from('listings')
      .update({ cover_image_path: cover.path })
      .eq('id', listing.id)
      .is('cover_image_path', null)
    coverSet = !error
  }

  if (result.photos.some((p) => p.ok)) {
    if (listing.status === 'published') {
      const citySlug = (listing.cities as { slug: string } | null)?.slug
      if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
    revalidateOwnerEditors(listing.id)
  }

  return { ok: true, photos: result.photos, coverSet }
}
