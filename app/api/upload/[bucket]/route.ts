import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = new Set(['listing-media', 'receipt-uploads'])

const BUCKET_LIMITS: Record<string, { maxBytes: number; mimeTypes: Set<string> }> = {
  'listing-media': {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  },
  'receipt-uploads': {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  },
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 128)
}

interface RouteContext {
  params: Promise<{ bucket: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { bucket } = await params

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(
      { error: 'Invalid bucket.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // Auth required for all uploads
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'UNAUTHORIZED' },
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
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'file field is required.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // bucket is already validated against ALLOWED_BUCKETS so BUCKET_LIMITS[bucket] is defined
  const limits = BUCKET_LIMITS[bucket]!

  // Validate MIME type
  if (!limits.mimeTypes.has(file.type)) {
    return NextResponse.json(
      {
        error: `File type "${file.type}" is not allowed for this bucket.`,
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > limits.maxBytes) {
    const limitMB = limits.maxBytes / (1024 * 1024)
    return NextResponse.json(
      { error: `File exceeds ${limitMB} MB limit.`, code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const baseName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ''))
  const storagePath = `${user.id}/${Date.now()}-${baseName}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const serviceClient = createServiceClient()

  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed.', code: 'SERVER_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ data: { path: storagePath } }, { status: 201 })
}
