# Route Map — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Frontend Architecture

This document maps every route in The BLACQList's Next.js App Router structure across all phases. It defines the purpose, auth requirement, role access, data needs, and phase for every route. Engineers building `app/` should treat this as the canonical reference for what to create and in what order.

Routes are organized by section and annotated with the platform phase in which they become available. An engineer looking at any route should be able to immediately determine: what file to create, what data it needs, who can access it, and whether it is in scope today.

**Phase key used throughout:**

| Code | Phase |
|---|---|
| MVP | Launch — required for public go-live |
| Beta | Feature-flagged on production URL, 4–8 weeks post-MVP |
| V1 | 8–12 weeks post-MVP — Trust, editorial, monetization |
| V1.5 | Self-serve monetization hardening |
| V2 | Commerce layer — marketplace, receipts, spend tracking |
| V3 | Intelligence layer — AI, dollar-flow map |
| V4 | Native apps, 25+ cities, internationalization |

---

## Note on Entity Route Pattern

ADR-010 (`architecture-decisions.md`) documents a flat `/listing/[slug]` pattern. This route map supersedes that with the more SEO-optimal city-contextualized pattern: `/[city-slug]/business/[listing-slug]`. The city-scoped pattern produces richer URL signals for local search ranking (e.g., `theblacqlist.com/atlanta/business/sweet-auburn-bbq-atlanta`) and allows city + entity type landing pages to have a consistent sibling relationship. **ADR-010 should be updated to reflect this routing decision before development begins.**

---

## Public Discovery Routes

These routes are accessible to all visitors, including anonymous users. They drive organic discovery and SEO. All must be server-rendered.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | Homepage: hero, category grid, city spotlight, featured listings, editorial teaser, flow map placeholder | All | MVP | No | Featured listings (admin-curated), top categories, seed cities, one featured collection | Server Component; streaming Suspense for featured listings section |
| `/discover` | `app/discover/page.tsx` | Browse by category, city, or entity type — all-listings entry point with faceted filters | All | MVP | No | Category list, city list, entity type list, paginated listing results | Filters stored in URL search params; `DashboardFilters`-style Client Component for filter bar |
| `/search` | `app/search/page.tsx` | Search results for keyword + category + city queries | All | MVP | No | Search API results, category list, city list | `searchParams` from page props; full-text search via Supabase PG FTS; result cards with save button (requires auth check) |
| `/events` | `app/events/page.tsx` | Browse all active Event Pages across all cities | All | Beta | No | Event listings (entity_type = event, status = active, date >= today), city filter | Auto-filters to upcoming events; past events excluded from default view |
| `/jobs` | `app/jobs/page.tsx` | Browse all active Job listings across all cities | All | Beta | No | Job listings (entity_type = job, status = active, not expired), city + category filters | Auto-expires listings after deadline date |
| `/collections` | `app/collections/page.tsx` | Index of all published editorial collections | All | MVP | No | All published collections (title, slug, cover image, listing count) | Admin creates collections; page is publicly discoverable |
| `/collection/[slug]` | `app/collection/[slug]/page.tsx` | Single editorial collection page (curated list of BLACQList Pages with editorial intro) | All | MVP | No | Collection by slug, linked listing records | Server-rendered; OG meta with collection title + description |
| `/guides` | `app/guides/page.tsx` | Index of all published city guides | All | V1 | No | All published guides (title, slug, city, cover image) | Editorial content; admin-created in V1 |
| `/guide/[slug]` | `app/guide/[slug]/page.tsx` | Single city guide page (editorial, category-organized listings per city) | All | V1 | No | Guide by slug, linked listing records by category | Server-rendered; rich editorial content |
| `/blacqlight` | `app/blacqlight/page.tsx` | BLACQLight editorial article index — stories, features, spotlights | All | V1 | No | All published BLACQLight articles (title, slug, excerpt, cover image, publish date) | Editorial section; authored by Editors in admin CMS |
| `/blacqlight/[slug]` | `app/blacqlight/[slug]/page.tsx` | Single BLACQLight article (rich text, linked to BLACQList Pages in-line) | All | V1 | No | Article by slug, linked listing previews | Server-rendered; article JSON-LD structured data; OG image |
| `/map` | `app/map/page.tsx` | Interactive map view of listings (radius or city area) | All | V2 | No | Listing geo data, categories, cities | Requires maps API (Mapbox or Radar — see ADR open decisions); geo coordinates on listing records |
| `/marketplace` | `app/marketplace/page.tsx` | Marketplace browse — all active vendor product listings | All | V2 | No | Products (all published vendors), category + price filters | Commerce layer; links to vendor storefront pages |
| `/for-business` | `app/for-business/page.tsx` | Business owner acquisition / marketing page — explains BLACQList Pages, claim flow, and value prop | All | MVP | No | Static content, optional: listing tier pricing data | SEO-targeted at Black business owners searching for directory listing tools |
| `/for-vendors` | `app/for-vendors/page.tsx` | Vendor acquisition page — explains marketplace storefront, fees, Stripe Connect | All | V2 | No | Static content, marketplace fee data | Marketing; no transactional elements |
| `/for-sponsors` | `app/for-sponsors/page.tsx` | Sponsor marketing page — explains placement types, reach, audience data, contact form | All | V1 | No | Static content, optional: available placement inventory stub | Drives inbound sponsor leads; CTA is a contact form or calendar link |
| `/about` | `app/about/page.tsx` | About The BLACQList — mission, team, story, community impact | All | MVP | No | Static content | Standard marketing page |
| `/pricing` | `app/pricing/page.tsx` | Listing tier pricing breakdown (Free / Standard / Premium) | All | V1 | No | Tier definitions, feature comparison data | Available at V1 when monetization launches; a placeholder stub is acceptable at MVP |

