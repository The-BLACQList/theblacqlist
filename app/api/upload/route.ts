// =============================================================================
// POST /api/upload — the single file-upload endpoint
// =============================================================================
// Three endpoints used to write to Supabase Storage, each with its own MIME
// set, size limit, path shape, status codes and error vocabulary. They drifted
// apart in ways that were not cosmetic:
//
//   * /api/upload/[bucket] derived the stored extension from the client's
//     filename and the stored content-type from the client's declared MIME, so
//     extension, content-type and actual bytes were three independently
//     client-controlled values. It had no ownership check of any kind.
//   * It also returned `{ data: { path } }` while its only caller read
//     `{ path }` — so verification documents uploaded fine and then reached the
//     server action as empty strings. See the note on `purpose` below.
//   * /api/media/upload enforced the plan photo limit and cleaned up after a
//     failed DB insert; the other two did neither.
//
// This endpoint is the union of what each did correctly:
//   * the extension comes from a server-controlled MIME map, never from the
//     filename, and the content-type written to storage is that same mapped
//     value rather than the client's string;
//   * every write is ownership-checked against a real row where a real row
//     exists to check against;
//   * one status-code and error-code vocabulary;
//   * the plan photo limit and the compensating delete apply to every gallery
//     upload, not only the ones that happened to come through the dashboard.
//
// Magic-byte sniffing (ledger 6.3) landed here separately, once the three
// endpoints were one: lib/security/file-signature.ts, called with the rest of
// the input validation. Malware scanning is the remaining half of 6.3 and is
// not here — it needs a scanning service, which is a spend decision.
//
// Listing photos now go through lib/media/storeListingImage.ts, shared with
// the site import (ticket 127). They are decoded and re-encoded first, which
// strips EXIF data such as a phone photo's GPS position.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { prepareImage } from '@/lib/media/prepareImage'
import { listingImageLimit, storeListingImage, type ListingImageRole } from '@/lib/media/storeListingImage'
import {
  matchesDeclaredType,
  readSignatureHeader,
  SIGNATURE_MISMATCH_CODE,
  SIGNATURE_MISMATCH_ERROR,
} from '@/lib/security/file-signature'

// `receipt-uploads` is intentionally absent. Its only API caller was the
// verification form (which belonged in `verification-docs` all along); receipts
// themselves are written by the spend server actions, which are row-scoped.
// Leaving an unowned write path open to a private bucket bought nothing.
const ALLOWED_BUCKETS = new Set(['listing-media', 'verification-docs'])

const LISTING_MEDIA_ROLES = new Set(['logo', 'cover', 'gallery'])

// A claim upload attaches to a client-generated id before any claim row exists;
// a listing-verification upload attaches to a listing the caller must own.
// Different authorization shapes, so the caller has to say which.
const DOC_PURPOSES = new Set(['claim', 'listing_verification'])

// The only source of truth for a stored document's extension. `file.name` is
// never consulted: a caller may not choose what the object is called on disk.
// Listing photos take theirs from the re-encoded image instead.
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

// These match the bucket definitions in
// supabase/migrations/20260524000000_storage_buckets.sql exactly. A type the
// route accepts but the bucket rejects fails at storage with a 500 the user
// cannot act on, which is how `application/pdf` on `receipt-uploads` went
// unnoticed until 20260813010000.
const BUCKET_MIMES: Record<string, Set<string>> = {
  'listing-media': new Set(['image/jpeg', 'image/png', 'image/webp']),
  'verification-docs': new Set(['image/jpeg', 'image/png', 'application/pdf']),
}

function getSizeLimit(bucket: string, mediaRole: string | null): number {
  if (bucket === 'listing-media') {
    return listingImageLimit(mediaRole === 'logo' || mediaRole === 'cover' ? mediaRole : 'gallery')
  }
  return 10 * 1024 * 1024
}

function buildDocumentPath(entityId: string, purpose: string, ext: string): string {
  const uuid = crypto.randomUUID()
  if (purpose === 'listing_verification') {
    return `listings/${entityId}/verification/${uuid}.${ext}`
  }
  return `claims/${entityId}/${uuid}.${ext}`
}

const UNREADABLE_IMAGE_ERROR = 'We could not read that image. Re-save it as a JPEG or PNG and try again.'

// Each upload can be 10 MB, so one account looping this endpoint fills storage
// fast. 60 in ten minutes is well past a full listing gallery plus documents.
const UPLOAD_RATE_LIMIT = 60
const UPLOAD_RATE_WINDOW_SECONDS = 10 * 60

