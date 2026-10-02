/** A point as the map and the browser hand it to us. */
export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_MILES = 3958.8
const MILES_PER_DEGREE_LAT = 69.0
const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Great-circle distance in miles. The same haversine the search RPC uses, run
 * in the browser because the map already holds every pinned listing.
 */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The box around a radius, as [[west, south], [east, north]] for fitBounds. */
export function radiusBounds(center: LatLng, miles: number): [[number, number], [number, number]] {
  const dLat = miles / MILES_PER_DEGREE_LAT
  const dLng = miles / (MILES_PER_DEGREE_LAT * Math.max(Math.cos(toRad(center.lat)), 0.01))
  return [
    [center.lng - dLng, center.lat - dLat],
    [center.lng + dLng, center.lat + dLat],
  ]
}

/** A closed ring of [lng, lat] points tracing the radius, for the map outline. */
export function radiusRing(center: LatLng, miles: number, steps = 64): [number, number][] {
  const dLat = miles / MILES_PER_DEGREE_LAT
  const dLng = miles / (MILES_PER_DEGREE_LAT * Math.max(Math.cos(toRad(center.lat)), 0.01))
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    ring.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)])
  }
  return ring
}

/** "0.4 mi" under a mile, whole-ish miles above it. */
export function formatMiles(miles: number): string {
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
}
