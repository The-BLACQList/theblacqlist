# Ticket 025: Search API Endpoint (GET /api/search)

**Ticket ID:** BLACQ-025
**Title:** Search API endpoint (GET /api/search) with full-text search, pg_trgm fallback, and filters
**Type:** Feature
**Priority:** P0 — Critical
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 4: Search, Filters, City/Category Pages
**Feature Area:** API / Search

---

## Context

Search is the highest-frequency interaction on the platform. Without a working search endpoint, the search results page, discover page, and claim entry flow are all non-functional. This Route Handler implements full-text search over published listings using PostgreSQL's `tsvector`/`tsquery` FTS mechanism with a `pg_trgm` fallback for partial matches and typo tolerance. It supports filtering by city, category, entity type, and trust tier, and is consumed by every discovery surface on the platform.

Source artifacts:
- `docs/blacqlist/architecture/api-contract.md` — Section 1, Endpoint 1: Search Entities
- `docs/blacqlist/ux/mvp-screen-map.md` — Search Results page, Discover page
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 2 (search states)

This ticket depends on Ticket 009 (database schema with `search_vector` GIN index and `pg_trgm` extension) and Ticket 013 (listings data). At MVP, the search API must handle the full query/filter/paginate contract in a single Route Handler.

---

## User Story

> As a visitor searching for Black-owned businesses, I want to search by keyword and filter by city, category, and entity type, so that I can quickly find relevant listings without browsing through unrelated results.

---

## Scope

