'use client'

import { SlidersHorizontal, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PRICE_RANGES, type FacetGroupData, type FacetCounts } from '@/lib/listings/facets'
import {
  useFacetParams,
  FACET_KEYS,
  LOCATION_KEYS,
  clearEntries,
} from '@/components/discovery/useFacetParams'
import {
  ENTITY_TYPES,
  TRUST_TIERS,
  OWNERSHIP_LABELS,
  LOCATION_TYPES,
} from '@/components/discovery/facetConstants'
import { NearYouFilter } from '@/components/discovery/NearYouFilter'
import { FilterSection } from '@/components/discovery/FilterSection'
import { CategoryTree } from '@/components/discovery/CategoryTree'
import type { TreeCategory } from '@/lib/categories/tree'

function optionClass(isActive: boolean): string {
  return cn(
    'text-left px-3 py-1.5 rounded-lg text-sm font-subhead transition-colors',
    isActive
      ? 'bg-brand-black text-white font-semibold'
      : 'text-charcoal hover:bg-pale-lavender hover:text-brand-black'
  )
}

function CountTag({ n }: { n: number }) {
  return (
    <span className="ml-auto text-[11px] tabular-nums text-charcoal-soft" aria-hidden="true">
      {n}
    </span>
  )
}

export interface FacetSidebarProps {
  cities?: { name: string; slug: string }[]
  /**
   * Every active category, parents and subcategories. The tree nests them; the
   * chips need the subcategories too, or a picked child shows as its raw slug.
   */
  categories?: TreeCategory[]
  groups: FacetGroupData[]
  counts: FacetCounts
  hideCityFilter?: boolean
  className?: string
}

