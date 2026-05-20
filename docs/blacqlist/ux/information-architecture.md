# Information Architecture — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth for platform structure
**Owner:** UX / Product
**Audience:** Engineering, Design, QA, Editorial

---

## 1. Platform Overview

The BLACQList is a national Black discovery, marketplace, and community commerce platform. Every listed entity — business, professional, creative, event, job, or vendor — receives a **BLACQList Page**: a polished, templated micro-website with trust signals, rich media, community validation, and a clear path to action. The platform is the definitive digital home for Black-owned entities in every city.

### Core IA Principles

**Discovery is the spine.** Search, city pages, and category pages are the primary entry points. Every route that surfaces an entity page must be findable through at least two of these paths.

**BLACQList Pages are the atomic unit.** Every other surface — search results, city pages, collections, editorial — exists to surface and reinforce the Page. The Page is never downstream of another entity's page; it is always the destination.

**Location is a structural dimension, not a filter.** City and category pages are first-class routes with their own SEO-optimized URLs, not just filtered search results. They exist in the URL hierarchy and generate discrete, indexable pages.

**The IA grows in layers.** Each phase adds depth (more entity templates, more editorial surface area, commerce infrastructure) without restructuring the base. The URL hierarchy defined at MVP accommodates all future entity types and phases without breaking changes.

**Roles determine access depth, not navigation structure.** Anonymous visitors, supporters, business owners, and admins all move through the same public discovery architecture. Role-specific surfaces (dashboards, admin) are additive, not alternative navigation trees.

---

## 2. Top-Level Sections

| Section                | Description                                                                           | Auth Required           | Introduced |
| ---------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| **Public Discovery**   | Homepage, search, city pages, category pages, entity Pages, marketplace, events, jobs | No                      | MVP        |
| **Editorial**          | BLACQLight articles, curated collections, city guides                                 | No                      | V1         |
| **Account**            | Sign in/up, saved listings, reviews, orders, spend, receipts, settings                | Yes                     | MVP        |
| **Owner Dashboard**    | Claim, create, manage Page, analytics, products, services, upgrade                    | Yes (Owner role)        | MVP        |
| **Vendor Dashboard**   | Storefront management, product listings, order management, payouts                    | Yes (Vendor role)       | V2         |
| **Sponsor Dashboard**  | Campaign creation, targeting, performance analytics                                   | Yes (Sponsor role)      | V3         |
| **Admin**              | Listing management, claim review, verification queue, editorial, analytics, system    | Yes (Admin/Super Admin) | MVP        |
| **Marketing / Static** | For Business, For Vendors, For Sponsors, About, Pricing, legal pages                  | No                      | MVP        |

---

## 3. Full Page Inventory

Page labels are annotated: phase (MVP / V1 / V2 / V3), auth requirement (Public / Auth Required), and primary role(s).

---

### 3.1 Public Discovery

```
/                                           Homepage                    MVP  | Public | All
/discover                                   Discover (browse all)       MVP  | Public | All
/search                                     Search Results              MVP  | Public | All
/map                                        Map View                    V2   | Public | All
/marketplace                                Marketplace Home            V2   | Public | All
/marketplace/[category-slug]                Marketplace Category        V2   | Public | All
/events                                     Events Home                 V1   | Public | All
/jobs                                       Jobs Home                   V1   | Public | All
/collections                                Collections Index           V1   | Public | All
/collection/[slug]                          Collection Page             V1   | Public | All
/guides                                     Guides Index                V2   | Public | All
/guide/[slug]                               City Guide Page             V2   | Public | All
/blacqlight                                 BLACQLight Index            V1   | Public | All
/blacqlight/[slug]                          BLACQLight Article          V1   | Public | All
```

---

### 3.2 Location Pages

Auto-generated from listing data. Every page is server-rendered and SEO-indexed.

```
/national                                   All Listings (National)     MVP  | Public | All
/online                                     Online-Only Listings        MVP  | Public | All
/ships-nationwide                           Ships Nationwide            V2   | Public | All  (marketplace)
/virtual-services                           Virtual Services            MVP  | Public | All

/state/[state-slug]                         State Landing Page          MVP  | Public | All
/state/[state-slug]/[category-slug]         State + Category            V1   | Public | All

/city/[city-slug]                           City Landing Page           MVP  | Public | All
/city/[city-slug]/[category-slug]           City + Category             MVP  | Public | All
/city/[city-slug]/[category-slug]/[sub]     City + Category + Sub       V1   | Public | All
/city/[city-slug]/events                    City Events                 V1   | Public | All
/city/[city-slug]/jobs                      City Jobs                   V1   | Public | All
/city/[city-slug]/marketplace               City Marketplace            V2   | Public | All
/near-me                                    Near Me (geo)               V2   | Public | All
```

> Neighborhood pages are generated only when listing density in a city exceeds a threshold (V2).
> "Near Me" requires geolocation permission and maps API integration.

