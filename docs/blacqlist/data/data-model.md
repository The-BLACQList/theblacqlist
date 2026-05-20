# Data Model — The BLACQList

**Product:** The BLACQList
**Database:** Supabase / PostgreSQL
**Date:** 2026-05-07
**Status:** Approved — pre-migration reference
**Linked content model:** `docs/blacqlist/data/entity-content-model.md`
**Linked architecture decisions:** `docs/blacqlist/architecture/architecture-decisions.md`
**Linked enum reference:** `docs/blacqlist/data/enums-and-statuses.md`

---

## 1. Overview

### Design Philosophy

The BLACQList data model is organized around a single principle: every listed entity — regardless of type — shares one base record in `listings`. Entity-type-specific fields live in `listing_details_*` extension tables, each carrying a one-to-one FK back to `listings.id`. This is documented as the official architecture decision in ADR-012.

**Base + extension pattern:** `listings` holds all search, discovery, SEO, status, trust, and admin fields that apply uniformly across all entity types. Adding a new entity type requires only a new `listing_details_*` table — no modifications to the base. RLS policies on `listings` apply universally; extension tables inherit access through their FK.

**UUID primary keys throughout:** All tables use `uuid DEFAULT gen_random_uuid()` as their primary key. This avoids sequential integer enumeration attacks on public-facing IDs and is consistent with Supabase Auth's `auth.users.id` type.

**Soft deletes on all entity tables:** Entity records use `deleted_at timestamptz` (soft delete). All default queries filter `WHERE deleted_at IS NULL`. RLS policies enforce this automatically, eliminating the risk of accidentally reading deleted records in application code.

**`updated_at` auto-updated by trigger:** Every table that has `updated_at` has a corresponding `set_updated_at` trigger that fires on every UPDATE. This is never managed by application code.

**RLS-first design:** Row Level Security is enabled on all tables. Anon role gets read access to published, non-deleted records only. Authenticated role gets read/write access to their own records. Service role bypasses RLS for admin and background job operations.

**"Entity" is the product term; `listing` is the database naming convention.** Engineers write `listings`; the product, marketing, and UX team say "entity" or "BLACQList Page." These are the same thing.

### Scale Context

65 total tables across 5 phases:
- **MVP (21 tables):** Must exist before public launch
- **Beta (10 tables):** 4–8 weeks post-MVP; additional entity types and community features
- **V1 (9 tables):** 8–12 weeks post-MVP; subscriptions, editorial, verification workflow
- **V2 (15 tables):** 10–14 weeks post-V1; marketplace, AI, receipt tracking
- **V3+ (10 tables):** Dollar-flow map, autonomous agents, sponsor campaigns

---

## 2. Domain Map

Eight domains organize the 65 tables by function. Tables appear in the domain where they primarily belong; cross-domain relationships are documented in Section 3.

### Identity
| Table | Phase | Description |
|---|---|---|
| `profiles` | MVP | User display info; mirrors `auth.users` via trigger |
| `user_roles` | MVP | Role assignments per user (supporter, owner, editor, admin, super_admin) |

### Entities
| Table | Phase | Description |
|---|---|---|
| `listings` | MVP | Base entity record; all discovery, search, status, trust, SEO, admin fields |
| `listing_details_business` | MVP | Business-specific extension: description, hours, address, contact, social, CTA config, price_range |
| `listing_details_professional` | Beta | Professional-specific extension: headline, bio, credentials, specialties, consultation_type, CTA config |
| `listing_details_creative` | Beta | Creative-specific extension: bio, medium_genre, portfolio_statement, commission_status, CTA config |
| `listing_details_event` | Beta | Event-specific extension: event_date, timezone, venue, ticket/rsvp URLs, organizer_listing_id |
| `listing_details_job` | Beta | Job-specific extension: role_title, employment_type, location_type, salary_range, apply_url |
| `listing_details_vendor` | V2 | Vendor marketplace extension: storefront_description, Stripe Connect fields, shipping/return policy |

### Entity Sub-tables
| Table | Phase | Description |
|---|---|---|
| `services` | MVP | Service offerings; child of business/professional listings |
| `products` | V2 | Product catalog; child of vendor listings |
| `product_variants` | V2 | Variant options per product (size, color, etc.) |
| `listing_hours` | MVP | Structured day-of-week hours rows; replaces jsonb hours field for query-ability |
| `listing_links` | MVP | Flexible additional social/external links beyond the fixed social columns |
| `listing_ctas` | V3 | Multiple CTA configurations per listing with placement context |
| `listing_tags` | Beta | Junction: listings ↔ tags |
| `listing_service_areas` | V2 | Structured service area definitions (zip, city, radius, state) |
| `media_attachments` | MVP | Polymorphic media store (entity_type: listing/product/review) |

### Discovery and Community
| Table | Phase | Description |
|---|---|---|
| `categories` | MVP | Hierarchical category tree; parent_id self-FK for subcategories |
| `cities` | MVP | City reference: name, slug, state_id, metro_area, lat, lng, active |
| `states` | MVP | State reference: name, code, country |
| `neighborhoods` | Beta | Neighborhood reference; city-scoped |
| `tags` | Beta | Free-form discovery tags; usage_count maintained by trigger |
| `saves` | MVP | User-to-listing save associations |
| `corrections` | Beta | Community corrections queue; field-level suggested edits |
| `reviews` | MVP | Star ratings and text reviews (intake-only at MVP; display at V1) |
| `review_responses` | Beta | Owner responses to published reviews |
| `review_reports` | Beta | User reports of inappropriate reviews |

