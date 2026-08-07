'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CITY_VIEWS } from '@/components/map/mapStyle'
import { MapDrawer } from '@/components/map/MapDrawer'
import { isOpenNow } from '@/lib/listings/openStatus'
import type { WeeklyHours } from '@/types'
import { cn } from '@/lib/utils'

export interface MapListing {
  id: string
  name: string
  href: string
  category: string | null
  categorySlug: string | null
  citySlug: string | null
  cityName: string | null
  trustTier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
  isFeatured: boolean
  isSponsored: boolean
  priceRange: string | null
  hours: WeeklyHours | null
  coverSrc: string | null
  lng: number
  lat: number
}

interface GeoFeature {
  geometry: { coordinates: [number, number] }
  properties: Omit<MapListing, 'lng' | 'lat'>
}

const TIER_RADIUS: Record<string, number> = { certified: 9, verified: 7, claimed: 5, unclaimed: 3.5 }

/**
 * MP-A "Full-Bleed Explorer" on the light basemap: the map fills the page,
 * search/filters float on top, results live in a collapsible drawer (bottom
 * sheet on mobile). Tier-aware pins (prominence = trust, never pay); the
 * highlighted pin gets the gold glow + grow/bounce (reduced-motion: instant).
 * The drawer's list is the parallel accessible path to every business.
 */
