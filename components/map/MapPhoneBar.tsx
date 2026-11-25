'use client'

import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { FilterChips, FilterExtras } from '@/components/map/MapFilterControls'
import { MapFiltersButton } from '@/components/map/MapFiltersButton'
import { MapSearchInput } from '@/components/map/MapSearchInput'
import { CITY_CHOICES } from '@/components/map/mapStyle'
import { activeFilterCount } from '@/lib/map/filterListings'
import type { MapFilterProps } from '@/lib/map/types'
import { cn } from '@/lib/utils'

interface Props extends MapFilterProps {
  onLocate: () => void
}

// A very short, narrow window has room for the search bar only. The chips, with
// Near Me among them, come with the Filters button.
const NO_ROOM = '[@media(max-width:639px)_and_(max-height:359px)]:hidden'

/** Floating search bar, chip row and locate button over the phone map. */
export function MapPhoneBar({ onLocate, ...filterProps }: Props) {
  const { filters, onFilters, categories, entityTypes, citySlug, onCity, onNearMe, onRadius, locating } = filterProps
  const [extrasOpen, setExtrasOpen] = useState(false)

  return (
    <div
      data-map-phonebar=""
      className={cn(
        'pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2',
        // The open filters come in front of an open list.
        extrasOpen ? 'z-30' : 'z-20',
        // Sideways phone: the chips sit beside the search bar (ticket 285).
        'map-tiny:sm:flex-row map-tiny:sm:flex-wrap map-tiny:sm:items-center'
      )}
    >
      <div className="pointer-events-auto flex min-h-[52px] min-w-0 map-tiny:sm:flex-[1_1_20rem] items-center gap-2 rounded-[14px] bg-white p-1 shadow-[0_6px_20px_rgba(29,28,29,0.2)]">
        <label htmlFor="map-city-select" className="sr-only">
          City
        </label>
        <select
          id="map-city-select"
          value={citySlug}
          onChange={(e) => onCity(e.target.value)}
          className="min-h-11 max-w-[104px] shrink-0 rounded-xl bg-off-white px-2 text-[14px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {CITY_CHOICES.map(({ slug, label }) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
        <MapSearchInput
          id="map-search-phone"
          value={filters.query}
          onChange={(query) => onFilters({ query })}
          onEnter={filterProps.onPlaceSearch}
          placeHit={filterProps.placeHit}
          onGoToPlace={filterProps.onGoToPlace}
        />
        <MapFiltersButton
          iconOnly
          count={activeFilterCount(filters)}
          expanded={extrasOpen}
          onToggle={() => setExtrasOpen((v) => !v)}
          controls="map-phone-extras"
        />
      </div>
      {extrasOpen && (
        <div
          id="map-phone-extras"
          className="pointer-events-auto rounded-[14px] bg-white p-3 map-tiny:order-last map-tiny:max-h-[calc(100dvh_-_14rem)] map-tiny:w-full map-tiny:overflow-y-auto shadow-[0_6px_20px_rgba(29,28,29,0.2)]"
        >
          <FilterExtras filters={filters} onFilters={onFilters} categories={categories} />
        </div>
      )}
      <div
        role="group"
        aria-label="Quick filters"
        data-map-chips=""
        className={cn(
          'pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1',
          'map-tiny:sm:mx-0 map-tiny:sm:min-w-0 map-tiny:sm:flex-[1_1_16rem] map-tiny:sm:px-1 map-tiny:sm:pb-0',
          !extrasOpen && NO_ROOM
        )}
      >
        <FilterChips
          filters={filters}
          onFilters={onFilters}
          entityTypes={entityTypes}
          onNearMe={onNearMe}
          onRadius={onRadius}
          locating={locating}
        />
      </div>
      <button
        type="button"
        onClick={onLocate}
        aria-label="Near me, use my location"
        data-map-locate=""
        className={cn(
          'pointer-events-auto flex size-11 items-center justify-center self-end map-tiny:absolute map-tiny:right-0 map-tiny:top-full map-tiny:mt-1 rounded-full bg-white text-ink shadow-[0_6px_20px_rgba(29,28,29,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
          NO_ROOM
        )}
      >
        <LocateFixed className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