---

## Location Routes

Location routes are auto-generated from listing data in the database. They serve as SEO landing pages for city-level and city + category discovery. They must be server-rendered and included in `sitemap.xml`.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/city/[city-slug]` | `app/city/[city-slug]/page.tsx` | City landing page — top listings, category grid, city stats, city guide link | All | MVP | No | City record by slug, top-ranked listings for city, category list, collection featuring city | `generateStaticParams` for all known cities at build time; ISR revalidation every 24h |
| `/city/[city-slug]/[category-slug]` | `app/city/[city-slug]/[category-slug]/page.tsx` | City + category combination page — filtered listing grid | All | MVP | No | City by slug, category by slug, listings filtered by both | Nested dynamic segments; `generateStaticParams` for all active combinations; OG meta includes city + category |
| `/online-only` | `app/online-only/page.tsx` | Listings for businesses that operate exclusively online (no physical location) | All | MVP | No | Listings with `location_type = 'online'`, category filter | Useful for national browsing without a city filter |
| `/ships-nationwide` | `app/ships-nationwide/page.tsx` | Listings for businesses that ship products to any US address | All | MVP | No | Listings with `ships_nationwide = true`, category filter | Overlaps with marketplace but is directory-level |
| `/virtual-services` | `app/virtual-services/page.tsx` | Virtual service providers (therapists, coaches, tutors, consultants) | All | MVP | No | Listings with `service_type = 'virtual'`, category filter | Useful discovery path for geographically unconstrained professional services |
| `/near-me` | `app/near-me/page.tsx` | Geo-aware listing discovery based on browser geolocation | All | V2 | No | Listing geo data, browser coordinates (client-side), maps API | Requires geolocation prompt; Client Component wrapper inside a Server layout; falls back to `/discover` if geo denied |
| `/neighborhood/[neighborhood-slug]` | `app/neighborhood/[neighborhood-slug]/page.tsx` | Neighborhood-level landing page (sub-city granularity) | All | V2 | No | Neighborhood record by slug, listings with neighborhood tag | Requires neighborhood data model on listings; start with Atlanta neighborhoods |

---

## Entity / BLACQList Page Routes

Each route renders a full BLACQList Page for a specific entity. These are the core SEO and user-facing product pages. All must be server-rendered with complete structured data, OG meta, and canonical URLs.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/[city-slug]/business/[listing-slug]` | `app/[city-slug]/business/[listing-slug]/page.tsx` | Business BLACQList Page — hero, about, services, gallery, contact, CTA, trust badge, share, save | All (save requires auth) | MVP | No (save button gated) | Listing by slug, listing_details_business, media_attachments, categories, city, saves count, owner claim status | Server Component; `generateStaticParams` for all published business listings; ISR revalidation every 1h; LocalBusiness JSON-LD; OG image per listing |
| `/[city-slug]/professional/[listing-slug]` | `app/[city-slug]/professional/[listing-slug]/page.tsx` | Professional BLACQList Page — bio, credentials, services, portfolio, booking CTA | All | Beta | No | Listing by slug, listing_details_professional, media_attachments, categories, city | Server Component; same SEO/OG/JSON-LD requirements as business template |
| `/[city-slug]/creative/[listing-slug]` | `app/[city-slug]/creative/[listing-slug]/page.tsx` | Creative BLACQList Page — bio, portfolio gallery, medium/genre tags, booking/commission CTA | All | Beta | No | Listing by slug, listing_details_creative, media_attachments, categories, city | Server Component; portfolio gallery may include video embed links |
| `/events/[event-slug]` | `app/events/[event-slug]/page.tsx` | Event Page — event name, date/time, location, description, ticket/RSVP link, cover image, organizer link | All | Beta | No | Listing by slug, listing_details_event, organizer listing record, media_attachments | Auto-archival: page remains visible after event date but is marked "Past Event"; filtered from discovery by default |
| `/jobs/[job-slug]` | `app/jobs/[job-slug]/page.tsx` | Job Listing Page — title, company, location, description, apply link, deadline, employer Page link | All | Beta | No | Listing by slug, listing_details_job, employer listing (optional) | Auto-expiry after deadline; expired listings return `not-found.tsx` or a redirect to `/jobs` |
| `/marketplace/vendor/[vendor-slug]` | `app/marketplace/vendor/[vendor-slug]/page.tsx` | Vendor storefront — product grid, storefront about, shipping/returns policy, brand header | All | V2 | No | Vendor listing record, products for vendor, media_attachments | Extends the Business BLACQList Page with commerce elements; same slug as the business listing |
| `/marketplace/product/[product-slug]` | `app/marketplace/product/[product-slug]/page.tsx` | Product detail page — images, description, variants, price, add to cart, vendor link | All | V2 | No | Product record by slug, product variants, vendor listing record, inventory count | Requires Stripe + cart infrastructure from V2 |
| `/marketplace/service/[service-slug]` | `app/marketplace/service/[service-slug]/page.tsx` | Service detail page — service description, price, provider link, booking/inquiry CTA | All | V2 | No | Service record by slug, provider listing record | May be nested under Professional or Business Page depending on provider type |
| `/sponsor/[sponsor-slug]` | `app/sponsor/[sponsor-slug]/page.tsx` | Sponsor profile page — brand info, sponsored categories/cities, campaign summary | All | V1 | No | Sponsor record by slug, active placements summary | Limited public-facing content; primarily for brand transparency |

