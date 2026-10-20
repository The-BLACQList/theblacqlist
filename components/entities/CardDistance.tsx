'use client'

// "About 2.3 mi from you" on Discover and Search cards (ticket 141).
//
// The provider finds the shopper's position once per page, never once per
// card. It uses the Near You point when the URL has one, and otherwise asks
// the browser only when location is already allowed for this site, so a list
// never shows a prompt. The position stays in the browser: it is not sent,
// logged or written to the URL.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { cardDistanceLabel } from '@/lib/listings/distanceFromYou'
import type { LatLng } from '@/lib/map/distance'
import type { DiscoveryEntity } from '@/types'

const PositionContext = createContext<LatLng | null>(null)

interface ProviderProps {
  /** The Near You point from the URL, when a Near You search is on. */
  origin: LatLng | null
  children: ReactNode
}

export function CardDistanceProvider({ origin, children }: ProviderProps) {
  const [allowed, setAllowed] = useState<LatLng | null>(null)

  useEffect(() => {
    if (origin) return
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            if (!cancelled) setAllowed({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          },
          () => {
            // No line on failure. The cards read the same as before.
          },
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
        )
      })
      .catch(() => {
        // Some browsers cannot query this permission. Without it we never ask.
      })
    return () => {
      cancelled = true
    }
  }, [origin])

  return <PositionContext.Provider value={origin ?? allowed}>{children}</PositionContext.Provider>
}

interface Props {
  entity: Pick<DiscoveryEntity, 'location_type' | 'lat' | 'lng'>
}

/** The card line. Renders nothing outside a provider or without a position. */
export function CardDistance({ entity }: Props) {
  const label = cardDistanceLabel(useContext(PositionContext), entity)
  if (!label) return null
  return <p className="text-xs font-subhead text-charcoal">{label}</p>
}