---

### 3.3 Entity Pages (BLACQList Pages)

All entity pages use the base route: `/[city-slug]/[category-slug]/[listing-slug]`

Each entity type has its own template rendered at this URL.

```
/[city-slug]/[category-slug]/[listing-slug]     Business BLACQList Page     MVP  | Public | All
/[city-slug]/[category-slug]/[listing-slug]     Professional Page           V1   | Public | All
/[city-slug]/[category-slug]/[listing-slug]     Creative Page               V1   | Public | All
/[city-slug]/events/[listing-slug]              Event Page                  V1   | Public | All
/[city-slug]/jobs/[listing-slug]                Job Page                    V1   | Public | All
/[city-slug]/[category-slug]/[listing-slug]     Vendor Page                 V2   | Public | All
/[city-slug]/[category-slug]/[listing-slug]/[product-slug]   Product Page   V2   | Public | All
/[city-slug]/[category-slug]/[listing-slug]/services/[slug]  Service Page   V1   | Public | All
```

> Entity type is determined by a `listing_type` field, not by the URL. The URL structure is shared across all entity types. The template rendered differs by entity type.
> Event Pages auto-archive after event date; they remain accessible via direct URL but are excluded from search indexing post-event.
> Product Pages and Service Pages are sub-pages of their parent Vendor/Business Page.

---

### 3.4 Account Pages

```
/sign-in                                    Sign In                     MVP  | Public (redirects if auth'd)
/sign-up                                    Sign Up                     MVP  | Public (redirects if auth'd)
/sign-up/[step]                             Onboarding Steps            MVP  | Auth Required | New User
/forgot-password                            Password Reset Request      MVP  | Public
/reset-password                             Password Reset (token)      MVP  | Public (token-gated)
/verify-email                               Email Verification          MVP  | Public (token-gated)

/account                                    Account Overview            MVP  | Auth Required | Supporter+
/account/saved                              Saved Listings              MVP  | Auth Required | Supporter+
/account/saved/[list-slug]                  Named Save List             V1   | Auth Required | Supporter+
/account/reviews                            My Reviews                  V1   | Auth Required | Supporter+
/account/orders                             Order History               V2   | Auth Required | Supporter+
/account/orders/[order-id]                  Order Detail                V2   | Auth Required | Supporter+
/account/spend                              Community Spend Dashboard   V2   | Auth Required | Supporter+
/account/receipts                           Receipt Uploads             V2   | Auth Required | Supporter+
/account/settings                           Account Settings            MVP  | Auth Required | Supporter+
/account/settings/profile                   Profile Settings            MVP  | Auth Required | Supporter+
/account/settings/notifications             Notification Preferences    V1   | Auth Required | Supporter+
/account/settings/privacy                   Privacy Settings            V2   | Auth Required | Supporter+
/account/settings/password                  Change Password             MVP  | Auth Required | Supporter+
/account/settings/delete                    Delete Account              MVP  | Auth Required | Supporter+
```

---

### 3.5 Owner Dashboard Pages

```
/dashboard                                  Owner Dashboard Home        MVP  | Auth Required | Owner+
/dashboard/page                             My BLACQList Page (view)    MVP  | Auth Required | Owner+
/dashboard/page/edit                        Edit Page                   MVP  | Auth Required | Owner+
/dashboard/page/edit/[section]              Edit Page — Section         MVP  | Auth Required | Owner+
/dashboard/media                            Media Manager               MVP  | Auth Required | Owner+
/dashboard/analytics                        Analytics Overview          V1   | Auth Required | Owner+
/dashboard/analytics/[metric]               Analytics Detail            V1   | Auth Required | Owner+
/dashboard/reviews                          Reviews Inbox               V1   | Auth Required | Owner+
/dashboard/products                         Products (Vendor)           V2   | Auth Required | Vendor+
/dashboard/products/new                     New Product                 V2   | Auth Required | Vendor+
/dashboard/products/[id]/edit               Edit Product                V2   | Auth Required | Vendor+
/dashboard/services                         Services                    MVP  | Auth Required | Owner+
/dashboard/services/new                     New Service                 MVP  | Auth Required | Owner+
/dashboard/services/[id]/edit               Edit Service                MVP  | Auth Required | Owner+
/dashboard/events                           My Events                   V1   | Auth Required | Owner/Organizer
/dashboard/events/new                       Create Event                V1   | Auth Required | Owner/Organizer
/dashboard/events/[id]/edit                 Edit Event                  V1   | Auth Required | Owner/Organizer
/dashboard/jobs                             My Job Listings             V1   | Auth Required | Owner/Job Poster
/dashboard/jobs/new                         Post a Job                  V1   | Auth Required | Owner/Job Poster
/dashboard/jobs/[id]/edit                   Edit Job                    V1   | Auth Required | Owner/Job Poster
/dashboard/orders                           Orders (Vendor)             V2   | Auth Required | Vendor+
/dashboard/orders/[id]                      Order Detail (Vendor)       V2   | Auth Required | Vendor+
/dashboard/payouts                          Payouts / Stripe Connect    V2   | Auth Required | Vendor+
/dashboard/upgrade                          Upgrade Listing Tier        V1   | Auth Required | Owner+
/dashboard/claim                            Claim Status                MVP  | Auth Required | Owner (pending)
/dashboard/verification                     Verification Status         V1   | Auth Required | Owner+
/dashboard/settings                         Dashboard Settings          MVP  | Auth Required | Owner+
```

