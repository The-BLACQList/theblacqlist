# Error Handling Standard — The BLACQList

**Last updated:** 2026-05-07
**Applies to:** All Route Handlers and Server Actions

This document is the single source of truth for error handling across the platform. All engineers must apply these patterns without deviation. Any endpoint or action that returns a different shape, skips auth checks, or surfaces raw database errors to the client is a defect.

---

## 1. Response Envelope

All Route Handlers return one of three envelope shapes. All Server Actions return `ActionResult<T>`. The two systems are not interchangeable — Route Handlers are HTTP and use `Response.json()`; Server Actions are TypeScript function calls and return typed values directly.

### Route Handler Envelopes

```typescript
// Success — single resource
interface SuccessResponse<T> {
  data: T
}

// Success — collection
interface ListResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

// Error
interface ErrorResponse {
  error: string                          // Human-readable; safe to display in UI
  code: string                           // Machine-readable constant; matches ERROR_CODES
  fields?: Record<string, string>        // Field-level messages; only present for VALIDATION_ERROR
}
```

**JSON examples:**

```json
// Single resource
{ "data": { "id": "a1b2c3d4-...", "name": "Sweet Auburn BBQ", "status": "published" } }

// Collection
{
  "data": [{ "id": "a1b2c3d4-..." }, { "id": "b2c3d4e5-..." }],
  "meta": { "total": 142, "page": 2, "limit": 20 }
}

// Validation error
{
  "error": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "fields": {
    "name": "Business name is required.",
    "cta_url": "Must be a valid URL."
  }
}

// Permission error
{ "error": "You must be signed in to do that.", "code": "UNAUTHORIZED" }

// Not found
{ "error": "Not found.", "code": "NOT_FOUND" }

// Server error
{ "error": "Something went wrong. Please try again.", "code": "INTERNAL_ERROR" }
```

**Envelope rules:**
- `data` is always present on success; never present on error.
- `error` and `code` are always present on error; never present on success.
- `fields` is only included on `VALIDATION_ERROR` responses. It is not included on any other error type.
- Never return HTTP `200` for an error condition.
- Never return HTTP `500` for a validation failure.
- Never return a different shape for the same endpoint under different conditions. Shape is determined by success vs. error, not by the specific data returned.

### Server Action Return Type

Server Actions do not use HTTP envelopes. They return `ActionResult<T>` directly.

```typescript
// lib/errors/types.ts

export type ActionSuccess<T> = {
  data: T
}

export type ActionError = {
  error: string                          // Human-readable; safe to show in toast or inline message
  code: string                           // Machine-readable; matches ERROR_CODES
  fields?: Record<string, string>        // Field-level messages for form validation display
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

// Type guard — use in Client Components to branch on result type
export function isActionError(result: ActionResult<unknown>): result is ActionError {
  return 'error' in result
}
```

**Caller pattern:**

```typescript
const result = await createClaim(input)

if (isActionError(result)) {
  if (result.code === ERROR_CODES.VALIDATION_ERROR && result.fields) {
    for (const [field, message] of Object.entries(result.fields)) {
      form.setError(field as keyof FormValues, { message })
    }
  } else {
    toast.error(result.error)
  }
  return
}

// Success — result.data is available here
toast.success('Claim submitted.')
router.push(`/account/claims/${result.data.claim_id}`)
```

**Server Action rules:**
- Never `throw` from a Server Action. All error paths return `{ error, code }`.
- Throwing causes Next.js to render the nearest error boundary, which strips field-level errors and prevents graceful recovery.
- Never return different `data` shapes on success. Define a concrete return type per action.

---

## 2. HTTP Status Code Reference

| Code | Name | When to use |
|---|---|---|
| `200` | OK | Successful GET, PUT, or PATCH |
| `201` | Created | Successful POST that creates a new resource |
| `204` | No Content | Successful DELETE — no response body |
| `400` | Bad Request | Invalid input, malformed request body, unsupported filter or sort parameter, property exceeds size limit |
| `401` | Unauthorized | Missing or expired session token — the request carries no valid identity |
| `403` | Forbidden | Authenticated but not authorized — valid session, wrong role or ownership |
| `404` | Not Found | Resource does not exist, was soft-deleted, or the requester must not know it exists |
| `409` | Conflict | State conflict — duplicate resource creation, invalid status transition attempted from the wrong current state |
| `422` | Unprocessable Entity | Valid format but failed business rule — e.g., attempting to submit a listing that lacks required fields, submitting a claim for a listing already owned |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected failure in the service layer or database — never return for validation failures |

**404 vs. 403 decision rule:**

Return `404` (not `403`) when confirming that a resource exists would itself leak information the requester should not have. The test: if the requester should not be able to distinguish "this resource exists and you can't access it" from "this resource doesn't exist," use `404`.

