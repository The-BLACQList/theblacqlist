'use client'

// The save control on a discover card.
//
// One metaphor across the whole product: a BOOKMARK, filled when saved. A heart
// reads as a public "like"; a bookmark reads as a private list, which is exactly
// what /account/saved is. `SaveButton` (entity pages) and
// `EntityPlatformActivity` use the same glyph — the founder's complaint was that
// the card and the listing page looked like two different actions when they hit
// the same endpoint (POST/DELETE /api/saves).
//
// ⚠ Saved vs unsaved must be distinguishable BY COLOUR ALONE at card size. A
// different glyph (BookmarkCheck) at 18px across a 24-card grid is not a signal
// anyone sees; a solid gold chip is.

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bookmark } from 'lucide-react'

import { cn } from '@/lib/utils'

/** How long the failure ring and its message stay up before clearing. */
const FAILURE_MS = 4000
/** Fallback for clearing the pop when `animationend` never fires — it does not
 *  fire under prefers-reduced-motion, where the animation does not exist. */
const POP_MS = 400

interface SaveIconButtonProps {
  listingId: string
  listingName: string
  initialIsSaved?: boolean
  className?: string
}

export function SaveIconButton({
  listingId,
  listingName,
  initialIsSaved = false,
  className,
}: SaveIconButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [failed, setFailed] = useState(false)
  const [popping, setPopping] = useState(false)
  // ⚠ Seeded EMPTY, deliberately. Seeding it with the current state means every
  // card on a 24-card grid mounts announcing "<name> removed from saved" for a
  // listing that was never saved — 24 blocks of false text in the a11y tree.
  // A live region reports CHANGES; it has nothing to say before the first one.
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (failTimer.current) clearTimeout(failTimer.current)
      if (popTimer.current) clearTimeout(popTimer.current)
    },
    []
  )

  /** Undo the optimistic flip and SAY SO — a silent revert reads as a bug. */
  function rollback(attempted: boolean) {
    setIsSaved(!attempted)
    setFailed(true)
    setMessage("Couldn't save. Try again.")
    if (failTimer.current) clearTimeout(failTimer.current)
    failTimer.current = setTimeout(() => setFailed(false), FAILURE_MS)
  }

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    e.preventDefault()
    if (isPending) return

    const next = !isSaved
    setIsSaved(next)
    setFailed(false)
    setMessage(next ? `${listingName} saved` : `${listingName} removed from saved`)

    // ⚠ Set ONLY in the click handler, never from `initialIsSaved` — deriving it
    // from state would pop every already-saved card on page load.
    if (next) {
      setPopping(true)
      if (popTimer.current) clearTimeout(popTimer.current)
      popTimer.current = setTimeout(() => setPopping(false), POP_MS)
    }

    startTransition(async () => {
      try {
        if (next) {
          const res = await fetch('/api/saves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_id: listingId }),
          })
          if (!res.ok) {
            if (res.status === 401) {
              const currentUrl = window.location.pathname + window.location.search
              window.location.href = `/sign-in?next=${encodeURIComponent(currentUrl)}&action=save&listing_id=${listingId}`
              return
            }
            rollback(next)
          }
        } else {
          const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
          if (!res.ok && res.status !== 204) {
            rollback(next)
          }
        }
      } catch {
        rollback(next)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onAnimationEnd={() => setPopping(false)}
        disabled={isPending}
        // Product anchor for the Tester Tour rail — see components/entity-page/
        // SaveButton.tsx and lib/tour/targets.ts. A card save is a real save, so
        // the tour must be able to spotlight and witness this control too.
        data-tour="save-listing"
        aria-label={isSaved ? `Remove ${listingName} from saved` : `Save ${listingName}`}
        aria-pressed={isSaved}
        className={cn(
          'absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-1',
          isSaved
            ? // Solid gold, not gold-at-20%: over an arbitrary cover photo a
              // translucent tint is invisible. #000 on #c4a065 is 8.5:1.
              'bg-amber-gold text-brand-black ring-2 ring-white/70 hover:bg-light-gold'
            : 'bg-black/50 text-white hover:bg-black/70',
          failed && 'ring-2 ring-red-500',
          popping && 'blacq-save-pop',
          className
        )}
      >
        <Bookmark
          size={18}
          fill={isSaved ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>
      {/* Polite live region. Empty until the user actually toggles something. */}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </>
  )
}
