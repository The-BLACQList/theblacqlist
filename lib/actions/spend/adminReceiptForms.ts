'use server'

// =============================================================================
// Form wrappers for /admin/receipts (ticket 293)
// =============================================================================
// The page's plain forms used to call the actions with `.bind(null, null)`,
// which threw the result away: an admin saw nothing when a review failed or
// someone else got there first. These run the same actions, then send the
// admin back to the tab they were on with a result line.
// =============================================================================

import { redirect } from 'next/navigation'

import { approveReceiptAction } from '@/lib/actions/spend/approveReceipt'
import { rejectReceiptAction } from '@/lib/actions/spend/rejectReceipt'
import {
  adminReceiptResultCode,
  adminReceiptsResultHref,
  parseAdminReceiptTab,
} from '@/lib/admin/receiptReviewResult'

export async function adminApproveReceiptForm(tab: string, formData: FormData): Promise<void> {
  const state = await approveReceiptAction(null, formData)
  redirect(
    adminReceiptsResultHref(parseAdminReceiptTab(tab), adminReceiptResultCode('approve', state))
  )
}

export async function adminRejectReceiptForm(tab: string, formData: FormData): Promise<void> {
  const state = await rejectReceiptAction(null, formData)
  redirect(
    adminReceiptsResultHref(parseAdminReceiptTab(tab), adminReceiptResultCode('reject', state))
  )
}
