'use client'

import { ChevronDown } from 'lucide-react'
import { NO_FILTERS, activeFilterCount } from '@/lib/map/filterListings'
import type { MapFilterProps } from '@/lib/map/types'
import { cn } from '@/lib/utils'

export function chipClass(active: boolean): string {
  return cn(
    'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
    active
      ? 'border-ink bg-ink text-white'
      : 'border-hairline bg-white text-ink hover:border-ink/40'
  )
}

type ChipProps = Pick<MapFilterProps, 'filters' | 'onFilters' | 'entityTypes'>

/** Quick filters: apply on tap, no submit. Active chips are filled and pressed. */
export function FilterChips({ filters, onFilters, entityTypes }: ChipProps) {
  return (
    <>
      <button
        type="button"
        aria-pressed={filters.openNow}
        onClick={() => onFilters({ openNow: !filters.openNow })}
        className={chipClass(filters.openNow)}
      >
        Open now
      </button>
      <button
        type="button"
        aria-pressed={filters.trustOnly}
        onClick={() => onFilters({ trustOnly: !filters.trustOnly })}
        className={chipClass(filters.trustOnly)}
      >
        Verified+
      </button>
      {entityTypes.length > 1 &&
        entityTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={filters.entityType === t.value}
            onClick={() => onFilters({ entityType: filters.entityType === t.value ? '' : t.value })}
            className={chipClass(filters.entityType === t.value)}
          >
            {t.label}
          </button>
        ))}
    </>
  )
}

/** The slower filters: category, plus a way back to everything. */
export function FilterExtras({ filters, onFilters, categories }: Omit<ChipProps, 'entityTypes'> & Pick<MapFilterProps, 'categories'>) {
  const count = activeFilterCount(filters)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="map-category-filter" className="sr-only">
        Filter by category
      </label>
      <div className="relative min-w-[200px] flex-1">
        <select
          id="map-category-filter"
          value={filters.categorySlug}
          onChange={(e) => onFilters({ categorySlug: e.target.value })}
          className="min-h-11 w-full appearance-none rounded-xl border border-hairline bg-white pl-4 pr-10 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-charcoal"
          aria-hidden="true"
        />
      </div>
      {(count > 0 || filters.query) && (
        <button
          type="button"
          onClick={() => onFilters(NO_FILTERS)}
          className="min-h-11 rounded-xl px-2 text-[14px] font-semibold text-amber underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
