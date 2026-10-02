import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import { radiusRing } from '@/lib/map/distance'
import type { NearMe } from '@/lib/map/types'

const RING_SOURCE = 'near-ring'
const RING_LAYER = 'near-ring-line'
const AMBER = '#8f6600'

interface Options {
  map: MlMap | null
  ready: boolean
  near: NearMe | null
}

function ringData(near: NearMe | null) {
  return {
    type: 'FeatureCollection' as const,
    features: near
      ? [
          {
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: radiusRing(near, near.radiusMiles) },
            properties: {},
          },
        ]
      : [],
  }
}

/** A gold-ringed dot for the visitor. Labeled, but not a tab stop: it does nothing. */
function buildYouAreHere(): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', 'Your location')
  el.style.cssText =
    'width:18px;height:18px;border-radius:9999px;background:#1d1c1d;border:3px solid #c4a065;box-shadow:0 0 0 4px rgba(196,160,101,0.28),0 2px 6px rgba(29,28,29,0.35);pointer-events:none;'
  return el
}

/**
 * While Near me is on: a "you are here" marker and a dashed outline of the
 * radius, drawn under the listing dots so it never hides a business.
 */
export function useNearMeOverlay({ map, ready, near }: Options) {
  const marker = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!map || !ready) return
    if (!map.getSource(RING_SOURCE)) {
      map.addSource(RING_SOURCE, { type: 'geojson', data: ringData(null) })
      map.addLayer(
        {
          id: RING_LAYER,
          type: 'line',
          source: RING_SOURCE,
          paint: { 'line-color': AMBER, 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
        },
        map.getLayer('clusters') ? 'clusters' : undefined
      )
    }
    ;(map.getSource(RING_SOURCE) as GeoJSONSource).setData(ringData(near))

    if (!near) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ element: buildYouAreHere() })
    }
    marker.current.setLngLat([near.lng, near.lat]).addTo(map)
  }, [map, ready, near])

  useEffect(
    () => () => {
      marker.current?.remove()
      marker.current = null
    },
    []
  )
}
