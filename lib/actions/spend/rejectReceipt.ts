'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendReceiptNeedsFixEmail } from '@/lib/email/receiptNotices'
import { pickRejectionReason, receiptBusinessName } from '@/lib/spend/receipt-emails'

export type RejectReceiptState = { success: true } | { error: string } | null

export async function rejectReceiptAction(
  _prev: RejectReceiptState,
  formData: FormData
): Promise<RejectReceiptState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  // A preset reason saves its own words; "Other" saves the typed text (ticket 165).
  const rejectionReason = pickRejectionReason(
    formData.get('rejection_reason')?.toString(),
    formData.get('rejection_reason_other')?.toString()
  )

  if (!receiptId) return { error: 'Invalid receipt.' }

  const serviceClient = createServiceClient()

  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select('id, user_id, listing_id, raw_business_name, amount_cents, status')
    .eq('id', receiptId)
    .single()

  if (!receipt) return { error: 'Receipt not found.' }
  if (receipt.status !== 'pending_review')
    return { error: 'Only pending receipts can be rejected.' }

  const { error: updateError } = await serviceClient
    .from('receipt_uploads')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)

  if (updateError) return { error: 'Failed to reject receipt. Please try again.' }

  await writeAuditLog({
    adminUserId: session.user.id,
    action: 'receipt_rejected',
    targetTable: 'receipt_uploads',
    targetId: receiptId,
    beforeState: { status: 'pending_review' },
    afterState: { status: 'rejected', rejection_reason: rejectionReason },
  })

  // Tell the shopper, fire-and-forget (ticket 165). Needs-a-fix always sends;
  // the rejection already stands whatever happens to the email.
  void (async () => {
    let listingName: string | null = null
    try {
      if (receipt.listing_id) {
        const { data: listing } = await serviceClient
          .from('listings')
          .select('name')
          .eq('id', receipt.listing_id)
          .maybeSingle()
        listingName = listing?.name ?? null
      }
    } catch {
      // The name is a nicety. Send with the typed name or the general one.
    }
    await sendReceiptNeedsFixEmail(serviceClient, {
      receiptId,
      userId: receipt.user_id,
      amountCents: receipt.amount_cents,
      businessName: receiptBusinessName(listingName, receipt.raw_business_name),
      reason: rejectionReason,
    })
  })()

  revalidatePath('/admin/receipts')
  revalidatePath('/account/receipts')
  return { success: true }
}
