# The BLACQList — Full Production Roadmap

**Date:** 2026-05-12  
**Status:** Approved — ready to execute  
**North Star:** Make the Black economy visible, discoverable, and self-reinforcing.

This document is the authoritative build guide from current shell/demo state to full production. It covers four phases and all major feature systems: core discovery, editorial CMS, Stripe monetization, the Circulation Map (community dollar-flow visualization), and all 17 AI agents.

**Related docs:**

- `production/current-state-audit.md` — full route/component inventory as of 2026-05-12
- `production/mock-to-real-data-map.md` — every mock data location and replacement plan
- `production/beta-build-task-index.md` — 20-task ordered Phase 0 index

---

## Quick Reference: Phase Timeline

| Phase | Name                | Goal                                           | Weeks | Key Deliverable                                  |
| ----- | ------------------- | ---------------------------------------------- | ----- | ------------------------------------------------ |
| **0** | Beta Foundation     | Remove mocks, seed data, fix routing           | 1–3   | Real data in the app; zero mock fallbacks        |
| **1** | MVP Beta Launch     | Core workflows live with 250+ listings         | 3–10  | Platform usable by real businesses + supporters  |
| **2** | V1: Trust & Revenue | Reviews + Stripe subscriptions live            | 10–18 | Revenue on; badges earnable; editorial published |
| **3** | V2: Commerce + AI   | Circulation Map pipeline; all 17 AI agents     | 18–32 | Spend tracking live; AI agents in production     |
| **4** | V3: Intelligence    | Interactive Circulation Map; full AI concierge | 32–44 | Dollar flow visible; AI-powered discovery public |

---

## Current State Snapshot (2026-05-12)

- 97 route files | 37 Supabase tables | 34 server actions | 73 components | 7 migrations
- tsc: ✅ zero errors | lint: ✅ zero errors
- ~60 routes FUNCTIONAL | ~5 PARTIAL | ~32 SHELL
- Mock data in 2 files: `data/mock-entities.ts`, `data/mock-entity-page.ts`
- Dev environment pointing at live Supabase cloud project (risk — see Phase 0 task 1)

---

## Phase 0 — Beta Foundation

**Goal:** Every existing route works with real data. No mock fallbacks. Clean local dev environment. All admin queues functional.  
**Duration:** Weeks 1–3  
**No new migrations needed** — all 37 tables exist.

### Build Tasks (in dependency order)

| #    | Task                                                                                         | Files                                                                                                                        | Risk   |
| ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0.1  | Set up local Supabase CLI — stop dev pointing at cloud project                               | `.env.local`, `supabase/config.toml`                                                                                         | HIGH   |
| 0.2  | Seed `states` + `cities` (13 launch cities with slug, state_abbr, lat/lng)                   | `supabase/seeds/002_reference_data.sql` (new)                                                                                | LOW    |
| 0.3  | Seed `categories` (25-category taxonomy + subcategories with parent_id chain)                | `supabase/seeds/003_categories.sql` (new)                                                                                    | LOW    |
| 0.4  | Seed `plans` (4 rows: Free / Starter / Growth / Premium with monthly + annual prices)        | `supabase/seeds/004_plans.sql` (new)                                                                                         | LOW    |
| 0.5  | Verify and push `supabase/seeds/001_listings.sql` (99KB file exists)                         | `supabase/seeds/001_listings.sql`                                                                                            | MEDIUM |
| 0.6  | Replace `STUB_CITIES` in onboarding with cities DB query                                     | `app/onboarding/page.tsx` lines 12–23                                                                                        | LOW    |
| 0.7  | Remove `MOCK_ENTITIES` fallback from `/discover`; show real empty state                      | `app/(public)/discover/page.tsx` lines 44–49, `lib/listings/query.ts`                                                        | MEDIUM |
| 0.8  | Remove `MOCK_ENTITIES` fallback from `/search`; show real empty state                        | `app/(public)/search/page.tsx` lines 93–95, `lib/listings/query.ts`                                                          | MEDIUM |
| 0.9  | Wire `SaveButton` → `POST /api/saves` (save) + `DELETE /api/saves` (unsave)                  | `components/entity-page/SaveButton.tsx`                                                                                      | LOW    |
| 0.10 | Wire `/account/saved` to fetch user's saved listings                                         | `app/account/saved/page.tsx`                                                                                                 | LOW    |
| 0.11 | Render `rich_text_content` column in `/blacqlight/[slug]`                                    | `app/(public)/blacqlight/[slug]/page.tsx`                                                                                    | LOW    |
| 0.12 | Render `guide_sections` rows in `/guides/[slug]`                                             | `app/(public)/guides/[slug]/page.tsx`                                                                                        | LOW    |
| 0.13 | Wire `ShareButton` → Web Share API + clipboard fallback                                      | `components/entity-page/ShareButton.tsx`                                                                                     | LOW    |
| 0.14 | Build admin verification queue (replaces "coming soon")                                      | `app/admin/verification/page.tsx`, `lib/actions/admin/`                                                                      | MEDIUM |
| 0.15 | Build admin reviews moderation queue (replaces "coming soon")                                | `app/admin/reviews/page.tsx`, `lib/actions/admin/moderateReviewAction.ts`                                                    | MEDIUM |
| 0.16 | Build admin reports/corrections queue (replaces "coming soon")                               | `app/admin/reports/page.tsx`, new `lib/actions/admin/resolveReportAction.ts`                                                 | MEDIUM |
| 0.17 | Entity type routing: restructure `app/[citySlug]/business/` → `app/[citySlug]/[entityType]/` | `app/[citySlug]/business/[listingSlug]/page.tsx` → `app/[citySlug]/[entityType]/[listingSlug]/page.tsx`                      | HIGH   |
| 0.18 | Migrate types from mock files to `types/index.ts`                                            | `types/index.ts`, `data/mock-entities.ts`, `data/mock-entity-page.ts`, `lib/listings/query.ts`, `lib/listings/entityPage.ts` | LOW    |
| 0.19 | Delete `data/mock-entities.ts` + `data/mock-entity-page.ts`                                  | Both files                                                                                                                   | LOW    |
| 0.20 | Replace legal placeholder copy (attorney-reviewed text for privacy, terms, cookies)          | `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`, `app/(public)/cookies/page.tsx`                              | HIGH   |

### Phase 0 Go/No-Go Checklist

- [ ] `supabase start` runs all 7 migrations cleanly on local CLI
- [ ] `/discover` shows seeded real businesses; `MOCK_ENTITIES` import removed from all files
- [ ] `/search?q=<term>` returns real results; empty state shown for zero results
- [ ] Entity type routing: `/atlanta/restaurant/slug` works if listing_type='restaurant'
- [ ] `SaveButton` saves and unsaves; save persists on page refresh
- [ ] `/account/saved` shows real saves; correct empty state when none
- [ ] Admin verification, reviews, reports pages show real queue content
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm lint` — zero errors
- [ ] No console errors on `/`, `/discover`, `/sign-in`, entity page, `/dashboard`

---

## Phase 1 — MVP Beta Launch

**Goal:** Platform live with real businesses and core workflows end-to-end. Admin can manage the directory. 250+ seeded listings across 3 cities.  
**Duration:** Weeks 3–10  
**Env vars to activate:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SENTRY_DSN`

### 1.1 — Additional Entity Types

New migration: `20260512000000_additional_entity_types.sql`

**Tables to create:**

