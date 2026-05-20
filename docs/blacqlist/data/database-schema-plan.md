# Database Schema Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Reference document for migration authors
**Owner:** Architecture + Engineering

This document defines the complete per-table schema for all tables across all phases. Tables are grouped by domain. Use this document before writing any Supabase migration.

**Document structure:**
- Part A (this file): Sections 1–5 — Identity, Entities, Entity Sub-tables, Discovery, Community Engagement (30 tables)
- Part B (database-schema-plan-b.md): Sections 6–16 — Commerce, Editorial, Receipts & Spend, Flow Map, Events & Jobs, Analytics, AI, Admin, Sponsorships, MVP summary, Later tables summary (35 tables)

---

## Global Schema Conventions

These apply to every table in this document without exception.

- **Primary keys:** `uuid` via `gen_random_uuid()` unless the table uses `listing_id` as both PK and FK (one-to-one extension tables).
- **Soft deletes:** `deleted_at timestamptz` on all entity tables. Default queries must include `WHERE deleted_at IS NULL`. RLS policies enforce this automatically where specified.
- **`updated_at` trigger:** Every table with `updated_at` must have the standard trigger applied:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- **Entry table audit fields:** Tables that store user-submitted content add `created_by uuid FK → auth.users` and `updated_by uuid FK → auth.users` beyond the standard `id`, `created_at`, `updated_at`.
- **Supabase Auth reference:** All `FK → auth.users` references point to `auth.users(id)` in the Supabase Auth schema. Use `ON DELETE SET NULL` unless CASCADE behavior is explicitly noted.
- **Service role:** Admin mutations use the Supabase service role key server-side. All RLS policies are written for the `anon` and `authenticated` Supabase roles. Admin access bypasses RLS entirely via the service role — additional service-layer checks enforce admin authorization.

---

## Section 1: Identity

Two tables govern user identity on the platform. Supabase Auth owns the canonical `auth.users` record (email, password hash, session). The application database extends that with a `profiles` record and a `user_roles` record per role assignment.

---

## profiles

**Phase:** MVP
**Purpose:** Stores the public-facing profile for every authenticated user, extending `auth.users` with display name, avatar, bio, and location.
**Privacy:** PII — `display_name`, `avatar_url`, `bio` are user-supplied. `city_id` is approximate location, not a precise address.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | PK and FK → `auth.users(id)` ON DELETE CASCADE. Same UUID as the Supabase Auth user. |
| `display_name` | `text` | YES | — | Public display name. Shown on reviews, saves, and comments. Null until user sets it. |
| `avatar_url` | `text` | YES | — | Supabase Storage path in `avatars` bucket — not a URL. Generate signed/public URL at read time. |
| `bio` | `text` | YES | — | Short user bio. Shown on profile pages (V1+). Optional. |
| `city_id` | `uuid` | YES | — | FK → `cities(id)` ON DELETE SET NULL. Optional self-reported location. |
| `website_url` | `text` | YES | — | Personal or professional website. Optional. |
| `created_at` | `timestamptz` | NO | `now()` | Set by trigger on `auth.users` INSERT that also creates this row. |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger on every UPDATE. |

### Indexes

- `PRIMARY KEY (id)`
- `profiles_city_id_idx` on `(city_id)` — B-tree; filters profiles by city.

### Unique Constraints

- None beyond PK. `display_name` uniqueness is not enforced at the DB layer; it is checked at the application layer with a `LIKE` or `pg_trgm` search before save.

### Foreign Keys

- `id → auth.users(id) ON DELETE CASCADE` — profile is deleted when the auth user is deleted.
- `city_id → cities(id) ON DELETE SET NULL`

### RLS Note

`anon` and `authenticated` can SELECT profiles where the owner has a published listing (public profile pages — V1). Owners can SELECT and UPDATE their own profile (`id = auth.uid()`). Admin via service role can SELECT all.

### Seed Data

None — profiles are created via a trigger on `auth.users` INSERT.

---

## user_roles

**Phase:** MVP
**Purpose:** Stores role assignments for every authenticated user. Roles are checked server-side on every request; they are not encoded in the JWT.
**Privacy:** Restricted — role records reveal a user's permission level. Accessible only to the role holder (own record) and Admin via service role.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE. The user this role is assigned to. |
| `role` | `text` | NO | — | CHECK IN (`'supporter'`, `'owner'`, `'editor'`, `'admin'`, `'super_admin'`). The role being assigned. `'owner'` is scoped to a specific listing via `listing_id`. |
| `listing_id` | `uuid` | YES | — | FK → `listings(id)` ON DELETE CASCADE. Null for all roles except `'owner'`. For `'owner'`, scopes the ownership to a single listing. |
| `granted_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. The admin who granted this role. Null for auto-granted `'supporter'` role at sign-up. |
| `created_at` | `timestamptz` | NO | `now()` | Timestamp the role was granted. |

### Indexes

- `PRIMARY KEY (id)`
- `user_roles_user_id_idx` on `(user_id)` — B-tree; look up all roles for a user.
- `user_roles_listing_id_idx` on `(listing_id) WHERE listing_id IS NOT NULL` — partial B-tree; look up owners of a specific listing.

### Unique Constraints

- `UNIQUE (user_id, role, listing_id)` — prevents duplicate role assignments. `listing_id` participates so a user can be owner of multiple listings (each pair is distinct) but not owner of the same listing twice.

### Foreign Keys

- `user_id → auth.users(id) ON DELETE CASCADE`
- `listing_id → listings(id) ON DELETE CASCADE`
- `granted_by → auth.users(id) ON DELETE SET NULL`

### RLS Note

`authenticated` can SELECT own role records only (`user_id = auth.uid()`). No `authenticated` INSERT, UPDATE, or DELETE — all role changes are performed via service role by Admin or Super Admin Server Actions.

### Seed Data

Required — one `super_admin` role record for the founding team account must be seeded before any admin operations are possible.

---

## Section 2: Entities

The `listings` table is the base record for every entity type on the platform. Extension tables (`listing_details_*`) hold entity-type-specific fields and each carry a one-to-one FK to `listings.id`. Never query an entity type without joining the appropriate extension table.

---

## listings

**Phase:** MVP (all columns built at MVP; some are activated in later phases per the phase column in entity-content-model.md)
**Purpose:** The single base record for every entity type. One row per listed entity. All discovery, search, status, trust, SEO, admin, and lifecycle fields live here.
**Privacy:** `submitted_by`, `owner_user_id`, `updated_by` are user FKs. `verification_docs` contains sensitive document paths — admin-only access. `admin_notes` is internal-only.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK. FK target for all extension and supporting tables. |
| `name` | `text` | NO | — | Public entity name. Required on all types. |
| `slug` | `text` | NO | — | URL-safe unique identifier. Auto-generated on create. Immutable after first publish per ADR-010. |
| `entity_type` | `text` | NO | — | CHECK IN (`'business'`, `'professional'`, `'creative'`, `'event'`, `'job'`, `'vendor'`). Set on create; never changed. |
| `tagline` | `text` | YES | — | Short descriptor ≤140 chars for hero section. |
| `category_id` | `uuid` | NO | — | FK → `categories(id)` ON DELETE RESTRICT. Primary category. Required. |
| `subcategory_ids` | `uuid[]` | YES | — | Array of subcategory UUIDs. No FK constraint — validated at application layer. V1 active. |
| `city_id` | `uuid` | YES | — | FK → `cities(id)` ON DELETE SET NULL. Null for online-only entities. |
| `location_type` | `text` | NO | `'physical'` | CHECK IN (`'physical'`, `'online'`, `'hybrid'`, `'virtual-services'`, `'ships-nationwide'`). |
| `service_area_description` | `text` | YES | — | Free-text service area. Indexed in `search_vector`. |
| `ships_nationwide` | `boolean` | NO | `false` | Search/filter signal for nationwide-shipping entities. |
| `status` | `text` | NO | `'draft'` | CHECK IN (`'draft'`, `'pending'`, `'published'`, `'unpublished'`, `'flagged'`, `'archived'`). Controls Page visibility. |
| `tier` | `text` | NO | `'free'` | CHECK IN (`'free'`, `'standard'`, `'premium'`). Determines feature availability. `standard` and `premium` active at V1. |
| `source` | `text` | NO | `'owner'` | CHECK IN (`'owner'`, `'community'`, `'admin'`, `'import'`). How the listing was created. |
| `published_at` | `timestamptz` | YES | — | Set to `now()` on first transition to `'published'`. |
| `trust_tier` | `text` | NO | `'unclaimed'` | CHECK IN (`'unclaimed'`, `'claimed'`, `'verified'`, `'certified'`). Publicly visible trust badge. |
| `claim_id` | `uuid` | YES | — | FK → `claims(id)` ON DELETE SET NULL. The claim that elevated this listing to `'claimed'`. |
| `verified_at` | `timestamptz` | YES | — | Timestamp of admin verification approval. V1 active. |
| `verified_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Admin who approved verification. V1 active. |
| `certification_auto_granted_at` | `timestamptz` | YES | — | Set by DB trigger when all BLACQList Certified criteria are met simultaneously. Never set manually. V1 trigger built. |
| `flag_status` | `text` | NO | `'none'` | CHECK IN (`'none'`, `'inactive'`, `'duplicate'`, `'incorrect'`, `'spam'`). Non-`'none'` hides listing from public search and sets `noindex = true`. |
| `admin_notes` | `text` | YES | — | Internal admin notes. Never exposed to owners or public. |
| `moderation_notes` | `text` | YES | — | Notes shown to listing owner when listing is rejected, flagged, or requires correction. |
| `is_featured` | `boolean` | NO | `false` | Admin-controlled editorial feature slot. At most one per placement context (enforced at application layer). |
| `is_sponsored` | `boolean` | NO | `false` | Has an active paid sponsored placement. Auto-set false after `sponsored_expires_at` passes. V1 active. |
| `sponsored_expires_at` | `timestamptz` | YES | — | Expiry timestamp for sponsored placement. Null when `is_sponsored = false`. V1 active. |
| `sponsored_placement_type` | `text` | YES | — | One of `'homepage'`, `'search'`, `'category'`, `'city'`. Null when not sponsored. V1 active. |
| `verification_status` | `text` | NO | `'none'` | CHECK IN (`'none'`, `'pending'`, `'verified'`, `'rejected'`). Workflow state — distinct from `trust_tier`. Columns built at MVP; workflow active at V1. |
| `verification_docs` | `text[]` | YES | — | Array of Supabase Storage paths in the private `verification-docs` bucket. Admin-only access via 15-min signed URLs. V1 active. |
| `verification_notes` | `text` | YES | — | Admin notes on verification decision shown to owner on rejection. V1 active. |
| `meta_title` | `text` | YES | — | HTML `<title>`. Falls back to generated `"{name} — {category} in {city} — The BLACQList"`. |
| `meta_description` | `text` | YES | — | HTML meta description. Falls back to first 160 chars of description field. |
| `og_image_path` | `text` | YES | — | Storage path for OG image. Falls back to `cover_image_path` → `logo_path` → platform default. |
| `canonical_url` | `text` | YES | — | System-managed canonical URL per ADR-010. Owners cannot override. |
| `json_ld_type` | `text` | YES | — | Schema.org JSON-LD type. Inferred from `entity_type` if null. |
| `sitemap_include` | `boolean` | NO | `true` | Auto-set false when `status != 'published'`, `noindex = true`, or `deleted_at IS NOT NULL`. |
| `noindex` | `boolean` | NO | `false` | Auto-set true when `status = 'archived'` or `flag_status != 'none'`. |
| `logo_path` | `text` | YES | — | Storage path in `listing-media` bucket for logo. 400×400px, max 2MB, WebP. |
| `cover_image_path` | `text` | YES | — | Storage path for hero/cover image. 1200×675px, max 5MB, WebP. |
| `last_edited_by_owner_at` | `timestamptz` | YES | — | Updated whenever the owner saves any field change. Used for stale listings queue. |
| `last_admin_updated_at` | `timestamptz` | YES | — | Updated whenever an admin edits any field. Separate from `updated_at`. |
| `auto_archive_at` | `timestamptz` | YES | — | For events: set to event end date + 1 day. Processed by daily scheduled function. Null for non-event entities. |
| `auto_expire_at` | `timestamptz` | YES | — | For jobs: set to application deadline + 1 day. Processed by daily scheduled function. Null for non-job entities. |
| `stale_flagged_at` | `timestamptz` | YES | — | Set by scheduled job when owner has not edited in 180+ days. Cleared on next owner save. V1 active. |
| `is_vendor` | `boolean` | NO | `false` | Convenience flag. True when `entity_type = 'vendor'`. Kept in sync with `entity_type` by application layer. |
| `review_count` | `integer` | NO | `0` | Denormalized count of published reviews. Updated by trigger on `reviews` INSERT/UPDATE. |
| `avg_rating` | `numeric(3,2)` | YES | — | Denormalized average rating from published reviews. Updated by same trigger. Null until first published review. |
| `save_count` | `integer` | NO | `0` | Denormalized count of saves. Updated by trigger on `saves` INSERT/DELETE. |
| `view_count` | `integer` | NO | `0` | Denormalized total page view count. Updated by analytics event processing. |
| `owner_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Set by claims approval workflow — not directly editable. Drives RLS ownership policies. |
| `submitted_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. User who created or submitted the listing. |
| `updated_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. User who last updated the listing. |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger on every UPDATE. |
| `deleted_at` | `timestamptz` | YES | — | Soft delete. All default queries filter `WHERE deleted_at IS NULL`. |
| `search_vector` | `tsvector` | YES | — | Full-text search vector. A-weight: `name`; B-weight: category name + city name; C-weight: `description` + `tagline`; D-weight: `service_area_description`. Updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (slug)` — URL uniqueness enforced at DB layer.
- `listings_search_vector_idx` on `(search_vector)` — GIN index. Full-text search.
- `listings_status_idx` on `(status)` — B-tree. Filter by publication status.
- `listings_entity_type_idx` on `(entity_type)` — B-tree. Filter by entity type.
- `listings_city_id_idx` on `(city_id)` — B-tree. City landing pages, city-scoped search.
- `listings_category_id_idx` on `(category_id)` — B-tree. Category pages, category filters.
- `listings_owner_user_id_idx` on `(owner_user_id)` — B-tree. Owner dashboard queries.
- `listings_trust_tier_idx` on `(trust_tier)` — B-tree. Trust badge filters.
- `listings_is_featured_idx` on `(is_featured) WHERE is_featured = true` — partial. Featured slot lookup.
- `listings_is_sponsored_idx` on `(is_sponsored) WHERE is_sponsored = true` — partial. Sponsored placement lookup.
- `listings_deleted_at_idx` on `(deleted_at) WHERE deleted_at IS NULL` — partial. Efficient soft-delete filtering.
- `listings_auto_archive_at_idx` on `(auto_archive_at) WHERE auto_archive_at IS NOT NULL` — partial. Daily archive job.
- `listings_auto_expire_at_idx` on `(auto_expire_at) WHERE auto_expire_at IS NOT NULL` — partial. Daily expire job.

### Unique Constraints

- `UNIQUE (slug)` — one slug per platform.

### Foreign Keys

- `category_id → categories(id) ON DELETE RESTRICT`
- `city_id → cities(id) ON DELETE SET NULL`
- `claim_id → claims(id) ON DELETE SET NULL`
- `verified_by → auth.users(id) ON DELETE SET NULL`
- `owner_user_id → auth.users(id) ON DELETE SET NULL`
- `submitted_by → auth.users(id) ON DELETE SET NULL`
- `updated_by → auth.users(id) ON DELETE SET NULL`

### RLS Note

`anon` SELECT: `status = 'published' AND deleted_at IS NULL`. `authenticated` SELECT: same as anon, plus own unpublished rows where `owner_user_id = auth.uid()`. `authenticated` INSERT: allowed; new listings start at `status = 'draft'`. `authenticated` UPDATE: only where `owner_user_id = auth.uid()`; valid status transitions enforced at service layer. `authenticated` DELETE: not permitted — soft delete only via service role. Admin mutations via service role.

