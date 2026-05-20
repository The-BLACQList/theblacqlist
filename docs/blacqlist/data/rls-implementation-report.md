# RLS Implementation Report — The BLACQList MVP

**Migration file:** `supabase/migrations/20260510000001_mvp_rls_policies.sql`
**Created:** 2026-05-10
**Status:** Ready for review — do not apply without explicit approval

---

## 1. What This Migration Does

This migration supersedes the basic inline RLS policies written in `20260510000000_initial_blacqlist_mvp_schema.sql`. It:

1. Creates five helper functions for role and ownership verification in Server Actions
2. Drops all 37 basic policies from the initial migration
3. Creates 52 per-operation policies covering all 22 MVP tables
4. Corrects two policy gaps from the initial migration (see Section 7)

---

## 2. Helper Functions

| Function | Returns | Purpose |
|---|---|---|
| `is_admin()` | `boolean` | True if session user has `admin` or `super_admin` role |
| `is_super_admin()` | `boolean` | True if session user has `super_admin` role |
| `has_role(p_role text)` | `boolean` | True if session user has the specified role |
| `owns_listing(p_listing_id uuid)` | `boolean` | True if session user owns the listing (checks `owner_user_id` + `deleted_at IS NULL`) |
| `owns_entity(p_entity_id uuid)` | `boolean` | Alias for `owns_listing` — `entity == listing` in MVP |

All functions are `STABLE SECURITY DEFINER SET search_path = public`.

**Usage in Server Actions:**
```typescript
// Verify admin role before using service_role
const { data: isAdmin } = await supabase.rpc('is_admin')
if (!isAdmin) return Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

// Verify listing ownership before using service_role
const { data: isOwner } = await supabase.rpc('owns_listing', { p_listing_id: listingId })
if (!isOwner) return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
```

**Important:** These functions are for service-layer verification. They are **not** referenced inside RLS policies — inline conditions are used there for performance and clarity.

---

## 3. Access Matrix

### Reference data (states, cities, categories)

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ all rows | ✅ all rows | ✅ bypass |
| INSERT | ❌ | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ |

### plans

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ `is_active = true` only | ✅ `is_active = true` only | ✅ bypass |
| INSERT / UPDATE / DELETE | ❌ | ❌ | ✅ |

### profiles

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ (V1: public owner profiles) | ✅ own record only | ✅ bypass |
| UPDATE | ❌ | ✅ own record only | ✅ |
| INSERT | ❌ | ❌ (trigger creates on signup) | ✅ |
| DELETE | ❌ | ❌ | ✅ |

### user_roles

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ✅ own record only | ✅ bypass |
| INSERT / UPDATE / DELETE | ❌ | ❌ | ✅ |

### listings

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ `status='published' AND deleted_at IS NULL` | ✅ published OR `owner_user_id = auth.uid()` | ✅ bypass |
| INSERT | ❌ | ✅ `submitted_by = auth.uid() AND owner_user_id = auth.uid()` | ✅ |
| UPDATE | ❌ | ✅ `owner_user_id = auth.uid()` only | ✅ |
| DELETE | ❌ | ❌ (soft delete via service_role) | ✅ |

### listing_details_business / services / listing_hours / listing_links

Same ownership-gate pattern for all four tables:

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ parent listing `status='published'` | ✅ published OR own listing | ✅ bypass |
| INSERT | ❌ | ✅ own listing only | ✅ |
| UPDATE | ❌ | ✅ own listing only | ✅ |
| DELETE | ❌ | ✅ own listing only | ✅ |

### media_attachments

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ `entity_type='listing'` + published parent | ✅ own uploads + published listing media | ✅ bypass |
| INSERT | ❌ | ✅ `entity_type='listing'` + own listing | ✅ |
| UPDATE | ❌ | ✅ `uploaded_by = auth.uid()` only | ✅ |
| DELETE | ❌ | ✅ `uploaded_by = auth.uid()` only | ✅ |

### claims

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ✅ `claimant_user_id = auth.uid()` | ✅ bypass |
| INSERT | ❌ | ✅ `claimant_user_id = auth.uid()` | ✅ |
| UPDATE | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ✅ (not used — claims are permanent) |

### saves

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ✅ `user_id = auth.uid()` | ✅ bypass |
| INSERT | ❌ | ✅ `user_id = auth.uid()` | ✅ |
| UPDATE | ❌ | ❌ (delete + re-insert only) | ✅ |
| DELETE | ❌ | ✅ `user_id = auth.uid()` | ✅ |

