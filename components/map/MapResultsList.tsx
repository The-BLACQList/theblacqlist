'use client'

import Link from 'next/link'
import { widerRadius } from '@/lib/listings/location-params'
import { distanceMiles } from '@/lib/map/distance'
import { MapListingCard } from '@/components/map/MapListingCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { MapResultsProps } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props extends MapResultsProps {
  variant: 'grid' | 'strip'
  className?: string
}

/**
 * The four states of the result list in one place: loading skeletons, a load
 * failure with a way out, an empty view, and the cards. Used by the desktop
 * panel (grid) and the phone sheet (strip).
 */
export function MapResultsList({
  listings,
  numbers,
  loading,
  loadError,
  selectedId,
  onHover,
  onSelect,
  near,
  onRadius,
  variant,
  className,
}: Props) {
  const wider = near ? widerRadius(near.radiusMiles) : null
  const message = loadError ? (
    <div className="p-4 text-center">
      <p className="text-sm text-charcoal">Couldn&apos;t load the map listings.</p>
      <Link
        href="/discover"
        className="inline-flex min-h-11 items-center text-sm font-bold text-amber underline underline-offset-2"
      >
        Browse on Discover instead
      </Link>
    </div>
  ) : listings.length === 0 && !loading && near ? (
    <div className="p-4 text-center">
      <p className="text-sm text-charcoal">Nothing within {near.radiusMiles} miles in this view.</p>
      {wider && (
        <button
          type="button"
          onClick={() => onRadius(wider)}
          className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-amber underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          Show {wider} miles
        </button>
      )}
    </div>
  ) : listings.length === 0 && !loading ? (
    <p className="p-4 text-center text-sm text-charcoal">
      No businesses in this view. Zoom out, clear a filter, or switch city.
    </p>
  ) : null

  if (message) return <div className={className}>{message}</div>

  return (
    <ul
      aria-label="Businesses in view"
      aria-busy={loading}
      className={cn(
        'm-0 list-none p-0',
        variant === 'grid' ? 'grid grid-cols-2 gap-3' : 'flex snap-x snap-mandatory gap-3 overflow-x-auto',
        className
      )}
    >
      {loading
        ? Array.from({ length: variant === 'grid' ? 6 : 3 }).map((_, i) => (
            <li key={i} className={variant === 'strip' ? 'w-[250px] shrink-0' : undefined}>
              <Skeleton className="aspect-[4/3] w-full rounded-[14px]" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </li>
          ))
        : listings.map((listing) => (
            <li key={listing.id} className={variant === 'strip' ? 'shrink-0' : undefined}>
              <MapListingCard
                listing={listing}
                number={numbers.get(listing.id) ?? null}
                selected={listing.id === selectedId}
                variant={variant}
                distance={near ? distanceMiles(near, listing) : null}
                onSelect={onSelect}
                onHover={onHover}
              />
            </li>
          ))}
    </ul>
  )
}
