'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ALL_CITIES, buildMapStyle, CITY_VIEWS, initialCity, US_BOUNDS } from '@/components/map/mapStyle'
import { tileTemplate } from '@/lib/map/tileUrls'
import {
  addLandmarkLayers,
  addListingLayers,
  DOT_LAYERS,
  readLooseIds,
  setSquareIds,
} from '@/components/map/mapLayers'
import { toLandmarkGeoJSON } from '@/lib/map/landmarks'
import { MapDrawer } from '@/components/map/MapDrawer'
import { MapPhoneBar } from '@/components/map/MapPhoneBar'
import { MapControls } from '@/components/map/MapControls'
import { MapLegend, type LegendMarks } from '@/components/map/MapLegend'
import type { PinSpec } from '@/components/map/photoPin'
import { useIsDesktop } from '@/components/map/useIsDesktop'
import { useMapListings } from '@/components/map/useMapListings'
import { usePinMarkers } from '@/components/map/usePinMarkers'
import { useSelectionPopup } from '@/components/map/useSelectionPopup'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import { radiusBounds } from '@/lib/map/distance'
import { NO_FILTERS, filterListings, sortByDistance } from '@/lib/map/filterListings'
import { pickTiles, rankListings } from '@/lib/map/rankListings'
import type { MapFilters, MapListing, MapPlace, NearMe } from '@/lib/map/types'
import { phonePadding } from '@/components/map/phonePadding'
import { useFollowSelection } from '@/components/map/useFollowSelection'
import { useNearMeOverlay } from '@/components/map/useNearMeOverlay'

export type { MapListing }

const TYPE_LABELS: Record<string, string> = {
  business: 'Businesses',
  restaurant: 'Restaurants',
  service_provider: 'Services',
  vendor: 'Vendors',
  professional: 'Professionals',
  creative: 'Creatives',
  event: 'Events',
  job: 'Jobs',
  creator: 'Creators',
}

/**
 * The map explorer. Desktop: a docked panel beside the map. Phone: the map
 * fills the screen under a floating search bar, with a bottom sheet of cards.
 *
 * Calm Map rules (ticket 244, founder's pick 2026-11-21), the same at every
 * zoom: a business is drawn once, as one mark, and each shape means one thing.
 * - Groups: circles with a count, the only number on the map. At country
 *   view the groups carry the whole map (founder 2026-11-21: no city plates).
 * - A square for each claimed page standing on its own (logo on Starter and up,
 *   plain ink on Free; picked trusted-first, never by plan), a dot for the rest.
 * - No rank numbers; a card and its square or dot light up together on hover.
 * The panel and sheet lists are the parallel accessible path to every business.
 */
/**
 * Room around the lower 48, so the Gulf cities sit above the phone's sheet. On a
 * phone it is measured: the bar and the sheet change with the window (ticket 285).
 */
function usPadding(box: HTMLElement | null) {
  return window.matchMedia('(min-width: 1024px)').matches ? 40 : phonePadding(box)
}

function readCityParam(): string {
  return initialCity(new URLSearchParams(window.location.search).get('city'))
}

/** Keeps `?city=` in step with the choice, so the view can be shared. */
function writeCityParam(slug: string) {
  const url = new URL(window.location.href)
  if (slug === ALL_CITIES) url.searchParams.delete('city')
  else url.searchParams.set('city', slug)
  window.history.replaceState(window.history.state, '', url)
}