---

## Auth Routes

Auth routes handle account creation, sign-in, session management, and password recovery. These routes must not be accessible to already-authenticated users (redirect to `/dashboard` or intended destination).

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/sign-in` | `app/sign-in/page.tsx` | Email + password sign-in form | Anonymous | MVP | No (redirect if authed) | — | Supabase Auth; redirect to `?next=` param or `/dashboard` on success; show inline error on failure |
| `/sign-up` | `app/sign-up/page.tsx` | New account registration — email + password + display name + role selection | Anonymous | MVP | No (redirect if authed) | — | Triggers email verification; role default: Supporter; "I have a business" option routes to onboarding |
| `/onboarding` | `app/onboarding/page.tsx` | Post-signup flow — role confirmation, first action (search to claim, or create listing, or explore) | Newly registered | MVP | Yes | User record, role | Multi-step; 2–3 steps maximum; Client Component for step state; skippable if user dismisses |
| `/forgot-password` | `app/forgot-password/page.tsx` | Request password reset email | Anonymous | MVP | No | — | Supabase Auth magic link; always shows success message regardless of whether email exists (security) |
| `/reset-password` | `app/reset-password/page.tsx` | Set new password using token from email | Anonymous | MVP | Token in URL | — | Supabase handles token validation; show error if token is expired or invalid |
| `/verify-email` | `app/verify-email/page.tsx` | Email verification landing page (arrived from verification link in email) | Anonymous / New user | MVP | Token in URL | — | Supabase handles token; on success redirect to `/onboarding` or `/dashboard`; on failure show resend option |

---

## Account Routes (Supporter)

These routes are part of the authenticated supporter experience. All require a valid session. Role checks are enforced by `middleware.ts` and by server-side session reads within each page.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/account` | `app/account/page.tsx` | Account overview — redirect to role-appropriate primary view | Supporter, Owner | MVP | Yes | User role | Server-side redirect: Owner → `/dashboard`; Supporter → `/account/saved` |
| `/account/saved` | `app/account/saved/page.tsx` | Saved listings — all listings the user has bookmarked | Supporter, Owner | MVP | Yes | Saves for `auth.uid()`, listing records with basic fields | Save/unsave toggle from this page; empty state with CTA to `/discover` |
| `/account/reviews` | `app/account/reviews/page.tsx` | All reviews submitted by this user — status, associated listing, edit option | Supporter | V1 | Yes | Reviews for `auth.uid()` | Shows pending/published/rejected status; edit is allowed while review is pending |
| `/account/orders` | `app/account/orders/page.tsx` | Buyer order history — order status, line items, vendor link, reorder option | Supporter | V2 | Yes | Orders for `auth.uid()`, line items, vendor listing records | Requires V2 marketplace checkout |
| `/account/spend` | `app/account/spend/page.tsx` | Personal community spend tracker — total spend by category and month, receipts list | Supporter | V2 | Yes | Spend events for `auth.uid()`, aggregated by category + month | Private to the user; community aggregate shown publicly elsewhere |
| `/account/receipts` | `app/account/receipts/page.tsx` | Receipt upload history and upload form — beta intake flow | Supporter | MVP (beta) | Yes | Spend events for `auth.uid()`, upload form | MVP beta: intake only, no visualization; `spend_events` table populated; no dashboard chart yet |
| `/account/settings` | `app/account/settings/page.tsx` | Profile settings — display name, email, password change, notification preferences, delete account | Supporter, Owner | MVP | Yes | User record for `auth.uid()` | Separate form sections for profile, security, and notifications; destructive actions (delete) require confirmation dialog |

---

## Business Owner Dashboard Routes

