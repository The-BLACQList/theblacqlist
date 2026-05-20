# Current State Audit — The BLACQList

**Date:** 2026-05-12  
**Purpose:** Baseline snapshot before production conversion work begins. No code was changed during this audit.

---

## Code Quality Gates

| Check | Result | Command |
|---|---|---|
| TypeScript (`tsc --noEmit`) | ✅ Zero errors | `pnpm tsc --noEmit` |
| ESLint (`pnpm lint`) | ✅ Zero errors | `pnpm lint` |

---

## App Structure Summary

| Layer | Count | Location |
|---|---|---|
| Route files (pages, layouts, API routes) | 97 | `app/` |
| Components | 73 | `components/` |
| Lib files | 54 | `lib/` |
| Supabase migrations | 7 | `supabase/migrations/` |
| Mock data files | 2 | `data/` |
| Server actions | 34 | `lib/actions/` |
| TypeScript types (auto-generated) | 40 tables | `lib/supabase/types.ts` |

---

## Route Inventory

**Status key:**  
- `FUNCTIONAL` — Real Supabase queries + logic; works end-to-end  
- `PARTIAL` — Mix of real data and stubs; requires data seeding or stub removal  
- `SHELL` — Static UI, "coming soon" message, or placeholder — no real data  

### Root + Auth

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/` | `app/layout.tsx` | Layout | FUNCTIONAL | No | None | Root layout, fonts, PublicHeader/Footer |
| `/` | `app/page.tsx` | Page | SHELL | No | CATEGORIES, CITIES, FEATURES arrays (lines 16–68) | Intentional marketing content; not a conversion target |
| `/(auth)` | `app/(auth)/layout.tsx` | Layout | FUNCTIONAL | No | None | Auth wrapper layout |
| `/sign-in` | `app/(auth)/sign-in/page.tsx` | Page | FUNCTIONAL | Yes | None | Supabase auth; signInAction server action |
| `/sign-up` | `app/(auth)/sign-up/page.tsx` | Page | FUNCTIONAL | Yes | None | Supabase auth; ROLE_OPTIONS is UI config, not DB data |
| `/verify-email` | `app/(auth)/verify-email/page.tsx` | Page | SHELL | No | None | Static info page; no logic needed |
| `/auth/callback` | `app/auth/callback/route.ts` | API Route | FUNCTIONAL | Yes | None | Supabase OAuth code exchange; redirects to /onboarding |

### Onboarding

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/onboarding` | `app/onboarding/page.tsx` | Page | PARTIAL | Yes | `STUB_CITIES` (lines 12–23) | Calls `setOnboardingRoleAction`; cities hardcoded with TODO comment |