```sql
-- Professional listing extension (lawyers, consultants, therapists, doctors)
listing_details_professional (
  listing_id uuid PK FK → listings.id,
  specialty text,
  credentials text[],       -- ["J.D.", "Licensed Therapist", etc.]
  license_type text,
  license_number text,
  accepting_new_clients boolean DEFAULT true,
  availability_notes text,
  created_at timestamptz DEFAULT now()
)

-- Creative listing extension (artists, photographers, designers, writers)
listing_details_creative (
  listing_id uuid PK FK → listings.id,
  medium text,              -- "oil painting", "photography", etc.
  portfolio_url text,
  commission_open boolean DEFAULT true,
  style_tags text[],
  created_at timestamptz DEFAULT now()
)

-- Event listing (auto-expires after end_datetime)
listing_details_event (
  listing_id uuid PK FK → listings.id,
  event_type text,          -- "market", "pop-up", "conference", "concert"
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  venue_name text,
  venue_address text,
  ticket_url text,
  ticket_price_range text,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,     -- RRULE string if recurring
  created_at timestamptz DEFAULT now()
)

-- Job listing
listing_details_job (
  listing_id uuid PK FK → listings.id,
  job_type text CHECK (job_type IN ('full_time','part_time','contract','freelance','internship')),
  salary_min_cents integer,
  salary_max_cents integer,
  salary_period text CHECK (salary_period IN ('hour','week','month','year')),
  remote_ok boolean DEFAULT false,
  apply_url text NOT NULL,
  deadline_at timestamptz,
  created_at timestamptz DEFAULT now()
)

-- User-submitted corrections to listing data
corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  current_value text,
  suggested_value text NOT NULL,
  submitter_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Owner responses to published reviews
review_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  response_text text NOT NULL CHECK (length(response_text) BETWEEN 1 AND 600),
  status text DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Searchable tags (curated by admin)
tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Many-to-many: listings ↔ tags
listing_tags (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, tag_id)
)

-- Neighborhoods within cities (for more granular discovery)
neighborhoods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  UNIQUE (city_id, slug),
  created_at timestamptz DEFAULT now()
)
```

**RLS for new tables:** Follow patterns from `20260510000001_mvp_rls_policies.sql`.

- `listing_details_*`: public read for published listings; owner insert/update
- `corrections`: authenticated insert; service_role for admin writes
- `review_responses`: owner insert on own listings; public read of published
- `tags`, `listing_tags`, `neighborhoods`: public read; service_role for writes

**Page templates:**

- Professional Page: same as Business template; shows credentials, specialty, license, availability
- Creative Page: same as Business; shows medium, portfolio link, commission status, style tags
- Event Page: same; shows date/time, venue, ticket link; page auto-archives after end_datetime
- Job Page: same; shows job type, salary, remote status, apply link; archives after deadline_at

Files:

- `app/[citySlug]/[entityType]/[listingSlug]/page.tsx` — already handles `listing_type` from DB; add conditional rendering for new extension table fields
- No new page files needed — entity type routing handles all variants

### 1.2 — Full BLACQList Page Feature Completion

All components exist. Wire them fully:

| Feature                         | Component                                         | Action                                                                           |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Review submission (intake only) | `components/entity-page/ReviewForm.tsx`           | Form submits via `createReviewAction`; `status='intake'`; not displayed publicly |
| Community corrections           | `components/entity-page/ReportCorrectionForm.tsx` | Submits via `submitCorrectionAction`; lands in admin reports queue               |
| Flow-map widget                 | `components/flow-map/FlowSummaryCards.tsx`        | Shows real data from `/api/flow-map/summary` (wire placeholders off)             |

### 1.3 — Full Claim Workflow

Email notifications via Resend (templates already in `lib/email/templates/`):

| Event                | Template              | Trigger                             |
| -------------------- | --------------------- | ----------------------------------- |
| Claim submitted      | `claim-submitted.tsx` | After `createClaimAction` succeeds  |
| Claim approved       | `claim-approved.tsx`  | After admin `approveClaimAction`    |
| Claim rejected       | `claim-rejected.tsx`  | After admin `rejectClaimAction`     |
| Welcome (new signup) | `welcome.tsx`         | After `signUpAction` confirms email |

Files: `lib/actions/admin/approveClaim.ts`, `lib/actions/admin/rejectClaim.ts` — add Resend call after DB update

### 1.4 — Owner Dashboard — Full Editor

All section components exist in `components/dashboard/`. Wire remaining:

| Section            | Component              | Status                                       |
| ------------------ | ---------------------- | -------------------------------------------- |
| Basic info         | `BasicInfoSection.tsx` | Exists                                       |
| Contact            | `ContactSection.tsx`   | Exists                                       |
| Social links       | `SocialSection.tsx`    | Exists                                       |
| SEO metadata       | `SeoSection.tsx`       | Exists                                       |
| Primary CTA        | `CtaSection.tsx`       | Exists                                       |
| About / story      | `AboutSection.tsx`     | Exists                                       |
| Media gallery      | `MediaGrid.tsx`        | Exists — wire to `/api/upload/listing-media` |
| Hours of operation | `listing_hours` table  | Build `HoursSection.tsx` (new)               |
| Business links     | `listing_links` table  | Build `LinksSection.tsx` (new)               |

Stat cards on `/dashboard` page:

- Query `entity_analytics_daily` for 7/30-day page views, CTA clicks, save counts
- Completeness checklist already exists on `/dashboard/page.tsx`

Files: `app/dashboard/pages/[entityId]/edit/page.tsx`, `app/dashboard/pages/[entityId]/media/page.tsx`

### 1.5 — Submit Business — Full Multi-Step Flow

Current `SubmitListingForm` is a single form. Replace with multi-step wizard:

1. Entity type selector (Business / Professional / Creative / Event / Job)
2. Basic info (name, tagline, description — with duplicate detection before proceeding)
3. Contact (phone, email, website, address)
4. Category + city selection (real DB data)
5. Media (logo + up to 12 gallery images via `/api/upload/listing-media`)
6. Primary CTA (type + URL)
7. Preview (read-only summary)
8. Submit → status='pending'

**Duplicate detection:** Before creating, check: `SELECT id FROM listings WHERE normalized_name = lower(trim($name)) AND city_id = $city_id AND deleted_at IS NULL`  
If match found → show warning dialog with link to existing listing + option to claim instead.

Files: `app/add-business/page.tsx`, `components/listings/SubmitListingForm.tsx`, `lib/actions/listings/submitListingAction.ts`

### 1.6 — Sitemap, SEO, and Structured Data

| Feature                | File                                                                  | Notes                                                                         |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Auto-generated sitemap | `app/sitemap.ts` (new)                                                | All published listings + static pages; revalidated every 24h                  |
| robots.txt             | `app/robots.ts` (new)                                                 | Allow crawl; disallow `/admin`, `/dashboard`, `/api`                          |
| OG image per listing   | `app/[citySlug]/[entityType]/[listingSlug]/opengraph-image.tsx` (new) | `ImageResponse` with listing name + category + cover image                    |
| LocalBusiness JSON-LD  | In entity page server component                                       | Already partially present; complete with address, hours, geo, aggregateRating |
| Canonical URL          | In page metadata                                                      | `https://theblacqlist.com/[city]/[type]/[slug]`                               |

### 1.7 — Analytics Pipeline

Wire `lib/analytics/client.ts` to fire events:

| Event          | Where fired                    | Data sent                                         |
| -------------- | ------------------------------ | ------------------------------------------------- |
| `page_view`    | Entity page server component   | listing_id, city_id, referrer                     |
| `cta_click`    | SaveButton, CTA button onClick | listing_id, cta_type, destination_url             |
| `save`         | SaveButton after success       | listing_id                                        |
| `search_query` | Search page server component   | query, result_count, city_filter, category_filter |

**Nightly aggregation job** (Supabase Edge Function):

- Runs at 00:00 UTC daily
- Aggregates `analytics_events` from prior day → inserts row to `entity_analytics_daily` per listing
- File: `supabase/functions/aggregate-analytics/index.ts` (new)

### 1.8 — Seed Production Data

**Minimum before go/no-go:**

