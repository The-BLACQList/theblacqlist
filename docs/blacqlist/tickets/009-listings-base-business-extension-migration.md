# Ticket 009: Listings base table and business extension migration

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P0

## Feature Area

Database

## Context

The `listings` table is the central entity of the entire platform — every BLACQList Page, every search result, every claim, every save, and every analytics event references a row in `listings`. The `listing_details_business` extension table holds business-specific contact, hours, social, and CTA fields. The `search_vector` tsvector column and its maintenance trigger are the foundation of Phase 1 full-text search. This migration must include the FK back-fill for `user_roles.listing_id` deferred from Ticket 008. Source documents: `docs/blacqlist/data/database-schema-plan.md` (Section 2: `listings`, `listing_details_business`), `docs/blacqlist/data/rls-policy-plan.md` (Section 4: `listings`, `listing_details_business`).

## User Story

As a business owner, I want to create a listing for my business that is stored in the platform database with full metadata, trust tier tracking, SEO fields, and a full-text search vector, so that my business can be discovered through search and featured on a BLACQList Page.

## Scope

- Write SQL migration `supabase/migrations/20260507000004_listings_base_business.sql`
- Create `listings` table with all fields from schema plan (see Data Notes for complete column list — there are ~50 columns)
- Create `listing_details_business` table with all fields from schema plan
- Enable `pg_trgm` extension (idempotent — may already be enabled from Ticket 002 manual setup; `CREATE EXTENSION IF NOT EXISTS`)
- Create the `search_vector` tsvector maintenance trigger on `listings`
- Add `ALTER TABLE user_roles ADD CONSTRAINT user_roles_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE` (FK deferred from Ticket 008)
- Create all required indexes on `listings` (GIN on `search_vector`, B-tree on status/entity_type/city_id/category_id/owner_user_id/trust_tier, partial indexes for is_featured/is_sponsored/deleted_at/auto_archive_at/auto_expire_at)
- Enable RLS on both tables
- Write RLS policies per `rls-policy-plan.md` for `listings` and `listing_details_business`
- Add `updated_at` trigger to both `listings` and `listing_details_business`

## Out of Scope

- Supplementary tables: `listing_hours`, `listing_links`, `services`, `media_attachments` (Ticket 010)
- Admin listing management UI
- Owner listing create/edit UI
- The `claims` table (referenced by `listings.claim_id` FK) — see Edge Cases for how to handle this
- Analytics or save count denormalization triggers (later ticket)

## Dependencies

- Depends on: Ticket 006 — `cities` table must exist for `listings.city_id` FK
- Depends on: Ticket 007 — `categories` table must exist for `listings.category_id` FK (NOT NULL constraint)
- Depends on: Ticket 008 — `user_roles` table must exist for the `ALTER TABLE user_roles ADD CONSTRAINT` command in this migration

## UX Notes

N/A — database migration ticket. No user-facing screens are built here.

## Design Notes

N/A — database migration ticket.

## Data Notes

**`listings` table — complete field spec** (extracted from `database-schema-plan.md` Section 2):

