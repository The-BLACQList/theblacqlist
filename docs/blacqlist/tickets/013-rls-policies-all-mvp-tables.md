# Ticket 013: RLS Policies for All 21 MVP Tables

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P0

## Feature Area

Database / Security

## Context

Row Level Security is the last line of defense at the database layer. Without RLS enabled and policies applied, any query — including those constructed from bugs in application code — can access data it should not see. Every table in the BLACQList database must have RLS enabled before any application code is deployed against the production Supabase project. This ticket applies all RLS policies defined in `docs/blacqlist/data/rls-policy-plan.md` section 4 across all 21 MVP tables. Source: `docs/blacqlist/data/rls-policy-plan.md` (complete document), enforcement layer matrix in section 3.

## User Story

As a platform security engineer, I want RLS enabled on every MVP table with per-role SELECT, INSERT, UPDATE, and DELETE policies matching the approved policy plan, so that no application bug, misconfigured query, or stolen `anon` key can expose private user data or permit unauthorized writes.

## Scope

- SQL migration file `supabase/migrations/006_rls_policies.sql`
- Enable RLS on all 21 MVP tables: `profiles`, `user_roles`, `listings`, `listing_details_business`, `services`, `listing_hours`, `listing_links`, `media_attachments`, `categories`, `cities`, `states`, `saves`, `claims`, `reviews`, `collections`, `collection_items`, `analytics_events`, `search_events`, `entity_analytics_daily`, `admin_audit_log`, `moderation_queue`
- Create reusable helper functions `is_admin()` and `owns_listing(listing_id uuid)`
- Write all SELECT, INSERT, UPDATE, DELETE policies per the RLS policy plan exactly
- Write and verify: anonymous public read policies, authenticated self-read policies, ownership-gated write policies, and service_role bypass (implicit — no policy needed)

## Out of Scope

- Storage bucket policies (documented in rls-policy-plan.md section 5; separate infrastructure ticket)
- Beta/V1/V2 tables: `corrections`, `review_responses`, `review_reports`, `subscriptions`, `verification_submissions`, `plans`, `editorial_articles`, `guides`, `guide_sections`, etc.
- Any application service code

## Dependencies

- Depends on: Tickets 006, 007, 008, 009, 010, 011, 012 — all table creation migrations must be complete before RLS policies can be applied

## UX Notes

No user-facing UI. However, incorrect RLS policies will manifest as 403 errors, empty data arrays, or unexpected data leakage in every screen that accesses the database. This ticket must be verified before any frontend tickets are tested against a live Supabase instance.

## Design Notes

No UI. Migration file only.

## Data Notes

The complete policy specification is in `docs/blacqlist/data/rls-policy-plan.md`. Below is the implementation summary organized by table group. Refer to the source document for the exact SQL expressions.

### Helper functions (create first)

