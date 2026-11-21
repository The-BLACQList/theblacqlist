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
  onHover: (id: string | null) => void
}

interface Entry {
  key: string
  marker: maplibregl.Marker
}

/**
 * Keeps one HTML marker per square, diffed by key so panning never flickers. A
 * square is rebuilt only when its selection or look changes. `pins` comes in
 * trust order and earlier squares stack on top, so where two overlap the
 * higher-trust page shows (the plan never decides it).
 */
export function usePinMarkers({ map, ready, pins, hoverId, onSelect, onHover }: Options) {
  const entries = useRef<Map<string, Entry>>(new Map())
  const select = useRef(onSelect)
  const hover = useRef(onHover)
  useEffect(() => {
    select.current = onSelect
    hover.current = onHover
  }, [onSelect, onHover])

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
      const element = buildPinElement(spec, {
        onSelect: (l) => select.current(l),
        onHover: (id) => hover.current(id),
      })
      const marker = new maplibregl.Marker({ element })
        .setLngLat([spec.listing.lng, spec.listing.lat])
        .addTo(map)
      live.set(spec.listing.id, { key: pinKey(spec), marker })
    }
    pins.forEach((spec, i) => {
      const element = live.get(spec.listing.id)?.marker.getElement()
      if (element) element.style.zIndex = String(spec.selected ? pins.length + 1 : pins.length - i)
    })
  }, [map, ready, pins])

  // Hover on a card lights its square with an ink halo.
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
