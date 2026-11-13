'use client'

import { useId, useState } from 'react'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFacetParams } from '@/components/discovery/useFacetParams'
import { ORDER_PLATFORMS, ORDER_PLATFORM_IDS, parseZip } from '@/lib/listings/whereSold'

// "Where to buy" on Discover (owner-experience round 2, part D): one button per
// delivery app (`order_on`, matching a page on ANY picked app) and a "Sold near"
// zip (`sold_near`), which matches pages stocked in a store at that zip or
// nationwide. No counts: facet_counts has no rows for these, and a missing
// badge is honest where a 0 would not be.

function optionClass(isActive: boolean): string {
  return cn(
    'text-left px-3 py-1.5 rounded-lg text-sm font-subhead transition-colors',
    isActive
      ? 'bg-brand-black text-white font-semibold'
      : 'text-charcoal hover:bg-pale-lavender hover:text-brand-black'
  )
}

export function WhereToBuyFilter() {
  const { searchParams, getCsv, toggleCsv } = useFacetParams()
  const selected = getCsv('order_on')
  const current = searchParams.get('sold_near') ?? ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1" role="group" aria-label="Order on">
        {ORDER_PLATFORM_IDS.map((p) => {
          const isActive = selected.includes(p)
          return (
            <button
              key={p}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggleCsv('order_on', p)}
              className={optionClass(isActive)}
            >
              Order on {ORDER_PLATFORMS[p].label}
            </button>
          )
        })}
      </div>
      {/* Keyed on the URL value, so a chip removal or Clear all resets the box. */}
      <SoldNearInput key={current} current={current} />
    </div>
  )
}

function SoldNearInput({ current }: { current: string }) {
  const { setParam } = useFacetParams()
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string | null>(null)
  // The sidebar can be on the page twice (desktop and the mobile sheet).
  const id = useId()
  const inputId = `${id}-zip`
  const errorId = `${id}-error`

  function apply() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(null)
      if (current) setParam('sold_near', '')
      return
    }
    const zip = parseZip(trimmed)
    if (!zip) {
      setError('Enter a 5-digit zip code')
      return
    }
    setError(null)
    if (zip !== current) setParam('sold_near', zip)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <label
        htmlFor={inputId}
        className="flex items-center gap-1.5 mb-1 font-subhead text-xs font-semibold text-charcoal"
      >
        <MapPin className="size-3.5" aria-hidden="true" />
        Sold in stores near
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          placeholder="Zip code"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setError(null)
            setValue(e.target.value)
          }}
          className="min-w-0 flex-1 h-9 rounded-lg border border-charcoal/30 bg-white px-3 font-subhead text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-lg bg-brand-black px-3 font-subhead text-sm font-semibold text-white hover:bg-charcoal"
        >
          Go
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 font-body text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