**In scope:**
- `app/api/search/route.ts` — `GET` Route Handler (not a Server Action — search is triggered by URL params, not form mutations)
- Query params: `q` (text, optional), `city` (city_slug, optional), `category` (category_slug, optional), `type` (listing_type enum, optional), `trust_tier` (optional), `location_type` (optional), `page` (integer, default 1), `limit` (integer, default 20, max 100)
- Full-text search: when `q` is provided, use `search_vector @@ websearch_to_tsquery('english', $q)`, ranked by `ts_rank DESC, published_at DESC`
- `pg_trgm` fallback: if FTS returns fewer than 5 results, run `similarity(listings.name, $q) > 0.25` and append non-duplicate results (deduplication by `id`)
- No-query mode: when `q` is absent, return results ordered by `is_featured DESC, published_at DESC`
- Unconditional WHERE: `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- City filter: subquery `listings.city_id = (SELECT id FROM cities WHERE slug = $city AND is_active = true)`
- Category filter: subquery `listings.category_id = (SELECT id FROM categories WHERE slug = $category AND is_active = true)`
- Response shape: `{ data: SearchResult[], meta: { total, page, limit } }` per `SearchResult` interface in api-contract.md
- Cover image URL: `getPublicUrl(cover_image_path)` from `listing-media` bucket; `logo_path` URL from same bucket; generated at read time, not stored
- Rate limiting: 60 requests/min for anonymous (IP-based), 120/min for authenticated. At MVP: in-memory counter per IP hash (Redis or Upstash in V1). For MVP: use a lightweight in-memory map with a 60-second window or use Vercel's rate limiting middleware.
- Input validation via `zod` schema on query params
- Error codes: `VALIDATION_ERROR` (400), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500)
- `search_performed` analytics event logged server-side (INSERT to `analytics_events` table directly, not via the analytics API endpoint — this is the server)

**Out of scope:**
- Autosuggest / typeahead (V1)
- Saved search (V1)
- Sort options beyond Relevance (V1 — Newest, Rating)
- Elasticsearch or external search service (V1+)
- Events browse (`GET /api/listings?type=event` — Endpoint 9, Beta)
- Jobs browse (Endpoint 10, Beta)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-009: Database schema with `listings.search_vector` GIN index | Infrastructure | Not started — search_vector and GIN index must exist |
| BLACQ-009: `pg_trgm` PostgreSQL extension enabled | Infrastructure | Not started — must be enabled via migration |
| BLACQ-013: Seed listings data (at least 10 published listings for meaningful test results) | Data | Not started |
| `cities` table with `slug` and `is_active` columns | Data | Must exist |
| `categories` table with `slug` and `is_active` columns | Data | Must exist |
| Supabase client (service_role) available in Route Handler | Infrastructure | Must be configured in `lib/supabase/server.ts` |

---

## UX Notes

- **Consuming screens:** Search Results (`/search`), Discover (`/discover`), Claim Entry search (`/claim`)
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Search Results page, Discover page
- **Empty result behavior:** Returns `{ data: [], meta: { total: 0, page: 1, limit: 20 } }` — never a 404. The frontend handles empty state rendering.
- **Search result latency target:** Under 300ms for typical queries at launch scale (<5,000 listings). The GIN index on `search_vector` must be in place before this endpoint is deployed.
- **Filter validation:** Unrecognized query parameters are silently ignored (per api-contract.md spec) except for enum params (`type`, `trust_tier`, `location_type`) which are validated and return `VALIDATION_ERROR` on invalid values.

---

## Design Notes

Not applicable — this is a pure API ticket with no UI components.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listings`, `listing_details_business`, `cities`, `categories`
- **Entities involved:** `listings` (primary), `cities` (filter join), `categories` (filter join)
- **Operations:** SELECT only (read-only endpoint)
- **SQL patterns:**
  - FTS query: `WHERE listings.search_vector @@ websearch_to_tsquery('english', $1) AND status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
  - FTS ranking: `ORDER BY ts_rank(listings.search_vector, websearch_to_tsquery('english', $1)) DESC, published_at DESC`
  - Trgm fallback: `WHERE similarity(listings.name, $1) > 0.25 AND status = 'published' AND deleted_at IS NULL AND flag_status = 'none' AND id NOT IN ($fts_result_ids)`
  - Total count: use a separate `COUNT(*)` query with same WHERE clause (or `count` column from a windowed query) for pagination `meta.total`
  - `LIMIT $limit OFFSET ($page - 1) * $limit`
- **search_vector column:** Must include name, tagline, description, category name, city name. The GIN index on this column is the performance requirement for FTS. If not present, this endpoint will be unacceptably slow.
- **Cover image URL generation:** `supabase.storage.from('listing-media').getPublicUrl(listing.cover_image_path)` — generate in the service layer, not in the SQL query. `null` if `cover_image_path` is null.
- **RLS:** Route Handler uses the Supabase anon client for anonymous requests (RLS enforces `status = 'published'`). For extra safety, always add the WHERE clause explicitly in the service code too — defense in depth.
- **Migration required:** No new migration for this ticket — depends on migrations in Ticket 009. `pg_trgm` must be enabled (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) in the Ticket 009 migration.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Section 1, Endpoint 1
- **Endpoint:** `GET /api/search`
- **Auth required:** No (anonymous access permitted). Authenticated requests get a higher rate limit.
- **Request shape (query params):** `q`, `city`, `category`, `type`, `trust_tier`, `location_type`, `page`, `limit`
- **Response shape:**
  ```typescript
  {
    data: SearchResult[],
    meta: { total: number, page: number, limit: number }
  }
  ```
- **`SearchResult` fields:** `id`, `name`, `slug`, `entity_type`, `tagline`, `city: { name, slug }`, `category: { name, slug }`, `trust_tier`, `listing_tier`, `logo_path` (storage path), `cover_image_path` (storage path), `avg_rating`, `review_count`, `save_count`, `status`, `published_at`
- **Note on image paths:** The API returns storage paths, not CDN URLs, per the architecture overview. The frontend generates URLs client-side via `getPublicUrl()`. Include both `logo_path` and `cover_image_path` as storage paths in the response.
- **Error codes:** `VALIDATION_ERROR` 400, `RATE_LIMITED` 429

---

## Implementation Notes

**Files to create:**
- `app/api/search/route.ts` — Route Handler, exports `GET`
- `lib/services/search.ts` — `searchListings(params: SearchQueryParams): Promise<{ results: SearchResult[], total: number }>` service function containing all SQL logic
- `lib/validations/search.ts` — zod schema for `SearchQueryParams`
- `lib/utils/rateLimit.ts` (if not already exists) — in-memory IP-based rate limiter (60/min anon, 120/min auth). Use a `Map<string, { count: number, windowStart: number }>` cleared per 60-second window per IP hash.

**Files to modify:**
- None — new endpoint

**Key patterns:**
```typescript
// app/api/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = searchSchema.safeParse(Object.fromEntries(searchParams))
  if (!params.success) {
    return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', fields: params.error.flatten().fieldErrors }, { status: 400 })
  }
  // Rate limit check...
  // Delegate to service layer
  const { results, total } = await searchListings(params.data)
  return Response.json({ data: results, meta: { total, page: params.data.page, limit: params.data.limit } })
}
```

```typescript
// lib/services/search.ts
// Build FTS query
const ftsQuery = `
  SELECT *, ts_rank(search_vector, websearch_to_tsquery('english', $1)) as rank
  FROM listings
  LEFT JOIN cities ON listings.city_id = cities.id
  LEFT JOIN categories ON listings.category_id = categories.id
  WHERE search_vector @@ websearch_to_tsquery('english', $1)
    AND listings.status = 'published'
    AND listings.deleted_at IS NULL
    AND listings.flag_status = 'none'
    ${cityFilter}
    ${categoryFilter}
    ${typeFilter}
    ${trustTierFilter}
  ORDER BY rank DESC, listings.published_at DESC
  LIMIT $2 OFFSET $3
`
// Run FTS. If results.length < 5 AND q is present, run pg_trgm fallback, append non-duplicates.
// Run COUNT query for meta.total.
// Map to SearchResult shape, generate CDN URLs.
```

- Use parameterized queries via Supabase's `.rpc()` for complex raw SQL, or use `supabase.from('listings').select(...)` with `.textSearch('search_vector', q, { type: 'websearch' })`. For the trgm fallback, use `.rpc('search_by_similarity', { name_query: q, threshold: 0.25 })` — implement this as a Postgres function if the Supabase JS client cannot express the trgm query directly.
- For the no-`q` case: use Supabase's fluent query builder (`.from('listings').select(...).eq('status', 'published').order('is_featured', { ascending: false }).order('published_at', { ascending: false })`).
- Rate limiting: SHA-256 hash the `x-forwarded-for` or `x-real-ip` header for anonymous IP keys. For authenticated users, use `auth.uid()` as the rate limit key.
- The `search_performed` analytics event is written as a direct INSERT to the `analytics_events` table from the service layer using the service_role client. Do not call `/api/analytics/event` from within another Route Handler.

**Do not:**
- Use `ILIKE '%query%'` for full-text search — this is a full table scan and will be unacceptably slow even at 1,000 listings.
- Accept raw SQL fragments via query params — all user input must be parameterized.
- Return database column names that differ from the `SearchResult` interface — map at the service layer.
- Expose internal fields like `owner_user_id`, `flag_status`, `deleted_at` in the response.

---

## Acceptance Criteria

- [ ] `GET /api/search?q=barbershop&city=atlanta` returns listings where the `search_vector` matches "barbershop" in Atlanta, ordered by FTS relevance. Response is `{ data: SearchResult[], meta: { total, page: 1, limit: 20 } }`.
- [ ] `GET /api/search?city=atlanta&category=food-beverage` (no `q`) returns published listings in Atlanta, food & beverage category, ordered by `is_featured DESC, published_at DESC`.
- [ ] `GET /api/search?q=barbeershop` (typo) returns at least 1 result via the `pg_trgm` fallback when FTS returns fewer than 5 results.
- [ ] `GET /api/search?q=test&limit=101` returns `400 VALIDATION_ERROR` with an error message.
- [ ] `GET /api/search?q=test&type=invalid_type` returns `400 VALIDATION_ERROR`.
- [ ] `GET /api/search?q=nothing_that_exists` returns `{ data: [], meta: { total: 0, page: 1, limit: 20 } }` — not a 404.
- [ ] Listings with `status != 'published'`, `deleted_at IS NOT NULL`, or `flag_status != 'none'` are never returned in any query.
- [ ] `cover_image_path` and `logo_path` in the response are Supabase Storage paths (e.g., `listings/[id]/cover/[uuid].jpg`) — not full CDN URLs.
- [ ] Exceeding 60 requests/min from the same IP returns `429 RATE_LIMITED`.
- [ ] A `search_performed` analytics event is recorded for every request, including no-`q` requests and requests that return zero results.
- [ ] `GET /api/search?page=2&limit=10` returns the second page of 10 results and `meta.page = 2` in the response.

---

## Failure States

| Failure | Condition | Response | Recovery |
|---|---|---|---|
| `pg_trgm` extension not enabled | Migration not run | 500 INTERNAL_ERROR — `operator does not exist: text % text` from Postgres | Run the extension migration; log the error server-side |
| `search_vector` GIN index missing | Schema incomplete | FTS query runs as a sequential scan — extremely slow (not a failure per se, but a performance emergency) | Run the GIN index migration immediately |
| Database unavailable | Supabase connection failed | 500 INTERNAL_ERROR with safe message "Search is temporarily unavailable" | Automatic retry on next request |
| Invalid `city` slug provided | City not in `cities` table | Results filtered to 0 (city filter subquery returns null, no listings match) — 200 with empty array | User broadens their search |
| Invalid `category` slug provided | Category not in `categories` table | Same as invalid city — 200 empty array | N/A |
| Rate limit exceeded | IP exceeds 60/min | 429 RATE_LIMITED — `{ error: "Too many requests", code: "RATE_LIMITED" }` | Wait 60 seconds and retry |
| `websearch_to_tsquery` rejects malformed query | User enters only stop words or query operators | FTS returns 0 results — pg_trgm fallback activates | Fallback handles gracefully |

---

## Edge Cases

- `q` is an empty string `""` after trim: treat as no `q` (undefined behavior) — redirect to no-query path.
- `q` is exactly 200 characters (max): accepted and passed to FTS. Test that 201-character queries are rejected.
- `q` contains SQL injection attempts (e.g., `'; DROP TABLE listings;--`): parameterized queries prevent this. Test that such inputs return 0 results or empty array, not an error.
- `page=1000` on a dataset with 50 results: returns empty array with `meta.total = 50, meta.page = 1000`. Do not 404.
- `q` is all uppercase: `websearch_to_tsquery` is case-insensitive with the `'english'` dictionary. Test mixed-case queries return correct results.
- Both `q` and all filters applied simultaneously: should work correctly — FTS + filter WHERE clauses combined.
- `trgm` fallback appends results but creates duplicates with FTS results: deduplicate by `id` in the service layer before returning.
- Concurrent requests (load test): ensure the in-memory rate limiter handles concurrent access correctly. Use `atomicCounter` pattern or accept occasional slight inaccuracy at MVP.