**Entry flow pages** (outside the dashboard but owner-initiated):

```
/claim                                      Claim Your Page (start)     MVP  | Public (auth gate mid-flow)
/claim/search                               Search for Your Listing     MVP  | Public (auth gate mid-flow)
/claim/[listing-id]                         Claim This Listing          MVP  | Auth Required | Any→Owner
/claim/[listing-id]/submitted               Claim Submitted             MVP  | Auth Required | Owner (pending)
/add-your-business                          Add Your Business (start)   MVP  | Public (auth gate mid-flow)
/add-your-business/new                      New Listing Form            MVP  | Auth Required | Any→Owner
```

---

### 3.6 Vendor Dashboard Pages

```
/vendor                                     Vendor Dashboard Home       V2   | Auth Required | Vendor+
/vendor/storefront                          Storefront View             V2   | Auth Required | Vendor+
/vendor/storefront/edit                     Edit Storefront             V2   | Auth Required | Vendor+
/vendor/products                            Product Management          V2   | Auth Required | Vendor+
/vendor/products/new                        New Product                 V2   | Auth Required | Vendor+
/vendor/products/[id]/edit                  Edit Product                V2   | Auth Required | Vendor+
/vendor/orders                              Orders                      V2   | Auth Required | Vendor+
/vendor/orders/[id]                         Order Detail                V2   | Auth Required | Vendor+
/vendor/analytics                           Vendor Analytics            V2   | Auth Required | Vendor+
/vendor/payouts                             Payouts & Stripe Connect    V2   | Auth Required | Vendor+
/vendor/settings                            Vendor Settings             V2   | Auth Required | Vendor+
```

---

### 3.7 Sponsor Dashboard Pages

```
/sponsor                                    Sponsor Dashboard Home      V3   | Auth Required | Sponsor
/sponsor/campaigns                          Campaigns                   V3   | Auth Required | Sponsor
/sponsor/campaigns/new                      Create Campaign             V3   | Auth Required | Sponsor
/sponsor/campaigns/[id]                     Campaign Detail             V3   | Auth Required | Sponsor
/sponsor/campaigns/[id]/edit                Edit Campaign               V3   | Auth Required | Sponsor
/sponsor/analytics                          Campaign Analytics          V3   | Auth Required | Sponsor
/sponsor/billing                            Billing & Budget            V3   | Auth Required | Sponsor
/sponsor/settings                           Sponsor Settings            V3   | Auth Required | Sponsor
```

---

### 3.8 Admin Pages

```
/admin                                      Admin Dashboard             MVP  | Auth Required | Admin+
/admin/listings                             All Listings                MVP  | Auth Required | Admin+
/admin/listings/[id]                        Listing Detail (Admin)      MVP  | Auth Required | Admin+
/admin/listings/[id]/edit                   Edit Listing (Admin)        MVP  | Auth Required | Admin+
/admin/claims                               Claim Review Queue          MVP  | Auth Required | Admin+
/admin/claims/[id]                          Claim Detail                MVP  | Auth Required | Admin+
/admin/verification                         Verification Queue          V1   | Auth Required | Admin+
/admin/verification/[id]                    Verification Detail         V1   | Auth Required | Admin+
/admin/corrections                          Community Corrections Queue V1   | Auth Required | Admin+
/admin/corrections/[id]                     Correction Detail           V1   | Auth Required | Admin+
/admin/reviews                              Reviews Moderation Queue    V1   | Auth Required | Admin+
/admin/reviews/[id]                         Review Detail               V1   | Auth Required | Admin+
/admin/events                               Event Review Queue          V1   | Auth Required | Admin+
/admin/jobs                                 Job Listing Review          V1   | Auth Required | Admin+
/admin/marketplace                          Marketplace Review          V2   | Auth Required | Admin+
/admin/receipts                             Receipt Review Queue        V2   | Auth Required | Admin+
/admin/users                                User Management             MVP  | Auth Required | Admin+
/admin/users/[id]                           User Detail                 MVP  | Auth Required | Admin+
/admin/editorial                            Editorial Management        V1   | Auth Required | Admin/Editor
/admin/editorial/collections                Collections Manager         V1   | Auth Required | Admin/Editor
/admin/editorial/collections/new            New Collection              V1   | Auth Required | Admin/Editor
/admin/editorial/collections/[id]/edit      Edit Collection             V1   | Auth Required | Admin/Editor
/admin/editorial/articles                   BLACQLight Articles         V1   | Auth Required | Admin/Editor
/admin/editorial/articles/new               New Article                 V1   | Auth Required | Admin/Editor
/admin/editorial/articles/[id]/edit         Edit Article                V1   | Auth Required | Admin/Editor
/admin/editorial/guides                     City Guides Manager         V2   | Auth Required | Admin/Editor
/admin/editorial/guides/new                 New City Guide              V2   | Auth Required | Admin/Editor
/admin/editorial/guides/[id]/edit           Edit City Guide             V2   | Auth Required | Admin/Editor
/admin/sponsored                            Sponsored Placements        V1   | Auth Required | Admin+
/admin/sponsored/[id]                       Sponsored Placement Detail  V1   | Auth Required | Admin+
/admin/analytics                            Platform Analytics          V1   | Auth Required | Admin+
/admin/analytics/[view]                     Analytics Detail View       V1   | Auth Required | Admin+
/admin/flow-map                             Dollar-Flow Map Data        V3   | Auth Required | Admin+
/admin/settings                             System Settings             MVP  | Auth Required | Super Admin
/admin/settings/[section]                   System Settings — Section   MVP  | Auth Required | Super Admin
/admin/audit-log                            Audit Log                   MVP  | Auth Required | Super Admin
```