### Public Pages

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/discover` | `app/(public)/discover/page.tsx` | Page | PARTIAL | Yes | Falls back to `MOCK_ENTITIES` when DB empty (lines 44–49) | Queries `listings`; mock fallback hides empty prod state |
| `/search` | `app/(public)/search/page.tsx` | Page | PARTIAL | Yes | Falls back to `MOCK_ENTITIES` when DB empty (lines 93–95) | Full-text search on `search_vector`; same mock fallback |
| `/[citySlug]/business/[listingSlug]` | `app/[citySlug]/business/[listingSlug]/page.tsx` | Page | FUNCTIONAL | Yes | None | Entity detail page; `getEntityPageFromDB()`; only `business` type routed (routing gap — see §Gaps) |
| `/vendors/[slug]` | `app/(public)/vendors/[slug]/page.tsx` | Page | FUNCTIONAL | Yes | None | Vendor storefront; fetches listing + products/services |
| `/marketplace` | `app/(public)/marketplace/page.tsx` | Page | FUNCTIONAL | Yes | None | Fetches `marketplace_products` + `marketplace_services`; empty states shown |
| `/marketplace/products` | `app/(public)/marketplace/products/page.tsx` | Page | FUNCTIONAL | Yes | None | Product listing |
| `/marketplace/services` | `app/(public)/marketplace/services/page.tsx` | Page | FUNCTIONAL | Yes | None | Service listing |
| `/marketplace/products/[slug]` | `app/(public)/marketplace/products/[slug]/page.tsx` | Page | FUNCTIONAL | Yes | None | Product detail |
| `/marketplace/services/[slug]` | `app/(public)/marketplace/services/[slug]/page.tsx` | Page | FUNCTIONAL | Yes | None | Service detail |
| `/collections` | `app/(public)/collections/page.tsx` | Page | FUNCTIONAL | Yes | None | Fetches published collections |
| `/collections/[slug]` | `app/(public)/collections/[slug]/page.tsx` | Page | FUNCTIONAL | Yes | None | Collection detail + items join |
| `/guides` | `app/(public)/guides/page.tsx` | Page | FUNCTIONAL | Yes | None | Queries `guides`; correctly shows empty state with "coming soon" |
| `/guides/[slug]` | `app/(public)/guides/[slug]/page.tsx` | Page | PARTIAL | Yes | None | Fetches guide record but renders "Sections coming soon" — `guide_sections` not rendered |
| `/blacqlight` | `app/(public)/blacqlight/page.tsx` | Page | FUNCTIONAL | Yes | None | Queries `editorial_articles`; correctly shows empty state |
| `/blacqlight/[slug]` | `app/(public)/blacqlight/[slug]/page.tsx` | Page | PARTIAL | Yes | None | Fetches article but renders "Article content coming soon" — `rich_text_content` not rendered |
| `/claim` | `app/(public)/claim/page.tsx` | Page | FUNCTIONAL | Yes | None | Search listings by name; claim buttons |
| `/claim/[listingId]` | `app/(public)/claim/[listingId]/page.tsx` | Page | FUNCTIONAL | Yes | None | Auth-gated; checks existing claims; `ClaimForm` component |
| `/flow-map` | `app/(public)/flow-map/page.tsx` | Page | PARTIAL | Yes | None | Queries flow data; city/category filters are placeholders; entity impact panel is placeholder |
| `/for-business` | `app/(public)/for-business/page.tsx` | Page | SHELL | No | None | Marketing page |
| `/for-vendors` | `app/(public)/for-vendors/page.tsx` | Page | SHELL | No | None | Marketing page |
| `/for-sponsors` | `app/(public)/for-sponsors/page.tsx` | Page | SHELL | No | None | Marketing page |
| `/pricing` | `app/(public)/pricing/page.tsx` | Page | SHELL | No | None | "Paid tiers coming soon" — waitlist CTA |
| `/events` | `app/(public)/events/page.tsx` | Page | SHELL | No | None | No `events` table; static shell |
| `/jobs` | `app/(public)/jobs/page.tsx` | Page | SHELL | No | None | No `jobs` table; static shell |
| `/map` | `app/(public)/map/page.tsx` | Page | SHELL | No | None | No map API integrated; static shell |
| `/about` | `app/(public)/about/page.tsx` | Page | SHELL | No | None | Static content |
| `/contact` | `app/(public)/contact/page.tsx` | Page | SHELL | No | None | Static content |
| `/privacy` | `app/(public)/privacy/page.tsx` | Page | SHELL | No | None | ⚠️ Explicit attorney-review warning in page copy |
| `/terms` | `app/(public)/terms/page.tsx` | Page | SHELL | No | None | ⚠️ Explicit attorney-review warning in page copy |
| `/cookies` | `app/(public)/cookies/page.tsx` | Page | SHELL | No | None | ⚠️ Explicit attorney-review warning in page copy |

### Account

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/account` | `app/account/page.tsx` | Page | FUNCTIONAL | Yes | None | Auth-gated hub; links to sub-sections; TODO comment for full dashboard |
| `/account/saved` | `app/account/saved/page.tsx` | Page | SHELL | No | None | TODO comment line 31: "replace with real saves query once schema migration runs"; `/api/saves` GET already works |
| `/account/claims` | `app/account/claims/page.tsx` | Page | FUNCTIONAL | Yes | None | Fetches user's claims; status badges; withdraw button |
| `/account/receipts` | `app/account/receipts/page.tsx` | Page | FUNCTIONAL | Yes | None | Fetches receipt_uploads; shows spend summary |
| `/account/receipts/new` | `app/account/receipts/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Receipt submission form |
| `/account/community-spend` | `app/account/community-spend/page.tsx` | Page | FUNCTIONAL | Yes | None | Anonymized aggregate spend data |
| `/account/settings` | `app/account/settings/page.tsx` | Page | FUNCTIONAL | Yes | None | Profile settings; `updateProfileAction` |

### Add Business

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/add-business` | `app/add-business/page.tsx` | Page | FUNCTIONAL | Yes | None | Fetches active categories; `SubmitListingForm` |
| `/add-business/submitted` | `app/add-business/submitted/page.tsx` | Page | FUNCTIONAL | No | None | Static confirmation page |

