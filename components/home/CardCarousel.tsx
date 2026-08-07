'use client'

import { useRef } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  ariaLabel: string
  children: React.ReactNode
  /** Tailwind width classes per slide */
  itemClassName?: string
}

/**
 * Shared scroll-snap card carousel (server-rendered children): swipe,
 * arrows, and keyboard all work; scrolling is instant under
 * prefers-reduced-motion. Used by the trending row and future card rails.
 */
export function CardCarousel({ ariaLabel, children, itemClassName }: Props) {
  const reelRef = useRef<HTMLDivElement>(null)

  function scrollByCard(direction: 1 | -1) {
    const reel = reelRef.current
    if (!reel) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const card = reel.querySelector<HTMLElement>('[data-carousel-item]')
    const step = card ? card.offsetWidth + 16 : reel.clientWidth * 0.6
    const atEnd = reel.scrollLeft + reel.clientWidth >= reel.scrollWidth - 8
    const atStart = reel.scrollLeft <= 8
    let left = reel.scrollLeft + direction * step
    if (direction === 1 && atEnd) left = 0
    if (direction === -1 && atStart) left = reel.scrollWidth
    reel.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const items = Array.isArray(children) ? children : [children]

  return (
    <div>
      <div
        ref={reelRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {items.map((child, i) => (
          <div
            key={i}
            data-carousel-item
            className={cn('shrink-0 snap-start', itemClassName ?? 'w-[280px] md:w-[300px]')}
          >
            {child}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-1.5">
        {(
          [
            [-1, 'Scroll back', ArrowLeft],
            [1, 'Scroll forward', ArrowRight],
          ] as const
        ).map(([dir, label, Icon]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={() => scrollByCard(dir)}
            className="flex items-center justify-center size-11 rounded-full border-[1.5px] border-brand-black text-brand-black hover:bg-brand-black hover:text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
