'use client'

import { useActionState } from 'react'
import {
  inviteTesterAction,
  endTesterEnrollmentAction,
} from '@/lib/actions/admin/manageTesterTour'

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
          The listing&rsquo;s owner becomes the tester — the tour&rsquo;s trial
          lands on their own listing.
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
          Enrolled. The tester sees the tour rail on their next signed-in page
          view (while the tour flag is on).
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

export function EndEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const [state, dispatch, pending] = useActionState(
    endTesterEnrollmentAction,
    null
  )

  const error = state !== null && 'error' in state ? state.error : null

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <p className="font-body text-xs text-red-600 max-w-[160px] text-right">
          {error}
        </p>
      )}
      <form action={dispatch}>
        <input type="hidden" name="enrollment_id" value={enrollmentId} />
        <button
          type="submit"
          disabled={pending}
          className="font-subhead text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {pending ? 'Ending…' : 'End enrollment'}
        </button>
      </form>
    </div>
  )
}