These routes are only accessible to users with a Business Owner role. The dashboard is the primary management interface for a claimed or created BLACQList Page. All are protected by middleware and by server-side role validation.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/claim` | `app/claim/page.tsx` | Claim a BLACQList Page — search for existing listing by name, city, or category | Authenticated (any) | MVP | Yes | Search query → listing results | Entry point before auth is also acceptable at MVP (redirect to sign-in if not authenticated mid-flow); duplicate detection warning displayed |
| `/claim/[listing-id]` | `app/claim/[listing-id]/page.tsx` | Claim a specific listing — submit verification info (email, phone, optional document upload) | Authenticated (any) | MVP | Yes | Listing record by ID | Creates a claim record with `status: pending`; triggers claim submitted email; shows confirmation state on submit |
| `/add-business` | `app/add-business/page.tsx` | Create a new BLACQList Page for a business that doesn't exist yet — multi-step form | Authenticated (any) | MVP | Yes | Category list, city list | Multi-step: entity type → basic info → contact → category/city → media → CTA → preview → publish; duplicate warning before final submit |
| `/dashboard` | `app/dashboard/page.tsx` | Owner dashboard home — stats overview, claim status, quick edit links | Business Owner | MVP | Yes | Listing record for owner, analytics events aggregate (7d/30d views, CTA clicks, saves, shares), claim status | Role check: non-owners redirected to `/account`; renders stats cards + Page status + quick action buttons |
| `/dashboard/page` | `app/dashboard/page/page.tsx` | Full BLACQList Page editor — all fields: hero, about, services, gallery, hours, contact, social, CTA, publish toggle | Business Owner | MVP | Yes | Full listing record, listing_details_business, media_attachments | Large multi-section form; `react-hook-form` + `zod`; autosave on section blur; preview link; publish/unpublish toggle |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Page analytics — views, CTA clicks, saves, shares; 30-day and 90-day trend charts; search impression count | Business Owner | V1 | Yes | Analytics events for listing_id, aggregated by day/week; review count + average | MVP has basic counts only; V1 adds charts and search impressions; Recharts for trend charts |
| `/dashboard/reviews` | `app/dashboard/reviews/page.tsx` | Review management — view all reviews, respond to published reviews, flag inappropriate reviews | Business Owner | V1 | Yes | Reviews for listing_id where `status = published`, review responses | Read-only for pending reviews; respond action on published; flag action available |
| `/dashboard/products` | `app/dashboard/products/page.tsx` | Manage marketplace product listings — create, edit, archive products; manage inventory | Marketplace Vendor | V2 | Yes | Products for vendor_id, inventory counts | Requires vendor storefront flag on listing; V2 only |
| `/dashboard/services` | `app/dashboard/services/page.tsx` | Manage service offerings listed on the BLACQList Page — add, edit, reorder, delete | Business Owner | MVP | Yes | Services for listing_id | Simpler than products — no cart or inventory; text descriptions and optional pricing |
| `/dashboard/events` | `app/dashboard/events/page.tsx` | Create and manage Event Pages linked to this Business Page | Business Owner, Event Organizer | Beta | Yes | Events for organizer_listing_id | Event creation form; event list; auto-archive status indicator |
| `/dashboard/jobs` | `app/dashboard/jobs/page.tsx` | Create and manage Job listings linked to this Business Page | Business Owner, Job Poster | Beta | Yes | Jobs for employer_listing_id | Job creation form; job list with expiry dates; extend or close listings |
| `/dashboard/upgrade` | `app/dashboard/upgrade/page.tsx` | Listing tier upgrade — Free / Standard / Premium comparison, Stripe subscription initiation | Business Owner | V1 | Yes | Current tier for listing, tier definitions, Stripe pricing IDs | Stripe Checkout session created server-side; redirect to Stripe hosted page; success/cancel return URLs |
| `/dashboard/billing` | `app/dashboard/billing/page.tsx` | Stripe Customer Portal — manage subscription, payment method, cancel, download invoices | Business Owner (paid tier) | V1.5 | Yes | Stripe Customer ID for user | Stripe Customer Portal session created server-side; redirect to Stripe portal; no UI to build beyond the redirect button |
| `/dashboard/suggestions` | `app/dashboard/suggestions/page.tsx` | AI Page optimization suggestions — description improvements, category accuracy, CTA completeness | Business Owner | V2 | Yes | Listing record, AI suggestion response from Anthropic API | Owner-triggered; not automatic; shows suggestions with accept/dismiss per field; V2 only |

---

## Admin Routes

All admin routes are protected by middleware requiring `role = admin` or `role = super_admin`. Server-side role check on every page load — middleware alone is not sufficient. A failed role check redirects to `/` with no indication of admin route existence.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | Admin entry point — immediate redirect to `/admin/overview` | Admin, Super Admin | MVP | Yes (admin role) | — | Redirect only; no content |
| `/admin/overview` | `app/admin/overview/page.tsx` | Platform stats dashboard — total listings, new this week, pending claims, total users, flagged listings, recent activity | Admin, Super Admin | MVP | Yes (admin role) | Platform-wide aggregates from listings, claims, users tables | Stat cards + activity feed; Server Component; no charts at MVP; V1 adds trend charts |
| `/admin/listings` | `app/admin/listings/page.tsx` | All listings — filterable table with status (claimed/unclaimed/flagged/pending), city, category, entity type | Admin, Super Admin | MVP | Yes (admin role) | Paginated listings with all filter dimensions; claim status join | Full CRUD access; status filter chips; bulk flag action; search by name |
| `/admin/listings/[id]` | `app/admin/listings/[id]/page.tsx` | Single listing edit view — all fields, status controls, flag reason, delete confirmation | Admin, Super Admin | MVP | Yes (admin role) | Full listing record, listing_details_business, media_attachments, claim record if any | Same form fields as owner dashboard page editor; additional: status override, flag reason, hard delete (confirmation required) |
| `/admin/claims` | `app/admin/claims/page.tsx` | Pending claim queue — list of all claims with status filter (pending/approved/rejected) | Admin, Super Admin | MVP | Yes (admin role) | All claims with listing + user join, verification info | Claim cards with approve/reject actions; reject requires reason input |
| `/admin/claims/[id]` | `app/admin/claims/[id]/page.tsx` | Single claim review — claimant info, submitted verification, listing details, approve/reject action | Admin, Super Admin | MVP | Yes (admin role) | Claim record, linked listing, user record, uploaded verification documents | Approve triggers owner role assignment + email; reject triggers email with reason |
| `/admin/verification` | `app/admin/verification/page.tsx` | Verification document review queue — pending Verified badge applications | Admin, Super Admin | Beta | Yes (admin role) | Verification submissions with status filter | Approve grants Verified badge on listing; reject with reason; document preview in panel |
| `/admin/receipts` | `app/admin/receipts/page.tsx` | Receipt review queue — spot-check incoming receipt data for OCR accuracy and completeness | Admin, Super Admin | MVP (beta) | Yes (admin role) | Spend events with `status = pending_review`; receipt image from Supabase Storage | Beta intake; no visualization; admin can correct OCR-suggested values and approve |
| `/admin/marketplace` | `app/admin/marketplace/page.tsx` | Marketplace management — order overview, vendor applications, dispute queue | Admin, Super Admin | V2 | Yes (admin role) | Orders (all), vendor applications, disputes | V2 only; Stripe Connect vendor review |
| `/admin/events` | `app/admin/events/page.tsx` | Event listing review queue — newly submitted events pending admin review before publishing | Admin, Super Admin | Beta | Yes (admin role) | Event listings with `status = pending`; linked organizer | Approve/reject with reason; auto-publish option configurable |
| `/admin/jobs` | `app/admin/jobs/page.tsx` | Job listing review queue — newly submitted jobs pending admin review | Admin, Super Admin | Beta | Yes (admin role) | Job listings with `status = pending`; linked employer | Approve/reject with reason |
| `/admin/sponsored` | `app/admin/sponsored/page.tsx` | Sponsored placement management — assign and manage featured slots in search results, city pages, homepage | Admin, Super Admin | V1 | Yes (admin role) | Sponsor records, placement slots, active placements | Manual placement at V1; self-serve is V1.5; clearly labeled "Sponsored" in all public UI |
| `/admin/collections` | `app/admin/collections/page.tsx` | Manage editorial collections — create, edit, reorder, archive | Admin, Super Admin | MVP | Yes (admin role) | All collections, listing search for adding members | Create form: title, slug, description, cover image; add/remove listings by search |
| `/admin/collections/[id]` | `app/admin/collections/[id]/page.tsx` | Edit a single collection — update metadata, manage listing order, publish/archive | Admin, Super Admin | MVP | Yes (admin role) | Collection record, linked listing records | Drag-to-reorder listing sequence within collection |
| `/admin/guides` | `app/admin/guides/page.tsx` | Manage city guide pages — create, edit, publish, archive | Admin, Super Admin | V1 | Yes (admin role) | All guides, city list, linked listing records by category | City guide creation: city, title, category sections, featured listings per section |
| `/admin/blacqlight` | `app/admin/blacqlight/page.tsx` | Manage BLACQLight editorial articles — create, edit, publish, archive | Admin, Editor, Super Admin | V1 | Yes (admin or editor role) | All articles, author record, linked listing references | Rich text editor (Tiptap or similar); link listings inline; schedule publish date |
| `/admin/reviews` | `app/admin/reviews/page.tsx` | Review moderation queue — all submitted reviews pending moderation | Admin, Super Admin | V1 | Yes (admin role) | Reviews with `status = pending`, linked listing + user | Approve (publishes to Page) / reject (removed, user optionally notified) / flag for follow-up |
| `/admin/corrections` | `app/admin/corrections/page.tsx` | Community correction queue — user-submitted data correction requests | Admin, Super Admin | V1 | Yes (admin role) | Correction submissions, linked listing records, submitted correction details | Apply correction to listing / reject / contact submitter; resolution email fires on action |
| `/admin/flowmap` | `app/admin/flowmap/page.tsx` | Flow map data explorer — raw spend event data, node distribution, data quality view | Admin, Super Admin | V3 | Yes (admin role) | Spend events aggregate, business nodes with opt-in flag, city-level volume | Internal tool only; not a public page; D3 or React Flow visualization |
| `/admin/analytics` | `app/admin/analytics/page.tsx` | Platform-level analytics dashboard — listings by city/category/trust status, claim resolution time, search query breakdown, active owner count | Admin, Super Admin | V1 | Yes (admin role) | Aggregated analytics events, listing stats, claim stats, search query logs | MVP has basic counts; V1 adds full analytics dashboard with charts |
| `/admin/users` | `app/admin/users/page.tsx` | User management — view all users, filter by role, suspend/unsuspend, change role, view account details | Admin, Super Admin | MVP | Yes (admin role) | Users table, user_roles table | Role change and suspend are irreversible-feeling actions; require confirmation dialogs; Super Admin only for Admin role assignment |

---

## Utility / Legal Routes

Static content pages. All are public, no auth required, no dynamic data. Serve as simple Server Components with no data fetching.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/privacy` | `app/privacy/page.tsx` | Privacy policy — full legal text | All | MVP | No | Static content | Must be live before public launch; linked in footer and at account creation |
| `/terms` | `app/terms/page.tsx` | Terms of service — full legal text | All | MVP | No | Static content | Must be live before public launch; linked in footer |
| `/cookies` | `app/cookies/page.tsx` | Cookie policy — what is tracked, how to opt out | All | MVP | No | Static content | Linked from cookie consent banner |
| `/dmca` | `app/dmca/page.tsx` | DMCA takedown request contact and instructions | All | MVP | No | Static content | Required for user-generated content platforms (photos, descriptions) |