```sql
-- Admin check — returns true if the current user is an admin or super_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Ownership check — returns true if current user owns the specified listing
CREATE OR REPLACE FUNCTION owns_listing(p_listing_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM listings
    WHERE id = p_listing_id
    AND owner_user_id = auth.uid()
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

Note: Helper functions use `SECURITY DEFINER` so they can query `user_roles` and `listings` regardless of the calling user's own RLS restrictions. This is safe because the functions return only a boolean.

### Reference tables — public SELECT, no user writes

Tables: `categories`, `cities`, `states`

Policy pattern: `anon` and `authenticated` SELECT all rows (`true`). No INSERT/UPDATE/DELETE for anon or authenticated. service_role bypasses.

### Identity tables — self-only access

Tables: `profiles`, `user_roles`

**profiles:** `authenticated` SELECT/UPDATE where `id = auth.uid()`. INSERT via trigger on `auth.users` INSERT (service_role). No `authenticated` DELETE.

**user_roles:** `authenticated` SELECT where `user_id = auth.uid()`. No authenticated INSERT/UPDATE/DELETE. All role assignments via service_role only.

### Listings table — published filter for anon, ownership gate for writes

- `anon` SELECT: `status = 'published' AND deleted_at IS NULL`
- `authenticated` SELECT: `(status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL)`
- `authenticated` INSERT: `auth.uid() IS NOT NULL` (any authenticated user; `owner_user_id` set by service)
- `authenticated` UPDATE: `owner_user_id = auth.uid() AND deleted_at IS NULL`
- `authenticated` DELETE: DENY

### Listing child tables — inheritance pattern

Tables: `listing_details_business`, `services`, `listing_hours`, `listing_links`, `media_attachments`

Pattern for all:

- `anon` SELECT: `listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)`
- `authenticated` SELECT: `listing_id IN (SELECT id FROM listings WHERE (status = 'published' AND deleted_at IS NULL) OR (owner_user_id = auth.uid() AND deleted_at IS NULL))`
- `authenticated` INSERT: `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)`
- `authenticated` UPDATE: same ownership gate as INSERT
- `authenticated` DELETE: same (for services, listing_hours, listing_links, media_attachments); DENY for listing_details_business

**media_attachments additional rule:** `authenticated` INSERT requires `entity_type = 'listing'`; `authenticated` UPDATE/DELETE: `uploaded_by = auth.uid()` only.

### Engagement tables

**saves:** `authenticated` SELECT/INSERT/DELETE where `user_id = auth.uid()`. No UPDATE. Anon: DENY all.

**claims:** `authenticated` SELECT where `claimant_user_id = auth.uid()`. INSERT allowed (any authenticated). UPDATE: DENY. DELETE: DENY.

**reviews:** `anon` SELECT where `status = 'published'`. `authenticated` SELECT where `status = 'published' OR reviewer_user_id = auth.uid()`. INSERT: any authenticated; `status` forced to `'intake'` — add a policy check: `WITH CHECK (status = 'intake')`. UPDATE: DENY. DELETE: DENY.

### Editorial tables

**collections:** `anon` SELECT where `is_active = true`. `authenticated` SELECT where `is_active = true`. No INSERT/UPDATE/DELETE for either role.

**collection_items:** `anon` and `authenticated` SELECT where `collection_id IN (SELECT id FROM collections WHERE is_active = true)`. No INSERT/UPDATE/DELETE.

### Analytics tables

**analytics_events:** No SELECT for `anon`. `authenticated` SELECT where `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())`. No INSERT/UPDATE/DELETE for any non-service_role client.

**search_events:** No SELECT, INSERT, UPDATE, DELETE for `anon` or `authenticated`. service_role only.

**entity_analytics_daily:** No SELECT for `anon`. `authenticated` SELECT where `listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid())`. No INSERT/UPDATE/DELETE for `authenticated`.

**admin_audit_log:** No SELECT, INSERT, UPDATE, DELETE for `anon` or `authenticated`. service_role only. (The immutability trigger from Ticket 012 additionally blocks UPDATE/DELETE even for service_role.)

**moderation_queue:** No SELECT, INSERT, UPDATE, DELETE for `anon` or `authenticated`. service_role only.

### Migration required

Yes — `supabase/migrations/006_rls_policies.sql`

## API Notes

No API endpoints. Incorrect policies will surface as errors in all API endpoints and Server Actions. Every authenticated server-side database query should use the Supabase client initialized with the session cookie (not service_role) for user-facing reads — RLS filters will apply automatically.

## Implementation Notes

**File to create:**

- `supabase/migrations/006_rls_policies.sql`

**Migration structure:**

```sql
-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
-- ... repeat for all 21 tables

-- 2. Create helper functions
CREATE OR REPLACE FUNCTION is_admin() ...
CREATE OR REPLACE FUNCTION owns_listing(p_listing_id uuid) ...

