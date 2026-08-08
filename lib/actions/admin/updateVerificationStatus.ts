'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { VerificationApprovedEmail } from '@/lib/email/templates/verification-approved'
import { VerificationRejectedEmail } from '@/lib/email/templates/verification-rejected'

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
    .select('id, name, trust_tier, verification_status, owner_user_id')
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

  // Only a grant writes provenance. A rejection must NOT null verified_at /
  // verified_by: rejecting a re-review of an already-verified listing would
  // erase when and by whom it was originally verified, silently. The rejection
  // is carried by verification_status + verification_notes. Revoking an
  // existing verification is a deliberate act via TrustTierActions (demote to
  // 'claimed'), which clears the stamp along with the tier.
  const { error: updateError } = await serviceClient
    .from('listings')
    .update({
      verification_status: decision,
      trust_tier: newTrustTier,
      verification_notes: notes,
      ...(decision === 'verified' && { verified_at: now, verified_by: admin.user.id }),
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

  // ── Decision email to the owner (fire-and-forget) ───────────────────────────
  // Wrapped so nothing in the notification path can reject the moderation
  // decision that already committed above — the same posture writeAuditLog and
  // maybePromoteToCertified use. An unclaimed listing has no owner to notify.
  if (listing.owner_user_id) {
    const ownerUserId = listing.owner_user_id
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://theblacqlist.com'

    void (async () => {
      try {
        const { data: userData } = await serviceClient.auth.admin.getUserById(ownerUserId)
        const ownerEmail = userData?.user?.email
        if (!ownerEmail) return

        if (decision === 'verified') {
          await sendEmail({
            to: ownerEmail,
            subject: `${listing.name} is now Verified on The BLACQList`,
            react: VerificationApprovedEmail({
              listingName: listing.name,
              listingId,
              siteUrl,
            }),
          })
        } else {
          await sendEmail({
            to: ownerEmail,
            subject: `An update on your verification request for ${listing.name}`,
            react: VerificationRejectedEmail({
              listingName: listing.name,
              listingId,
              notes,
              siteUrl,
            }),
          })
        }
      } catch (err) {
        console.error('[updateVerificationStatus] decision email failed:', listingId, err)
      }
    })()
  }

  return { success: true, listingId, decision }
}
