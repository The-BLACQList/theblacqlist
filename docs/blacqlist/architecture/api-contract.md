# API Contract — The BLACQList

**Last updated:** 2026-05-07
**Status:** Reference document for all frontend and backend engineers
**Owner:** Architecture + Engineering

This document defines every API endpoint and Server Action for The BLACQList across all feature areas and phases. Engineers read this before writing any route handler, server action, or client-side fetch call.

**Document structure:**

- Part A (this file): Overview + Sections 1–4 — Public Discovery, Auth/Account, Saves/Shares, Entity Submission
- Part B (api-contract-b.md): Sections 5–9 — Claims, Owner Dashboard, Reviews, Corrections, Admin
- Part C (api-contract-c.md): Sections 10–12 — Receipt/Spend, Flow Map, Marketplace

---

## Overview

### Base URL

| Environment | URL                                |
| ----------- | ---------------------------------- |
| Development | `http://localhost:3000`            |
| Staging     | `https://staging.theblacqlist.com` |
| Production  | `https://theblacqlist.com`         |

### Authentication

All authenticated endpoints use the Supabase session managed in httpOnly cookies by `@supabase/ssr`. There is no `Authorization: Bearer` header — the session is read server-side on every request via `supabase.auth.getUser()`. Role is confirmed by querying the `user_roles` table server-side; JWT claims are never used for authorization decisions.

**Role hierarchy:**

| Role        | Description                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| Anonymous   | Unauthenticated — read-only access to published content                         |
| Supporter   | Any authenticated user — can save, review, share                                |
| Owner       | Authenticated user with `user_roles.role = 'owner'` for a specific `listing_id` |
| Admin       | Platform staff — elevated moderation and management access                      |
| Super Admin | Full platform access including role grants and destructive operations           |

### Request Format

- **Route Handlers:** JSON body with `Content-Type: application/json`, or query parameters as documented per endpoint
- **Server Actions:** TypeScript function calls from Client Components; validated arguments (not FormData unless noted)

### Response Format

All responses use a consistent envelope:

```
// Single resource
{ "data": T }

// Collection
{ "data": T[], "meta": { "total": number, "page": number, "limit": number } }

// Error
{ "error": "Human-readable message safe to display", "code": "MACHINE_READABLE_CODE" }

// Validation error
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "fields": { "fieldName": "Error message for this field" }
}
```

### Pagination

- Default limit: 20. Maximum limit: 100.
- `page` is 1-indexed. `page=1` is the first page.
- Always return `meta.total`, `meta.page`, and `meta.limit` in collection responses.

### Dates

All datetime fields are ISO 8601 strings in UTC: `"2026-05-07T14:00:00Z"`

### IDs

All IDs are UUIDs (strings), never integers.

### Storage Paths

Supabase Storage paths (not CDN URLs) are stored in the database and returned in API responses. Generate public URLs at read time via `getPublicUrl(path)` for the `listing-media` bucket. Generate 15-minute signed URLs at read time via service_role for `verification-docs` and `receipts` buckets. Never persist full CDN URLs in the database.

### ISR Cache Strategy

| Change type                          | Invalidation call                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Published listing content updated    | `revalidatePath('/[city-slug]/business/[listing-slug]')`                      |
| City or category listing set changes | `revalidateTag('city-[slug]')` or `revalidatePath('/[city-slug]/[cat-slug]')` |
| Collection items change              | `revalidatePath('/collection/[slug]')`                                        |
| Admin changes featured status        | Revalidate homepage + city page                                               |

---

## Per-Endpoint Format

Each endpoint is documented with these 11 fields:

```
### [Endpoint Name]
**Type:** Route Handler | Server Action
**Route / Action:** path or lib/actions/... function name
**Phase:** MVP | Beta | V1 | V2 | V3
**Auth:** minimum role required

**Request**
TypeScript interface for query params or body

**Response**
TypeScript interface for data field

**Validation Rules**
- zod rules

**Permission Checks**
- server-side checks

**Errors**
| Code | HTTP | When |

**Frontend Usage**
which screens + how result is used

**Analytics Event Emitted**
event_name — when triggered, properties

**Cache Invalidation**
revalidatePath / revalidateTag calls, or "None"
```

---

## Section 1: Public Discovery

All endpoints in this section are public (Anonymous access). They enforce `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'` as unconditional server-side filters on all listing queries.

---

### 1. Search Entities

**Type:** Route Handler
**Route / Action:** `GET /api/search`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
interface SearchQueryParams {
  q?: string // Full-text search query, max 200 chars
  city?: string // City slug (e.g., "atlanta")
  category?: string // Category slug (e.g., "food-beverage")
  type?: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  trust_tier?: 'claimed' | 'verified' | 'certified'
  location_type?: 'physical' | 'online' | 'hybrid'
  page?: number // Default: 1, min: 1
  limit?: number // Default: 20, max: 100
}
```

**Response**

```typescript
interface SearchResult {
  id: string
  name: string
  slug: string
  entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  tagline: string | null
  city: {
    name: string
    slug: string
  } | null
  category: {
    name: string
    slug: string
  }
  trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
  listing_tier: 'free' | 'standard' | 'premium'
  logo_path: string | null // Supabase Storage path; caller generates URL
  cover_image_path: string | null // Supabase Storage path; caller generates URL
  avg_rating: number | null
  review_count: number
  save_count: number
  status: 'published'
  published_at: string // ISO 8601
}

// Response envelope: { data: SearchResult[], meta: { total, page, limit } }
```

**Validation Rules**

- `q`: max 200 characters; trim whitespace before FTS query construction
- `limit`: max 100; coerce to integer; reject non-numeric values
- `page`: min 1; coerce to integer; reject non-numeric values
- `type`: must be one of the six valid `entity_type` values if provided
- `trust_tier`: must be `'claimed'`, `'verified'`, or `'certified'` if provided
- `location_type`: must be `'physical'`, `'online'`, or `'hybrid'` if provided
- Unrecognized query parameters: ignore silently

**Permission Checks**

- Unconditional server-side WHERE clause: `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- City filter applied as `listings.city_id = (SELECT id FROM cities WHERE slug = $city AND is_active = true)`
- Category filter applied as `listings.category_id = (SELECT id FROM categories WHERE slug = $category AND is_active = true)`
- No auth check required

**Search Logic**

When `q` is provided: `search_vector @@ websearch_to_tsquery('english', q)`, ranked by `ts_rank DESC, published_at DESC`. If FTS returns fewer than 5 results, run a `pg_trgm` fallback on `listings.name` with `similarity > 0.25` and append non-duplicate results. When `q` is not provided, return results ordered by `is_featured DESC, published_at DESC`.

**Errors**

| Code               | HTTP | When                                                                  |
| ------------------ | ---- | --------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid parameter values (non-numeric page/limit, invalid enum value) |
| `RATE_LIMITED`     | 429  | 60 requests/min for Anonymous; 120 requests/min for authenticated     |

**Frontend Usage**

- Search Results screen (`/search`) — primary query on every filter change and pagination action
- Discover screen (`/discover`) — called with no `q` param, filtered by city or category

**Analytics Event Emitted**

`search_performed` — fired on every request regardless of result count; properties: `{ query: q | null, filters: { city, category, type, trust_tier, location_type }, result_count: number }`

**Cache Invalidation**

None — fully dynamic; no ISR cache.

---

### 2. Get Featured Entities

**Type:** Route Handler
**Route / Action:** `GET /api/listings/featured`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
interface FeaturedQueryParams {
  city_slug?: string // Filter featured listings to a specific city
  limit?: number // Default: 6, max: 20
}
```

**Response**

```typescript
// Array of SearchResult (same shape as endpoint 1)
// Filtered to listings where is_featured = true AND status = 'published' AND deleted_at IS NULL
// Sorted by published_at DESC within featured set
// Response envelope: { data: SearchResult[], meta: { total, page: 1, limit } }
```

**Validation Rules**

- `limit`: max 20; coerce to integer
- `city_slug`: validated against `cities` table; invalid slug returns empty array, not 404

**Permission Checks**

- Unconditional: `is_featured = true AND status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- City filter: `listings.city_id = (SELECT id FROM cities WHERE slug = $city_slug AND is_active = true)`

**Errors**

| Code               | HTTP | When                                 |
| ------------------ | ---- | ------------------------------------ |
| `VALIDATION_ERROR` | 400  | `limit` exceeds 20 or is non-numeric |

**Frontend Usage**

- Homepage — featured listings carousel or grid (up to 6, no city filter)
- City Landing page (`/[city-slug]`) — city-scoped featured listings (city_slug provided)

**Analytics Event Emitted**

`featured_listings_shown` — properties: `{ city_slug: string | null, count: number }`

**Cache Invalidation**

ISR 30 minutes. Revalidated immediately when an admin changes `is_featured` on any listing via `revalidatePath('/')` and `revalidatePath('/[city-slug]')`.

---

### 3. Get City Page Data

**Type:** Route Handler
**Route / Action:** `GET /api/cities/[slug]`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
// No body or query params — city slug is path parameter
```

**Response**

```typescript
interface CityPageData {
  city: {
    id: string
    name: string
    slug: string
    state: {
      name: string
      code: string // Two-letter state code
    }
    metro_area: string | null
    latitude: number
    longitude: number
  }
  categories: Array<{
    id: string
    name: string
    slug: string
    icon: string | null
    listing_count: number // Count of published listings in this city + category
  }>
  featured_listings: SearchResult[] // Same shape as endpoint 1; limited to 6
  total_listings: number // Total published listings in this city
}
```

**Validation Rules**

- `slug`: path parameter must be a non-empty string; validated against `cities.slug`

**Permission Checks**

- Returns 404 if `cities.is_active = false` or city not found
- `featured_listings` filtered to `is_featured = true AND status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- `listing_count` per category counts only `status = 'published' AND deleted_at IS NULL`

**Errors**

| Code        | HTTP | When                                                          |
| ----------- | ---- | ------------------------------------------------------------- |
| `NOT_FOUND` | 404  | City slug not found in `cities` table, or `is_active = false` |

**Frontend Usage**

- City Landing page (`/[city-slug]`) — renders full page: city hero, category grid, featured listings section

**Analytics Event Emitted**

`city_page_viewed` — properties: `{ city_slug: string }`

**Cache Invalidation**

ISR 24 hours. `revalidateTag('city-[slug]')` called whenever any listing in the city changes publication status.

---

### 4. Get City + Category Page Data

**Type:** Route Handler
**Route / Action:** `GET /api/cities/[city-slug]/categories/[category-slug]`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
interface CityCategoryQueryParams {
  page?: number // Default: 1
  limit?: number // Default: 20, max: 100
  type?: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  trust_tier?: 'claimed' | 'verified' | 'certified'
}
```

**Response**

```typescript
interface CityCategoryPageData {
  city: {
    id: string
    name: string
    slug: string
  }
  category: {
    id: string
    name: string
    slug: string
    description: string | null
  }
  listings: SearchResult[] // Same shape as endpoint 1
  meta: {
    total: number
    page: number
    limit: number
  }
}
```

**Validation Rules**

- `page`: min 1; coerce to integer
- `limit`: max 100; coerce to integer
- `type`: must be valid `entity_type` value if provided
- `trust_tier`: must be `'claimed'`, `'verified'`, or `'certified'` if provided
- Unrecognized query parameters: return `VALIDATION_ERROR` 400

**Permission Checks**

- Returns 404 if city not found, `cities.is_active = false`, category not found, or `categories.is_active = false`
- Listings filtered to `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- City filter: `listings.city_id = city.id`; category filter: `listings.category_id = category.id`

**Errors**

| Code               | HTTP | When                                                   |
| ------------------ | ---- | ------------------------------------------------------ |
| `NOT_FOUND`        | 404  | City or category slug not found, or either is inactive |
| `VALIDATION_ERROR` | 400  | Invalid parameter values                               |

**Frontend Usage**

- City + Category landing page (`/[city-slug]/[category-slug]`) — full listing grid with pagination

**Analytics Event Emitted**

`category_page_viewed` — properties: `{ city_slug: string, category_slug: string }`

**Cache Invalidation**

ISR 24 hours. `revalidatePath('/[city-slug]/[category-slug]')` called whenever a listing in this city + category combination changes publication status.

---

### 5. Get Entity Page by Slug

**Type:** Route Handler
**Route / Action:** `GET /api/listings/[city-slug]/[entity-type]/[listing-slug]`
**Phase:** MVP
**Auth:** Anonymous (public data); authenticated user receives `is_saved: true | false`

**Request**

```typescript
// All identifiers are path parameters — no query params
// Path: /api/listings/{city-slug}/{entity-type}/{listing-slug}
```

**Response**

```typescript
interface EntityPageData {
  listing: {
    id: string
    name: string
    slug: string
    entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
    tagline: string | null
    status: string
    trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
    listing_tier: 'free' | 'standard' | 'premium'
    logo_path: string | null
    cover_image_path: string | null
    avg_rating: number | null
    review_count: number
    save_count: number
    published_at: string | null
    noindex: boolean
    canonical_url: string | null
    meta_title: string | null
    meta_description: string | null
    og_image_path: string | null
    city: {
      id: string
      name: string
      slug: string
    } | null
    category: {
      id: string
      name: string
      slug: string
    }
    owner_user_id: string | null // Only included if requester is the listing owner
  }
  details: {
    // listing_details_business fields (for business and vendor entity types)
    description: string | null
    hours: Record<string, { open: string; close: string; closed: boolean }> | null
    hours_notes: string | null
    address_line_1: string | null
    address_line_2: string | null
    city_text: string | null
    state: string | null
    zip: string | null
    phone: string | null
    email: string | null
    website_url: string | null
    social_instagram: string | null
    social_facebook: string | null
    social_linkedin: string | null
    social_tiktok: string | null
    social_youtube: string | null
    social_twitter: string | null
    cta_type: string
    cta_url: string | null
    cta_label_override: string | null
    price_range: '$' | '$$' | '$$$' | '$$$$' | null
    founded_year: number | null
  }
  media: Array<{
    id: string
    file_path: string // Storage path — caller generates URL
    alt_text: string | null
    display_order: number
    width: number | null
    height: number | null
  }>
  services: Array<{
    id: string
    name: string
    description: string | null
    price: number | null
    price_type: 'fixed' | 'starting-at' | 'hourly' | 'custom' | 'free' | null
    price_note: string | null
    duration_minutes: number | null
    cta_type: string | null
    cta_url: string | null
    display_order: number
    is_visible: boolean
  }>
  listing_hours: Array<{
    day_of_week: number // 0 = Sunday, 6 = Saturday
    open_time: string | null // "HH:MM" format
    close_time: string | null
    is_closed: boolean
    notes: string | null
  }>
  listing_links: Array<{
    platform: string
    url: string
    display_order: number
  }>
  is_saved: boolean // Always false for Anonymous; true if authenticated user has saved this listing
}
```

**Validation Rules**

- All three path parameters must be non-empty strings
- `entity-type` must be one of: `business`, `professional`, `creative`, `event`, `job`, `vendor`
- `listing-slug` validated against `listings.slug`
- `city-slug` validated against the listing's resolved `city_id` → `cities.slug`

**Permission Checks**

- Anonymous: listing must have `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- Authenticated owner (`owner_user_id = auth.uid()`): may also see listings with `status = 'draft'` or `status = 'pending'` for their own listing
- If city-slug or entity-type in the URL path do not match the listing's actual values, respond with 301 redirect to the correct canonical URL
- `owner_user_id` field only included in response when `auth.uid() = listing.owner_user_id`
- Services filtered to `is_visible = true` for Anonymous and non-owner authenticated users

**Errors**

| Code                | HTTP | When                                                                                    |
| ------------------- | ---- | --------------------------------------------------------------------------------------- |
| `NOT_FOUND`         | 404  | Listing slug not found, or listing is not published for Anonymous                       |
| `WRONG_ENTITY_TYPE` | 301  | Entity type in URL path does not match `listings.entity_type` — redirect to correct URL |

**Frontend Usage**

- Business BLACQList Page (`/[city-slug]/business/[listing-slug]`) — renders the full public listing page
- Same route handler serves all entity types; frontend determines layout from `entity_type`

**Analytics Event Emitted**

`listing_page_viewed` — properties: `{ listing_id: string, entity_type: string, trust_tier: string, referrer: string | null }`

**Cache Invalidation**

ISR 1 hour. `revalidatePath('/[city-slug]/[entity-type]/[listing-slug]')` called on any owner save, admin update, or status change affecting this listing.

---

### 6. Get Related Entities

**Type:** Route Handler
**Route / Action:** `GET /api/listings/[id]/related`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
interface RelatedQueryParams {
  limit?: number // Default: 4, max: 12
}
```

**Response**

```typescript
// Array of SearchResult (same shape as endpoint 1)
// Same category + same city as the source listing
// Excludes the source listing itself
// Filtered to status = 'published' AND deleted_at IS NULL AND flag_status = 'none'
// Sorted by trust_tier DESC (certified > verified > claimed > unclaimed), then avg_rating DESC NULLS LAST
// Response envelope: { data: SearchResult[] }
```

**Validation Rules**

- `id`: must be a valid UUID
- `limit`: max 12; coerce to integer

**Permission Checks**

- Source listing must exist and `deleted_at IS NULL`; returns 404 if not found
- Related listings filtered to `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`

**Errors**

| Code               | HTTP | When                                        |
| ------------------ | ---- | ------------------------------------------- |
| `NOT_FOUND`        | 404  | Source listing ID not found or soft-deleted |
| `VALIDATION_ERROR` | 400  | `id` is not a valid UUID                    |

**Frontend Usage**

- "More like this" section on the BLACQList Page — displayed below the main listing content

**Analytics Event Emitted**

None.

**Cache Invalidation**

ISR 1 hour.

---

### 7. List Collections

**Type:** Route Handler
**Route / Action:** `GET /api/collections`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
// No query params
```

**Response**

```typescript
interface CollectionCard {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image_path: string | null // Storage path; caller generates URL
  listing_count: number
  display_order: number
}

