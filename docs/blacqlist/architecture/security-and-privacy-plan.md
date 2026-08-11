# Security and Privacy Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Approved for implementation
**Owner:** Architecture + Engineering
**Reviewer:** Security review required before V2 (marketplace) launch

This document defines the security posture, privacy policies, and enforcement mechanisms for The BLACQList across all phases. It is the source of truth for how user data is protected, how access is controlled, and where known gaps exist. It should be shared with any security reviewer engaged before V2.

---

## 1. User Role Model and Access Boundaries

The platform has five roles. Roles are stored in the `user_roles` table (not in the JWT), so role changes take effect immediately without requiring token re-issue. The role check is performed server-side on every request to a role-gated route.

### Role Definitions

| Role            | Description                                             | Assignment                                         |
| --------------- | ------------------------------------------------------- | -------------------------------------------------- |
| **Anonymous**   | Unauthenticated visitor                                 | Default (no account)                               |
| **Supporter**   | Authenticated user who discovers and saves businesses   | Self-service on sign-up                            |
| **Owner**       | Authenticated user who has claimed one or more listings | Granted by Admin upon claim approval               |
| **Admin**       | Platform operator with moderation and management access | Granted by Super Admin only                        |
| **Super Admin** | Founding team with full system access                   | Maximum 2 people at launch; granted manually in DB |

### Access Boundaries by Role

**Anonymous**

- SELECT published listings (`status = 'published'`, `deleted_at IS NULL`) — public pages only
- SELECT public categories, cities, editorial content
- No write operations of any kind
- Rate-limited on search: 60 requests per minute per IP
- Cannot claim, review, save, or submit any content

**Supporter** (all Anonymous permissions, plus)

- INSERT and DELETE own saves (`saves` table, own `user_id` only)
- INSERT own reviews (V1; `status: 'pending'` only — never directly published)
- INSERT own spend events and receipt uploads (V2)
- SELECT own account data, own saves, own reviews, own spend events
- No access to any other user's data
- No access to listing management, admin tools, or other owners' data

**Owner** (all Supporter permissions, plus)

- SELECT, UPDATE, INSERT own listings (gated by `owner_user_id = auth.uid()`)
- SELECT, UPDATE, INSERT all child records of own listings: `listing_details_business`, `listing_details_*`, `media_attachments` for own entities
- INSERT own claim submissions; SELECT own claim status
- SELECT own listing analytics (own listings only — no cross-listing visibility, even for multi-listing owners)
- No access to verification queue, admin tools, other users' data, other owners' listings, or platform-wide statistics

**Admin** (all Supporter permissions, plus)

- SELECT all listings, including unpublished and soft-deleted
- UPDATE listing status, flags, verification status via Server Actions (service role path)
- Approve or reject claims; approve or reject community corrections (V1)
- SELECT and moderate review queue (V1); can reject reviews before publication
- SELECT and action verification document queue (V1); view verification documents via 15-minute signed URLs only
- SELECT and update user records (not passwords); assign Supporter or Owner roles; suspend users
- SELECT platform-wide analytics
- INSERT to `admin_audit_log` on every mutation
- Cannot assign Admin or Super Admin roles
- Cannot view other admins' audit log entries (Super Admin only)
- Cannot access Stripe payment details (Stripe Dashboard only)

**Super Admin** (all Admin permissions, plus)

- SELECT all admin audit log entries
- Assign and revoke Admin role
- System configuration (feature flags, platform settings)
- View all financial and subscription data
- Cannot self-assign Super Admin (hardcoded at DB level as a constraint; only direct DB access can create a second Super Admin — requires two-person authorization)

### Multi-Listing Ownership

An Owner may own multiple listings if they submit and receive approval for multiple claims. Analytics and management scoping remain per-listing — there is no cross-listing aggregate view available to Owners. The `owner_user_id` field on each `listings` row is the authoritative ownership record.

---

## 2. Row Level Security (RLS) Approach

RLS is the database-level enforcement layer. It is not optional and is never disabled. It provides the last line of defense even if a bug in application code constructs an unexpected query.

### Core Principle

RLS policies on every table enforce that: unauthenticated requests can only read published public data; authenticated users can only read and write their own records; admin operations bypass RLS via the service role key, which is used exclusively in Server Actions and Route Handlers on the server — never in client code.

### Supabase Role Mapping

| Supabase Role   | Maps To                                                | Scope                                        |
| --------------- | ------------------------------------------------------ | -------------------------------------------- |
| `anon`          | Anonymous visitors                                     | SELECT on published public rows only         |
| `authenticated` | Supporter, Owner (determined by additional role check) | SELECT on public data + write on own records |
| `service_role`  | Admin and Super Admin actions                          | Bypasses RLS entirely; server-side only      |

### Policy Logic by Table

**`listings`**

- `anon` SELECT: `status = 'published' AND deleted_at IS NULL`
- `authenticated` SELECT: published rows (same as anon) plus own unpublished rows where `owner_user_id = auth.uid()`
- `authenticated` INSERT: allowed; `owner_user_id` is set to `auth.uid()` at insert time; new listings start with `status = 'draft'`
- `authenticated` UPDATE: only where `owner_user_id = auth.uid()`; status transitions from `draft` to `submitted` only — service layer enforces valid transitions
- `authenticated` DELETE: not permitted; soft delete via `deleted_at` requires service role
- Admin mutations: via service role (bypasses RLS)

**`media_attachments`**

