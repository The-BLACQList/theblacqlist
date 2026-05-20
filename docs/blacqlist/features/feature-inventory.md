# Feature Inventory — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product

This is the canonical list of all features across all modules and phases. Use this as a reference when writing tickets, planning sprints, and making scope decisions.

**Priority key:** M = Must-have (MVP) | S = Should-have (V1) | L = Later (V2) | F = Future (V3+)

---

## Module 1 — Search & Discovery

| Feature                                                      | Priority | Phase | Notes                            |
| ------------------------------------------------------------ | -------- | ----- | -------------------------------- |
| Keyword search (full-text across listing fields)             | M        | MVP   |                                  |
| Category filter                                              | M        | MVP   | Top-level categories only at MVP |
| City / metro filter                                          | M        | MVP   |                                  |
| Search results page with listing cards                       | M        | MVP   |                                  |
| Search results: sort by relevance / newest / rating          | S        | V1    |                                  |
| Search results: filter by trust status (verified, certified) | S        | V1    |                                  |
| Autocomplete / type-ahead suggestions                        | S        | V1    |                                  |
| Geo-aware "near me" search                                   | L        | V2    | Requires maps API                |
| Faceted multi-filter (category + city + trust + entity type) | S        | V1    |                                  |
| Empty search state with suggestions                          | M        | MVP   |                                  |
| "No results" state with alternate suggestions                | M        | MVP   |                                  |
| Search history (for logged-in users)                         | L        | V2    |                                  |
| Saved search / alerts                                        | F        | V3    |                                  |
| AI-assisted conversational search                            | L        | V2    | Requires listing data quality    |
| Search analytics (what users are searching for)              | S        | V1    | Admin view                       |

---

## Module 2 — City & Category Discovery

| Feature                                           | Priority | Phase | Notes                      |
| ------------------------------------------------- | -------- | ----- | -------------------------- |
| City landing pages (auto-generated from data)     | M        | MVP   | SEO-optimized              |
| Category landing pages (auto-generated from data) | M        | MVP   | SEO-optimized              |
| Homepage featured categories                      | M        | MVP   |                            |
| Homepage city spotlight                           | M        | MVP   | Atlanta first              |
| Trending entities per city                        | S        | V1    | Based on save/view signals |
| City-level curated collections                    | L        | V2    | Editorial feature          |
| City guides                                       | L        | V2    | Editorial feature          |
| "New to The BLACQList" discovery section          | S        | V1    | Recently added listings    |

---

## Module 3 — BLACQList Pages

### Business Page Template (MVP)

| Feature                                                       | Priority | Phase | Notes                   |
| ------------------------------------------------------------- | -------- | ----- | ----------------------- |
| Hero (cover image, business name, tagline, primary CTA)       | M        | MVP   |                         |
| About section (business description)                          | M        | MVP   |                         |
| Category + subcategory tags                                   | M        | MVP   |                         |
| Location (address or service area)                            | M        | MVP   | Address optional        |
| Hours of operation                                            | M        | MVP   |                         |
| Contact info (phone, email, website)                          | M        | MVP   |                         |
| Social links (Instagram, Facebook, LinkedIn, TikTok, YouTube) | S        | MVP   |                         |
| Gallery (up to 12 images)                                     | S        | MVP   |                         |
| Services/offerings section (list with descriptions)           | S        | MVP   |                         |
| Primary CTA configuration (book / order / contact / visit)    | M        | MVP   |                         |
| Save button                                                   | M        | MVP   |                         |
| Share button + OG meta preview                                | M        | MVP   |                         |
| Claimed / verified badge                                      | M        | MVP   |                         |
| Review summary (star rating + count)                          | S        | V1    |                         |
| Review list                                                   | S        | V1    |                         |
| Related listings section                                      | S        | V1    | "More in this category" |
| Featured placement indicator (sponsored)                      | S        | V1    |                         |
| Page SEO (title, description, OG, canonical)                  | M        | MVP   |                         |
| Page sitemap inclusion                                        | M        | MVP   |                         |

### Professional Page Template (V1)

| Feature                                          | Priority | Phase | Notes                     |
| ------------------------------------------------ | -------- | ----- | ------------------------- |
| Bio section                                      | S        | V1    |                           |
| Credentials + certifications                     | S        | V1    |                           |
| Services with pricing (or "contact for pricing") | S        | V1    |                           |
| Portfolio section                                | S        | V1    | Images + case study links |
| LinkedIn + portfolio site link                   | S        | V1    |                           |
| Consultation / booking CTA                       | S        | V1    |                           |