### Seed Data

Required — admin and import-sourced listing seeds for launch cities. See `seed-data-plan.md`.

---

## listing_details_business

**Phase:** MVP (base fields); V1 adds `accepts_reservations`, `price_range`, `founded_year`; V2 adds `lat`, `lng`
**Purpose:** Entity-type-specific fields for business listings. One row per `listings` row where `entity_type = 'business'` or `entity_type = 'vendor'`.
**Privacy:** `phone`, `email`, `address_line_1`, `address_line_2` are PII. Public by owner choice when listing is published.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. One-to-one enforced by PK. |
| `description` | `text` | YES | — | Full "About" section text. Used in `search_vector`. |
| `hours` | `jsonb` | YES | — | Structured hours. Shape: `{monday: {open: "09:00", close: "17:00", closed: false}, ...}`. Null if unknown. Document shape in migration comment. |
| `hours_notes` | `text` | YES | — | Supplement to structured hours for irregular situations. |
| `address_line_1` | `text` | YES | — | Street address. Null for online-only businesses. PII-adjacent. |
| `address_line_2` | `text` | YES | — | Suite, unit, floor. Optional. |
| `city_text` | `text` | YES | — | Denormalized city name for display. Must be kept in sync with `listings.city_id` in same transaction. |
| `state` | `text` | YES | — | Two-letter US state code. |
| `zip` | `text` | YES | — | ZIP code. Format validated at application layer, not DB. |
| `lat` | `numeric` | YES | — | Latitude. Null until V2 geocoding is active. |
| `lng` | `numeric` | YES | — | Longitude. Null until V2 geocoding is active. |
| `phone` | `text` | YES | — | Business phone. PII. Used for `cta_type = 'call'` (`tel:` link). |
| `email` | `text` | YES | — | Business contact email. PII. Distinct from auth email. |
| `website_url` | `text` | YES | — | External website. Must start with `https://` — validated at application layer. |
| `social_instagram` | `text` | YES | — | Full Instagram profile URL. |
| `social_facebook` | `text` | YES | — | Full Facebook page URL. |
| `social_linkedin` | `text` | YES | — | Full LinkedIn company or profile URL. |
| `social_tiktok` | `text` | YES | — | Full TikTok profile URL. |
| `social_youtube` | `text` | YES | — | YouTube channel URL. |
| `social_twitter` | `text` | YES | — | X (formerly Twitter) profile URL. |
| `cta_type` | `text` | NO | `'visit'` | CHECK IN (`'book'`, `'order'`, `'call'`, `'message'`, `'visit'`, `'get-quote'`, `'shop'`, `'subscribe'`, `'contact'`). Controls CTA button on Page hero. |
| `cta_url` | `text` | YES | — | URL for CTA. Null for `'call'` type (uses `phone` field). |
| `cta_label_override` | `text` | YES | — | Custom CTA label. Takes precedence over default catalog label when non-null. |
| `ships_nationwide` | `boolean` | NO | `false` | Rendering convenience — synced with `listings.location_type`. Application layer keeps in sync. |
| `accepts_reservations` | `boolean` | YES | — | Whether business accepts reservations. V1 filter signal. |
| `price_range` | `text` | YES | — | CHECK IN (`'$'`, `'$$'`, `'$$$'`, `'$$$$'`). V1 filter signal. |
| `founded_year` | `integer` | YES | — | Year founded. Validated: 1800 ≤ value ≤ current year. V1. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`

### Unique Constraints

- None beyond PK. Uniqueness of the one-to-one relationship is enforced by PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

Inherits access through `listings`. `anon` SELECT: only if parent listing is published. `authenticated` UPDATE: only where the parent listing's `owner_user_id = auth.uid()`. INSERT via service role or owner on listing creation. Admin via service role.

### Seed Data

Required — business detail rows for all seeded listing records.

---

## listing_details_professional

**Phase:** Beta (base fields); V1 adds `video_embed_url`
**Purpose:** Entity-type-specific fields for professional listings — attorneys, therapists, coaches, consultants, trainers.
**Privacy:** `phone`, `email` are PII. Public by owner choice when listing is published.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. |
| `headline` | `text` | YES | — | One-line professional identity shown below name in hero. |
| `bio` | `text` | YES | — | Full professional biography. Used in full-text search. |
| `credentials` | `text[]` | YES | — | Array of credential strings. Displayed as credential badge row. |
| `specialties` | `text[]` | YES | — | Array of specialty strings. Displayed as tags; search signals in V1. |
| `consultation_type` | `text` | YES | — | CHECK IN (`'in-person'`, `'virtual'`, `'both'`). Search filter in V1. |
| `availability_note` | `text` | YES | — | Free-text availability message shown near CTA. |
| `cta_type` | `text` | NO | `'book'` | CHECK IN (`'book'`, `'schedule'`, `'inquire'`, `'call'`, `'message'`, `'contact'`). |
| `cta_url` | `text` | YES | — | URL for CTA. Null for `'call'` type. |
| `phone` | `text` | YES | — | Professional contact phone. PII. |
| `email` | `text` | YES | — | Professional contact email. PII. Distinct from auth email. |
| `website_url` | `text` | YES | — | Portfolio or personal site URL. |
| `social_instagram` | `text` | YES | — | Instagram profile URL. |
| `social_linkedin` | `text` | YES | — | LinkedIn profile URL. |
| `social_twitter` | `text` | YES | — | X (Twitter) profile URL. |
| `city_text` | `text` | YES | — | Practice city for display. Denormalized from `listings.city_id`. |
| `state` | `text` | YES | — | Two-letter state code. |
| `virtual_only` | `boolean` | NO | `false` | True if no in-person presence. When true, `listings.location_type` should be `'virtual-services'`. |
| `video_embed_url` | `text` | YES | — | YouTube or Vimeo embed URL for intro/portfolio video. V1. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

Same inheritance pattern as `listing_details_business`. `authenticated` UPDATE only where `listings.owner_user_id = auth.uid()`.

### Seed Data

None — professional listings are owner-created at Beta launch.

---

## listing_details_creative

**Phase:** Beta (base fields); V1 adds `video_embed_url`
**Purpose:** Entity-type-specific fields for creative listings — artists, photographers, musicians, designers, filmmakers, authors.
**Privacy:** `phone`, `email` are PII. Public by owner choice.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. |
| `bio` | `text` | YES | — | Artist/creative biography. Used in full-text search. |
| `medium_genre` | `text[]` | YES | — | Array of mediums or genres. Displayed as tags; search signals in V1. |
| `portfolio_statement` | `text` | YES | — | Brief statement about the body of work. Shown above portfolio gallery. |
| `commission_status` | `text` | YES | — | CHECK IN (`'open'`, `'closed'`, `'by-request'`). Status chip near CTA. |
| `cta_type` | `text` | NO | `'contact'` | CHECK IN (`'book'`, `'commission'`, `'inquire'`, `'contact'`, `'shop'`). |
| `cta_url` | `text` | YES | — | URL for CTA. |
| `phone` | `text` | YES | — | Contact phone. PII. |
| `email` | `text` | YES | — | Contact email. PII. |
| `website_url` | `text` | YES | — | Portfolio or personal site URL. |
| `social_instagram` | `text` | YES | — | Instagram profile URL. Displayed prominently. |
| `social_tiktok` | `text` | YES | — | TikTok profile URL. |
| `social_youtube` | `text` | YES | — | YouTube channel URL. |
| `social_twitter` | `text` | YES | — | X (Twitter) profile URL. |
| `social_behance` | `text` | YES | — | Behance portfolio URL. Relevant for designers. |
| `video_embed_url` | `text` | YES | — | YouTube or Vimeo embed URL for featured video. V1. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

Same inheritance pattern as `listing_details_business`.

### Seed Data

None — creative listings are owner-created at Beta launch.

---

## listing_details_event

**Phase:** Beta
**Purpose:** Entity-type-specific fields for event listings — concerts, pop-ups, workshops, markets, networking events. Auto-archives after event end date.
**Privacy:** None beyond what is already on `listings`. Event locations are public by design.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. |
| `event_date` | `date` | NO | — | Primary event date (start date for multi-day). Required. |
| `event_end_date` | `date` | YES | — | End date for multi-day events. Null for single-day. `listings.auto_archive_at` set to `event_end_date + 1 day` (or `event_date + 1 day` if null). |
| `event_time` | `time` | YES | — | Start time. Null for all-day or TBD events. |
| `event_end_time` | `time` | YES | — | End time. Null for open-ended or all-day events. |
| `timezone` | `text` | NO | `'America/New_York'` | IANA timezone identifier. Required even when `event_time` is null. |
| `location_type` | `text` | NO | `'in-person'` | CHECK IN (`'in-person'`, `'virtual'`, `'hybrid'`). Event-scoped — distinct from `listings.location_type`. |
| `location_address` | `text` | YES | — | Full address string for in-person events. Null for virtual events. |
| `location_city_text` | `text` | YES | — | Denormalized city name for display without JOIN. |
| `venue_name` | `text` | YES | — | Venue name displayed above address. |
| `description` | `text` | YES | — | Full event description. Used in full-text search. |
| `ticket_url` | `text` | YES | — | External ticket purchase URL. Null for free or RSVP-only events. |
| `rsvp_url` | `text` | YES | — | RSVP URL for free events. Null for ticketed events. |
| `is_free` | `boolean` | NO | `false` | Whether event is free to attend. "Free" badge trigger; search filter in V1. |
| `ticket_price_min` | `numeric(10,2)` | YES | — | Minimum ticket price in USD. Null if unknown or free. |
| `ticket_price_max` | `numeric(10,2)` | YES | — | Maximum ticket price. Null for single-price or free events. |
| `ticket_price_note` | `text` | YES | — | Free-text price note. Displayed when non-null; takes precedence over rendered range. |
| `cta_type` | `text` | NO | `'get-tickets'` | CHECK IN (`'get-tickets'`, `'rsvp'`, `'register'`, `'learn-more'`). |
| `cta_url` | `text` | YES | — | URL for CTA. Should match `ticket_url` or `rsvp_url` depending on `cta_type`. |
| `organizer_listing_id` | `uuid` | YES | — | FK → `listings(id)` ON DELETE SET NULL. Optional "Presented by" attribution. |
| `is_recurring` | `boolean` | NO | `false` | Placeholder field — recurring event management is V2. At Beta, recurring events are separate records. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`
- `listing_details_event_date_idx` on `(event_date)` — B-tree; upcoming events queries.
- `listing_details_organizer_idx` on `(organizer_listing_id) WHERE organizer_listing_id IS NOT NULL` — partial B-tree.

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `organizer_listing_id → listings(id) ON DELETE SET NULL`

### RLS Note

Same inheritance pattern as `listing_details_business`. `anon` SELECT only when parent listing is published.

### Seed Data

None — event listings are owner-created at Beta launch.

---

## listing_details_job

**Phase:** Beta
**Purpose:** Entity-type-specific fields for job listings — full-time, part-time, contract, internship, and volunteer opportunities. Auto-expires at application deadline.
**Privacy:** None beyond what is on `listings`. Employer contact is handled via `apply_url`.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. |
| `role_title` | `text` | NO | — | Job title. Required. Displayed as Page headline. |
| `employment_type` | `text` | YES | — | CHECK IN (`'full-time'`, `'part-time'`, `'contract'`, `'freelance'`, `'internship'`, `'volunteer'`). V1 filter. |
| `location_type` | `text` | NO | `'in-person'` | CHECK IN (`'in-person'`, `'remote'`, `'hybrid'`). Prominent display on Page and search cards. |
| `location_address` | `text` | YES | — | Work location address. Null for remote roles. |
| `location_city_text` | `text` | YES | — | Denormalized city name. Null for fully remote. |
| `location_state` | `text` | YES | — | State for display. Null for fully remote. |
| `description` | `text` | YES | — | Full job description. Used in full-text search. |
| `requirements` | `text` | YES | — | Requirements/qualifications section. May contain Markdown. |
| `salary_range_min` | `numeric(10,2)` | YES | — | Minimum salary in USD. Null if undisclosed. |
| `salary_range_max` | `numeric(10,2)` | YES | — | Maximum salary in USD. Null for single-rate or undisclosed. |
| `salary_type` | `text` | YES | — | CHECK IN (`'annual'`, `'hourly'`, `'project'`). Labels salary range display. Null if undisclosed. |
| `salary_visible` | `boolean` | NO | `true` | Whether to display salary on public Page. Salary fields may be set with `salary_visible = false` for internal record-keeping. |
| `apply_url` | `text` | YES | — | External apply URL — ATS, email, or form. Null if no apply mechanism exists yet. |
| `cta_type` | `text` | NO | `'apply'` | CHECK IN (`'apply'`, `'learn-more'`, `'contact'`). |
| `cta_url` | `text` | YES | — | CTA URL. May differ from `apply_url` (e.g., landing page vs. ATS link). |
| `deadline` | `date` | YES | — | Application deadline. When set, `listings.auto_expire_at` is set to `deadline + 1 day at midnight UTC`. |
| `employer_listing_id` | `uuid` | YES | — | FK → `listings(id)` ON DELETE SET NULL. "Posted by [Business]" attribution. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`
- `listing_details_job_deadline_idx` on `(deadline) WHERE deadline IS NOT NULL` — partial B-tree; daily expire job.
- `listing_details_employer_idx` on `(employer_listing_id) WHERE employer_listing_id IS NOT NULL` — partial B-tree.

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `employer_listing_id → listings(id) ON DELETE SET NULL`

### RLS Note

Same inheritance pattern. `anon` SELECT only when parent listing is published and `deleted_at IS NULL`.

### Seed Data

None — job listings are owner-created at Beta launch.

---

## listing_details_vendor

**Phase:** V2
**Purpose:** Marketplace-specific fields for vendor listings. A vendor entity has both a `listing_details_business` row and this row, both keyed to the same `listings.id`. Business context (address, hours, contact) is in `listing_details_business`; commerce fields are here.
**Privacy:** `stripe_connect_id` is a sensitive credential — server-side only. Never include in any client-facing API response.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `listing_id` | `uuid` | NO | — | PK and FK → `listings(id)` ON DELETE CASCADE. |
| `storefront_description` | `text` | YES | — | "What we sell" summary shown above the product grid. |
| `shipping_info` | `text` | YES | — | Free-text shipping policy. Shown in storefront footer section. |
| `return_policy` | `text` | YES | — | Free-text return and exchange policy. |
| `stripe_connect_id` | `text` | YES | — | Stripe Connect account ID (e.g., `acct_1Ab...`). Server-side only. Never returned in client-facing responses. |
| `stripe_connect_status` | `text` | NO | `'not-started'` | CHECK IN (`'not-started'`, `'pending'`, `'active'`, `'restricted'`). Synced via Stripe Connect webhooks. Controls whether storefront is "open". |
| `cta_type` | `text` | NO | `'shop'` | CHECK IN (`'shop'`, `'browse'`, `'order'`, `'visit-store'`). |
| `cta_url` | `text` | YES | — | CTA URL. May be null for in-platform storefronts (scrolls to section on same page). |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (listing_id)`

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

Same inheritance pattern. `stripe_connect_id` must never be SELECTed in any `authenticated` or `anon` query. Server Actions read this field using the service role key only and never return it in a response payload.

### Seed Data

None — vendor listings are owner-created at V2 launch.

---

## Section 3: Entity Sub-tables

Sub-tables store child records that belong to a parent listing but are not themselves top-level entities. They are displayed on the parent's Page and are not directly searchable.

---

## services

