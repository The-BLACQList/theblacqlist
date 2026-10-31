'use client'

import { useRouter } from 'next/navigation'

import { ErrorState } from '@/components/ui/error-state'

/**
 * The list read failed (ticket 164). Same thin wrapper as SavedLoadError: the
 * retry callback can't cross the server/client boundary, and
 * `router.refresh()` re-runs the page in place.
 */
export function ReceiptsLoadError() {
  const router = useRouter()

  return (
    <ErrorState
      heading="We couldn't load your receipts."
      body="Something went wrong on our end. Try again in a moment."
      homeHref="/account"
      reset={() => router.refresh()}
    />
  )
}
