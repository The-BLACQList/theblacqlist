import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin/guard'
import { canViewReceiptFile } from '@/lib/spend/owner-receipts'
import { isFeatureEnabled } from '@/lib/env'

interface RouteParams {
  params: Promise<{ id: string }>
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// GET /api/receipts/[id]/signed-url
// Returns a 15-minute signed URL for a receipt image.
// Access: the shopper who uploaded it, an admin, or (ticket 183) the owner of
// the receipt's business while it waits for them to verify it.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  if (!isUUID(id)) {
    return NextResponse.json(
      { error: 'Invalid receipt ID.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

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

  const serviceClient = createServiceClient()

  // Check admin first (can see any receipt)
  const adminSession = await getAdminSession()

  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select('id, user_id, file_path, listing_id, status')
    .eq('id', id)
    .single()

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  // The business owner, read through the viewer's own client so RLS and
  // deleted_at apply. Only asked when the viewer isn't the shopper or an admin.
  let listingOwnerId: string | null = null
  if (
    receipt.user_id !== user.id &&
    !adminSession &&
    receipt.listing_id &&
    isFeatureEnabled('ownerReceiptReview')
  ) {
    const { data: listing } = await supabase
      .from('listings')
      .select('owner_user_id')
      .eq('id', receipt.listing_id)
      .eq('owner_user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    listingOwnerId = listing?.owner_user_id ?? null
  }

  // Anyone else gets a 404, never a 403.
  if (
    !canViewReceiptFile({ viewerId: user.id, isAdmin: !!adminSession, receipt, listingOwnerId })
  ) {
    return NextResponse.json({ error: 'Not found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (!receipt.file_path) {
    return NextResponse.json(
      { error: 'No file attached to this receipt.', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const { data: signedUrl, error: signError } = await serviceClient.storage
    .from('receipt-uploads')
    .createSignedUrl(receipt.file_path, 60 * 15) // 15 minutes

  if (signError || !signedUrl) {
    return NextResponse.json(
      { error: 'Could not generate file URL.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { url: signedUrl.signedUrl } })
}
