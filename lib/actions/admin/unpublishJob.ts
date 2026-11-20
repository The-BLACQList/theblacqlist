'use server'

// Ticket 235: an admin takes a live job off the job board.
//
// Before this, only the owner could unpublish, from their own edit page (which
// moves the job back to 'draft'). An admin who found a bad or stale role had no
// button for it. This sets 'unpublished' rather than 'draft' on purpose: the
// listings guard lets an owner move a job draft → pending, but refuses any move
// out of 'unpublished', so the owner can't put back up what an admin took down.
//
// Out of scope, by decision: no refund (refunds stay manual in Stripe) and no
// email to the owner. The owner's edit page says "Taken Down" and gives the
// support address.

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { buildEntityUrl } from '@/lib/listings/url'

export type UnpublishJobState = { success: true } | { error: string } | null

const NOTE_MAX = 500

export async function unpublishJobAction(
  _prev: UnpublishJobState,
  formData: FormData
): Promise<UnpublishJobState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const note = formData.get('note')?.toString().trim().slice(0, NOTE_MAX) || null
  if (!listingId) return { error: 'Missing listing ID.' }

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, status, entity_type, slug, cities!listings_city_id_fkey(slug)')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }
  if (listing.entity_type !== 'job') return { error: 'Only job listings can be unpublished here.' }
  if (listing.status !== 'published') return { error: 'This job is not live.' }

  const now = new Date().toISOString()
  const { data: moved, error: updateError } = await serviceClient
    .from('listings')
    .update({
      status: 'unpublished',
      last_admin_updated_at: now,
      ...(note ? { moderation_notes: note } : {}),
    })
    .eq('id', listingId)
    // Only a live job moves. If the owner or the expiry sweep changed it since
    // the read above, nothing is written and the admin is told.
    .eq('status', 'published')
    .select('id')

  if (updateError) return { error: 'Failed to unpublish this job. Please try again.' }
  if (!moved || moved.length === 0) {
    return { error: 'This job changed while you were looking. Reload the page and try again.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'unpublish_job',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: { status: 'published' },
    afterState: { status: 'unpublished', ...(note ? { note } : {}) },
  })

  revalidatePath('/jobs')
  const citySlug = (listing.cities as { slug: string } | null)?.slug
  if (listing.slug) revalidatePath(buildEntityUrl('job', citySlug, listing.slug))
  revalidatePath(`/dashboard/pages/${listingId}/edit`)
  revalidatePath('/admin', 'layout')

  return { success: true }
}
