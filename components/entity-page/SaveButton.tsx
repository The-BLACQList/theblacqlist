'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  listingId: string
  initialSaved?: boolean
  className?: string
  tabIndex?: number
  variant?: 'icon' | 'pill'
  /**
   * Refresh the server-rendered route after a successful toggle. Saving goes
   * through the /api/saves route handler rather than a server action, so there
   * is no revalidatePath to piggyback on — a page whose server content depends
   * on save state has to ask for the refresh itself. /account/saved does (the
   * card, its list chips, and the rail all come from the server); entity pages
   * do not, and skip the round-trip.
   */
  refreshOnToggle?: boolean
}

export function SaveButton({
  listingId,
  initialSaved = false,
  className,
  tabIndex,
  variant = 'icon',
  refreshOnToggle = false,
}: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggle() {
    if (isPending) return
    const next = !saved
    setSaved(next) // optimistic update

    startTransition(async () => {
      try {
        if (next) {
          const res = await fetch('/api/saves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_id: listingId }),
          })
          if (!res.ok) {
            // Redirect to sign-in if unauthenticated
            if (res.status === 401) {
              const currentUrl = window.location.pathname + window.location.search
              window.location.href = `/sign-in?next=${encodeURIComponent(currentUrl)}&action=save&listing_id=${listingId}`
              return
            }
            setSaved(!next) // rollback
            return
          }
        } else {
          const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
          if (!res.ok && res.status !== 204) {
            setSaved(!next) // rollback
            return
          }
        }
        // Only after the server actually accepted the change — a rolled-back
        // toggle must not refresh, or the stale server state would overwrite
        // the rollback and the button would appear to un-revert itself.
        if (refreshOnToggle) router.refresh()
      } catch {
        setSaved(!next) // rollback on network error
      }
    })
  }

  // Polite live region announces the save/unsave outcome to screen readers
  // (matches SaveIconButton). The button's aria-label is unaffected.
  const liveRegion = (
    <span className="sr-only" aria-live="polite">
      {saved ? 'Saved' : 'Removed from saved'}
    </span>
  )

  if (variant === 'pill') {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          // `data-tour` is a PRODUCT ANCHOR, not a test hook: the Tester Tour
          // rail spotlights this control by that name. It is deliberately not
          // the aria-label, which is user-facing copy that gets reworded and
          // which flips with `saved`. Both variants carry it — a listing page
          // renders up to three Save buttons and the tour must find whichever
          // one is actually visible. See lib/tour/targets.ts.
          data-tour="save-listing"
          aria-label={saved ? 'Remove from saved businesses' : 'Save this business'}
          aria-pressed={saved}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-4 rounded-full font-subhead font-semibold text-sm transition-colors',
            saved
              ? 'bg-amber-gold/15 text-amber border border-amber-gold/30'
              : 'bg-charcoal/8 text-charcoal border border-charcoal/15 hover:border-amber-gold/30 hover:text-amber',
            className
          )}
        >
          <Heart
            className={cn('size-4', saved ? 'fill-amber-gold text-amber' : '')}
            aria-hidden="true"
          />
          {saved ? 'Saved' : 'Save'}
        </button>
        {liveRegion}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        // Product anchor — see the note on the pill variant above.
        data-tour="save-listing"
        aria-label={saved ? 'Remove from saved businesses' : 'Save this business'}
        aria-pressed={saved}
        tabIndex={tabIndex}
        className={cn(
          'inline-flex items-center justify-center size-10 rounded-full transition-colors',
          saved
            ? 'bg-amber-gold/20 text-amber hover:bg-amber-gold/30'
            : 'bg-white/10 text-white hover:bg-white/20',
          className
        )}
      >
        <Heart
          className={cn('size-4', saved ? 'fill-amber-gold text-amber' : '')}
          aria-hidden="true"
        />
      </button>
      {liveRegion}
    </>
  )
}
