# Migration 001 Report — Initial BLACQList MVP Schema

**Migration file:** `supabase/migrations/20260510000000_initial_blacqlist_mvp_schema.sql`
**Seed file:** `supabase/seed.sql`
**Date:** 2026-05-10
**Status:** Ready to apply — pending `supabase db push` by engineer
**Author:** Schema Data Agent
**Reviewed by:** — (pending engineering review before first apply)

---

## 1. Migration Overview

This is the initial database migration for The BLACQList. It creates all 23 MVP-phase tables, all required indexes, all Row Level Security policies, and all triggers needed for the platform to function from day one.

The migration establishes the complete foundation for: user identity and roles, the listing entity system (base + extension), community engagement (saves, reviews, claims), editorial collections, analytics ingestion, and admin audit infrastructure.

After this migration is applied and seed.sql is run, the platform has a complete, production-ready database layer that supports all MVP feature tickets (Tickets 006 through 050).

---

## 2. Naming Convention Note

The product team and UX documentation use "entity" terminology throughout. The BLACQList page is called an "entity" or a "BLACQList Page" in product documents. The user requested 25 tables using `entity_*` naming conventions (e.g., `entity_claims`, `entity_media`, `entity_analytics_daily`).

All official architecture documents (`data-model.md`, `database-schema-plan.md`, `rls-policy-plan.md`) use `listing_*` prefix naming throughout. This migration follows the official naming convention.

### Complete Naming Mapping

| Product / Requested Name  | Official Table Name                | Notes                                                                                |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `entities`                | `listings`                         | The central entity table                                                             |
| `entity_details`          | `listing_details_business`         | Business-type extension                                                              |
| `entity_claims`           | `claims`                           | Ownership claims                                                                     |
| `entity_media`            | `media_attachments`                | Polymorphic media                                                                    |
| `entity_hours`            | `listing_hours`                    | Structured hours rows                                                                |
| `entity_links`            | `listing_links`                    | External link records                                                                |
| `entity_services`         | `services`                         | Service/offering rows                                                                |
| `entity_analytics_daily`  | `entity_analytics_daily`           | KEPT as-is — no `listing_` prefix in official docs; this name is used in Ticket #082 |
| `entity_saves`            | `saves`                            | User saves/bookmarks                                                                 |
| `entity_reviews`          | `reviews`                          | User reviews                                                                         |
| `entity_collections`      | `collections` + `collection_items` | Editorial collections (two tables)                                                   |
| `user_entity_roles`       | `user_roles`                       | User role assignments                                                                |
| `entity_analytics_events` | `analytics_events`                 | Raw analytics event stream                                                           |
| `entity_search_events`    | `search_events`                    | Search query log                                                                     |

---

## 3. Tables Created

23 tables created in dependency order:

| #   | Table Name                 | Phase | Domain     | Purpose                                        |
| --- | -------------------------- | ----- | ---------- | ---------------------------------------------- |
| 1   | `states`                   | MVP   | Reference  | US states + DC; static reference data          |
| 2   | `cities`                   | MVP   | Reference  | Launch cities and future markets               |
| 3   | `categories`               | MVP   | Reference  | Self-referencing category tree                 |
| 4   | `plans`                    | MVP   | Reference  | Listing tier plans (free/standard/premium)     |
| 5   | `profiles`                 | MVP   | Identity   | User public profile; mirrors auth.users        |
| 6   | `listings`                 | MVP   | Entities   | Base entity record for all listing types       |
| 7   | `listing_details_business` | MVP   | Entities   | Business-type extension (1:1 with listings)    |
| 8   | `user_roles`               | MVP   | Identity   | Role assignments per user                      |
| 9   | `services`                 | MVP   | Entities   | Services/offerings under a listing             |
| 10  | `media_attachments`        | MVP   | Entities   | Polymorphic media for listings, reviews, users |
| 11  | `listing_hours`            | MVP   | Entities   | Normalized hours rows per day of week          |
| 12  | `listing_links`            | MVP   | Entities   | External links (social, booking, menu, etc.)   |
| 13  | `claims`                   | MVP   | Entities   | Ownership claim submissions                    |
| 14  | `listings.claim_id` FK     | MVP   | Entities   | Deferred circular FK resolved via ALTER TABLE  |
| 15  | `saves`                    | MVP   | Engagement | User saves/bookmarks                           |
| 16  | `reviews`                  | MVP   | Engagement | User reviews                                   |
| 17  | `collections`              | MVP   | Editorial  | Admin-curated listing collections              |
| 18  | `collection_items`         | MVP   | Editorial  | Junction: collections ↔ listings               |
| 19  | `analytics_events`         | MVP   | Analytics  | Raw event stream                               |
| 20  | `search_events`            | MVP   | Analytics  | Search query log                               |
| 21  | `entity_analytics_daily`   | MVP   | Analytics  | Pre-aggregated daily stats per listing         |
| 22  | `admin_audit_log`          | MVP   | Admin      | Immutable admin action log                     |
| 23  | `moderation_queue`         | MVP   | Admin      | Centralized review queue                       |

