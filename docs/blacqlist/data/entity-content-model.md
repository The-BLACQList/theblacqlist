# Entity Content Model — The BLACQList

**Product:** The BLACQList
**Database:** Supabase / PostgreSQL
**Date:** 2026-05-07
**Status:** In Review
**Linked brief:** `docs/blacqlist/product/product-vision.md`
**Linked MVP spec:** `docs/blacqlist/product/mvp-definition.md`
**Linked architecture:** `docs/blacqlist/architecture/architecture-decisions.md`

---

## 1. Overview

This document defines the logical content model for every entity type on The BLACQList. It is the authoritative reference for field definitions, types, nullability, relationships, and data rules. The physical Supabase/PostgreSQL schema and migration files are derived from this document — not the reverse.

### What this document covers

- The shared base entity (`listings`) and all fields common to every entity type
- The eight entity-specific extension tables and their unique fields
- Two sub-entity tables (`products`, `services`) that are children of top-level entities
- Supporting tables: `media_attachments`, `spend_events` (connection fields only), and the `claims` reference
- The CTA type catalog, SEO field rules, media limits, verification criteria, and freshness fields
- Phase assignments for every field so engineers know what to build now versus later

### Approach: shared base + extension tables

Every listed entity on the platform — regardless of type — shares a single `listings` base table. Entity-type-specific fields live in separate `listing_details_*` extension tables that each carry a one-to-one foreign key back to `listings.id`. This design is documented as the official architecture decision in ADR-012.

Benefits of this approach:

- Search, discovery, SEO, status, trust, and admin fields are consistent across all entity types
- Adding a new entity type requires only a new `listing_details_*` table — no modifications to the base table
- RLS policies on `listings` apply universally; extension tables inherit access through their FK

Products and Services are sub-entities. They are children of a parent listing (`vendor` and `business`/`professional` respectively), have their own dedicated tables, and do not appear in the `listings` base table. They are not top-level searchable entities at MVP.

### Guidance for engineers reading this document

The Notes column in every table is not decoration — it explains why each field exists, how it is used in the product, and what behavior depends on it. Read the notes before implementing. Fields without notes on a schema of this size will produce misimplemented columns.

---

## 2. Entity Hierarchy Diagram

```
listings (base record — shared by all top-level entity types)
  ├── listing_details_business          (one-to-one, entity_type = 'business')
  ├── listing_details_professional      (one-to-one, entity_type = 'professional')
  ├── listing_details_creative          (one-to-one, entity_type = 'creative')
  ├── listing_details_event             (one-to-one, entity_type = 'event')
  ├── listing_details_job               (one-to-one, entity_type = 'job')
  └── listing_details_vendor            (one-to-one, entity_type = 'vendor')

Sub-entities (children of top-level entities — do not have their own listings row):
  ├── products     (many-to-one → listings where entity_type = 'vendor')
  └── services     (many-to-one → listings where entity_type = 'business' | 'professional')
```

Supporting tables referenced by listings (defined in their own schema documents or below):

| Table                  | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `cities`               | Canonical city/metro reference with SEO-friendly slugs and geo data            |
| `categories`           | Hierarchical category tree (top-level + subcategories)                         |
| `media_attachments`    | Polymorphic media store for all entity types (gallery images, portfolio items) |
| `claims`               | Ownership claim requests from business owners                                  |
| `reviews`              | Star ratings + text reviews (V1)                                               |
| `saves`                | User-listing save associations                                                 |
| `collections_listings` | Editorial collections ↔ listings junction (V1)                                 |
| `analytics_events`     | Page view, CTA click, share events for business analytics                      |
| `spend_events`         | Tracked spend linked to businesses and vendors (V2)                            |

---

## 3. Shared Base Entity Fields

**Table:** `listings`
**Description:** The single base record for every entity type. One row per listed entity. All discovery, search, status, trust, SEO, admin, and lifecycle fields live here so they apply uniformly across entity types.

### 3.1 Identity Fields

| Field         | Type                                                                          | Nullable | Default             | Notes                                                                                                                                                                                                                                          | Phase |
| ------------- | ----------------------------------------------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `id`          | `uuid`                                                                        | No       | `gen_random_uuid()` | Primary key. Used as the FK target for all extension tables and supporting tables.                                                                                                                                                             | MVP   |
| `entity_type` | `text` CHECK IN ('business','professional','creative','event','job','vendor') | No       | —                   | Determines which `listing_details_*` table holds the extended fields. Enforced as a CHECK constraint. Set on create; never changed.                                                                                                            | MVP   |
| `name`        | `text`                                                                        | No       | —                   | The public-facing entity name. Required on all entity types. Used in meta_title generation if `meta_title` is null.                                                                                                                            | MVP   |
| `slug`        | `text`                                                                        | No       | —                   | URL-safe unique identifier. Auto-generated from `name` + `city_text` on create (e.g., `sweet-auburn-bbq-atlanta`). Immutable after first publish — stability over accuracy per ADR-010. UNIQUE constraint. Used in canonical URL construction. | MVP   |
| `tagline`     | `text`                                                                        | Yes      | —                   | Short descriptor (≤140 chars) shown in the hero section below the name. Distinct from description — should be punchy and brand-forward. Optional at create; owner sets this in the Page editor.                                                | MVP   |

### 3.2 Location and Discovery Fields

| Field                      | Type                                                                                 | Nullable | Default      | Notes                                                                                                                                                                                       | Phase |
| -------------------------- | ------------------------------------------------------------------------------------ | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `city_id`                  | `uuid` FK → `cities.id` ON DELETE SET NULL                                           | Yes      | —            | Null for online-only or ships-nationwide entities with no physical presence. Used for city landing pages, city filters, and city-scoped search. SET NULL on city delete (rare, but safe).   | MVP   |
| `category_id`              | `uuid` FK → `categories.id` ON DELETE RESTRICT                                       | No       | —            | Primary category. RESTRICT on delete prevents orphaned listings. Required on all entity types.                                                                                              | MVP   |
| `subcategory_ids`          | `uuid[]`                                                                             | Yes      | —            | Array of subcategory UUIDs. Optional. Stored as a PostgreSQL array. Used for subcategory filter pages in V1. No FK enforcement on array elements — validated at the application layer.      | V1    |
| `location_type`            | `text` CHECK IN ('physical','online','hybrid','virtual-services','ships-nationwide') | No       | `'physical'` | Determines how location is displayed on the BLACQList Page and in search cards. `virtual-services` = professional who works via video call; `ships-nationwide` = vendor with no storefront. | MVP   |
| `service_area_description` | `text`                                                                               | Yes      | —            | Free-text service area description for non-physical entities ("Serving metro Atlanta and surrounding counties"). Shown on Page below the location section.                                  | MVP   |

### 3.3 Status and Lifecycle Fields

| Field          | Type                                                                               | Nullable | Default   | Notes                                                                                                                                                                                                                                                                                                                                                                        | Phase                                    |
| -------------- | ---------------------------------------------------------------------------------- | -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `status`       | `text` CHECK IN ('draft','pending','published','unpublished','flagged','archived') | No       | `'draft'` | Controls Page visibility. `draft` = owner editing, not publicly visible. `pending` = submitted for admin review (used for community-added listings). `published` = live and indexable. `unpublished` = owner took it offline. `flagged` = admin flagged for review — hidden from public search. `archived` = auto-set after `auto_archive_at` passes (events, expired jobs). | MVP                                      |
| `tier`         | `text` CHECK IN ('free','standard','premium')                                      | No       | `'free'`  | Listing tier. Determines feature availability and placement eligibility. `free` = MVP. `standard` and `premium` = V1 paid tiers. Controls gallery image limits, analytics access, and sponsored placement eligibility.                                                                                                                                                       | MVP (free only) / V1 (standard, premium) |
| `source`       | `text` CHECK IN ('owner','community','admin','import')                             | No       | `'owner'` | How this listing was created. `owner` = business owner created it directly. `community` = submitted by a supporter for admin review. `admin` = created by internal admin. `import` = seeded via bulk import script. Important for moderation routing — community listings require admin review before publishing.                                                            | MVP                                      |
| `published_at` | `timestamptz`                                                                      | Yes      | —         | Set to `now()` when status first transitions to `published`. Null for unpublished listings. Used for "new to BLACQList" discovery and freshness ordering.                                                                                                                                                                                                                    | MVP                                      |
| `created_at`   | `timestamptz`                                                                      | No       | `now()`   | Creation timestamp.                                                                                                                                                                                                                                                                                                                                                          | MVP                                      |
| `updated_at`   | `timestamptz`                                                                      | No       | `now()`   | Auto-updated by trigger on every UPDATE to any column on the `listings` row.                                                                                                                                                                                                                                                                                                 | MVP                                      |
| `deleted_at`   | `timestamptz`                                                                      | Yes      | —         | Soft delete. Null = active. Non-null = deleted. All default queries filter `WHERE deleted_at IS NULL`. RLS policies enforce this automatically. Used when a listing is removed from the platform but its data must be retained for audit (e.g., a fraudulent claim that was approved and then reversed).                                                                     | MVP                                      |

### 3.4 Ownership and Audit Fields

| Field           | Type                                      | Nullable | Default | Notes                                                                                                                                                                                                                 | Phase |
| --------------- | ----------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `submitted_by`  | `uuid` FK → `users.id` ON DELETE SET NULL | Yes      | —       | The user who created or submitted the listing. Null for imported listings with no associated user. SET NULL if the user is deleted.                                                                                   | MVP   |
| `updated_by`    | `uuid` FK → `users.id` ON DELETE SET NULL | Yes      | —       | The user who last updated the listing (can be admin or owner). Set on every save. Null until first update after creation.                                                                                             | MVP   |
| `owner_user_id` | `uuid` FK → `users.id` ON DELETE SET NULL | Yes      | —       | The authenticated user who owns this listing. Null until a claim is approved. Set by the claims approval workflow — not editable directly by the owner. Drives RLS ownership policies ("owner can edit own listing"). | MVP   |

### 3.5 Trust Fields