export function MapExplore({ tilesUrl }: { tilesUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const highlightMarker = useRef<maplibregl.Marker | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const [listings, setListings] = useState<MapListing[]>([])
  const [loadError, setLoadError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [inView, setInView] = useState<MapListing[]>([])
  const [citySlug, setCitySlug] = useState<string>('atlanta-ga')
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [trustOnly, setTrustOnly] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Load listings GeoJSON once
  useEffect(() => {
    fetch('/api/map/listings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((geo: { features: GeoFeature[] }) => {
        setListings(
          geo.features.map((f) => ({
            ...f.properties,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
        )
      })
      .catch(() => setLoadError(true))
  }, [])

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (openNowOnly && !(l.hours && isOpenNow(l.hours).open)) return false
        if (trustOnly && l.trustTier !== 'verified' && l.trustTier !== 'certified') return false
        return true
      }),
    [listings, openNowOnly, trustOnly]
  )

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: filtered.map((l) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
        properties: { id: l.id, trustTier: l.trustTier },
      })),
    }),
    [filtered]
  )

  const refreshInView = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    setInView(
      filtered
        .filter((l) => bounds.contains([l.lng, l.lat]))
        .sort((a, b) => {
          // Sponsored/featured get list priority (badged in the drawer) —
          // never a bigger pin. Then trust, then name.
          const promo = Number(b.isSponsored || b.isFeatured) - Number(a.isSponsored || a.isFeatured)
          if (promo !== 0) return promo
          const tiers = ['unclaimed', 'claimed', 'verified', 'certified']
          const tier = tiers.indexOf(b.trustTier) - tiers.indexOf(a.trustTier)
          return tier !== 0 ? tier : a.name.localeCompare(b.name)
        })
        .slice(0, 60)
    )
  }, [filtered])

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(tilesUrl),
      center: CITY_VIEWS['atlanta-ga']!.center,
      zoom: CITY_VIEWS['atlanta-ga']!.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      map.addSource('listings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 13,
        promoteId: 'id',
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(196,160,101,0.28)',
          'circle-stroke-color': '#8f6600',
          'circle-stroke-width': 1.5,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 24],
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'listings',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 12,
        },
        paint: { 'text-color': '#5c4a1e' },
      })
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': [
            'match',
            ['get', 'trustTier'],
            'certified',
            TIER_RADIUS.certified!,
            'verified',
            TIER_RADIUS.verified!,
            'claimed',
            TIER_RADIUS.claimed!,
            TIER_RADIUS.unclaimed!,
          ],
          'circle-color': [
            'match',
            ['get', 'trustTier'],
            'unclaimed',
            '#a08d64',
            '#8f6600',
          ],
          'circle-stroke-color': [
            'match',
            ['get', 'trustTier'],
            'certified',
            '#ffd867',
            '#ffffff',
          ],
          'circle-stroke-width': ['match', ['get', 'trustTier'], 'certified', 2.5, 1.5],
        },
      })

      map.on('click', 'clusters', (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const source = map.getSource('listings') as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(feature.properties!.cluster_id as number).then((zoom: number) => {
          const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates
          if (reduceMotion) map.jumpTo({ center: [lng, lat], zoom })
          else map.easeTo({ center: [lng, lat], zoom })
        })
      })
      map.on('click', 'pins', (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0] as MapGeoJSONFeature | undefined
        if (feature) setHighlightId(feature.properties.id as string)
      })
      for (const layer of ['pins', 'clusters']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }
      map.on('moveend', () => setMapReady((r) => (r ? r : true)))
      setMapReady(true)
    })
    map.on('error', () => {
      /* tile errors are non-fatal; the drawer list remains the reliable path */
    })

    return () => {
      map.remove()
      mapRef.current = null
      maplibregl.removeProtocol('pmtiles')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesUrl])

  // Push filtered data into the source + refresh drawer on map movement
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource('listings') as maplibregl.GeoJSONSource | undefined
    source?.setData(geojson)
    refreshInView()
    const handler = () => refreshInView()
    map.on('moveend', handler)
    return () => {
      map.off('moveend', handler)
    }
  }, [geojson, mapReady, refreshInView])

  // Highlight marker: gold glow + grow/bounce on the selected pin, plus popup
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    highlightMarker.current?.remove()
    highlightMarker.current = null
    popupRef.current?.remove()
    popupRef.current = null
    if (!highlightId) return
    const listing = filtered.find((l) => l.id === highlightId)
    if (!listing) return

    const el = document.createElement('div')
    el.className = cn('blacq-map-highlight', reduceMotion && 'blacq-map-highlight-static')
    highlightMarker.current = new maplibregl.Marker({ element: el })
      .setLngLat([listing.lng, listing.lat])
      .addTo(map)

    const open = listing.hours ? isOpenNow(listing.hours) : null
    const tierLabel =
      listing.trustTier === 'certified'
        ? '★ Certified'
        : listing.trustTier === 'verified'
          ? '✓ Verified'
          : listing.trustTier === 'claimed'
            ? 'Claimed'
            : 'Unclaimed'
    const popupEl = document.createElement('div')
    popupEl.className = 'blacq-map-popup'
    popupEl.innerHTML = `
      ${listing.coverSrc ? `<div class="blacq-map-popup-photo" style="background-image:url('${listing.coverSrc}')"></div>` : ''}
      <div class="blacq-map-popup-body">
        <p class="blacq-map-popup-tier">${tierLabel}</p>
        <p class="blacq-map-popup-name"></p>
        <p class="blacq-map-popup-meta"></p>
        <a class="blacq-map-popup-link" href="${listing.href}">View page →</a>
      </div>`
    popupEl.querySelector('.blacq-map-popup-name')!.textContent = listing.name
    popupEl.querySelector('.blacq-map-popup-meta')!.textContent = [
      listing.category,
      open ? open.label : null,
    ]
      .filter(Boolean)
      .join(' · ')

    popupRef.current = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '260px' })
      .setLngLat([listing.lng, listing.lat])
      .setDOMContent(popupEl)
      .addTo(map)
    popupRef.current.on('close', () => setHighlightId(null))
  }, [highlightId, filtered, reduceMotion])

  function flyToCity(slug: string) {
    setCitySlug(slug)
    const view = CITY_VIEWS[slug]
    const map = mapRef.current
    if (!view || !map) return
    if (reduceMotion) map.jumpTo({ center: view.center, zoom: view.zoom })
    else map.flyTo({ center: view.center, zoom: view.zoom, duration: 1400 })
  }

  function focusListing(listing: MapListing) {
    setHighlightId(listing.id)
    const map = mapRef.current
    if (!map) return
    if (reduceMotion) map.jumpTo({ center: [listing.lng, listing.lat], zoom: Math.max(map.getZoom(), 13) })
    else map.easeTo({ center: [listing.lng, listing.lat], zoom: Math.max(map.getZoom(), 13) })
  }

  const filterChip = (active: boolean) =>
    cn(
      'inline-flex items-center min-h-11 px-4 rounded-full font-subhead text-[13px] font-semibold backdrop-blur-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
      active
        ? 'bg-gold text-brand-black'
        : 'bg-deep-bg/80 border border-off-white/25 text-off-white hover:bg-deep-bg'
    )

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)]">
      <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />

      {/* Floating filter bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex gap-2 flex-wrap" role="group" aria-label="Map filters">
        {Object.entries(CITY_VIEWS).map(([slug, view]) => (
          <button
            key={slug}
            type="button"
            onClick={() => flyToCity(slug)}
            className={filterChip(citySlug === slug)}
            aria-pressed={citySlug === slug}
          >
            {view.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpenNowOnly((v) => !v)}
          className={filterChip(openNowOnly)}
          aria-pressed={openNowOnly}
        >
          Open now
        </button>
        <button
          type="button"
          onClick={() => setTrustOnly((v) => !v)}
          className={filterChip(trustOnly)}
          aria-pressed={trustOnly}
        >
          Verified+
        </button>
      </div>

      <MapDrawer
        listings={inView}
        totalCount={filtered.length}
        loadError={loadError}
        highlightId={highlightId}
        onHover={(id) => setHighlightId(id)}
        onSelect={focusListing}
      />
    </div>
  )
}