### Commerce
| Table | Phase | Description |
|---|---|---|
| `claims` | MVP | Ownership claim workflow queue |
| `verification_submissions` | V1 | Per-cycle document intake for verified trust tier |
| `subscriptions` | V1 | Active Stripe subscriptions per listing |
| `plans` | V1 | Subscription plan tiers with Stripe price IDs |
| `orders` | V2 | Marketplace orders (buyer, vendor, status, totals, Stripe payment intent) |
| `order_items` | V2 | Line items within an order |
| `coupons` | V2 | Discount codes; vendor-scoped or platform-wide |
| `invoices` | V3 | Payment references (subscription, placement, marketplace fee) |
| `service_packages` | V3 | Bundled service tiers for professional/business listings |
| `receipt_uploads` | V2 | Raw receipt intake for spend tracking |
| `spend_events` | V2 | Processed spend records attributed to listings |

### Editorial
| Table | Phase | Description |
|---|---|---|
| `collections` | MVP | Curated listing groups; admin-created at MVP |
| `collection_items` | MVP | Junction: collections ↔ listings with display_order |
| `editorial_articles` | V1 | BLACQLight editorial articles |
| `guides` | V1 | City guides with markdown sections |
| `guide_sections` | V1 | Individual sections within a guide; listing callout IDs |
| `featured_slots` | V1 | Managed editorial featured slots by placement context |
| `sponsored_placements` | V1 | Active paid sponsored placements |
| `sponsor_campaigns` | V3 | Sponsor campaign management with budget and targeting |

### Analytics and Intelligence
| Table | Phase | Description |
|---|---|---|
| `analytics_events` | MVP | Raw analytics event log; all 45 event types |
| `search_events` | MVP | Enriched search query log with result counts and click tracking |
| `entity_analytics_daily` | MVP | Precomputed daily stats per listing |
| `platform_analytics_daily` | V1 | Platform-wide daily aggregate stats |
| `community_impact_daily` | V2 | Anonymized spend aggregates by city/category; no user FKs |
| `flow_nodes` | V3 | Graph entity nodes for dollar-flow map |
| `flow_edges` | V3 | Money flow edges between nodes |
| `flow_map_snapshots` | V3 | Precomputed graph state for fast rendering |
| `anonymized_community_nodes` | V3 | Public aggregate nodes for visualization without user exposure |
| `vendor_relationships` | V3 | Inferred B2B spend patterns between vendors |
| `ai_suggestions` | V2 | AI-generated owner suggestions per listing |
| `ai_generation_requests` | V2 | API rate-limit and audit log for AI calls |
| `ai_moderation_flags` | V2 | AI-flagged content pending human review |
| `ai_agent_runs` | V3 | Autonomous agent execution logs |

### Admin
| Table | Phase | Description |
|---|---|---|
| `admin_audit_log` | MVP | Immutable admin action log with before/after state |
| `moderation_queue` | MVP | Unified queue for all pending admin review items |
| `event_vendors` | V2 | Vendors participating at event listings |
| `event_sponsors` | V2 | Brands sponsoring event listings |

---

## 3. Core Entity Relationships

### Identity Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `auth.users` → `profiles` | 1:1 | `profiles.id = auth.users.id` | CASCADE | Profiles row created by trigger on `auth.users` INSERT. Profile `id` is the same UUID as `auth.users.id`. |
| `profiles` → `user_roles` | 1:N | `user_roles.user_id → profiles.id` | CASCADE | One user can hold multiple roles. |

### Entities Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `listings` → `listing_details_business` | 1:1 | `listing_details_business.listing_id → listings.id` | CASCADE | UNIQUE on listing_id enforces one-to-one. |
| `listings` → `listing_details_professional` | 1:1 | `listing_details_professional.listing_id → listings.id` | CASCADE | UNIQUE on listing_id enforces one-to-one. |
| `listings` → `listing_details_creative` | 1:1 | `listing_details_creative.listing_id → listings.id` | CASCADE | UNIQUE on listing_id enforces one-to-one. |
| `listings` → `listing_details_event` | 1:1 | `listing_details_event.listing_id → listings.id` | CASCADE | UNIQUE on listing_id enforces one-to-one. |
| `listings` → `listing_details_job` | 1:1 | `listing_details_job.listing_id → listings.id` | CASCADE | UNIQUE on listing_id enforces one-to-one. |
| `listings` → `listing_details_vendor` | 1:1 | `listing_details_vendor.listing_id → listings.id` | CASCADE | UNIQUE on listing_id. Vendor entity_type also has a listing_details_business row — same listing_id, two extension rows. |
| `listings` → `services` | 1:N | `services.listing_id → listings.id` | CASCADE | Business and professional listings only. |
| `listings` → `products` | 1:N | `products.vendor_listing_id → listings.id` | CASCADE | Vendor listings only. |
| `listings` → `product_variants` | via `products` | `product_variants.product_id → products.id` | CASCADE | Variants are children of products, not direct listing children. |
| `listings` → `listing_hours` | 1:N | `listing_hours.listing_id → listings.id` | CASCADE | Up to 7 rows (one per day of week). |
| `listings` → `listing_links` | 1:N | `listing_links.listing_id → listings.id` | CASCADE | Flexible additional links beyond fixed social columns. |
| `listings` → `media_attachments` | 1:N | `media_attachments.entity_id` (where entity_type='listing') | CASCADE (app-enforced) | Polymorphic FK; no formal constraint. App enforces ON DELETE CASCADE behavior. |

