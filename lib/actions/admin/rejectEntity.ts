'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { EntityRejectedEmail } from '@/lib/email/templates/entity-rejected'

export type RejectEntityState = { success: true; listingId: string } | { error: string } | null

export async function rejectEntityAction(
  _prev: RejectEntityState,
  formData: FormData
): Promise<RejectEntityState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const reason = formData.get('reason')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!reason || reason.length < 5) {
    return { error: 'A rejection reason is required (minimum 5 characters).' }
  }
  if (reason.length > 500) {
    return { error: 'Rejection reason must be 500 characters or fewer.' }
  }

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, name, status, submitted_by')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }
  if (listing.status === 'rejected') return { error: 'This listing is already rejected.' }

  const now = new Date().toISOString()
  const { error: updateError } = await serviceClient
    .from('listings')
    .update({
      status: 'rejected',
      moderation_notes: `${reason}${notes ? `\n\nAdmin notes: ${notes}` : ''}`,
      last_admin_updated_at: now,
    })
    .eq('id', listingId)

  if (updateError) return { error: 'Failed to reject listing. Please try again.' }

  await serviceClient
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_at: now })
    .eq('entity_id', listingId)
    .eq('queue_type', 'new_submission')
    .eq('status', 'pending')

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'reject_entity',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: { status: listing.status },
    afterState: { status: 'rejected', rejection_reason: reason },
  })

  // ── Rejection email (fire-and-forget) ────────────────────────────────────────
  if (listing.submitted_by) {
    void (async () => {
      const { data: userData } = await serviceClient.auth.admin.getUserById(listing.submitted_by!)
      const submitterEmail = userData?.user?.email
      if (submitterEmail) {
        await sendEmail({
          to: submitterEmail,
          subject: `An update on your submission for ${listing.name}`,
          react: EntityRejectedEmail({ listingName: listing.name, reason }),
        })
      }
    })()
  }

  return { success: true, listingId }
}