// Response envelope: { data: CollectionCard[] }
// Filtered to is_active = true; sorted by display_order ASC
```

**Validation Rules**

- None — no parameters accepted.

**Permission Checks**

- Only `is_active = true` collections returned
- `listing_count` counts only published, non-deleted listings in each collection

**Errors**

| Code | HTTP | When                                               |
| ---- | ---- | -------------------------------------------------- |
| —    | —    | Returns empty array if no active collections exist |

**Frontend Usage**

- Collections index page (`/collections`) — renders the full collections grid
- Homepage featured collection slot — uses first item from response

**Analytics Event Emitted**

`collections_index_viewed` — no properties.

**Cache Invalidation**

ISR 1 hour. Revalidated when an admin creates, updates, or deactivates a collection.

---

### 8. Get Collection Detail

**Type:** Route Handler
**Route / Action:** `GET /api/collections/[slug]`
**Phase:** MVP
**Auth:** Anonymous

**Request**

```typescript
// No query params — collection slug is path parameter
```

**Response**

```typescript
interface CollectionDetailData {
  collection: {
    id: string
    title: string
    slug: string
    description: string | null
    cover_image_path: string | null // Storage path; caller generates URL
  }
  listings: SearchResult[] // Same shape as endpoint 1; ordered by collection display_order ASC
}

// Response envelope: { data: CollectionDetailData }
```

**Validation Rules**

- `slug`: must be a non-empty string; validated against `collections.slug`

**Permission Checks**

- Returns 404 if collection not found or `is_active = false`
- Listings in the collection filtered to `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`

**Errors**

| Code        | HTTP | When                                              |
| ----------- | ---- | ------------------------------------------------- |
| `NOT_FOUND` | 404  | Collection slug not found, or `is_active = false` |

**Frontend Usage**

- Collection Page (`/collection/[slug]`) — renders the curated collection listing grid

**Analytics Event Emitted**

`collection_page_viewed` — properties: `{ collection_id: string, slug: string }`

**Cache Invalidation**

ISR 1 hour. `revalidatePath('/collection/[slug]')` called when admin adds, removes, or reorders listings within this collection.

---

### 9. Browse Events

**Type:** Route Handler
**Route / Action:** `GET /api/listings?type=event`
**Phase:** Beta
**Auth:** Anonymous

**Request**

```typescript
interface EventBrowseQueryParams {
  type: 'event' // Required — this endpoint is the handler when type=event is passed
  city?: string // City slug
  page?: number // Default: 1
  limit?: number // Default: 20, max: 100
}
```

**Response**

```typescript
// Array of SearchResult (same shape as endpoint 1)
// Filtered to entity_type = 'event' AND status = 'published' AND deleted_at IS NULL
// Only future events: JOIN listing_details_event WHERE event_date > CURRENT_DATE
// Sorted by listing_details_event.event_date ASC
// Response envelope: { data: SearchResult[], meta: { total, page, limit } }
```

**Validation Rules**

- `city`: validated against `cities` table; invalid slug returns empty array
- `limit`: max 100; coerce to integer
- `page`: min 1

**Permission Checks**

- `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- Only events where `listing_details_event.event_date > CURRENT_DATE`

**Errors**

| Code               | HTTP | When                     |
| ------------------ | ---- | ------------------------ |
| `VALIDATION_ERROR` | 400  | Invalid parameter values |

**Frontend Usage**

- Events browse page (`/events` or `/[city-slug]/events`) — full paginated event list

**Analytics Event Emitted**

`events_browse_viewed` — properties: `{ city_slug: string | null }`

**Cache Invalidation**

ISR 30 minutes. `revalidatePath('/events')` called when an event listing is published or updated.

---

### 10. Browse Jobs

**Type:** Route Handler
**Route / Action:** `GET /api/listings?type=job`
**Phase:** Beta
**Auth:** Anonymous

**Request**

```typescript
interface JobBrowseQueryParams {
  type: 'job' // Required — this endpoint is the handler when type=job is passed
  city?: string // City slug
  page?: number // Default: 1
  limit?: number // Default: 20, max: 100
}
```

**Response**

```typescript
// Array of SearchResult (same shape as endpoint 1)
// Filtered to entity_type = 'job' AND status = 'published' AND deleted_at IS NULL
// Excludes expired jobs: listings.auto_expire_at IS NULL OR listings.auto_expire_at > now()
// Sorted by listings.published_at DESC
// Response envelope: { data: SearchResult[], meta: { total, page, limit } }
```

**Validation Rules**

- `city`: validated against `cities` table; invalid slug returns empty array
- `limit`: max 100; coerce to integer
- `page`: min 1

**Permission Checks**

- `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`
- Non-expired only: `auto_expire_at IS NULL OR auto_expire_at > now()`

**Errors**

| Code               | HTTP | When                     |
| ------------------ | ---- | ------------------------ |
| `VALIDATION_ERROR` | 400  | Invalid parameter values |

**Frontend Usage**

- Jobs browse page (`/jobs` or `/[city-slug]/jobs`) — full paginated job list

**Analytics Event Emitted**

`jobs_browse_viewed` — properties: `{ city_slug: string | null }`

**Cache Invalidation**

ISR 30 minutes. `revalidatePath('/jobs')` called when a job listing is published or updated.

---

## Section 2: Auth & Account

These endpoints manage the authenticated user's own identity and onboarding state. Auth is required for all three. Role checks use the `user_roles` table.

---

### 11. Get Current User

**Type:** Route Handler
**Route / Action:** `GET /api/me`
**Phase:** MVP
**Auth:** Supporter (any authenticated user)

**Request**

```typescript
// No body or query params — identity derived from session cookie
```

**Response**

```typescript
interface CurrentUser {
  id: string
  display_name: string | null
  avatar_url: string | null // Storage path; caller generates URL
  bio: string | null
  city_id: string | null
  website_url: string | null
  created_at: string // ISO 8601
  roles: Array<{
    role: 'supporter' | 'owner' | 'editor' | 'admin' | 'super_admin'
    listing_id: string | null // Non-null only for 'owner' role
  }>
}

// Response envelope: { data: CurrentUser }
```

**Validation Rules**

- None — no input parameters.

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- Query `profiles` where `id = auth.uid()`
- Query `user_roles` where `user_id = auth.uid()` for all role records

**Errors**

| Code            | HTTP | When                            |
| --------------- | ---- | ------------------------------- |
| `AUTH_REQUIRED` | 401  | No valid session cookie present |

**Frontend Usage**

- Nav user menu — populates display name and avatar
- Account settings screen — pre-fills current values
- Owner dashboard — verifies owner role before rendering

**Analytics Event Emitted**

None.

**Cache Invalidation**

None — fully dynamic.

---

### 12. Update Profile

**Type:** Server Action
**Route / Action:** `lib/actions/account/updateProfile`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface UpdateProfileInput {
  display_name?: string // Max 100 chars
  avatar_url?: string // Supabase Storage path (not a URL); must match avatars bucket path format
  bio?: string // Max 500 chars
  city_id?: string // Valid UUID; must exist in cities table
  website_url?: string // Must start with https://
}
```

**Response**

```typescript
interface UpdatedProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  city_id: string | null
  website_url: string | null
}

// Response envelope: { data: UpdatedProfile }
// On success: no revalidatePath (profile page not public in MVP)
```

**Validation Rules**

- `display_name`: max 100 characters if provided; min 1 character if provided (no empty string)
- `bio`: max 500 characters if provided
- `website_url`: must start with `https://` if provided; validated as a parseable URL
- `avatar_url`: must be a Supabase Storage path (not a full URL); validated via path prefix check
- `city_id`: must be a valid UUID and must exist in the `cities` table if provided
- All fields are optional — partial updates are supported; omitted fields are unchanged

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; redirect to `/login` if no session
- UPDATE applied only where `profiles.id = auth.uid()`

**Errors**

| Code               | HTTP | When                                                                             |
| ------------------ | ---- | -------------------------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                                                 |
| `VALIDATION_ERROR` | 400  | Field-level validation failure (see fields object in response)                   |
| `SERVER_ERROR`     | 500  | Unexpected database error (safe message returned; full error logged server-side) |

**Frontend Usage**

- Account Settings screen — invoked on form submit; displays field-level errors inline on failure; shows success toast on completion

**Analytics Event Emitted**

None.

**Cache Invalidation**

None (profile pages are not public-facing in MVP).

---

### 13. Set Onboarding Role

**Type:** Server Action
**Route / Action:** `lib/actions/account/setOnboardingRole`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface SetOnboardingRoleInput {
  role: 'supporter' | 'owner'
}
```

**Response**

```typescript
interface OnboardingRoleResult {
  role: 'supporter' | 'owner'
  onboarding_completed: true
}

// Response envelope: { data: OnboardingRoleResult }
```

**Validation Rules**

- `role`: required; must be exactly `'supporter'` or `'owner'`; `'admin'` and `'super_admin'` are rejected with `VALIDATION_ERROR`

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user
- Check `user_roles` table: if a `'supporter'` or `'owner'` role already exists for this `user_id`, return `ROLE_ALREADY_SET` 409
- INSERT via service role into `user_roles` with `{ user_id: auth.uid(), role, listing_id: null, granted_by: null }`

**Errors**

| Code               | HTTP | When                                                           |
| ------------------ | ---- | -------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                               |
| `VALIDATION_ERROR` | 400  | `role` is not `'supporter'` or `'owner'`, or field is missing  |
| `ROLE_ALREADY_SET` | 409  | User already has a `supporter` or `owner` role in `user_roles` |

**Frontend Usage**

- Onboarding screen — invoked once on role selection; on success, redirects to the appropriate dashboard or next onboarding step

**Analytics Event Emitted**

`onboarding_role_set` — properties: `{ role: 'supporter' | 'owner' }`

**Cache Invalidation**

None.

---

## Section 3: Saves & Shares

Saves are lightweight toggles that authenticated users apply to listings. The route handler pattern (not Server Actions) is used for save/unsave because they are triggered by interactive buttons on listing cards, not form submissions, and benefit from the direct fetch model for optimistic UI.

---

### 14. Save Entity

**Type:** Route Handler
**Route / Action:** `POST /api/saves`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface SaveEntityBody {
  listing_id: string // UUID
}
```

**Response**

```typescript
interface SaveResult {
  saved: true
  listing_id: string
}

// Response envelope: { data: SaveResult }
// HTTP 201 Created
```

**Validation Rules**

- `listing_id`: required; must be a valid UUID format
- Listing must exist in `listings` table with `status = 'published' AND deleted_at IS NULL`

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- `user_id` is set server-side from `auth.uid()` — not accepted from the client
- DB operation: `INSERT INTO saves (user_id, listing_id) ON CONFLICT (user_id, listing_id) DO NOTHING`

**Errors**

| Code               | HTTP | When                                                         |
| ------------------ | ---- | ------------------------------------------------------------ |
| `AUTH_REQUIRED`    | 401  | No valid session                                             |
| `VALIDATION_ERROR` | 400  | `listing_id` is missing or not a valid UUID                  |
| `NOT_FOUND`        | 404  | Listing does not exist, is not published, or is soft-deleted |

**Frontend Usage**

- Save button on BLACQList Page and listing cards — optimistic UI: toggle button state immediately on click, then fire the request; roll back if request fails with toast error

**Analytics Event Emitted**

`listing_saved` — properties: `{ listing_id: string, entity_type: string }`

**Cache Invalidation**

None. The `save_count` on `listings` is updated by a DB trigger on `saves` INSERT; next ISR revalidation picks up the updated count.

---

### 15. Unsave Entity

**Type:** Route Handler
**Route / Action:** `DELETE /api/saves`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface UnsaveEntityParams {
  listing_id: string // UUID — passed as query parameter: DELETE /api/saves?listing_id=...
}
```

**Response**

```typescript
// HTTP 204 No Content — no response body
// Returns 204 even if the save row did not exist (idempotent)
```

**Validation Rules**

- `listing_id`: required; must be a valid UUID format
- No validation of listing existence — the operation is always safe to execute

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- DELETE applied with `WHERE user_id = auth.uid() AND listing_id = $listing_id`
- Idempotent: no error if the row does not exist

**Errors**

| Code               | HTTP | When                                        |
| ------------------ | ---- | ------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                            |
| `VALIDATION_ERROR` | 400  | `listing_id` is missing or not a valid UUID |

**Frontend Usage**

- Save button (filled/active state) on BLACQList Page and cards — optimistic UI: toggle immediately, fire request, roll back on failure
- Saved Listings page (`/account/saved`) — remove action on each saved listing item

**Analytics Event Emitted**

`listing_unsaved` — properties: `{ listing_id: string }`

**Cache Invalidation**

None. DB trigger on `saves` DELETE updates `listings.save_count`.

---

### 16. List Saved Entities

**Type:** Route Handler
**Route / Action:** `GET /api/saves`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface SavesListQueryParams {
  page?: number // Default: 1
  limit?: number // Default: 20, max: 100
}
```

**Response**

```typescript
interface SavedListingCard extends SearchResult {
  saved_at: string // ISO 8601 timestamp of when the listing was saved
}

// Response envelope: { data: SavedListingCard[], meta: { total, page, limit } }
// Ordered by saves.created_at DESC (most recently saved first)
// Listings with deleted_at IS NOT NULL are excluded even if save row exists
```

**Validation Rules**

- `page`: min 1; coerce to integer
- `limit`: max 100; coerce to integer

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- JOIN: `saves WHERE saves.user_id = auth.uid()` → JOIN `listings WHERE deleted_at IS NULL`
- Only returns listings the authenticated user has saved

**Errors**

| Code               | HTTP | When                        |
| ------------------ | ---- | --------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session            |
| `VALIDATION_ERROR` | 400  | Invalid page or limit value |

**Frontend Usage**

- Saved Listings screen (`/account/saved`) — full paginated grid of the user's saved listings

**Analytics Event Emitted**

`saved_list_viewed` — no properties.

**Cache Invalidation**

None — fully dynamic.

---

### 17. Log Analytics Event

**Type:** Route Handler
**Route / Action:** `POST /api/analytics/event`
**Phase:** MVP
**Auth:** Anonymous (unauthenticated events permitted)

**Request**

```typescript
interface AnalyticsEventBody {
  event_name: string // Must be one of the 45 defined event names (see analytics enum)
  entity_type?: string // E.g., 'listing', 'collection', 'search'
  entity_id?: string // UUID of the entity being interacted with
  properties?: Record<string, unknown> // Max 5KB serialized
  session_id?: string // Client-generated session identifier for anonymous attribution
}
```

**Response**

```typescript
interface AnalyticsEventResult {
  success: true
}

// Response envelope: { data: { success: true } }
// HTTP 200 — fire and forget; always returns 200 unless event_name is invalid
```

**Validation Rules**

- `event_name`: required; must be one of the 45 defined event names validated against a server-side enum; return `VALIDATION_ERROR` 400 for unrecognized event names
- `properties`: max 5KB when serialized to JSON; excess payload rejected with `VALIDATION_ERROR`
- `entity_id`: must be a valid UUID format if provided
- All other fields: optional; silently coerced if type is wrong (server handles gracefully)

**Permission Checks**

- No auth requirement — anonymous events are accepted
- `user_id` is set from `supabase.auth.getUser()` if a valid session is present; null for Anonymous
- `ip_address` is hashed SHA-256 server-side before storage — the raw IP address is never persisted
- Rate limit: 300 events per minute per `session_id`; excess requests return HTTP 429 but the error is not surfaced to the user (fire-and-forget)

**Errors**

| Code               | HTTP | When                                                                   |
| ------------------ | ---- | ---------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | `event_name` not in the defined enum, or `properties` exceeds 5KB      |
| `RATE_LIMITED`     | 429  | Exceeds 300 events/min per `session_id` (silently swallowed by client) |

**Frontend Usage**

- Every client-side interaction event fires this endpoint via a `useAnalytics()` hook or direct fetch; pattern is fire-and-forget — the UI does not wait for or act on the response

**Analytics Event Emitted**

This is the analytics ingestion endpoint. No secondary event is emitted.

**Cache Invalidation**

None.

---

## Section 4: Entity Submission

These endpoints and actions cover the full lifecycle of submitting a new listing: duplicate check, creation, draft autosave, media upload, and final submission for review.

---

### 18. Check for Duplicate Listing

**Type:** Route Handler
**Route / Action:** `POST /api/listings/duplicate-check`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface DuplicateCheckBody {
  name: string // Max 200 chars
  city_id: string // UUID
}
```

**Response**

```typescript
interface DuplicateCheckResult {
  duplicates: Array<{
    id: string
    name: string
    slug: string
    city: {
      name: string
    }
    entity_type: string
    trust_tier: string
    match_score: number // pg_trgm similarity score between 0 and 1
  }>
}

// Response envelope: { data: DuplicateCheckResult }
// Returns empty duplicates array if no matches found — never 404
```

**Validation Rules**

- `name`: required; max 200 characters; min 2 characters
- `city_id`: required; must be a valid UUID; must exist in the `cities` table

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- Query is read-only — no write operations; service layer uses authenticated client
- DB: `SELECT id, name, slug, city_id, entity_type, trust_tier, similarity(name, $1) AS match_score FROM listings WHERE city_id = $2 AND deleted_at IS NULL AND similarity(name, $1) > 0.3 ORDER BY match_score DESC LIMIT 5`

**Errors**

| Code               | HTTP | When                                                                                    |
| ------------------ | ---- | --------------------------------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                                                        |
| `VALIDATION_ERROR` | 400  | `name` or `city_id` missing, `city_id` is not a valid UUID, or `city_id` does not exist |

**Frontend Usage**

- Add Business form step 2 — called before the final submit button becomes active; if `duplicates.length > 0`, show a duplicate warning modal with the matched listings; user must acknowledge before continuing

**Analytics Event Emitted**

`duplicate_warning_shown` — fired only if `duplicates.length > 0`; properties: `{ listing_name: string, city_id: string, duplicate_count: number }`

**Cache Invalidation**

None.

---

### 19. Create Listing

**Type:** Server Action
**Route / Action:** `lib/actions/listings/createListing`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface CreateListingInput {
  // Core listing fields
  entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job'
  name: string // Required; max 200 chars
  tagline?: string // Max 140 chars
  category_id: string // Required; UUID; must exist in categories table
  city_id?: string // UUID; null for online-only entities
  location_type: 'physical' | 'online' | 'hybrid' | 'virtual-services' | 'ships-nationwide'

  // Business detail fields (for entity_type = 'business')
  description?: string
  phone?: string // Valid US phone format if provided
  email?: string // Valid email format if provided
  website_url?: string // Must start with https:// if provided
  address_line_1?: string
  address_line_2?: string
  state?: string // Two-letter US state code
  zip?: string
  cta_type: string // Required; must be a valid cta_type value for entity_type
  cta_url?: string // Required unless cta_type = 'call'
  cta_label_override?: string // Max 50 chars

  // Hours — optional at creation; structured as object
  hours?: Record<
    'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday',
    { open: string; close: string; closed: boolean }
  >

  // Media — optional at creation; paths from prior /api/upload calls
  logo_path?: string // Storage path
  cover_image_path?: string // Storage path
}
```