### Discovery and Community Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `listings` → `categories` | N:1 | `listings.category_id → categories.id` | RESTRICT | Cannot delete a category that has listings. |
| `categories` → `categories` | self | `categories.parent_id → categories.id` | SET NULL | Subcategories become top-level if parent deleted. |
| `listings` → `cities` | N:1 | `listings.city_id → cities.id` | SET NULL | Null for online-only or ships-nationwide listings. |
| `cities` → `states` | N:1 | `cities.state_id → states.id` | RESTRICT | Cannot delete a state that has cities. |
| `listings` → `saves` | 1:N | `saves.listing_id → listings.id` | CASCADE | Save records deleted with the listing. |
| `profiles` → `saves` | 1:N | `saves.user_id → profiles.id` | CASCADE | Save records deleted with the user profile. |
| `listings` → `reviews` | 1:N | `reviews.listing_id → listings.id` | CASCADE | |
| `profiles` → `reviews` | 1:N | `reviews.reviewer_user_id → profiles.id` | SET NULL | Reviews preserved with null user when reviewer is deleted. |
| `reviews` → `review_responses` | 1:1 | `review_responses.review_id → reviews.id` | CASCADE | One owner response per review. |
| `listings` → `corrections` | 1:N | `corrections.listing_id → listings.id` | CASCADE | |
| `listings` → `listing_tags` | M:N via `listing_tags` | `listing_tags.listing_id → listings.id` | CASCADE | |
| `tags` → `listing_tags` | M:N via `listing_tags` | `listing_tags.tag_id → tags.id` | CASCADE | |
| `neighborhoods` → `cities` | N:1 | `neighborhoods.city_id → cities.id` | CASCADE | Neighborhoods deleted with their city. |

### Editorial Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `listings` → `collections` | M:N via `collection_items` | `collection_items.listing_id → listings.id` | CASCADE | |
| `collections` → `collection_items` | 1:N | `collection_items.collection_id → collections.id` | CASCADE | |
| `listings` → `featured_slots` | 1:N | `featured_slots.listing_id → listings.id` | SET NULL | Featured slot preserved (cleared) when listing deleted. |
| `listings` → `sponsored_placements` | 1:N | `sponsored_placements.listing_id → listings.id` | CASCADE | |

### Commerce Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `listings` → `claims` | 1:N | `claims.listing_id → listings.id` | CASCADE | Many claims over time; at most one approved per listing. |
| `profiles` → `claims` | 1:N | `claims.claimant_user_id → profiles.id` | SET NULL | Claim preserved when claimant user deleted. |
| `listings` → `subscriptions` | 1:1 | `subscriptions.listing_id → listings.id` | CASCADE | One active subscription per listing. |
| `plans` → `subscriptions` | 1:N | `subscriptions.plan_id → plans.id` | RESTRICT | Cannot delete a plan with active subscriptions. |
| `listings` → `orders` | 1:N | `orders.vendor_listing_id → listings.id` | SET NULL | Orders preserved when vendor listing deleted. |
| `profiles` → `orders` | 1:N | `orders.buyer_user_id → profiles.id` | SET NULL | Orders preserved when buyer profile deleted. |
| `orders` → `order_items` | 1:N | `order_items.order_id → orders.id` | CASCADE | |
| `products` → `order_items` | 1:N | `order_items.product_id → products.id` | SET NULL | Order items preserved (product snapshot retained) when product deleted. |
| `listings` → `verification_submissions` | 1:N | `verification_submissions.listing_id → listings.id` | CASCADE | |
| `profiles` → `spend_events` | 1:N | `spend_events.user_id → profiles.id` | SET NULL | Spend records preserved anonymized when user deleted. |
| `listings` → `spend_events` | 1:N | `spend_events.listing_id → listings.id` | SET NULL | Spend records preserved when listing deleted. |

### Analytics Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `listings` → `analytics_events` | 1:N | `analytics_events.listing_id → listings.id` | SET NULL | listing_id is nullable; platform-level events have null listing_id. |
| `listings` → `entity_analytics_daily` | 1:N | `entity_analytics_daily.listing_id → listings.id` | CASCADE | Daily stats deleted with listing. |

### Admin Domain

| Relationship | Type | FK | ON DELETE | Notes |
|---|---|---|---|---|
| `admin_audit_log` | append-only | `admin_audit_log.admin_user_id → profiles.id` | SET NULL | Audit log is immutable — no updates, no deletes. SET NULL on admin user delete. |
| `moderation_queue` → `profiles` | N:1 | `moderation_queue.assigned_to → profiles.id` | SET NULL | Unassigned when admin user deleted. |

---

## 4. Phase Architecture

Complete table inventory ordered by phase, then by dependency within the phase.

