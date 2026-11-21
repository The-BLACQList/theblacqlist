import { useEffect, useRef, type RefObject } from 'react'
import type { Map as MlMap } from 'maplibre-gl'
import { followOffset } from '@/lib/map/followOffset'
import type { MapListing } from '@/lib/map/types'

interface Options {
  map: MlMap | null
  ready: boolean
  /** Phones only; on desktop the preview card sits beside the pin instead. */
  enabled: boolean
  listing: MapListing | null
  mark: 'tile' | 'dot'
  reduceMotion: boolean
  /** The map box; the bar and sheet are found inside it by data attribute. */
  boxRef: RefObject<HTMLElement | null>
  /**
   * A one-off minimum zoom for the next centring (a card tap zooms in to
   * street level). Read and cleared on each new selection.
   */
  minZoomRef: RefObject<number | null>
}

/**
 * Ticket 244, founder 2026-11-21: on a phone the selected pin moves to the
 * middle of the map the visitor can see (between the search bar and the card
 * sheet) and stays there while the sheet or screen changes size, until the
 * visitor drags, pinches or scrolls the map themselves.
 */
export function useFollowSelection({ map, ready, enabled, listing, mark, reduceMotion, boxRef, minZoomRef }: Options) {
  const following = useRef(false)
  const latest = useRef({ listing, mark })
  // Declared first, so it runs before the centring effect below.
  useEffect(() => {
    latest.current = { listing, mark }
  }, [listing, mark])
  const id = listing?.id ?? null

  // A visitor's own move ends following. Our easeTo has no originalEvent.
  useEffect(() => {
    if (!map || !ready) return
    const stop = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) following.current = false
    }
    map.on('movestart', stop)
    return () => {
      map.off('movestart', stop)
    }
  }, [map, ready])

  useEffect(() => {
    following.current = false
    if (!map || !ready || !enabled || !id) return
    const box = boxRef.current
    if (!box) return

    const centre = (animate: boolean) => {
      const current = latest.current.listing
      if (!following.current || !current) return
      const rect = box.getBoundingClientRect()
      const bar = box.querySelector('[data-map-phonebar]')?.getBoundingClientRect()
      const sheet = box.querySelector('[data-map-sheet]')?.getBoundingClientRect()
      const offset = followOffset(
        { mapTop: rect.top, mapBottom: rect.bottom, barBottom: bar?.bottom ?? null, sheetTop: sheet?.top ?? null },
        latest.current.mark
      )
      const minZoom = minZoomRef.current ?? 0
      minZoomRef.current = null
      const view = { center: [current.lng, current.lat] as [number, number], zoom: Math.max(map.getZoom(), minZoom), offset }
      // easeTo, not jumpTo, even when instant: only easeTo takes an offset.
      map.easeTo(animate && !reduceMotion ? view : { ...view, duration: 0 })
    }

    following.current = true
    centre(true)

    // The sheet grows when List opens and the screen turns: keep the pin in
    // the middle of what is left.
    if (typeof ResizeObserver === 'undefined') return
    let frame = 0
    let primed = false
    const observer = new ResizeObserver(() => {
      // The first report is just the current sizes; the pin is already moving.
      if (!primed) {
        primed = true
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => centre(false))
    })
    observer.observe(box)
    const sheet = box.querySelector('[data-map-sheet]')
    if (sheet) observer.observe(sheet)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      following.current = false
    }
  }, [map, ready, enabled, id, reduceMotion, boxRef, minZoomRef])
}