**Response**

```typescript
interface CreateListingResult {
  listing_id: string
  slug: string
  status: 'draft'
}

// Response envelope: { data: CreateListingResult }
// HTTP 201 Created
```

**Validation Rules**

- `entity_type`: required; must be one of the five valid values (vendor is excluded — vendor listings are created through a separate flow)
- `name`: required; min 2 chars; max 200 chars
- `tagline`: max 140 characters if provided
- `category_id`: required; valid UUID; must exist in `categories` table with `is_active = true`
- `location_type`: required; must be a valid value
- `city_id`: required when `location_type = 'physical'` or `'hybrid'`; optional otherwise
- `email`: valid email format if provided
- `website_url`: must start with `https://` if provided
- `phone`: valid US phone format (10 digits) if provided
- `cta_url`: required when `cta_type != 'call'`
- `cta_label_override`: max 50 characters if provided
- `logo_path` and `cover_image_path`: must be valid Supabase Storage paths in the `listing-media` bucket if provided (validate path format)

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; redirect to `/login` if no session
- `owner_user_id` set to `auth.uid()` server-side — never accepted from client
- `submitted_by` set to `auth.uid()` server-side
- `source` set to `'owner'` server-side
- DB: INSERT into `listings` (status = 'draft'), then INSERT into `listing_details_business` (or appropriate detail table), then INSERT into `user_roles` `{ user_id: auth.uid(), role: 'owner', listing_id: newListing.id }` using service role if user does not already have an owner role for this listing

**Errors**

| Code               | HTTP | When                                                                    |
| ------------------ | ---- | ----------------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                                        |
| `VALIDATION_ERROR` | 400  | Any field-level validation failure (fields object included in response) |
| `SERVER_ERROR`     | 500  | Unexpected database error (safe message returned; full error logged)    |

**Frontend Usage**

- Add Business form final submit — on success, redirect to `/dashboard/listings/[listing_id]/edit` (the Page Editor) to complete the listing before submitting for review

**Analytics Event Emitted**

`listing_created` — properties: `{ listing_id: string, entity_type: string, city_id: string | null, has_media: boolean }`

**Cache Invalidation**

None at creation (listing is `draft` and not publicly visible). ISR cache path is created once the listing is published.

---

### 20. Update Listing Draft (Autosave)

**Type:** Server Action
**Route / Action:** `lib/actions/listings/updateListingDraft`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface UpdateListingDraftInput {
  listing_id: string // UUID
  section: 'hero' | 'contact' | 'hours' | 'social' | 'cta' | 'about' | 'seo'
  fields: Record<string, unknown> // Section-specific fields; validated per section
}
```

**Section field maps:**

```typescript
// section = 'hero'
interface HeroFields {
  name?: string // Max 200 chars
  tagline?: string // Max 140 chars
  logo_path?: string // Storage path
  cover_image_path?: string
}

// section = 'contact'
interface ContactFields {
  phone?: string
  email?: string
  website_url?: string // Must start with https://
  address_line_1?: string
  address_line_2?: string
  state?: string
  zip?: string
}

// section = 'hours'
interface HoursFields {
  hours?: Record<string, { open: string; close: string; closed: boolean }>
  hours_notes?: string
}

// section = 'social'
interface SocialFields {
  social_instagram?: string
  social_facebook?: string
  social_linkedin?: string
  social_tiktok?: string
  social_youtube?: string
  social_twitter?: string
}

// section = 'cta'
interface CTAFields {
  cta_type?: string
  cta_url?: string
  cta_label_override?: string // Max 50 chars
}

// section = 'about'
interface AboutFields {
  description?: string
  price_range?: '$' | '$$' | '$$$' | '$$$$' | null
  founded_year?: number // Between 1800 and current year
}

// section = 'seo'
interface SEOFields {
  meta_title?: string // Max 60 chars
  meta_description?: string // Max 160 chars
  og_image_path?: string // Storage path
}
```

**Response**

```typescript
interface AutosaveResult {
  saved_at: string // ISO 8601 timestamp
}

// Response envelope: { data: AutosaveResult }
```

**Validation Rules**

- `listing_id`: required; valid UUID
- `section`: required; must be one of the seven valid section values
- `fields`: validated per section map above; unrecognized field keys for a section are rejected with `VALIDATION_ERROR`
- `website_url`: must start with `https://` if provided in contact section
- `founded_year`: must be an integer between 1800 and the current year if provided
- `cta_url`: required if `cta_type != 'call'` when updating the CTA section

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; return `AUTH_REQUIRED` if no session
- Verify `listings.owner_user_id = auth.uid()` AND `listings.deleted_at IS NULL`; return `FORBIDDEN` if check fails
- UPDATE applied only to the relevant table (`listings` for hero/seo fields; `listing_details_business` for contact/hours/social/cta/about fields)
- After update: set `listings.last_edited_by_owner_at = now()`

**Errors**

| Code               | HTTP | When                                                     |
| ------------------ | ---- | -------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                         |
| `FORBIDDEN`        | 403  | `owner_user_id != auth.uid()` or listing is soft-deleted |
| `NOT_FOUND`        | 404  | `listing_id` does not exist                              |
| `VALIDATION_ERROR` | 400  | Field-level validation failure                           |
| `SERVER_ERROR`     | 500  | Unexpected database error                                |

**Frontend Usage**

- Page Editor — autosave fires on every section's field blur event; UI shows "Saving…" → "Saved" state feedback using the `saved_at` timestamp in the response

**Analytics Event Emitted**

`page_section_edited` — properties: `{ listing_id: string, section: string }`

**Cache Invalidation**

If `listings.status = 'published'`: call `revalidatePath('/[city-slug]/[entity-type]/[listing-slug]')` after successful save. If status is `'draft'` or `'pending'`: no revalidation (draft pages are not cached).

---

### 21. Upload Entity Media

**Type:** Route Handler
**Route / Action:** `POST /api/upload`
**Phase:** MVP
**Auth:** Supporter (for `listing-media` bucket); service_role only for `verification-docs` and `receipts` buckets

**Request**

```typescript
// Content-Type: multipart/form-data
interface UploadFormData {
  file: File
  bucket: 'listing-media' | 'verification-docs' | 'receipts'
  entity_type: string // E.g., 'listing', 'user'
  entity_id: string // UUID of the parent entity
  media_role?: 'logo' | 'cover' | 'gallery' // For listing-media bucket only
}
```

**Response**

```typescript
interface UploadResult {
  path: string // Supabase Storage path — NEVER a URL
}

// Response envelope: { data: UploadResult }
// HTTP 201 Created
```

**Validation Rules**

- `bucket = 'listing-media'`:
  - MIME type: `image/jpeg`, `image/png`, or `image/webp` only
  - `media_role = 'cover'`: max 5MB
  - `media_role = 'logo'`: max 2MB
  - `media_role = 'gallery'` (default): max 3MB
- `bucket = 'verification-docs'`:
  - MIME type: `image/jpeg`, `image/png`, or `application/pdf` only
  - Max 10MB
- `bucket = 'receipts'`:
  - MIME type: `image/jpeg`, `image/png`, or `image/webp` only
  - Max 10MB
- `entity_id`: must be a valid UUID
- Filename is always server-generated: `[entity_type]/[entity_id]/[media_role|type]/[uuid].[ext]` — the user-supplied filename is never used

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; 401 if no session
- For `listing-media`: verify `listings.owner_user_id = auth.uid()` where `listings.id = entity_id`; return `FORBIDDEN` if check fails
- For `verification-docs` and `receipts`: these buckets are only writable via service_role from other server-side actions; this endpoint returns `FORBIDDEN` for authenticated non-service requests to these buckets
- After successful upload to `listing-media` bucket with `media_role = 'gallery'`: INSERT into `media_attachments` table with file metadata. For `logo` and `cover` uploads: caller is responsible for updating `listings.logo_path` or `listings.cover_image_path` via the `updateListingDraft` action

**Errors**

| Code               | HTTP | When                                                                                      |
| ------------------ | ---- | ----------------------------------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                                                          |
| `FORBIDDEN`        | 403  | `owner_user_id != auth.uid()` for listing-media, or non-service access to private buckets |
| `VALIDATION_ERROR` | 400  | Invalid MIME type, file exceeds size limit, missing required fields                       |
| `UPLOAD_FAILED`    | 500  | Supabase Storage upload failed (logged server-side; safe message returned)                |

**Frontend Usage**

- Image uploader component in Add Business form — called when user selects or captures a file; returned `path` is stored in component state and passed to `createListing` or `updateListingDraft` on save
- Page Editor media section — same component; returned `path` immediately triggers `updateListingDraft` with the new path

**Analytics Event Emitted**

`media_uploaded` — properties: `{ listing_id: string, file_type: string, bucket: string, media_role: string }`

**Cache Invalidation**

None at upload. Cache is invalidated when the listing is updated via `updateListingDraft` with the new path.

---

### 22. Submit Listing for Review

**Type:** Server Action
**Route / Action:** `lib/actions/listings/submitListingForReview`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface SubmitListingForReviewInput {
  listing_id: string // UUID
}
```

**Response**

```typescript
interface SubmitForReviewResult {
  listing_id: string
  status: 'pending'
  message: string // E.g., "Your listing has been submitted for review. We'll notify you within 2 business days."
}

// Response envelope: { data: SubmitForReviewResult }
```

**Validation Rules**

- `listing_id`: required; valid UUID
- Listing must have all required fields populated before submission is allowed:
  - `listings.name` is not null
  - `listings.category_id` is not null
  - `listings.entity_type` is not null
  - `listing_details_business.cta_type` is not null (for business entity type)
- `listings.status` must be `'draft'` — cannot re-submit a `'pending'` or `'published'` listing
- Completion check is performed by the service layer before the status transition

**Permission Checks**

- `supabase.auth.getUser()` must return a valid user; redirect to `/login` if no session
- Verify `listings.owner_user_id = auth.uid()` AND `listings.deleted_at IS NULL`; return `FORBIDDEN` if check fails
- DB: UPDATE `listings SET status = 'pending', updated_by = auth.uid()`; INSERT into `moderation_queue` with listing context

**Errors**

| Code                        | HTTP | When                                                                        |
| --------------------------- | ---- | --------------------------------------------------------------------------- |
| `AUTH_REQUIRED`             | 401  | No valid session                                                            |
| `FORBIDDEN`                 | 403  | `owner_user_id != auth.uid()` or listing is soft-deleted                    |
| `NOT_FOUND`                 | 404  | `listing_id` does not exist                                                 |
| `VALIDATION_ERROR`          | 400  | Required fields are missing (response includes which fields are incomplete) |
| `INVALID_STATUS_TRANSITION` | 422  | Listing is not in `'draft'` status — cannot be submitted                    |

**Frontend Usage**

- Page Editor — "Submit for Review" button appears when the listing has all required fields populated; on success, redirect to a confirmation screen showing review timeline

**Analytics Event Emitted**

`listing_submitted_for_review` — properties: `{ listing_id: string, entity_type: string }`

**Cache Invalidation**

## None — listing transitions from `'draft'` to `'pending'`; neither status is publicly cached.

## Section 5: Claim Workflow

---

### 23. Create Claim

**Type:** Server Action
**Route / Action:** `lib/actions/claims/createClaim`
**Phase:** MVP
**Auth:** Supporter (authenticated user with any role)

**Request**

```typescript
interface CreateClaimInput {
  listing_id: string // uuid
  verification_email: string
  verification_phone?: string
  role_at_business: string // "owner" | "manager" | "authorized_agent"
  notes?: string
}
```

**Response**

```typescript
interface CreateClaimResponse {
  claim_id: string // uuid
  status: 'pending'
  message: string
}
```

**Validation Rules**

- `listing_id` required; must be a valid UUID
- `verification_email` required; must be a valid email format
- `verification_phone` optional; if provided, must be a non-empty string (formatting validated at UI layer)
- `role_at_business` required; must be one of `"owner"`, `"manager"`, `"authorized_agent"`; max 100 chars
- `notes` optional; max 500 chars
- Referenced `listing_id` must exist and not be soft-deleted (`deleted_at IS NULL`)
- Referenced listing must not already have `owner_user_id` set to a different authenticated user (checked pre-insert)

**Permission Checks**

- `auth.uid()` must be non-null (authenticated)
- Block if an open claim already exists: `EXISTS (SELECT 1 FROM claims WHERE claimant_user_id = auth.uid() AND listing_id = $listing_id AND status IN ('pending', 'under_review'))` → return `409 CLAIM_ALREADY_OPEN`
- Rate limit: max 3 open claims per user within a rolling 24-hour window → return `429 RATE_LIMITED`
- If `listings.owner_user_id = auth.uid()` already, block with `422 LISTING_ALREADY_CLAIMED` (user already owns it)

**Errors**

| Code                      | HTTP | When                                                                    |
| ------------------------- | ---- | ----------------------------------------------------------------------- |
| `VALIDATION_ERROR`        | 400  | Missing or invalid fields                                               |
| `AUTH_REQUIRED`           | 401  | No authenticated session                                                |
| `CLAIM_ALREADY_OPEN`      | 409  | A pending or under_review claim already exists for this user + listing  |
| `LISTING_ALREADY_CLAIMED` | 422  | Listing already has an owner (different user) or caller already owns it |
| `RATE_LIMITED`            | 429  | More than 3 open claims in 24 hours                                     |

**Frontend Usage**

- Claim Form screen at `/claim/[listing-id]`
- On success: show confirmation message with `claim_id` and status; navigate to claim status page

**Analytics Event Emitted**
`claim_submitted` — when claim INSERT succeeds; properties: `{ listing_id, has_verification_email: true }`

**Cache Invalidation**
None

---

### 24. Upload Claim Proof

**Type:** Route Handler (reuses `POST /api/upload` with claim-specific bucket + entity parameters)
**Route / Action:** `POST /api/upload`
**Phase:** MVP
**Auth:** Supporter (claimant must own the claim being uploaded to)

**Request**

```typescript
// multipart/form-data
interface UploadClaimProofInput {
  file: File
  bucket: 'verification-docs'
  entity_id: string // claim_id (uuid)
}
```

**Response**

```typescript
interface UploadClaimProofResponse {
  path: string // Supabase Storage path — never a URL
}
```

**Validation Rules**

- `file` required; must not be empty
- MIME type must be one of: `image/jpeg`, `image/png`, `application/pdf`
- File size must not exceed 10MB (10 × 1024 × 1024 bytes)
- `entity_id` must be a valid UUID and map to an existing `claims` row

**Permission Checks**

- `auth.uid()` must be non-null
- `claims.claimant_user_id = auth.uid()` — caller must own the referenced claim
- `claims.status IN ('pending', 'under_review')` — cannot upload to resolved or withdrawn claims
- If either check fails: `403 FORBIDDEN`; if claim not found: `404 NOT_FOUND`

**Errors**

| Code               | HTTP | When                                              |
| ------------------ | ---- | ------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid MIME type, size exceeded, or missing file |
| `AUTH_REQUIRED`    | 401  | No authenticated session                          |
| `FORBIDDEN`        | 403  | Caller does not own the claim                     |
| `NOT_FOUND`        | 404  | `entity_id` does not match an existing claim      |
| `SERVER_ERROR`     | 500  | Supabase Storage upload failure                   |

**Frontend Usage**

- Claim Form document upload step
- On success: append returned `path` to the pending upload list; display file name confirmation to user
- After upload, the service layer calls `UPDATE claims SET verification_doc_paths = array_append(verification_doc_paths, $path)` using the service_role client

**Analytics Event Emitted**
`claim_document_uploaded` — when upload succeeds; properties: `{ claim_id }`

**Cache Invalidation**
None

---

### 25. Check Claim Status

**Type:** Route Handler
**Route / Action:** `GET /api/claims/status`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface ClaimStatusQueryParams {
  listing_id: string // uuid — required query parameter
}
```

**Response**

```typescript
interface ClaimStatusResponse {
  claim_id: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | null
  submitted_at: string | null // ISO 8601
  reviewed_at: string | null // ISO 8601; null until admin decision
  rejection_reason: string | null
}
```

**Validation Rules**

- `listing_id` required; must be a valid UUID format

**Permission Checks**

- `auth.uid()` must be non-null
- Query is scoped to `claimant_user_id = auth.uid()` — users can only read their own claims
- If no claim exists for the caller + listing combination, return `200` with all fields null (not a 404)

**Errors**

| Code            | HTTP | When                     |
| --------------- | ---- | ------------------------ |
| `AUTH_REQUIRED` | 401  | No authenticated session |

**Frontend Usage**

- Claim Form screen: pre-populates status banner if an existing claim is found
- Dashboard claim status card: shows current state and rejection reason if applicable

**Analytics Event Emitted**
None

**Cache Invalidation**
None

---

### 26. Withdraw Claim

