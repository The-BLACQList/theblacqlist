'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { TURNSTILE_ERROR, verifyTurnstileFormData } from '@/lib/security/turnstile'

const REVIEW_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const REVIEW_PHOTO_MAX_BYTES = 5 * 1024 * 1024
const REVIEW_PHOTO_MAX_COUNT = 3

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

  // Reviews had the weakest protection of the three surfaces — a per-user
  // per-listing duplicate guard and nothing else. Runs after auth so an
  // unauthenticated caller never burns a token.
  if (!(await verifyTurnstileFormData(formData))) {
    return { error: TURNSTILE_ERROR }
  }

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

  // Validate optional photos up-front (before the review is saved) so the user can
  // fix and resubmit cleanly — once the review exists, the duplicate guard blocks retry.
  const photoFiles = formData
    .getAll('photos')
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (photoFiles.length > REVIEW_PHOTO_MAX_COUNT) {
    return { error: `You can attach up to ${REVIEW_PHOTO_MAX_COUNT} photos.`, field: 'photos' }
  }
  for (const f of photoFiles) {
    if (!REVIEW_PHOTO_TYPES.includes(f.type)) {
      return { error: 'Photos must be JPEG, PNG, or WebP.', field: 'photos' }
    }
    if (f.size > REVIEW_PHOTO_MAX_BYTES) {
      return { error: 'Each photo must be under 5 MB.', field: 'photos' }
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

  // Optional per-criterion scores arrive as `criterion:<uuid>` form fields.
  // These ride the review's moderation gate and are best-effort: a failure here
  // (e.g. review_ratings not migrated yet) must not fail the saved review.
  const criterionRows: { review_id: string; criterion_id: string; rating: number }[] = []
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('criterion:')) continue
    const criterionId = key.slice('criterion:'.length).trim()
    const value = parseInt(raw.toString().trim(), 10)
    if (!criterionId || isNaN(value) || value < 1 || value > 5) continue
    criterionRows.push({ review_id: review.id, criterion_id: criterionId, rating: value })
  }
  if (criterionRows.length > 0) {
    try {
      await (supabase as unknown as SupabaseClient).from('review_ratings').insert(criterionRows)
    } catch {
      // best-effort enrichment only — the review itself is already saved
    }
  }

  // Upload any photos via the service client (mirrors the receipt-upload flow — a
  // reviewer is not the listing owner, so the owner-gated upload APIs won't work).
  // Photos land pending (is_approved=false) and only become public when an admin
  // publishes the review. Best-effort: a photo failure must not fail the saved review.
  if (photoFiles.length > 0) {
    try {
      const service = createServiceClient()
      const mediaRows: {
        entity_type: string
        entity_id: string
        file_path: string
        file_type: string
        file_size_bytes: number
        uploaded_by: string
        is_approved: boolean
      }[] = []
      for (const f of photoFiles) {
        const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `reviews/${review.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await service.storage
          .from('listing-media')
          .upload(path, f, { contentType: f.type, upsert: false })
        if (upErr) continue
        mediaRows.push({
          entity_type: 'review',
          entity_id: review.id,
          file_path: path,
          file_type: f.type,
          file_size_bytes: f.size,
          uploaded_by: user.id,
          is_approved: false,
        })
      }
      if (mediaRows.length > 0) {
        await (service as unknown as SupabaseClient).from('media_attachments').insert(mediaRows)
      }
    } catch {
      // best-effort — the review is already saved
    }
  }

  return { success: true, reviewId: review.id }
}
