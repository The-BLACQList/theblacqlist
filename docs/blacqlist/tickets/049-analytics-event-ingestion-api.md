# Ticket 049: Analytics event ingestion API (POST /api/analytics/event)

---

## Status

Backlog

## Phase

Phase 7: Saves, Reviews, Corrections, Sharing

## Priority

P1 — High

## Estimate

S (1–2h)

## Feature Area

Analytics / Infrastructure

---

## Context

Every significant user interaction on the platform — from page views to CTA clicks, saves, shares, and review submissions — fires a structured analytics event. These events power the owner dashboard's 7-day stats, the admin overview, and future product decisions.

The analytics ingestion endpoint is the single entry point for all client-side and server-side event data. It is designed to be fire-and-forget: the client never awaits a response, and a failure must never surface to the user. The endpoint always returns 200 except for invalid `event_name` values.

Events are stored in the `analytics_events` table and aggregated nightly (or on-demand for the dashboard) into the `entity_analytics_daily` summary table.

This ticket builds the Route Handler at `POST /api/analytics/event`. All server-side (RSC) event logging uses a direct DB insert helper (`insertAnalyticsEvent`) that bypasses the HTTP round trip.

Sources: `docs/blacqlist/architecture/api-contract.md` § 17 (Log Analytics Event); `docs/blacqlist/architecture/server-actions-plan.md` § 1 (Route Handler decision); `docs/blacqlist/architecture/data-model.md` → `analytics_events`, `entity_analytics_daily`.

---

## User Story

As the platform, I need every user interaction to be recorded in a structured analytics store, so that owners can see how their listings are performing and the team can make data-informed product decisions.

---

## Scope

**In scope:**

- `app/api/analytics/event/route.ts` — Route Handler; exports `POST` handler
- Accepts the `AnalyticsEventBody` shape (see API Notes below)
- Validates `event_name` against a server-side allowlist of the defined event names (see below)
- Sets `user_id` from `supabase.auth.getUser()` if authenticated; `null` if anonymous
- Hashes `ip_address` via SHA-256 before storage — raw IP never persisted
- Inserts into `analytics_events` table
- Always returns 200 `{ data: { success: true } }` on success or on non-critical failure (fire-and-forget)
- Returns 400 for invalid `event_name` or `properties` exceeding 5KB
- Returns 429 for rate limit exceeded (300 events/min per `session_id`) — client swallows this silently
- `lib/analytics/insertAnalyticsEvent.ts` — direct DB insert helper for Server Components (bypasses HTTP)
- Rate limit check in the handler: `session_id` → counter in memory or lightweight KV (see implementation notes); 429 if exceeded
- All other error paths log server-side and return 200 — the client must never see an unexpected error from this endpoint

**Out of scope:**

- `entity_analytics_daily` aggregation job (this is a background/cron concern)
- Real-time dashboard data (the dashboard reads from pre-aggregated tables)
- Full analytics reporting UI
- Event replay or dead-letter queue
- The 45-event allowlist definition is part of the data model; this ticket implements validation against it

---

## Dependencies

| Dependency                                                           | Type            | Status             |
| -------------------------------------------------------------------- | --------------- | ------------------ |
| Ticket 012 — `analytics_events` table migration                      | Blocking ticket | Not started        |
| `NEXT_PUBLIC_SUPABASE_URL` and service role key for direct DB insert | Environment     | Must be configured |

---

## UX Notes

This is a backend-only ticket. There is no user-facing UI. The Route Handler is called by other components (fire-and-forget) and by server-side helpers in RSC pages. It is invisible to users.

---

## Design Notes

No UI. The handler must respond quickly (target P95 < 50ms) because some calls are made from interactive components. Lightweight validation and immediate insert — no complex business logic.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `analytics_events`
- **Entities involved:** `analytics_events`
- **Operations:**
  - INSERT `analytics_events` with: `event_name`, `user_id` (from auth, nullable), `session_id`, `entity_type`, `entity_id`, `properties`, `ip_address_hash` (SHA-256 of IP), `user_agent`, `occurred_at = now()`