---

### 3.9 Marketing / Static Pages

```
/for-business                               For Business Owners         MVP  | Public | All
/for-vendors                                For Marketplace Vendors     V2   | Public | All
/for-sponsors                               For Sponsors                V3   | Public | All
/about                                      About The BLACQList         MVP  | Public | All
/pricing                                    Pricing & Tiers             V1   | Public | All
/privacy                                    Privacy Policy              MVP  | Public | All
/terms                                      Terms of Service            MVP  | Public | All
/cookies                                    Cookie Policy               MVP  | Public | All
/dmca                                       DMCA Policy                 MVP  | Public | All
```

---

### 3.10 Utility Pages

```
/404                                        Not Found                   MVP  | Public | All
/500                                        Server Error                MVP  | Public | All
/maintenance                                Maintenance Mode            MVP  | Public | All
/loading                                    Loading / Suspense fallback MVP  | Internal | —
```

---

## 4. Content Hierarchy Per Page Type

### 4.1 Homepage (`/`)

Priority order — what appears first to last:

1. **Navigation bar** — wordmark, search bar (prominent), Sign In / Sign Up, city selector
2. **Hero** — headline, subheadline, primary CTA ("Discover Black-owned near you"), city input
3. **City spotlight** — featured city (Atlanta at launch), quick-access category pills for that city
4. **Featured categories** — 6–8 top-level categories with icons, linked to category landing pages
5. **Featured BLACQList Pages** — 6–8 editorially selected Pages (admin-curated at MVP; algorithmic surfacing in V1)
6. **Recently added** — 4–6 newest Pages (V1 only)
7. **Editorial teaser** — BLACQLight article(s) or collection promo (V1 only)
8. **For business owners CTA** — "Claim or create your BLACQList Page" banner, linked to `/for-business`
9. **Community impact teaser** — dollar-flow visual or community spend stat (V3 only)
10. **Footer** — navigation links, social links, legal links

---

### 4.2 Search Results (`/search`)

Priority order:

1. **Search bar** — persistent, pre-filled with current query
2. **Active filters bar** — city, category, trust status chips with remove (×); "Clear all" when active
3. **Result count + sort control** — "142 results in Atlanta" + sort: Relevance / Newest / Rating (V1)
4. **Results grid / list** — listing cards: primary image, name, category, city, claimed/verified badge, star rating (V1), save button
5. **Empty state** — when zero results: heading, suggestion to adjust query, related category suggestions
6. **Pagination or infinite scroll** — page controls at bottom
7. **Filter panel** — sidebar (desktop) or drawer (mobile): category, city, trust status, entity type (V1)
8. **Map toggle** — switch to map view (V2)

---

### 4.3 Business BLACQList Page (`/[city]/[category]/[slug]`)

Priority order:

1. **Hero** — cover image (full-width), business name, tagline, claimed/verified badge, primary CTA button
2. **Quick-actions bar** — Save, Share, Directions, Call (sticky on scroll, mobile-first)
3. **About** — business description
4. **Contact & hours** — phone, email, website, address, hours of operation (card layout)
5. **Social links** — Instagram, Facebook, LinkedIn, TikTok, YouTube
6. **Services / offerings** — list with descriptions and optional pricing
7. **Gallery** — image grid (up to 12 images), lightbox on click
8. **Reviews** — star rating summary card, review list with author/date/text (V1)
9. **Related listings** — "More in [category] in [city]" row (V1)
10. **Category + location breadcrumb** — linked back to city page and category page
11. **Report / correction link** — "Is this info incorrect?" (V1)

---