**Phase:** MVP (name, description, display_order, is_visible); V1 adds price, price_type, price_note, duration_minutes, cta_type, cta_url
**Purpose:** Individual service offerings for business and professional listings. Displayed as a structured list on the Page.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. Parent business or professional listing. |
| `name` | `text` | NO | — | Service name. Displayed as item heading. |
| `description` | `text` | YES | — | Short description of what the service includes. |
| `price` | `numeric(10,2)` | YES | — | Price in USD. Null if owner uses `price_note` instead. V1 active. |
| `price_type` | `text` | YES | — | CHECK IN (`'fixed'`, `'starting-at'`, `'hourly'`, `'custom'`, `'free'`). Labels price display. V1 active. |
| `price_note` | `text` | YES | — | Free-text price note. Shown when `price_type = 'custom'` or for additional context. V1 active. |
| `duration_minutes` | `integer` | YES | — | Estimated service duration in minutes. Shown as "~60 min". V1 active. |
| `cta_type` | `text` | YES | — | CHECK IN (`'book'`, `'inquire'`, `'call'`, `'contact'`). Per-service CTA. Overrides parent listing CTA when set. V1 active. |
| `cta_url` | `text` | YES | — | Per-service CTA URL. Null when `cta_type` is null. V1 active. |
| `display_order` | `integer` | NO | `0` | Sort order for the services list. Owner can reorder via drag-and-drop. |
| `is_visible` | `boolean` | NO | `true` | Whether service is shown on public Page. Allows temporary hiding without deletion. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `services_listing_id_idx` on `(listing_id)` — B-tree; fetch all services for a listing.
- `services_listing_order_idx` on `(listing_id, display_order)` — B-tree; ordered fetch.

### Unique Constraints

- None. Duplicate service names on the same listing trigger an application-layer warning but are not blocked by a DB constraint.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()`. Admin via service role.

### Seed Data

None — services are owner-created.

---

## products

**Phase:** V2
**Purpose:** Individual products for sale. Child entity of a vendor listing. Products are discovered through the vendor's storefront, not through global search.
**Privacy:** `stripe_product_id`, `stripe_price_id` are server-side only — never returned in client-facing responses.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `vendor_listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. Vendor parent. |
| `name` | `text` | NO | — | Product name. Displayed on product cards and detail page. |
| `slug` | `text` | NO | — | URL-safe identifier. Auto-generated from vendor slug + product name. UNIQUE. |
| `description` | `text` | YES | — | Full product description. |
| `price` | `numeric(10,2)` | NO | — | Current sale price in USD. Required. |
| `compare_at_price` | `numeric(10,2)` | YES | — | Original/strikethrough price. Must be greater than `price` when set. |
| `currency` | `text` | NO | `'USD'` | ISO 4217 currency code. USD only at V2. |
| `sku` | `text` | YES | — | Vendor-assigned SKU. Not unique at platform level. |
| `inventory_count` | `integer` | YES | — | Current inventory. Null = unlimited. Zero = out of stock. Must be ≥ 0 when non-null. |
| `track_inventory` | `boolean` | NO | `false` | Whether `inventory_count` is being tracked. When false, product is always shown as available. |
| `is_digital` | `boolean` | NO | `false` | Whether product is digital (ebook, download). No shipping when true. |
| `status` | `text` | NO | `'draft'` | CHECK IN (`'active'`, `'draft'`, `'archived'`). `draft` = not visible on storefront. |
| `weight_oz` | `numeric` | YES | — | Product weight in ounces for shipping calculation. Null for digital products. |
| `categories` | `text[]` | YES | — | Product category tags. Free text array for storefront filtering. |
| `tags` | `text[]` | YES | — | Discovery tags. Free text array. |
| `cover_image_path` | `text` | YES | — | Primary product image. Storage path in `listing-media` bucket. |
| `variants` | `jsonb` | YES | — | Variant configuration. Shape: `[{name: "Size", options: ["S","M","L"]}, ...]`. Null for simple products. |
| `stripe_product_id` | `text` | YES | — | Stripe Product ID. Set when product goes active. Server-side only. |
| `stripe_price_id` | `text` | YES | — | Stripe Price ID. Must be recreated when `price` or `currency` changes. Server-side only. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |
| `deleted_at` | `timestamptz` | YES | — | Soft delete. Preserved for order history reference. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `products_vendor_listing_id_idx` on `(vendor_listing_id)` — B-tree; fetch all products for a vendor.
- `products_status_idx` on `(vendor_listing_id, status)` — B-tree; storefront query (active products only).
- `products_deleted_at_idx` on `(deleted_at) WHERE deleted_at IS NULL` — partial; soft-delete filtering.

### Unique Constraints

- `UNIQUE (slug)` — platform-wide product slug uniqueness.

### Foreign Keys

- `vendor_listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where `status = 'active'`, `deleted_at IS NULL`, and parent listing is published. `authenticated` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()`. `stripe_product_id` and `stripe_price_id` are excluded from any `anon` or `authenticated` SELECT via server-side query construction; never in a view or function that exposes to clients.

### Seed Data

None — products are owner-created at V2 launch.

---

## product_variants

**Phase:** V2
**Purpose:** Individual variant rows for products with variant options (size, color, material). Each variant represents one purchasable combination.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `product_id` | `uuid` | NO | — | FK → `products(id)` ON DELETE CASCADE. |
| `name` | `text` | NO | — | Variant display name ("Small / Black", "M / Red"). |
| `options` | `jsonb` | NO | — | Key-value pairs for this variant. Shape: `{"color": "red", "size": "M"}`. |
| `price_delta` | `numeric(10,2)` | NO | `0` | Price adjustment relative to parent product price. Negative values allowed for discounted variants. |
| `inventory_count` | `integer` | YES | — | Variant-level inventory. Null = inherits parent tracking. Zero = out of stock for this variant. |
| `sku` | `text` | YES | — | Variant-level SKU. |
| `is_active` | `boolean` | NO | `true` | Whether this variant is purchasable. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `product_variants_product_id_idx` on `(product_id)` — B-tree; fetch all variants for a product.

### Unique Constraints

- None. Variant option combinations are validated for uniqueness at the application layer.

### Foreign Keys

- `product_id → products(id) ON DELETE CASCADE`

### RLS Note

Same access pattern as `products`. `anon` and `authenticated` access inherits through parent product's visibility rules. Mutations only by owner via service-layer checks.

### Seed Data

None.

---

## listing_hours

**Phase:** MVP (table built; used alongside `listing_details_business.hours` jsonb field)
**Purpose:** Structured weekly hours of operation, one row per day per listing. Provides a normalized alternative to the jsonb hours field for querying.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `day_of_week` | `integer` | NO | — | CHECK (day_of_week BETWEEN 0 AND 6). 0 = Sunday, 6 = Saturday. |
| `open_time` | `time` | YES | — | Opening time. Null when `is_closed = true`. |
| `close_time` | `time` | YES | — | Closing time. Null when `is_closed = true`. |
| `is_closed` | `boolean` | NO | `false` | True when business is closed on this day. When true, `open_time` and `close_time` should be null. |
| `notes` | `text` | YES | — | Supplemental note for this specific day ("Closes early on holidays"). |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `listing_hours_listing_id_idx` on `(listing_id, day_of_week)` — B-tree; fetch weekly hours for a listing.

### Unique Constraints

- `UNIQUE (listing_id, day_of_week)` — one hours record per day per listing.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()`.

### Seed Data

None — owner-populated.

---

## listing_links

**Phase:** MVP
**Purpose:** Social and external links for a listing. Stored separately from `listing_details_*` social URL fields to support flexible ordering and additional link types.
**Privacy:** None. All links are public when listing is published.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `platform` | `text` | NO | — | CHECK IN (`'instagram'`, `'facebook'`, `'twitter'`, `'tiktok'`, `'youtube'`, `'linkedin'`, `'pinterest'`, `'website'`, `'booking'`, `'shop'`, `'other'`). |
| `url` | `text` | NO | — | Full URL for this link. Must start with `https://` — validated at application layer. |
| `display_order` | `integer` | NO | `0` | Sort order within this listing's link set. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `listing_links_listing_id_idx` on `(listing_id, display_order)` — B-tree; ordered fetch for a listing.

### Unique Constraints

