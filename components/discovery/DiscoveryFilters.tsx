'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Route } from 'next'
import { SlidersHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { EntityType } from '@/types'

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'business', label: 'Businesses' },
  { value: 'professional', label: 'Professionals' },
  { value: 'creative', label: 'Creatives' },
  { value: 'event', label: 'Events' },
  { value: 'job', label: 'Jobs' },
  { value: 'vendor', label: 'Vendors' },
]

const CATEGORIES = [
  { value: 'food-dining', label: 'Food & Dining' },
  { value: 'beauty-grooming', label: 'Beauty & Grooming' },
  { value: 'wellness-health', label: 'Wellness & Health' },
  { value: 'fashion-apparel', label: 'Fashion & Apparel' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'creative-media', label: 'Creative & Media' },
  { value: 'home-living', label: 'Home & Living' },
  { value: 'events-entertainment', label: 'Events & Entertainment' },
  { value: 'education-tutoring', label: 'Education & Tutoring' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal-financial', label: 'Legal & Financial' },
  { value: 'retail-gifts', label: 'Retail & Gifts' },
  { value: 'photography-videography', label: 'Photography & Videography' },
  { value: 'social-media-marketing', label: 'Social Media & Marketing' },
  { value: 'books-publishing', label: 'Books & Publishing' },
  { value: 'construction-trades', label: 'Construction & Trades' },
  { value: 'arts-culture', label: 'Arts & Culture' },
  { value: 'childcare-family', label: 'Childcare & Family' },
  { value: 'spiritual-community', label: 'Spiritual & Community' },
  { value: 'travel-transportation', label: 'Travel & Transportation' },
  { value: 'pet-services', label: 'Pet Services' },
  {
    value: 'agriculture-sustainability',
    label: 'Agriculture & Sustainability',
  },
  { value: 'staffing-workforce', label: 'Staffing & Workforce' },
]

interface DiscoveryFiltersProps {
  className?: string
  cities?: { name: string; slug: string }[]
  hideCityFilter?: boolean
}

export function DiscoveryFilters({
  className,
  cities = [],
  hideCityFilter = false,
}: DiscoveryFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeType = searchParams.get('type') ?? ''
  const activeCategory = searchParams.get('category') ?? ''
  const activeCity = searchParams.get('city') ?? ''

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}` as Route)
    },
    [searchParams, pathname, router]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('type')
    params.delete('category')
    if (!hideCityFilter) params.delete('city')
    router.push(`${pathname}?${params.toString()}` as Route)
  }, [searchParams, pathname, router, hideCityFilter])

  const hasActiveFilters = !!(activeType || activeCategory || (!hideCityFilter && activeCity))

  return (
    <aside aria-label="Discovery filters" className={cn('flex flex-col gap-5', className)}>
      {/* Header row */}
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

      {/* Entity type filter — functional */}
      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
          Type
        </legend>
        <div className="flex flex-col gap-1">
          {ENTITY_TYPES.map(({ value, label }) => {
            const isActive = activeType === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setParam('type', isActive ? '' : value)}
                className={cn(
                  'text-left px-3 py-1.5 rounded-lg text-sm font-subhead transition-colors',
                  isActive
                    ? 'bg-brand-black text-white font-semibold'
                    : 'text-charcoal hover:bg-pale-lavender hover:text-brand-black'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Category filter — functional */}
      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
          Category
        </legend>
        <select
          value={activeCategory}
          onChange={(e) => setParam('category', e.target.value)}
          aria-label="Filter by category"
          className="w-full h-10 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </fieldset>

      {/* City filter — hidden on city landing pages */}
      {!hideCityFilter && (
        <fieldset>
          <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
            City
          </legend>
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
        </fieldset>
      )}

      {/* Location type stub */}
      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
          Availability
        </legend>
        <div className="flex flex-col gap-1">
          {['Online / Virtual', 'Ships Nationwide', 'In-Person'].map((label) => (
            <label
              key={label}
              className="flex items-center gap-2 text-sm font-subhead text-charcoal-soft cursor-not-allowed select-none"
            >
              <input
                type="checkbox"
                disabled
                className="rounded border-charcoal/20"
                aria-label={`${label} (coming soon)`}
              />
              {label}
              <span className="ml-auto text-[10px] text-charcoal-faint uppercase tracking-wide">
                Soon
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Trust tier stub */}
      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
          Trust Level
        </legend>
        <label className="flex items-center gap-2 text-sm font-subhead text-charcoal-soft cursor-not-allowed select-none">
          <input
            type="checkbox"
            disabled
            className="rounded border-charcoal/20"
            aria-label="Verified only (coming soon)"
          />
          Verified &amp; Certified only
          <span className="ml-auto text-[10px] text-charcoal-faint uppercase tracking-wide">Soon</span>
        </label>
      </fieldset>
    </aside>
  )
}
