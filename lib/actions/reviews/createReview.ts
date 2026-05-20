'use server'

import { createClient } from '@/lib/supabase/server'

export type CreateReviewState =
  | { success: true; reviewId: string }
  | { error: string; field?: string }
  | null

export async function createReviewAction(
  _prev: CreateReviewState,
  formData: FormData
): Promise<CreateReviewState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to submit a review.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const ratingRaw = formData.get('rating')?.toString().trim() ?? ''
  const title = formData.get('title')?.toString().trim() || null
  const body = formData.get('body')?.toString().trim() || null
  const visitDate = formData.get('visit_date')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }

  const rating = parseInt(ratingRaw, 10)
  if (!ratingRaw || isNaN(rating) || rating < 1 || rating > 5) {
    return { error: 'Please select a star rating.', field: 'rating' }
  }
  if (title && title.length > 150) {
    return { error: 'Title must be 150 characters or fewer.', field: 'title' }
  }
  if (body && body.length > 2000) {
    return { error: 'Review body must be 2000 characters or fewer.', field: 'body' }
  }
  if (visitDate) {
    const d = new Date(visitDate)
    if (isNaN(d.getTime()) || d > new Date()) {
      return { error: 'Visit date must be a valid past date.', field: 'visit_date' }
    }
  }

  // Verify listing is published and exists
  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_user_id, trust_tier')
    .eq('id', listingId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found or not available for reviews.' }

  // Owners cannot review their own listing
  if (listing.owner_user_id === user.id) {
    return { error: 'You cannot review your own business.' }
  }

  // Check for existing review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('reviewer_user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) {
    return { error: 'You have already submitted a review for this business.' }
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      listing_id: listingId,
      reviewer_user_id: user.id,
      rating,
      title,
      body,
      visit_date: visitDate,
      status: 'intake',
    })
    .select('id')
    .single()

  if (error || !review) return { error: 'Failed to submit your review. Please try again.' }

  return { success: true, reviewId: review.id }
}