**Type:** Server Action
**Route / Action:** `lib/actions/claims/withdrawClaim`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface WithdrawClaimInput {
  claim_id: string // uuid
}
```

**Response**

```typescript
interface WithdrawClaimResponse {
  claim_id: string
  status: 'withdrawn'
}
```

**Validation Rules**

- `claim_id` required; must be a valid UUID

**Permission Checks**

- `auth.uid()` must be non-null
- `claims.claimant_user_id = auth.uid()` — caller must own the claim
- `claims.status IN ('pending', 'under_review')` — cannot withdraw a claim that has already been approved or rejected; return `422 INVALID_STATUS_TRANSITION` if status is `approved` or `rejected`

**Errors**

| Code                        | HTTP | When                                                           |
| --------------------------- | ---- | -------------------------------------------------------------- |
| `VALIDATION_ERROR`          | 400  | Missing or invalid `claim_id`                                  |
| `AUTH_REQUIRED`             | 401  | No authenticated session                                       |
| `FORBIDDEN`                 | 403  | Caller does not own the claim                                  |
| `INVALID_STATUS_TRANSITION` | 422  | Claim status is `approved` or `rejected` — cannot be withdrawn |

**Frontend Usage**

- Claim status page: "Withdraw claim" button visible only when `status IN ('pending', 'under_review')`
- On success: update status display to `withdrawn`; hide withdraw button

**Analytics Event Emitted**
`claim_withdrawn` — when withdrawal succeeds; properties: `{ claim_id }`

**Cache Invalidation**
None — `UPDATE moderation_queue SET status = 'dismissed'` is executed in the same service call for the associated moderation queue entry

---

## Section 6: Owner Dashboard

---

### 27. Get Dashboard Overview

**Type:** Route Handler
**Route / Action:** `GET /api/dashboard`
**Phase:** MVP
**Auth:** Owner

**Request**

No query parameters. Returns all listings owned by the authenticated user.

**Response**

```typescript
interface DashboardOverviewResponse {
  data: {
    listings: Array<{
      id: string // uuid
      name: string
      slug: string
      entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
      status: 'draft' | 'pending' | 'published' | 'unpublished' | 'flagged' | 'archived'
      trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
      listing_tier: 'free' | 'standard' | 'premium'
      logo_path: string | null // Storage path — generate public URL at read time
      cover_image_path: string | null // Storage path — generate public URL at read time
      published_at: string | null // ISO 8601
      claim: {
        status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
        submitted_at: string // ISO 8601
      } | null
      analytics_7d: {
        page_views: number
        cta_clicks: number
        saves: number
        shares: number
      }
    }>
  }
}
```

**Validation Rules**

- No request parameters to validate

**Permission Checks**

- `auth.uid()` must be non-null
- Query filters: `listings.owner_user_id = auth.uid() AND deleted_at IS NULL`
- Uses authenticated Supabase client (not service_role); RLS enforces ownership
- Analytics data: SUM of `page_views`, `cta_clicks`, `saves`, `shares` from `entity_analytics_daily WHERE snapshot_date >= now() - interval '7 days'` for each listing

**Errors**

| Code            | HTTP | When                                                              |
| --------------- | ---- | ----------------------------------------------------------------- |
| `AUTH_REQUIRED` | 401  | No authenticated session                                          |
| `FORBIDDEN`     | 403  | Authenticated user does not have the `owner` role for any listing |

**Frontend Usage**

- Dashboard Home screen: renders listing card grid
- Each card shows logo, name, status badge, trust tier badge, 7-day analytics summary, and claim status if pending

**Analytics Event Emitted**
`dashboard_viewed` — on successful response; properties: `{ listing_count: number }`

**Cache Invalidation**
None — real-time data; not cached

---

### 28. Update Listing Content

**Type:** Server Action
**Route / Action:** `lib/actions/dashboard/updateListingContent`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface UpdateListingContentInput {
  listing_id: string // uuid — required

  // Hero fields (updates listings table)
  name?: string
  tagline?: string
  logo_path?: string // Storage path
  cover_image_path?: string // Storage path

  // About + Contact fields (updates listing_details_business)
  description?: string
  phone?: string
  email?: string
  website_url?: string
  address_line_1?: string
  address_line_2?: string
  state?: string
  zip?: string

  // Hours (updates listing_details_business)
  hours?: {
    monday?: { open: string; close: string; closed: boolean }
    tuesday?: { open: string; close: string; closed: boolean }
    wednesday?: { open: string; close: string; closed: boolean }
    thursday?: { open: string; close: string; closed: boolean }
    friday?: { open: string; close: string; closed: boolean }
    saturday?: { open: string; close: string; closed: boolean }
    sunday?: { open: string; close: string; closed: boolean }
  }
  hours_notes?: string

  // Social links (updates listing_details_business)
  social_instagram?: string
  social_facebook?: string
  social_linkedin?: string
  social_tiktok?: string
  social_youtube?: string
  social_twitter?: string

  // SEO fields (updates listings table)
  meta_title?: string
  meta_description?: string
}
```

**Response**

```typescript
interface UpdateListingContentResponse {
  saved_at: string // ISO 8601 timestamp
}
```

**Validation Rules**

- `listing_id` required
- `name` max 200 chars if provided
- `tagline` max 140 chars if provided
- `email` must be valid email format if provided
- `website_url` must start with `https://` if provided
- `social_*` URLs must start with `https://` if provided
- `meta_title` max 60 chars if provided
- `meta_description` max 160 chars if provided
- At least one field beyond `listing_id` must be present

**Permission Checks**

- `auth.uid()` must be non-null
- `listings.owner_user_id = auth.uid() AND deleted_at IS NULL` — service layer verifies before any UPDATE
- Service sets `last_edited_by_owner_at = now()` and `updated_by = auth.uid()` on every call

**Errors**

| Code               | HTTP | When                                            |
| ------------------ | ---- | ----------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Field length, format, or URL validation failure |
| `AUTH_REQUIRED`    | 401  | No authenticated session                        |
| `FORBIDDEN`        | 403  | Authenticated user does not own this listing    |
| `NOT_FOUND`        | 404  | `listing_id` does not exist or is soft-deleted  |

**Frontend Usage**

- Page Editor: autosaves on field blur per section (Hero, About, Contact, Hours, Social, SEO)
- On success: show inline "Saved" confirmation; no page navigation

**Analytics Event Emitted**
`page_section_edited` — on success; properties: `{ listing_id, changed_fields: string[] }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only executed when `listings.status = 'published'`

---

### 29. Manage CTAs

**Type:** Server Action
**Route / Action:** `lib/actions/dashboard/manageCtas`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface ManageCtasInput {
  listing_id: string // uuid
  cta_type: string // see valid values below
  cta_url?: string
  cta_label_override?: string
}
```

**Response**

```typescript
interface ManageCtasResponse {
  saved_at: string // ISO 8601
}
```

**Validation Rules**

- `listing_id` required
- `cta_type` required; must be one of: `'book'`, `'order'`, `'call'`, `'message'`, `'visit'`, `'get-quote'`, `'shop'`, `'subscribe'`, `'contact'`, `'schedule'`, `'inquire'`, `'commission'`, `'reserve'`, `'download'`, `'apply'`, `'donate'`, `'join'`, `'learn-more'` (18 valid values)
- `cta_url` required when `cta_type !== 'call'`; must start with `https://`
- `cta_url` must be null or omitted when `cta_type = 'call'` (uses `phone` field instead)
- `cta_label_override` optional; max 50 chars

**Permission Checks**

- `auth.uid()` must be non-null
- `listings.owner_user_id = auth.uid()` verified before UPDATE

**Errors**

| Code               | HTTP | When                                                                |
| ------------------ | ---- | ------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid `cta_type`, missing required `cta_url`, or URL format error |
| `AUTH_REQUIRED`    | 401  | No authenticated session                                            |
| `FORBIDDEN`        | 403  | Caller does not own this listing                                    |

**Frontend Usage**

- Page Editor CTA section
- On success: show inline "Saved" confirmation; refresh CTA preview component

**Analytics Event Emitted**
`cta_updated` — on success; properties: `{ listing_id, cta_type }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only when `listings.status = 'published'`

---

### 30. Manage Services

**Type:** Server Actions (3 separate actions)
**Route / Action:** `lib/actions/dashboard/addService`, `lib/actions/dashboard/updateService`, `lib/actions/dashboard/deleteService`
**Phase:** MVP (name, description, display_order, is_visible); V1 (price, price_type, price_note, duration_minutes, cta_type, cta_url)
**Auth:** Owner

**Request**

```typescript
// addService
interface AddServiceInput {
  listing_id: string // uuid
  name: string
  description?: string
  price?: number // V1; numeric, ≥ 0
  price_type?: 'fixed' | 'starting-at' | 'hourly' | 'custom' | 'free' // V1
  price_note?: string // V1
  duration_minutes?: number // V1; positive integer
  cta_type?: 'book' | 'inquire' | 'call' | 'contact' // V1
  cta_url?: string // V1
  display_order?: number
}

// updateService
interface UpdateServiceInput {
  service_id: string // uuid
  name?: string
  description?: string
  price?: number
  price_type?: 'fixed' | 'starting-at' | 'hourly' | 'custom' | 'free'
  price_note?: string
  duration_minutes?: number
  is_visible?: boolean
  cta_type?: 'book' | 'inquire' | 'call' | 'contact'
  cta_url?: string
}

// deleteService
interface DeleteServiceInput {
  service_id: string // uuid
}
```

**Response**

```typescript
// addService / updateService
interface ServiceMutationResponse {
  service_id: string // uuid
}

// deleteService
interface DeleteServiceResponse {
  deleted: true
}
```

**Validation Rules**

- `name` required for `addService`; max 200 chars
- `price` must be ≥ 0 if provided
- `price_type` must be a valid enum value if provided
- `cta_url` must start with `https://` if provided and `cta_type !== 'call'`

**Permission Checks**

- For `addService`: `listings.owner_user_id = auth.uid()` where `listing_id` matches
- For `updateService` and `deleteService`: service's parent `listing_id` must satisfy `listings.owner_user_id = auth.uid()`
- Soft-deleted listings cannot have services added (`deleted_at IS NULL` required)

**Errors**

| Code               | HTTP | When                                        |
| ------------------ | ---- | ------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid field values                        |
| `AUTH_REQUIRED`    | 401  | No authenticated session                    |
| `FORBIDDEN`        | 403  | Caller does not own the parent listing      |
| `NOT_FOUND`        | 404  | `service_id` or `listing_id` does not exist |

**Frontend Usage**

- Services Manager screen at `/dashboard/services`
- Add: appends new service card to list
- Update: inline field edits with autosave on blur
- Delete: removes card from list with confirmation dialog

**Analytics Event Emitted**

- `service_added` — properties: `{ listing_id, service_id }`
- `service_updated` — properties: `{ service_id, changed_fields: string[] }`
- `service_deleted` — properties: `{ service_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only when parent `listings.status = 'published'`

---

### 31. Reorder Services

**Type:** Server Action
**Route / Action:** `lib/actions/dashboard/reorderServices`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface ReorderServicesInput {
  listing_id: string // uuid
  ordered_ids: string[] // uuid[] — complete ordered list of service IDs for this listing
}
```

**Response**

```typescript
interface ReorderServicesResponse {
  updated: number // count of rows updated
}
```

**Validation Rules**

- `listing_id` required
- `ordered_ids` required; must be a non-empty array
- All IDs in `ordered_ids` must belong to the given `listing_id` — any foreign ID returns `403`

**Permission Checks**

- `auth.uid()` must be non-null
- `listings.owner_user_id = auth.uid()` — verified before bulk UPDATE
- Service IDs validated against `SELECT id FROM services WHERE listing_id = $listing_id` before executing any update

**Errors**

| Code               | HTTP | When                                                                               |
| ------------------ | ---- | ---------------------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Empty `ordered_ids` or malformed UUIDs                                             |
| `AUTH_REQUIRED`    | 401  | No authenticated session                                                           |
| `FORBIDDEN`        | 403  | Caller does not own the listing or `ordered_ids` contains IDs from another listing |

**Frontend Usage**

- Services Manager drag-to-reorder UI
- Called on drop event after drag completes; `ordered_ids` reflects final visual order
- On success: no visual change needed (order already updated optimistically in UI)

**Analytics Event Emitted**
None

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only when parent `listings.status = 'published'`

---

### 32. Manage Gallery Media

**Type:** Server Actions (3 actions)
**Route / Action:** `lib/actions/dashboard/deleteMedia`, `lib/actions/dashboard/updateMediaAltText`, `lib/actions/dashboard/reorderMedia`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
// deleteMedia
interface DeleteMediaInput {
  media_id: string // uuid
}

// updateMediaAltText
interface UpdateMediaAltTextInput {
  media_id: string // uuid
  alt_text: string
}

// reorderMedia
interface ReorderMediaInput {
  listing_id: string // uuid
  ordered_ids: string[] // uuid[] — complete ordered list of media IDs for this listing
}
```

**Response**

```typescript
// deleteMedia
interface DeleteMediaResponse {
  deleted: true
}

// updateMediaAltText
interface UpdateMediaAltTextResponse {
  updated: true
}

// reorderMedia
interface ReorderMediaResponse {
  updated: number // count of rows updated
}
```

**Validation Rules**

- `media_id` required and valid UUID for delete and alt text update
- `alt_text` max 200 chars
- `listing_id` and `ordered_ids` required for reorder; all IDs must belong to the given listing

**Permission Checks**

- `auth.uid()` must be non-null
- For delete and alt text: `media_attachments.uploaded_by = auth.uid()` OR parent `listings.owner_user_id = auth.uid()`
- For reorder: `listings.owner_user_id = auth.uid()`
- `deleteMedia` also calls `supabase.storage.from('listing-media').remove([file_path])` via service_role after the DB row is deleted

**Errors**

| Code               | HTTP | When                                      |
| ------------------ | ---- | ----------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid input or alt text exceeds max     |
| `AUTH_REQUIRED`    | 401  | No authenticated session                  |
| `FORBIDDEN`        | 403  | Caller does not own the media or listing  |
| `NOT_FOUND`        | 404  | `media_id` or `listing_id` does not exist |

**Frontend Usage**

- Page Editor gallery section
- Delete: removes image from gallery; triggers storage cleanup
- Alt text: inline edit with autosave on blur
- Reorder: drag-to-reorder grid; called on drop event

**Analytics Event Emitted**

- `media_deleted` — properties: `{ media_id, listing_id }`
- `media_reordered` — properties: `{ listing_id, item_count: number }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only when parent `listings.status = 'published'`

---

### 33. Get Listing Analytics

**Type:** Server Action
**Route / Action:** `lib/actions/dashboard/getListingAnalytics`
**Phase:** MVP
**Auth:** Owner

**Request**

```typescript
interface GetListingAnalyticsInput {
  listing_id: string // uuid
  days?: 7 | 30 | 90 // default: 30; free tier capped at 7
}
```

**Response**

```typescript
interface GetListingAnalyticsResponse {
  listing_id: string
  period_days: 7 | 30 | 90
  totals: {
    page_views: number
    cta_clicks: number
    saves: number
    shares: number
  }
  daily: Array<{
    date: string // ISO 8601 date string (YYYY-MM-DD)
    page_views: number
    cta_clicks: number
    saves: number
    shares: number
  }>
}
```

**Validation Rules**

- `listing_id` required
- `days` must be one of `7`, `30`, or `90` if provided; defaults to `30`
- Free tier cap: if `listings.tier = 'free'`, `days` is clamped to `7` regardless of request value — no error returned, the cap is applied silently with `period_days` in the response reflecting the actual range used

**Permission Checks**

- `auth.uid()` must be non-null
- `listings.owner_user_id = auth.uid()` — verified before data is returned

**Errors**

| Code               | HTTP | When                             |
| ------------------ | ---- | -------------------------------- |
| `VALIDATION_ERROR` | 400  | `days` is not 7, 30, or 90       |
| `AUTH_REQUIRED`    | 401  | No authenticated session         |
| `FORBIDDEN`        | 403  | Caller does not own this listing |

**Frontend Usage**

- Dashboard analytics section: renders totals summary cards and a daily line chart
- Free tier: shows 7-day data with an upsell prompt to unlock 30- and 90-day views (V1)

**Analytics Event Emitted**
None — this is the analytics read endpoint; no event is emitted

**Cache Invalidation**
None

---

## Section 7: Reviews

---

### 34. Create Review

**Type:** Server Action
**Route / Action:** `lib/actions/reviews/createReview`
**Phase:** MVP (data stored at `status = 'intake'`); V1 (workflow and public display active)
**Auth:** Supporter

**Request**

```typescript
interface CreateReviewInput {
  listing_id: string // uuid
  rating: 1 | 2 | 3 | 4 | 5
  title?: string
  body?: string
  visit_date?: string // ISO 8601 date string (YYYY-MM-DD)
}
```

**Response**

```typescript
interface CreateReviewResponse {
  review_id: string // uuid
  status: 'intake'
  message: string
}
```

**Validation Rules**

- `listing_id` required
- `rating` required; must be an integer between 1 and 5 inclusive
- `title` optional; max 150 chars
- `body` optional; max 2000 chars
- `visit_date` optional; must be a valid ISO date string; must not be a future date

**Permission Checks**

- `auth.uid()` must be non-null
- Referenced listing must exist with `status = 'published' AND deleted_at IS NULL`
- Uniqueness: `UNIQUE (reviewer_user_id, listing_id)` — one review per user per listing; duplicate returns `409 REVIEW_ALREADY_EXISTS`
- At MVP, `review_count` and `avg_rating` on `listings` are NOT updated until `status = 'published'` (activated at V1 when moderation workflow is live)

**Errors**

| Code                    | HTTP | When                                                                                 |
| ----------------------- | ---- | ------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`      | 400  | Missing required fields, rating out of range, future visit date, or body exceeds max |
| `AUTH_REQUIRED`         | 401  | No authenticated session                                                             |
| `NOT_FOUND`             | 404  | `listing_id` does not exist or is not published                                      |
| `REVIEW_ALREADY_EXISTS` | 409  | Caller has already submitted a review for this listing                               |

**Frontend Usage**

- Review form modal on BLACQList Page
- On success: show confirmation message ("Your review has been submitted and will appear after approval"); close modal

**Analytics Event Emitted**
`review_submitted` — on success; properties: `{ listing_id, rating }`

**Cache Invalidation**
None — review not publicly displayed until V1 when `status = 'published'`

---

### 35. Update Own Review

**Type:** Server Action
**Route / Action:** `lib/actions/reviews/updateReview`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface UpdateReviewInput {
  review_id: string // uuid
  rating?: 1 | 2 | 3 | 4 | 5
  title?: string
  body?: string
  visit_date?: string // ISO 8601 date string (YYYY-MM-DD)
}
```

**Response**

```typescript
interface UpdateReviewResponse {
  review_id: string
  updated_at: string // ISO 8601
}
```

