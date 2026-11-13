'use server'

// =============================================================================
// A business owner says a receipt isn't theirs (ticket 183)
// =============================================================================
// The shopper gets the needs-a-fix email with the owner's reason, so they can
// correct the business or the details and resubmit.
// =============================================================================

import { revalidatePath } from 'next/cache'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { sendReceiptNeedsFixEmail } from '@/lib/email/receiptNotices'
import { rejectPendingReceipt } from '@/lib/spend/applyReceiptReview'
import { pickOwnerRejectionReason } from '@/lib/spend/owner-receipts'
import { receiptBusinessName } from '@/lib/spend/receipt-emails'
import {
  OWNER_REVIEW_ERRORS,
  loadReceiptForOwner,
  revalidateReceiptReview,
} from '@/lib/actions/owner/receiptReviewShared'
import type { OwnerReceiptState } from '@/lib/actions/owner/verifyReceipt'

export async function ownerRejectReceiptAction(
  _prev: OwnerReceiptState,
  formData: FormData
): Promise<OwnerReceiptState> {
  if (!isFeatureEnabled('ownerReceiptReview')) return { error: 'Receipt review is not open yet.' }
  const session = await getOwnerSession()
  if (!session) return { error: 'Please sign in again.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  if (!receiptId) return { error: 'Invalid receipt.' }

  const rejectionReason = pickOwnerRejectionReason(
    formData.get('rejection_reason')?.toString(),
    formData.get('rejection_reason_other')?.toString()
  )
  if (!rejectionReason) return { error: 'Choose a reason so the shopper knows what to fix.' }

  const loaded = await loadReceiptForOwner(receiptId, session.user.id)
  if (loaded.check !== 'ok') return { error: OWNER_REVIEW_ERRORS[loaded.check] }
  const { receipt, serviceClient, listingName } = loaded

  const result = await rejectPendingReceipt(
    serviceClient,
    receiptId,
    { userId: session.user.id, role: 'owner' },
    rejectionReason
  )
  if (!result.ok) {
    return {
      error:
        result.reason === 'already_reviewed'
          ? OWNER_REVIEW_ERRORS.not_pending
          : "Couldn't update that receipt. Please try again.",
    }
  }

  void (async () => {
    await sendReceiptNeedsFixEmail(serviceClient, {
      receiptId,
      userId: receipt.user_id,
      amountCents: receipt.amount_cents,
      businessName: receiptBusinessName(listingName, receipt.raw_business_name),
      reason: rejectionReason,
    })
  })()

  revalidateReceiptReview(revalidatePath)
  return { success: true }
}
