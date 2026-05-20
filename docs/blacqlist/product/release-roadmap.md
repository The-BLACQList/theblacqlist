# Release Roadmap — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product

This is a living roadmap. Phases are sequential — do not start a phase before the prior phase's acceptance criteria are met. Timeline estimates are directional, not commitments.

---

## Roadmap Summary

| Phase   | Name               | Focus                                                    | Status      |
| ------- | ------------------ | -------------------------------------------------------- | ----------- |
| 0       | Foundation         | Infrastructure + project setup                           | Planning    |
| 1 (MVP) | Find & Be Found    | Discovery + BLACQList Pages + Claim/Manage               | Planning    |
| 2 (V1)  | Trust & Grow       | Reviews + Trust signals + Editorial + Early monetization | Not started |
| 3 (V2)  | Commerce Layer     | Marketplace + Receipts + Spend tracking                  | Not started |
| 4 (V3)  | Intelligence Layer | AI concierge + Dollar-flow map + Advanced analytics      | Not started |
| 5 (V4)  | Scale              | Mobile app + Multi-language + Expanded cities            | Not started |

---

## Phase 0 — Foundation

**Goal:** Technical infrastructure is in place. No user-facing features yet.

**Deliverables:**

- Next.js 14 project scaffolded with TypeScript, Tailwind, shadcn/ui
- Supabase project initialized (database, auth, storage)
- Vercel deployment pipeline connected
- Base schema: `users`, `listings`, `categories`, `cities`, `media_attachments`
- Auth flow: signup, signin, signout, password reset
- Admin role assigned via database, protected routes via middleware
- Seed data pipeline: import script for initial Atlanta listings
- Domain + DNS configuration
- Environment variables documented

**Acceptance criteria:**

- A developer can sign up, sign in, and see an empty admin dashboard
- Seed script imports 10 test listings to the database
- Vercel preview deploy is live on every PR
- Supabase RLS is enabled on all tables

**Estimated duration:** 1–2 weeks

---

## Phase 1 (MVP) — Find & Be Found

**Goal:** A real user can search for Black-owned businesses and find a polished Page. A business owner can claim or create their listing. The platform is publicly live.

**New in this phase:**

### Discovery

- Full-text keyword search
- Category filter
- City filter
- Search results page with listing cards
- City landing pages (auto-generated from data)
- Category landing pages (auto-generated from data)
- Homepage with featured categories and city spotlight

### BLACQList Pages

- Business Page template: hero, about, category, location, hours, contact, social links, gallery, services, CTA
- Page SEO: server-rendered, OG tags, canonical URLs, sitemap
- Share functionality (copy link + social)

### Claim + Create + Manage

- Claim flow: search → select listing → submit claim request
- Create flow: new listing form
- Business owner dashboard: view/edit Page, upload media, manage CTA, see claim status
- Admin claim queue: review, approve, reject claim requests

### User Accounts

- Email signup/signin
- Saved list (save any listing, view saved list)
- User profile (display name, email)

### Admin

- Listing management (view all, filter by status, edit any)
- Basic stats: total listings, new this week, pending claims

**Launch data requirement:** 150+ Atlanta listings, 50+ each in Houston and Chicago

**Acceptance criteria:** See `mvp-definition.md` acceptance criteria

**Estimated duration:** 6–10 weeks from Phase 0 completion

---

## Phase 2 (V1) — Trust & Grow

**Goal:** The platform moves from discoverable to trusted. Business owners have a reason to stay active. Early revenue begins.

**New in this phase:**

### Trust + Reviews

- Review system: star rating + text, with basic moderation queue
- Review display on BLACQList Pages (average rating, review count, recent reviews)
- Trust badges: claimed → verified (manual review) → BLACQList Certified
- Verification flow: business owner submits documents, admin reviews
- Community corrections: flag incorrect info, admin reviews flag queue

### Additional Page Templates

- Professional Page template
- Creative Page template
- Event Page template (with auto-expiry on past dates)
- Job/Opportunity listing template

### Supporter Experience

- Supporter dashboard: saved lists, recently viewed, suggested businesses
- Follow a business (be notified of updates — lightweight)

### Editorial

- BLACQLight article pages (admin-created)
- Curated collections (admin-created, e.g., "Best Black-owned Restaurants in Atlanta")
- Featured placements on homepage and city pages

### Early Monetization

- Listing tiers: Free, Standard, Premium (feature set defined in monetization doc)
- Sponsored placement: premium listings appear at top of category/city search results
- Stripe integration for listing tier subscriptions

### Analytics

- Business owner analytics: Page views, CTA clicks, saves, shares (last 30/90 days)
- Admin analytics: listings by city, listings by category, new signups, active business owners

**Dependencies:**

- Phase 1 (MVP) must be fully live with real users
- Minimum 500 total listings before reviews add meaningful signal
- Admin team in place for trust/verification queue

**Estimated duration:** 8–12 weeks after MVP launch

---

## Phase 3 (V2) — Commerce Layer

**Goal:** The BLACQList becomes a place where you can buy, not just discover. Community spend tracking begins.

**New in this phase:**

### Marketplace

