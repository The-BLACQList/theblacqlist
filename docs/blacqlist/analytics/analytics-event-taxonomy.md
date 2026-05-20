# Analytics Event Taxonomy — The BLACQList

**Last updated:** 2026-05-11  
**Status:** Foundation implemented

---

## Architecture Overview

All events flow into the `analytics_events` table via two paths:

| Path | When to use | Module |
|---|---|---|
| `POST /api/analytics/event` | Client components (browser) | `lib/analytics/client.ts` → `track()` |
| `trackServerEvent()` / `trackServerEventWithUser()` | Server Actions, Route Handlers, Server Components | `lib/analytics/server.ts` |

The existing `/api/marketplace/cta-click` route continues to operate independently and inserts into `analytics_events` directly — it predates this foundation.

---

## Privacy Rules

1. **No PII in `properties`** — never include email, full name, phone number, street address, or any field that directly identifies a person.
2. **`user_id` is handled at the table level** — resolved from the authenticated session server-side; never passed by the client in the request body.
3. **Search queries** are logged in `search_performed.properties.query`. Queries are not considered PII under this data model but should be reviewed periodically for inadvertent personal data.
4. **Review text is excluded** — `review_submitted` records the rating only. Review text lives in the `reviews` table under RLS, never in `analytics_events`.
5. **URLs are sanitized** — `cta_click` properties record `destination_domain` (domain only), never the full URL with query parameters.
6. **`user_id` survives GDPR erasure as `null`** — rows are never deleted; `user_id` is SET NULL on user deletion. Event counts remain accurate; attribution is lost.
7. **IP addresses** — the schema supports `ip_address` (SHA-256 hashed). The current route handler does NOT populate this field. Add hashed IP if rate-limiting or fraud detection requires it.
8. **Session IDs** — `session_id` is a client-generated UUID stored in `sessionStorage`. It expires when the browser tab closes. It is not a persistent identifier.

---

## Events

### Discovery

#### `page_view`
Fired when an entity page (listing, product, service, collection, guide) is fully loaded.

| Property | Type | Notes |
|---|---|---|
| `entity_type` | string | `'listing'` \| `'product'` \| `'service'` \| `'collection'` \| `'guide'` |
| `referrer_type` | string | `'search'` \| `'collection'` \| `'direct'` \| `'share'` |

**entity_id:** the UUID of the entity being viewed.  
**entity_type:** the type (required for aggregation).

---

#### `search_performed`
Fired when a user submits a search query (not on every keystroke).

| Property | Type | Notes |
|---|---|---|
| `query` | string | Raw query text; reviewed for inadvertent PII |
| `result_count` | number | Number of results returned |
| `city_id` | string | UUID of the city filter active at search time |
| `category_id` | string | UUID of the category filter active at search time |

**entity_id:** null (platform-level event).

---

#### `filter_applied`
Fired when a user applies a filter on a search, category, or map view.

| Property | Type | Required | Notes |
|---|---|---|---|
| `filter_type` | string | Yes | `'city'` \| `'category'` \| `'trust_tier'` \| `'location_type'` |
| `filter_value` | string | No | The value set (not PII) |

---

#### `collection_viewed`
Fired when a collection page is loaded.

| Property | Type | Notes |
|---|---|---|
| `collection_slug` | string | Slug of the collection |

**entity_id:** UUID of the collection.

---

#### `guide_viewed`
Fired when a guide or editorial page is loaded.

| Property | Type | Notes |
|---|---|---|
| `guide_slug` | string | Slug of the guide |

**entity_id:** UUID of the guide.

---

### Engagement

#### `cta_click`
General CTA click (website, book, contact, etc.). Also covers `hero_cta_click` and `action_bar_cta_click` — use the most specific constant when available.

| Property | Type | Notes |
|---|---|---|
| `cta_type` | string | `'visit-website'` \| `'book-now'` \| `'get-directions'` \| `'call'` \| `'email'` |
| `listing_id` | string | UUID of the listing — useful when entity_type is product/service |
| `destination_domain` | string | Domain only (e.g. `calendly.com`) — never the full URL |

---

#### `save_toggled`
Fired when a user saves or unsaves a listing.

| Property | Type | Notes |
|---|---|---|
| `action` | string | `'saved'` \| `'unsaved'` |
| `source` | string | `'entity_page'` \| `'search_result'` \| `'collection'` |

**entity_id:** UUID of the listing.

---

#### `share_initiated`
Fired when a user opens the share flow (native share or copy-link).

| Property | Type | Notes |
|---|---|---|
| `method` | string | `'copy_link'` \| `'native_share'` |
| `source` | string | `'entity_page'` \| `'collection'` |

