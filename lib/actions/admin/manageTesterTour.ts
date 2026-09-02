'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'

export type ManageTesterTourState = { success: true } | { error: string } | null

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Invite a tester by enrolling a listing's OWNER in the tour.
 *
 * The enrollment binds tester and listing together, and the migration's
 * contract (20260830000000_tester_tour.sql) is that ownership is verified
 * HERE, at invitation time — a trial is worth nothing on a listing the tester
 * cannot edit. Taking the listing as the input and enrolling whoever owns it
 * makes that check structural: there is no way to enroll a non-owner.
 */
export async function inviteTesterAction(
  _prev: ManageTesterTourState,
  formData: FormData
): Promise<ManageTesterTourState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const listingRef = formData.get('listing')?.toString().trim() ?? ''
  if (!listingRef) return { error: 'Enter a listing ID or slug.' }

  const serviceClient = createServiceClient()

  const listingQuery = serviceClient
    .from('listings')
    .select('id, name, slug, status, owner_user_id, deleted_at')
  const { data: listing, error: listingError } = await (UUID_PATTERN.test(
    listingRef
  )
    ? listingQuery.eq('id', listingRef)
    : listingQuery.eq('slug', listingRef)
  ).maybeSingle()

  if (listingError) {
    console.error('[inviteTesterAction] listing lookup', listingError)
    return { error: 'Failed to look up the listing. Please try again.' }
  }
  if (!listing || listing.deleted_at !== null) {
    return { error: `No listing found for “${listingRef}”.` }
  }
  if (!listing.owner_user_id) {
    return {
      error:
        'This listing has no owner account. The tour’s trial lands on the tester’s own listing, so they must claim it before they can be invited.',
    }
  }
  if (listing.status !== 'published') {
    return {
      error: `“${listing.name}” is not published (status: ${listing.status}). Publish it first — the trial upgrades a live listing, not a hidden one.`,
    }
  }

  const { data: enrollment, error: insertError } = await serviceClient
    .from('tour_enrollments')
    .insert({
      tester_user_id: listing.owner_user_id,
      listing_id: listing.id,
      invited_by: admin.user.id,
    })
    .select('id')
    .single()

  if (insertError) {
    // The only unique index an insert can trip is one-live-enrollment-per-
    // tester (the trial-per-tester/-listing indexes are partial on
    // trial_granted_at, which is NULL here).
    if (insertError.code === '23505') {
      return {
        error:
          'This owner already has a live tour enrollment. End it below before re-inviting.',
      }
    }
    console.error('[inviteTesterAction]', insertError)
    return { error: 'Failed to create the enrollment. Please try again.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'invite_tour_tester',
    targetTable: 'tour_enrollments',
    targetId: enrollment.id,
    afterState: {
      tester_user_id: listing.owner_user_id,
      listing_id: listing.id,
      listing_slug: listing.slug,
    },
  })

  revalidatePath('/admin/testers')
  return { success: true }
}

/**
 * End a live enrollment. Ending frees the one-live-enrollment-per-tester slot
 * so the tester can be re-invited later; it deletes no evidence — the step
 * completions stay attached to this enrollment row.
 */
export async function endTesterEnrollmentAction(
  _prev: ManageTesterTourState,
  formData: FormData
): Promise<ManageTesterTourState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const enrollmentId = formData.get('enrollment_id')?.toString().trim() ?? ''
  if (!UUID_PATTERN.test(enrollmentId)) return { error: 'Invalid enrollment.' }

  const serviceClient = createServiceClient()

  // `.is('ended_at', null)` + `.select('id')` makes a double-end observable
  // as a zero-row update instead of silently re-stamping ended_at.
  const endedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await serviceClient
    .from('tour_enrollments')
    .update({ ended_at: endedAt })
    .eq('id', enrollmentId)
    .is('ended_at', null)
    .select('id')

  if (updateError) {
    console.error('[endTesterEnrollmentAction]', updateError)
    return { error: 'Failed to end the enrollment. Please try again.' }
  }
  if (!updated || updated.length === 0) {
    return { error: 'This enrollment was not found or is already ended.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'end_tour_enrollment',
    targetTable: 'tour_enrollments',
    targetId: enrollmentId,
    beforeState: { ended_at: null },
    afterState: { ended_at: endedAt },
  })

  revalidatePath('/admin/testers')
  return { success: true }
}
