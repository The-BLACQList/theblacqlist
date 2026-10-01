import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import { buildPinElement, pinKey, type PinSpec } from '@/components/map/photoPin'
import type { MapListing } from '@/lib/map/types'

interface Options {
  map: MlMap | null
  ready: boolean
  pins: PinSpec[]
  hoverId: string | null
  onSelect: (listing: MapListing) => void
}

interface Entry {
  key: string
  marker: maplibregl.Marker
}

/**
 * Keeps one HTML marker per numbered pin, diffed by key so panning never
 * flickers. A pin is rebuilt only when its number or selection changes.
 */
export function usePinMarkers({ map, ready, pins, hoverId, onSelect }: Options) {
  const entries = useRef<Map<string, Entry>>(new Map())
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!map || !ready) return
    const live = entries.current
    const wanted = new Map(pins.map((p) => [p.listing.id, p]))

    for (const [id, entry] of live) {
      const spec = wanted.get(id)
      if (!spec || pinKey(spec) !== entry.key) {
        entry.marker.remove()
        live.delete(id)
      }
    }
    for (const spec of pins) {
      if (live.has(spec.listing.id)) continue
      const element = buildPinElement(spec, (l) => select.current(l))
      const marker = new maplibregl.Marker({ element })
        .setLngLat([spec.listing.lng, spec.listing.lat])
        .addTo(map)
      live.set(spec.listing.id, { key: pinKey(spec), marker })
    }
  }, [map, ready, pins])

  // Hover from a card lights the pin with a gold ring.
  useEffect(() => {
    for (const [id, entry] of entries.current) {
      entry.marker.getElement().classList.toggle('blacq-pin-hover', id === hoverId)
    }
  }, [hoverId, pins])

  useEffect(() => {
    const live = entries.current
    return () => {
      for (const entry of live.values()) entry.marker.remove()
      live.clear()
    }
  }, [])
}
