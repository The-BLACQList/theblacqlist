# Ticket 030: Media Upload API (POST /api/upload)

**Ticket ID:** BLACQ-030
**Title:** Media upload API (POST /api/upload) — all three bucket types
**Type:** Feature
**Priority:** P0 — Critical
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 5: Submit / Claim / Manage Foundation
**Feature Area:** API / Media

---

## Context

The media upload endpoint is a gating dependency for every feature that involves file uploads: listing cover images and logos in the Add Business form, gallery images in the Page Editor, verification documents in the Claim flow, and receipt photos in the Receipt Upload Beta. Without this endpoint, none of those flows can be completed. It handles three distinct storage buckets with different MIME type and size constraints, enforces ownership authorization, and generates UUID-based storage paths to prevent path traversal attacks.

This endpoint is documented in the API contract as Endpoint 21 (Upload Entity Media). The scope extension in this ticket covers the `subtype` parameter approach described in the ticket prompt (which aligns with the `media_role` field in the contract).

Source artifacts:
- `docs/blacqlist/architecture/api-contract.md` — Section 4, Endpoint 21: Upload Entity Media
- `docs/blacqlist/ux/mvp-screen-map.md` — Add Business Step 5 (media upload), Page Editor gallery section, Claim form (document upload)
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 11.2 (gallery image upload states in Page Editor)

This ticket depends on Ticket 002 (Supabase project setup with storage buckets configured). The `listing-media`, `verification-docs`, and `receipts` buckets must exist in Supabase Storage before this endpoint can write to them.

---

## User Story

> As a business owner or platform user, I want to upload images and documents as part of my listing, claim, or receipt submission, so that my files are securely stored and immediately available for use in my listing page or workflow.

---

## Scope

**In scope:**
- `app/api/upload/route.ts` — `POST` Route Handler, `Content-Type: multipart/form-data`
- Form fields: `file` (binary/File), `bucket` (`'listing-media'` | `'verification-docs'` | `'receipts'`), `entity_type` (string, e.g., `'listing'`, `'user'`), `entity_id` (UUID of the parent entity), `media_role` (optional: `'logo'` | `'cover'` | `'gallery'` for listing-media bucket; `'claim-doc'` for verification-docs; `'receipt'` for receipts)
- MIME type validation from file bytes (NOT from `Content-Type` header): use the `file-type` npm package or buffer magic bytes inspection. Reject if MIME does not match the allowed set for the bucket.
- File size validation per bucket and media_role:
  - `listing-media`: logo ≤ 2MB, cover ≤ 5MB, gallery (default) ≤ 3MB
  - `verification-docs`: ≤ 10MB
  - `receipts`: ≤ 10MB
- Allowed MIME types:
  - `listing-media`: `image/jpeg`, `image/png`, `image/webp`
  - `verification-docs`: `image/jpeg`, `image/png`, `application/pdf`
  - `receipts`: `image/jpeg`, `image/png`, `image/webp`
- UUID filename generation: always generate a new UUID as the filename. Extension derived from validated MIME type. Never use the user-supplied filename.
- Storage path construction:
  - `listing-media`: `listings/[entity_id]/[media_role]/[uuid].[ext]`
  - `verification-docs`: `claims/[entity_id]/[uuid].[ext]`
  - `receipts`: `receipts/[user_id]/[uuid].[ext]`
