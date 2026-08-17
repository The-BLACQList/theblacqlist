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
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { photoLimit } from '@/lib/stripe/features'
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

// The only source of truth for a stored file's extension. `file.name` is never
// consulted — a caller may not choose what the object is called on disk.
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
    if (mediaRole === 'logo') return 2 * 1024 * 1024
    if (mediaRole === 'cover') return 5 * 1024 * 1024
    return 3 * 1024 * 1024 // gallery default
  }
  return 10 * 1024 * 1024
}

function buildStoragePath(
  bucket: string,
  entityId: string,
  mediaRole: string | null,
  purpose: string,
  ext: string
): string {
  const uuid = crypto.randomUUID()
  if (bucket === 'listing-media') {
    const role = mediaRole ?? 'gallery'
    return `listings/${entityId}/${role}/${uuid}.${ext}`
  }
  // verification-docs
  if (purpose === 'listing_verification') {
    return `listings/${entityId}/verification/${uuid}.${ext}`
  }
  return `claims/${entityId}/${uuid}.${ext}`
}

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

  const serviceClient = createServiceClient()

  // ---------------------------------------------------------------------
  // Ownership.
  //
  // listing-media: `entity_id` may be a client-generated UUID sent before the
  // listing row exists (the add-business media step uploads first and creates
  // the listing with that same id). A missing row is therefore normal and not
  // a denial — but a row owned by someone else always is.
  //
  // verification-docs + listing_verification: the listing must exist and be
  // owned by the caller. There is no pre-creation case here; the flow is only
  // reachable from a claimed listing's dashboard.
  // ---------------------------------------------------------------------
  let listing: { id: string; owner_user_id: string | null; tier: string | null } | null = null

  if (bucket === 'listing-media' || purpose === 'listing_verification') {
    const { data } = await supabase
      .from('listings')
      .select('id, owner_user_id, tier')
      .eq('id', entityId)
      .is('deleted_at', null)
      .maybeSingle()
    listing = data ?? null
  }

  if (bucket === 'listing-media' && listing && listing.owner_user_id !== user.id) {
    return bad('You do not have permission to upload media for this listing.', 'FORBIDDEN', 403)
  }

  if (purpose === 'listing_verification' && bucket === 'verification-docs') {
    if (!listing || listing.owner_user_id !== user.id) {
      return bad(
        'You do not have permission to upload documents for this listing.',
        'FORBIDDEN',
        403
      )
    }
  }

  const isGallery = bucket === 'listing-media' && (mediaRole === 'gallery' || mediaRole === null)

  // Plan photo limit — enforced server-side, and only once the listing exists.
  // During add-business there is no row to read a tier from and no gallery to
  // overflow yet; the limit is re-checked on every dashboard upload after that.
  if (isGallery && listing) {
    const limit = photoLimit(listing.tier)
    if (limit !== null) {
      const { count } = await serviceClient
        .from('media_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'listing')
        .eq('entity_id', entityId)

      if ((count ?? 0) >= limit) {
        return bad(
          `Your plan includes ${limit} photo${limit === 1 ? '' : 's'}. Upgrade to add more.`,
          'PLAN_LIMIT',
          400
        )
      }
    }
  }

  const ext = MIME_EXT[file.type] ?? 'bin'
  const contentType = file.type
  const storagePath = buildStoragePath(bucket, entityId, mediaRole, purpose, ext)
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(storagePath, arrayBuffer, { contentType, upsert: false })

  if (uploadError) {
    return bad('Upload failed.', 'UPLOAD_FAILED', 500)
  }

  if (!isGallery) {
    return NextResponse.json({ data: { path: storagePath } }, { status: 201 })
  }

  // Gallery uploads get a media_attachments row. Ordering is appended, not
  // assumed — two uploads racing for the same slot is a display bug, a lost
  // object is a support ticket.
  const { data: last } = await serviceClient
    .from('media_attachments')
    .select('display_order')
    .eq('entity_type', 'listing')
    .eq('entity_id', entityId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: media, error: insertError } = await serviceClient
    .from('media_attachments')
    .insert({
      entity_type: 'listing',
      entity_id: entityId,
      file_path: storagePath,
      file_type: contentType,
      file_size_bytes: file.size,
      uploaded_by: user.id,
      display_order: (last?.display_order ?? -1) + 1,
    })
    .select('id')
    .single()

  if (insertError || !media) {
    // Compensate: the object is already in the bucket and nothing now points at
    // it. An orphan in storage is invisible and permanent, so remove it rather
    // than leave the caller to retry into a growing pile.
    await serviceClient.storage.from(bucket).remove([storagePath])
    return bad('Upload failed. Please try again.', 'SERVER_ERROR', 500)
  }

  return NextResponse.json({ data: { path: storagePath, mediaId: media.id } }, { status: 201 })
}