| Column                          | Type           | Nullable | Default             | Key constraint                                                                                                   |
| ------------------------------- | -------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                            | `uuid`         | NO       | `gen_random_uuid()` | PK                                                                                                               |
| `name`                          | `text`         | NO       | —                   | —                                                                                                                |
| `slug`                          | `text`         | NO       | —                   | UNIQUE                                                                                                           |
| `entity_type`                   | `text`         | NO       | —                   | CHECK IN ('business','professional','creative','event','job','vendor')                                           |
| `tagline`                       | `text`         | YES      | —                   | —                                                                                                                |
| `category_id`                   | `uuid`         | NO       | —                   | FK → categories(id) ON DELETE RESTRICT                                                                           |
| `subcategory_ids`               | `uuid[]`       | YES      | —                   | —                                                                                                                |
| `city_id`                       | `uuid`         | YES      | —                   | FK → cities(id) ON DELETE SET NULL                                                                               |
| `location_type`                 | `text`         | NO       | `'physical'`        | CHECK IN ('physical','online','hybrid','virtual-services','ships-nationwide')                                    |
| `service_area_description`      | `text`         | YES      | —                   | Indexed in search_vector                                                                                         |
| `ships_nationwide`              | `boolean`      | NO       | `false`             | —                                                                                                                |
| `status`                        | `text`         | NO       | `'draft'`           | CHECK IN ('draft','pending','published','unpublished','flagged','archived')                                      |
| `tier`                          | `text`         | NO       | `'free'`            | CHECK IN ('free','standard','premium')                                                                           |
| `source`                        | `text`         | NO       | `'owner'`           | CHECK IN ('owner','community','admin','import')                                                                  |
| `published_at`                  | `timestamptz`  | YES      | —                   | Set on first publish                                                                                             |
| `trust_tier`                    | `text`         | NO       | `'unclaimed'`       | CHECK IN ('unclaimed','claimed','verified','certified')                                                          |
| `claim_id`                      | `uuid`         | YES      | —                   | FK → claims(id) ON DELETE SET NULL (claims table created later; add as deferrable or add FK in claims migration) |
| `verified_at`                   | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `verified_by`                   | `uuid`         | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL                                                                           |
| `certification_auto_granted_at` | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `flag_status`                   | `text`         | NO       | `'none'`            | CHECK IN ('none','inactive','duplicate','incorrect','spam')                                                      |
| `admin_notes`                   | `text`         | YES      | —                   | Admin-only; never exposed to users                                                                               |
| `moderation_notes`              | `text`         | YES      | —                   | Visible to owner on rejection                                                                                    |
| `is_featured`                   | `boolean`      | NO       | `false`             | —                                                                                                                |
| `is_sponsored`                  | `boolean`      | NO       | `false`             | —                                                                                                                |
| `sponsored_expires_at`          | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `sponsored_placement_type`      | `text`         | YES      | —                   | —                                                                                                                |
| `verification_status`           | `text`         | NO       | `'none'`            | CHECK IN ('none','pending','verified','rejected')                                                                |
| `verification_docs`             | `text[]`       | YES      | —                   | Storage paths; admin-only                                                                                        |
| `verification_notes`            | `text`         | YES      | —                   | —                                                                                                                |
| `meta_title`                    | `text`         | YES      | —                   | —                                                                                                                |
| `meta_description`              | `text`         | YES      | —                   | —                                                                                                                |
| `og_image_path`                 | `text`         | YES      | —                   | Storage path                                                                                                     |
| `canonical_url`                 | `text`         | YES      | —                   | System-managed                                                                                                   |
| `json_ld_type`                  | `text`         | YES      | —                   | —                                                                                                                |
| `sitemap_include`               | `boolean`      | NO       | `true`              | —                                                                                                                |
| `noindex`                       | `boolean`      | NO       | `false`             | —                                                                                                                |
| `logo_path`                     | `text`         | YES      | —                   | Storage path                                                                                                     |
| `cover_image_path`              | `text`         | YES      | —                   | Storage path                                                                                                     |
| `last_edited_by_owner_at`       | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `last_admin_updated_at`         | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `auto_archive_at`               | `timestamptz`  | YES      | —                   | For events                                                                                                       |
| `auto_expire_at`                | `timestamptz`  | YES      | —                   | For jobs                                                                                                         |
| `stale_flagged_at`              | `timestamptz`  | YES      | —                   | —                                                                                                                |
| `is_vendor`                     | `boolean`      | NO       | `false`             | —                                                                                                                |
| `review_count`                  | `integer`      | NO       | `0`                 | —                                                                                                                |
| `avg_rating`                    | `numeric(3,2)` | YES      | —                   | —                                                                                                                |
| `save_count`                    | `integer`      | NO       | `0`                 | —                                                                                                                |
| `view_count`                    | `integer`      | NO       | `0`                 | —                                                                                                                |
| `owner_user_id`                 | `uuid`         | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL                                                                           |
| `submitted_by`                  | `uuid`         | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL                                                                           |
| `updated_by`                    | `uuid`         | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL                                                                           |
| `created_at`                    | `timestamptz`  | NO       | `now()`             | —                                                                                                                |
| `updated_at`                    | `timestamptz`  | NO       | `now()`             | —                                                                                                                |
| `deleted_at`                    | `timestamptz`  | YES      | —                   | Soft delete                                                                                                      |
| `search_vector`                 | `tsvector`     | YES      | —                   | GIN indexed; maintained by trigger                                                                               |

