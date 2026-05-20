'use client'

import { useActionState, useState } from 'react'
import { submitReviewResponse } from '@/lib/actions/owner/submitReviewResponse'
import type { ReviewResponseState } from '@/lib/actions/owner/submitReviewResponse'

interface Props {
  reviewId: string
  listingId: string
}

const initial: ReviewResponseState = {}

export function OwnerRespondForm({ reviewId, listingId }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(submitReviewResponse, initial)

  if (state.success) {
    return (
      <p className="font-body text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
        Response saved. It will appear below this review.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 font-body text-xs font-semibold text-charcoal/50 hover:text-brand-black underline underline-offset-2 transition-colors"
      >
        Respond as owner
      </button>
    )
  }

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="review_id" value={reviewId} />
      <input type="hidden" name="listing_id" value={listingId} />
      <textarea
        name="response"
        required
        maxLength={2000}
        rows={3}
        autoFocus
        placeholder="Write your response to this review…"
        className="w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
      />
      {state.error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 px-4 rounded-full bg-brand-black text-white font-body font-bold text-xs hover:bg-charcoal transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Post response'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-8 px-4 rounded-full border border-charcoal/20 text-brand-black font-body font-bold text-xs hover:bg-charcoal/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