Examples:
- An unauthenticated user requests a draft listing by ID → `404`
- A supporter requests another user's private claim record by ID → `404`
- An owner requests an admin moderation record → `404`
- An owner requests their own listing that has been soft-deleted → `404`
- An admin requests a resource the admin role cannot access → `403` (admin knows the system; resource existence is not sensitive)

---

## 3. Machine-Readable Error Codes

All error codes are defined in `lib/errors/codes.ts`. Every error response must include a `code` from this table. Never invent ad-hoc string codes outside this file.

```typescript
// lib/errors/codes.ts

export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED:               'UNAUTHORIZED',
  FORBIDDEN:                  'FORBIDDEN',
  SESSION_EXPIRED:            'SESSION_EXPIRED',

  // Validation
  VALIDATION_ERROR:           'VALIDATION_ERROR',
  INVALID_INPUT:              'INVALID_INPUT',
  UNSUPPORTED_FILTER:         'UNSUPPORTED_FILTER',

  // Resources
  NOT_FOUND:                  'NOT_FOUND',
  ALREADY_EXISTS:             'ALREADY_EXISTS',
  CONFLICT:                   'CONFLICT',
  INVALID_STATUS_TRANSITION:  'INVALID_STATUS_TRANSITION',

  // Business rules — Claims
  CLAIM_ALREADY_OPEN:         'CLAIM_ALREADY_OPEN',
  LISTING_ALREADY_CLAIMED:    'LISTING_ALREADY_CLAIMED',

  // Business rules — Reviews
  REVIEW_ALREADY_EXISTS:      'REVIEW_ALREADY_EXISTS',
  RESPONSE_ALREADY_EXISTS:    'RESPONSE_ALREADY_EXISTS',
  LISTING_NOT_PUBLISHED:      'LISTING_NOT_PUBLISHED',
  OWNER_REQUIRED:             'OWNER_REQUIRED',

  // Business rules — Account
  ROLE_ALREADY_SET:           'ROLE_ALREADY_SET',

  // Rate limiting
  RATE_LIMIT_EXCEEDED:        'RATE_LIMIT_EXCEEDED',

  // File uploads
  FILE_TOO_LARGE:             'FILE_TOO_LARGE',
  INVALID_FILE_TYPE:          'INVALID_FILE_TYPE',
  UPLOAD_FAILED:              'UPLOAD_FAILED',

  // Idempotency
  IDEMPOTENCY_KEY_REQUIRED:   'IDEMPOTENCY_KEY_REQUIRED',
  DUPLICATE_SUBMISSION:       'DUPLICATE_SUBMISSION',

  // Marketplace / Payments
  STRIPE_CONNECT_REQUIRED:    'STRIPE_CONNECT_REQUIRED',

  // Server
  INTERNAL_ERROR:             'INTERNAL_ERROR',

} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
```

### Full Error Code Reference

**Auth errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | No valid session present | `supabase.auth.getUser()` returns no user or returns an error |
| `FORBIDDEN` | 403 | Authenticated but not authorized | Valid session; role or ownership check failed; resource existence is not sensitive |
| `SESSION_EXPIRED` | 401 | Session token has expired | Auth server returns an expired token error; client should redirect to `/login` |

**Validation errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | One or more fields failed validation | Zod `safeParse` returns `success: false`; always includes `fields` object |
| `INVALID_INPUT` | 400 | Malformed request body or missing required structure | Request body is not valid JSON, `Content-Type` is wrong, or required top-level field is absent with no field-level context to return |
| `UNSUPPORTED_FILTER` | 400 | Query parameter filter or sort field not supported | A query param key is not in the documented allowed set for a list endpoint |

**Resource errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `NOT_FOUND` | 404 | Resource does not exist or requester must not know it exists | Row not found; soft-deleted row; ownership failure where existence must not be disclosed |
| `ALREADY_EXISTS` | 409 | Unique constraint violation | Duplicate listing name + city combination; duplicate category slug |
| `CONFLICT` | 409 | General state conflict not covered by a domain-specific code | Concurrent edit conflict; ambiguous state collision |
| `INVALID_STATUS_TRANSITION` | 422 | Attempted status change is not allowed from the current state | Submitting a listing not in `'draft'`; approving a claim not in `'pending'`; publishing a listing in `'rejected'` |

**Business rule errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `CLAIM_ALREADY_OPEN` | 409 | User already has a `'pending'` or `'under_review'` claim for this listing | `createClaim` called when an open claim already exists; response body includes the existing `claim_id` |
| `LISTING_ALREADY_CLAIMED` | 409 | Listing already has an approved owner | `createClaim` called on a listing with `trust_tier` of `'claimed'`, `'verified'`, or `'certified'` |
| `REVIEW_ALREADY_EXISTS` | 409 | User has already submitted a review for this listing | `createReview` blocked by `UNIQUE (reviewer_user_id, listing_id)` |
| `RESPONSE_ALREADY_EXISTS` | 409 | Owner has already responded to this review | `respondToReview` called on a review that already has an owner response |
| `LISTING_NOT_PUBLISHED` | 422 | Attempted action requires a published listing | Creating a review for a listing that is not `'published'` |
| `OWNER_REQUIRED` | 403 | Action requires ownership of the specific listing | Dashboard action called by an authenticated user who does not have `role = 'owner'` for the given `listing_id` |
| `ROLE_ALREADY_SET` | 409 | Onboarding role has already been assigned | `setOnboardingRole` called when the user already has a `'supporter'` or `'owner'` role in `user_roles` |