function bad(error: string, code: string, status: number): NextResponse {
  return NextResponse.json({ error, code }, { status })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return bad('Authentication required.', 'AUTH_REQUIRED', 401)
  }

  if (
    !(await checkRateLimit({
      bucket: 'upload',
      identifier: user.id,
      limit: UPLOAD_RATE_LIMIT,
      windowSeconds: UPLOAD_RATE_WINDOW_SECONDS,
    }))
  ) {
    return bad('Too many uploads. Please wait a few minutes and try again.', 'RATE_LIMITED', 429)
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return bad('Invalid form data.', 'VALIDATION_ERROR', 400)
  }

  const file = formData.get('file')
  const bucket = formData.get('bucket')?.toString() ?? ''
  const entityId = formData.get('entity_id')?.toString() ?? ''
  const mediaRole = formData.get('media_role')?.toString() ?? null
  const purpose = formData.get('purpose')?.toString() ?? 'claim'

  if (!(file instanceof File) || file.size === 0) {
    return bad('file field is required.', 'VALIDATION_ERROR', 400)
  }

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return bad('Invalid bucket.', 'VALIDATION_ERROR', 400)
  }

  if (!entityId || !/^[0-9a-f-]{36}$/.test(entityId)) {
    return bad('entity_id must be a valid UUID.', 'VALIDATION_ERROR', 400)
  }

  if (bucket === 'listing-media' && mediaRole !== null && !LISTING_MEDIA_ROLES.has(mediaRole)) {
    return bad('Invalid media_role for listing-media bucket.', 'VALIDATION_ERROR', 400)
  }

  if (bucket === 'verification-docs' && !DOC_PURPOSES.has(purpose)) {
    return bad('Invalid purpose for verification-docs bucket.', 'VALIDATION_ERROR', 400)
  }

  const allowedMimes = BUCKET_MIMES[bucket]!
  if (!allowedMimes.has(file.type)) {
    return bad('File type not allowed for this bucket.', 'INVALID_FILE_TYPE', 400)
  }

  const sizeLimit = getSizeLimit(bucket, mediaRole)
  if (file.size > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024))
    return bad(`File exceeds ${limitMB} MB limit.`, 'FILE_TOO_LARGE', 413)
  }

  // The declared type has to survive contact with the bytes. This sits with the
  // other input validation, before the service client is created and before any
  // row is read, so a mismatched file costs one 12-byte slice and nothing else.
  const header = await readSignatureHeader(file)
  if (!matchesDeclaredType(header, file.type)) {
    return bad(SIGNATURE_MISMATCH_ERROR, SIGNATURE_MISMATCH_CODE, 400)
  }

  // Listing photos share one path with the site import (ticket 127): decoded
  // and re-encoded so EXIF data, including a phone's GPS position, never
  // reaches the public bucket. See lib/media/storeListingImage.ts.
  if (bucket === 'listing-media') {
    const prepared = await prepareImage(Buffer.from(await file.arrayBuffer()), file.type)
    if (!prepared.ok) {
      return prepared.reason === 'mismatch'
        ? bad(SIGNATURE_MISMATCH_ERROR, SIGNATURE_MISMATCH_CODE, 400)
        : bad(UNREADABLE_IMAGE_ERROR, 'INVALID_IMAGE', 400)
    }
    const stored = await storeListingImage({
      supabase,
      userId: user.id,
      listingId: entityId,
      role: (mediaRole ?? 'gallery') as ListingImageRole,
      image: prepared,
    })
    if (!stored.ok) return bad(stored.error, stored.code, stored.status)
    return NextResponse.json(
      { data: stored.mediaId ? { path: stored.path, mediaId: stored.mediaId } : { path: stored.path } },
      { status: 201 }
    )
  }

  // ---------------------------------------------------------------------
  // Verification documents. A claim upload attaches to a client-generated id
  // before any claim row exists. A listing-verification upload needs a listing
  // that exists and is owned by the caller; that flow is only reachable from a
  // claimed listing's dashboard.
  // ---------------------------------------------------------------------
  if (purpose === 'listing_verification') {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, owner_user_id')
      .eq('id', entityId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!listing || listing.owner_user_id !== user.id) {
      return bad(
        'You do not have permission to upload documents for this listing.',
        'FORBIDDEN',
        403
      )
    }
  }

  const serviceClient = createServiceClient()
  const ext = MIME_EXT[file.type] ?? 'bin'
  const storagePath = buildDocumentPath(entityId, purpose, ext)

  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (uploadError) {
    return bad('Upload failed.', 'UPLOAD_FAILED', 500)
  }

  return NextResponse.json({ data: { path: storagePath } }, { status: 201 })
}
