'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, LocateFixed, X } from 'lucide-react'

import type { PlaceSuggestion } from '@/lib/geo/placeQueries'

/**
 * "Your City" in onboarding (ticket 230): type any US city or town and pick it
 * from suggestions, or tap "Use My Location".
 *
 * Suggestions come from our own copy of the Census place list
 * (/api/places/suggest), so nothing a person types goes to an outside company.
 * "Use My Location" rounds the position to 2 decimals in the browser (about a
 * kilometre) before asking /api/places/nearest which place that is; the
 * position is never saved.
 *
 * Modelled on components/spend/ListingCombobox.tsx: a pick locks into a chip
 * with a clear button, so the typed words can never disagree with the place
 * that is sent. Unlike that field, free text is never sent — a home city has
 * to be a real place, and Skip is the way to leave it empty.
 */

interface Props {
  id: string
  value: PlaceSuggestion | null
  onChange: (place: PlaceSuggestion | null) => void
  className: string
  describedBy?: string
}

export const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 200

type LocateState = 'idle' | 'locating' | 'failed' | 'none'

/** Two decimals is about a kilometre: enough to name a town, not a street. */
export function roundForPlace(value: number): number {
  return Math.round(value * 100) / 100
}

export function CityCombobox({ id, value, onChange, className, describedBy }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [locate, setLocate] = useState<LocateState>('idle')

  const listboxId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) return
    const trimmed = query.trim()
    // Below the threshold the change handler has already cleared the list.
    if (trimmed.length < MIN_QUERY_LENGTH) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const json: { data?: { places?: PlaceSuggestion[] } } = res.ok ? await res.json() : {}
        setResults(json.data?.places ?? [])
        setSearched(true)
        setHighlight(-1)
        setOpen(true)
      } catch {
        // An abort is the expected path on every keystroke.
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, value])

  function onQueryChange(next: string) {
    setQuery(next)
    setSearched(false)
    if (locate !== 'locating') setLocate('idle')
    if (next.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setOpen(false)
      setHighlight(-1)
      setLoading(false)
    }
  }

  function select(place: PlaceSuggestion) {
    onChange(place)
    setQuery('')
    setResults([])
    setOpen(false)
    setSearched(false)
    setHighlight(-1)
  }

  function clearSelection() {
    onChange(null)
    setLocate('idle')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function locateMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocate('failed')
      return
    }
    setLocate('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = roundForPlace(pos.coords.latitude)
          const lng = roundForPlace(pos.coords.longitude)
          const res = await fetch(`/api/places/nearest?lat=${lat}&lng=${lng}`)
          const json: { data?: { place?: PlaceSuggestion | null } } = res.ok ? await res.json() : {}
          const place = json.data?.place ?? null
          if (place) {
            setLocate('idle')
            select(place)
          } else {
            setLocate('none')
          }
        } catch {
          setLocate('failed')
        }
      },
      () => setLocate('failed'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
      return
    }
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault()
        setOpen(true)
        setHighlight(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted place, or the first one when only one
      // matches. It never submits: step 1 has no form.
      const choice = results[highlight] ?? (results.length === 1 ? results[0] : undefined)
      if (choice) {
        e.preventDefault()
        select(choice)
      }
    }
  }

  if (value) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-charcoal/20 bg-pale-lavender/30 px-3 py-1">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="size-4 flex-shrink-0 text-amber" aria-hidden="true" />
            <span
              className="truncate font-subhead text-sm text-brand-black"
              data-testid="city-chip"
            >
              {value.label}
            </span>
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="flex size-11 flex-shrink-0 items-center justify-center rounded-md text-charcoal-soft hover:text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-black/20"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Clear {value.label}</span>
          </button>
        </div>
      </div>
    )
  }

  const noMatch =
    searched && !loading && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0
  const locateNote =
    locate === 'failed'
      ? 'We couldn’t get your location. Type your city instead.'
      : locate === 'none'
        ? 'We couldn’t find a US city near you. Type your city instead.'
        : ''

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          maxLength={60}
          placeholder="Start typing, e.g. Decatur"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-describedby={[describedBy, hintId].filter(Boolean).join(' ') || undefined}
          aria-activedescendant={
            open && highlight >= 0 ? `${listboxId}-option-${highlight}` : undefined
          }
          className={className}
        />

        {loading && (
          <Loader2
            className="absolute right-3 top-3.5 size-4 animate-spin text-charcoal-soft"
            aria-hidden="true"
          />
        )}

        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching US cities"
          className={
            open && results.length > 0
              ? 'absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-charcoal/20 bg-white py-1 shadow-lg'
              : 'hidden'
          }
        >
          {results.map((place, i) => (
            <li
              key={place.geoid}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault()
                select(place)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex min-h-11 cursor-pointer items-center px-3 py-2 font-subhead text-sm text-brand-black ${
                i === highlight ? 'bg-pale-lavender/50' : ''
              }`}
            >
              {place.label}
            </li>
          ))}
        </ul>
      </div>

      <p id={hintId} className="font-subhead text-xs text-charcoal-soft" aria-live="polite">
        {noMatch ? 'No US city found. Check the spelling, or skip for now.' : locateNote}
      </p>

      <button
        type="button"
        onClick={locateMe}
        disabled={locate === 'locating'}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-charcoal/30 bg-white px-3 font-subhead text-sm text-brand-black transition-colors hover:border-brand-black disabled:opacity-60"
      >
        {locate === 'locating' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LocateFixed className="size-4" aria-hidden="true" />
        )}
        {locate === 'locating' ? 'Finding You…' : 'Use My Location'}
      </button>

      <p aria-live="polite" role="status" className="sr-only">
        {open && results.length > 0
          ? `${results.length} ${results.length === 1 ? 'city' : 'cities'} found. Use arrow keys to review.`
          : ''}
      </p>
    </div>
  )
}