**Rate limiting:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in the configured window | Any endpoint whose per-window limit has been reached; see Section 7 |

**File upload errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `FILE_TOO_LARGE` | 400 | File exceeds the size limit for the target bucket | Checked before the Supabase Storage write; see Section 8 |
| `INVALID_FILE_TYPE` | 400 | MIME type is not in the allowed set for the target bucket | Checked from actual file bytes, not the `Content-Type` header; see Section 8 |
| `UPLOAD_FAILED` | 500 | Supabase Storage write failed unexpectedly | Storage client returns an error after passing all validation checks |

**Idempotency:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | `client_idempotency_key` field is missing | `createReceiptSubmission` or `createSpendLog` called without a client-provided idempotency key |
| `DUPLICATE_SUBMISSION` | 200 | Idempotency key already processed | Key found in existing row; original result returned — not an error from the client's perspective |

**Server errors:**

| Code | HTTP status | Description | When to return |
|---|---|---|---|
| `INTERNAL_ERROR` | 500 | Unexpected failure in service layer or database | Catch-all for unhandled errors; safe generic message returned to client; full error logged server-side |

---

## 4. Validation Error Format

Validation errors always include a `fields` object keyed by the exact field name from the request body.

```json
{
  "error": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "fields": {
    "name": "Business name is required.",
    "city_id": "Must be a valid city ID.",
    "cta_url": "Must be a valid URL."
  }
}
```

**Field naming rules:**
- Keys in `fields` match the exact request body field name — the same name the client sent, matching the database column convention (snake_case).
- Nested fields use dot notation: `"hours.monday.open": "Open time is required."`
- Only include fields that have errors. Do not include valid fields.
- Return all field errors in a single response. Do not return one error at a time.

**Implementation:**

```typescript
// lib/errors/format.ts

import { ZodError } from 'zod'

export function formatZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !fields[path]) {
      // Only store the first error per field path
      fields[path] = issue.message
    }
  }
  return fields
}
```

**Server Action — validation return:**

```typescript
const parsed = schema.safeParse(input)
if (!parsed.success) {
  return {
    error: 'Validation failed.',
    code: ERROR_CODES.VALIDATION_ERROR,
    fields: formatZodErrors(parsed.error),
  }
}
```

**Route Handler — validation return:**

```typescript
const parsed = schema.safeParse(body)
if (!parsed.success) {
  return Response.json(
    {
      error: 'Validation failed.',
      code: ERROR_CODES.VALIDATION_ERROR,
      fields: formatZodErrors(parsed.error),
    },
    { status: 400 }
  )
}
```

**Client Component — applying field errors from a Server Action:**

```typescript
if (isActionError(result) && result.code === ERROR_CODES.VALIDATION_ERROR && result.fields) {
  for (const [field, message] of Object.entries(result.fields)) {
    form.setError(field as keyof FormValues, { message })
  }
  return
}
```

---

## 5. Permission Error Format

### Case A — Not authenticated (401)

Returned when `supabase.auth.getUser()` returns no user or an auth error. The session check always runs first, before any permission check.

```json
{ "error": "You must be signed in to do that.", "code": "UNAUTHORIZED" }
```

**Server Action:**
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return { error: 'You must be signed in to do that.', code: ERROR_CODES.UNAUTHORIZED }
}
```

**Route Handler:**
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return Response.json(
    { error: 'You must be signed in to do that.', code: ERROR_CODES.UNAUTHORIZED },
    { status: 401 }
  )
}
```

### Case B — Authenticated but not authorized (403)

Returned when a valid session exists but the user's role does not permit the operation. Use `403` only when the resource's existence is not sensitive.

```json
{ "error": "You don't have permission to do that.", "code": "FORBIDDEN" }
```

### Case C — Ownership failure where existence must not be disclosed (404)

Returned when a user requests a resource they do not own and confirming the resource exists would leak information.

```json
{ "error": "Not found.", "code": "NOT_FOUND" }
```

**Pattern used in owner-scoped Server Actions:**

```typescript
// Step 3 — Permission check
const { data: listing } = await supabase
  .from('listings')
  .select('id, owner_user_id')
  .eq('id', parsed.data.listing_id)
  .eq('owner_user_id', user.id)
  .is('deleted_at', null)
  .single()

if (!listing) {
  // Return NOT_FOUND — do not confirm whether the listing exists at all
  return { error: 'Listing not found.', code: ERROR_CODES.NOT_FOUND }
}
```

