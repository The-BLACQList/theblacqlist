import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  published_at: string | null
  visit_date: string | null
  reviewer_display_name?: string | null
}

interface Props {
  reviews: Review[]
  avgRating: number | null
  reviewCount: number
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "size-3.5",
            s <= rating ? "fill-amber-gold text-amber-gold" : "fill-none text-charcoal/20"
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export function ReviewList({ reviews, avgRating, reviewCount }: Props) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="font-body text-sm text-charcoal/60">No reviews yet. Be the first to share your experience.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      {avgRating !== null && reviewCount > 0 && (
        <div className="flex items-center gap-3 pb-2 border-b border-charcoal/8">
          <span className="font-headline text-3xl text-brand-black">{avgRating.toFixed(1)}</span>
          <div>
            <StarDisplay rating={Math.round(avgRating)} />
            <p className="font-body text-xs text-charcoal/50 mt-0.5">{reviewCount.toLocaleString()} reviews</p>
          </div>
        </div>
      )}

      {/* Review cards */}
      {reviews.map((review) => (
        <article key={review.id} className="rounded-xl border border-charcoal/8 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-subhead text-sm font-semibold text-brand-black">
                {review.reviewer_display_name ?? "BLACQList Community Member"}
              </p>
              {review.published_at && (
                <p className="font-body text-xs text-charcoal/40 mt-0.5">
                  {new Date(review.published_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
            <StarDisplay rating={review.rating} />
          </div>
          {review.title && (
            <p className="font-subhead text-sm font-semibold text-brand-black mb-1">{review.title}</p>
          )}
          {review.body && (
            <p className="font-body text-sm text-charcoal/80 leading-relaxed">{review.body}</p>
          )}
        </article>
      ))}
    </div>
  )
}