### Creative Page Template (V1)

| Feature                                        | Priority | Phase | Notes |
| ---------------------------------------------- | -------- | ----- | ----- |
| Bio section                                    | S        | V1    |       |
| Medium / genre / discipline tags               | S        | V1    |       |
| Portfolio gallery (images + video embed links) | S        | V1    |       |
| Booking / commission request link              | S        | V1    |       |
| Event appearances (linked Event Pages)         | S        | V1    |       |

### Event Page Template (V1)

| Feature                                           | Priority | Phase | Notes                    |
| ------------------------------------------------- | -------- | ----- | ------------------------ |
| Event name, date, time, end time                  | S        | V1    |                          |
| Location (physical address or "Virtual")          | S        | V1    |                          |
| Event description                                 | S        | V1    |                          |
| Ticket / RSVP link                                | S        | V1    | External link only at V1 |
| Cover image                                       | S        | V1    |                          |
| Organizer link (to Business or Professional Page) | S        | V1    |                          |
| Auto-archive after event date                     | S        | V1    |                          |

### Job / Opportunity Listing (V1)

| Feature                                  | Priority | Phase | Notes              |
| ---------------------------------------- | -------- | ----- | ------------------ |
| Job title, company, location (or remote) | S        | V1    |                    |
| Job description                          | S        | V1    |                    |
| Apply link                               | S        | V1    | Off-platform at V1 |
| Deadline                                 | S        | V1    | Auto-expires       |
| Link to employer's BLACQList Page        | S        | V1    | Optional           |

### Marketplace Vendor Page (V2)

| Feature                    | Priority | Phase | Notes |
| -------------------------- | -------- | ----- | ----- |
| Product grid               | L        | V2    |       |
| Product detail page        | L        | V2    |       |
| Storefront about section   | L        | V2    |       |
| Shipping and return policy | L        | V2    |       |

---

## Module 4 — Claim / Create / Manage

| Feature                                                  | Priority | Phase | Notes |
| -------------------------------------------------------- | -------- | ----- | ----- |
| Search for existing listing to claim                     | M        | MVP   |       |
| Claim request form (with verification info upload)       | M        | MVP   |       |
| Claim status tracking (pending / approved / rejected)    | M        | MVP   |       |
| Email notification: claim approved or rejected           | M        | MVP   |       |
| Create new listing flow (multi-step form)                | M        | MVP   |       |
| Business owner dashboard                                 | M        | MVP   |       |
| Edit all Page fields from dashboard                      | M        | MVP   |       |
| Upload logo and cover image                              | M        | MVP   |       |
| Upload gallery images (up to 12)                         | S        | MVP   |       |
| Set primary CTA type and URL                             | M        | MVP   |       |
| Preview Page before publishing                           | S        | MVP   |       |
| Unpublish / take Page offline                            | S        | MVP   |       |
| Duplicate listing detection (warn before creating)       | S        | MVP   |       |
| AI Page optimization suggestions (description, category) | L        | V2    |       |

---

## Module 5 — Trust & Verification

| Feature                                                    | Priority | Phase | Notes        |
| ---------------------------------------------------------- | -------- | ----- | ------------ |
| "Claimed" badge (shown when listing is owner-managed)      | M        | MVP   |              |
| "Verified" badge (manual admin review, document upload)    | S        | V1    |              |
| "BLACQList Certified" badge (highest tier)                 | S        | V1    | Criteria TBD |
| Verification document upload (business license, EIN, etc.) | S        | V1    |              |
| Admin verification review queue                            | S        | V1    |              |
| Verification expiry + renewal notifications                | L        | V2    |              |
| Community endorsements / vouch feature                     | F        | V3    |              |

---

## Module 6 — Community Corrections

| Feature                                                   | Priority | Phase | Notes |
| --------------------------------------------------------- | -------- | ----- | ----- |
| "Report incorrect info" flag on any listing               | S        | V1    |       |
| Correction submission form (field + suggested correction) | S        | V1    |       |
| Admin correction review queue                             | S        | V1    |       |
| Community-vote on corrections before admin review         | F        | V3    |       |
| "Last verified by community" timestamp                    | S        | V1    |       |

---

## Module 7 — Reviews

