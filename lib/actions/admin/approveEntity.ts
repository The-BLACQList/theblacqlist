'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { EntityApprovedEmail } from '@/lib/email/templates/entity-approved'
import { buildEntityUrl } from '@/lib/listings/url'

export type ApproveEntityState =
  | { success: true; listingId: string; listingName: string }
  | { error: string }
  | null

export async function approveEntityAction(
  _prev: ApproveEntityState,
  formData: FormData
): Promise<ApproveEntityState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select(
      'id, name, status, trust_tier, slug, entity_type, submitted_by, cities!listings_city_id_fkey(slug)'
    )
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }
  if (listing.status === 'published') return { error: 'This listing is already published.' }
  if (listing.status === 'rejected')
    return { error: 'This listing has been rejected. Restore it before approving.' }

  const now = new Date().toISOString()
  const { error: updateError } = await serviceClient
    .from('listings')
    .update({
      status: 'published',
      published_at: now,
      moderation_notes: notes,
      last_admin_updated_at: now,
    })
    .eq('id', listingId)

  if (updateError) return { error: 'Failed to approve listing. Please try again.' }

  // Resolve the moderation queue entry
  await serviceClient
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_at: now })
    .eq('entity_id', listingId)
    .eq('queue_type', 'new_submission')
    .eq('status', 'pending')

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'approve_entity',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: { status: listing.status, trust_tier: listing.trust_tier },
    afterState: { status: 'published' },
  })

  // ── Approval email (fire-and-forget) ─────────────────────────────────────────
  // Same shape as rejectEntity.ts:69-81, and for the same reason: the publish
  // has already succeeded by this point. A missing address, a missing Resend
  // key, or a rejected send must never turn a published listing into an error
  // the admin sees. `sendEmail` itself never throws (lib/email/resend.ts:20).
  if (listing.submitted_by) {
    void (async () => {
      const { data: userData } = await serviceClient.auth.admin.getUserById(listing.submitted_by!)
      const submitterEmail = userData?.user?.email
      if (!submitterEmail) return

      // Built only when both segments exist. buildEntityUrl would happily
      // return "/online/undefined/undefined" — a link to a 404 is worse than
      // the dashboard button the template falls back to.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
      const listingUrl =
        listing.slug && listing.entity_type
          ? `${siteUrl}${buildEntityUrl(listing.entity_type, listing.cities?.slug ?? null, listing.slug)}`
          : null

      await sendEmail({
        to: submitterEmail,
        subject: `${listing.name} is live on The BLACQList`,
        react: EntityApprovedEmail({ listingName: listing.name, listingUrl, siteUrl }),
      })
    })()
  }

  return { success: true, listingId, listingName: listing.name }
}