- None. A listing may have multiple links of the same platform type (e.g., two websites).

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()`.

### Seed Data

None — owner-populated.

---

## listing_ctas

**Phase:** V3 (placeholder table; CTA fields live on `listing_details_*` tables at MVP through V2)
**Purpose:** Flexible CTA management for premium listings — supports multiple CTAs, section-specific placement, and custom ordering beyond the primary CTA field on each detail table.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `cta_type` | `text` | NO | — | CHECK IN (`'book'`, `'order'`, `'call'`, `'message'`, `'visit'`, `'get-quote'`, `'shop'`, `'subscribe'`, `'contact'`, `'commission'`, `'inquire'`, `'get-tickets'`, `'rsvp'`, `'register'`, `'learn-more'`, `'apply'`, `'buy-now'`, `'book-service'`). Full catalog from Section 5 of entity-content-model.md. |
| `cta_url` | `text` | YES | — | URL for this CTA. Null for `'call'` type. |
| `cta_label` | `text` | NO | — | Display label. Overrides default catalog label. |
| `display_order` | `integer` | NO | `0` | Sort order among this listing's CTAs. |
| `section_context` | `text` | YES | — | Which section of the Page this CTA appears in. Null = global. |
| `is_active` | `boolean` | NO | `true` | Whether CTA is currently shown. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `listing_ctas_listing_id_idx` on `(listing_id, display_order)` — B-tree; ordered fetch.

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/UPDATE/DELETE: only where `listings.owner_user_id = auth.uid()` and `listings.tier = 'premium'` (enforced at service layer).

### Seed Data

None.

---

## listing_tags

**Phase:** Beta
**Purpose:** Junction table associating tags with listings. Enables tag-based discovery and filtering.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `tag_id` | `uuid` | NO | — | FK → `tags(id)` ON DELETE CASCADE. |
| `created_at` | `timestamptz` | NO | `now()` | When the tag was applied to this listing. |

### Indexes

- `PRIMARY KEY (id)`
- `listing_tags_listing_id_idx` on `(listing_id)` — B-tree; fetch all tags for a listing.
- `listing_tags_tag_id_idx` on `(tag_id)` — B-tree; fetch all listings for a tag.

### Unique Constraints

- `UNIQUE (listing_id, tag_id)` — no duplicate tag associations.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `tag_id → tags(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/DELETE: only where `listings.owner_user_id = auth.uid()`. Admin can manage tags via service role.

### Seed Data

None — owner-applied or admin-curated at Beta.

---

## listing_service_areas

**Phase:** V2
**Purpose:** Structured service area records for non-physical or hybrid entities. Replaces or supplements the free-text `listings.service_area_description` field with queryable geographic scope.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `area_type` | `text` | NO | — | CHECK IN (`'city'`, `'state'`, `'metro'`, `'radius'`, `'national'`, `'international'`). |
| `area_value` | `text` | NO | — | Human-readable area identifier: city slug, state code ("GA"), metro name ("Atlanta Metro"), or country code. |
| `radius_miles` | `integer` | YES | — | Radius in miles from listing location. Only applicable when `area_type = 'radius'`. |
| `created_at` | `timestamptz` | NO | `now()` | |

### Indexes

- `PRIMARY KEY (id)`
- `listing_service_areas_listing_id_idx` on `(listing_id)` — B-tree; fetch all service areas for a listing.
- `listing_service_areas_area_value_idx` on `(area_type, area_value)` — B-tree; look up listings serving a specific area.

### Unique Constraints

- None beyond PK.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where parent listing is published. `authenticated` INSERT/DELETE: only where `listings.owner_user_id = auth.uid()`.

### Seed Data

None.

---

## media_attachments

**Phase:** MVP (entity_type CHECK expanded at V2 to include `'product'`)
**Purpose:** Polymorphic media store for gallery images, portfolio items, product images, and review photos for any entity type.
**Privacy:** None for public listing media. `verification-docs` and `receipts` buckets have private access controls enforced separately at the Storage bucket policy level and via RLS.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `entity_type` | `text` | NO | — | CHECK IN (`'listing'`, `'product'`, `'review'`, `'user'`). `'product'` added at V2 migration. |
| `entity_id` | `uuid` | NO | — | ID of the parent entity. Not a formal FK (polymorphic) — enforced at application layer. |
| `file_path` | `text` | NO | — | Supabase Storage path in the `listing-media` bucket. Never store a CDN URL — generate at read time. |
| `file_type` | `text` | NO | — | MIME type: `image/jpeg`, `image/png`, `image/webp`. Validated server-side before upload. |
| `file_size_bytes` | `integer` | NO | — | File size in bytes. Used for tier-based storage tracking. |
| `width` | `integer` | YES | — | Image width in pixels. Set by upload handler after processing. |
| `height` | `integer` | YES | — | Image height in pixels. Set by upload handler after processing. |
| `alt_text` | `text` | YES | — | Owner-supplied alt text. Falls back to generated alt from listing name and position if null. |
| `display_order` | `integer` | NO | `0` | Sort order within the gallery for this entity. Owner can reorder. |
| `is_portfolio_primary` | `boolean` | NO | `false` | For Creative entities: marks which image is featured at top of portfolio gallery. At most one per listing. |
| `is_approved` | `boolean` | NO | `true` | Admin can set false to hide a media item flagged as inappropriate. True by default. |
| `uploaded_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Who uploaded this file. |
| `created_at` | `timestamptz` | NO | `now()` | Upload timestamp. |

### Indexes

- `PRIMARY KEY (id)`
- `media_entity_idx` on `(entity_type, entity_id)` — B-tree; efficient polymorphic lookup.
- `media_attachments_uploaded_by_idx` on `(uploaded_by)` — B-tree; find media by uploader.

### Unique Constraints

- None. Multiple images per entity are expected.

### Foreign Keys

- `uploaded_by → auth.users(id) ON DELETE SET NULL`
- No formal FK on `entity_id` (polymorphic design — integrity enforced at application layer).

### RLS Note

`anon` SELECT: only where parent entity is a published listing (`entity_type = 'listing'`) and `is_approved = true`. `authenticated` INSERT: only for entities the user owns. `authenticated` DELETE: own uploaded attachments only. No `anon` or `authenticated` access to files in the `verification-docs` or `receipts` buckets — controlled by Storage bucket policy.

### Seed Data

None — media is owner-uploaded.

---

## Section 4: Discovery

Discovery tables form the taxonomy and geographic scaffolding for the platform. They are mostly reference data, seeded before any listings are created.

---

## categories

**Phase:** MVP
**Purpose:** Hierarchical category tree for classifying listings. Top-level categories have `parent_id = null`. Subcategories reference a top-level category.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | Display name ("Food & Beverage", "Health & Wellness"). |
| `slug` | `text` | NO | — | URL-safe identifier ("food-beverage", "health-wellness"). UNIQUE. Used in category landing page URLs. |
| `parent_id` | `uuid` | YES | — | FK → `categories(id)` ON DELETE SET NULL. Null for top-level categories. |
| `description` | `text` | YES | — | Optional description shown on category landing pages. |
| `icon` | `text` | YES | — | Icon identifier or SVG path. Used in category filter UI. |
| `display_order` | `integer` | NO | `0` | Sort order within the category level (top-level or within a parent). |
| `is_active` | `boolean` | NO | `true` | Whether this category is displayed to users and available for selection. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `categories_parent_id_idx` on `(parent_id)` — B-tree; fetch subcategories for a parent.
- `categories_display_order_idx` on `(parent_id, display_order)` — B-tree; ordered category tree rendering.

### Unique Constraints

- `UNIQUE (slug)`

### Foreign Keys

- `parent_id → categories(id) ON DELETE SET NULL`

### RLS Note

`anon` and `authenticated` SELECT all rows where `is_active = true`. No user INSERT/UPDATE/DELETE — categories are admin-managed via service role.

### Seed Data

Required — the full category taxonomy must be seeded before any listings can be created. `listings.category_id` has a NOT NULL constraint.

---

## cities

**Phase:** MVP
**Purpose:** Canonical city and metro area reference. Includes SEO-friendly slugs, geographic coordinates, and launch-phase assignment for phased market rollout.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | City display name ("Atlanta", "Houston"). |
| `slug` | `text` | NO | — | URL-safe identifier ("atlanta", "houston"). UNIQUE. Used in city landing page URLs. |
| `state_id` | `uuid` | NO | — | FK → `states(id)` ON DELETE RESTRICT. |
| `metro_area` | `text` | YES | — | Metro area name for grouping ("Atlanta Metro", "Greater Houston"). Optional. |
| `latitude` | `numeric(10,6)` | NO | — | City center latitude. Used for geo proximity queries at V2. |
| `longitude` | `numeric(10,6)` | NO | — | City center longitude. |
| `population` | `integer` | YES | — | City population (approximate). Used for internal prioritization, not displayed. |
| `is_active` | `boolean` | NO | `false` | Whether the city is live on the platform. False until manually activated for launch. |
| `launch_phase` | `text` | NO | `'later'` | CHECK IN (`'launch'`, `'v1'`, `'v2'`, `'later'`). Planned rollout phase for this city. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `cities_state_id_idx` on `(state_id)` — B-tree; cities by state.
- `cities_is_active_idx` on `(is_active) WHERE is_active = true` — partial; active city filter.

### Unique Constraints

- `UNIQUE (slug)`

### Foreign Keys

- `state_id → states(id) ON DELETE RESTRICT`

### RLS Note

`anon` and `authenticated` SELECT all rows. Admin manages via service role. No user writes.

### Seed Data

Required — all planned launch cities and future markets must be seeded. Listings reference `cities.id` via FK.

---

## states

**Phase:** MVP
**Purpose:** US state reference table. Foreign key target for `cities.state_id`. US-only at MVP.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | Full state name ("Georgia", "Texas"). |
| `code` | `text` | NO | — | Two-character state code ("GA", "TX"). UNIQUE. |
| `country` | `text` | NO | `'US'` | Country code. US-only at MVP. |
| `created_at` | `timestamptz` | NO | `now()` | |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (code)`

### Unique Constraints

- `UNIQUE (code)`

### Foreign Keys

- None. Referenced by `cities.state_id`.

### RLS Note

`anon` and `authenticated` SELECT all rows. No user writes — admin-managed.

### Seed Data

Required — all 50 US states seeded before cities can be seeded.

---

## neighborhoods

**Phase:** Beta
**Purpose:** Neighborhood reference records within a city. Used for finer-grained location filtering and discovery beyond the city level.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | Neighborhood display name ("Old Fourth Ward", "Midtown"). |
| `slug` | `text` | NO | — | URL-safe identifier. UNIQUE within a city but not platform-wide. |
| `city_id` | `uuid` | NO | — | FK → `cities(id)` ON DELETE CASCADE. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `neighborhoods_city_id_idx` on `(city_id)` — B-tree; fetch neighborhoods by city.
- `UNIQUE (city_id, slug)` — slug is unique within a city.

### Unique Constraints

- `UNIQUE (city_id, slug)` — allows the same neighborhood name slug in different cities.

### Foreign Keys

- `city_id → cities(id) ON DELETE CASCADE`

### RLS Note

`anon` and `authenticated` SELECT all rows. Admin-managed via service role.

### Seed Data

Optional — neighborhood data seeded for launch cities at Beta. Can be added incrementally.

---

## tags

**Phase:** Beta
**Purpose:** Freeform tags used for discovery and filtering. Can be associated with a category for organization. Applied to listings via the `listing_tags` junction table.
**Privacy:** None.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | Tag display name ("Black-Owned", "Vegan", "LGBTQ+ Friendly"). |
| `slug` | `text` | NO | — | URL-safe identifier. UNIQUE. |
| `category_id` | `uuid` | YES | — | FK → `categories(id)` ON DELETE SET NULL. Optional category association for organization. |
| `usage_count` | `integer` | NO | `0` | Denormalized count of active listing associations. Updated by trigger on `listing_tags` INSERT/DELETE. |
| `is_active` | `boolean` | NO | `true` | Whether tag is available for use. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `tags_category_id_idx` on `(category_id) WHERE category_id IS NOT NULL` — partial B-tree; tags by category.
- `tags_usage_count_idx` on `(usage_count DESC)` — B-tree; popular tags ordering.

### Unique Constraints

- `UNIQUE (slug)`

### Foreign Keys

- `category_id → categories(id) ON DELETE SET NULL`

### RLS Note

`anon` and `authenticated` SELECT all rows where `is_active = true`. Tags are created by admin or via an owner suggestion flow (V1). No direct user INSERT to `tags` — suggestions create a pending tag record reviewed by admin.

### Seed Data

Optional — a curated set of initial tags should be seeded at Beta launch.

---

## saves

**Phase:** MVP
**Purpose:** Records when a Supporter saves (bookmarks) a listing. One row per user-listing association.
**Privacy:** Saves are private to the saving user. `user_id` must never be exposed in any public query.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE. The user who saved the listing. |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. The saved listing. |
| `created_at` | `timestamptz` | NO | `now()` | When the save was created. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (user_id, listing_id)` — one save per user per listing.
- `saves_user_id_idx` on `(user_id)` — B-tree; fetch all saves for a user's saved list.
- `saves_listing_id_idx` on `(listing_id)` — B-tree; denormalized save count updates.

### Unique Constraints

- `UNIQUE (user_id, listing_id)` — prevents duplicate saves.

### Foreign Keys

- `user_id → auth.users(id) ON DELETE CASCADE`
- `listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`authenticated` SELECT, INSERT, DELETE: own records only (`user_id = auth.uid()`). `anon`: not permitted. Owner of a listing can see only the denormalized `save_count` on `listings` — not who saved it.

### Seed Data

None.

---

## Section 5: Community Engagement

Community engagement tables manage user-contributed trust signals: ownership claims, factual corrections, reviews, and review moderation. These tables are central to the platform's trust and accuracy model.

---

## claims

**Phase:** MVP
**Purpose:** Ownership claim requests submitted by business owners to claim an unclaimed listing. The claims workflow is what elevates a listing from `trust_tier = 'unclaimed'` to `trust_tier = 'claimed'`.
**Privacy:** `claimant_user_id` is a user FK — the claim record itself is visible only to the claimant and Admin.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. The listing being claimed. |
| `claimant_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. The user submitting the claim. SET NULL on user delete preserves the claim record for audit. |
| `status` | `text` | NO | `'pending'` | CHECK IN (`'pending'`, `'under_review'`, `'approved'`, `'rejected'`, `'withdrawn'`). Transitions enforced at service layer. |
| `submitted_at` | `timestamptz` | NO | `now()` | When the claim was submitted. |
| `reviewed_at` | `timestamptz` | YES | — | When an admin made a decision. Null until decision. |
| `reviewed_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Admin who reviewed the claim. |
| `rejection_reason` | `text` | YES | — | Admin-written reason for rejection. Shown to claimant. |
| `verification_doc_paths` | `text[]` | YES | — | Array of Storage paths for supporting documents. Stored in `verification-docs` bucket. |
| `notes` | `text` | YES | — | Internal admin notes on this claim. Not shown to claimant. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `claims_listing_id_idx` on `(listing_id)` — B-tree; check for existing claims on a listing.
- `claims_claimant_user_id_idx` on `(claimant_user_id)` — B-tree; user's own claim history.
- `claims_status_idx` on `(status) WHERE status IN ('pending', 'under_review')` — partial; admin claim queue.

### Unique Constraints

- None. A listing may have multiple claims over time (a rejected claim followed by a resubmission). Application layer prevents two simultaneous pending claims for the same listing.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `claimant_user_id → auth.users(id) ON DELETE SET NULL`
- `reviewed_by → auth.users(id) ON DELETE SET NULL`

### RLS Note

`authenticated` INSERT: allowed; `claimant_user_id` set to `auth.uid()`. `authenticated` SELECT: own claim records only (`claimant_user_id = auth.uid()`). `authenticated` UPDATE: not permitted — service layer manages all status transitions. Admin via service role.

### Seed Data

None.

---

## corrections

**Phase:** Beta
**Purpose:** Community-submitted corrections to listing data. Any authenticated user can flag a specific field as incorrect and suggest the correct value. Reviewed and applied by Admin.
**Privacy:** `submitter_user_id` is a user FK — visible only to the submitter and Admin.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `submitter_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. User who submitted the correction. |
| `field_name` | `text` | NO | — | The field being corrected ("phone", "address_line_1", "website_url"). |
| `current_value` | `text` | YES | — | The current (incorrect) value as the submitter sees it. Null if the field is empty but should have a value. |
| `suggested_value` | `text` | NO | — | The correct value the submitter is suggesting. |
| `reason` | `text` | YES | — | Optional explanation of why the current value is wrong. |
| `status` | `text` | NO | `'pending'` | CHECK IN (`'pending'`, `'approved'`, `'rejected'`). Transitions managed at service layer. |
| `reviewed_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Admin who reviewed. |
| `reviewed_at` | `timestamptz` | YES | — | When the admin made a decision. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `corrections_listing_id_idx` on `(listing_id)` — B-tree; all corrections for a listing.
- `corrections_status_idx` on `(status) WHERE status = 'pending'` — partial; admin corrections queue.
- `corrections_submitter_idx` on `(submitter_user_id)` — B-tree; submitter's own history.

### Unique Constraints

- None. Multiple corrections for the same field on the same listing are allowed and reviewed individually.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `submitter_user_id → auth.users(id) ON DELETE SET NULL`
- `reviewed_by → auth.users(id) ON DELETE SET NULL`

### RLS Note

`authenticated` INSERT: allowed; `submitter_user_id` set to `auth.uid()`. `authenticated` SELECT: own correction records only. `authenticated` UPDATE: not permitted. Admin via service role.

### Seed Data

None.

---

## reviews

**Phase:** MVP (data model defined and columns built); V1 (workflow active)
**Purpose:** Star ratings and text reviews submitted by Supporters for published listings. Reviews enter with `status = 'intake'` and require Admin approval before publication in V1.
**Privacy:** `reviewer_user_id` is a user FK. Display name is shown publicly; email and user ID are never exposed.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. |
| `reviewer_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. SET NULL on user delete; review remains if published. |
| `rating` | `integer` | NO | — | CHECK (rating BETWEEN 1 AND 5). Star rating. |
| `title` | `text` | YES | — | Optional review headline. |
| `body` | `text` | YES | — | Review text. Optional but strongly encouraged. |
| `status` | `text` | NO | `'intake'` | CHECK IN (`'intake'`, `'pending_approval'`, `'published'`, `'rejected'`, `'removed'`). `'intake'` = stored but not yet in review queue; `'pending_approval'` = in admin review queue (V1); `'published'` = live; `'rejected'` = not approved; `'removed'` = admin removed post-approval. |
| `visit_date` | `date` | YES | — | Date the reviewer visited or interacted with the business. Optional. |
| `is_verified_purchase` | `boolean` | NO | `false` | True for reviews associated with a marketplace transaction (V2). |
| `reviewed_by` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Admin who moderated this review. |
| `reviewed_at` | `timestamptz` | YES | — | When moderation decision was made. |
| `published_at` | `timestamptz` | YES | — | When status transitioned to `'published'`. |
| `rejection_reason` | `text` | YES | — | Reason for rejection shown to reviewer. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (reviewer_user_id, listing_id)` — one review per user per listing. Anti-gaming control.
- `reviews_listing_id_idx` on `(listing_id, status)` — B-tree; published reviews for a listing.
- `reviews_status_pending_idx` on `(status) WHERE status = 'pending_approval'` — partial; admin review queue.
- `reviews_reviewer_user_id_idx` on `(reviewer_user_id)` — B-tree; reviewer's own review history.

### Unique Constraints

- `UNIQUE (reviewer_user_id, listing_id)` — one review per user per listing.

### Foreign Keys

- `listing_id → listings(id) ON DELETE CASCADE`
- `reviewer_user_id → auth.users(id) ON DELETE SET NULL`
- `reviewed_by → auth.users(id) ON DELETE SET NULL`

### RLS Note

`anon` SELECT: only where `status = 'published'`. `authenticated` SELECT: own reviews at any status; others' reviews only where `status = 'published'`. `authenticated` INSERT: allowed; `status` forced to `'intake'` by RLS policy — service layer rejects any INSERT with a non-`'intake'` status. `authenticated` UPDATE: not permitted — reviews are immutable after submission. `authenticated` DELETE: not permitted. Admin via service role.

### Seed Data

None.

---

## review_responses

**Phase:** Beta
**Purpose:** Owner responses to published reviews. One response per review maximum. Owners can respond to public reviews — responses are published immediately without moderation.
**Privacy:** `responder_listing_id` reveals the owner of the listing. Soft delete (`deleted_at`) preserves audit history.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `review_id` | `uuid` | NO | — | FK → `reviews(id)` ON DELETE CASCADE. |
| `responder_listing_id` | `uuid` | NO | — | FK → `listings(id)` ON DELETE CASCADE. Must match the `listing_id` on the referenced review — enforced at service layer. |
| `response_text` | `text` | NO | — | The owner's response text. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated via trigger. |
| `deleted_at` | `timestamptz` | YES | — | Soft delete. Null = active response. |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE (review_id)` — one response per review.
- `review_responses_responder_idx` on `(responder_listing_id)` — B-tree; all responses by a listing owner.

### Unique Constraints

- `UNIQUE (review_id)` — one response per review maximum.

### Foreign Keys

- `review_id → reviews(id) ON DELETE CASCADE`
- `responder_listing_id → listings(id) ON DELETE CASCADE`

### RLS Note

`anon` SELECT: only where `deleted_at IS NULL`. `authenticated` INSERT: only where `listings.owner_user_id = auth.uid()` for the referenced listing. `authenticated` UPDATE: only where `listings.owner_user_id = auth.uid()`. `authenticated` DELETE: soft delete only via service layer. Admin via service role.

### Seed Data

None.

---

## review_reports

**Phase:** Beta
**Purpose:** Reports submitted by authenticated users to flag reviews that violate policy. Flagged reviews enter a secondary admin moderation queue but remain publicly visible until Admin acts.
**Privacy:** `reporter_user_id` is a user FK — visible to Admin only, never to the listing owner or public.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `review_id` | `uuid` | NO | — | FK → `reviews(id)` ON DELETE CASCADE. |
| `reporter_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. User who filed the report. |
| `reason` | `text` | NO | — | CHECK IN (`'spam'`, `'inappropriate'`, `'fake'`, `'off_topic'`, `'other'`). |
| `notes` | `text` | YES | — | Optional additional context from the reporter. |
| `status` | `text` | NO | `'pending'` | CHECK IN (`'pending'`, `'reviewed'`, `'dismissed'`). |
| `created_at` | `timestamptz` | NO | `now()` | |

### Indexes

- `PRIMARY KEY (id)`
- `review_reports_review_id_idx` on `(review_id)` — B-tree; reports for a specific review.
- `review_reports_status_idx` on `(status) WHERE status = 'pending'` — partial; admin flagged review queue.

### Unique Constraints

- None. Multiple users can report the same review independently.

### Foreign Keys

- `review_id → reviews(id) ON DELETE CASCADE`
- `reporter_user_id → auth.users(id) ON DELETE SET NULL`

### RLS Note

`authenticated` INSERT: allowed; `reporter_user_id` set to `auth.uid()`. `authenticated` SELECT: not permitted — reports are admin-only. Admin via service role.

### Seed Data

None.

---

## verification_submissions

**Phase:** V1
**Purpose:** Formal verification document submissions linked to an approved claim. Tracks the verification review workflow and schedules document purge 90 days after a decision, per the privacy policy.
**Privacy:** `doc_paths` contains Storage paths to sensitive verification documents in the private `verification-docs` bucket. Admin access only via 15-minute signed URLs. Paths are redacted in audit log snapshots.

### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `claim_id` | `uuid` | NO | — | FK → `claims(id)` ON DELETE CASCADE. The approved claim this verification is tied to. |
| `doc_paths` | `text[]` | NO | — | Array of Supabase Storage paths in the `verification-docs` bucket. Minimum one path required. |
| `submitted_at` | `timestamptz` | NO | `now()` | When documents were submitted. |
| `decision_at` | `timestamptz` | YES | — | When the admin made a decision. Null until decision. |
| `reviewer_user_id` | `uuid` | YES | — | FK → `auth.users(id)` ON DELETE SET NULL. Admin who reviewed. |
| `decision` | `text` | YES | — | CHECK IN (`'approved'`, `'rejected'`, `'needs_more_info'`). Null until decision. |
| `notes` | `text` | YES | — | Admin notes on the decision. Shown to owner on rejection or `needs_more_info`. |
| `purge_at` | `timestamptz` | YES | — | Scheduled document purge date. Set to `decision_at + 90 days` when a decision is made. A nightly job deletes files from Storage and sets `doc_paths = '{}'` for rows where `purge_at <= now()`. |
| `created_at` | `timestamptz` | NO | `now()` | |

### Indexes

- `PRIMARY KEY (id)`
- `verification_submissions_claim_id_idx` on `(claim_id)` — B-tree; submissions for a claim.
- `verification_submissions_purge_at_idx` on `(purge_at) WHERE purge_at IS NOT NULL` — partial; nightly purge job.
- `verification_submissions_pending_idx` on `(decision) WHERE decision IS NULL` — partial; admin review queue.

### Unique Constraints

- None beyond PK. A claim may have multiple verification submissions (e.g., initial rejection followed by resubmission).

### Foreign Keys

- `claim_id → claims(id) ON DELETE CASCADE`
- `reviewer_user_id → auth.users(id) ON DELETE SET NULL`

### RLS Note

`authenticated` INSERT: allowed for users where the parent claim's `claimant_user_id = auth.uid()`. `authenticated` SELECT: own submissions only — status and notes visible to claimant; `doc_paths` is excluded from `authenticated` SELECT by server-side query construction. Admin access via service role only. `doc_paths` is never returned in any client-facing API response.

### Seed Data

None.
---

## Section 6: Commerce

Commerce tables power paid tiers, subscriptions, marketplace orders, and service packaging. All Stripe identifiers stored here are server-side only — never expose them in any client-facing API response. `plans` and `subscriptions` are V1 (paid tiers launch). `orders`, `order_items`, `coupons`, and `invoices` are V2 (marketplace launch). `service_packages` is V2 (vendor service bundles).

---

### `plans`

**Phase:** V1
**Purpose:** Stores the three subscription tiers available to listing owners (Free, Standard, Premium), their pricing, and their feature entitlements.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | CHECK IN ('free','standard','premium') |
| price_monthly | numeric(10,2) | NO | 0 | USD; 0 for free tier |
| price_yearly | numeric(10,2) | NO | 0 | USD; 0 for free tier |
| features | jsonb | NO | '[]' | Array of feature key strings; document shape in migration comment |
| stripe_price_id_monthly | text | YES | — | Stripe Price ID for monthly billing; null for free tier |
| stripe_price_id_yearly | text | YES | — | Stripe Price ID for annual billing; null for free tier |
| is_active | boolean | NO | true | false = hidden from plan selection UI |
| display_order | integer | NO | 0 | Controls sort order on pricing page |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX plans_name_idx ON plans (name)`

#### Unique Constraints

- `name` — one row per tier

#### Foreign Keys

- None

#### RLS Note

`anon` and `authenticated` SELECT where `is_active = true`. INSERT/UPDATE/DELETE via service role only (admin-managed reference data).

#### Seed Data

Required — seed three rows at migration time: `free` (price 0), `standard`, `premium` with placeholder Stripe IDs.

---

### `subscriptions`

**Phase:** V1
**Purpose:** Tracks the active subscription relationship between a listing and a plan, including Stripe subscription state and billing period.
**Privacy:** Restricted — `stripe_subscription_id` and `stripe_customer_id` are server-side only; never include in client API responses.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| plan_id | uuid | NO | — | FK → plans ON DELETE RESTRICT |
| stripe_subscription_id | text | YES | — | Stripe Subscription ID; null until Stripe checkout completes |
| stripe_customer_id | text | YES | — | Stripe Customer ID; null until first checkout |
| status | text | NO | 'active' | CHECK IN ('trialing','active','past_due','canceled','unpaid','paused') |
| current_period_start | timestamptz | YES | — | Synced from Stripe webhook |
| current_period_end | timestamptz | YES | — | Synced from Stripe webhook |
| cancel_at_period_end | boolean | NO | false | True when owner cancels but billing period hasn't expired |
| canceled_at | timestamptz | YES | — | Set when status transitions to 'canceled' |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX subscriptions_listing_id_idx ON subscriptions (listing_id)` — one active subscription per listing
- `CREATE INDEX subscriptions_stripe_subscription_id_idx ON subscriptions (stripe_subscription_id)` — Stripe webhook lookup
- `CREATE INDEX subscriptions_status_idx ON subscriptions (status)` — filter by status for admin views

#### Unique Constraints

- `listing_id` — one subscription record per listing

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`
- `plan_id → plans.id ON DELETE RESTRICT`

#### RLS Note

`authenticated` SELECT where `listing_id` maps to a listing owned by `auth.uid()`. INSERT/UPDATE via service role only (Stripe webhook handler).

#### Seed Data

None — subscriptions are created by the Stripe checkout flow at runtime.

---

### `orders`

**Phase:** V2
**Purpose:** Tracks a buyer's purchase of one or more products from a vendor listing, including payment status, shipping address, and fulfillment state.
**Privacy:** PII: `shipping_address` (jsonb containing name, street, city, state, zip) — scoped to buyer and vendor owner only.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| buyer_user_id | uuid | YES | — | FK → auth.users ON DELETE SET NULL; SET NULL preserves order history on account deletion |
| vendor_listing_id | uuid | NO | — | FK → listings ON DELETE RESTRICT; cannot delete a vendor with orders |
| status | text | NO | 'pending' | CHECK IN ('pending','confirmed','processing','shipped','delivered','canceled','refunded') |
| subtotal | numeric(10,2) | NO | — | Sum of order_items.total_price before platform fee |
| platform_fee | numeric(10,2) | NO | — | BLACQList platform fee withheld from payout |
| stripe_payment_intent_id | text | YES | — | Stripe PaymentIntent ID; null until payment initiated |
| shipping_address | jsonb | YES | — | Shape: {name, line1, line2, city, state, zip, country}; null for digital-only orders |
| notes | text | YES | — | Buyer notes to vendor at checkout |
| fulfilled_at | timestamptz | YES | — | Set when status transitions to 'delivered' |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX orders_buyer_user_id_idx ON orders (buyer_user_id)` — buyer order history
- `CREATE INDEX orders_vendor_listing_id_idx ON orders (vendor_listing_id)` — vendor order management
- `CREATE INDEX orders_status_idx ON orders (status)` — filter by fulfillment state
- `CREATE INDEX orders_stripe_payment_intent_id_idx ON orders (stripe_payment_intent_id)` — Stripe webhook lookup

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `buyer_user_id → auth.users.id ON DELETE SET NULL`
- `vendor_listing_id → listings.id ON DELETE RESTRICT`

#### RLS Note

`authenticated` SELECT where `buyer_user_id = auth.uid()` (buyer sees own orders) or `vendor_listing_id` maps to a listing where `owner_user_id = auth.uid()` (vendor sees incoming orders). INSERT/UPDATE via service role only (checkout Server Action).

#### Seed Data

None — created at runtime by the checkout flow.

---

### `order_items`

**Phase:** V2
**Purpose:** Line items for a single order — one row per product/variant combination purchased.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| order_id | uuid | NO | — | FK → orders ON DELETE CASCADE |
| product_id | uuid | NO | — | FK → products ON DELETE RESTRICT; preserve product reference for order history |
| variant_id | uuid | YES | — | FK → product_variants ON DELETE RESTRICT; null for simple (no-variant) products |
| quantity | integer | NO | — | CHECK (quantity > 0) |
| unit_price | numeric(10,2) | NO | — | Price at time of purchase; snapshot prevents price-change retroactive impact |
| total_price | numeric(10,2) | NO | — | unit_price * quantity; stored for query convenience |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX order_items_order_id_idx ON order_items (order_id)` — fetch all items for an order

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `order_id → orders.id ON DELETE CASCADE`
- `product_id → products.id ON DELETE RESTRICT`
- `variant_id → product_variants.id ON DELETE RESTRICT`

#### RLS Note

Access controlled through parent `orders` row — no direct public access. SELECT/INSERT via service role only in the checkout Server Action.

#### Seed Data

None.

---

### `coupons`

**Phase:** V2
**Purpose:** Discount codes that can be applied at checkout to reduce order totals, with optional usage limits and expiry dates.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| code | text | NO | — | UNIQUE; uppercase enforced at application layer |
| discount_type | text | NO | — | CHECK IN ('percentage','fixed_amount') |
| discount_value | numeric(10,2) | NO | — | Percentage (0–100) or fixed USD amount |
| minimum_order_amount | numeric(10,2) | YES | — | Minimum subtotal required to apply coupon; null = no minimum |
| usage_limit | integer | YES | — | Maximum total redemptions; null = unlimited |
| usage_count | integer | NO | 0 | Incremented atomically at checkout; CHECK (usage_count >= 0) |
| expires_at | timestamptz | YES | — | null = no expiry |
| is_active | boolean | NO | true | Admin can deactivate without deleting |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX coupons_code_idx ON coupons (code)`
- `CREATE INDEX coupons_is_active_expires_at_idx ON coupons (is_active, expires_at)` — validate active, non-expired coupons at checkout

#### Unique Constraints

- `code` — case-normalized at application layer before insert

#### Foreign Keys

- None

#### RLS Note

`anon` and `authenticated` SELECT is not permitted (code validation happens server-side only). INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None — created by admin or automated campaign tooling at runtime.

---

### `invoices`

**Phase:** V2
**Purpose:** Tracks billing invoices generated by Stripe for subscription and marketplace payments, keyed to a listing.
**Privacy:** Restricted — `stripe_invoice_id` is server-side only.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| amount | numeric(10,2) | NO | — | Invoice amount in USD |
| currency | text | NO | 'USD' | ISO 4217 currency code |
| stripe_invoice_id | text | YES | — | Stripe Invoice ID; null for manually created records |
| status | text | NO | 'open' | CHECK IN ('draft','open','paid','uncollectible','void') |
| due_at | timestamptz | YES | — | null for invoices with no net terms |
| paid_at | timestamptz | YES | — | Set when status transitions to 'paid' |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX invoices_listing_id_idx ON invoices (listing_id)` — fetch all invoices for a listing
- `CREATE INDEX invoices_stripe_invoice_id_idx ON invoices (stripe_invoice_id)` — Stripe webhook lookup
- `CREATE INDEX invoices_status_idx ON invoices (status)` — filter unpaid invoices

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`authenticated` SELECT where `listing_id` maps to a listing owned by `auth.uid()`. INSERT/UPDATE via service role only (Stripe webhook handler).

#### Seed Data

None.

---

### `service_packages`

**Phase:** V2
**Purpose:** Structured service bundles that a vendor can offer for purchase, with defined pricing and billing type, distinct from the per-service list on a business listing.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| name | text | NO | — | Package display name |
| description | text | YES | — | What is included in the package |
| price | numeric(10,2) | NO | — | Package price in USD |
| billing_type | text | NO | — | CHECK IN ('one_time','monthly','per_project') |
| included_services | text[] | YES | — | Array of service description strings for display |
| stripe_price_id | text | YES | — | Stripe Price ID; null until synced to Stripe |
| is_active | boolean | NO | true | false = hidden from storefront |
| display_order | integer | NO | 0 | Controls sort order on the listing page |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX service_packages_listing_id_idx ON service_packages (listing_id)` — fetch all packages for a listing

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT where `is_active = true` and parent listing is published. `authenticated` INSERT/UPDATE where `listing_id` maps to a listing owned by `auth.uid()`. DELETE via service role only.

#### Seed Data

None.

---

## Section 7: Editorial

Editorial tables support admin-curated content — collections of listings, long-form articles, city guides, featured slots, and sponsored placements. These are the surfaces through which the editorial team drives discovery beyond search.

---

### `collections`

**Phase:** MVP
**Purpose:** Named, ordered groups of listings curated by admins for themed discovery (e.g., "Black-owned coffee shops in Atlanta" or "Best places to spend Black Dollar Friday").
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | Collection display title |
| slug | text | NO | — | UNIQUE; URL-safe identifier for the collection page |
| description | text | YES | — | Shown at the top of the collection page |
| cover_image_path | text | YES | — | Supabase Storage path in listing-media bucket |
| is_active | boolean | NO | true | false = not publicly visible |
| display_order | integer | NO | 0 | Sort order on the collections index page |
| created_by | uuid | YES | — | FK → auth.users ON DELETE SET NULL |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX collections_slug_idx ON collections (slug)`
- `CREATE INDEX collections_is_active_display_order_idx ON collections (is_active, display_order)` — collections index page query

#### Unique Constraints

- `slug`

#### Foreign Keys

- `created_by → auth.users.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT where `is_active = true`. INSERT/UPDATE/DELETE via service role only (admin-managed).

#### Seed Data

Optional — seed a small number of launch collections as editorial examples.

---

### `collection_items`

**Phase:** MVP
**Purpose:** Junction table associating listings to collections with a defined display order.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| collection_id | uuid | NO | — | FK → collections ON DELETE CASCADE |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| display_order | integer | NO | 0 | Sort position within the collection |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX collection_items_collection_listing_idx ON collection_items (collection_id, listing_id)`
- `CREATE INDEX collection_items_collection_id_idx ON collection_items (collection_id)` — fetch all items in a collection
- `CREATE INDEX collection_items_listing_id_idx ON collection_items (listing_id)` — find all collections containing a listing

#### Unique Constraints

- `(collection_id, listing_id)` — a listing may appear in a collection only once

#### Foreign Keys

- `collection_id → collections.id ON DELETE CASCADE`
- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT (collection membership is public data). INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None — populated by admin when creating collections.

---

### `editorial_articles`

**Phase:** V1
**Purpose:** Long-form editorial content (blog posts, opinion pieces, platform announcements) published by the BLACQList editorial team.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | Article headline |
| slug | text | NO | — | UNIQUE; URL-safe identifier; immutable after first publish |
| author_user_id | uuid | YES | — | FK → auth.users ON DELETE SET NULL |
| body_md | text | NO | — | Full article body in Markdown |
| excerpt | text | YES | — | Short teaser text (≤280 chars) for card display; null = auto-generated from body |
| cover_image_path | text | YES | — | Supabase Storage path |
| status | text | NO | 'draft' | CHECK IN ('draft','review','published','archived') |
| published_at | timestamptz | YES | — | Set when status first transitions to 'published' |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |
| deleted_at | timestamptz | YES | — | Soft delete; default queries filter WHERE deleted_at IS NULL |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX editorial_articles_slug_idx ON editorial_articles (slug)`
- `CREATE INDEX editorial_articles_status_published_at_idx ON editorial_articles (status, published_at DESC)` — published article listing
- `CREATE INDEX editorial_articles_deleted_at_idx ON editorial_articles (id) WHERE deleted_at IS NULL` — partial index for active-only queries

#### Unique Constraints

- `slug`

#### Foreign Keys

- `author_user_id → auth.users.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT where `status = 'published'` and `deleted_at IS NULL`. INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None.

---

### `guides`

**Phase:** V1
**Purpose:** Structured city guides that surface curated recommendations, context, and editorial narrative for a specific city on the platform.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| city_id | uuid | NO | — | FK → cities ON DELETE CASCADE; one guide per city at V1 |
| title | text | NO | — | Guide headline (e.g., "The BLACQList Guide to Atlanta") |
| slug | text | NO | — | UNIQUE; URL-safe guide identifier |
| intro | text | YES | — | Introductory paragraph displayed above guide sections |
| cover_image_path | text | YES | — | Supabase Storage path |
| status | text | NO | 'draft' | CHECK IN ('draft','published','archived') |
| published_at | timestamptz | YES | — | Set when status first transitions to 'published' |
| created_by | uuid | YES | — | FK → auth.users ON DELETE SET NULL |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX guides_slug_idx ON guides (slug)`
- `CREATE INDEX guides_city_id_idx ON guides (city_id)` — look up guide for a city page
- `CREATE INDEX guides_status_idx ON guides (status)` — published guides list

#### Unique Constraints

- `slug`

#### Foreign Keys

- `city_id → cities.id ON DELETE CASCADE`
- `created_by → auth.users.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT where `status = 'published'`. INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None — created by editorial team per city at V1 launch.

---

### `guide_sections`

**Phase:** V1
**Purpose:** Ordered content sections within a city guide, each with a heading and Markdown body.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| guide_id | uuid | NO | — | FK → guides ON DELETE CASCADE |
| heading | text | NO | — | Section heading displayed on the guide page |
| body_md | text | NO | — | Section content in Markdown |
| display_order | integer | NO | 0 | Sort order within the parent guide |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX guide_sections_guide_id_display_order_idx ON guide_sections (guide_id, display_order)` — ordered fetch of all sections for a guide

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `guide_id → guides.id ON DELETE CASCADE`

#### RLS Note

Access controlled through parent `guides` row — public SELECT if parent guide is published. INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None.

---

### `featured_slots`

**Phase:** V1
**Purpose:** Controls which listings appear in editorially curated featured positions across key pages (homepage, city pages, category pages, search results).
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| placement_context | text | NO | — | CHECK IN ('homepage','city_page','category_page','search_results') |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| display_order | integer | NO | 0 | Sort position within the placement context |
| starts_at | timestamptz | NO | — | When this featured slot becomes active |
| ends_at | timestamptz | YES | — | null = no expiry (permanent editorial feature) |
| is_active | boolean | NO | true | Admin toggle to deactivate without deleting |
| created_by | uuid | YES | — | FK → auth.users ON DELETE SET NULL |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX featured_slots_context_active_idx ON featured_slots (placement_context, is_active, starts_at, ends_at)` — rendering query for active slots per context
- `CREATE INDEX featured_slots_listing_id_idx ON featured_slots (listing_id)` — find all featured placements for a listing

#### Unique Constraints

- None beyond PK — multiple featured slots may exist per context; rendering layer applies display_order

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`
- `created_by → auth.users.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT where `is_active = true` and `starts_at <= now()` and (`ends_at IS NULL` or `ends_at > now()`). INSERT/UPDATE/DELETE via service role only.

#### Seed Data

None.

---

### `sponsored_placements`

**Phase:** V1
**Purpose:** Tracks paid sponsored placement purchases by listing owners, including placement type, active period, and associated Stripe payment.
**Privacy:** Restricted — `stripe_payment_intent_id` is server-side only.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| placement_type | text | NO | — | CHECK IN ('featured_top','category_spotlight','city_spotlight','search_banner') |
| starts_at | timestamptz | NO | — | Placement active start |
| expires_at | timestamptz | YES | — | null = no expiry; scheduled job checks this daily |
| is_active | boolean | NO | true | Auto-set to false when expires_at passes |
| price_paid | numeric(10,2) | YES | — | Amount paid at purchase; null for admin-granted placements |
| stripe_payment_intent_id | text | YES | — | Stripe PaymentIntent ID; null for comp placements |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX sponsored_placements_listing_id_idx ON sponsored_placements (listing_id)` — fetch placements for a listing
- `CREATE INDEX sponsored_placements_active_expires_idx ON sponsored_placements (is_active, expires_at)` — daily expiry job query

#### Unique Constraints

- None beyond PK — a listing may have multiple sponsored placements of different types

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`authenticated` SELECT where `listing_id` maps to a listing owned by `auth.uid()`. INSERT via service role only (checkout flow). UPDATE/DELETE via service role only.

#### Seed Data

None.

---

## Section 8: Receipts and Spend

Receipt and spend tables capture the data powering the dollar-flow visualization. These tables contain the most sensitive per-user financial data on the platform. All access is heavily restricted. See the security and privacy plan for the complete access model.

---

### `receipt_uploads`

**Phase:** V2
**Purpose:** Stores metadata and OCR-extracted fields for receipt photos uploaded by supporters to record their spend at Black-owned businesses.
**Privacy:** PII: `image_path` is a private storage path — accessible only to the uploading user via a 15-minute signed URL generated server-side. `parsed_merchant_name` and `parsed_amount` are financial behavior data scoped to the user.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → auth.users ON DELETE CASCADE |
| image_path | text | NO | — | Storage path in private `receipts` bucket; never store signed URL |
| ocr_raw | jsonb | YES | — | Raw OCR API response; null until processing completes |
| parsed_amount | numeric(10,2) | YES | — | OCR-extracted transaction amount |
| parsed_merchant_name | text | YES | — | OCR-extracted merchant name |
| parsed_date | date | YES | — | OCR-extracted transaction date |
| status | text | NO | 'uploaded' | CHECK IN ('uploaded','processing','parsed','confirmed','rejected') |
| spend_event_id | uuid | YES | — | FK → spend_events; set after a confirmed spend_event is created from this receipt |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX receipt_uploads_user_id_idx ON receipt_uploads (user_id)` — user receipt history
- `CREATE INDEX receipt_uploads_status_idx ON receipt_uploads (status)` — processing queue

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `user_id → auth.users.id ON DELETE CASCADE`
- `spend_event_id → spend_events.id ON DELETE SET NULL`

#### RLS Note

`authenticated` SELECT, INSERT, DELETE where `user_id = auth.uid()` only. No admin routine access — admin access to individual receipts requires a documented escalation process (defined before V2 launch per security plan).

#### Seed Data

None.

---

### `spend_events`

**Phase:** V2
**Purpose:** Records an individual spend transaction attributed to a Black-owned business, sourced from a receipt upload, a marketplace order, or manual entry. Powers the dollar-flow visualization in aggregate.
**Privacy:** PII: `user_id` combined with `amount` and `spend_date` constitutes financial behavior data. `user_id` is never included in any aggregate query or API response. `aggregate_opt_out` must be respected in all aggregate computations.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → auth.users ON DELETE CASCADE |
| listing_id | uuid | YES | — | FK → listings ON DELETE SET NULL; null for unattributed manual entries |
| amount | numeric(10,2) | NO | — | Transaction amount in USD; CHECK (amount > 0) |
| currency | text | NO | 'USD' | ISO 4217 |
| spend_date | date | NO | — | Date of the actual transaction |
| category_id | uuid | YES | — | FK → categories; inferred by OCR or product category |
| source | text | NO | 'manual' | CHECK IN ('receipt','manual','order','import') |
| aggregate_opt_out | boolean | NO | false | true = exclude this event from all community aggregate computations |
| receipt_upload_id | uuid | YES | — | FK → receipt_uploads ON DELETE SET NULL; null for order-sourced and manual entries |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX spend_events_user_id_idx ON spend_events (user_id)` — user spend history
- `CREATE INDEX spend_events_listing_id_idx ON spend_events (listing_id)` — aggregate by business
- `CREATE INDEX spend_events_spend_date_idx ON spend_events (spend_date)` — date-range aggregate queries
- `CREATE INDEX spend_events_aggregate_opt_out_idx ON spend_events (aggregate_opt_out) WHERE aggregate_opt_out = false` — partial index for efficient aggregate queries that respect opt-out

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `user_id → auth.users.id ON DELETE CASCADE`
- `listing_id → listings.id ON DELETE SET NULL`
- `category_id → categories.id ON DELETE SET NULL`
- `receipt_upload_id → receipt_uploads.id ON DELETE SET NULL`

#### RLS Note

`authenticated` SELECT, INSERT, DELETE where `user_id = auth.uid()` only. Raw rows are never passed to the frontend or included in any public aggregate response. Aggregate computations run server-side via service role with opt-out filtering applied in the query.

#### Seed Data

None.

---

### `community_impact_daily`

**Phase:** V2
**Purpose:** Pre-aggregated daily snapshots of community spend by city and category, used to power the impact dashboard and dollar-flow map without exposing individual transactions. No user FKs — this is anonymized aggregate data only.
**Privacy:** None — this table contains no PII. It is public aggregate data. Individual users cannot be identified from these rows.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| snapshot_date | date | NO | — | The date this aggregate covers |
| city_id | uuid | YES | — | FK → cities ON DELETE CASCADE; null = nationwide aggregate |
| category_id | uuid | YES | — | FK → categories ON DELETE SET NULL; null = all-category aggregate |
| total_spend | numeric(14,2) | NO | 0 | Sum of qualifying spend_events.amount for this period/city/category |
| transaction_count | integer | NO | 0 | Count of qualifying spend_events rows |
| unique_businesses | integer | NO | 0 | Count of distinct listing_id values in the aggregate |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX community_impact_daily_snapshot_city_cat_idx ON community_impact_daily (snapshot_date, city_id, category_id)` — prevents duplicate snapshots
- `CREATE INDEX community_impact_daily_snapshot_date_idx ON community_impact_daily (snapshot_date DESC)` — date-range queries for impact charts

#### Unique Constraints

- `(snapshot_date, city_id, category_id)` — one snapshot per date per city+category combination

#### Foreign Keys

- `city_id → cities.id ON DELETE CASCADE`
- `category_id → categories.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT — this is public aggregate data. INSERT via service role only (nightly aggregation job). No UPDATE or DELETE permitted from application code.

#### Seed Data

None — populated by the nightly aggregation job.

---

## Section 9: Flow Map

Flow map tables support the V3 dollar-flow visualization, which shows how money moves through the Black economy at the city and category level. These tables contain no user identifiers. All data is computed from pre-aggregated spend data. The minimum 5-contributor threshold is enforced at the service layer before any edge is written to `flow_edges` or `anonymized_community_nodes`.

---

### `flow_nodes`

**Phase:** V3+
**Purpose:** Nodes in the dollar-flow graph, representing a business, category, or city. Stores computed flow metrics for rendering the visualization.
**Privacy:** None — nodes represent businesses and categories, not individuals.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | YES | — | FK → listings ON DELETE CASCADE; null for category and city nodes |
| city_id | uuid | YES | — | FK → cities ON DELETE CASCADE; set for city-type nodes |
| category_id | uuid | YES | — | FK → categories ON DELETE SET NULL; set for category-type nodes |
| node_type | text | NO | — | CHECK IN ('business','category','city') |
| total_inflow | numeric(14,2) | NO | 0 | Total spend dollars flowing into this node |
| total_outflow | numeric(14,2) | NO | 0 | Total spend dollars flowing out of this node |
| node_weight | numeric(10,6) | NO | 0 | Normalized weight for visualization sizing (0–1) |
| last_computed_at | timestamptz | YES | — | Timestamp of last computation; null = never computed |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX flow_nodes_listing_id_idx ON flow_nodes (listing_id)` — look up node for a given listing
- `CREATE INDEX flow_nodes_city_id_idx ON flow_nodes (city_id)` — fetch all nodes in a city
- `CREATE INDEX flow_nodes_node_type_idx ON flow_nodes (node_type)` — filter by node type

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`
- `city_id → cities.id ON DELETE CASCADE`
- `category_id → categories.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT — public visualization data. INSERT/UPDATE via service role only (computation job).

#### Seed Data

None — populated by the V3 flow computation job.

---

### `flow_edges`

**Phase:** V3+
**Purpose:** Directed edges between flow nodes representing money movement from source to target, with aggregate volume and computed weight for the visualization.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| source_node_id | uuid | NO | — | FK → flow_nodes ON DELETE CASCADE |
| target_node_id | uuid | NO | — | FK → flow_nodes ON DELETE CASCADE |
| total_amount | numeric(14,2) | NO | 0 | Aggregate spend flowing along this edge for the period |
| transaction_count | integer | NO | 0 | Count of transactions represented; must be ≥ 5 to exist |
| edge_weight | numeric(10,6) | NO | 0 | Normalized weight for edge thickness (0–1) |
| period_start | date | NO | — | Start of the period this edge covers |
| period_end | date | NO | — | End of the period this edge covers |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX flow_edges_source_target_period_idx ON flow_edges (source_node_id, target_node_id, period_start)`
- `CREATE INDEX flow_edges_source_node_id_idx ON flow_edges (source_node_id)` — outbound edges from a node
- `CREATE INDEX flow_edges_target_node_id_idx ON flow_edges (target_node_id)` — inbound edges to a node

#### Unique Constraints

- `(source_node_id, target_node_id, period_start)` — one edge per direction per period

#### Foreign Keys

- `source_node_id → flow_nodes.id ON DELETE CASCADE`
- `target_node_id → flow_nodes.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT — public visualization data. INSERT/UPDATE via service role only. The 5-contributor minimum is enforced in the service layer before writing any edge record.

#### Seed Data

None.

---

### `flow_map_snapshots`

**Phase:** V3+
**Purpose:** Pre-serialized graph payloads for the flow map visualization, computed periodically to avoid expensive real-time graph computation on each page load.
**Privacy:** None — contains no user data.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| snapshot_date | date | NO | — | The date this snapshot covers |
| city_id | uuid | YES | — | FK → cities ON DELETE CASCADE; null = national snapshot |
| graph_json | jsonb | NO | — | Precomputed graph payload; shape: {nodes: [...], edges: [...]} |
| node_count | integer | NO | — | Number of nodes in the snapshot |
| edge_count | integer | NO | — | Number of edges in the snapshot |
| computation_duration_ms | integer | YES | — | Milliseconds taken to compute; null if not measured |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX flow_map_snapshots_snapshot_date_city_id_idx ON flow_map_snapshots (snapshot_date DESC, city_id)` — fetch latest snapshot for a city

#### Unique Constraints

- None beyond PK — multiple snapshots may exist per date/city (old snapshots retained for comparison)

#### Foreign Keys

- `city_id → cities.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT — the visualization is publicly accessible. INSERT via service role only (computation job).

#### Seed Data

None.

---

### `anonymized_community_nodes`

**Phase:** V3+
**Purpose:** City- and category-level aggregate nodes for the community visualization layer. No user FKs. Enforces the minimum 5-contributor threshold before a node is published.
**Privacy:** None — strictly aggregate data. No individual can be identified from these rows.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| city_id | uuid | NO | — | FK → cities ON DELETE CASCADE |
| category_id | uuid | YES | — | FK → categories ON DELETE SET NULL; null = all-category city node |
| total_spend | numeric(14,2) | NO | — | Aggregate spend for this city/category/period |
| transaction_count | integer | NO | — | Count of transactions; must be ≥ 5 to be written |
| contributing_user_count | integer | NO | — | Distinct user count; minimum 5 enforced at service layer before insert |
| period_start | date | NO | — | Period start date |
| period_end | date | NO | — | Period end date |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX anonymized_community_nodes_city_period_idx ON anonymized_community_nodes (city_id, period_start, period_end)` — city-scoped period queries

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `city_id → cities.id ON DELETE CASCADE`
- `category_id → categories.id ON DELETE SET NULL`

#### RLS Note

`anon` and `authenticated` SELECT — public aggregate data. INSERT via service role only. The service layer must confirm `contributing_user_count >= 5` before writing any row.

#### Seed Data

None.

---

### `vendor_relationships`

**Phase:** V3+
**Purpose:** Inferred relationships between vendor listings based on co-shopping behavior, event co-participation, or supply chain signals, used to power the vendor network layer of the flow map.
**Privacy:** None — relationships are between business entities, not users.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| vendor_a_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| vendor_b_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| relationship_type | text | NO | — | CHECK IN ('co_shopped','supplier_inferred','event_coparticipant') |
| strength_score | numeric(5,4) | NO | 0 | Computed relationship strength (0–1); higher = stronger signal |
| inferred_from | text | NO | — | Describes the signal source (e.g., 'spend_events overlap Q1 2026') |
| period_start | date | NO | — | Start of the analysis period |
| period_end | date | NO | — | End of the analysis period |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX vendor_relationships_vendor_a_idx ON vendor_relationships (vendor_a_id)` — relationships for a given vendor
- `CREATE INDEX vendor_relationships_vendor_b_idx ON vendor_relationships (vendor_b_id)` — reverse direction lookup

#### Unique Constraints

- None beyond PK — multiple relationship types may exist between the same pair

#### Foreign Keys

- `vendor_a_id → listings.id ON DELETE CASCADE`
- `vendor_b_id → listings.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT — business relationship data is public. INSERT/UPDATE via service role only (inference job).

#### Seed Data

None.

---

## Section 10: Events and Jobs

These two tables extend event and job listings with many-to-many relationships to other listings. Extension detail tables (`listing_details_event`, `listing_details_job`) are covered in Part A.

---

### `event_vendors`

**Phase:** V2
**Purpose:** Associates vendor listings with an event listing, allowing event pages to surface participating vendors with role labels and display ordering.
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| event_listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE; must be entity_type = 'event' |
| vendor_listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE; the participating vendor |
| role | text | YES | — | Vendor's role at the event (e.g., 'vendor','food','art','music'); free text |
| display_order | integer | NO | 0 | Sort order in the vendor grid on the event page |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX event_vendors_event_vendor_idx ON event_vendors (event_listing_id, vendor_listing_id)`
- `CREATE INDEX event_vendors_event_listing_id_idx ON event_vendors (event_listing_id)` — fetch all vendors for an event
- `CREATE INDEX event_vendors_vendor_listing_id_idx ON event_vendors (vendor_listing_id)` — find all events for a vendor

#### Unique Constraints

- `(event_listing_id, vendor_listing_id)` — a vendor can participate in an event only once

#### Foreign Keys

- `event_listing_id → listings.id ON DELETE CASCADE`
- `vendor_listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT (event vendor associations are public). `authenticated` INSERT/UPDATE/DELETE where `event_listing_id` maps to a listing owned by `auth.uid()`. Admin via service role.

#### Seed Data

None.

---

### `event_sponsors`

**Phase:** V2
**Purpose:** Sponsors for an event listing, which may or may not have their own BLACQList Page. Supports tiered sponsor display (title, gold, silver, community).
**Privacy:** None

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| event_listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| sponsor_name | text | NO | — | Display name of the sponsor |
| sponsor_url | text | YES | — | Sponsor website URL; null if no website |
| logo_path | text | YES | — | Supabase Storage path for sponsor logo; null if no logo provided |
| tier | text | YES | — | CHECK IN ('title','gold','silver','community'); null = untiered |
| display_order | integer | NO | 0 | Sort order within each tier |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX event_sponsors_event_listing_id_idx ON event_sponsors (event_listing_id)` — fetch all sponsors for an event

#### Unique Constraints

- None beyond PK — same sponsor name may appear at different tiers across events

#### Foreign Keys

- `event_listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`anon` and `authenticated` SELECT (sponsor data is public). `authenticated` INSERT/UPDATE/DELETE where `event_listing_id` maps to a listing owned by `auth.uid()`. Admin via service role.

#### Seed Data

None.

---

## Section 11: Analytics

Analytics tables are append-only event stores and daily rollup tables. Application code never UPDATEs or DELETEs rows in these tables — they are written once and read for reporting. Raw event tables are server-insert only; no client-side writes are permitted.

---

### `analytics_events`

**Phase:** MVP
**Purpose:** Append-only log of every trackable user interaction on the platform — page views, CTA clicks, saves, shares, search interactions, and admin events. Server-written only.
**Privacy:** `user_id` is nullable (null for anonymous events). `ip_address` must be hashed or anonymized before storage — never store a raw IP. `user_agent` is stored for bot detection only.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| event_name | text | NO | — | One of the 45 defined platform event names (e.g., 'listing_view', 'cta_click', 'save_added', 'search_performed'); validated at service layer |
| entity_type | text | YES | — | Type of entity the event is about (e.g., 'listing', 'collection', 'article') |
| entity_id | uuid | YES | — | ID of the entity; combined with entity_type for lookups |
| user_id | uuid | YES | — | FK → auth.users; null for anonymous events; SET NULL on user delete |
| session_id | text | YES | — | Pseudonymous session identifier; not a Supabase session token |
| properties | jsonb | NO | '{}' | Event-specific properties (e.g., {cta_type: 'book', referrer: 'search'}) |
| ip_address | text | YES | — | Hashed IP address (SHA-256 one-way hash); never store raw IP |
| user_agent | text | YES | — | Raw user agent string for bot detection |
| referrer | text | YES | — | HTTP Referer header value |
| created_at | timestamptz | NO | now() | Insertion timestamp; this table is ordered by created_at |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX analytics_events_event_name_idx ON analytics_events (event_name)` — filter by event type
- `CREATE INDEX analytics_events_entity_idx ON analytics_events (entity_type, entity_id)` — all events for a specific entity
- `CREATE INDEX analytics_events_user_id_idx ON analytics_events (user_id)` — user-scoped analytics (admin view)
- `CREATE INDEX analytics_events_created_at_idx ON analytics_events (created_at DESC)` — time-range queries

#### Unique Constraints

- None beyond PK — events are never deduplicated at the DB layer

#### Foreign Keys

- `user_id → auth.users.id ON DELETE SET NULL`

#### RLS Note

INSERT via service role only (server-side Server Actions). `authenticated` SELECT where `entity_id` maps to a listing owned by `auth.uid()` (owner analytics). Admin SELECT via service role. No client-side reads of the raw events table.

#### Seed Data

None.

---

### `search_events`

**Phase:** MVP
**Purpose:** Records each search query with filters applied, result count, and whether the user clicked a result — used to improve search relevance and surface popular queries.
**Privacy:** `user_id` is nullable. Query text is stored as-is; no PII scrubbing is applied at the DB layer — the service layer must avoid logging searches that contain email addresses or phone numbers (detected by pattern).

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| query | text | NO | — | The search string entered by the user |
| filters | jsonb | NO | '{}' | Active filter state at time of search (e.g., {city: 'atlanta', category: 'food'}) |
| result_count | integer | NO | — | Number of results returned |
| clicked_result_position | integer | YES | — | 1-based position of the result the user clicked; null if no click |
| clicked_listing_id | uuid | YES | — | The listing that was clicked; null if no click |
| user_id | uuid | YES | — | FK → auth.users; null for anonymous searches |
| city_id | uuid | YES | — | FK → cities; the city context in which the search was performed |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX search_events_query_idx ON search_events (query)` — popular query analysis
- `CREATE INDEX search_events_created_at_idx ON search_events (created_at DESC)` — time-range queries
- `CREATE INDEX search_events_city_id_idx ON search_events (city_id)` — city-scoped search analysis

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `clicked_listing_id → listings.id ON DELETE SET NULL`
- `user_id → auth.users.id ON DELETE SET NULL`
- `city_id → cities.id ON DELETE SET NULL`

#### RLS Note

INSERT via service role only. SELECT via service role only (admin analytics). No owner-facing access to search events.

#### Seed Data

None.

---

### `entity_analytics_daily`

**Phase:** MVP
**Purpose:** Daily rollup of key metrics for each listing (page views, CTA clicks, saves, shares, search impressions) — queried by the owner analytics dashboard without touching the raw `analytics_events` table.
**Privacy:** None — aggregated metrics with no user identifiers.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| snapshot_date | date | NO | — | The date this rollup covers |
| page_views | integer | NO | 0 | Total page views for this listing on this date |
| cta_clicks | integer | NO | 0 | Total CTA button clicks |
| saves | integer | NO | 0 | Net saves added (new saves minus unsaves for the day) |
| shares | integer | NO | 0 | Total share events |
| search_impressions | integer | NO | 0 | Times this listing appeared in search results |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated when rollup is recomputed |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX entity_analytics_daily_listing_date_idx ON entity_analytics_daily (listing_id, snapshot_date)`
- `CREATE INDEX entity_analytics_daily_listing_id_idx ON entity_analytics_daily (listing_id)` — all-time metrics for a listing
- `CREATE INDEX entity_analytics_daily_snapshot_date_idx ON entity_analytics_daily (snapshot_date DESC)` — date-range queries

#### Unique Constraints

- `(listing_id, snapshot_date)` — one row per listing per day

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`authenticated` SELECT where `listing_id` maps to a listing owned by `auth.uid()`. INSERT/UPDATE via service role only (nightly rollup job).

#### Seed Data

None.

---

### `platform_analytics_daily`

**Phase:** V1
**Purpose:** Daily platform-wide aggregate metrics (total listings, searches, saves, page views) used by admin dashboards and public impact metrics — one row per day.
**Privacy:** None — no user identifiers; purely platform-level counts.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| snapshot_date | date | NO | — | UNIQUE; the date this snapshot covers |
| total_listings | integer | NO | 0 | Total listings in the platform (all statuses, not deleted) |
| total_published_listings | integer | NO | 0 | Listings with status = 'published' |
| total_searches | integer | NO | 0 | Total search_events records for this date |
| total_saves | integer | NO | 0 | Total saves records created on this date |
| total_page_views | integer | NO | 0 | Total listing page_view analytics_events for this date |
| total_claimed_listings | integer | NO | 0 | Listings with trust_tier = 'claimed' or higher |
| new_listings | integer | NO | 0 | Listings created on this date |
| new_users | integer | NO | 0 | auth.users records created on this date |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE UNIQUE INDEX platform_analytics_daily_snapshot_date_idx ON platform_analytics_daily (snapshot_date DESC)`

#### Unique Constraints

- `snapshot_date` — one row per day

#### Foreign Keys

- None

#### RLS Note

`anon` SELECT for a subset of fields (public impact metrics). Admin SELECT all fields via service role. INSERT/UPDATE via service role only (nightly rollup job).

#### Seed Data

None.

---

## Section 12: AI

AI tables support the V2 suggestion engine, generation request logging, content moderation flagging, and V3 autonomous agent runs. All AI operations are server-side only. No AI model output is written directly to user-facing records without a human-in-the-loop step for moderation flags.

---

### `ai_suggestions`

**Phase:** V2
**Purpose:** Stores AI-generated optimization suggestions for listing owners (e.g., incomplete description, missing CTA, inaccurate category) with lifecycle tracking from generation to response.
**Privacy:** None — suggestions reference listing IDs, not user IDs directly.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| listing_id | uuid | NO | — | FK → listings ON DELETE CASCADE |
| suggestion_type | text | NO | — | CHECK IN ('description_quality','category_accuracy','cta_completeness','image_missing','hours_missing') |
| content | text | NO | — | The suggestion text shown to the owner |
| confidence_score | numeric(5,4) | YES | — | Model confidence (0–1); null if not provided by the model |
| status | text | NO | 'pending' | CHECK IN ('pending','shown','accepted','dismissed','expired') |
| shown_at | timestamptz | YES | — | When the suggestion was first surfaced to the owner |
| responded_at | timestamptz | YES | — | When the owner accepted or dismissed |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX ai_suggestions_listing_id_status_idx ON ai_suggestions (listing_id, status)` — fetch active suggestions for a listing's dashboard
- `CREATE INDEX ai_suggestions_status_idx ON ai_suggestions (status)` — admin review of pending suggestions

#### Unique Constraints

- None beyond PK — multiple suggestions of the same type may exist for a listing over time

#### Foreign Keys

- `listing_id → listings.id ON DELETE CASCADE`

#### RLS Note

`authenticated` SELECT where `listing_id` maps to a listing owned by `auth.uid()`. UPDATE (for accepting/dismissing) where same ownership check applies. INSERT via service role only (AI suggestion job).

#### Seed Data

None.

---

### `ai_generation_requests`

**Phase:** V2
**Purpose:** Logs every request made to an AI model (description generation, category suggestion, content enhancement) for cost tracking, latency monitoring, and debugging.
**Privacy:** None — contains model names and token counts, not user content. The `user_id` FK is present for attribution but this table does not store prompt content (logged separately in structured logs).

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES | — | FK → auth.users ON DELETE SET NULL; null for system-triggered requests |
| listing_id | uuid | YES | — | FK → listings ON DELETE SET NULL; null for non-listing requests |
| model | text | NO | — | Model identifier (e.g., 'claude-sonnet-4-6') |
| prompt_type | text | NO | — | Category of request (e.g., 'description_generation', 'category_suggestion') |
| input_tokens | integer | NO | — | Input token count for cost tracking |
| output_tokens | integer | NO | — | Output token count |
| latency_ms | integer | YES | — | Round-trip latency in milliseconds; null if not measured |
| status | text | NO | 'success' | CHECK IN ('success','error','timeout') |
| error_message | text | YES | — | Error details on failure; null on success |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX ai_generation_requests_user_id_idx ON ai_generation_requests (user_id)` — per-user request history
- `CREATE INDEX ai_generation_requests_model_created_at_idx ON ai_generation_requests (model, created_at DESC)` — cost aggregation by model
- `CREATE INDEX ai_generation_requests_status_idx ON ai_generation_requests (status)` — error rate monitoring

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `user_id → auth.users.id ON DELETE SET NULL`
- `listing_id → listings.id ON DELETE SET NULL`

#### RLS Note

No SELECT for `anon` or `authenticated` — this is an internal operational log. Admin SELECT via service role only.

#### Seed Data

None.

---

### `ai_moderation_flags`

**Phase:** V2
**Purpose:** AI-generated content moderation flags for listings, reviews, profiles, or corrections that may violate platform policy, routed to the admin moderation queue for human review.
**Privacy:** None — flags reference entity IDs, not user PII.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| entity_type | text | NO | — | CHECK IN ('listing','review','profile','correction') |
| entity_id | uuid | NO | — | ID of the flagged entity; not a formal FK (polymorphic) |
| flag_reason | text | NO | — | Description of the potential policy violation |
| confidence_score | numeric(5,4) | YES | — | Model confidence (0–1); null if model does not provide it |
| status | text | NO | 'pending' | CHECK IN ('pending','reviewed','dismissed','actioned') |
| reviewed_by | uuid | YES | — | FK → auth.users ON DELETE SET NULL; the admin who reviewed this flag |
| reviewed_at | timestamptz | YES | — | When the admin completed review |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX ai_moderation_flags_entity_idx ON ai_moderation_flags (entity_type, entity_id)` — flags for a specific entity
- `CREATE INDEX ai_moderation_flags_status_idx ON ai_moderation_flags (status)` — admin moderation queue

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `reviewed_by → auth.users.id ON DELETE SET NULL`

#### RLS Note

No access for `anon` or `authenticated`. Admin SELECT and UPDATE via service role only. INSERT via service role only (AI moderation job).

#### Seed Data

None.

---

### `ai_agent_runs`

**Phase:** V3+
**Purpose:** Logs autonomous AI agent executions (curation agents, optimization agents, moderation agents), tracking status, scope, and outcome for audit and debugging.
**Privacy:** None — contains operational metadata, not user data.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_type | text | NO | — | CHECK IN ('curation','optimization','moderation') |
| triggered_by | text | NO | — | CHECK IN ('schedule','event','manual') |
| input_context | jsonb | YES | — | Parameters passed to the agent run; null for parameterless runs |
| output_summary | text | YES | — | Human-readable summary of what the agent did; null until completed |
| listings_affected | integer | NO | 0 | Count of listings modified or acted on |
| status | text | NO | 'running' | CHECK IN ('running','completed','failed') |
| started_at | timestamptz | NO | now() | — |
| completed_at | timestamptz | YES | — | null until run completes or fails |
| error_message | text | YES | — | Error details on failure; null on success |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX ai_agent_runs_agent_type_status_idx ON ai_agent_runs (agent_type, status)` — running agent monitoring
- `CREATE INDEX ai_agent_runs_started_at_idx ON ai_agent_runs (started_at DESC)` — recent run history

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- None

#### RLS Note

No access for `anon` or `authenticated`. Admin SELECT via service role only. INSERT/UPDATE via service role only (agent infrastructure).

#### Seed Data

None.

---

## Section 13: Admin

Admin tables are operational infrastructure. They are not exposed to any non-admin user and contain no publicly readable data. The `admin_audit_log` is immutable by design — no application code path permits UPDATE or DELETE on it.

---

### `admin_audit_log`

**Phase:** MVP
**Purpose:** Immutable record of every admin mutation on the platform — approvals, rejections, status changes, role modifications, suspensions, and system operations. Required for compliance. Retained indefinitely.
**Privacy:** Restricted — `before_state` and `after_state` snapshots are sanitized before storage (verification doc paths redacted, no raw credentials). `admin_user_id` FK is SET NULL on user deletion to preserve the log record.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| admin_user_id | uuid | YES | — | FK → auth.users ON DELETE SET NULL; SET NULL preserves log on admin account deletion |
| action | text | NO | — | One of the defined action enum values (see security plan Section 9) |
| target_table | text | NO | — | The table affected by the action |
| target_id | uuid | YES | — | PK of the affected record; null for platform-level actions |
| before_state | jsonb | YES | — | Sanitized snapshot of the record before the change; null for INSERT operations |
| after_state | jsonb | YES | — | Sanitized snapshot of the record after the change; null for DELETE operations |
| ip_address | text | YES | — | IP address of the admin request extracted server-side |
| user_agent | text | YES | — | Browser user agent of the admin session |
| created_at | timestamptz | NO | now() | — |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX admin_audit_log_admin_user_id_idx ON admin_audit_log (admin_user_id)` — admin's own history view
- `CREATE INDEX admin_audit_log_target_table_target_id_idx ON admin_audit_log (target_table, target_id)` — all actions on a specific record
- `CREATE INDEX admin_audit_log_action_idx ON admin_audit_log (action)` — filter by action type
- `CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC)` — chronological log view

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `admin_user_id → auth.users.id ON DELETE SET NULL`

#### RLS Note

INSERT via service role only. SELECT via service role only — Admins see their own entries; Super Admin sees all entries (enforced at service layer, not RLS). No UPDATE or DELETE from any role — enforced by a DB-level trigger that rejects modifications.

#### Seed Data

None.

---

### `moderation_queue`

**Phase:** MVP
**Purpose:** Central queue for all items requiring admin review — claims, corrections, flagged reviews, flagged listings, and verification submissions. Supports assignment, prioritization, and resolution tracking.
**Privacy:** None — references entity IDs only; underlying entity records contain any PII.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| queue_type | text | NO | — | CHECK IN ('claim','correction','review','flagged_listing','verification') |
| entity_id | uuid | NO | — | ID of the entity requiring review |
| entity_type | text | NO | — | The table containing the entity (e.g., 'listings', 'reviews', 'claims') |
| status | text | NO | 'pending' | CHECK IN ('pending','assigned','resolved','dismissed') |
| assigned_to | uuid | YES | — | FK → auth.users ON DELETE SET NULL; the admin this item is assigned to |
| priority | integer | NO | 0 | Higher value = higher priority; used for queue sort ordering |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |
| resolved_at | timestamptz | YES | — | Set when status transitions to 'resolved' or 'dismissed' |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX moderation_queue_status_type_priority_idx ON moderation_queue (status, queue_type, priority DESC)` — admin queue view with priority ordering
- `CREATE INDEX moderation_queue_assigned_to_idx ON moderation_queue (assigned_to)` — items assigned to a specific admin
- `CREATE INDEX moderation_queue_entity_idx ON moderation_queue (entity_type, entity_id)` — check queue status for a specific entity

