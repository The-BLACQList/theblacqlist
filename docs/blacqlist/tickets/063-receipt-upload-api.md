# Ticket 063: Receipt upload API — POST to receipts bucket, signed URL generation

## Status

Draft

## Phase

Phase 11: Receipt Upload and Community Spend Beta

## Priority

P2

## Estimate

M (2–4h)

## Feature Area

Spend / Receipts

---

## Context

The community spend feature allows supporters to upload receipts from Black-owned businesses, which are later reviewed by admins and aggregated into spend analytics. This ticket implements the two server-side primitives that the receipt upload UI (Ticket 064) and admin review queue (Ticket 065) depend on:

1. `POST /api/receipts/upload` — a Route Handler that receives a multipart file upload, validates the file, stores it in the private `receipts` Supabase Storage bucket, and inserts a row in `receipt_uploads` with all submitted metadata. The `client_idempotency_key` field prevents duplicate submissions if the user retries a failed upload — implemented via `INSERT ... ON CONFLICT (client_idempotency_key) DO NOTHING`.

2. `GET /api/receipts/[id]/signed-url` — a Route Handler that generates a 15-minute signed URL for a specific `receipt_uploads` row. Auth required; owner-only. The signed URL is generated at request time using the service role key and is never stored.

This extends the core media upload system from Ticket 030 by targeting the `receipts` bucket specifically and adding the `receipt_uploads` table write.

**Flag:** `client_idempotency_key` column must exist on `receipt_uploads` before this ticket can be started — verify the migration from the schema plan is in place.