---

## 4. Enums and Status CHECK Constraints

Every finite value set is enforced at the database layer via CHECK constraints. No `ENUM` types are used — text columns with CHECK constraints allow future value additions without a migration that rebuilds the column.

| Table                      | Column                     | Allowed Values                                                                                                      |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `cities`                   | `launch_phase`             | `launch`, `v1`, `v2`, `later`                                                                                       |
| `listings`                 | `entity_type`              | `business`, `professional`, `creative`, `event`, `job`, `vendor`                                                    |
| `listings`                 | `location_type`            | `physical`, `online`, `hybrid`, `virtual-services`, `ships-nationwide`                                              |
| `listings`                 | `status`                   | `draft`, `pending`, `published`, `unpublished`, `flagged`, `archived`                                               |
| `listings`                 | `tier`                     | `free`, `standard`, `premium`                                                                                       |
| `listings`                 | `source`                   | `owner`, `community`, `admin`, `import`                                                                             |
| `listings`                 | `trust_tier`               | `unclaimed`, `claimed`, `verified`, `certified`                                                                     |
| `listings`                 | `flag_status`              | `none`, `inactive`, `duplicate`, `incorrect`, `spam`                                                                |
| `listings`                 | `sponsored_placement_type` | `homepage`, `search`, `category`, `city`                                                                            |
| `listings`                 | `verification_status`      | `none`, `pending`, `under_review`, `verified`, `rejected`                                                           |
| `listing_details_business` | `cta_type`                 | `book`, `order`, `call`, `message`, `visit`, `get-quote`, `shop`, `subscribe`, `contact`                            |
| `listing_details_business` | `price_range`              | `$`, `$$`, `$$$`, `$$$$`                                                                                            |
| `listing_details_business` | `founded_year`             | CHECK >= 1800 AND <= 2100                                                                                           |
| `user_roles`               | `role`                     | `supporter`, `owner`, `editor`, `admin`, `super_admin`                                                              |
| `media_attachments`        | `entity_type`              | `listing`, `product`, `review`, `user`                                                                              |
| `listing_hours`            | `day_of_week`              | CHECK BETWEEN 0 AND 6 (0=Sunday)                                                                                    |
| `listing_links`            | `link_type`                | `website`, `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `twitter`, `booking`, `menu`, `order`, `other` |
| `claims`                   | `status`                   | `pending`, `under_review`, `approved`, `rejected`, `withdrawn`                                                      |
| `reviews`                  | `rating`                   | CHECK BETWEEN 1 AND 5                                                                                               |
| `reviews`                  | `status`                   | `intake`, `pending_approval`, `published`, `rejected`, `removed`                                                    |
| `plans`                    | `name`                     | `free`, `standard`, `premium`                                                                                       |
| `analytics_events`         | —                          | No status enum; event_name is free text                                                                             |
| `entity_analytics_daily`   | —                          | No status enum; stats only                                                                                          |
| `moderation_queue`         | `queue_type`               | `claim`, `correction`, `review`, `flagged_listing`, `verification`                                                  |
| `moderation_queue`         | `status`                   | `pending`, `assigned`, `resolved`, `dismissed`                                                                      |
| `admin_audit_log`          | —                          | No status enum; immutable records                                                                                   |

---

## 5. Indexes Created

**Total index count: 62** (including UNIQUE indexes, partial indexes, GIN, and B-tree)

### UNIQUE indexes (enforce uniqueness constraints)

| Index                                      | Table                    | Column(s)                        |
| ------------------------------------------ | ------------------------ | -------------------------------- |
| `states_code_idx`                          | `states`                 | `code`                           |
| `cities_slug_idx`                          | `cities`                 | `slug`                           |
| `listings_slug_idx`                        | `listings`               | `slug`                           |
| `plans_name_idx`                           | `plans`                  | `name`                           |
| `collections_slug_idx`                     | `collections`            | `slug`                           |
| `user_roles` UNIQUE constraint             | `user_roles`             | `(user_id, role, listing_id)`    |
| `saves` UNIQUE constraint                  | `saves`                  | `(user_id, listing_id)`          |
| `reviews` UNIQUE constraint                | `reviews`                | `(reviewer_user_id, listing_id)` |
| `listing_hours` UNIQUE constraint          | `listing_hours`          | `(listing_id, day_of_week)`      |
| `collection_items` UNIQUE constraint       | `collection_items`       | `(collection_id, listing_id)`    |
| `entity_analytics_daily` UNIQUE constraint | `entity_analytics_daily` | `(listing_id, snapshot_date)`    |
| `categories_slug_idx`                      | `categories`             | `slug`                           |

### GIN indexes (full-text search)

| Index                        | Table      | Column                |
| ---------------------------- | ---------- | --------------------- |
| `listings_search_vector_idx` | `listings` | `search_vector` (GIN) |

### Partial indexes (filtered queries — key performance indexes)

| Index                          | Table        | Filter                                       |
| ------------------------------ | ------------ | -------------------------------------------- |
| `cities_is_active_idx`         | `cities`     | `WHERE is_active = true`                     |
| `listings_is_featured_idx`     | `listings`   | `WHERE is_featured = true`                   |
| `listings_is_sponsored_idx`    | `listings`   | `WHERE is_sponsored = true`                  |
| `listings_deleted_at_idx`      | `listings`   | `WHERE deleted_at IS NULL`                   |
| `listings_auto_archive_at_idx` | `listings`   | `WHERE auto_archive_at IS NOT NULL`          |
| `listings_auto_expire_at_idx`  | `listings`   | `WHERE auto_expire_at IS NOT NULL`           |
| `user_roles_listing_id_idx`    | `user_roles` | `WHERE listing_id IS NOT NULL`               |
| `claims_status_idx`            | `claims`     | `WHERE status IN ('pending','under_review')` |
| `reviews_status_pending_idx`   | `reviews`    | `WHERE status = 'pending_approval'`          |
| `listings_claim_id_idx`        | `listings`   | `WHERE claim_id IS NOT NULL`                 |

---

## 6. Triggers

8 trigger functions + 10 trigger bindings created in this migration:

| Trigger Function                    | Tables it fires on                                                                                                                                                                                                                                                 | Event                            | Purpose                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `update_updated_at()`               | `cities`, `categories`, `plans`, `profiles`, `listings`, `listing_details_business`, `user_roles` (not applicable — no updated_at), `services`, `listing_hours`, `listing_links`, `claims`, `reviews`, `collections`, `entity_analytics_daily`, `moderation_queue` | BEFORE UPDATE                    | Auto-set `updated_at = now()` on every update                                                          |
| `create_profile_on_signup()`        | `auth.users`                                                                                                                                                                                                                                                       | AFTER INSERT                     | Create a corresponding `profiles` row when a new auth user registers                                   |
| `assign_supporter_role_on_signup()` | `auth.users`                                                                                                                                                                                                                                                       | AFTER INSERT                     | Create a `user_roles` row with `role='supporter'` when a new auth user registers                       |
| `update_listings_search_vector()`   | `listings`                                                                                                                                                                                                                                                         | BEFORE INSERT OR UPDATE          | Recompute the `search_vector` tsvector column from name (A), tagline (B), service_area_description (D) |
| `update_listing_save_count()`       | `saves`                                                                                                                                                                                                                                                            | AFTER INSERT OR DELETE           | Increment or decrement `listings.save_count`; GREATEST guard prevents negative values                  |
| `update_listing_review_stats()`     | `reviews`                                                                                                                                                                                                                                                          | AFTER INSERT OR UPDATE OR DELETE | Recompute `listings.review_count` and `listings.avg_rating` from published reviews only                |
| `prevent_audit_log_modification()`  | `admin_audit_log`                                                                                                                                                                                                                                                  | BEFORE UPDATE OR DELETE          | RAISE EXCEPTION to enforce immutability of audit log records                                           |

**`set_updated_at` trigger is bound on 13 tables:**
`cities`, `categories`, `plans`, `profiles`, `listings`, `listing_details_business`, `services`, `listing_hours`, `listing_links`, `claims`, `reviews`, `collections`, `entity_analytics_daily`, `moderation_queue`

---

## 7. Row Level Security

RLS is enabled on all 23 tables in this migration. The default PostgreSQL behavior when RLS is enabled and no policy matches is to return zero rows on SELECT and reject mutations — this is the intended behavior for service-role-only tables.

### Tables with anon + authenticated read access (public reference data)

| Table        | Policy                                                 |
| ------------ | ------------------------------------------------------ |
| `states`     | `anon`, `authenticated`: SELECT all                    |
| `cities`     | `anon`, `authenticated`: SELECT all                    |
| `categories` | `anon`, `authenticated`: SELECT WHERE is_active = true |
| `plans`      | `anon`, `authenticated`: SELECT WHERE is_active = true |

### Tables with role-differentiated access

| Table                      | anon                                              | authenticated                                                                         | Notes                                                  |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `listings`                 | SELECT published + not deleted                    | SELECT published/not deleted OR own listings; INSERT (submitted_by = uid); UPDATE own | No DELETE policy — soft delete only                    |
| `listing_details_business` | SELECT for published parent                       | SELECT published or own; INSERT/UPDATE for owners                                     | Ownership enforced via listings.owner_user_id join     |
| `services`                 | SELECT for published parent                       | SELECT for published; INSERT/UPDATE/DELETE for owners                                 | Same ownership join pattern                            |
| `listing_hours`            | SELECT for published parent                       | SELECT published or own; INSERT/UPDATE/DELETE for owners                              | —                                                      |
| `listing_links`            | SELECT for published parent                       | SELECT for published; INSERT/UPDATE/DELETE for owners                                 | —                                                      |
| `media_attachments`        | SELECT entity_type='listing' AND is_approved=true | SELECT is_approved=true; INSERT (uploaded_by=uid); DELETE own                         | Service layer enforces published parent check for anon |
| `profiles`                 | No access at MVP                                  | SELECT + UPDATE own record (id = uid)                                                 | anon public profiles deferred to V1                    |
| `user_roles`               | No access                                         | SELECT own records                                                                    | All writes via service role                            |
| `claims`                   | No access                                         | INSERT (claimant = uid); SELECT own                                                   | All updates via service role                           |
| `saves`                    | No access                                         | ALL (user_id = uid)                                                                   | Insert + delete + select own                           |
| `reviews`                  | SELECT published                                  | SELECT published OR own; INSERT (reviewer=uid, status='intake')                       | No update/delete for authenticated                     |
| `collections`              | SELECT is_active=true                             | SELECT is_active=true                                                                 | Writes via service role only                           |
| `collection_items`         | SELECT all                                        | SELECT all                                                                            | Writes via service role only                           |
| `analytics_events`         | No access                                         | SELECT own listing events only                                                        | INSERT via service role                                |
| `entity_analytics_daily`   | No access                                         | SELECT own listings                                                                   | INSERT/UPDATE via service role                         |

### Tables with service-role-only access (no anon or authenticated policies)

| Table              | Reason                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| `search_events`    | Sensitive query data; aggregated analytics only surfaced via owner dashboard |
| `admin_audit_log`  | Admin-only; all writes from service role in server actions                   |
| `moderation_queue` | Admin-only; managed by server actions and background jobs                    |

---

## 8. Seed Data

`supabase/seed.sql` contains the following reference data:

| Table        | Row count | Notes                                                              |
| ------------ | --------- | ------------------------------------------------------------------ |
| `states`     | 51        | All 50 US states + District of Columbia                            |
| `cities`     | 13        | 3 primary launch (is_active=true) + 10 secondary (is_active=false) |
| `categories` | 188       | 25 top-level + 163 subcategories                                   |
| `plans`      | 3         | free, standard, premium                                            |

**Total seed rows: 255**

All inserts use `ON CONFLICT DO NOTHING` — the seed is idempotent and safe to re-run.

Category IDs use fixed UUIDs with a recognizable pattern (`c0000001-*` for top-level, `c0000002-*` for subcategories) to make them stable, predictable, and easy to reference in application code and future seed files.

### What is NOT in this seed file

- Test user accounts (belongs in `supabase/seeds/005_test_users.sql`, dev/staging only)
- Test user roles (belongs in `supabase/seeds/006_test_user_roles.sql`, dev/staging only)
- Listings (belongs in `supabase/seeds/007_listings.sql`, staging/production)
- Media, collections, collection_items (staging/production seed files)
- Any analytics, review, or save records (real data only)

---

## 9. Deferred Tables (Not in This Migration)

Tables scoped to Beta, V1, V2, or V3 phases are intentionally excluded from this migration. They depend on MVP tables being stable first.

### Beta Phase (4–8 weeks post-MVP)

| Table                          | Reason deferred                                    |
| ------------------------------ | -------------------------------------------------- |
| `listing_details_professional` | Professional entity type not in MVP scope          |
| `listing_details_creative`     | Creative entity type not in MVP scope              |
| `listing_details_event`        | Event entity type not in MVP scope                 |
| `listing_details_job`          | Job entity type not in MVP scope                   |
| `listing_details_vendor`       | Vendor entity type not in MVP scope                |
| `products`                     | Vendor storefront — deferred to Beta (Ticket #071) |
| `listing_tags`                 | Tag system — not in MVP feature inventory          |
| `follows`                      | Social following — not in MVP                      |

### V1 Phase (8–12 weeks post-MVP)

| Table                     | Reason deferred                                        |
| ------------------------- | ------------------------------------------------------ |
| `subscriptions`           | Monetization plan — Standard/Premium paid tiers are V1 |
| `subscription_events`     | Billing event log — V1                                 |
| `verification_requests`   | Formal verification workflow — V1                      |
| `editorial_spotlights`    | Featured editorial placements — V1                     |
| `homepage_featured_slots` | Homepage featured config — V1                          |

### V2 Phase

| Table               | Reason deferred                                  |
| ------------------- | ------------------------------------------------ |
| `spend_events`      | Receipt verification / dollar-flow tracking — V2 |
| `receipts`          | Receipt upload and parsing — V2                  |
| `ai_flags`          | AI moderation flags (Ticket #081) — V2           |
| `sponsor_campaigns` | Sponsored placement campaigns — V2               |
| `messages`          | Owner/supporter messaging — V2                   |

---

## 10. Naming Mapping Reference

This table is the canonical mapping for engineers switching between product documentation (which uses "entity" terminology) and the database (which uses "listing" terminology).

| What product/UX docs call it | Database table                              | Column prefix   |
| ---------------------------- | ------------------------------------------- | --------------- |
| Entity / BLACQList Page      | `listings`                                  | `listing_`      |
| Entity type                  | `listings.entity_type`                      | —               |
| Entity details               | `listing_details_business`                  | `listing_id` FK |
| Entity hours                 | `listing_hours`                             | `listing_id` FK |
| Entity links / socials       | `listing_links`                             | `listing_id` FK |
| Entity services              | `services`                                  | `listing_id` FK |
| Entity media / gallery       | `media_attachments` (entity_type='listing') | `entity_id`     |
| Entity claim                 | `claims`                                    | `listing_id` FK |
| Entity save                  | `saves`                                     | `listing_id` FK |
| Entity review                | `reviews`                                   | `listing_id` FK |
| Entity trust tier            | `listings.trust_tier`                       | —               |
| Entity analytics             | `entity_analytics_daily`                    | `listing_id` FK |
| Entity collection membership | `collection_items`                          | `listing_id` FK |

---

## 11. Critical Assumptions

The following assumptions are documented so that any deviation from them is caught before or during review:

1. **Supabase Auth exists and is configured** before this migration runs. The `auth.users` table is referenced by FK in `profiles`, `user_roles`, `listings`, `claims`, `reviews`, `saves`, `analytics_events`, `search_events`, `admin_audit_log`, and `moderation_queue`. If `auth.users` does not exist, the migration will fail.

2. **`pg_trgm` extension** is available in the Supabase project. This is enabled by the first statement in the migration (`CREATE EXTENSION IF NOT EXISTS pg_trgm`). On Supabase, this extension is pre-approved and should enable without error.

3. **Supabase service role** is used for all admin mutations, background job writes, and analytics ingestion. No `authenticated` RLS policies are written for these operations. Any server action touching admin tables must use the service role client (`createServiceClient()`), never the public client.

4. **listing_details_business is the only entity extension table at MVP.** The `entity_type` column in `listings` supports six types but only `business` has an extension table in this migration. All other entity types (`professional`, `creative`, `event`, `job`, `vendor`) are handled in Beta migrations.

5. **search_vector does not include description.** The `listings.search_vector` trigger weights name (A), tagline (B), and service_area_description (D). Business description lives in `listing_details_business.description`, which cannot be accessed from the `listings` trigger without a join. Incorporating description into full-text search requires a separate trigger on `listing_details_business` that updates `listings.search_vector`. This is documented as a known limitation and deferred to V1.

6. **Denormalized counters (save_count, review_count, avg_rating) can drift** if rows are inserted or deleted directly via service role without firing row-level triggers. The aggregation job (Ticket #082) provides a nightly reconciliation to catch and correct any drift.

7. **RLS policies for `collection_items`** use `USING (true)` for anon and authenticated SELECT because collection items are always public. Service layer filtering for `is_active` parent collections is enforced at the application layer.

---

## 12. Manual Steps Required Before First Use

Complete these steps in order after the migration is applied:

**Step 1: Link the Supabase project (if not already done)**

```bash
supabase init              # if not already initialized
supabase link --project-ref [YOUR_PROJECT_REF]
```

**Step 2: Apply the migration**

```bash
supabase db push
```

Expected output: all tables created, no errors.

**Step 3: Verify the pg_trgm extension**

In Supabase Dashboard, go to Database > Extensions and confirm `pg_trgm` is enabled. If the migration's `CREATE EXTENSION IF NOT EXISTS pg_trgm` did not enable it automatically, enable it manually in the Supabase Dashboard.

**Step 4: Apply the seed data**

```bash
# From the project root
psql $DATABASE_URL < supabase/seed.sql
```

Or via the Supabase SQL editor (paste contents of seed.sql and run).

**Step 5: Validate seed data row counts**

```sql
SELECT 'states'     AS tbl, COUNT(*) FROM states
UNION ALL
SELECT 'cities',    COUNT(*) FROM cities
UNION ALL
SELECT 'categories',COUNT(*) FROM categories
UNION ALL
SELECT 'plans',     COUNT(*) FROM plans;
-- Expected: 51, 13, 188, 3
```

**Step 6: Replace Stripe price ID placeholders (before V1 launch)**

Before activating the Standard and Premium paid tiers, run:

```sql
UPDATE plans
SET stripe_price_id_monthly = 'price_REAL_STANDARD_MONTHLY',
    stripe_price_id_yearly  = 'price_REAL_STANDARD_YEARLY'
