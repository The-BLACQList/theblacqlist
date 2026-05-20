# RLS Policy Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Approved for implementation
**Audience:** Engineers writing Supabase RLS policies
**Owner:** Backend Engineering
**Source documents:**
- `docs/blacqlist/architecture/security-and-privacy-plan.md`
- `docs/blacqlist/data/entity-content-model.md`

This document is the authoritative specification for every Row Level Security policy on The BLACQList database. Engineers must read this document before writing a single RLS policy. Policies that deviate from this specification must be reviewed by the backend lead before merging.

---

## 1. RLS Principles

### Universal enforcement

RLS is enabled on every table without exception. There is no table for which RLS is disabled in any environment — including development. If a development workflow requires bypassing RLS, it must use the service role key in a local server-side context, not disable RLS on the table.

### Default deny

The PostgreSQL default when RLS is enabled and no policy matches is to return zero rows on SELECT and reject INSERT/UPDATE/DELETE. This is the correct behavior. Do not write a "catch-all allow" policy to make development easier — it will ship to production.

### Supabase role model

The BLACQList maps its five application roles to three Supabase database roles:

| Supabase Role | Who uses it | Scope |
|---|---|---|
| `anon` | Unauthenticated visitors | SELECT on published, non-deleted public rows only |
| `authenticated` | All signed-in users (Supporter, Owner, Admin, Super Admin) | SELECT on public data + own records; differentiated by `user_roles` lookup |
| `service_role` | Server-side only — Admin and Super Admin actions | Bypasses RLS entirely; used exclusively in Server Actions and Route Handlers |

### service_role key discipline

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. It is stored in a server-only environment variable (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_*`) and used exclusively in:
- `app/actions/` Server Actions
- `app/api/` Route Handlers

It is never imported in any file marked `"use client"`. It is never logged. It is never returned in any API response body. A code review finding the service role key in client-accessible code is an immediate blocker.

### Role differentiation within `authenticated`

The `authenticated` Supabase role covers Supporters, Owners, Admins, and Super Admins. RLS policies cannot distinguish between them using the JWT alone — role is stored in the `user_roles` table, not in JWT claims. The pattern for role-gated RLS policies is:

```sql
EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin')
)
```

However, for most admin mutations, the service_role path is used instead of writing broad `authenticated` RLS policies for admin access. This keeps RLS policies focused on user-facing access control.

### RLS as the last line of defense

RLS is not the only security control. It is the last line of defense at the database layer. The enforcement stack is:
1. Middleware — route-level auth and role checks
2. Server Actions / Route Handlers — session validation and service-layer permission checks
3. RLS — database-level enforcement, regardless of what the application layer does

A bug in application code that constructs an unexpected query will still be blocked by RLS. This is the value of having RLS enabled on every table.

---

## 2. Role Model Summary

### Five platform roles mapped to Supabase auth

| Platform Role | Supabase Role | How role is known | Key permissions |
|---|---|---|---|
| **Anonymous** | `anon` | No session | SELECT published, non-deleted public data only |
| **Supporter** | `authenticated` | `user_roles.role = 'supporter'` | Own saves, own reviews (V1), own spend events (V2) |
| **Owner** | `authenticated` | `user_roles.role = 'owner'` | Own listings and all child records; own claim history |
| **Admin** | `authenticated` + service_role | `user_roles.role = 'admin'` | All mutations via service_role; SELECT all records via service_role |
| **Super Admin** | `authenticated` + service_role | `user_roles.role = 'super_admin'` | All Admin permissions + audit log (all entries) + role management |

### How `auth.uid()` is used in policies

`auth.uid()` returns the UUID of the currently authenticated user from the Supabase JWT. It is available in all RLS policy expressions on the `authenticated` role. It returns `NULL` for the `anon` role — any policy expression that includes `auth.uid() = some_column` will evaluate to false for unauthenticated requests, providing safe defaults.

### How role checks work

Role checks in RLS policies use a subquery against `user_roles`:

```sql
-- Owner check
auth.uid() = owner_user_id

-- Own record check
auth.uid() = user_id

-- Admin/Super Admin check (for SELECT policies)
EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin')
)

