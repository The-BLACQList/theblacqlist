# Ticket 010: Listing supplementary tables migration (hours, links, services, media)

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P0

## Feature Area

Database

## Context

A BLACQList Page for a business is built from multiple child tables in addition to the base `listings` and `listing_details_business` rows. Structured hours of operation (`listing_hours`), social and external links (`listing_links`), service offerings (`services`), and gallery images (`media_attachments`) are all separate tables that the owner populates to complete their Page. These tables must exist before any owner dashboard or listing edit UI can be built. They also carry the same RLS ownership-gate pattern as the extension table — owner can manage their own records, anon can read records for published listings, and admin operates via service_role. Source documents: `docs/blacqlist/data/database-schema-plan.md` (Section 3: `listing_hours`, `listing_links`, `services`, `media_attachments`), `docs/blacqlist/data/rls-policy-plan.md` (Section 4: same tables).

## User Story

As a business owner, I want to add structured business hours, social links, service offerings, and gallery images to my listing, so that customers see complete, rich information on my BLACQList Page.

## Scope

- Write SQL migration `supabase/migrations/20260507000005_listing_supplementary_tables.sql`
- Create `listing_hours` table with exact fields from schema plan
- Create `listing_links` table with exact fields from schema plan
- Create `services` table with exact fields from schema plan
- Create `media_attachments` table with exact fields from schema plan
- Apply `updated_at` triggers to `listing_hours`, `listing_links`, `services` (not `media_attachments` — no `updated_at` column per schema plan)
- Create all required indexes on each table
- Enable RLS on all four tables
- Write RLS policies for all four tables per `rls-policy-plan.md` — ownership-gate pattern through parent `listings.owner_user_id`

## Out of Scope

- File upload Route Handler for `media_attachments` (a later ticket)
- Owner hours/links/services/media edit UI (later tickets)
- `listing_details_professional`, `listing_details_creative`, `listing_details_event`, `listing_details_job` extension tables (Beta phase — deferred)
- Polymorphic `entity_type = 'product'` support for `media_attachments` (V2 expansion per schema plan)

## Dependencies

- Depends on: Ticket 009 — `listings` table must exist for all FK references in this migration

## UX Notes

N/A — database migration ticket. No user-facing screens are built here.

## Design Notes

N/A — database migration ticket.

## Data Notes

**`listing_hours` table — exact field spec:**

| Column        | Type          | Nullable | Default             | Constraint                                                |
| ------------- | ------------- | -------- | ------------------- | --------------------------------------------------------- |
| `id`          | `uuid`        | NO       | `gen_random_uuid()` | PK                                                        |
| `listing_id`  | `uuid`        | NO       | —                   | FK → listings(id) ON DELETE CASCADE                       |
| `day_of_week` | `integer`     | NO       | —                   | CHECK (day_of_week BETWEEN 0 AND 6); 0=Sunday, 6=Saturday |
| `open_time`   | `time`        | YES      | —                   | Null when is_closed=true                                  |
| `close_time`  | `time`        | YES      | —                   | Null when is_closed=true                                  |
| `is_closed`   | `boolean`     | NO       | `false`             | —                                                         |
| `notes`       | `text`        | YES      | —                   | Day-specific notes                                        |
| `created_at`  | `timestamptz` | NO       | `now()`             | —                                                         |
| `updated_at`  | `timestamptz` | NO       | `now()`             | —                                                         |

Indexes: `listing_hours_listing_id_idx` on `(listing_id, day_of_week)`. Unique: `UNIQUE(listing_id, day_of_week)`.

**`listing_links` table — exact field spec:**

