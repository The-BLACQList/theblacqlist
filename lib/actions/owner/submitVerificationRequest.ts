'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { sendEmail } from '@/lib/email/resend'
import { VerificationSubmittedEmail } from '@/lib/email/templates/verification-submitted'
import { VerificationAdminNotificationEmail } from '@/lib/email/templates/verification-admin-notification'

export type SubmitVerificationState = { success: true } | { error: string } | null

export async function submitVerificationRequest(
  _prev: SubmitVerificationState,
  formData: FormData
): Promise<SubmitVerificationState> {
  const session = await getOwnerSession()
  if (!session) return { error: 'You must be signed in to submit a verification request.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const rawPaths = formData
    .getAll('doc_paths[]')
    .map((v) => v.toString().trim())
    .filter(Boolean)

  if (!listingId) return { error: 'Missing listing ID.' }
  if (rawPaths.length === 0) return { error: 'Upload at least one document before submitting.' }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, trust_tier, verification_status, owner_user_id')
    .eq('id', listingId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }
  if (listing.owner_user_id !== session.user.id) return { error: 'You do not own this listing.' }
  if (listing.trust_tier !== 'claimed') {
    return { error: 'Verification is only available for claimed listings.' }
  }
  // 'pending' is the status this action itself writes — omitting it let an
  // owner resubmit repeatedly and enqueue a duplicate moderation_queue row on
  // every submit.
  if (
    listing.verification_status === 'pending' ||
    listing.verification_status === 'under_review' ||
    listing.verification_status === 'verified'
  ) {
    return { error: 'This listing is already verified or currently under review.' }
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({
      verification_docs: rawPaths,
      verification_status: 'pending',
    })
    .eq('id', listingId)

  if (updateError) return { error: 'Failed to submit request. Please try again.' }

  const serviceClient = createServiceClient()

  // Second line of defence behind the status guard above: never stack a second
  // unresolved verification row on the same listing. Two admins picking up
  // duplicate rows for one request is a moderation-integrity problem, not just
  // noise.
  const { data: openRow } = await serviceClient
    .from('moderation_queue')
    .select('id')
    .eq('entity_id', listingId)
    .eq('queue_type', 'verification')
    .in('status', ['pending', 'assigned'])
    .maybeSingle()

  if (!openRow) {
    await serviceClient.from('moderation_queue').insert({
      entity_id: listingId,
      entity_type: 'listing',
      queue_type: 'verification',
      status: 'pending',
      priority: 0,
    })
  }

  // ── Notifications (fire-and-forget) ─────────────────────────────────────────
  // Non-blocking by design: sendEmail already swallows Resend failures, and the
  // request is durably recorded above. A mail hiccup must never turn a
  // successful submission into an error the owner has to retry.
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://theblacqlist.com'

  if (session.user.email) {
    void sendEmail({
      to: session.user.email,
      subject: `We received your verification request for ${listing.name}`,
      react: VerificationSubmittedEmail({
        listingName: listing.name,
        listingId,
        siteUrl,
      }),
    })
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (adminEmail && session.user.email) {
    void sendEmail({
      to: adminEmail,
      subject: `Verification requested: ${listing.name}`,
      react: VerificationAdminNotificationEmail({
        listingName: listing.name,
        listingId,
        ownerEmail: session.user.email,
        documentCount: rawPaths.length,
        adminUrl: `${siteUrl}/admin/verification`,
      }),
    })
  }

  revalidatePath(`/dashboard/pages/${listingId}/verification`)
  return { success: true }
}