**Validation Rules**

- `review_id` required
- `rating` must be 1–5 if provided
- `title` max 150 chars if provided
- `body` max 2000 chars if provided
- `visit_date` must be a valid ISO date, not future, if provided
- At least one field beyond `review_id` must be present

**Permission Checks**

- `auth.uid()` must be non-null
- `reviews.reviewer_user_id = auth.uid()` — caller must own the review
- `reviews.status = 'intake'` — reviews can only be edited while in intake; if status has advanced (e.g., `pending_approval` or `published`), return `422 INVALID_STATUS_TRANSITION`

**Errors**

| Code                        | HTTP | When                                   |
| --------------------------- | ---- | -------------------------------------- |
| `VALIDATION_ERROR`          | 400  | Field value or format violation        |
| `AUTH_REQUIRED`             | 401  | No authenticated session               |
| `FORBIDDEN`                 | 403  | Caller does not own this review        |
| `INVALID_STATUS_TRANSITION` | 422  | Review is no longer in `intake` status |

**Frontend Usage**

- Review edit flow: pre-populated form in account settings or on listing page if review is in intake
- On success: show inline "Review updated" confirmation

**Analytics Event Emitted**
`review_updated` — on success; properties: `{ review_id }`

**Cache Invalidation**
None — review not publicly displayed while in intake

---

### 36. Delete Own Review

**Type:** Server Action
**Route / Action:** `lib/actions/reviews/deleteOwnReview`
**Phase:** MVP
**Auth:** Supporter

**Request**

```typescript
interface DeleteOwnReviewInput {
  review_id: string // uuid
}
```

**Response**

```typescript
interface DeleteOwnReviewResponse {
  deleted: true
}
```

**Validation Rules**

- `review_id` required; must be a valid UUID

**Permission Checks**

- `auth.uid()` must be non-null
- `reviews.reviewer_user_id = auth.uid()` — caller must own the review
- `reviews.status = 'intake'` — published reviews cannot be self-deleted; return `422 INVALID_STATUS_TRANSITION` for any other status

**Errors**

| Code                        | HTTP | When                                                                       |
| --------------------------- | ---- | -------------------------------------------------------------------------- |
| `AUTH_REQUIRED`             | 401  | No authenticated session                                                   |
| `FORBIDDEN`                 | 403  | Caller does not own this review                                            |
| `INVALID_STATUS_TRANSITION` | 422  | Review is not in `intake` status (published reviews require admin removal) |

**Frontend Usage**

- Review management in account settings
- On success: remove review entry from list; show "Review deleted" toast

**Analytics Event Emitted**
`review_deleted` — on success; properties: `{ review_id }`

**Cache Invalidation**
None

---

### 37. Owner Respond to Review

**Type:** Server Action
**Route / Action:** `lib/actions/reviews/respondToReview`
**Phase:** Beta
**Auth:** Owner

**Request**

```typescript
interface RespondToReviewInput {
  review_id: string // uuid
  response_text: string
}
```

**Response**

```typescript
interface RespondToReviewResponse {
  response_id: string // uuid
}
```

**Validation Rules**

- `review_id` required
- `response_text` required; max 1000 chars
- Referenced review must have `status = 'published'`

**Permission Checks**

- `auth.uid()` must be non-null
- Lookup `reviews.listing_id` for the referenced review; verify `listings.owner_user_id = auth.uid()`
- One response per review: `UNIQUE (review_id)` on `review_responses` — return `409 RESPONSE_ALREADY_EXISTS` if a response already exists

**Errors**

| Code                      | HTTP | When                                                            |
| ------------------------- | ---- | --------------------------------------------------------------- |
| `VALIDATION_ERROR`        | 400  | Missing or too-long `response_text`, or review is not published |
| `AUTH_REQUIRED`           | 401  | No authenticated session                                        |
| `FORBIDDEN`               | 403  | Caller does not own the listing associated with this review     |
| `NOT_FOUND`               | 404  | `review_id` does not exist                                      |
| `RESPONSE_ALREADY_EXISTS` | 409  | A response has already been posted for this review              |

**Frontend Usage**

- Owner review management screen (Beta): "Reply to review" form rendered beneath each published review

**Analytics Event Emitted**
`review_response_added` — on success; properties: `{ review_id, listing_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — response appears publicly on the listing page

---

### 38. Report Review

**Type:** Server Action
**Route / Action:** `lib/actions/reviews/reportReview`
**Phase:** Beta
**Auth:** Supporter

**Request**

```typescript
interface ReportReviewInput {
  review_id: string // uuid
  reason: 'spam' | 'inappropriate' | 'fake' | 'off_topic' | 'other'
  notes?: string
}
```

**Response**

```typescript
interface ReportReviewResponse {
  reported: true
}
```

**Validation Rules**

- `review_id` required
- `reason` required; must be one of the five valid enum values
- `notes` optional; max 500 chars

**Permission Checks**

- `auth.uid()` must be non-null
- Caller cannot report their own review: `reviews.reviewer_user_id != auth.uid()`
- One report per caller per review — check `EXISTS (SELECT 1 FROM review_reports WHERE review_id = $review_id AND reporter_user_id = auth.uid())` → `409 ALREADY_REPORTED`
- After INSERT: if total report count for this review is ≥ 3, INSERT into `moderation_queue` with `queue_type = 'review'`

**Errors**

| Code               | HTTP | When                                                           |
| ------------------ | ---- | -------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Missing `reason`, invalid `reason` value, or notes exceeds max |
| `AUTH_REQUIRED`    | 401  | No authenticated session                                       |
| `ALREADY_REPORTED` | 409  | Caller has already reported this review                        |

**Frontend Usage**

- "Report this review" link on each published review card
- On success: replace link with "Reported" disabled text; show "Thank you for your report" toast

**Analytics Event Emitted**
`review_reported` — on success; properties: `{ review_id, reason }`

**Cache Invalidation**
None

---

### 39. Admin Moderate Review

Specification documented in full under Section 9, endpoint 51. This entry is a placeholder cross-reference only.

---

## Section 8: Corrections

---

### 40. Submit Correction

**Type:** Server Action
**Route / Action:** `lib/actions/corrections/submitCorrection`
**Phase:** Beta
**Auth:** Anonymous (unauthenticated users may submit)

**Request**

```typescript
interface SubmitCorrectionInput {
  listing_id: string // uuid
  field_name: string
  current_value?: string // what the submitter currently sees
  suggested_value: string
  reason?: string
}
```

**Response**

```typescript
interface SubmitCorrectionResponse {
  correction_id: string // uuid
  message: string
}
```

**Validation Rules**

- `listing_id` required; must be a valid UUID
- `field_name` required; max 100 chars (e.g., `"phone"`, `"address_line_1"`, `"website_url"`)
- `suggested_value` required; max 500 chars
- `current_value` optional; max 500 chars
- `reason` optional; max 500 chars
- Referenced listing must exist with `status = 'published' AND deleted_at IS NULL`

**Permission Checks**

- No authentication required — `submitter_user_id` is set to `auth.uid()` when a session exists, or `NULL` for anonymous submissions
- No rate limiting at MVP; consider IP-based rate limiting at Beta if spam occurs

**Errors**

| Code               | HTTP | When                                               |
| ------------------ | ---- | -------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Missing required fields or field length violations |
| `NOT_FOUND`        | 404  | `listing_id` does not exist or is not published    |

**Frontend Usage**

- "Report incorrect info" modal accessible from the BLACQList Page (Beta)
- On success: show "Thank you — we'll review this soon" confirmation; close modal

**Analytics Event Emitted**
`correction_submitted` — on success; properties: `{ listing_id, field_name }`

**Cache Invalidation**
None

---

### 41. Admin Resolve Correction

Specification documented in full under Section 9, endpoint 52. This entry is a placeholder cross-reference only.

---

## Section 9: Admin

All endpoints in this section require the `admin` or `super_admin` role. All mutations use the service_role Supabase client and write to `admin_audit_log` in the same transaction.

---

### 42. List Entities (Admin)

**Type:** Route Handler
**Route / Action:** `GET /api/admin/listings`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface AdminListingsQueryParams {
  status?: 'draft' | 'pending' | 'published' | 'unpublished' | 'flagged' | 'archived'
  city?: string // city slug
  category?: string // category slug
  type?: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  include_deleted?: 'true' | 'false' // default: 'false'
  page?: number // default: 1
  limit?: number // default: 50; max: 100
}
```

**Response**

```typescript
interface AdminListingsResponse {
  data: Array<{
    id: string
    name: string
    slug: string
    entity_type: string
    status: string
    flag_status: string
    trust_tier: string
    city_id: string | null
    category_id: string
    owner_user_id: string | null
    submitted_by: string | null
    created_at: string // ISO 8601
    updated_at: string // ISO 8601
    published_at: string | null // ISO 8601
    moderation_notes: string | null
    admin_notes: string | null
    deleted_at: string | null
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

**Validation Rules**

- `status` must be a valid status enum value if provided
- `type` must be a valid `entity_type` value if provided
- `limit` capped at 100
- `include_deleted = 'true'` removes the `deleted_at IS NULL` filter

**Permission Checks**

- Server-side role check: `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))`
- Uses service_role client — bypasses RLS to return all statuses and soft-deleted records when `include_deleted = true`

**Errors**

| Code            | HTTP | When                                           |
| --------------- | ---- | ---------------------------------------------- |
| `AUTH_REQUIRED` | 401  | No authenticated session                       |
| `FORBIDDEN`     | 403  | Authenticated user is not admin or super_admin |

**Frontend Usage**

- Admin Listings screen: filterable, paginated table of all listings
- Columns show status, flag_status, trust_tier, owner presence, and timestamps

**Analytics Event Emitted**
None

**Cache Invalidation**
None

---

### 43. Approve Entity

**Type:** Server Action
**Route / Action:** `lib/actions/admin/approveEntity`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface ApproveEntityInput {
  listing_id: string // uuid
  notes?: string
}
```

**Response**

```typescript
interface ApproveEntityResponse {
  listing_id: string
  status: 'published'
  published_at: string // ISO 8601
}
```

**Validation Rules**

- `listing_id` required
- Listing must currently have `status = 'pending'`; any other status returns `422 INVALID_STATUS_TRANSITION`

**Permission Checks**

- Admin role check (service_role client)
- All writes use service_role — RLS bypassed; service layer enforces admin authorization

**Errors**

| Code                        | HTTP | When                               |
| --------------------------- | ---- | ---------------------------------- |
| `AUTH_REQUIRED`             | 401  | No authenticated session           |
| `FORBIDDEN`                 | 403  | Caller is not admin or super_admin |
| `INVALID_STATUS_TRANSITION` | 422  | Listing is not in `pending` status |

**Frontend Usage**

- Admin Listings detail page: "Approve" button
- On success: update status badge in UI; show success toast

**Analytics Event Emitted**
`admin_listing_approved` — on success; properties: `{ listing_id, admin_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` + `revalidateTag('city-[slug]')` — listing now publicly visible

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='listing_approved', target_table='listings', target_id=$listing_id, before_state={status:'pending'}, after_state={status:'published', published_at:...}, ip_address)`

---

### 44. Reject Entity

**Type:** Server Action
**Route / Action:** `lib/actions/admin/rejectEntity`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface RejectEntityInput {
  listing_id: string // uuid
  reason: string
  notes?: string // internal admin notes
}
```

**Response**

```typescript
interface RejectEntityResponse {
  listing_id: string
  status: 'rejected'
}
```

**Validation Rules**

- `listing_id` required
- `reason` required; max 500 chars — shown to the listing submitter via email

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code               | HTTP | When                               |
| ------------------ | ---- | ---------------------------------- |
| `VALIDATION_ERROR` | 400  | Missing or too-long `reason`       |
| `AUTH_REQUIRED`    | 401  | No authenticated session           |
| `FORBIDDEN`        | 403  | Caller is not admin or super_admin |

**Frontend Usage**

- Admin Listings detail page: "Reject" button triggers a reason input dialog before confirming
- On success: update status badge to `rejected`; rejection reason saved as `moderation_notes`

**Analytics Event Emitted**
`admin_listing_rejected` — on success; properties: `{ listing_id, admin_id }`

**Cache Invalidation**
None — rejected listings are not publicly indexed

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='listing_rejected', target_table='listings', target_id=$listing_id, before_state={status:...}, after_state={status:'rejected', moderation_notes:reason}, ip_address)`

---

### 45. List Claims (Admin)

**Type:** Route Handler
**Route / Action:** `GET /api/admin/claims`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface AdminClaimsQueryParams {
  status?: 'pending' | 'under_review' | 'approved' | 'rejected'
  page?: number // default: 1
  limit?: number // default: 20; max: 100
}
```

**Response**

```typescript
interface AdminClaimsResponse {
  data: Array<{
    claim_id: string
    status: string
    submitted_at: string // ISO 8601
    reviewed_at: string | null // ISO 8601
    listing: {
      id: string
      name: string
      city: string | null // city_text from listing_details_business
    }
    claimant: {
      id: string
      display_name: string | null
      email: string // from auth.users — admin-only
    }
    verification_doc_count: number // count of paths in verification_doc_paths — NOT the paths themselves
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

**Validation Rules**

- `status` must be a valid claim status if provided
- `limit` capped at 100
- `verification_doc_paths` array is never returned in list view — use `getVerificationDocUrl` (endpoint 46) to access individual documents

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code            | HTTP | When                               |
| --------------- | ---- | ---------------------------------- |
| `AUTH_REQUIRED` | 401  | No authenticated session           |
| `FORBIDDEN`     | 403  | Caller is not admin or super_admin |

**Frontend Usage**

- Admin Claims Queue screen: sortable, filterable table of claims awaiting review
- `verification_doc_count` shown as badge (e.g., "2 docs") with a link to view each via signed URL

**Analytics Event Emitted**
None

**Cache Invalidation**
None

---

### 46. Get Verification Document URL

**Type:** Server Action
**Route / Action:** `lib/actions/admin/getVerificationDocUrl`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface GetVerificationDocUrlInput {
  claim_id: string // uuid
  doc_path: string // Supabase Storage path in verification-docs bucket
}
```

**Response**

```typescript
interface GetVerificationDocUrlResponse {
  signed_url: string // 15-minute expiry signed URL — never log, store, or cache
  expires_at: string // ISO 8601 timestamp (now + 15 minutes)
}
```

**Validation Rules**

- `claim_id` required
- `doc_path` required; must begin with a valid `verification-docs/` path prefix
- Referenced `claim_id` must have `status IN ('pending', 'under_review')` — no access to docs for resolved claims

**Permission Checks**

- Admin role check (service_role client)
- Uses service_role storage client: `supabase.storage.from('verification-docs').createSignedUrl(doc_path, 900)`
- The signed URL is returned in the Server Action response only — it is never logged, cached, stored in the DB, or included in any audit log snapshot

**Errors**

| Code            | HTTP | When                                                                           |
| --------------- | ---- | ------------------------------------------------------------------------------ |
| `AUTH_REQUIRED` | 401  | No authenticated session                                                       |
| `FORBIDDEN`     | 403  | Caller is not admin or super_admin                                             |
| `NOT_FOUND`     | 404  | `claim_id` not found or `doc_path` not in the claim's `verification_doc_paths` |

**Frontend Usage**

- Admin Claim Review screen: "View document" button generates a signed URL on demand
- URL opened in a new browser tab; displayed for 15 minutes before expiry
- No URL caching on the client — each click generates a fresh signed URL

**Analytics Event Emitted**
`admin_verification_doc_viewed` — on success; properties: `{ claim_id, admin_id }` — doc path is NOT logged

**Cache Invalidation**
None

---

### 47. Approve Claim

**Type:** Server Action
**Route / Action:** `lib/actions/admin/approveClaim`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface ApproveClaimInput {
  claim_id: string // uuid
  notes?: string // internal notes
}
```

**Response**

```typescript
interface ApproveClaimResponse {
  claim_id: string
  status: 'approved'
  listing_id: string
}
```

**Validation Rules**

- `claim_id` required
- Claim must have `status IN ('pending', 'under_review')`
- Listing must not already have `owner_user_id` set to a different user than the claimant — return `409 LISTING_ALREADY_OWNED`

**Permission Checks**

- Admin role check (service_role client)
- All five DB operations execute as a single transaction; partial success is not permitted

**Errors**

| Code                        | HTTP | When                                                       |
| --------------------------- | ---- | ---------------------------------------------------------- |
| `AUTH_REQUIRED`             | 401  | No authenticated session                                   |
| `FORBIDDEN`                 | 403  | Caller is not admin or super_admin                         |
| `INVALID_STATUS_TRANSITION` | 422  | Claim is not in `pending` or `under_review` status         |
| `LISTING_ALREADY_OWNED`     | 409  | Listing `owner_user_id` is already set to a different user |

**Frontend Usage**

- Admin Claim Review screen: "Approve claim" button
- On success: update claim status badge; show "Claim approved — ownership transferred" toast

**Analytics Event Emitted**
`admin_claim_approved` — on success; properties: `{ claim_id, listing_id, admin_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — trust tier badge changes from `unclaimed` to `claimed`

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='claim_approved', target_table='claims', target_id=$claim_id, before_state={status:'pending',...}, after_state={status:'approved',...}, ip_address)`

**Transaction Steps (executed atomically)**

1. `UPDATE claims SET status='approved', reviewed_by=auth.uid(), reviewed_at=now()`
2. `UPDATE listings SET trust_tier='claimed', owner_user_id=$claimant_user_id, claim_id=$claim_id, is_claimed=true, claimed_at=now()`
3. `INSERT INTO user_roles (user_id=$claimant_user_id, role='owner', listing_id=$listing_id, granted_by=auth.uid())` on conflict do nothing
4. `UPDATE moderation_queue SET status='resolved', resolved_at=now()` for this claim
5. `INSERT INTO admin_audit_log (...)`
6. Non-blocking: send claim approval email via Resend

---

### 48. Reject Claim

**Type:** Server Action
**Route / Action:** `lib/actions/admin/rejectClaim`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface RejectClaimInput {
  claim_id: string // uuid
  reason: string
  notes?: string // internal admin notes; not shown to claimant
}
```

**Response**