-- Owner's listing membership (for child record access)
listing_id IN (
  SELECT id FROM listings
  WHERE owner_user_id = auth.uid()
  AND deleted_at IS NULL
)
```

Role checks are not cached in the JWT and take effect immediately when `user_roles` is updated. A user's role change is reflected on the next request without requiring token re-issue.

---

## 3. Enforcement Layer Matrix

This matrix shows where each security control is enforced across the system. Every row should have at least one `Yes` — preferably two for critical controls.

| Control | DB RLS | Service Layer | Middleware | Storage Policy |
|---|---|---|---|---|
| Anonymous read-only on public data | Yes | — | — | Yes (private buckets) |
| Published + non-deleted filter on public SELECT | Yes | — | — | — |
| Ownership enforcement (owner edits own listing) | Yes | Yes | — | — |
| Admin role check before mutation | No (service_role bypasses) | Yes | Yes | — |
| Super Admin role check | No (service_role bypasses) | Yes | Yes | — |
| Suspended account block | No | Yes | Yes | — |
| JWT stored in httpOnly cookie | — | — | Yes (Supabase SSR) | — |
| Verification document access control | Yes | Yes | — | Yes (private bucket) |
| Receipt access control | Yes | Yes | — | Yes (private bucket) |
| MIME type validation on upload | — | Yes | — | — |
| File size enforcement | — | Yes | — | — |
| Rate limiting (search, auth, claim, review) | — | Yes | Yes | — |
| Duplicate listing detection | DB constraint (slug UNIQUE) | Yes (similarity) | — | — |
| Audit log immutability | Yes (trigger) | — | — | — |
| Review pending-only on insert | Yes | Yes | — | — |
| Analytics aggregate anonymization | — | Yes | — | — |
| Storage path construction (no user input) | — | Yes | — | — |
| Spend event user isolation | Yes | Yes | — | — |
| Soft-delete filter (deleted_at IS NULL) | Yes | Yes | — | — |
| One review per user per listing | Yes (UNIQUE constraint) | Yes | — | — |
| Claims status transitions | No | Yes | — | — |
| Admin audit log insert | No (service_role only) | Yes | — | — |

---

## 4. Per-Table RLS Policies

The following sections define the RLS policy for every table in the BLACQList database, organized by phase. The notation `service_role` in the table means admin and super admin operations are conducted via the Supabase service role key in server-side code, which bypasses RLS. No explicit RLS policy is needed for service_role access — it inherits bypass by default.

---

### profiles

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Profiles are not publicly accessible |
| SELECT | authenticated | `auth.uid() = id` | Users can read their own profile only |
| INSERT | authenticated | `auth.uid() = id` | Triggered by auth signup via database trigger; users cannot manually insert another user's profile |
| UPDATE | authenticated | `auth.uid() = id` | Users can update their own profile only |
| DELETE | authenticated | None (deny) | Profile deletion goes through account deletion flow via service_role |
| All ops | service_role | Bypass RLS | Admin user management operations |

---

### user_roles

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Role data is not public |
| SELECT | authenticated | `auth.uid() = user_id` | Users can read their own role record only; determines what UI to show them |
| INSERT | authenticated | None (deny) | Role assignment is an admin-only operation; no user can self-assign a role |
| UPDATE | authenticated | None (deny) | Same — role changes via service_role only |
| DELETE | authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin assigns, changes, and revokes roles |

---

### listings

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `status = 'published' AND deleted_at IS NULL` | Unauthenticated visitors see only live, non-deleted listings |
| SELECT | authenticated | `(status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL)` | Supporters see published + non-deleted. Owners additionally see their own drafts and unpublished listings |
| INSERT | authenticated | `auth.uid() IS NOT NULL` | Any authenticated user can create a listing; `owner_user_id` is set to `auth.uid()` at insert time; status defaults to `'draft'` |
| UPDATE | authenticated | `owner_user_id = auth.uid() AND deleted_at IS NULL` | Owners can only update their own non-deleted listings; status transitions from `draft` to `submitted` only — service layer enforces valid transitions |
| DELETE | authenticated | None (deny) | No hard deletes via authenticated role; soft delete via service_role sets `deleted_at` |
| All ops | service_role | Bypass RLS | Admin creates, edits, publishes, flags, soft-deletes, and restores listings |

---

### listing_details_business

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Only for published, non-deleted parent listings |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Same as listings SELECT policy extended to child records |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner can only insert details for listings they own |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Same ownership gate |
| DELETE | authenticated | None (deny) | Details are deleted via CASCADE when parent listing is soft-deleted; service_role handles hard cascade if needed |
| All ops | service_role | Bypass RLS | Admin management |

---

### listing_details_professional

**Phase:** Beta
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Published parent only |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Own + published |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Ownership gate |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Ownership gate |
| DELETE | authenticated | None (deny) | CASCADE from parent or service_role |
| All ops | service_role | Bypass RLS | Admin management |

---

### listing_details_creative

**Phase:** Beta
**RLS:** Enabled

Identical policy structure to `listing_details_professional`. Ownership gate via `listing_id` FK to `listings` where `owner_user_id = auth.uid()`.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### listing_details_event

**Phase:** Beta
**RLS:** Enabled

Identical ownership-gate structure. Event pages are public once the parent listing is published, including after auto-archive (archived events remain readable but are de-indexed via `noindex`).

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### listing_details_job

**Phase:** Beta
**RLS:** Enabled

Identical ownership-gate structure to all other extension tables.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### listing_details_vendor

**Phase:** V2
**RLS:** Enabled

`stripe_connect_id` must never be returned in a SELECT response visible to a non-admin user. This is enforced at the service layer (column exclusion in queries), not at the RLS level — RLS cannot filter individual columns. Engineers must ensure no client-facing query returns `stripe_connect_id`.

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Public vendor storefront data; stripe_connect_id excluded at service layer |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Own vendor details |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner gate |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner gate; Stripe Connect status synced via service_role webhook handler |
| DELETE | authenticated | None (deny) | |
| All ops | service_role | Bypass RLS | Stripe Connect webhook updates, admin management |

---

### services

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Only services for published listings |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Own + public |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner gate |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner gate |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner can delete own services |
| All ops | service_role | Bypass RLS | Admin management |

---

### media_attachments

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `entity_type = 'listing' AND entity_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Only media for published listings; no access to verification docs or receipts via this table |
| SELECT | authenticated | `(entity_type = 'listing' AND entity_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))) OR (uploaded_by = auth.uid())` | Own uploads + public listing media |
| INSERT | authenticated | `entity_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Can only attach media to own listings; `entity_type` must be `'listing'` for authenticated role |
| UPDATE | authenticated | `uploaded_by = auth.uid()` | Can update only own uploads (e.g., alt text, display_order) |
| DELETE | authenticated | `uploaded_by = auth.uid()` | Can delete own uploaded media |
| All ops | service_role | Bypass RLS | Admin can manage all media; verification doc handling |

**Storage note:** The `verification-docs` and `receipts` buckets are not accessible via this RLS policy or any authenticated path. Those buckets are private and accessed via service_role signed URLs only.

---

### categories

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `true` (all rows) | Categories are fully public reference data |
| SELECT | authenticated | `true` (all rows) | Same |
| INSERT | anon / authenticated | None (deny) | Categories are admin-managed reference data only |
| UPDATE | anon / authenticated | None (deny) | Same |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin manages the category tree |

---

### cities

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `true` (all rows) | Cities are fully public reference data |
| SELECT | authenticated | `true` (all rows) | Same |
| INSERT | anon / authenticated | None (deny) | Cities are admin-managed reference data only |
| UPDATE | anon / authenticated | None (deny) | Same |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin manages city records |

---

### states

**Phase:** MVP
**RLS:** Enabled

Identical policy to `cities` — fully public SELECT, admin-only writes via service_role.

---

### listing_hours

**Phase:** MVP
**RLS:** Enabled

`listing_hours` is a supporting table for structured hours data when stored separately from the `jsonb` hours field on `listing_details_business`. Policies mirror the listing detail extension pattern.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| All ops | service_role | Bypass RLS |

---

### listing_links

**Phase:** MVP
**RLS:** Enabled

Identical ownership-gate pattern to `listing_hours`.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| All ops | service_role | Bypass RLS |

---

### claims

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Claim records are not public |
| SELECT | authenticated | `claimant_user_id = auth.uid()` | Users can see their own claim submissions and status only |
| INSERT | authenticated | `auth.uid() IS NOT NULL` | Any authenticated user can submit a claim; `claimant_user_id` is set to `auth.uid()` at insert time |
| UPDATE | authenticated | None (deny) | Status transitions are admin-only operations via service_role |
| DELETE | authenticated | None (deny) | Claims are never deleted — they are the audit record of ownership history |
| All ops | service_role | Bypass RLS | Admin reviews, approves, and rejects claims |

---

### saves

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Save data is not public |
| SELECT | authenticated | `user_id = auth.uid()` | Users see only their own saves |
| INSERT | authenticated | `user_id = auth.uid()` | Users can only save on their own behalf; `user_id` must equal `auth.uid()` |
| UPDATE | authenticated | None (deny) | No update path for saves; delete and re-insert |
| DELETE | authenticated | `user_id = auth.uid()` | Users can unsave their own saves |
| All ops | service_role | Bypass RLS | Admin can clear saves if needed (e.g., account deletion) |

---

### reviews

**Phase:** MVP (data model defined); V1 (active with moderation)
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `status = 'approved'` | Only approved reviews are publicly visible |
| SELECT | authenticated | `status = 'approved' OR reviewer_user_id = auth.uid()` | Authenticated users can see all approved reviews plus their own pending/rejected reviews |
| INSERT | authenticated | `auth.uid() IS NOT NULL` | `reviewer_user_id` set to `auth.uid()` at insert time; `status` forced to `'pending'` — service layer rejects any insert with `status != 'pending'` |
| UPDATE | authenticated | None (deny) | Reviews are immutable after submission — no updates permitted from any authenticated user |
| DELETE | authenticated | None (deny) | Reviews cannot be deleted by users; admin deletion via service_role only |
| All ops | service_role | Bypass RLS | Admin approves, rejects, flags, or deletes reviews |

---

### collections

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `is_published = true` | Only published collections are publicly visible |
| SELECT | authenticated | `is_published = true` | Same as anon — collections are either public or admin-only |
| INSERT | anon / authenticated | None (deny) | Collections are admin-created only |
| UPDATE | anon / authenticated | None (deny) | Same |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin creates and manages collections |

---

### collection_items

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `collection_id IN (SELECT id FROM collections WHERE is_published = true)` | Only items in published collections |
| SELECT | authenticated | `collection_id IN (SELECT id FROM collections WHERE is_published = true)` | Same |
| INSERT | anon / authenticated | None (deny) | Admin-only via service_role |
| UPDATE | anon / authenticated | None (deny) | Same |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin manages collection membership |

---

### analytics_events

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Analytics are not public |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Owners can only see analytics for their own listings |
| INSERT | anon / authenticated | None (deny) | Events are written server-side only via Server Actions; no client-side inserts permitted |
| UPDATE | anon / authenticated | None (deny) | Analytics events are immutable |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Server-side event writes and admin analytics access |

---

### search_events

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Search telemetry is not public |
| SELECT | authenticated | None (deny) | Individual users do not access search event records |
| INSERT | anon / authenticated | None (deny) | Server-side writes only |
| All ops | service_role | Bypass RLS | Server-side logging; admin analytics |

---

### entity_analytics_daily

**Phase:** MVP
**RLS:** Enabled

Pre-aggregated daily analytics summaries per listing. Owners read their own listing's aggregates.

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Not public |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Owner reads own listing's aggregates only |
| INSERT | anon / authenticated | None (deny) | Populated by scheduled aggregation job via service_role |
| UPDATE | anon / authenticated | None (deny) | Same |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Aggregation job and admin access |

---

### admin_audit_log

**Phase:** MVP
**RLS:** Enabled
**Special rule:** Immutable — no UPDATE or DELETE from any role including service_role (enforced by trigger)

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Audit logs are not public |
| SELECT | authenticated | None (deny) | Audit logs are not accessible via authenticated role directly; access is through service_role only with admin role check in service layer |
| INSERT | anon / authenticated | None (deny) | Only service_role can insert; every admin mutation writes a record before returning |
| UPDATE | All roles | None (deny — trigger) | DB trigger raises `EXCEPTION 'admin_audit_log is immutable'` on any UPDATE attempt |
| DELETE | All roles | None (deny — trigger) | DB trigger raises `EXCEPTION 'admin_audit_log is immutable'` on any DELETE attempt |
| All ops | service_role (SELECT/INSERT) | Bypass RLS | INSERT: any admin action. SELECT: Super Admin sees all; Admin sees own entries (filtered in service layer) |

See Section 6 for the immutability trigger specification.

---

### moderation_queue

**Phase:** MVP
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Not public |
| SELECT | authenticated | None (deny) | Moderation queue is admin-only |
| INSERT | anon / authenticated | None (deny) | Queue entries created by service_role on flag submission |
| UPDATE | anon / authenticated | None (deny) | Resolutions via service_role |
| DELETE | anon / authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin works the moderation queue |

---

### corrections

**Phase:** Beta
**RLS:** Enabled

Community corrections allow authenticated users to submit factual corrections for admin review.

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Corrections are not public |
| SELECT | authenticated | `submitter_user_id = auth.uid()` | Users can see their own submitted corrections and status |
| INSERT | authenticated | `auth.uid() IS NOT NULL` | Any authenticated user can submit a correction; `submitter_user_id` set to `auth.uid()` |
| UPDATE | authenticated | None (deny) | Corrections are immutable after submission; admin handles via service_role |
| DELETE | authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin reviews and resolves corrections |

---

### review_responses

**Phase:** Beta
**RLS:** Enabled

Business owners can respond to approved reviews on their own listings.

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `review_id IN (SELECT id FROM reviews WHERE status = 'approved')` | Public when the parent review is approved |
| SELECT | authenticated | `review_id IN (SELECT id FROM reviews WHERE status = 'approved') OR listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Own listing responses at any status |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner can only respond to reviews on own listings; one response per review enforced by UNIQUE constraint |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owner can edit own responses |
| DELETE | authenticated | None (deny) | Owner cannot delete responses; admin via service_role |
| All ops | service_role | Bypass RLS | Admin moderation |

