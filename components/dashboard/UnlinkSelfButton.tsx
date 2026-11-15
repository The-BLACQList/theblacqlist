'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Unlink } from 'lucide-react'
import { unlinkLocationAction } from '@/lib/actions/dashboard/locations'

/** On a linked location's own Locations page: take it out of its group (ticket 110). */
export function UnlinkSelfButton({ locationId, name }: { locationId: string; name: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await unlinkLocationAction({ locationId })
            if ('error' in result) setError(result.error)
            else router.refresh()
          })
        }}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full border border-charcoal/20 bg-white text-charcoal font-subhead text-sm font-bold disabled:opacity-50"
        aria-label={`Unlink ${name}`}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Unlink className="size-4" aria-hidden="true" />
        )}
        Unlink This Page
      </button>
      {error && (
        <p role="alert" className="mt-2 font-body text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
