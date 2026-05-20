# Architecture Decisions — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Architecture + Engineering

This document records the major architecture decisions made for The BLACQList, the reasoning behind each, and the trade-offs accepted. Each decision has an ID for referencing in tickets and discussions.

---

## ADR-001 — Framework: Next.js 14+ with App Router

**Status:** Decided
**Decision:** Use Next.js 14+ with the App Router for all frontend and API route work.

**Reasoning:**
- Server Components enable SEO-critical BLACQList Pages to be fully server-rendered and indexable without hydration overhead
- Streaming and Suspense support means discovery pages can load incrementally without blocking on slow queries
- The App Router's file-based routing maps cleanly to the BLACQList URL structure (`/[city]/[category]/[slug]`)
- Next.js Image and Metadata APIs simplify the OG/SEO layer that is required for every BLACQList Page
- Vercel deployment pipeline is native and zero-config for Next.js

**Trade-offs accepted:**
- App Router is more complex to learn than Pages Router — requires discipline around Server vs. Client component boundaries
- Some third-party libraries are not yet App Router-compatible — must evaluate before adding

**Rejected alternatives:**
- Remix: Excellent DX but smaller ecosystem; Next.js better for the SEO-first use case
- SvelteKit: Smaller team familiarity; excellent but not the default for this team
- Vite + React SPA: Rules out SSR/SEO without additional configuration — not viable for a discovery platform

---

## ADR-002 — Language: TypeScript in Strict Mode

**Status:** Decided
**Decision:** All files use TypeScript. Strict mode enabled. No `any` without documented justification.

**Reasoning:**
- A platform with 8+ entity types, multiple user roles, and complex permission logic requires type safety to catch errors at compile time, not runtime
- Shared schemas between client (zod) and server (TypeScript types) are only viable with TypeScript
- AI-assisted development (GitHub Copilot, Claude Code) is significantly more accurate with TypeScript

**Trade-offs accepted:**
- Slightly slower initial development for developers moving from JavaScript
- Some third-party libraries require `@types/` packages

---

## ADR-003 — Database: Supabase + PostgreSQL

**Status:** Decided
**Decision:** Supabase as the database platform, using PostgreSQL with Row Level Security.

**Reasoning:**
- PostgreSQL `tsvector` full-text search is sufficient for MVP search without an additional search service
- `pg_trgm` enables fuzzy matching and typo-tolerant search at low cost
- Supabase Auth eliminates the need to build authentication from scratch
- Supabase Storage handles media uploads (logos, gallery images, receipts)
- Supabase RLS policies enforce data access at the database level — the safest place for a platform with multiple user roles
- Supabase Realtime can power live features in later phases (admin queue, vendor order notifications) without adding a separate service
- Supabase's dashboard is a sufficient admin data interface in early phases

**Trade-offs accepted:**
- PostgreSQL full-text search has limitations at scale (no ML-based ranking, no synonym expansion) — plan for Algolia or Typesense migration in V2 when listing count exceeds ~50,000
- Supabase is not self-hosted at launch — data residency decisions deferred to V2

**Rejected alternatives:**
- PlanetScale/MySQL: No full-text search native support; PostGIS/geo support weaker
- MongoDB: Less appropriate for relational data (listings → categories → cities → users)
- Firebase: No SQL, weak relational support, harder to migrate away from

---

## ADR-004 — Search Architecture: PostgreSQL FTS (MVP) → Algolia (V2)

**Status:** Decided (MVP phase)
**Decision:** Use PostgreSQL full-text search with `tsvector` and `pg_trgm` at MVP. Plan for Algolia or Typesense migration when search quality or performance degrades.

**MVP search strategy:**
- `tsvector` columns on `listings` table combining: name, description, category, city, subcategory, tags
- `GIN` index on the `tsvector` column for query performance
- `pg_trgm` for fuzzy matching (handles typos and partial matches)
- Filters (category, city, trust status, entity type) applied as `WHERE` clauses
- Sorting: relevance (ts_rank) first, then recency tiebreaker

**V2 migration trigger:** When any of the following occur:
- Search latency exceeds 300ms at p95
- Total listings exceed 50,000
- Users request synonym search ("barber" ≠ "barbershop" in basic FTS) or semantic search
- AI-assisted discovery is being built (requires vector search — `pgvector` or external)

**Rejected alternatives for MVP:**
- Algolia at MVP: Cost and complexity overhead before the platform has validated search usage patterns
- Elasticsearch: Infrastructure overhead not justified at MVP scale

---

## ADR-005 — Authentication: Supabase Auth

**Status:** Decided
**Decision:** Supabase Auth for all authentication flows.

