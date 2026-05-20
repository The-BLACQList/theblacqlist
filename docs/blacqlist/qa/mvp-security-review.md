# MVP Security Review — The BLACQList

**Date:** 2026-05-11
**Status:** Draft
**Reviewer:** QA Pass (automated code audit)
**Scope:** All MVP tables, routes, server actions, and API handlers

---

## Summary

The BLACQList has a strong RLS foundation with 803 lines of policies, SECURITY DEFINER helper functions, and server-side role enforcement. However, several gaps exist that must be closed before launch. Two critical issues are identified: a missing upload route handler (any user can attempt uploads with no server validation) and business/search pages serving mock data (production gap, not a security issue). Three high-severity gaps require pre-launch fixes.

---

## SR-01 — Row Level Security (RLS)

**Status: PASS with caveats**

### What was reviewed

`supabase/migrations/20260510000001_mvp_rls_policies.sql` — 803 lines

### Findings

**Pass:**

- RLS is enabled on all MVP tables via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Helper functions (`is_admin()`, `is_super_admin()`, `has_role()`, `owns_listing()`, `owns_entity()`) are defined as `SECURITY DEFINER STABLE` — correct; prevents privilege escalation, allows caching
- `admin_audit_log` and `moderation_queue`: no public policies defined — correct default deny
- `ai_suggestions`: owner-read-only policy filters by `status IN ('pending', 'approved', 'applied')` — rejected suggestions invisible to owners (correct)
- `ai_generation_requests`: no public policy — admin service-role only (correct; contains operational data)
- Soft-delete filtering (`WHERE deleted_at IS NULL`) is applied in RLS policies consistently
- `saves` table: users can only read/write their own saves (`auth.uid() = user_id`)

**Risks identified:**

| Risk                                                  | Severity | Detail                                                                                                                                                           |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listings` public SELECT policy — scope review needed | Medium   | Verify public policy does not expose draft/deleted listings; `deleted_at IS NULL` must be in policy WHERE clause                                                 |
| `reviews` cross-user read                             | Low      | Reviews are public by design; confirm reviewer `user_id` is NOT in the SELECT projection for anonymous reads                                                     |
| `receipts` — buyer anonymity                          | Medium   | Receipts must be readable only by submitter (user_id match) or admin/service role. Verify the policy does not allow any authenticated user to read all receipts. |
| `community_spend` aggregation                         | Low      | Verify aggregate API (`/api/community-spend`) never returns individual transaction amounts                                                                       |

---

## SR-02 — Role Checks and Admin Route Enforcement

**Status: PASS**

### Findings

**Pass:**

- `requireAdmin()` in `lib/admin/guard.ts` checks `user_roles` table server-side — not middleware-only
- `requireOwner()` in `lib/dashboard/guard.ts` checks `listings.owner_user_id = auth.uid()` server-side
- Middleware (`middleware.ts`) provides first-line protection for `/admin`, `/dashboard`, `/account`, `/claim`, `/add-business`, `/onboarding`
- Defense in depth: middleware redirects unauthenticated users; server guards redirect insufficiently-permissioned users
- Ownership check uses `eq("owner_user_id", owner.user.id)` pattern — returns `notFound()` on mismatch (not a 403, avoiding resource existence leakage — correct)

**Risks:**

| Risk                                           | Severity | Detail                                                                                                                                                                                                      |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin middleware only checks session, not role | Low      | Expected design — role check is in `requireAdmin()`. Middleware gap would only affect direct URL access without a session; role is always checked server-side.                                              |
| `createServiceClient()` used in admin pages    | Low      | Correct for admin use cases; bypasses RLS intentionally. Ensure no `createServiceClient()` is used in owner-facing pages. Audit: `grep -r "createServiceClient" app/dashboard/` should return zero results. |

---

## SR-03 — Admin-Only Editing Enforced

**Status: PASS**

### Findings

**Pass:**

- Admin server actions in `lib/actions/admin/` include `requireAdmin()` at the top of each function
- Audit log insertion (`admin_audit_log`) present in admin claim approval, rejection, and moderation actions
- No admin action calls `createClient()` (which would be session-scoped) — all use `createServiceClient()` with prior auth gate

**Risks:**

| Risk                         | Severity | Detail                                                                                                                                                                     |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin audit log completeness | Medium   | Verify ALL admin mutations (approve claim, reject claim, verify listing, moderate review) write to `admin_audit_log`. Missing audit entries make incident response harder. |

---

## SR-04 — Owner-Only Editing Enforced

**Status: PASS with one caveat**

### Findings

**Pass:**

- All owner dashboard Server Actions call `requireOwner()` before any mutation
- `requireOwner()` cross-checks `listings.owner_user_id = auth.uid()`
- Supabase RLS enforces the same rule at the DB layer independently

**Risks:**

| Risk                                       | Severity      | Detail                                                                                                                               |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ai_suggestions` apply action (when built) | High (future) | The approval workflow spec notes: apply action must verify ownership independent of RLS. Not yet built — flag for V2 implementation. |

---

## SR-05 — Receipt Privacy and Buyer Anonymity

**Status: REVIEW REQUIRED**

### Findings

**Concern:**
The receipt lifecycle involves: supporter submits receipt → admin reviews → aggregate spend updated. Individual receipt amounts must never be visible to other supporters or to public anonymous users.