| Feature                                              | Priority | Phase | Notes |
| ---------------------------------------------------- | -------- | ----- | ----- |
| Star rating (1–5)                                    | S        | V1    |       |
| Text review body                                     | S        | V1    |       |
| Review submission form                               | S        | V1    |       |
| Review moderation queue (admin)                      | S        | V1    |       |
| Business owner can respond to reviews                | S        | V1    |       |
| "Helpful" vote on reviews                            | L        | V2    |       |
| Review display on BLACQList Page (average + list)    | S        | V1    |       |
| Review display in search results (star rating shown) | S        | V1    |       |
| Flag a review as inappropriate                       | S        | V1    |       |

---

## Module 8 — Saves & Shares

| Feature                                           | Priority | Phase | Notes                |
| ------------------------------------------------- | -------- | ----- | -------------------- |
| Save any listing (heart / bookmark)               | M        | MVP   | Logged-in users only |
| Saved list view in user account                   | M        | MVP   |                      |
| Named save lists (e.g., "Restaurants", "Gifting") | L        | V2    |                      |
| Share listing via copy link                       | M        | MVP   |                      |
| Share listing to social (OG preview)              | M        | MVP   |                      |
| Share listing natively (iOS/Android share sheet)  | L        | V2    | Mobile app           |

---

## Module 9 — Marketplace

| Feature                                         | Priority | Phase | Notes                         |
| ----------------------------------------------- | -------- | ----- | ----------------------------- |
| Vendor storefront Page                          | L        | V2    |                               |
| Product listing page                            | L        | V2    |                               |
| Product variants (size, color, etc.)            | L        | V2    |                               |
| Add to cart                                     | L        | V2    |                               |
| Cart management                                 | L        | V2    |                               |
| Checkout (Stripe)                               | L        | V2    |                               |
| Order confirmation email                        | L        | V2    |                               |
| Buyer order history                             | L        | V2    |                               |
| Vendor order management                         | L        | V2    |                               |
| Fulfillment status updates                      | L        | V2    |                               |
| Vendor Stripe Connect payout setup              | L        | V2    |                               |
| Marketplace transaction fee (platform cut)      | L        | V2    | % defined in monetization doc |
| Buyer refund request                            | L        | V2    |                               |
| Vendor dispute resolution                       | L        | V2    |                               |
| Vendor analytics (sales, revenue, top products) | L        | V2    |                               |

---

## Module 10 — Receipt Upload & Spend Tracking

| Feature                                             | Priority | Phase | Notes |
| --------------------------------------------------- | -------- | ----- | ----- |
| Receipt photo capture (mobile camera)               | L        | V2    |       |
| OCR-assisted category detection                     | L        | V2    |       |
| Manual spend categorization confirm                 | L        | V2    |       |
| Personal spend log                                  | L        | V2    |       |
| Personal spend dashboard (total spend, by category) | L        | V2    |       |
| Community spend aggregate (anonymized, city-level)  | L        | V2    |       |
| Spend streak / milestone gamification               | F        | V3    |       |

---

## Module 11 — Dollar-Flow Map

| Feature                                                 | Priority | Phase | Notes                             |
| ------------------------------------------------------- | -------- | ----- | --------------------------------- |
| Business / vendor node display (opt-in)                 | F        | V3    |                                   |
| Anonymized buyer flow volume                            | F        | V3    |                                   |
| City-level filter                                       | F        | V3    |                                   |
| Category-level filter                                   | F        | V3    |                                   |
| Embed option for external sites                         | F        | V3    |                                   |
| Aggregate summary number ("$X circulated this quarter") | L        | V2    | Simpler version before full graph |

---

## Module 12 — Dashboards

### Supporter Dashboard

| Feature                | Priority | Phase | Notes |
| ---------------------- | -------- | ----- | ----- |
| Saved listings list    | M        | MVP   |       |
| Recently viewed        | S        | V1    |       |
| Suggested businesses   | S        | V1    |       |
| Personal spend summary | L        | V2    |       |

### Business Owner Dashboard

| Feature                             | Priority | Phase | Notes |
| ----------------------------------- | -------- | ----- | ----- |
| Page view count                     | M        | MVP   |       |
| CTA click count                     | M        | MVP   |       |
| Save count                          | M        | MVP   |       |
| Share count                         | S        | MVP   |       |
| Claim status indicator              | M        | MVP   |       |
| Review management                   | S        | V1    |       |
| Analytics (30/90 day views, trends) | S        | V1    |       |
| Tier status + upgrade prompt        | S        | V1    |       |