#### Unique Constraints

- None beyond PK — the same entity may appear multiple times in the queue (e.g., a listing flagged, resolved, then flagged again)

#### Foreign Keys

- `assigned_to → auth.users.id ON DELETE SET NULL`

#### RLS Note

No access for `anon` or `authenticated`. Admin SELECT and UPDATE via service role only. INSERT via service role only (automated on flag/submit events and admin actions).

#### Seed Data

None.

---

## Section 14: Sponsorships

---

### `sponsor_campaigns`

**Phase:** V3+
**Purpose:** Tracks brand sponsorship campaigns from organizations wanting platform-level visibility, with targeting options by city and category and lifecycle state management.
**Privacy:** None — sponsor identity and campaign configuration; no user PII.

#### Fields

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| sponsor_name | text | NO | — | Public name of the sponsoring organization |
| sponsor_url | text | YES | — | Sponsor website URL for attribution links |
| logo_path | text | YES | — | Supabase Storage path for sponsor logo |
| target_city_ids | uuid[] | YES | — | Array of city UUIDs to target; null = nationwide |
| target_category_ids | uuid[] | YES | — | Array of category UUIDs to target; null = all categories |
| budget | numeric(10,2) | YES | — | Total campaign budget in USD; null for flat-rate campaigns |
| starts_at | timestamptz | NO | — | Campaign activation timestamp |
| ends_at | timestamptz | YES | — | Campaign expiry; null = no end date |
| status | text | NO | 'draft' | CHECK IN ('draft','active','paused','completed') |
| created_by | uuid | YES | — | FK → auth.users ON DELETE SET NULL; the admin who created the campaign |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | Trigger-updated |

