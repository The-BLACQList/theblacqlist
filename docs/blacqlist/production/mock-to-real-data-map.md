# Mock-to-Real Data Map — The BLACQList

**Date:** 2026-05-12  
**Purpose:** Every location where mock/stub/placeholder data exists, what real data it should replace, the Supabase query needed, and the correct removal order.

---

## Overview

| #   | Source                                              | Files Importing It                                                                        | Blocks Beta     | Needs DB Seed First |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------- | ------------------- |
| 1   | `data/mock-entities.ts` — `MOCK_ENTITIES` array     | `app/(public)/discover/page.tsx`, `app/(public)/search/page.tsx`, `lib/listings/query.ts` | Yes             | Yes                 |
| 2   | `data/mock-entity-page.ts` — `EntityPageData` types | `lib/listings/entityPage.ts`                                                              | No (types only) | No                  |
| 3   | `STUB_CITIES` in onboarding                         | `app/onboarding/page.tsx`                                                                 | Yes             | Yes                 |
| 4   | SaveButton placeholder                              | `components/entity-page/SaveButton.tsx`                                                   | Yes             | No                  |
| 5   | ShareButton placeholder                             | `components/entity-page/ShareButton.tsx`                                                  | No (UX gap)     | No                  |

---

## Mock Source 1: `data/mock-entities.ts` — MOCK_ENTITIES

**File:** `data/mock-entities.ts` (301 lines)  
**What it contains:** Array of 42 fake Black-owned business listings used as a discovery fallback when Supabase returns empty results.

**Where it's imported:**

| Importing file                   | Usage                                                      | Line     |
| -------------------------------- | ---------------------------------------------------------- | -------- |
| `app/(public)/discover/page.tsx` | Renders as fallback when `result.fromMock === true`        | 8, 44–49 |
| `app/(public)/search/page.tsx`   | Filters mock array by query params when DB empty           | 8, 93–95 |
| `lib/listings/query.ts`          | Sets `fromMock: true` flag when Supabase returns 0 results | 2, 134   |

**Why it exists:** Dev/demo fallback to show a non-empty UI before listings were seeded in the database.

**The risk:** In production with an empty DB, fake businesses will silently render on `/discover` and `/search`. Users will interact with listings that don't exist.

**What it replaces:**

Real `listings` records from Supabase with `status = 'published'` and `deleted_at IS NULL`, joined with `categories` and `cities`.

**Query already written:** `lib/listings/query.ts` — `queryListings(params)` — already does the right thing. The mock fallback is a conditional wrapper around it.

**What needs to happen before removal:**

1. Seed at minimum 5–10 real `listings` records (with matching `cities` and `categories` seed data)
2. Remove the `fromMock` flag from `lib/listings/query.ts`
3. Replace the mock fallback in `app/(public)/discover/page.tsx` with a proper empty state (e.g., "Be the first business in your city — submit yours")
4. Replace the mock fallback in `app/(public)/search/page.tsx` with a proper empty state
5. Delete `data/mock-entities.ts`

**Types dependency:** `data/mock-entities.ts` also exports `DiscoveryEntity`, `EntityType`, `LocationType`, `TrustTier`, `Tier` types that are imported by `lib/listings/query.ts`. Before deleting the file, these types must be moved to `types/index.ts` or inlined.

---

## Mock Source 2: `data/mock-entity-page.ts` — EntityPageData types

**File:** `data/mock-entity-page.ts` (243 lines)  
**What it contains:** A single fixture object (`MOCK_ENTITY_PAGE`) and 12 type definitions (`EntityPageData`, `BusinessDetails`, `WeeklyHours`, `ServiceItem`, etc.).

**Where it's imported:**

| Importing file               | Usage                                                                           | Line |
| ---------------------------- | ------------------------------------------------------------------------------- | ---- |
| `lib/listings/entityPage.ts` | Imports `EntityPageData` and related types; fixture not used in production path | 10   |

**Why it exists:** Type definitions and a demo fixture from before real DB types were generated.

**The risk:** Low. The fixture itself is not rendered in any live route. The types are the real dependency.

**What it replaces:**

The types should be replaced by (or aliased to) the auto-generated Supabase types in `lib/supabase/types.ts`.

**What needs to happen before removal:**

1. Confirm that `lib/listings/entityPage.ts` does not use `MOCK_ENTITY_PAGE` fixture in any production code path
2. Migrate the 12 custom types to `types/index.ts` (or re-export from Supabase generated types)
3. Update all imports from `@/data/mock-entity-page` to `@/types`
4. Delete `data/mock-entity-page.ts`

**Note:** This is the lowest-risk removal. No visible UI impact.

---

## Mock Source 3: `STUB_CITIES` in Onboarding

**File:** `app/onboarding/page.tsx` (lines 12–23)  
**What it contains:** Hardcoded array of 8 city names shown as selectable pills during onboarding step 1.

```typescript
// line 12 — with TODO comment: "replace with DB query once schema migration runs"
const STUB_CITIES = [
  'Atlanta',
  'Chicago',
  'Houston',
  'Los Angeles',
  'New York',
  'Philadelphia',
  'Washington D.C.',
  'Miami',
]
```

**Why it exists:** Cities migration ran, but the onboarding component never switched from the stub to a DB query. Comment documents the intent.

**The risk:** Medium. New users onboard against 8 hardcoded cities. The actual launch list has 13 cities per `docs/blacqlist/data/seed-data-plan.md`. Missing cities: Dallas, Detroit, Baltimore, Charlotte, Oakland (or others in the final seed).

