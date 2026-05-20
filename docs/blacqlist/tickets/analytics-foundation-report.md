# Analytics Foundation — Build Report

**Date:** 2026-05-11  
**Status:** Foundation complete

---

## Events Implemented

15 events are defined in `lib/analytics/constants.ts` and accepted by `POST /api/analytics/event`:

| Constant | Event name | Category |
|---|---|---|
| `PAGE_VIEW` | `page_view` | Discovery |
| `SEARCH_PERFORMED` | `search_performed` | Discovery |
| `FILTER_APPLIED` | `filter_applied` | Discovery |
| `COLLECTION_VIEWED` | `collection_viewed` | Discovery |
| `GUIDE_VIEWED` | `guide_viewed` | Discovery |
| `CTA_CLICK` | `cta_click` | Engagement |
| `HERO_CTA_CLICK` | `hero_cta_click` | Engagement |
| `ACTION_BAR_CTA_CLICK` | `action_bar_cta_click` | Engagement |
| `SAVE_TOGGLED` | `save_toggled` | Engagement |
| `SHARE_INITIATED` | `share_initiated` | Engagement |
| `MARKETPLACE_PRODUCT_VIEWED` | `marketplace_product_viewed` | Marketplace |
| `MARKETPLACE_CTA_CLICK` | `marketplace_cta_click` | Marketplace |
| `REVIEW_SUBMITTED` | `review_submitted` | Conversion |
| `CLAIM_STARTED` | `claim_started` | Conversion |
| `CLAIM_SUBMITTED` | `claim_submitted` | Conversion |
| `LISTING_SUBMITTED` | `listing_submitted` | Conversion |
| `RECEIPT_SUBMITTED` | `receipt_submitted` | Conversion |

The existing `/api/marketplace/cta-click` route continues to insert `cta_click` events directly — it is compatible with the new table schema and was not refactored.

---

## Files Created

| File | Description |
|---|---|
| `lib/analytics/constants.ts` | Event name constants, TypeScript property types per event |
| `lib/analytics/server.ts` | `trackServerEvent()` and `trackServerEventWithUser()` utilities |
| `lib/analytics/client.ts` | `track()` browser helper — sendBeacon with fetch fallback |
| `app/api/analytics/event/route.ts` | `POST /api/analytics/event` — validates event_name, resolves user_id, fire-and-forget insert |
| `docs/blacqlist/analytics/analytics-event-taxonomy.md` | Full event taxonomy with properties, privacy rules, known limitations, test cases |

## Files Modified

| File | Change |
|---|---|
| `app/admin/analytics/page.tsx` | Replaced stub with: 3 stat cards (total, 24h, 7d), recent 50 events table |
| `app/dashboard/pages/[entityId]/analytics/page.tsx` | Added 30-day event counts (views, CTA clicks, saves, shares) from `analytics_events` |

---

## Metadata Allowed

| Event | Allowed properties |
|---|---|
| `search_performed` | query, result_count, city_id, category_id |
| `filter_applied` | filter_type, filter_value |
| `page_view` | entity_type, referrer_type |
| `cta_click` / `hero_cta_click` / `action_bar_cta_click` | cta_type, listing_id, destination_domain |
| `save_toggled` | action ('saved'/'unsaved'), source |
| `share_initiated` | method, source |
| `review_submitted` | rating (1–5 only) |
| `claim_started` | none beyond entity_id |
| `claim_submitted` | none beyond entity_id |
| `listing_submitted` | entity_type, category_id, city_id |
| `receipt_submitted` | listing_id |
| `marketplace_product_viewed` | listing_id |
| `marketplace_cta_click` | cta_type, listing_id |
| `guide_viewed` | guide_slug |
| `collection_viewed` | collection_slug |

---

## Privacy Rules

