'use client'

import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, SAND } from '@/components/map/mapStyle'
import { tileTemplate } from '@/lib/map/tileUrls'
import type { LocationPin } from '@/lib/listings/locationPins'

/** Zoom for one pin, and the deepest fitBounds goes for several: streets, not rooftops. */
const PIN_ZOOM = 14

function pinElement(pin: LocationPin): HTMLElement {
  const el = document.createElement('div')
  el.className = pin.primary
    ? 'size-5 rounded-full bg-brand-black ring-[3px] ring-gold shadow-md'
    : 'size-4 rounded-full bg-gold ring-2 ring-white shadow-md'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', pin.label)
  el.title = pin.label
  return el
}

/**
 * No WebGL (an old browser, a headless test). MapLibre would have owned the
 * container's children; this owns them instead, so no state changes inside
 * the effect. The address and "Open in Maps" beside the map still work.
 */
function showUnavailable(container: HTMLElement) {
  const el = document.createElement('div')
  el.className = 'h-full w-full flex items-center justify-center'
  el.style.backgroundColor = SAND.ground
  const text = document.createElement('p')
  text.className = 'font-subhead text-xs text-charcoal-soft'
  text.textContent = 'Map unavailable'
  el.append(text)
  container.replaceChildren(el)
}

/**
 * The MapLibre canvas behind EntityLocationMap. Loaded only in the browser,
 * only when the Visit block renders pins. Same basemap and self-hosted tiles
 * as the explore map; no listing layers, just a marker per location.
 */
export function LocationMapCanvas({ pins }: { pins: LocationPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Rebuild the map only when the pins change, not on every parent render.
  const key = pins.map((p) => `${p.id}:${p.lat}:${p.lng}`).join('|')

  useEffect(() => {
    const container = containerRef.current
    const first = pins[0]
    if (!container || !first) return

    const bounds = new maplibregl.LngLatBounds([first.lng, first.lat], [first.lng, first.lat])
    for (const p of pins) bounds.extend([p.lng, p.lat])

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container,
        style: buildMapStyle(
          tileTemplate(window.location.origin, 'metros'),
          tileTemplate(window.location.origin, 'us')
        ),
        ...(pins.length === 1
          ? { center: [first.lng, first.lat] as [number, number], zoom: PIN_ZOOM }
          : { bounds, fitBoundsOptions: { padding: 48, maxZoom: PIN_ZOOM } }),
        attributionControl: { compact: true },
        // Scrolling the page must never zoom the map: ctrl/⌘ + wheel, or two fingers.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      })
    } catch (err) {
      console.warn('[location-map] could not start:', err instanceof Error ? err.message : err)
      showUnavailable(container)
      return () => container.replaceChildren()
    }
    // Only the picture is hidden from assistive tech; each marker is labelled.
    map.getCanvas().setAttribute('aria-hidden', 'true')
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const markers = pins.map((p) =>
      new maplibregl.Marker({ element: pinElement(p) }).setLngLat([p.lng, p.lat]).addTo(map)
    )
    map.on('error', (e) => {
      console.warn('[location-map] style/tile error:', e?.error?.message ?? e)
    })
    return () => {
      for (const m of markers) m.remove()
      map.remove()
    }
    // `key` stands in for `pins`: same coordinates, same map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <div ref={containerRef} className="h-full w-full" />
}
