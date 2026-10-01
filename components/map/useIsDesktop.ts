import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px)'

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

/** True at the Tailwind `lg` breakpoint and up. The map page is client-only. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
