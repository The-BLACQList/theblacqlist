'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EMBER_WASH } from '@/lib/design/surfaces'

export interface ShowcaseItem {
  id: string
  name: string
  href: string
  categoryName: string | null
  coverSrc: string | null
  /** Up to two real offerings (name + optional price) from the listing */
  offerings: Array<{ name: string; price: string | null }>
  tagline: string
}

interface Props {
  items: ShowcaseItem[]
}

const ADVANCE_MS = 6000

/**
 * "Your BLACQList Page" microsite showcase carousel (LCI §Homepage item 7):
 * scroll-snap cards, each a mini page-preview built from a REAL listing's
 * data, linking to the real page. Swipe, arrows, and keyboard all work;
 * gentle auto-advance runs only when the user hasn't asked for reduced
 * motion, and pauses on hover, focus, or any manual interaction.
 */
export function ShowcaseCarousel({ items }: Props) {
  const reelRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const interactedUntil = useRef(0)

  function scrollByCard(direction: 1 | -1, smooth = true) {
    const reel = reelRef.current
    if (!reel) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const card = reel.querySelector<HTMLElement>('[data-showcase-card]')
    const step = card ? card.offsetWidth + 16 : reel.clientWidth * 0.6
    const atEnd = reel.scrollLeft + reel.clientWidth >= reel.scrollWidth - 8
    const atStart = reel.scrollLeft <= 8
    let left = reel.scrollLeft + direction * step
    if (direction === 1 && atEnd) left = 0
    if (direction === -1 && atStart) left = reel.scrollWidth
    reel.scrollTo({ left, behavior: reduceMotion || !smooth ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (!paused && Date.now() > interactedUntil.current) scrollByCard(1)
    }, ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [paused])

  if (items.length === 0) return null

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={reelRef}
        role="region"
        aria-label="Business page examples, horizontally scrollable"
        tabIndex={0}
        onPointerDown={() => {
          interactedUntil.current = Date.now() + 15000
        }}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {items.map((item, i) => (
          <Link
            key={item.id}
            href={item.href}
            aria-label={`${item.name}, page example ${i + 1} of ${items.length}`}
            data-showcase-card
            className="group shrink-0 w-[82%] sm:w-[46%] lg:w-[31%] snap-start rounded-xl border border-charcoal/10 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            <div className="relative aspect-[16/8] bg-deep-bg">
              {item.coverSrc ? (
                <Image
                  src={item.coverSrc}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 82vw, (max-width: 1024px) 46vw, 31vw"
                  className="object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{ background: EMBER_WASH }}
                />
              )}
              <span
                className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent"
                aria-hidden="true"
              />
              <span className="absolute left-3.5 bottom-2.5 font-headline text-[17px] text-white group-hover:text-light-gold transition-colors duration-150">
                {item.name}
              </span>
            </div>

            <div className="px-3.5 py-3">
              {item.offerings.length > 0 ? (
                <>
                  <p className="font-subhead text-[10px] font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
                    {item.categoryName ?? 'Offerings'}
                  </p>
                  <ul className="list-none m-0 p-0">
                    {item.offerings.map((offering) => (
                      <li
                        key={offering.name}
                        className="flex items-baseline justify-between gap-3 py-1.5 border-b border-charcoal/10 last:border-b-0"
                      >
                        <span className="font-subhead text-[13px] font-semibold text-brand-black truncate">
                          {offering.name}
                        </span>
                        {offering.price && (
                          <span className="font-subhead text-xs font-bold text-amber shrink-0">
                            {offering.price}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="font-body text-[13px] text-charcoal line-clamp-2">{item.tagline}</p>
              )}
              <p className="font-subhead text-xs font-bold text-brand-black mt-2 group-hover:text-amber transition-colors duration-150">
                View this page →
              </p>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 mt-1.5">
          {(
            [
              [-1, 'Previous page example', ArrowLeft],
              [1, 'Next page example', ArrowRight],
            ] as const
          ).map(([dir, label, Icon]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => {
                interactedUntil.current = Date.now() + 15000
                scrollByCard(dir)
              }}
              className={cn(
                'flex items-center justify-center size-11 rounded-full border-[1.5px] border-brand-black text-brand-black',
                'hover:bg-brand-black hover:text-white transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