- Atlanta: 150+ published listings (use existing `001_listings.sql` + supplement)
- Houston: 50+ published listings
- Chicago: 50+ published listings
- 40%+ of all listings have ≥1 image
- 20%+ have `trust_tier IN ('claimed','verified')`
- Every published listing has: description (100+ chars), category_id, city_id, cta_type, slug

### Phase 1 Go/No-Go Checklist

- [ ] 250+ listings published across Atlanta / Houston / Chicago
- [ ] `sitemap.xml` submitted to Google Search Console; listings indexable
- [ ] Claim workflow: user submits → admin approves → email sent → owner dashboard shows claimed badge
- [ ] Submit business: multi-step form completes; duplicate detection blocks re-submission
- [ ] Admin can approve/reject entities, claims, reviews, and reports with all actions logged
- [ ] Resend emails delivered in staging for claim + welcome flows
- [ ] Sentry capturing errors in production Vercel project
- [ ] Entity page JSON-LD validates in Google Rich Results Test
- [ ] OG images render correctly when URL shared on social
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] No P0 console errors across all routes

---

## Phase 2 — V1: Trust & Revenue

**Goal:** Reviews display publicly. Trust badges earnable. Editorial content published. Stripe subscriptions live.  
**Duration:** Weeks 10–18  
**Env vars to activate:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### 2.1 — Reviews Display (Moderated)

Admin moderation (built in Phase 0) approves reviews → `status='published'`.

**Public display:**

- `components/entity-page/EntityReviewsSection.tsx` (exists) — render only `status='published'` reviews
- Average rating calculated from published reviews; shown on entity page hero
- Star rating visible on discovery cards (if ≥1 published review)
- Review count displayed: "12 reviews"
- Owner response display: show approved `review_responses` below each review

**Auto-grant BLACQList Certified (DB function):**

```sql
-- Called by trigger on INSERT/UPDATE to reviews and listing aggregate columns
CREATE OR REPLACE FUNCTION check_and_grant_certified(p_listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET trust_tier = 'certified', certified_at = now()
  WHERE id = p_listing_id
    AND trust_tier = 'verified'
    AND review_count >= 6
    AND review_avg_rating >= 4.0
    AND last_active_at >= now() - interval '90 days'
    AND trust_tier != 'certified';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 — Trust System

| Badge               | Condition                             | Visible on                                       |
| ------------------- | ------------------------------------- | ------------------------------------------------ |
| Unclaimed           | `trust_tier='unclaimed'`              | Entity page, search card                         |
| Claimed             | `trust_tier='claimed'`                | Entity page, search card                         |
| Verified            | `trust_tier='verified'` (admin-set)   | Entity page hero, search card                    |
| BLACQList Certified | `trust_tier='certified'` (auto-grant) | Entity page hero, search card, discovery filters |

Files: `components/ui/status-badge.tsx` (exists), `components/entity-page/EntityTrustSection.tsx` (exists)

### 2.3 — Editorial CMS (Full Activation)

| Content Type        | Admin Route                       | Public Route                         | Status      |
| ------------------- | --------------------------------- | ------------------------------------ | ----------- |
| BLACQLight articles | `/admin/blacqlight/` (exists)     | `/blacqlight/[slug]` (fixed Phase 0) | ✅ Activate |
| City guides         | `/admin/guides/` (exists)         | `/guides/[slug]` (fixed Phase 0)     | ✅ Activate |
| Collections         | `/admin/collections/` (exists)    | `/collections/[slug]` (exists)       | ✅ Activate |
| Featured editorial  | Admin assigns to `featured_slots` | Homepage featured section            | Build       |

**New migration table:** `featured_slots` — admin assigns a collection/article/guide to a named slot (e.g., `homepage_hero`, `homepage_editorial_1`, `homepage_editorial_2`). Homepage queries this table server-side.

### 2.4 — Stripe Subscriptions

**New API routes:**

```
POST /api/checkout/subscription
  - Auth required
  - Body: { listing_id, plan_key, billing_period: 'monthly'|'yearly' }
  - Looks up plan's stripe_price_id
  - Creates Stripe Checkout session with success_url, cancel_url, metadata
  - Returns { checkout_url }

POST /api/webhooks/stripe
  - Stripe signature verification
  - Handles:
    - checkout.session.completed → upsert subscriptions row, status='active'
    - invoice.payment_succeeded → update subscriptions.current_period_end
    - customer.subscription.updated → sync status
    - customer.subscription.deleted → status='canceled'
```

**Dashboard upgrade page** (`app/dashboard/upgrade/page.tsx`):

- Replace "coming soon" with real plan comparison table (Free / Starter / Growth / Premium)
- "Upgrade" button triggers `POST /api/checkout/subscription`
- Current plan badge shows on dashboard header

**Subscription guard:**

```typescript
// lib/dashboard/subscriptionGuard.ts
export async function getActiveSubscription(listingId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end, plans(plan_key)')
    .eq('listing_id', listingId)
    .eq('status', 'active')
    .single()
  return data // null = Free tier
}
```

Files: `app/api/webhooks/stripe/route.ts` (new), `app/api/checkout/subscription/route.ts` (new), `app/dashboard/upgrade/page.tsx`, `lib/dashboard/subscriptionGuard.ts` (new)

### 2.5 — Sponsored Placements

**Admin workflow:**

- Admin creates a `sponsored_placements` row for a listing (type, zone, dates)
- Placement query in relevant pages: `SELECT listing_id FROM sponsored_placements WHERE status='active' AND placement_zone=$zone AND starts_at <= now() AND ends_at >= now() LIMIT 1`
- "Sponsored" label displayed on placement cards (required)

**Placement zones:**

- `homepage` — featured business row above discovery grid
- `city` — featured row on `/[citySlug]` city page
- `category` — featured row on `/category/[categorySlug]` page
- `search` — featured row above search results

Files: `app/admin/sponsored-placements/page.tsx` (new), query modifications in homepage + search + city + category pages

### 2.6 — Business Analytics Dashboard

`/dashboard/pages/[entityId]/analytics` (exists) — add:

- 7/30/90-day trend charts using `entity_analytics_daily` (Recharts bar chart)
- Search impressions count from `search_events`
- Save trend line
- Top search terms that led to this page

Platform analytics at `/admin/analytics` (exists) — add:

- Listings by city (bar chart)
- Listings by category (horizontal bar)
- Claim resolution time (average days pending → approved)
- Weekly new users trend

### 2.7 — Expanded Search and Discovery

**New routes:**

| Route                      | File                                                  | Purpose                            |
| -------------------------- | ----------------------------------------------------- | ---------------------------------- |
| `/[citySlug]`              | `app/(public)/[citySlug]/page.tsx` (new)              | All published businesses in a city |
| `/category/[categorySlug]` | `app/(public)/category/[categorySlug]/page.tsx` (new) | Cross-city category browse         |

**Search enhancements:**

- Category filter chips on `/discover` and `/search` (currently "coming soon" text)
- City filter dropdown
- Sort: relevance / newest / most saves / highest rated (after reviews live)
- Filter count badge on mobile filter drawer

### New Migration: `20260512000001_v1_features.sql`

```sql
-- Editorial featured slots (homepage, city, category placements)
CREATE TABLE featured_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_key text NOT NULL UNIQUE,  -- 'homepage_hero', 'homepage_editorial_1', etc.
  content_type text NOT NULL CHECK (content_type IN ('collection','article','guide','listing')),
  content_id uuid NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  set_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verification document submissions
CREATE TABLE verification_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  submitter_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_path text,           -- Supabase Storage path in verification-docs bucket
  document_type text,           -- 'business_license','ein_letter','articles_of_incorporation'
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Platform-wide daily aggregates (admin dashboard)
CREATE TABLE platform_analytics_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  total_listings integer DEFAULT 0,
  new_listings integer DEFAULT 0,
  total_users integer DEFAULT 0,
  new_users integer DEFAULT 0,
  total_searches integer DEFAULT 0,
  total_page_views integer DEFAULT 0,
  total_cta_clicks integer DEFAULT 0,
  total_saves integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add search rank boost to listings (admin-controlled for sponsored uplift)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_rank_boost integer DEFAULT 0;

