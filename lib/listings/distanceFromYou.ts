// "About 2.3 mi from you" on the listing page (tester ask, 2026-10-19).
// Straight-line miles, the same haversine the map and the search RPC use, so
// the number matches what the map list shows for the same listing.

import { distanceMiles, formatMiles, type LatLng } from '@/lib/map/distance'
import type { DiscoveryEntity, LocationType } from '@/types'

/** The line under the address, or null when the listing has no pin. */
export function distanceFromYouLabel(
  you: LatLng,
  place: { lat: number | null; lng: number | null }
): string | null {
  if (place.lat == null || place.lng == null) return null
  const miles = distanceMiles(you, { lat: place.lat, lng: place.lng })
  // formatMiles would print "0.0 mi" for someone standing outside the door.
  if (miles < 0.1) return 'Less than 0.1 mi from you'
  return `About ${formatMiles(miles)} from you`
}

// Online-only and ships-nationwide listings may still carry a pin (an office,
// a warehouse), but a distance on their card would suggest a place to visit.
const NO_DISTANCE_TYPES: ReadonlySet<LocationType> = new Set(['virtual', 'national'])

/**
 * The card line on Discover and Search (ticket 141). Same words and math as
 * the listing page, or null when the card should show nothing.
 */
export function cardDistanceLabel(
  you: LatLng | null,
  entity: Pick<DiscoveryEntity, 'location_type' | 'lat' | 'lng'>
): string | null {
  if (!you || NO_DISTANCE_TYPES.has(entity.location_type)) return null
  return distanceFromYouLabel(you, { lat: entity.lat ?? null, lng: entity.lng ?? null })
}