| Field                           | Type                                                           | Nullable | Default       | Notes                                                                                                                                                                                                                                                                                                                                                      | Phase |
| ------------------------------- | -------------------------------------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `trust_tier`                    | `text` CHECK IN ('unclaimed','claimed','verified','certified') | No       | `'unclaimed'` | The trust level displayed as a badge on the BLACQList Page. `unclaimed` = created by community or admin, no owner. `claimed` = owner has been approved via the claims workflow. `verified` = owner submitted documents reviewed and approved by admin. `certified` = BLACQList Certified (auto-granted by trigger when all criteria met — see Section 12). | MVP   |
| `claim_id`                      | `uuid` FK → `claims.id` ON DELETE SET NULL                     | Yes      | —             | The FK to the specific claim record that elevated this listing to `claimed`. Null for unclaimed listings. Set during claims approval. Allows admin to trace back the approval event.                                                                                                                                                                       | MVP   |
| `verified_at`                   | `timestamptz`                                                  | Yes      | —             | Timestamp when an admin approved verification. Null until verified.                                                                                                                                                                                                                                                                                        | V1    |
| `verified_by`                   | `uuid` FK → `users.id` ON DELETE SET NULL                      | Yes      | —             | The admin user who approved verification. Null until verified. SET NULL if admin user is deleted.                                                                                                                                                                                                                                                          | V1    |
| `certification_auto_granted_at` | `timestamptz`                                                  | Yes      | —             | Auto-set by database trigger or scheduled function when all BLACQList Certified criteria are met simultaneously (see Section 12). Never set manually. Presence of this timestamp means certification was auto-granted, not admin-granted.                                                                                                                  | V1    |

### 3.6 SEO Fields

| Field              | Type      | Nullable | Default | Notes                                                                                                                                                                                                | Phase |
| ------------------ | --------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `meta_title`       | `text`    | Yes      | —       | HTML `<title>` tag. If null, the system generates: `"{name} — {category} in {city} — The BLACQList"`. Owner can override in the Page editor. Max 60 chars for display; not enforced at DB layer.     | MVP   |
| `meta_description` | `text`    | Yes      | —       | HTML `<meta name="description">`. If null, system uses the first 160 chars of the entity's description field. Owner can override. Used by Google and social previews.                                | MVP   |
| `og_image_path`    | `text`    | Yes      | —       | Supabase Storage path for the Open Graph image. If null, falls back to `cover_image_path`, then `logo_path`, then a platform-default OG image. Never store the CDN URL here — generate at read time. | MVP   |
| `canonical_url`    | `text`    | Yes      | —       | If null, system generates from entity_type + city slug + listing slug per ADR-010 route structure. Owner cannot override canonical URL — it is system-managed to prevent duplicate content.          | MVP   |
| `json_ld_type`     | `text`    | Yes      | —       | The Schema.org JSON-LD type used for structured data on the BLACQList Page. See Section 10 for the mapping per entity type. If null, system infers from `entity_type`.                               | MVP   |
| `sitemap_include`  | `boolean` | No       | `true`  | Controls inclusion in the XML sitemap. Set false automatically when status = 'flagged', 'archived', or `noindex` = true.                                                                             | MVP   |
| `noindex`          | `boolean` | No       | `false` | Set true automatically for archived events and expired jobs so they are de-indexed from Google. Also set true for flagged listings.                                                                  | MVP   |

### 3.7 Admin and Moderation Fields

| Field                      | Type                                                               | Nullable | Default  | Notes                                                                                                                                                                                                                                                                                                  | Phase |
| -------------------------- | ------------------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `flag_status`              | `text` CHECK IN ('none','inactive','duplicate','incorrect','spam') | No       | `'none'` | Admin-assigned flag reason. `none` = clean. `inactive` = business appears to be closed. `duplicate` = another listing exists for the same entity. `incorrect` = known incorrect information. `spam` = fraudulent or promotional. Flagged listings are hidden from public search but visible to admins. | MVP   |
| `admin_notes`              | `text`                                                             | Yes      | —        | Internal admin notes. Never shown to the listing owner or public. Used for moderation context, follow-up reminders, and claim review notes.                                                                                                                                                            | MVP   |
| `moderation_notes`         | `text`                                                             | Yes      | —        | Notes visible to the listing owner — shown in their dashboard when a listing is rejected, flagged, or requires correction. Distinct from `admin_notes` which is internal-only.                                                                                                                         | MVP   |
| `is_featured`              | `boolean`                                                          | No       | `false`  | Homepage featured slot. At most one listing should have this true at any given time. Admin-controlled only. Not the same as sponsored placement — featured is editorial; sponsored is paid.                                                                                                            | MVP   |
| `is_sponsored`             | `boolean`                                                          | No       | `false`  | Has an active paid sponsored placement. Set to true when a sponsored placement purchase is active. Auto-set to false after `sponsored_expires_at` passes.                                                                                                                                              | V1    |
| `sponsored_expires_at`     | `timestamptz`                                                      | Yes      | —        | Expiry timestamp for the sponsored placement. Null when `is_sponsored` = false. After this timestamp, a scheduled function sets `is_sponsored` = false and clears this field.                                                                                                                          | V1    |
| `sponsored_placement_type` | `text`                                                             | Yes      | —        | Where the sponsored placement appears. One of: `'homepage'`, `'search'`, `'category'`, `'city'`. Null when not sponsored. Used by the rendering layer to apply sponsored treatment in the correct context.                                                                                             | V1    |

### 3.8 Verification Fields

| Field                 | Type                                                     | Nullable | Default  | Notes                                                                                                                                                                                                                                                                                                               | Phase                          |
| --------------------- | -------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `verification_status` | `text` CHECK IN ('none','pending','verified','rejected') | No       | `'none'` | The verification workflow status. `none` = never submitted. `pending` = documents uploaded, awaiting admin review. `verified` = approved. `rejected` = admin rejected; owner can resubmit. Distinct from `trust_tier` — this field tracks the workflow state; `trust_tier` tracks the publicly visible trust level. | MVP (data model) / V1 (active) |
| `verification_docs`   | `text[]`                                                 | Yes      | —        | Array of Supabase Storage paths for verification documents uploaded by the owner (business license, EIN confirmation, etc.). Paths in the `verification-docs` private bucket. Never publicly accessible. Generated signed URLs on admin access only.                                                                | V1                             |
| `verification_notes`  | `text`                                                   | Yes      | —        | Admin-written notes on the verification decision. Shown to the owner when status = 'rejected' so they know what to resubmit.                                                                                                                                                                                        | V1                             |

### 3.9 Freshness Fields

| Field                     | Type          | Nullable | Default | Notes                                                                                                                                                                                                                                              | Phase |
| ------------------------- | ------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `last_edited_by_owner_at` | `timestamptz` | Yes      | —       | Updated whenever the listing owner saves any field change in the Page editor. Used by the admin stale listings queue to surface listings that haven't been touched by the owner in 180+ days. Null until first owner edit.                         | MVP   |
| `last_admin_updated_at`   | `timestamptz` | Yes      | —       | Updated whenever an admin edits any field. Separate from `updated_at` which updates on any change. Used to track admin maintenance activity on a listing.                                                                                          | MVP   |
| `auto_archive_at`         | `timestamptz` | Yes      | —       | For events: set to the event end date + 1 day at create time. A scheduled function checks this field daily and sets `status = 'archived'` and `noindex = true` for any listing where this timestamp has passed. Null for non-event entities.       | V1    |
| `auto_expire_at`          | `timestamptz` | Yes      | —       | For jobs: set to the application deadline at create time. Same scheduled function processes this field. After expiry, status = 'archived', noindex = true. Null for non-job entities.                                                              | V1    |
| `stale_flagged_at`        | `timestamptz` | Yes      | —       | Set by a scheduled admin tool job when `last_edited_by_owner_at` is null or more than 180 days ago, and status = 'published'. Surfaces in an admin "stale listings" queue for outreach or archival. Cleared when the owner next edits the listing. | V1    |

### 3.10 Media Fields (on base `listings` table)

These are direct paths on the `listings` table for the two primary images that appear in the hero and in search result cards. Additional media (gallery, portfolio) lives in `media_attachments`.

| Field              | Type   | Nullable | Default | Notes                                                                                                                                                                                                                                         | Phase |
| ------------------ | ------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `logo_path`        | `text` | Yes      | —       | Supabase Storage path in the `listing-media` bucket. The logo is displayed in search result cards and the Page header. Recommended dimensions: 400×400px square, max 2MB, converted to WebP. Never store the CDN URL — generate at read time. | MVP   |
| `cover_image_path` | `text` | Yes      | —       | Supabase Storage path for the hero/cover image. Displayed full-width at the top of the BLACQList Page and as the primary OG image. Recommended: 1200×675px (16:9), max 5MB, WebP. Falls back to `logo_path` for OG if null.                   | MVP   |

---

## 4. Entity-Type-Specific Fields

Each section below defines the extension table for a single entity type. Every extension table has:

- `id` uuid PK
- `listing_id` uuid FK → `listings.id` ON DELETE CASCADE, NOT NULL, UNIQUE (enforces one-to-one)
- `created_at` / `updated_at` timestamptz audit fields

These common columns are not repeated in each table below — they are assumed on every extension table.

---

### 4.1 Business (`listing_details_business`)

**Description:** The primary entity type. Covers brick-and-mortar, service businesses, and online businesses. The only entity type built at MVP. All other entity type templates are designed as extensions of this base model.

