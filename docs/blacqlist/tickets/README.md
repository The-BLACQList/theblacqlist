# Ticket Index — The BLACQList

**Last updated:** 2026-05-07
**Total tickets:** 50
**Phases covered:** Phase 0 (Setup and Foundation), Phase 1 (Database / Auth / RLS Foundation), Phase 2 (Public Marketing and Discovery Shell), Phase 3 (BLACQList Page Build-Out), Phase 4 (Search, Filters, City/Category Pages), Phase 5 (Submit / Claim / Manage Foundation), Phase 6 (Admin Review and Verification), Phase 7 (Saves, Reviews, Corrections, Sharing), Phase 8 (Owner Dashboard)

---

## Ticket Index

| ID                                                             | Title                                                                                      | Phase                                         | Priority | Feature Area                      | Status  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- | -------- | --------------------------------- | ------- |
| [001](./001-nextjs-project-init.md)                            | Next.js 14 project initialization and tooling                                              | Phase 0: Setup and Foundation                 | P0       | Infrastructure                    | Draft   |
| [002](./002-supabase-setup.md)                                 | Supabase project setup and environment configuration                                       | Phase 0: Setup and Foundation                 | P0       | Infrastructure                    | Draft   |
| [003](./003-vercel-deployment-pipeline.md)                     | Vercel deployment pipeline and preview environments                                        | Phase 0: Setup and Foundation                 | P0       | Infrastructure                    | Draft   |
| [004](./004-error-tracking-sentry.md)                          | Error tracking setup (Sentry)                                                              | Phase 0: Setup and Foundation                 | P1       | Infrastructure                    | Draft   |
| [005](./005-code-quality-tooling.md)                           | Code quality tooling (ESLint, Prettier, Husky, commitlint)                                 | Phase 0: Setup and Foundation                 | P1       | Infrastructure                    | Draft   |
| [006](./006-geographic-tables-migration.md)                    | Geographic reference tables migration (states, cities)                                     | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [007](./007-category-taxonomy-migration.md)                    | Category taxonomy migration and seed data                                                  | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [008](./008-user-profiles-roles-migration.md)                  | User profiles and roles migration                                                          | Phase 1: Database / Auth / RLS Foundation     | P0       | Database / Auth                   | Draft   |
| [009](./009-listings-base-business-extension-migration.md)     | Listings base table and business extension migration                                       | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [010](./010-listing-supplementary-tables-migration.md)         | Listing supplementary tables migration (hours, links, services, media)                     | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [011](./011-engagement-tables-migration.md)                    | Engagement tables migration (saves, claims, reviews, collections)                          | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [012](./012-analytics-audit-tables-migration.md)               | Analytics and audit tables migration                                                       | Phase 1: Database / Auth / RLS Foundation     | P0       | Database                          | Draft   |
| [013](./013-rls-policies-all-mvp-tables.md)                    | RLS policies for all 21 MVP tables                                                         | Phase 1: Database / Auth / RLS Foundation     | P0       | Database / Security               | Draft   |
| [014](./014-auth-flows.md)                                     | Authentication flows (sign-up, sign-in, password reset, email verify)                      | Phase 1: Database / Auth / RLS Foundation     | P0       | Auth                              | Draft   |
| [015](./015-app-shell-layout.md)                               | App shell — root layout, navigation, fonts, brand tokens, global CSS                       | Phase 2: Public Marketing and Discovery Shell | P0       | Frontend Shell                    | Draft   |
| [016](./016-homepage.md)                                       | Homepage page component                                                                    | Phase 2: Public Marketing and Discovery Shell | P1       | Discovery                         | Draft   |
| [017](./017-for-business-about-pages.md)                       | For Business and About static pages                                                        | Phase 2: Public Marketing and Discovery Shell | P2       | Marketing                         | Draft   |
| [018](./018-legal-pages.md)                                    | Legal pages — Privacy Policy and Terms of Service                                          | Phase 2: Public Marketing and Discovery Shell | P1       | Legal                             | Draft   |
| [019](./019-404-error-loading-pages.md)                        | 404, error boundary, and route-level loading pages                                         | Phase 2: Public Marketing and Discovery Shell | P1       | Frontend Shell                    | Draft   |
| [020](./020-blacqlist-page-data-layer.md)                      | BLACQList Page — route, data layer, and page component                                     | Phase 2: Public Marketing and Discovery Shell | P0       | Core Workflow                     | Draft   |
| [021](./021-blacqlist-page-hero-about-hours-contact-social.md) | BLACQList Page — hero, about, hours, contact, and social sections                          | Phase 3: BLACQList Page Build-Out             | P1       | Core Workflow / BLACQList Page    | Backlog |
| [022](./022-blacqlist-page-gallery-services-cta.md)            | BLACQList Page — gallery, services, and primary CTA section                                | Phase 3: BLACQList Page Build-Out             | P1       | Core Workflow / BLACQList Page    | Backlog |
| [023](./023-blacqlist-page-seo-og-jsonld-sitemap.md)           | BLACQList Page — SEO metadata, OG image, JSON-LD, and sitemap                              | Phase 3: BLACQList Page Build-Out             | P1       | SEO / Infrastructure              | Backlog |
| [024](./024-blacqlist-page-save-share-analytics-sticky-cta.md) | BLACQList Page — save button, share button, analytics events, and sticky CTA bar           | Phase 3: BLACQList Page Build-Out             | P1       | Core Workflow / Engagement        | Backlog |
| [025](./025-search-api-endpoint.md)                            | Search API endpoint (GET /api/search) — FTS, pg_trgm fallback, filters, pagination         | Phase 4: Search, Filters, City/Category Pages | P0       | API / Public Discovery            | Backlog |
| [026](./026-search-results-page.md)                            | Search results page (/search) — filter bar, listing grid, load more                        | Phase 4: Search, Filters, City/Category Pages | P1       | Public Discovery                  | Backlog |
| [027](./027-city-landing-pages.md)                             | City landing pages (/[city-slug]) — ISR, hero, featured listings, category shortcuts       | Phase 4: Search, Filters, City/Category Pages | P1       | Public Discovery / SEO            | Backlog |
| [028](./028-city-category-landing-pages.md)                    | City-category landing pages (/[city-slug]/[category-slug]) — ISR, breadcrumb, listing grid | Phase 4: Search, Filters, City/Category Pages | P1       | Public Discovery / SEO            | Backlog |
| [029](./029-discover-browse-page.md)                           | Discover / browse page (/discover) — facet-driven browsing, claimed-only toggle            | Phase 4: Search, Filters, City/Category Pages | P2       | Public Discovery                  | Backlog |
| [030](./030-media-upload-api.md)                               | Media upload API (POST /api/upload) — MIME validation, UUID paths, three-bucket support    | Phase 5: Submit / Claim / Manage Foundation   | P0       | API / Media                       | Backlog |
| [031](./031-listing-duplicate-check-api.md)                    | Listing duplicate-check API (POST /api/listings/duplicate-check)                           | Phase 5: Submit / Claim / Manage Foundation   | P1       | API / Entity Submission           | Backlog |
| [032](./032-add-business-form-steps-1-4.md)                    | Add Business multi-step form: steps 1–4 (entity type, basic info, contact, category/city)  | Phase 5: Submit / Claim / Manage Foundation   | P1       | Core Workflow / Entity Submission | Backlog |
| [033](./033-add-business-form-steps-5-7.md)                    | Add Business multi-step form: steps 5–7 (media, CTA, preview/publish)                      | Phase 5: Submit / Claim / Manage Foundation   | P1       | Core Workflow / Entity Submission | Backlog |
| [034](./034-claim-entry-page.md)                               | Claim entry page (/claim) — search for existing listing to claim                           | Phase 5: Submit / Claim / Manage Foundation   | P1       | Core Workflow / Claim             | Backlog |
| [035](./035-claim-form-doc-upload.md)                          | Claim form and verification document upload (/claim/[listing-id])                          | Phase 5: Submit / Claim / Manage Foundation   | P1       | Core Workflow / Claim             | Backlog |
| [036](./036-claim-status-tracking.md)                          | Claim status tracking page (/account/claims)                                               | Phase 5: Submit / Claim / Manage Foundation   | P2       | Core Workflow / Claim / Account   | Backlog |
| [037](./037-admin-layout-nav-auth-guard.md)                    | Admin layout, navigation, and auth guard                                                   | Phase 6: Admin Review and Verification        | P0       | Admin / Auth                      | Backlog |
| [038](./038-admin-listings-table.md)                           | Admin listings table (/admin/listings)                                                     | Phase 6: Admin Review and Verification        | P1       | Admin / Listings                  | Backlog |
| [039](./039-admin-listing-detail-edit.md)                      | Admin listing detail and edit (/admin/listings/[id])                                       | Phase 6: Admin Review and Verification        | P1       | Admin / Listings                  | Backlog |
| [040](./040-admin-claims-queue.md)                             | Admin claims queue (/admin/claims)                                                         | Phase 6: Admin Review and Verification        | P0       | Admin / Claims                    | Backlog |
| [041](./041-admin-claim-review-approve-reject.md)              | Admin claim review — approve, reject, get signed doc URL (/admin/claims/[id])              | Phase 6: Admin Review and Verification        | P0       | Admin / Claims                    | Backlog |
| [042](./042-admin-users-table.md)                              | Admin users table — role management and suspension (/admin/users)                          | Phase 6: Admin Review and Verification        | P1       | Admin / Users                     | Backlog |
| [043](./043-admin-collections-management.md)                   | Admin collections management — CRUD, items, homepage-featured (/admin/collections)         | Phase 6: Admin Review and Verification        | P2       | Admin / Collections               | Backlog |
| [044](./044-admin-category-management.md)                      | Admin category management — create, edit, reorder, deactivate (/admin/categories)          | Phase 6: Admin Review and Verification        | P2       | Admin / Categories                | Backlog |
| [045](./045-save-unsave-api-button-component.md)               | Save / unsave Route Handlers and SaveButton component                                      | Phase 7: Saves, Reviews, Corrections, Sharing | P1       | API / Saves / Engagement          | Backlog |
| [046](./046-saved-listings-page.md)                            | Saved listings page (/account/saved)                                                       | Phase 7: Saves, Reviews, Corrections, Sharing | P1       | Account / Saves                   | Backlog |
| [047](./047-share-functionality.md)                            | Share functionality — copy link, OG preview, Web Share API                                 | Phase 7: Saves, Reviews, Corrections, Sharing | P2       | Saves / Engagement / Sharing      | Backlog |
| [048](./048-review-intake-server-actions.md)                   | Review intake — Server Actions and form components (MVP: intake only)                      | Phase 7: Saves, Reviews, Corrections, Sharing | P1       | Reviews / Engagement              | Backlog |
| [049](./049-analytics-event-ingestion-api.md)                  | Analytics event ingestion API (POST /api/analytics/event)                                  | Phase 7: Saves, Reviews, Corrections, Sharing | P1       | API / Analytics                   | Backlog |
| [050](./050-owner-dashboard-home.md)                           | Owner dashboard home (/dashboard)                                                          | Phase 8: Owner Dashboard                      | P1       | Dashboard / Analytics             | Backlog |