1. **No PII in properties** — no email, name, phone, full URL, or personally identifying fields
2. **user_id is server-resolved** — never accepted from the client; always from the authenticated session
3. **Search queries are logged** (`search_performed.query`) — review periodically for inadvertent personal data
4. **Review text excluded** — `review_submitted` records rating only; text stays in the `reviews` table
5. **URLs sanitized** — `destination_domain` is domain-only, never the full URL with query string
6. **GDPR erasure**: `user_id` SET NULL on user delete; rows preserved for aggregate counts
7. **`ip_address` field not populated** — the column exists in the schema but is not captured in the current route handler
8. **Session IDs are ephemeral** — `session_id` stored in `sessionStorage`, expires when the tab closes, not a persistent tracker

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| No rate limiting on `/api/analytics/event` | Risk of event spam from a bad actor or client bug | Add Redis-backed rate limit (300 events/min/session) before significant traffic |
| No IP hashing | Missing fraud signal | Populate `ip_address` with SHA-256 hashed IP when needed |
| No daily aggregation job | `entity_analytics_daily` is empty; owner dashboard shows raw counts | Build scheduled cron job to aggregate previous-day events at 00:05 UTC |
| Owner analytics uses live queries | COUNT queries per page load; slow at scale | Replace with reads from `entity_analytics_daily` once aggregation job runs |
| `scroll_depth_*` events not in constants | Scroll tracking not instrumented | Add `SCROLL_DEPTH_25/50/75/100` constants when entity pages are instrumented |
| `trackServerEventWithUser()` dynamic import | `await import("@/lib/supabase/server")` inside an async function avoids SSR circular dependency concerns | Static import is safe if calling context is confirmed server-only |
| `/api/marketplace/cta-click` not refactored | Parallel implementation; both insert to `analytics_events` | Optional cleanup: refactor to call `trackServerEventWithUser()` |

---

## Tests Needed

### Route handler (`POST /api/analytics/event`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Valid `page_view` event, no session | HTTP 200, row inserted with `user_id = null` |
| 2 | Valid event, authenticated session | HTTP 200, row inserted with correct `user_id` |
| 3 | Missing `event_name` | HTTP 400, `code: VALIDATION_ERROR` |
| 4 | Unknown `event_name` (`"foo_bar"`) | HTTP 400, `code: VALIDATION_ERROR` |
| 5 | `properties` payload > 5 KB | HTTP 400, `code: VALIDATION_ERROR` |
| 6 | Non-string `entity_id` (e.g. `entity_id: 123`) | HTTP 400, `code: VALIDATION_ERROR` |
| 7 | Malformed JSON body | HTTP 400, `code: VALIDATION_ERROR` |
| 8 | Valid event with all optional fields | HTTP 200, all fields stored |

### Client helper (`lib/analytics/client.ts`)

| # | Scenario | Expected |
|---|---|---|
| 1 | `sessionStorage` unavailable | `track()` does not throw |
| 2 | `navigator.sendBeacon` unavailable | Falls back to `fetch`; does not throw |
| 3 | Network failure during send | Does not throw; analytics is fire-and-forget |
| 4 | Payload shape | Correct JSON shape sent to endpoint |

### Server utilities (`lib/analytics/server.ts`)

| # | Scenario | Expected |
|---|---|---|
| 1 | `trackServerEvent()` | Inserts row without blocking caller |
| 2 | `trackServerEventWithUser()` with active session | `user_id` populated from session |
| 3 | `trackServerEventWithUser()` with no session | `user_id = null`, no error thrown |

### Owner analytics page (`/dashboard/pages/[entityId]/analytics`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Owner views their own listing | Counts displayed, no error |
| 2 | User accesses another owner's listing ID | 404 returned |
| 3 | Unauthenticated access | Redirect to sign-in (dashboard layout guard) |

### Admin analytics page (`/admin/analytics`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Admin user loads page | Stats and recent events table rendered |
| 2 | Non-admin user loads page | 403 / redirect (requireAdmin guard) |
| 3 | No events in database | "No events recorded yet" empty state shown |

---

## Next Recommended Tickets

1. **Instrument entity page with `page_view`** — fire `track({ event_name: ANALYTICS_EVENTS.PAGE_VIEW, entity_id, entity_type })` from the entity page client component on mount.
2. **Instrument search with `search_performed`** — fire after search results are returned, include `result_count` and active filters.
3. **Instrument claim flow** — fire `claim_started` on claim button click, `claim_submitted` on successful form submission.
4. **Instrument listing submit** — fire `listing_submitted` from the submit listing server action after successful insert.
5. **Instrument receipt submit** — fire `receipt_submitted` from the submit receipt server action.
6. **Daily aggregation job** — Supabase Edge Function or cron that runs at 00:05 UTC, aggregates previous day's events into `entity_analytics_daily`.
7. **Rate limiting on analytics endpoint** — implement request counting by `session_id` using Redis or Upstash.
8. **Owner analytics V1** — replace live COUNT queries with reads from `entity_analytics_daily`; add 7-day trend sparkline.