---

### review_reports

**Phase:** Beta
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Not public |
| SELECT | authenticated | `reporter_user_id = auth.uid()` | Reporters can see their own flags |
| INSERT | authenticated | `auth.uid() IS NOT NULL` | Any authenticated user can flag a review; `reporter_user_id` set to `auth.uid()` |
| UPDATE | authenticated | None (deny) | Status transitions via service_role |
| DELETE | authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Admin resolves reports |

---

### tags

**Phase:** Beta
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `true` (all rows) |
| SELECT | authenticated | `true` (all rows) |
| INSERT | anon / authenticated | None (deny) |
| UPDATE | anon / authenticated | None (deny) |
| DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### listing_tags

**Phase:** Beta
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Tags for published listings only |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Own + published |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owners add tags to own listings |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owners remove tags from own listings |
| All ops | service_role | Bypass RLS | Admin tag management |

---

### neighborhoods

**Phase:** Beta
**RLS:** Enabled

Reference data. Publicly readable; admin-managed.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `true` (all rows) |
| SELECT | authenticated | `true` (all rows) |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### plans

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `is_active = true` | Public plans page reads active plans |
| SELECT | authenticated | `is_active = true` | Same |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Plans are admin-managed via service_role |
| All ops | service_role | Bypass RLS | Admin manages plan definitions |

