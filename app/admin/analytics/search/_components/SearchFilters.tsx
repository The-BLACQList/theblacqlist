'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface City {
  slug: string
  name: string
}

interface Props {
  cities: City[]
  period: string
  city: string
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

export function SearchFilters({ cities, period, city }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || (key === 'period' && value === '30d') || (key === 'city' && !value)) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const hasNonDefault = period !== '30d' || !!city

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="period-select" className="font-subhead text-xs text-charcoal-soft">
          Period
        </label>
        <select
          id="period-select"
          value={period}
          onChange={(e) => setParam('period', e.target.value)}
          className="h-9 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="city-select" className="font-subhead text-xs text-charcoal-soft">
          City
        </label>
        <select
          id="city-select"
          value={city}
          onChange={(e) => setParam('city', e.target.value || null)}
          className="h-9 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {hasNonDefault && (
        <button
          onClick={() => router.replace(pathname)}
          className="mt-5 font-body text-xs text-charcoal-soft hover:text-brand-black underline underline-offset-2 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