### reviews

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ `status='published'` | ✅ published OR `reviewer_user_id = auth.uid()` | ✅ bypass |
| INSERT | ❌ | ✅ `reviewer_user_id = auth.uid() AND status = 'intake'` | ✅ |
| UPDATE | ❌ | ❌ (immutable after submission) | ✅ |
| DELETE | ❌ | ❌ | ✅ |

### collections

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ `is_active = true` | ✅ `is_active = true` | ✅ bypass |
| INSERT / UPDATE / DELETE | ❌ | ❌ | ✅ |

### collection_items

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ✅ items in active collections | ✅ items in active collections | ✅ bypass |
| INSERT / UPDATE / DELETE | ❌ | ❌ | ✅ |

### analytics_events

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ✅ own listing events only | ✅ bypass |
| INSERT | ❌ | ❌ (Server Action → service_role) | ✅ |
| UPDATE / DELETE | ❌ | ❌ | ✅ |

### search_events

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ❌ | ✅ bypass |
| INSERT | ❌ | ❌ | ✅ |

### entity_analytics_daily

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ✅ own listing aggregates only | ✅ bypass |
| INSERT / UPDATE / DELETE | ❌ | ❌ | ✅ (scheduled job) |

### admin_audit_log

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| SELECT | ❌ | ❌ | ✅ bypass |
| INSERT | ❌ | ❌ | ✅ |
| UPDATE | ❌ trigger | ❌ trigger | ❌ trigger |
| DELETE | ❌ trigger | ❌ trigger | ❌ trigger |

### moderation_queue

| Operation | anon | authenticated | service_role |
|---|---|---|---|
| All ops | ❌ | ❌ | ✅ bypass |

---

## 4. Policies Created

52 policies across 20 tables (search_events, admin_audit_log, and moderation_queue require no explicit policies — RLS enabled + default deny is the correct state).

| Table | Policies |
|---|---|
| states | 2 (anon/authenticated SELECT) |
| cities | 2 (anon/authenticated SELECT) |
| categories | 2 (anon/authenticated SELECT) |
| plans | 2 (anon/authenticated SELECT) |
| profiles | 2 (authenticated SELECT + UPDATE) |
| user_roles | 1 (authenticated SELECT own) |
| listings | 4 (anon SELECT, authenticated SELECT, INSERT, UPDATE) |
| listing_details_business | 5 (anon SELECT, authenticated SELECT, INSERT, UPDATE, DELETE) |
| services | 5 (anon SELECT, authenticated SELECT, INSERT, UPDATE, DELETE) |
| media_attachments | 5 (anon SELECT, authenticated SELECT, INSERT, UPDATE, DELETE) |
| listing_hours | 5 (anon SELECT, authenticated SELECT, INSERT, UPDATE, DELETE) |
| listing_links | 5 (anon SELECT, authenticated SELECT, INSERT, UPDATE, DELETE) |
| claims | 2 (authenticated SELECT, INSERT) |
| saves | 3 (authenticated SELECT, INSERT, DELETE) |
| reviews | 3 (anon SELECT, authenticated SELECT, INSERT) |
| collections | 2 (anon/authenticated SELECT) |
| collection_items | 2 (anon/authenticated SELECT) |
| analytics_events | 1 (authenticated SELECT own) |
| entity_analytics_daily | 1 (authenticated SELECT own) |
| search_events | 0 (default deny) |
| admin_audit_log | 0 (default deny + trigger immutability) |
| moderation_queue | 0 (default deny) |

---

## 5. Known Gaps and Deferred Policies

The following tables exist in the MVP schema but are not covered by this migration because:
- they are Beta or V1 phase tables (RLS should be added when those tables are created), or
- they are handled by a separate migration for later phases.

| Table | Phase | RLS Status | Notes |
|---|---|---|---|
| `listing_details_professional` | Beta | RLS enabled (initial migration); no policies beyond initial | Add policies in Beta migration |
| `listing_details_creative` | Beta | RLS enabled; no policies | Add in Beta migration |
| `listing_details_event` | Beta | RLS enabled; no policies | Add in Beta migration |
| `listing_details_job` | Beta | RLS enabled; no policies | Add in Beta migration |
| `listing_details_vendor` | V2 | Not yet in schema | Add when table is created |
| `subscriptions` | V1 | Not in MVP schema | Add in V1 migration |
| `plans` (INSERT/UPDATE) | V1 | No write policies | Covered by service_role; fine |