- Upload via Supabase storage service_role client
- After successful gallery upload to `listing-media` bucket: INSERT a record into `media_attachments` table with `entity_type`, `entity_id`, `file_path`, `file_type` (MIME), `file_size_bytes`, `uploaded_by` (auth.uid())
- For `logo` and `cover` uploads: return the path and let the caller update the listing via `updateListingDraft` — no automatic listing update in this handler
- Response: `{ data: { path: string } }` — the storage path (never a CDN URL)
- Error codes: `AUTH_REQUIRED` (401), `FORBIDDEN` (403), `VALIDATION_ERROR` (400), `FILE_TOO_LARGE` (413), `INVALID_FILE_TYPE` (400), `UPLOAD_FAILED` (500)
- Auth required for all uploads: `supabase.auth.getUser()` must return a valid user
- Ownership check for `listing-media`: verify `listings.owner_user_id = auth.uid()` where `listings.id = entity_id`. Return `FORBIDDEN` if check fails.
- `verification-docs` and `receipts` buckets: accessible only via service_role from other server-side actions (per api-contract.md). For this route handler: `verification-docs` uploads are allowed for authenticated users during the claim flow; `receipts` uploads are allowed for authenticated users. The bucket-level RLS policy (configured in Supabase) enforces who can write — the handler provides application-level authorization on top.
- Analytics event: `media_uploaded` — properties: `{ listing_id: entity_id, file_type: mime, bucket, media_role }`

**Out of scope:**
- Image resizing, compression, or thumbnail generation (V1 — use Supabase Image Transform or an edge function)
- Video upload (V1)
- Audio upload (not planned)
- Bulk upload endpoint (V1 — single file per request at MVP)
- Drag-and-drop UI (belongs in the Page Editor ticket, not this API ticket)
- Progress events (multipart upload chunking) — single-request upload at MVP; file size limits make chunking unnecessary

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-002: Supabase project setup with `listing-media`, `verification-docs`, `receipts` buckets created | Infrastructure | Not started — bucket names and RLS policies must be configured |
| `media_attachments` table in the database schema | Database | Must exist (Ticket 009 or earlier schema ticket) |
| `listings` table with `owner_user_id` column | Database | Must exist |
| `file-type` npm package (or equivalent buffer magic bytes library) | Dependency | Must be installed: `npm install file-type` |
| Supabase service_role key available as `SUPABASE_SERVICE_ROLE_KEY` env var | Environment | Must be set |
| `uuid` generation: `crypto.randomUUID()` available in Node.js 18+ | Runtime | Available in Next.js 14 |

---

## UX Notes

- **Consuming screens:**
  - Add Business form Step 5 (media): logo, cover image, gallery uploads
  - Page Editor gallery section: add/replace gallery images, replace cover image, replace logo
  - Claim form: optional document upload
  - Receipt upload: receipt photo
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Add Business Step 5; `docs/blacqlist/ux/empty-loading-error-success-states.md` → Section 11.2 (gallery upload states)
- **Upload flow from UI perspective:** User selects or captures a file → client sends `FormData` to `POST /api/upload` → endpoint validates, uploads to Supabase Storage, returns `{ data: { path } }` → client stores the `path` in component state → on form save, the `path` is passed to `createListing` or `updateListingDraft`
- **Error communication:** `FILE_TOO_LARGE` → UI shows "File too large. Max [size] for this type." inline below the upload slot. `INVALID_FILE_TYPE` → "This file type isn't supported. Use JPEG, PNG, or WebP." No network errors exposed as raw messages.
- **Upload in progress:** The UI uploads and awaits the response. The upload button/slot shows a spinner. The rest of the form remains interactive during upload. This is per `empty-loading-error-success-states.md` Section 11.2: "Other images and UI remain interactive" during individual image upload.

---

## Design Notes

Not applicable — this is a pure API ticket with no UI components. The upload slot UI (progress indicator, preview, error states) is implemented in the Page Editor gallery section ticket.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `media_attachments`, `listings`
- **Entities involved:** `media_attachments` (INSERT for gallery uploads), `listings` (SELECT for ownership verification)
- **Operations:**
  - SELECT `listings WHERE id = entity_id AND owner_user_id = auth.uid()` (ownership check)
  - INSERT `media_attachments` (gallery uploads only)
  - Supabase Storage upload (write to bucket)