**What it replaces:**

```typescript
// Replace with:
const supabase = await createClient()
const { data: cities } = await supabase
  .from('cities')
  .select('id, name, state_abbr, slug')
  .eq('is_active', true)
  .order('name')
```

**What needs to happen before removal:**

1. Seed `cities` table with all 13 launch cities (per `data/seed-data-plan.md`)
2. Convert `/onboarding/page.tsx` from client component to async server component for the data-fetch step, OR fetch cities server-side and pass as prop
3. Replace `STUB_CITIES.map(...)` with `cities.map(city => city.name)`
4. Remove the `STUB_CITIES` constant

**Dependency:** Cities seed data must exist before this stub can be removed.

---

## Mock Source 4: SaveButton Placeholder

**File:** `components/entity-page/SaveButton.tsx`  
**What it contains:** Placeholder button that renders the save icon but does not call any API.

**TODO comment in file:** "Replace with real API call when save/unsave routes are ready (Ticket 045)"

**Why it exists:** The UI was built before the API route. The API route is now fully functional.

**What it replaces:**

`/api/saves` — already implemented and production-ready:

- `POST /api/saves` — saves listing (`{ listing_id: uuid }`)
- `DELETE /api/saves` — unsaves listing (`?listing_id=uuid`)
- `GET /api/saves` — returns user's saved listings

**What needs to happen:**

1. `SaveButton` becomes a client component (`"use client"`)
2. On click: call `POST /api/saves` or `DELETE /api/saves` based on current save state
3. Accept a `listingId: string` prop and an optional `initialSaved: boolean` prop
4. Show loading state during API call; show error toast on failure
5. Remove the TODO comment

**No seed data dependency.** API is live and the `saves` table exists.

---

## Mock Source 5: ShareButton Placeholder

**File:** `components/entity-page/ShareButton.tsx`  
**What it contains:** Placeholder button; no actual share behavior.

**Why it exists:** UI scaffolded before share functionality was implemented.

**What it replaces:**

Native [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) with clipboard fallback:

```typescript
async function handleShare() {
  const url = window.location.href
  const title = listingName
  if (navigator.share) {
    await navigator.share({ title, url })
  } else {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  }
}
```

**No backend needed. No seed data dependency.**

---

## Connected Missing Query: `/account/saved`

This is not a mock data source — it's a missing Supabase query where a real API already exists.

**File:** `app/account/saved/page.tsx`  
**Current state:** Always shows empty state. TODO comment on line 31.

**API route that already works:** `GET /api/saves` — returns paginated list of user's saved listings with business name, slug, city, and category.

**What the page needs:**

```typescript
// Server component fetch
const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/saves`, {
  headers: { cookie: cookieHeader },
})
const { data: savedListings } = await res.json()
```

Or directly via Supabase server client:

```sql
SELECT saves.id, saves.created_at,
       listings.name, listings.slug, listings.city_id, listings.listing_type
FROM saves
JOIN listings ON saves.listing_id = listings.id
WHERE saves.user_id = auth.uid()
  AND listings.deleted_at IS NULL
ORDER BY saves.created_at DESC
```

**No seed data dependency.** Works as soon as a user has actually saved a listing.

---

## Removal Order

Remove in this sequence to avoid import errors and broken pages:

| Step | Action                                                            | Blocker                |
| ---- | ----------------------------------------------------------------- | ---------------------- |
| 1    | Seed `cities` table with launch cities                            | Required for Step 2    |
| 2    | Seed `categories` table with taxonomy                             | Required for Step 3    |
| 3    | Seed at least 5 real `listings` records                           | Required for Steps 4–5 |
| 4    | Replace `STUB_CITIES` in onboarding with cities DB query          | Cities seed done       |
| 5    | Wire `SaveButton` to `/api/saves`                                 | No dependencies        |
| 6    | Wire `ShareButton` to Web Share API                               | No dependencies        |
| 7    | Wire `/account/saved` to saves query                              | No dependencies        |
| 8    | Remove `fromMock` fallback from `/discover` and `/search`         | Listings seeded        |
| 9    | Migrate types from `data/mock-entities.ts` to `types/index.ts`    | Step 8 complete        |
| 10   | Delete `data/mock-entities.ts`                                    | Step 9 complete        |
| 11   | Migrate types from `data/mock-entity-page.ts` to `types/index.ts` | Step 10 complete       |
| 12   | Delete `data/mock-entity-page.ts`                                 | Step 11 complete       |

---

## Summary: What Stays (Intentional Hardcoding)

The following hardcoded data is intentional and is NOT a conversion target:

| Location                           | Data                                      | Why it stays                                    |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `app/page.tsx` lines 16–68         | `CATEGORIES`, `CITIES`, `FEATURES` arrays | Marketing content; curated copy; not a DB query |
| `app/(auth)/sign-up/page.tsx`      | `ROLE_OPTIONS` array                      | UI config (enum of valid roles); not DB data    |
| `app/admin/entities/page.tsx`      | `STATUS_TABS`                             | UI config                                       |
| `app/admin/claims/page.tsx`        | `ROLE_LABELS`, `STATUS_TABS`              | UI config                                       |
| `app/api/upload/[bucket]/route.ts` | `ALLOWED_BUCKETS`, `BUCKET_LIMITS`        | Security config — should NOT come from DB       |
| `app/api/analytics/event/route.ts` | `MAX_PROPERTIES_BYTES`, `RATE_LIMIT`      | Rate-limiting config — correct as constants     |