### Profiles — anon SELECT deferred

Public owner profile pages (accessible without login) are planned for V1. The `anon` SELECT policy on `profiles` is intentionally absent at MVP. When implemented, it should expose only `display_name`, `avatar_url`, and `bio` — never `email` or `phone_number`.

### Admin role — no RLS policies

All admin operations bypass RLS entirely via `service_role`. This is intentional. Admin access control is enforced at the service-layer level (Server Actions check `is_admin()` before using service_role). Adding admin-specific RLS policies would create a false sense of security while adding complexity.

---

## 6. Corrections Applied in This Migration

### 6.1 saves table — FOR ALL policy replaced

The initial migration used a single `FOR ALL` policy on `saves`:

```sql
-- Initial migration (incorrect — FOR ALL includes UPDATE)
CREATE POLICY "saves: authenticated manage own"
  ON saves FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

`FOR ALL` silently permitted `UPDATE` on saves rows. The intent is no UPDATE path (delete and re-insert). This migration drops the combined policy and creates explicit `SELECT`, `INSERT`, and `DELETE` policies with no `UPDATE` policy.

### 6.2 collection_items — USING (true) replaced

The initial migration used `USING (true)` on `collection_items`, exposing items from **all** collections including inactive ones:

```sql
-- Initial migration (incorrect — exposes items from inactive collections)
CREATE POLICY "collection_items: public read"
  ON collection_items FOR SELECT TO anon, authenticated
  USING (true);
