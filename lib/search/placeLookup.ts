// Place lookup for the map search box (ticket 142).
// Server only. Never import this in client components.
//
// [Decision — founder, 2026-10-20] Free, on Enter only, our own cities and
// states first, then OpenStreetMap (Nominatim). Cached and rate limited, no
// suggestions while typing.
//
// Order:
//   1. The words are exactly one of our cities, a nickname ("atl"), or a city
//      with its state ("decatur ga", "decatur georgia"): that city's own point.
//      No upstream call.
//   2. The words are exactly a state name ("Ohio", "Washington State"): a
//      structured Nominatim state search, cached, falling back to one of our
//      cities in that state.
//   3. Anything else: Nominatim, US only. A 5-digit ZIP uses the postal code
//      search; other words use a settlement search, so "Starbucks" can never
//      land on a coffee shop. Only places count (see ZOOM_BY_TYPE).
//
// Nothing here logs the query or the coordinates, on success or failure.
// geocodeAddress (lib/listings/geocode.ts) is not used: it needs a street line,
// so it cannot resolve "Decatur" or a ZIP, and its Census fallback has the
// same limit.

import { USER_AGENT } from '@/lib/listings/geocode'
import { CITY_NICKNAMES, normalizeQuery, type AssistCity } from '@/lib/search/assist'
import { US_STATES } from '@/lib/search/usStates'

export interface PlaceResult {
  /** As shown on the row: "Decatur, GA", "Ohio", "30030, Decatur, GA". */
  label: string
  lat: number
  lng: number
  /** The map zoom that frames the place. */
  zoom: number
}

export interface PlaceLookupOutcome {
  place: PlaceResult | null
  /**
   * True when the answer may be cached: a hit, or an upstream that answered
   * "nothing". False when the upstream failed or was over its ceiling, so a
   * passing outage is never cached as a miss.
   */
  cacheable: boolean
}

export interface PlaceLookupDeps {
  fetchImpl?: typeof fetch
  /** Charges one upstream call against the shared ceiling. False means skip. */
  allowUpstream?: () => Promise<boolean>
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const UPSTREAM_TIMEOUT_MS = 5000
/** Seven days in the Next data cache. Places do not move. */
const UPSTREAM_REVALIDATE_SECONDS = 604800

export const CITY_ZOOM = 11
export const STATE_ZOOM = 6

// What Nominatim calls a place, and how close to frame it. Anything else
// (a shop, a road, a building) is a miss.
const ZOOM_BY_TYPE: Readonly<Record<string, number>> = {
  state: STATE_ZOOM,
  county: 9,
  city: CITY_ZOOM,
  town: CITY_ZOOM,
  municipality: CITY_ZOOM,
  borough: CITY_ZOOM,
  village: 12,
  hamlet: 12,
  locality: 12,
  postcode: 12,
  suburb: 13,
  neighbourhood: 13,
  quarter: 13,
  city_district: 13,
}

const ZIP_PATTERN = /^\d{5}$/

// ─── Our own data ────────────────────────────────────────────────────────────

function cityLabel(city: AssistCity): string {
  return city.stateCode ? `${city.name}, ${city.stateCode}` : city.name
}

function hasPoint(city: AssistCity): city is AssistCity & { lat: number; lng: number } {
  return (
    city.lat != null && city.lng != null && Number.isFinite(city.lat) && Number.isFinite(city.lng)
  )
}

/**
 * The city the words name exactly, when it has a point. A live city wins over
 * an inactive one with the same name.
 */
export function matchLocalCity(query: string, cities: readonly AssistCity[]): AssistCity | null {
  const text = normalizeQuery(query)
  if (!text) return null

  const stateNameByCode = new Map(US_STATES.map((s) => [s.code, normalizeQuery(s.name)]))
  const bySlug = new Map(cities.map((c) => [c.slug, c]))

  const matches = cities.filter((c) => {
    const name = normalizeQuery(c.name)
    if (!name) return false
    if (text === name) return true
    if (!c.stateCode) return false
    if (text === `${name} ${c.stateCode.toLowerCase()}`) return true
    const stateName = stateNameByCode.get(c.stateCode)
    return stateName != null && text === `${name} ${stateName}`
  })

  const nickSlug = CITY_NICKNAMES[text]
  const nickCity = nickSlug ? bySlug.get(nickSlug) : undefined
  if (nickCity) matches.unshift(nickCity)

  const withPoint = matches.filter(hasPoint)
  return withPoint.find((c) => c.isActive) ?? withPoint[0] ?? null
}

/** The state the words name exactly, or null. */
export function matchStateName(query: string): { code: string; name: string } | null {
  const text = normalizeQuery(query)
  if (text === 'washington state') return { code: 'WA', name: 'Washington State' }
  return US_STATES.find((s) => normalizeQuery(s.name) === text) ?? null
}

// ─── Nominatim ───────────────────────────────────────────────────────────────

interface NominatimHit {
  lat?: string
  lon?: string
  name?: string
  addresstype?: string
  address?: Record<string, string | undefined>
}

type UpstreamAnswer = { ok: true; hit: NominatimHit | null } | { ok: false }

async function askNominatim(
  params: Record<string, string>,
  deps: Required<PlaceLookupDeps>
): Promise<UpstreamAnswer> {
  if (!(await deps.allowUpstream())) return { ok: false }

  const url = new URL(NOMINATIM_SEARCH)
  for (const [k, v] of Object.entries({
    ...params,
    format: 'jsonv2',
    countrycodes: 'us',
    limit: '1',
    addressdetails: '1',
  })) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await deps.fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      next: { revalidate: UPSTREAM_REVALIDATE_SECONDS },
    } as RequestInit)
    if (!res.ok) return { ok: false }
    const body = (await res.json()) as unknown
    if (!Array.isArray(body)) return { ok: false }
    return { ok: true, hit: (body[0] as NominatimHit | undefined) ?? null }
  } catch {
    return { ok: false }
  }
}

