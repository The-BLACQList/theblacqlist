'use client'

import { useActionState, useState } from 'react'
import { cancelSponsoredPlacement } from '@/lib/actions/admin/cancelSponsoredPlacement'
import type { CancelSponsoredPlacementState } from '@/lib/actions/admin/cancelSponsoredPlacement'

const initial: CancelSponsoredPlacementState = {}

/**
 * Ends a placement early. Two-step by design: cancelling stops delivery for
 * something a sponsor paid for, and there is no undo — the action refuses to
 * act on a placement that is no longer active or scheduled.
 */
export function CancelPlacementButton({
  id,
  listingName,
}: {
  id: string
  listingName: string
}) {
  const [state, action, pending] = useActionState(cancelSponsoredPlacement, initial)
  const [confirming, setConfirming] = useState(false)

  if (state.error) {
    return (
      <span className="font-body text-xs text-red-700" role="alert">
        {state.error}
      </span>
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-body text-xs font-semibold text-charcoal-soft underline underline-offset-2 hover:text-red-700 transition-colors min-h-[44px] sm:min-h-0"
      >
        Cancel
      </button>
    )
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="font-body text-xs font-bold text-red-700 underline underline-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-0"
      >
        {pending ? 'Ending…' : `End ${listingName}?`}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="font-body text-xs text-charcoal-soft hover:text-brand-black transition-colors min-h-[44px] sm:min-h-0"
      >
        Keep
      </button>
    </form>
  )
}