### Admin Dashboard

| Feature                 | Priority | Phase | Notes |
| ----------------------- | -------- | ----- | ----- |
| Total listings count    | M        | MVP   |       |
| New listings this week  | M        | MVP   |       |
| Pending claims queue    | M        | MVP   |       |
| Flagged listings        | M        | MVP   |       |
| Review moderation queue | S        | V1    |       |
| Correction queue        | S        | V1    |       |
| User management         | M        | MVP   |       |
| Platform analytics      | S        | V1    |       |

---

## Module 13 — Editorial System

| Feature                                     | Priority | Phase | Notes                                        |
| ------------------------------------------- | -------- | ----- | -------------------------------------------- |
| BLACQLight article pages                    | S        | V1    | Admin-created markdown or rich text          |
| Curated collections                         | S        | V1    | List of BLACQList Pages with editorial intro |
| City guides                                 | L        | V2    |                                              |
| Featured placement (link editorial to Page) | S        | V1    |                                              |
| Homepage editorial carousel                 | S        | V1    |                                              |
| Editorial CMS (admin tool)                  | S        | V1    | Minimal — not a full CMS                     |

---

## Module 14 — AI Features

| Feature                                                 | Priority | Phase | Notes |
| ------------------------------------------------------- | -------- | ----- | ----- |
| AI-assisted description suggestions for business owners | L        | V2    |       |
| AI category recommendations                             | L        | V2    |       |
| Conversational discovery agent (shopper-side)           | L        | V2    |       |
| AI curation assistant (admin)                           | F        | V3    |       |
| AI-powered duplicate detection                          | L        | V2    |       |

---

## Module 15 — Monetization

| Feature                                               | Priority | Phase | Notes               |
| ----------------------------------------------------- | -------- | ----- | ------------------- |
| Free listing tier                                     | M        | MVP   |                     |
| Standard listing tier (paid, more features)           | S        | V1    | Stripe subscription |
| Premium listing tier (paid, max features + analytics) | S        | V1    | Stripe subscription |
| Sponsored placement in search results                 | S        | V1    |                     |
| Featured homepage placement (premium)                 | S        | V1    |                     |
| Job posting fee                                       | L        | V2    |                     |
| Event promotion fee                                   | L        | V2    |                     |
| Marketplace transaction fee                           | L        | V2    | Stripe Connect      |
| Sponsor campaign packages                             | F        | V3    |                     |

---

## Module 16 — Analytics

| Feature                                        | Priority | Phase | Notes |
| ---------------------------------------------- | -------- | ----- | ----- |
| Page view counter (business owner)             | M        | MVP   |       |
| CTA click counter (business owner)             | M        | MVP   |       |
| Save + share counter (business owner)          | M        | MVP   |       |
| Admin platform stats                           | M        | MVP   |       |
| Business owner analytics dashboard (30/90 day) | S        | V1    |       |
| City-level platform analytics (admin)          | S        | V1    |       |
| Community impact stats (public-facing)         | F        | V3    |       |
| Downloadable data reports                      | F        | V3    |       |

---

## Feature Dependencies

Critical dependency chains (must be built in this order):

```
Auth → Claim → Owner Dashboard → Page Analytics
Auth → Supporter Account → Save → Saved List
Listings → Search → City Pages → Category Pages
Listings → BLACQList Page → Reviews (V1)
Listings → BLACQList Page → Trust Badges (V1)
Business Page → Vendor Storefront → Products → Cart → Checkout (V2)
Transactions + Receipts → Spend Tracking → Dollar-Flow Map (V2/V3)
High-quality Listing Data → AI Concierge (V2)
```

---

## Assumptions

- All features marked M (Must-have) are required for public launch
- Features marked S (Should-have) should follow within 8–12 weeks of MVP launch
- Features marked L (Later) are explicitly deferred until after V1 is validated
- Features marked F (Future) are in scope for the platform long-term but have no committed timeline

---

## Open Questions

1. Should reviews be enabled in MVP (with no moderation) or held until V1 moderation queue is ready?
2. Is job posting self-service or admin-approved before publishing?
3. Should the AI description suggestion tool launch before or after the manual editing workflow is validated?

---

## Do Not Overbuild Yet

- Do not implement L or F features before their dependencies are live and validated
- Do not build the full analytics stack before there is real user data to analyze
- Do not build marketplace infrastructure before the directory and BLACQList Pages have real business owners
- Do not build AI features before listing data quality is measurably high