-- Add certified timestamp to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS certified_at timestamptz;

-- DB function: auto-grant certified badge
CREATE OR REPLACE FUNCTION check_and_grant_certified(p_listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET trust_tier = 'certified', certified_at = now()
  WHERE id = p_listing_id
    AND trust_tier = 'verified'
    AND review_count >= 6
    AND review_avg_rating >= 4.0
    AND last_active_at >= now() - interval '90 days'
    AND trust_tier != 'certified';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Phase 2 Go/No-Go Checklist

- [ ] Published reviews render on entity pages with star ratings and review count
- [ ] BLACQList Certified auto-grant fires correctly in staging (set up test account with 6+ reviews)
- [ ] Stripe test checkout creates subscription; Stripe Dashboard shows payment
- [ ] Webhook updates `subscriptions.status='active'` after checkout
- [ ] Subscription guard blocks paid features for Free tier users
- [ ] `/dashboard/upgrade` shows real plans with working Checkout button
- [ ] Published article shows full content at `/blacqlight/slug`
- [ ] Published guide shows sections at `/guides/slug`
- [ ] Featured slot on homepage shows admin-assigned collection
- [ ] Sponsored placement appears with "Sponsored" label
- [ ] Stripe test cancellation via webhook updates `subscriptions.status='canceled'`

---

## Phase 3 — V2: Commerce Layer + AI Agents

**Goal:** Receipt tracking live and feeding Circulation Map. All 17 AI agents in production. Marketplace media upload complete.  
**Duration:** Weeks 18–32  
**Env vars to activate:** `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_AI_FEATURES_ENABLED=true`

### 3.1 — Marketplace: Completion

Current state: routes functional, products/services queryable, CTA tracking working. Complete:

- Image upload for products/services (currently URL-only): add upload flow using `/api/upload/listing-media`
- Marketplace search: full-text search within `marketplace_products.name + description`
- Marketplace category filter: `marketplace_products.category_id` FK (add column + seed data)
- Vendor analytics: `/dashboard/pages/[entityId]/analytics` — add CTA click breakdown by product

Files: `app/dashboard/products/new/page.tsx`, `app/dashboard/services/new/page.tsx` (add image upload)

### 3.2 — Receipt Tracking — Full Workflow

**User flow (mobile-first):**

1. `/account/receipts/new` — open camera or file picker (`accept="image/*" capture="environment"`)
2. Upload to `receipts` storage bucket via `/api/upload/receipts`
3. OCR suggestion: send image path to Anthropic Vision (Claude Haiku) → returns suggested business_name, amount, date
4. User confirms/edits; selects matched listing from fuzzy search
5. Submit form → `createReceiptSubmissionAction` → `receipt_uploads` row with `status='pending_review'`
6. Admin reviews at `/admin/receipts` (exists) → approve
7. On approval: server action calls `process_receipt_approval()` DB function (Phase 3 migration)

**OCR route:**

```
POST /api/receipt/ocr
  - Auth required
  - Body: { file_path: string }  (Supabase Storage path)
  - Generates 5-min signed URL for the image
  - Calls Claude Haiku with vision: "Extract business name, amount, and date from this receipt image. Return JSON."
  - Returns: { business_name, amount_cents, purchase_date, confidence }
  - Never stores image content; only returns structured extraction
```

Files: `app/api/receipt/ocr/route.ts` (new), `app/account/receipts/new/page.tsx`, `components/spend/ReceiptSubmissionForm.tsx`

### 3.3 — Circulation Map — Full Pipeline

**New migration: `20260512000002_flow_map_triggers.sql`**

```sql
-- Add city_id attribution to spend_events (missing from current schema)
ALTER TABLE spend_events ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS spend_events_city_idx ON spend_events (city_id);

-- Core aggregation function
CREATE OR REPLACE FUNCTION process_receipt_approval(p_receipt_id uuid)
RETURNS void AS $$
DECLARE
  v_listing_id uuid;
  v_city_id uuid;
  v_amount_cents integer;
  v_purchase_date date;
  v_source_node_id uuid;
  v_target_node_id uuid;
BEGIN
  -- Get receipt details
  SELECT ru.listing_id, l.city_id, ru.amount_cents, ru.purchase_date
  INTO v_listing_id, v_city_id, v_amount_cents, v_purchase_date
  FROM receipt_uploads ru
  JOIN listings l ON l.id = ru.listing_id
  WHERE ru.id = p_receipt_id;

  -- Insert anonymized spend_event (no user_id)
  INSERT INTO spend_events (receipt_upload_id, listing_id, city_id, amount_cents, purchase_date)
  VALUES (p_receipt_id, v_listing_id, v_city_id, v_amount_cents, v_purchase_date)
  ON CONFLICT (receipt_upload_id) DO NOTHING;

  -- Upsert business flow_node
  INSERT INTO flow_nodes (node_type, entity_id, display_name, total_spend_cents, transaction_count)
  SELECT 'business', v_listing_id, l.name, v_amount_cents, 1
  FROM listings l WHERE l.id = v_listing_id
  ON CONFLICT (node_type, entity_id) DO UPDATE
    SET total_spend_cents = flow_nodes.total_spend_cents + EXCLUDED.total_spend_cents,
        transaction_count = flow_nodes.transaction_count + 1;

  -- Upsert city flow_node
  INSERT INTO flow_nodes (node_type, entity_id, display_name, total_spend_cents, transaction_count)
  SELECT 'city', v_city_id, c.name, v_amount_cents, 1
  FROM cities c WHERE c.id = v_city_id
  ON CONFLICT (node_type, entity_id) DO UPDATE
    SET total_spend_cents = flow_nodes.total_spend_cents + EXCLUDED.total_spend_cents,
        transaction_count = flow_nodes.transaction_count + 1;

  -- Get node IDs
  SELECT id INTO v_source_node_id FROM flow_nodes WHERE node_type = 'city' AND entity_id = v_city_id;
  SELECT id INTO v_target_node_id FROM flow_nodes WHERE node_type = 'business' AND entity_id = v_listing_id;

  -- Upsert flow_edge (city → business)
  INSERT INTO flow_edges (source_node_id, target_node_id, total_spend_cents, transaction_count)
  VALUES (v_source_node_id, v_target_node_id, v_amount_cents, 1)
  ON CONFLICT (source_node_id, target_node_id) DO UPDATE
    SET total_spend_cents = flow_edges.total_spend_cents + EXCLUDED.total_spend_cents,
        transaction_count = flow_edges.transaction_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on receipt approval
CREATE OR REPLACE FUNCTION trigger_receipt_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM process_receipt_approval(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipt_approval_trigger
AFTER UPDATE ON receipt_uploads
FOR EACH ROW EXECUTE FUNCTION trigger_receipt_approval();
```

**Circulation Map — `/flow-map` page activation:**

Wire existing component placeholders to real data:

| Component             | Current State                     | Action                                  |
| --------------------- | --------------------------------- | --------------------------------------- |
| `FlowSummaryCards`    | Exists, wired                     | Verify real data flows in               |
| `FlowNodeTable`       | Exists                            | Wire city/category filter query params  |
| `FlowMapNetwork`      | Exists (decorative SVG)           | Upgrade to force-directed graph         |
| City/category filters | Placeholder `{/* placeholder */}` | Wire to URL query params + API filters  |
| Entity impact panel   | Placeholder                       | Wire to `/api/flow-map/personal-impact` |

**FlowMapNetwork visualization** (install `react-force-graph-2d`):

- Nodes: businesses (circles, amber gold) + cities (squares, charcoal)
- Node size: proportional to `total_spend_cents`
- Edges: `transaction_count >= 5` only (privacy floor)
- Edge thickness: proportional to `transaction_count`
- Click on business node → navigate to entity page
- Hover: tooltip with business name + total spend formatted as dollars

Files: `components/flow-map/FlowMapNetwork.tsx`, `app/(public)/flow-map/page.tsx`

### 3.4 — AI Agent Layer

**Infrastructure: `lib/ai/client.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runAgent<T>({
  agentType,
  model,
  systemPrompt,
  userPrompt,
  listingId,
  triggeredBy,
}: AgentRunParams): Promise<AgentResult<T>> {
  // Log run start to ai_generation_requests
  // Use prompt caching for system prompts (cache_control: { type: "ephemeral" })
  // Call API
  // Log token counts and duration
  // Return structured result
}
```

Prompt caching: all system prompts use `cache_control: { type: "ephemeral" }`. Estimated 70%+ cache hit rate on repeated agent calls.

**New migration: `20260512000003_ai_agent_runs.sql`**

```sql
CREATE TABLE ai_agent_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type text NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('owner','admin','cron','system')),
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  cache_read_tokens integer,
  duration_ms integer,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed','skipped')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add FK from ai_suggestions to run log
ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS agent_run_id uuid REFERENCES ai_agent_runs(id) ON DELETE SET NULL;

CREATE INDEX ai_agent_runs_listing_idx ON ai_agent_runs (listing_id);
CREATE INDEX ai_agent_runs_agent_type_idx ON ai_agent_runs (agent_type);
CREATE INDEX ai_agent_runs_created_idx ON ai_agent_runs (created_at DESC);
```

---

#### All 22 AI Agents — Complete Specification

**Privacy non-negotiables (all agents):**

- No user_id, email, phone, or full name passed to Anthropic
- No receipt image content passed to Anthropic (OCR only gets the image, not metadata)
- All prompts assembled server-side
- All outputs stored in `ai_suggestions` with `status='pending'` before any display
- No suggestion auto-published

---

##### Shopper-Side Agents (5)

**Agent S1: Find-It-For-Me**  
_"What are you looking for?" → ranked listing results_

- Model: Claude Haiku 4.5
- Trigger: User types natural language query in search bar on `/discover`
- File: `lib/ai/agents/shopper.ts` → `findItForMe()`
- System prompt (cached): Platform overview + category list + city list
- User prompt: `"Find me: {query}. City: {city}. Return top 5 listing IDs from this list: {listing_ids_json} with a 1-sentence reason why each matches."`
- Output: `Array<{ listing_id: uuid, relevance_note: string }>` stored in session (not DB)
- Display: Alongside normal search results; labeled "AI suggestions"

**Agent S2: Support Local Tonight**  
_Occasion-aware, time-sensitive recommendations_

- Model: Claude Haiku 4.5
- Trigger: User taps "Support Tonight" button on discover page
- File: `lib/ai/agents/shopper.ts` → `supportLocalTonight()`
- Input: current_time (hour only, no date), city, optional occasion text
- Output: 3–5 listing IDs with "why tonight" note
- Display: Modal or drawer; labeled "Tonight's picks — AI suggestion"

**Agent S3: Gift Finder**  
_Gift recommendations by recipient + occasion + budget_

- Model: Claude Haiku 4.5
- Trigger: User opens Gift Finder tool (new `/discover` widget)
- File: `lib/ai/agents/shopper.ts` → `giftFinder()`
- Input: recipient_type (mom/partner/friend/colleague), occasion, budget_max_cents, city
- Output: Mix of listing IDs + marketplace product IDs with gift narrative (1–2 sentences)
- Display: Gift suggestion cards; labeled "AI-powered gift ideas"

**Agent S4: Event Planner**  
_Multi-vendor shortlist for events_

- Model: Claude Haiku 4.5
- Trigger: User fills "Plan an event" form
- File: `lib/ai/agents/shopper.ts` → `eventPlanner()`
- Input: event_type, guest_count, budget_cents, city, categories_needed (e.g., catering, photography)
- Output: Per-category vendor shortlist with budget allocation
- Display: Category-by-category cards; labeled "AI event planning suggestions"

**Agent S5: Community Spend Insights**  
_Personal spend analytics from receipts_

- Model: Claude Sonnet 4.6
- Trigger: User opens `/account/community-spend`
- File: `lib/ai/agents/shopper.ts` → `communitySpendInsights()`
- Input: user's aggregate category totals (no PII; no individual transaction details): `{ restaurant: 340_00, beauty: 120_00, retail: 80_00 }`
- Output: Plain-language summary + 2–3 "next dollar" nudges
- Display: Insight card below spend totals; labeled "AI insight"

---

##### Consumer Companion Agents (5)

These agents help consumers systematically shift their everyday spending and service providers to Black-owned businesses. The goal is not one-off discovery but frictionless life-shift — replacing groceries, healthcare, home services, legal, and other routine needs without piecing together 50 separate entity pages. These agents surface a unified basket view, personalized daily picks, and full provider matches.

**New data needed — patch `profiles` table:**

```sql
-- Migration: 20260512000003b_consumer_companion.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS shift_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_radius_miles integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS provider_needs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_notes text,
  ADD COLUMN IF NOT EXISTS companion_onboarded boolean DEFAULT false;
-- RLS: these columns are owner-readable/writable only (inherits existing profiles policy)
```

**New pages:**

- `/account/life-shift` — Life Shift hub with category cards (groceries, healthcare, beauty, auto, home services, finance, legal, childcare); clicking a category triggers Life Shift Advisor
- `/account/basket` — Everyday Basket Builder: item entry + AI-mapped business list
- `/account/recommendations` — Local Life Concierge daily card feed; personalized by saves + city
- `/discover/providers/[type]` — Provider Matcher results for service provider types

**New file: `lib/ai/agents/companion.ts`**

---

**Agent C1: Life Shift Advisor**  
_"I want to shift my [category] spending to Black-owned" → a transition plan_

- Model: Claude Sonnet 4.6
- Trigger: User selects a category on `/account/life-shift`
- File: `lib/ai/agents/companion.ts` → `lifeShiftAdvisor()`
- Input: `{ category, city, radius_miles, saved_listing_ids: uuid[], spend_categories: string[] }` — no PII
- Output: `{ transition_plan: { start_here: string, steps: Array<{ subcategory: string, listing_ids: uuid[], note: string }> } }` → displayed inline (not stored as `ai_suggestions` — ephemeral UI response)
- Display: Transition plan card on `/account/life-shift/[category]`; links to each suggested business page

**Agent C2: Everyday Basket Builder**  
_Maps a weekly shopping list to Black-owned businesses near the user_

- Model: Claude Haiku 4.5
- Trigger: User opens `/account/basket` and enters item categories needed this week
- File: `lib/ai/agents/companion.ts` → `everydayBasketBuilder()`
- Input: `{ item_categories: string[], city, radius_miles, available_listing_ids: uuid[] }` — listing IDs pre-filtered by city + radius server-side
- Output: `Array<{ category: string, business_name: string, listing_id: uuid, note: string }>` — one or more businesses per item category
- Pricing: If `marketplace_products` rows exist for matched listings, surface them with `price_cents`
- Display: Basket summary view — "For produce → {business}, For haircare → {business}, ..."

**Agent C3: Local Life Concierge**  
_Daily personalized picks based on behavior + location_

- Model: Claude Haiku 4.5
- Trigger: User opens app / `/account/recommendations` refreshes (at most once per 24h per user)
- File: `lib/ai/agents/companion.ts` → `localLifeConcierge()`
- Input: `{ saved_listing_ids: uuid[], top_searched_categories: string[] (anon), city, hour_of_day: number, shift_categories: string[] }` — no user_id, no search text
- Output: `Array<{ listing_id: uuid, why_now: string (1 sentence) }>` — 3–5 picks
- Storage: Result cached in `ai_suggestions` with `type='concierge_picks'`, `expires_at = now() + 24h`; refreshed nightly
- Display: "Today's picks for you" card feed with dismiss / save CTAs

**Agent C4: Provider Matcher**  
_Finds Black-owned doctors, lawyers, accountants, childcare, and other service providers_

- Model: Claude Sonnet 4.6
- Trigger: User selects a provider type on `/discover/providers/[type]`
- File: `lib/ai/agents/companion.ts` → `providerMatcher()`
- Input: `{ provider_type, city, preferences: string (freeform, ≤100 chars, e.g., "accepting new patients"), candidate_listing_ids: uuid[] }` — candidate IDs pre-filtered by `listing_type` + city server-side
- Output: `Array<{ listing_id: uuid, fit_note: string (1–2 sentences), completeness_flag: boolean }>` — top 5 matches
- Display: Provider match cards with contact CTA; `completeness_flag=true` listings show "Profile may be incomplete" badge
- Provider `listing_type` values needed: `healthcare`, `legal`, `financial`, `childcare`, `home_services` (ensure these are in `listing_type` CHECK constraint)

**Agent C5: Experience Builder**  
_Plans a full occasion with a complete Black-owned vendor lineup_

- Model: Claude Sonnet 4.6
- Trigger: User fills "Plan an experience" form (expanded from existing Event Planner agent)
- File: `lib/ai/agents/companion.ts` → `experienceBuilder()`
- Input: `{ occasion_type, date_description (e.g., "summer Saturday"), guest_count, budget_cents, city, vendor_categories_needed: string[] }` — no personal details
- Output: `{ vendor_lineup: Array<{ role: string, listing_ids: uuid[], budget_allocation_cents: number, note: string }>, total_estimated_cost: number }`
- Display: Full vendor lineup table with role, budget slice, and links; "Build this" saves lineup to `/account/saved`

---

##### Business-Side Agents (7)

**Agent B1: Page Builder**  
_Drafts description + tagline from business name + category_

- Model: Claude Haiku 4.5
- Trigger: Owner starts business submission or clicks "Get AI help" in editor
- File: `lib/ai/agents/business.ts` → `pageBuilder()`
- Input: business_name, category_name, city_name, owner_notes (optional, ≤200 chars)
- Output: `{ description: string (100–250 chars), tagline: string (≤80 chars) }` → stored in `ai_suggestions`
- Display: In editor; "Use this" button inserts into form field

**Agent B2: Listing Optimizer**  
_Checklist of 12 completeness gaps + improvement copy_

- Model: Claude Haiku 4.5
- Trigger: Owner opens `/dashboard/pages/[entityId]/ai-suggestions`
- File: `lib/ai/agents/business.ts` → `listingOptimizer()`
- Input: listing completeness flags (12 boolean checks: has_description, has_hours, has_logo, has_gallery, has_social, has_cta, has_tagline, has_meta_title, has_meta_description, has_phone, has_website, has_services)
- Output: Per-failed-check improvement copy suggestion → each stored as separate `ai_suggestions` row
- Display: Checklist UI with AI-suggested text for each gap; each "Apply" button one-click to insert

**Agent B3: SEO & Visibility Coach**  
_Generates SEO meta title + description_

- Model: Claude Haiku 4.5
- Trigger: Owner clicks "Optimize SEO" in SEO section of editor
- File: `lib/ai/agents/business.ts` → `seoCoach()`
- Input: listing_name, category_name, city_name, current_meta_title (if any), current_meta_description (if any)
- Output: `{ meta_title: string (≤60 chars), meta_description: string (≤160 chars) }` → stored in `ai_suggestions`
- Display: In SEO editor section; "Use this" applies to form fields

**Agent B4: Social Caption Generator**  
_Platform-specific captions for sharing_

- Model: Claude Haiku 4.5
- Trigger: Owner clicks "Generate captions" in Social section
- File: `lib/ai/agents/business.ts` → `socialCaption()`
- Input: listing_name, tagline, category_name, city_name
- Output: `{ instagram: string (≤150 chars), facebook: string (≤280 chars), x: string (≤280 chars) }` → stored as 3 `ai_suggestions` rows
- Display: Social captions panel with copy-to-clipboard buttons

**Agent B5: Marketplace Merchandising**  
_Improves product/service listing copy_

- Model: Claude Haiku 4.5
- Trigger: Owner clicks "Improve with AI" on product/service edit page
- File: `lib/ai/agents/business.ts` → `marketplaceMerchandising()`
- Input: product_name, current_description (≤500 chars), price_display_text, category_name
- Output: `{ name: string, description: string (50–200 chars), positioning_note: string }` → stored in `ai_suggestions`
- Display: In product editor; "Apply" button updates form fields

**Agent B6: Review Response Drafter**  
_Professional draft response to customer review_

- Model: Claude Haiku 4.5
- Trigger: New published review appears in owner's review queue
- File: `lib/ai/agents/business.ts` → `reviewResponseDrafter()`
- Input: review_text (the review content), listing_name, listing_category (no reviewer name/ID)
- Output: `{ response_draft: string (≤300 chars) }` → stored in `ai_suggestions`
- Display: In review management UI; owner edits before posting

**Agent B7: Analytics Explainer**  
_Weekly analytics summary in plain language_

- Model: Claude Sonnet 4.6
- Trigger: Owner opens analytics tab; runs at most once per week per listing
- File: `lib/ai/agents/business.ts` → `analyticsExplainer()`
- Input: `{ page_views_7d, page_views_30d, cta_clicks_7d, saves_7d, top_search_terms: string[] (no PII) }`
- Output: `{ summary: string (2–3 sentences), top_insight: string, suggested_action: string }` → stored in `ai_suggestions`
- Display: "Your listing this week" card in analytics view

---

##### Admin/Platform Agents (5)

**Agent A1: Directory Curator**  
_Nightly quality scoring + moderation queue flagging_

- Model: Claude Haiku 4.5
- Trigger: Nightly Supabase Edge Function cron (00:30 UTC)
- File: `supabase/functions/directory-curator/index.ts` (new)
- Input: Batch of listings with completeness_score < 40 (no user data): `[{ listing_id, name, category, completeness_score, missing_fields }]`
- Output: Per-listing `ai_suggestions` row with flag type and reasoning
- Privacy: No owner email, phone, or PII passed — only listing content fields

**Agent A2: Verification Support**  
_Pre-screens claim submissions for admin_

- Model: Claude Haiku 4.5
- Trigger: Admin opens a claim review at `/admin/claims/[id]`
- File: `lib/ai/agents/admin.ts` → `verificationSupport()`
- Input: Claim submission fields only (role, relationship_to_business, verification_statement) — document images NEVER passed
- Output: `{ recommendation: 'approve_likely'|'review_needed'|'flag_for_review', reasoning: string (≤150 chars) }`
- Display: Admin claim review page; "AI assessment" card; admin makes final decision

**Agent A3: Collection Builder**  
_Suggests listings for curated collections_

- Model: Claude Haiku 4.5
- Trigger: Admin clicks "Get AI suggestions" when creating a collection
- File: `lib/ai/agents/admin.ts` → `collectionBuilder()`
- Input: collection_theme (admin-typed text), city_filter (optional), existing_listing_ids_in_collection
- Output: `[{ listing_id, rationale: string (1 sentence) }]` — 5–10 suggestions
- Display: Suggestion list in collection editor; checkboxes to add

**Agent A4: Guide Writer**  
_Drafts city guide section copy_

- Model: Claude Sonnet 4.6
- Trigger: Admin clicks "Draft this section" in guide editor
- File: `lib/ai/agents/admin.ts` → `guideWriter()`
- Input: city_name, section_topic (e.g., "Best breakfast spots"), featured_listing_names[] (up to 5)
- Output: `{ section_content: string (2–4 paragraphs, ≤600 words) }` → stored in `ai_suggestions`
- Display: In guide section editor; "Insert draft" button

**Agent A5: Social Media Agent**  
_Auto-drafts platform posts for new verified listings_

- Model: Claude Haiku 4.5
- Trigger: Listing `trust_tier` updated to 'verified' or 'certified' (webhook or DB trigger)
- File: `lib/ai/agents/admin.ts` → `socialMediaAgent()`
- Input: listing_name, category_name, city_name, tagline (if set)
- Output: `{ instagram_post: string, facebook_post: string, x_post: string }` → stored in `ai_suggestions` with type='social_caption'
- Display: Admin social queue for review/edit before posting; never auto-posted

---

**AI agent go/no-go for Phase 3:**

- All agents store output in `ai_suggestions` with `status='pending'`; verified no auto-publish path exists
- Prompt audit: grep all `lib/ai/agents/` files; confirm no user_id, email, phone, or PII in any prompt string
- All agents have run log in `ai_generation_requests` + `ai_agent_runs`
- Feature flag `NEXT_PUBLIC_AI_FEATURES_ENABLED=true` verified in staging before production flip

### Phase 3 Go/No-Go Checklist

- [ ] Receipt upload → admin approve → `spend_events` row created (no user_id)
- [ ] `flow_nodes` and `flow_edges` updated after approval
- [ ] `/flow-map` renders real nodes and edges in force-directed graph
- [ ] Privacy floor: edges with `<5 transactions` excluded from visualization
- [ ] Personal impact panel shows authenticated user's real totals
- [ ] All 22 AI agents produce output in staging (Anthropic API live)
- [ ] No `ai_suggestions` row auto-published; all require approval
- [ ] `ai_generation_requests` and `ai_agent_runs` logs populated after each agent run
- [ ] Prompt audit passes (no PII in prompts)
- [ ] `/account/receipts/new` camera capture works on mobile Safari + Chrome
- [ ] Consumer Companion: Local Life Concierge shows personalized picks on `/account/recommendations`
- [ ] Consumer Companion: Provider Matcher returns results for at least 3 provider types (healthcare, legal, financial)
- [ ] Consumer Companion: Everyday Basket Builder maps item categories to local businesses on `/account/basket`
- [ ] Consumer Companion: Life Shift Advisor produces a transition plan for at least 3 spend categories
- [ ] Consumer Companion: `profiles` table has `shift_categories`, `location_radius_miles`, `provider_needs` columns
- [ ] `/account/life-shift`, `/account/basket`, `/account/recommendations` pages render without errors
- [ ] `pnpm tsc --noEmit` — zero errors

---

## Phase 4 — V3: Intelligence Layer

**Goal:** Full interactive Circulation Map with time slider. Public AI concierge. Sponsor campaigns self-serve. `/impact` public analytics page.  
**Duration:** Weeks 32–44  
**Prerequisite:** 6+ months of receipt data (≥500 members, ≥30 business nodes, ≥2,000 spend_events)

### 4.1 — Circulation Map — Full Interactive

**New migration: `20260512000004_flow_map_snapshots.sql`**

```sql
CREATE TABLE flow_map_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  nodes_json jsonb NOT NULL,    -- serialized flow_nodes at snapshot time
  edges_json jsonb NOT NULL,    -- serialized flow_edges (min 5 transactions)
  total_spend_cents bigint DEFAULT 0,
  total_transactions integer DEFAULT 0,
  unique_businesses integer DEFAULT 0,
  unique_cities integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX flow_map_snapshots_date_idx ON flow_map_snapshots (snapshot_date DESC);
```

**Nightly snapshot Edge Function** (`supabase/functions/snapshot-flow-map/index.ts`):

- Runs at 03:00 UTC weekly (Sunday)
- Queries `flow_nodes` + `flow_edges` WHERE `transaction_count >= 5`
- Serializes to JSON → inserts `flow_map_snapshots` row

**Interactive graph enhancements to `FlowMapNetwork.tsx`:**

- Time range slider (driven by `flow_map_snapshots.snapshot_date` values)
- On slider change: fetch `/api/flow-map/snapshot/[date]` → re-render graph
- Category lens: filter edges to only show businesses in selected category
- City filter: show only one city's outbound edges
- Embed widget: button generates `<iframe src="https://theblacqlist.com/flow-map/embed" ...>` snippet

**New API route:** `GET /api/flow-map/snapshot/[date]` — returns snapshot by date

### 4.2 — Full AI Concierge (Public)

Expand Agent S1 (Find-It-For-Me) into a persistent chat interface:

- New component: `components/ai/DiscoveryConcierge.tsx`
- Chat history stored in component state (not DB — session only)
- Follow-up queries: "show me more like that" appends to conversation history
- Multi-turn: user can refine by price, distance, subcategory
- `POST /api/ai/discover` — multi-turn conversation endpoint
- Clearly labeled: "AI-powered discovery · Results are curated suggestions, not endorsements"
- Rate limited: 20 queries per hour per IP (logged in `analytics_events`)

### 4.3 — Sponsor Campaigns Self-Serve

**New API route:** `POST /api/checkout/placement`

- Auth + owner role required
- Body: `{ listing_id, campaign_type, placement_zone, starts_at, ends_at }`
- Checks inventory availability (no overlapping active placements for that zone)
- Creates Stripe Payment Intent (one-time, not subscription)
- Returns `{ client_secret }` for Stripe Elements confirmation

**Dashboard:** `/dashboard/upgrade` — add "Purchase Spotlight" section below subscription plans  
**Admin management:** `/admin/sponsored-placements` — view all active + pending campaigns

### 4.4 — Community Impact Page (`/impact`)

New public page showing platform-wide stats:

- Total businesses listed
- Total dollars tracked through the community
- Number of unique supporters who've uploaded receipts
- Number of cities represented
- Top 10 most-saved businesses
- Top 10 most-reviewed businesses
- Monthly spend trend chart (last 12 months from `community_impact_daily`)
- CTA → "Upload a receipt" / "Explore the flow map"

**New migration: `20260512000005_v3_intelligence.sql`**

```sql
-- Daily community impact snapshot
CREATE TABLE community_impact_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  total_businesses integer DEFAULT 0,
  total_spend_cents bigint DEFAULT 0,
  total_receipts integer DEFAULT 0,
  unique_supporters integer DEFAULT 0,  -- count of distinct submitters (anonymized)
  unique_cities integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Sponsor campaign purchases
CREATE TABLE sponsor_campaign_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  campaign_type text NOT NULL CHECK (campaign_type IN ('city_spotlight','platform_partner','community_partner','editorial')),
  placement_zone text NOT NULL CHECK (placement_zone IN ('homepage','city','category','search')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  price_cents integer NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','completed','canceled','refunded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX sponsor_campaign_zone_idx ON sponsor_campaign_purchases (placement_zone, starts_at, ends_at)
  WHERE status = 'active';
```

### Phase 4 Go/No-Go Checklist

- [ ] Flow map interactive graph renders with ≥30 real business nodes
- [ ] Time slider shows historical snapshots (at least 4 weekly snapshots)
- [ ] Category lens and city filter work without breaking graph render
- [ ] Embed widget generates valid iframe with correct dimensions
- [ ] AI concierge handles multi-turn conversation; returns relevant listings
- [ ] Follow-up query ("show me more like that") refines, not restarts results
- [ ] Sponsor campaign purchase: Stripe Payment Intent created → payment confirmed → `sponsor_campaign_purchases.status='active'`
- [ ] `/impact` page renders with live stats from `community_impact_daily`

---

## Complete Migration Plan

| File                                         | Phase | New Tables / Columns                                                                                                                                                                   | Notes                                          |
| -------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `20260512000000_additional_entity_types.sql` | 1     | `listing_details_professional`, `listing_details_creative`, `listing_details_event`, `listing_details_job`, `corrections`, `review_responses`, `tags`, `listing_tags`, `neighborhoods` | 9 new tables; RLS follows existing patterns    |
| `20260512000001_v1_features.sql`             | 2     | `featured_slots`, `verification_submissions`, `platform_analytics_daily`; columns: `listings.search_rank_boost`, `listings.certified_at`; function: `check_and_grant_certified()`      | 3 new tables + 2 columns + 1 DB function       |
| `20260512000002_flow_map_triggers.sql`       | 3     | Column: `spend_events.city_id`; function: `process_receipt_approval()`; trigger: `receipt_approval_trigger`                                                                            | No new tables; adds FK + function + trigger    |
| `20260512000003_ai_agent_runs.sql`           | 3     | `ai_agent_runs`; column: `ai_suggestions.agent_run_id`                                                                                                                                 | 1 new table + 1 FK column                      |
| `20260512000003b_consumer_companion.sql`     | 3     | Columns on `profiles`: `shift_categories`, `location_radius_miles`, `provider_needs`, `dietary_notes`, `companion_onboarded`                                                           | No new tables; 5 new columns on existing table |
| `20260512000004_flow_map_snapshots.sql`      | 4     | `flow_map_snapshots`                                                                                                                                                                   | 1 new table; weekly nightly job                |
| `20260512000005_v3_intelligence.sql`         | 4     | `community_impact_daily`, `sponsor_campaign_purchases`                                                                                                                                 | 2 new tables                                   |

**Total after all migrations:** 37 (existing) + 16 (new) = **53 tables** + 5 new columns on `profiles`

---

## Environment Variables — Activation by Phase

| Variable                             | P0      | P1      | P2      | P3     | P4                             |
| ------------------------------------ | ------- | ------- | ------- | ------ | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`           | ✅      | ✅      | ✅      | ✅     | ✅                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | ✅      | ✅      | ✅      | ✅     | ✅                             |
| `SUPABASE_SERVICE_ROLE_KEY`          | ✅      | ✅      | ✅      | ✅     | ✅                             |
| `NEXT_PUBLIC_SITE_URL`               | ✅      | ✅      | ✅      | ✅     | ✅                             |
| `AUTH_SECRET`                        | ✅      | ✅      | ✅      | ✅     | ✅                             |
| `RESEND_API_KEY`                     | —       | ✅      | ✅      | ✅     | ✅                             |
| `RESEND_FROM_EMAIL`                  | —       | ✅      | ✅      | ✅     | ✅                             |
| `NEXT_PUBLIC_SENTRY_DSN`             | —       | ✅      | ✅      | ✅     | ✅                             |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | —       | —       | ✅      | ✅     | ✅                             |
| `STRIPE_SECRET_KEY`                  | —       | —       | ✅      | ✅     | ✅                             |
| `STRIPE_WEBHOOK_SECRET`              | —       | —       | ✅      | ✅     | ✅                             |
| `ANTHROPIC_API_KEY`                  | —       | —       | —       | ✅     | ✅                             |
| `NEXT_PUBLIC_AI_FEATURES_ENABLED`    | `false` | `false` | `false` | `true` | `true`                         |
| `STRIPE_CONNECT_CLIENT_ID`           | —       | —       | —       | —      | If marketplace checkout scoped |

---

## AI Agent Build Sequence

Build agents in this order to minimize rework and test on stable data:

| Order | Agent                           | Domain     | Model  | Phase                   |
| ----- | ------------------------------- | ---------- | ------ | ----------------------- |
| 1     | Listing Optimizer               | Business   | Haiku  | 3                       |
| 2     | SEO Coach                       | Business   | Haiku  | 3                       |
| 3     | Social Caption                  | Business   | Haiku  | 3                       |
| 4     | Page Builder                    | Business   | Haiku  | 3                       |
| 5     | Verification Support            | Admin      | Haiku  | 3                       |
| 6     | Directory Curator               | Admin/cron | Haiku  | 3                       |
| 7     | Collection Builder              | Admin      | Haiku  | 3                       |
| 8     | Analytics Explainer             | Business   | Sonnet | 3                       |
| 9     | Review Response                 | Business   | Haiku  | 3                       |
| 10    | Marketplace Merchandising       | Business   | Haiku  | 3                       |
| 11    | Guide Writer                    | Admin      | Sonnet | 3                       |
| 12    | Social Media Agent              | Admin      | Haiku  | 3                       |
| 13    | Support Local Tonight           | Shopper    | Haiku  | 3                       |
| 14    | Gift Finder                     | Shopper    | Haiku  | 3                       |
| 15    | Community Spend Insights        | Shopper    | Sonnet | 3 (requires spend data) |
| 16    | Find-It-For-Me (simple)         | Shopper    | Haiku  | 3                       |
| 17    | Event Planner                   | Shopper    | Haiku  | 3                       |
| 18    | Find-It-For-Me (full concierge) | Shopper    | Sonnet | 4                       |

---

## Circulation Map Build Sequence

| Step | Phase | What Changes                                                                |
| ---- | ----- | --------------------------------------------------------------------------- |
| 1    | 0     | Wire `/flow-map` `FlowSummaryCards` + `FlowNodeTable` to real API data      |
| 2    | 3     | Add `spend_events.city_id`; write `process_receipt_approval()` trigger      |
| 3    | 3     | OCR receipt → listing match → spend event pipeline end-to-end in staging    |
| 4    | 3     | Upgrade `FlowMapNetwork.tsx` to force-directed graph (react-force-graph-2d) |
| 5    | 3     | Wire city/category filters on flow-map page to query params                 |
| 6    | 3     | Wire personal impact panel to `/api/flow-map/personal-impact`               |
| 7    | 4     | `flow_map_snapshots` table + nightly archiving Edge Function                |
| 8    | 4     | Time range slider in graph (requires ≥4 snapshots / 1 month of data)        |
| 9    | 4     | Category lens + city filter in graph                                        |
| 10   | 4     | Embed widget (`<iframe>`) with `?embed=true` query param                    |

---

## Critical Path (Condensed)

```
Phase 0 (wks 1–3)
  Seed cities/categories/plans/listings
  Remove all mock fallbacks
  Fix [citySlug]/[entityType] routing
  Wire SaveButton, /account/saved
  Build admin verification/reviews/reports queues
  Fix blacqlight + guide content rendering
  Legal copy replaced
        │
        ▼
Phase 1 (wks 3–10)
  4 new entity type migrations
  Full claim + submit workflows with email
  Sitemap, robots.txt, JSON-LD, OG images
  Analytics pipeline (events + nightly aggregation)
  250+ seeded listings across 3 cities
        │
        ▼
Phase 2 (wks 10–18)
  Reviews public + trust badges + certified auto-grant
  Editorial CMS live (articles, guides, collections)
  Stripe subscriptions + webhook handler
  Sponsored placements (admin-assigned)
  City + category landing pages
        │
        ▼
Phase 3 (wks 18–32)
  Full receipt upload with OCR
  Flow map DB trigger (spend → nodes/edges)
  Circulation Map visualization (force-directed graph)
  All 17 AI agents in production
  Marketplace media upload
        │
        ▼
Phase 4 (wks 32–44)
  Interactive Circulation Map (time slider, filters, embed)
  Full AI concierge (multi-turn chat)
  Sponsor campaigns self-serve (Stripe Payment Intent)
  /impact community analytics page
```

---

## What to Build First

Start with Phase 0, Task 0.1: move local dev off the cloud Supabase instance and onto the local CLI. Every subsequent development task is safer with a clean local environment where DB mutations don't affect staging.

Then run seeds in order: `002_reference_data.sql` → `003_categories.sql` → `004_plans.sql` → `001_listings.sql`.

Once data is seeded, the mock fallback removals (Tasks 0.7, 0.8) will show real content instead of blank pages.
