'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X } from 'lucide-react'

/** How long the note stays up. Hovering or focusing it holds it open. */
const SHOW_MS = 6000

interface Props {
  onClose: () => void
}

/**
 * "Saved. View your saved places" — shown after a save the server accepted.
 * [Decision — founder, 2026-10-15 (simplicity P5): tester said "Nothing
 * navigates you back to them."]
 *
 * Portalled to <body> so no transformed or blurred ancestor (the hero Save
 * button sits on a backdrop-blur) can trap its fixed position. It is not a live
 * region: the Save button's own live region already says "Saved", and a second
 * announcement would repeat it. The Saved menu link (M1) is the lasting way
 * back, so the note can time out.
 */
export function SavedToast({ onClose }: Props) {
  const [held, setHeld] = useState(false)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (held) return
    const timer = setTimeout(() => closeRef.current(), SHOW_MS)
    return () => clearTimeout(timer)
  }, [held])

  return createPortal(
    <div
      // Above the phone quick-action bar on listing pages (EntityQuickActionBar).
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl bg-brand-black px-4 py-3 text-white shadow-lg md:bottom-6"
      // React events bubble through portals. On a discover card the Save
      // button sits inside the card's link, so keep these clicks to ourselves.
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <p className="flex-1 font-subhead text-sm">
        Saved.{' '}
        <Link
          href="/account/saved"
          className="font-semibold text-gold underline underline-offset-2 hover:text-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold rounded-sm"
        >
          View your saved places
        </Link>
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>,
    document.body
  )
}

/** The saved page itself needs no pointer back to the saved page. */
export function showsSavedToast(pathname: string): boolean {
  return !pathname.startsWith('/account/saved')
}