- **`media_attachments` table schema (per data-model):**
  ```sql
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY
  entity_type  text NOT NULL
  entity_id    uuid NOT NULL
  file_path    text NOT NULL
  file_type    text NOT NULL      -- MIME type
  file_size_bytes integer NOT NULL
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL
  display_order integer DEFAULT 0
  alt_text     text
  created_at   timestamptz DEFAULT now() NOT NULL
  ```
- **Storage path format:** `listings/[entity_id]/[media_role]/[uuid].[ext]`. Extension mapping: `image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`, `application/pdf` → `.pdf`.
- **File size check:** Check `file.size` (bytes) before attempting the upload. Return `FILE_TOO_LARGE` immediately if over limit.
- **MIME validation:** Read the first 4KB of the file as a `Buffer` and check magic bytes using `file-type`. Do not trust the `file.type` or the `Content-Type` header.
- **RLS:** The handler uses the Supabase service_role client for the upload to bypass bucket-level RLS. Application-level ownership checks are done in the handler code. This is per the API contract spec for this endpoint.
- **Migration required:** No (depends on `media_attachments` table from earlier migration). Confirm `media_attachments` table exists.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Section 4, Endpoint 21
- **Endpoint:** `POST /api/upload` — `Content-Type: multipart/form-data`
- **Auth required:** Yes — `supabase.auth.getUser()` must succeed
- **Request fields:**
  - `file` (File/Blob)
  - `bucket` (string, enum: `'listing-media'` | `'verification-docs'` | `'receipts'`)
  - `entity_type` (string, e.g., `'listing'`)
  - `entity_id` (string, UUID)
  - `media_role` (string, optional: `'logo'` | `'cover'` | `'gallery'` | `'claim-doc'` | `'receipt'`)
- **Response:** `{ data: { path: string } }` — HTTP 201
- **Error codes:**

| Code | HTTP | Condition |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No valid session |
| `FORBIDDEN` | 403 | `owner_user_id != auth.uid()` for listing-media |
| `VALIDATION_ERROR` | 400 | Missing required fields, invalid bucket value, invalid UUID for entity_id |
| `INVALID_FILE_TYPE` | 400 | MIME type not allowed for the target bucket |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit for the bucket + media_role combination |
| `UPLOAD_FAILED` | 500 | Supabase Storage upload rejected or timed out |

---

## Implementation Notes

**Files to create:**
- `app/api/upload/route.ts` — Route Handler, exports `POST`
- `lib/services/upload.ts` — `uploadFile(params: UploadParams): Promise<{ path: string }>` — service function with validation, ownership check, storage upload, and `media_attachments` INSERT
- `lib/validations/upload.ts` — zod schema for upload form fields
- `lib/utils/mime.ts` — `validateMimeType(buffer: Buffer, allowedTypes: string[]): Promise<string | null>` — reads magic bytes using `file-type`, returns detected MIME or null if not in allowed set. Also exports `mimeToExtension(mime: string): string`.

**Files to modify:**
- `package.json` — add `file-type` dependency (run `npm install file-type`)

**Key patterns:**