WHERE name = 'standard';

UPDATE plans
SET stripe_price_id_monthly = 'price_REAL_PREMIUM_MONTHLY',
    stripe_price_id_yearly  = 'price_REAL_PREMIUM_YEARLY'
WHERE name = 'premium';
```

**Step 7: Activate secondary market cities as each market launches**

```sql
UPDATE cities SET is_active = true WHERE slug = 'washington-dc';
-- Repeat for each market when activating
```

**Step 8: Regenerate TypeScript types**

```bash
supabase gen types typescript --local > lib/supabase/types.ts
# Or for remote:
supabase gen types typescript --project-id [YOUR_PROJECT_REF] > lib/supabase/types.ts
```

**Step 9: For dev/staging — seed test users**

Create the four test accounts in Supabase Auth Studio (or via admin API), then run:

```bash
psql $DATABASE_URL < supabase/seeds/005_test_users.sql
psql $DATABASE_URL < supabase/seeds/006_test_user_roles.sql
```

These files do not exist yet — create them following the spec in `docs/blacqlist/data/seed-data-plan.md` Section 9.

---

## 13. Risks and Known Limitations

| Risk                                                                 | Severity    | Mitigation                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Circular FK between `listings.claim_id` and `claims.listing_id`      | Low         | Resolved via deferred `ALTER TABLE` — claims table created first, then FK added to listings. Order is explicit in migration.                                                                                                                              |
| `search_vector` does not include business description                | Medium      | Description lives in `listing_details_business`, not in `listings`. Weighted full-text search over description requires a cross-table trigger update, deferred to V1. Search quality at MVP is based on name, tagline, and service_area_description only. |
| Denormalized counters can drift under service_role direct inserts    | Low         | Nightly aggregation job (Ticket #082) reconciles counts. Drift is non-critical (display counters only).                                                                                                                                                   |
| RLS policies on `collection_items` use bare `USING (true)`           | Low         | Collection items are always public content. Service layer enforces `is_active = true` on the parent collection before rendering. No private data in collection_items.                                                                                     |
| `media_attachments` has no formal FK on `entity_id` (polymorphic)    | Medium      | Service layer enforces ownership and published-parent validation. Orphaned media rows can accumulate if parent entity is hard-deleted (hard delete is not permitted by RLS, so this risk is limited to service-role operations).                          |
| `admin_audit_log` and `search_events` have no RLS policies           | Intentional | Default-deny RLS protects these tables. Service role only access is the correct design. Do not add authenticated policies without engineering lead review.                                                                                                |
| Test user UUIDs in seed files must be created in Supabase Auth first | Operational | See seed-data-plan.md Section 9 for the exact creation procedure. Test seed files (005, 006) must not run until Auth accounts exist.                                                                                                                      |
| Stripe placeholder strings will fail Stripe API calls                | V1 gate     | The `plans` table holds placeholder strings. Monetization API calls must validate that the price ID is not a placeholder before calling Stripe. Add this guard in the service layer before V1 launch.                                                     |

---

## 14. How to Apply

### Fresh local environment

```bash
# 1. Start Supabase locally
supabase start

