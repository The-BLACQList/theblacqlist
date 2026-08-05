import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { photoLimit } from '@/lib/stripe/features'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB (compression happens client-side)

export async function POST(request: NextRequest) {
  const owner = await getOwnerSession()
  if (!owner) {
    return NextResponse.json({ error: 'You must be signed in to upload media.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const file = formData.get('file') as File | null

  if (!listingId) return NextResponse.json({ error: 'Missing listing ID.' }, { status: 400 })
  if (!file || file.size === 0)
    return NextResponse.json({ error: 'No file selected.' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, and GIF images are supported.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 10 MB or smaller.' }, { status: 400 })
  }

  const supabase = await createClient()
  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) {
    return NextResponse.json(
      { error: 'Listing not found or you do not have permission to upload here.' },
      { status: 403 }
    )
  }

  // Enforce the plan's photo limit server-side (RLS can't count rows).
  const limit = photoLimit(listing.tier)
  if (limit !== null) {
    const { count } = await serviceClient
      .from('media_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', listingId)
      .eq('entity_type', 'listing')

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `Your plan includes up to ${limit} ${limit === 1 ? 'photo' : 'photos'}. Upgrade to add more.`,
        },
        { status: 400 }
      )
    }
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const filePath = `${listingId}/${crypto.randomUUID()}.${ext}`

  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await serviceClient.storage
    .from('listing-media')
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[media/upload] storage error:', uploadError)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  // Get current max display_order for this listing
  const { data: lastMedia } = await supabase
    .from('media_attachments')
    .select('display_order')
    .eq('entity_id', listingId)
    .eq('entity_type', 'listing')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = lastMedia?.display_order != null ? lastMedia.display_order + 1 : 0

  const { data: newMedia, error: dbError } = await serviceClient
    .from('media_attachments')
    .insert({
      entity_type: 'listing',
      entity_id: listingId,
      file_path: filePath,
      file_type: file.type,
      file_size_bytes: file.size,
      display_order: nextOrder,
      uploaded_by: owner.user.id,
    })
    .select('id')
    .single()

  if (dbError || !newMedia) {
    await serviceClient.storage.from('listing-media').remove([filePath])
    return NextResponse.json(
      { error: 'Failed to save media record. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, mediaId: newMedia.id }, { status: 201 })
}
