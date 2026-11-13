// =============================================================================
// Loads a receipt for an owner review (ticket 183)
// =============================================================================
// Not a server action: imported by verifyReceipt.ts and rejectReceipt.ts.
//
// receipt_uploads RLS only lets the uploader read a row, so the receipt comes
// from the service client. Ownership is then checked twice: the receipt's
// listing must be owned by the viewer (read through the viewer's own client,
// so RLS and deleted_at apply), and ownerCanReview decides the rest. Anything
// that isn't theirs reads as "not found", never "forbidden".
// =============================================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ownerCanReview, type OwnerReviewCheck } from '@/lib/spend/owner-receipts'

export interface OwnerReviewReceipt {
  id: string
  user_id: string
  listing_id: string | null
  raw_business_name: string | null
  amount_cents: number
  purchase_date: string
  aggregate_opt_out: boolean
  status: string
}

export type OwnerReviewLoad =
  | {
      check: 'ok'
      receipt: OwnerReviewReceipt & { listing_id: string }
      listingName: string
      serviceClient: ReturnType<typeof createServiceClient>
    }
  | { check: Exclude<OwnerReviewCheck, 'ok'> }

export async function loadReceiptForOwner(
  receiptId: string,
  viewerId: string
): Promise<OwnerReviewLoad> {
  const serviceClient = createServiceClient()
  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select(
      'id, user_id, listing_id, raw_business_name, amount_cents, purchase_date, aggregate_opt_out, status'
    )
    .eq('id', receiptId)
    .maybeSingle()

  if (!receipt?.listing_id) return { check: 'not_found' }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, owner_user_id')
    .eq('id', receipt.listing_id)
    .eq('owner_user_id', viewerId)
    .is('deleted_at', null)
    .maybeSingle()

  const check = ownerCanReview({
    receipt,
    listingOwnerId: listing?.owner_user_id ?? null,
    viewerId,
  })
  if (check !== 'ok' || !listing) return { check: check === 'ok' ? 'not_found' : check }

  return {
    check: 'ok',
    receipt: { ...receipt, listing_id: receipt.listing_id },
    listingName: listing.name,
    serviceClient,
  }
}

export const OWNER_REVIEW_ERRORS: Record<Exclude<OwnerReviewCheck, 'ok'>, string> = {
  not_found: 'Receipt not found.',
  own_receipt: "You can't verify your own receipt. We'll review it for you.",
  not_pending: 'This receipt was already reviewed.',
}

export function revalidateReceiptReview(revalidatePath: (p: string, t?: 'layout') => void) {
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/receipts')
  revalidatePath('/admin/receipts')
  revalidatePath('/account/receipts')
  revalidatePath('/account/community-spend')
}
