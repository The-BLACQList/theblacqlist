// "About 2.3 mi from you" on the listing page (tester ask, 2026-10-19).
// Straight-line miles, the same haversine the map and the search RPC use, so
// the number matches what the map list shows for the same listing.

import { distanceMiles, formatMiles, type LatLng } from '@/lib/map/distance'

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
