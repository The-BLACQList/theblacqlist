# Supabase Production Checklist — The BLACQList

**Date:** 2026-05-11
**Status:** Pre-deployment checklist
**Applies to:** Production Supabase project only (separate from staging)

Complete every section in order. Migrations may be applied to the **empty** production DB during setup/testing (Supabase Pro's included daily backups cover this phase) — **PITR is enabled before public launch (gate M7)**, not before the initial setup migrations. Do not open the site to users until RLS verification is complete.

---

## Section 1 — Project Configuration

### 1.1 Plan and billing

- [ ] Production Supabase project is on **Pro plan** or higher
  - Reason: Pro (~$25/mo) gives **daily backups + no auto-pause**, and is required to add PITR later. Keep Pro now; it's the only ongoing infra cost until launch.
  - Verify: Supabase Dashboard → Settings → Billing → current plan
- [ ] Billing email is a monitored address (not a personal email that may be missed)
- [ ] Usage alerts are configured: Supabase Dashboard → Settings → Billing → Spend Caps

### 1.2 Backups & Point-in-Time Recovery (PITR)

**During setup/testing (now):** the production DB is empty, so **Pro's included daily backups** (7-day retention) are the safety net — migrations may be applied without PITR. If a setup migration goes wrong, restore the latest daily backup or recreate the empty project. No real data is at risk yet.

**PITR is a paid add-on (~$100/mo for the 7-day window) and is enabled before the public launch — gate M7 — when real user data starts to accrue.** Do not enable it during testing (cost); do not launch to users without it.

- [ ] A successful **daily backup** exists now (dashboard → Settings → Backups shows a recent timestamp)
- [ ] **PITR enabled — at gate M7, before public launch** (Settings → Backups → "Point in Time Recovery", 7-day window). _Deferred during testing._

### 1.3 Connection pooling

- [ ] PgBouncer is enabled in **transaction mode**
  - Verify: Supabase Dashboard → Settings → Database → "Connection Pooling" shows enabled
  - Mode must be "Transaction" — not "Session" (session mode is incompatible with Vercel serverless)
- [ ] The **pooled connection string** is what the application uses for Supabase client connections
- [ ] The **direct connection string** (non-pooled) is used only for running migrations via `supabase db push`

### 1.4 Database region

- [ ] Production project is in a US region (recommended: `us-east-1` for lowest latency to the primary US user base)
- [ ] Staging project is in the same region (consistent behavior between environments)

### 1.5 PostgreSQL version

- [ ] Database PostgreSQL major version is **17** (matches `supabase/config.toml` setting `major_version = 17`)
  - Verify: Supabase Dashboard → Settings → Database → "PostgreSQL version"

---

## Section 2 — Extensions

Run the following in Supabase SQL Editor (production project):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- [ ] `pg_trgm` extension is enabled
  - Verify: Supabase Dashboard → Database → Extensions → search "pg_trgm" → status = enabled
  - Purpose: trigram-based fuzzy text search for listing and business name search

No other extensions are required at MVP.

---

## Section 3 — Migrations Applied

Apply in this exact order. After each migration completes, verify the expected tables exist before proceeding.

| #   | Migration file                                    | Expected tables/objects after                                                                           | Verified |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `20260510000000_initial_blacqlist_mvp_schema.sql` | `users`, `listings`, `categories`, `cities`, `states`, `saves`, `claims`, `user_roles`, `listing_hours` | [ ]      |
| 2   | `20260510000001_mvp_rls_policies.sql`             | RLS enabled on all tables from migration 1                                                              | [ ]      |
| 3   | `20260511000000_editorial_foundation.sql`         | `collections`, `collection_listings`, `guides`, `blacqlight_features`                                   | [ ]      |
| 4   | `20260511000001_receipt_community_spend.sql`      | `receipt_uploads`, `spend_events`, `community_spend_snapshots`                                          | [ ]      |
| 5   | `20260511000002_marketplace_foundation.sql`       | `products`, `services`, `vendor_storefronts`, `orders`, `order_items`                                   | [ ]      |
| 6   | `20260511000003_monetization_foundation.sql`      | `subscriptions`, `sponsored_placements`, `sponsor_campaigns`, `set_updated_at()` function               | [ ]      |
| 7   | `20260511000004_ai_foundation.sql`                | `ai_suggestions`, `ai_generation_requests`                                                              | [ ]      |

**Verification SQL (run in Supabase SQL Editor after all migrations):**

```sql
-- Confirm all expected tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected tables include at minimum: `ai_generation_requests`, `ai_suggestions`, `blacqlight_features`, `categories`, `cities`, `claims`, `collection_listings`, `collections`, `community_spend_snapshots`, `guides`, `listing_hours`, `listings`, `listing_details_business`, `orders`, `order_items`, `plans`, `products`, `receipt_uploads`, `saves`, `services`, `spend_events`, `sponsored_placements`, `sponsor_campaigns`, `states`, `subscriptions`, `user_roles`, `users`, `vendor_storefronts`.

---

## Section 4 — Seed Data Applied

```sql
-- Run after migrations are applied
-- Command: psql "[production-direct-db-url]" -f supabase/seed.sql
-- Or via Supabase CLI: supabase db push --include-seed --db-url "[production-db-url]"
```

**Verify after seeding:**

```sql
SELECT 'states'     AS tbl, count(*) FROM states
UNION ALL
SELECT 'cities'     AS tbl, count(*) FROM cities
UNION ALL
SELECT 'categories' AS tbl, count(*) FROM categories
UNION ALL
SELECT 'plans'      AS tbl, count(*) FROM plans;
```

Expected counts:

| Table        | Expected count                                    |
| ------------ | ------------------------------------------------- |
| `states`     | 51 (50 states + DC)                               |
| `cities`     | 13                                                |
| `categories` | 25+ (top-level + subcategories)                   |
| `plans`      | 3 (free, starter, growth — or as defined in seed) |

- [ ] All four counts match expected values
- [ ] No test users, test listings, or dev fixtures are present in the production database

---

## Section 5 — Row Level Security Verification

### 5.1 RLS enabled on all tables

- [ ] RLS is enabled on every table
  - Verify: Supabase Dashboard → Database → Tables → for each table, "Row Level Security" column shows enabled

Quick SQL check:

```sql
-- Tables with RLS disabled (should return zero rows)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT relname FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public'
      AND relrowsecurity = true
  );
