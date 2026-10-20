'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  updateListingStatusAction,
  type UpdateListingStatusState,
} from '@/lib/actions/dashboard/updateListingStatus'

interface Props {
  eventId: string
  eventName: string
}

// Ticket 106. Takes a live event off the site from the host page's Events tab.
// The same action as Unpublish in the event's own editor, so the owner guard
// and the allowance count see one path. The event goes back to draft; putting
// it live again runs through review, where the allowance is checked.
export function EventUnpublishButton({ eventId, eventName }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<UpdateListingStatusState, FormData>(
    updateListingStatusAction,
    null
  )

  useEffect(() => {
    if (state && 'success' in state) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="listing_id" value={eventId} />
      <input type="hidden" name="action" value="unpublish" />
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Unpublish ${eventName}`}
        className="inline-flex items-center gap-1.5 h-8 min-h-[44px] md:min-h-0 px-3 rounded-lg border border-charcoal/20 font-subhead font-semibold text-xs text-charcoal hover:bg-charcoal/5 disabled:opacity-60 transition-colors"
      >
        {isPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
        Unpublish
      </button>
      {state && 'error' in state && (
        <p role="alert" className="font-subhead text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