| Field                  | Type                                                                                               | Nullable | Default   | Notes                                                                                                                                                                                                                                                                                                                   | Phase |
| ---------------------- | -------------------------------------------------------------------------------------------------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `description`          | `text`                                                                                             | Yes      | —         | The full "About" section for the business. Shown in the About section of the BLACQList Page. Used in PostgreSQL full-text search tsvector. If null and `source` = 'import', left blank for owner to fill in.                                                                                                            | MVP   |
| `hours`                | `jsonb`                                                                                            | Yes      | —         | Structured hours of operation. Expected shape: `{monday: {open: "09:00", close: "17:00", closed: false}, tuesday: {...}, ...}`. Each day key is required but values can be `{closed: true}` for closed days. Null if hours are unknown or "by appointment only". Document shape in a migration comment.                 | MVP   |
| `hours_notes`          | `text`                                                                                             | Yes      | —         | Optional supplement to structured hours for irregular situations ("Closed on major holidays", "Summer hours in effect June–August"). Displayed below the hours grid on the Page.                                                                                                                                        | MVP   |
| `address_line_1`       | `text`                                                                                             | Yes      | —         | Street address line 1. Null for online-only or virtual-services businesses. PII-adjacent — do not surface in analytics.                                                                                                                                                                                                 | MVP   |
| `address_line_2`       | `text`                                                                                             | Yes      | —         | Suite, unit, floor number. Optional.                                                                                                                                                                                                                                                                                    | MVP   |
| `city_text`            | `text`                                                                                             | Yes      | —         | Denormalized city name for display ("Atlanta", "Houston"). Distinct from `listings.city_id` which is the FK to the `cities` table. Used for display on the Page and in search cards so a JOIN to `cities` is not required for rendering the address.                                                                    | MVP   |
| `state`                | `text`                                                                                             | Yes      | —         | Two-letter state code ("GA", "TX"). US-only at MVP.                                                                                                                                                                                                                                                                     | MVP   |
| `zip`                  | `text`                                                                                             | Yes      | —         | ZIP code. Null for virtual businesses. Not validated at the DB layer — application validates format.                                                                                                                                                                                                                    | MVP   |
| `lat`                  | `numeric`                                                                                          | Yes      | —         | Latitude for map pin. Null until V2 when map view is enabled. Set by geocoding address at save time (V2).                                                                                                                                                                                                               | V2    |
| `lng`                  | `numeric`                                                                                          | Yes      | —         | Longitude for map pin. Same as `lat` — both null until V2.                                                                                                                                                                                                                                                              | V2    |
| `phone`                | `text`                                                                                             | Yes      | —         | Business phone number. Stored as text to preserve formatting. PII. Displayed on the Page and used for `cta_type = 'call'` (generates a `tel:` link).                                                                                                                                                                    | MVP   |
| `email`                | `text`                                                                                             | Yes      | —         | Business contact email. PII. Displayed on the Page as a `mailto:` link. Not used for platform auth — that is the user's `users.email`.                                                                                                                                                                                  | MVP   |
| `website_url`          | `text`                                                                                             | Yes      | —         | External website URL. Validated to start with `https://` at the application layer.                                                                                                                                                                                                                                      | MVP   |
| `social_instagram`     | `text`                                                                                             | Yes      | —         | Full Instagram profile URL (e.g., `https://instagram.com/handle`). Validated as URL. Displayed as icon link on the Page.                                                                                                                                                                                                | MVP   |
| `social_facebook`      | `text`                                                                                             | Yes      | —         | Full Facebook page URL.                                                                                                                                                                                                                                                                                                 | MVP   |
| `social_linkedin`      | `text`                                                                                             | Yes      | —         | Full LinkedIn company or profile URL.                                                                                                                                                                                                                                                                                   | MVP   |
| `social_tiktok`        | `text`                                                                                             | Yes      | —         | Full TikTok profile URL.                                                                                                                                                                                                                                                                                                | MVP   |
| `social_youtube`       | `text`                                                                                             | Yes      | —         | YouTube channel URL.                                                                                                                                                                                                                                                                                                    | MVP   |
| `social_twitter`       | `text`                                                                                             | Yes      | —         | X (formerly Twitter) profile URL.                                                                                                                                                                                                                                                                                       | MVP   |
| `cta_type`             | `text` CHECK IN ('book','order','call','message','visit','get-quote','shop','subscribe','contact') | No       | `'visit'` | Controls which CTA button appears on the Page hero. Drives the label, icon, and click behavior. See the CTA Type Catalog in Section 5 for full behavior per type. Default is `'visit'` — takes the user to the website.                                                                                                 | MVP   |
| `cta_url`              | `text`                                                                                             | Yes      | —         | The URL the CTA button opens. Required for all `cta_type` values except `'call'` (which uses the `phone` field). Null for call CTAs.                                                                                                                                                                                    | MVP   |
| `cta_label_override`   | `text`                                                                                             | Yes      | —         | If the owner wants a custom label instead of the default (e.g., "Order Catering" instead of "Order Now"), they set this. Takes precedence over the default label from the CTA catalog if non-null.                                                                                                                      | MVP   |
| `accepts_reservations` | `boolean`                                                                                          | Yes      | —         | Whether the business accepts reservations. Used as a filter signal in V1. Distinct from CTA booking — a business can accept reservations without having an online booking link.                                                                                                                                         | V1    |
| `price_range`          | `text` CHECK IN ('$','$$','$$$','$$$$')                                                            | Yes      | —         | Informal price range indicator. Null if unknown or if business declines to state. Used as a filter in V1.                                                                                                                                                                                                               | V1    |
| `founded_year`         | `integer`                                                                                          | Yes      | —         | Year the business was founded. Used for "in business since X" display. Validated: must be between 1800 and the current year.                                                                                                                                                                                            | V1    |
| `ships_nationwide`     | `boolean`                                                                                          | No       | `false`   | Whether the business ships products nationwide. Redundant with `listings.location_type = 'ships-nationwide'` — use `listings.location_type` as the canonical field. This column is present on the business detail table for rendering convenience (avoids JOIN to base) but must be kept in sync via application logic. | MVP   |

---

### 4.2 Professional (`listing_details_professional`)

**Description:** Individual service provider — attorney, therapist, coach, financial advisor, trainer, consultant. Solo-practitioner focus. Introduced in Beta.

| Field               | Type                                                                     | Nullable | Default  | Notes                                                                                                                                                                                                                                                         | Phase |
| ------------------- | ------------------------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `headline`          | `text`                                                                   | Yes      | —        | One-line professional identity shown below the name in the hero ("Licensed Therapist · Atlanta, GA" or "Brand Strategist for Black Creatives"). Distinct from `listings.tagline`.                                                                             | Beta  |
| `bio`               | `text`                                                                   | Yes      | —        | Full professional biography. Shown in the main body of the Professional Page. Used in full-text search.                                                                                                                                                       | Beta  |
| `credentials`       | `text[]`                                                                 | Yes      | —        | Array of credential strings. Each element is a single credential label ("Licensed Clinical Social Worker (LCSW)", "Georgia Bar Admitted", "ICF Certified Coach"). Displayed as a credential badges row. No FK — free text with admin curation guidance in V1. | Beta  |
| `specialties`       | `text[]`                                                                 | Yes      | —        | Array of specialty strings ("Anxiety", "Couples Therapy", "Corporate Strategy"). Displayed as tags on the Page. Used as search signals in V1.                                                                                                                 | Beta  |
| `consultation_type` | `text` CHECK IN ('in-person','virtual','both')                           | Yes      | —        | Whether the professional offers in-person, virtual, or both consultation types. Shown as an availability indicator. Used as a search filter in V1.                                                                                                            | Beta  |
| `availability_note` | `text`                                                                   | Yes      | —        | Free-text availability message set by the professional ("Currently accepting new clients", "Waitlist only — contact to be added"). Shown prominently near the CTA.                                                                                            | Beta  |
| `cta_type`          | `text` CHECK IN ('book','schedule','inquire','call','message','contact') | No       | `'book'` | Primary CTA for the Professional Page. Default is `'book'` to drive consultation bookings.                                                                                                                                                                    | Beta  |
| `cta_url`           | `text`                                                                   | Yes      | —        | URL for the CTA (Calendly link, booking page, contact form). Null for `'call'` CTA type.                                                                                                                                                                      | Beta  |
| `phone`             | `text`                                                                   | Yes      | —        | Professional contact phone. PII.                                                                                                                                                                                                                              | Beta  |
| `email`             | `text`                                                                   | Yes      | —        | Professional contact email. PII. Not the same as the user's auth email.                                                                                                                                                                                       | Beta  |
| `website_url`       | `text`                                                                   | Yes      | —        | Portfolio or personal site URL.                                                                                                                                                                                                                               | Beta  |
| `social_instagram`  | `text`                                                                   | Yes      | —        | Instagram profile URL.                                                                                                                                                                                                                                        | Beta  |
| `social_linkedin`   | `text`                                                                   | Yes      | —        | LinkedIn profile URL. Most relevant social for professionals.                                                                                                                                                                                                 | Beta  |
| `social_twitter`    | `text`                                                                   | Yes      | —        | X (Twitter) profile URL.                                                                                                                                                                                                                                      | Beta  |
| `city_text`         | `text`                                                                   | Yes      | —        | Practice city for display ("Atlanta, GA", "Houston, TX"). Denormalized from `listings.city_id` for display convenience.                                                                                                                                       | Beta  |
| `state`             | `text`                                                                   | Yes      | —        | Two-letter state code.                                                                                                                                                                                                                                        | Beta  |
| `virtual_only`      | `boolean`                                                                | No       | `false`  | True if the professional has no in-person presence and operates entirely remotely. When true, `listings.location_type` should be `'virtual-services'` and `listings.city_id` may be null.                                                                     | Beta  |
| `video_embed_url`   | `text`                                                                   | Yes      | —        | URL for an intro or portfolio video (YouTube or Vimeo embed). Displayed in the Page body as an embedded player. Null until owner adds it.                                                                                                                     | V1    |

---

### 4.3 Creative (`listing_details_creative`)

**Description:** Visual artists, photographers, musicians, designers, filmmakers, authors, performers. Portfolio-first presentation. Introduced in Beta.

