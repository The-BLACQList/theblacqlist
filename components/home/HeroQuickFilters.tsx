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

export interface QuickFilter {
  label: string
  href: string
}

export interface NearPoint {
  lat: number
  lng: number
}

interface Props {
  filters: readonly QuickFilter[]
  /**
   * Guide mode (ticket 146). Set, the chips feed the AI bar instead of opening
   * a page: a chip hands over its label, Near me hands over a position (or
   * null when there is none to use).
   */
  onPick?: (words: string) => void
  onNear?: (near: NearPoint | null) => void
  /** Guide mode only: Near me is switched on. */
  nearOn?: boolean
}

/**
 * The hero's quick filters, led by Near me. A tap asks the browser for a
 * position, which shows the browser's own Allow prompt the first time. With a
 * position it opens Discover nearest first. Without one (blocked, unsupported,
 * timed out) it still opens Discover, so the visitor never hits a dead end or
 * a settings message on the home page. The position is only rounded and put
 * in that URL; it is never logged or stored here.
 *
 * In guide mode Near me is a switch: on, it hands the guide a position; on
 * again, it turns off. The other chips ask the guide instead of linking.
 */
export function HeroQuickFilters({ filters, onPick, onNear, nearOn = false }: Props) {
  const router = useRouter()
  const [locating, setLocating] = useState(false)
  const guideMode = Boolean(onPick && onNear)

  function findNearMe() {
    if (guideMode && nearOn) {
      onNear?.(null)
      return
    }
    // Leaving the page keeps the spinner up until the next page shows.
    const done = (near: NearPoint | null) => {
      if (!guideMode) {
        router.push(near ? nearMeHref(near.lat, near.lng) : FALLBACK_HREF)
        return
      }
      setLocating(false)
      onNear?.(near)
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      done(null)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => done({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => done(null),
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
            aria-pressed={guideMode ? nearOn : undefined}
            className={`${CHIP} disabled:cursor-wait aria-pressed:bg-gold aria-pressed:text-brand-black aria-pressed:border-gold`}
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
            {guideMode ? (
              <button type="button" onClick={() => onPick?.(filter.label)} className={CHIP}>
                {filter.label}
              </button>
            ) : (
              <Link href={filter.href} className={CHIP}>
                {filter.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {locating ? 'Finding businesses near you' : ''}
      </p>
    </>
  )
}