```typescript
// app/api/upload/route.ts
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string
  const entityId = formData.get('entity_id') as string
  const entityType = formData.get('entity_type') as string
  const mediaRole = formData.get('media_role') as string | null

  // Validate fields with zod
  const validated = uploadSchema.safeParse({ bucket, entityId, entityType, mediaRole })
  if (!validated.success) {
    return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', fields: validated.error.flatten().fieldErrors }, { status: 400 })
  }

  // File size check
  const sizeLimit = getSizeLimit(bucket, mediaRole)
  if (file.size > sizeLimit) {
    return Response.json({ error: `File too large. Maximum size is ${formatBytes(sizeLimit)}.`, code: 'FILE_TOO_LARGE' }, { status: 413 })
  }

  // MIME validation from bytes
  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = await validateMimeType(buffer, getAllowedMimes(bucket))
  if (!detectedMime) {
    return Response.json({ error: 'File type not supported.', code: 'INVALID_FILE_TYPE' }, { status: 400 })
  }

  // Ownership check for listing-media
  if (bucket === 'listing-media') {
    const { data: listing } = await supabase.from('listings').select('owner_user_id').eq('id', entityId).single()
    if (!listing || listing.owner_user_id !== user.id) {
      return Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // Generate UUID path
  const ext = mimeToExtension(detectedMime)
  const uuid = crypto.randomUUID()
  const path = buildStoragePath(bucket, entityId, mediaRole, uuid, ext, user.id)

  // Upload to Supabase Storage (service_role client)
  const serviceClient = createServiceRoleClient()
  const { error: uploadError } = await serviceClient.storage.from(bucket).upload(path, buffer, { contentType: detectedMime })
  if (uploadError) {
    console.error('[upload] Storage error:', uploadError)
    return Response.json({ error: 'Upload failed. Please try again.', code: 'UPLOAD_FAILED' }, { status: 500 })
  }

  // Insert media_attachments record for gallery uploads
  if (bucket === 'listing-media' && mediaRole === 'gallery') {
    await serviceClient.from('media_attachments').insert({
      entity_type: entityType,
      entity_id: entityId,
      file_path: path,
      file_type: detectedMime,
      file_size_bytes: file.size,
      uploaded_by: user.id,
    })
  }

  return Response.json({ data: { path } }, { status: 201 })
}
```

```typescript
// Storage path construction
function buildStoragePath(bucket: string, entityId: string, mediaRole: string | null, uuid: string, ext: string, userId: string): string {
  if (bucket === 'listing-media') return `listings/${entityId}/${mediaRole ?? 'gallery'}/${uuid}.${ext}`
  if (bucket === 'verification-docs') return `claims/${entityId}/${uuid}.${ext}`
  if (bucket === 'receipts') return `receipts/${userId}/${uuid}.${ext}`
  throw new Error(`Unknown bucket: ${bucket}`)
}
```

```typescript
// File size limits
function getSizeLimit(bucket: string, mediaRole: string | null): number {
  if (bucket === 'listing-media') {
    if (mediaRole === 'cover') return 5 * 1024 * 1024    // 5MB
    if (mediaRole === 'logo') return 2 * 1024 * 1024     // 2MB
    return 3 * 1024 * 1024                               // 3MB gallery
  }
  return 10 * 1024 * 1024                                // 10MB (verification-docs, receipts)
}
```

**`file-type` usage:**
```typescript
import { fileTypeFromBuffer } from 'file-type'

export async function validateMimeType(buffer: Buffer, allowedTypes: string[]): Promise<string | null> {
  const result = await fileTypeFromBuffer(buffer)
  if (!result) return null  // Cannot detect type
  if (!allowedTypes.includes(result.mime)) return null
  return result.mime
}
```

**Note:** `file-type` is an ESM-only package as of version 19+. Ensure the Next.js project is configured to handle ESM dependencies, OR use version 16.x (last CommonJS-compatible version). Check `package.json` `type` field before installing.

**Do not:**
- Trust `file.type` from the `File` object or `Content-Type` from the request — always inspect magic bytes.
- Use the original filename from the `File` object — always generate a UUID filename.
- Store CDN URLs in the database or return them in the response — return only the storage path.
- Expose the Supabase storage error message to the client — log it server-side and return the generic "UPLOAD_FAILED" message.
- Allow `admin` or `super_admin` role bypass of ownership check in this route — admin uploads go through a separate admin-specific endpoint (or service_role direct in admin actions).

---

## Acceptance Criteria

