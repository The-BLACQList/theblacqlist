'use client'

import { useActionState, useState } from 'react'
import { Loader2, Star, ImagePlus, X } from 'lucide-react'
import { createReviewAction } from '@/lib/actions/reviews/createReview'
import { TurnstileWidget } from '@/components/security/TurnstileWidget'
import type { ReviewCriterion } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  listingId: string
  listingName: string
  criteria?: ReviewCriterion[]
}

function CriterionStarRow({
  id,
  name,
  value,
  onChange,
}: {
  id: string
  name: string
  value: number
  onChange: (v: number) => void
}) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-body text-sm text-charcoal">{name}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${name}: ${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={value === star}
            className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
          >
            <Star
              className={cn(
                'size-5 transition-colors',
                star <= display ? 'fill-amber-gold text-amber' : 'fill-none text-charcoal/25'
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <input type="hidden" name={`criterion:${id}`} value={value || ''} />
    </div>
  )
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const labels = [
    '',
    '1 star, Poor',
    '2 stars, Fair',
    '3 stars, Good',
    '4 stars, Great',
    '5 stars, Excellent',
  ]
  const display = hover || value

  return (
    <fieldset>
      <legend className="block font-subhead text-xs font-semibold text-charcoal-soft mb-2">
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
                'size-8 transition-colors',
                star <= display ? 'fill-amber-gold text-amber' : 'fill-none text-charcoal/25'
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

export function ReviewForm({ listingId, listingName, criteria = [] }: Props) {
  const [state, formAction, isPending] = useActionState(createReviewAction, null)
  const [rating, setRating] = useState(0)
  // CONTROLLED on purpose (debt ⑰). React 19 resets an uncontrolled
  // <form action={…}> once the action resolves, so a server-side rejection —
  // Turnstile, a duplicate review, a body that failed a rule — used to wipe up
  // to 2000 characters of writing while the rating, criteria and photo names
  // beside it survived, because those were already held in state. `bodyLen` is
  // now derived rather than tracked separately: as its own state it kept the
  // old count after a reset and reported characters the textarea no longer had.
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [criteriaRatings, setCriteriaRatings] = useState<Record<string, number>>({})
  const [photoNames, setPhotoNames] = useState<string[]>([])

  if (state && 'success' in state) {
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
          We&apos;ll publish it after a quick check, usually within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="rating" value={rating} />

      <StarSelector value={rating} onChange={setRating} />
      {state && 'field' in state && state.field === 'rating' && (
        <p role="alert" className="font-body text-xs text-red-600">
          {state.error}
        </p>
      )}

      {criteria.length > 0 && (
        <fieldset className="rounded-lg border border-charcoal/12 bg-cream/40 px-4 py-3">
          <legend className="px-1 font-subhead text-xs font-semibold text-charcoal-soft">
            Rate by category <span className="font-normal text-charcoal-faint">(optional)</span>
          </legend>
          <div className="space-y-2 mt-1">
            {criteria.map((c) => (
              <CriterionStarRow
                key={c.id}
                id={c.id}
                name={c.name}
                value={criteriaRatings[c.id] ?? 0}
                onChange={(v) => setCriteriaRatings((prev) => ({ ...prev, [c.id]: v }))}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label
          htmlFor="review-title"
          className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
        >
          Title <span className="font-normal text-charcoal-faint">(optional, max 150 chars)</span>
        </label>
        <input
          id="review-title"
          name="title"
          type="text"
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
      </div>

      <div>
        <label
          htmlFor="review-body"
          className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
        >
          Your review <span className="font-normal text-charcoal-faint">(max 2000 chars)</span>
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={4}
          maxLength={2000}
          placeholder="Share your experience with this business…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
        />
        <p className="font-body text-xs text-charcoal-faint text-right mt-0.5">{body.length}/2000</p>
        {state && 'field' in state && state.field === 'body' && (
          <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
            {state.error}
          </p>
        )}
      </div>

      <div>
        <span className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1">
          Photos <span className="font-normal text-charcoal-faint">(optional, up to 3)</span>
        </span>
        <label
          htmlFor="review-photos"
          className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-charcoal/30 px-4 py-2.5 font-body text-sm text-charcoal hover:border-amber-gold hover:bg-amber-50/40 transition-colors"
        >
          <ImagePlus className="size-4 text-amber" aria-hidden="true" />
          {photoNames.length > 0 ? 'Change photos' : 'Add photos'}
          <input
            id="review-photos"
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) =>
              setPhotoNames(Array.from(e.target.files ?? []).map((f) => f.name).slice(0, 3))
            }
          />
        </label>
        <p className="font-body text-xs text-charcoal-faint mt-1">
          JPEG, PNG, or WebP · 5 MB max each · shown once your review is approved.
        </p>
        {photoNames.length > 0 && (
          <ul className="mt-2 space-y-1">
            {photoNames.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-1.5 font-body text-xs text-charcoal-soft"
              >
                <ImagePlus className="size-3 text-charcoal-faint" aria-hidden="true" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}
        {state && 'field' in state && state.field === 'photos' && (
          <p role="alert" className="font-body text-xs text-red-600 mt-1 flex items-center gap-1">
            <X className="size-3.5 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
      </div>

      {state && 'error' in state && !('field' in state && state.field) && (
        <p
          role="alert"
          className="font-body text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
        >
          {state.error}
        </p>
      )}

      <TurnstileWidget />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || rating === 0}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </form>
  )
}