| # | Table | Phase | Trigger for Creation |
|---|---|---|---|
| 1 | `states` | **MVP** | Geographic reference required before cities |
| 2 | `cities` | **MVP** | Geographic reference required before listings |
| 3 | `categories` | **MVP** | Category reference required before listings |
| 4 | `profiles` | **MVP** | Synced from auth.users on signup |
| 5 | `user_roles` | **MVP** | Role assignment requires profiles |
| 6 | `listings` | **MVP** | Core entity table — everything depends on it |
| 7 | `listing_details_business` | **MVP** | Only extension table built at MVP |
| 8 | `listing_hours` | **MVP** | Structured hours; replaces jsonb for business listings |
| 9 | `listing_links` | **MVP** | Flexible link storage beyond fixed social columns |
| 10 | `services` | **MVP** | Basic service listings under business entities |
| 11 | `media_attachments` | **MVP** | Gallery images for listings |
| 12 | `claims` | **MVP** | Ownership claim workflow |
| 13 | `saves` | **MVP** | User bookmark associations |
| 14 | `reviews` | **MVP** | Schema built at MVP; intake-only; display at V1 |
| 15 | `collections` | **MVP** | Admin-curated listing groups |
| 16 | `collection_items` | **MVP** | Junction for collections ↔ listings |
| 17 | `analytics_events` | **MVP** | Event log for all user interactions |
| 18 | `search_events` | **MVP** | Enriched search query log |
| 19 | `entity_analytics_daily` | **MVP** | Daily aggregate stats per listing |
| 20 | `admin_audit_log` | **MVP** | Immutable admin action log |
| 21 | `moderation_queue` | **MVP** | Unified admin review queue |
| 22 | `listing_details_professional` | **Beta** | Professional entity type |
| 23 | `listing_details_creative` | **Beta** | Creative entity type |
| 24 | `listing_details_event` | **Beta** | Event entity type |
| 25 | `listing_details_job` | **Beta** | Job entity type |
| 26 | `corrections` | **Beta** | Community correction submissions |
| 27 | `review_responses` | **Beta** | Owner responses to reviews |
| 28 | `review_reports` | **Beta** | User reports on reviews |
| 29 | `tags` | **Beta** | Free-form discovery tags |
| 30 | `listing_tags` | **Beta** | Listings ↔ tags junction |
| 31 | `neighborhoods` | **Beta** | Neighborhood geo reference |
| 32 | `plans` | **V1** | Subscription tier definitions |
| 33 | `subscriptions` | **V1** | Active Stripe subscriptions |
| 34 | `sponsored_placements` | **V1** | Paid placement records |
| 35 | `featured_slots` | **V1** | Editorial featured slot management |
| 36 | `editorial_articles` | **V1** | BLACQLight editorial content |
| 37 | `guides` | **V1** | City guide pages |
| 38 | `guide_sections` | **V1** | Sections within guides |
| 39 | `verification_submissions` | **V1** | Document intake for verification workflow |
| 40 | `platform_analytics_daily` | **V1** | Platform-wide daily aggregate stats |
| 41 | `listing_details_vendor` | **V2** | Vendor marketplace extension |
| 42 | `products` | **V2** | Vendor product catalog |
| 43 | `product_variants` | **V2** | Product variant options |
| 44 | `orders` | **V2** | Marketplace order records |
| 45 | `order_items` | **V2** | Order line items |
| 46 | `coupons` | **V2** | Discount codes |
| 47 | `receipt_uploads` | **V2** | Raw receipt image intake |
| 48 | `spend_events` | **V2** | Processed spend attribution records |
| 49 | `listing_service_areas` | **V2** | Structured service area definitions |
| 50 | `ai_suggestions` | **V2** | AI-generated listing optimization suggestions |
| 51 | `ai_generation_requests` | **V2** | AI API call log and rate-limit tracking |
| 52 | `ai_moderation_flags` | **V2** | AI content moderation flags |
| 53 | `event_vendors` | **V2** | Vendors at event listings |
| 54 | `event_sponsors` | **V2** | Brands sponsoring events |
| 55 | `community_impact_daily` | **V2** | Anonymized community spend aggregates |
| 56 | `flow_nodes` | **V3** | Dollar-flow map graph entity nodes |
| 57 | `flow_edges` | **V3** | Dollar-flow map graph edges (money flows) |
| 58 | `flow_map_snapshots` | **V3** | Precomputed graph state snapshots |
| 59 | `anonymized_community_nodes` | **V3** | Public aggregate nodes for visualization |
| 60 | `vendor_relationships` | **V3** | Inferred B2B spend patterns |
| 61 | `sponsor_campaigns` | **V3** | Sponsor campaign management |
| 62 | `invoices` | **V3** | Payment record references |
| 63 | `service_packages` | **V3** | Bundled service tiers per listing |
| 64 | `ai_agent_runs` | **V3** | Autonomous agent execution logs |
| 65 | `listing_ctas` | **V3** | Multiple CTA configurations per listing |

---

## 5. Trust Tier Data Model

### State Machine

```
unclaimed
  → [claim approved by admin] → claimed
    → [V1: verification docs submitted] → verified (via verification_status workflow)
      → [auto-grant trigger: all 5 criteria met] → certified
        → [admin manual revoke] → verified
      → [admin revoke docs] → claimed
    → [admin revoke claim] → unclaimed
```

### Trust Tier Definitions

| Tier | How Set | Data Requirements | Display | Unlocks |
|---|---|---|---|---|
| `unclaimed` | Default on create | None | "Unclaimed" badge (gray) | Basic Page visibility |
| `claimed` | Admin approves claim via `claims` workflow | Approved row in `claims` table; `listings.claim_id` set; `listings.owner_user_id` set | "Claimed" badge (blue) | Owner can edit Page, upload media, configure CTA |
| `verified` | V1: Admin approves verification submission | `verification_submissions` decision = approved; `listings.verified_at` set; `listings.verified_by` set | "Verified" badge (green) | Higher search placement; verified badge on Page |
| `certified` | Auto-grant trigger on `reviews` table | All 5 criteria met simultaneously (see below) | "BLACQList Certified" badge (Amber Gold) | Premium badge treatment; highest search trust signal |

### BLACQList Certified Auto-Grant Criteria

All five conditions must be simultaneously true for the trigger to execute:

| # | Condition | Table/Field |
|---|---|---|
| 1 | `trust_tier = 'verified'` | `listings.trust_tier` |
| 2 | ≥ 6 published reviews for this listing | `reviews WHERE listing_id = [id] AND status = 'published'` |
| 3 | Average published review rating ≥ 4.0 | `AVG(reviews.star_rating) WHERE listing_id = [id] AND status = 'published'` |
| 4 | `listings.status = 'published'` | `listings.status` |
| 5 | Published for ≥ 90 days | `listings.published_at <= now() - interval '90 days'` |