| Field                 | Type                                                             | Nullable | Default     | Notes                                                                                                                                                                                                            | Phase |
| --------------------- | ---------------------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `bio`                 | `text`                                                           | Yes      | —           | Artist/creative biography. Main body text on the Creative Page. Used in full-text search.                                                                                                                        | Beta  |
| `medium_genre`        | `text[]`                                                         | Yes      | —           | Array of mediums or genres. Examples for visual: `["Photography", "Portrait", "Digital Art"]`. Examples for music: `["R&B", "Live Performance", "Producer"]`. Displayed as tags. Used as search signals in V1.   | Beta  |
| `portfolio_statement` | `text`                                                           | Yes      | —           | A brief statement about the body of work — distinct from the bio. Shown above the portfolio gallery. Example: "Available for editorial, commercial, and event photography."                                      | Beta  |
| `commission_status`   | `text` CHECK IN ('open','closed','by-request')                   | Yes      | —           | Whether the creative is currently accepting commissions. Shown as a status chip near the CTA. Helps supporters know at a glance whether to reach out.                                                            | Beta  |
| `cta_type`            | `text` CHECK IN ('book','commission','inquire','contact','shop') | No       | `'contact'` | Default is `'contact'` — creatives are generally reached out to before a transaction. `'shop'` used when the creative also sells products (may link to external shop at Beta; links to vendor storefront in V2). | Beta  |
| `cta_url`             | `text`                                                           | Yes      | —           | URL for the CTA (booking form, commission request link, external shop).                                                                                                                                          | Beta  |
| `phone`               | `text`                                                           | Yes      | —           | Contact phone. PII.                                                                                                                                                                                              | Beta  |
| `email`               | `text`                                                           | Yes      | —           | Contact email. PII.                                                                                                                                                                                              | Beta  |
| `website_url`         | `text`                                                           | Yes      | —           | Portfolio website or personal site URL.                                                                                                                                                                          | Beta  |
| `social_instagram`    | `text`                                                           | Yes      | —           | Instagram profile URL. The most important social for most creatives — displayed prominently.                                                                                                                     | Beta  |
| `social_tiktok`       | `text`                                                           | Yes      | —           | TikTok profile URL.                                                                                                                                                                                              | Beta  |
| `social_youtube`      | `text`                                                           | Yes      | —           | YouTube channel URL. Relevant for musicians and filmmakers.                                                                                                                                                      | Beta  |
| `social_twitter`      | `text`                                                           | Yes      | —           | X (Twitter) profile URL.                                                                                                                                                                                         | Beta  |
| `social_behance`      | `text`                                                           | Yes      | —           | Behance portfolio URL. Relevant for designers.                                                                                                                                                                   | Beta  |
| `video_embed_url`     | `text`                                                           | Yes      | —           | YouTube or Vimeo embed URL for a featured video (music video, showreel, demo reel). Displayed prominently in the Page body. Null until owner adds it.                                                            | V1    |

---

### 4.4 Event (`listing_details_event`)

**Description:** A time-bounded event — concert, pop-up, workshop, market, networking event. Auto-archives after the event end date. Introduced in Beta.

| Field                  | Type                                                           | Nullable | Default              | Notes                                                                                                                                                                                                                                   | Phase |
| ---------------------- | -------------------------------------------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `event_date`           | `date`                                                         | No       | —                    | The primary date of the event. Required. For multi-day events, this is the start date. Combined with `event_time` for full datetime display.                                                                                            | Beta  |
| `event_end_date`       | `date`                                                         | Yes      | —                    | End date for multi-day events. Null for single-day events. When non-null, displayed as a date range ("Nov 15–17, 2026"). The `listings.auto_archive_at` timestamp is set to `event_end_date + 1 day` (or `event_date + 1 day` if null). | Beta  |
| `event_time`           | `time`                                                         | Yes      | —                    | Start time of the event (e.g., `19:00`). Null for "all day" events or when time is TBD. Combined with `timezone` for display.                                                                                                           | Beta  |
| `event_end_time`       | `time`                                                         | Yes      | —                    | End time. Null for open-ended or all-day events.                                                                                                                                                                                        | Beta  |
| `timezone`             | `text`                                                         | No       | `'America/New_York'` | IANA timezone identifier. Determines how time fields are displayed to the visitor. Required even if event_time is null — in case time is added later.                                                                                   | Beta  |
| `location_type`        | `text` CHECK IN ('in-person','virtual','hybrid')               | No       | `'in-person'`        | Distinct from `listings.location_type` — this field is scoped specifically to events. Determines whether an address or a virtual link is shown.                                                                                         | Beta  |
| `location_address`     | `text`                                                         | Yes      | —                    | Full address string for in-person events ("The Gathering Spot, 550 Somerset Terrace NE, Atlanta, GA 30306"). Null for virtual events.                                                                                                   | Beta  |
| `location_city_text`   | `text`                                                         | Yes      | —                    | City name for display. Denormalized for rendering without a JOIN to `cities`.                                                                                                                                                           | Beta  |
| `venue_name`           | `text`                                                         | Yes      | —                    | Venue name shown separately from the address ("The Gathering Spot", "The Fox Theatre"). Displayed above the address on the Page.                                                                                                        | Beta  |
| `description`          | `text`                                                         | Yes      | —                    | Full event description. Shown in the main body of the Event Page. Used in full-text search.                                                                                                                                             | Beta  |
| `ticket_url`           | `text`                                                         | Yes      | —                    | External ticket purchase URL (Eventbrite, Tock, direct). Null for free or RSVP-only events.                                                                                                                                             | Beta  |
| `rsvp_url`             | `text`                                                         | Yes      | —                    | RSVP URL for free events. Null for ticketed events.                                                                                                                                                                                     | Beta  |
| `is_free`              | `boolean`                                                      | No       | `false`              | Whether the event is free to attend. Used to display a "Free" badge and to filter search results in V1. When true, `ticket_price_min` and `ticket_price_max` should both be null.                                                       | Beta  |
| `ticket_price_min`     | `numeric`                                                      | Yes      | —                    | Minimum ticket price in USD (e.g., `0.00` for a free tier, `15.00` for general admission). Null if unknown or free.                                                                                                                     | Beta  |
| `ticket_price_max`     | `numeric`                                                      | Yes      | —                    | Maximum ticket price. Null for single-price events or free events. Used to render a price range ("$15–$75").                                                                                                                            | Beta  |
| `ticket_price_note`    | `text`                                                         | Yes      | —                    | Free-text price note for complex pricing ("Free – $45; VIP Tables Available"). Displayed below the structured price range when non-null. Takes precedence over rendered range for display.                                              | Beta  |
| `cta_type`             | `text` CHECK IN ('get-tickets','rsvp','register','learn-more') | No       | `'get-tickets'`      | Primary CTA for the Event Page. Default assumes a ticketed event. Set to `'rsvp'` for free events.                                                                                                                                      | Beta  |
| `cta_url`              | `text`                                                         | Yes      | —                    | URL for the CTA. Should match `ticket_url` or `rsvp_url` depending on `cta_type`.                                                                                                                                                       | Beta  |
| `organizer_listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL                   | Yes      | —                    | Optional link to the organizer's BLACQList Page (Business or Professional). Displayed as a "Presented by" attribution on the Event Page. SET NULL if the organizer listing is deleted.                                                  | Beta  |
| `is_recurring`         | `boolean`                                                      | No       | `false`              | Whether this is a recurring event. True value is a placeholder — recurring event management is a V2 feature. At Beta, recurring events are separate listing records.                                                                    | V2    |

---

### 4.5 Job (`listing_details_job`)

**Description:** A job or employment opportunity. Auto-expires at application deadline. Applications handled off-platform via an apply link. Introduced in Beta.

| Field                 | Type                                                                                      | Nullable | Default       | Notes                                                                                                                                                                                               | Phase |
| --------------------- | ----------------------------------------------------------------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `role_title`          | `text`                                                                                    | No       | —             | The job title ("Marketing Manager", "Line Cook", "Software Engineer"). Required. Displayed as the headline of the Job Page.                                                                         | Beta  |
| `employment_type`     | `text` CHECK IN ('full-time','part-time','contract','freelance','internship','volunteer') | Yes      | —             | Employment type. Null if the poster does not specify. Used as a filter in V1.                                                                                                                       | Beta  |
| `location_type`       | `text` CHECK IN ('in-person','remote','hybrid')                                           | No       | `'in-person'` | Whether the role is in-person, remote, or hybrid. Displayed prominently on the Job Page and in search cards.                                                                                        | Beta  |
| `location_address`    | `text`                                                                                    | Yes      | —             | Work location address. Null for remote roles.                                                                                                                                                       | Beta  |
| `location_city_text`  | `text`                                                                                    | Yes      | —             | City name for display. Null for fully remote roles.                                                                                                                                                 | Beta  |
| `location_state`      | `text`                                                                                    | Yes      | —             | State for display ("GA", "TX"). Null for fully remote.                                                                                                                                              | Beta  |
| `description`         | `text`                                                                                    | Yes      | —             | Full job description. Shown in the body of the Job Page. May include responsibilities, qualifications, and benefits. Used in full-text search.                                                      | Beta  |
| `requirements`        | `text`                                                                                    | Yes      | —             | Requirements or qualifications section. May be formatted with Markdown bullet points. Rendered separately from `description` on the Page.                                                           | Beta  |
| `salary_range_min`    | `numeric`                                                                                 | Yes      | —             | Minimum salary in USD. Null if the poster chooses not to display.                                                                                                                                   | Beta  |
| `salary_range_max`    | `numeric`                                                                                 | Yes      | —             | Maximum salary in USD. Null for single-rate or undisclosed salaries.                                                                                                                                | Beta  |
| `salary_type`         | `text` CHECK IN ('annual','hourly','project')                                             | Yes      | —             | Determines how the salary range is labeled ("$60k–$80k / year" vs. "$25–$35 / hour"). Null if salary is undisclosed.                                                                                | Beta  |
| `salary_visible`      | `boolean`                                                                                 | No       | `true`        | Whether to display the salary on the public Page. When false, salary range fields may be set but are not rendered. Allows the poster to record compensation internally without showing it publicly. | Beta  |
| `apply_url`           | `text`                                                                                    | Yes      | —             | External apply URL — ATS link, email application link, or direct form. Null if the job is listing-only with no apply mechanism yet.                                                                 | Beta  |
| `cta_type`            | `text` CHECK IN ('apply','learn-more','contact')                                          | No       | `'apply'`     | Primary CTA. Default is `'apply'`.                                                                                                                                                                  | Beta  |
| `cta_url`             | `text`                                                                                    | Yes      | —             | Same as `apply_url` in most cases. Separated to allow the CTA to point to a different URL than the apply link (e.g., a landing page vs. the ATS).                                                   | Beta  |
| `deadline`            | `date`                                                                                    | Yes      | —             | Application deadline date. When set, this value is also written to `listings.auto_expire_at` as `deadline + 1 day at midnight UTC`. Null for rolling applications.                                  | Beta  |
| `employer_listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL                                              | Yes      | —             | Optional link to the employer's BLACQList Page. Displayed as "Posted by [Business Name]" on the Job Page with a link. SET NULL if employer listing is deleted.                                      | Beta  |

