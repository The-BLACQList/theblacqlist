'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'

/** How long the failure ring and its message stay up before clearing. */
const FAILURE_MS = 4000

/**
 * The surface this button sits on — and, with it, BOTH its unsaved and its
 * saved colours.
 *
 * ⚠ This prop exists because of a real bug, not for tidiness. Callers used to
 * pass `bg-white/20 hover:bg-white/30 backdrop-blur-sm` in `className`, and
 * `cn()` merges the caller's classes AFTER the component's own — so the saved
 * `bg-amber-gold/20` was overridden on every render and the saved background
 * has never actually appeared in either hero. Reordering the `cn()` arguments
 * would fix it today and break again the next time someone passes a colour.
 * Taking the surface away from the caller is the fix that holds:
 * `className` is for SIZING and POSITION only.
 */
type Surface = 'hero' | 'bar' | 'light'

const SURFACE: Record<Surface, { saved: string; unsaved: string }> = {
  // Over a photo scrim. Saved is SOLID gold, not a tint — /20 over an arbitrary
  // cover image is invisible even when it does render. #000 on #c4a065 is 8.5:1.
  hero: {
    saved: 'bg-amber-gold text-brand-black border border-transparent hover:bg-light-gold',
    unsaved: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm hover:bg-white/30',
  },
  // The fixed quick-action bar, which sits on brand-black.
  bar: {
    saved: 'bg-amber-gold text-brand-black border border-transparent hover:bg-light-gold',
    unsaved: 'bg-white/10 text-white border border-white/20 hover:bg-white/20',
  },
  // On white/paper — /account/saved and anywhere else in the body.
  light: {
    saved: 'bg-amber-gold text-brand-black border border-transparent hover:bg-light-gold',
    unsaved:
      'bg-charcoal/8 text-charcoal border border-charcoal/15 hover:border-amber-gold/40 hover:text-amber',
  },
}

interface Props {
  listingId: string
  initialSaved?: boolean
  /** Sizing and position only — never a background. See {@link Surface}. */
  className?: string
  tabIndex?: number
  variant?: 'icon' | 'pill'
  /** Which ground this button sits on. Drives both saved and unsaved colours. */
  surface?: Surface
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
  surface = 'light',
  refreshOnToggle = false,
}: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [failed, setFailed] = useState(false)
  // ⚠ Seeded EMPTY. Seeding it with the current state makes every listing page
  // mount announcing "Removed from saved" for something that was never saved.
  // A live region reports CHANGES; before the first one it has nothing to say.
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (failTimer.current) clearTimeout(failTimer.current)
    },
    []
  )

  /** Undo the optimistic flip and SAY SO — a silent revert reads as a bug. */
  function rollback(attempted: boolean) {
    setSaved(!attempted)
    setFailed(true)
    setMessage("Couldn't save. Try again.")
    if (failTimer.current) clearTimeout(failTimer.current)
    failTimer.current = setTimeout(() => setFailed(false), FAILURE_MS)
  }

  function toggle() {
    if (isPending) return
    const next = !saved
    setSaved(next) // optimistic update
    setFailed(false)
    setMessage(next ? 'Saved' : 'Removed from saved')

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
            rollback(next)
            return
          }
        } else {
          const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
          if (!res.ok && res.status !== 204) {
            rollback(next)
            return
          }
        }
        // Only after the server actually accepted the change — a rolled-back
        // toggle must not refresh, or the stale server state would overwrite
        // the rollback and the button would appear to un-revert itself.
        if (refreshOnToggle) router.refresh()
      } catch {
        rollback(next)
      }
    })
  }

  // Polite live region announces the save/unsave outcome to screen readers
  // (matches SaveIconButton). The button's aria-label is unaffected.
  const liveRegion = (
    <span className="sr-only" aria-live="polite">
      {message}
    </span>
  )

  const colors = SURFACE[surface][saved ? 'saved' : 'unsaved']

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
            'inline-flex items-center gap-2 h-11 px-5 rounded-full font-subhead font-semibold text-sm transition-colors',
            colors,
            failed && 'ring-2 ring-red-500',
            className
          )}
        >
          <Bookmark
            className="size-4"
            fill={saved ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          {/* The word is the whole point of this variant. An icon alone is what
              made the card and the page look like two different actions. */}
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
          colors,
          failed && 'ring-2 ring-red-500',
          className
        )}
      >
        <Bookmark className="size-4" fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {liveRegion}
    </>
  )
}
