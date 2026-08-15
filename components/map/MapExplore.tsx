'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CITY_VIEWS } from '@/components/map/mapStyle'
import { MapDrawer } from '@/components/map/MapDrawer'
import { buildPinsFilter, popupOffsetFor, TIER_RADIUS } from '@/lib/map/popupOffset'
import { isOpenNow } from '@/lib/listings/openStatus'
import type { WeeklyHours } from '@/types'
import { cn } from '@/lib/utils'

export interface MapListing {
  id: string
  name: string
  entityType: string
  href: string
  category: string | null
  categorySlug: string | null
  citySlug: string | null
  cityName: string | null
  trustTier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
  logoSrc: string | null
  ownershipLabel: string
  avgRating: number | null
  reviewCount: number
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
  const logoMarkers = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [viewNonce, setViewNonce] = useState(0)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const [listings, setListings] = useState<MapListing[]>([])
  const [loadError, setLoadError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [tilesStalled, setTilesStalled] = useState(false)
  const [inView, setInView] = useState<MapListing[]>([])
  const [citySlug, setCitySlug] = useState<string>('atlanta-ga')
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [trustOnly, setTrustOnly] = useState(false)
  const [categorySlug, setCategorySlug] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  // Hover and selection are separate states on purpose. Hover (drawer
  // mouseenter/focus) only glows the pin; selection (clicking a pin or a
  // drawer row) is the one thing that opens a card. Collapsing them meant a
  // card was always open, which is what let a second pin click close the card
  // it had just opened instead of moving it.
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? hoverId

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

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of listings) {
      if (l.categorySlug && l.category) seen.set(l.categorySlug, l.category)
    }
    return [...seen.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [listings])

