'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { approveEntityAction } from '@/lib/actions/admin/approveEntity'
import { rejectEntityAction } from '@/lib/actions/admin/rejectEntity'

interface Props {
  listingId: string
  listingName: string
}

export function EntityApprovalActions({ listingId, listingName }: Props) {
  const [approveState, approveAction, isApproving] = useActionState(approveEntityAction, null)
  const [rejectState, rejectAction, isRejecting] = useActionState(rejectEntityAction, null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  if (approveState && 'success' in approveState) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
        <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
        <p className="font-subhead text-sm font-semibold text-green-700">
          {listingName} has been approved and published.
        </p>
      </div>
    )
  }

  if (rejectState && 'success' in rejectState) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <XCircle className="size-4 text-red-600 shrink-0" aria-hidden="true" />
        <p className="font-subhead text-sm font-semibold text-red-700">
          {listingName} has been rejected.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Error banners */}
      {approveState && 'error' in approveState && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{approveState.error}</p>
        </div>
      )}
      {rejectState && 'error' in rejectState && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{rejectState.error}</p>
        </div>
      )}

      {/* Approve */}
      <form action={approveAction}>
        <input type="hidden" name="listing_id" value={listingId} />
        <button
          type="submit"
          disabled={isApproving || isRejecting}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
        >
          {isApproving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isApproving ? 'Approving…' : 'Approve & Publish'}
        </button>
      </form>

      {/* Reject */}
      {!showRejectForm ? (
        <button
          type="button"
          onClick={() => setShowRejectForm(true)}
          disabled={isApproving || isRejecting}
          className="w-full inline-flex items-center justify-center h-11 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-subhead font-bold text-sm transition-colors"
        >
          Reject
        </button>
      ) : (
        <form
          action={rejectAction}
          className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50"
        >
          <input type="hidden" name="listing_id" value={listingId} />
          <div>
            <label
              htmlFor="reject-reason"
              className="block font-subhead text-sm font-semibold text-red-800 mb-1"
            >
              Rejection reason <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="reject-reason"
              name="reason"
              rows={3}
              required
              maxLength={500}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this listing is being rejected…"
              className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
            />
            <p className="font-body text-xs text-charcoal/50 mt-0.5 text-right">
              {rejectReason.length}/500
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isRejecting || !rejectReason.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
            >
              {isRejecting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isRejecting ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="px-4 h-10 rounded-lg border border-charcoal/20 text-charcoal/60 hover:text-brand-black font-subhead text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
