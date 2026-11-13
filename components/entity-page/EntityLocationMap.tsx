'use client'

import dynamic from 'next/dynamic'
import { Navigation } from 'lucide-react'
import type { LocationPin } from '@/lib/listings/locationPins'
import { cn } from '@/lib/utils'

/** SAND.ground from components/map/mapStyle — copied so this file pulls no basemap code. */
const SAND_GROUND = '#efe5d3'

// MapLibre stays out of the page bundle (the same guardrail as the explore map).
// The server renders the sand placeholder, which also holds the layout while
// the chunk streams in; the address and "Open in Maps" never depend on it.
const LocationMapCanvas = dynamic(
  () => import('@/components/entity-page/LocationMapCanvas').then((m) => m.LocationMapCanvas),
  { ssr: false, loading: () => <MapPlaceholder /> }
)

function MapPlaceholder() {
  return (
    <div
      className="h-full w-full"
      style={{ backgroundColor: SAND_GROUND }}
      role="status"
      aria-label="Loading the map"
    />
  )
}

interface Props {
  pins: LocationPin[]
  /** The Google Maps directions link from lib/listings/directions. */
  directionsHref: string | null
  className?: string
}

/**
 * The mini map in the Visit block (ticket 190): every location pinned, framed
 * together, with the directions link on top so there is always a way out.
 */
export function EntityLocationMap({ pins, directionsHref, className }: Props) {
  if (pins.length === 0) return null
  const label = pins.length === 1 ? 'Map of the location' : `Map of ${pins.length} locations`
  return (
    <div
      data-testid="location-map"
      role="group"
      aria-label={label}
      className={cn('relative overflow-hidden rounded-xl border border-charcoal/10', className)}
    >
      <div className="h-56 md:h-64">
        <LocationMapCanvas pins={pins} />
      </div>
      {directionsHref && (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/95 border border-charcoal/10 shadow-sm font-subhead text-xs font-bold text-brand-black hover:border-gold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <Navigation className="size-3.5 text-amber" aria-hidden="true" />
          Open in Maps
        </a>
      )}
    </div>
  )
}
