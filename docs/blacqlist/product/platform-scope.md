# Platform Scope — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product + Architecture

This document defines what The BLACQList is and is not, and which modules belong to which release phase.

---

## What Is In Scope

The BLACQList is a national Black discovery, marketplace, and community commerce platform. All of the following are in scope for the full platform over time. Not all are in scope for MVP.

---

## Module Inventory

| # | Module | Phase | Priority |
|---|---|---|---|
| 1 | National discovery + search | MVP | Must-have |
| 2 | City-aware discovery + city landing pages | MVP | Must-have |
| 3 | Category-aware discovery + category landing pages | MVP | Must-have |
| 4 | BLACQList Pages — business template | MVP | Must-have |
| 5 | BLACQList Pages — professional template | V1 | Should-have |
| 6 | BLACQList Pages — creative template | V1 | Should-have |
| 7 | BLACQList Pages — event template | V1 | Should-have |
| 8 | BLACQList Pages — job/opportunity listing | V1 | Should-have |
| 9 | BLACQList Pages — marketplace vendor template | V2 | Later |
| 10 | Claim workflow (business owner claims listing) | MVP | Must-have |
| 11 | Create workflow (business owner creates new listing) | MVP | Must-have |
| 12 | Manage workflow (dashboard for owners to edit their Page) | MVP | Must-have |
| 13 | Trust + verification (claimed → verified → certified) | V1 | Should-have |
| 14 | Community corrections (flag incorrect info) | V1 | Should-have |
| 15 | Reviews (star rating + text) | V1 | Should-have |
| 16 | Saves + save lists | MVP | Must-have |
| 17 | Shares (social share, copy link) | MVP | Must-have |
| 18 | Marketplace — vendor storefronts | V2 | Later |
| 19 | Marketplace — product listings | V2 | Later |
| 20 | Marketplace — cart + checkout | V2 | Later |
| 21 | Marketplace — fulfillment tracking | V2 | Later |
| 22 | Receipt upload | V2 | Later |
| 23 | Community spend tracking | V2 | Later |
| 24 | Dollar-flow map (visualization) | V3 | Future |
| 25 | Supporter dashboard | V1 | Should-have |
| 26 | Business owner dashboard | MVP | Must-have |
| 27 | Vendor dashboard | V2 | Later |
| 28 | Sponsor dashboard | V3 | Future |
| 29 | Admin dashboard | MVP | Must-have |
| 30 | Editorial — BLACQLight articles | V1 | Should-have |
| 31 | Editorial — curated collections | V1 | Should-have |
| 32 | Editorial — city guides | V2 | Later |
| 33 | AI — shopper-side discovery agent | V2 | Later |
| 34 | AI — business page optimization agent | V2 | Later |
| 35 | AI — admin + curator agent | V3 | Future |
| 36 | Monetization — listing tiers (free/basic/premium) | V1 | Should-have |
| 37 | Monetization — sponsored pages | V1 | Should-have |
| 38 | Monetization — marketplace transaction fees | V2 | Later |
| 39 | Monetization — job posting fees | V2 | Later |
| 40 | Monetization — event promotion fees | V2 | Later |
| 41 | Monetization — sponsor campaign packages | V3 | Future |
| 42 | Platform analytics (admin) | V1 | Should-have |
| 43 | Business analytics (owner dashboard) | V1 | Should-have |
| 44 | Community impact analytics | V3 | Future |

---

## Phase Definitions

### MVP
The smallest version of The BLACQList that delivers real value to real users on launch day.

A real user — someone who is not the founder and has no obligation to use the platform — can:
- Search for a Black-owned business, professional, or creative by keyword, category, or city
- View a polished BLACQList Page for that entity
- Save, share, or click to contact/visit
- Claim or create their own BLACQList Page
- Manage their Page from an owner dashboard
- Be found, reviewed, and trusted

The MVP is not feature-complete. It is value-complete for the core discovery and listing use case.

