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

  const serviceClient = createServiceClient()

  await serviceClient.from('moderation_queue').insert({
    entity_id: listingId,
    entity_type: 'listing',
    queue_type: 'new_submission',
    status: 'pending',
    priority: 0,
  })

  void serviceClient.from('analytics_events').insert({
    event_name: 'listing_submitted',
    entity_id: listingId,
    entity_type: 'listing',
    user_id: userId,
    properties: { source: 'web_form' },
  })

  return { success: true }
}