**Permission error rules:**
- Always check session (`UNAUTHORIZED`) before checking role or ownership (`FORBIDDEN` / `NOT_FOUND`). Never reverse this order.
- Never expose role names, permission logic, or ownership structure in error messages. "You are not an admin" is unacceptable — use "You don't have permission to do that."
- Never surface whether a resource exists to a requester who has no right to know.
- Use `supabase.auth.getUser()` — not `getSession()` — for all server-side auth checks. `getUser()` re-validates with the Supabase auth server on every call; `getSession()` reads from the cookie only and does not re-validate.

---

## 6. Not Found Error Format

```json
{ "error": "Not found.", "code": "NOT_FOUND" }
```

**Decision matrix:**

| Condition | Response |
|---|---|
| Resource never existed | `404 NOT_FOUND` |
| Resource existed but was soft-deleted (`deleted_at IS NOT NULL`) | `404 NOT_FOUND` — treat as not found from the client's perspective |
| Resource exists but requester is not authorized and existence is sensitive | `404 NOT_FOUND` — do not confirm existence |
| Resource exists but requester is not authorized and existence is not sensitive | `403 FORBIDDEN` |
| Resource exists but the HTTP method used is not supported | `405 Method Not Allowed` — Next.js route handlers return this automatically for unimplemented methods |
| Resource exists but is in the wrong state for the action | `422 INVALID_STATUS_TRANSITION` or `409 CONFLICT` as appropriate |

**Soft-delete rule:** Every query that returns a listing, claim, review, or correction to a non-admin user must include `AND deleted_at IS NULL` as an unconditional filter. Never return a soft-deleted row as if it exists.

---

## 7. Rate Limiting

### Per-Endpoint Rate Limit Table

| Endpoint | Anonymous limit | Authenticated limit | Window | Enforcement |
|---|---|---|---|---|
| `GET /api/search` | 60 req/min | 120 req/min | 1 min rolling | IP hash in middleware (MVP); Upstash Redis (V1) |
| `POST /api/analytics/event` | 300 events/min | 300 events/min | 1 min per `session_id` | Service layer check on `session_id` header |
| `createClaim` (Server Action) | n/a | 3 claims/day | 24 hr rolling | Service layer query: `SELECT COUNT(*) FROM claims WHERE user_id = $1 AND created_at > now() - interval '24 hours'` |
| `createReview` (Server Action) | n/a | 1 per listing per user | Lifetime | `UNIQUE (reviewer_user_id, listing_id)` constraint on `reviews` table → `409` |
| `POST /api/upload` | n/a | 10 uploads/hr (free tier); 50 uploads/hr (standard+) | 1 hr rolling | Service layer + listing tier check |
| `POST /api/listings/duplicate-check` | n/a | 60 req/min | 1 min rolling | IP hash in middleware (MVP) |
| Auth endpoints (Supabase-managed) | Supabase built-in limits | Supabase built-in limits | — | Enforced by Supabase Auth; not configurable |

### Rate Limit Response