---

## System Routes

API routes, generated files, and infrastructure endpoints. These are not rendered UI pages.

| Route | File Path | Purpose | User Role | Phase | Auth Required | Data Needed | Notes |
|---|---|---|---|---|---|---|---|
| `/sitemap.xml` | `app/sitemap.ts` | Auto-generated XML sitemap — all listings, city pages, category pages, collections, guides, articles | N/A | MVP | No | All published listing slugs, city slugs, category slugs, collection slugs | Next.js `sitemap.ts` export; submitted to Google Search Console; regenerates on ISR revalidation |
| `/robots.txt` | `app/robots.ts` | Robots configuration — allow all public routes, disallow `/admin`, `/dashboard`, `/account`, `/api` | N/A | MVP | No | Static config | Next.js `robots.ts` export |
| `/og/[...params]` | `app/og/[...params]/route.ts` | Dynamic OG image generation — produces a branded Open Graph image per listing using the listing's cover image, name, and category | N/A | MVP | No | Listing name, cover image URL, category from URL params | `@vercel/og` or `next/og`; called by the `<meta property="og:image">` tag on BLACQList Pages; cached at CDN level |
| `/api/search` | `app/api/search/route.ts` | Search API — accepts `q`, `category`, `city`, `type`, `page` query params; returns paginated listing results | All | MVP | No (public) | Supabase PG FTS query with tsvector + pg_trgm; filters as WHERE clauses | Public endpoint; rate-limited; response envelope: `{ data: [], meta: { total, page, limit } }` |
| `/api/listings/[id]` | `app/api/listings/[id]/route.ts` | Single listing data endpoint — used by client-side save/share interactions where full page re-render is not needed | Authenticated | MVP | Yes | Listing record by ID | Returns only publicly safe fields; auth required for save state |
| `/api/saves` | `app/api/saves/route.ts` | Save / unsave a listing — POST to save, DELETE to unsave | Authenticated | MVP | Yes | `saves` table; user_id + listing_id | Returns updated save count; used by save button on listing cards and BLACQList Pages |
| `/api/analytics/event` | `app/api/analytics/event/route.ts` | Fire an analytics event (page_view, cta_click, save, search_query) — called client-side after user action | All | MVP | No | Analytics event payload: type, listing_id, user_id (optional), metadata | Fire-and-forget; non-blocking; logs to `analytics_events` table |
| `/api/webhooks/stripe` | `app/api/webhooks/stripe/route.ts` | Stripe webhook handler — handles subscription created, updated, cancelled; payment succeeded/failed; refund processed | N/A (Stripe) | V1 | Stripe signature | Stripe webhook payload, Stripe secret | `stripe.webhooks.constructEvent()` for signature verification; `raw` body required; idempotent handlers |
| `/api/webhooks/resend` | `app/api/webhooks/resend/route.ts` | Resend email event webhook — tracks email delivered, bounced, complained events | N/A (Resend) | V1 | Resend signature | Resend webhook payload | Logs email delivery events; bounce handling updates notification preferences |
| `/api/upload` | `app/api/upload/route.ts` | Server-side file upload handler — validates file type and size, uploads to Supabase Storage, returns storage path | Authenticated | MVP | Yes | File (multipart), bucket name, auth session | Never returns a CDN URL — returns storage path only; URL generated at read time |
| `/api/receipts` | `app/api/receipts/route.ts` | Receipt upload and OCR intake — accepts receipt photo, optionally runs OCR suggestion, stores spend_event | Authenticated | MVP (beta) | Yes | Receipt image file, `spend_events` table | OCR is a stub at MVP beta (manual entry); OCR pipeline added in V2 |