-- 3. Per-table policies (ordered: reference tables first, then complex tables)
-- profiles policies
CREATE POLICY "profiles: authenticated user reads own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ... all policies per the rls-policy-plan.md specification
```

**Policy naming convention:** `"[table]: [role] [operation] [condition summary]"` — e.g., `"listings: anon reads published"`, `"saves: authenticated manages own"`.

**Critical verification requirement:** Before this migration is merged, run the following verification matrix against the local dev DB using a test anon client, a test authenticated non-owner client, a test owner client, and an admin client:

| Table            | Anon SELECT    | Auth non-owner SELECT | Owner SELECT                 | Auth INSERT             | Owner UPDATE | Auth DELETE |
| ---------------- | -------------- | --------------------- | ---------------------------- | ----------------------- | ------------ | ----------- |
| listings         | published only | published + own       | published + own              | allowed                 | own only     | denied      |
| saves            | denied         | denied                | own only                     | own only                | denied       | own only    |
| claims           | denied         | own only              | own only (if owner=claimant) | allowed                 | denied       | denied      |
| reviews          | published only | published + own       | published + own              | allowed (status=intake) | denied       | denied      |
| analytics_events | denied         | own listings          | own listings                 | denied                  | denied       | denied      |
| admin_audit_log  | denied         | denied                | denied                       | denied                  | denied       | denied      |

**Key patterns:**

- Use `TO authenticated` and `TO anon` clauses on every policy — do not omit the role
- Use `USING` for SELECT conditions; use both `USING` and `WITH CHECK` for INSERT/UPDATE conditions
- Test every DENY path, not just the allow path — a missing DENY policy may silently allow access via Postgres default
- service_role bypasses all policies by default — never write a policy for service_role

**Do not:**

- Write a catch-all `USING (true)` policy as a development shortcut
- Omit `deleted_at IS NULL` from any `listings`-involving policy
- Use JWT claims for role checks — always query `user_roles` table

## Acceptance Criteria

- [ ] RLS is enabled on all 21 MVP tables — confirmed by querying `pg_tables` WHERE `rowsecurity = true`
- [ ] Anon client cannot SELECT from `saves`, `claims`, `reviews` (non-published), `analytics_events`, `admin_audit_log`, or `moderation_queue` — confirmed by attempting selects and receiving empty result set (not an error; RLS returns 0 rows silently)
- [ ] Anon client can SELECT published listings from `listings` and child tables (`listing_details_business`, `services`, `listing_hours`, `listing_links`, `media_attachments`)
- [ ] Authenticated non-owner cannot UPDATE a listing they do not own — confirmed by attempt returning 0 affected rows
- [ ] Authenticated user can INSERT into `saves` with `user_id = auth.uid()` and cannot INSERT with a different `user_id` — second attempt raises check violation or returns 0 rows
- [ ] Authenticated user can SELECT their own `claims` rows but not another user's claims — confirmed by cross-user SELECT returning 0 rows
- [ ] Reviews INSERT policy enforces `status = 'intake'` — confirmed by attempting INSERT with `status = 'published'` raising policy violation
- [ ] `admin_audit_log` is completely inaccessible to `anon` and `authenticated` clients — SELECT, INSERT, UPDATE, DELETE all return 0 rows or errors
- [ ] `is_admin()` function returns `true` for a user with `user_roles.role = 'admin'` and `false` for a supporter

## Failure States

| Failure                                        | User-visible behavior                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| RLS enabled but no SELECT policy on `listings` | Every listing query returns 0 rows for all users — homepage and search pages appear empty                |
| Ownership check using wrong column             | Owner cannot see their own drafts; owner cannot update their own listing — Dashboard shows "no listings" |
| Missing `deleted_at IS NULL` in anon policy    | Soft-deleted listings appear in public search and on the homepage                                        |
| `anon` SELECT allowed on `analytics_events`    | Platform analytics data is publicly accessible via the `anon` Supabase key — data leak                   |
| `authenticated` UPDATE allowed on `reviews`    | Users can change their review rating or body after submission — anti-gaming control fails                |

## Edge Cases

- The `reviews` INSERT policy must include `WITH CHECK (status = 'intake')` — without this, an attacker could craft a request to insert a review with `status = 'published'` bypassing moderation
- The helper function `owns_listing()` includes `deleted_at IS NULL` — a user cannot claim ownership of a soft-deleted listing through RLS
- `UNIQUE (reviewer_user_id, listing_id)` on `reviews` means that after a user is deleted (SET NULL), the NULL user_id does not conflict with another NULL user_id. This is correct behavior but the RLS policy for `authenticated` INSERT should still enforce `WITH CHECK (reviewer_user_id = auth.uid())`
- `media_attachments` has a polymorphic `entity_id` field. The INSERT policy must require `entity_type = 'listing'` for authenticated users to prevent attaching media to non-listing entities (user profiles, products) through the standard auth path

## Accessibility Notes

Not applicable — database security migration ticket.

## QA Test Cases

| #    | Scenario                                      | Role                           | Steps                                                             | Expected result                                                           |
| ---- | --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| QA-1 | Anon reads published listings                 | Anon Supabase client           | `SELECT * FROM listings` using anon key                           | Only rows where `status = 'published' AND deleted_at IS NULL` returned    |
| QA-2 | Authenticated reads own draft                 | Authenticated client (owner)   | INSERT a draft listing; SELECT listings; verify own draft appears | Draft listing appears in SELECT result alongside published listings       |
| QA-3 | Auth user cannot read another user's saves    | Authenticated client (User A)  | User B inserts a save; User A runs `SELECT * FROM saves`          | User A receives 0 rows (only their own saves visible)                     |
| QA-4 | Reviews INSERT status gated                   | Authenticated client           | Attempt `INSERT INTO reviews (... status = 'published' ...)`      | INSERT fails with policy violation or check violation; row is not created |
| QA-5 | Admin_audit_log inaccessible to authenticated | Authenticated non-admin client | `SELECT * FROM admin_audit_log`                                   | Returns 0 rows — no error, just empty result                              |

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. It must only be used in server-side code (Server Actions, Route Handlers). It must never appear in any file with `"use client"` directive. Code review must reject any PR that imports the service role key in client-accessible files.
- `is_admin()` and `owns_listing()` use `SECURITY DEFINER` — ensure these functions do not expose any columns beyond the boolean return value. Audit the function bodies before shipping.
- Policy changes in production require careful sequencing: disable the incorrect policy → verify queries are blocked → create the correct policy → verify queries work as expected. Never drop a restrictive policy before adding the corrected one.
- Rate limiting (search, auth, claim, review submissions) is enforced at the middleware and service layer — NOT in RLS policies. RLS is not a rate limiter.

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for migration ticket
- [ ] Full verification matrix (anon / auth non-owner / owner / admin) tested against local dev DB for at least: listings, saves, claims, reviews, analytics_events, admin_audit_log
- [ ] Mobile tested at 375px — N/A
- [ ] Keyboard navigation tested — N/A
- [ ] PR opened and linked to this ticket