```json
{
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

HTTP status `429` with headers:

```
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1746633600
```

- `Retry-After`: seconds until the rate limit window resets
- `X-RateLimit-Reset`: Unix timestamp (UTC) of when the window resets
- These headers must be included on every `429` response

### MVP vs. V1 Enforcement

At MVP, rate limiting on Route Handlers is enforced via IP hash in Next.js middleware using the edge runtime with an in-memory or Vercel Edge Config store. This is sufficient for launch traffic.

In V1, migrate Route Handler rate limiting to Upstash Redis using the `@upstash/ratelimit` package for durable, distributed enforcement that survives deployment restarts and multi-region scale. The migration is additive — middleware logic swaps the backing store, not the response contract.

Service layer rate limits (claim frequency, upload quotas) are enforced by database queries in the service module and do not change between MVP and V1.

---

## 8. File Upload Validation Rules

All validation in this section runs server-side at `POST /api/upload` before any Supabase Storage write. Client-side validation is UX only and is not trusted.

### Per-Bucket Rules

| Bucket | Allowed MIME types | Max file size | Max dimensions | Storage path pattern | Access |
|---|---|---|---|---|---|
| `listing-media` (logo) | `image/jpeg`, `image/png`, `image/webp` | 2 MB | 400×400 px | `listings/[listing_id]/logo/[uuid].[ext]` | Public |
| `listing-media` (cover) | `image/jpeg`, `image/png`, `image/webp` | 5 MB | 1200×675 px | `listings/[listing_id]/cover/[uuid].[ext]` | Public |
| `listing-media` (gallery) | `image/jpeg`, `image/png`, `image/webp` | 3 MB | Free (long edge max 2400 px) | `listings/[listing_id]/gallery/[uuid].[ext]` | Public |
| `verification-docs` | `image/jpeg`, `image/png`, `application/pdf` | 10 MB | — | `claims/[claim_id]/[uuid].[ext]` | Private — admin signed URL only |
| `receipts` | `image/jpeg`, `image/png`, `image/webp` | 10 MB | — | `receipts/[user_id]/[uuid].[ext]` | Private — owner signed URL only |

### Validation Sequence

Run these checks in order before writing to storage. Return on the first failure — do not run subsequent checks.

1. **Auth check** — `supabase.auth.getUser()` must return a valid user. Return `401 UNAUTHORIZED` if no session.
2. **Bucket permission check** — confirm the authenticated user is authorized to write to the requested bucket (see ownership rules below).
3. **File presence check** — confirm a file was provided and `file.size > 0`. Return `400 INVALID_INPUT` if absent.
4. **File size check** — compare `file.size` against the bucket's max. Return `400 FILE_TOO_LARGE` if exceeded.
5. **MIME type check** — read MIME type from the actual file bytes using the `file-type` library. Do not trust the `Content-Type` header or the `file.type` property from the client. Return `400 INVALID_FILE_TYPE` if not in the allowed set.
6. **Dimension check** (logo and cover only) — read image dimensions using `sharp` or equivalent. Return `400 VALIDATION_ERROR` with a field error if dimensions exceed the maximum.
7. **Filename generation** — generate a server-side UUID filename. Never use the original filename from the client (path traversal risk). Format: `[uuid].[ext]` where `ext` is derived from the confirmed MIME type, not the original filename.
8. **Storage write** — call `supabase.storage.from(bucket).upload(path, file, { upsert: false })`. If the storage client returns an error, log it server-side and return `500 UPLOAD_FAILED`.

### Ownership Rules per Bucket

| Bucket | Permission check |
|---|---|
| `listing-media` | `listings.owner_user_id = auth.uid()` where `listings.id = entity_id`; return `403` if check fails |
| `verification-docs` | Only writable from other server-side actions via the service role client; this endpoint returns `403` for any direct authenticated request to this bucket |
| `receipts` | `entity_id` (the `user_id` segment) must equal `auth.uid()`; return `403` if check fails |

### Storage URL Generation

Never persist CDN URLs in the database. Store the storage path and generate URLs at read time.

```typescript
// Public bucket (listing-media)
const { data } = supabase
  .storage
  .from('listing-media')
  .getPublicUrl(path)
// data.publicUrl is the CDN URL — use only at read time; never store

// Private bucket — owner access (receipts)
// Verify user_id prefix matches auth.uid() before generating
const { data, error } = await supabaseAdmin
  .storage
  .from('receipts')
  .createSignedUrl(path, 900)   // 15-minute expiry
// data.signedUrl is returned to the authenticated owner; never stored

// Private bucket — admin access (verification-docs)
const { data, error } = await supabaseAdmin
  .storage
  .from('verification-docs')
  .createSignedUrl(path, 3600)  // 1-hour expiry for admin review
// Called only from getVerificationDocUrl Server Action; supabaseAdmin is the service role client
```

---

## 9. Idempotency Rules

Different operations require different idempotency strategies. Use the correct type for each operation. Never add idempotency complexity to operations that do not require it.

### Type A — `ON CONFLICT DO NOTHING` (saves, lightweight toggles)

For operations where repeated execution is safe and the result is always the same.

```typescript
// POST /api/saves — save a listing
// Returns 201 whether the row was inserted or already existed
const { error } = await supabase
  .from('saves')
  .insert({ user_id: user.id, listing_id: parsed.data.listing_id })
  .throwOnError()
// Supabase's PostgREST client handles ON CONFLICT DO NOTHING via RLS + unique constraint
// At the SQL layer: INSERT INTO saves (user_id, listing_id) VALUES ($1, $2) ON CONFLICT (user_id, listing_id) DO NOTHING
```

Response: HTTP `201 Created` in both cases. The client does not need to distinguish insert from no-op.

### Type B — Idempotent deletes

Deletes must not return `404` if the row does not exist. The desired end state (row absent) is already satisfied.

```typescript
// DELETE /api/saves — unsave a listing
// Returns 204 whether the row existed or not
const { error } = await supabase
  .from('saves')
  .delete()
  .eq('user_id', user.id)
  .eq('listing_id', parsed.data.listing_id)
// If no rows are deleted, Supabase does not return an error — 204 is returned regardless
```

Response: HTTP `204 No Content` unconditionally. Never return `404` on a delete of an already-absent row.

### Type C — Client idempotency key (receipt submissions, spend logs)

For V2 operations where the client may retry on network failure and the server must not process the same request twice.

**Client responsibility:**
1. Generate a UUID before the first attempt: `const key = crypto.randomUUID()`
2. Store the key for the duration of the request lifecycle (component state or localStorage)
3. Send the same key on every retry attempt

**Server implementation:**

```typescript
// createReceiptSubmission — lib/actions/spend/createReceiptSubmission.ts

// Step 2 — Validate input (includes client_idempotency_key)
const parsed = schema.safeParse(input)
// schema requires client_idempotency_key: z.string().uuid()
// If missing: return { error: '...', code: ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED }

