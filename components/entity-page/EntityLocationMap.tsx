'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Navigation } from 'lucide-react'
import type { LocationPin } from '@/lib/listings/locationPins'
import { cn } from '@/lib/utils'

/** SAND.ground from components/map/mapStyle — copied so this file pulls no basemap code. */
const SAND_GROUND = '#efe5d3'

/**
 * How far below the fold the map starts loading: about one phone screen, so
 * the chunk and the first tiles are in by the time the Visit block scrolls in.
 */
const NEAR_VIEWPORT = '600px 0px'

// MapLibre stays out of the page bundle (the same guardrail as the explore map)
// and is fetched only once the map nears the viewport (ticket 190), so a
// visitor who never scrolls to the Visit block never downloads it. The server
// renders the sand placeholder, which also holds the layout until then; the
// address and "Open in Maps" never depend on it.
const LocationMapCanvas = dynamic(
  () => import('@/components/entity-page/LocationMapCanvas').then((m) => m.LocationMapCanvas),
  { ssr: false, loading: () => <MapPlaceholder loading /> }
)

function MapPlaceholder({ loading = false }: { loading?: boolean }) {
  return (
    <div
      className="h-full w-full"
      style={{ backgroundColor: SAND_GROUND }}
      {...(loading ? { role: 'status', 'aria-label': 'Loading the map' } : { 'aria-hidden': true })}
    />
  )
}

/** True once the element has come within NEAR_VIEWPORT of the screen. Never goes back. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    // A browser with no IntersectionObserver keeps the sand block; the
    // address and "Open in Maps" beside it still work.
    if (!el || near || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: NEAR_VIEWPORT }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])
  return [ref, near] as const
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
 * Shown on live and example pages alike whenever a location has coordinates.
 */
export function EntityLocationMap({ pins, directionsHref, className }: Props) {
  const [mapRef, near] = useNearViewport<HTMLDivElement>()
  if (pins.length === 0) return null
  const label = pins.length === 1 ? 'Map of the location' : `Map of ${pins.length} locations`
  return (
    <div
      data-testid="location-map"
      role="group"
      aria-label={label}
      className={cn('relative overflow-hidden rounded-xl border border-charcoal/10', className)}
    >
      <div ref={mapRef} className="h-56 md:h-64">
        {near ? <LocationMapCanvas pins={pins} /> : <MapPlaceholder />}
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