---

## Routes Not in MVP Yet

All routes that are defined in this document but not available at public MVP launch. These should not be built, linked to, or accessible before their phase.

| Route | Phase | Reason Not in MVP |
|---|---|---|
| `/discover` | MVP | Actually in MVP — this row should not exist |
| `/events` | Beta | Event Page template deferred to Beta; no event entity type at MVP |
| `/jobs` | Beta | Job listing template deferred to Beta; no job entity type at MVP |
| `/guides` | V1 | Editorial city guides require Editor role + CMS; editorial work is V1 |
| `/guide/[slug]` | V1 | Same as above |
| `/blacqlight` | V1 | BLACQLight editorial articles require Editor CMS; V1 |
| `/blacqlight/[slug]` | V1 | Same as above |
| `/map` | V2 | Requires maps API integration, geo coordinates on listing records, significant V2 work |
| `/marketplace` | V2 | Full commerce layer; Stripe Connect, vendor storefronts; V2 |
| `/for-vendors` | V2 | No vendor product until marketplace is live |
| `/for-sponsors` | V1 | Sponsorships are manual at MVP; marketing page not needed until V1 sales motion begins |
| `/pricing` | V1 | No paid tiers at MVP; listing tiers launch in V1 |
| `/near-me` | V2 | Geo search requires maps API and geo coordinates on listings |
| `/neighborhood/[neighborhood-slug]` | V2 | Neighborhood data model not in MVP schema; requires city + neighborhood relationship |
| `/[city-slug]/professional/[listing-slug]` | Beta | Professional Page template deferred to Beta |
| `/[city-slug]/creative/[listing-slug]` | Beta | Creative Page template deferred to Beta |
| `/events/[event-slug]` | Beta | Event Page template deferred to Beta |
| `/jobs/[job-slug]` | Beta | Job listing template deferred to Beta |
| `/marketplace/vendor/[vendor-slug]` | V2 | Vendor storefront is V2 |
| `/marketplace/product/[product-slug]` | V2 | Product pages are V2 |
| `/marketplace/service/[service-slug]` | V2 | Service detail pages are V2 |
| `/sponsor/[sponsor-slug]` | V1 | Sponsor records and profiles are V1 |
| `/account/reviews` | V1 | Review display and management are V1 |
| `/account/orders` | V2 | Requires marketplace checkout (V2) |
| `/account/spend` | V2 | Personal spend dashboard is V2 |
| `/dashboard/analytics` | V1 | Full analytics dashboard is V1; basic counts are in dashboard home at MVP |
| `/dashboard/reviews` | V1 | Review management for owners is V1 |
| `/dashboard/products` | V2 | Marketplace product management is V2 |
| `/dashboard/events` | Beta | Event management is Beta |
| `/dashboard/jobs` | Beta | Job management is Beta |
| `/dashboard/upgrade` | V1 | Listing tier monetization is V1 |
| `/dashboard/billing` | V1.5 | Stripe Customer Portal is V1.5 |
| `/dashboard/suggestions` | V2 | AI Page optimization suggestions are V2 |
| `/admin/verification` | Beta | Verified badge intake and review queue are Beta |
| `/admin/marketplace` | V2 | Marketplace admin tools are V2 |
| `/admin/events` | Beta | Event review queue is Beta |
| `/admin/jobs` | Beta | Job review queue is Beta |
| `/admin/sponsored` | V1 | Sponsored placements are V1 |
| `/admin/guides` | V1 | City guide CMS is V1 |
| `/admin/blacqlight` | V1 | BLACQLight editorial CMS is V1 |
| `/admin/reviews` | V1 | Review moderation queue is V1 |
| `/admin/corrections` | V1 | Community corrections queue is V1 |
| `/admin/flowmap` | V3 | Dollar-flow map data explorer is V3 |
| `/admin/analytics` | V1 | Full platform analytics dashboard is V1 |
| `/api/webhooks/stripe` | V1 | No Stripe integration at MVP |
| `/api/webhooks/resend` | V1 | Email event tracking is V1 |