**Flows supported:**
- Email + password (MVP)
- Magic link / passwordless email (V1 — simpler onboarding)
- Google OAuth (V1)
- Apple OAuth (V2 — required for iOS app)

**Session management:**
- JWT sessions stored in httpOnly cookies (server-side)
- Session refresh handled by Supabase client SDK
- Middleware (`middleware.ts`) checks session on protected routes
- RLS policies use `auth.uid()` for ownership enforcement at the database level

**Role management:**
- Roles stored in a `user_roles` table, not in the JWT (to allow role changes without token re-issue)
- Admin role is checked server-side on every admin route access
- Supabase `service_role` key used only in server-side code; never exposed to the client

---

## ADR-006 — File Storage: Supabase Storage

**Status:** Decided
**Decision:** Supabase Storage for all user-uploaded media: logos, cover images, gallery images, verification documents, receipt photos.

**Bucket structure:**
| Bucket | Access | Contents |
|---|---|---|
| `listing-media` | Public (images served via CDN URL) | Logos, cover images, gallery images |
| `verification-docs` | Private (admin only) | Business license uploads, ID documents |
| `receipts` | Private (owner only) | Receipt photo uploads |

**Rules:**
- Never store the Supabase CDN URL — store the storage path and generate URLs at read time
- File type and size validation server-side before upload
- Image optimization (WebP conversion, resize) via Next.js Image or Supabase image transforms
- Verification documents are never publicly accessible under any circumstances

---

## ADR-007 — Payments: Stripe

**Status:** Decided
**Decision:** Stripe for all payment flows.

**MVP scope:** None (no payments at MVP)

**V1 scope:**
- Stripe subscriptions for listing tier upgrades (Standard, Premium)
- Stripe Customer Portal for self-service subscription management

**V2 scope (Marketplace):**
- Stripe Connect (Standard or Express) for vendor payouts
- Platform application fee on marketplace transactions
- Webhook handlers for: payment succeeded, payment failed, subscription updated, refund processed
- Stripe Radar for fraud detection on marketplace transactions

**Trade-offs accepted:**
- Stripe fees reduce platform margin on marketplace
- Stripe Connect onboarding requires vendors to complete KYC — some friction at vendor signup

---

## ADR-008 — Email: Resend

**Status:** Decided (pending confirmation)
**Decision:** Resend for transactional email.

**MVP transactional emails:**
- Claim request submitted (owner receives confirmation)
- Claim approved (owner notified)
- Claim rejected (owner notified with reason)
- Password reset
- Email verification

**V1 additions:**
- Review notification (business owner)
- Community correction resolved
- Listing approaching expiry (events, jobs)

**Template approach:** React Email components for consistent branding across all transactional emails.

---

## ADR-009 — AI Layer: Anthropic Claude API

**Status:** Planned (V2)
**Decision:** Anthropic Claude API for all AI features. No other AI provider.

**V2 AI features:**
- Business Page optimization suggestions (description quality, category accuracy, CTA completeness)
- Shopper-side conversational discovery (natural language search with ranked results + reasoning)

**V3 AI features:**
- Admin curation agent (surfaces trending listings, flags stale content, recommends editorial)

**Prompt strategy:**
- All AI prompts are server-side only — no client-side API calls with exposed keys
- AI responses include a confidence signal and a reasoning trace visible to the user
- Prompts are versioned and testable
- AI features are behind feature flags — disabled if response quality is below threshold

**Rejected alternatives:**
- OpenAI: Valid alternative; Anthropic preferred for safety characteristics and reasoning quality
- On-device / edge models: Insufficient capability for the conversational discovery use case

---

## ADR-010 — URL Structure

**Status:** Decided (updated 2026-05-07 — original `/listing/[slug]` pattern superseded by route-map.md)
**Decision:** The BLACQList URL structure for all routes.

**Public routes:**
```
/                                                    Homepage
/search                                              Search results
/[city-slug]                                         City landing page
/[city-slug]/[category-slug]                         Category + city landing page
/[city-slug]/business/[listing-slug]                 Business BLACQList Page
/[city-slug]/professional/[listing-slug]             Professional BLACQList Page
/[city-slug]/creative/[listing-slug]                 Creative BLACQList Page
/[city-slug]/event/[listing-slug]                    Event BLACQList Page
/[city-slug]/job/[listing-slug]                      Job BLACQList Page
/[city-slug]/vendor/[listing-slug]                   Vendor BLACQList Page
/[city-slug]/vendor/[listing-slug]/products          Vendor product catalog
/[city-slug]/vendor/[listing-slug]/products/[slug]   Product sub-page (V2)
/[city-slug]/business/[listing-slug]/services/[slug] Service sub-page (V1)
/events                                              Events browse
/jobs                                                Jobs browse
/editorial/[slug]                                    BLACQLight article
/collection/[slug]                                   Curated collection
/guide/[city-slug]                                   City guide
```

