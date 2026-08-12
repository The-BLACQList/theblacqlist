'use client'

import { useRouter } from 'next/navigation'

import { ErrorState } from '@/components/ui/error-state'

/**
 * The third required state for this page (`ux.md`): the query failed.
 *
 * `ErrorState` only renders its retry when given a `reset` callback, and a
 * callback cannot cross the server/client boundary — hence this thin wrapper.
 * `router.refresh()` re-runs the Server Component rather than reloading the
 * document, so a transient Supabase failure recovers in place.
 */
export function SavedLoadError() {
  const router = useRouter()

  return (
    <ErrorState
      heading="Couldn't load your saved businesses"
      body="Something went wrong on our end. Try again in a moment."
      reset={() => router.refresh()}
    />
  )
}