---

## Next.js App Router File Structure Notes

### Dynamic Segments

The BLACQList uses nested dynamic segments in the entity route pattern. All segment values are slugs — lowercase, hyphen-separated, URL-safe strings.

| Segment | Values | Example |
|---|---|---|
| `[city-slug]` | Generated from `cities` table (slugified city name) | `atlanta`, `houston`, `chicago` |
| `[listing-slug]` | Generated on create: `[business-name]-[city]` | `sweet-auburn-bbq-atlanta` |
| `[category-slug]` | Generated from `categories` table | `restaurants`, `hair-beauty`, `wellness` |
| `[event-slug]` | Generated on create from event name + date | `harlem-night-atlanta-20261104` |
| `[job-slug]` | Generated on create from job title + company | `senior-designer-the-blacqlist` |
| `[slug]` | Generic — used for collections, guides, articles | `best-atlanta-coffee`, `atlanta-city-guide` |
| `[id]` | UUID — used in admin detail routes | `3f2a...` (admin routes only; never exposed in public URLs) |
| `[...params]` | Catch-all — used for OG image generation | `listing/sweet-auburn-bbq-atlanta/og` |

### Route Groups for Layout Separation

Use Next.js route groups (parenthesized folders) to separate shared layouts without affecting the URL path.

| Route Group | Folder | Shared Layout | Routes It Contains |
|---|---|---|---|
| Public | `app/(public)/` | Public layout: top nav, footer, cookie banner | `/`, `/discover`, `/search`, `/city/[city-slug]`, all entity pages, legal pages |
| Auth | `app/(auth)/` | Minimal layout: centered, no nav, no footer | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Onboarding | `app/(onboarding)/` | Minimal layout: progress indicator, no full nav | `/onboarding` |
| Dashboard | `app/(dashboard)/` | Dashboard shell: sidebar nav, top bar, mobile nav | `/dashboard`, `/dashboard/*`, `/account`, `/account/*`, `/claim`, `/add-business` |
| Admin | `app/(admin)/` | Admin shell: admin-specific sidebar, breadcrumbs, role gate | `/admin`, `/admin/*` |