---

## Accessibility Notes

Not applicable — this is a server-side API endpoint with no UI.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-025-1 | FTS keyword search | `GET /api/search?q=barbershop` | Returns listings whose name, category, or description contains "barbershop" (via `search_vector`); response shape matches `SearchResult[]`; `meta.total > 0` |
| QA-025-2 | City filter | `GET /api/search?city=atlanta` (no q) | Only listings with `city.slug = 'atlanta'` returned; all other cities excluded |
| QA-025-3 | Combined q + city + category | `GET /api/search?q=hair&city=atlanta&category=hair-beauty` | Returns only Hair & Beauty listings in Atlanta matching "hair" in search_vector |
| QA-025-4 | Typo fallback (trgm) | `GET /api/search?q=barbershoop` (intentional typo) | Returns barbershop listings via pg_trgm fallback (similarity > 0.25); results are appended after FTS results |
| QA-025-5 | Invalid type enum | `GET /api/search?type=restaurant` | 400 VALIDATION_ERROR with error message |
| QA-025-6 | Published-only filter | Search for a listing known to have `status = 'draft'` | Listing does NOT appear in results |
| QA-025-7 | Pagination | `GET /api/search?limit=5&page=2` (with >5 listings) | Returns listings 6–10; `meta.page = 2, meta.limit = 5` |
| QA-025-8 | Empty results | `GET /api/search?q=zzz_nonexistent_business_xyz` | `{ data: [], meta: { total: 0, page: 1, limit: 20 } }` — 200 status, not 404 |

