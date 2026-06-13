'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

export type SubmitForReviewState =
  | { error: string }
  | { success: true }
  | null

export async function submitListingForReviewAction(
  _prev: SubmitForReviewState,
  formData: FormData
): Promise<SubmitForReviewState> {
  const listingId = formData.get('listing_id')?.toString().trim()

  if (!listingId || !/^[0-9a-f-]{36}$/.test(listingId)) {
    return { error: 'Invalid listing ID.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, status, owner_user_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found.' }
  }

  if (listing.owner_user_id !== user.id) {
    return { error: 'You do not have permission to submit this listing.' }
  }

  if (listing.status !== 'draft') {
    return { error: 'Only draft listings can be submitted for review.' }
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({ status: 'pending' })
    .eq('id', listingId)
    .eq('owner_user_id', user.id)

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
    user_id: user.id,
    properties: { source: 'web_form' },
  })

  return { success: true }
}
