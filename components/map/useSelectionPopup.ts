import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import { buildPopupContent } from '@/components/map/popupContent'
import { popupAnchor, popupOffset } from '@/lib/map/popupOffset'
import type { MapListing } from '@/lib/map/types'

interface Options {
  map: MlMap | null
  listing: MapListing | null
  /** Phones show the selection in the sheet instead of a card on the map. */
  enabled: boolean
  onClose: () => void
}

/** The preview card beside the selected pin (desktop). */
export function useSelectionPopup({ map, listing, enabled, onClose }: Options) {
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!map) return
    // Null the ref *before* removing: Popup.remove() fires 'close' synchronously,
    // and the guarded handler below must see a cleared ref or it would clear the
    // selection out from under the effect that is opening the next card.
    const previous = popupRef.current
    popupRef.current = null
    previous?.remove()
    if (!enabled || !listing) return

    const point = map.project([listing.lng, listing.lat])
    const { clientWidth, clientHeight } = map.getContainer()
    const popup = new maplibregl.Popup({
      anchor: popupAnchor(point.x, point.y, clientWidth, clientHeight),
      offset: popupOffset(),
      closeButton: true,
      closeOnClick: false,
      maxWidth: 'none',
      className: 'blacq-map-popup-wrap',
    })
      .setLngLat([listing.lng, listing.lat])
      .setDOMContent(buildPopupContent(listing))
      .addTo(map)
    popupRef.current = popup
    // Guarded: only a genuine user close (the x or a bare-map click) deselects.
    popup.on('close', () => {
      if (popupRef.current === popup) close.current()
    })
  }, [map, listing, enabled])

  useEffect(() => {
    return () => {
      const popup = popupRef.current
      popupRef.current = null
      popup?.remove()
    }
  }, [])
}