```

This migration replaces it with a subquery that restricts to items from active collections only:

```sql
USING (
  collection_id IN (SELECT id FROM collections WHERE is_active = true)
)
```

---

## 7. Security Risks and Notes

### Risk: reviews INSERT — status is forced by WITH CHECK but not trigger

The reviews INSERT policy enforces `status = 'intake'` via WITH CHECK at the RLS layer. A service-layer check should also validate this before calling the insert. If the WITH CHECK constraint is the only enforcement, a misconfigured Server Action could bypass it by calling the service_role path. Both layers should enforce it.

**Mitigation already in schema:** The initial migration's `reviews` table has a CHECK constraint `CHECK (status IN ('intake','pending_approval','published','rejected','removed'))`, so an invalid status value would fail at the DB level regardless.

### Risk: listings INSERT — owner_user_id set by client

The listings INSERT policy requires `owner_user_id = auth.uid()`. This prevents inserting a listing on behalf of another user, but the Server Action must explicitly set this field — it is not auto-set by the database. If a Server Action omits `owner_user_id`, the insert will fail (NOT NULL constraint) which is the correct outcome.

**Recommendation:** In the listings Server Action, always explicitly set `owner_user_id = auth.uid()` and `submitted_by = auth.uid()`.

### Risk: media_attachments — entity_type filtering

The `media_attachments` INSERT policy restricts to `entity_type = 'listing'`. If future phases add other entity types (e.g., user avatars, review photos), new policies will be needed for each new entity type. Do not add a catch-all policy. Add a new explicit policy per entity type with appropriate ownership validation.

### Risk: analytics_events — entity_id column assumed to be listing_id

The `analytics_events` SELECT policy assumes `entity_type = 'listing'` and uses `entity_id` as the listing ID. If future event types use `entity_id` for non-listing entities, this policy would unintentionally restrict access. The policy should remain narrow to `entity_type = 'listing'` only.

### Risk: No RLS on listing_details_* (Beta tables)

`listing_details_professional`, `listing_details_creative`, `listing_details_event`, and `listing_details_job` have RLS enabled from the initial migration but no policies. This means they are in **default deny** state — no one can read or write them except via service_role. This is correct at MVP but must be addressed before these tables are used in production.

### Risk: Helper function SECURITY DEFINER

All five helper functions use `SECURITY DEFINER`. This means they execute with the function owner's privileges, bypassing RLS when querying `user_roles` and `listings`. This is intentional — these functions need to read across the user_roles table regardless of the calling user's RLS context. However, any future developer who adds logic to these functions must be aware they bypass RLS internally.

---

## 8. Tests Required Before Production

### Tier 1 — Auth boundary tests (must pass before staging deploy)

| # | Test | Expected result |
|---|---|---|
| 1 | `SELECT * FROM listings` as anon | Returns only `status='published' AND deleted_at IS NULL` rows |
| 2 | `INSERT INTO listings (...)` as anon | Error: insufficient privilege |
| 3 | `SELECT * FROM listings` as authenticated user A | Returns own listings + published listings |
| 4 | `UPDATE listings SET name='x' WHERE owner_user_id = [user B]` as authenticated user A | 0 rows affected (policy blocks) |
| 5 | `DELETE FROM listings WHERE id = [own listing]` as authenticated | Error: no DELETE policy |
| 6 | `SELECT * FROM saves WHERE user_id != auth.uid()` as authenticated | 0 rows |
| 7 | `INSERT INTO saves (user_id, listing_id) VALUES ([other user id], ...)` as authenticated | Error: WITH CHECK violation |
| 8 | `INSERT INTO reviews (..., status='published')` as authenticated | Error: WITH CHECK violation (`status` must be `'intake'`) |
| 9 | `UPDATE reviews SET status='published'` as authenticated | Error: no UPDATE policy |
| 10 | `SELECT * FROM claims` as anon | 0 rows (deny) |
| 11 | `SELECT * FROM admin_audit_log` as authenticated | Error: insufficient privilege |
| 12 | `SELECT * FROM user_roles WHERE user_id != auth.uid()` as authenticated | 0 rows (policy restricts to own) |

### Tier 2 — Ownership boundary tests

| # | Test | Expected result |
|---|---|---|
| 13 | User A inserts into `listing_details_business` with `listing_id` owned by user B | Error: WITH CHECK violation |
| 14 | User A updates `listing_hours` for user B's listing | 0 rows affected |
| 15 | User A reads analytics for user B's listing | 0 rows |
| 16 | User A deletes media uploaded by user B | 0 rows affected |
| 17 | User A reads entity_analytics_daily for user B's listing | 0 rows |

### Tier 3 — Public access tests

| # | Test | Expected result |
|---|---|---|
| 18 | `SELECT * FROM categories` as anon | All category rows |
| 19 | `SELECT * FROM cities` as anon | All city rows |
| 20 | `SELECT * FROM states` as anon | All state rows |
| 21 | `SELECT * FROM plans` as anon | `is_active = true` rows only |
| 22 | `SELECT * FROM collections` as anon | `is_active = true` rows only |
| 23 | `SELECT * FROM collection_items` as anon | Items in active collections only (not all items) |
| 24 | `SELECT * FROM reviews` as anon | `status='published'` rows only |
| 25 | `SELECT * FROM media_attachments` as anon | `entity_type='listing'` items for published listings only |

### Tier 4 — Helper function tests

| # | Test | Expected result |
|---|---|---|
| 26 | `SELECT is_admin()` as a user with role='supporter' | `false` |
| 27 | `SELECT is_admin()` as a user with role='admin' | `true` |
| 28 | `SELECT has_role('owner')` as a user with role='owner' | `true` |
| 29 | `SELECT owns_listing('[listing_id_owned_by_user_B]')` as user A | `false` |
| 30 | `SELECT owns_listing('[listing_id_owned_by_user_A]')` as user A | `true` |

---

## 9. Manual Steps to Apply

**Before applying:**
- [ ] Confirm this migration file has been reviewed
- [ ] Local: `supabase start` and Docker is running

**Apply locally:**
```bash
supabase db push
```

**Apply to staging:**
```bash
supabase db push --linked
```

**After applying:**
```bash
# Regenerate TypeScript types to include helper functions
supabase gen types typescript --local > lib/supabase/types.ts

# Run type check
pnpm tsc --noEmit

# Verify health check
# GET http://localhost:3000/api/health/supabase
```

**Do NOT apply to production until:**
- [ ] All Tier 1 and Tier 2 tests pass on local
- [ ] All Tier 1 and Tier 2 tests pass on staging
- [ ] TypeScript type check passes with zero errors
- [ ] Explicit user approval

---

## 10. Reference

| Source | Location |
|---|---|
| Schema plan | `docs/blacqlist/data/database-schema-plan.md` |
| RLS policy plan | `docs/blacqlist/data/rls-policy-plan.md` |
| Security and privacy plan | `docs/blacqlist/architecture/security-and-privacy-plan.md` |
| Initial migration | `supabase/migrations/20260510000000_initial_blacqlist_mvp_schema.sql` |
| This migration | `supabase/migrations/20260510000001_mvp_rls_policies.sql` |
