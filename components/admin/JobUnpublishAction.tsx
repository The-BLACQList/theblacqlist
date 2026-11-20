'use client'

// Ticket 235: the admin's Unpublish button for a live job. Two steps, like
// Reject in EntityApprovalActions: the first click opens a small form with an
// optional note, and only Confirm takes the job down.

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { unpublishJobAction } from '@/lib/actions/admin/unpublishJob'

interface Props {
  listingId: string
  listingName: string
}

export function JobUnpublishAction({ listingId, listingName }: Props) {
  const [state, action, isPending] = useActionState(unpublishJobAction, null)
  const [confirming, setConfirming] = useState(false)

  if (state && 'success' in state) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3"
      >
        <CheckCircle className="size-4 text-green-700 shrink-0" aria-hidden="true" />
        <p className="font-subhead text-sm font-semibold text-green-800">
          {listingName} is off the job board.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="font-body text-sm text-charcoal-soft">
        This job is live. Unpublishing takes it off the job board and its page. The owner can&apos;t
        put it back up; they see &ldquo;Taken Down&rdquo; with the support address. Any refund is
        done in Stripe.
      </p>

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-600 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-800">{state.error}</p>
        </div>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full inline-flex items-center justify-center h-11 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-subhead font-bold text-sm transition-colors"
        >
          Unpublish Job
        </button>
      ) : (
        <form action={action} className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50">
          <input type="hidden" name="listing_id" value={listingId} />
          <div>
            <label
              htmlFor="unpublish-note"
              className="block font-subhead text-sm font-semibold text-red-800 mb-1"
            >
              Note for the Record (Optional)
            </label>
            <textarea
              id="unpublish-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder="Why it came down. Only admins see this."
              className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Unpublishing…' : 'Confirm Unpublish'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-4 h-11 rounded-lg border border-charcoal/20 text-charcoal-soft hover:text-brand-black font-subhead text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
