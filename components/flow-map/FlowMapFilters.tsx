'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { SlidersHorizontal, X } from 'lucide-react'

interface Option {
  name: string
  slug: string
}

interface FlowMapFiltersProps {
  cities: Option[]
  categories: Option[]
}

/**
 * City and category filters for the community dollar-flow map.
 *
 * The URL is the state (shareable, survives refresh, readable by the server
 * component that does the querying), and a change applies immediately with no
 * submit button. Only two keys are owned here: `city` and `category`.
 */
export function FlowMapFilters({ cities, categories }: FlowMapFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCity = searchParams.get('city') ?? ''
  const activeCategory = searchParams.get('category') ?? ''

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      const qs = params.toString()
      router.push((qs ? `${pathname}?${qs}` : pathname) as Route)
    },
    [searchParams, pathname, router]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('city')
    params.delete('category')
    const qs = params.toString()
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route)
  }, [searchParams, pathname, router])

  const cityLabel = cities.find((c) => c.slug === activeCity)?.name ?? activeCity
  const categoryLabel = categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory
  const hasActiveFilters = !!(activeCity || activeCategory)

  return (
    <div className="rounded-xl bg-white border border-charcoal/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline text-base text-brand-black flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-charcoal-soft" aria-hidden="true" />
          Filter by city or category
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="font-subhead text-xs text-charcoal underline underline-offset-2 hover:text-brand-black"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="flow-map-city"
            className="block font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5"
          >
            City
          </label>
          <select
            id="flow-map-city"
            value={activeCity}
            onChange={(e) => setParam('city', e.target.value)}
            className="w-full h-10 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
          >
            <option value="">All cities</option>
            {cities.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="flow-map-category"
            className="block font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5"
          >
            Category
          </label>
          <select
            id="flow-map-category"
            value={activeCategory}
            onChange={(e) => setParam('category', e.target.value)}
            className="w-full h-10 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
          >
            <option value="">All categories</option>
            {categories.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {activeCity && (
            <button
              type="button"
              onClick={() => setParam('city', '')}
              className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full bg-pale-lavender font-subhead text-xs font-semibold text-brand-black hover:bg-charcoal/10 transition-colors"
            >
              {cityLabel}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove city filter</span>
            </button>
          )}
          {activeCategory && (
            <button
              type="button"
              onClick={() => setParam('category', '')}
              className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full bg-pale-lavender font-subhead text-xs font-semibold text-brand-black hover:bg-charcoal/10 transition-colors"
            >
              {categoryLabel}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove category filter</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
