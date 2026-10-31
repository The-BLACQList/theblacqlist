'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { EntityApprovedEmail } from '@/lib/email/templates/entity-approved'
import { buildEntityUrl } from '@/lib/listings/url'
import { isFeatureEnabled } from '@/lib/env'
import { applyJobGoLiveDefaults } from '@/lib/services/listings/jobGoLive'
import {
  isOwnerSubmittedUnclaimed,
  OWNER_SUBMITTED_CLAIM_NOTE,
  postJobInviteOpen,
} from '@/lib/listings/ownerLine'

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
      'id, name, status, trust_tier, slug, entity_type, submitted_by, published_at, source, ownership_attested, owner_user_id, cities!listings_city_id_fkey(slug)'
    )
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }
  if (listing.status === 'published') return { error: 'This listing is already published.' }
  if (listing.status === 'rejected')
    return { error: 'This listing has been rejected. Restore it before approving.' }

  // Ticket 158: the owner added this page and attested they own it, and this
  // review is the same check a claim gets, so it goes live as Claimed.
  const ownerPath = isOwnerSubmittedUnclaimed(listing)
  const trustTierAfter = ownerPath ? 'claimed' : listing.trust_tier

  const approvedAt = new Date()
  const now = approvedAt.toISOString()
  const { error: updateError } = await serviceClient
    .from('listings')
    .update({
      status: 'published',
      published_at: now,
      moderation_notes: notes,
      last_admin_updated_at: now,
      ...(ownerPath ? { trust_tier: 'claimed' } : {}),
    })
    .eq('id', listingId)

  if (updateError) return { error: 'Failed to approve listing. Please try again.' }

  // The approved claim row starts the 90-day Certified clock (it reads
  // claims.reviewed_at), and the role row matches what approveClaim grants.
  // Neither undoes the publish if it fails: the error goes in the audit row so
  // the founder can add it by hand.
  let ownerClaimId: string | null = null
  const ownerPathErrors: string[] = []
  const ownerId = listing.owner_user_id
  if (ownerPath && ownerId) {
    const { data: claimRow, error: claimError } = await serviceClient
      .from('claims')
      .insert({
        listing_id: listingId,
        claimant_user_id: ownerId,
        status: 'approved',
        role_at_business: 'owner',
        reviewed_at: now,
        reviewed_by: admin.user.id,
        notes: OWNER_SUBMITTED_CLAIM_NOTE,
      })
      .select('id')
      .single()
    if (claimError || !claimRow) {
      ownerPathErrors.push(`claim insert: ${claimError?.message ?? 'no row returned'}`)
    } else {
      ownerClaimId = claimRow.id
    }

    const { error: roleError } = await serviceClient.from('user_roles').insert({
      user_id: ownerId,
      role: 'owner',
      listing_id: listingId,
      granted_by: admin.user.id,
    })
    // 23505: the owner already has this role (unique user_id, role, listing_id).
    if (roleError && roleError.code !== '23505') {
      ownerPathErrors.push(`owner role insert: ${roleError.message}`)
    }
    if (ownerPathErrors.length > 0) {
      console.error('[approveEntity] owner path incomplete', { listingId, errors: ownerPathErrors })
    }
  }

  // Ticket 155: a job's 30 days start when it goes live, not at submit. Sets a
  // default closing date when the poster left it blank and lines the paid
  // window up with it. Fail-soft: the publish above already stands.
  if (listing.entity_type === 'job') {
    await applyJobGoLiveDefaults(serviceClient, {
      listingId,
      publishedAt: approvedAt,
      firstPublish: !listing.published_at,
      paidPostingsOn: isFeatureEnabled('paidPostings'),
    })
  }

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
    afterState: {
      status: 'published',
      trust_tier: trustTierAfter,
      ...(ownerPath ? { claim_id: ownerClaimId } : {}),
      ...(ownerPathErrors.length > 0 ? { owner_path_errors: ownerPathErrors } : {}),
    },
  })

  // The pending count lives in the admin layout (sidebar pills) and the
  // overview alert; drop it the moment the founder acts, not on the next
  // full reload.
  revalidatePath('/admin', 'layout')

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
        react: EntityApprovedEmail({
          listingName: listing.name,
          listingUrl,
          siteUrl,
          ownerManages: ownerPath,
          postJobOpen: ownerPath && postJobInviteOpen(),
        }),
      })
    })()
  }

  return { success: true, listingId, listingName: listing.name }
}
