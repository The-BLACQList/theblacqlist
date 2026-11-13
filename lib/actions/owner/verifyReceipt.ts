'use server'

// =============================================================================
// A business owner verifies a receipt for their business (ticket 183)
// =============================================================================
// `[Decision — founder, 2026-11-13]` The business verifies, not the admin.
// Free on every plan. An owner can't verify their own purchase.
// =============================================================================

import { revalidatePath } from 'next/cache'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { sendReceiptCountedEmail } from '@/lib/email/receiptNotices'
import { approvePendingReceipt } from '@/lib/spend/applyReceiptReview'
import { joinedMap } from '@/lib/spend/counted-receipt'
import { receiptBusinessName } from '@/lib/spend/receipt-emails'
import {
  OWNER_REVIEW_ERRORS,
  loadReceiptForOwner,
  revalidateReceiptReview,
} from '@/lib/actions/owner/receiptReviewShared'

export type OwnerReceiptState = { success: true } | { error: string } | null

export async function ownerVerifyReceiptAction(
  _prev: OwnerReceiptState,
  formData: FormData
): Promise<OwnerReceiptState> {
  if (!isFeatureEnabled('ownerReceiptReview')) return { error: 'Receipt review is not open yet.' }
  const session = await getOwnerSession()
  if (!session) return { error: 'Please sign in again.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  if (!receiptId) return { error: 'Invalid receipt.' }

  const loaded = await loadReceiptForOwner(receiptId, session.user.id)
  if (loaded.check !== 'ok') return { error: OWNER_REVIEW_ERRORS[loaded.check] }
  const { receipt, serviceClient } = loaded

  const result = await approvePendingReceipt(serviceClient, receipt, {
    userId: session.user.id,
    role: 'owner',
  })
  if (!result.ok) {
    return {
      error:
        result.reason === 'already_reviewed'
          ? OWNER_REVIEW_ERRORS.not_pending
          : "Couldn't verify that receipt. Please try again.",
    }
  }

  // Tell the shopper, fire-and-forget. The receipt is verified either way.
  void (async () => {
    await sendReceiptCountedEmail(serviceClient, {
      receiptId,
      userId: receipt.user_id,
      amountCents: receipt.amount_cents,
      businessName: receiptBusinessName(
        result.listingName ?? loaded.listingName,
        receipt.raw_business_name
      ),
      joinedMap: joinedMap(receipt),
    })
  })()

  revalidateReceiptReview(revalidatePath)
  return { success: true }
}
