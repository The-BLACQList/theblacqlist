'use client'

import { useEffect, useRef, useState } from 'react'
import { MapResultsList } from '@/components/map/MapResultsList'
import type { MapResultsProps } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props extends MapResultsProps {
  reduceMotion: boolean
}

/**
 * Phone sheet: a snap-scrolling strip of photo cards under the map. "List"
 * lifts the sheet and stacks the cards so every business is reachable by scroll.
 */
export function MapBottomSheet(props: Props) {
  const { reduceMotion, selectedId, inViewCount, loadError, near } = props
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      aria-label="Businesses on the map"
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[24px] bg-off-white shadow-[0_-8px_28px_rgba(29,28,29,0.18)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <span aria-hidden="true" className="mb-2 block h-1 w-10 rounded-full bg-hairline" />
          <h2 className="font-headline text-[20px] font-medium text-ink" aria-live="polite">
            {loadError
              ? 'Businesses'
              : near
                ? `${inViewCount} within ${near.radiusMiles} mi`
                : `${inViewCount} in view`}
          </h2>
          {near && !loadError && (
            <p className="text-[12px] text-charcoal">Nearest first. Only businesses with a map pin show here.</p>
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
          expanded ? 'max-h-[62dvh] overflow-y-auto' : 'overflow-x-auto overflow-y-hidden'
        )}
      >
        <MapResultsList
          {...props}
          variant={expanded ? 'grid' : 'strip'}
          className={expanded ? '!grid-cols-1 sm:!grid-cols-2' : undefined}
        />
      </div>
    </section>
  )
}