```

**Expected result: zero rows.** If any table appears, enable RLS immediately:

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

### 5.2 No anonymous access to private tables

Test using the anon key (which simulates an unauthenticated user):

```sql
-- Run as anon key context in Supabase SQL Editor → select "Anon" role
SELECT count(*) FROM receipt_uploads;     -- expected: 0 (no access)
SELECT count(*) FROM spend_events;        -- expected: 0 (no access) or only anonymized aggregates
SELECT count(*) FROM user_roles;          -- expected: 0 (no access)
SELECT count(*) FROM admin_audit_log;     -- expected: 0 (no access)
```

- [ ] `receipt_uploads` — anon reads return 0 rows (buyer data is private)
- [ ] `user_roles` — anon reads return 0 rows (role assignment is private)
- [ ] `claims` — anon reads return 0 rows (claims are private until approved)

### 5.3 Buyer anonymity — spend data

The community spend feature anonymizes spend data. Verify:

- [ ] `spend_events` contains `user_id` but the SELECT RLS policy restricts reads to the owning user only
- [ ] `community_spend_snapshots` is readable by all (aggregated, no individual user data) — verify the select policy allows public read
- [ ] The Flow Map public page (`/flow-map`) renders aggregated totals only — no individual user transactions are visible

**SQL verification:**

```sql
-- As anon key: should return aggregate rows (public)
SELECT count(*) FROM community_spend_snapshots;

-- As anon key: should return 0 (private per-user data)
SELECT count(*) FROM spend_events;
```

### 5.4 Receipt privacy

- [ ] Receipt uploads are private — only the uploading user can read their own receipts
- [ ] No public URL access to the `receipts` storage bucket (bucket visibility = private)
- [ ] Signed URL generation is server-side only (`app/api/receipts/[id]/signed-url/route.ts`)
- [ ] Signed URLs expire in 15 minutes (enforced in the signed URL route handler)

**Manual test:**

1. Sign in as User A, upload a receipt
2. Sign in as User B (different account), attempt to access User A's receipt signed URL
3. Expected: 401 Unauthorized or 403 Forbidden

### 5.5 Cross-owner listing protection

- [ ] A business owner cannot edit a listing they do not own
  - Test: sign in as Owner A, attempt `POST /api/listings/[owner-b-listing-id]` or equivalent server action with Owner A's session
  - Expected: 403 Forbidden or 404 Not Found (do not reveal that the listing exists)
- [ ] Admin users can edit all listings (service role operations in admin actions bypass RLS intentionally)

---

## Section 6 — Storage Bucket Configuration

Create three buckets in Supabase Dashboard → Storage. Apply the following settings exactly.

### 6.1 `listing-media` — Public bucket

| Setting         | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Bucket name     | `listing-media`                                             |
| Visibility      | **Public**                                                  |
| File size limit | Leave at default (application layer enforces 5 MB per file) |

```sql
-- Verify bucket exists and is public
SELECT name, public FROM storage.buckets WHERE name = 'listing-media';
-- Expected: { name: 'listing-media', public: true }
```

- [ ] Bucket `listing-media` exists
- [ ] Bucket is public (files served without authentication)
- [ ] Test: upload a test image via `POST /api/upload/listing-media`, retrieve it via the public URL, confirm it loads in a browser tab

### 6.2 `verification-docs` — Private bucket

| Setting     | Value               |
| ----------- | ------------------- |
| Bucket name | `verification-docs` |
| Visibility  | **Private**         |

```sql
-- Verify bucket exists and is private
SELECT name, public FROM storage.buckets WHERE name = 'verification-docs';
-- Expected: { name: 'verification-docs', public: false }
```

- [ ] Bucket `verification-docs` exists
- [ ] Bucket is private (no public URL access)
- [ ] Direct URL access returns 400 or access denied — test by constructing `[SUPABASE_URL]/storage/v1/object/public/verification-docs/[any-path]` in a browser tab

### 6.3 `receipts` — Private bucket

| Setting     | Value       |
| ----------- | ----------- |
| Bucket name | `receipts`  |
| Visibility  | **Private** |

```sql
-- Verify bucket exists and is private
SELECT name, public FROM storage.buckets WHERE name = 'receipts';
-- Expected: { name: 'receipts', public: false }
```

- [ ] Bucket `receipts` exists
- [ ] Bucket is private
- [ ] Direct URL access is blocked — test the same way as `verification-docs`
- [ ] Receipt signed URLs expire in 15 minutes — confirm by inspecting the URL expiry parameter in a generated signed URL

---

## Section 7 — Authentication Configuration

Configure in Supabase Dashboard → Authentication → URL Configuration.

### 7.1 Site URL

Set to the production domain:

```
https://theblacqlist.com
```

- [ ] Site URL is set to `https://theblacqlist.com` (production project)
- [ ] Site URL is set to `https://theblacqlist.vercel.app` (staging project)