**Note:** Entity type is determined by the `listing_type` field on the `listings` table, not by URL prefix. All entity pages share the same dynamic route segment pattern `/[city-slug]/[entity-type]/[listing-slug]`. The original `/listing/[slug]` pattern in this ADR was superseded by the route map established in `ux/route-map.md`.

**Authenticated routes:**
```
/dashboard                     Business owner or supporter dashboard (role-based redirect)
/dashboard/page                Business owner — edit BLACQList Page
/dashboard/analytics           Business owner — analytics
/dashboard/saved               Supporter — saved list
/dashboard/spend               Supporter — spend tracking (V2)
/claim                         Claim a listing
/create                        Create a new listing
```

**Admin routes:**
```
/admin                         Admin dashboard
/admin/listings                Listing management
/admin/claims                  Claim queue
/admin/reviews                 Review queue (V1)
/admin/corrections             Correction queue (V1)
/admin/users                   User management
/admin/editorial               Editorial CMS (V1)
```

**Slug format for listings:** `[business-name]-[city]` — e.g., `sweet-auburn-bbq-atlanta`
- Generated on create, unique, URL-safe
- Does not change when business data changes (stability over accuracy)

---

## ADR-011 — Hosting: Vercel

**Status:** Decided
**Decision:** Vercel for hosting. Edge Network for CDN. Preview deployments on every PR.

**Reasoning:**
- Zero-config Next.js deployment
- Preview URLs enable non-technical stakeholders to review UX before merging
- Vercel Edge Functions can handle geolocation-based city detection
- Serverless functions scale to zero — cost-efficient at MVP traffic levels

**Trade-offs accepted:**
- Vendor lock-in to Vercel — acceptable until V3/V4 scale requires cost optimization
- Cold start latency on serverless functions — mitigated by keeping route handlers lean

---

## ADR-012 — Data Model Philosophy

**Status:** Decided
**Decision:** PostgreSQL relational model with typed entities, not a schema-less document store.

**Core principles:**
- Every entity type is a separate table (not a polymorphic mega-table)
- Listings have a shared base table (`listings`) with entity-type-specific extension tables
- Many-to-many relationships use explicit junction tables
- All primary keys are UUIDs (not sequential integers) for security and portability
- All datetime fields are `timestamptz`
- Audit fields on every entry table: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft deletes (`deleted_at`) on all entities where history matters

**Entity relationship summary (see full data model in `docs/blacqlist/data/`):**
- `users` — auth and profile
- `listings` — base entity record shared across all types
- `listing_details_business` — business-specific fields
- `listing_details_professional` — professional-specific fields (V1)
- `listing_details_creative` — creative-specific fields (V1)
- `listing_details_event` — event-specific fields (V1)
- `categories` — hierarchical category tree
- `cities` — city reference table with geo data
- `media_attachments` — all uploaded media, polymorphic
- `claims` — ownership claim requests
- `reviews` — review records (V1)
- `corrections` — community correction requests (V1)
- `saves` — user-listing saves
- `user_roles` — role assignments

---

## Decisions Still Open

| Decision | Options | Target Phase |
|---|---|---|
| Map / geo provider (city detection, "near me") | Mapbox, Google Maps, Radar | V2 |
| Analytics platform | PostHog, Mixpanel, Amplitude | V1 |
| Error tracking | Sentry (likely) | Phase 0 |
| Search upgrade path | Algolia vs. Typesense | V2 |
| Mobile app approach | React Native vs. Expo vs. native Swift/Kotlin | V4 |
| Marketplace fulfillment tracking | Custom vs. EasyPost | V2 |
| Dollar-flow graph technology | D3.js vs. React Flow vs. Nivo | V3 |

---

## Assumptions

- Supabase remains cost-effective at the scale of 100K–500K listings (validated by public pricing before V2)
- Vercel serverless functions are sufficient for the API load at MVP and V1
- PostgreSQL full-text search is sufficient for MVP and early V1 — plan the migration before search is a user-facing bottleneck

---

## Open Questions

1. Should `listing_details_*` extension tables be created now for all entity types, or created per-phase?
2. Is there a case for a dedicated search microservice (Typesense self-hosted) over Algolia at V2 for cost reasons?
3. Should the AI prompt templates be stored in the database (admin-editable) or in code (version-controlled)?

---

## Do Not Overbuild Yet

- Do not implement Algolia or external search before PostgreSQL FTS is proven insufficient
- Do not implement Stripe Connect (marketplace payouts) before Phase 3
- Do not implement AI API integration before listing data quality is high enough for AI to return useful results
- Do not optimize for V4 mobile scale before V1 web is stable and used
