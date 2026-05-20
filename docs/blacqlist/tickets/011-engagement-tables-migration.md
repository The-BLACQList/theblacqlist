# Ticket 011: Engagement Tables Migration

## Status
Draft

## Phase
Phase 1: Database / Auth / RLS Foundation

## Priority
P0

## Feature Area
Database

## Context
The engagement tables form the core user-interaction layer of the BLACQList platform. Without these tables, no user can save a listing, submit a claim, write a review, or be associated with a curated collection. This migration creates the five tables that power those workflows: `claims`, `saves`, `reviews`, `collections`, and `collection_items`. All five tables are required for MVP. Source: `docs/blacqlist/data/database-schema-plan.md` sections 5 and 7, `docs/blacqlist/data/rls-policy-plan.md` section 4.

## User Story
As a platform engineer, I want the engagement tables created in the Supabase database with correct schemas, constraints, indexes, and triggers, so that application code can immediately begin writing and reading saves, claims, reviews, and collections data without risk of data corruption or missing constraints.

## Scope
- SQL migration file `supabase/migrations/004_engagement_tables.sql`
- Create `saves` table with all fields, indexes, foreign keys, and UNIQUE constraint
- Create `claims` table with all fields, indexes, foreign keys, and status CHECK constraint
- Create `reviews` table with all fields, indexes, foreign keys, rating CHECK, and UNIQUE constraint
- Create `collections` table with all fields, slug UNIQUE index, and is_active flag
- Create `collection_items` table with all fields and UNIQUE(collection_id, listing_id)
- Apply `set_updated_at` trigger to `claims`, `reviews`, and `collections`
- All five tables must exist and pass `tsc --noEmit` type checks for generated Supabase types after migration runs

## Out of Scope
- RLS policies for these tables (covered by Ticket 013)
- Any application-layer service or Server Action code
- Admin UI for moderation queue (later phase)
- `corrections`, `review_responses`, `review_reports` (Beta phase tables)

## Dependencies
- Depends on: Ticket 009 — Core entity tables migration (listings, categories, cities must exist for FKs to resolve)

## UX Notes
No user-facing UI in this ticket. This is a database infrastructure ticket. The downstream tickets that depend on this migration include the save button (listing page), claim flow, and review submission flow.

## Design Notes
No UI. Supabase migration file only.

## Data Notes

### `saves`
**Source:** `docs/blacqlist/data/database-schema-plan.md` — Section 5

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` | NO | `now()` | |

- `UNIQUE (user_id, listing_id)` — prevents duplicate saves
- Indexes: `saves_user_id_idx` on `(user_id)`, `saves_listing_id_idx` on `(listing_id)`
- No `updated_at` — saves are create/delete only, never updated

### `claims`
**Source:** `docs/blacqlist/data/database-schema-plan.md` — Section 5

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE |
| `claimant_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL |
| `status` | `text` | NO | `'pending'` | CHECK IN (`'pending'`, `'under_review'`, `'approved'`, `'rejected'`, `'withdrawn'`) |
| `submitted_at` | `timestamptz` | NO | `now()` | |
| `reviewed_at` | `timestamptz` | YES | — | Null until admin decision |
| `reviewed_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL |
| `rejection_reason` | `text` | YES | — | Shown to claimant on rejection |
| `verification_doc_paths` | `text[]` | YES | — | Storage paths in `verification-docs` bucket |
| `notes` | `text` | YES | — | Internal admin notes; not shown to claimant |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger |

- No UNIQUE constraint on `(listing_id, claimant_user_id)` — multiple claims over time are allowed; application layer prevents two simultaneous `'pending'` claims for the same listing
- Indexes: `claims_listing_id_idx`, `claims_claimant_user_id_idx`, `claims_status_idx` (partial, WHERE status IN (`'pending'`,`'under_review'`))

### `reviews`
**Source:** `docs/blacqlist/data/database-schema-plan.md` — Section 5

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE |
| `reviewer_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL |
| `rating` | `integer` | NO | — | CHECK (rating BETWEEN 1 AND 5) |
| `title` | `text` | YES | — | Optional review headline |
| `body` | `text` | YES | — | Review text |
| `status` | `text` | NO | `'intake'` | CHECK IN (`'intake'`, `'pending_approval'`, `'published'`, `'rejected'`, `'removed'`) |
| `visit_date` | `date` | YES | — | |
| `is_verified_purchase` | `boolean` | NO | `false` | V2 marketplace signal |
| `reviewed_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL |
| `reviewed_at` | `timestamptz` | YES | — | |
| `published_at` | `timestamptz` | YES | — | |
| `rejection_reason` | `text` | YES | — | Shown to reviewer on rejection |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger |

- `UNIQUE (reviewer_user_id, listing_id)` — one review per user per listing
- Indexes: `reviews_listing_id_idx` on `(listing_id, status)`, `reviews_status_pending_idx` (partial, WHERE status = `'pending_approval'`), `reviews_reviewer_user_id_idx`

### `collections`
**Source:** `docs/blacqlist/data/database-schema-plan.md` — Section 7

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `title` | `text` | NO | — | Collection display title |
| `slug` | `text` | NO | — | UNIQUE; URL-safe identifier |
| `description` | `text` | YES | — | Shown at top of collection page |
| `cover_image_path` | `text` | YES | — | Storage path in `listing-media` bucket |
| `is_active` | `boolean` | NO | `true` | false = not publicly visible |
| `display_order` | `integer` | NO | `0` | Sort order on collections index page |
| `created_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger |

