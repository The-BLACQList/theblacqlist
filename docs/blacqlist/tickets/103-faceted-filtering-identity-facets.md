# Ticket 103: Faceted filtering + Identity & Ownership facets

## Status

✅ Done — verified on staging (2026-06-22): migrations + attribute data applied, listings reconciled, 32/32 a11y tests green, filters live on /discover.

## Phase

V1 (post-MVP discovery richness)

## Priority

P2

## Feature Area

Frontend / UX + Backend / DB

---

## Context

The original discovery cards (025 search API, 026 search results, 029 discover) shipped with a thin filter layer — entity-type + category, with city / availability / trust as "coming soon" stubs. The founder's original vision (the **MyListing** WordPress theme) was a far richer, faceted directory. This ticket brings that richness: a normalized attributes taxonomy, a flagship **Identity & Ownership** facet group (the platform's differentiator), and a real faceted Explore experience.

It is deliberately sequenced **after launch** so it never competes with the open launch blockers; basic browse keeps working with or without the new migration applied (graceful fallback).

---

## User Story

As a supporter, I want to filter the directory by identity (e.g. Black-Woman-Owned, Veteran-Owned), amenities, price, and hours — with live counts next to each option — so I can find exactly the businesses I want to support.

---

## Scope

**Built (in scope):**

- **Attributes taxonomy** — `attribute_groups` → `attribute_values` → `listing_attributes` (mirrors the `categories` pattern), plus the long-deferred `tags` / `listing_tags` tables, `usage_count` triggers, RLS, and an `is_open_now(listing_id)` SQL helper (port of `EntityAtAGlance.isOpenNow()`). Migration `20260622000000_attributes_taxonomy.sql`.
- **Faceted search RPCs** — `search_listings_faceted` (AND-across-groups / OR-within, price, open-now, sort) + `facet_counts` (disjunctive per-option counts). Migration `20260622000001_search_listings_faceted_rpc.sql`.
- **Seed** — 6 facet groups / 41 values incl. the full **Identity & Ownership** set (Black-Owned, Black-Woman/Man-Owned, LGBTQ+-Owned, Veteran-Owned, Immigrant-Owned, Family-Owned, Faith-Based, Minority-Certified) + Service Options / Accessibility / Payment / Amenities / Dietary; backfill in `seeds/003_attribute_backfill.sql`.
- **Faceted sidebar UI** — `components/discovery/{FacetSidebar,SortDropdown,ActiveFilterChips,MobileFilterSheet,useFacetParams,facetConstants}.tsx`; DB-driven categories; URL-synced state; identity chips on cards (`components/entities/EntityCard.tsx`).
- **Owner editor** — `components/dashboard/AttributesSection.tsx` + `lib/actions/dashboard/updateListingAttributes.ts`; listing-page display `components/entity-page/EntityAttributes.tsx`.
- **Resilience** — discovery queries the new tables separately and fails soft, so `/discover` works whether or not the migration is applied (`attachIdentityChips` in `lib/listings/query.ts`).

**Out of scope (later):**

- Map / proximity / geo search.
- Tag-filter pages; `/api/search` route still uses FTS (only `queryListings` is faceted).
- Pillar B listing depth (video, multi-criteria reviews + photos, FAQ, menu grouping, on-page events) — separate tickets.

---

## Acceptance Criteria

- [x] Migrations apply cleanly (verified on staging 2026-06-22).
- [x] `tsc --noEmit` + `eslint` clean.
- [x] `/discover` returns listings with or without the attributes migration applied (resilience fix; 9 e2e failures cleared).
- [x] Attribute vocabulary + backfill loaded on staging (`scripts/staging-attributes-seed.sql`) — applied with no errors.
- [x] `/discover` shows the facet sidebar with the new filters live.
- [x] `pnpm test:a11y` green on `/discover` and a listing page (32/32 passing).

---

## Notes

- Canonical attribute data lives in `supabase/seed.sql` §5–6 + `supabase/seeds/003_attribute_backfill.sql` (run on local `db reset`); `scripts/staging-attributes-seed.sql` is a one-paste copy for the manual staging apply.
- See also: `~/.claude` plan history and the broader MyListing-richness roadmap (Pillar B / v2).
