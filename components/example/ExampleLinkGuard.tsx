'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EXAMPLE_LINK_NOTE, isAllowedExampleHref } from '@/lib/example/copy'

interface Props {
  children: ReactNode
}

const NOTE_MS = 2400

/**
 * Holds every link on a sample page that would leave it (ticket 184). The
 * sample business does not exist, so its website, phone, email, booking link,
 * the related cards and the sign-in prompts all go nowhere; instead of each
 * section learning about sample mode, one capture-phase listener on the
 * wrapper cancels the click and shows a short note.
 *
 * Why a native listener and not onClickCapture: React dispatches both phases
 * from the root container, so a native capture listener on this wrapper runs
 * after React's capture handlers but BEFORE every React onClick on the way
 * back up. stopPropagation here therefore also stops the click-tracking
 * handlers the contact links and cards attach (nothing is recorded for a
 * business that is not real), and preventDefault stops the navigation.
 *
 * Allowed through: in-page anchors (the anchor tabs, #send-message), the
 * sample pages themselves, and anything inside an element marked
 * `data-example-allow-links` — the banner's credit links, which are ours.
 * Buttons are never touched: "Show code", the lightbox and the FAQ
 * accordion keep working.
 */
export function ExampleLinkGuard({ children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [noteShown, setNoteShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]')
      if (!anchor) return
      if (anchor.closest('[data-example-allow-links]')) return
      const href = anchor.getAttribute('href') ?? ''
      if (isAllowedExampleHref(href)) return

      event.preventDefault()
      event.stopPropagation()
      setNoteShown(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setNoteShown(false), NOTE_MS)
    }

    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('click', onClick, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div ref={ref} data-example-link-guard="">
      {children}
      {/* Always mounted so the live region exists before the first note. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {noteShown && (
          <span
            data-testid="example-link-note"
            className="rounded-full bg-ink px-4 py-2 font-subhead text-sm text-off-white shadow-lg"
          >
            {EXAMPLE_LINK_NOTE}
          </span>
        )}
      </div>
    </div>
  )
}
