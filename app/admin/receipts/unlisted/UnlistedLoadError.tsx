'use client'

import { useRouter } from 'next/navigation'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Either read failed (ticket 168). Same thin wrapper as ReceiptsLoadError:
 * `router.refresh()` re-runs the page in place.
 */
export function UnlistedLoadError() {
  const router = useRouter()

  return (
    <ErrorState
      heading="Couldn't load the list."
      body="Something went wrong on our end. Try again in a moment."
      homeHref="/admin/receipts"
      reset={() => router.refresh()}
    />
  )
}