```typescript
interface RejectClaimResponse {
  claim_id: string
  status: 'rejected'
}
```

**Validation Rules**

- `claim_id` required
- `reason` required; max 500 chars — shown to the claimant in the rejection email

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code               | HTTP | When                               |
| ------------------ | ---- | ---------------------------------- |
| `VALIDATION_ERROR` | 400  | Missing or too-long `reason`       |
| `AUTH_REQUIRED`    | 401  | No authenticated session           |
| `FORBIDDEN`        | 403  | Caller is not admin or super_admin |

**Frontend Usage**

- Admin Claim Review screen: "Reject" button triggers a reason input dialog before confirming
- On success: update claim status badge to `rejected`

**Analytics Event Emitted**
`admin_claim_rejected` — on success; properties: `{ claim_id, admin_id }`

**Cache Invalidation**
None — listing trust tier does not change on rejection

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='claim_rejected', target_table='claims', target_id=$claim_id, before_state={status:...}, after_state={status:'rejected', rejection_reason:reason}, ip_address)`

---

### 49. Update Verification Status

**Type:** Server Action
**Route / Action:** `lib/actions/admin/updateVerificationStatus`
**Phase:** V1
**Auth:** Admin

**Request**

```typescript
interface UpdateVerificationStatusInput {
  listing_id: string // uuid
  decision: 'verified' | 'rejected'
  notes?: string // shown to owner on rejection
}
```

**Response**

```typescript
interface UpdateVerificationStatusResponse {
  listing_id: string
  verification_status: 'verified' | 'rejected'
  trust_tier?: 'verified' // set only when decision = 'verified'
}
```

**Validation Rules**

- `listing_id` required
- `decision` required; must be `'verified'` or `'rejected'`
- Listing must have `verification_status = 'pending'`; other states return `422 INVALID_STATUS_TRANSITION`

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code                        | HTTP | When                                     |
| --------------------------- | ---- | ---------------------------------------- |
| `AUTH_REQUIRED`             | 401  | No authenticated session                 |
| `FORBIDDEN`                 | 403  | Caller is not admin or super_admin       |
| `INVALID_STATUS_TRANSITION` | 422  | `verification_status` is not `'pending'` |

**Frontend Usage**

- Admin Verification Queue (V1): approve or reject with optional notes
- On approval: trust tier badge updates to `verified` on the listing page

**Analytics Event Emitted**

- `admin_verification_granted` — on `decision = 'verified'`; properties: `{ listing_id, admin_id }`
- `admin_verification_rejected` — on `decision = 'rejected'`; properties: `{ listing_id, admin_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — trust badge changes

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='verification_decision', target_table='listings', target_id=$listing_id, before_state={verification_status:'pending'}, after_state={verification_status:decision, trust_tier:...}, ip_address)`

---

### 50. Moderate Media

**Type:** Server Action
**Route / Action:** `lib/actions/admin/moderateMedia`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
interface ModerateMediaInput {
  media_id: string // uuid
  approved: boolean
  notes?: string
}
```

**Response**

```typescript
interface ModerateMediaResponse {
  media_id: string
  is_approved: boolean
}
```

**Validation Rules**

- `media_id` required; must be a valid UUID

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code            | HTTP | When                               |
| --------------- | ---- | ---------------------------------- |
| `AUTH_REQUIRED` | 401  | No authenticated session           |
| `FORBIDDEN`     | 403  | Caller is not admin or super_admin |
| `NOT_FOUND`     | 404  | `media_id` does not exist          |

**Frontend Usage**

- Admin Listing Detail media section: approve or reject individual gallery images
- On rejection (`approved = false`): image hidden from public listing page without deletion

**Analytics Event Emitted**

- `admin_media_approved` — when `approved = true`; properties: `{ media_id }`
- `admin_media_rejected` — when `approved = false`; properties: `{ media_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — media visibility changes on the public page

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='media_moderated', target_table='media_attachments', target_id=$media_id, before_state={is_approved:...}, after_state={is_approved:approved}, ip_address)`

---

### 51. Moderate Review

**Type:** Server Action
**Route / Action:** `lib/actions/admin/moderateReview`
**Phase:** MVP (table exists; moderation workflow active); V1 (public display active)
**Auth:** Admin

**Request**

```typescript
interface ModerateReviewInput {
  review_id: string // uuid
  decision: 'published' | 'rejected' | 'removed'
  reason?: string // required when decision is 'rejected' or 'removed'
}
```

**Response**

```typescript
interface ModerateReviewResponse {
  review_id: string
  status: 'published' | 'rejected' | 'removed'
}
```

**Validation Rules**

- `review_id` required
- `decision` required; must be one of `'published'`, `'rejected'`, `'removed'`
- `reason` required when `decision IN ('rejected', 'removed')`; max 500 chars

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code               | HTTP | When                                       |
| ------------------ | ---- | ------------------------------------------ |
| `VALIDATION_ERROR` | 400  | Missing `reason` when decision requires it |
| `AUTH_REQUIRED`    | 401  | No authenticated session                   |
| `FORBIDDEN`        | 403  | Caller is not admin or super_admin         |

**Frontend Usage**

- Admin Review Queue: approve or reject each queued review
- On `published`: review becomes publicly visible on the listing page (V1 display activation)

**Analytics Event Emitted**
`admin_review_moderated` — on success; properties: `{ review_id, decision, admin_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — review count and rating change when `decision = 'published'`

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='review_moderated', target_table='reviews', target_id=$review_id, before_state={status:...}, after_state={status:decision}, ip_address)`

**Side Effects on Publish**
When `decision = 'published'`: set `reviews.published_at = now()`; trigger recalculation of `listings.review_count` and `listings.avg_rating` for the parent listing; update `moderation_queue SET status = 'resolved'`

---

### 52. Resolve Correction

**Type:** Server Action
**Route / Action:** `lib/actions/admin/resolveCorrection`
**Phase:** Beta
**Auth:** Admin

**Request**

```typescript
interface ResolveCorrectionInput {
  correction_id: string // uuid
  decision: 'approved' | 'dismissed'
  notes?: string // internal notes; visible to admin only
}
```

**Response**

```typescript
interface ResolveCorrectionResponse {
  correction_id: string
  status: 'resolved'
}
```

**Validation Rules**

- `correction_id` required
- `decision` required; must be `'approved'` or `'dismissed'`
- Correction must have `status = 'pending'`; return `422` otherwise

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code            | HTTP | When                               |
| --------------- | ---- | ---------------------------------- |
| `AUTH_REQUIRED` | 401  | No authenticated session           |
| `FORBIDDEN`     | 403  | Caller is not admin or super_admin |
| `NOT_FOUND`     | 404  | `correction_id` does not exist     |

**Frontend Usage**

- Admin Corrections queue (Beta): approve or dismiss each pending correction
- On approval: the `suggested_value` is applied to the specified `field_name` on the listing record

**Analytics Event Emitted**

- `admin_correction_approved` — when `decision = 'approved'`; properties: `{ correction_id, listing_id }`
- `admin_correction_dismissed` — when `decision = 'dismissed'`; properties: `{ correction_id }`

**Cache Invalidation**
`revalidatePath('/[city-slug]/business/[listing-slug]')` — only when `decision = 'approved'` and the correction has been applied to the listing

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='correction_resolved', target_table='corrections', target_id=$correction_id, before_state={status:'pending'}, after_state={status:decision}, ip_address)`

**Apply Logic (when `decision = 'approved'`)**
Service layer reads `corrections.field_name` and `corrections.suggested_value`, then executes a targeted UPDATE on either `listings` or `listing_details_business` depending on which table contains the field. Field name is validated against an allowlist before any dynamic UPDATE.

---

### 53. Manage Categories

**Type:** Server Action
**Route / Action:** `lib/actions/admin/manageCategories`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
// Create
interface CreateCategoryInput {
  action: 'create'
  name: string
  slug: string
  parent_id?: string // uuid; null for top-level categories
  description?: string
  icon?: string
  display_order?: number
}

// Update
interface UpdateCategoryInput {
  action: 'update'
  id: string // uuid
  name?: string
  slug?: string
  description?: string
  icon?: string
  display_order?: number
  is_active?: boolean
}

// Reorder
interface ReorderCategoriesInput {
  action: 'reorder'
  ordered_ids: string[] // uuid[] — full ordered list at the same level (same parent_id)
}
```

**Response**

```typescript
// create
interface CreateCategoryResponse {
  category_id: string // uuid
}

// update / reorder
interface CategoryMutationResponse {
  updated: true
}
```

**Validation Rules**

- `name` required for `create`; max 200 chars
- `slug` required for `create`; must be lowercase, URL-safe (letters, digits, hyphens only); must be unique across all categories — return `409 SLUG_CONFLICT` on duplicate
- `slug` for `update`: same format rules if provided; uniqueness re-checked
- `reorder` `ordered_ids` must be a non-empty array of valid UUIDs

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code               | HTTP | When                                             |
| ------------------ | ---- | ------------------------------------------------ |
| `VALIDATION_ERROR` | 400  | Missing required fields or slug format violation |
| `SLUG_CONFLICT`    | 409  | Slug is already in use by another category       |
| `AUTH_REQUIRED`    | 401  | No authenticated session                         |
| `FORBIDDEN`        | 403  | Caller is not admin or super_admin               |

**Frontend Usage**

- Admin Categories management screen (if built at MVP; deferred to Beta if not prioritized)
- Category tree rendered with drag-to-reorder support within each parent level

**Analytics Event Emitted**

- `admin_category_created` — properties: `{ category_id, name }`
- `admin_category_updated` — properties: `{ category_id, changed_fields: string[] }`

**Cache Invalidation**
`revalidateTag('categories')` — category changes affect all city pages, category landing pages, and listing form dropdowns

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='category_[created|updated|reordered]', target_table='categories', target_id=$category_id_or_null, ...)`

---

### 54. Manage Collections

**Type:** Server Actions
**Route / Action:** `lib/actions/admin/manageCollections`, `lib/actions/admin/manageCollectionItems`
**Phase:** MVP
**Auth:** Admin

**Request**

```typescript
// manageCollections — Create
interface CreateCollectionInput {
  action: 'create'
  title: string
  slug: string
  description?: string
  cover_image_path?: string // Storage path
}

// manageCollections — Update
interface UpdateCollectionInput {
  action: 'update'
  collection_id: string // uuid
  title?: string
  slug?: string
  description?: string
  cover_image_path?: string
  is_active?: boolean
  display_order?: number
}

// manageCollections — Delete
interface DeleteCollectionInput {
  action: 'delete'
  collection_id: string // uuid
}

// manageCollectionItems — Add
interface AddCollectionItemInput {
  action: 'add'
  collection_id: string // uuid
  listing_id: string // uuid
  display_order?: number
}

// manageCollectionItems — Remove
interface RemoveCollectionItemInput {
  action: 'remove'
  collection_id: string // uuid
  listing_id: string // uuid
}

// manageCollectionItems — Reorder
interface ReorderCollectionItemsInput {
  action: 'reorder'
  collection_id: string // uuid
  ordered_listing_ids: string[] // uuid[] — complete ordered list
}
```

**Response**

```typescript
// create collection
interface CreateCollectionResponse {
  collection_id: string // uuid
}

// update collection
interface UpdateCollectionResponse {
  updated: true
}

// delete collection
interface DeleteCollectionResponse {
  deleted: true
}

// add item
interface AddCollectionItemResponse {
  collection_id: string
  listing_id: string
}

// remove item / reorder
interface CollectionItemMutationResponse {
  updated: true
}
```

**Validation Rules**

- `title` required for `create`; max 200 chars
- `slug` required for `create`; must be lowercase, URL-safe (letters, digits, hyphens only); `UNIQUE` on `collections.slug` — return `409 SLUG_CONFLICT` on duplicate
- Adding a listing already in the collection returns `409 DUPLICATE_ITEM` (enforced by `UNIQUE (collection_id, listing_id)` on `collection_items`)
- `ordered_listing_ids` for reorder must all belong to the given collection

**Permission Checks**

- Admin role check (service_role client)

**Errors**

| Code               | HTTP | When                                             |
| ------------------ | ---- | ------------------------------------------------ |
| `VALIDATION_ERROR` | 400  | Missing required fields or slug format violation |
| `SLUG_CONFLICT`    | 409  | Slug is already in use by another collection     |
| `DUPLICATE_ITEM`   | 409  | Listing is already in this collection            |
| `AUTH_REQUIRED`    | 401  | No authenticated session                         |
| `FORBIDDEN`        | 403  | Caller is not admin or super_admin               |

**Frontend Usage**

- Admin Collections screen: create, edit, and delete collections; manage listing membership and order

**Analytics Event Emitted**

- `admin_collection_created` — properties: `{ collection_id, title }`
- `admin_collection_updated` — properties: `{ collection_id, changed_fields: string[] }`
- `admin_collection_item_added` — properties: `{ collection_id, listing_id }`

**Cache Invalidation**
`revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')` — collection pages and the collections index are publicly cached

**Audit Log Entry**
`INSERT INTO admin_audit_log (admin_user_id, action='collection_[created|updated|deleted|item_added|item_removed|items_reordered]', target_table='collections', target_id=$collection_id, ...)`

---

## Section 10: Receipt & Community Spend

> **Phase: V2** — All endpoints in this section are deferred to V2. The `receipt_uploads`, `spend_events`, and `community_impact_daily` tables are built at V2. No receipt or spend endpoints are active at MVP or V1.

---

### 55. Upload Receipt Photo

**Type:** Route Handler
**Route / Action:** `POST /api/upload`
**Phase:** V2
**Auth:** Supporter (minimum)

**Request**

```typescript
// multipart/form-data
interface UploadReceiptRequest {
  file: File // Receipt image file
  bucket: 'receipts' // Must be literal 'receipts' for this flow
  entity_type: 'receipt' // Must be literal 'receipt' for this flow
  entity_id: string // Must equal auth.uid() — enforced server-side
}
```

**Response**

```typescript
interface UploadReceiptResponse {
  data: {
    path: string // Storage path: receipts/[user_id]/[uuid].[ext]
  }
}
```

> Note: This endpoint reuses the shared `POST /api/upload` route handler documented in Section 3 (Media). The `bucket`, `entity_type`, and `entity_id` parameters route the upload to the `receipts` bucket. The storage path is returned for use in the subsequent `createReceiptSubmission` action. No database record is created by this endpoint — the path is stored when the receipt submission is created.

**Validation Rules**

- `file` is required and must not be empty
- `file.type` must be one of `image/jpeg`, `image/png`, `image/webp`
- `file.size` must not exceed 10MB (10,485,760 bytes)
- `entity_id` must equal `auth.uid()` — server enforces this regardless of client-provided value
- `bucket` must equal `'receipts'` — any other value routes to the media upload flow
- Filename is server-generated as `[uuid].[ext]` — client-provided filename is ignored

**Permission Checks**

- Session validated via `supabase.auth.getUser()` before any file handling
- `entity_id` is overwritten server-side to `auth.uid()` — client cannot upload to another user's receipt folder
- Storage path pattern enforced: `receipts/[auth.uid()]/[uuid].[ext]`

**Errors**

| Code               | HTTP | When                                                             |
| ------------------ | ---- | ---------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                                 |
| `FORBIDDEN`        | 403  | `entity_id` does not match `auth.uid()`                          |
| `VALIDATION_ERROR` | 400  | MIME type not allowed, file exceeds 10MB, or `entity_id` missing |
| `UPLOAD_FAILED`    | 500  | Supabase Storage write failed                                    |

**Frontend Usage**

- Receipt upload screen at `/account/receipts` — triggered via FAB opening camera or file picker
- `path` from response is passed directly to `createReceiptSubmission` in the same user flow
- Do not cache or store the path in persistent state beyond the active submission session

**Analytics Event Emitted**

`receipt_upload_started` — when user opens the camera or file picker to begin upload (emitted client-side before the request, not after)

**Cache Invalidation**

None — storage uploads are not cached

---

### 56. Create Receipt Submission

**Type:** Server Action
**Route / Action:** `lib/actions/spend/createReceiptSubmission`
**Phase:** V2
**Auth:** Supporter (minimum)

**Request**

```typescript
interface CreateReceiptSubmissionArgs {
  client_idempotency_key: string // UUID generated client-side; required for dedup
  image_path: string // Storage path from prior /api/upload call
  listing_id?: string // UUID — optional matched listing
  raw_business_name?: string // Free-text business name if listing_id not known
  amount: number // Purchase amount in USD
  spend_date: string // ISO date string: "YYYY-MM-DD"
  category_id?: string // UUID — optional category attribution
}
```

**Response**

```typescript
interface CreateReceiptSubmissionResponse {
  data: {
    spend_event_id: string // UUID of the created spend_events row
    status: 'pending' // Always 'pending' for receipt submissions requiring review
    message: string // Human-readable confirmation
  }
}
```

> Note: `client_idempotency_key` is stored on the `receipt_uploads` record and used to detect duplicate submissions from network retries. The service layer uses `INSERT INTO receipt_uploads ... ON CONFLICT (client_idempotency_key) DO NOTHING` and returns the existing record ID on conflict. `spend_events.user_id` is set server-side from `auth.uid()` and is never returned in any response.

**Validation Rules**

- `client_idempotency_key` required; must be a valid UUID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- `image_path` required; must start with `receipts/[auth.uid()]/` — any other prefix is rejected
- `image_path` must reference a file that exists in Supabase Storage (server validates before creating DB record)
- `amount` required; must be greater than 0 and no greater than 99,999.99
- `spend_date` required; must be a valid ISO date; not more than 90 days in the past; not in the future
- At least one of `listing_id` or `raw_business_name` must be provided
- `listing_id` if provided must reference a published listing (`status = 'published'`)
- `category_id` if provided must reference an active category (`is_active = true`)

**Permission Checks**

- `user_id` on both `receipt_uploads` and `spend_events` is set server-side to `auth.uid()` — never trusted from request body
- `image_path` must start with `receipts/[auth.uid()]/` — enforces that users can only submit receipts from their own storage folder
- On idempotency key conflict: return the existing `spend_event_id` with HTTP 200 (not an error)

**Errors**