// Step 4 — Insert with conflict handling
const { data: inserted } = await supabase
  .from('receipt_uploads')
  .insert({
    ...parsed.data,
    user_id: user.id,
    client_idempotency_key: parsed.data.client_idempotency_key,
  })
  .select('id, created_at, status')

// If the INSERT returned no row (ON CONFLICT DO NOTHING suppressed it):
if (!inserted) {
  const { data: existing } = await supabase
    .from('receipt_uploads')
    .select('id, created_at, status')
    .eq('client_idempotency_key', parsed.data.client_idempotency_key)
    .eq('user_id', user.id)
    .single()

  // Return the original result — caller cannot tell this was a duplicate
  return { data: existing }
}

return { data: inserted }
```

The `receipt_uploads` and `spend_logs` tables have a `UNIQUE (client_idempotency_key)` constraint. The `ON CONFLICT DO NOTHING` strategy prevents duplicate rows. The server always returns the successful result, whether from the original insert or the lookup on conflict.

### Type D — Hard block via UNIQUE constraint (reviews)

Reviews intentionally prevent duplicates rather than silently deduplicating them. The caller receives an explicit `409` to surface to the user.

```typescript
// createReview — on DB constraint violation
// Supabase returns error code '23505' (PostgreSQL unique_violation)

if (dbError?.code === '23505') {
  return {
    error: 'You have already reviewed this listing.',
    code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
  }
}
```

The `reviews` table has `UNIQUE (reviewer_user_id, listing_id)`. This is a business rule enforcement, not transparent idempotency. The client uses this `409` to redirect the user to their existing review.

### Type E — Open claim check (claims)

Before inserting a new claim, the service layer checks for an existing open claim and returns the existing record's ID so the client can redirect rather than create a duplicate.

```typescript
// createClaim — lib/actions/claims/createClaim.ts — Step 3 (before INSERT)

const { data: existingClaim } = await supabase
  .from('claims')
  .select('id')
  .eq('user_id', user.id)
  .eq('listing_id', parsed.data.listing_id)
  .in('status', ['pending', 'under_review'])
  .maybeSingle()

if (existingClaim) {
  return {
    error: 'You already have an open claim for this listing.',
    code: ERROR_CODES.CLAIM_ALREADY_OPEN,
    // Include existing claim ID so client can redirect
    fields: { claim_id: existingClaim.id },
  }
}
```

The `fields` object is used here to pass the existing `claim_id` to the client for the redirect URL. This is the only case where `fields` carries non-validation data.

### Type F — Fire-and-forget analytics (no idempotency enforced)

Analytics events are write-only and never deduplicated at write time. Duplicate events from page refreshes or network retries are expected and filtered at aggregation time.

```typescript
// POST /api/analytics/event — always INSERT, no conflict handling
// Duplicate events are expected — they are filtered in analytics queries, not prevented here
const { error } = await supabase
  .from('analytics_events')
  .insert({ event_name, session_id, listing_id, user_id, properties, ip_hash })
// If this fails, log and return 200 anyway — analytics must never break UX
```

Never add `ON CONFLICT` handling to analytics event writes. Over-deduplication at write time causes undercounting.

---

## 10. Analytics Event Emission Standard

### Event Naming Convention

- Format: `[entity]_[past_tense_verb]` or `[action_context]_[past_tense_verb]`
- Use snake_case exclusively
- Always include context — no generic names like `click` or `event`

**Examples:** `listing_viewed`, `search_performed`, `cta_clicked`, `claim_submitted`, `review_submitted`, `save_added`, `save_removed`, `listing_shared`

### Required Properties on Every Event

```typescript
interface AnalyticsEventBase {
  event_name: string          // From the defined event enum — see api-contract-a.md Section 3
  session_id: string          // Client-generated UUID; persisted in sessionStorage for the browser session
  listing_id?: string         // UUID; required when the event is scoped to a specific listing
  city_slug?: string          // Required when the event is scoped to a city
  category_slug?: string      // Required when the event is scoped to a category
  referrer?: string           // `document.referrer` — the URL the user navigated from
  user_agent?: string         // `navigator.userAgent` truncated to 256 characters
  // user_id is set server-side from auth.uid() — never sent from the client
  // ip_address is hashed SHA-256 server-side — never sent from the client; never stored raw
}
```

### Client vs. Server Emission

| Event | Where emitted | Rationale |
|---|---|---|
| `listing_viewed` | Server (RSC page load) | Most reliable — fires on every server render, including bot and direct URL visits |
| `search_performed` | Client (after search results render) | Captures query string and result count from the rendered response |
| `cta_clicked` | Client (`onClick` handler) | User-initiated click action; cannot be server-triggered |
| `save_added` | Client (after SA completes) | User action; emit only on confirmed success, not on optimistic update |
| `save_removed` | Client (after Route Handler completes) | User action |
| `listing_shared` | Client (after share API or copy action) | User action |
| `claim_submitted` | Server (inside SA after successful DB write) | Transactional — must not be skipped or duplicated |
| `review_submitted` | Server (inside SA after successful DB write) | Transactional |
| `listing_created` | Server (inside SA after successful DB write) | Transactional |
| `listing_submitted_for_review` | Server (inside SA after successful DB write) | Transactional |
| `listing_approved` | Server (inside SA after successful DB write) | Admin action |
| `listing_rejected` | Server (inside SA after successful DB write) | Admin action |
| `claim_approved` | Server (inside SA after successful DB write) | Admin action |
| `claim_rejected` | Server (inside SA after successful DB write) | Admin action |

### Client Emission Pattern

Never await analytics on the client. Fire and forget. Swallow all errors silently — analytics must never interrupt or break the user flow.

```typescript
// hooks/useAnalytics.ts

