'use server'

import { createClient } from '@/lib/supabase/server'

export type DeleteOwnReviewState = { success: true } | { error: string } | null

export async function deleteOwnReviewAction(
  _prev: DeleteOwnReviewState,
  formData: FormData
): Promise<DeleteOwnReviewState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to delete a review.' }

  const reviewId = formData.get('review_id')?.toString().trim() ?? ''
  if (!reviewId) return { error: 'Missing review ID.' }

  const { data: review } = await supabase
    .from('reviews')
    .select('id, reviewer_user_id, status')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review) return { error: 'Review not found.' }
  if (review.reviewer_user_id !== user.id)
    return { error: 'You do not have permission to delete this review.' }
  if (review.status !== 'intake') {
    return {
      error: 'This review can no longer be deleted. Published reviews require admin removal.',
    }
  }

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
  if (error) return { error: 'Failed to delete review. Please try again.' }

  return { success: true }
}
