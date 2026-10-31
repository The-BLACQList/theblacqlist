import type { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { ReceiptCountedEmail } from '@/lib/email/templates/receipt-counted'
import { ReceiptNeedsFixEmail } from '@/lib/email/templates/receipt-needs-fix'
import {
  RECEIPT_COUNTED_SUBJECT,
  RECEIPT_NEEDS_FIX_SUBJECT,
  wantsCountedEmail,
} from '@/lib/spend/receipt-emails'

// =============================================================================
// Receipt review emails (ticket 165)
// =============================================================================
// Called fire-and-forget from approveReceipt and rejectReceipt, after the
// status update has landed. Neither function ever rejects: a failed send logs
// the receipt id (and nothing about the shopper) and the review stands.
// =============================================================================

type ServiceClient = ReturnType<typeof createServiceClient>

interface ReceiptNotice {
  receiptId: string
  userId: string
  amountCents: number
  businessName: string
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
}

async function emailFor(serviceClient: ServiceClient, userId: string): Promise<string | null> {
  const { data } = await serviceClient.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

/** "Your receipt is counted", unless the shopper turned it off. */
export async function sendReceiptCountedEmail(
  serviceClient: ServiceClient,
  notice: ReceiptNotice
): Promise<void> {
  try {
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .select('receipt_counted_emails')
      .eq('id', notice.userId)
      .maybeSingle()
    // A failed read means "on". Only an explicit false stops the email.
    if (!wantsCountedEmail(error ? null : profile)) return

    const to = await emailFor(serviceClient, notice.userId)
    if (!to) return

    await sendEmail({
      to,
      subject: RECEIPT_COUNTED_SUBJECT,
      react: ReceiptCountedEmail({
        amountCents: notice.amountCents,
        businessName: notice.businessName,
        siteUrl: siteUrl(),
      }),
    })
  } catch {
    console.error(`[receipt-email] counted email failed for receipt ${notice.receiptId}`)
  }
}

/** "Your receipt needs a quick fix". Always sends; there is no switch. */
export async function sendReceiptNeedsFixEmail(
  serviceClient: ServiceClient,
  notice: ReceiptNotice & { reason: string | null }
): Promise<void> {
  try {
    const to = await emailFor(serviceClient, notice.userId)
    if (!to) return

    await sendEmail({
      to,
      subject: RECEIPT_NEEDS_FIX_SUBJECT,
      react: ReceiptNeedsFixEmail({
        receiptId: notice.receiptId,
        reason: notice.reason,
        amountCents: notice.amountCents,
        businessName: notice.businessName,
        siteUrl: siteUrl(),
      }),
    })
  } catch {
    console.error(`[receipt-email] needs-a-fix email failed for receipt ${notice.receiptId}`)
  }
}