### V1 (Post-MVP Hardening)
Adds trust signals, reviews, community health, and early monetization. The platform moves from "discoverable" to "trusted and growing."

### V2 (Commerce Layer)
Adds marketplace, receipt upload, spend tracking, and job + event monetization. The platform becomes a commerce platform, not just a discovery platform.

### V3 (Intelligence + Impact Layer)
Adds AI concierge, dollar-flow map, sponsor campaigns, and community impact analytics. The platform becomes a data layer for the Black economy.

---

## What Is Explicitly Out of Scope

These will not be built at any phase without a new product decision:

- **Social feed / content feed** — The BLACQList is not a social network. No timeline, no follower graph, no status updates.
- **Messaging / DMs between users** — Contact is handled through business contact CTAs (phone, email, booking link), not on-platform messaging.
- **Ratings-only aggregator** — The platform is not built to be Yelp for Black businesses. Reviews exist in service of trust, not as the core product.
- **Job board as a standalone product** — Job listings are one entity type on The BLACQList, not a separate product.
- **Crowdfunding or donations** — Not a GoFundMe competitor.
- **User-generated content beyond reviews and corrections** — No blog posts, no photo uploads from general users, no community boards.
- **B2B tools** — Business-to-business transactions, procurement tools, or supplier directories are out of scope.
- **International listings** — US-only at launch. International is a future decision, not a current architecture concern.

---

## Entity Types

The BLACQList supports the following entity types. Each type has its own BLACQList Page template.

| Entity Type | Template | Phase |
|---|---|---|
| Business | Full business Page (hero, about, offerings, hours, gallery, reviews, contact) | MVP |
| Professional | Professional profile Page (bio, services, credentials, portfolio, reviews, contact) | V1 |
| Creative | Creative Page (bio, medium/genre, portfolio/gallery, booking, reviews, contact) | V1 |
| Event | Event Page (date/time, location, description, tickets/RSVP, organizer, related businesses) | V1 |
| Job/Opportunity | Job listing Page (role, description, employer, apply link, deadline) | V1 |
| Marketplace Vendor | Vendor storefront Page (products, categories, shipping info, reviews) | V2 |
| Product | Product listing card (linked from vendor Page or searchable standalone) | V2 |
| Service | Service listing card (linked from business or professional Page) | MVP (embedded) |

---

## Relationship Between Entity Types

```
Business ──── lists ──────► Services
Business ──── employs ────► Professionals
Business ──── hosts ───────► Events
Business ──── posts ────────► Jobs
Vendor ──────── sells ──────► Products
Creative ────── offers ─────► Services
Creative ────── performs at ► Events
Professional ── attends ────► Events
User ──────────── saves ─────► Any entity
User ──────────── reviews ───► Any entity
User ──────────── shares ────► Any entity
```

In MVP, these relationships are modeled in the data but only the Business → Services linkage is surfaced in the UI.

---

## Assumptions

- 8 entity types is the right taxonomy at launch — we may discover a 9th type (e.g., "Community Organization") that doesn't fit any current category
- The BLACQList Page template system can be built with a shared base template and entity-specific extensions
- Events as an entity type are sufficiently different from businesses to require their own template
- Job listings are a relatively low-complexity entity type and can be added in V1 without significant additional infrastructure

---

## Open Questions

1. Should services be a standalone entity type or always embedded in a business/professional Page?
2. Should organizations (nonprofits, community groups) be their own entity type or categorized under Business?
3. Does the data model need to support an entity belonging to multiple types? (e.g., a creative who is also a vendor)
4. Should event listings auto-expire, and if so, what happens to the Page after expiry?
5. Are job listings self-service or do they require admin approval before publishing?

---

## Do Not Overbuild Yet

- Do not build V2 entity types (vendors, products) before the core business template is used and validated
- Do not build all 8 Page templates simultaneously — ship business first, add others incrementally
- Do not build the marketplace infrastructure before the directory is functioning
- Do not build entity relationship UIs before the underlying entities are working individually
- Do not add entity types that have no confirmed user demand before launch
