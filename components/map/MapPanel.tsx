'use client'

import { useEffect, useRef, useState } from 'react'
import { FilterChips, FilterExtras } from '@/components/map/MapFilterControls'
import { MapCityTabs } from '@/components/map/MapCityTabs'
import { MapFiltersButton } from '@/components/map/MapFiltersButton'
import { MapResultsList } from '@/components/map/MapResultsList'
import { MapSearchInput } from '@/components/map/MapSearchInput'
import { CITY_VIEWS } from '@/components/map/mapStyle'
import { activeFilterCount } from '@/lib/map/filterListings'
import type { MapFilterProps, MapResultsProps } from '@/lib/map/types'

interface Props extends MapFilterProps, MapResultsProps {
  cityTotal: number
  reduceMotion: boolean
}

/**
 * Desktop docked panel. The h1 names the city, then search, filters and the
 * photo-card grid. This list is the keyboard-first path to every business; the
 * canvas is an enhancement, never the only way in.
 */
export function MapPanel(props: Props) {
  const { filters, onFilters, categories, entityTypes, citySlug, onCity, onNearMe, onRadius, locating } = props
  const { cityTotal, reduceMotion, selectedId, loading, loadError, inViewCount } = props
  const [extrasOpen, setExtrasOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // A pin click selects a card that may be off-screen in the panel: bring it in.
  useEffect(() => {
    if (!selectedId) return
    const card = scrollRef.current?.querySelector(`[data-listing-id="${CSS.escape(selectedId)}"]`)
    card?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [selectedId, reduceMotion])

  return (
    <section
      aria-label="Businesses on the map"
      className="flex w-[480px] shrink-0 flex-col border-r border-hairline bg-off-white"
    >
      <div className="flex flex-col gap-4 px-6 pb-4 pt-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber">The map</p>
          <h1 className="mt-1 font-headline text-[52px] font-medium leading-none tracking-[-0.02em] text-ink">
            {CITY_VIEWS[citySlug]?.label ?? 'The map'}
          </h1>
          <p className="mt-2 text-[15px] text-charcoal">
            {loading
              ? 'Loading businesses'
              : `${cityTotal} Black-Owned and Ally ${cityTotal === 1 ? 'business' : 'businesses'}`}
          </p>
        </div>
        <MapCityTabs citySlug={citySlug} onCity={onCity} />
        <div className="flex gap-2">
          <MapSearchInput
            id="map-search-desktop"
            value={filters.query}
            onChange={(query) => onFilters({ query })}
          />
          <MapFiltersButton
            count={activeFilterCount(filters)}
            expanded={extrasOpen}
            onToggle={() => setExtrasOpen((v) => !v)}
            controls="map-filter-extras"
          />
        </div>
        {extrasOpen && (
          <div id="map-filter-extras">
            <FilterExtras filters={filters} onFilters={onFilters} categories={categories} />
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          <FilterChips
            filters={filters}
            onFilters={onFilters}
            entityTypes={entityTypes}
            onNearMe={onNearMe}
            onRadius={onRadius}
            locating={locating}
          />
        </div>
        {!loadError && (
          <div aria-live="polite">
            <p className="text-[13px] text-charcoal">
              <span className="font-headline text-[17px] text-ink">
                {filters.near ? `${inViewCount} within ${filters.near.radiusMiles} mi` : `${inViewCount} in view`}
              </span>
              {filters.near ? ' · nearest first' : ' · trusted first'}
            </p>
            {filters.near && (
              <p className="mt-1 text-[12.5px] text-charcoal">Only businesses with a map pin show here.</p>
            )}
          </div>
        )}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <MapResultsList {...props} variant="grid" />
      </div>
    </section>
  )
}