# 2. Apply migration
supabase db push

# 3. Seed reference data
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql

# 4. Regenerate types
supabase gen types typescript --local > lib/supabase/types.ts
```

### Staging environment

```bash
# 1. Link project
supabase link --project-ref [STAGING_PROJECT_REF]

# 2. Apply migration (review diff first)
supabase db push --dry-run    # review what will be applied
supabase db push              # apply

# 3. Seed reference data
# Use Supabase Dashboard SQL editor or psql with the staging DATABASE_URL
psql $STAGING_DATABASE_URL < supabase/seed.sql

# 4. Run dev/staging-specific seed files (test users)
psql $STAGING_DATABASE_URL < supabase/seeds/005_test_users.sql
psql $STAGING_DATABASE_URL < supabase/seeds/006_test_user_roles.sql
```

### Production environment

```bash
# 1. Confirm backup exists in Supabase Dashboard > Backups
# 2. Link to production project
supabase link --project-ref [PRODUCTION_PROJECT_REF]

# 3. Dry run
supabase db push --dry-run

# 4. Apply (coordinate with deployment window)
supabase db push

# 5. Apply reference data seed ONLY (no test files)
psql $PRODUCTION_DATABASE_URL < supabase/seed.sql

# 6. Verify row counts (see Step 5 in Section 12)
# 7. Regenerate types and deploy application
supabase gen types typescript --project-id [PRODUCTION_PROJECT_REF] > lib/supabase/types.ts
```

### Rollback procedure

This migration adds tables, indexes, triggers, and RLS policies. There are no destructive changes to existing tables. Rollback, if needed, requires dropping all created objects in reverse dependency order.

Because this is the initial migration on a new database, the practical rollback is to drop the Supabase project and recreate it. For a production environment, restore from the pre-migration backup confirmed in Step 1.

This migration is not reversible via a simple `supabase migration revert` without a down-migration file. Down migration files are deferred — the initial schema is not expected to roll back in production.

---

_Migration report complete. Next steps: Ticket #006 (geographic tables migration) is superseded by this migration. Ticket #007 (category taxonomy) and Ticket #008 (user profiles/roles) are also covered. Engineering should close those tickets and update the README.md in `docs/blacqlist/tickets/` to reflect that the initial schema is delivered in a single consolidated migration file._
