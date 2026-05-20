'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

const VALID_DECISIONS = ['verified', 'rejected'] as const

export type UpdateVerificationState =
  | { success: true; listingId: string; decision: 'verified' | 'rejected' }
  | { error: string }
  | null

export async function updateVerificationStatusAction(
  _prev: UpdateVerificationState,
  formData: FormData
): Promise<UpdateVerificationState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const decision = formData.get('decision')?.toString().trim() as
    | 'verified'
    | 'rejected'
    | undefined
  const notes = formData.get('notes')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!decision || !VALID_DECISIONS.includes(decision)) {
    return { error: "Decision must be 'verified' or 'rejected'." }
  }

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, name, trust_tier, verification_status')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  // Must be claimed before it can be verified
  if (listing.trust_tier === 'unclaimed') {
    return {
      error: 'This listing is unclaimed. It must be claimed before verification can be granted.',
    }
  }

  const now = new Date().toISOString()
  const newTrustTier = decision === 'verified' ? 'verified' : listing.trust_tier

  const { error: updateError } = await serviceClient
    .from('listings')
    .update({
      verification_status: decision,
      trust_tier: newTrustTier,
      verification_notes: notes,
      verified_at: decision === 'verified' ? now : null,
      verified_by: decision === 'verified' ? admin.user.id : null,
      last_admin_updated_at: now,
    })
    .eq('id', listingId)

  if (updateError) return { error: 'Failed to update verification status. Please try again.' }

  await serviceClient
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_at: now })
    .eq('entity_id', listingId)
    .eq('queue_type', 'verification')
    .in('status', ['pending', 'assigned'])

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: decision === 'verified' ? 'verify_listing' : 'reject_verification',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: {
      trust_tier: listing.trust_tier,
      verification_status: listing.verification_status,
    },
    afterState: { trust_tier: newTrustTier, verification_status: decision, notes },
  })

  return { success: true, listingId, decision }
}
