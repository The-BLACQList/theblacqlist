'use client'

import { ArrowUpDown } from 'lucide-react'

import { SORT_OPTIONS, DISTANCE_SORT_OPTION } from '@/lib/listings/facets'
import { useFacetParams } from '@/components/discovery/useFacetParams'

export function SortDropdown() {
  const { searchParams, setParam } = useFacetParams()
  const current = searchParams.get('sort') ?? 'relevance'

  // Nearest is only offered once a location is in the URL. Without coordinates
  // the server rejects sort=distance, so offering it would be a control that
  // returns an error by design.
  const hasLocation = Boolean(searchParams.get('lat') && searchParams.get('lng'))
  const options = hasLocation ? [...SORT_OPTIONS, DISTANCE_SORT_OPTION] : SORT_OPTIONS

  return (
    <label className="inline-flex items-center gap-2">
      <ArrowUpDown className="size-4 text-charcoal" aria-hidden="true" />
      <span className="sr-only">Sort results</span>
      <select
        value={current}
        onChange={(e) => setParam('sort', e.target.value === 'relevance' ? '' : e.target.value)}
        aria-label="Sort results"
        className="h-9 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
