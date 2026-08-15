'use client'

import { useState } from 'react'
import { LoaderCircle, MapPin } from 'lucide-react'
import { useFacetParams, LOCATION_KEYS, clearEntries } from './useFacetParams'
// Shared with the server side of the page, which has to parse the same three
// keys back out of the URL and offer the next radius up on an empty result.
import {
  RADIUS_OPTIONS,
  DEFAULT_RADIUS_MILES,
  roundCoord,
  parseLocationFromQuery,
} from '@/lib/listings/location-params'

type LocateState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'unsupported'

/** The copy for each failure. Every one of them ends somewhere the visitor can go. */
const FAILURE_COPY: Record<'denied' | 'unavailable' | 'unsupported', string> = {
  denied:
    'Location is turned off for this site. You can turn it back on in your browser settings, or pick a city below.',
  unavailable:
    'We could not get your location just now. Try again, or pick a city below.',
  unsupported: 'This browser cannot share a location. Pick a city below instead.',
}

interface NearYouFilterProps {
  cities: { name: string; slug: string }[]
  /** False on a city page, where the city is already fixed by the route. */
  showCityFallback?: boolean
}

export function NearYouFilter({ cities, showCityFallback = true }: NearYouFilterProps) {
  const { searchParams, setParam, setParams } = useFacetParams()
  const [state, setState] = useState<LocateState>('idle')

  // Parsed, not merely present — the same all-or-nothing read the page does on
  // the server. A location the server dropped must not leave this control
  // showing a radius the results were never filtered by.
  const location = parseLocationFromQuery((key) => searchParams.get(key))
  const active = location !== null
  const radius = location?.radius ?? DEFAULT_RADIUS_MILES

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState('idle')
        // All three together: the search schema rejects a partial location.
        setParams({
          lat: String(roundCoord(pos.coords.latitude)),
          lng: String(roundCoord(pos.coords.longitude)),
          radius: String(DEFAULT_RADIUS_MILES),
        })
      },
      (err) => {
        setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  function clearLocation() {
    setState('idle')
    // clearEntries takes sort=distance with it — that sort cannot be honored
    // without coordinates, and the RPC's NULLS LAST would quietly fall through
    // to another key while the control still read "Nearest".
    setParams(clearEntries(LOCATION_KEYS, searchParams.get('sort')))
  }

  const failure = state === 'denied' || state === 'unavailable' || state === 'unsupported'

  return (
    <fieldset className="border-b border-charcoal/15 pb-4">
      <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
        Near You
      </legend>

      {active ? (
        <div className="space-y-2">
          <p className="font-subhead text-sm text-brand-black">
            Showing businesses within {radius} {radius === 1 ? 'mile' : 'miles'} of you.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Search radius">
            {RADIUS_OPTIONS.map((option) => {
              const selected = option === radius
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setParam('radius', String(option))}
                  className={`min-h-11 rounded-lg border px-3 font-subhead text-sm transition-colors ${
                    selected
                      ? 'border-brand-black bg-brand-black text-white'
                      : 'border-charcoal/30 bg-white text-brand-black hover:border-brand-black'
                  }`}
                >
                  {option} mi
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={clearLocation}
            className="font-subhead text-sm text-charcoal underline underline-offset-2 hover:text-brand-black min-h-11"
          >
            Turn off location
          </button>
          <p className="font-subhead text-xs text-charcoal-soft">
            Some businesses have not been mapped yet. Those will not show up in a
            distance search.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={locate}
            disabled={state === 'locating'}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-charcoal/30 bg-white px-3 font-subhead text-sm text-brand-black transition-colors hover:border-brand-black disabled:opacity-60"
          >
            {state === 'locating' ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MapPin className="size-4" aria-hidden="true" />
            )}
            {state === 'locating' ? 'Finding you' : 'Use my location'}
          </button>

          {failure ? (
            <div role="status" className="space-y-2">
              <p className="font-subhead text-sm text-charcoal">{FAILURE_COPY[state]}</p>

              {state === 'unavailable' ? (
                <button
                  type="button"
                  onClick={locate}
                  className="font-subhead text-sm text-brand-black underline underline-offset-2 min-h-11"
                >
                  Try again
                </button>
              ) : null}

              {showCityFallback ? (
                <label className="block">
                  <span className="font-subhead text-sm text-charcoal">Browse a city</span>
                  <select
                    value={searchParams.get('city') ?? ''}
                    onChange={(event) => setParam('city', event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-charcoal/30 bg-white px-2 font-subhead text-sm text-brand-black focus:border-brand-black focus:outline-none focus:ring-2 focus:ring-brand-black/20"
                  >
                    <option value="">Choose a city</option>
                    {cities.map((city) => (
                      <option key={city.slug} value={city.slug}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="font-subhead text-sm text-charcoal">
                  You are already browsing a city, so the listings below still apply.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </fieldset>
  )
}
