'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

// A "More below" pill on the edit page (part C feedback, 2026-11-13). Owners
// didn't notice that a long tab carried on past the screen. The pill floats
// near the bottom while the end of the open tab is still below the screen,
// and goes once it comes into view. `watch` re-checks when the tab changes.

export function MoreBelow({ watch }: { watch?: unknown }) {
  const endRef = useRef<HTMLDivElement>(null)
  const [below, setBelow] = useState(false)

  useEffect(() => {
    const end = endRef.current
    if (!end || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        // Only while the end is under the screen, not after scrolling past it.
        setBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0)
      },
      { rootMargin: '0px 0px -96px 0px' }
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [watch])

  function scrollOn() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      {/* No height of its own, and -mt-6 cancels the column's gap, so neither div moves the cards. */}
      <div className="pointer-events-none sticky bottom-20 z-10 -mt-6 flex h-0 justify-center">
        {below && (
          <button
            type="button"
            onClick={scrollOn}
            className="pointer-events-auto inline-flex -translate-y-full items-center gap-1.5 rounded-full border border-charcoal/15 bg-white/95 px-4 py-2 font-subhead text-xs font-semibold text-brand-black shadow-md backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
          >
            More below
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div ref={endRef} aria-hidden="true" className="-mt-6 h-px" />
    </>
  )
}