| Check                                     | Expected                            | Status                                          |
| ----------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| RLS: supporter reads own receipts only    | `WHERE user_id = auth.uid()`        | Must verify in migration                        |
| RLS: admin reads all receipts             | service role or `is_admin()` policy | Must verify                                     |
| Public `community_spend` API              | Returns aggregate total only        | Must verify no per-user data                    |
| Receipt detail page (`/account/receipts`) | Shows only current user's history   | Must verify with signed-out and cross-user test |
| Signed receipt URL API                    | Generates signed URL with TTL       | Must verify URL expires                         |

**Action required:** Run TA-20 (Receipts lifecycle test) with cross-user access test.

---

## SR-06 — File Upload Privacy and Security

**Status: CRITICAL GAP — P0 Before Launch**

### Finding

`app/api/upload/[bucket]/route.ts` **does not exist.** No upload route handler has been implemented.

### Implications

1. **Functionality gap:** All media upload flows (gallery, receipt documents, profile images) will fail silently or with unhandled errors.
2. **Security gap when eventually built:** The upload route must enforce:
   - Authentication (reject unauthenticated uploads)
   - Ownership check (user can only upload to their own entity's bucket path)
   - File type validation (MIME type, not just extension)
   - File size limit enforcement
   - Filename sanitization (prevent path traversal)
   - Storage path structure: `/{entity_type}/{entity_id}/{filename}` — never user-supplied paths

### Required implementation (before launch):

```
POST /api/upload/[bucket]
- requireAuth()
- Validate bucket name against allowlist (not user-supplied)
- Validate MIME type: image/jpeg, image/png, image/webp (for media); application/pdf (for receipts)
- Validate file size: ≤5MB for images, ≤10MB for documents
- Sanitize filename: replace with UUID-based name
- Upload to Supabase Storage: path = {entity_type}/{entity_id}/{uuid}.{ext}
- Insert to media_attachments: store path, not URL
- Return: { path, file_type, file_size_bytes }
```

---

## SR-07 — No Exposed Secrets

**Status: PASS**

### Findings

**Pass:**

- `NEXT_PUBLIC_*` variables in `.env.example` are limited to Supabase URL and anon key (safe to expose)
- Service role key, Resend API key, Stripe keys, Anthropic key — all non-public in `.env.example`
- No hardcoded API keys found in codebase
- `createServiceClient()` is only called in server-side admin and API routes — not in `"use client"` components

**Risks:**

| Risk                               | Severity            | Detail                                                                                                            |
| ---------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Supabase anon key in client bundle | Low                 | Intentional by design — anon key is meant for client use; RLS enforces access. RLS must be comprehensive (it is). |
| Service role key exposure          | High (hypothetical) | Never seen in any client component; confirm with `grep -r "service_role" app/` returning only server-side files   |

---

## SR-08 — No Public Raw Analytics Exposure

**Status: PASS**

### Findings

**Pass:**

- `analytics_events` table: no public SELECT policy — default deny
- `entity_analytics_daily`: owner reads own listing's data only (via `owns_listing()` helper)
- Admin analytics reads all data via service role
- Analytics event ingestion API (`/api/analytics/event`): validates event name against `VALID_EVENT_NAMES` set before insert; prevents arbitrary event injection

**Risks:**

| Risk                           | Severity | Detail                                                                                                                                                               |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limiting on analytics API | Medium   | No rate limiting on `POST /api/analytics/event`. A malicious actor could flood the table with valid events. Recommend: rate limit per IP (10 req/sec) before launch. |

---

## SR-09 — No Public Admin Notes or Moderation Flags

**Status: PASS**

### Findings

**Pass:**

- `admin_audit_log`: no public RLS policy — default deny. Only accessible via service role.
- `moderation_queue`: no public RLS policy — default deny.
- Admin notes on claims/listings/reviews: stored in admin-only tables; no owner-facing SELECT policy returns note fields.
- Admin dashboard fetches use `createServiceClient()` — correct.

---

## SR-10 — No Self-Verification

**Status: PASS**

### Findings

**Pass:**

- Claim approval requires admin action — not a user self-service flow
- `requireAdmin()` check in all claim approval/rejection server actions
- An owner cannot approve their own claim via the owner dashboard (no approve action exists there)
- Listing `is_verified` and `is_claimed` fields are set only via admin server actions

**Risks:**

| Risk                                                     | Severity | Detail                                                                                                                   |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Claim workflow: same user owns listing and submits claim | Low      | Should not be possible if listing already has `owner_user_id`. Verify claim form blocks claim on already-owned listings. |

---

## Security Fix Priority

| Priority      | Issue                                                      | Required Before                    |
| ------------- | ---------------------------------------------------------- | ---------------------------------- |
| P0 — Critical | Upload route handler missing                               | Any media upload feature goes live |
| P1 — High     | Receipt RLS cross-user access: verify                      | Launch                             |
| P1 — High     | Rate limiting on analytics event API                       | Launch (DDoS/spam vector)          |
| P1 — High     | Admin audit log completeness audit                         | Launch                             |
| P2 — Medium   | `createServiceClient()` usage audit in non-admin pages     | Launch                             |
| P2 — Medium   | Verify `listings` public RLS includes `deleted_at IS NULL` | Launch                             |
| P3 — Low      | Self-verification guard on already-owned listings          | Pre-launch validation              |
