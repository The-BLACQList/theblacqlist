'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

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
    .select('id, name, status, trust_tier')
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

  return { success: true, listingId, listingName: listing.name }
}