**Trigger placement:** Database trigger on `reviews` table fires on INSERT and on UPDATE where `status` changes to `'published'`. Trigger computes criteria 2 and 3 for the associated listing, then checks criteria 1, 4, and 5. If all five pass: `UPDATE listings SET trust_tier = 'certified', certification_auto_granted_at = now() WHERE id = [listing_id]`.

**Revocation:** Admin resets `trust_tier = 'verified'` and `certification_auto_granted_at = NULL` manually. No automated revocation path. If a review is removed (reducing count below 6 or average below 4.0), certification is not automatically revoked — it requires admin action. This is intentional: certification is an achievement, not a continuously recalculated score.

**Open decision:** PostgreSQL trigger function vs. Supabase Edge Function invoked by a trigger. See Section 10.

### Fields Used in Trust Workflow

| Field | Table | Notes |
|---|---|---|
| `trust_tier` | `listings` | Public-facing trust level |
| `claim_id` | `listings` | FK to the approved claim record |
| `owner_user_id` | `listings` | Set during claim approval |
| `verified_at` | `listings` | Timestamp of verification approval (V1) |
| `verified_by` | `listings` | Admin user who approved (V1) |
| `certification_auto_granted_at` | `listings` | Auto-set by trigger; presence indicates auto-grant (V1) |
| `verification_status` | `listings` | Workflow state: none / pending / under_review / verified / rejected |
| `verification_docs` | `listings` | Storage paths for uploaded docs (V1) |
| `verification_notes` | `listings` | Admin decision notes shown to owner on rejection (V1) |
| `status` (workflow) | `claims` | pending / under_review / approved / rejected |
| `decision` | `verification_submissions` | approved / rejected (V1) |

---

## 6. Search Architecture

### Full-Text Search: tsvector

**Field:** `listings.search_vector tsvector`
**Index:** `CREATE INDEX listings_search_vector_idx ON listings USING GIN (search_vector)`
**Populated by:** Trigger on INSERT and UPDATE of relevant fields

**Weight composition:**

| Weight | Field(s) | Rationale |
|---|---|---|
| A (highest) | `listings.name` | Name is the strongest signal for intent match |
| B | `categories.name` (denormalized at index time), `cities.name` (denormalized) | Category and city are the most common filters |
| C | Entity description field (varies by entity_type), `listings.tagline` | Content match; lower priority than identity |
| D (lowest) | `listings.service_area_description` | Supplementary geographic context |

**Trigger logic (simplified):**
```
UPDATE listings.search_vector = (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce([category_name], '')), 'B') ||
  setweight(to_tsvector('english', coalesce([city_name], '')), 'B') ||
  setweight(to_tsvector('english', coalesce([description], '') || ' ' || coalesce(tagline, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(service_area_description, '')), 'D')
)
WHERE id = NEW.id
```

Category name and city name are resolved at index time via lookup; the tsvector is not updated when a category or city name changes (rare; acceptable at MVP scale).

### Fuzzy Matching: pg_trgm

**Extension:** `pg_trgm` (enabled in Supabase by default)
**Index:** `CREATE INDEX listings_name_trgm_idx ON listings USING GIN (name gin_trgm_ops)`
**Use:** Typo-tolerant name search; similarity threshold 0.3 for suggestion matching, 0.6 for duplicate detection (see entity-content-model.md Section 16)

### Search Combination Strategy

At MVP, queries combine:
1. Full-text search via `search_vector @@ to_tsquery(...)` for ranked results
2. `pg_trgm` similarity on `name` for "did you mean" suggestions
3. Equality filters on `category_id`, `city_id`, `location_type`, `trust_tier`, `tier`

All search queries must include `WHERE listings.status = 'published' AND listings.deleted_at IS NULL` (enforced by RLS policy on the anon role).

### Upgrade Trigger

Migrate to Algolia or Typesense when **either** condition is met:
- 50,000+ published listings
- p99 search latency > 500ms at peak traffic

The switch requires no schema changes to `listings` — only the search query layer changes. The `search_vector` field can be deprecated or kept as a fallback.

---

## 7. Analytics Data Architecture

Three layers of analytics data, each with a distinct purpose and query pattern.

### Layer 1: Raw Events

**`analytics_events`** — All user interaction events across the platform.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `event_name` | `text` | One of the 45 defined event names (see `enums-and-statuses.md` Section 10) |
| `listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL | Nullable; null for platform-level events (search, homepage views) |
| `user_id` | `uuid` FK → `profiles.id` ON DELETE SET NULL | Nullable for anon sessions |
| `session_id` | `text` | Client-generated session token; used to group events in a single visit |
| `properties` | `jsonb` | Event-specific data. Shape varies by event_name; documented in enums-and-statuses.md |
| `created_at` | `timestamptz` | Event timestamp; NOT updated_at — this table is append-only |

**No `updated_at` on `analytics_events`.** This table is append-only. Never update or delete rows except for GDPR erasure (SET NULL on user_id; do not delete the row — aggregate integrity depends on the row count).

**`search_events`** — Enriched search log with query, filters, result count, and click-through tracking.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `query` | `text` | Raw search query string |
| `filters` | `jsonb` | Active filters at search time: `{city_id, category_id, location_type, trust_tier}` |
| `result_count` | `integer` | Number of results returned |
| `clicked_listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL | The listing clicked from results; null if no click |
| `clicked_position` | `integer` | Position in results (1-indexed) of the clicked listing |
| `user_id` | `uuid` FK → `profiles.id` ON DELETE SET NULL | Nullable for anon |
| `session_id` | `text` | Session token for grouping |
| `created_at` | `timestamptz` | Query timestamp |

### Layer 2: Daily Aggregates