| Column          | Type          | Nullable | Default             | Constraint                                                                                                               |
| --------------- | ------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`            | `uuid`        | NO       | `gen_random_uuid()` | PK                                                                                                                       |
| `listing_id`    | `uuid`        | NO       | —                   | FK → listings(id) ON DELETE CASCADE                                                                                      |
| `platform`      | `text`        | NO       | —                   | CHECK IN ('instagram','facebook','twitter','tiktok','youtube','linkedin','pinterest','website','booking','shop','other') |
| `url`           | `text`        | NO       | —                   | Must start with https:// — validated at application layer                                                                |
| `display_order` | `integer`     | NO       | `0`                 | —                                                                                                                        |
| `created_at`    | `timestamptz` | NO       | `now()`             | —                                                                                                                        |
| `updated_at`    | `timestamptz` | NO       | `now()`             | —                                                                                                                        |

Indexes: `listing_links_listing_id_idx` on `(listing_id, display_order)`.

**`services` table — exact field spec:**

| Column             | Type            | Nullable | Default             | Constraint                                                |
| ------------------ | --------------- | -------- | ------------------- | --------------------------------------------------------- |
| `id`               | `uuid`          | NO       | `gen_random_uuid()` | PK                                                        |
| `listing_id`       | `uuid`          | NO       | —                   | FK → listings(id) ON DELETE CASCADE                       |
| `name`             | `text`          | NO       | —                   | —                                                         |
| `description`      | `text`          | YES      | —                   | —                                                         |
| `price`            | `numeric(10,2)` | YES      | —                   | V1 active                                                 |
| `price_type`       | `text`          | YES      | —                   | CHECK IN ('fixed','starting-at','hourly','custom','free') |
| `price_note`       | `text`          | YES      | —                   | V1 active                                                 |
| `duration_minutes` | `integer`       | YES      | —                   | V1 active                                                 |
| `cta_type`         | `text`          | YES      | —                   | CHECK IN ('book','inquire','call','contact')              |
| `cta_url`          | `text`          | YES      | —                   | —                                                         |
| `display_order`    | `integer`       | NO       | `0`                 | —                                                         |
| `is_visible`       | `boolean`       | NO       | `true`              | —                                                         |
| `created_at`       | `timestamptz`   | NO       | `now()`             | —                                                         |
| `updated_at`       | `timestamptz`   | NO       | `now()`             | —                                                         |

Indexes: `services_listing_id_idx` on `(listing_id)`, `services_listing_order_idx` on `(listing_id, display_order)`.

**`media_attachments` table — exact field spec:**

| Column                 | Type          | Nullable | Default             | Constraint                                     |
| ---------------------- | ------------- | -------- | ------------------- | ---------------------------------------------- |
| `id`                   | `uuid`        | NO       | `gen_random_uuid()` | PK                                             |
| `entity_type`          | `text`        | NO       | —                   | CHECK IN ('listing','product','review','user') |
| `entity_id`            | `uuid`        | NO       | —                   | Polymorphic — no formal FK                     |
| `file_path`            | `text`        | NO       | —                   | Storage path in listing-media bucket ONLY      |
| `file_type`            | `text`        | NO       | —                   | MIME type: image/jpeg, image/png, image/webp   |
| `file_size_bytes`      | `integer`     | NO       | —                   | —                                              |
| `width`                | `integer`     | YES      | —                   | Set by upload handler                          |
| `height`               | `integer`     | YES      | —                   | Set by upload handler                          |
| `alt_text`             | `text`        | YES      | —                   | —                                              |
| `display_order`        | `integer`     | NO       | `0`                 | —                                              |
| `is_portfolio_primary` | `boolean`     | NO       | `false`             | For creative entities                          |
| `is_approved`          | `boolean`     | NO       | `true`              | —                                              |
| `uploaded_by`          | `uuid`        | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL         |
| `created_at`           | `timestamptz` | NO       | `now()`             | —                                              |

Note: No `updated_at` on `media_attachments` per schema plan.

Indexes: `media_entity_idx` on `(entity_type, entity_id)`, `media_attachments_uploaded_by_idx` on `(uploaded_by)`.

**RLS policies — `listing_hours`:**

```sql
-- anon SELECT: only where parent listing is published
CREATE POLICY "listing_hours_select_published" ON listing_hours
  FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- authenticated SELECT: own + published
CREATE POLICY "listing_hours_select_authenticated" ON listing_hours
  FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
        OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- authenticated INSERT/UPDATE/DELETE: own listings only
CREATE POLICY "listing_hours_mutate_own" ON listing_hours
  FOR ALL TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
