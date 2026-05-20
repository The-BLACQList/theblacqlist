# Production Build Plan — The BLACQList

**Last updated:** 2026-05-12
**Status:** Active execution reference
**Starting point:** App shell, mock data, Business entity template, email notifications wired, 7 migrations written

---

## Current State (as of 2026-05-12)

### What exists and works

- All major public routes (homepage, discover, search, city/entity pages, claim, add-business, collections, for-business, legal)
- All admin routes (claims queue, entities CRUD, collections, analytics, reviews, verification, receipts)
- All owner dashboard routes (page editor, services, products, analytics, upgrade, settings)
- 7 database migrations (MVP schema + RLS + editorial + receipts + marketplace + monetization + AI)
- GIN full-text search index on `listings.search_vector` with weighted tsvector trigger
- Business entity page template (`[citySlug]/business/[listingSlug]`)
- Email notifications (welcome, claim submitted/approved/rejected) via Resend
- Mock listing photos for 12 entities
- Homepage hero photography

### What is not yet functional

- Search and discover use JavaScript filtering — not connected to Supabase search
- No seed data in Supabase — pages fall back to mock entities
- Only Business entity page template — 4 others (Professional, Creative, Event, Job) are missing
- No city/category landing pages
- Stripe not wired (upgrade flow is a stub)
- Analytics events not verified to be firing
- Save/unsave not verified end-to-end
- Sitemap, robots.txt, JSON-LD structured data not implemented
- Mobile filters are stubs (city, availability, trust level)
- Review display is intake-only (reviews submitted, not shown publicly)

---

## Phase 2 — Core Discovery (Target: 2–3 weeks)

Goal: Make the app work with real data. Every core discovery flow should work end-to-end.

### 2.1 — Full-text search via Supabase ← CURRENT

- Replace JavaScript `filterEntities()` with server-side Supabase `.textSearch()` on `search_vector`
- Category/city filter: slug → ID lookup then `.eq('category_id', ...)` / `.eq('city_id', ...)`
- Entity type filter: `.eq('entity_type', ...)`
- Pagination: 24 per page, URL-based (`?page=2`)
- Wire "Load more" in DiscoveryGrid as a real link
- Shared query utility at `lib/listings/query.ts`
- Enable city filter in DiscoveryFilters

### 2.2 — Migrations applied + seed data

- Apply all 7 migrations to Supabase project (via Supabase CLI: `supabase db push`)
- Seed 150+ Atlanta listings with full data (name, tagline, description, category, city, cover image URL, services, hours, CTA)
- Seed 50+ Houston listings, 50+ Chicago listings
- Seed categories (25 from taxonomy), cities (13 launch cities), states
- Verify discover page shows real data without mock fallback

### 2.3 — City and category landing pages

- `app/[citySlug]/page.tsx` — city index page (all listings in a city, sorted by featured → saves)
- `app/[citySlug]/[entityType]/page.tsx` — entity type within city
- Auto-generated from Supabase city data (`generateStaticParams` for ISR)
- City header: name, state, listing count, category grid
- SEO: title, description, OG tags per city/category combination
- Add city filter to DiscoveryFilters (was a stub)

### 2.4 — Professional entity page template

- Route: `app/[citySlug]/professional/[listingSlug]/page.tsx`
- Reuse hero, contact, social, CTA components from business template
- Professional-specific: credential badges, portfolio section, booking CTA
- `listing_details_professional` table join in query
- Mirror the data-fetching pattern from business template

### 2.5 — Creative entity page template

- Route: `app/[citySlug]/creative/[listingSlug]/page.tsx`
- Creative-specific: portfolio/gallery-first layout, commission CTA, medium/style tags
- `listing_details_creative` table join in query

### 2.6 — Event entity page template

- Route: `app/[citySlug]/event/[listingSlug]/page.tsx`
- Event-specific: date/time, venue, RSVP/get-tickets CTA, description
- Auto-archive when event date passes (`status = 'archived'`)
- `listing_details_event` table join in query

### 2.7 — Job listing template

- Route: `app/[citySlug]/job/[listingSlug]/page.tsx`
- Job-specific: role, company, location (remote/hybrid/onsite), salary range, apply CTA
- Auto-expiry after 30 days
- `listing_details_job` table join in query

### 2.8 — SEO foundation

- `sitemap.xml` — dynamically generated from all published listings + city/category pages
- `robots.txt` — allow all crawlers, point to sitemap
- JSON-LD structured data (LocalBusiness schema) on every entity page
- OG image generation per listing (title + cover image via `next/og`)
- Verify all entity pages are server-rendered and indexable

### 2.9 — Save/unsave end-to-end

- Verify `/api/saves` route handles POST (save) and DELETE (unsave) correctly
- Wire `SaveButton` component on entity cards and entity pages
- Require auth — prompt sign-in modal if unauthenticated
- Update save count display after action (optimistic UI)
- `/account/saved` page: show saved listings grid

### 2.10 — Analytics events

