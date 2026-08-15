'use client'

import { ArrowUpDown } from 'lucide-react'

import { SORT_OPTIONS, DISTANCE_SORT_OPTION } from '@/lib/listings/facets'
import { useFacetParams } from '@/components/discovery/useFacetParams'
import { parseLocationFromQuery } from '@/lib/listings/location-params'

export function SortDropdown() {
  const { searchParams, setParam } = useFacetParams()
  const current = searchParams.get('sort') ?? 'relevance'

  // Nearest is only offered once a usable location is in the URL — parsed the
  // same all-or-nothing way the server parses it, not merely present. Without
  // coordinates the server drops sort=distance, so offering it against a partial
  // or out-of-range location would be a control that silently does nothing.
  const hasLocation = parseLocationFromQuery((key) => searchParams.get(key)) !== null
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