---

### subscriptions

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Subscription data is not public |
| SELECT | authenticated | `user_id = auth.uid() OR listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Users see their own subscription; owners see their listing's subscription |
| INSERT | authenticated | None (deny) | Subscriptions created via Stripe webhook handler (service_role) |
| UPDATE | authenticated | None (deny) | Managed via Stripe webhooks only |
| DELETE | authenticated | None (deny) | Same |
| All ops | service_role | Bypass RLS | Stripe webhook handlers; admin billing management |

---

### sponsored_placements

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `is_active = true AND expires_at > now()` | Active sponsored placements used for rendering sponsored labels in search/category pages |
| SELECT | authenticated | `is_active = true AND expires_at > now() OR listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Owners can see their own placements |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Managed by admin and Stripe webhooks via service_role |
| All ops | service_role | Bypass RLS | Admin assigns placements; expiry jobs clear expired placements |

---

### editorial_articles

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `status = 'published'` | Published articles are public |
| SELECT | authenticated | `status = 'published'` | Same — authenticated users have no additional article access |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Admin-created via service_role |
| All ops | service_role | Bypass RLS | Admin manages editorial content |

---

### guides

**Phase:** V1
**RLS:** Enabled

Identical policy to `editorial_articles`.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `status = 'published'` |
| SELECT | authenticated | `status = 'published'` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### guide_sections

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `guide_id IN (SELECT id FROM guides WHERE status = 'published')` |
| SELECT | authenticated | `guide_id IN (SELECT id FROM guides WHERE status = 'published')` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### verification_submissions

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Verification submissions are never public |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Owners can see their own verification submission status (not the document paths) |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owners submit verification for their own listings |
| UPDATE | authenticated | None (deny) | Status transitions via service_role only |
| DELETE | authenticated | None (deny) | Document auto-purge via scheduled service_role job |
| All ops | service_role | Bypass RLS | Admin reviews verification queue; document storage path management |