#### Indexes

- `PRIMARY KEY (id)`
- `CREATE INDEX sponsor_campaigns_status_starts_ends_idx ON sponsor_campaigns (status, starts_at, ends_at)` — active campaign lookup for rendering

#### Unique Constraints

- None beyond PK

#### Foreign Keys

- `created_by → auth.users.id ON DELETE SET NULL`

#### RLS Note

No access for `anon` or `authenticated`. Admin SELECT and full lifecycle management via service role only.

#### Seed Data

None.

---

## Section 15: MVP Tables Only

This section is the first-ticket priority list for engineers starting the MVP migration sprint. Tables are ordered by dependency — tables with no foreign key dependencies come first, then tables that depend on them, then junction and child tables, then operational tables. Build them in this order to avoid FK violations during migration.

The 21 MVP tables cover every capability required to: seed the platform with business listings, allow supporters to create accounts and save listings, allow owners to claim and manage listings, support admin moderation, and record analytics events.

| Priority | Table | Domain Section | Purpose |
|---|---|---|---|
| 1 | `states` | Section 3 (Part A) | Reference table for US states; no dependencies |
| 2 | `cities` | Section 3 (Part A) | City/metro reference with slugs; depends on states |
| 3 | `categories` | Section 3 (Part A) | Hierarchical category tree; self-referencing FK |
| 4 | `listings` | Section 4 (Part A) | Base entity table; depends on cities, categories |
| 5 | `listing_details_business` | Section 5 (Part A) | Business-specific fields; one-to-one with listings |
| 6 | `services` | Section 5 (Part A) | Service offerings; child of listings |
| 7 | `media_attachments` | Section 6 (Part A) | Polymorphic media store; child of listings and products |
| 8 | `listing_hours` | Section 6 (Part A) | Structured hours rows; child of listings |
| 9 | `listing_links` | Section 6 (Part A) | Social and URL links; child of listings |
| 10 | `profiles` | Section 1 (Part A) | User display names and preferences; mirrors auth.users |
| 11 | `user_roles` | Section 1 (Part A) | Role assignments; depends on auth.users |
| 12 | `claims` | Section 7 (Part A) | Ownership claim requests; depends on listings and auth.users |
| 13 | `saves` | Section 8 (Part A) | User-listing save associations; depends on listings and auth.users |
| 14 | `reviews` | Section 9 (Part A) | Star ratings and text reviews (data model built; workflow inactive until V1) |
| 15 | `collections` | Section 7 (this doc) | Admin-curated listing groups; depends on auth.users |
| 16 | `collection_items` | Section 7 (this doc) | Collection ↔ listing junction; depends on collections and listings |
| 17 | `analytics_events` | Section 11 (this doc) | Append-only platform event log; depends on auth.users |
| 18 | `search_events` | Section 11 (this doc) | Search query log; depends on cities, listings, auth.users |
| 19 | `entity_analytics_daily` | Section 11 (this doc) | Daily listing metric rollups; depends on listings |
| 20 | `admin_audit_log` | Section 13 (this doc) | Immutable admin action log; depends on auth.users |
| 21 | `moderation_queue` | Section 13 (this doc) | Admin review queue; depends on auth.users |

