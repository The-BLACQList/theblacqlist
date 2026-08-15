'use client'

import { X } from 'lucide-react'

import type { FacetGroupData } from '@/lib/listings/facets'
import {
  useFacetParams,
  FACET_KEYS,
  LOCATION_KEYS,
  clearEntries,
} from '@/components/discovery/useFacetParams'
import {
  ENTITY_TYPE_LABEL,
  TRUST_TIER_LABEL,
  OWNERSHIP_LABEL_MAP,
} from '@/components/discovery/facetConstants'

interface ActiveFilterChipsProps {
  groups: FacetGroupData[]
  categories?: { name: string; slug: string }[]
  cities?: { name: string; slug: string }[]
  hideCityFilter?: boolean
}

interface Chip {
  label: string
  onRemove: () => void
}

export function ActiveFilterChips({
  groups,
  categories = [],
  cities = [],
  hideCityFilter = false,
}: ActiveFilterChipsProps) {
  const { searchParams, setParam, setParams, getCsv, removeCsv } = useFacetParams()

  const clearableKeys = [
    ...(hideCityFilter ? FACET_KEYS.filter((k) => k !== 'city') : FACET_KEYS),
    ...LOCATION_KEYS,
  ]

  // slug → display name for attribute values and taxonomies
  const attrLabel: Record<string, string> = {}
  for (const g of groups) for (const v of g.values) attrLabel[v.slug] = v.name
  const catLabel: Record<string, string> = Object.fromEntries(categories.map((c) => [c.slug, c.name]))
  const cityLabel: Record<string, string> = Object.fromEntries(cities.map((c) => [c.slug, c.name]))

  const chips: Chip[] = []

  const type = searchParams.get('type')
  if (type) chips.push({ label: ENTITY_TYPE_LABEL[type] ?? type, onRemove: () => setParam('type', '') })

  const category = searchParams.get('category')
  if (category)
    chips.push({ label: catLabel[category] ?? category, onRemove: () => setParam('category', '') })

  const city = searchParams.get('city')
  if (city && !hideCityFilter)
    chips.push({ label: cityLabel[city] ?? city, onRemove: () => setParam('city', '') })

  const trust = searchParams.get('trust_tier')
  if (trust) chips.push({ label: TRUST_TIER_LABEL[trust] ?? trust, onRemove: () => setParam('trust_tier', '') })

  const ownership = searchParams.get('ownership')
  if (ownership)
    chips.push({
      label: OWNERSHIP_LABEL_MAP[ownership] ?? ownership,
      onRemove: () => setParam('ownership', ''),
    })

  // One chip for the whole location filter, not three. Removing it takes the
  // distance sort with it, since that sort cannot be honored without coordinates.
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radius = searchParams.get('radius')
  if (lat && lng && radius)
    chips.push({
      label: `Within ${radius} ${radius === '1' ? 'mile' : 'miles'}`,
      onRemove: () => setParams(clearEntries(LOCATION_KEYS, searchParams.get('sort'))),
    })

  if (searchParams.get('open_now') === '1')
    chips.push({ label: 'Open now', onRemove: () => setParam('open_now', '') })

  for (const p of getCsv('price')) chips.push({ label: p, onRemove: () => removeCsv('price', p) })

  for (const slug of getCsv('attrs'))
    chips.push({ label: attrLabel[slug] ?? slug, onRemove: () => removeCsv('attrs', slug) })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-charcoal/20 bg-pale-lavender px-3 py-1 text-xs font-subhead font-semibold text-brand-black hover:bg-pale-lavender/70"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => setParams(clearEntries(clearableKeys, searchParams.get('sort')))}
          className="text-xs font-subhead text-charcoal underline underline-offset-2 hover:text-brand-black"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
