/**
 * The assistant's Near me (ticket 147).
 *
 * Only an ask that says "near me" (or close to it) asks the browser for a
 * position. The server rounds it and uses it for our search only; it never
 * goes to the AI. A refusal or timeout means the ask goes without it.
 */

const NEAR_WORDS = /\b(near me|nearby|close to me|around me|closest)\b/i

export function wantsNearMe(text: string): boolean {
  return NEAR_WORDS.test(text)
}

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
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  })
}