---

## Section 16: Later Tables

All tables deferred beyond MVP, grouped by release phase. Each deferral includes a rationale to ensure the reason is documented for future sprint planning.

---

### Beta

Beta tables are built when the platform expands beyond Business listings to support Professional, Creative, Event, and Job entity types, plus community-contributed corrections, review responses, and the tag system.

| Table | Domain Section | Purpose | Why Deferred |
|---|---|---|---|
| `listing_details_professional` | Section 5 (Part A) | Professional-specific fields (credentials, consultation type, bio) | Entity type not in MVP scope; business listings only at launch |
| `listing_details_creative` | Section 5 (Part A) | Creative-specific fields (portfolio statement, commission status, medium/genre) | Entity type not in MVP scope |
| `listing_details_event` | Section 5 (Part A) | Event-specific fields (date, time, ticket URL, ticket price) | Entity type not in MVP scope |
| `listing_details_job` | Section 5 (Part A) | Job-specific fields (role title, employment type, salary range, apply URL) | Entity type not in MVP scope |
| `corrections` | Section 9 (Part A) | Community-submitted corrections to listing information | Moderation workflow complexity; admin team capacity at MVP is focused on claims |
| `review_responses` | Section 9 (Part A) | Business owner responses to published reviews | Reviews themselves are V1; responses are a V1+ feature |
| `review_reports` | Section 9 (Part A) | User-submitted flags on published reviews | Review moderation workflow is V1; flag sub-system is Beta |
| `tags` | Section 10 (Part A) | Platform-managed tag reference table | Tags are a discovery enhancement; core search works without them at MVP |
| `listing_tags` | Section 10 (Part A) | Many-to-many junction between listings and tags | Depends on tags table |
| `neighborhoods` | Section 3 (Part A) | Sub-city neighborhood reference for location refinement | City-level granularity is sufficient at MVP; neighborhood refinement is a search enhancement |

