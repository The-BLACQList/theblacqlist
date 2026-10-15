import { safeFetch, SafeFetchError } from '@/lib/import/safe-fetch'
import { prepareImage } from '@/lib/media/prepareImage'
import {
  listingImageLimit,
  storeListingImage,
  type ListingImageRole,
} from '@/lib/media/storeListingImage'
import type { createClient } from '@/lib/supabase/server'

// =============================================================================
// Bringing one photo from an owner's site onto their page (ticket 127)
// =============================================================================
// Only photos the owner picked on step 0 come through here, one URL at a time.
// The fetch is the same guarded fetch the page read used: public addresses
// only, every redirect re-checked, a deadline and a byte cap. After that it is
// the upload path exactly: the type comes from the bytes (a server's
// content-type is ignored), the image is decoded and written out again so EXIF
// and GPS data are dropped, and the plan photo limit applies.
//
// A photo that fails never stops the others or the page itself. It comes back
// as a short line the owner can read, and they can upload it by hand instead.
// =============================================================================

/** Raw bytes we will download for one photo, before it is scaled down. */
export const IMPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const IMPORT_IMAGE_TIMEOUT_MS = 10_000
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1'

export type ImportRemoteImageResult =
  | { ok: true; path: string; mediaId: string | null }
  | { ok: false; reason: ImportImageFailure; message: string }

export type ImportImageFailure =
  | 'unreachable'
  | 'too_large'
  | 'unsupported'
  | 'unreadable'
  | 'plan_limit'
  | 'forbidden'
  | 'store_failed'

const MESSAGES: Record<ImportImageFailure, string> = {
  unreachable: 'We could not get this photo from your site.',
  too_large: 'This photo is too large to bring in. Upload a smaller copy instead.',
  unsupported: 'This photo is not a JPEG, PNG or WebP, so we skipped it.',
  unreadable: 'We could not read this photo.',
  plan_limit: 'Your plan is full, so we skipped this photo.',
  forbidden: 'You do not have permission to add photos to this page.',
  store_failed: 'We could not save this photo. Try uploading it instead.',
}

function fail(reason: ImportImageFailure, message = MESSAGES[reason]): ImportRemoteImageResult {
  return { ok: false, reason, message }
}

export async function importRemoteImage(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  listingId: string
  role: ListingImageRole
  url: string
}): Promise<ImportRemoteImageResult> {
  const { supabase, userId, listingId, role, url } = args

  let body: Buffer
  try {
    const res = await safeFetch(url, {
      maxBytes: IMPORT_IMAGE_MAX_BYTES,
      timeoutMs: IMPORT_IMAGE_TIMEOUT_MS,
      accept: IMAGE_ACCEPT,
    })
    body = res.body
  } catch (err) {
    if (err instanceof SafeFetchError && err.code === 'too_large') return fail('too_large')
    return fail('unreachable')
  }

  const image = await prepareImage(body)
  if (!image.ok) return fail(image.reason === 'unreadable' ? 'unreadable' : 'unsupported')

  // The cap applies to what we store. A 6 MB original from a site usually comes
  // out well under it once scaled to 2400px.
  if (image.bytes.length > listingImageLimit(role)) return fail('too_large')

  const stored = await storeListingImage({ supabase, userId, listingId, role, image })
  if (stored.ok) return { ok: true, path: stored.path, mediaId: stored.mediaId }
  if (stored.code === 'PLAN_LIMIT') return fail('plan_limit', stored.error)
  if (stored.code === 'FORBIDDEN') return fail('forbidden')
  return fail('store_failed')
}