**entity_id:** UUID of the entity being shared.

---

### Marketplace

#### `marketplace_product_viewed`
Fired when a product detail page is loaded.

| Property | Type | Notes |
|---|---|---|
| `listing_id` | string | UUID of the listing that owns the product |

**entity_id:** UUID of the product (`marketplace_products.id`).  
**entity_type:** `'product'`

---

#### `marketplace_cta_click`
Fired when a user clicks an outbound CTA on a marketplace product or service (Shop Now, Book Now, Visit Website).

| Property | Type | Notes |
|---|---|---|
| `cta_type` | string | `'shop-now'` \| `'book-now'` \| `'visit-website'` |
| `listing_id` | string | UUID of the associated listing |

**entity_id:** UUID of the product or service.  
**entity_type:** `'product'` or `'service'`

---

### Conversion

#### `review_submitted`
Fired when a review is successfully submitted.

| Property | Type | Notes |
|---|---|---|
| `rating` | number | 1–5 only. No review text. |

**entity_id:** UUID of the listing reviewed.

---

#### `claim_started`
Fired when a user clicks the "Claim this listing" button and begins the claim flow (navigates to the claim page).

No properties beyond `entity_id` (the listing UUID).

---

#### `claim_submitted`
Fired when a claim form is successfully submitted.

No properties beyond `entity_id` (the listing UUID).

---

#### `listing_submitted`
Fired when a new listing submission is successfully created.

| Property | Type | Notes |
|---|---|---|
| `entity_type` | string | Type of entity submitted |
| `category_id` | string | UUID of the selected category |
| `city_id` | string | UUID of the selected city |

**entity_id:** UUID of the newly created listing.

---

#### `receipt_submitted`
Fired when a community spend receipt is successfully submitted.

| Property | Type | Notes |
|---|---|---|
| `listing_id` | string | UUID of the listing the receipt is attributed to |

**entity_id:** UUID of the receipt record.  
Amount/spend data is NOT included in properties — it lives in the `receipts` table only.

---

## Validation Rules (enforced by `/api/analytics/event`)

| Rule | Details |
|---|---|
| `event_name` required | Must be one of the `VALID_EVENT_NAMES` set |
| `properties` size limit | Max 5 KB serialized JSON |
| `entity_id` type | String (UUID format expected) if provided |
| `user_id` | Never accepted from client — always resolved server-side |
| Rate limiting | Not yet implemented — track volume and add at 300 events/min/session if abuse observed |

---

## Known Limitations

1. **No IP hashing** — `ip_address` column exists but is not populated. Add SHA-256 hashed IP to the route handler if fraud detection is needed.
2. **No rate limiting** — the `/api/analytics/event` endpoint has no rate limit. Implement a Redis-backed counter (keyed by `session_id`) before the platform has significant traffic.
3. **Scroll depth events** — `scroll_depth_25/50/75/100` are defined in the schema but not in this foundation's constants. Add them when entity pages are instrumented.
4. **Daily aggregation job** — `entity_analytics_daily` table exists but is not populated. A scheduled job at 00:05 UTC should aggregate previous-day raw events. Not built yet.
5. **`/api/marketplace/cta-click`** — predates this foundation. It still inserts `cta_click` events correctly but doesn't use the new utility functions. Refactor is optional; the insert shape is compatible.
6. **No deduplication** — repeated identical events within a session are recorded. The client uses `sendBeacon` which may send a request on every call; call `track()` judiciously.
7. **`session_id` from server actions** — `trackServerEvent()` accepts `session_id` but does not auto-generate one. Server-side events will have `session_id = null` unless the caller explicitly threads it through.

---

## Tests Needed

| Area | What to test |
|---|---|
| `POST /api/analytics/event` | Valid event inserts successfully (HTTP 200) |
| | Missing `event_name` returns 400 VALIDATION_ERROR |
| | Unknown `event_name` returns 400 VALIDATION_ERROR |
| | Properties exceeding 5 KB returns 400 |
| | Non-string `entity_id` returns 400 |
| | Anonymous request (no session) returns 200 with `user_id = null` |
| `track()` client helper | Does not throw when `sessionStorage` is unavailable |
| | Does not throw when `navigator.sendBeacon` is unavailable |
| | Sends correct payload shape |
| `trackServerEvent()` | Fires insert without awaiting |
| `trackServerEventWithUser()` | Resolves user_id from a valid session |
| | Returns gracefully when no session exists |
| Admin analytics page | Loads without error for authenticated admin |
| Owner analytics page | Shows only events for the owner's listing |
| | Returns 404 for a listing the user does not own |
