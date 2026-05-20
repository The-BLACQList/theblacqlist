import { Star, BadgeCheck, MessageSquare } from 'lucide-react'
import type { EntityPageData, ReviewItem } from '@/types'
import { ReviewForm } from '@/components/entity-page/ReviewForm'
import { OwnerRespondForm } from '@/components/entity-page/OwnerRespondForm'

interface Props {
  entity: EntityPageData
  userId: string | null
  isOwner: boolean
  hasReviewed: boolean
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const px = size === 'md' ? 'size-5' : 'size-4'
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${px} ${
            i < rating ? 'fill-amber-gold text-amber-gold' : 'fill-transparent text-charcoal/20'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function ReviewCard({
  review,
  isOwner,
  listingId,
}: {
  review: ReviewItem
  isOwner: boolean
  listingId: string
}) {
  const displayName = review.reviewer_display_name ?? 'BLACQList Community Member'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <article className="border border-charcoal/10 rounded-xl p-5 flex flex-col gap-3 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <StarRow rating={review.rating} />
          {review.title && (
            <p className="font-subhead font-semibold text-[15px] text-brand-black leading-snug">
              {review.title}
            </p>
          )}
        </div>
        {review.is_verified_purchase && (
          <span className="inline-flex items-center gap-1 font-subhead text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 flex-shrink-0">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Verified
          </span>
        )}
      </div>

      {review.body && (
        <p className="font-body text-sm text-charcoal leading-relaxed">{review.body}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <span className="inline-flex items-center justify-center size-7 rounded-full bg-deep-bg text-white font-headline text-xs flex-shrink-0">
          {initial}
        </span>
        <div>
          <p className="font-subhead text-sm font-medium text-brand-black leading-none">
            {displayName}
          </p>
          {review.published_at && (
            <p className="font-body text-xs text-charcoal/60 mt-0.5">
              {formatDate(review.published_at)}
            </p>
          )}
        </div>
      </div>

      {/* Owner response — shown to everyone if it exists */}
      {review.owner_response && (
        <div className="mt-1 rounded-lg bg-pale-lavender/40 border border-charcoal/10 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare className="size-3.5 text-charcoal/50" aria-hidden="true" />
            <p className="font-subhead text-xs font-semibold text-charcoal/60">
              Response from the owner
              {review.owner_responded_at && (
                <span className="font-normal ml-1">· {formatDate(review.owner_responded_at)}</span>
              )}
            </p>
          </div>
          <p className="font-body text-sm text-charcoal/80 leading-relaxed">
            {review.owner_response}
          </p>
        </div>
      )}

      {/* Respond button — shown only to the owner when no response yet */}
      {isOwner && !review.owner_response && (
        <OwnerRespondForm reviewId={review.id} listingId={listingId} />
      )}
    </article>
  )
}

export function EntityReviewsSection({ entity, userId, isOwner, hasReviewed }: Props) {
  const canReview = !!userId && !isOwner && !hasReviewed
  const hasReviews = entity.reviews && entity.reviews.length > 0

  // Only render if there's something to show
  if (!hasReviews && !canReview) return null

  const avg =
    entity.avg_rating ??
    (hasReviews
      ? entity.reviews.reduce((sum, r) => sum + r.rating, 0) / entity.reviews.length
      : null)

  const roundedAvg = avg !== null ? Math.round(avg * 10) / 10 : null

  return (
    <section aria-labelledby="reviews-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        {/* Header — only shown when reviews exist */}
        {hasReviews && roundedAvg !== null && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex flex-col gap-1.5">
              <h2
                id="reviews-heading"
                className="font-headline text-[22px] md:text-[28px] text-brand-black"
              >
                Reviews
              </h2>
              <div className="flex items-center gap-2">
                <StarRow rating={Math.round(avg!)} size="md" />
                <span className="font-subhead font-semibold text-brand-black text-base">
                  {roundedAvg.toFixed(1)}
                </span>
                <span className="font-body text-sm text-charcoal/60">
                  ({entity.review_count} {entity.review_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section heading when there are no reviews yet */}
        {!hasReviews && canReview && (
          <h2
            id="reviews-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
          >
            Be the first to review
          </h2>
        )}

        {/* Review cards */}
        {hasReviews && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {entity.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} isOwner={isOwner} listingId={entity.id} />
            ))}
          </div>
        )}

        {/* Review submission form */}
        {canReview && (
          <div className="max-w-xl">
            {hasReviews && (
              <h3 className="font-headline text-lg text-brand-black mb-4">Share your experience</h3>
            )}
            <ReviewForm listingId={entity.id} listingName={entity.name} />
          </div>
        )}
      </div>
    </section>
  )
}