---

## Security Notes

- All SQL queries must be parameterized — never interpolate user input directly into a SQL string.
- `q` parameter is passed to `websearch_to_tsquery()` as a parameterized value — PostgreSQL handles escaping. Never use string concatenation.
- IP hashing for rate limiting: hash with SHA-256 before using as a map key. Never log raw IP addresses.
- The `flag_status = 'none'` filter in the unconditional WHERE clause prevents flagged listings from appearing in search results, even if `status = 'published'`.
- Response fields do not include `owner_user_id`, `deleted_at`, `flag_status`, or any internal state — map carefully in the service layer.
- `CORS` headers: the Route Handler should only be callable from same-origin requests. Do not add permissive `Access-Control-Allow-Origin: *` to this endpoint.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] FTS query tested with real listing data and `pg_trgm` extension confirmed enabled
- [ ] pg_trgm fallback tested with a deliberate typo
- [ ] Published-only filter verified (draft listing does not appear)
- [ ] Pagination tested (page 2 returns correct offset)
- [ ] Rate limit tested (61st request returns 429)
- [ ] Input validation tested for all invalid enum values
- [ ] SQL injection test: `q="'; DROP TABLE listings;--"` returns empty results, no error
- [ ] Response shape matches `SearchResult` interface exactly (TypeScript types verify this)
- [ ] Cover image paths are storage paths, not CDN URLs (check a result that has a cover image)