**`entity_analytics_daily`** — Precomputed daily stats per listing. Populated by a scheduled daily job that aggregates Layer 1 events.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `listing_id` | `uuid` FK → `listings.id` ON DELETE CASCADE | |
| `date` | `date` | The calendar date this row covers |
| `page_views` | `integer` | Count of `page_view` events |
| `cta_clicks` | `integer` | Count of any `*_cta_click` or action bar click events |
| `saves` | `integer` | Count of `save_toggled` events with direction = 'saved' |
| `shares` | `integer` | Count of `share_initiated` events |
| `search_impressions` | `integer` | Count of times this listing appeared in a search result set |
| `created_at` | `timestamptz` | When this aggregate row was computed |

UNIQUE constraint on `(listing_id, date)` — one row per listing per day. Aggregation job uses `INSERT ... ON CONFLICT DO UPDATE` for idempotency.

**`platform_analytics_daily`** (V1) — Platform-wide daily stats for the admin dashboard.

| Field | Type | Notes |
|---|---|---|
| `date` | `date` | PK |
| `total_published_listings` | `integer` | Snapshot count at end of day |
| `new_listings` | `integer` | New listings created that day |
| `total_searches` | `integer` | Count from search_events |
| `total_saves` | `integer` | Count from analytics_events |
| `total_page_views` | `integer` | Count from analytics_events |
| `new_users` | `integer` | New profile rows created |
| `total_claims` | `integer` | Claims submitted |
| `total_reviews` | `integer` | Reviews submitted |

### Layer 3: Community Impact

**`community_impact_daily`** (V2) — Anonymized spend aggregates by city and category. No user FKs. No individual spend attribution. Used for the community impact visualization and public "dollars circulated" metrics.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `date` | `date` | Calendar date |
| `city_id` | `uuid` FK → `cities.id` ON DELETE CASCADE | |
| `category_id` | `uuid` FK → `categories.id` ON DELETE CASCADE | |
| `total_spend_usd` | `numeric(14,2)` | Sum of all attributed spend for this city/category/date |
| `transaction_count` | `integer` | Number of spend events contributing to this aggregate |
| `created_at` | `timestamptz` | When computed |

### Event-to-Aggregate Feed Logic

The daily aggregation job (Supabase scheduled Edge Function or pg_cron) runs at 00:05 UTC and processes the previous calendar day:

```
page_view events → entity_analytics_daily.page_views
action_bar_cta_click + hero_cta_click + [any cta click] → entity_analytics_daily.cta_clicks
save_toggled WHERE direction='saved' → entity_analytics_daily.saves
share_initiated → entity_analytics_daily.shares
[search_events.clicked_listing_id] → entity_analytics_daily.search_impressions (from search_events table)
```

Owner analytics access (V1): owners of `standard` or `premium` tier listings can query `entity_analytics_daily` for their own listing via RLS. Free tier listings are eligible for a 30-day summary only (enforced in the API layer, not RLS).

---

## 8. Flow Map Data Architecture (V3, designed in V2)

The dollar-flow map visualizes how money moves through the Black community on the platform. It is a V3 feature, but the data model design must be settled in V2 when `spend_events` is built, because the graph data derives from `spend_events`.

### Data Pipeline

```
spend_events (V2)
  ↓ [nightly aggregation job]
flow_nodes + flow_edges (V3)
  ↓ [weekly snapshot job]
flow_map_snapshots (V3)
  ↓ [anonymization + minimum threshold filter]
anonymized_community_nodes (V3) → public visualization
```

### Table Summaries

**`flow_nodes`** — Each distinct listing (or category/city aggregate) that appears in the flow graph as a node.

| Key Field | Type | Notes |
|---|---|---|
| `listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL | Null for aggregate nodes (city, category-level) |
| `entity_type` | `text` | Mirrors `listings.entity_type` at snapshot time |
| `city_id` | `uuid` | For geographic grouping |
| `total_inflow_usd` | `numeric(14,2)` | Total spend attributed to this listing in the period |
| `total_outflow_usd` | `numeric(14,2)` | Total spend from this listing to others (B2B, V3) |
| `node_weight` | `numeric` | Computed weight for visualization sizing |
| `period_start` / `period_end` | `date` | The time window this node represents |

**`flow_edges`** — Directional money flow between two nodes.

| Key Field | Type | Notes |
|---|---|---|
| `source_node_id` | `uuid` FK → `flow_nodes.id` | Who spent |
| `target_node_id` | `uuid` FK → `flow_nodes.id` | Who received |
| `total_amount_usd` | `numeric(14,2)` | Aggregate flow in the period |
| `transaction_count` | `integer` | Number of spend events |
| `edge_weight` | `numeric` | For visualization line thickness |
| `period_start` / `period_end` | `date` | Time window |

**Minimum 5 contributor threshold:** A flow edge is only rendered in the public visualization if `transaction_count >= 5`. This prevents individual user spending patterns from being inferred. Enforced in `anonymized_community_nodes` and by the Edge Function that populates `flow_map_snapshots`.

**`flow_map_snapshots`** — Precomputed full graph state stored as JSON for fast client rendering. Avoids recomputing the graph on every page load.

| Key Field | Type | Notes |
|---|---|---|
| `snapshot_date` | `date` | When this snapshot was computed |
| `city_id` | `uuid` | City scope (null = national) |
| `graph_json` | `jsonb` | Full serialized graph: `{nodes: [...], edges: [...]}` |
| `node_count` | `integer` | For monitoring |
| `edge_count` | `integer` | For monitoring |
| `computation_ms` | `integer` | For performance tracking |

**`vendor_relationships`** — Inferred B2B spend patterns. When spend_events shows recurring transactions from one vendor to another, a vendor relationship edge is inferred.

| Key Field | Type | Notes |
|---|---|---|
| `vendor_a_id` | `uuid` FK → `listings.id` | Buyer |
| `vendor_b_id` | `uuid` FK → `listings.id` | Seller |
| `relationship_type` | `text` | `'supplier'`, `'service-provider'`, `'recurring-customer'` |
| `evidence_count` | `integer` | Number of spend events supporting this inference |
| `inferred_at` | `timestamptz` | When last computed |

---

## 9. Marketplace Data Architecture (V2)

### Product Catalog Flow

```
listing_details_vendor (stripe_connect_id, stripe_connect_status)
  → products (stripe_product_id, stripe_price_id)
    → product_variants (price_delta, inventory_count)
      → order_items (unit_price, quantity, product_snapshot jsonb)
        → orders (subtotal, platform_fee, total_amount, stripe_payment_intent_id)
