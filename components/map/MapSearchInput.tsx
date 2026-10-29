'use client'

import { MapPin, Search } from 'lucide-react'
import type { MapPlace } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  id: string
  className?: string
  /** Enter: asks whether the words name a place (ticket 142). */
  onEnter?: () => void
  /** The place the words name, shown as a "Go to" row under the box. */
  placeHit?: MapPlace | null
  onGoToPlace?: () => void
}

/**
 * Searches the loaded businesses by name or category. Filters as you type.
 * Enter also asks whether the words name a place, and offers a row that moves
 * the map there. A miss shows nothing: the words may be a business name, and
 * the pin filter already answered that.
 */
export function MapSearchInput({
  value,
  onChange,
  id,
  className,
  onEnter,
  placeHit,
  onGoToPlace,
}: Props) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <label htmlFor={id} className="sr-only">
        Search businesses or places on the map
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-charcoal"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Search businesses"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !onEnter) return
          e.preventDefault()
          onEnter()
        }}
        className="min-h-11 w-full rounded-xl border border-hairline bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-charcoal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      />
      <div aria-live="polite" className="absolute inset-x-0 top-full z-30 mt-1">
        {placeHit && onGoToPlace ? (
          <button
            type="button"
            onClick={onGoToPlace}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-hairline bg-white px-3.5 text-left text-[15px] font-semibold text-ink shadow-[0_6px_20px_rgba(29,28,29,0.2)] hover:bg-off-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            <MapPin className="size-4 shrink-0 text-amber" aria-hidden="true" />
            <span className="min-w-0 truncate">Go to {placeHit.label}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