---

### V1

V1 tables activate paid subscriptions, sponsored placements, editorial content, city guides, the verification workflow, and platform-level analytics.

| Table | Domain Section | Purpose | Why Deferred |
|---|---|---|---|
| `plans` | Section 6 (this doc) | Subscription tier definitions (Free, Standard, Premium) | Monetization is not in MVP scope; all listings start on free tier |
| `subscriptions` | Section 6 (this doc) | Listing-to-plan subscription state with Stripe sync | Depends on plans; requires Stripe Connect onboarding for owners |
| `sponsored_placements` | Section 7 (this doc) | Paid placement purchases with active period tracking | Requires a self-serve purchase flow; editorial featured slots are the MVP equivalent |
| `featured_slots` | Section 7 (this doc) | Admin-controlled editorial featured positions across pages | MVP uses a simpler `is_featured` boolean on listings; full slot management is V1 |
| `editorial_articles` | Section 7 (this doc) | Long-form editorial content published by the BLACQList team | Content team capacity; MVP focuses on directory, not editorial |
| `guides` | Section 7 (this doc) | Curated city guide pages | Requires editorial content investment; deferred until city coverage is sufficient |
| `guide_sections` | Section 7 (this doc) | Ordered content sections within city guides | Depends on guides |
| `verification_submissions` | Section 8 (Part A) | Document uploads and admin workflow for listing verification | Verification workflow has admin tooling complexity; data model columns exist on listings at MVP |
| `platform_analytics_daily` | Section 11 (this doc) | Daily platform-wide aggregate metrics for admin dashboards | Admin dashboard is not a launch requirement; basic Supabase Studio queries are sufficient at MVP |

---

### V2

V2 tables power the marketplace (orders, products, variants, coupons), receipt capture and spend tracking, service area management, AI optimization, and event-listing relationships.

| Table | Domain Section | Purpose | Why Deferred |
|---|---|---|---|
| `listing_details_vendor` | Section 5 (Part A) | Vendor-specific fields (Stripe Connect, storefront description, return policy) | Marketplace requires Stripe Connect; deferred until V2 payments infrastructure is built |
| `products` | Section 5 (Part A) | Product catalog for vendor storefronts | Marketplace feature; depends on listing_details_vendor |
| `product_variants` | Section 5 (Part A) | Size/color/option variants for products | Depends on products |
| `orders` | Section 6 (this doc) | Marketplace order records with payment and fulfillment state | Requires Stripe Connect and full checkout flow |
| `order_items` | Section 6 (this doc) | Line items within an order | Depends on orders and products |
| `coupons` | Section 6 (this doc) | Discount code management for marketplace checkout | Requires order checkout to be built first |
| `receipt_uploads` | Section 8 (this doc) | Receipt photo uploads with OCR processing | Requires OCR pipeline, private storage bucket, and spend tracking flow |
| `spend_events` | Section 8 (this doc) | Individual spend records linked to listings | Depends on receipt_uploads; requires spend tracking product design |
| `listing_service_areas` | Section 7 (Part A) | Defined geographic service area polygons or radius records | Map view and geographic filtering are V2 features |
| `ai_suggestions` | Section 12 (this doc) | AI-generated optimization suggestions for listing owners | Requires AI integration and owner-facing suggestion UI |
| `ai_generation_requests` | Section 12 (this doc) | Log of AI model API calls for cost and latency tracking | Depends on AI integration being built |
| `ai_moderation_flags` | Section 12 (this doc) | AI-generated content moderation flags routed to admin queue | Depends on AI integration; human review queue must be operational first |
| `event_vendors` | Section 10 (this doc) | Many-to-many between events and participating vendor listings | Event entity type is Beta; vendor type is V2; junction is V2 |
| `event_sponsors` | Section 10 (this doc) | Sponsor records for event pages | Same dependency chain as event_vendors |
| `community_impact_daily` | Section 8 (this doc) | Anonymized daily spend aggregates by city and category | Depends on spend_events being populated with sufficient data |

---

### V3+

V3+ tables power the dollar-flow map visualization, autonomous AI agents, vendor relationship inference, platform-level sponsor campaigns, service package purchasing, and invoicing.

| Table | Domain Section | Purpose | Why Deferred |
|---|---|---|---|
| `flow_nodes` | Section 9 (this doc) | Graph nodes for the dollar-flow visualization | Requires substantial spend_events data (V2) before visualization is meaningful |
| `flow_edges` | Section 9 (this doc) | Directed edges between flow nodes with volume and weight | Depends on flow_nodes and aggregated spend data |
| `flow_map_snapshots` | Section 9 (this doc) | Pre-computed serialized graph payloads for visualization rendering | Depends on flow_nodes and flow_edges being populated |
| `anonymized_community_nodes` | Section 9 (this doc) | City/category aggregate nodes for public flow map layer | Depends on community_impact_daily reaching minimum 5-contributor thresholds |
| `vendor_relationships` | Section 9 (this doc) | Inferred business-to-business relationships from spend and event data | Requires V2 spend data and event co-participation data to generate meaningful signals |
| `sponsor_campaigns` | Section 14 (this doc) | Brand-level sponsorship campaigns with city and category targeting | Platform-level sponsorships require significant traffic before value proposition is proven |
| `invoices` | Section 6 (this doc) | Stripe-synced invoice records for subscription and marketplace billing | Billing complexity is deferred to post-marketplace launch when invoice history is needed |
| `service_packages` | Section 6 (this doc) | Structured service bundles with Stripe pricing for vendor storefronts | Requires marketplace checkout and Stripe Connect; a V2+ add-on beyond the core order flow |
| `ai_agent_runs` | Section 12 (this doc) | Autonomous AI agent execution logs for curation, optimization, and moderation | Autonomous agents require validated AI suggestion and moderation pipelines from V2 |
| `listing_ctas` | Section 6 (Part A) | Structured CTA records for listings that require multiple CTAs | CTA data on listing_details tables is sufficient through V2; multi-CTA is a V3 enhancement |