- Verify `/api/analytics/event` POST handler is correct
- Fire `page_view` event on every BLACQList Page load (server-side)
- Fire `cta_click` event on every primary CTA click (client-side)
- Fire `save` / `unsave` events from SaveButton
- Fire `search_query` event on search (query + result count)
- Verify events are writing to `analytics_events` table in Supabase

---

## Phase 3 — Trust, Content & Polish (Target: 2 weeks)

Goal: The platform feels alive with real content and visible trust signals.

### 3.1 — Review display (post-moderation)

- `EntityReviewsSection.tsx` already renders mock reviews — wire to real Supabase data
- Query: `reviews WHERE listing_id = X AND status = 'approved' ORDER BY created_at DESC LIMIT 10`
- Show star average + count in entity page hero
- Admin review queue: approve/reject incoming reviews
- Intake form on entity pages (logged-in users only, claimed listings only)

### 3.2 — Collections fully working

- Admin collection editor (`/admin/collections`) — create, edit, assign listings
- Public collections index (`/collections`) — grid of active collections
- Collection detail page (`/collections/[slug]`) — title, editorial intro, listing grid
- Homepage featured collection slot — admin assigns one collection as featured
- Analytics: `collection_view` event

### 3.3 — BLACQLight articles

- Admin article editor (`/admin/blacqlight`) — rich text (markdown), linked listings, cover image
- Public BLACQLight index (`/blacqlight`) — article feed
- Article detail page with linked BLACQList Pages sidebar
- `blacqlight_article` table in editorial migration (already exists)

### 3.4 — Verified badge intake

- Verification request form on owner dashboard: business name confirmation, EIN (optional), owner attestation, document upload
- Admin verification queue: review document, approve/reject
- Verified badge renders on entity page hero and search cards when `trust_tier = 'verified'`
- Email: verification submitted, verification approved, verification rejected

### 3.5 — Owner dashboard analytics (real data)

- Wire dashboard analytics page to real Supabase data
- 7-day and 30-day page views (from `analytics_events` WHERE `event_type = 'page_view'`)
- CTA clicks, save count, share count
- Simple sparkline chart (recharts or plain SVG)

### 3.6 — Mobile filters

- Replace "coming soon" stubs in discover with functional mobile filter sheet
- Bottom sheet drawer (shadcn/ui Sheet) triggered by filter button on mobile
- Contains entity type, category, city filters — same logic as desktop sidebar
- Active filter count badge on trigger button
- City filter wired (after 2.3 is done)

### 3.7 — Community corrections

- "Report incorrect info" button on entity pages
- Simple form: what's wrong (radio: closed/moved/wrong info/other) + details text
- Writes to `corrections` table, admin sees in queue
- No email required for submission (friction-reducing)

---

## Phase 4 — Monetization (Target: 2–3 weeks)

Goal: The platform can earn revenue from business owners.

### 4.1 — Stripe setup

- Create Stripe account, get live + test keys
- Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to `.env.local`
- Create products + prices in Stripe dashboard: Standard ($29/mo), Premium ($79/mo)
- Add price IDs to env: `STRIPE_STANDARD_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`

### 4.2 — Subscription tier upgrade flow

- Upgrade page (`/dashboard/upgrade`) — show tier comparison table
- Create Stripe Checkout Session server action
- Redirect to Stripe hosted checkout
- Webhook handler (`/api/stripe/webhook`): handle `checkout.session.completed` → update `listings.tier`
- Webhook: `customer.subscription.deleted` → downgrade to free
- Success/cancel return pages

### 4.3 — Tier-gated features

- Premium only: sponsored search placement label, extended gallery (12 images vs 6), featured badge
- Standard only: verified badge intake access, extended analytics (90-day)
- Free: basic page, 6 gallery images, 30-day analytics
- Enforce tier limits in page editor (show upgrade prompt when limit hit)

### 4.4 — Sponsored placements (admin-assigned)

- Admin can mark any listing as `is_sponsored = true`
- Sponsored listings show "Sponsored" label on search cards
- Sponsored slots appear at top of category/city pages (after featured)
- No self-serve yet — manual sales only (V1.5)

### 4.5 — Stripe Customer Portal

- After subscription active: link to Stripe Customer Portal from dashboard
- User can update payment method, view invoices, cancel subscription
- Webhook handles cancellation → downgrade tier in DB

---

## Phase 5 — Production Hardening (Target: 1–2 weeks)

Goal: Safe, fast, accessible, and indexed.

### 5.1 — Security audit

- Verify all RLS policies are enforced (test each table as anon, authenticated, admin)
- Confirm no route handler returns data it shouldn't
- Review file upload validation (type, size) on upload route
- Confirm no secrets in client-side code or git history
- Enable Supabase audit logging

### 5.2 — Accessibility audit

- Tab through every form, modal, and interactive element
- Screen reader test on: entity page, search results, auth flows
- Verify all images have alt text
- Verify all form inputs have labels
- Check color contrast on Amber Gold over Deep Background
- Fix any `div` acting as interactive element

### 5.3 — Performance optimization