### 7.2 Redirect URLs

Add all of the following redirect URLs. These are the exact paths that Supabase Auth will allow after email confirmation and OAuth flows.

```
https://theblacqlist.com
https://theblacqlist.com/auth/callback
https://theblacqlist.com/onboarding
https://*.vercel.app
https://*.vercel.app/auth/callback
```

For the **staging project only**, also add:

```
http://localhost:3000
http://localhost:3000/auth/callback
```

Do not add localhost to the production project's redirect URLs.

- [ ] All production redirect URLs are added to the production Supabase project
- [ ] `http://localhost:3000` is NOT in the production project's redirect URL list
- [ ] `https://theblacqlist.com/auth/callback` is confirmed — this is the route handler at `app/auth/callback/route.ts`

### 7.3 Email provider settings

- [ ] Email provider is enabled (Supabase Dashboard → Authentication → Providers → Email → enabled)
- [ ] Email confirmation is enabled (`enable_confirmations = true`) — users must verify email before accessing protected routes
- [ ] Double confirm changes is enabled (changing email requires confirmation from both old and new address)
- [ ] Custom SMTP is configured if using Resend for auth emails — or confirm Supabase's built-in email sending is acceptable for MVP volume
- [ ] JWT expiry is set to **7 days** (604800 seconds) — production default; change from the 1-hour local default

### 7.4 Auth email templates

Customize the following email templates in Supabase Dashboard → Authentication → Email Templates with BLACQList branding (logo, brand colors, support email):

- [ ] **Confirm signup** — email verification link
- [ ] **Reset password** — password reset link
- [ ] **Magic link** — if magic link auth is enabled
- [ ] From name is "The BLACQList" (not "Supabase")
- [ ] Reply-to address is `support@theblacqlist.com` or the designated support email

---

## Section 8 — Admin User

- [ ] Admin account has been created via the production sign-up flow
- [ ] Admin account email is verified
- [ ] Admin user ID has been inserted into `user_roles` with `role = 'admin'` (see deployment runbook Step 5)
- [ ] Admin can log in and access `/admin` without being redirected
- [ ] Admin can see claims queue at `/admin/claims`
- [ ] Admin can see entities at `/admin/entities`
- [ ] No test or seed-data admin accounts exist in production (admin accounts must be created intentionally, not from seed files)

---

## Section 9 — Final Supabase Production Verification

Run this final SQL check in the Supabase SQL Editor (production project) before opening traffic:

```sql
-- 1. Confirm RLS is on for all public tables
SELECT tablename,
       CASE WHEN relrowsecurity THEN 'enabled' ELSE 'DISABLED ⚠' END AS rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE t.schemaname = 'public'
ORDER BY tablename;

-- 2. Confirm reference data counts
SELECT 'states'     AS tbl, count(*) FROM states
UNION ALL SELECT 'cities',     count(*) FROM cities
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'plans',      count(*) FROM plans;

-- 3. Confirm storage buckets
SELECT name, public FROM storage.buckets ORDER BY name;

-- 4. Confirm admin user exists
SELECT u.email, r.role
FROM user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'admin';

-- 5. Confirm no development test data is present
SELECT count(*) AS test_user_count FROM auth.users
WHERE email LIKE '%+test%' OR email LIKE '%@example.%';
-- Expected: 0
```

- [ ] All tables show `rls_status = enabled`
- [ ] Reference data counts match expected values
- [ ] Three storage buckets exist with correct visibility settings
- [ ] At least one admin user is present
- [ ] Zero test/example email addresses exist in production auth
