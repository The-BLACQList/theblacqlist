'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { canAccess } from '@/lib/stripe/features'

export type ReviewResponseState = {
  error?: string
  success?: boolean
}

export async function submitReviewResponse(
  _prev: ReviewResponseState,
  formData: FormData
): Promise<ReviewResponseState> {
  const session = await getOwnerSession()
  if (!session) return { error: 'You must be signed in to respond to reviews.' }

  const reviewId = (formData.get('review_id') as string | null) ?? ''
  const listingId = (formData.get('listing_id') as string | null) ?? ''
  const response = ((formData.get('response') as string | null) ?? '').trim()

  if (!reviewId || !listingId) return { error: 'Invalid request.' }
  if (!response) return { error: 'Response cannot be empty.' }
  if (response.length > 2000) return { error: 'Response must be 2000 characters or fewer.' }

  const supabase = await createClient()

  // Confirm ownership — listing must belong to this user
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, entity_type, tier, cities!listings_city_id_fkey(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', session.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: "Listing not found or you don't own it." }

  // Responding to reviews is a Starter+ feature.
  if (!canAccess(listing.tier, 'review_response')) {
    return { error: 'Responding to reviews is available on the Starter, Growth, and Premium plans.' }
  }

  // Confirm review exists and belongs to this listing
  const { data: review } = await supabase
    .from('reviews')
    .select('id')
    .eq('id', reviewId)
    .eq('listing_id', listingId)
    .eq('status', 'published')
    .maybeSingle()

  if (!review) return { error: 'Review not found.' }

  const { error } = await supabase
    .from('reviews')
    .update({
      owner_response: response,
      owner_responded_at: new Date().toISOString(),
    })
    .eq('id', reviewId)

  if (error) {
    console.error('[submitReviewResponse]', error)
    return { error: 'Failed to save response. Please try again.' }
  }

  const citySlug = (listing.cities as { slug: string } | null)?.slug ?? null
  revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))

  return { success: true }
}