### 4.4 Owner Dashboard Home (`/dashboard`)

Priority order:

1. **Status banner** — claim status (Pending / Approved / Active), or verification status if V1 feature
2. **Page preview card** — thumbnail + name + URL of their BLACQList Page, "View live Page" link
3. **Quick-action buttons** — Edit Page, Upload Media, View Analytics (V1), Post a Job (V1)
4. **Analytics summary strip** — Page views, CTA clicks, saves, shares (last 30 days; V1 only — at MVP shows placeholder with "Analytics coming soon")
5. **Completion checklist** — progress indicator for Page completeness (logo uploaded, description added, hours set, etc.)
6. **Reviews inbox preview** — latest 2–3 reviews (V1 only)
7. **Products / services count** — shortcut to manage offerings
8. **Upgrade nudge** — if on free tier, contextual prompt to upgrade (V1 only)
9. **Help / resources panel** — tips for improving Page performance

---

### 4.5 Admin Dashboard Home (`/admin`)

Priority order:

1. **Platform stats strip** — Total listings, Active listings, Pending claims, New this week, Total users
2. **Priority action queues** — Claim Review (count badge), Verification Queue (V1), Corrections Queue (V1), Reviews Queue (V1) — each row is a shortcut to the relevant queue with count
3. **Recent activity feed** — last 10 platform events (new listings, claims submitted, new users)
4. **Listings by status** — quick-filter table: All / Unclaimed / Claimed / Verified / Flagged
5. **Search bar** — search for a specific listing or user by name
6. **Moderation alerts** — flagged listings, reported reviews, correction requests needing action
7. **Editorial shortcuts** — Create Collection, Write Article, Create Guide (V1)
8. **Analytics link** — "View platform analytics" (V1)

---

## 5. URL Hierarchy Summary

### Entity Pages

```
/[city-slug]/[category-slug]/[listing-slug]
  └── /[listing-slug]/services/[service-slug]    (V1)
  └── /[listing-slug]/[product-slug]             (V2)

Examples:
  /atlanta/restaurants/buttermilk-kitchen
  /houston/hair-salons/prestige-hair-studio
  /chicago/bookstores/semicolon-bookshop
  /atlanta/events/black-art-market-june-2026     (V1)
  /atlanta/jobs/graphic-designer-at-blacq-co     (V1)
```

### Location Pages

```
/national
/online
/virtual-services
/ships-nationwide                                (V2)

/state/[state-slug]
/state/[state-slug]/[category-slug]              (V1)

/city/[city-slug]
/city/[city-slug]/[category-slug]
/city/[city-slug]/[category-slug]/[sub-slug]     (V1)
/city/[city-slug]/events                         (V1)
/city/[city-slug]/jobs                           (V1)
/city/[city-slug]/marketplace                    (V2)
/near-me                                         (V2)

Examples:
  /city/atlanta
  /city/atlanta/restaurants
  /city/atlanta/restaurants/soul-food
  /state/georgia
```

### Account Pages

```
/account
/account/saved
/account/saved/[list-slug]                       (V1)
/account/reviews                                 (V1)
/account/orders                                  (V2)
/account/orders/[order-id]                       (V2)
/account/spend                                   (V2)
/account/receipts                                (V2)
/account/settings
/account/settings/profile
/account/settings/notifications                  (V1)
/account/settings/privacy                        (V2)
/account/settings/password
/account/settings/delete
```

### Owner Dashboard

```
/dashboard
/dashboard/page
/dashboard/page/edit
/dashboard/page/edit/[section]
/dashboard/analytics                             (V1)
/dashboard/analytics/[metric]                    (V1)
/dashboard/reviews                               (V1)
/dashboard/products                              (V2)
/dashboard/services
/dashboard/events                                (V1)
/dashboard/jobs                                  (V1)
/dashboard/orders                                (V2)
/dashboard/payouts                               (V2)
/dashboard/upgrade                               (V1)
/dashboard/claim
/dashboard/verification                          (V1)
/dashboard/settings
```

### Admin

```
/admin
/admin/listings
/admin/listings/[id]
/admin/listings/[id]/edit
/admin/claims
/admin/claims/[id]
/admin/verification                              (V1)
/admin/corrections                               (V1)
/admin/reviews                                   (V1)
/admin/events                                    (V1)
/admin/jobs                                      (V1)
/admin/marketplace                               (V2)
/admin/receipts                                  (V2)
/admin/users
/admin/users/[id]
/admin/editorial                                 (V1)
/admin/editorial/collections                     (V1)
/admin/editorial/articles                        (V1)
/admin/editorial/guides                          (V2)
/admin/sponsored                                 (V1)
/admin/analytics                                 (V1)
/admin/flow-map                                  (V3)
/admin/settings
/admin/audit-log
```

### Editorial

```
/collection/[slug]
/guide/[slug]                                    (V2)
/blacqlight/[slug]                               (V1)
```

---

## 6. Navigation Entry Points

