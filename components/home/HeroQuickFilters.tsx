'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle, MapPin } from 'lucide-react'
import { nearMeHref } from '@/lib/listings/location-params'

/** Where Near me lands when there is no position to use. */
const FALLBACK_HREF = '/discover'

const CHIP =
  'inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-off-white/40 bg-off-white/10 text-off-white font-subhead text-[13px] font-semibold backdrop-blur-sm hover:bg-off-white/20 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'

interface Props {
  filters: readonly { label: string; href: string }[]
}

/**
 * The hero's quick filters, led by Near me. A tap asks the browser for a
 * position, which shows the browser's own Allow prompt the first time. With a
 * position it opens Discover nearest first. Without one (blocked, unsupported,
 * timed out) it still opens Discover, so the visitor never hits a dead end or
 * a settings message on the home page. The position is only rounded and put
 * in that URL; it is never logged or stored here.
 */
export function HeroQuickFilters({ filters }: Props) {
  const router = useRouter()
  const [locating, setLocating] = useState(false)

  function findNearMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      router.push(FALLBACK_HREF)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => router.push(nearMeHref(pos.coords.latitude, pos.coords.longitude)),
      () => router.push(FALLBACK_HREF),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

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
      <p role="status" className="sr-only">
        {locating ? 'Finding businesses near you' : ''}
      </p>
    </>
  )
}