```

**`product_snapshot` in `order_items`:** At time of purchase, a JSON snapshot of the product name, description, price, and variant is stored in `order_items.product_snapshot`. This ensures order history is preserved correctly even if the product is later edited or archived. The `product_id` FK is SET NULL-safe; the snapshot is the source of truth for order display.

### Stripe Connect Integration

| Field | Table | Notes |
|---|---|---|
| `stripe_connect_id` | `listing_details_vendor` | Stripe Connect account ID (e.g., `acct_*`). Never expose to non-admin API responses. |
| `stripe_connect_status` | `listing_details_vendor` | `not-started / pending / active / restricted` — synced via Stripe webhooks |
| `stripe_product_id` | `products` | Created when product goes to `active` status |
| `stripe_price_id` | `products` | Must be recreated when price changes (Stripe prices are immutable) |
| `stripe_payment_intent_id` | `orders` | The Stripe PaymentIntent ID for the transaction |
| `stripe_invoice_id` | `invoices` | For subscription and placement billing |

**Platform fee model:** `orders.platform_fee = orders.subtotal * 0.10` (10% at V2 launch; configurable at V3). The fee percentage is not stored per-order at MVP — it is computed at order creation time and stored as a fixed `numeric(10,2)` value. If the platform fee rate changes, historical orders retain their original fee.

### Receipt Intake Pipeline

```
receipt_uploads (image_path, status='pending')
  ↓ [OCR job — Supabase Edge Function]
    receipt_uploads.ocr_raw (raw OCR output jsonb)
    receipt_uploads.merchant_name, amount, purchase_date, category (parsed fields)
    receipt_uploads.status = 'pending' → user confirmation required
  ↓ [User confirms or corrects]
    receipt_uploads.status = 'confirmed'
    spend_events created (user_id, listing_id via merchant match, amount, source='receipt-upload')
  OR
    receipt_uploads.status = 'rejected' (user cancels or OCR confidence too low)