The five primary paths by which a user reaches a BLACQList Page:

| #   | Entry Point                         | Path                                                              | Notes                                                                                 |
| --- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | **Direct URL / Search engine**      | Google → `/[city]/[category]/[slug]`                              | Primary organic traffic source. Pages must be server-rendered with full SEO metadata. |
| 2   | **Platform search**                 | `/search?q=[query]&city=[city]` → listing card → Page             | Primary in-product discovery path. Card click navigates to the Page URL.              |
| 3   | **City or category landing page**   | `/city/[city]` or `/city/[city]/[category]` → listing card → Page | Browsing-intent path. Listings surface as cards on these pages.                       |
| 4   | **Editorial collection or article** | `/collection/[slug]` or `/blacqlight/[slug]` → Page link          | V1. Curated discovery. Collection members are explicitly linked Pages.                |
| 5   | **Shared link**                     | External social share or copy-link → Page URL                     | Any surface can generate a share link. OG tags ensure preview renders on social.      |

Additional entry points as the platform grows:

- Saved list (`/account/saved`) → Page (Supporter path, MVP)
- Homepage featured section → Page (editorial or algorithmic)
- Related listings section on another Page (V1)
- Near me / map view (V2)

---

## 7. Cross-Linking Logic

### Business Page cross-links:

| From          | Links to                                        | Why                                                |
| ------------- | ----------------------------------------------- | -------------------------------------------------- |
| Business Page | City landing page `/city/[city]`                | Breadcrumb, category/location context              |
| Business Page | Category landing page `/city/[city]/[category]` | Breadcrumb                                         |
| Business Page | Collection pages featuring this Page            | "Featured in" badge or inline collection link (V1) |
| Business Page | Related listings (same city + category)         | "More in [category]" row (V1)                      |
| Business Page | Event Pages linked from this business           | Upcoming events section (V1)                       |
| Business Page | Job Pages linked from this business             | "We're hiring" section (V1)                        |
| Business Page | Marketplace product pages                       | Product grid (V2)                                  |

### City Landing Page cross-links:

| From      | Links to                              | Why                                    |
| --------- | ------------------------------------- | -------------------------------------- |
| City Page | Category sub-pages for that city      | Top categories nav, quick-access pills |
| City Page | Individual listing Pages in that city | Featured listings grid                 |
| City Page | Collections scoped to that city       | "Top collections in [city]" (V1)       |
| City Page | City Guide for that city              | Editorial link (V2)                    |
| City Page | Events in that city                   | Events section or link (V1)            |
| City Page | Jobs in that city                     | Jobs section or link (V1)              |

### Collection Page cross-links:

| From       | Links to                                           | Why                             |
| ---------- | -------------------------------------------------- | ------------------------------- |
| Collection | Each member BLACQList Page                         | Primary purpose of a collection |
| Collection | City page(s) represented in the collection         | Contextual navigation           |
| Collection | Related collections                                | "More collections" (V1)         |
| Collection | BLACQLight article that references this collection | Editorial linkage (V1)          |

### Search Results cross-links:

| From           | Links to                                  | Why                                |
| -------------- | ----------------------------------------- | ---------------------------------- |
| Search Results | Individual listing Pages                  | Primary click target on each card  |
| Search Results | City landing page for active city filter  | "Browse all in [city]" suggestion  |
| Search Results | Category landing page for active category | "See all in [category]" suggestion |

### Account / Saved List cross-links:

| From            | Links to                              | Why                          |
| --------------- | ------------------------------------- | ---------------------------- |
| Saved List      | Individual listing Pages              | Re-visit saved entity        |
| Order History   | Vendor Page, Product Page             | Re-purchase or revisit (V2)  |
| Spend Dashboard | Listing Pages for logged transactions | Connect spend to entity (V2) |

---

## 8. SEO Architecture

| URL Tier                                                 | SEO Intent                                                       | Priority         | Key Signal                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| **Homepage** `/`                                         | Brand authority, national top-level query                        | Critical         | Domain authority, brand name recognition, featured entity signals          |
| **City Pages** `/city/[city]`                            | Local discovery intent ("Black-owned businesses in Atlanta")     | Critical         | City-level keyword density, listing count, freshness                       |
| **City + Category Pages** `/city/[city]/[category]`      | Transactional local intent ("Black-owned restaurants Atlanta")   | Critical         | Category + city co-occurrence, listing density, structured data            |
| **Individual Listing Pages** `/[city]/[category]/[slug]` | Name + location queries ("Buttermilk Kitchen Atlanta soul food") | High             | Entity-specific title, description, schema.org LocalBusiness, reviews (V1) |
| **State Pages** `/state/[state]`                         | Mid-funnel state-level queries                                   | Medium           | State + keyword co-occurrence                                              |
| **National** `/national`                                 | Broad awareness queries                                          | Medium           | Breadth signal, category diversity                                         |
| **Collections** `/collection/[slug]`                     | Editorial + long-tail intent ("best Black-owned bookstores")     | Medium           | Unique editorial copy, link equity from articles                           |
| **BLACQLight Articles** `/blacqlight/[slug]`             | Informational + discovery intent, backlinkable                   | Medium           | Original editorial content, internal linking to Pages                      |
| **City Guides** `/guide/[slug]`                          | Local editorial intent, high shareability                        | Medium (V2)      | Long-form, geographically rich content                                     |
| **Event Pages** `/[city]/events/[slug]`                  | Time-bound event queries                                         | Low / time-bound | Structured event schema; de-indexed or archived post-event                 |
| **Job Pages** `/[city]/jobs/[slug]`                      | Job title + city queries                                         | Low / time-bound | Job structured data; expire on deadline                                    |
| **Marketplace Pages** `/marketplace/[...]`               | Product + category queries                                       | Medium (V2)      | Product schema, pricing data, merchant trust signals                       |

