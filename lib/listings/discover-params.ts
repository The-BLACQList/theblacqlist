/**
 * The discover URL contract, in one place.
 *
 * Three server-rendered pages read the same query string and hand it to
 * `queryListings`: `/discover`, `/discover/[citySlug]` and `/search`. Until this
 * file existed each one hand-mapped its own searchParams, and the three had
 * drifted: `/discover` forwarded the full facet set, while the city page and
 * `/search` forwarded only `q`, `type` and `category`.
 *
 * The drift is invisible from the outside, which is what makes it expensive. A
 * visitor who filters on `/discover` and then clicks into a city keeps every
 * facet in the URL, the page silently ignores all but three of them, and the
 * results come back wider than the filters shown beside them. Same for any
 * shared link and any crawled URL. Nothing errors; the page just answers a
 * different question than the one in the address bar. That is the same silent
 * widening `lib/validations/search.ts` refuses to allow at the API boundary.
 *
 * So there is one parse, and pages call it. A page may still narrow the result
 * afterwards (the city page pins `city` to its own slug), but it no longer
 * decides which keys exist.
 *
 * Validation stays where it already is. `parseLocationParams` drops a partial
 * or out-of-range location triple whole, and the CSV keys are deliberately NOT
 * checked against the known values — an unrecognised entry must survive to the
 * query and return nothing, because dropping it here would turn
 * `?location_type=nonsense` into no filter at all and answer with the whole
 * directory under the caller's filter chip.
 */

import type { ListingsParams } from '@/lib/listings/query'
import { parseLocationParams, widerRadius } from '@/lib/listings/location-params'
import { buildPageUrl } from '@/lib/listings/pagination'

/**
 * Every query-string key a discover-style page reads.
 *
 * A `type` alias rather than an `interface` on purpose: TypeScript gives type
 * aliases of object types an implicit index signature and interfaces none, and
 * `buildPageUrl` takes `Record<string, string | undefined>`. As an interface
 * this does not satisfy that parameter and every page needs a cast to build its
 * own next-page link. Leave it as a type.
 */
export type DiscoverSearchParams = {
  q?: string
  type?: string
  category?: string
  city?: string
  trust_tier?: string
  location_type?: string
  ownership?: string
  price?: string
  attrs?: string
  open_now?: string
  /** "Near You" — all three or none. See lib/listings/location-params.ts. */
  lat?: string
  lng?: string
  radius?: string
  sort?: string
  page?: string
}

/** Splits a CSV URL value, or undefined when the key is absent or empty. */
function csv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined
  const values = raw.split(',').filter(Boolean)
  return values.length > 0 ? values : undefined
}

/** 1-based, never below 1 — `?page=0` and `?page=-3` read as the first page. */
export function parsePage(raw: string | undefined): number {
  const page = parseInt(raw ?? '1', 10)
  return Number.isFinite(page) ? Math.max(1, page) : 1
}

/**
 * Maps a discover-style query string onto `queryListings` arguments.
 *
 * `withFacets` is the caller's call: only `/discover` renders the facet sidebar,
 * and loading the counts for a page that has no sidebar is two RPCs of wasted
 * work.
 */
export function parseDiscoverParams(
  params: DiscoverSearchParams,
  options: { withFacets?: boolean } = {}
): ListingsParams {
  const location = parseLocationParams(params)
  // The distance sort cannot outlive the coordinates it sorts by: with no
  // location the RPC's NULLS-LAST ordering falls through to the next key and
  // the page would claim a proximity order it never applied.
  const sort = location ? params.sort : params.sort === 'distance' ? undefined : params.sort

  return {
    q: params.q,
    type: params.type,
    category: params.category,
    city: params.city,
    trust_tier: params.trust_tier,
    location_type: csv(params.location_type),
    ownership: params.ownership,
    price: csv(params.price),
    attrs: csv(params.attrs),
    open_now: params.open_now === '1' || params.open_now === 'true',
    lat: location?.lat,
    lng: location?.lng,
    radius: location?.radius,
    sort,
    page: parsePage(params.page),
    ...(options.withFacets ? { withFacets: true } : {}),
  }
}

/**
 * The two ways out of an empty or failed radius search: the same search one
 * radius wider, and the same search with the location dropped.
 *
 * Both are plain links so they work before any JavaScript loads, and both go
 * back to page 1. `|| basePath` is load-bearing rather than defensive:
 * `buildPageUrl` returns an empty string when nothing is left in the query,
 * which is the ordinary case here since location is usually the only filter,
 * and an empty href renders as nothing at all. At the widest radius there is no
 * "wider area" link either, so the empty state would be a dead end under copy
 * promising two ways out. Never a dead end is the whole point of that screen.
 *
 * Lives here rather than on /discover because the radius keys now reach
 * /discover/[citySlug] and /search too, and an empty state whose escape links
 * exist on one page and not the others is the same drift this file exists to
 * end.
 */
export function buildLocationEscapeUrls(
  params: DiscoverSearchParams,
  basePath: string
): { widerRadiusUrl?: string; clearLocationUrl?: string } {
  const location = parseLocationParams(params)
  if (!location) return {}

  const nextRadius = widerRadius(location.radius)

  return {
    widerRadiusUrl:
      nextRadius !== null
        ? buildPageUrl({ ...params, radius: String(nextRadius) }, 1) || basePath
        : undefined,
    clearLocationUrl:
      buildPageUrl(
        {
          ...params,
          lat: undefined,
          lng: undefined,
          radius: undefined,
          // Dropping the coordinates drops the sort that depended on them.
          sort: params.sort === 'distance' ? undefined : params.sort,
        },
        1
      ) || basePath,
  }
}
