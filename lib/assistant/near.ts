/**
 * The assistant's Near me (ticket 147).
 *
 * Only an ask that says "near me" (or close to it) asks the browser for a
 * position. It is rounded here, before it leaves the browser (about 100 m),
 * and again on the server, which uses it for our search only; it never goes
 * to the AI. A refusal or timeout means the ask goes without it.
 *
 * Cue (ticket 148) also asks again for a follow-up that names no place when
 * the last answer used Near me, so "what about dentists?" stays near you. The
 * chat keeps only that the last answer was near, never the position.
 */

const NEAR_WORDS =
  /\b(near me|near by|nearby|close to me|close by|around me|around here|near here|in my area|closest)\b/i

export function wantsNearMe(text: string): boolean {
  return NEAR_WORDS.test(text)
}

import { roundCoord } from '@/lib/listings/location-params'

export interface NearPoint {
  lat: number
  lng: number
}

export function getNearPoint(): Promise<NearPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  })
}
