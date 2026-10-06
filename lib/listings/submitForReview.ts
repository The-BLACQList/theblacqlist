import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceClient } from '@/lib/supabase/server'

type AnyClient = SupabaseClient | { from: SupabaseClient['from'] }

/**
 * Move a draft listing into the moderation queue.
 *
 * Lives here rather than inside the server action because two callers need it:
 * the action itself, and the Stripe fulfilment handler that completes a paid job
 * posting. A paid job that reached `pending` by a slightly different code path —
 * missing its queue row, missing its analytics event — would be a job someone
 * paid for that no moderator ever sees.
 *
 * It is deliberately NOT exported from the `'use server'` module: every export
 * of a `'use server'` file becomes a callable action endpoint, and a
 * status-transition helper that takes its own database client has no business
 * being reachable from a browser.
 *
 * The `owner_user_id` filter on the update is load-bearing under RLS *and* under
 * the service role, where RLS does not apply at all — it is the only thing
 * stopping a wrong `listingId` in a webhook payload from publishing a stranger's
 * draft.
 */
export async function transitionToPendingReview(
  supabase: AnyClient,
  listingId: string,
  userId: string
): Promise<{ success: true } | { error: string }> {
  const { error: updateError } = await supabase
    .from('listings')
    .update({ status: 'pending' })
    .eq('id', listingId)
    .eq('owner_user_id', userId)

  if (updateError) {
    return { error: 'Failed to submit listing for review. Please try again.' }
  }

  // The queue row is what a moderator sees. Until 2026-10-06 the queue_type
  // CHECK rejected 'new_submission' and this insert's error was ignored, so
  // every submitted listing sat in `pending` with no reviewer. A failed insert
  // now puts the listing back to draft and reports it, so a retry (the owner's,
  // or Stripe's redelivery for a paid job) starts from a clean state.
  const queued = await queueNewSubmission(listingId)
  if (!queued) {
    await supabase
      .from('listings')
      .update({ status: 'draft' })
      .eq('id', listingId)
      .eq('owner_user_id', userId)
    return { error: 'Failed to submit listing for review. Please try again.' }
  }

  const serviceClient = createServiceClient()

  void serviceClient.from('analytics_events').insert({
    event_name: 'listing_submitted',
    entity_id: listingId,
    entity_type: 'listing',
    user_id: userId,
    properties: { source: 'web_form' },
  })

  return { success: true }
}

/**
 * Put a listing in the moderation queue once. Returns false on any failure,
 * including a missing service-role key (createServiceClient throws).
 * An open row (pending or assigned) already there counts as queued.
 */
export async function queueNewSubmission(listingId: string): Promise<boolean> {
  try {
    const serviceClient = createServiceClient()
    const { data: open, error: readError } = await serviceClient
      .from('moderation_queue')
      .select('id')
      .eq('queue_type', 'new_submission')
      .eq('entity_id', listingId)
      .in('status', ['pending', 'assigned'])
      .limit(1)
    if (readError) return false
    if (open && open.length > 0) return true

    const { error } = await serviceClient.from('moderation_queue').insert({
      entity_id: listingId,
      entity_type: 'listing',
      queue_type: 'new_submission',
      status: 'pending',
      priority: 0,
    })
    if (error) {
      console.error(JSON.stringify({ level: 'error', op: 'queue_new_submission', listingId, code: error.code }))
      return false
    }
    return true
  } catch {
    return false
  }
}