**`listing_details_business` table — key fields** (see schema plan for full list):

| Column                 | Type          | Nullable | Default   |
| ---------------------- | ------------- | -------- | --------- | ------------------------------------------------------------------------------------------- |
| `listing_id`           | `uuid`        | NO       | —         | PK and FK → listings(id) ON DELETE CASCADE                                                  |
| `description`          | `text`        | YES      | —         | Used in search_vector                                                                       |
| `hours`                | `jsonb`       | YES      | —         | Structured hours                                                                            |
| `hours_notes`          | `text`        | YES      | —         | —                                                                                           |
| `address_line_1`       | `text`        | YES      | —         | PII                                                                                         |
| `address_line_2`       | `text`        | YES      | —         | —                                                                                           |
| `city_text`            | `text`        | YES      | —         | Denormalized from listings.city_id                                                          |
| `state`                | `text`        | YES      | —         | Two-letter code                                                                             |
| `zip`                  | `text`        | YES      | —         | —                                                                                           |
| `lat`                  | `numeric`     | YES      | —         | V2 geocoding                                                                                |
| `lng`                  | `numeric`     | YES      | —         | V2 geocoding                                                                                |
| `phone`                | `text`        | YES      | —         | PII                                                                                         |
| `email`                | `text`        | YES      | —         | PII                                                                                         |
| `website_url`          | `text`        | YES      | —         | —                                                                                           |
| `social_instagram`     | `text`        | YES      | —         | —                                                                                           |
| `social_facebook`      | `text`        | YES      | —         | —                                                                                           |
| `social_linkedin`      | `text`        | YES      | —         | —                                                                                           |
| `social_tiktok`        | `text`        | YES      | —         | —                                                                                           |
| `social_youtube`       | `text`        | YES      | —         | —                                                                                           |
| `social_twitter`       | `text`        | YES      | —         | —                                                                                           |
| `cta_type`             | `text`        | NO       | `'visit'` | CHECK IN ('book','order','call','message','visit','get-quote','shop','subscribe','contact') |
| `cta_url`              | `text`        | YES      | —         | —                                                                                           |
| `cta_label_override`   | `text`        | YES      | —         | —                                                                                           |
| `ships_nationwide`     | `boolean`     | NO       | `false`   | —                                                                                           |
| `accepts_reservations` | `boolean`     | YES      | —         | V1                                                                                          |
| `price_range`          | `text`        | YES      | —         | CHECK IN ('$','$$','$$$','$$$$')                                                            |
| `founded_year`         | `integer`     | YES      | —         | V1                                                                                          |
| `created_at`           | `timestamptz` | NO       | `now()`   | —                                                                                           |
| `updated_at`           | `timestamptz` | NO       | `now()`   | —                                                                                           |

**`search_vector` trigger** (weights per schema plan):

- A-weight: `name`
- B-weight: category name (denormalized at time of update), city name (denormalized), `tagline`
- C-weight: `listing_details_business.description`, `service_area_description`

The trigger must JOIN to `categories` and `cities` to get the denormalized names at update time.

**RLS policies — `listings`:**

```sql
-- anon SELECT: published + not deleted
CREATE POLICY "listings_select_public" ON listings
  FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL);

-- authenticated SELECT: published + not deleted, OR own drafts
CREATE POLICY "listings_select_authenticated" ON listings
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- authenticated INSERT: any signed-in user can create a listing
CREATE POLICY "listings_insert_authenticated" ON listings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- authenticated UPDATE: own non-deleted listings only
CREATE POLICY "listings_update_own" ON listings
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() AND deleted_at IS NULL);

-- No DELETE policy for authenticated — soft delete via service_role only
```