### Dashboard (Owner)

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/dashboard` | `app/dashboard/layout.tsx` | Layout | FUNCTIONAL | Yes | None | Requires owner role via `requireOwner()` |
| `/dashboard` | `app/dashboard/page.tsx` | Page | FUNCTIONAL | Yes | None | Owner listings + completeness checklist |
| `/dashboard/pages` | `app/dashboard/pages/page.tsx` | Page | FUNCTIONAL | Yes | None | Owner's business pages list; status + edit links |
| `/dashboard/pages/[entityId]` | `app/dashboard/pages/[entityId]/page.tsx` | Page | FUNCTIONAL | Yes | None | Entity overview |
| `/dashboard/pages/[entityId]/edit` | `app/dashboard/pages/[entityId]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Page editor (BasicInfo, Contact, Social, SEO, CTA sections) |
| `/dashboard/pages/[entityId]/analytics` | `app/dashboard/pages/[entityId]/analytics/page.tsx` | Page | FUNCTIONAL | Yes | None | Per-entity analytics from `analytics_events` |
| `/dashboard/pages/[entityId]/media` | `app/dashboard/pages/[entityId]/media/page.tsx` | Page | FUNCTIONAL | Yes | None | Media management |
| `/dashboard/pages/[entityId]/offerings` | `app/dashboard/pages/[entityId]/offerings/page.tsx` | Page | FUNCTIONAL | Yes | None | Products/services for page |
| `/dashboard/pages/[entityId]/ai-suggestions` | `app/dashboard/pages/[entityId]/ai-suggestions/page.tsx` | Page | SHELL | No | None | Intentional V2 shell; `NEXT_PUBLIC_AI_FEATURES_ENABLED=false` |
| `/dashboard/products` | `app/dashboard/products/page.tsx` | Page | FUNCTIONAL | Yes | None | Owner's `marketplace_products` |
| `/dashboard/products/new` | `app/dashboard/products/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Product creation form |
| `/dashboard/products/[productId]/edit` | `app/dashboard/products/[productId]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Product edit form |
| `/dashboard/services` | `app/dashboard/services/page.tsx` | Page | FUNCTIONAL | Yes | None | Owner's `marketplace_services` |
| `/dashboard/services/new` | `app/dashboard/services/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Service creation form |
| `/dashboard/services/[serviceId]/edit` | `app/dashboard/services/[serviceId]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Service edit form |
| `/dashboard/upgrade` | `app/dashboard/upgrade/page.tsx` | Page | SHELL | No | None | "Paid plans are coming soon"; intentional placeholder |

### Admin

