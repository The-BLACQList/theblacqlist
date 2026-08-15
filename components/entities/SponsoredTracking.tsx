'use client'

// Delivery telemetry for sponsored placements.
//
// Why these are client components at all: the sponsored splice happens in
// lib/listings/query.ts, which runs inside an ISR page
// (app/[citySlug]/[entityType]/page.tsx has `revalidate = 86400`). Counting
// server-side there would record one impression per REVALIDATION rather than
// per view — off by orders of magnitude — and `after()` is not available during
// the build-time prerender at all. Client-side is the only place these numbers
// can be true. The trade is that they are browser-reported, same trust level as
// page_view and cta_click; see lib/analytics/constants.ts for what that means
// before quoting them to a sponsor.
//
// entity_id is the PLACEMENT id, never the listing id. A sponsor buys a
// placement, and the same listing can hold several over time.

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

const ENTITY_TYPE = 'sponsored_placement'

interface SponsoredDelivery {
  placementId: string
  listingId: string
  position?: number
}

/**
 * Fires one impression when the card mounts.
 *
 * Renders nothing. Mounted only on sponsored cards (at most three per page), so
 * this does not turn the whole results grid into client components.
 *
 * Not viewport-verified on purpose — a card below the fold still counts. That
 * is a documented property of the metric, not an oversight; adding an
 * IntersectionObserver would change what the number means and the admin copy
 * would have to change with it.
 */
export function SponsoredImpression({ placementId, listingId, position }: SponsoredDelivery) {
  // React StrictMode double-invokes effects in development. The fiber is not
  // remounted between the two invocations, so a ref survives and de-dupes them.
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track({
      event_name: ANALYTICS_EVENTS.SPONSORED_IMPRESSION,
      entity_type: ENTITY_TYPE,
      entity_id: placementId,
      properties: { listing_id: listingId, position },
    })
  }, [placementId, listingId, position])

  return null
}

interface SponsoredLinkProps extends SponsoredDelivery {
  href: string
  className?: string
  children: React.ReactNode
}

/**
 * A Link that reports a click before navigating.
 *
 * `track` uses sendBeacon, which is specified to survive the page unload that
 * follows — so this does not need to delay or intercept the navigation.
 */
export function SponsoredLink({
  href,
  className,
  children,
  placementId,
  listingId,
  position,
}: SponsoredLinkProps) {
  return (
    <Link
      href={href as Route}
      className={className}
      onClick={() => {
        track({
          event_name: ANALYTICS_EVENTS.SPONSORED_CLICK,
          entity_type: ENTITY_TYPE,
          entity_id: placementId,
          properties: { listing_id: listingId, position },
        })
      }}
    >
      {children}
    </Link>
  )
}