**RLS policies — `listing_details_business`:** Follow the ownership-gate pattern through parent `listings.owner_user_id = auth.uid()` subquery (see `rls-policy-plan.md` Section 4: `listing_details_business`).

**Migration file:** `supabase/migrations/20260507000004_listings_base_business.sql`

## API Notes

N/A — no API routes in this ticket.

Future listing queries will follow this pattern:

```typescript
// Public listing fetch (used by BLACQList Page)
const { data: listing } = await supabase
  .from('listings')
  .select(
    `
    *,
    listing_details_business(*),
    categories(name, slug),
    cities(name, slug)
  `
  )
  .eq('slug', slug)
  .eq('status', 'published')
  .is('deleted_at', null)
  .single()
```

## Implementation Notes

**Files to create:**

- `supabase/migrations/20260507000004_listings_base_business.sql`

**Key implementation notes:**

1. **`claim_id` FK deferral:** The `claims` table does not exist yet. Create `listings.claim_id` as a plain `uuid` nullable column without the FK constraint in this migration. Add `ALTER TABLE listings ADD CONSTRAINT listings_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL` in the `claims` table migration.

2. **`search_vector` trigger function:**

```sql
CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  cat_name text;
  city_name_val text;
  biz_description text;
BEGIN
  -- Get category name
  SELECT name INTO cat_name FROM categories WHERE id = NEW.category_id;
  -- Get city name
  SELECT name INTO city_name_val FROM cities WHERE id = NEW.city_id;
  -- Get business description (may not exist yet at insert time)
  SELECT description INTO biz_description
    FROM listing_details_business WHERE listing_id = NEW.id;

  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(city_name_val, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(biz_description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_search_vector_update
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_listings_search_vector();
```

3. **`ALTER TABLE user_roles`** — add the FK at the end of this migration:

```sql
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
```

4. **All indexes:**

```sql
CREATE UNIQUE INDEX listings_slug_unique ON listings (slug);
CREATE INDEX listings_search_vector_idx ON listings USING GIN (search_vector);
CREATE INDEX listings_status_idx ON listings (status);
CREATE INDEX listings_entity_type_idx ON listings (entity_type);
CREATE INDEX listings_city_id_idx ON listings (city_id);
CREATE INDEX listings_category_id_idx ON listings (category_id);
CREATE INDEX listings_owner_user_id_idx ON listings (owner_user_id);
CREATE INDEX listings_trust_tier_idx ON listings (trust_tier);
CREATE INDEX listings_is_featured_idx ON listings (is_featured) WHERE is_featured = true;
CREATE INDEX listings_is_sponsored_idx ON listings (is_sponsored) WHERE is_sponsored = true;
CREATE INDEX listings_deleted_at_idx ON listings (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX listings_auto_archive_at_idx ON listings (auto_archive_at) WHERE auto_archive_at IS NOT NULL;
CREATE INDEX listings_auto_expire_at_idx ON listings (auto_expire_at) WHERE auto_expire_at IS NOT NULL;
```

**Do not:**

- Store CDN URLs in `logo_path`, `cover_image_path`, or `og_image_path` — storage paths only
- Allow any client-facing query to return `admin_notes`, `verification_docs`, or `verification_notes` — these are service_role-only fields; the service layer must exclude them from all client queries
- Set `status = 'published'` as a default — all new listings start as `'draft'`

## Acceptance Criteria