  const TYPE_LABELS: Record<string, string> = {
    business: 'Businesses',
    restaurant: 'Restaurants',
    service_provider: 'Services',
    vendor: 'Vendors',
    professional: 'Professionals',
    creative: 'Creatives',
    event: 'Events',
    job: 'Jobs',
  }
  const presentTypes = useMemo(() => {
    const seen = new Set<string>()
    for (const l of listings) seen.add(l.entityType)
    return [...seen].filter((t) => TYPE_LABELS[t]).sort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings])

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (openNowOnly && !(l.hours && isOpenNow(l.hours).open)) return false
        if (trustOnly && l.trustTier !== 'verified' && l.trustTier !== 'certified') return false
        if (categorySlug && l.categorySlug !== categorySlug) return false
        if (typeFilter && l.entityType !== typeFilter) return false
        return true
      }),
    [listings, openNowOnly, trustOnly, categorySlug, typeFilter]
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

    // Same-origin tiles proxy by default (CORS-free); env URL is an override.
    const resolvedTiles = tilesUrl || `${window.location.origin}/api/map/tiles`
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(resolvedTiles),
      center: CITY_VIEWS['atlanta-ga']!.center,
      zoom: CITY_VIEWS['atlanta-ga']!.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    const stallTimer = window.setTimeout(() => {
      if (!map.loaded()) setTilesStalled(true)
    }, 10000)
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      map.addSource('listings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 12,
        promoteId: 'id',
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(143,102,0,0.20)',
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
        id: 'pins-unclaimed',
        type: 'circle',
        source: 'listings',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'trustTier'], 'unclaimed']],
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#6e5a3d',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      })
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'listings',
        // No maxzoom: the circle layer stays live at every zoom and instead
        // drops exactly the ids that got a DOM logo marker (see the marker
        // effect). A blanket zoom cutoff left claimed+ listings past the
        // 60-marker cap with no renderer at all.
        filter: buildPinsFilter([]),
        paint: {
          'circle-radius': [
            'match',
            ['get', 'trustTier'],
            'certified',
            TIER_RADIUS.certified,
            'verified',
            TIER_RADIUS.verified,
            'claimed',
            TIER_RADIUS.claimed,
            TIER_RADIUS.unclaimed,
          ],
          'circle-color': '#8f6600',
          // Tier ladder, visible: certified = thick light-gold ring, verified =
          // thin light-gold ring, claimed = white ring, unclaimed = small dark dot.
          'circle-stroke-color': [
            'match',
            ['get', 'trustTier'],
            'certified',
            '#ffd867',
            'verified',
            '#ffd867',
            '#ffffff',
          ],
          'circle-stroke-width': [
            'match',
            ['get', 'trustTier'],
            'certified',
            2.5,
            'verified',
            1.75,
            1.5,
          ],
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
      for (const pinLayer of ['pins', 'pins-unclaimed']) {
        map.on('click', pinLayer, (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0] as MapGeoJSONFeature | undefined
          if (feature) setSelectedId(feature.properties.id as string)
        })
      }
      // The popup runs with closeOnClick disabled so a pin-to-pin click can't
      // tear down the card it just opened. Clicking bare map still dismisses.
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['pins', 'pins-unclaimed', 'clusters'],
        })
        if (hits.length === 0) setSelectedId(null)
      })
      for (const layer of ['pins', 'pins-unclaimed', 'clusters']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }
      map.on('moveend', () => {
        setMapReady((r) => (r ? r : true))
        setViewNonce((n) => n + 1)
      })
      map.on('zoomend', () => setViewNonce((n) => n + 1))
      setMapReady(true)
      setTilesStalled(false)
    })
    map.on('error', (e) => {
      // Surface, never swallow: the drawer list stays the reliable path.
      console.warn('[map] style/tile error:', e?.error?.message ?? e)
    })

    return () => {
      window.clearTimeout(stallTimer)
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

  // Identity markers (map-presence ladder, MPP-B): at street zoom, claimed
  // listings get a named pin; verified+ get their logo in a ring (monogram
  // fallback) — certified brightest. Unclaimed stays a dot: identity is
  // earned by trust. Markers are diffed by id so panning never flickers,
  // and the viewport cap keeps the highest trust tiers first.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const markers = logoMarkers.current

    // Whatever this effect decides, the circle layer takes the complement:
    // every claimed+ listing ends up with exactly one renderer, never zero.
    const syncPinsLayer = () => {
      if (map.getLayer('pins')) {
        map.setFilter('pins', buildPinsFilter([...markers.keys()]))
      }
    }

    if (map.getZoom() < 13) {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
      syncPinsLayer()
      return
    }

    const bounds = map.getBounds()
    const tierRank = { certified: 0, verified: 1, claimed: 2 } as const
    const visible = filtered
      .filter((l) => l.trustTier !== 'unclaimed' && bounds.contains([l.lng, l.lat]))
      .sort(
        (a, b) =>
          tierRank[a.trustTier as keyof typeof tierRank] -
          tierRank[b.trustTier as keyof typeof tierRank]
      )
      .slice(0, 60)
    const visibleIds = new Set(visible.map((l) => l.id))

    for (const [id, marker] of markers) {
      if (!visibleIds.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }

    for (const listing of visible) {
      if (markers.has(listing.id)) continue
      const logoTier = listing.trustTier === 'verified' || listing.trustTier === 'certified'
      const el = document.createElement('button')
      el.type = 'button'
      el.className = cn(
        'blacq-logo-marker',
        !logoTier && 'blacq-logo-marker-claimed',
        listing.trustTier === 'certified' && 'blacq-logo-marker-certified'
      )
      // The map container is aria-hidden (the drawer list is the accessible
      // parallel path), so these buttons must not be focusable — 60 unlabeled
      // tab stops inside a hidden subtree is the violation, not the fix.
      el.tabIndex = -1
      el.setAttribute('aria-hidden', 'true')
      const ring = document.createElement('span')
      ring.className = 'blacq-logo-marker-ring'
      if (logoTier && listing.logoSrc) {
        const img = document.createElement('img')
        img.src = listing.logoSrc
        img.alt = ''
        ring.appendChild(img)
      } else if (logoTier) {
        const initials = listing.name
          .split(' ')
          .filter((w) => /^[A-Za-z]/.test(w))
          .slice(0, 2)
          .map((w) => w[0] ?? '')
          .join('')
          .toUpperCase()
        ring.textContent = initials
      }
      const tip = document.createElement('span')
      tip.className = 'blacq-logo-marker-tip'
      const label = document.createElement('span')
      label.className = 'blacq-logo-marker-label'
      label.textContent = listing.name
      el.append(ring, tip, label)
      el.addEventListener('click', (event) => {
        // Marker clicks bubble to the canvas container and would fire a map
        // `click`, closing the card this one is opening.
        event.stopPropagation()
        setSelectedId(listing.id)
      })
      markers.set(
        listing.id,
        new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([listing.lng, listing.lat])
          .addTo(map)
      )
    }

    for (const [id, marker] of markers) {
      marker.getElement().classList.toggle('blacq-logo-marker-active', id === activeId)
    }
    syncPinsLayer()
  }, [filtered, mapReady, viewNonce, activeId])

  // Unmount-only teardown for the diffed marker set
  useEffect(() => {
    const markers = logoMarkers.current
    return () => {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    }
  }, [])

  // Gold glow on the active pin — but only for GL circles. A DOM logo marker
  // gets `blacq-logo-marker-active` instead: the glow marker is center-anchored
  // and on a 74px-tall marker it landed on the name label, not the ring.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    highlightMarker.current?.remove()
    highlightMarker.current = null
    if (!activeId || logoMarkers.current.has(activeId)) return
    const listing = filtered.find((l) => l.id === activeId)
    if (!listing) return

    const el = document.createElement('div')
    el.className = cn('blacq-map-highlight', reduceMotion && 'blacq-map-highlight-static')
    highlightMarker.current = new maplibregl.Marker({ element: el })
      .setLngLat([listing.lng, listing.lat])
      .addTo(map)
  }, [activeId, filtered, reduceMotion, viewNonce])

  // Preview card for the selected listing
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Null the ref *before* removing: Popup.remove() fires 'close' synchronously,
    // and the guarded handler below must see a cleared ref or it would null the
    // selection out from under the effect that is opening the next card.
    const previous = popupRef.current
    popupRef.current = null
    previous?.remove()

    if (!selectedId) return
    const listing = filtered.find((l) => l.id === selectedId)
    if (!listing) return

    const open = listing.hours ? isOpenNow(listing.hours) : null
    const tierLabel =
      listing.trustTier === 'certified'
        ? '★ Certified'
        : listing.trustTier === 'verified'
          ? '✓ Verified'
          : listing.trustTier === 'claimed'
            ? 'Claimed'
            : 'Unclaimed'
    // PP-1 photo-led preview: cover header w/ tier chip, facts, two actions
    const ownershipLabel = listing.ownershipLabel === 'ally' ? 'Ally' : 'Black-Owned'
    const directionsHref = `https://maps.google.com/?q=${listing.lat},${listing.lng}`
    const popupEl = document.createElement('div')
    popupEl.className = 'blacq-map-popup'
    popupEl.innerHTML = `
      ${
        listing.coverSrc
          ? `<div class="blacq-map-popup-photo" style="background-image:url('${listing.coverSrc}')"><span class="blacq-map-popup-chips"><span class="blacq-map-popup-chip">${ownershipLabel}</span><span class="blacq-map-popup-chip">${tierLabel}</span></span><p class="blacq-map-popup-photoname"></p></div>`
          : `<p class="blacq-map-popup-tier">${ownershipLabel} · ${tierLabel}</p><p class="blacq-map-popup-name"></p>`
      }
      <div class="blacq-map-popup-body">
        <p class="blacq-map-popup-meta"></p>
        <div class="blacq-map-popup-actions">
          <a class="blacq-map-popup-primary" href="${listing.href}">View page</a>
          <a class="blacq-map-popup-secondary" href="${directionsHref}" target="_blank" rel="noopener noreferrer">Directions</a>
        </div>
      </div>`
    const nameEl = popupEl.querySelector('.blacq-map-popup-photoname') ?? popupEl.querySelector('.blacq-map-popup-name')
    if (nameEl) nameEl.textContent = listing.name
    popupEl.querySelector('.blacq-map-popup-meta')!.textContent = [
      listing.category,
      open ? open.label : null,
      listing.avgRating !== null && listing.reviewCount > 0
        ? `★ ${listing.avgRating.toFixed(1)} (${listing.reviewCount})`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const popup = new maplibregl.Popup({
      // Sized to the renderer actually on screen so the card points at the pin
      // instead of covering it. A scalar offset here normalizes to a radius,
      // which cleared a 3.5px dot fine and buried a 74px logo marker.
      offset: popupOffsetFor(listing.trustTier, logoMarkers.current.has(listing.id)),
      closeButton: true,
      closeOnClick: false,
      maxWidth: '260px',
      className: 'blacq-map-popup-wrap',
    })
      .setLngLat([listing.lng, listing.lat])
      .setDOMContent(popupEl)
      .addTo(map)
    popupRef.current = popup
    // Guarded: only a genuine user close (× or a bare-map click) deselects.
    popup.on('close', () => {
      if (popupRef.current === popup) setSelectedId(null)
    })
  }, [selectedId, filtered])

  // Crossing z13 swaps a listing between the circle layer and a DOM marker,
  // which changes how much the card has to clear. Re-offset in place rather
  // than rebuilding the popup, so panning never flashes the card.
  useEffect(() => {
    const popup = popupRef.current
    if (!popup || !selectedId) return
    const listing = filtered.find((l) => l.id === selectedId)
    if (!listing) return
    popup.setOffset(
      popupOffsetFor(listing.trustTier, logoMarkers.current.has(listing.id))
    )
  }, [selectedId, filtered, viewNonce])

  function flyToCity(slug: string) {
    setCitySlug(slug)
    const view = CITY_VIEWS[slug]
    const map = mapRef.current
    if (!view || !map) return
    if (reduceMotion) map.jumpTo({ center: view.center, zoom: view.zoom })
    else map.flyTo({ center: view.center, zoom: view.zoom, duration: 1400 })
  }

  function focusListing(listing: MapListing) {
    setSelectedId(listing.id)
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
    <div className="relative h-[calc(100dvh_-_3.5rem)] md:h-[calc(100dvh_-_4rem)]">
      <div ref={containerRef} className="h-full w-full" aria-hidden="true" />

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
        {presentTypes.length > 1 &&
          presentTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter((v) => (v === t ? '' : t))}
              className={filterChip(typeFilter === t)}
              aria-pressed={typeFilter === t}
            >
              {TYPE_LABELS[t]}
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
        <label className="sr-only" htmlFor="map-category-filter">
          Filter by category
        </label>
        <select
          id="map-category-filter"
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
          className={cn(
            filterChip(Boolean(categorySlug)),
            'appearance-none pr-8 cursor-pointer bg-no-repeat bg-[position:right_0.75rem_center]'
          )}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23f4f4f7' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {tilesStalled && (
        <p
          role="status"
          className="absolute top-16 right-3 z-20 max-w-[260px] rounded-lg bg-deep-bg/90 border border-off-white/20 px-3.5 py-2.5 font-subhead text-xs text-off-white backdrop-blur-sm"
        >
          Map imagery is taking a while. The list below is live.
        </p>
      )}
      <MapDrawer
        listings={inView}
        totalCount={filtered.length}
        loadError={loadError}
        highlightId={activeId}
        onHover={setHoverId}
        onSelect={focusListing}
      />
    </div>
  )
}