- `anon` SELECT: only where `bucket = 'listing-media'` and the parent listing is published
- `authenticated` INSERT: only for entity records the user owns (`entity_id` must match a listing where `owner_user_id = auth.uid()`)
- `authenticated` SELECT: own entities' attachments only; no SELECT on `verification-docs` or `receipts` buckets by non-owner users
- `authenticated` DELETE: own attachments only
- `anon` access to `verification-docs` bucket: blocked at both RLS and Supabase Storage bucket policy levels (private bucket)
- `anon` access to `receipts` bucket: blocked at both RLS and Supabase Storage bucket policy levels (private bucket)

**`reviews`** (V1)

- `anon` SELECT: only where `status = 'approved'`
- `authenticated` SELECT: own reviews at any status; others' reviews only where `status = 'approved'`
- `authenticated` INSERT: allowed; `reviewer_user_id` set to `auth.uid()`; `status` forced to `'pending'` at insert — service layer rejects any attempt to set `status = 'approved'` on insert
- `authenticated` UPDATE: not permitted — reviews are immutable after submission to prevent post-approval manipulation
- `authenticated` DELETE: not permitted
- Admin moderation: via service role

**`claims`**

- `authenticated` INSERT: allowed; `claimant_user_id` set to `auth.uid()`
- `authenticated` SELECT: own claim records only (status visible to claimant)
- `authenticated` UPDATE: not permitted — service layer manages status transitions
- Admin: via service role

**`analytics_events`**

- `anon` INSERT: not permitted
- `authenticated` INSERT: not permitted from client; events are written server-side only via Server Actions
- `authenticated` SELECT: only where the `listing_id` FK points to a listing the user owns (`owner_user_id = auth.uid()`)
- `anon` SELECT: not permitted
- Admin: via service role

**`admin_audit_log`**

- INSERT: only via service role (no direct user writes)
- SELECT: Admin and Super Admin via service role; Super Admin can see all entries; Admin can see only their own entries (enforced at service layer, not RLS)
- `anon` and `authenticated` SELECT: not permitted
- `authenticated` DELETE: not permitted; audit records are immutable

**`saves`**

- `authenticated` INSERT: own records only (`user_id = auth.uid()`)
- `authenticated` DELETE: own records only
- `authenticated` SELECT: own records only
- `anon`: not permitted

**`spend_events`** (V2)

- `authenticated` INSERT: own records only (`user_id = auth.uid()`)
- `authenticated` SELECT: own records only
- `authenticated` DELETE: own records only (triggers Storage file deletion via Server Action)
- `anon`: not permitted
- Aggregate views for flow-map: computed server-side by service layer — raw rows never exposed in aggregate queries (see Section 6)

**`user_roles`**

- `authenticated` SELECT: own role record only
- `authenticated` INSERT/UPDATE/DELETE: not permitted; role changes are Admin/Super Admin operations via service role only

### Service Role Key Discipline

The `SUPABASE_SERVICE_ROLE_KEY` environment variable is:

- Stored in Vercel environment variables (server-only, never `NEXT_PUBLIC_*`)
- Used exclusively in Server Actions (`app/actions/`) and Route Handlers (`app/api/`)
- Never imported in any file that is or could become a Client Component
- Never logged, never returned in a response body, never included in any client-side bundle

Any code review finding the service role key in a `"use client"` file or in a `NEXT_PUBLIC_*` variable is an immediate blocker.

---

## 3. Authentication Security

### Session Storage

JWT sessions are stored in httpOnly cookies managed by the Supabase SSR helper (`@supabase/ssr`). This prevents JavaScript access to the token and eliminates the class of XSS attacks that steal tokens from localStorage. Sessions are never stored in localStorage, sessionStorage, or any other browser-accessible storage.

### Session Lifecycle

- **Session duration:** 7 days with sliding expiry
- **Refresh strategy:** Supabase handles token refresh automatically before expiry; the SSR helper manages cookie updates on each server-side request
- **Expiry handling:** Expired sessions redirect to `/sign-in?next=[original-path]` so users return to where they were after re-authentication
- **Server-side validation:** `middleware.ts` calls `supabase.auth.getUser()` on every request to a protected route — the session is validated against the Supabase Auth server, not decoded locally from the cookie. A tampered or expired cookie is rejected.

### Password Requirements

- Minimum 8 characters, enforced by Supabase Auth configuration
- Supabase Auth handles password hashing (bcrypt) — the platform never stores or processes plaintext passwords
- Password reset uses a time-limited email link (Supabase Auth default: 1 hour expiry)

### Email Verification

- Email verification is required before an account is considered fully active
- Unverified accounts: cannot claim listings, cannot submit reviews (V1), cannot upload verification documents
- Verification link is sent by Supabase Auth on sign-up; resend available from the verification pending screen
- This prevents throwaway email registrations from gaming the trust system

### Route Protection in Middleware

`middleware.ts` enforces three tiers of route protection:

1. **Authenticated routes** (`/dashboard/*`, `/claim`, `/create`): requires valid session; redirect to `/sign-in?next=[path]` if absent
2. **Admin routes** (`/admin/*`): requires valid session AND role check against `user_roles` table returning `admin` or `super_admin`; redirect to `/403` if role is insufficient
3. **Suspended accounts**: `suspended_at` field is checked server-side; suspended sessions receive a `403` and are redirected to a suspension notice page regardless of route

The middleware is the first line of defense. Server Actions and Route Handlers perform their own session validation as a second check — they do not rely on middleware alone.

### Auth Rate Limiting

- Sign-up, sign-in, password reset endpoints: 10 requests per minute per IP
- Implemented via middleware for Next.js routes; Supabase Auth has its own rate limiting on auth API calls
- CAPTCHA on auth forms: deferred to V1 (documented gap — see Section 17)

---

## 4. Verification Evidence Privacy