---

## Build Order

Tickets must be executed in this sequence due to schema and runtime dependencies:

```
Phase 0 — Infrastructure
001 (Next.js init)
  └── 002 (Supabase setup)
  └── 003 (Vercel pipeline)
        └── 004 (Sentry)
005 (code quality tooling) — parallel with 002–004, requires 001

Phase 1 — Database / Auth / RLS
002 (Supabase setup)
  └── 006 (states, cities)
        └── 007 (categories)
              └── 008 (profiles, user_roles)
                    └── 009 (listings, listing_details_business)
                          └── 010 (listing_hours, listing_links, services, media_attachments)
                                └── 011 (saves, claims, reviews, collections, collection_items)
                                      └── 012 (analytics, audit log, moderation_queue)
                                            └── 013 (RLS policies — all 21 tables)
014 (auth flows) — requires 008 (profiles + user_roles tables); parallel with 010–012

Phase 2 — Public Marketing and Discovery Shell
015 (app shell layout) — requires 001 (Next.js init); no DB dependency
016 (homepage) — requires 015, 009 (listings table), 013 (RLS)
017 (For Business + About pages) — requires 015
018 (legal pages) — requires 015
019 (404 + error + loading pages) — requires 015
020 (BLACQList Page data layer) — requires 009, 010, 013, 015, 019

Phase 3 — BLACQList Page Build-Out
021 (hero, about, hours, contact, social) — requires 020
022 (gallery, services, primary CTA) — requires 020; soft dependency on 030 (upload API for gallery CDN URLs)
023 (SEO, OG image, JSON-LD, sitemap) — requires 020
024 (save, share, analytics, sticky CTA) — requires 020; soft dependency on 045 (save API) and 049 (analytics API)
021–024 can be developed in parallel after 020 is merged

Phase 4 — Search, Filters, City/Category Pages
025 (search API) — requires 009, 013; pg_trgm and tsvector index from 009
026 (search results page) — requires 025, 015
027 (city landing pages) — requires 025, 015, 006 (cities table)
028 (city-category landing pages) — requires 027, 007 (categories table)
029 (discover page) — requires 025; reuses filter components from 026

Phase 5 — Submit / Claim / Manage Foundation
030 (media upload API) — requires 009, 010 (media_attachments table), 013 (RLS)
031 (duplicate-check API) — requires 009 (listings table), pg_trgm extension enabled
032 (add-business steps 1–4) — requires 015 (app shell), 014 (auth), 007 (categories), 006 (cities)
033 (add-business steps 5–7) — requires 032, 031, 030 (media upload Route Handler)
034 (claim entry page) — requires 015, 014, 009 (listings)
035 (claim form + doc upload) — requires 034, 011 (claims table), 030 (upload Route Handler)
036 (claim status tracking) — requires 035, 011

Phase 6 — Admin Review and Verification
037 (admin layout + auth guard) — requires 014 (auth), 008 (user_roles), 012 (admin_audit_log)
038 (admin listings table) — requires 037
039 (admin listing detail + edit) — requires 038
040 (admin claims queue) — requires 037, 035, 011
041 (admin claim review + approve/reject) — requires 040, 035, 011, 009 (listings); parallel with 042–044
042 (admin users table) — requires 037, 008 (profiles + user_roles); parallel with 041, 043, 044
043 (admin collections management) — requires 037, 011 (collections + collection_items); parallel with 041, 042, 044
044 (admin category management) — requires 037, 007 (categories); parallel with 041, 042, 043

Phase 7 — Saves, Reviews, Corrections, Sharing
045 (save/unsave Route Handlers + SaveButton) — requires 011 (saves table), 013 (RLS), 014 (auth), 020 (BLACQList Page)
049 (analytics event ingestion API) — requires 012 (analytics tables), 013 (RLS); can be developed parallel with 045–048
046 (saved listings page) — requires 045, 014; parallel with 047, 048
047 (share functionality) — requires 020 (BLACQList Page OG metadata from Ticket 023), 049; parallel with 045, 046, 048
048 (review intake Server Actions + form) — requires 011 (reviews table), 013 (RLS), 014 (auth), 020 (BLACQList Page); parallel with 045–047

Phase 8 — Owner Dashboard
050 (owner dashboard home) — requires 014 (auth), 009 (listings), 011 (claims), 012 (analytics tables), 013 (RLS), 049 (analytics API)
```

