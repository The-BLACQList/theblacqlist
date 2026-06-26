import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = new Set(['listing-media', 'verification-docs', 'receipt-uploads'])

const LISTING_MEDIA_ROLES = new Set(['logo', 'cover', 'gallery'])

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const BUCKET_MIMES: Record<string, Set<string>> = {
  'listing-media': new Set(['image/jpeg', 'image/png', 'image/webp']),
  'verification-docs': new Set(['image/jpeg', 'image/png', 'application/pdf']),
  'receipt-uploads': new Set(['image/jpeg', 'image/png', 'image/webp']),
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
  userId: string,
  mediaRole: string | null,
  ext: string
): string {
  const uuid = crypto.randomUUID()
  if (bucket === 'listing-media') {
    const role = mediaRole ?? 'gallery'
    return `listings/${entityId}/${role}/${uuid}.${ext}`
  }
  if (bucket === 'verification-docs') {
    return `claims/${entityId}/${uuid}.${ext}`
  }
  // receipt-uploads
  return `receipts/${userId}/${uuid}.${ext}`
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  const bucket = formData.get('bucket')?.toString() ?? ''
  const entityId = formData.get('entity_id')?.toString() ?? ''
  const mediaRole = formData.get('media_role')?.toString() ?? null

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'file field is required.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: 'Invalid bucket.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  if (!entityId || !/^[0-9a-f-]{36}$/.test(entityId)) {
    return NextResponse.json(
      { error: 'entity_id must be a valid UUID.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  if (bucket === 'listing-media' && mediaRole !== null && !LISTING_MEDIA_ROLES.has(mediaRole)) {
    return NextResponse.json(
      { error: 'Invalid media_role for listing-media bucket.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const allowedMimes = BUCKET_MIMES[bucket]!
  if (!allowedMimes.has(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed for this bucket.', code: 'INVALID_FILE_TYPE' },
      { status: 400 }
    )
  }

  const sizeLimit = getSizeLimit(bucket, mediaRole)
  if (file.size > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024))
    return NextResponse.json(
      { error: `File exceeds ${limitMB} MB limit.`, code: 'FILE_TOO_LARGE' },
      { status: 413 }
    )
  }

  // Ownership check for listing-media when listing already exists
  // (entity_id may be a pre-generated client UUID before listing creation — skip check if not found)
  if (bucket === 'listing-media') {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, owner_user_id')
      .eq('id', entityId)
      .maybeSingle()

    if (listing && listing.owner_user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to upload media for this listing.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
  }

  const ext = MIME_EXT[file.type] ?? 'bin'
  const storagePath = buildStoragePath(bucket, entityId, user.id, mediaRole, ext)
  const arrayBuffer = await file.arrayBuffer()
  const serviceClient = createServiceClient()

  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { error: 'Upload failed.', code: 'UPLOAD_FAILED' },
      { status: 500 }
    )
  }

  // Insert media_attachments record for gallery uploads
  if (bucket === 'listing-media' && (mediaRole === 'gallery' || mediaRole === null)) {
    void serviceClient.from('media_attachments').insert({
      entity_type: 'listing',
      entity_id: entityId,
      file_path: storagePath,
      file_type: file.type,
      file_size_bytes: file.size,
      uploaded_by: user.id,
    })
  }

  return NextResponse.json({ data: { path: storagePath } }, { status: 201 })
}