function stateCodeOf(hit: NominatimHit): string | null {
  const iso = hit.address?.['ISO3166-2-lvl4'] ?? ''
  const m = /^US-([A-Z]{2})$/.exec(iso)
  return m?.[1] ?? null
}

/** A Nominatim answer as a place, or null when it is not a place we accept. */
export function toPlace(hit: NominatimHit | null): PlaceResult | null {
  if (!hit) return null
  const zoom = hit.addresstype ? ZOOM_BY_TYPE[hit.addresstype] : undefined
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (zoom == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const code = stateCodeOf(hit)
  const address = hit.address ?? {}
  let label: string
  if (hit.addresstype === 'state') {
    label = hit.name || address.state || ''
  } else if (hit.addresstype === 'postcode') {
    const zip = address.postcode || hit.name || ''
    const town = address.city || address.town || address.village || address.hamlet || address.suburb
    label = [zip, town, code].filter(Boolean).join(', ')
  } else {
    const name = hit.name || ''
    label = name && code ? `${name}, ${code}` : name
  }
  if (!label) return null

  return { label, lat, lng, zoom }
}

// ─── The lookup ──────────────────────────────────────────────────────────────

/**
 * Where on the map the words point, if anywhere.
 *
 * `query` must already be validated (2 to 100 characters).
 */
export async function lookupPlace(
  query: string,
  cities: readonly AssistCity[],
  deps: PlaceLookupDeps = {}
): Promise<PlaceLookupOutcome> {
  const resolved: Required<PlaceLookupDeps> = {
    fetchImpl: deps.fetchImpl ?? fetch,
    allowUpstream: deps.allowUpstream ?? (async () => true),
  }

  // 1. One of our cities.
  const city = matchLocalCity(query, cities)
  if (city && hasPoint(city)) {
    return {
      place: { label: cityLabel(city), lat: city.lat, lng: city.lng, zoom: CITY_ZOOM },
      cacheable: true,
    }
  }

  // 2. A state, by name.
  const state = matchStateName(query)
  if (state) {
    const answer = await askNominatim({ state: state.name.replace(/ State$/, '') }, resolved)
    const place = answer.ok ? toPlace(answer.hit) : null
    if (place && answer.ok && answer.hit?.addresstype === 'state') {
      return { place: { ...place, label: state.name, zoom: STATE_ZOOM }, cacheable: true }
    }
    // Upstream down or odd: frame one of our cities in the state instead.
    const inState = cities.filter((c) => c.stateCode === state.code).filter(hasPoint)
    const anchor = inState.find((c) => c.isActive) ?? inState[0]
    if (anchor) {
      return {
        place: { label: state.name, lat: anchor.lat, lng: anchor.lng, zoom: STATE_ZOOM },
        cacheable: false,
      }
    }
    return { place: null, cacheable: answer.ok }
  }

  // 3. A ZIP or a town, from OpenStreetMap.
  const trimmed = query.trim()
  const answer = ZIP_PATTERN.test(trimmed)
    ? await askNominatim({ postalcode: trimmed }, resolved)
    : await askNominatim({ q: trimmed, featureType: 'settlement' }, resolved)
  if (!answer.ok) return { place: null, cacheable: false }
  return { place: toPlace(answer.hit), cacheable: true }
}
