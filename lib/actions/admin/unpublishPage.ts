'use server'

// Ticket 284: an admin hides a live Page, and puts back one an admin hid.
//
// The work is done by two database functions, so the status, the audit row and
// the do-not-re-add mark are written together or not at all. 'unpublished' is
// on purpose, as in unpublishJob: the listings guard lets no owner move a Page
// out of it. Jobs keep unpublishJob.
//
// Out of scope, by decision: no email, no refund, no plan cancel, no photo
// removal.

import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin/guard'
import { isPageHideReason, PAGE_HIDE_NOTE_MAX } from '@/lib/admin/pageHide'
import { createServiceClient } from '@/lib/supabase/server'

export type PageHideState = { success: true } | { error: string } | null

const NO_PERMISSION = 'You do not have permission to perform this action.'

const HIDE_REFUSALS: Record<string, string> = {
  not_found: 'Page not found.',
  is_job: 'Jobs have their own Unpublish. Reload the page and use that.',
  not_published: 'This Page is not live. Reload the page and check its status.',
}

const PUT_BACK_REFUSALS: Record<string, string> = {
  not_found: 'Page not found.',
  is_job: 'Jobs can’t be put back here.',
  not_hidden: 'This Page is not hidden. Reload the page and check its status.',
  not_ours: 'This Page was not hidden by an admin here, so it can’t be put back here.',
}

/**
 * Any page may list this one (home, city, search, vendors, related), so the
 * whole site is refreshed. Hiding a Page is rare. The map's data and the sitemap
 * are route handlers, which the layout path doesn't reach.
 */
function refreshEverywhere() {
  revalidatePath('/', 'layout')
  revalidatePath('/api/map/listings')
  revalidatePath('/sitemap.xml')
}

export async function unpublishPageAction(
  _prev: PageHideState,
  formData: FormData
): Promise<PageHideState> {
  const admin = await getAdminSession()
  if (!admin) return { error: NO_PERMISSION }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const reason = formData.get('reason')?.toString() ?? ''
  const note = formData.get('note')?.toString().trim().slice(0, PAGE_HIDE_NOTE_MAX) ?? ''
  const mark = formData.get('do_not_re_add') === 'on'

  if (!listingId) return { error: 'Missing listing ID.' }
  if (!isPageHideReason(reason)) return { error: 'Choose a reason.' }
  if (reason === 'other' && !note) return { error: 'Add a note that says why.' }

  const { data, error } = await createServiceClient().rpc('admin_hide_page', {
    p_listing_id: listingId,
    p_admin_id: admin.user.id,
    p_reason: reason,
    p_note: note,
    p_mark: mark,
  })

  if (error) {
    console.error('[unpublishPage] failed:', error.message)
    return { error: 'Nothing was changed. The Page could not be unpublished. Please try again.' }
  }
  if (data !== 'ok') return { error: HIDE_REFUSALS[data] ?? 'Nothing was changed. Try again.' }

  refreshEverywhere()
  return { success: true }
}

export async function putBackPageAction(
  _prev: PageHideState,
  formData: FormData
): Promise<PageHideState> {
  const admin = await getAdminSession()
  if (!admin) return { error: NO_PERMISSION }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const reason = formData.get('reason')?.toString().trim().slice(0, PAGE_HIDE_NOTE_MAX) ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }
  if (!reason) return { error: 'Say why this Page is going back up.' }

  const { data, error } = await createServiceClient().rpc('admin_put_back_page', {
    p_listing_id: listingId,
    p_admin_id: admin.user.id,
    p_reason: reason,
  })

  if (error) {
    console.error('[putBackPage] failed:', error.message)
    return { error: 'Nothing was changed. The Page could not be put back. Please try again.' }
  }
  if (data !== 'ok') return { error: PUT_BACK_REFUSALS[data] ?? 'Nothing was changed. Try again.' }

  refreshEverywhere()
  return { success: true }
}