**PII note:** `doc_paths[]` contains paths to the `verification-docs` private bucket. Owners can see their submission record via SELECT but the service layer must exclude `doc_paths` from the SELECT columns returned to authenticated users. `doc_paths` is returned only via service_role for admin review.

---

### receipt_uploads

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Receipts are private financial records |
| SELECT | authenticated | `user_id = auth.uid()` | Users can see only their own receipt records |
| INSERT | authenticated | `user_id = auth.uid()` | Users upload their own receipts; `user_id` must equal `auth.uid()` |
| UPDATE | authenticated | None (deny) | Receipt records are immutable; any corrections go through a spend_events update |
| DELETE | authenticated | `user_id = auth.uid()` | Users can delete their own receipt records; Server Action also deletes the Storage file |
| All ops | service_role | Bypass RLS | Backend OCR processing and admin escalation |

---

### spend_events

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Spend data is private |
| SELECT | authenticated | `user_id = auth.uid()` | Users see only their own spend events |
| INSERT | authenticated | `user_id = auth.uid()` | Users can only create spend events on their own behalf |
| UPDATE | authenticated | `user_id = auth.uid()` | Users can update their own events (e.g., confirm OCR attribution) |
| DELETE | authenticated | `user_id = auth.uid()` | Users can delete their own spend events; triggers Storage file deletion via Server Action |
| All ops | service_role | Bypass RLS | Marketplace purchase recording; aggregate computation for flow map; admin spot-check |