---

### 4.6 Vendor (`listing_details_vendor`)

**Description:** A business that sells physical or digital products through the BLACQList marketplace. Vendor is a superset of Business — a Vendor listing has both a `listing_details_business` record and a `listing_details_vendor` record. The business detail record holds all contact/address/hours information. The vendor detail record holds marketplace-specific fields. Introduced in V2.

**Architecture note on the Business/Vendor relationship:**

A Vendor is modeled as a Business listing (`entity_type = 'vendor'`) that has both a `listing_details_business` row AND a `listing_details_vendor` row, both keyed to the same `listings.id`. This means the business context data (address, hours, contact, social) is stored in `listing_details_business` and the commerce layer data is stored in `listing_details_vendor`. The rendering layer joins both. This is preferred over duplicating all business fields in the vendor table.

An existing `entity_type = 'business'` listing can be upgraded to a vendor by:

1. Changing `entity_type` to `'vendor'` on the `listings` row
2. Creating a `listing_details_vendor` row for that `listings.id`

The existing `listing_details_business` row is preserved — no data loss.

| Field                    | Type                                                            | Nullable | Default         | Notes                                                                                                                                                                                                                                                                                    | Phase |
| ------------------------ | --------------------------------------------------------------- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `storefront_description` | `text`                                                          | Yes      | —               | A short "What we sell" summary specifically for the storefront section of the Vendor Page. Distinct from the business description in `listing_details_business`. Shown above the product grid.                                                                                           | V2    |
| `shipping_info`          | `text`                                                          | Yes      | —               | Free-text shipping policy ("Ships in 3–5 business days. Free shipping on orders over $75."). Shown in the storefront section.                                                                                                                                                            | V2    |
| `return_policy`          | `text`                                                          | Yes      | —               | Free-text return and exchange policy. Shown in the storefront section.                                                                                                                                                                                                                   | V2    |
| `stripe_connect_id`      | `text`                                                          | Yes      | —               | The Stripe Connect account ID for this vendor (e.g., `acct_1AbcDefGhIjKlMno`). Set during Stripe Connect onboarding. Null until the vendor completes onboarding. Used to route payouts. Never expose in API responses to non-admin users.                                                | V2    |
| `stripe_connect_status`  | `text` CHECK IN ('not-started','pending','active','restricted') | No       | `'not-started'` | `not-started` = vendor has not begun Stripe Connect onboarding. `pending` = Connect onboarding started but not complete. `active` = fully onboarded; can receive payouts. `restricted` = Stripe has restricted the account (requires vendor action). Synced via Stripe Connect webhooks. | V2    |
| `cta_type`               | `text` CHECK IN ('shop','browse','order','visit-store')         | No       | `'shop'`        | Primary CTA for the Vendor Page hero. Default is `'shop'` — scrolls to or links to the storefront.                                                                                                                                                                                       | V2    |
| `cta_url`                | `text`                                                          | Yes      | —               | CTA URL. For in-platform storefronts, this may be null (scrolls to storefront section on the same page). For external storefronts, this is the URL.                                                                                                                                      | V2    |

---

### 4.7 Product (`products` table)

**Description:** An individual product for sale. Child entity of a Vendor listing. Each product row is owned by exactly one vendor. Products are not searchable at the `listings` level — they are discovered through the Vendor's storefront. Introduced in V2.

**Table:** `products`
**Parent:** `listings.id` where `entity_type = 'vendor'`
**On Delete:** CASCADE — when a vendor listing is deleted, all its products are deleted.

| Field               | Type                                          | Nullable | Default             | Notes                                                                                                                                                                                                                       | Phase |
| ------------------- | --------------------------------------------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `id`                | `uuid`                                        | No       | `gen_random_uuid()` | Primary key.                                                                                                                                                                                                                | V2    |
| `vendor_listing_id` | `uuid` FK → `listings.id` ON DELETE CASCADE   | No       | —                   | The vendor parent. NOT NULL. UNIQUE per product — each product belongs to exactly one vendor.                                                                                                                               | V2    |
| `name`              | `text`                                        | No       | —                   | Product name. Displayed on product cards and the product detail page.                                                                                                                                                       | V2    |
| `slug`              | `text`                                        | No       | —                   | URL-safe identifier. Auto-generated from vendor slug + product name. UNIQUE across the `products` table.                                                                                                                    | V2    |
| `description`       | `text`                                        | Yes      | —                   | Full product description. Shown on the product detail page.                                                                                                                                                                 | V2    |
| `price`             | `numeric(10,2)`                               | No       | —                   | Current sale price in USD. Not null — every product must have a price.                                                                                                                                                      | V2    |
| `compare_at_price`  | `numeric(10,2)`                               | Yes      | —                   | Original or "was" price for strikethrough pricing display. Null if not on sale. Must be greater than `price` when set.                                                                                                      | V2    |
| `currency`          | `text`                                        | No       | `'USD'`             | ISO 4217 currency code. USD only at V2 launch.                                                                                                                                                                              | V2    |
| `sku`               | `text`                                        | Yes      | —                   | Vendor-assigned stock keeping unit. Not unique at the platform level — unique per vendor enforced at the application layer.                                                                                                 | V2    |
| `inventory_count`   | `integer`                                     | Yes      | —                   | Current inventory quantity. Null = unlimited (no tracking). Zero = out of stock. Must be >= 0 when non-null.                                                                                                                | V2    |
| `track_inventory`   | `boolean`                                     | No       | `false`             | Whether inventory_count is being tracked. When false, `inventory_count` should be null and the product is always shown as available.                                                                                        | V2    |
| `is_digital`        | `boolean`                                     | No       | `false`             | Whether this is a digital product (ebook, download, course). When true, shipping fields are irrelevant and no shipping cost is calculated at checkout.                                                                      | V2    |
| `status`            | `text` CHECK IN ('active','draft','archived') | No       | `'draft'`           | `draft` = not visible on the storefront. `active` = visible and purchasable. `archived` = no longer for sale; preserved for order history.                                                                                  | V2    |
| `weight_oz`         | `numeric`                                     | Yes      | —                   | Product weight in ounces for shipping calculation. Null for digital products or when vendor manages shipping manually.                                                                                                      | V2    |
| `categories`        | `text[]`                                      | Yes      | —                   | Product category tags. Free text array. Used for storefront filtering (V2). Not FK-constrained.                                                                                                                             | V2    |
| `tags`              | `text[]`                                      | Yes      | —                   | Search and discovery tags. Free text array.                                                                                                                                                                                 | V2    |
| `cover_image_path`  | `text`                                        | Yes      | —                   | Primary product image. Supabase Storage path in `listing-media` bucket. Displayed on product cards and as the hero on product detail pages. Additional images in `media_attachments`.                                       | V2    |
| `variants`          | `jsonb`                                       | Yes      | —                   | V2 product variant configuration. Expected shape: `[{name: "Size", options: ["S","M","L","XL"]}, {name: "Color", options: ["Black","White"]}]`. Null for simple (no-variant) products. Document shape in migration comment. | V2    |
| `stripe_product_id` | `text`                                        | Yes      | —                   | Stripe Product ID (e.g., `prod_AbcDefGhIjKlMno`). Set when the product is created in Stripe. Null until Stripe sync runs.                                                                                                   | V2    |
| `stripe_price_id`   | `text`                                        | Yes      | —                   | Stripe Price ID (e.g., `price_AbcDefGhIjKlMno`). Set when the Stripe price object is created. When `price` or `currency` changes, a new Stripe price must be created and this field updated.                                | V2    |
| `created_at`        | `timestamptz`                                 | No       | `now()`             |                                                                                                                                                                                                                             | V2    |
| `updated_at`        | `timestamptz`                                 | No       | `now()`             | Trigger-updated.                                                                                                                                                                                                            | V2    |

---

### 4.8 Service (`services` table)

**Description:** An individual service offering. Child entity of a Business or Professional listing. Services are displayed as a structured list on the BLACQList Page — they are not separately searchable at MVP. Available in a basic form at MVP (name + description); expanded fields in V1.

**Table:** `services`
**Parent:** `listings.id` where `entity_type = 'business'` or `entity_type = 'professional'`
**On Delete:** CASCADE — when the parent listing is deleted, all its services are deleted.

