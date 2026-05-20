'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

export type RejectReceiptState = { success: true } | { error: string } | null

export async function rejectReceiptAction(
  _prev: RejectReceiptState,
  formData: FormData
): Promise<RejectReceiptState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  const rejectionReason = formData.get('rejection_reason')?.toString().trim() || null

  if (!receiptId) return { error: 'Invalid receipt.' }

  const serviceClient = createServiceClient()

  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select('id, status')
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

  revalidatePath('/admin/receipts')
  revalidatePath('/account/receipts')
  return { success: true }
}
