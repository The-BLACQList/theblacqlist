'use client'

import { useActionState, useState } from 'react'
import { inviteTesterAction, endTesterEnrollmentAction } from '@/lib/actions/admin/manageTesterTour'

export function InviteTesterForm() {
  const [state, dispatch, pending] = useActionState(inviteTesterAction, null)

  const error = state !== null && 'error' in state ? state.error : null
  const succeeded = state !== null && 'success' in state && state.success

  return (
    <form action={dispatch} className="space-y-3">
      <div>
        <label
          htmlFor="invite-listing"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Listing ID or slug
        </label>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          The listing&rsquo;s owner becomes the tester, and their free month lands on their own
          listing.
        </p>
        <input
          id="invite-listing"
          name="listing"
          type="text"
          required
          placeholder="e.g. harlem-coffee-co or a UUID"
          className="mt-1.5 w-full max-w-md rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
      </div>
      {error && (
        <p role="alert" className="font-body text-sm text-red-600">
          {error}
        </p>
      )}
      {succeeded && (
        <p role="status" className="font-body text-sm text-green-700">
          Enrolled. The tester sees the tour rail on their next signed-in page view (while the tour
          flag is on).
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-black px-4 py-2 font-subhead text-sm font-semibold text-white transition-colors hover:bg-charcoal disabled:opacity-50"
      >
        {pending ? 'Inviting…' : 'Invite tester'}
      </button>
    </form>
  )
}

/**
 * End a tester. Ending frees their spot under the cap and keeps their answers,
 * but an owner's unclaimed free month closes for good, so it always asks first
 * and says so when it applies (ticket 137).
 */
export function EndEnrollmentButton({
  enrollmentId,
  testerLabel,
  warning,
}: {
  enrollmentId: string
  testerLabel: string
  warning: string | null
}) {
  const [state, dispatch, pending] = useActionState(endTesterEnrollmentAction, null)
  const [confirming, setConfirming] = useState(false)

  const error = state !== null && 'error' in state ? state.error : null

  if (!confirming) {
    return (
      <div className="w-full space-y-3">
        {warning && (
          <p className="rounded-lg border border-[#ecd9ad] bg-[#fbf3e2] px-3 py-2 font-body text-sm text-[#7a5600]">
            {warning}
          </p>
        )}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-lg border border-[#e8c7c4] bg-white px-4 font-subhead text-sm font-semibold text-[#a02a1f] hover:bg-[#fdf1ef]"
        >
          End and free this spot
        </button>
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label={`End ${testerLabel}`}
      className="w-full rounded-lg border border-[#e8c7c4] bg-[#fdf1ef] p-3 space-y-2"
    >
      <p className="font-subhead text-sm font-semibold text-[#7d2118]">
        End {testerLabel}? Their spot opens up and their answers stay.
      </p>
      {warning && <p className="font-body text-sm text-[#7d2118]">{warning}</p>}
      {error && (
        <p role="alert" className="font-body text-sm text-[#7d2118]">
          {error}
        </p>
      )}
      <form action={dispatch} className="flex flex-wrap gap-2">
        <input type="hidden" name="enrollment_id" value={enrollmentId} />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="min-h-11 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black hover:border-charcoal/40 disabled:opacity-50"
        >
          Keep them
        </button>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-[#a02a1f] px-4 font-subhead text-sm font-semibold text-white hover:bg-[#7d2118] disabled:opacity-50"
        >
          {pending ? 'Ending…' : `Yes, end ${testerLabel}`}
        </button>
      </form>
    </div>
  )
}