| Route | File | Type | Status | Supabase | Mock Data | Notes |
|---|---|---|---|---|---|---|
| `/admin` | `app/admin/layout.tsx` | Layout | FUNCTIONAL | Yes | None | Requires admin/super_admin via `requireAdmin()` |
| `/admin` | `app/admin/page.tsx` | Page | FUNCTIONAL | Yes | None | Stat cards; recent queue activity |
| `/admin/entities` | `app/admin/entities/page.tsx` | Page | FUNCTIONAL | Yes | None | Paginated listings table by status |
| `/admin/entities/[id]` | `app/admin/entities/[id]/page.tsx` | Page | FUNCTIONAL | Yes | None | Entity review + approve/reject actions |
| `/admin/claims` | `app/admin/claims/page.tsx` | Page | FUNCTIONAL | Yes | None | Claims queue by status |
| `/admin/claims/[id]` | `app/admin/claims/[id]/page.tsx` | Page | FUNCTIONAL | Yes | None | Claim detail + approve/reject |
| `/admin/verification` | `app/admin/verification/page.tsx` | Page | SHELL | No | None | "Verification queue coming soon" |
| `/admin/reviews` | `app/admin/reviews/page.tsx` | Page | SHELL | No | None | "Review moderation coming soon" |
| `/admin/reports` | `app/admin/reports/page.tsx` | Page | SHELL | No | None | "Reports queue coming soon" |
| `/admin/analytics` | `app/admin/analytics/page.tsx` | Page | FUNCTIONAL | Yes | None | Queries `analytics_events`; 24h / 7d / total counts |
| `/admin/collections` | `app/admin/collections/page.tsx` | Page | FUNCTIONAL | Yes | None | Collections management |
| `/admin/collections/new` | `app/admin/collections/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Create collection |
| `/admin/collections/[id]/edit` | `app/admin/collections/[id]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Edit collection + items |
| `/admin/guides` | `app/admin/guides/page.tsx` | Page | FUNCTIONAL | Yes | None | Guides management |
| `/admin/guides/new` | `app/admin/guides/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Create guide |
| `/admin/guides/[id]/edit` | `app/admin/guides/[id]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Edit guide + sections |
| `/admin/blacqlight` | `app/admin/blacqlight/page.tsx` | Page | FUNCTIONAL | Yes | None | Editorial articles management |
| `/admin/blacqlight/new` | `app/admin/blacqlight/new/page.tsx` | Page | FUNCTIONAL | Yes | None | Create article |
| `/admin/blacqlight/[id]/edit` | `app/admin/blacqlight/[id]/edit/page.tsx` | Page | FUNCTIONAL | Yes | None | Edit article |
| `/admin/receipts` | `app/admin/receipts/page.tsx` | Page | FUNCTIONAL | Yes | None | Receipt review queue; approve/reject with reason |
| `/admin/marketplace` | `app/admin/marketplace/page.tsx` | Page | FUNCTIONAL | Yes | None | Marketplace products + services overview |
| `/admin/ai-tools` | `app/admin/ai-tools/page.tsx` | Page | PARTIAL | No | Mock suggestions shown when no API key | Anthropic not connected; shows mock suggestions with label |

### API Routes

| Route | File | Status | Auth | Notes |
|---|---|---|---|---|
| `GET /api/saves` | `app/api/saves/route.ts` | FUNCTIONAL | Required | Returns user's saved listings with pagination |
| `POST /api/saves` | `app/api/saves/route.ts` | FUNCTIONAL | Required | Saves a listing; validates UUID |
| `DELETE /api/saves` | `app/api/saves/route.ts` | FUNCTIONAL | Required | Unsaves; handles duplicate-key gracefully |
| `POST /api/analytics/event` | `app/api/analytics/event/route.ts` | FUNCTIONAL | None (rate-limited) | 30 req/60s per IP; fire-and-forget insert |
| `GET /api/community-spend` | `app/api/community-spend/route.ts` | FUNCTIONAL | None | Anonymized aggregates; 1h ISR cache |
| `GET /api/flow-map/summary` | `app/api/flow-map/summary/route.ts` | FUNCTIONAL | None | Anonymized flow graph; 1h ISR cache |
| `GET /api/flow-map/personal-impact` | `app/api/flow-map/personal-impact/route.ts` | FUNCTIONAL | Required | Authenticated user's spend impact |
| `GET /api/receipts/[id]/signed-url` | `app/api/receipts/[id]/signed-url/route.ts` | FUNCTIONAL | Required | 15-min signed URL; owner or admin only |
| `POST /api/upload/[bucket]` | `app/api/upload/[bucket]/route.ts` | FUNCTIONAL | Required | Multipart upload; validates MIME + size per bucket |
| `POST /api/marketplace/cta-click` | `app/api/marketplace/cta-click/route.ts` | FUNCTIONAL | None | CTA click analytics; best-effort user assoc. |
| `GET /api/health/supabase` | `app/api/health/supabase/route.ts` | FUNCTIONAL | None | Validates env vars + Supabase auth session |
| `GET /auth/callback` | `app/auth/callback/route.ts` | N/A | OAuth | Supabase OAuth code exchange |