- Note: the ticket prompt uses `is_published` and `homepage_featured`; the schema-plan.md uses `is_active` and `display_order`. Use the schema-plan.md as the authoritative source. The `homepage_featured` concept is expressed via a separate `featured_slots` table at V1 — do not add a `homepage_featured` column at this migration.
- Indexes: `collections_slug_idx` (UNIQUE), `collections_is_active_display_order_idx`

### `collection_items`
**Source:** `docs/blacqlist/data/database-schema-plan.md` — Section 7

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `collection_id` | `uuid` | NO | — | FK → `collections(id)` ON DELETE CASCADE |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE |
| `display_order` | `integer` | NO | `0` | Sort position within the collection |
| `created_at` | `timestamptz` | NO | `now()` | |

- `UNIQUE (collection_id, listing_id)` — a listing may appear in a collection only once
- Indexes: `collection_items_collection_listing_idx` (UNIQUE), `collection_items_collection_id_idx`, `collection_items_listing_id_idx`
- No `updated_at` — items are create/delete only

### Migration required
Yes — `supabase/migrations/004_engagement_tables.sql`

## API Notes
No API endpoints in this ticket. The tables created here are called by:
- `POST /api/saves` (Ticket depends on saves table)
- `DELETE /api/saves` (Ticket depends on saves table)
- `lib/actions/claims/submitClaim` (future ticket)
- `GET /api/collections` (Ticket 016 data layer)

## Implementation Notes

**File to create:**
- `supabase/migrations/004_engagement_tables.sql`

**Migration structure:**

```sql
-- 1. saves
CREATE TABLE saves (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX saves_user_listing_idx ON saves (user_id, listing_id);
CREATE INDEX saves_user_id_idx ON saves (user_id);
CREATE INDEX saves_listing_id_idx ON saves (listing_id);

-- 2. claims (create before listings FK to claims is added — see Note)
CREATE TABLE claims (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id              uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  claimant_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','under_review','approved','rejected','withdrawn')),
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason        text,
  verification_doc_paths  text[],
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claims_listing_id_idx ON claims (listing_id);
CREATE INDEX claims_claimant_user_id_idx ON claims (claimant_user_id);
CREATE INDEX claims_status_idx ON claims (status)
  WHERE status IN ('pending', 'under_review');
CREATE TRIGGER set_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. reviews
CREATE TABLE reviews (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id           uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating               integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                text,
  body                 text,
  status               text NOT NULL DEFAULT 'intake'
                         CHECK (status IN ('intake','pending_approval','published','rejected','removed')),
  visit_date           date,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  reviewed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  published_at         timestamptz,
  rejection_reason     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reviews_reviewer_listing_idx ON reviews (reviewer_user_id, listing_id);
CREATE INDEX reviews_listing_id_idx ON reviews (listing_id, status);
CREATE INDEX reviews_status_pending_idx ON reviews (status) WHERE status = 'pending_approval';
CREATE INDEX reviews_reviewer_user_id_idx ON reviews (reviewer_user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. collections
CREATE TABLE collections (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  slug            text NOT NULL,
  description     text,
  cover_image_path text,
  is_active       boolean NOT NULL DEFAULT true,
  display_order   integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX collections_slug_idx ON collections (slug);
CREATE INDEX collections_is_active_display_order_idx ON collections (is_active, display_order);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. collection_items
CREATE TABLE collection_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX collection_items_collection_listing_idx
  ON collection_items (collection_id, listing_id);
CREATE INDEX collection_items_collection_id_idx ON collection_items (collection_id);
CREATE INDEX collection_items_listing_id_idx ON collection_items (listing_id);
```

**Trigger prerequisite:** The `update_updated_at()` function must already exist in the database (created in the initial schema migration per global schema conventions). Do not redefine it here — just call `CREATE TRIGGER`.

**Important — `listings.claim_id` FK:** The `listings` table has a `claim_id uuid FK → claims(id) ON DELETE SET NULL` column defined in the entity tables migration (Ticket 009). If that FK was deferred pending this migration, add the constraint here:
```sql
ALTER TABLE listings ADD CONSTRAINT listings_claim_id_fkey
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;
```
Coordinate with the author of Ticket 009 to determine whether this FK should be added in 009 or here.

