'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { moderateReviewAction } from '@/lib/actions/admin/moderateReview'

interface Props {
  reviewId: string
}

export function ReviewModerationActions({ reviewId }: Props) {
  const [state, action, isPending] = useActionState(moderateReviewAction, null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  if (state && 'success' in state) {
    return state.decision === 'published' ? (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
        <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
        <p className="font-subhead text-sm font-semibold text-green-700">
          Review published. It is now visible on the listing page.
        </p>
      </div>
    ) : (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <XCircle className="size-4 text-red-600 shrink-0" aria-hidden="true" />
        <p className="font-subhead text-sm font-semibold text-red-700">Review rejected.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Publish */}
      <form action={action}>
        <input type="hidden" name="review_id" value={reviewId} />
        <input type="hidden" name="decision" value="published" />
        <button
          type="submit"
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
        >
          {isPending && !showRejectForm && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          Publish review
        </button>
      </form>

      {/* Reject */}
      {!showRejectForm ? (
        <button
          type="button"
          onClick={() => setShowRejectForm(true)}
          disabled={isPending}
          className="w-full inline-flex items-center justify-center h-11 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-subhead font-bold text-sm transition-colors"
        >
          Reject review
        </button>
      ) : (
        <form action={action} className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50">
          <input type="hidden" name="review_id" value={reviewId} />
          <input type="hidden" name="decision" value="rejected" />
          <div>
            <label
              htmlFor="review-reject-reason"
              className="block font-subhead text-sm font-semibold text-red-800 mb-1"
            >
              Rejection reason
              <span className="font-normal text-charcoal-soft ml-1">(optional)</span>
            </label>
            <textarea
              id="review-reject-reason"
              name="rejection_reason"
              rows={3}
              maxLength={500}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this review is being rejected…"
              className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
            />
            <p className="font-body text-xs text-charcoal-soft mt-0.5 text-right">
              {rejectionReason.length}/500
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
            >
              {isPending && showRejectForm && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Confirm rejection
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="px-4 h-10 rounded-lg border border-charcoal/20 text-charcoal-soft hover:text-brand-black font-subhead text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
