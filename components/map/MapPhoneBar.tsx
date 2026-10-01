'use client'

import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { FilterChips, FilterExtras } from '@/components/map/MapFilterControls'
import { MapFiltersButton } from '@/components/map/MapFiltersButton'
import { MapSearchInput } from '@/components/map/MapSearchInput'
import { CITY_VIEWS } from '@/components/map/mapStyle'
import { activeFilterCount } from '@/lib/map/filterListings'
import type { MapFilterProps } from '@/lib/map/types'

interface Props extends MapFilterProps {
  onLocate: () => void
}

/** Floating search bar, chip row and locate button over the phone map. */
export function MapPhoneBar({ onLocate, ...filterProps }: Props) {
  const { filters, onFilters, categories, entityTypes, citySlug, onCity } = filterProps
  const [extrasOpen, setExtrasOpen] = useState(false)

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
      <div className="pointer-events-auto flex min-h-[52px] items-center gap-2 rounded-[14px] bg-white p-1 shadow-[0_6px_20px_rgba(29,28,29,0.2)]">
        <label htmlFor="map-city-select" className="sr-only">
          City
        </label>
        <select
          id="map-city-select"
          value={citySlug}
          onChange={(e) => onCity(e.target.value)}
          className="min-h-11 max-w-[104px] shrink-0 rounded-xl bg-off-white px-2 text-[14px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {Object.entries(CITY_VIEWS).map(([slug, view]) => (
            <option key={slug} value={slug}>
              {view.label}
            </option>
          ))}
        </select>
        <MapSearchInput
          id="map-search-phone"
          value={filters.query}
          onChange={(query) => onFilters({ query })}
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
          className="pointer-events-auto rounded-[14px] bg-white p-3 shadow-[0_6px_20px_rgba(29,28,29,0.2)]"
        >
          <FilterExtras filters={filters} onFilters={onFilters} categories={categories} />
        </div>
      )}
      <div
        role="group"
        aria-label="Quick filters"
        className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1"
      >
        <FilterChips filters={filters} onFilters={onFilters} entityTypes={entityTypes} />
      </div>
      <button
        type="button"
        onClick={onLocate}
        aria-label="Show my location"
        className="pointer-events-auto flex size-11 items-center justify-center self-end rounded-full bg-white text-ink shadow-[0_6px_20px_rgba(29,28,29,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <LocateFixed className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
