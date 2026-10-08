'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapLayerMouseEvent } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CITY_VIEWS } from '@/components/map/mapStyle'
import { addLandmarkLayers, addListingLayers, DOT_LAYERS } from '@/components/map/mapLayers'
import { toLandmarkGeoJSON } from '@/lib/map/landmarks'
import { MapDrawer } from '@/components/map/MapDrawer'
import { MapPhoneBar } from '@/components/map/MapPhoneBar'
import { MapControls } from '@/components/map/MapControls'
import { MapLegend } from '@/components/map/MapLegend'
import type { PinSpec } from '@/components/map/photoPin'
import { useIsDesktop } from '@/components/map/useIsDesktop'
import { useMapListings } from '@/components/map/useMapListings'
import { usePinMarkers } from '@/components/map/usePinMarkers'
import { useSelectionPopup } from '@/components/map/useSelectionPopup'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import { radiusBounds } from '@/lib/map/distance'
import { NO_FILTERS, filterListings, sortByDistance } from '@/lib/map/filterListings'
import { PIN_LIMIT, pinNumbers, rankListings } from '@/lib/map/rankListings'
import type { MapFilters, MapListing, NearMe } from '@/lib/map/types'
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
 * "Photo Pins" explorer. Desktop: a docked panel beside the map. Phone: the map
 * fills the screen under a floating search bar, with a bottom sheet of cards.
 * The top picks in view (ranked trusted-first, the same order as the list) are
 * numbered photo pins; every other listing is a small dot or part of a cluster.
 * The panel and sheet lists are the parallel accessible path to every business.
 */
export function MapExplore({ tilesUrl }: { tilesUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [tilesStalled, setTilesStalled] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [viewNonce, setViewNonce] = useState(0)
  const { listings, loading, loadError } = useMapListings()
  const isDesktop = useIsDesktop()

  const [citySlug, setCitySlug] = useState('atlanta-ga')
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS)
  // Hover only rings a pin; selection is what opens the card. Kept separate so a
  // second pin click moves the card instead of closing the one it just opened.
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
  const cityTotal = useMemo(() => listings.filter((l) => l.citySlug === citySlug).length, [listings, citySlug])

  const filtered = useMemo(() => filterListings(listings, filters), [listings, filters])
  // moveend and zoomend bump viewNonce, which re-reads the viewport bounds.
  const inView = useMemo(() => {
    if (!mapReady || !map) return []
    const bounds = map.getBounds()
    const visible = filtered.filter((l) => bounds.contains([l.lng, l.lat]))
    // Near me answers "what is closest", so distance wins over trust order.
    return filters.near ? sortByDistance(visible, filters.near) : rankListings(visible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, filters.near, map, mapReady, viewNonce])
  const numbers = useMemo(() => pinNumbers(inView, PIN_LIMIT), [inView])

  const pins = useMemo<PinSpec[]>(() => {
    const specs: PinSpec[] = inView
      .filter((l) => numbers.has(l.id))
      .map((listing) => ({ listing, number: numbers.get(listing.id)!, selected: listing.id === selectedId }))
    const extra = selectedId && !numbers.has(selectedId) ? filtered.find((l) => l.id === selectedId) : null
    if (extra) specs.push({ listing: extra, number: null, selected: true })
    return specs
  }, [inView, numbers, filtered, selectedId])

  // Numbered pins are drawn as HTML markers, so keep them out of the GL source.
  const pinnedKey = useMemo(() => [...numbers.keys()].sort().join(','), [numbers])
  const geojson = useMemo(() => {
    const skip = new Set(pinnedKey ? pinnedKey.split(',') : [])
    return {
      type: 'FeatureCollection' as const,
      features: filtered
        .filter((l) => !skip.has(l.id))
        .map((l) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
          properties: { id: l.id },
        })),
    }
  }, [filtered, pinnedKey])

  const focusListing = useCallback(
    (listing: MapListing) => {
      setSelectedId(listing.id)
      const m = mapRef.current
      if (!m) return
      const view = { center: [listing.lng, listing.lat] as [number, number], zoom: Math.max(m.getZoom(), 13) }
      if (reduceMotion) m.jumpTo(view)
      else m.easeTo(view)
    },
    [reduceMotion]
  )

  usePinMarkers({ map, ready: mapReady, pins, hoverId, onSelect: (l) => setSelectedId(l.id) })
  useNearMeOverlay({ map, ready: mapReady, near: filters.near })
  useSelectionPopup({
    map,
    listing: useMemo(() => filtered.find((l) => l.id === selectedId) ?? null, [filtered, selectedId]),
    enabled: isDesktop,
    onClose: () => setSelectedId(null),
  })

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    maplibregl.addProtocol('pmtiles', new Protocol().tile)
    // Same-origin tiles proxy by default (CORS-free); env URL is an override.
    const resolvedTiles = tilesUrl || `${window.location.origin}/api/map/tiles`
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(resolvedTiles),
      center: CITY_VIEWS['atlanta-ga']!.center,
      zoom: CITY_VIEWS['atlanta-ga']!.zoom,
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
      m.on('moveend', () => setViewNonce((n) => n + 1))
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
      maplibregl.removeProtocol('pmtiles')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesUrl])

  useEffect(() => {
    if (!map || !mapReady) return
    ;(map.getSource('listings') as maplibregl.GeoJSONSource | undefined)?.setData(geojson)
  }, [map, mapReady, geojson])

  function moveTo(center: [number, number], zoom: number) {
    const m = mapRef.current
    if (!m) return
    if (reduceMotion) m.jumpTo({ center, zoom })
    else m.flyTo({ center, zoom, duration: 1400 })
  }

  function flyToCity(slug: string) {
    setCitySlug(slug)
    const view = CITY_VIEWS[slug]
    if (view) moveTo(view.center, view.zoom)
  }

  /** Frames the whole radius, leaving room for the phone bar and sheet. */
  function fitNear(near: NearMe) {
    const m = mapRef.current
    if (!m) return
    const padding = isDesktop ? 40 : { top: 150, bottom: 280, left: 20, right: 20 }
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

  const filterProps = {
    filters,
    onFilters: (patch: Partial<MapFilters>) => setFilters((f) => ({ ...f, ...patch })),
    categories,
    entityTypes,
    citySlug,
    onCity: flyToCity,
    onNearMe: findNearMe,
    onRadius: setRadius,
    locating,
  }
  const drawerProps = {
    ...filterProps,
    isDesktop,
    cityTotal,
    reduceMotion,
    listings: inView,
    numbers,
    inViewCount: inView.length,
    loading,
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
      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {isDesktop ? (
          <>
            <MapLegend />
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
            className="absolute right-4 top-4 z-30 max-w-[280px] rounded-xl bg-ground px-3.5 py-2.5 text-xs text-white shadow-lg max-lg:top-auto max-lg:bottom-72 max-lg:left-4"
          >
            {message}
          </p>
        )}
        <MapDrawer {...drawerProps} slot="overlay" />
      </div>
    </div>
  )
}