```

The same ownership-gate pattern applies to `listing_links`, `services`, and the authenticated policies for `media_attachments`. See `rls-policy-plan.md` Section 4 for the full per-table policy list.

**`media_attachments` RLS note:** `anon` SELECT is restricted to `entity_type = 'listing'` and `is_approved = true` only. The `verification-docs` and `receipts` storage buckets are NOT accessible via this table's RLS — they are private bucket-level controls.

**Migration file:** `supabase/migrations/20260507000005_listing_supplementary_tables.sql`

## API Notes

N/A — no API routes in this ticket.

Future owner dashboard queries will use patterns like:

```typescript
// Fetch all hours for a listing (owner dashboard)
const { data: hours } = await supabase
  .from('listing_hours')
  .select('*')
  .eq('listing_id', listingId)
  .order('day_of_week')

// Fetch gallery media for a published listing (BLACQList Page)
const { data: gallery } = await supabase
  .from('media_attachments')
  .select('id, file_path, alt_text, display_order, width, height')
  .eq('entity_type', 'listing')
  .eq('entity_id', listingId)
  .eq('is_approved', true)
  .order('display_order')
```

Note: `file_path` is a storage path. The URL generation utility converts it:

```typescript
const {
  data: { publicUrl },
} = supabase.storage.from('listing-media').getPublicUrl(attachment.file_path)
```

## Implementation Notes

**Files to create:**

- `supabase/migrations/20260507000005_listing_supplementary_tables.sql`

**Migration structure:**

```sql
-- 1. listing_hours
CREATE TABLE listing_hours ( ... );
ALTER TABLE listing_hours ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX listing_hours_unique_day ON listing_hours (listing_id, day_of_week);
CREATE INDEX listing_hours_listing_id_idx ON listing_hours (listing_id, day_of_week);
CREATE TRIGGER set_listing_hours_updated_at ...;
-- RLS policies (as documented above)

-- 2. listing_links
CREATE TABLE listing_links ( ... );
ALTER TABLE listing_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX listing_links_listing_id_idx ON listing_links (listing_id, display_order);
CREATE TRIGGER set_listing_links_updated_at ...;
-- RLS policies

-- 3. services
CREATE TABLE services ( ... );
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE INDEX services_listing_id_idx ON services (listing_id);
CREATE INDEX services_listing_order_idx ON services (listing_id, display_order);
CREATE TRIGGER set_services_updated_at ...;
-- RLS policies

-- 4. media_attachments
CREATE TABLE media_attachments ( ... );
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX media_entity_idx ON media_attachments (entity_type, entity_id);
CREATE INDEX media_attachments_uploaded_by_idx ON media_attachments (uploaded_by);
-- RLS policies (no updated_at trigger — no updated_at column on this table)
```

**Key patterns:**

- `listing_hours` UNIQUE constraint on `(listing_id, day_of_week)` enforces one record per day per listing — this is a hard constraint at the DB level
- `media_attachments` uses a polymorphic design for `entity_type`/`entity_id` — no formal FK on `entity_id` because it may reference different tables. The application layer validates that the entity exists and the user owns it before inserting
- `file_path` in `media_attachments` stores a relative storage path (e.g., `listings/abc-123/gallery/uuid.webp`) — NEVER a full CDN URL. URLs are generated at read time via `supabase.storage.from('listing-media').getPublicUrl(file_path)`
- `services.price`, `price_type`, `price_note`, `duration_minutes`, `cta_type`, `cta_url` columns are built now but described as "V1 active" in the schema plan — they are present in the table at MVP so the schema is stable; the UI simply doesn't surface them until V1
- For the `listing_links.platform` CHECK constraint — include all 11 platform values from the schema plan exactly as specified

**Do not:**

- Create a separate `attachment_type` column that replaces the `entity_type` pattern — use the exact schema plan column names
- Store a CDN URL in `file_path` — always store the storage path relative to the bucket root
- Add a formal FK on `media_attachments.entity_id` — the polymorphic design intentionally omits it; integrity is application-enforced
- Allow `is_approved = false` to be set by the owner — only admin (service_role) can set it to false for flagged content

## Acceptance Criteria

- [ ] `supabase db push` applies the migration without errors
- [ ] All four tables exist: `listing_hours`, `listing_links`, `services`, `media_attachments`
- [ ] `UNIQUE(listing_id, day_of_week)` constraint on `listing_hours` is enforced: attempting to insert two rows for the same listing and day_of_week fails with a unique constraint violation
- [ ] Anon client can SELECT hours, links, services, and media for a published listing
- [ ] Anon client cannot SELECT hours, links, services, or media for a non-published listing (RLS returns 0 rows)
- [ ] Authenticated owner can INSERT, UPDATE, and DELETE rows for their own listing's hours, links, services, and media
- [ ] Authenticated user cannot INSERT a row for a listing they do not own (RLS with-check rejects the insert with 0 rows)
- [ ] `media_entity_idx` on `(entity_type, entity_id)` exists on `media_attachments`
- [ ] `file_path` in `media_attachments` accepts only a storage path string — no validation at DB level, but the column is confirmed present and used correctly in QA test cases
- [ ] `services.display_order` defaults to 0 and is updatable by the owner

## Failure States

| Failure                                               | User-visible behavior                                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listings` table doesn't exist when migration runs    | All FK constraints fail; engineer ensures Ticket 009 ran first                                                                                             |
| Duplicate day_of_week insert for same listing         | UNIQUE constraint violation on `listing_hours`; the application layer should UPSERT hours (INSERT ... ON CONFLICT DO UPDATE) rather than blindly inserting |
| CDN URL accidentally stored in `file_path`            | Future CDN provider change breaks all image URLs; engineer audits insert code to confirm only storage paths are stored                                     |
| `is_approved` set to false by owner via direct update | RLS `WITH CHECK` policy must prevent this — verify the policy correctly restricts owner ability to flip `is_approved`                                      |