| Code               | HTTP | When                                                      |
| ------------------ | ---- | --------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                          |
| `VALIDATION_ERROR` | 400  | Any field fails validation (see rules above)              |
| `FORBIDDEN`        | 403  | `image_path` does not start with `receipts/[auth.uid()]/` |
| `NOT_FOUND`        | 404  | `image_path` does not exist in storage                    |
| `SERVER_ERROR`     | 500  | Database write failed                                     |

> On idempotency key conflict: return `{ data: { spend_event_id: "[existing_id]", status: 'pending', message: "Receipt already submitted." } }` with HTTP 200.

**Frontend Usage**

- Receipt submission form displayed after successful photo upload at `/account/receipts`
- Client generates `client_idempotency_key` with `crypto.randomUUID()` before first submission attempt
- On network error, client retries with the same `client_idempotency_key` — server deduplicates
- On 200 with existing `spend_event_id`: show confirmation; do not re-submit

**Analytics Event Emitted**

`receipt_submitted` — emitted on successful insert (not on idempotency conflict); properties: `{ has_listing_match: boolean }` where `has_listing_match = true` when `listing_id` was provided

**Cache Invalidation**

None — receipt lists are fetched dynamically; no ISR paths to revalidate

---

### 57. List Own Receipts

**Type:** Route Handler
**Route / Action:** `GET /api/receipts`
**Phase:** V2
**Auth:** Supporter (minimum)

**Request**

```typescript
// Query parameters
interface ListReceiptsParams {
  status?: 'uploaded' | 'processing' | 'parsed' | 'confirmed' | 'rejected'
  page?: number // Default: 1
  limit?: number // Default: 20; maximum: 100
}
```

**Response**