---

## Server Actions Inventory

All 34 server actions are in `lib/actions/` and use `"use server"` pragma. All are production-ready with input validation and typed error returns.

| Domain | File | Actions |
|---|---|---|
| auth | `lib/actions/auth/` | `signInAction`, `signUpAction`, `signOutAction` |
| account | `lib/actions/account/` | `setOnboardingRoleAction`, `updateProfileAction` |
| listings | `lib/actions/listings/` | `submitListingAction` |
| claims | `lib/actions/claims/` | `createClaimAction`, `withdrawClaimAction` |
| reviews | `lib/actions/reviews/` | `createReviewAction`, `deleteOwnReviewAction` |
| corrections | `lib/actions/corrections/` | `submitCorrectionAction` |
| spend | `lib/actions/spend/` | `createReceiptSubmissionAction`, `approveReceiptAction`, `rejectReceiptAction` |
| dashboard | `lib/actions/dashboard/` | `updateListingContentAction`, `updateServiceAction`, `addServiceAction`, `deleteServiceAction`, `deleteMediaAction`, `updateMediaAltTextAction`, `updateCtaAction` |
| marketplace | `lib/actions/marketplace/` | `createProductAction`, `updateProductAction`, `createServiceAction`, `updateServiceAction` |
| editorial | `lib/actions/editorial/` | article, collection, guide action modules |
| admin | `lib/actions/admin/` | `approveEntityAction`, `rejectEntityAction`, `approveClaimAction`, `rejectClaimAction`, `updateVerificationStatusAction`, `moderateReviewAction` |

---

## Migrations Inventory

| Migration | Tables Created | Key Features |
|---|---|---|
| `20260510000000_initial_blacqlist_mvp_schema.sql` | 23 tables | Core MVP: states, cities, categories, plans, profiles, user_roles, listings, listing_details_business, services, media_attachments, listing_hours, listing_links, saves, claims, reviews, collections, collection_items, analytics_events, search_events, entity_analytics_daily, admin_audit_log, moderation_queue; `update_updated_at()` trigger function; trigram extension |
| `20260510000001_mvp_rls_policies.sql` | 0 (RLS only) | Comprehensive per-table RLS; helper functions: `is_admin()`, `is_super_admin()`, `has_role()`, `owns_listing()`, `owns_entity()` |
| `20260511000000_editorial_foundation.sql` | 3 tables | `editorial_articles`, `guides`, `guide_sections`; public read of published only |
| `20260511000001_receipt_community_spend.sql` | 4 tables | `receipt_uploads`, `spend_events`, `flow_nodes`, `flow_edges`; `client_idempotency_key` UNIQUE on receipts |
| `20260511000002_marketplace_foundation.sql` | 2 tables | `marketplace_products`, `marketplace_services`; UNIQUE(listing_id, slug) + global_slug UNIQUE |
| `20260511000003_monetization_foundation.sql` | 3 tables + 1 column | `subscriptions`, `sponsored_placements`, `sponsor_campaigns`; `plan_key` added to `plans` |
| `20260511000004_ai_foundation.sql` | 2 tables | `ai_suggestions`, `ai_generation_requests`; no provider connected |

**Total tables created: 37 of 65 planned**  
All MVP tables present. Gaps are post-MVP (V1/V2/V3 features).

---

## Components with Placeholder Functionality

| Component | File | Issue | Blocker |
|---|---|---|---|
| `SaveButton` | `components/entity-page/SaveButton.tsx` | Placeholder UI; TODO "Ticket 045"; `/api/saves` already works | None — API route is functional |
| `ShareButton` | `components/entity-page/ShareButton.tsx` | Placeholder; no Web Share API integration yet | None — browser API, no backend needed |