- `next/image` with correct `sizes` on all images
- Lazy load below-the-fold images
- Implement ISR (`revalidate: 3600`) on entity pages and category/city pages
- Verify LCP ≤ 2.5s on mobile for homepage and entity pages
- Compress hero images (WebP, ≤500KB hero, ≤200KB listing covers)
- Bundle analysis: remove unused dependencies

### 5.4 — SEO audit

- Submit sitemap to Google Search Console
- Verify JSON-LD validates in Rich Results Test
- Ensure all entity pages return 200, not redirect chains
- Canonical URLs correct on all pages
- Verify OG images render in social media debuggers (Twitter, Facebook)

### 5.5 — Regression QA

- Happy path: anonymous user discovers → views entity page → signs up → saves listing
- Happy path: business owner signs up → claims listing → editor → publishes
- Happy path: admin approves claim → verified badge appears
- Error paths: 404, 500, unauthenticated access to protected routes
- Mobile QA: 375px viewport for all critical flows

### 5.6 — Production infrastructure

- Create Supabase production project (separate from dev)
- Apply all migrations to production Supabase
- Create Vercel production deployment connected to `main` branch
- Configure all env vars in Vercel (Supabase, Resend, Stripe, Sentry)
- Configure custom domain + HTTPS
- Enable Supabase connection pooling (PgBouncer) for production

### 5.7 — Monitoring

- Sentry error tracking wired (frontend + server actions)
- Vercel Analytics enabled
- Supabase alerts: DB size, connection count, error rate
- Uptime monitoring (BetterUptime or similar) on `/api/health/supabase`

### 5.8 — Seed production data

- Import 150+ Atlanta listings via Supabase seed script
- Import 50+ Houston, 50+ Chicago
- Verify all listings have cover images (Supabase Storage or confirmed CDN URLs)
- Run smoke tests against production URL

---

## Phase 6 — Beta Features (Post-Launch, 4–8 weeks)

These ship after MVP is validated with real users.

- **Professional, Creative, Event, Job templates** — if not completed in Phase 2
- **Reviews display** — moderated reviews shown publicly
- **Community corrections** — flag incorrect info flow
- **Vendor storefront page** — product grid, `listing_details_vendor`
- **Receipt upload full flow** — camera → OCR → confirm → logged
- **Personal spend dashboard**
- **Community spend aggregate** (public number)
- **Supporter dashboard** — recently viewed, suggested businesses
- **BLACQList Certified** — auto-grant logic (verified + 6+ reviews + 4.0+ + 90 days active)

---

## Phase 7 — V1 (8–12 weeks post-launch)

- Reviews fully live with star averages on search cards
- Stripe Connect (payouts to vendors)
- Marketplace: vendor product listings, cart, checkout
- AI page optimization suggestions (owner dashboard)
- Full analytics dashboards (owner 90-day, admin platform-wide)
- City guide pages (admin-curated)
- Sponsored placement self-serve for Premium tier owners
- OG image auto-generation per listing

---

## Build Sequence Summary

```
Phase 2.1  Full-text search ← NOW
Phase 2.2  Seed data + migrations applied
Phase 2.3  City + category landing pages
Phase 2.4  Professional entity template
Phase 2.5  Creative entity template
Phase 2.6  Event entity template
Phase 2.7  Job entity template
Phase 2.8  SEO (sitemap, JSON-LD, OG)
Phase 2.9  Save/unsave end-to-end
Phase 2.10 Analytics events

Phase 3.1  Reviews display + moderation
Phase 3.2  Collections fully working
Phase 3.3  BLACQLight articles
Phase 3.4  Verified badge intake
Phase 3.5  Owner dashboard analytics
Phase 3.6  Mobile filters
Phase 3.7  Community corrections

Phase 4.1  Stripe setup
Phase 4.2  Subscription upgrade flow
Phase 4.3  Tier-gated features
Phase 4.4  Sponsored placements (admin)
Phase 4.5  Stripe Customer Portal

Phase 5.1  Security audit
Phase 5.2  Accessibility audit
Phase 5.3  Performance optimization
Phase 5.4  SEO audit
Phase 5.5  Regression QA
Phase 5.6  Production infrastructure
Phase 5.7  Monitoring
Phase 5.8  Seed production data

→ Public launch
```

---

## Tech Notes

- **Search**: Supabase `.textSearch('search_vector', query, { type: 'websearch', config: 'english' })`. GIN index already in migration `20260510000000`.
- **Pagination**: URL-based (`?page=N`), 24 per page, SSR-friendly
- **ISR**: Entity pages and city/category pages use `revalidate: 3600` (1 hour). Admin-triggered revalidation for immediate updates.
- **Images**: Supabase Storage for all user uploads. Next.js `next/image` with `remotePatterns` for `*.supabase.co`. Hero at `public/images/` for static assets.
- **Stripe**: Hosted Checkout for payment (no card UI to build). Customer Portal for self-serve management. Webhook handler for all subscription lifecycle events.
- **AI (Phase 7)**: Anthropic `claude-haiku-4-5` for page optimization suggestions (low cost, fast). Owner-triggered only, not automatic.
