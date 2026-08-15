/**
 * The "Near You" URL contract, in one place.
 *
 * `lat`, `lng` and `radius` are three URL keys describing one filter, and the
 * database treats a partial one as no filter at all: `search_listings_faceted`
 * short-circuits its whole radius predicate to TRUE the moment any of the three
 * is NULL. So a URL carrying `?radius=10` with no coordinates would return the
 * entire unfiltered directory while the page around it says "within 10 miles".
 *
 * The API route closes that at the schema boundary (`lib/validations/search.ts`
 * rejects a partial location with a 400). Server-rendered pages hand-parse their
 * searchParams instead, so they close it here: the triple is parsed all-or-
 * nothing, and an incomplete or out-of-range one is dropped whole — including
 * the distance sort that cannot outlive it. The visitor then gets an ordinary
 * unfiltered directory with no location UI, which is a truthful answer to a
 * malformed URL. What they must never get is unfiltered results wearing a
 * proximity label.
 */

/** The radii offered in the UI. Every value sits inside the schema's 0.1–500 range. */
export const RADIUS_OPTIONS = [1, 5, 10, 25] as const

/** What "Use my location" applies on its own, before the visitor narrows it. */
export const DEFAULT_RADIUS_MILES = 10

/**
 * Three decimals is roughly 110 m. That is far finer than any radius we offer
 * and far coarser than a doorstep, which matters because these coordinates go
 * into a URL that gets bookmarked, shared and written to server access logs.
 * We take the precision the filter needs and leave the rest in the browser.
 * (Coordinates are also deliberately never passed to logSearchEvent — C3.2.)
 */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Mirrors the bounds in lib/validations/search.ts. Change both together. */
const BOUNDS = {
  lat: [-90, 90],
  lng: [-180, 180],
  radius: [0.1, 500],
} as const

export interface LocationParams {
  lat: number
  lng: number
  radius: number
}

function num(raw: string | undefined, [min, max]: readonly [number, number]): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const value = Number(raw)
  // Number('') is 0 and lat=0/lng=0 is a real point in the Gulf of Guinea, which
  // is why the empty check above comes first rather than relying on the range.
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

/**
 * Returns the complete, in-range location triple, or null. Never returns a
 * partial one — see the note at the top of this file for why that matters.
 */
export function parseLocationParams(params: {
  lat?: string
  lng?: string
  radius?: string
}): LocationParams | null {
  const lat = num(params.lat, BOUNDS.lat)
  const lng = num(params.lng, BOUNDS.lng)
  const radius = num(params.radius, BOUNDS.radius)
  if (lat === null || lng === null || radius === null) return null
  return { lat, lng, radius }
}

/**
 * The next radius up from the current one, or null when already at the widest.
 * Drives the "Search a wider area" link on the radius empty state — offered only
 * when there is genuinely somewhere wider to go.
 */
export function widerRadius(current: number): number | null {
  return RADIUS_OPTIONS.find((option) => option > current) ?? null
}
