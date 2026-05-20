'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { ClaimRejectedEmail } from '@/lib/email/templates/claim-rejected'

export type RejectClaimState = { success: true; claimId: string } | { error: string } | null

export async function rejectClaimAction(
  _prev: RejectClaimState,
  formData: FormData
): Promise<RejectClaimState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const claimId = formData.get('claim_id')?.toString().trim() ?? ''
  const reason = formData.get('reason')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null

  if (!claimId) return { error: 'Missing claim ID.' }
  if (!reason || reason.length < 5) {
    return { error: 'A rejection reason is required (minimum 5 characters).' }
  }
  if (reason.length > 500) {
    return { error: 'Rejection reason must be 500 characters or fewer.' }
  }

  const serviceClient = createServiceClient()

  const { data: claim } = await serviceClient
    .from('claims')
    .select('id, status, claimant_user_id, listing_id')
    .eq('id', claimId)
    .maybeSingle()

  if (!claim) return { error: 'Claim not found.' }

  if (!['pending', 'under_review'].includes(claim.status)) {
    return { error: 'This claim is not in a reviewable state.' }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await serviceClient
    .from('claims')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: admin.user.id,
      reviewed_at: now,
    })
    .eq('id', claimId)

  if (updateError) return { error: 'Failed to reject claim. Please try again.' }

  await serviceClient
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_at: now })
    .eq('entity_id', claimId)
    .eq('entity_type', 'claim')
    .in('status', ['pending', 'assigned'])

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'reject_claim',
    targetTable: 'claims',
    targetId: claimId,
    beforeState: { status: claim.status },
    afterState: { status: 'rejected', rejection_reason: reason, notes },
  })

  // ── Rejection email (fire-and-forget) ────────────────────────────────────────
  if (claim.claimant_user_id) {
    void (async () => {
      const [{ data: userData }, { data: listingData }] = await Promise.all([
        serviceClient.auth.admin.getUserById(claim.claimant_user_id!),
        serviceClient.from('listings').select('name').eq('id', claim.listing_id).maybeSingle(),
      ])
      const claimantEmail = userData?.user?.email
      const listingName = listingData?.name ?? 'your listing'
      if (claimantEmail) {
        await sendEmail({
          to: claimantEmail,
          subject: `An update on your claim for ${listingName}`,
          react: ClaimRejectedEmail({ listingName, reason }),
        })
      }
    })()
  }

  return { success: true, claimId }
}