| Field              | Type                                                             | Nullable | Default             | Notes                                                                                                                                                           | Phase |
| ------------------ | ---------------------------------------------------------------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `id`               | `uuid`                                                           | No       | `gen_random_uuid()` | Primary key.                                                                                                                                                    | MVP   |
| `listing_id`       | `uuid` FK → `listings.id` ON DELETE CASCADE                      | No       | —                   | The parent business or professional listing. NOT NULL.                                                                                                          | MVP   |
| `name`             | `text`                                                           | No       | —                   | Service name ("Loc Maintenance", "Business Coaching Session", "Brand Photography Package"). Displayed as the service item heading.                              | MVP   |
| `description`      | `text`                                                           | Yes      | —                   | Short description of what the service includes. Displayed below the name in the services list. Optional at MVP.                                                 | MVP   |
| `price`            | `numeric(10,2)`                                                  | Yes      | —                   | Price in USD. Null if the owner prefers to use `price_note` instead (e.g., "Contact for pricing").                                                              | V1    |
| `price_type`       | `text` CHECK IN ('fixed','starting-at','hourly','custom','free') | Yes      | —                   | Determines how the price is labeled. `starting-at` renders "From $X". `hourly` renders "$X / hour". `custom` renders the `price_note` string only. Null at MVP. | V1    |
| `price_note`       | `text`                                                           | Yes      | —                   | Free-text price note. Displayed when `price_type = 'custom'` or when additional context is needed ("Prices vary by length and texture").                        | V1    |
| `duration_minutes` | `integer`                                                        | Yes      | —                   | Estimated service duration in minutes. Displayed as "~60 min" when set. Useful for appointment-based services. Null if not applicable.                          | V1    |
| `cta_type`         | `text` CHECK IN ('book','inquire','call','contact')              | Yes      | —                   | Per-service CTA. When set, this overrides the listing-level CTA for this specific service. Null means the service inherits the parent listing's CTA.            | V1    |
| `cta_url`          | `text`                                                           | Yes      | —                   | Per-service CTA URL. Null when `cta_type` is null.                                                                                                              | V1    |
| `display_order`    | `integer`                                                        | No       | `0`                 | Integer controlling the sort order of services in the displayed list. Owner can reorder services via drag-and-drop.                                             | MVP   |
| `is_visible`       | `boolean`                                                        | No       | `true`              | Whether this service is shown on the public Page. Allows owners to temporarily hide a service (e.g., seasonal offering) without deleting it.                    | MVP   |
| `created_at`       | `timestamptz`                                                    | No       | `now()`             |                                                                                                                                                                 | MVP   |
| `updated_at`       | `timestamptz`                                                    | No       | `now()`             | Trigger-updated.                                                                                                                                                | MVP   |

---

## 5. CTA Type Catalog

This catalog defines every valid CTA type across the platform. Engineers use this table to implement CTA rendering logic. Product uses it to configure CTA options per entity type. Every CTA type must be in this catalog — do not add new CTA types without updating this document.

| CTA type       | Default label       | Entity types           | Click behavior                                  | Notes                                                                                  |
| -------------- | ------------------- | ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `book`         | "Book Now"          | Business, Professional | Opens `cta_url` in new tab                      | Calendar link, Calendly, booking system.                                               |
| `order`        | "Order Now"         | Business, Vendor       | Opens `cta_url` in new tab                      | External ordering link at MVP/Beta. In-platform cart in V2 for Vendors.                |
| `call`         | "Call Now"          | Business, Professional | `tel:` link using `phone` field                 | `cta_url` is null for call CTAs. Requires `phone` to be set.                           |
| `message`      | "Message Us"        | Business, Professional | Opens `cta_url` or `mailto:`                    | Can be a WhatsApp link, contact form URL, or mailto link.                              |
| `visit`        | "Visit Us"          | Business               | Opens `cta_url` or maps link                    | Default for businesses with a physical location.                                       |
| `get-quote`    | "Get a Quote"       | Business, Professional | Opens `cta_url` or `mailto:`                    | Contact form or quote request page URL.                                                |
| `shop`         | "Shop Now"          | Vendor                 | Scrolls to storefront or opens `cta_url`        | In-platform storefront scroll at V2. External link at MVP if Vendor has external shop. |
| `subscribe`    | "Subscribe"         | Business, Creative     | Opens `cta_url`                                 | Newsletter signup, membership page.                                                    |
| `contact`      | "Contact"           | Creative, Professional | Opens `cta_url` or `mailto:`                    | General contact — used when a more specific action type doesn't apply.                 |
| `commission`   | "Commission Me"     | Creative               | Opens `cta_url` or `mailto:`                    | Commission request form or contact link for custom work.                               |
| `inquire`      | "Inquire"           | Professional, Creative | Opens `cta_url` or `mailto:`                    | For services where the first step is an inquiry, not a direct booking.                 |
| `get-tickets`  | "Get Tickets"       | Event                  | Opens `ticket_url` or `cta_url` in new tab      | Eventbrite, Tock, or any ticketing platform.                                           |
| `rsvp`         | "RSVP"              | Event                  | Opens `rsvp_url` or `cta_url` in new tab        | For free events with RSVPs.                                                            |
| `register`     | "Register"          | Event                  | Opens `cta_url` in new tab                      | For events with a registration form (workshops, conferences).                          |
| `learn-more`   | "Learn More"        | Event, Job             | Opens `cta_url` in new tab                      | Used when no direct action (tickets, apply) is available yet.                          |
| `apply`        | "Apply Now"         | Job                    | Opens `apply_url` or `cta_url` in new tab       | Opens the employer's ATS, job board listing, or application email.                     |
| `buy-now`      | "Buy Now"           | Product                | Add to cart (V2 in-platform) or opens `cta_url` | In-platform cart at V2; external URL at MVP if referenced from an external context.    |
| `book-service` | "Book This Service" | Service                | Opens `cta_url` in new tab                      | Per-service booking link that overrides the parent listing's CTA.                      |

**CTA rendering rules:**

- `cta_label_override` (on `listing_details_business`) takes precedence over the default label when non-null.
- A `call` CTA renders as a `tel:` link — if `phone` is null, the CTA is not rendered and the Page falls back to the next available contact method.
- Every entity type must have a CTA configured — a Page with no CTA is an incomplete listing.

---

## 6. Media Fields

### 6.1 Base Listing Media

The two primary image fields on the `listings` base table. These are the only media fields stored directly on `listings` — all additional media is in `media_attachments`.

| Field              | Table      | Notes                                                                                                                                                                                   |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo_path`        | `listings` | Supabase Storage path in `listing-media` bucket. 400×400px recommended. Max 2MB. Converted to WebP by the upload handler. Used in search result cards, Page header, and as OG fallback. |
| `cover_image_path` | `listings` | Storage path for hero/cover. 1200×675px (16:9) recommended. Max 5MB. Used as the primary OG image. Falls back to `logo_path` for OG if null.                                            |

### 6.2 `media_attachments` Table

The polymorphic media store for all gallery images, portfolio items, and additional images for any entity type or sub-entity.

**Table:** `media_attachments`

| Field                  | Type                                           | Nullable | Default             | Notes                                                                                                                                                             |
| ---------------------- | ---------------------------------------------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `uuid`                                         | No       | `gen_random_uuid()` | Primary key.                                                                                                                                                      |
| `entity_type`          | `text` CHECK IN ('listing','product','review') | No       | —                   | The type of parent entity. `listing` covers all top-level entity types. `product` is for product gallery images. `review` is for V1 review photos.                |
| `entity_id`            | `uuid`                                         | No       | —                   | FK to the parent entity's `id`. Not a formal FK constraint (polymorphic) — enforced at the application layer. Indexed with `entity_type` for efficient filtering. |
| `file_path`            | `text`                                         | No       | —                   | Supabase Storage path in the `listing-media` bucket. Never store the CDN URL — generate signed or public URLs at read time.                                       |
| `file_type`            | `text`                                         | No       | —                   | MIME type string: `image/jpeg`, `image/png`, `image/webp`. Validated server-side before upload.                                                                   |
| `file_size_bytes`      | `integer`                                      | No       | —                   | File size in bytes. Used for storage usage tracking per tier.                                                                                                     |
| `display_order`        | `integer`                                      | No       | `0`                 | Sort order within the gallery for this entity. Owner can reorder via drag-and-drop.                                                                               |
| `alt_text`             | `text`                                         | Yes      | —                   | Owner-provided alt text for accessibility. If null, the rendering layer generates a generic alt from the listing name and position.                               |
| `is_portfolio_primary` | `boolean`                                      | No       | `false`             | For Creative entities: marks which image is featured at the top of the portfolio gallery. At most one image per listing should have this true.                    |
| `uploaded_by`          | `uuid` FK → `users.id` ON DELETE SET NULL      | Yes      | —                   | The user who uploaded this file. SET NULL if user is deleted. Used for audit and for filtering to show only owner-uploaded media.                                 |
| `created_at`           | `timestamptz`                                  | No       | `now()`             | Upload timestamp.                                                                                                                                                 |

### 6.3 Media Limits by Entity Type and Tier

| Entity type                         | Logo                                      | Cover image                         | Gallery (media_attachments)      |
| ----------------------------------- | ----------------------------------------- | ----------------------------------- | -------------------------------- |
| Business (Free tier)                | 1                                         | 1                                   | 6 max                            |
| Business (Standard or Premium tier) | 1                                         | 1                                   | 12 max                           |
| Professional                        | 1                                         | 1                                   | 8 max (portfolio images)         |
| Creative                            | 1                                         | 1                                   | 20 max (portfolio-primary first) |
| Event                               | —                                         | 1                                   | 6 max                            |
| Job                                 | 1 (company logo via `listings.logo_path`) | 1                                   | —                                |
| Vendor                              | 1                                         | 1                                   | 12 max                           |
| Product                             | —                                         | 1 (via `products.cover_image_path`) | 6 max                            |

Media limits are enforced at the application layer (server-side validation before upload), not at the database layer. The `listings.tier` field determines the gallery limit for Business listings. For all other entity types, the limit is fixed regardless of tier.

---

## 7. Location and Service Area Fields

Location data is split across two tables intentionally: `listings` holds the fields used for indexing, search filtering, and city-page association; `listing_details_business` (and other detail tables) holds the fields used for display.

| Field                      | Table                      | Type                                       | Nullable | Notes                                                                                                                      |
| -------------------------- | -------------------------- | ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `city_id`                  | `listings`                 | `uuid` FK → `cities.id` ON DELETE SET NULL | Yes      | Used for city landing page association and city-scoped search. Null for online-only.                                       |
| `location_type`            | `listings`                 | `text` enum                                | No       | Used in search filters and Page rendering. One of: `physical`, `online`, `hybrid`, `virtual-services`, `ships-nationwide`. |
| `service_area_description` | `listings`                 | `text`                                     | Yes      | Free-text service area. Indexed in full-text search.                                                                       |
| `ships_nationwide`         | `listings`                 | `boolean`                                  | No       | Search and filter signal for nationwide-shipping entities. Default false.                                                  |
| `address_line_1`           | `listing_details_business` | `text`                                     | Yes      | Street address.                                                                                                            |
| `address_line_2`           | `listing_details_business` | `text`                                     | Yes      | Suite, unit, floor.                                                                                                        |
| `city_text`                | `listing_details_business` | `text`                                     | Yes      | Denormalized city for display without JOIN.                                                                                |
| `state`                    | `listing_details_business` | `text`                                     | Yes      | Two-letter state code.                                                                                                     |
| `zip`                      | `listing_details_business` | `text`                                     | Yes      | ZIP code.                                                                                                                  |
| `lat`                      | `listing_details_business` | `numeric`                                  | Yes      | Latitude. Null until V2 geocoding.                                                                                         |
| `lng`                      | `listing_details_business` | `numeric`                                  | Yes      | Longitude. Null until V2 geocoding.                                                                                        |
| `location_address`         | `listing_details_event`    | `text`                                     | Yes      | Full address string for events.                                                                                            |
| `location_city_text`       | `listing_details_event`    | `text`                                     | Yes      | City name for event display.                                                                                               |
| `venue_name`               | `listing_details_event`    | `text`                                     | Yes      | Venue name for events.                                                                                                     |
| `location_address`         | `listing_details_job`      | `text`                                     | Yes      | Work location for jobs.                                                                                                    |
| `location_city_text`       | `listing_details_job`      | `text`                                     | Yes      | City name for job display.                                                                                                 |
| `location_state`           | `listing_details_job`      | `text`                                     | Yes      | State for job display.                                                                                                     |

**Design note:** The denormalized `city_text` fields on detail tables exist to render the address without joining to `cities`. When a listing's city is updated, both `city_id` on `listings` AND the `city_text` on the detail table must be updated in the same transaction.

---

## 8. Marketplace Connection Fields

Fields that connect entities to the V2 marketplace commerce layer. All Stripe fields are server-side only — never include `stripe_connect_id`, `stripe_product_id`, or `stripe_price_id` in any client-facing API response.

| Field                    | Table                    | Type                       | Notes                                                                                                                                                   |
| ------------------------ | ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_vendor`              | `listings`               | `boolean`, default `false` | Convenience flag. True when `entity_type = 'vendor'`. Updated in sync with entity_type. Allows filtering vendor-eligible entities without a type check. |
| `stripe_connect_id`      | `listing_details_vendor` | `text`, nullable           | Stripe Connect account ID. Server-side only.                                                                                                            |
| `stripe_connect_status`  | `listing_details_vendor` | `text` enum                | Synced from Stripe webhooks. Controls whether the vendor storefront is "open for business".                                                             |
| `stripe_product_id`      | `products`               | `text`, nullable           | Stripe Product object ID. Created when product goes active.                                                                                             |
| `stripe_price_id`        | `products`               | `text`, nullable           | Stripe Price object ID. Must be recreated when `price` changes.                                                                                         |
| `storefront_description` | `listing_details_vendor` | `text`, nullable           | Displayed above the product grid on the Vendor Page.                                                                                                    |
| `shipping_info`          | `listing_details_vendor` | `text`, nullable           | Shown in the storefront footer section.                                                                                                                 |
| `return_policy`          | `listing_details_vendor` | `text`, nullable           | Shown in the storefront footer section.                                                                                                                 |