- [ ] Given an authenticated owner uploading a JPEG cover image (< 5MB) for their listing, the endpoint returns `{ data: { path: "listings/[entity_id]/cover/[uuid].jpg" } }` with HTTP 201.
- [ ] Given a file with a `.jpg` extension but PDF magic bytes, the endpoint returns `400 INVALID_FILE_TYPE` (MIME validation is from bytes, not filename).
- [ ] Given a logo upload exceeding 2MB, the endpoint returns `413 FILE_TOO_LARGE` without attempting the Supabase upload.
- [ ] Given a cover upload of exactly 5MB (the limit), the endpoint accepts and processes it successfully. A file of 5MB + 1 byte is rejected.
- [ ] Given an unauthenticated request, the endpoint returns `401 AUTH_REQUIRED`.
- [ ] Given an authenticated user uploading to a listing they do not own, the endpoint returns `403 FORBIDDEN` — the upload is rejected and no file is stored.
- [ ] Given a gallery upload to `listing-media`, a record is inserted into `media_attachments` after successful upload.
- [ ] Given a logo or cover upload to `listing-media`, NO record is inserted into `media_attachments` — the caller manages the path update via `updateListingDraft`.
- [ ] The returned `path` is a Supabase Storage path (e.g., `listings/[uuid]/gallery/[uuid].jpg`), never a CDN URL.
- [ ] Given a valid `verification-docs` upload (PDF, < 10MB), the endpoint accepts and returns the storage path.
- [ ] The `media_uploaded` analytics event is logged after every successful upload.
- [ ] Given a PDF file uploaded to `listing-media` (images-only bucket), the endpoint returns `400 INVALID_FILE_TYPE`.
- [ ] A WebP file (`image/webp`) is accepted for `listing-media` and `receipts` buckets.

---

## Failure States

| Failure | Condition | Response | Recovery |
|---|---|---|---|
| File field missing from FormData | Request malformed | 400 VALIDATION_ERROR: "file is required" | Client must include the file field |
| Supabase Storage upload fails | Network issue, quota exceeded, or storage error | 500 UPLOAD_FAILED — safe message, full error logged | Client shows "Upload failed. Try again." |
| `media_attachments` INSERT fails after successful upload | Database write error | 500 UPLOAD_FAILED — the file is in storage but no record exists. Log the orphaned path for cleanup. | Admin cleanup job; client shows "Upload failed" |
| Invalid `entity_id` UUID format | Malformed UUID in form field | 400 VALIDATION_ERROR | Client corrects the UUID |
| Invalid `bucket` value | Not one of the three valid bucket names | 400 VALIDATION_ERROR | Client must use the correct bucket name |
| File with zero bytes | Empty file upload | 400 INVALID_FILE_TYPE — `file-type` returns null for empty buffer | Client re-selects the file |
| Ownership check: listing not found | `entity_id` does not match any listing | 403 FORBIDDEN — treated as ownership failure (do not reveal whether the listing exists) | N/A |

---

## Edge Cases

- File extension does not match detected MIME (e.g., `photo.png` that is actually a JPEG): MIME is determined from magic bytes — use the detected MIME for path extension, not the file's original extension.
- `file-type` cannot determine MIME type (unusual or corrupted file): return `INVALID_FILE_TYPE` — do not attempt the upload.
- `entity_id` is a valid UUID but does not exist in `listings` (deleted listing): ownership check returns null → 403 FORBIDDEN. Do not reveal whether the listing existed.
- Upload race condition: two simultaneous uploads for the same listing by the same user: both succeed (UUIDs guarantee uniqueness in the path). The caller is responsible for not over-uploading.
- `media_attachments` INSERT fails after storage upload: log the orphaned path with `[ORPHANED_UPLOAD]` prefix. At V1, implement a cleanup job to remove orphaned storage files.
- Bucket `listing-media` with no `media_role` provided: default to `'gallery'` in path construction and use gallery size limit (3MB).
- User uploads a file right at the size limit: `file.size === limit` is valid (≤ limit). Test boundary: exact limit should pass, limit + 1 byte should fail.

---

## Accessibility Notes