### SEO Requirements at MVP:

- All entity Pages and location Pages must be server-side rendered (Next.js `generateStaticParams` or ISR)
- Every Page must have unique `<title>`, `<meta name="description">`, and OpenGraph tags
- Entity Pages must include `schema.org/LocalBusiness` JSON-LD structured data
- XML sitemap auto-generated from live listings; updated on publish/unpublish
- Canonical URLs on all pages; no duplicate content between filtered views and canonical URLs
- `robots.txt` must block admin, dashboard, and account routes
- Event and job Pages must include structured data (schema.org/Event, schema.org/JobPosting) and be marked with `validThrough` / `endDate` for auto-expiry signal

---

## 9. Content Types

These are the distinct content types in the platform — not UI components. Each has its own data model, lifecycle, and permissions.

| Content Type           | Description                                                                                             | Introduced     | Entity/Table                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------- |
| **Listing (base)**     | The shared record underlying all entity Pages. Contains name, city, category, status, owner.            | MVP            | `listings`                        |
| **Business Page**      | Full business profile template. Extends Listing with hours, gallery, services, CTAs, social links.      | MVP            | `listings` + `business_pages`     |
| **Professional Page**  | Individual practice profile. Extends Listing with bio, credentials, portfolio, services.                | V1             | `listings` + `professional_pages` |
| **Creative Page**      | Creative portfolio + booking. Extends Listing with medium, portfolio, event appearances.                | V1             | `listings` + `creative_pages`     |
| **Event Page**         | Time-bounded event. Extends Listing with date, location/virtual, ticket link, auto-expiry.              | V1             | `listings` + `event_pages`        |
| **Job Page**           | Job/opportunity listing. Extends Listing with role, description, apply link, deadline.                  | V1             | `listings` + `job_pages`          |
| **Vendor Page**        | Commerce-enabled business profile. Extends Business Page with product grid, storefront settings.        | V2             | `listings` + `vendor_pages`       |
| **Product**            | Individual purchasable item. Linked to Vendor Page. Has price, variants, inventory.                     | V2             | `products`                        |
| **Service**            | Named offering within a Business or Professional Page. Has description, optional price.                 | MVP (embedded) | `services`                        |
| **Collection**         | Editorially curated set of listing Pages. Has title, description, cover image, member list.             | V1             | `collections`                     |
| **City Guide**         | Long-form editorial content for a specific city. Contains curated sections with embedded Pages.         | V2             | `guides`                          |
| **BLACQLight Article** | Editorial article. May reference listings. Has author, publish date, body, tags.                        | V1             | `articles`                        |
| **Review**             | Star rating + text by a Supporter. Linked to a Listing. Has status (pending/published/removed).         | V1             | `reviews`                         |
| **Spend Event**        | A logged community spend transaction. Linked to a Listing. Source: receipt upload or marketplace order. | V2             | `spend_events`                    |
| **Analytics Event**    | A tracked platform action (Page view, CTA click, save, share). Not user-visible; powers dashboards.     | MVP (basic)    | `analytics_events`                |
| **User**               | Platform account. Has role(s), email, display name, auth credential.                                    | MVP            | `users`                           |
| **Claim**              | A request by a User to become the Owner of a Listing. Has status (pending/approved/rejected).           | MVP            | `claims`                          |
| **Correction**         | A community-submitted flag indicating incorrect or outdated listing information.                        | V1             | `corrections`                     |
| **Sponsor Campaign**   | A paid promotional placement package. Has budget, targeting, placements, duration.                      | V3             | `sponsor_campaigns`               |

---

## 10. Phase-by-Phase IA Growth

