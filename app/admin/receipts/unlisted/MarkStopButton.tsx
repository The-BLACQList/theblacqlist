'use client'

import { useActionState, useState } from 'react'

import { markBusinessOptedOutAction } from '@/lib/actions/spend/unlistedInvite'
import type { MarkOptedOutState } from '@/lib/actions/spend/unlistedInvite'

/**
 * The business replied STOP. Two-step, because there is no undo: once marked,
 * "Email this business" stays off for good.
 */
export function MarkStopButton({ businessName }: { businessName: string }) {
  const [state, action, pending] = useActionState<MarkOptedOutState, FormData>(
    markBusinessOptedOutAction,
    null
  )
  const [confirming, setConfirming] = useState(false)

  if (state && 'error' in state) {
    return (
      <p className="font-body text-xs text-red-700 min-h-11 flex items-center" role="alert">
        {state.error}
      </p>
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center min-h-11 font-body text-xs font-semibold text-charcoal-soft underline underline-offset-2 hover:text-red-700 transition-colors"
      >
        Mark STOP received
        <span className="sr-only"> from {businessName}</span>
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3">
      <input type="hidden" name="business_name" value={businessName} />
      <span className="font-body text-xs text-brand-black">Email stays off for good.</span>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center min-h-11 font-body text-xs font-bold text-red-700 underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Mark STOP'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex items-center min-h-11 font-body text-xs text-charcoal-soft hover:text-brand-black transition-colors"
      >
        Keep
      </button>
    </form>
  )
}