- [ ] `supabase db push` applies the migration without errors
- [ ] `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'listings'` returns the expected column count (verify all ~50 columns are present)
- [ ] Creating a test listing via the authenticated Supabase client sets `status = 'draft'` by default
- [ ] `search_vector` is populated on INSERT (verify with `SELECT search_vector IS NOT NULL FROM listings WHERE id = [test_id]`)
- [ ] `search_vector` updates on UPDATE of `name` (verify with `SELECT search_vector FROM listings` before and after updating the name)
- [ ] `anon` SELECT returns only listings where `status = 'published' AND deleted_at IS NULL`
- [ ] `authenticated` SELECT returns own draft listings in addition to published ones
- [ ] `authenticated` cannot UPDATE a listing they don't own (RLS blocks it with 0 rows updated)
- [ ] `user_roles.listing_id` FK constraint is present (verify with `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'user_roles'`)
- [ ] GIN index on `search_vector` exists (verify with `SELECT indexname FROM pg_indexes WHERE tablename = 'listings' AND indexdef LIKE '%gin%'`)

## Failure States

| Failure                                                               | User-visible behavior                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `search_vector` trigger fails due to missing categories/cities tables | Migration fails; engineer ensures Tickets 006 and 007 ran first                                                               |
| `user_roles` FK alter fails because `user_roles` table doesn't exist  | Engineer ensures Ticket 008 ran before this migration                                                                         |
| `claim_id` FK added without `claims` table existing                   | Constraint violation; engineer does NOT add the claim_id FK in this migration — it is deferred to the claims migration        |
| GIN index creation times out on large existing dataset                | Not a risk at MVP seed scale; relevant for production at V1+ volume                                                           |
| `admin_notes` returned in a client query                              | Security issue; engineer adds explicit column exclusion in the service layer and never exposes this field in any API response |

## Edge Cases

- The `search_vector` trigger queries `listing_details_business` for the description — at listing INSERT time, the business details row doesn't exist yet; the trigger must handle a NULL description gracefully using `COALESCE`
- A listing with `entity_type = 'vendor'` also needs a `listing_details_business` row (vendor entities share business contact data per the schema plan) plus a future `listing_details_vendor` row — the business detail INSERT must happen in the same transaction as the listing INSERT
- `deleted_at IS NOT NULL` listings must not appear in any RLS-filtered query for any role except service_role — test this explicitly by soft-deleting a published listing and verifying it disappears from anon queries

## Accessibility Notes

- [ ] N/A — database migration ticket.

## QA Test Cases

| #   | Scenario                      | Role                  | Steps                                                                                   | Expected result                                                        |
| --- | ----------------------------- | --------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Listing INSERT default status | Authenticated user    | Insert a test listing via authenticated client                                          | `status = 'draft'`, `search_vector IS NOT NULL`                        |
| 2   | Anon only sees published      | Anon client           | Create a draft and a published listing; query via anon client                           | Only the published listing is returned                                 |
| 3   | Owner sees own draft          | Authenticated (owner) | Query listings via authenticated client for own user                                    | Both draft and published listings for own `owner_user_id` are returned |
| 4   | Search vector updates         | Engineer              | UPDATE `name` on a published listing; re-query `search_vector`                          | `search_vector` reflects new name at A-weight                          |
| 5   | Soft delete hidden from anon  | Engineer              | Set `deleted_at = now()` on a published listing via service_role; query via anon client | Listing is not returned in results                                     |

## Security Notes

- `admin_notes`, `verification_docs`, and `verification_notes` must NEVER be returned in any client-facing API response — the service layer must always SELECT specific columns (not `*`) to exclude these fields
- `owner_user_id` on `listings` drives all RLS ownership checks — it must only be set by the claims approval workflow (admin service_role action), never directly by a user edit
- Soft deletes (`deleted_at IS NOT NULL`) are enforced in RLS policies — test that a soft-deleted listing is invisible to all roles except service_role
- The `search_vector` trigger function has SELECT access to `categories` and `cities` — it should not have access to any sensitive tables

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) — N/A for pure SQL migration
- [ ] Lint: zero errors (`npm run lint`) — N/A for SQL files
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for database migration
- [ ] Mobile tested at 375px — N/A for database migration
- [ ] Keyboard navigation tested — N/A for database migration
- [ ] Accessibility requirements met — N/A for database migration
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