| Section / Page Type                         | Prototype          | MVP                              | V1                                           | V2                                    | V3                   |
| ------------------------------------------- | ------------------ | -------------------------------- | -------------------------------------------- | ------------------------------------- | -------------------- |
| Homepage                                    | Static design only | Live                             | + trending, editorial teaser                 | + marketplace teaser                  | + impact stats       |
| Search Results                              | —                  | Live                             | + sort, trust filter, entity type filter     | + map toggle                          | —                    |
| City Landing Pages                          | —                  | Live (Atlanta, Houston, Chicago) | + state pages, expanded cities               | + marketplace, near me, neighborhoods | —                    |
| Category Landing Pages                      | —                  | Live                             | + sub-categories, trust filter               | —                                     | —                    |
| Business BLACQList Page                     | Static design only | Live                             | + reviews, related listings, correction link | —                                     | + flow map indicator |
| Professional Page                           | —                  | —                                | Live                                         | —                                     | —                    |
| Creative Page                               | —                  | —                                | Live                                         | —                                     | —                    |
| Event Page                                  | —                  | —                                | Live                                         | —                                     | —                    |
| Job Page                                    | —                  | —                                | Live                                         | —                                     | —                    |
| Vendor Page                                 | —                  | —                                | —                                            | Live                                  | —                    |
| Product Page                                | —                  | —                                | —                                            | Live                                  | —                    |
| Service Page (sub-page)                     | —                  | Embedded only                    | Live as sub-page                             | —                                     | —                    |
| Collections Index + Pages                   | —                  | —                                | Live                                         | —                                     | —                    |
| BLACQLight Articles                         | —                  | —                                | Live                                         | —                                     | —                    |
| City Guides                                 | —                  | —                                | —                                            | Live                                  | —                    |
| Marketplace Home + Category                 | —                  | —                                | —                                            | Live                                  | —                    |
| Events Home                                 | —                  | —                                | Live                                         | —                                     | —                    |
| Jobs Home                                   | —                  | —                                | Live                                         | —                                     | —                    |
| Map View                                    | —                  | —                                | —                                            | Live                                  | —                    |
| Sign In / Sign Up                           | —                  | Live                             | —                                            | —                                     | —                    |
| Onboarding Flow                             | —                  | Live                             | + role branching                             | —                                     | —                    |
| Account — Saved                             | —                  | Live                             | + named lists                                | —                                     | —                    |
| Account — Reviews                           | —                  | —                                | Live                                         | —                                     | —                    |
| Account — Orders                            | —                  | —                                | —                                            | Live                                  | —                    |
| Account — Spend / Receipts                  | —                  | —                                | —                                            | Live                                  | —                    |
| Account — Settings                          | —                  | Live (basic)                     | + notifications                              | + privacy                             | —                    |
| Claim Flow                                  | —                  | Live                             | —                                            | —                                     | —                    |
| Add Your Business Flow                      | —                  | Live                             | —                                            | —                                     | —                    |
| Owner Dashboard Home                        | —                  | Live                             | + analytics, reviews, events, jobs, upgrade  | + products, orders, payouts           | —                    |
| Vendor Dashboard                            | —                  | —                                | —                                            | Live                                  | —                    |
| Sponsor Dashboard                           | —                  | —                                | —                                            | —                                     | Live                 |
| Admin Dashboard                             | —                  | Live (basic)                     | + queues, editorial, analytics, sponsored    | + marketplace, receipts               | + flow-map data      |
| Admin Claim Queue                           | —                  | Live                             | —                                            | —                                     | —                    |
| Admin Verification Queue                    | —                  | —                                | Live                                         | —                                     | —                    |
| Admin Corrections Queue                     | —                  | —                                | Live                                         | —                                     | —                    |
| Admin Reviews Queue                         | —                  | —                                | Live                                         | —                                     | —                    |
| Admin Editorial Tools                       | —                  | —                                | Live                                         | + guides                              | —                    |
| Admin Analytics                             | —                  | Basic stats only                 | Full analytics dashboard                     | + marketplace, spend                  | + impact analytics   |
| For Business Page                           | Static only        | Live                             | —                                            | —                                     | —                    |
| For Vendors Page                            | —                  | —                                | —                                            | Live                                  | —                    |
| For Sponsors Page                           | —                  | —                                | —                                            | —                                     | Live                 |
| Pricing Page                                | —                  | —                                | Live (V1 tiers)                              | + vendor/job fees                     | + sponsor packages   |
| Legal Pages (Privacy, Terms, DMCA, Cookies) | —                  | Live                             | Updated for reviews                          | Updated for marketplace               | Updated for AI       |
| 404 / 500 / Maintenance                     | —                  | Live                             | —                                            | —                                     | —                    |
| Dollar-Flow Map                             | —                  | —                                | —                                            | —                                     | Live                 |

---

## Next Artifact

The recommended next document is `docs/blacqlist/ux/user-flow-discovery.md` — mapping the step-by-step discovery and search flows for Anonymous Visitor and Supporter, from first touch to Page view to save/share. This is the highest-traffic path on the platform and the one most dependent on correct IA implementation.

After that: `user-flow-claim.md` (business owner claim and create flows), then `screen-map.md` (full screen inventory with layout types, primary actions, and role access per screen).