**Privacy note:** `user_id` is never included in any aggregate query result returned to the frontend. The service layer enforces this at query construction time. Raw `spend_events` rows are never passed to any client-facing component.

---

### products

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `status = 'active' AND vendor_listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` | Only active products on published vendor listings |
| SELECT | authenticated | `status IN ('active','draft') AND vendor_listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` | Owners can see their own draft products |
| INSERT | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Vendor owners manage own products |
| UPDATE | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Same |
| DELETE | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Owners can delete own products; archived products preserved for order history |
| All ops | service_role | Bypass RLS | Admin management; Stripe product sync |

---

### orders

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Orders are private |
| SELECT | authenticated | `buyer_user_id = auth.uid() OR vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Buyers see own orders; vendors see orders on their listings |
| INSERT | authenticated | None (deny) | Orders created via Stripe checkout webhook (service_role) |
| UPDATE | authenticated | None (deny) | Order status managed via Stripe webhooks via service_role |
| DELETE | authenticated | None (deny) | Orders are permanent records |
| All ops | service_role | Bypass RLS | Stripe webhook order management; admin dispute resolution |

---

### order_items

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | `order_id IN (SELECT id FROM orders WHERE buyer_user_id = auth.uid() OR vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid()))` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### ai_suggestions

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | AI suggestions are private |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Owners see suggestions for own listings only |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Suggestions generated by AI service via service_role |
| All ops | service_role | Bypass RLS | AI generation and admin review |

---

### ai_generation_requests

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | `requested_by = auth.uid()` |
| INSERT | authenticated | `requested_by = auth.uid()` |
| UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### ai_moderation_flags

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | None (deny) |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### platform_analytics_daily

**Phase:** V1
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Platform analytics are admin-only |
| SELECT | authenticated | None (deny) | Same — not exposed to owners or supporters |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Populated by scheduled aggregation job |
| All ops | service_role | Bypass RLS | Admin analytics dashboard reads |

---

### community_impact_daily

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `true` (all rows) | Community impact aggregates are public — this is the public-facing data layer for the flow map |
| SELECT | authenticated | `true` (all rows) | Same |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Populated by scheduled aggregation job via service_role |
| All ops | service_role | Bypass RLS | Aggregation pipeline |

---

### flow_nodes

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `true` (all rows) | Flow nodes are public visualization data |
| SELECT | authenticated | `true` (all rows) | Same |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Managed by graph pipeline via service_role |
| All ops | service_role | Bypass RLS | Graph pipeline |

---

### flow_edges

**Phase:** V3
**RLS:** Enabled

Identical policy to `flow_nodes`. Fully public SELECT; service_role-only writes.

---

### flow_map_snapshots

**Phase:** V3
**RLS:** Enabled

Identical policy to `flow_nodes`. Fully public SELECT; service_role-only writes.

---

### anonymized_community_nodes

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | `true` (all rows) | Anonymized aggregate nodes are public |
| SELECT | authenticated | `true` (all rows) | Same |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) | Populated by anonymization pipeline that enforces minimum threshold (5 distinct `user_id` values per node) |
| All ops | service_role | Bypass RLS | Anonymization pipeline |

---

### coupons

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition | Notes |
|---|---|---|---|
| SELECT | anon | None (deny) | Coupon codes are not publicly browsable |
| SELECT | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` | Vendors see their own coupons |
| INSERT | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Vendors create own coupons |
| UPDATE | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Vendors manage own coupons |
| DELETE | authenticated | `vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` | Vendors delete own coupons |
| All ops | service_role | Bypass RLS | Admin management; Stripe coupon sync |

