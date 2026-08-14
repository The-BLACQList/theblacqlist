/**
 * Server-side address geocoding via OpenStreetMap Nominatim.
 * Failure-tolerant: any error or non-match returns null (a listing with a
 * null lat/lng simply has no map pin). Called on address save — low volume,
 * within Nominatim's usage policy (identified User-Agent, no bulk here;
 * bulk backfills use scripts/geocode-listings.ts at 1 req/s).
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

function cleanStreet(address: string): string {
  return address
    .replace(TRAILING_UNIT, '')
    .replace(/\s*(suite|ste\.?|unit|apt\.?)\s*[\w-]+/gi, '')
    .trim()
    .replace(/,+$/, '')
}

/** Exported for tests only — see tests/geocode-clean-street.test.ts. */
export const __cleanStreetForTest = cleanStreet

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
