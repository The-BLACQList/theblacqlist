/**
 * Server-side address geocoding via OpenStreetMap Nominatim.
 * Failure-tolerant: any error or non-match returns null (a listing with a
 * null lat/lng simply has no map pin). Called on address save — low volume,
 * within Nominatim's usage policy (identified User-Agent, no bulk here;
 * bulk backfills use scripts/geocode-listings.ts at 1 req/s).
 */

const USER_AGENT = 'TheBLACQList/1.0 (hello@theblacqlist.com)'

function cleanStreet(address: string): string {
  return address
    .replace(/(?:[,\s]*)(suite|ste\.?|unit|apt\.?|#|floor|fl\.?|bldg\.?)\s*[\w-]*\s*$/i, '')
    .replace(/\s*(suite|ste\.?|unit|apt\.?)\s*[\w-]+/gi, '')
    .trim()
    .replace(/,+$/, '')
}

export async function geocodeAddress(input: {
  address: string
  city?: string | null
  state?: string | null
  zip?: string | null
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      countrycodes: 'us',
      street: cleanStreet(input.address),
    })
    if (input.city) params.set('city', input.city)
    if (input.state) params.set('state', input.state)
    if (input.zip) params.set('postalcode', input.zip)

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const results = (await res.json()) as Array<{ lat: string; lon: string }>
    const first = results[0]
    if (!first) return null
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
  } catch {
    return null
  }
}
