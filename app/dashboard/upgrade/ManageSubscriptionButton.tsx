'use client'

import { useState, useTransition } from 'react'
import { createPortalSession } from '@/lib/actions/billing/createPortalSession'

interface Props {
  listingId?: string
}

export function ManageSubscriptionButton({ listingId }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await createPortalSession({ listingId })
      if (result.ok) {
        window.location.href = result.url
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center rounded-full border border-brand-black bg-white px-5 py-2 font-body font-bold text-sm text-brand-black transition-colors hover:bg-brand-black hover:text-white disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isPending ? 'Opening…' : 'Manage subscription'}
      </button>
      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