**Key patterns:**
- Use `gen_random_uuid()` for all PKs (not `uuid_generate_v4()`)
- All FKs to `auth.users` use ON DELETE CASCADE (user_id) or ON DELETE SET NULL (other user references)
- Do not use `varchar` — use `text` for all string columns
- Test the migration against a local Supabase dev instance before opening a PR

## Acceptance Criteria
- [ ] Migration file `supabase/migrations/004_engagement_tables.sql` exists and runs without error against a fresh Supabase dev instance
- [ ] `saves` table has UNIQUE constraint on `(user_id, listing_id)` — confirmed by attempting to INSERT a duplicate row and receiving a unique violation error
- [ ] `claims` table has CHECK constraint on `status` — confirmed by attempting to INSERT a row with `status = 'invalid'` and receiving a check violation error
- [ ] `reviews` table has CHECK constraint `rating BETWEEN 1 AND 5` — confirmed by attempting to INSERT rating = 0 and rating = 6, both raising violations
- [ ] `reviews` table has UNIQUE constraint on `(reviewer_user_id, listing_id)` — confirmed by duplicate INSERT attempt
- [ ] `collections.slug` is UNIQUE — confirmed by duplicate INSERT attempt
- [ ] `collection_items` has UNIQUE constraint on `(collection_id, listing_id)` — confirmed by duplicate INSERT
- [ ] All three `set_updated_at` triggers fire correctly — confirmed by UPDATE on claims, reviews, and collections and observing `updated_at` change
- [ ] `tsc --noEmit` passes after running `supabase gen types typescript` to regenerate types from the new schema
- [ ] All foreign key relationships resolve correctly — confirmed by inserting valid parent records first, then inserting child records referencing them

## Failure States

| Failure | User-visible behavior |
|---|---|
| Migration run against a DB missing the `update_updated_at()` function | Migration fails with `function update_updated_at() does not exist`; engineer must run the earlier migration that creates the function first |
| FK to `listings` fails because `listings` table does not exist | Migration fails with `relation "listings" does not exist`; Ticket 009 must be run first |
| FK to `auth.users` fails in a fresh Supabase project | Supabase Auth schema is initialized automatically in every project; this FK always resolves unless the project is not a Supabase project |
| Duplicate INSERT into `saves` | Postgres raises `ERROR 23505 unique_violation`; application layer catches and treats as idempotent success (`ON CONFLICT DO NOTHING`) |
| `reviews` INSERT with invalid `status` | Postgres raises `ERROR 23514 check_violation`; service layer must validate status before insert |

## Edge Cases
- If Ticket 009 is already merged but deferred the `listings.claim_id FK → claims` constraint, this migration must apply that constraint with `ALTER TABLE listings ADD CONSTRAINT ...`
- If the migration is rolled back, child records (claims, reviews, saves) must be considered in the rollback — the rollback must `DROP TABLE collection_items, collections, reviews, claims, saves` in reverse order of FK dependencies
- `verification_doc_paths text[]` defaults to NULL, not an empty array; application code must treat NULL and `'{}'` as equivalent "no documents"
- `reviews.reviewer_user_id` is nullable (SET NULL on user delete) — the UNIQUE constraint on `(reviewer_user_id, listing_id)` allows multiple NULL reviewer rows (Postgres treats NULL as not equal to NULL in UNIQUE indexes). This is intentional: after a user is deleted, their review becomes anonymous but remains published.

## Accessibility Notes
Not applicable — database migration ticket.

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Verify saves UNIQUE constraint | Engineer | Run migration; INSERT two rows into `saves` with identical `user_id` and `listing_id` | Second INSERT raises `23505 unique_violation` |
| QA-2 | Verify claims status CHECK | Engineer | Run migration; INSERT a claim with `status = 'active'` (not in allowed set) | INSERT raises `23514 check_violation` |
| QA-3 | Verify reviews rating CHECK | Engineer | Run migration; INSERT a review with `rating = 6` | INSERT raises `23514 check_violation` |
| QA-4 | Verify updated_at trigger fires | Engineer | Run migration; UPDATE any field on a `claims` row; SELECT `updated_at` immediately after | `updated_at` reflects the time of the UPDATE, not the original `created_at` |
| QA-5 | Verify collections slug uniqueness | Engineer | INSERT two collections with identical `slug` value | Second INSERT raises `23505 unique_violation` |

## Security Notes
- `verification_doc_paths` must never be returned in any client-facing API response. This column stores paths to the private `verification-docs` Supabase Storage bucket. RLS on `claims` already prevents non-admin SELECT of claim rows; the service layer must additionally exclude this column from any SELECT statement visible to the listing owner.
- `claims.notes` (internal admin notes) must also be excluded from any SELECT returning data to the claimant — the service layer handles this column exclusion.

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) after type regeneration
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Migration tested against local Supabase dev instance (not just schema inspection)
- [ ] Rollback SQL documented in a comment at the bottom of the migration file
- [ ] PR opened and linked to this ticket