---

### invoices

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | `user_id = auth.uid() OR vendor_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### service_packages

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `is_active = true AND listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `is_active = true AND listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL) OR listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| All ops | service_role | Bypass RLS |

---

### vendor_relationships

**Phase:** V2
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `true` (only if both listings are published — JOIN required in service layer) |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid()) OR related_listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE / DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| All ops | service_role | Bypass RLS |

---

### sponsor_campaigns

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | `advertiser_user_id = auth.uid()` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### ai_agent_runs

**Phase:** V3
**RLS:** Enabled

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | None (deny) |
| SELECT | authenticated | `user_id = auth.uid()` |
| INSERT / UPDATE / DELETE | anon / authenticated | None (deny) |
| All ops | service_role | Bypass RLS |

---

### listing_ctas

**Phase:** V3
**RLS:** Enabled

Identical ownership-gate pattern to `listing_links`.

| Operation | Role | Condition |
|---|---|---|
| SELECT | anon | `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)` |
| SELECT | authenticated | `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))` |
| INSERT | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| UPDATE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| DELETE | authenticated | `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` |
| All ops | service_role | Bypass RLS |

---

## 5. Storage Bucket Policies

### listing-media (public bucket)

**Purpose:** Listing logos, cover images, gallery images, and product images.
**Access model:** Public read; authenticated owner write.

| Operation | Who | Condition |
|---|---|---|
| READ (public URL) | Anyone | Always — this bucket is public; URLs do not require signing |
| UPLOAD | authenticated | Storage path must begin with `listings/[listing_id]/` where `listing_id` is a listing with `owner_user_id = auth.uid()`; enforced in the server-side upload Route Handler, not the Supabase Storage policy directly |
| DELETE | service_role | Server-side only — no direct browser delete |
| Bucket-level policy | public | `true` on SELECT; INSERT, UPDATE, DELETE restricted to service_role |

**Path pattern enforced in upload Route Handler:**
```
listing-media/listings/[listing_id]/logo/[uuid].[ext]
listing-media/listings/[listing_id]/cover/[uuid].[ext]
listing-media/listings/[listing_id]/gallery/[uuid].[ext]
listing-media/products/[product_id]/[uuid].[ext]
```

No component of the path is user-supplied. The Route Handler constructs the path from validated server-side values only.

### verification-docs (private bucket)

**Purpose:** Business ownership verification documents — government IDs, business licenses, EIN documents.
**Access model:** Admin-only via signed URLs with 15-minute expiry. No public access. No direct browser access.

| Operation | Who | Condition |
|---|---|---|
| READ | Nobody directly | No public URLs; no direct browser URLs; no CDN distribution |
| READ (signed URL) | service_role | Generated on demand when Admin explicitly opens a verification review for a specific listing |
| UPLOAD | service_role | Server-side Route Handler only after auth and ownership validation |
| DELETE | service_role | Auto-purge job 90 days after verification decision |
| Bucket-level policy | private | SELECT: service_role only; INSERT: service_role only; DELETE: service_role only |

**Signed URL generation rules:**
- Expiry: 15 minutes — non-negotiable
- Generated only in the admin verification review Server Action
- The full signed URL is never logged, never stored, never returned in a cached response
- The admin review UI streams the document via a server-side proxy route; the signed URL never appears in browser history or network logs visible to the client

### receipts (private bucket)

**Purpose:** Receipt photos uploaded by Supporters for spend tracking.
**Access model:** Submitting user reads own receipts via signed URLs with 15-minute expiry. No other user access. No public access.

| Operation | Who | Condition |
|---|---|---|
| READ | Nobody directly | No public URLs |
| READ (signed URL) | service_role | Generated when authenticated user views their own receipt at `/dashboard/spend`; verified that `spend_event.user_id = auth.uid()` before generating |
| UPLOAD | service_role | Server-side Route Handler validates auth, ownership, MIME type, and file size before writing |
| DELETE | service_role | User-initiated deletion Server Action + scheduled data retention jobs |
| Bucket-level policy | private | service_role only for all operations |

**No cross-user access under any circumstances.** If a support escalation requires admin to view a receipt, the process must be defined and logged before V2 (documented as a known gap in the security plan until then).

---

## 6. Audit Log Immutability

### Protection mechanism

`admin_audit_log` is protected against modification by a database trigger that fires on any UPDATE or DELETE attempt and raises an exception, regardless of the calling role — including service_role.

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is immutable. Records cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_log_immutability_guard
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

This trigger must be created as part of the migration that creates `admin_audit_log`. It must be tested before MVP launch with both a direct UPDATE attempt and a DELETE attempt from the service_role client — both must raise an exception.

### Insert behavior

Inserts are permitted only via service_role. Every admin mutation — regardless of whether it succeeds or fails — writes a record to `admin_audit_log` in the same database transaction where possible. If the mutation is a multi-step operation, the audit log entry is written on the final step.

Required fields on every insert:
- `admin_user_id` — the `auth.uid()` of the admin performing the action
- `action` — one of the defined action enum values (see security plan Section 9 for the full enum)
- `target_table` — the table affected
- `target_id` — the primary key of the affected record
- `before_state` — JSONB snapshot of the record before the change (sanitized: no raw file paths for `verification-docs` or `receipts`)
- `after_state` — JSONB snapshot after the change (sanitized)
- `ip_address` — extracted from request headers server-side

### Access model

- **Admin:** Can SELECT their own entries only (`admin_user_id = auth.uid()`). This filtering is enforced in the service layer, not at the RLS level (RLS on `admin_audit_log` denies direct authenticated access; the service layer performs the lookup via service_role and applies the filter before returning results).
- **Super Admin:** Can SELECT all entries. Filter is removed in the service layer for super_admin role.
- **Retention:** Indefinite. No purge job. No TTL. These are compliance records.

---

## 7. Soft Delete Enforcement

### Default behavior in RLS

All RLS SELECT policies on `listings` include `deleted_at IS NULL` as a mandatory condition. This means a soft-deleted listing is invisible to all users — including the owner — through any query that goes through RLS. Only service_role queries can see soft-deleted records.

```sql
-- Pattern used in every public-facing SELECT policy on listings
WHERE status = 'published' AND deleted_at IS NULL