Not applicable — this is a server-side API endpoint with no UI.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-030-1 | Valid JPEG gallery upload | POST to `/api/upload` with valid JPEG, bucket=listing-media, media_role=gallery, valid entity_id | 201 response; `{ data: { path: "listings/[id]/gallery/[uuid].jpg" } }`; record in `media_attachments` |
| QA-030-2 | File too large (cover) | POST 6MB JPEG with media_role=cover | 413 FILE_TOO_LARGE; no file in storage |
| QA-030-3 | MIME type mismatch (magic bytes) | POST file with `.jpg` extension but PDF magic bytes | 400 INVALID_FILE_TYPE; no file in storage |
| QA-030-4 | Unauthenticated upload | POST without session cookie | 401 AUTH_REQUIRED |
| QA-030-5 | Wrong owner | POST with valid JPEG to a listing owned by a different user | 403 FORBIDDEN; no file in storage |
| QA-030-6 | PDF to verification-docs | POST PDF (< 10MB) to bucket=verification-docs | 201 response; path format `claims/[entity_id]/[uuid].pdf` |
| QA-030-7 | PDF to listing-media (invalid) | POST PDF to bucket=listing-media | 400 INVALID_FILE_TYPE |
| QA-030-8 | Logo upload — no media_attachments record | POST JPEG with media_role=logo | 201 response; path format `listings/[id]/logo/[uuid].jpg`; NO record inserted into `media_attachments` |
| QA-030-9 | WebP upload | POST WebP image to listing-media | 201 response; path ends in `.webp` |

---

## Security Notes

- **MIME validation from magic bytes (critical):** Trusting `Content-Type` headers or file extensions allows content-type spoofing attacks. Always inspect the file buffer. The `file-type` library reads the first bytes of the buffer to detect the actual MIME type.
- **UUID filenames (critical):** User-supplied filenames are never used. UUID filenames prevent path traversal attacks and filename-based injection.
- **Ownership enforcement:** For `listing-media`, the endpoint always queries `listings.owner_user_id = auth.uid()`. Users cannot upload to arbitrary listing IDs. This is enforced in application code (defense-in-depth over Supabase RLS).
- **Service_role client scope:** The service_role Supabase client used for storage uploads is never exposed to the browser. It is instantiated server-side only in the Route Handler.
- **Path construction:** Storage paths are constructed from validated UUID `entity_id` + UUID filename. No user-supplied strings are included in the path except the validated `media_role` (which is enum-validated before use).
- **No URL storage:** The endpoint returns the storage path (`path`), not a CDN URL. CDN URLs are generated at read time via `getPublicUrl()`. This ensures CDN URLs are never stored and remain regenerable.
- **File content scanning:** At MVP, no virus/malware scanning is performed on uploads. This is a known risk — document in the security risk log. In V1, integrate Supabase Edge Function + ClamAV or a cloud-based file scanning service.
- **Rate limiting:** Upload endpoint inherits session-based rate limiting from Supabase. Consider adding an explicit upload rate limit (e.g., 20 uploads/minute per user) in V1 to prevent abuse.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `file-type` package installed and ESM compatibility confirmed
- [ ] Valid JPEG upload tested end-to-end (file in Supabase Storage, path returned, `media_attachments` record created for gallery)
- [ ] Logo upload: NO `media_attachments` record created — verified
- [ ] FILE_TOO_LARGE tested for each bucket (2MB logo, 5MB cover, 3MB gallery, 10MB docs/receipts)
- [ ] MIME type mismatch test: .jpg file with PDF magic bytes → INVALID_FILE_TYPE
- [ ] Unauthenticated upload → 401
- [ ] Wrong owner upload → 403
- [ ] UUID filename verified (no user filename in storage path)
- [ ] Storage path format verified for all three buckets
- [ ] Analytics `media_uploaded` event fires after successful upload (check via console or network tab)
- [ ] Orphaned upload logging verified (by intentionally failing the `media_attachments` INSERT in a test environment)