export function MapExplore() {
  const containerRef = useRef<HTMLDivElement>(null)
  /** The map box with the phone bar and sheet over it (useFollowSelection). */
  const mapBoxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [tilesStalled, setTilesStalled] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [viewNonce, setViewNonce] = useState(0)
  const { listings, loading, loadError } = useMapListings()
  const isDesktop = useIsDesktop()

  // The map opens on the whole country unless a link names one city.
  const [citySlug, setCitySlug] = useState(readCityParam)
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS)
  // Hover only rings a pin; selection is what opens the card. Kept separate so a
  // second pin click moves the card instead of closing the one it just opened.
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // What the map drew at its last idle: businesses standing on their own (not
  // in a group), and which marks are on screen, for the squares and legend.
  const [drawn, setDrawn] = useState<{ zoom: number; loose: Set<string>; groups: boolean; landmarks: boolean }>(
    () => ({ zoom: 0, loose: new Set(), groups: false, landmarks: false })
  )
  // The place the search words name, after Enter (ticket 142). Each lookup gets
  // a number, so a slow answer for old words never shows under new ones.
  const [placeHit, setPlaceHit] = useState<MapPlace | null>(null)
  const placeRequest = useRef(0)

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of listings) if (l.categorySlug && l.category) seen.set(l.categorySlug, l.category)
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [listings])
  const entityTypes = useMemo(
    () =>
      [...new Set(listings.map((l) => l.entityType))]
        .filter((t) => TYPE_LABELS[t])
        .sort()
        .map((value) => ({ value, label: TYPE_LABELS[value]! })),
    [listings]
  )
  // The panel line reads "N Black-owned businesses", so Ally listings stay on
  // the map but are not counted in it.
  const cityTotal = useMemo(
    () =>
      listings.filter((l) => l.ownershipLabel !== 'ally' && (citySlug === ALL_CITIES || l.citySlug === citySlug))
        .length,
    [listings, citySlug]
  )

  const filtered = useMemo(() => filterListings(listings, filters), [listings, filters])
  // moveend and zoomend bump viewNonce, which re-reads the viewport bounds.
  const visible = useMemo(() => {
    // No bounds yet. Once the imagery has stalled the notice says the list is live,
    // so it lists the chosen city instead.
    if (!mapReady || !map) {
      if (!tilesStalled) return []
      return citySlug === ALL_CITIES ? filtered : filtered.filter((l) => l.citySlug === citySlug)
    }
    const bounds = map.getBounds()
    return filtered.filter((l) => bounds.contains([l.lng, l.lat]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, map, mapReady, tilesStalled, citySlug, viewNonce])
  // The list is capped (LIST_LIMIT); the count above it is not, so the whole
  // country reads as every business, not the first 60.
  const inView = useMemo(
    // Near me answers "what is closest", so distance wins over trust order.
    () => (filters.near ? sortByDistance(visible, filters.near) : rankListings(visible)),
    [visible, filters.near]
  )

  // Squares are picked trusted-first from everything in view (not the capped,
  // maybe distance-sorted list), plus the selected page wherever it is.
  const tiles = useMemo(() => {
    const ranked = rankListings(visible, Infinity)
    const chosen = filtered.find((l) => l.id === selectedId)
    if (chosen && !ranked.some((l) => l.id === chosen.id)) ranked.push(chosen)
    return pickTiles(ranked, drawn.loose, selectedId)
  }, [visible, filtered, selectedId, drawn.loose])

  const pins = useMemo<PinSpec[]>(
    () =>
      tiles.map((listing) => {
        const selected = listing.id === selectedId
        return { listing, selected, named: selected && !isDesktop }
      }),
    [tiles, selectedId, isDesktop]
  )
  const squareKey = useMemo(() => tiles.map((l) => l.id).sort().join(','), [tiles])

  // Every listing stays in the source so a group counts everyone in it; the
  // dots of squares are hidden by filter (setSquareIds).
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: filtered.map((l) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
        properties: { id: l.id },
      })),
    }),
    [filtered]
  )

  const legend: LegendMarks = {
    squares: tiles.length > 0,
    // A dot shows only for a business standing on its own that is not a square.
    dots: visible.some((l) => drawn.loose.has(l.id) && !tiles.includes(l)),
    groups: drawn.groups,
    landmarks: drawn.landmarks,
  }

  // A card tap zooms in to street level. On a phone useFollowSelection makes
  // that move, so the pin lands in the middle of the strip above the sheet.
  const followZoom = useRef<number | null>(null)
  const focusListing = useCallback(
    (listing: MapListing) => {
      setSelectedId(listing.id)
      const m = mapRef.current
      if (!m) return
      if (!isDesktop) {
        followZoom.current = 13
        return
      }
      const view = { center: [listing.lng, listing.lat] as [number, number], zoom: Math.max(m.getZoom(), 13) }
      if (reduceMotion) m.jumpTo(view)
      else m.easeTo(view)
    },
    [reduceMotion, isDesktop]
  )

  usePinMarkers({ map, ready: mapReady, pins, hoverId, onSelect: (l) => setSelectedId(l.id), onHover: setHoverId })
  useNearMeOverlay({ map, ready: mapReady, near: filters.near })
  const selectedListing = useMemo(() => filtered.find((l) => l.id === selectedId) ?? null, [filtered, selectedId])
  const selectedMark = tiles.some((l) => l.id === selectedId) ? 'tile' : 'dot'
  useSelectionPopup({
    map,
    listing: selectedListing,
    mark: selectedMark,
    enabled: isDesktop,
    onClose: () => setSelectedId(null),
  })
  useFollowSelection({
    map,
    ready: mapReady,
    enabled: !isDesktop,
    listing: selectedListing,
    mark: selectedMark,
    reduceMotion,
    boxRef: mapBoxRef,
    minZoomRef: followZoom,
  })

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const opening = CITY_VIEWS[citySlug]
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(
        tileTemplate(window.location.origin, 'metros'),
        tileTemplate(window.location.origin, 'us')
      ),
      ...(opening
        ? { center: opening.center, zoom: opening.zoom }
        : { bounds: US_BOUNDS, fitBoundsOptions: { padding: usPadding(mapBoxRef.current) } }),
      attributionControl: { compact: true },
    })
    mapRef.current = m
    // Only the picture is hidden from assistive tech. The pins and controls that
    // live in the same container are labeled and reachable.
    m.getCanvas().setAttribute('aria-hidden', 'true')
    const stallTimer = window.setTimeout(() => {
      if (!m.loaded()) setTilesStalled(true)
    }, 10000)

    m.on('load', () => {
      addLandmarkLayers(m, toLandmarkGeoJSON())
      addListingLayers(m)
      m.on('click', 'clusters', (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const source = m.getSource('listings') as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(feature.properties!.cluster_id as number).then((zoom: number) => {
          const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates
          if (reduceMotion) m.jumpTo({ center: [lng, lat], zoom })
          else m.easeTo({ center: [lng, lat], zoom })
        })
      })
      m.on('click', 'dots', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) setSelectedId(id)
      })
      // closeOnClick is off so a pin-to-pin click can't tear down the card it
      // just opened. Clicking bare map still dismisses.
      m.on('click', (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: [...DOT_LAYERS] }).length === 0) setSelectedId(null)
      })
      for (const layer of DOT_LAYERS) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''))
      }
      // A business under the pointer lights its card.
      m.on('mousemove', 'dots', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        setHoverId(id ?? null)
      })
      m.on('mouseleave', 'dots', () => setHoverId(null))
      m.on('moveend', () => setViewNonce((n) => n + 1))
      m.on('idle', () => {
        const { loose, groups } = readLooseIds(m)
        const landmarks = m.queryRenderedFeatures({ layers: ['landmarks'] }).length > 0
        const zoom = m.getZoom()
        setDrawn((prev) =>
          prev.zoom === zoom &&
          prev.groups === groups &&
          prev.landmarks === landmarks &&
          prev.loose.size === loose.size &&
          [...loose].every((id) => prev.loose.has(id))
            ? prev
            : { zoom, loose, groups, landmarks }
        )
      })
      setMap(m)
      setMapReady(true)
      setTilesStalled(false)
    })
    m.on('error', (e) => {
      // Surface, never swallow: the list stays the reliable path.
      console.warn('[map] style/tile error:', e?.error?.message ?? e)
    })

    return () => {
      window.clearTimeout(stallTimer)
      m.remove()
      mapRef.current = null
      setMap(null)
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map || !mapReady) return
    ;(map.getSource('listings') as maplibregl.GeoJSONSource | undefined)?.setData(geojson)
  }, [map, mapReady, geojson])

  useEffect(() => {
    if (!map || !mapReady) return
    setSquareIds(map, squareKey ? squareKey.split(',') : [])
  }, [map, mapReady, squareKey])

  // A selected or hovered business that is a dot shows it on the dot itself.
  useDotState(map, mapReady, 'selected', selectedId)
  useDotState(map, mapReady, 'hover', hoverId)

  function moveTo(center: [number, number], zoom: number) {
    const m = mapRef.current
    if (!m) return
    if (reduceMotion) m.jumpTo({ center, zoom })
    else m.flyTo({ center, zoom, duration: 1400 })
  }

  function flyToCity(slug: string) {
    setCitySlug(slug)
    writeCityParam(slug)
    const view = CITY_VIEWS[slug]
    if (view) moveTo(view.center, view.zoom)
    else mapRef.current?.fitBounds(US_BOUNDS, { padding: usPadding(mapBoxRef.current), duration: reduceMotion ? 0 : 1400 })
  }

  /** Frames the whole radius, leaving room for the phone bar and sheet. */
  function fitNear(near: NearMe) {
    const m = mapRef.current
    if (!m) return
    const padding = isDesktop ? 40 : phonePadding(mapBoxRef.current)
    m.fitBounds(radiusBounds(near, near.radiusMiles), { padding, duration: reduceMotion ? 0 : 1200 })
  }

  // The position stays in this component's state. It is never logged, sent,
  // or written to the URL.
  function findNearMe() {
    if (!navigator.geolocation) {
      setNotice('Your browser can’t share its location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setNotice(null)
        const near = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusMiles: filters.near?.radiusMiles ?? DEFAULT_RADIUS_MILES,
        }
        setFilters((f) => ({ ...f, near }))
        fitNear(near)
      },
      () => {
        setLocating(false)
        setNotice('We couldn’t get your location. Check that location access is allowed for this site.')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  function setRadius(radiusMiles: number) {
    if (!filters.near) return
    const near = { ...filters.near, radiusMiles }
    setFilters((f) => ({ ...f, near }))
    fitNear(near)
  }

  /** Enter in the search box: do the words name a place? A miss shows nothing. */
  async function searchPlace() {
    const q = filters.query.trim()
    const request = ++placeRequest.current
    setPlaceHit(null)
    if (q.length < 2 || q.length > 100) return
    try {
      const res = await fetch(`/api/places/lookup?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const body = (await res.json()) as { data: MapPlace | null }
      if (request === placeRequest.current) setPlaceHit(body.data ?? null)
    } catch {
      // A place miss never gets in the way of the pin filter.
    }
  }

  /**
   * Moves to the place and clears the words, so the pins there show. Near me
   * goes off too, or its radius would hide them, and no city tab claims the view.
   */
  function goToPlace() {
    if (!placeHit) return
    placeRequest.current++
    moveTo([placeHit.lng, placeHit.lat], placeHit.zoom)
    setPlaceHit(null)
    setFilters((f) => ({ ...f, query: '', near: null }))
    setCitySlug(ALL_CITIES)
    writeCityParam(ALL_CITIES)
  }

  const filterProps = {
    filters,
    onFilters: (patch: Partial<MapFilters>) => {
      if (patch.query !== undefined) {
        placeRequest.current++
        setPlaceHit(null)
      }
      setFilters((f) => ({ ...f, ...patch }))
    },
    categories,
    entityTypes,
    citySlug,
    onCity: flyToCity,
    onNearMe: findNearMe,
    onRadius: setRadius,
    locating,
    placeHit,
    onPlaceSearch: searchPlace,
    onGoToPlace: goToPlace,
  }
  const drawerProps = {
    ...filterProps,
    isDesktop,
    cityTotal,
    reduceMotion,
    listings: inView,
    hoverId,
    inViewCount: visible.length,
    // Nothing is in view until the map can say what its bounds are. Without this the
    // list says "No businesses" for a moment, and the phone sheet jumps (ticket 272).
    loading: !loadError && (loading || (!mapReady && !tilesStalled)),
    loadError,
    selectedId,
    onHover: setHoverId,
    onSelect: focusListing,
    near: filters.near,
  }
  const message = notice ?? (tilesStalled ? 'Map imagery is taking a while. The list is live.' : null)

  return (
    <div className="relative flex h-[calc(100dvh_-_3.5rem)] overflow-hidden md:h-[calc(100dvh_-_4rem)]">
      <MapDrawer {...drawerProps} slot="side" />
      {/* The Tester Tour's map step rings this (lib/tour/targets.ts). */}
      <div ref={mapBoxRef} data-tour="map" className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {isDesktop ? (
          <>
            <MapLegend marks={legend} />
            <MapControls
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onLocate={findNearMe}
            />
          </>
        ) : (
          <MapPhoneBar {...filterProps} onLocate={findNearMe} />
        )}
        {message && (
          <p
            role="status"
            className="absolute right-4 top-4 z-30 max-w-[280px] rounded-xl bg-ground px-3.5 py-2.5 text-xs text-white shadow-lg max-lg:top-auto max-lg:bottom-[calc(var(--map-sheet-h,22rem)+0.75rem)] max-lg:left-4"
          >
            {message}
          </p>
        )}
        <MapDrawer {...drawerProps} slot="overlay" />
      </div>
    </div>
  )
}

/** Sets one feature-state flag on one listing's dot, clearing the last one. */
function useDotState(map: MlMap | null, ready: boolean, flag: 'selected' | 'hover', id: string | null) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!map || !ready || !map.getSource('listings')) return
    if (last.current && last.current !== id) {
      map.setFeatureState({ source: 'listings', id: last.current }, { [flag]: false })
    }
    if (id) map.setFeatureState({ source: 'listings', id }, { [flag]: true })
    last.current = id
  }, [map, ready, flag, id])
}
