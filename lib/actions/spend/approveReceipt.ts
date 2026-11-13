'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendReceiptCountedEmail } from '@/lib/email/receiptNotices'
import { UNLISTED_CANT_APPROVE } from '@/lib/spend/unlisted'
import { receiptBusinessName } from '@/lib/spend/receipt-emails'
import { joinedMap } from '@/lib/spend/counted-receipt'
import { approvePendingReceipt } from '@/lib/spend/applyReceiptReview'

export type ApproveReceiptState = { success: true } | { error: string } | null

export async function approveReceiptAction(
  _prev: ApproveReceiptState,
  formData: FormData
): Promise<ApproveReceiptState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  if (!receiptId) return { error: 'Invalid receipt.' }

  const serviceClient = createServiceClient()

  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select(
      'id, user_id, listing_id, raw_business_name, amount_cents, purchase_date, aggregate_opt_out, status'
    )
    .eq('id', receiptId)
    .single()

  if (!receipt) return { error: 'Receipt not found.' }
  if (receipt.status !== 'pending_review')
    return { error: 'Only pending receipts can be approved.' }

  // 1-4. Status, spend_event and flow graph, written once even if the owner
  //      verifies at the same moment (lib/spend/applyReceiptReview.ts).
  const result = await approvePendingReceipt(serviceClient, receipt, {
    userId: session.user.id,
    role: 'admin',
  })
  if (!result.ok) {
    return {
      error:
        result.reason === 'already_reviewed'
          ? 'This receipt was already reviewed.'
          : result.reason === 'unlisted'
            ? UNLISTED_CANT_APPROVE
            : 'Failed to approve receipt. Please try again.',
    }
  }
  const { listingName } = result

  // 5. Audit log
  await writeAuditLog({
    adminUserId: session.user.id,
    action: 'receipt_approved',
    targetTable: 'receipt_uploads',
    targetId: receiptId,
    beforeState: { status: 'pending_review' },
    afterState: { status: 'approved', verified_by_role: 'admin' },
  })

  // 6. Tell the shopper, fire-and-forget (ticket 165). The receipt is already
  //    approved; a failed or skipped send never changes that.
  void (async () => {
    await sendReceiptCountedEmail(serviceClient, {
      receiptId,
      userId: receipt.user_id,
      amountCents: receipt.amount_cents,
      businessName: receiptBusinessName(listingName, receipt.raw_business_name),
      joinedMap: joinedMap(receipt),
    })
  })()

  revalidatePath('/admin/receipts')
  revalidatePath('/account/receipts')
  revalidatePath('/account/community-spend')
  return { success: true }
}
