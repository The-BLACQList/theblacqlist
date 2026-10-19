'use client'

// Shows how far the listing is from the visitor, under the address in At a
// Glance. The browser only asks for location when the visitor taps, unless
// they already allowed it for this site, in which case the line just appears.

import { useEffect, useState } from 'react'
import { LoaderCircle, Navigation } from 'lucide-react'
import { distanceFromYouLabel } from '@/lib/listings/distanceFromYou'

type State =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'done'; label: string }
  | { kind: 'denied' | 'unavailable' | 'unsupported' }

const FAILURE_COPY = {
  denied: 'Location is turned off for this site. You can turn it on in your browser settings.',
  unavailable: 'We could not get your location just now. Try again in a moment.',
  unsupported: 'This browser cannot share a location.',
} as const

interface Props {
  lat: number
  lng: number
}

export function DistanceFromYou({ lat, lng }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ kind: 'unsupported' })
      return
    }
    setState({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const label = distanceFromYouLabel(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { lat, lng }
        )
        setState(label ? { kind: 'done', label } : { kind: 'unavailable' })
      },
      (err) => {
        setState({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  // Already allowed: no prompt will show, so fill the line in straight away.
  useEffect(() => {
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') locate()
      })
      .catch(() => {
        // Some browsers cannot query this permission. The button still works.
      })
    return () => {
      cancelled = true
    }
    // Run once per listing; locate reads lat/lng from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <div aria-live="polite" className="mt-2 pl-6">
      {state.kind === 'done' ? (
        <p className="font-body text-sm text-charcoal">{state.label}</p>
      ) : state.kind === 'locating' ? (
        <p className="inline-flex items-center gap-2 font-subhead text-sm text-charcoal">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Finding your location
        </p>
      ) : (
        <div className="space-y-1">
          {state.kind !== 'idle' && (
            <p className="font-subhead text-xs text-charcoal-soft">{FAILURE_COPY[state.kind]}</p>
          )}
          {state.kind !== 'unsupported' && (
            <button
              type="button"
              onClick={locate}
              className="inline-flex min-h-11 items-center gap-2 font-subhead text-sm text-charcoal underline underline-offset-2 hover:text-brand-black"
            >
              <Navigation className="size-4 text-amber" aria-hidden="true" />
              {state.kind === 'idle' ? 'How far is it from me?' : 'Try again'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
