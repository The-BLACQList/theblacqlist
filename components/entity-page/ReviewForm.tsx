"use client"

import { useActionState, useState } from "react"
import { Loader2, Star } from "lucide-react"
import { createReviewAction } from "@/lib/actions/reviews/createReview"
import { cn } from "@/lib/utils"

interface Props {
  listingId: string
  listingName: string
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const labels = ["", "1 star — Poor", "2 stars — Fair", "3 stars — Good", "4 stars — Great", "5 stars — Excellent"]
  const display = hover || value

  return (
    <fieldset>
      <legend className="block font-subhead text-xs font-semibold text-charcoal/70 mb-2">
        Star rating <span aria-hidden="true">*</span>
      </legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer">
            <input
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
              aria-label={labels[star]}
            />
            <Star
              className={cn(
                "size-8 transition-colors",
                star <= display
                  ? "fill-amber-gold text-amber-gold"
                  : "fill-none text-charcoal/25"
              )}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ReviewForm({ listingId, listingName }: Props) {
  const [state, formAction, isPending] = useActionState(createReviewAction, null)
  const [rating, setRating] = useState(0)
  const [bodyLen, setBodyLen] = useState(0)

  if (state && "success" in state) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-green-200 bg-green-50 px-5 py-4"
      >
        <p className="font-subhead text-sm font-semibold text-green-800 mb-1">
          Thanks for your review of {listingName}.
        </p>
        <p className="font-body text-sm text-green-700">
          We&apos;ll publish it after a quick check — usually within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="rating" value={rating} />

      <StarSelector value={rating} onChange={setRating} />
      {state && "field" in state && state.field === "rating" && (
        <p role="alert" className="font-body text-xs text-red-600">{state.error}</p>
      )}

      <div>
        <label htmlFor="review-title" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
          Title <span className="font-normal text-charcoal/40">(optional, max 150 chars)</span>
        </label>
        <input
          id="review-title"
          name="title"
          type="text"
          maxLength={150}
          placeholder="Summarize your experience"
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
      </div>

      <div>
        <label htmlFor="review-body" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
          Your review <span className="font-normal text-charcoal/40">(max 2000 chars)</span>
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={4}
          maxLength={2000}
          placeholder="Share your experience with this business…"
          onChange={(e) => setBodyLen(e.target.value.length)}
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
        />
        <p className="font-body text-xs text-charcoal/40 text-right mt-0.5">{bodyLen}/2000</p>
        {state && "field" in state && state.field === "body" && (
          <p role="alert" className="font-body text-xs text-red-600 mt-0.5">{state.error}</p>
        )}
      </div>

      {state && "error" in state && !("field" in state && state.field) && (
        <p role="alert" className="font-body text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || rating === 0}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </form>
  )
}
