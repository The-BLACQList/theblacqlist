'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// [Decision — founder, 2026-10-15: trust badges explain themselves on tap.]
// A real <button> that opens a small non-modal popover: one plain line for the
// tier plus a link to /about/trust. Escape closes and returns focus, a click or
// tap outside closes, and it is tap-first (no hover). The popover is
// position:fixed and clamped to the viewport so it cannot overflow at 375px;
// it closes on scroll/resize rather than trying to follow the badge.
// Only used where the badge is NOT inside a link or card (nested interactive
// content is invalid HTML) — see the `explain` prop on StatusBadge.

interface Props {
  label: string
  meaning: string
  children: ReactNode
}

const POPOVER_WIDTH = 288 // 18rem
const EDGE = 12

interface Position {
  top: number
  left: number
  width: number
}

export function TrustBadgeExplainer({ label, meaning, children }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  function toggle() {
    if (open) {
      close(false)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE * 2)
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))
      setPos({ top: rect.bottom + 8, left, width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(true)
    }
    function onPointer(e: PointerEvent) {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close(false)
    }
    function onDismiss() {
      close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
    }
  }, [open, close])

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-haspopup="dialog"
        aria-label={`${label}. What does this mean?`}
        // The ::before grows the tap area to ~44px tall without changing how
        // big the badge looks.
        className="relative inline-flex cursor-pointer rounded-full before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
      >
        {children}
      </button>
      {open && pos && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={`About the ${label} badge`}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-50 rounded-xl border border-charcoal/10 bg-white p-4 shadow-lg"
        >
          <p className="font-body text-sm leading-snug text-charcoal">{meaning}</p>
          <Link
            href="/about/trust"
            className="mt-2 inline-flex min-h-11 items-center font-subhead text-sm font-semibold text-brand-black underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black/40"
          >
            How trust works
          </Link>
        </div>
      )}
    </span>
  )
}