Sources: `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads; `docs/blacqlist/architecture/api-contract.md` §10 (Receipts); `docs/blacqlist/architecture/server-actions-plan.md` § Spend.

---

## User Story

As an authenticated supporter, I want to upload a receipt image to the platform, so that my community spend at Black-owned businesses is recorded and can be reviewed.

---

## Scope

**In scope:**

- `app/api/receipts/upload/route.ts` — POST Route Handler
  - Accepts `multipart/form-data` with fields: `file` (required), `listing_id` (optional UUID), `amount_cents` (optional integer), `purchase_date` (optional ISO date string), `notes` (optional text), `client_idempotency_key` (required UUID generated client-side)
  - Validates file: MIME type from magic bytes (not `Content-Type` header) — allowed: `image/jpeg`, `image/png`, `image/webp`, `image/heic`; max file size: 10MB
  - Uploads file to Supabase Storage `receipts` bucket at path: `{user_id}/{uuid_filename}.{ext}`
  - Inserts a row in `receipt_uploads` with `status = 'pending_review'` and the `client_idempotency_key`
  - Uses `INSERT ... ON CONFLICT (client_idempotency_key) DO NOTHING RETURNING *` — if a duplicate key exists, returns the existing row (200, not 409)
  - Returns: `{ data: { id: string; status: 'pending_review'; file_path: string } }`
- `app/api/receipts/[id]/signed-url/route.ts` — GET Route Handler
  - Auth required: `authenticated` role, owner-only (`receipt_uploads.user_id = auth.uid()`)
  - Generates a 15-minute signed URL via Supabase Storage service role: `supabase.storage.from('receipts').createSignedUrl(path, 900)`
  - Returns: `{ data: { signed_url: string; expires_at: string } }`
  - Does NOT store the signed URL — generates fresh on every request
- Zod validation schema for the upload form fields: `lib/validations/spend.ts` (create file if it does not exist)
- Error handling per the standard error shape in `docs/blacqlist/architecture/error-handling-standard.md`

**Out of scope:**

- OCR processing of the uploaded image (stub handled in Ticket 064's UI layer)
- Admin review / approve / reject of receipts (Ticket 065)
- Spend event creation from receipts (Ticket 067)
- `createReceiptUpload` Server Action (`lib/actions/spend/createReceiptSubmission.ts`) — that SA is for the form submission flow in Ticket 064; this ticket is the underlying Route Handler
- Signed URL for verification documents (handled in the claims flow — separate bucket)

---

## Dependencies

| Dependency                                                             | Type               | Status                              |
| ---------------------------------------------------------------------- | ------------------ | ----------------------------------- |
| Ticket 002 — Supabase project setup (Storage buckets configured)       | Blocking ticket    | Not started                         |
| Ticket 014 — Auth flows (session management)                           | Blocking ticket    | Not started                         |
| Ticket 030 — Media upload API (core upload pattern to follow)          | Reference ticket   | Not started                         |
| `receipt_uploads` table migration with `client_idempotency_key` column | Database migration | Must exist — verify before starting |
| `receipts` Supabase Storage bucket (private, not public)               | Infrastructure     | Must be configured                  |

---

## UX Notes

- These are server-side API routes — no UI is implemented in this ticket. The UI is built in Ticket 064 and Ticket 065.
- The Route Handlers must return consistent JSON error shapes so the client in Ticket 064 can display specific error messages.

---

## Design Notes

No frontend UI in this ticket. The response shapes below define what Ticket 064's form will receive.

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads
- **Table:** `receipt_uploads`
- **Key fields:**

| Field                    | Type          | Notes                                                                                 |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------- |
| `id`                     | `uuid`        | PK, `gen_random_uuid()`                                                               |
| `user_id`                | `uuid`        | FK → `auth.users(id)` ON DELETE CASCADE; set to `auth.uid()`                          |
| `listing_id`             | `uuid`        | FK → `listings(id)` ON DELETE SET NULL; nullable                                      |
| `file_path`              | `text`        | Supabase Storage path in `receipts` bucket — NOT the URL                              |
| `amount_cents`           | `integer`     | Optional; user-entered or OCR-parsed                                                  |
| `purchase_date`          | `date`        | Optional; user-entered or OCR-parsed                                                  |
| `notes`                  | `text`        | Optional free-text                                                                    |
| `status`                 | `text`        | CHECK IN (`'pending_review'`, `'approved'`, `'rejected'`); default `'pending_review'` |
| `client_idempotency_key` | `uuid`        | UNIQUE constraint; generated client-side; prevents duplicate submissions              |
| `ocr_raw_data`           | `jsonb`       | Nullable; OCR output if processed (V2)                                                |
| `submitted_by`           | `uuid`        | FK → `auth.users(id)` ON DELETE SET NULL; same as `user_id` at submission             |
| `updated_by`             | `uuid`        | FK → `auth.users(id)` ON DELETE SET NULL                                              |
| `source`                 | `text`        | `'web'` or `'mobile'`                                                                 |
| `created_at`             | `timestamptz` | `now()`                                                                               |
| `updated_at`             | `timestamptz` | trigger-updated                                                                       |

- **Operations:**
  - INSERT into `receipt_uploads` with `ON CONFLICT (client_idempotency_key) DO NOTHING RETURNING *`
  - SELECT `receipt_uploads.file_path` WHERE `id = ? AND user_id = auth.uid()` (for signed URL generation)
- **Validation rules:**
  - `client_idempotency_key`: required, must be a valid UUID
  - `file`: required; MIME validated from magic bytes; max 10MB
  - `listing_id`: optional; if provided, must be a valid UUID (not validated against DB — FK constraint handles integrity)
  - `amount_cents`: optional; integer ≥ 1 if provided
  - `purchase_date`: optional; ISO 8601 date string; must not be in the future
- **RLS:** `receipt_uploads` INSERT: `authenticated` users can insert their own rows only (`user_id = auth.uid()`); SELECT: owner-only; admin reads via service role
- **Migration required:** No new migration — `receipt_uploads` table is in scope of earlier migration tickets. Verify `client_idempotency_key` column exists with `UNIQUE` constraint before starting this ticket.

---

## API Notes

### POST /api/receipts/upload

**Type:** Route Handler
**Auth:** `authenticated` (supporter or above)

**Request:** `multipart/form-data`

```typescript
// Form fields
interface ReceiptUploadFields {
  file: File // Required. Receipt image.
  client_idempotency_key: string // Required. UUID generated client-side.
  listing_id?: string // Optional. UUID of the Black-owned business.
  amount_cents?: string // Optional. Integer as string (form data is strings).
  purchase_date?: string // Optional. ISO 8601 date: "2026-05-07"
  notes?: string // Optional. Max 500 chars.
}
```

**Response:**

```typescript
interface ReceiptUploadResponse {
  id: string
  status: 'pending_review'
  file_path: string // Storage path — NOT the signed URL
}
// Envelope: { data: ReceiptUploadResponse }
```

**Errors:**

| Code                | HTTP | When                                                         |
| ------------------- | ---- | ------------------------------------------------------------ |
| `AUTH_REQUIRED`     | 401  | No valid session                                             |
| `VALIDATION_ERROR`  | 400  | File missing, invalid MIME type, size exceeded, invalid UUID |
| `FILE_TOO_LARGE`    | 400  | File exceeds 10MB                                            |
| `INVALID_FILE_TYPE` | 400  | MIME type not in allowed list                                |
| `OPERATION_FAILED`  | 500  | Supabase Storage upload failed or DB insert failed           |

### GET /api/receipts/[id]/signed-url

**Type:** Route Handler
**Auth:** `authenticated`; owner-only

**Response:**

```typescript
interface SignedUrlResponse {
  signed_url: string // 15-minute expiry
  expires_at: string // ISO 8601: "2026-05-07T14:15:00Z"
}
// Envelope: { data: SignedUrlResponse }
```

**Errors:**

| Code               | HTTP | When                                                    |
| ------------------ | ---- | ------------------------------------------------------- |
| `AUTH_REQUIRED`    | 401  | No valid session                                        |
| `NOT_FOUND`        | 404  | Receipt ID not found or does not belong to `auth.uid()` |
| `OPERATION_FAILED` | 500  | Signed URL generation failed                            |

---

## Implementation Notes

**Files to create:**

- `app/api/receipts/upload/route.ts` — POST Route Handler
- `app/api/receipts/[id]/signed-url/route.ts` — GET Route Handler
- `lib/validations/spend.ts` — zod schemas for receipt upload fields

**Files to modify:**

- None — this is a net-new API surface

**Key patterns:**

- Follow the Ticket 030 upload pattern for the core `file → storage → db` flow — do not duplicate MIME validation logic; extract to a shared helper in `lib/storage/validateFile.ts` if it does not already exist
- Never trust the `Content-Type` request header for MIME type — always validate from magic bytes (see Ticket 030 note on `file-type` package versioning: use v16.x for CommonJS, or confirm ESM config before using v19+)
- Storage path format: `receipts/{user_id}/{Date.now()}-{uuid}.{ext}` — include timestamp prefix for natural ordering
- `INSERT ... ON CONFLICT (client_idempotency_key) DO NOTHING RETURNING *`: if `RETURNING *` returns zero rows (conflict), the upload was a duplicate — fetch and return the existing row instead of creating a new one. Return HTTP 200 (not 409) with the existing row data.
- Use `createServiceRoleClient()` for the signed URL generation in `GET /api/receipts/[id]/signed-url` — anon client cannot access the private `receipts` bucket
- Set `receipts` bucket as **private** (not public) in Supabase Storage configuration — signed URLs are the only access path

**Do not:**

- Store signed URLs in the database — generate them at request time only
- Use the `Content-Type` header for file type validation
- Return 409 for an idempotent duplicate — return 200 with the existing record

---

## Acceptance Criteria

- [ ] Given an authenticated user POSTs a valid JPEG under 10MB with a unique `client_idempotency_key`, then a `receipt_uploads` row is created with `status = 'pending_review'` and the response contains `{ data: { id, status, file_path } }`
- [ ] Given the same `client_idempotency_key` is submitted twice, then the second request returns 200 with the data from the first row — no duplicate row is created in `receipt_uploads`
- [ ] Given a file exceeding 10MB is submitted, then the API returns 400 with `code: 'FILE_TOO_LARGE'`
- [ ] Given a PDF or non-image MIME type is submitted, then the API returns 400 with `code: 'INVALID_FILE_TYPE'`
- [ ] Given an unauthenticated request is made to either endpoint, then 401 is returned with `code: 'AUTH_REQUIRED'`
- [ ] Given an authenticated user requests a signed URL for a receipt they own, then a signed URL with a 15-minute expiry is returned and the URL resolves to the image in storage
- [ ] Given an authenticated user requests a signed URL for a receipt owned by a different user, then 404 is returned — the existence of the other user's receipt is not disclosed
- [ ] The `file_path` stored in `receipt_uploads` is a Supabase Storage path, not a CDN URL

---

## Failure States

| Failure                                         | User-visible behavior                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Supabase Storage upload fails mid-flight        | Route Handler returns `{ error: 'Upload failed. Please try again.', code: 'OPERATION_FAILED' }` (500); no DB row inserted |
| DB insert fails after successful storage upload | Route Handler returns `OPERATION_FAILED` (500); the orphaned storage file is acceptable at MVP (cleanup in V1)            |
| Signed URL generation fails                     | Route Handler returns `OPERATION_FAILED` (500); caller should show "Could not load receipt image"                         |
| Receipt ID not found (or wrong owner)           | 404 — no information leak about other users' receipts                                                                     |

---

## Edge Cases

- `listing_id` is provided but the listing does not exist: the FK constraint will handle integrity at DB level; the Route Handler should not pre-validate the listing UUID against the DB (avoids an extra query)
- `purchase_date` is today in the user's timezone but appears as yesterday in UTC: accept — do not enforce strict timezone matching
- User uploads the same file twice with different `client_idempotency_key` values: two separate rows are created (this is correct — idempotency is per key, not per file content)
- File upload is interrupted (network drop mid-stream): the storage upload will fail; the Route Handler returns `OPERATION_FAILED`; the client should display an error and allow retry with a new `client_idempotency_key` — or the same key if the client retains it

---

## Accessibility Notes

No UI in this ticket. Accessibility requirements are in Ticket 064 (the form).

---

## QA Test Cases

| #    | Scenario                      | Role                       | Steps                                                                       | Expected result                                                                                                             |
| ---- | ----------------------------- | -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Successful upload             | supporter                  | POST a valid JPEG < 10MB with all fields                                    | 200 response; row in `receipt_uploads` with `status='pending_review'`; file visible in `receipts` bucket at the stored path |
| QA-2 | Idempotency key deduplication | supporter                  | POST same `client_idempotency_key` twice                                    | Both return 200; exactly one row in `receipt_uploads`                                                                       |
| QA-3 | File too large                | supporter                  | POST a file > 10MB                                                          | 400 response with `code: 'FILE_TOO_LARGE'`                                                                                  |
| QA-4 | Invalid file type             | supporter                  | POST a PDF                                                                  | 400 response with `code: 'INVALID_FILE_TYPE'`                                                                               |
| QA-5 | Signed URL — correct owner    | supporter                  | Upload a receipt; GET `/api/receipts/[id]/signed-url` as the same user      | 200 response with a `signed_url`; URL loads the image in a browser                                                          |
| QA-6 | Signed URL — wrong owner      | supporter (different user) | GET `/api/receipts/[id]/signed-url` for a receipt belonging to another user | 404 response                                                                                                                |
| QA-7 | Unauthenticated access        | anonymous                  | POST to upload endpoint; GET signed URL endpoint                            | Both return 401                                                                                                             |

---

## Security Notes

- Validate MIME type from magic bytes — never trust the `Content-Type` header
- The `receipts` Supabase Storage bucket must be configured as private — no public access policy
- Signed URLs are generated with service role key server-side — the service role key must never appear in client-side code
- Owner-only check for signed URL: `SELECT id FROM receipt_uploads WHERE id = ? AND user_id = auth.uid()` — returns 404 if not found, never 403 (avoids confirming existence to non-owners)
- `amount_cents` and `purchase_date` are stored as user input — no PII risk beyond standard user data retention policy

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (N/A for UI; API: success, validation error, auth error, server error)
- [ ] Mobile tested at 375px (N/A — API only)
- [ ] Keyboard navigation tested (N/A — API only)
- [ ] Accessibility requirements met (N/A — no UI)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
