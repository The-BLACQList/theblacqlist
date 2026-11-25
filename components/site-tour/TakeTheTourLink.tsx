'use client'

import { useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { SITE_TOUR_BUTTONS } from '@/lib/site-tour/copy'
import { isSiteTourHiddenPath } from '@/lib/site-tour/routes'
import { requestSiteTour } from '@/lib/site-tour/signals'
import { canRetake, earliest, readMemory, SITE_TOUR_MEMORY_EVENT } from '@/lib/site-tour/state'

const subscribe = (notify: () => void) => {
  window.addEventListener(SITE_TOUR_MEMORY_EVENT, notify)
  return () => window.removeEventListener(SITE_TOUR_MEMORY_EVENT, notify)
}

/** True until 30 days after the first visit. False on the server. */
export function useCanRetake(accountSeenAt: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => canRetake(earliest(readMemory()?.seenAt, accountSeenAt), Date.now()),
    () => false
  )
}

/** The Take the Tour row (My Account) and footer link. Gone 30 days after the first visit. */
export function TakeTheTourLink({
  from,
  accountSeenAt = null,
  className,
  onStart,
  as: Wrap,
}: {
  from: 'menu' | 'footer'
  accountSeenAt?: string | null
  className?: string
  onStart?: () => void
  /** Wrap in a list item, so an expired row leaves no empty one behind. */
  as?: 'li'
}) {
  const pathname = usePathname()
  const router = useRouter()
  const show = useCanRetake(accountSeenAt)
  if (!show) return null
  const button = (
    <button
      type="button"
      className={className}
      onClick={() => {
        onStart?.()
        if (isSiteTourHiddenPath(pathname)) router.push(`/?tour=${from}`)
        // After a menu or drawer has closed and given focus back.
        else window.setTimeout(() => requestSiteTour(from), 0)
      }}
    >
      {SITE_TOUR_BUTTONS.take}
    </button>
  )
  return Wrap ? <Wrap>{button}</Wrap> : button
}
