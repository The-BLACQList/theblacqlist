# Ticket 031: Listing Duplicate-Check API

## Status
Backlog

## Phase
Phase 5: Submit / Claim / Manage Foundation

## Priority
P1

## Feature Area
API / Entity Submission

## Context
Before a user submits a new business listing, the platform must warn them if a similar listing already exists in the same city. Without this check, The BLACQList will accumulate duplicate entries for the same business — undermining data quality and trust. This Route Handler powers the `DuplicateWarningDialog` on the Add Business form Step 7 and must be implemented before Ticket 033 (steps 5–7 of the Add Business form). Source: `docs/blacqlist/architecture/api-contract.md` Section 4 endpoint 18; `docs/blacqlist/ux/mvp-screen-map.md` Add Business screen; `docs/blacqlist/data/database-schema-plan.md` listings table.

## User Story
As a business owner completing the Add Business form, I want to be warned if a similar listing already exists in my city before I publish, so that I can claim an existing page instead of creating a duplicate.

## Scope

**In scope:**
- Create `app/api/listings/duplicate-check/route.ts` as a POST Route Handler
- Accept JSON body `{ name: string, city_id: string }`
- Execute `pg_trgm` similarity query against published listings in the given city with `similarity > 0.3`, ordered by match score descending, limited to 5 results
- Return `{ data: { duplicates: Array<{ id, name, slug, city: { name }, entity_type, trust_tier, match_score }> } }` — empty array when no matches
- Auth: Supporter (authenticated session required — called after user has signed in at step 3 of Add Business)
- Rate limit: 20 requests/min anonymous (middleware), 60 requests/min authenticated
- Generate public CDN URL from `cover_image_path` storage path at read time; never return raw path to client
- Input validation with zod: `name` min 2 / max 200 chars, `city_id` valid UUID that exists in `cities` table
- Structured error responses matching `{ error: string, code: string }` envelope

**Out of scope:**
- Fuzzy search across cities (query is always scoped to the provided `city_id`)
- Draft or pending listings in results (only `status = 'published' AND deleted_at IS NULL` listings returned)
- Saving duplicate warnings to the database
- The `DuplicateWarningDialog` UI component (covered by Ticket 033)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 025 (listings table migration) | Blocking ticket | Must be complete — `listings` table must exist with `pg_trgm` extension and `name` column |
| `pg_trgm` extension enabled in Supabase | Infrastructure | Must be enabled before similarity queries work — confirm in Supabase Studio |
| `cities` table seeded with launch cities | Data | Required to validate `city_id` |

## UX Notes

- **Screen:** Add Business — Step 7 (Preview + Publish)
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` Add Business section; `docs/blacqlist/ux/core-user-flows.md` Flow 8 (Add Business)
- **Entry points:** Called by `DuplicateWarningDialog` logic in the Step 7 page component before the publish action fires
- **Exit points:** If `duplicates.length > 0`, the UI shows a modal — this endpoint does not redirect; the caller handles the UI response
- **Mobile behavior:** No UI in this ticket — pure API endpoint

## Design Notes

- No UI component in this ticket
- Response shape is consumed by `DuplicateWarningDialog` in Ticket 033 — coordinate field names
- `cover_image_url` in the response should be a full public CDN URL, not a storage path (generate via `supabase.storage.from('listing-media').getPublicUrl(cover_image_path)` at read time)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings` table
- **Entities involved:** `listings`, `cities`
- **Operations:** SELECT only — no writes
- **Validation rules:** `city_id` must resolve to an active city (`is_active = true`); invalid UUID returns `400 VALIDATION_ERROR`
- **RLS policies:** Query uses authenticated Supabase client; RLS `anon` SELECT policy (`status = 'published' AND deleted_at IS NULL`) is the correct filter here — no admin access needed
- **Migration required:** No — requires `pg_trgm` extension only; confirm enabled

**Query pattern:**
```sql
SELECT
  id, name, slug, entity_type, trust_tier,
  similarity(name, $1) AS match_score,
  cover_image_path
FROM listings
WHERE city_id = $2
  AND status = 'published'
  AND deleted_at IS NULL
  AND similarity(name, $1) > 0.3
ORDER BY match_score DESC
LIMIT 5
```
Join to `cities` table to return `city.name` in the response.

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 4, endpoint 18
- **Endpoints involved:**
  - `POST /api/listings/duplicate-check` — checks for name similarity in a city
- **Auth required:** Yes — Supporter (authenticated session via Supabase cookie)
- **Request shape:**
  ```typescript
  { name: string, city_id: string }
  ```
- **Response shape:**
  ```typescript
  {
    data: {
      duplicates: Array<{
        id: string
        name: string
        slug: string
        city: { name: string }
        entity_type: string
        trust_tier: string
        match_score: number   // 0–1
        cover_image_url: string | null
      }>
    }
  }
  ```
- **Error codes to handle:**
  - `401 AUTH_REQUIRED` — no valid session; caller redirects to sign-in
  - `400 VALIDATION_ERROR` — missing name, invalid city_id; caller shows inline error

## Implementation Notes

**Files to create:**
- `app/api/listings/duplicate-check/route.ts` — POST Route Handler

**Files to modify:**
- None

