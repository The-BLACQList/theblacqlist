'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MapResultsList } from '@/components/map/MapResultsList'
import type { MapResultsProps } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props extends MapResultsProps {
  reduceMotion: boolean
}

/**
 * Phone sheet: a snap-scrolling strip of photo cards under the map. "List"
 * lifts the sheet and stacks the cards so every business is reachable by scroll.
 * The shorter the window, the less of it the closed sheet takes (ticket 285): row
 * cards, then one line with the count, or the chosen business, beside List.
 */
export function MapBottomSheet(props: Props) {
  const { reduceMotion, selectedId, inViewCount, loading, loadError, near, listings } = props
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const chosen = listings.find((l) => l.id === selectedId) ?? null

  // Floating buttons (the site assistant's Ask) ride just above the sheet, so
  // they never cover a card. The sheet's height goes in a CSS variable.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const set = () => root.style.setProperty('--map-sheet-h', `${Math.round(sheet.getBoundingClientRect().height)}px`)
    set()
    const observer = new ResizeObserver(set)
    observer.observe(sheet)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--map-sheet-h')
    }
  }, [])

  // A pin tap selects a card that may be off-screen in the strip: bring it in.
  useEffect(() => {
    if (!selectedId) return
    const card = scrollRef.current?.querySelector(`[data-listing-id="${CSS.escape(selectedId)}"]`)
    card?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [selectedId, reduceMotion])

  return (
    <section
      ref={sheetRef}
      data-map-sheet={expanded ? 'open' : ''}
      aria-label="Businesses on the map"
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[calc(100%-5rem)] flex-col rounded-t-[24px] bg-off-white shadow-[0_-8px_28px_rgba(29,28,29,0.18)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3 map-tiny:py-1.5">
        <div className="min-w-0">
          <span aria-hidden="true" className="mb-2 block h-1 w-10 rounded-full bg-hairline map-tiny:hidden" />
          <h2
            className={cn(
              'font-headline text-[20px] font-medium text-ink map-tiny:leading-tight',
              chosen && !expanded && 'map-tiny:sr-only'
            )}
            aria-live="polite"
          >
            {loadError || loading
              ? 'Businesses'
              : near
                ? `${inViewCount} within ${near.radiusMiles} mi`
                : `${inViewCount} in view`}
          </h2>
          {near && !loadError && (
            <p className="text-[12px] text-charcoal map-tiny:hidden">Nearest first. Only businesses with a map pin show here.</p>
          )}
          {/* One line has no room for the chosen card, so its name leads to the Page. */}
          {chosen && !expanded && (
            <Link
              href={chosen.href}
              className="hidden min-h-11 min-w-0 flex-col justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-amber map-tiny:flex"
            >
              <span className="truncate font-headline text-[16px] leading-tight text-ink">{chosen.name}</span>
              <span className="truncate text-[13px] font-semibold text-amber">View Page</span>
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="min-h-11 shrink-0 rounded-xl border border-ink/80 bg-white px-5 text-[14px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {expanded ? 'Map' : 'List'}
        </button>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          'px-4 pb-4',
          expanded
            ? 'max-h-[62dvh] min-h-0 overflow-y-auto map-tiny:max-h-none'
            : 'overflow-x-auto overflow-y-hidden map-tiny:hidden'
        )}
      >
        <MapResultsList
          {...props}
          variant={expanded ? 'grid' : 'strip'}
          className={expanded ? '!grid-cols-1 sm:!grid-cols-2 map-tiny:sm:!grid-cols-3' : undefined}
        />
      </div>
    </section>
  )
}