Verification documents are the highest-sensitivity data on the platform. Business owners upload government-issued IDs, business licenses, and EIN documents to prove ownership. Mishandling this data carries legal and reputational risk disproportionate to any other data category on the platform.

### Storage

- Stored in the `verification-docs` Supabase Storage bucket
- Bucket policy: **private** — no public access, no unauthenticated access, no anonymous access
- The bucket is not accessible via any CDN or public URL pattern
- Storage bucket policy explicitly denies all access from `anon` role and from `authenticated` role without service role elevation

### Path Storage

- The `verification_docs` field on the `listings` table stores storage paths only (e.g., `verification-docs/listings/[listing_id]/[uuid].pdf`)
- No signed URLs are ever stored in the database
- No CDN URLs or public URLs for verification documents exist anywhere in the system

### Access by Admin

- Signed URLs are generated server-side, on demand, only when an Admin explicitly opens the verification review UI for a specific listing
- Signed URL expiry: 15 minutes
- The signed URL is returned to the Admin's browser session only — it is not logged, not stored, not sent via email, and not included in any API response that could be cached
- The admin review UI loads the document via a server-side proxy route that fetches the signed URL and streams the file — the full signed URL is never present in the page source, browser history, or network logs visible to the client
- Admins cannot download verification documents in bulk — each document requires an individual review action

### Auto-Purge Policy

Verification documents are deleted from Supabase Storage 90 days after a verification decision (approved or rejected). This reduces liability from holding sensitive identity documents longer than operationally necessary.

- A scheduled job (Supabase Edge Function or cron) runs nightly to identify `listings` where `verification_decision_at` is older than 90 days and `verification_docs` is non-null
- The job deletes each file from Storage and sets `verification_docs = NULL` on the `listings` record
- The verification status field (`verification_status`) is retained — only the document files are deleted
- Job execution is logged in `admin_audit_log` with `action = 'auto_purge_verification_docs'`

**Phase note:** Verification documents exist starting in V1. The auto-purge job is a V1 requirement, not deferred.

---

## 5. Receipt Privacy

Receipt photos are private financial records. No user should be able to see another user's receipts under any circumstances.

### Storage

- Stored in the `receipts` Supabase Storage bucket
- Bucket policy: **private** — accessible only via service role
- RLS on `spend_events` table: `user_id = auth.uid()` on all SELECT, INSERT, DELETE operations

### Access

- Signed URLs: 15-minute expiry, generated server-side only when the authenticated user views their own receipt history at `/dashboard/spend`
- The signed URL is returned to the requesting user's session only and is not logged
- No admin has routine access to individual receipt photos — admin access to receipts requires a specific support escalation path (to be defined before V2 launch)

### Data Decoupling

OCR-extracted data (amount, merchant name, category, date) is stored in the `spend_events` table independently of the receipt image. This means:

- Spend analytics and flow-map calculations use only the extracted fields — the raw image is never accessed for aggregate computations
- If a receipt photo is deleted by the user, extracted event data can be retained or deleted according to user preference (to be defined in the V2 privacy settings UI)

### User Deletion

Users can delete their own receipts from `/dashboard/spend`. Deletion is a Server Action that:

1. Deletes the file from Supabase Storage using the service role key
2. Deletes the `spend_events` row (which cascades or nullifies child records per schema)
3. Returns confirmation to the user

### Community Aggregate Views

Spend aggregates used in the flow-map visualization (V3) are computed by the service layer with the following guarantees:

- No `user_id`, name, or any personally identifiable field is included in aggregate query results
- Aggregation is at the city + category level minimum
- A minimum threshold of 5 transactions must exist for a flow line to appear (prevents inference attacks where a single user's behavior could be deduced from the visualization)
- The service layer enforces these constraints in the query — the raw `spend_events` rows are never passed to the frontend

---

## 6. Buyer Anonymity in Flow-Map Views (V3)

The dollar flow visualization shows how spending moves through the Black economy. It must not reveal any individual's spending behavior.

### What Is Stored vs. What Is Displayed

The `spend_events` table stores `user_id` as a foreign key for data integrity and deletion purposes. This field is:

- Used server-side for ownership enforcement (RLS, deletion, opt-out)
- Never included in any API response, aggregate query, or frontend data payload
- Never joined into any visualization data pipeline

### Visualization Data Contract

The flow-map API endpoint returns only:

- Business node identifiers (listing name, category, city)
- Anonymized aggregate flow volume between nodes (total dollar amount aggregated across all contributing transactions, no count of individual transactions)
- City and category labels

It does not return: user IDs, transaction counts by user, individual amounts, dates of individual transactions, or any field that could be combined to identify a person's spending pattern.

### Minimum Threshold

A flow segment is only rendered if it represents at least 5 distinct contributing `user_id` values. This threshold is enforced in the server-side query before data is returned. Segments below threshold are omitted from the response entirely — they are not returned as zeroed-out values.

### Opt-Out

Users can opt out of contributing their spend events to aggregate views at any time from `/dashboard/spend/settings`. Opt-out is respected immediately:

- An `aggregate_opt_out` boolean field on the user's record (or `spend_events` rows) is checked in every aggregate query
- Opted-out users' `spend_events` rows are excluded from all aggregate calculations
- Opting back in applies to future events; it does not retroactively include past events in aggregates

---

## 7. Review Moderation and Reviewer Privacy

### Submission Flow

Reviews are submitted with `status = 'pending'`. They are not visible to any public user, the business owner, or other supporters until an Admin approves them. This prevents unmoderated defamatory, spam, or coordinated review-bombing content from ever appearing publicly.

### Admin Review Queue

The admin review queue displays:

- Reviewer's display name (not email address, not user ID)
- Review text
- Star rating
- Name of the listing being reviewed
- Submission timestamp
- Reviewer's prior review count (to identify unusual activity patterns)

Admin cannot see the reviewer's email address in the queue UI. Email is available only via Supabase Auth dashboard in cases requiring direct contact (e.g., a legal hold situation).

### Public Display

- The reviewer's display name is shown publicly. Display names are configurable — users can use initials or an alias.
- Email addresses are never shown publicly
- The reviewer's user ID is never exposed in any public API response
- Business owners see only the display name and review text — they cannot identify who submitted a review

### Review Immutability

Reviews cannot be edited after submission. This prevents a user from submitting a neutral review for approval and then editing it to be inflammatory after it passes moderation. The service layer rejects all UPDATE attempts on `reviews` rows from the `authenticated` role. Admin can delete a review via service role if it later violates policy.

### Owner Flag Flow

Business owners can flag a review they believe violates policy. A flagged review:

1. Enters a secondary admin review queue
2. Remains visible publicly until Admin makes a decision (to prevent owners from suppressing legitimate criticism by flagging)
3. Admin can: dismiss the flag (review stays), delete the review (removed from public view), or escalate for legal review

### Anti-Gaming Controls

- One review per user per listing: enforced at the database level via a unique constraint on `(reviewer_user_id, listing_id)`
- Rate limit: maximum 3 reviews per user per 24-hour window (enforced in the review submission Server Action before the insert)
- CAPTCHA on review submission: deferred to V1 (documented gap)

---

## 8. Business Owner Access

### Listing Ownership Enforcement

The `owner_user_id` field on the `listings` table is the authoritative ownership record. All RLS policies and service-layer checks use this field. There is no mechanism for an Owner to access or modify a listing they do not own.

Enforcement is applied at three layers:

1. **RLS policy**: `owner_user_id = auth.uid()` on UPDATE and INSERT policies for the `authenticated` role
2. **Service layer**: `getListingByOwner(userId, listingId)` is the only query used in Owner-facing Server Actions — it always includes the ownership filter, so a misconfigured action cannot accidentally return another owner's listing
3. **Server Component data fetching**: Dashboard pages use Server Components that pass `auth.uid()` as a required filter — there is no client-side ownership filtering

### Analytics Scoping

Owner analytics are scoped to individual listings. Even if an Owner has multiple listings:

- Analytics queries always include `listing_id = [specific_listing_id]` and `owner_user_id = auth.uid()`
- There is no cross-listing aggregate dashboard for Owners at MVP or V1
- Platform-wide analytics (total listings, total searches, category distribution) are Admin-only

### What Owners Cannot Do

- Access any listing they do not own
- Read another user's saves, reviews, or account data
- Access the admin queue, verification queue, or review moderation tools
- See platform-wide statistics
- Read their own customers' or reviewers' personal data

---

## 9. Admin Access Controls

### Authentication

Admins use the same Supabase Auth flow as regular users. The Admin role is not granted by the authentication system — it is a role stored in `user_roles` and checked server-side. Successfully authenticating as a user with an admin email address does not grant admin access; the role record must exist.

### Service Role Key Usage

All admin mutations use the `SUPABASE_SERVICE_ROLE_KEY` via Server Actions. This means:

- Admin operations bypass RLS at the database level (intentional — admin needs to read and write records they do not own)
- Every admin mutation is preceded by a server-side role check: the Server Action confirms `user_roles` contains an `admin` or `super_admin` entry for the calling user before proceeding
- The service role key is never used client-side

### Admin Audit Log

Every admin mutation writes a record to `admin_audit_log` before returning a response. The log schema captures:

| Field           | Contents                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | UUID                                                                                                                                                                                                                                                                                 |
| `admin_user_id` | FK to `users.id` — who performed the action                                                                                                                                                                                                                                          |
| `action`        | Enum: `approve_claim`, `reject_claim`, `flag_listing`, `unpublish_listing`, `delete_listing`, `verify_listing`, `reject_verification`, `modify_user_role`, `suspend_user`, `reinstate_user`, `approve_review`, `reject_review`, `resolve_correction`, `auto_purge_verification_docs` |
| `target_table`  | The table affected                                                                                                                                                                                                                                                                   |
| `target_id`     | The primary key of the affected record                                                                                                                                                                                                                                               |
| `before_state`  | JSONB snapshot of the record before the change (sanitized — no passwords, no raw file paths for sensitive buckets)                                                                                                                                                                   |
| `after_state`   | JSONB snapshot of the record after the change (sanitized)                                                                                                                                                                                                                            |
| `ip_address`    | IP address of the admin request (extracted from the request headers server-side)                                                                                                                                                                                                     |
| `created_at`    | Timestamptz                                                                                                                                                                                                                                                                          |

Audit log records are immutable. No UPDATE or DELETE is permitted on `admin_audit_log` from any role including service role (enforced via a database trigger that rejects modifications).

Audit log retention: indefinite. This is a compliance requirement.

### Access to Audit Log

- Admin: can SELECT their own entries (`admin_user_id = [own id]`) via the service layer; the Admin UI shows only their own history
- Super Admin: can SELECT all entries
- Both: read-only access; no delete or update

### What Admins Cannot Do

- Assign the Admin or Super Admin role (Super Admin only)
- View another Admin's audit log entries (Super Admin only)
- Access Stripe payment details — all payment data is in the Stripe Dashboard; the platform stores only `stripe_customer_id` and `stripe_subscription_id`
- Bulk-download verification documents
- View raw receipt photos without a documented support escalation process (defined before V2)

### Super Admin Constraints

- Maximum 2 Super Admin accounts at launch (enforced at service layer — creating a third Super Admin requires direct database access with documented justification)
- Admin cannot self-promote to Super Admin — role assignments are validated server-side to prevent privilege escalation
- Super Admin creation requires two-person authorization: one Super Admin initiates, one confirms via a separate authenticated session

---

## 10. Audit Logging

### What Is Logged

| Event                               | Log location                                                  | Retention                     |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| All admin mutations                 | `admin_audit_log`                                             | Indefinite                    |
| Listing created/updated             | `listings.updated_by`, `listings.submitted_by`                | Indefinite (with record)      |
| Claim submitted, approved, rejected | `admin_audit_log` (on decision); `claims` table (full record) | Indefinite                    |
| Verification decision (V1)          | `admin_audit_log`                                             | Indefinite                    |
| Review approved or rejected (V1)    | `admin_audit_log`                                             | Indefinite                    |
| User suspended or reinstated        | `admin_audit_log`                                             | Indefinite                    |
| Role assignment or revocation       | `admin_audit_log`                                             | Indefinite                    |
| Verification docs auto-purged       | `admin_audit_log`                                             | Indefinite                    |
| Auth events (sign-up, sign-in)      | Supabase Auth logs                                            | Per Supabase retention policy |
| Failed auth attempts                | Supabase Auth logs                                            | Per Supabase retention policy |

### What Is Not Logged

- Anonymous searches and public page views: captured in `analytics_events` for product analytics, not in the audit log
- Individual page views by authenticated users: not logged beyond what Supabase Auth records
- Email addresses in any application log
- Session tokens or JWTs in any log
- Raw file paths for `verification-docs` or `receipts` in `before_state` / `after_state` fields of the audit log — paths are redacted to `[redacted]` in the sanitized snapshots

### Log Format

All server-side application logs use structured JSON format. Each entry includes: `timestamp`, `level` (`info` / `warn` / `error`), `event_type`, `user_id` (if authenticated), `request_id`, and event-specific fields. Logs are shipped to Vercel's log drain or a third-party log aggregator (Datadog, Logtail — to be selected before V1 launch).

---

## 11. File Upload Safety

All file uploads are processed through a server-side Route Handler before being written to Supabase Storage. There are no direct browser-to-storage uploads that bypass the server. The upload Route Handler enforces the following checks before writing to Storage.

### MIME Type Validation

The server checks the actual MIME type of the uploaded file (not just the extension declared by the client) against an allowlist:

| Bucket              | Allowed MIME types                                   |
| ------------------- | ---------------------------------------------------- |
| `listing-media`     | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| `verification-docs` | `image/jpeg`, `image/png`, `application/pdf`         |
| `receipts`          | `image/jpeg`, `image/png`, `image/heic`              |

Any MIME type not on the allowlist results in a `400 Bad Request` rejection before the file is written to Storage.

Executable file types (`.exe`, `.js`, `.php`, `.sh`, `application/x-msdownload`, `application/javascript`, `text/x-php`, etc.) are explicitly rejected.

### Size Limits

Size limits are enforced in the upload service layer (server-side), not only in client-side UI validation:

| Asset type            | Limit                                         |
| --------------------- | --------------------------------------------- |
| Listing logo          | 2 MB                                          |
| Cover image           | 5 MB                                          |
| Gallery image         | 2 MB per image; maximum 12 images per listing |
| Verification document | 10 MB                                         |
| Receipt photo         | 5 MB                                          |

Exceeding the limit results in a `400 Bad Request` with a clear error message before the upload is written to Storage.

### Storage Path Pattern

Storage paths follow a deterministic, server-controlled pattern:

```
[bucket]/[entity_type]/[entity_id]/[uuid].[ext]
```

Examples:

- `listing-media/listings/8f3a-1bc2-.../logo/3e7f-9a01....webp`
- `verification-docs/listings/8f3a-1bc2-.../9b3c-4d8e....pdf`
- `receipts/spend_events/4c2a-8f7b.../7d1e-0c3f....jpg`

No component of the path is user-supplied. The `entity_id` is validated server-side as a UUID that belongs to the requesting user before the path is constructed. Path traversal attacks (e.g., `../../../other_user/...`) are not possible because no user input reaches the path construction logic.

### No Direct Browser-to-Storage Uploads

Supabase Storage supports direct browser uploads via the client SDK. This capability is explicitly disabled for this platform. All uploads must go through the server-side Route Handler at `app/api/upload/[bucket]/route.ts`, which performs auth, role, ownership, MIME, and size validation before writing to Storage.

### Virus Scanning

Virus scanning is not implemented at MVP. This is a documented known gap (see Section 17). At V1, a ClamAV-based scanning step will be added to the upload Route Handler via a Supabase Edge Function. Until then, MIME validation and size limits are the primary controls against malicious file uploads.

---

## 12. Spam and Abuse Prevention

### Rate Limiting

Rate limits are enforced at the middleware layer for route-level limits and at the Server Action layer for operation-specific limits:

| Endpoint / Operation   | Limit                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Public search          | 60 requests per minute per IP                                                 |
| Sign-up                | 10 requests per minute per IP                                                 |
| Sign-in                | 10 requests per minute per IP                                                 |
| Password reset request | 10 requests per minute per IP                                                 |
| Claim submission       | 3 per authenticated user per 24 hours                                         |
| Listing creation       | 5 per authenticated user per 24 hours (most listings are admin-seeded at MVP) |
| Review submission (V1) | 3 per authenticated user per 24 hours                                         |

Rate limit storage: Vercel KV (Redis) or an in-memory counter with IP extraction from `x-forwarded-for` header. Vercel's built-in DDoS protection covers volumetric attacks beyond application-level rate limiting.

### CAPTCHA

CAPTCHA is not implemented at MVP. This is a documented known gap (see Section 17). At V1, CAPTCHA (hCaptcha or Cloudflare Turnstile) will be added to:

- Claim submission
- Review submission
- Sign-up form

### Duplicate Listing Detection

Before creating a new listing, the service layer performs a server-side similarity check:

- Normalized business name (lowercased, trimmed, common suffixes removed) + city match
- If a potential duplicate is found, the server returns a `409` response with the potential duplicate's ID
- The client displays a warning screen: "A listing for [Name] in [City] may already exist. [View existing listing] [Continue creating new]"
- The user chooses whether to proceed — duplicates are never silently created or silently rejected

### Flag and Review Queue

Any authenticated user can flag a listing as having incorrect information. Flagged listings:

- Enter the admin review queue immediately
- Remain publicly visible until Admin takes action (to prevent malicious flagging from suppressing legitimate listings)
- Admin SLA for flagged listings: 48 hours at MVP

### IP Blocking

IP-level blocking is not implemented at the application layer at MVP. Vercel's DDoS protection handles volumetric attacks. Persistent abusers can be blocked at the Vercel Firewall level as an operational measure.

---

## 13. Sensitive User Data Handling

### PII Inventory

| Data type                   | Where stored                           | Who can access                                               | Retention                          |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| Email address               | `auth.users` (Supabase Auth) only      | User (via Supabase Auth), Super Admin via Supabase dashboard | Until account deletion             |
| Password (hashed)           | `auth.users` (Supabase Auth) only      | Nobody (bcrypt hash only)                                    | Until account deletion             |
| Business phone number       | `listing_details_business.phone`       | Owner (own listing), public (published listings), Admin      | Until listing deletion             |
| Business address            | `listing_details_business.address`     | Owner (own listing), public (published listings), Admin      | Until listing deletion             |
| User personal phone         | Not collected                          | N/A                                                          | N/A                                |
| User home address           | Not collected                          | N/A                                                          | N/A                                |
| Verification documents      | `verification-docs` bucket             | Admin only (signed URL, 15-min expiry)                       | 90 days post-decision, then purged |
| Receipt photos              | `receipts` bucket                      | Submitting user only (signed URL, 15-min expiry)             | Until user deletes                 |
| Stripe customer ID          | `subscriptions.stripe_customer_id`     | Admin (service layer), Stripe                                | Until account deletion             |
| Stripe subscription ID      | `subscriptions.stripe_subscription_id` | Admin (service layer), Stripe                                | Until subscription cancellation    |
| Payment card data           | Not stored (Stripe only)               | N/A                                                          | N/A                                |
| Spend event amount/merchant | `spend_events` table                   | Submitting user only                                         | Until user deletes                 |

### Data Minimization

- Email addresses are stored in Supabase Auth only — they are never replicated to the application database tables
- Email is never logged by the application
- User personal phone and home address are never collected; only business contact details are collected for listings
- No behavioral tracking beyond what is written to `analytics_events` by the server
- No third-party advertising or tracking pixels on any page

### Third-Party Data Sharing

- Payment data: Stripe processes and stores payment data. The platform stores only Stripe-assigned identifiers.
- Email sending: Resend receives the user's email address and the email body for transactional email delivery. No marketing list is maintained.
- Error tracking: Sentry (planned for Phase 0) — PII scrubbing rules must be configured before Sentry is enabled (email addresses and user IDs must be scrubbed from Sentry breadcrumbs).
- Analytics: PostHog or equivalent (V1) — no PII in event properties; user identifiers are pseudonymous UUIDs only.

### Account Deletion

Account deletion removes:

- Supabase Auth account (`auth.users` row)
- User's own saves, reviews, spend events, and receipt files
- User's `user_roles` entry

Account deletion does not remove:

- Listings owned by the user (listings are transferred to admin stewardship or unpublished — not deleted — to preserve business records)
- Audit log entries (`admin_audit_log`) — these are compliance records, and their `admin_user_id` FK is set to NULL on user deletion (SET NULL constraint)
- Anonymized aggregate data derived from the user's spend events

The account deletion flow and data handling policy must be documented in the Privacy Policy before launch.

---

## 14. Content Moderation Plan

### Reviews (V1)

| Stage                         | Status     | Visibility                   | SLA                      |
| ----------------------------- | ---------- | ---------------------------- | ------------------------ |
| Submitted                     | `pending`  | Submitter only               | —                        |
| Admin approved                | `approved` | Public                       | 72 hours from submission |
| Admin rejected                | `rejected` | Submitter only (with reason) | 72 hours from submission |
| Owner flagged (post-approval) | `flagged`  | Public until decision        | 48 hours from flag       |

Admin moderation queue at `/admin/reviews` shows all `status = 'pending'` and `status = 'flagged'` reviews sorted by submission time.

### Community Corrections (V1)

| Stage          | Status     | Visibility                   | SLA      |
| -------------- | ---------- | ---------------------------- | -------- |
| Submitted      | `pending`  | Submitter and Admin          | —        |
| Admin applied  | `resolved` | Change visible in listing    | 72 hours |
| Admin rejected | `rejected` | Submitter only (with reason) | 72 hours |

### Flagged Listings

| Action              | Trigger                                  | Admin response options                            | SLA       |
| ------------------- | ---------------------------------------- | ------------------------------------------------- | --------- |
| Flag submitted      | Any authenticated user                   | Dismiss flag / Update listing / Unpublish listing | 48 hours  |
| Listing unpublished | Admin decision                           | Owner notified via email                          | Immediate |
| Listing deleted     | Admin decision (severe policy violation) | Owner notified via email; audit log entry created | Immediate |

### Spam Listings

Spam listings identified through the flag queue or proactive admin monitoring. Admin can: flag, unpublish, soft-delete, or permanently delete. All actions are logged in `admin_audit_log`.

### DMCA Takedown

- DMCA contact email and mailing address published in the footer and Privacy Policy
- Designated agent registered with the US Copyright Office
- Takedown SLA: 5 business days from receipt of a complete DMCA notice
- Counter-notice process: documented in the Privacy Policy
- Takedown actions logged in `admin_audit_log` with `action = 'dmca_takedown'`

### P0 Escalation (Illegal Content, Doxxing, Harassment)

P0 content — illegal material, personally identifiable information posted without consent, targeted harassment — is handled outside the standard SLA:

- Immediate unpublish on identification (no 48-hour window)
- Immediate admin notification (Slack or email alert to founding team)
- Preservation of content evidence before deletion (for potential law enforcement cooperation)
- Legal review before re-publication is considered

---

## 15. HTTPS and Transport Security

### HTTPS Enforcement

- Vercel enforces HTTPS on all custom domains and preview deployments
- HTTP requests are redirected to HTTPS at the Vercel edge before reaching the application
- No HTTP is permitted in production under any circumstances (ADR-011)

### Security Headers

> **Corrected 2026-08-11.** Everything under this heading previously described a
> plan as if it were the build. It claimed five headers configured in
> `next.config.ts` via `headers()`; the file had no `headers()` function and set
> none of them. Four of the five were simply absent in production, and the fifth
> was right by accident. The table below is what is actually served.

| Header                      | Value                                                 | Set by                                            | Purpose                                             |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000`                                    | **Vercel platform default — not project config**  | Enforce HTTPS for 2 years                           |
| `X-Frame-Options`           | `DENY`                                                | `lib/security/headers.ts` → `next.config.ts`      | Prevent clickjacking via iframe embedding           |
| `X-Content-Type-Options`    | `nosniff`                                             | `lib/security/headers.ts` → `next.config.ts`      | Prevent MIME type sniffing                          |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                     | `lib/security/headers.ts` → `next.config.ts`      | Limit referrer information in cross-origin requests |
| `X-Powered-By`              | *removed* (`poweredByHeader: false`)                  | `next.config.ts`                                  | Stop advertising the framework to anyone probing    |

Two things about that table are load-bearing:

- **HSTS is inherited, not owned.** Vercel serves it on this project; nothing in
  the repo asks for it, and it survives only as long as that default does. Its
  `max-age` is two years — longer than the one year this document used to
  propose — and it carries **no** `includeSubDomains`. Adding that directive
  ourselves would bind every present and future subdomain to HTTPS for two
  years, which is hard to reverse and buys nothing on the apex, so it was
  deliberately left alone `[Decision — 2026-08-11]`.
- **`Permissions-Policy` is still not set.** The value this document used to
  claim — `camera=(), microphone=(), geolocation=()` — is unsafe to ship as
  written, because two shipped surfaces use `capture="environment"` file inputs
  (`components/dashboard/MediaGrid.tsx`, `components/spend/ReceiptSubmissionForm.tsx`)
  and whether `camera=()` blocks a capture-hinted file input — as opposed to
  `getUserMedia`, which the app never calls — is unmeasured. Receipt upload is
  the input the entire spend pipeline depends on. Tracked as its own checkpoint
  rather than guessed at here.

The three project-set headers are applied by `next.config.ts` `headers()` on
`/:path*`. That layer reaches middleware redirects as well as rendered routes,
which matters while `COMING_SOON_MODE` 307s every public path
`[Measured — curl against a local production build, 2026-08-11]`.

### Content Security Policy

CSP is not implemented at MVP. This is a documented known gap (see Section 17). At V1, a CSP header will be added that:

- Restricts `script-src` to `'self'` and explicitly listed CDN origins
- Restricts `img-src` to `'self'`, the Supabase Storage CDN origin, and data URIs
- Blocks inline scripts (requires eliminating any inline `<script>` tags — Next.js App Router supports this)
- Is deployed in report-only mode first, then enforced after a two-week observation period

### CORS

Supabase handles its own CORS configuration. The Next.js API routes do not require explicit CORS configuration for same-origin use. If a public API is introduced (V2), CORS will be restricted to the platform's own domain — wildcard (`*`) is not permitted for authenticated routes.

---

## 16. Secret Management

### Environment Variable Discipline

| Secret                    | Variable name                             | Where used                  | Notes                                                |
| ------------------------- | ----------------------------------------- | --------------------------- | ---------------------------------------------------- |
| Supabase project URL      | `NEXT_PUBLIC_SUPABASE_URL`                | Client and server           | Safe to expose — not a secret                        |
| Supabase anon key         | `NEXT_PUBLIC_SUPABASE_ANON_KEY`           | Client and server           | Safe to expose — gated by RLS                        |
| Supabase service role key | `SUPABASE_SERVICE_ROLE_KEY`               | Server-side only            | Never in `NEXT_PUBLIC_*`; never in client components |
| Stripe publishable key    | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (V1) | Client-side Stripe.js only  | Safe to expose                                       |
| Stripe secret key         | `STRIPE_SECRET_KEY` (V1)                  | Server-side only            | Never in `NEXT_PUBLIC_*`                             |
| Stripe webhook secret     | `STRIPE_WEBHOOK_SECRET` (V1)              | Webhook Route Handler only  | Used to validate incoming Stripe events              |
| Resend API key            | `RESEND_API_KEY`                          | Email service layer only    | Server-side only                                     |
| Anthropic API key         | `ANTHROPIC_API_KEY` (V2)                  | `lib/ai/` server layer only | Server-side only                                     |

### Repository Security

- `.gitignore` includes `.env`, `.env.local`, `.env.production`, `.env.staging` — all env files except `.env.example`
- `.env.example` documents all required variables with placeholder values and comments — no real credentials
- Branch protection on `main`: PRs required; direct pushes blocked; at least one reviewer required
- Secret scanning: GitHub secret scanning enabled on the repository; a pre-commit hook using `git-secrets` or `truffleHog` catches secrets before they are committed
- Any secret found in a commit history must be rotated immediately — the history alone is treated as compromised

### Secret Rotation Policy

| Trigger                         | Action                                                                      |
| ------------------------------- | --------------------------------------------------------------------------- |
| Team member with access departs | Rotate all secrets they had access to within 24 hours                       |
| Stripe webhook URL changes      | Rotate `STRIPE_WEBHOOK_SECRET`                                              |
| Suspected credential exposure   | Rotate affected secrets immediately; review audit logs for unauthorized use |
| Routine rotation                | Annually for all secrets                                                    |

### Vercel Environment Variable Access

Environment variables in Vercel are accessible only to team members with Admin or Owner access to the Vercel project. Access is reviewed when team composition changes.

---

## 17. Open Security Gaps at MVP Launch

This section documents security capabilities that are intentionally deferred beyond MVP. These are known gaps, not oversights. Each item has a target phase and an interim mitigation.

| Gap                                       | Risk Level                                   | Interim Mitigation                                                                 | Target Phase                         |
| ----------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| No CAPTCHA on claim/review submission     | Medium                                       | Rate limiting (3/day) + email verification required                                | V1                                   |
| No virus scanning on file uploads         | Medium                                       | MIME type allowlist + size limits block most vectors; no executable types accepted | V1 (ClamAV via Edge Function)        |
| No Content Security Policy header         | Medium                                       | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` — live since 2026-08-11, **not** at MVP as this row previously claimed | V4 (needs a report-only soak first)  |
| `Permissions-Policy` not set              | Low                                          | The app calls no `getUserMedia` and no `getCurrentPosition`; the only camera surfaces are `capture="environment"` file inputs | Next — needs a measurement, not a guess (see Section 15) |
| No formal penetration test                | High (before marketplace)                    | Internal security review of auth flows and RLS policies before launch              | Pre-V2 (before marketplace launch)   |
| No bug bounty program                     | Low (at MVP scale)                           | Internal responsible disclosure contact email in Security Policy                   | V2                                   |
| No SOC 2 compliance                       | Not applicable at MVP scale                  | Reassess at V2 when marketplace introduces financial transaction handling          | V2+ (pending legal review)           |
| No rate limiting on listing media uploads | Low                                          | File size and count limits enforce practical throttling                            | V1                                   |
| No admin IP allowlisting                  | Low                                          | Admin role check + audit logging provides compensating control                     | V1 (evaluate based on incident risk) |
| Sentry PII scrubbing not configured       | Medium (if Sentry enabled before configured) | Do not enable Sentry in production until PII scrubbing rules are confirmed         | Phase 0 prerequisite                 |
| Receipt admin access process undefined    | Medium (V2 relevance)                        | No support flow for admin to access receipts exists; document before V2 launch     | Pre-V2                               |

### Pre-V2 Security Checklist (before marketplace launch)

Before V2 (Stripe Connect, marketplace transactions) launches, the following must be completed:

- [ ] Formal penetration test of auth flows, RLS policies, file upload paths, and payment endpoints
- [ ] Bug bounty or responsible disclosure program established
- [ ] CAPTCHA on all submission forms (V1 completion)
- [ ] Virus scanning on all file upload paths (V1 completion)
- [ ] CSP header enforced (not report-only) (V1 completion)
- [ ] Receipt admin access escalation process documented and reviewed
- [ ] Stripe Radar fraud rules configured for marketplace transactions
- [ ] Data residency review completed (Supabase region selection confirmed)
- [ ] Legal review of Privacy Policy for marketplace payment data handling

---

## Appendix: Enforcement Layer Summary

A quick reference for where each security control is enforced.

| Control                         | DB (RLS)                   | Service Layer | Middleware         | Storage Policy        |
| ------------------------------- | -------------------------- | ------------- | ------------------ | --------------------- |
| Anonymous read-only             | Yes                        | —             | —                  | Yes (private buckets) |
| Ownership enforcement           | Yes                        | Yes           | —                  | —                     |
| Admin role check                | No (service role bypasses) | Yes           | Yes                | —                     |
| Suspended account block         | No                         | Yes           | Yes                | —                     |
| JWT in httpOnly cookie          | —                          | —             | Yes (Supabase SSR) | —                     |
| Verification doc access control | Yes                        | Yes           | —                  | Yes                   |
| Receipt access control          | Yes                        | Yes           | —                  | Yes                   |
| MIME type validation            | —                          | Yes           | —                  | —                     |
| File size enforcement           | —                          | Yes           | —                  | —                     |
| Rate limiting                   | —                          | Yes           | Yes                | —                     |
| Duplicate detection             | DB constraint              | Yes           | —                  | —                     |
| Audit logging                   | DB trigger (immutability)  | Yes           | —                  | —                     |
| Review pending-only on insert   | Yes                        | Yes           | —                  | —                     |
| Aggregate anonymization         | —                          | Yes           | —                  | —                     |
| Storage path construction       | —                          | Yes           | —                  | —                     |