**Key patterns:**
- Use `createServerClient` from `@supabase/ssr` with `cookies()` — never the browser client
- Call `supabase.auth.getUser()` — not `getSession()` — to validate the session on every request
- Use zod `safeParse` to validate the request body before any DB operation
- Use Supabase `.rpc()` or raw SQL via `.from('listings').select(...)` with the similarity function — confirm which approach works cleanly with Supabase JS client (raw SQL via `supabase.rpc()` may be required for `similarity()`)
- Generate the cover image public URL using `supabase.storage.from('listing-media').getPublicUrl(path).data.publicUrl` — only call this for non-null paths
- Return `{ data: { duplicates: [] } }` (not 404) when no matches found
- Follow the response envelope pattern from `docs/blacqlist/architecture/api-contract.md` overview

**Do not:**
- Return storage paths to the client — always generate the CDN URL server-side
- Include `draft`, `pending`, `flagged`, or `archived` listings in results
- Skip the `city_id` existence check — an invalid city UUID must return `400`, not a DB error
- Use `pg_trgm` in a way that returns results with similarity 0 (the `> 0.3` threshold is mandatory)

## Acceptance Criteria

- [ ] Given a POST to `/api/listings/duplicate-check` with `{ name: "The Natural Hair Lounge", city_id: "[valid-atlanta-uuid]" }`, when a published listing named "Natural Hair Lounge" exists in Atlanta, then the response contains that listing in the `duplicates` array with `match_score > 0.3`
- [ ] Given a POST with a name that matches no published listings, then the response is `{ data: { duplicates: [] } }` with HTTP 200 — not a 404
- [ ] Given a POST with `city_id` set to a malformed UUID string, then the response is `{ error: "...", code: "VALIDATION_ERROR" }` with HTTP 400
- [ ] Given a POST with a valid `city_id` that does not exist in the `cities` table, then the response is `{ error: "...", code: "VALIDATION_ERROR" }` with HTTP 400
- [ ] Given a POST from an unauthenticated caller (no session cookie), then the response is `{ error: "Authentication required.", code: "AUTH_REQUIRED" }` with HTTP 401
- [ ] Given a POST with `name` exceeding 200 characters, then the response is `{ error: "...", code: "VALIDATION_ERROR" }` with HTTP 400
- [ ] The `duplicates` array never contains more than 5 results
- [ ] The response `cover_image_url` field is a full HTTPS URL (not a storage path) for listings that have a `cover_image_path`, and `null` for listings that do not
- [ ] Pending, draft, flagged, and archived listings are never returned regardless of similarity score
- [ ] The endpoint returns a response within 500ms for a standard query (pg_trgm index is used)

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| No session | Unauthenticated caller | `401 AUTH_REQUIRED` JSON response | Caller redirects user to sign-in; `next=/add-business` param preserves flow |
| Invalid city_id | Non-UUID or non-existent city | `400 VALIDATION_ERROR` JSON response | Caller shows inline error — city selection must be reselected |
| `pg_trgm` extension missing | Extension not enabled in Supabase | `500 SERVER_ERROR` — DB query fails with pg error | Admin enables extension in Supabase Studio; no user-visible recovery |
| DB timeout | Supabase query exceeds threshold | `500 SERVER_ERROR` returned | Caller shows generic error; user can retry or proceed without duplicate check |
| Empty `name` | Name field is empty string | `400 VALIDATION_ERROR` | Caller enforces minimum length before calling endpoint |

## Edge Cases

- Business name contains special characters (apostrophes, ampersands, em-dashes): `pg_trgm` handles these in similarity scoring; no special escaping needed beyond parameterized query
- City has zero published listings: returns `{ data: { duplicates: [] } }` — not an error
- Caller submits the same name twice rapidly (network retry): idempotent — same query returns same results; no deduplication needed
- `cover_image_path` is an empty string (not null): treat as null; do not call `getPublicUrl("")`
- Match score exactly at threshold (0.3): query uses `> 0.3` strictly — a score of exactly 0.3 is excluded

## Accessibility Notes

- No UI component in this ticket — accessibility requirements are in Ticket 033 which renders the duplicate warning dialog

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Happy path — duplicate found | POST with `{ name: "The Hair Studio", city_id: "[atlanta-uuid]" }` where "Hair Studio ATL" exists as a published listing | Response 200; `duplicates` array contains at least one item; each item has `id`, `name`, `slug`, `match_score`, `city.name` |
| QA-2 | No duplicate | POST with `{ name: "Completely Unique Xylophone Repair", city_id: "[atlanta-uuid]" }` | Response 200; `duplicates` is empty array |
| QA-3 | Unauthenticated | POST without session cookie | Response 401; `code: "AUTH_REQUIRED"` |
| QA-4 | Invalid city_id | POST with `{ name: "Test Business", city_id: "not-a-uuid" }` | Response 400; `code: "VALIDATION_ERROR"` |
| QA-5 | Draft listing not returned | POST with name matching a `status: 'draft'` listing | Response 200; `duplicates` does not contain the draft listing |

## Security Notes

- Never return `draft`, `pending`, `flagged`, or `archived` listings to anonymous or authenticated callers — the `status = 'published'` filter is unconditional
- `city_id` is used in a parameterized query — no SQL injection risk
- Rate limiting must be applied at the middleware or route level to prevent scraping all listing names via similarity queries
- `cover_image_url` is generated from the public `listing-media` bucket — this is intentional and correct; no signed URL needed for cover images
- Do not log the `name` parameter in server logs — it may contain PII (a person's name submitted as a business name)

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Happy path tested in browser / API client (Insomnia or curl)
- [ ] Empty result (no duplicates) tested
- [ ] Unauthenticated request tested
- [ ] Invalid `city_id` validation tested
- [ ] `pg_trgm` extension confirmed enabled in Supabase project
- [ ] Response shape matches what Ticket 033 (`DuplicateWarningDialog`) expects