---

## Known Broken or Risky Assumptions

| # | Risk | Location | Severity | Detail |
|---|---|---|---|---|
| 1 | **Dev pointing to cloud Supabase** | `.env.local` | HIGH | `NEXT_PUBLIC_SUPABASE_URL` is a live Supabase cloud project, not local CLI. Local dev mutations go to staging DB. |
| 2 | **Mock fallback hides empty production state** | `app/(public)/discover/page.tsx` line 44, `app/(public)/search/page.tsx` line 93 | HIGH | When listings DB is empty, fake businesses render. Will silently show incorrect data until DB is seeded. |
| 3 | **STUB_CITIES in onboarding** | `app/onboarding/page.tsx` lines 12–23 | MEDIUM | 8 hardcoded cities shown; DB has 13 launch cities planned. New users onboard with wrong city list. |
| 4 | **account/saved always empty** | `app/account/saved/page.tsx` | MEDIUM | Shows empty state regardless of whether user has actual saves. Breaks trust for users who saved items. |
| 5 | **Rich text not rendered in blacqlight/[slug]** | `app/(public)/blacqlight/[slug]/page.tsx` | MEDIUM | "Article content coming soon" shown even for published articles with `rich_text_content` populated. |
| 6 | **Guide sections not rendered** | `app/(public)/guides/[slug]/page.tsx` | MEDIUM | "Sections coming soon" shown even for published guides with `guide_sections` records. |
| 7 | **Legal pages have placeholder copy** | `app/(public)/privacy`, `terms`, `cookies` | HIGH | Explicit attorney-review warnings in page text. Cannot launch with these. |
| 8 | **Only `business` entity type is routed** | `app/[citySlug]/business/[listingSlug]/page.tsx` | HIGH | ADR-010 requires `/[city-slug]/[entity-type]/[listing-slug]`. Other types (restaurant, salon, café, etc.) have no route. Any listing_type other than business returns 404. |
| 9 | **Admin verification, reviews, reports are shells** | `app/admin/verification`, `reviews`, `reports` | MEDIUM | Critical admin workflows for beta (verifying businesses, moderating reviews, processing reports) are not built. |
| 10 | **AI tools page shows mock suggestions** | `app/admin/ai-tools/page.tsx` | LOW | Intentional — Anthropic not connected. Clearly labeled in UI. Acceptable for beta. |

---

## What Is NOT Built Yet (Clear Gaps)

| Feature | Status | Notes |
|---|---|---|
| Entity type routing (restaurant, salon, café, etc.) | Not started | Only `business` slug works; other entity types 404 |
| Admin verification queue | Shell only | No workflow, no document review |
| Admin review moderation | Shell only | Reviews exist in DB (`status='intake'`) but no admin UI |
| Admin reports/corrections queue | Shell only | `moderation_queue` table exists; no admin UI |
| SaveButton wired to API | Placeholder | Component renders; API works; not connected |
| ShareButton | Placeholder | No Web Share API; no clipboard fallback |
| `/account/saved` query | Missing | API route works; page doesn't call it |
| Guide sections rendering | Missing | Table + data exists; page shows "coming soon" |
| Article rich text rendering | Missing | Column exists; page shows "coming soon" |
| Legal copy | Placeholder | Attorney review required |
| Flow-map filters | Placeholder | City/category filter UI rendered but not wired |
| Map page | Shell | No mapping API integrated |
| Events feature | Shell | No `events` table in schema |
| Jobs feature | Shell | No `jobs` table in schema |
| Stripe integration | Not started | Env vars defined; no code; V1 feature |
| Stripe Connect (payouts) | Not started | V2 feature |
| AI content suggestions | Not started | Tables + prompts exist; Anthropic not connected; V2 |
| Algolia search | Not started | V2 feature |
| Sentry error tracking | Not started | DSN env var defined; not installed |
| `types/index.ts` | Placeholder | 2-line comment file; types live co-located near data |
| 28 remaining DB tables | Not migrated | Schema plan has 65; 37 migrated; all gaps are V1+ |