export function FacetSidebar({
  cities = [],
  categories = [],
  groups,
  counts,
  hideCityFilter = false,
  className,
}: FacetSidebarProps) {
  const { searchParams, setParam, setParams, getCsv, toggleCsv } = useFacetParams()

  // The counts did not come back. Every count reads 0, and 0 is what this panel
  // uses to grey a control out, so without this the whole sidebar would render
  // dead and tell the visitor that nothing in the directory matches anything.
  // Counts are an affordance; being able to filter at all is the feature. So
  // the badges go away and the controls stay live.
  const countsOff = counts.countsUnavailable === true
  // Undefined until the RPC returns per-type counts: no badges, nothing disabled.
  const typeCounts = countsOff ? undefined : counts.type

  const activeType = searchParams.get('type') ?? ''
  const activeCategory = searchParams.get('category') ?? ''
  const activeCity = searchParams.get('city') ?? ''
  const activeTrust = searchParams.get('trust_tier') ?? ''
  const activeOwnership = searchParams.get('ownership') ?? ''
  const openNow = searchParams.get('open_now') === '1'
  const selectedPrices = getCsv('price')
  const selectedAttrs = getCsv('attrs')
  // Multi-select as of 2026-09-04: Products & Services is four location types at
  // once, so this reads like price/attrs rather than the single-value facets.
  const selectedLocationTypes = getCsv('location_type')

  const clearableKeys = [
    ...(hideCityFilter ? FACET_KEYS.filter((k) => k !== 'city') : FACET_KEYS),
    ...LOCATION_KEYS,
  ]
  const hasActiveFilters = clearableKeys.some((k) => !!searchParams.get(k))

  function clearAll() {
    setParams(clearEntries(clearableKeys, searchParams.get('sort')))
  }

  return (
    <aside aria-label="Discovery filters" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-subhead text-sm font-semibold text-brand-black">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-subhead text-charcoal underline underline-offset-2 hover:text-brand-black"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Near You — geolocation, with a city picker behind every failure path */}
      <NearYouFilter cities={cities} showCityFallback={!hideCityFilter} />

      {/* Open now */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={openNow}
          onChange={() => setParam('open_now', openNow ? '' : '1')}
          className="rounded border-charcoal/30 text-brand-black focus:ring-brand-black/20"
        />
        <Clock className="size-4 text-charcoal" aria-hidden="true" />
        <span className="text-sm font-subhead text-brand-black">Open now</span>
        {!countsOff && <CountTag n={counts.openNow} />}
      </label>

      {/* Type opens by default: it is what most visitors reach for first.
          Ownership stays open too, being two buttons and the directory's
          defining label. Everything else starts closed unless it holds an
          active filter, which keeps the panel short. Category is closed on
          purpose: open, the tree is two Tab stops per parent, and a keyboard
          user would cross all of them to get from the search box to the
          results (e2e/keyboard-a11y.spec.ts J7). */}
      <FilterSection title="Type" defaultOpen active={!!activeType}>
        <div className="flex flex-col gap-1" role="group" aria-label="Filter by type">
          {ENTITY_TYPES.map(({ value, label }) => {
            const isActive = activeType === value
            const n = typeCounts ? (typeCounts[value] ?? 0) : null
            const disabled = !countsOff && !isActive && n === 0
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => setParam('type', isActive ? '' : value)}
                className={cn(
                  'flex items-center text-left px-3 py-1.5 rounded-lg text-sm font-subhead transition-colors',
                  isActive
                    ? 'bg-brand-black text-white font-semibold'
                    : disabled
                      ? 'text-charcoal-faint cursor-not-allowed'
                      : 'text-charcoal hover:bg-pale-lavender hover:text-brand-black'
                )}
              >
                {label}
                {!countsOff && n !== null && !isActive && <CountTag n={n} />}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {categories.length > 0 && (
        <FilterSection title="Category" active={!!activeCategory}>
          <CategoryTree
            categories={categories}
            counts={countsOff ? undefined : counts.category}
            activeSlug={activeCategory}
            onSelect={(slug) => setParam('category', slug)}
          />
        </FilterSection>
      )}

      <FilterSection title="Price" active={selectedPrices.length > 0}>
        <div className="flex gap-1.5" role="group" aria-label="Filter by price range">
          {PRICE_RANGES.map((p) => {
            const isActive = selectedPrices.includes(p)
            const n = counts.price[p] ?? 0
            const disabled = !countsOff && !isActive && n === 0
            return (
              <button
                key={p}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => toggleCsv('price', p)}
                className={cn(
                  'flex-1 h-9 rounded-lg border text-sm font-subhead font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-black text-white border-brand-black'
                    : disabled
                      ? 'border-charcoal/15 text-charcoal-faint cursor-not-allowed'
                      : 'border-charcoal/30 text-charcoal hover:border-brand-black hover:text-brand-black'
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {/* Ownership (Black-Owned / Ally): authoritative label, no per-option counts */}
      <FilterSection title="Ownership" defaultOpen active={!!activeOwnership}>
        <div className="flex flex-col gap-1" role="group" aria-label="Filter by ownership">
          {OWNERSHIP_LABELS.map(({ value, label }) => {
            const isActive = activeOwnership === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setParam('ownership', isActive ? '' : value)}
                className={optionClass(isActive)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {/* Where they operate: the online-only / no-fixed-address axis. Mirrors the
          owner-side "Where you operate" wording. No per-option counts, matching
          Ownership and Trust Level. */}
      <FilterSection title="Where they operate" active={selectedLocationTypes.length > 0}>
        <div className="flex flex-col gap-1" role="group" aria-label="Filter by where they operate">
          {LOCATION_TYPES.map(({ value, label }) => {
            const isActive = selectedLocationTypes.includes(value)
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleCsv('location_type', value)}
                className={optionClass(isActive)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {!hideCityFilter && (
        <FilterSection title="City" active={!!activeCity}>
          <select
            value={activeCity}
            onChange={(e) => setParam('city', e.target.value)}
            aria-label="Filter by city"
            className="w-full h-10 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
          >
            <option value="">All cities</option>
            {cities.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </FilterSection>
      )}

      {/* Attribute groups (Identity & Ownership, Amenities, …) */}
      {groups.map((group) => (
        <FilterSection
          key={group.id}
          title={group.name}
          active={group.values.some((v) => selectedAttrs.includes(v.slug))}
        >
          <div className="flex flex-col gap-1" role="group" aria-label={group.name}>
            {group.values.map((value) => {
              const isActive = selectedAttrs.includes(value.slug)
              const n = counts.attribute[value.id] ?? 0
              const disabled = !countsOff && !isActive && n === 0
              return (
                <label
                  key={value.id}
                  className={cn(
                    'flex items-center gap-2 text-sm font-subhead select-none',
                    disabled
                      ? 'text-charcoal-faint cursor-not-allowed'
                      : 'text-charcoal cursor-pointer hover:text-brand-black'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={disabled}
                    onChange={() => toggleCsv('attrs', value.slug)}
                    className="rounded border-charcoal/30 text-brand-black focus:ring-brand-black/20"
                  />
                  {value.name}
                  {!countsOff && <CountTag n={n} />}
                </label>
              )
            })}
          </div>
        </FilterSection>
      ))}

      <FilterSection title="Trust Level" active={!!activeTrust}>
        <div className="flex flex-col gap-1" role="group" aria-label="Filter by trust level">
          {TRUST_TIERS.map(({ value, label }) => {
            const isActive = activeTrust === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setParam('trust_tier', isActive ? '' : value)}
                className={optionClass(isActive)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </FilterSection>
    </aside>
  )
}
