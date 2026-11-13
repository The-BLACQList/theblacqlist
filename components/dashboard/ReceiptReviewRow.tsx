'use client'

import { useActionState, useId, useState } from 'react'

import { ReceiptImageButton } from '@/components/spend/ReceiptImageButton'
import { ownerVerifyReceiptAction, type OwnerReceiptState } from '@/lib/actions/owner/verifyReceipt'
import { ownerRejectReceiptAction } from '@/lib/actions/owner/rejectReceipt'
import type { ReceiptToVerify } from '@/lib/dashboard/receiptsToVerify'
import { OWNER_REJECT_REASONS } from '@/lib/spend/owner-receipts'
import { FIX_REASON_MAX_LENGTH, OTHER_FIX_REASON } from '@/lib/spend/receipt-emails'
import { supportDateLabel } from '@/lib/share/supportCard'

function dollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** One receipt waiting for the owner: what they need to check, and two answers. */
export function ReceiptReviewRow({ receipt }: { receipt: ReceiptToVerify }) {
  const [verifyState, verify, verifying] = useActionState<OwnerReceiptState, FormData>(
    ownerVerifyReceiptAction,
    null
  )
  const [rejectState, reject, rejecting] = useActionState<OwnerReceiptState, FormData>(
    ownerRejectReceiptAction,
    null
  )
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const ids = useId()
  const busy = verifying || rejecting

  const label = `${receipt.buyer} at ${receipt.listingName}`
  const purchased = supportDateLabel(receipt.purchaseDate) ?? receipt.purchaseDate
  const error =
    (verifyState && 'error' in verifyState && verifyState.error) ||
    (rejectState && 'error' in rejectState && rejectState.error) ||
    null

  if (verifyState && 'success' in verifyState) {
    return (
      <p role="status" className="p-5 font-subhead text-sm text-brand-black">
        Verified. {receipt.buyer}&apos;s purchase now counts, and we&apos;ve let them know.
      </p>
    )
  }
  if (rejectState && 'success' in rejectState) {
    return (
      <p role="status" className="p-5 font-subhead text-sm text-brand-black">
        Done. We&apos;ve asked {receipt.buyer} to check their receipt.
      </p>
    )
  }

  return (
    <div className="p-5 space-y-3">
      <div>
        <p className="font-subhead text-sm font-semibold text-brand-black">
          {receipt.buyer}{' '}
          <span className="font-normal text-charcoal-soft">supported {receipt.listingName}</span>
        </p>
        <p className="font-subhead text-xs text-charcoal-soft mt-1">
          {dollars(receipt.amountCents)} <span aria-hidden="true">·</span> bought {purchased}
        </p>
        {receipt.hasFile && (
          <div className="mt-2">
            <ReceiptImageButton
              receiptId={receipt.id}
              filePath={receipt.filePath}
              businessLabel={label}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={verify}>
          <input type="hidden" name="receipt_id" value={receipt.id} />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        {!showReject && (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="min-h-11 px-5 rounded-full border border-charcoal/20 text-charcoal-soft hover:text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-60"
          >
            Not ours
          </button>
        )}
      </div>

      {showReject && (
        <form action={reject} className="space-y-2">
          <input type="hidden" name="receipt_id" value={receipt.id} />
          <fieldset className="space-y-1.5">
            <legend className="font-subhead text-xs font-semibold text-brand-black mb-1">
              What&apos;s wrong? The shopper sees this so they can fix it.
            </legend>
            {[...OWNER_REJECT_REASONS, OTHER_FIX_REASON].map((value) => (
              <label key={value} className="flex items-center gap-2 font-body text-sm">
                <input
                  type="radio"
                  name="rejection_reason"
                  value={value}
                  required
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-amber-gold"
                />
                {value === OTHER_FIX_REASON ? 'Something else' : value}
              </label>
            ))}
          </fieldset>
          {reason === OTHER_FIX_REASON && (
            <div>
              <label htmlFor={`${ids}-other`} className="sr-only">
                Say what&apos;s wrong
              </label>
              <input
                id={`${ids}-other`}
                name="rejection_reason_other"
                type="text"
                required
                maxLength={FIX_REASON_MAX_LENGTH}
                placeholder="Say what's wrong"
                className="h-11 w-full max-w-sm px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm focus:outline-none focus:ring-1 focus:ring-amber-gold/60"
              />
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 px-5 rounded-full bg-brand-black text-white font-subhead font-bold text-sm disabled:opacity-60"
            >
              {rejecting ? 'Sending…' : 'Send to shopper'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReject(false)
                setReason('')
              }}
              className="min-h-11 px-4 font-subhead text-sm text-charcoal-soft underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
