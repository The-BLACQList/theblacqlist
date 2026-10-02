'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle, MapPin } from 'lucide-react'
import { nearMeHref } from '@/lib/listings/location-params'

type LocateState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'unsupported'

/** Same wording as the Discover Near You filter, pointed at the city browse instead. */
const FAILURE_COPY: Record<'denied' | 'unavailable' | 'unsupported', string> = {
  denied: 'Location is off for this site. Turn it on in your browser settings, or browse by city.',
  unavailable: 'We could not get your location just now. Try again, or browse by city.',
  unsupported: 'This browser cannot share a location. Browse by city instead.',
}

const CHIP =
  'inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-off-white/40 bg-off-white/10 text-off-white font-subhead text-[13px] font-semibold backdrop-blur-sm hover:bg-off-white/20 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'

interface Props {
  filters: readonly { label: string; href: string }[]
}

/**
 * The hero's quick filters, led by Near me. Near me asks the browser for a
 * position and opens Discover nearest first. The position is only rounded and
 * put in that URL; it is never logged or stored here.
 */
export function HeroQuickFilters({ filters }: Props) {
  const router = useRouter()
  const [state, setState] = useState<LocateState>('idle')

  function findNearMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => router.push(nearMeHref(pos.coords.latitude, pos.coords.longitude)),
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  const locating = state === 'locating'
  const failure = state === 'denied' || state === 'unavailable' || state === 'unsupported' ? state : null

  return (
    <>
      <ul className="flex flex-wrap gap-2 mt-4 list-none p-0 m-0" aria-label="Quick filters">
        <li>
          <button
            type="button"
            onClick={findNearMe}
            disabled={locating}
            aria-busy={locating}
            className={`${CHIP} disabled:cursor-wait`}
          >
            {locating ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <MapPin className="size-4" aria-hidden="true" />
            )}
            {locating ? 'Finding you…' : 'Near me'}
          </button>
        </li>
        {filters.map((filter) => (
          <li key={filter.label}>
            <Link href={filter.href} className={CHIP}>
              {filter.label}
            </Link>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 max-w-[46ch] font-body text-sm text-off-white/90 empty:hidden">
        {failure && (
          <>
            {FAILURE_COPY[failure]}{' '}
            <Link
              href="/discover"
              className="font-semibold text-gold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Browse by city
            </Link>
          </>
        )}
      </p>
    </>
  )
}