```

**`ocr_confidence` threshold:** If OCR confidence < 0.7, the receipt is flagged for manual review rather than auto-suggesting a merchant match. Threshold is configurable in application code, not stored in the schema.

---

## 10. Open Decisions

These five questions from `entity-content-model.md` Section 17 must be answered before Beta/V1 work begins. They are reproduced here as the data model reference.

| # | Question | Decision Owner | Phase Impact |
|---|---|---|---|
| 1 | **`subcategory_ids` array vs. `listing_subcategories` junction table.** Current model stores subcategory UUIDs as `uuid[]` on `listings` with no FK enforcement. A junction table (`listing_subcategories`) would add FK integrity and simplify querying, but requires a migration and API change. | Architecture | V1 |
| 2 | **`listing_details_professional` and `listing_details_creative` share a base vs. remain separate.** Both tables have overlapping fields (bio, phone, email, social links, website_url, video_embed_url, cta_type, cta_url). A shared base `listing_details_individual` + thin type extensions would reduce duplication. Separate tables are simpler now but harder to refactor later. | Architecture | Beta |
| 3 | **Business ↔ Vendor overlap: entity_type change vs. dual extension rows.** Current model: upgrading a Business to Vendor changes `entity_type = 'vendor'` and adds a `listing_details_vendor` row. Alternative: a Business listing could hold both `listing_details_business` AND `listing_details_vendor` rows without changing `entity_type`. The current model is simpler but reclassifies the Page. | Product + Architecture | V2 |
| 4 | **Certification trigger: PostgreSQL trigger function vs. Supabase Edge Function.** PostgreSQL triggers are synchronous, reliable, and harder to bypass but are harder to monitor, test, and deploy independently. Edge Functions are easier to test and monitor but add latency and can be misconfigured to skip. | Engineering | V1 |
| 5 | **Verification document expiry and renewal workflow.** Some documents (business licenses) expire. The current model stores docs as a `text[]` array on `listings`. A `verification_submissions` table (already in the V1 table inventory) with `purge_at` and renewal workflow may need a more complete spec. The key question: when a document expires, does `trust_tier` automatically drop from `verified` to `claimed`? | Product | V2 |

---

## 11. MVP Tables Only

The 21 tables required before public launch, ordered by dependency for the first sprint.

| # | Table | Purpose |
|---|---|---|
| 1 | `states` | Geographic reference seed data; required before cities can be created |
| 2 | `cities` | City/metro reference with slugs and geo data; required before listings |
| 3 | `categories` | Hierarchical category tree; required before listings |
| 4 | `profiles` | User display data synced from auth.users; required before any user action |
| 5 | `user_roles` | Role assignments per user; required for permissions enforcement |
| 6 | `listings` | Base entity table; the entire platform depends on this table |
| 7 | `listing_details_business` | Business-specific extension; only entity type active at MVP |
| 8 | `listing_hours` | Structured day-of-week hours; replaces jsonb for the business schedule section |
| 9 | `listing_links` | Flexible additional social/external links beyond fixed columns |
| 10 | `services` | Basic service listings (name, description, display_order, is_visible) |
| 11 | `media_attachments` | Gallery images and media for all entity types |
| 12 | `claims` | Ownership claim submission and approval queue |
| 13 | `saves` | User-to-listing bookmark associations |
| 14 | `reviews` | Star ratings and text reviews; schema built at MVP, intake-only |
| 15 | `collections` | Admin-curated listing groups for editorial and homepage placement |
| 16 | `collection_items` | Junction table linking collections to listings with display order |
| 17 | `analytics_events` | Append-only event log for all 45 user interaction event types |
| 18 | `search_events` | Enriched search log with query, filters, result count, and click tracking |
| 19 | `entity_analytics_daily` | Precomputed daily stats per listing (views, clicks, saves, shares) |
| 20 | `admin_audit_log` | Immutable log of all admin actions with before/after state |
| 21 | `moderation_queue` | Unified admin review queue for claims, corrections, reviews, flags |

---

## 12. Later Tables

All 44 non-MVP tables grouped by phase, with deferral rationale.

### Beta (4–8 weeks post-MVP)

| Table | Purpose | Deferral Rationale |
|---|---|---|
| `listing_details_professional` | Professional entity type extension | Only business entity at MVP; professional adds new entity type |
| `listing_details_creative` | Creative entity type extension | Same; adds creative entity type |
| `listing_details_event` | Event entity type extension | Same; adds event entity type with auto-archive behavior |
| `listing_details_job` | Job entity type extension | Same; adds job posting type with auto-expire behavior |
| `corrections` | Community field-level correction submissions | Community contribution feature; not required for core discovery |
| `review_responses` | Owner responses to published reviews | Reviews display deferred to V1; responses depend on display |
| `review_reports` | User reports on inappropriate reviews | Requires reviews to be public first |
| `tags` | Free-form discovery tags with usage tracking | Enhanced discovery; categories sufficient for MVP |
| `listing_tags` | Listings ↔ tags junction | Depends on `tags` table |
| `neighborhoods` | Neighborhood geo reference | City-level filtering is sufficient at MVP |

### V1 (8–12 weeks post-MVP)

| Table | Purpose | Deferral Rationale |
|---|---|---|
| `plans` | Subscription plan tier definitions | No paid tiers at MVP; all listings are free tier |
| `subscriptions` | Active Stripe subscription records | Depends on plans; revenue feature |
| `sponsored_placements` | Active paid placement records | Revenue feature; editorial featured slots sufficient at MVP |
| `featured_slots` | Admin-managed editorial featured slots | Basic `is_featured` boolean on listings sufficient at MVP |
| `editorial_articles` | BLACQLight editorial content | Content team resource requirement; not core to discovery |
| `guides` | City guide pages | Same; editorial content phase |
| `guide_sections` | Sections within city guides | Depends on `guides` |
| `verification_submissions` | Per-cycle document intake for verified trust tier | Verification workflow is V1; trust_tier schema exists at MVP |
| `platform_analytics_daily` | Platform-wide daily aggregate stats | Admin analytics; entity-level analytics sufficient at MVP |

### V2 (10–14 weeks post-V1)

| Table | Purpose | Deferral Rationale |
|---|---|---|
| `listing_details_vendor` | Vendor marketplace extension | Commerce layer; requires Stripe Connect onboarding (4–6 weeks) |
| `products` | Vendor product catalog | Depends on vendor extension and Stripe Connect |
| `product_variants` | Product variant options | Depends on products |
| `orders` | Marketplace order records | Depends on full commerce stack |
| `order_items` | Order line items | Depends on orders |
| `coupons` | Discount codes | Enhancement to marketplace; not required at launch |
| `receipt_uploads` | Raw receipt image intake | Spend tracking feature; separate UX flow from discovery |
| `spend_events` | Processed spend attribution records | Community impact data layer; complex pipeline |
| `listing_service_areas` | Structured service area definitions | Free-text `service_area_description` sufficient at MVP/Beta |
| `ai_suggestions` | AI-generated owner suggestions | AI features phase; listing quality tooling |
| `ai_generation_requests` | AI API call audit log | Required with AI features |
| `ai_moderation_flags` | AI content moderation flags | Required with AI features; manual moderation sufficient before V2 |
| `event_vendors` | Vendors at event listings | Event-specific enhancement; basic event listings don't require it |
| `event_sponsors` | Brands sponsoring events | Same; sponsor relationship feature |
| `community_impact_daily` | Anonymized spend aggregates by city/category | Depends on spend_events data pipeline |

### V3+ (10–14 weeks post-V1)

| Table | Purpose | Deferral Rationale |
|---|---|---|
| `flow_nodes` | Dollar-flow map graph nodes | Requires significant spend data volume (V2) before visualization is meaningful |
| `flow_edges` | Dollar-flow map graph edges | Depends on flow_nodes |
| `flow_map_snapshots` | Precomputed graph state | Depends on flow_nodes and flow_edges |
| `anonymized_community_nodes` | Public aggregate nodes | Depends on flow data and anonymization pipeline |
| `vendor_relationships` | Inferred B2B spend patterns | Requires substantial transaction history |
| `sponsor_campaigns` | Sponsor campaign management | Brand partnership program; requires sales infrastructure |
| `invoices` | Payment record references | Consolidated billing; Stripe dashboard sufficient until V3 |
| `service_packages` | Bundled service tiers per listing | Premium listing feature; service table sufficient until V3 |
| `ai_agent_runs` | Autonomous agent execution logs | Autonomous AI features are V3+ |
| `listing_ctas` | Multiple CTA configurations per listing | Single CTA per listing sufficient through V2 |
