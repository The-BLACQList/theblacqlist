'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import {
  CategoryRequestUpdateEmail,
  type CategoryRequestOutcome,
} from '@/lib/email/templates/category-request-update'

// The admin side of "suggest a new category" on /add-business (ticket 126).
// Three ways to close a request, each emails the owner:
//
//   add      create the category under the request's group, move the page in
//   move     move the page to a category that already exists
//   decline  leave the page where it is
//
// category_requests UPDATE has no RLS policy, so this service-role action
// (after the admin check) is the only way a request changes state.

export type ReviewCategoryRequestState =
  | { success: true; outcome: CategoryRequestOutcome }
  | { error: string }
  | null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function reviewCategoryRequestAction(
  _prev: ReviewCategoryRequestState,
  formData: FormData
): Promise<ReviewCategoryRequestState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const requestId = formData.get('request_id')?.toString().trim() ?? ''
  const decision = formData.get('decision')?.toString() ?? ''
  if (!UUID.test(requestId)) return { error: 'Missing request ID.' }
  if (decision !== 'add' && decision !== 'move' && decision !== 'decline') {
    return { error: 'Unknown decision.' }
  }

  const serviceClient = createServiceClient()

  const { data: request } = await serviceClient
    .from('category_requests')
    .select('id, listing_id, requested_by, proposed_name, parent_category_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) return { error: 'Request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, name, owner_user_id, category_id')
    .eq('id', request.listing_id)
    .maybeSingle()

  if (!listing) return { error: 'The business page for this request no longer exists.' }

  // ── Work out where the page ends up ────────────────────────────────────────
  let targetCategoryId: string | null = null
  let targetCategoryName = ''
  let createdCategoryId: string | null = null

  if (decision === 'add') {
    const name = formData.get('name')?.toString().trim() ?? ''
    if (name.length < 2 || name.length > 60) {
      return { error: 'Category name must be 2 to 60 characters.' }
    }
    const slug = slugify(name)
    if (!slug) return { error: 'That name needs at least one letter or number.' }

    // A new category is a sibling of the page's current one when that is a
    // subcategory, and a child of it when it is a top-level group.
    let parentId: string | null = null
    if (request.parent_category_id) {
      const { data: parent } = await serviceClient
        .from('categories')
        .select('id, parent_id')
        .eq('id', request.parent_category_id)
        .maybeSingle()
      parentId = parent ? (parent.parent_id ?? parent.id) : null
    }

    const { data: created, error: createError } = await serviceClient
      .from('categories')
      .insert({ name, slug, parent_id: parentId, is_active: true })
      .select('id, name')
      .single()

    if (createError || !created) {
      if (createError?.code === '23505') {
        return {
          error: `A category with the address "${slug}" already exists. Use "Move to" and pick it instead.`,
        }
      }
      return { error: 'Failed to create the category. Please try again.' }
    }
    createdCategoryId = created.id
    targetCategoryId = created.id
    targetCategoryName = created.name
  } else if (decision === 'move') {
    const categoryId = formData.get('category_id')?.toString().trim() ?? ''
    if (!UUID.test(categoryId)) return { error: 'Pick a category to move the page to.' }
    const { data: category } = await serviceClient
      .from('categories')
      .select('id, name, is_active')
      .eq('id', categoryId)
      .maybeSingle()
    if (!category || !category.is_active) return { error: 'That category is not available.' }
    targetCategoryId = category.id
    targetCategoryName = category.name
  } else if (listing.category_id) {
    const { data: current } = await serviceClient
      .from('categories')
      .select('name')
      .eq('id', listing.category_id)
      .maybeSingle()
    targetCategoryName = current?.name ?? ''
  }

  // ── Close the request (guarded, so two admins cannot both review it) ───────
  const now = new Date().toISOString()
  const status = decision === 'decline' ? 'declined' : 'approved'
  const { data: closed, error: closeError } = await serviceClient
    .from('category_requests')
    .update({
      status,
      reviewed_by: admin.user.id,
      reviewed_at: now,
      created_category_id: targetCategoryId,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (closeError || !closed || closed.length === 0) {
    // Nothing points at a category made a moment ago; remove it so a retry
    // does not trip over its slug.
    if (createdCategoryId) {
      await serviceClient.from('categories').delete().eq('id', createdCategoryId)
    }
    return {
      error: closeError
        ? 'Failed to save the decision. Please try again.'
        : 'This request has already been reviewed.',
    }
  }

  if (targetCategoryId && targetCategoryId !== listing.category_id) {
    const { error: moveError } = await serviceClient
      .from('listings')
      .update({ category_id: targetCategoryId })
      .eq('id', listing.id)
    if (moveError) {
      console.error(
        JSON.stringify({
          level: 'error',
          op: 'review_category_request_move',
          requestId,
          listingId: listing.id,
          code: moveError.code,
        })
      )
      return {
        error: 'The request was saved, but moving the page failed. Change its category by hand.',
      }
    }
  }

  const outcome: CategoryRequestOutcome =
    decision === 'add' ? 'added' : decision === 'move' ? 'moved' : 'declined'

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: `category_request_${outcome}`,
    targetTable: 'category_requests',
    targetId: requestId,
    beforeState: { status: 'pending', listing_category_id: listing.category_id },
    afterState: {
      status,
      listing_category_id: targetCategoryId ?? listing.category_id,
      created_category_id: createdCategoryId,
    },
  })

  // ── Owner email (fire-and-forget) ─────────────────────────────────────────
  const ownerId = request.requested_by ?? listing.owner_user_id
  if (ownerId) {
    void (async () => {
      const { data: userData } = await serviceClient.auth.admin.getUserById(ownerId)
      const ownerEmail = userData?.user?.email
      if (!ownerEmail) return
      await sendEmail({
        to: ownerEmail,
        subject:
          outcome === 'added'
            ? `${request.proposed_name} is now a category`
            : `An update on the category you suggested for ${listing.name}`,
        react: CategoryRequestUpdateEmail({
          listingId: listing.id,
          listingName: listing.name,
          proposedName: request.proposed_name,
          outcome,
          categoryName: targetCategoryName || 'its current category',
        }),
      })
    })()
  }

  revalidatePath('/admin', 'layout')
  revalidatePath(`/dashboard/pages/${listing.id}`, 'layout')

  return { success: true, outcome }
}
