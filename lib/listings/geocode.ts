/**
 * Server-side address geocoding: OpenStreetMap Nominatim first, then the US
 * Census Bureau geocoder when Nominatim finds nothing.
 * Failure-tolerant: any error or non-match returns null (a listing with a
 * null lat/lng simply has no map pin). Called on address save — low volume,
 * within Nominatim's usage policy (identified User-Agent, no bulk here;
 * bulk backfills use scripts/geocode-listings.ts at 1 req/s).
 *
 * Why the fallback: Nominatim only matches a house number OpenStreetMap has
 * mapped, and many US addresses have none. The Census geocoder interpolates
 * along TIGER street ranges, so it resolves most of them. It is free, keyless
 * and US-only, which is all this directory needs.
 * [Measured 2026-10-15] Of 57 published staging rows with an address but no
 * pin, 50 now resolve (Census fallback, one retry, and the cleanStreet word
 * boundary fix below). The 7 left are addresses neither source knows.
 */

const USER_AGENT = 'TheBLACQList/1.0 (hello@theblacqlist.com)'

/**
 * A trailing unit designator: an optional separator, one or more unit keywords
 * (or a bare `#`), and the identifier that follows.
 *
 * The keyword group repeats — `+` rather than a single match — because the old
 * pattern alternated `#` against the words and so consumed only ONE of them.
 * `"5303 W Pico Blvd, Suite #01"` matched at the `#`, stripped ` #01`, and left
 * the dangling word `"Suite"` in the street line, which Nominatim cannot
 * resolve. `"50 Ernest W Barrett Pkwy NW Ste Suite 125"` failed the same way on
 * the doubled keyword. Both are real corpus addresses; both geocode once the
 * whole designator comes off in one pass.
 *
 * [Measured — docs/blacqlist/ops/geocode/geocode-failures-2026-08-07.json,
 * 2026-08-14] 2 of the 41 open unrecoverable failures carry this signature.
 *
 * The keyword set is unchanged from the original deliberately: `fl` and `bldg`
 * are ambiguous enough as street words that widening the list would trade one
 * failure class for another.
 */
const TRAILING_UNIT = /[,\s]*(?:(?:\b(?:suite|ste|unit|apt|floor|fl|bldg)\b\.?|#)\s*)+[\w-]*\s*$/i

/**
 * A trailing ordinal floor: `"1230 Peachtree St. NE 19th Fl"`. The number comes
 * before the keyword, so TRAILING_UNIT never sees it. Requiring the ordinal
 * suffix keeps a street named "Fl" or a house number safe.
 */
const TRAILING_ORDINAL_FLOOR = /[,\s]+\d+(?:st|nd|rd|th)\s+(?:fl|floor)\.?\s*$/i

function cleanStreet(address: string): string {
  return (
    address
      .replace(TRAILING_ORDINAL_FLOOR, '')
      .replace(TRAILING_UNIT, '')
      // Word boundaries matter: without them the "ste" inside Winchester,
      // Amsterdam, Lancaster or Foster read as a suite marker and was cut out
      // ("1725 Winchester Rd" became "1725 Winche Rd").
      .replace(/\s*\b(?:suite|ste|unit|apt)\b\.?\s*[\w-]+/gi, '')
      .trim()
      .replace(/,+$/, '')
  )
}

/** Exported for tests only — see tests/geocode-clean-street.test.ts. */
export const __cleanStreetForTest = cleanStreet

type GeocodeInput = {
  address: string
  city?: string | null
  state?: string | null
  zip?: string | null
}

type LatLng = { lat: number; lng: number }

export async function geocodeAddress(input: GeocodeInput): Promise<LatLng | null> {
  return (await geocodeNominatim(input)) ?? (await geocodeCensus(input))
}

async function geocodeNominatim(input: GeocodeInput): Promise<LatLng | null> {
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

type CensusMatch = {
  coordinates?: { x?: number; y?: number }
  addressComponents?: { city?: string; state?: string; zip?: string }
}

/**
 * The Census geocoder corrects street names loosely ("Bowden Ave" can come
 * back as "Bowen Ave"), so a match only counts when it lands in the same state
 * and in the same ZIP or city we were given. Without that check a typo could
 * drop a pin in the wrong town.
 */
export function __censusMatchIsTrustedForTest(input: GeocodeInput, match: CensusMatch): boolean {
  return censusMatchIsTrusted(input, match)
}

function censusMatchIsTrusted(input: GeocodeInput, match: CensusMatch): boolean {
  const got = match.addressComponents ?? {}
  const norm = (v?: string | null) => (v ?? '').trim().toUpperCase()
  if (!input.state || norm(got.state) !== norm(input.state)) return false
  const zipOk = !!input.zip && norm(got.zip) === norm(input.zip).slice(0, 5)
  const cityOk = !!input.city && norm(got.city) === norm(input.city)
  return zipOk || cityOk
}

async function geocodeCensus(input: GeocodeInput): Promise<LatLng | null> {
  try {
    if (!input.state || (!input.city && !input.zip)) return null
    const params = new URLSearchParams({
      street: cleanStreet(input.address),
      state: input.state,
      benchmark: 'Public_AR_Current',
      format: 'json',
    })
    if (input.city) params.set('city', input.city)
    if (input.zip) params.set('zip', input.zip)

    const url = `https://geocoding.geo.census.gov/geocoder/locations/address?${params}`
    // The Census API is slow and sometimes stalls. One retry recovers most of
    // those; a real non-match comes back fast with an empty list, not an error.
    const matches = (await fetchCensusMatches(url)) ?? (await fetchCensusMatches(url))
    const match = matches?.find((m) => censusMatchIsTrusted(input, m))
    const x = match?.coordinates?.x
    const y = match?.coordinates?.y
    if (typeof x !== 'number' || typeof y !== 'number') return null
    return { lat: y, lng: x }
  } catch {
    return null
  }
}

async function fetchCensusMatches(url: string): Promise<CensusMatch[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } }
    return body.result?.addressMatches ?? null
  } catch {
    return null
  }
}