### Files Required Per Route Segment

| File | Purpose | Required For |
|---|---|---|
| `layout.tsx` | Shared layout for a route segment and all its children | Every route group; any route with a persistent shell (dashboard, admin) |
| `page.tsx` | The rendered page content for a URL segment | Every accessible URL |
| `loading.tsx` | React Suspense fallback during server-side data loading | All data-heavy pages: BLACQList Pages, search, dashboard, admin list views |
| `error.tsx` | Error boundary for runtime errors within the segment | All routes that fetch remote data; dashboard; admin; entity pages |
| `not-found.tsx` | 404 content for entities that don't exist or have been unpublished | Entity detail routes: `[listing-slug]`, `[event-slug]`, `[job-slug]`, `[slug]` |
| `route.ts` | API route handler | All `/api/` routes |
| `sitemap.ts` | Sitemap generation | `app/sitemap.ts` — root level only |
| `robots.ts` | Robots.txt generation | `app/robots.ts` — root level only |

### Protected Routes and Middleware

`middleware.ts` at the project root handles session checks before any protected route renders. It runs on the Edge runtime.

**Middleware-protected route patterns:**
- `/dashboard(.*)` — requires valid session; role check (owner) is performed server-side within each page
- `/account(.*)` — requires valid session
- `/claim(.*)` — requires valid session
- `/add-business` — requires valid session
- `/admin(.*)` — requires valid session AND `role = admin` OR `role = super_admin`; a valid session without an admin role receives a redirect to `/`, not a 403 page
- `/onboarding` — requires valid session; redirect away if onboarding already completed

**Publicly accessible but session-aware:**
- `/sign-in`, `/sign-up` — if already authenticated, redirect to `/dashboard`
- All entity pages (`/[city-slug]/business/[listing-slug]`, etc.) — publicly accessible; save/review buttons show sign-in prompt for unauthenticated users via a modal, not a redirect
- `/search`, `/discover`, `/city/[city-slug]` — public; save button state requires a session check via a lightweight client-side auth check

### Static Generation and Revalidation Strategy

| Route | Strategy | Revalidation |
|---|---|---|
| `/[city-slug]/business/[listing-slug]` | `generateStaticParams` for all published listings at build | ISR `revalidate: 3600` (1 hour) |
| `/city/[city-slug]` | `generateStaticParams` for all cities at build | ISR `revalidate: 86400` (24 hours) |
| `/city/[city-slug]/[category-slug]` | `generateStaticParams` for all active city+category combinations | ISR `revalidate: 86400` |
| `/collection/[slug]` | `generateStaticParams` for all published collections | ISR `revalidate: 3600` |
| `/search` | Dynamic (always server-rendered per request) | No caching — search results must be fresh |
| `/dashboard`, `/account`, admin routes | Dynamic (always server-rendered per request, session-dependent) | No caching |
| `/`, `/discover`, `/events`, `/jobs` | ISR with short revalidation | `revalidate: 1800` (30 minutes) |
| `/privacy`, `/terms`, `/cookies`, `/dmca` | Static — no dynamic data | `revalidate: false` (fully static at build) |

### OG Image Generation

Every BLACQList Page (`/[city-slug]/business/[listing-slug]`) generates a unique OG image via the `/og/[...params]` API route. The `og:image` meta tag on each listing page points to this route with the listing slug as a parameter. The route uses `@vercel/og` to compose an image from the listing's cover photo, business name, category, and city. OG images are cached at the CDN level with a long TTL and invalidated when the listing is updated.

### `use client` Boundaries

Default is Server Component. The following component types require `"use client"`:

| Component Type | Reason |
|---|---|
| Search filter bar | `useSearchParams`, `useRouter` for URL state management |
| Save button | `onClick` handler, optimistic UI state |
| Dashboard stats cards (real-time toggle) | `useState` for time range selector |
| Page editor form (`/dashboard/page`) | `react-hook-form`, `useState`, autosave effect |
| Claim form and add-business multi-step form | `react-hook-form`, step state via `useState` |
| Admin approve/reject actions | `onClick`, confirmation dialog state |
| Image gallery uploader | `useState`, drag-to-reorder |
| Mobile navigation | `useState` for open/close |
| Cookie consent banner | `localStorage`, `useState` |
| `/near-me` geo detection | `navigator.geolocation` (browser API) |
| OG share button | `navigator.clipboard` or `navigator.share` (browser API) |

Server Components that contain Client Component children pass data as props. Client Components that wrap Server Component children use the `children` prop pattern to preserve server rendering of the inner content.