export function useAnalytics() {
  const sessionId = useSessionId()   // from sessionStorage; generated once per browser session

  function track(
    eventName: string,
    properties?: Record<string, unknown>
  ) {
    // Fire-and-forget — do not await
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        session_id: sessionId,
        referrer: document.referrer || undefined,
        user_agent: navigator.userAgent.slice(0, 256),
        ...properties,
      }),
    }).catch(() => {
      // Silently swallow — analytics failures must not affect UX
    })
  }

  return { track }
}
```

### Server Emission Pattern (Inside Server Actions)

Enqueue after the primary DB write succeeds. Do not await — analytics must not slow down the Server Action's response to the client.

```typescript
// Inside a Server Action — Step 5 (side effects)

// Primary DB write succeeded — Step 4 is complete
// Enqueue analytics non-blocking, after response
Promise.resolve().then(() => {
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 'claim_submitted',
      session_id: input.session_id ?? '',
      listing_id: parsed.data.listing_id,
    }),
  }).catch((err) => {
    console.error('[analytics] Failed to emit claim_submitted:', err)
  })
})
```

### MVP Event Inventory

The following 15 events are required at MVP. All other events are deferred.

| Event name | Emitted from | Required properties |
|---|---|---|
| `listing_viewed` | Server (RSC) | `listing_id`, `entity_type`, `trust_tier` |
| `search_performed` | Client | `query`, `filters`, `result_count` |
| `cta_clicked` | Client | `listing_id`, `cta_type` |
| `save_added` | Client | `listing_id`, `entity_type` |
| `save_removed` | Client | `listing_id` |
| `listing_shared` | Client | `listing_id`, `share_method` |
| `claim_submitted` | Server | `listing_id` |
| `review_submitted` | Server | `listing_id` |
| `correction_submitted` | Server | `listing_id` |
| `listing_created` | Server | `listing_id`, `entity_type`, `city_id` |
| `listing_submitted_for_review` | Server | `listing_id`, `entity_type` |
| `listing_approved` | Server | `listing_id` |
| `listing_rejected` | Server | `listing_id` |
| `claim_approved` | Server | `listing_id`, `claim_id` |
| `claim_rejected` | Server | `listing_id`, `claim_id` |

V1 will add editorial and collection interaction events. V2 will add `receipt_submitted`, `spend_logged`, `product_viewed`, and `storefront_viewed`.

---

## 11. Background Operation Errors

Background operations — email sends, ISR revalidation, Stripe webhook processing, Supabase connection failures — have failure modes distinct from synchronous request/response errors. Each category has explicit handling rules.

### Email Send Failures (Resend)

Email sends are non-blocking side effects. They run after the primary DB write and must never fail the Server Action.

**Placement:** Step 5 of the seven-step pattern (side effects), after the DB write succeeds and before cache revalidation.

**Pattern:**

```typescript
// Step 5 — Email notification (non-blocking)
// Do not await directly in the critical path
await sendNotificationEmail(
  ClaimReceivedTemplate,
  process.env.ADMIN_NOTIFICATION_EMAIL!,
  { claimId: data.id, listingName: listing.name }
)
// sendNotificationEmail internally catches and logs all Resend errors — it never throws
```

The `sendNotificationEmail` helper (`lib/email/resend.ts`) wraps all Resend calls in a `try/catch`. On failure:
- Log to server console with prefix `[EMAIL_ERROR]`, operation name, and recipient role
- Never log the recipient's email address in console output
- At MVP: log and continue — no retry
- At V1: push the failed send to a `email_send_failures` dead-letter table with `template_name`, `recipient_role`, `sanitized_payload_json`, `error_message`, and `created_at` for admin visibility and manual retry

The hook point for V1 retry is the single `catch` block in `sendNotificationEmail`. No changes to calling Server Actions are required.

```typescript
// lib/email/resend.ts — catch block (current MVP)
} catch (error) {
  console.error('[EMAIL_ERROR] operation=sendNotificationEmail template=' + template.name + ' recipient_role=' + recipientRole, error)
  // V1: await insertEmailFailure({ templateName: template.name, recipientRole, payload, error })
}
```

### ISR Revalidation Failures

`revalidatePath` and `revalidateTag` are synchronous in Next.js App Router and do not throw exceptions. If revalidation does not trigger as expected, the cause is configuration, not a thrown error.

**Common causes and resolutions:**

| Symptom | Likely cause | Resolution |
|---|---|---|
| Page not updated after mutation | `NEXT_PRIVATE_REVALIDATE_TOKEN` env var missing in production | Confirm the variable is set in the deployment environment |
| Revalidation fires but page still stale | Deployment rollback left stale ISR cache | Expected — cache expires at TTL; no action required |
| `revalidatePath` called but nothing happens in development | ISR not active in development mode | Expected — ISR is production-only; test with `next build && next start` |

**Do not wrap `revalidatePath` in `try/catch`** — it does not throw and wrapping it obscures the call stack for no benefit.

```typescript
// Correct — log the triggering action, not revalidatePath itself
console.info('[approveEntity] Revalidating listing page:', listingSlug)
revalidatePath(`/${citySlug}/business/${listingSlug}`)
revalidateTag(`city-${citySlug}`)
```

If a deployment is rolled back, stale ISR cache may persist until the TTL expires for each route. This is expected behavior and does not require intervention. See `server-actions-plan.md` Section 5 for TTL values by route type.

### Stripe Webhook Failures (V1)

Stripe webhook handling applies from V1 onward when subscription billing is introduced.

**Thirty-second rule:** The webhook handler must return HTTP `200` to Stripe within 30 seconds. Any processing that may take longer must be queued asynchronously — not run inline in the handler.

**Signature verification failure:**

```typescript
// app/api/webhooks/stripe/route.ts

