# Ticket 142: Search phase 2, a place box on the map and a working zero-result log

**Phase:** V1.5 · **Priority:** P1 · **Status:** Done (PR open, merges after the flip)
**Depends on:** 085 (admin search analytics page), #159 (map search box filters the loaded pins)
**Gates:** GATE-DATA (retention job migration `20261022000000_search_events_retention.sql`, staging only until the founder's word after the flip). Privacy review before merge: `docs/blacqlist/compliance/search-zero-result-log-review.md`.
**Decision record:** the founder answered on 2026-10-20:

1. **Place lookup is free.** It searches on Enter, using our own cities and states first, then OpenStreetMap (Nominatim). It's cached and rate limited, with no suggestions while typing.
2. **The zero-result log is anonymous and kept 90 days**, with a privacy review before merge.

---

## Why

The release order (2026-10-20) listed search phase 2 as partly built:

- **The map box only filters pins already loaded.** Typing "Decatur" or a ZIP finds nothing unless a business has that word in its name, so there's no way to move the map to a place.
- **The zero-result log writes nothing anyone reads.** `logSearchEvent` wrote to `analytics_events`, but the admin page at `/admin/analytics/search` reads `search_events`, which no code wrote. The write was also fire-and-forget, so the function could end before it landed. And `/search`, the page people actually use, never logged at all; only the unused `/api/search` did.

## Scope

In:

- **Place lookup API.** `GET /api/places/lookup?q=`:
  - zod-validated (2 to 100 characters), rate limited at 30 per minute per IP (bucket `place_lookup`, the existing Postgres limiter), plus a shared ceiling of 50 upstream lookups per minute so we stay inside Nominatim's usage policy.
  - **Our own data first.** A query that is exactly one of our cities or a city nickname ("atl", "nola") goes to that city's center. A city with its state ("decatur ga", "decatur georgia") counts too, and a live city wins over an inactive one with the same name. These make no upstream call.
  - **States.** A query that is exactly a state name ("Ohio", "Washington State") asks Nominatim for that state (a structured state search, cached) and frames it at state zoom. If Nominatim is down, it frames one of our cities in that state instead, and that answer is not cached. Two-letter codes ("OH") are not read as states, since they clash with words.
  - **Then OpenStreetMap.** Anything else goes to Nominatim, US only: a 5-digit ZIP uses the postal code search, and other words use a settlement search, so "Starbucks" can't land on a coffee shop. Only towns, cities, neighborhoods, counties, states and ZIPs count as a hit.
  - **Cached.** Upstream answers sit in the Next data cache for 7 days, and the response is CDN-cacheable for a day.
  - **Answer:** `{ data: { label, lat, lng, zoom } }`, or `{ data: null }` when nothing matches. A failed upstream also answers `{ data: null }`, because a place miss must never block the pin filter.
  - **Nothing is logged.** Not the query, not the coordinates, not on success or failure.
  - `geocodeAddress` is not used: it needs a street line, so it can't resolve "Decatur" or a ZIP. The Census geocoder has the same limit, so the fallback is Nominatim only.
- **Map "Go to" row.**
  - Typing still filters the loaded pins, as before. The box's screen reader label now reads "Search businesses or places on the map".
  - Pressing Enter in the map search box also asks the lookup. When the words name a place, a row under the box reads **Go to Decatur, GA**. Tapping it moves the map there (fly, or jump under reduced motion), clears the box, turns off Near me and switches the city tab to All cities, so the pins at the place show.
  - Works the same on the desktop panel and the phone bar.
  - A miss shows nothing, because the words may be a business name and the pin filter already answered.
  - The row is a real button with a visible focus ring, at least 44px tall, announced politely.
- **Zero-result log.**
  - Writes to `search_events`, the table the admin page reads.
  - Logs only searches that return **zero** results, on page 1, with a query.
  - Skips searches where a filter could not run (radius or deep-filter outage), because those zeros are outages, not content gaps.
  - The insert runs inside `after()` and is awaited, so it lands after the response without being cut off.
  - Logged from both `/search` (the page) and `/api/search`.
  - **Stored:** the trimmed query (collapsed spaces, max 200 characters), the city, the category slug, `result_count = 0`, and the time.
  - **Never stored:** user id, IP, coordinates. A query that looks like an email address or a phone number is not logged at all.
- **Server search event removed.** The server no longer writes `search_performed` to `analytics_events`. It carried the full query of every search, kept with no end date, and nothing read it.
- **Retention.** A nightly pg_cron job (`purge-search-events`, 03:30 UTC) deletes `search_events` rows older than 90 days.
- **Admin page.** `/admin/analytics/search` shows the zero-result table only, read directly from `search_events`, with its CSV.
  - The "Top queries" table is gone: with only zero-result searches stored, it would show the same list under a wrong name.
  - The two RPCs the page called (`get_top_search_queries_filtered`, `get_zero_result_queries`) were never defined in any migration, so those calls are removed too.
  - `?table=top` on the export answers 400.

Out:

- Suggestions while typing (founder: search on Enter only).
- Logging every search, or a "top queries" view. That would need its own privacy review.
- Detail map tiles for places outside our metros. Outside them the map shows the plain country ground at street zoom, with any pins that are there.

## Acceptance criteria

- [x] Given the map, when a visitor types "Decatur" and presses Enter, then a "Go to Decatur, GA" row appears, and tapping it moves the map to Decatur.
- [x] Given "30030" and Enter, then the row offers the ZIP and moves there.
- [x] Given "atl" or "Atlanta" and Enter, then the row goes to Atlanta from our own city data, with no upstream call.
- [x] Given "Ohio" and Enter, then the row goes to Ohio at state zoom.
- [x] Given words that name no place, then no row appears and the pin filter is unchanged.
- [x] Given more than 30 lookups in a minute from one IP, then the API answers 429 `RATE_LIMITED`.
- [x] Given a query under 2 or over 100 characters, then the API answers 400 `VALIDATION_ERROR`.
- [x] Given an upstream failure, then the API answers 200 `{ data: null }` and logs nothing about the query.
- [x] Given a `/search` query that returns zero results, then one `search_events` row is written with the query, city, category, `result_count = 0`, and no user id.
- [x] Given a search with results, then nothing is written.
- [x] Given a zero-result search for an email address or phone number, then nothing is written.
- [x] Given a zero-result search where the radius or deep filters could not run, then nothing is written.
- [x] Given rows older than 90 days, then the nightly job deletes them.
- [x] The admin search page lists zero-result queries and exports them as CSV.

## QA notes

- Unit tests: `tests/place-lookup.test.ts` (API, local and upstream paths, validation, rate limit, failure), `tests/zero-result-log.test.ts` (what is kept, what is dropped, when it fires).
- On the Preview (staging data):
  - At 375px and desktop, check "Decatur", "30030", "atl" and "Ohio" each move the map, and nonsense words show no row.
  - Search `/search?q=zzqxv` once and confirm one anonymous `search_events` row on staging.
- Staging: the cron job is listed in `cron.job` as `purge-search-events`.
- Prod: apply the migration after the flip, on the founder's word, before this PR merges.
- Privacy review: `docs/blacqlist/compliance/search-zero-result-log-review.md`. Founder sign-off is needed before merge, plus two decisions:
  - F2: delete the old `search_performed` rows in `analytics_events` on prod after the flip.
  - F3: add OpenStreetMap (Nominatim) to the Privacy Policy provider list.
