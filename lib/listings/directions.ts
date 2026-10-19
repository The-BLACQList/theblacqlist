// One Google Maps directions link for every "Directions" button (map popup,
// quick action bar, At a Glance). Google's documented Maps URLs format opens
// straight into directions, hands off to the app on phones, and needs no key:
// https://developers.google.com/maps/documentation/urls/get-started
//
// The destination is the business name plus its street address, so Google
// shows the place instead of raw coordinates. Coordinates are only the
// fallback for a listing with no street address; a label on bare coordinates
// would need a Google Place ID, which we don't store.

const DIRECTIONS_BASE = 'https://www.google.com/maps/dir/?api=1&destination='

export interface DirectionsPlace {
  name: string
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  lat?: number | null
  lng?: number | null
}

/** The directions link for a place, or null when there is nowhere to send people. */
export function directionsUrl(p: DirectionsPlace): string | null {
  const street = p.street?.trim()
  if (street) {
    const stateZip = [p.state?.trim(), p.zip?.trim()].filter(Boolean).join(' ')
    const destination = [p.name.trim(), street, p.city?.trim(), stateZip]
      .filter(Boolean)
      .join(', ')
    return DIRECTIONS_BASE + encodeURIComponent(destination)
  }
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return DIRECTIONS_BASE + encodeURIComponent(`${p.lat},${p.lng}`)
  }
  return null
}