---

## Dependency Notes

- **Ticket 008** creates `user_roles.listing_id` without a FK constraint. The FK to `listings.id` is added via `ALTER TABLE` in **Ticket 009's** migration.
- **Ticket 009** creates `listings.claim_id` without a FK constraint. The FK to `claims.id` is added in **Ticket 011's** migration.
- **Ticket 011** adds the `claims.id → listings.claim_id` FK as a deferred `ALTER TABLE` to resolve the circular dependency between `listings` and `claims`.
- **Sentry DSN** environment variables (set in Ticket 004) require the Vercel project to exist (Ticket 003) before they can be configured.
- **Ticket 013** (RLS) must be applied before any frontend ticket is tested against a live Supabase instance.
- **Ticket 019** (404 / loading pages) should be completed before or alongside **Ticket 020** (BLACQList Page data layer) so that `notFound()` calls render the correct branded 404 page.
- **Ticket 019** `ListingPageSkeleton` layout must be updated to match the final **Ticket 020** page layout if any discrepancy exists before either ticket is merged.
- **Ticket 021** `getOpenStatus()` in `lib/utils/hours.ts` uses the user's local timezone via `Intl.DateTimeFormat`. This function must be tested with edge cases (midnight crossover, Sunday-only hours, closed-all-day `null` entries).
- **Ticket 022** gallery cap is enforced at read time from `listing_tier`: Free = 6 images, Standard/Premium = 12. The `GallerySection` must receive the cap as a prop — do not re-derive from `listing_tier` inside the component.
- **Ticket 023** OG image route at `app/og/listing/[id]/route.ts` uses `next/og` (`@vercel/og`). The route is a Route Handler, not a page. The `ImageResponse` must be 1200×630px. Ensure `next.config.ts` does not exclude `/og/` from the build.
- **Ticket 024** `SaveButton` optimistic state is initialized from `EntityPageData.is_saved` (Server Component prop). This eliminates a mount-time API call. The component must not issue a GET request on mount to check save state.
- **Ticket 025** analytics `search_performed` events are written directly to the DB inside the Route Handler (using a service-role Supabase client) — they do not call `POST /api/analytics/event` (Ticket 049). This avoids a self-referential API call on the server.
- **Ticket 028** routing: `app/[city-slug]/[category-slug]/page.tsx` catches all 2-segment paths. Listing pages at `app/[city-slug]/business/[listing-slug]/page.tsx` (3 segments) are more specific and resolve first — there is no conflict. QA-028-5 verifies this explicitly.
- **Ticket 029** `SearchFilterBar` and `ActiveFilterChips` are moved from `app/search/components/` to `components/discovery/` to allow sharing with the Discover page. The import in `app/search/` must be updated as part of this ticket.
- **Ticket 030** (`file-type` package): v19+ is ESM-only. Use v16.x if the project remains CommonJS, or confirm ESM configuration before installing v19+. Never trust the `Content-Type` request header for MIME validation — always validate from magic bytes.
- **Ticket 041** (`approveClaim` SA) writes to `admin_audit_log` using `createServiceRoleClient()`. The `profiles.suspended_at` column referenced in **Ticket 042** must be added via a migration (add to Ticket 008 or a new migration in Ticket 042 scope).
- **Ticket 042** requires `profiles.suspended_at timestamptz` to exist. The middleware added in Ticket 014 must be updated to check `suspended_at IS NOT NULL` and redirect suspended users.
- **Ticket 043** `homepage_featured` boolean on `collections` must exist in the schema (Ticket 011 scope). Confirm the column is present before Ticket 043 can be started.
- **Ticket 045** `POST /api/saves` uses `INSERT ... ON CONFLICT (user_id, listing_id) DO NOTHING` — the unique constraint `UNIQUE (user_id, listing_id)` on `saves` must exist (Ticket 011 migration).
- **Ticket 047** depends on OG metadata from the BLACQList Page (`generateMetadata` function, provisionally Ticket 023). If Ticket 023 has not shipped, the `ShareButton` component can be built — rich previews simply will not render until 023 is merged.
- **Ticket 048** reviews are stored with `status='intake'` and have no `revalidatePath` calls. No other ticket should attempt to query or display reviews publicly until a future "reviews public display" ticket is defined.
- **Ticket 049** analytics Route Handler is a hard dependency for **Ticket 045** (save analytics event), **Ticket 047** (share analytics event), **Ticket 048** (review analytics event), and **Ticket 050** (`dashboard_viewed` event). It can be stubbed as a no-op 200 handler during parallel development.
- **Ticket 050** `GET /api/dashboard` Route Handler is created within Ticket 050's scope — it does not exist prior to this ticket. The `completion_status` object in the response is computed server-side from JOINed `listing_details_business`, `listing_hours`, `listing_links`, and `services` tables (all from Ticket 010).