const sig = request.headers.get('stripe-signature')
let event: Stripe.Event

try {
  const body = await request.text()
  event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
} catch (err) {
  // Invalid signature — return 400 immediately; do not process
  return Response.json(
    { error: 'Webhook signature verification failed.', code: ERROR_CODES.UNAUTHORIZED },
    { status: 400 }
  )
}
```

**Processing failure after returning 200:**

Stripe retries webhooks for up to 48 hours on non-`2xx` responses. If the handler returns `200` but the business logic fails after:

1. Log the failure to a `failed_webhooks` table with `stripe_event_id`, `event_type`, `payload_json`, `error_message`, and `created_at`
2. Use the `stripe_event_id` as an idempotency key on all writes triggered by the webhook — re-processing on retry must not create duplicates
3. Alert on-call if `failed_webhooks` has unresolved rows older than 2 hours

```typescript
// Idempotency key pattern for webhook processing
const { data: existing } = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .maybeSingle()

if (existing) {
  // Already processed — return 200 immediately
  return Response.json({ received: true })
}

// Process the event
// ...

// Mark as processed
await supabase
  .from('processed_webhook_events')
  .insert({ stripe_event_id: event.id, event_type: event.type })
```

### Supabase Connection Failures

Every Supabase client call in the service layer must be wrapped in error handling. Never let an unhandled Supabase error propagate to the route or action boundary as an unhandled exception.

**Server Action pattern:**

```typescript
let data: ListingRow | null = null
let dbError: PostgrestError | null = null

try {
  const result = await supabase
    .from('listings')
    .update({ ...fields, updated_by: user.id })
    .eq('id', listingId)
    .select()
    .single()

  data = result.data
  dbError = result.error
} catch (err) {
  console.error('[updateListingContent] Unexpected Supabase error:', {
    operation: 'updateListingContent',
    userId: user.id,
    listingId,
    err,
  })
  return { error: 'Something went wrong. Please try again.', code: ERROR_CODES.INTERNAL_ERROR }
}

if (dbError || !data) {
  console.error('[updateListingContent] DB error:', {
    operation: 'updateListingContent',
    userId: user.id,
    listingId,
    code: dbError?.code,
  })
  return { error: 'Failed to update listing. Please try again.', code: ERROR_CODES.INTERNAL_ERROR }
}
```

**Route Handler pattern:**

```typescript
try {
  const { data, error } = await supabase
    .from('listings')
    .select('...')
    .eq('id', listingId)
    .single()

  if (error || !data) {
    console.error('[GET /api/listings/[id]] DB error:', { listingId, code: error?.code })
    return Response.json(
      { error: 'Something went wrong. Please try again.', code: ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    )
  }

  return Response.json({ data })
} catch (err) {
  console.error('[GET /api/listings/[id]] Unexpected error:', { listingId, err })
  return Response.json(
    { error: 'Something went wrong. Please try again.', code: ERROR_CODES.INTERNAL_ERROR },
    { status: 500 }
  )
}
```

**Server-side logging format for DB errors:**

```
[DB_ERROR] operation=<functionName> code=<supabase_error_code>
```

- Never log query parameters or field values — they may contain PII
- Never log raw SQL
- `supabase_error_code` is the PostgreSQL error code (e.g., `23505`, `42P01`) — safe to log
- Log `userId` (UUID only) for authenticated operations; log `null` for anonymous operations
