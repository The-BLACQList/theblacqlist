'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { maybePromoteToCertified } from '@/lib/services/trust/certification'

export type ModerateReviewState =
  | { success: true; reviewId: string; decision: 'published' | 'rejected' }
  | { error: string }
  | null

export async function moderateReviewAction(
  _prev: ModerateReviewState,
  formData: FormData
): Promise<ModerateReviewState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const reviewId = formData.get('review_id')?.toString().trim() ?? ''
  const decision = formData.get('decision')?.toString().trim()
  const rejectionReason = formData.get('rejection_reason')?.toString().trim() || null

  if (!reviewId) return { error: 'Missing review ID.' }
  if (decision !== 'published' && decision !== 'rejected') {
    return { error: "Decision must be 'published' or 'rejected'." }
  }

  const serviceClient = createServiceClient()

  const { data: review } = await serviceClient
    .from('reviews')
    .select('id, status, listing_id, listings(slug, entity_type, cities(slug))')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review) return { error: 'Review not found.' }

  const now = new Date().toISOString()
  const updateData =
    decision === 'published'
      ? { status: 'published', published_at: now, reviewed_at: now, reviewed_by: admin.user.id }
      : {
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_at: now,
          reviewed_by: admin.user.id,
        }

  const { error: updateError } = await serviceClient
    .from('reviews')
    .update(updateData)
    .eq('id', reviewId)

  if (updateError) return { error: 'Failed to update review. Please try again.' }

  // Approve the review's photos when the review is published — they ride the same
  // gate as the review body and stay hidden (is_approved=false) if it's rejected.
  if (decision === 'published') {
    await serviceClient
      .from('media_attachments')
      .update({ is_approved: true })
      .eq('entity_type', 'review')
      .eq('entity_id', reviewId)
  }

  // Resolve moderation queue entry if present
  await serviceClient
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_at: now })
    .eq('entity_id', reviewId)
    .eq('queue_type', 'review')
    .eq('status', 'pending')

  // A newly published review may tip a Verified listing over the
  // auto-certification thresholds (5 published reviews + 90 days tenure).
  if (decision === 'published') {
    const { promoted } = await maybePromoteToCertified(serviceClient, review.listing_id)
    if (promoted) {
      void writeAuditLog({
        adminUserId: admin.user.id,
        action: 'auto_certify_listing',
        targetTable: 'listings',
        targetId: review.listing_id,
        beforeState: { trust_tier: 'verified' },
        afterState: { trust_tier: 'certified' },
      })
    }
  }

  // Revalidate the entity page when publishing
  if (decision === 'published') {
    const listing = review.listings as {
      slug: string
      entity_type: string
      cities: { slug: string } | null
    } | null
    if (listing?.slug && listing?.entity_type) {
      revalidatePath(buildEntityUrl(listing.entity_type, listing.cities?.slug, listing.slug))
    }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'moderate_review',
    targetTable: 'reviews',
    targetId: reviewId,
    beforeState: { status: review.status },
    afterState: { status: decision },
  })

  // Sidebar pill reads the intake count from the admin layout.
  revalidatePath('/admin', 'layout')

  return { success: true, reviewId, decision }
}