```typescript
interface ListReceiptsResponse {
  data: Array<{
    id: string // spend_events.id (UUID)
    amount: number // spend_events.amount
    spend_date: string // ISO date string
    status: string // receipt_uploads.status
    created_at: string // ISO 8601 timestamp
    listing: {
      id: string
      name: string
      slug: string
      logo_path: string | null
    } | null // null for unattributed entries
    raw_business_name: string | null
    // image_path is intentionally excluded — use getReceiptImageUrl action
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

> Security note: `image_path` is never included in list responses. Receipt images are accessed exclusively via signed URLs generated by the `getReceiptImageUrl` Server Action, which validates ownership per request.

**Validation Rules**

- `status` if provided must be one of the valid enum values; return 400 for unrecognized values
- `limit` clamped to maximum 100 server-side regardless of client value
- `page` must be a positive integer; invalid values default to 1

**Permission Checks**

- `WHERE spend_events.user_id = auth.uid()` applied to all queries — users can only see their own receipts
- `image_path` column excluded from SELECT statement at the query level

**Errors**

| Code               | HTTP | When                          |
| ------------------ | ---- | ----------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session              |
| `VALIDATION_ERROR` | 400  | Invalid `status` filter value |

**Frontend Usage**

- Receipt history list at `/account/receipts`
- Powers the receipt count badge and spend summary on the account dashboard
- Each list item shows a "View receipt" action that calls `getReceiptImageUrl` to retrieve the signed URL on demand

**Analytics Event Emitted**

None

**Cache Invalidation**

None — dynamic per-user data; no ISR

---

### 58. Get Receipt Image URL

**Type:** Server Action
**Route / Action:** `lib/actions/spend/getReceiptImageUrl`
**Phase:** V2
**Auth:** Supporter (minimum — own receipts only)

**Request**

```typescript
interface GetReceiptImageUrlArgs {
  spend_event_id: string // UUID of the spend_events row
}
```

**Response**

```typescript
interface GetReceiptImageUrlResponse {
  data: {
    signed_url: string // 15-minute signed URL for direct storage access
    expires_at: string // ISO 8601 timestamp of URL expiry
  }
}
```

> Security model: The signed URL is generated using the Supabase service role storage client. The URL is valid for 900 seconds (15 minutes). It is never logged, never stored in the database, and never cached. The UI must use it immediately and discard it — not persist it in state or localStorage.

**Validation Rules**

- `spend_event_id` required; must be a valid UUID
- Corresponding `spend_events` row must have `user_id = auth.uid()`
- Corresponding `receipt_uploads` row must exist and have a non-null `image_path`

**Permission Checks**

- Ownership check: `SELECT image_path FROM receipt_uploads WHERE spend_event_id = [id] AND user_id = auth.uid()`
- Storage client uses service role key — never exposed to client; URL generation happens entirely server-side
- If ownership check fails: return 403, not 404 (ownership is known — the record exists)

**Errors**

| Code            | HTTP | When                                                                |
| --------------- | ---- | ------------------------------------------------------------------- |
| `AUTH_REQUIRED` | 401  | No valid session                                                    |
| `FORBIDDEN`     | 403  | `spend_events.user_id` does not match `auth.uid()`                  |
| `NOT_FOUND`     | 404  | `spend_event_id` does not exist or has no associated receipt upload |
| `SERVER_ERROR`  | 500  | Storage signed URL generation failed                                |

**Frontend Usage**

- Called when user expands a receipt row on `/account/receipts` to view the image
- Called when user opens the receipt detail modal
- URL is consumed immediately to populate an `<img>` tag — not stored in React state beyond the component's render lifecycle
- On URL expiry (after 15 minutes): call again to get a fresh URL

**Analytics Event Emitted**

None

**Cache Invalidation**

None

---

### 59. Create Spend Log (Manual)

**Type:** Server Action
**Route / Action:** `lib/actions/spend/createSpendLog`
**Phase:** V2
**Auth:** Supporter (minimum)

**Request**

```typescript
interface CreateSpendLogArgs {
  client_idempotency_key: string // UUID generated client-side; required for dedup
  listing_id: string // UUID — required; must reference a published listing
  amount: number // Purchase amount in USD
  spend_date: string // ISO date string: "YYYY-MM-DD"
  category_id?: string // UUID — optional category attribution
  aggregate_opt_out?: boolean // Default false — user opts out of community aggregation
}
```

**Response**

```typescript
interface CreateSpendLogResponse {
  data: {
    spend_event_id: string // UUID of the created spend_events row
    status: 'confirmed' // Manual logs are confirmed immediately (no receipt review)
  }
}
```

> Note: Manual spend logs skip the admin review queue because no image verification is required. The `source` field on `spend_events` is set to `'manual'` server-side. `user_id` is set to `auth.uid()` server-side and never returned. Deduplication uses the same `client_idempotency_key` pattern as receipt submissions.

**Validation Rules**

- `client_idempotency_key` required; must be a valid UUID
- `listing_id` required; must reference a listing with `status = 'published'` and `deleted_at IS NULL`
- `amount` required; must be greater than 0 and no greater than 99,999.99
- `spend_date` required; must be a valid ISO date; not in the future; not more than 90 days in the past
- `aggregate_opt_out` defaults to `false` if not provided

**Permission Checks**

- `user_id` set server-side to `auth.uid()` — never from request body
- On idempotency conflict: return existing record with HTTP 200

**Errors**

| Code               | HTTP | When                                                |
| ------------------ | ---- | --------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                    |
| `VALIDATION_ERROR` | 400  | Any field fails validation (see rules above)        |
| `NOT_FOUND`        | 404  | `listing_id` does not reference a published listing |
| `SERVER_ERROR`     | 500  | Database write failed                               |

> On idempotency key conflict: return `{ data: { spend_event_id: "[existing_id]", status: 'confirmed' } }` with HTTP 200.

**Frontend Usage**

- Manual spend entry form on `/account/receipts` (secondary path for users without receipts)
- Client generates `client_idempotency_key` with `crypto.randomUUID()` before submission
- On success: show confirmation toast, update receipt/spend list

**Analytics Event Emitted**

`spend_logged` — properties: `{ listing_id: string, has_receipt: false }`

**Cache Invalidation**

None

---

### 60. Get Community Spend Aggregate

**Type:** Route Handler
**Route / Action:** `GET /api/community-spend`
**Phase:** V2
**Auth:** Anonymous

**Request**

```typescript
// Query parameters
interface CommunitySpendParams {
  city_id?: string // UUID — filter to a specific city
  category_id?: string // UUID — filter to a specific category
  period?: '7d' | '30d' | '90d' | '1y' // Default: '30d'
}
```

**Response**

```typescript
interface CommunitySpendResponse {
  data: {
    total_spend: number // Sum of qualifying spend in USD
    transaction_count: number // Count of qualifying spend_events rows
    unique_businesses: number // Count of distinct businesses in the aggregate
    period_label: string // Human-readable: "Last 30 days", "Last year", etc.
    by_category?: Array<{
      category_id: string
      category_name: string
      total_spend: number
      transaction_count: number
    }>
    by_day?: Array<{
      date: string // ISO date: "YYYY-MM-DD"
      total_spend: number
    }>
  }
}
```

> Privacy model: This endpoint reads exclusively from `community_impact_daily`, which contains no user FKs and no individual transaction data. `user_id` is never in any response from this endpoint under any condition. `aggregate_opt_out = true` rows are excluded from the nightly aggregation job that populates `community_impact_daily` — they are never in scope here.

**Validation Rules**

- `period` if provided must be one of `'7d'`, `'30d'`, `'90d'`, `'1y'`; return 400 for unrecognized values
- `city_id` if provided must be a valid UUID
- `category_id` if provided must be a valid UUID
- Invalid UUIDs return 400, not 404

**Permission Checks**

- Public endpoint — no auth required
- No user-identifying data in any response field (enforced by reading only from `community_impact_daily`)

**Errors**

| Code               | HTTP | When                                               |
| ------------------ | ---- | -------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Invalid `period` value or malformed UUID parameter |

**Frontend Usage**

- Community impact visualization at `/impact` or `/community`
- Homepage dollar-flow teaser section (nationwide aggregate, no filters)
- City landing page stats block (filtered by `city_id`)
- Category pages (filtered by `category_id`)

**Analytics Event Emitted**

`community_spend_viewed` — properties: `{ city_id: string | null, period: string }`

**Cache Invalidation**

ISR 1 hour — `community_impact_daily` is updated once per day via scheduled aggregation job; 1-hour ISR balances freshness with performance

---

## Section 11: Flow Map

> **Phase: V3** — The endpoints *in this section* are deferred to V3. They are documented here because the frontend team needs the contract finalized before the V3 sprint begins.
>
> **Do not read that as "there is no flow map yet."** Two flow-map endpoints ship today and are not described in this section:
>
> | Live endpoint | Serves |
> |---|---|
> | `GET /api/flow-map/summary` (`app/api/flow-map/summary/route.ts`) | Public aggregate totals by business and city, `city` and `category` filters |
> | `GET /api/flow-map/personal-impact` (`app/api/flow-map/personal-impact/route.ts`) | The authenticated user's own totals |
>
> They read **`flow_nodes` and `flow_edges` directly, per request**. The Section 11 endpoints below are a *different, later* design that reads precomputed `flow_map_snapshots` rows.
>
> **`flow_map_snapshots` does not exist.** There is no migration and no generated type for it `[Measured — repo grep, 2026-08-17]`. It is a requirement of the V3/V4 design, not existing V2 infrastructure, and the roadmap schedules it in Phase 4 (`production-roadmap.md:1096`, migration `20260512000004_flow_map_snapshots.sql`) rather than V2. Every Section 11 endpoint that reads from it is blocked on that table being built.

---

### 61. Get Public Flow Summary

**Type:** Route Handler
**Route / Action:** `GET /api/flow/summary`
**Phase:** V3
**Auth:** Anonymous

**Request**

```typescript
// Query parameters
interface FlowSummaryParams {
  city_id?: string // UUID — filters to a single city; omit for nationwide
}
```

**Response**

```typescript
interface FlowSummaryResponse {
  data: {
    total_dollars_circulated: number // Aggregate spend in USD across the period
    total_businesses_supported: number // Distinct businesses with attributed spend
    city: {
      name: string
      slug: string
    } | null // null when city_id not provided (nationwide)
    period: string // "All time" or specific period label
    last_updated: string // ISO 8601 timestamp from flow_map_snapshots
  }
}
```

> Source: Aggregated from `flow_nodes` table. `last_updated` sourced from the most recent `flow_map_snapshots.created_at` for the given city. Contains no user data.

**Validation Rules**

- `city_id` if provided must be a valid UUID; return 400 for malformed values
- If `city_id` references a city with no flow data yet: return platform-wide summary, not 404

**Permission Checks**

- Public endpoint — no auth required
- No user data in any response field

**Errors**

| Code               | HTTP | When                     |
| ------------------ | ---- | ------------------------ |
| `VALIDATION_ERROR` | 400  | Malformed `city_id` UUID |

**Frontend Usage**

- Homepage dollar-flow teaser section (no `city_id`)
- City landing page hero stats block (with `city_id`)
- Flow map page header summary

**Analytics Event Emitted**

`flow_summary_viewed` — properties: `{ city_id: string | null }`

**Cache Invalidation**

ISR 1 hour — flow node aggregates are recomputed nightly; 1-hour ISR is sufficient

---

### 62. Get Anonymized Flow Data

**Type:** Route Handler
**Route / Action:** `GET /api/flow/anonymized`
**Phase:** V3
**Auth:** Anonymous

**Request**

```typescript
// Query parameters
interface AnonymizedFlowParams {
  city_id: string // UUID — required; no national flow graph at V3
  snapshot_date?: string // ISO date "YYYY-MM-DD"; defaults to most recent snapshot
}
```

**Response**

```typescript
interface AnonymizedFlowResponse {
  data: {
    snapshot_date: string
    nodes: Array<{
      id: string // flow_nodes.id
      node_type: 'business' | 'category' | 'city'
      label: string // Display name for this node
      total_inflow: number
      total_outflow: number
      node_weight: number // Normalized 0–1; drives visual sizing
    }>
    edges: Array<{
      source_node_id: string
      target_node_id: string
      total_amount: number
      edge_weight: number // Normalized 0–1; drives edge thickness
    }>
    meta: {
      node_count: number
      edge_count: number
      computed_at: string // ISO 8601 timestamp
    }
  }
}
```

> Privacy model: This endpoint reads from `flow_map_snapshots.graph_json`, which is precomputed by the nightly job. No `user_id`, no individual spend amounts, no personally identifying data appears in any field.
>
> ⚠ **The rest of this note described a control that does not exist, and promised a stronger one than ships.** It said *"nodes with fewer than 5 contributing users are excluded from the snapshot at computation time — enforced in the service layer before writing to `flow_nodes` or `flow_edges`, not at query time."* Both halves were wrong, and a privacy claim is the worst place to leave a wrong statement standing, so it is corrected here rather than deleted:
>
> | Claim | What ships |
> |---|---|
> | Enforced **before writing** | Enforced **at query time.** Every public read applies `.gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)` — `app/api/flow-map/summary/route.ts:41, :70, :92`, `app/api/community-spend/route.ts:40, :68`, `app/(public)/flow-map/page.tsx:148, :189`. `flow_nodes` and `flow_edges` hold every row, including rows below the bar. |
> | Fewer than 5 **contributing users** | Fewer than 5 **transactions.** The bound is `AGGREGATE_MIN_TRANSACTIONS = 5` (`lib/spend/aggregate-privacy.ts:32`) counted over spend events, not distinct people. **Five receipts from one person clear it** — stated as an honest limit in that file's own header comment. A distinct-*people* guarantee needs a join through `receipt_uploads.user_id`, which `flow_nodes` does not carry. |
>
> Two consequences follow, and neither is hypothetical. **(1)** Anything that reads `flow_nodes` without the `.gte()` publishes below-threshold rows — the filter is a call-site obligation, not a property of the table. **(2)** If the Section 11 snapshot design is ever built, moving the bound to write time is a real change with a real benefit (the obligation stops being per-call-site), not the documentation of an existing state. The public copy is already honest about the unit — `/flow-map` says *"distinct transactions"* (`page.tsx:602`) and `/flow-map/methodology` says *"separate purchases"* (`methodology/page.tsx:193`) — so it is this contract, not the user-facing promise, that overstated the guarantee. `[Needs professional review]` — carried into the E-3 aggregation-privacy bundle.

**Validation Rules**

- `city_id` required; must be a valid UUID
- `snapshot_date` if provided must be a valid ISO date in `YYYY-MM-DD` format
- If no snapshot exists for the requested `city_id` and `snapshot_date` combination: return 404

**Permission Checks**

- Public endpoint — no auth required
- No user data in any response field (enforced by reading from precomputed snapshots only)

**Errors**

| Code               | HTTP | When                                                                 |
| ------------------ | ---- | -------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | `city_id` missing, malformed UUID, or invalid `snapshot_date` format |
| `NOT_FOUND`        | 404  | No snapshot exists for the requested city and date                   |

**Frontend Usage**

- Flow map visualization at `/flow` — primary rendering data source
- Passes `nodes` and `edges` arrays to the graph rendering library
- `node_weight` and `edge_weight` drive visual sizing and thickness

**Analytics Event Emitted**

`flow_map_viewed` — properties: `{ city_id: string }`

**Cache Invalidation**

ISR 24 hours — snapshots are computed once per night; daily ISR matches computation cadence

---

### 63. Get Personal Impact

**Type:** Route Handler
**Route / Action:** `GET /api/flow/personal-impact`
**Phase:** V3
**Auth:** Supporter (minimum)

**Request**

```typescript
// Query parameters
interface PersonalImpactParams {
  period?: '30d' | '90d' | '1y' | 'all' // Default: '30d'
}
```

**Response**

```typescript
interface PersonalImpactResponse {
  data: {
    total_spend: number // Sum of authenticated user's spend in period
    businesses_supported: number // Count of distinct listing_ids in period
    top_categories: Array<{
      category_name: string
      total_spend: number
    }>
    period_label: string // "Last 30 days", "Last 90 days", etc.
  }
}
```

> Privacy model: This endpoint returns only the authenticated user's own aggregated spend data. Individual `spend_events` rows are never exposed — only SUM and COUNT aggregates are returned. No other user's data is accessible through this endpoint. `user_id` is never in the response.

**Validation Rules**

- `period` if provided must be one of `'30d'`, `'90d'`, `'1y'`, `'all'`; return 400 for unrecognized values
- `aggregate_opt_out = true` records are excluded from `total_spend` and `businesses_supported` — opt-out is respected even for the user's own view

**Permission Checks**

- `WHERE spend_events.user_id = auth.uid()` applied to all aggregations
- No other user's data is in scope under any condition

**Errors**

| Code               | HTTP | When                   |
| ------------------ | ---- | ---------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session       |
| `VALIDATION_ERROR` | 400  | Invalid `period` value |

**Frontend Usage**

- Personal impact card on the authenticated user's account dashboard at `/account` (V3 extension)
- Shown as a summary widget — not a raw transaction list

**Analytics Event Emitted**

`personal_impact_viewed` — properties: `{ period: string }`

**Cache Invalidation**

None — dynamic per-user data; no ISR

---

### 64. Get Entity Impact

**Type:** Route Handler
**Route / Action:** `GET /api/flow/entity/[id]`
**Phase:** V3
**Auth:** Owner (must own the listing referenced by `id`)

**Request**

```typescript
// Path parameter: id = listing UUID
// Query parameters
interface EntityImpactParams {
  period?: '30d' | '90d' | '1y' | 'all' // Default: '30d'
}
```

**Response**

```typescript
interface EntityImpactResponse {
  data: {
    listing_id: string // UUID of the listing
    total_attributed_spend: number // SUM of spend_events.amount for this listing
    transaction_count: number // COUNT of qualifying spend_events rows
    period_label: string // Human-readable period description
  }
}
```

> Privacy model: This endpoint returns community aggregate spend attributed to a specific listing. Individual `user_id` values from `spend_events` are never returned — only SUM and COUNT aggregates. `aggregate_opt_out = true` rows are excluded. A listing owner sees how much has been attributed to their business, not who spent it or individual transaction details.

**Validation Rules**

- `id` (path param) must be a valid UUID
- `period` if provided must be one of `'30d'`, `'90d'`, `'1y'`, `'all'`
- `aggregate_opt_out = true` rows excluded from all aggregations

**Permission Checks**

- `listings.owner_user_id = auth.uid()` — ownership verified before returning any data
- If the listing exists but is not owned by `auth.uid()`: return 403
- If the listing does not exist or is soft-deleted: return 404

**Errors**

| Code               | HTTP | When                                                           |
| ------------------ | ---- | -------------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                               |
| `FORBIDDEN`        | 403  | Listing exists but `owner_user_id` does not match `auth.uid()` |
| `NOT_FOUND`        | 404  | Listing does not exist or `deleted_at IS NOT NULL`             |
| `VALIDATION_ERROR` | 400  | Invalid `period` value or malformed UUID                       |

**Frontend Usage**

- Owner analytics dashboard at `/manage/[listing-id]/analytics` (V3 extension)
- Shown as a "Community attributed spend" summary widget

**Analytics Event Emitted**

`entity_impact_viewed` — properties: `{ listing_id: string }`

**Cache Invalidation**

None — dynamic per-listing data; no ISR

---

## Section 12: Marketplace Foundation

> **Phase: V2** — All endpoints in this section are deferred to V2. Stripe Connect application should be submitted at V1 launch (2–4 week review window) so that approval is in hand before V2 development begins. No marketplace endpoints are active at MVP or V1.

> **Stripe Connect note:** `listing_details_vendor.stripe_connect_id` (the `acct_...` string) and `products.stripe_product_id` / `products.stripe_price_id` are server-side only fields. They must never appear in any client-facing response payload under any condition.

---

### 65. List Vendor Products

**Type:** Route Handler
**Route / Action:** `GET /api/listings/[id]/products`
**Phase:** V2
**Auth:** Anonymous

**Request**

```typescript
// Path parameter: id = vendor listing UUID
// Query parameters
interface ListVendorProductsParams {
  page?: number // Default: 1
  limit?: number // Default: 20; maximum: 100
}
```

**Response**

```typescript
interface ListVendorProductsResponse {
  data: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    compare_at_price: number | null
    currency: string // "USD"
    inventory_count: number | null // null = unlimited
    track_inventory: boolean
    is_active: boolean // Derived: status === 'active'
    cover_image_path: string | null
    variants: Array<{
      id: string
      name: string
      options: Record<string, string> // e.g., { "color": "red", "size": "M" }
      price_delta: number
      inventory_count: number | null
      is_active: boolean // product_variants.is_active
    }> | null
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

> Schema note: `products.status` uses `'active' | 'draft' | 'archived'` in the database. The API response exposes this as `is_active: boolean` (`status === 'active'`) for frontend consistency. `stripe_product_id` and `stripe_price_id` are excluded from the SELECT query at the service layer. For the owner viewing their own storefront, inactive products (`status = 'draft'` or `'archived'`) are visible; for anonymous and authenticated non-owner requests, only `status = 'active'` products are returned.

**Validation Rules**

- `id` (path param) must be a valid UUID
- `limit` clamped to maximum 100 server-side
- `page` must be a positive integer

**Permission Checks**

- Parent listing must have `entity_type = 'vendor'` — return 422 if not a vendor listing
- Parent listing must have `status = 'published'` for anonymous access
- Products filtered to `status = 'active' AND deleted_at IS NULL` for anonymous and non-owner authenticated requests
- Owner (`listings.owner_user_id = auth.uid()`) may see all products including drafts and archived

**Errors**

| Code                 | HTTP | When                                                                |
| -------------------- | ---- | ------------------------------------------------------------------- |
| `NOT_FOUND`          | 404  | Listing does not exist or is not published                          |
| `LISTING_NOT_VENDOR` | 422  | Listing exists and is published but `entity_type` is not `'vendor'` |

**Frontend Usage**

- Vendor storefront products tab on the BLACQList Page
- Renders product cards with price, cover image, and variant selector
- Owner's product management view (includes draft/archived products)

**Analytics Event Emitted**

`product_catalog_viewed` — properties: `{ listing_id: string }`

**Cache Invalidation**

ISR 30 minutes — product availability and pricing change infrequently; 30-minute ISR balances freshness with performance

---

### 66. Get Product Detail

**Type:** Route Handler
**Route / Action:** `GET /api/products/[id]`
**Phase:** V2
**Auth:** Anonymous

**Request**

```typescript
// Path parameter: id = product UUID
// No query parameters
```

**Response**

```typescript
interface GetProductDetailResponse {
  data: {
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    compare_at_price: number | null
    currency: string
    inventory_count: number | null
    track_inventory: boolean
    is_active: boolean // Derived: status === 'active'
    is_digital: boolean
    cover_image_path: string | null
    tags: string[] | null
    vendor_listing: {
      id: string
      name: string
      slug: string
      city: {
        name: string
        slug: string
      } | null
    }
    variants: Array<{
      id: string
      name: string
      options: Record<string, string>
      price_delta: number
      inventory_count: number | null
      is_active: boolean
    }> | null
  }
}
```

> Note: `stripe_product_id`, `stripe_price_id`, and all Stripe identifiers are excluded from the SELECT query. `is_active` is derived from `status === 'active'`.

**Validation Rules**

- `id` (path param) must be a valid UUID

**Permission Checks**

- Product must have `deleted_at IS NULL`
- For anonymous and non-owner authenticated access: product must have `status = 'active'`
- Parent listing must have `status = 'published'`

**Errors**

| Code               | HTTP | When                                                                 |
| ------------------ | ---- | -------------------------------------------------------------------- |
| `NOT_FOUND`        | 404  | Product does not exist or parent listing is not published            |
| `PRODUCT_INACTIVE` | 410  | Product exists (`deleted_at IS NULL`) but `status` is not `'active'` |

> Use 410 Gone (not 404) for inactive products so that search engines and CDN caches can distinguish "never existed" from "existed but is no longer available." This distinction matters for crawl budget and storefront link management.

**Frontend Usage**

- Product sub-page: `/[city-slug]/vendor/[listing-slug]/products/[product-slug]`
- Renders full product page with description, variants, and purchase CTA
- Variant selector updates displayed price using `product.price + variant.price_delta`

**Analytics Event Emitted**

`product_page_viewed` — properties: `{ product_id: string, listing_id: string }`

**Cache Invalidation**

ISR 30 minutes

---

### 67. Create Product Draft

**Type:** Server Action
**Route / Action:** `lib/actions/marketplace/createProduct`
**Phase:** V2
**Auth:** Owner (vendor listing only)

**Request**

```typescript
interface CreateProductArgs {
  vendor_listing_id: string // UUID — must be a listing owned by auth.uid()
  name: string
  description?: string
  price: number // USD; must be > 0
  compare_at_price?: number // Must be > price when provided
  track_inventory?: boolean // Default: false
  inventory_count?: number // Required when track_inventory = true; must be ≥ 0
}
```

**Response**

```typescript
interface CreateProductResponse {
  data: {
    product_id: string // UUID of the created products row
    slug: string // Auto-generated from vendor slug + product name
    status: 'draft' // New products always start as draft
  }
}
```

> Note: New products are always created with `status = 'draft'` (`is_active = false`). A product becomes purchasable only when the owner explicitly sets `status = 'active'` via `updateProduct`, subject to the `stripe_connect_status = 'active'` requirement. `slug` is auto-generated server-side.

**Validation Rules**

- `vendor_listing_id` required; must reference an existing listing
- `name` required; maximum 200 characters
- `price` required; must be greater than 0; maximum value 99,999.99
- `compare_at_price` if provided must be greater than `price`
- `inventory_count` if provided must be ≥ 0
- If `track_inventory = true`, `inventory_count` must be provided

**Permission Checks**

- `listings.owner_user_id = auth.uid()` — only the listing owner can create products
- `listings.entity_type = 'vendor'` — only vendor listings can have products
- `listing_details_vendor.stripe_connect_status = 'active'` — products cannot be created (even as drafts) until Stripe Connect is approved; return `STRIPE_CONNECT_REQUIRED` if not active

**Errors**

| Code                      | HTTP | When                                                                    |
| ------------------------- | ---- | ----------------------------------------------------------------------- |
| `AUTH_REQUIRED`           | 401  | No valid session                                                        |
| `FORBIDDEN`               | 403  | `listings.owner_user_id` does not match `auth.uid()`                    |
| `NOT_FOUND`               | 404  | `vendor_listing_id` does not reference a valid listing                  |
| `VALIDATION_ERROR`        | 400  | Any field fails validation (see rules above)                            |
| `STRIPE_CONNECT_REQUIRED` | 422  | `stripe_connect_status` is not `'active'`                               |
| `LISTING_NOT_VENDOR`      | 422  | Listing exists and is owned by user but `entity_type` is not `'vendor'` |

**Frontend Usage**

- Vendor product management screen at `/manage/[listing-id]/products/new`
- On success: redirect to `/manage/[listing-id]/products/[product-id]/edit` to add images and publish

**Analytics Event Emitted**

`product_created` — properties: `{ listing_id: string, product_id: string }`

**Cache Invalidation**

None at creation — product is a draft and not yet publicly visible; no ISR paths require revalidation

---

### 68. Update Product

**Type:** Server Action
**Route / Action:** `lib/actions/marketplace/updateProduct`
**Phase:** V2
**Auth:** Owner

**Request**

```typescript
interface UpdateProductArgs {
  product_id: string // UUID of the product to update
  name?: string
  description?: string
  price?: number
  compare_at_price?: number // Set to null to remove strikethrough price
  track_inventory?: boolean
  inventory_count?: number
  is_active?: boolean // true = set status to 'active'; false = set status to 'draft'
}
```

**Response**

```typescript
interface UpdateProductResponse {
  data: {
    product_id: string
    updated_at: string // ISO 8601 timestamp
  }
}
```

> Note: `is_active` in the request maps to `status` in the database: `true` sets `status = 'active'`; `false` sets `status = 'draft'`. Activating a product (`is_active = true`) requires `stripe_connect_status = 'active'` — the service layer enforces this check. Setting `status = 'archived'` is handled by a separate delete/archive action (not in this endpoint). `stripe_product_id` and `stripe_price_id` are managed entirely server-side when `price` changes; they are never in the request or response.

**Validation Rules**

- `product_id` required; must be a valid UUID
- `name` if provided: maximum 200 characters
- `price` if provided: must be greater than 0; maximum 99,999.99
- `compare_at_price` if provided: must be greater than `price` (using updated price if `price` is also being changed in the same request)
- `inventory_count` if provided: must be ≥ 0
- If `is_active = true`: `stripe_connect_status` must be `'active'` (checked server-side against `listing_details_vendor`)

**Permission Checks**

- `products.vendor_listing_id` → `listings.owner_user_id = auth.uid()` — ownership verified via join
- Product must have `deleted_at IS NULL`
- `is_active = true` blocked if `stripe_connect_status != 'active'`

**Errors**

| Code                      | HTTP | When                                                                 |
| ------------------------- | ---- | -------------------------------------------------------------------- |
| `AUTH_REQUIRED`           | 401  | No valid session                                                     |
| `FORBIDDEN`               | 403  | Product's parent listing is not owned by `auth.uid()`                |
| `NOT_FOUND`               | 404  | Product does not exist or `deleted_at IS NOT NULL`                   |
| `VALIDATION_ERROR`        | 400  | Any field fails validation                                           |
| `STRIPE_CONNECT_REQUIRED` | 422  | `is_active = true` requested but `stripe_connect_status != 'active'` |

**Frontend Usage**

- Vendor product edit form at `/manage/[listing-id]/products/[product-id]/edit`
- Toggle in product list to activate/deactivate (sets `is_active`)
- On success: show save confirmation toast

**Analytics Event Emitted**

`product_updated` — properties: `{ product_id: string }`

**Cache Invalidation**

`revalidatePath('/[city-slug]/vendor/[listing-slug]/products/[product-slug]')` — product detail page
`revalidatePath('/api/listings/[listing-id]/products')` — vendor product list page

---

### 69. Get Vendor Storefront

**Type:** Route Handler
**Route / Action:** `GET /api/listings/[id]/storefront`
**Phase:** V2
**Auth:** Anonymous

**Request**

```typescript
// Path parameter: id = vendor listing UUID
// No query parameters
```

**Response**

```typescript
interface GetVendorStorefrontResponse {
  data: {
    listing: {
      id: string
      name: string
      slug: string
      trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
      logo_path: string | null
      cover_image_path: string | null
    }
    vendor_details: {
      storefront_description: string | null // listing_details_vendor.storefront_description
      shipping_info: string | null // listing_details_vendor.shipping_info
      return_policy: string | null // listing_details_vendor.return_policy
      // stripe_connect_id: NEVER returned
      // stripe_connect_status: NEVER returned
    }
    products: Array<{
      id: string
      name: string
      slug: string
      price: number
      compare_at_price: number | null
      cover_image_path: string | null
      is_active: boolean
      has_variants: boolean // true when variants jsonb is non-null
    }> // First 12 active products
    product_count: number // Total active product count for this vendor
  }
}
```

> Security constraint: `listing_details_vendor.stripe_connect_id` and `listing_details_vendor.stripe_connect_status` must never appear in any client-facing response from this endpoint or any other public endpoint. These fields are read exclusively via the service role in Server Actions that require them for payment processing.

**Validation Rules**

- `id` (path param) must be a valid UUID

**Permission Checks**

- Listing must have `status = 'published'` and `deleted_at IS NULL`
- Listing must have `entity_type = 'vendor'` — return 422 if published but not a vendor
- Products filtered to `status = 'active' AND deleted_at IS NULL` for anonymous access
- `stripe_connect_id` and `stripe_connect_status` excluded from SELECT at query level

**Errors**

| Code                 | HTTP | When                                                                  |
| -------------------- | ---- | --------------------------------------------------------------------- |
| `NOT_FOUND`          | 404  | Listing does not exist, is not published, or `deleted_at IS NOT NULL` |
| `LISTING_NOT_VENDOR` | 422  | Listing exists and is published but `entity_type` is not `'vendor'`   |

**Frontend Usage**

- Vendor BLACQList Page storefront tab
- Renders storefront header, shipping/return policy, and the first 12 product cards
- "View all products" link routes to `GET /api/listings/[id]/products` with pagination

**Analytics Event Emitted**

`storefront_viewed` — properties: `{ listing_id: string }`

**Cache Invalidation**

ISR 30 minutes

---

### 70. Track Outbound CTA Click

**Type:** Route Handler
**Route / Action:** `POST /api/analytics/event`
**Phase:** V2
**Auth:** Anonymous

**Request**

```typescript
// Uses the shared POST /api/analytics/event endpoint documented in Section 3.
// This entry documents the specific event shape for marketplace CTA tracking.
interface TrackCTAClickBody {
  event_name: 'cta_click'
  entity_type: 'listing' | 'product'
  entity_id: string // UUID of the listing or product
  properties: {
    cta_type: 'shop' | 'buy-now' | 'book' | 'order' | string
    listing_id: string // UUID — always required even when entity_type = 'product'
    product_id?: string // UUID — required when entity_type = 'product'
    destination_url: string // The external URL the user is navigating to
  }
}
```

**Response**

```typescript
interface TrackCTAClickResponse {
  data: {
    success: true
  }
}
```

> This endpoint is fire-and-forget. The frontend dispatches the event and does not await a meaningful response before performing the navigation. `destination_url` is stored for analytics purposes only — it is not used to construct a redirect. The `POST /api/analytics/event` endpoint is documented in full in Section 3; this entry specifies the `cta_click` event shape for the marketplace context.

**Validation Rules**

- `event_name` must equal `'cta_click'`
- `entity_type` must be `'listing'` or `'product'`
- `entity_id` must be a valid UUID
- `properties.listing_id` required; must be a valid UUID
- `properties.destination_url` required; must begin with `https://`
- `properties.product_id` required when `entity_type = 'product'`

**Permission Checks**

- Public endpoint — no auth required
- `user_id` is associated server-side from session if present; anonymous events stored without user linkage

**Errors**

| Code               | HTTP | When                                  |
| ------------------ | ---- | ------------------------------------- |
| `VALIDATION_ERROR` | 400  | Any required field missing or invalid |

**Frontend Usage**

- Any outbound CTA button on a vendor BLACQList Page (Shop, Order, Buy Now)
- Any outbound link on a product detail page
- Event is dispatched before navigation — use `navigator.sendBeacon()` or a non-blocking fetch

**Analytics Event Emitted**

`cta_click` — this IS the analytics event; no secondary event is emitted