---

## 9. Dollar-Flow Map Connection Fields

The dollar-flow map (V3) surfaces how money moves through the Black economy on the platform. The connection to listings is entirely through the `spend_events` table — no fields need to be added to `listings` for flow-map connectivity. The FK is on `spend_events.business_id`.

**Table:** `spend_events` (V2)

| Field               | Type                                                      | Nullable | Notes                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | `uuid` PK                                                 | No       |                                                                                                                                                                                                            |
| `business_id`       | `uuid` FK → `listings.id` ON DELETE SET NULL              | Yes      | The BLACQList Page the spend was attributed to. SET NULL if listing is deleted — preserves the spend record and the aggregate even after a listing is removed. Null for unattributed manual spend entries. |
| `vendor_listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL              | Yes      | Set for in-platform marketplace purchases (V2). Null for receipt-uploaded spend. SET NULL if listing deleted.                                                                                              |
| `user_id`           | `uuid` FK → `users.id` ON DELETE SET NULL                 | Yes      | The supporter who recorded or made the spend. SET NULL on user delete — preserves aggregate data.                                                                                                          |
| `amount`            | `numeric(10,2)`                                           | No       | Dollar amount. Not null — zero-value spend events should not be created.                                                                                                                                   |
| `source`            | `text` CHECK IN ('receipt-upload','marketplace-purchase') | No       | How the spend event was recorded. Used to filter in the spend dashboard.                                                                                                                                   |
| `category`          | `text`                                                    | Yes      | Spend category. Inferred by OCR for receipt uploads; set by product category for marketplace purchases.                                                                                                    |
| `date`              | `date`                                                    | No       | Date of the transaction. For receipt uploads, parsed from the receipt. For marketplace purchases, set at order time.                                                                                       |
| `ocr_confidence`    | `numeric(3,2)`                                            | Yes      | 0.00 to 1.00 — OCR confidence score for receipt-upload spend events. Null for marketplace purchases. Used to flag low-confidence attributions for manual review.                                           |
| `review_status`     | `text` CHECK IN ('pending','reviewed','flagged')          | No       | `'pending'`                                                                                                                                                                                                | `pending` = OCR or auto-attributed, not yet user-confirmed. `reviewed` = user confirmed the attribution and category. `flagged` = marked for admin review (potential misattribution). |
| `created_at`        | `timestamptz`                                             | No       | `now()`                                                                                                                                                                                                    |                                                                                                                                                                                       |
| `updated_at`        | `timestamptz`                                             | No       | `now()`                                                                                                                                                                                                    |                                                                                                                                                                                       |

**Dollar-flow map connectivity note:** The V3 map visualization reads from aggregated `spend_events` data grouped by `business_id`. No schema changes to `listings` are required for V3 compatibility — this FK relationship is established in V2 when `spend_events` is built.

---

## 10. SEO Fields

All SEO fields are on the `listings` base table. Rules for system-generated fallbacks:

| Field              | Fallback generation rule                                                                                  | Notes                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `meta_title`       | `"{name} — {category_name} in {city_name} — The BLACQList"`                                               | Max 60 chars. Truncated gracefully if generated title exceeds limit.                               |
| `meta_description` | First 160 characters of the entity's `description` field                                                  | Strips Markdown if description uses Markdown. Falls back to `tagline` if description is also null. |
| `og_image_path`    | Falls back to `cover_image_path` → `logo_path` → platform default OG image                                | Platform default is a branded BLACQList OG card.                                                   |
| `canonical_url`    | Generated from ADR-010 route structure: `/listing/{slug}` for businesses; entity-type variants as defined | System-managed. Never overridable by owners.                                                       |
| `json_ld_type`     | Inferred from `entity_type` per the mapping below                                                         | Can be overridden for edge cases.                                                                  |

**JSON-LD type mapping per entity type:**

| Entity type          | `json_ld_type` value                 | Schema.org notes                                                                                                   |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `business`           | `LocalBusiness`                      | More specific subtypes (RestaurantService, BeautyBusiness, etc.) applied by the rendering layer based on category. |
| `professional`       | `LocalBusiness`                      | With `@type: ["LocalBusiness", "ProfessionalService"]` for applicable categories.                                  |
| `creative`           | `Person` + `CreativeWork`            | Dual type. Person for the creative entity itself; CreativeWork for individual portfolio items.                     |
| `event`              | `Event`                              | Full Event JSON-LD with startDate, endDate, location, offers (for ticketed events).                                |
| `job`                | `JobPosting`                         | Full JobPosting JSON-LD with datePosted, validThrough, baseSalary, jobLocation.                                    |
| `vendor`             | `LocalBusiness` with `Store` subtype | Vendor storefronts use a Store subtype for better product search integration.                                      |
| Product (sub-entity) | `Product`                            | Product JSON-LD with offers, price, availability.                                                                  |
| Service (sub-entity) | `Service`                            | Service JSON-LD embedded in the parent entity's structured data.                                                   |

**Sitemap and indexing rules:**

- `sitemap_include` = false automatically when: `status` is not `published`, `noindex` is true, or `deleted_at` is set.
- `noindex` = true automatically when: status transitions to `archived` (for auto-archived events and expired jobs), or `flag_status` is not `none`.
- These fields must be re-evaluated whenever `status`, `flag_status`, or `deleted_at` changes — handled by a trigger or service layer hook.

---

## 11. Admin and Moderation Fields

All on the `listings` base table. Described fully in Section 3.7. Behavioral notes for engineers:

**`flag_status` behavior:**

- When `flag_status` is set to any value other than `'none'`, the listing is hidden from public search results and `noindex` is set to true.
- The listing remains visible in the admin dashboard filtered by flag status.
- Owners are shown `moderation_notes` in their dashboard when their listing is flagged.
- Setting `flag_status` back to `'none'` re-enables search visibility and sets `noindex` back to false (unless status is 'archived').

**`is_featured` constraint:**

- Only one listing should have `is_featured = true` at a time for each placement context. This is enforced at the application layer, not by a unique constraint (multiple featured slots may exist in V1 for different page zones — the constraint logic is product-defined, not just a single-row constraint).

**`is_sponsored` automation:**

- `is_sponsored` is set to true when a sponsored placement is purchased.
- `sponsored_expires_at` is set at purchase time.
- A scheduled function runs daily to set `is_sponsored = false` and `sponsored_expires_at = null` for expired placements.
- The `sponsored_placement_type` field determines in which context the sponsored badge and boosted position are applied by the rendering layer.

---

## 12. Verification Fields

Verification fields are on the `listings` base table. Described in Section 3.5 and 3.8.

**BLACQList Certified auto-grant criteria:**

A listing is auto-elevated to `trust_tier = 'certified'` and `certification_auto_granted_at` is set to `now()` when ALL of the following conditions are simultaneously true:

1. `trust_tier = 'verified'` — the listing has already completed human verification
2. Review count ≥ 6 — at least 6 rows in the `reviews` table where `listing_id = this listing` and `status = 'published'`
3. Average review rating ≥ 4.0 — computed from the same published reviews
4. `status = 'published'` — the listing is currently live
5. `published_at <= now() - interval '90 days'` — the listing has been published for at least 90 days

**Implementation approach:** This check should run as a database trigger on the `reviews` table (when a new review is inserted or updated to `status = 'published'`) rather than as a scheduled batch job. This ensures certification is granted promptly rather than waiting for the next batch window. The trigger should:

1. Compute the count and average for the listing associated with the new/updated review
2. Check all five criteria
3. If all five pass, update `listings.trust_tier = 'certified'` and `listings.certification_auto_granted_at = now()` for that listing

This certification check must run at the database level (trigger or Supabase Edge Function), not as application logic, to ensure it cannot be bypassed. Admins can manually revoke certification by resetting `trust_tier = 'verified'` and clearing `certification_auto_granted_at`.

---

## 13. Freshness Fields

Freshness fields are on the `listings` base table. Described in Section 3.9. Operational notes:

**`auto_archive_at` and `auto_expire_at` processing:**
A daily scheduled function (Supabase scheduled Edge Function or pg_cron job) queries for rows where:

- `auto_archive_at IS NOT NULL AND auto_archive_at <= now() AND status != 'archived'`
- OR `auto_expire_at IS NOT NULL AND auto_expire_at <= now() AND status != 'archived'`

For matching rows, the function sets: `status = 'archived'`, `noindex = true`, `sitemap_include = false`.

**`stale_flagged_at` processing:**
The same daily scheduled function also queries for rows where:

- `status = 'published'`
- AND (`last_edited_by_owner_at IS NULL OR last_edited_by_owner_at <= now() - interval '180 days'`)
- AND `stale_flagged_at IS NULL`

For matching rows, it sets `stale_flagged_at = now()`. These listings appear in the admin "Stale Listings" queue. When the owner next saves any edit, the application layer clears `stale_flagged_at = null`.

---

## 14. Phase Rollout Summary

This table summarizes which tables, field groups, and capabilities are available at each release phase. Use this when scoping migrations and implementation tickets.

| Capability                                                                             | MVP                                                          | Beta  | V1                                                                                           | V2                                                | V3     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| `listings` base table — all fields                                                     | Build all columns                                            | —     | —                                                                                            | —                                                 | —      |
| `listing_details_business`                                                             | Full                                                         | —     | `accepts_reservations`, `price_range`, `founded_year` added                                  | `lat`, `lng` added                                | —      |
| `listing_details_professional`                                                         | —                                                            | Build | `video_embed_url` added                                                                      | —                                                 | —      |
| `listing_details_creative`                                                             | —                                                            | Build | `video_embed_url` added                                                                      | —                                                 | —      |
| `listing_details_event`                                                                | —                                                            | Build | —                                                                                            | `is_recurring` active                             | —      |
| `listing_details_job`                                                                  | —                                                            | Build | —                                                                                            | —                                                 | —      |
| `listing_details_vendor`                                                               | —                                                            | —     | —                                                                                            | Build                                             | —      |
| `products` table                                                                       | —                                                            | —     | —                                                                                            | Build                                             | —      |
| `services` table                                                                       | Basic (`name`, `description`, `display_order`, `is_visible`) | —     | Full fields (`price`, `price_type`, `price_note`, `duration_minutes`, `cta_type`, `cta_url`) | —                                                 | —      |
| `media_attachments` table                                                              | Build                                                        | —     | —                                                                                            | `entity_type` CHECK expanded to include 'product' | —      |
| `spend_events` table                                                                   | —                                                            | —     | —                                                                                            | Build                                             | —      |
| `claims` table                                                                         | Build                                                        | —     | —                                                                                            | —                                                 | —      |
| `reviews` table                                                                        | Data model defined; not active                               | —     | Build and activate                                                                           | —                                                 | —      |
| Trust tier = 'unclaimed' / 'claimed'                                                   | Active                                                       | —     | —                                                                                            | —                                                 | —      |
| Trust tier = 'verified' / 'certified'                                                  | Data model only                                              | —     | Active (admin workflow)                                                                      | —                                                 | —      |
| Verification fields (`verification_status`, `verification_docs`, `verification_notes`) | Columns built                                                | —     | Workflow active                                                                              | —                                                 | —      |
| Certification auto-grant trigger                                                       | —                                                            | —     | Build                                                                                        | —                                                 | —      |
| Sponsored placement fields                                                             | Columns built                                                | —     | Active (sales-driven)                                                                        | Self-serve                                        | —      |
| `lat`, `lng` on business                                                               | Columns built (null)                                         | —     | —                                                                                            | Geocoding active                                  | —      |
| Stripe Connect fields on vendor                                                        | —                                                            | —     | —                                                                                            | Build and active                                  | —      |
| Stripe product/price IDs on products                                                   | —                                                            | —     | —                                                                                            | Build and active                                  | —      |
| `auto_archive_at` / `auto_expire_at` processing                                        | Logic built                                                  | —     | —                                                                                            | —                                                 | —      |
| `stale_flagged_at` processing                                                          | —                                                            | —     | Build                                                                                        | —                                                 | —      |
| Dollar-flow map visualization                                                          | —                                                            | —     | —                                                                                            | Data model only                                   | Active |
| AI optimization fields                                                                 | —                                                            | —     | —                                                                                            | —                                                 | Build  |

---

## 15. Data Privacy Inventory

Fields containing PII or data requiring special handling.

| Table                          | Column                             | Data classification      | Retention policy                           | Notes                                                                                                   |
| ------------------------------ | ---------------------------------- | ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `listing_details_business`     | `phone`                            | Contact info (PII)       | Until listing deleted or owner removes     | Public-facing by owner choice — but still PII                                                           |
| `listing_details_business`     | `email`                            | Contact info (PII)       | Until listing deleted or owner removes     | Public-facing by owner choice                                                                           |
| `listing_details_business`     | `address_line_1`, `address_line_2` | Location (PII-adjacent)  | Until listing deleted                      | Physical address of a business — public for physical locations; owner may choose to hide for home-based |
| `listing_details_professional` | `phone`, `email`                   | Contact info (PII)       | Until listing deleted or owner removes     | Same handling as business                                                                               |
| `listing_details_creative`     | `phone`, `email`                   | Contact info (PII)       | Until listing deleted or owner removes     |                                                                                                         |
| `listings`                     | `verification_docs`                | Sensitive documents      | Until verification decision made + 90 days | Business licenses, EINs. Admin-access only. Never public.                                               |
| `spend_events`                 | `user_id` + `amount` + `date`      | Financial behavior (PII) | Until user deletion request                | Aggregate data preserved anonymized; individual rows deleted on user GDPR request                       |

**Compliance notes:**

- The platform is US-only at launch; GDPR compliance is not a day-one requirement but should be designed for (soft-delete + `user_id` SET NULL pattern satisfies right-to-erasure for most tables).
- Verification documents must never be publicly accessible. Bucket policy on `verification-docs` must be private with admin-only signed URLs.
- Business contact information (phone, email, address) is public by owner consent when the listing is published. It is the owner's responsibility to determine what contact information to display.

---

## 16. Duplicate Detection Strategy

For every entity type with a natural key, the strategy for preventing duplicate records.

| Entity               | Natural key                                            | Detection strategy                                                                 | Response                                                                                                                  |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Business listing     | `(name, city_id, category_id)` normalized to lowercase | Similarity check (`pg_trgm`) before create. Surface matches with similarity > 0.6. | Warn the user with a duplicate candidate list before saving. "Continue anyway" or "Cancel" choice. Do not block silently. |
| Professional listing | `(name, city_id)` normalized                           | Same trgm similarity check                                                         | Same warning flow                                                                                                         |
| Event                | `(name, event_date, organizer_listing_id)`             | Exact match check before create                                                    | Warn and confirm. Recurring events allowed if `is_recurring` is true.                                                     |
| Job                  | `(role_title, employer_listing_id, deadline)`          | Exact match check before create                                                    | Warn and confirm. Same role with different deadlines is a new listing.                                                    |
| Vendor               | Inherits Business duplicate rules                      | Same as Business                                                                   | Same as Business                                                                                                          |
| Product              | `(vendor_listing_id, name, sku)` normalized            | Exact match on SKU if provided; name similarity check otherwise                    | Return 409 with the matching product's ID if SKU matches. Warn on name similarity.                                        |
| Service              | `(listing_id, name)` normalized                        | Name similarity check on the parent listing's services                             | Warn before creating. Allow duplicates on explicit confirmation.                                                          |

---

## 17. Open Questions

| Question                                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner                  | Status | Relevant phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------ | -------------- |
| Should `subcategory_ids` be a formal FK array or remain a text array? If the categories table supports subcategories, a UUID array with application-layer validation is workable but not ideal. Consider a `listing_subcategories` junction table at V1.                                                                                                                                                                                             | Architecture           | Open   | V1             |
| Should `listing_details_professional` and `listing_details_creative` share a base detail table given their similarity, or remain separate? Separate tables are cleaner for future divergence.                                                                                                                                                                                                                                                        | Architecture           | Open   | Beta           |
| Is `entity_type = 'vendor'` the right model for Business ↔ Vendor overlap, or should a listing be able to have both `listing_details_business` AND `listing_details_vendor` without changing `entity_type`? The current model changes `entity_type` to `'vendor'` — this is simpler but means the Page is classified as a vendor, not a business. Consider whether a business listing should be able to "add vendor features" without reclassifying. | Product + Architecture | Open   | V2             |
| Should the certification trigger be a PostgreSQL trigger function or a Supabase Edge Function invoked by a trigger? PostgreSQL triggers are more reliable but harder to test; Edge Functions are easier to monitor but add latency.                                                                                                                                                                                                                  | Engineering            | Open   | V1             |
| How should `verification_docs` handle document expiry? Some documents (business licenses) expire and must be renewed. A separate `verification_submissions` table with a renewal workflow may be needed in V2.                                                                                                                                                                                                                                       | Product                | Open   | V2             |
