'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { updateVerificationStatusAction } from '@/lib/actions/admin/updateVerificationStatus'

interface Props {
  listingId: string
}

export function VerificationDecisionForm({ listingId }: Props) {
  const [state, dispatch, isPending] = useActionState(updateVerificationStatusAction, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      router.push('/admin/verification')
    }
  }, [state, router])

  const error = state && 'error' in state ? state.error : null

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />

      <div>
        <label
          htmlFor="ver-notes"
          className="block font-subhead text-xs text-charcoal-soft uppercase tracking-wide mb-1.5"
        >
          Admin notes (optional)
        </label>
        <textarea
          id="ver-notes"
          name="notes"
          rows={3}
          placeholder="Document your decision or any issues found…"
          className="w-full rounded-lg border border-charcoal/15 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
        />
      </div>

      {error && (
        <p className="font-body text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          name="decision"
          value="verified"
          disabled={isPending}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 font-subhead text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Approve verification'}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={isPending}
          className="flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 font-subhead text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Reject'}
        </button>
      </div>
    </form>
  )
}