---

## Phase Summary

| Phase                                         | Tickets     | Count  | Description                                                                        |
| --------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------- |
| Phase 0: Setup and Foundation                 | 001–005     | 5      | Next.js init, Supabase, Vercel, Sentry, ESLint/Prettier                            |
| Phase 1: Database / Auth / RLS Foundation     | 006–014     | 9      | All schema migrations, RLS policies, auth flows                                    |
| Phase 2: Public Marketing and Discovery Shell | 015–020     | 6      | App shell, homepage, static pages, BLACQList Page route/data layer                 |
| Phase 3: BLACQList Page Build-Out             | 021–024     | 4      | Page sections (hero/about/hours/gallery/services), SEO, engagement                 |
| Phase 4: Search, Filters, City/Category Pages | 025–029     | 5      | Search API, search results page, city pages, city-category pages, discover         |
| Phase 5: Submit / Claim / Manage Foundation   | 030–036     | 7      | Media upload, duplicate check, add-business form (7 steps), claim flow             |
| Phase 6: Admin Review and Verification        | 037–044     | 8      | Admin layout, listings, claims queue, claim review, users, collections, categories |
| Phase 7: Saves, Reviews, Corrections, Sharing | 045–049     | 5      | Save/unsave API, saved page, share, reviews, analytics API                         |
| Phase 8: Owner Dashboard                      | 050         | 1      | Owner dashboard home — stats, claim status, completion checklist                   |
| **Total**                                     | **001–050** | **50** |                                                                                    |

---

## Source Documents

These tickets are derived from the following planning artifacts:

| Artifact                                 | Path                                                      |
| ---------------------------------------- | --------------------------------------------------------- |
| Tech Stack Decision Record               | `docs/blacqlist/architecture/tech-stack-decision.md`      |
| Environment Configuration Plan           | `docs/blacqlist/architecture/environment-plan.md`         |
| Database Schema Plan (Part A)            | `docs/blacqlist/data/database-schema-plan.md`             |
| RLS Policy Plan                          | `docs/blacqlist/data/rls-policy-plan.md`                  |
| API Contract                             | `docs/blacqlist/architecture/api-contract.md`             |
| Server Actions Plan                      | `docs/blacqlist/architecture/server-actions-plan.md`      |
| MVP Screen Map                           | `docs/blacqlist/ux/mvp-screen-map.md`                     |
| Empty / Loading / Error / Success States | `docs/blacqlist/ux/empty-loading-error-success-states.md` |
| BLACQList Page Design System             | `docs/blacqlist/design/blacqlist-page-design-system.md`   |
| Design Brief                             | `docs/blacqlist/design/design-brief.md`                   |