- Vendor storefront Page template (extends Business Page with commerce features)
- Product listing pages (title, images, price, description, variants)
- Cart + checkout (Stripe)
- Order management (vendor dashboard)
- Buyer order history
- Marketplace transaction fee model (Stripe Connect)
- Fulfillment status tracking

### Receipt Upload + Spend Tracking

- Receipt upload flow: photo capture → OCR-assisted categorization → manual confirm → logged
- Personal spend dashboard (supporter dashboard)
- Community spend aggregates (city-level, category-level — anonymized)
- Dollar-flow data pipeline: transactions + receipts → spend graph

### Job + Event Monetization

- Paid job posting (time-limited listing with boost options)
- Paid event promotion (featured placement on city/category pages)

**Dependencies:**

- Phase 2 must be complete
- Stripe Connect onboarding documented and tested
- Legal review of marketplace terms and vendor agreement
- Vendor supply: minimum 50 willing vendors onboarded before marketplace launch

**Estimated duration:** 10–14 weeks after V1 launch

---

## Phase 4 (V3) — Intelligence Layer

**Goal:** The platform becomes smart. AI surfaces the right entity to the right user. The dollar-flow map makes community impact visible.

**New in this phase:**

### AI Agents

- Shopper-side discovery agent: conversational search, contextual recommendations with reasoning
- Business-side Page optimization agent: suggests improvements to descriptions, categories, and CTAs
- Admin + curation agent: surfaces trending entities, flags stale listings, recommends editorial content

### Dollar-Flow Map

- Visual graph of community commerce circulation
- Business/vendor nodes (opt-in)
- Buyer nodes anonymized, shown as flow volume
- City-level and category-level filter
- Embed option for community organizations and media

### Sponsor Campaigns

- Sponsor dashboard: campaign creation, targeting by city/category, budget management
- Campaign placement: sponsored collections, homepage features, email spotlights
- Campaign analytics: impressions, clicks, conversions

### Community Impact Analytics

- Public-facing community impact page (total community spend, top cities, growth over time)
- Downloadable data reports for community organizations and journalists
- Business impact stories (opt-in case studies)

**Dependencies:**

- Phase 3 must be complete with real marketplace transaction data
- Minimum 6 months of receipt + transaction data for flow map to be meaningful
- Anthropic API integration evaluated and budgeted
- Legal review of public-facing spend data (even anonymized)

**Estimated duration:** 12–16 weeks after V2 launch

---

## Phase 5 (V4) — Scale

**Goal:** The platform grows beyond early adopters. Mobile experience is native. Geographic reach expands.

**New in this phase:**

### Mobile App

- iOS app (React Native or Swift)
- Android app
- Push notifications (new reviews, listing updates, community corrections resolved)
- Mobile receipt scanning (enhanced camera capture)

### Expanded Reach

- 25+ cities with meaningful listing density
- Spanish-language support (translation layer for key UI strings)
- International expansion assessment (Caribbean, UK, Canada)

### Platform Hardening

- Advanced moderation tools (AI-assisted flagging, bulk actions)
- Enterprise/partner API (for community organizations, media, data partners)
- White-label or co-branded city guides

**Dependencies:**

- All prior phases live and stable
- Mobile team onboarded or contracted
- Spanish-language content strategy defined

**Estimated duration:** Ongoing

---

## Phase Dependencies Map

```
Phase 0 (Foundation)
    │
    ▼
Phase 1 MVP (Discovery + Pages + Claim/Manage)
    │
    ▼
Phase 2 V1 (Trust + Reviews + Editorial + Monetization)
    │
    ▼
Phase 3 V2 (Marketplace + Receipts + Spend Tracking)
    │
    ▼
Phase 4 V3 (AI + Flow Map + Sponsor Campaigns)
    │
    ▼
Phase 5 V4 (Mobile + Scale + International)
```

Each phase is a gate. A phase is not complete until its acceptance criteria are met by real users, not just internally.

---

## What Moves Phases

A phase moves forward when:

1. All must-have features in the phase are live in production
2. At least one real user has completed the primary workflow end-to-end without assistance
3. No Critical or High severity bugs are open
4. The next phase's planning artifacts (product brief additions, data model changes, API contract additions) are approved

---

## Assumptions

- This roadmap assumes a small team (2–4 engineers + 1 designer + 1 product lead)
- Timeline estimates are for a full-time, focused team — adjust for part-time or parallel workstreams
- Phase 2 monetization is required before Phase 3 to fund marketplace infrastructure investment
- AI features in Phase 4 depend on listing data quality built through Phases 1–3

---

## Open Questions

1. Should Phase 2 include a limited mobile-web optimization pass, or wait for the native app in Phase 5?
2. Should the marketplace launch with physical products only, or also support digital downloads?
3. Is there a version of the dollar-flow map that can launch as a simple aggregate number in Phase 2, with the full graph in Phase 4?
4. Should Phase 2 editorial require a dedicated staff editor, or can it be community-contributed?

---

## Do Not Overbuild Yet

- Do not design Phase 3 marketplace infrastructure until Phase 1 MVP is live with real users
- Do not commit to Phase 4 AI architecture before Phase 2 listing data quality is validated
- Do not plan a mobile app until the responsive web experience has been used and validated by real mobile users
- Do not expand to new cities before Atlanta launch is stable