-- Pattern used in every owner-facing SELECT policy on listings
WHERE (status = 'published' AND deleted_at IS NULL)
   OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
```

### Child record behavior

Extension tables (`listing_details_business`, `services`, `media_attachments`, etc.) enforce soft-delete visibility indirectly by requiring the parent `listings` row to be visible:

```sql
-- Anon SELECT on listing_details_business
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE status = 'published'
  AND deleted_at IS NULL
)
```

Because the parent `listings` row is filtered by `deleted_at IS NULL` in the subquery, the extension record is also invisible when the parent is soft-deleted.

### Recovery path

Soft-deleted listings are only visible via service_role queries. Recovery (un-deletion) is an admin operation that sets `deleted_at = NULL` via service_role, creating an `admin_audit_log` entry for the restore action.

### Admin visibility of deleted records

Admin SELECT policies use service_role (which bypasses RLS), so admins can see soft-deleted records in the admin dashboard. The admin listings table must include a `deleted_at` filter in its default view to distinguish active from deleted, but the service layer can expose a "deleted listings" filter for recovery workflows.

---

## 8. Key RLS Patterns

These are the reusable policy expression patterns used throughout this document. Engineers should copy these exact patterns rather than writing variations to ensure consistency.

```sql
-- Published listing (public visibility)
status = 'published' AND deleted_at IS NULL

-- Ownership check (owner edits own listing)
owner_user_id = auth.uid()

-- Own record check (user owns this row)
user_id = auth.uid()

-- Admin/Super Admin role check
EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin')
)

-- Owner's listing membership (for child records)
listing_id IN (
  SELECT id FROM listings
  WHERE owner_user_id = auth.uid()
  AND deleted_at IS NULL
)

-- Never expose soft-deleted via anon
-- Always AND deleted_at IS NULL in any anon SELECT policy on listings or listings-keyed tables

-- Approved review check (for public review visibility)
status = 'approved'

-- Authenticated user check (any signed-in user can perform this action)
auth.uid() IS NOT NULL
```

---

*Document complete. Next: `seed-data-plan.md` for seed strategy, then `supabase/migrations/` for implementation.*