## Edge Cases

- If a listing has 7 hours rows (one per day) and the owner updates all 7 at once from the UI, the upsert must be transactional — a partial update (3 of 7 succeed) leaves hours in an inconsistent state; the service layer should process hours updates in a single transaction
- `listing_links` allows multiple links of the same platform type (e.g., two websites) — this is by design per the schema plan; the UI may warn but should not block it
- `media_attachments.entity_type = 'product'` is in the CHECK constraint at MVP even though the `products` table is V2 — this is intentional; the constraint is permissive enough to support the V2 expansion without a schema change
- Gallery images with `is_approved = false` must not appear in anon SELECTs — the RLS policy filters on `is_approved = true` for anon; verify this works correctly

## Accessibility Notes

- [ ] N/A — database migration ticket.

## QA Test Cases

| #   | Scenario                               | Role                    | Steps                                                                        | Expected result                                      |
| --- | -------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Hours UNIQUE constraint                | Engineer                | Insert two `listing_hours` rows with same `listing_id` and `day_of_week = 0` | Second insert fails with unique constraint violation |
| 2   | Anon reads published listing's hours   | Anon client             | Insert hours for a published listing; SELECT via anon client                 | Hours returned                                       |
| 3   | Anon cannot read draft listing's hours | Anon client             | Insert hours for a draft listing; SELECT via anon client                     | 0 rows returned                                      |
| 4   | Owner manages own services             | Authenticated owner     | INSERT a service; UPDATE its `display_order`; DELETE it                      | All three operations succeed                         |
| 5   | Non-owner cannot insert service        | Authenticated non-owner | Attempt to INSERT a service with a listing_id belonging to another user      | RLS blocks the insert; 0 rows affected               |

## Security Notes

- `media_attachments.file_path` must never contain user-supplied path segments — the upload handler must construct the path from validated server-side values only (e.g., `listings/[listing_id]/gallery/[uuid].webp` where `listing_id` and `uuid` are server-generated)
- The `is_approved` column on `media_attachments` must only be set to `false` by admin via service_role — RLS must prevent owners from modifying it
- `listing_links.url` must start with `https://` — enforce this in the application layer before insert; the DB column has no URL format constraint (use a CHECK constraint if desired as an extra layer: `CHECK (url LIKE 'https://%')`)
- `services` rows contain potential PII via `cta_url` fields — do not expose these in unauthenticated API responses for non-published listings

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