- **Validation rules:**
  - `event_name`: required; must be one of the 45 defined event names — validated against the allowlist
  - `properties`: optional; max 5KB when serialized; reject if exceeded
  - `entity_id`: must be a valid UUID format if provided
  - `session_id`: optional; used for rate limiting
- **RLS policies:** `analytics_events` is INSERT-only from the service_role client (no user-scoped reads or writes via anon/session client)
- **Migration required:** No — `analytics_events` table from Ticket 012

**Event name allowlist** (45 events — these are the names validated against; defined in `lib/analytics/eventNames.ts`):

```
listing_page_viewed, listing_saved, listing_unsaved, listing_shared,
listing_cta_clicked, listing_phone_clicked, listing_website_clicked,
listing_directions_clicked, listing_email_clicked, listing_social_clicked,
search_performed, search_result_clicked, featured_listings_shown,
city_page_viewed, category_page_viewed, collection_page_viewed,
collections_index_viewed, discover_page_viewed, homepage_viewed,
dashboard_viewed, onboarding_role_set, onboarding_completed, onboarding_skipped,
claim_submitted, claim_document_uploaded, claim_withdrawn,
listing_created, listing_submitted_for_review, listing_published,
review_submitted, duplicate_warning_shown, page_section_edited,
media_uploaded, saved_list_viewed, receipt_uploaded,
admin_overview_viewed, admin_listing_updated, admin_claim_approved,
admin_claim_rejected, admin_user_role_changed, admin_user_suspended,
admin_collection_published, category_updated, collection_item_added,
for_business_page_viewed
```

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` § 17

**Endpoint:** `POST /api/analytics/event`

**Auth:** Anonymous (unauthenticated events permitted)

**Request shape:**

```typescript
interface AnalyticsEventBody {
  event_name: string // Must be in the 45-event allowlist
  entity_type?: string // E.g., 'listing', 'collection'
  entity_id?: string // UUID of the entity being interacted with
  properties?: Record<string, unknown> // Max 5KB serialized
  session_id?: string // Client-generated session identifier
}
```

**Response shape:**

```typescript
{ "data": { "success": true } }   // HTTP 200 — always 200 on success or non-critical failure
```

**Error responses:**

| Code               | HTTP | When                                                        |
| ------------------ | ---- | ----------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | `event_name` not in allowlist, or `properties` exceeds 5KB  |
| `RATE_LIMITED`     | 429  | >300 events/min per `session_id` — client silently swallows |

**Important:** All other error paths (DB insert failure, auth lookup failure) must log server-side but return 200. The endpoint must never return a 500 to the client.

---

## Implementation Notes

**Files to create:**

- `app/api/analytics/event/route.ts` — Route Handler; POST only
- `lib/analytics/insertAnalyticsEvent.ts` — direct DB insert helper for RSC; same schema insert; bypasses HTTP
- `lib/analytics/eventNames.ts` — `const EVENT_NAMES: readonly string[]` — the 45 allowed event names as a typed tuple

**Key implementation:**

```typescript
// app/api/analytics/event/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { EVENT_NAMES } from '@/lib/analytics/eventNames'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_name, entity_type, entity_id, properties, session_id } = body

    // Validate event_name
    if (!event_name || !EVENT_NAMES.includes(event_name)) {
      return NextResponse.json(
        { error: 'Invalid event name.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Validate properties size
    if (properties && JSON.stringify(properties).length > 5120) {
      return NextResponse.json(
        { error: 'Properties payload too large.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Validate entity_id format if provided
    if (entity_id && !/^[0-9a-f-]{36}$/.test(entity_id)) {
      return NextResponse.json(
        { error: 'Invalid entity_id.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Rate limit (lightweight in-memory; swap for Redis/KV in production scale)
    // MVP: use a simple Map with TTL — see note below

    // Get user_id if authenticated (non-blocking — if auth fails, proceed as anonymous)
    let userId: string | null = null
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll() } }
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      /* anonymous */
    }

    // Hash IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null

    // Insert via service_role (bypasses RLS; analytics table is INSERT-only for anon)
    const { createServiceRoleClient } = await import('@/lib/admin/serviceRoleClient')
    const supabaseAdmin = createServiceRoleClient()
    await supabaseAdmin.from('analytics_events').insert({
      event_name,
      user_id: userId,
      session_id: session_id ?? null,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      properties: properties ?? null,
      ip_address_hash: ipHash,
      user_agent: request.headers.get('user-agent') ?? null,
      occurred_at: new Date().toISOString(),
    })

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    // Non-critical failure — log and return 200 anyway (fire-and-forget contract)
    console.error('[analytics/event] Insert failed:', err)
    return NextResponse.json({ data: { success: true } })
  }
}
```

**Rate limiting at MVP:** Use an in-memory `Map<sessionId, { count, windowStart }>` with a 60-second rolling window. This is acceptable for a single-server deployment or low-traffic MVP. At production scale, swap for Upstash Redis or Vercel KV. Add a `// TODO: replace with Redis in production` comment.

**`insertAnalyticsEvent` helper for RSC:**

```typescript
// lib/analytics/insertAnalyticsEvent.ts
interface AnalyticsEventInput {
  event_name: string
  user_id?: string | null
  entity_type?: string
  entity_id?: string
  properties?: Record<string, unknown>
}

export async function insertAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const { createServiceRoleClient } = await import('@/lib/admin/serviceRoleClient')
    const supabase = createServiceRoleClient()
    await supabase.from('analytics_events').insert({
      event_name: input.event_name,
      user_id: input.user_id ?? null,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      properties: input.properties ?? null,
      source: 'server',
      occurred_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[insertAnalyticsEvent] Failed:', err)
    // non-fatal — analytics failure never blocks page render
  }
}
```

**Client usage pattern (all callsites must follow this):**

```typescript
// Never await analytics — always fire-and-forget
fetch('/api/analytics/event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event_name: 'listing_page_viewed', entity_id: listingId }),
})
// No .then(), no .catch() — swallow completely in the caller
```

**Do not:**

- Await the analytics fetch in any client component
- Surface analytics failures to the user in any form
- Log `user_id` or `listing_id` (which are UUIDs and not PII) in error messages — log only the event_name and a sanitized error
- Use the session-scoped Supabase client for the INSERT — use service_role client to bypass RLS and ensure the insert always succeeds regardless of the user's role

---

## Acceptance Criteria

- [ ] Given a valid `event_name` from the allowlist, when `POST /api/analytics/event` is called, then the event is inserted into `analytics_events` and the response is `{ data: { success: true } }` HTTP 200
- [ ] Given an `event_name` not in the allowlist, then the response is `{ error: 'Invalid event name.', code: 'VALIDATION_ERROR' }` HTTP 400
- [ ] Given `properties` payload exceeds 5KB, then the response is `{ error: 'Properties payload too large.', code: 'VALIDATION_ERROR' }` HTTP 400
- [ ] Given a valid authenticated session, then `user_id` is set from `auth.uid()` on the insert; anonymous events insert with `user_id = null`
- [ ] Given the DB insert fails, then the handler catches the error, logs it server-side, and still returns 200 `{ data: { success: true } }` — the client is unaffected
- [ ] Given a `session_id` exceeds 300 events per minute, then the handler returns HTTP 429
- [ ] Given the endpoint is called, the client's `ip_address` is hashed via SHA-256 before storage; the raw IP is never persisted
- [ ] `insertAnalyticsEvent` server-side helper inserts directly to the DB without an HTTP round trip; errors are caught and logged without throwing
- [ ] All 45 allowed event names are defined in `lib/analytics/eventNames.ts` and validated against in the handler

---

## Failure States

| Failure              | Condition                             | User sees              | Behavior                                                                                    |
| -------------------- | ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| DB insert fails      | Supabase unavailable or network error | Nothing                | Error logged server-side; 200 returned to client                                            |
| Auth lookup fails    | Cookie parsing error                  | Nothing                | `user_id` treated as null; insert proceeds anonymously                                      |
| Invalid event_name   | Not in allowlist                      | 400 returned to client | Client may log error silently; no UI impact (fire-and-forget callers swallow all responses) |
| Rate limit exceeded  | >300/min per session_id               | 429 returned           | Client swallows silently per fire-and-forget contract                                       |
| Properties too large | >5KB payload                          | 400 returned           | Client swallows silently                                                                    |

---

## Edge Cases

- `session_id` is null or missing — rate limiting is skipped for null session_ids (cannot track an anonymous session without an ID); accept the event without rate limiting
- `entity_id` is provided but the entity does not exist in the DB — the analytics event is still inserted; the ingestion endpoint does not validate entity existence (that would require a DB round trip and defeat the fire-and-forget performance goal)
- Multiple analytics events fired in rapid succession from a single page view (e.g., listing_page_viewed + listing_cta_clicked within 1 second) — each is a separate insert; no deduplication at the ingestion layer (dedup happens at aggregation time if needed)
- `properties` contains nested objects — JSON serialization depth is not limited; only the total serialized size is checked (5KB)

---

## Security Notes

- **IP hashing:** SHA-256 of the raw IP address. The raw IP is never written to the DB. The hash is one-way — cannot be reversed to the original IP. This satisfies GDPR/CCPA requirements for not storing PII.
- **No PII in properties:** The `properties` payload is not inspected for PII beyond size validation. Callers are responsible for not including names, emails, or other PII in event properties. A note in `lib/analytics/eventNames.ts` should document this requirement.
- **Service_role for INSERT:** The `analytics_events` table should have an RLS policy that denies direct INSERT from anon/authenticated roles. The service_role client bypasses RLS and is the only allowed insert path. This prevents client-side direct DB writes.
- **Rate limiting:** MVP in-memory rate limit is per-process. On multi-instance deployments, each instance has its own counter — effective rate limit per user is `300 × instance_count`. This is acceptable at MVP. Add a TODO comment for production migration to shared KV.

---

## QA Test Cases

| ID   | Test                        | Steps                                                                                | Expected                                                                                                                       |
| ---- | --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| QA-1 | Valid event — anonymous     | POST `{ event_name: 'listing_page_viewed', entity_id: '[valid-uuid]' }` without auth | 200 `{ data: { success: true } }`. Row in `analytics_events` with `user_id = null`. `ip_address_hash` is a 64-char hex string. |
| QA-2 | Valid event — authenticated | POST same body with a valid session cookie                                           | 200. Row in `analytics_events` with correct `user_id`.                                                                         |
| QA-3 | Invalid event_name          | POST `{ event_name: 'fake_event' }`                                                  | 400 `{ error: 'Invalid event name.', code: 'VALIDATION_ERROR' }`. No DB row created.                                           |
| QA-4 | Properties too large        | POST with `properties` containing 6KB of data                                        | 400. No DB row created.                                                                                                        |
| QA-5 | DB failure resilience       | Temporarily disable the `analytics_events` table. POST a valid event.                | 200 returned. Error logged server-side. No 500 to client.                                                                      |
| QA-6 | Rate limit                  | POST 301 events/min with same `session_id`                                           | First 300 return 200. Request 301 returns 429.                                                                                 |
| QA-7 | Server-side insert helper   | Call `insertAnalyticsEvent` from a Server Component with a valid event.              | Row inserted in `analytics_events` with `source = 'server'`. No HTTP round trip.                                               |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] All 45 event names defined in `lib/analytics/eventNames.ts`
- [ ] `event_name` validation works for valid and invalid names
- [ ] `user_id` set correctly for authenticated and anonymous requests
- [ ] IP address SHA-256 hash confirmed — raw IP not stored
- [ ] DB insert failure returns 200 (not 500) — tested
- [ ] Rate limit: 300/min per session_id triggers 429; client behavior verified (silently swallowed)
- [ ] `insertAnalyticsEvent` helper tested from a Server Component
- [ ] `properties` 5KB limit tested
- [ ] Service_role client used for INSERT — RLS does not block the insert
- [ ] `TODO: replace in-memory rate limit with Redis` comment added in implementation
