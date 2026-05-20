# Ruthless MVP and Release Roadmap — The BLACQList

**Version:** 1.0
**Last updated:** 2026-05-07
**Status:** Execution reference — this is the build order
**Source:** Synthesized from PRD v1.0, product-vision.md, feature-inventory.md
**Owner:** Product + Engineering

This document translates the full platform vision into a concrete, sequenced build path. Every decision here prioritizes shipping something real over building something complete.

---

## Product North Star

**The BLACQList exists to make the Black economy visible, discoverable, and self-reinforcing.**

Every feature decision answers this question: *Does this make it easier to find Black-owned businesses, or easier for Black-owned businesses to be found and trusted?*

If the answer is no — or "sort of, eventually" — it doesn't ship yet.

The platform succeeds when:
- A community member can find a trusted Black-owned option in under 30 seconds
- A business owner can have a presence that outperforms their Google listing in under 20 minutes
- The dollar-flow map becomes a civic data layer — but only after years of real transaction data

---

## What Must Exist for the Product to Feel Like The BLACQList

These are the features that separate the platform from "a list of Black businesses in a database." Every item below is required before public launch. If any of these is missing, the product is a directory, not The BLACQList.

| Feature | Why it's non-negotiable |
|---|---|
| **BLACQList Pages with hero, gallery, about, services, CTA** | Pages are micro-websites. A name + address is a directory. |
| **Server-rendered, SEO-indexable Pages** | If Google can't index the Pages, the platform can't grow organically. |
| **National search with city and category filters** | Discovery must work for any city, not just Atlanta. |
| **Cover image + logo on every listing** | Visual quality is what makes Pages feel premium. A text-only listing defeats the purpose. |
| **Configurable primary CTA (Book / Order / Call / Visit)** | Discovery must lead to action. A Page with no CTA is a dead end. |
| **Claim workflow with admin approval** | Businesses must own their Pages. Unclaimed Pages are lower trust. |
| **Save + share with OG preview** | Saves create retention. Shares create organic growth. OG preview is the social proof unit. |
| **Trust badge (Claimed status visible)** | Even the first tier of trust signal distinguishes the platform from a scraped list. |
| **Admin can create collections** | One curated collection ("Best Atlanta Coffee Shops") makes the platform feel alive, not static. |
| **Analytics event tracking** | Without events firing from day one, there's no data to improve from. |
| **Receipt upload intake (beta, no visualization)** | The flow map needs a data headstart. Seeding starts now even if the display is months away. |
| **Spend events data model** | The flow map architecture must be designed in from the start. Retrofitting it later is expensive. |

---

## MVP Definition

### What MVP means here

The MVP is **production-worthy, not small**. It is the complete discovery and listing experience — search, polished Pages, claim/create/manage, saves, shares, admin, and basic reviews — deployed to real users in a real URL, with real Atlanta seed data.

It is not a prototype. It is not an internal tool. It is a public product.

### MVP is complete when

1. An anonymous user can search for a Black-owned business in Atlanta and find a polished BLACQList Page in under 30 seconds
2. A business owner can claim or create their BLACQList Page in under 15 minutes, without help
3. A logged-in supporter can save and share a listing
4. An admin can review and approve claims from a dashboard
5. At least 150 Atlanta listings, 50 Houston, 50 Chicago are live with full data
6. Every BLACQList Page is server-rendered and indexable by Google
7. No P0 bugs are open at launch

### MVP includes

**Public discovery**
- Homepage: hero, category grid, city spotlight, featured listings (admin-curated)
- City landing pages (auto-generated from listing data)
- Category landing pages (auto-generated)
- City + category combination pages
- SEO metadata on every page (title, description, OG tags)

**Search**
- Full-text keyword search across listing name, description, category, city, tags
- Category filter
- City filter
- Results page with listing cards: name, category, city, primary image, trust badge, save button
- Empty state with suggestions
- Search query logging (admin analytics)

**BLACQList Pages — Business Template**
- Hero: cover image, business name, tagline, primary CTA, trust badge
- About section (description)
- Category + subcategory tags
- Location (full address or service-area indicator)
- Hours of operation
- Contact: phone, email, website
- Social links: Instagram, Facebook, LinkedIn, TikTok, YouTube
- Gallery: up to 12 images
- Services/offerings list with descriptions
- Configurable primary CTA (Book / Order / Call / Message / Visit)
- Save + share buttons (OG preview on share)
- Claimed badge
- Page SEO: server-rendered, unique title/description/OG, canonical URL, sitemap inclusion
- LocalBusiness structured data (JSON-LD)

**Entity submission**
- Multi-step create flow (entity type → basic info → contact → category/city → media → CTA → preview → publish)
- Lightweight community submission form (name, category, city, website/phone)
- Duplicate detection warning before creation

**Claim workflow**
- Search-for-listing → claim → submit verification info (email, phone, optional document upload)
- Admin claim queue: view claims, approve or reject with reason
- Email notifications: claim submitted, claim approved, claim rejected

**Owner dashboard**
- Page view count (7-day, 30-day)
- CTA click count, save count, share count
- Claim status indicator
- Full Page editor (all fields)
- Logo and cover image upload
- Gallery image management (add, reorder, delete)
- Primary CTA configuration
- Preview before publish
- Publish/unpublish control

**User accounts**
- Email + password signup/signin/signout
- Password reset flow
- Email verification
- Basic profile: display name, email
- Role: supporter or business owner

**Supporter saves**
- Save/unsave any listing (logged-in users)
- Saved list view in account dashboard

**Reviews — intake only**
- Review submission form: star rating (1–5) + text body (logged-in users, on claimed listings only)
- Reviews logged and held in admin queue — **not displayed publicly until V1 moderation is live**
- Admin can see incoming review count in dashboard stats

**Admin dashboard**
- All listings view with filters (status, city, category, entity type)
- Claim queue: review pending claims, approve/reject with reason
- Create, edit, delete any listing
- Flag listing (inactive, duplicate, incorrect)
- User management: view, role change, suspend
- Platform stats: total listings, new this week, pending claims, total users

**Verification statuses**
- Unclaimed and Claimed badges rendered on Pages and search cards
- Verified and Certified badges: data model and UI present, but not yet earnable (shown as "coming soon" if inspected)

**Analytics event tracking**
- Page view event fired on every BLACQList Page load
- CTA click event fired on every primary CTA click
- Save event fired on save/unsave
- Search query logged with result count

**Editorial foundation**
- Admin can create a collection (title, description, slug, list of listing IDs)
- Collections publicly viewable at `/collection/[slug]`
- Featured collection slot on homepage (admin-controlled)

**Receipt upload — beta intake**
- Receipt upload form (photo capture from device camera or file upload)
- OCR-suggested business name and category (or manual entry)
- Amount, business, category, date stored in `spend_events` table
- No visualization, no dashboard — data pipeline seeding only

**Flow map — data foundation only**
- `spend_events` table: `(id, user_id, business_id, amount, source, category, date, created_at)`
- No public UI. No visualization.

**SEO/technical**
- Next.js App Router, server-rendered pages
- `sitemap.xml` auto-generated and submitted to Google Search Console
- `robots.txt` configured
- HTTPS enforced
- OG images auto-generated per listing (title + cover image)

---

## Prototype Scope

**Purpose:** Prove the design and data model before committing to full MVP build. De-risk the BLACQList Page template and search quality before seeding data.

**Who builds it:** 1 engineer + 1 designer, 2–3 week sprint.

**What it includes:**
- 10–20 manually seeded Atlanta listings (hardcoded or via direct DB insert)
- BLACQList Page template (business only) — static, no auth, no editor
- Search by keyword + category filter (no city filter yet)
- Search results page
- Share link + OG preview working

**What it does NOT include:**
- Auth of any kind
- Claim or create flows
- Admin dashboard
- Save functionality
- Any backend API — can use static/mock data

**Prototype is done when:** 3 non-team users look at a BLACQList Page and say it looks better than a Google Business listing.

**Then:** Prototype is discarded. MVP is built fresh on production infrastructure. The prototype is a design proof, not the codebase.

---

## MVP Scope

*See full MVP definition above. Summary:*

Discovery + search + BLACQList Pages (business) + create/claim/manage + auth + saves + reviews (intake only) + admin + editorial collections foundation + analytics events + receipt beta + spend_events data model.

**Timeline estimate:** 6–10 weeks of focused engineering from a team of 2–3 engineers.

**Launch criteria:**
- 150+ Atlanta listings, 50+ Houston, 50+ Chicago live with complete data
- 40%+ of listings have at least one image
- All Pages server-rendered and indexed
- Zero P0 bugs
- Privacy Policy + Terms of Service published

---

## Beta Scope

**When:** 4–8 weeks after MVP public launch. Invite-only for early adopters and willing business owners.

**Purpose:** Validate V1 features with real users before full rollout. Not a separate deployment — Beta features are behind feature flags on the production URL.

**What gets added in Beta:**

- **Reviews display (moderated):** Reviews submitted during MVP are now visible after admin approval. Admin moderation queue is live.
- **Professional Page template:** Available to beta users. Not yet broadly surfaced in search.
- **Creative Page template:** Available to beta users.
- **Event Page template:** Available to beta users. Auto-expiry working.
- **Job listing template:** Available to beta users. Auto-expiry working.
- **Basic trust verification intake:** Verified badge document upload form available. Admin review queue live.
- **Community corrections (beta):** Flag-incorrect-info button live on BLACQList Pages. Admin correction queue live.
- **Supporter dashboard:** Recently viewed, suggested businesses based on saved categories.

**Beta is done when:** Each Beta feature has been used by at least 5 non-team users without critical bugs.

---

## V1 Scope

**When:** 8–12 weeks after MVP launch (incorporating Beta learnings).

**Theme:** Trust & Grow — the platform earns community trust and starts earning revenue.

**What V1 adds:**

**Trust system (full)**
- Verified badge: full document upload + admin review + email approval flow
- BLACQList Certified badge: auto-granted when: verified + 6+ approved reviews + 4.0+ average + active 90 days
- Community corrections: fully live, admin queue with resolution email to reporter

**Reviews (full)**
- Reviews publicly displayed on BLACQList Pages (post-moderation)
- Star average shown on search result cards
- Business owner can respond to reviews from dashboard
- Flag-a-review flow live

**Additional Page templates (full)**
- Professional Page template
- Creative Page template
- Event Page template (with auto-archive)
- Job listing template (with auto-expiry)

**Editorial CMS**
- Admin-created BLACQLight articles (rich text, linked to BLACQList Pages)
- Full collections (title, editorial intro, featured listings)
- Homepage editorial carousel
- City guide foundation (admin can create city guide pages)

**Business owner analytics (enhanced)**
- 30-day and 90-day trend charts for views, clicks, saves
- Search impression count
- Review count and average in dashboard

**Platform analytics (admin)**
- Listings by city, category, entity type, trust status
- Claim resolution time averages
- Search query breakdown (top 50 searches)
- Active business owners count

**Supporter experience (enhanced)**
- Supporter dashboard: saved list, recently viewed, suggested businesses

**Monetization (initial)**
- Listing tiers defined and gated: Free / Standard / Premium
- Stripe subscription integration for tier upgrades
- Sponsored placement: featured slots in search results (city/category pages), clearly labeled "Sponsored"
- Homepage featured slot (admin-assigned, manual sales)

**V1 is done when:**
- 50+ businesses have paid for a listing tier upgrade
- Reviews are live, moderated, and displaying on Pages
- At least 3 sponsored placements are live
- All four non-business Page templates are in use by real users

---

## V1.5 Scope

**When:** 4–6 weeks after V1.

**Theme:** Monetization Hardening — revenue flows are self-serve and reliable.

**What V1.5 adds:**

- **Stripe Customer Portal** for business owners to manage, upgrade, downgrade, or cancel subscriptions
- **Sponsored placement self-serve** (basic): business owners on Premium tier can self-select a sponsored slot from available inventory
- **Job posting fees:** 30-day job listing is free; paid options for featured placement and extended duration
- **Event promotion fees:** Basic event listing free; paid for featured city/category placement
- **Refund and cancellation handling** for paid tiers (automated via Stripe webhooks)
- **Subscription analytics** for admin: MRR, churn, tier distribution

**V1.5 is done when:** At least 80% of paid listings are self-serve (not manually handled by the team).

---

## V2 Scope

**When:** 10–14 weeks after V1.5.

**Theme:** Commerce Layer — the platform becomes transactional, not just directional.

**What V2 adds:**

**Marketplace**
- Vendor storefront on BLACQList Page (product grid, product detail, shipping info, return policy)
- Cart and checkout (Stripe)
- Order confirmation emails to buyer + vendor
- Vendor order management dashboard
- Stripe Connect payout setup and onboarding
- Platform transaction fee (8–12%)
- Buyer order history
- Refund and dispute resolution flow
- Vendor analytics (sales, revenue, top products)

**Receipt upload (full)**
- Full receipt upload flow: camera capture → OCR → category confirm → logged
- Personal spend dashboard: total spend, by category, by month
- Community spend aggregate: total $ tracked, by city, by category (anonymized)
- Community spend summary number visible publicly

**AI agents (beta)**
- Business Page optimization agent: reviews listing, suggests description improvements, category fixes, CTA configuration — owner-triggered only
- AI conversational discovery: beta access for early adopters, clearly labeled "beta"

**Editorial expansion**
- City guides (full): admin-created, category-organized, city-specific
- Contributor system: trusted community writers can submit BLACQLight articles for editorial review

**V2 is done when:**
- 50+ vendors have active storefronts with purchasable products
- $10K+ in total marketplace GMV has been processed
- 200+ users have used the receipt upload flow
- Community spend aggregate shows real community data

---

## V3 and Beyond (Summary)

| Release | Focus |
|---|---|
| **V3** | Full interactive dollar-flow map. Full AI concierge (public). Admin/curator AI agent. Sponsor campaign self-serve dashboard. Community impact analytics (public-facing). |
| **V4** | iOS and Android native app. 25+ city depth. Spanish-language support. International expansion assessment. Enterprise/partner API. |

V3 begins only after V2 has 6+ months of spend data for the flow map to be meaningful.

---

## Do-Not-Build-Yet List

These are explicitly off the table until the phase they belong to. Any team member proposing to add these earlier must document the justification in writing and get product lead sign-off.

| Feature | Blocked until | Reason |
|---|---|---|
| Marketplace cart + checkout | V2 | Requires vendor supply, Stripe Connect legal review, KYC |
| Stripe Connect vendor payouts | V2 | Compliance and legal; premature before vendor onboarding |
| AI conversational discovery (full) | V2 (beta) | Needs listing data quality to be high; bad AI is worse than no AI |
| AI Page optimization suggestions | V2 | Same data quality dependency |
| Full dollar-flow map visualization | V3 | Needs 6+ months of real transaction data |
| Sponsor campaign self-serve dashboard | V3 | Sponsorships are manual until V1.5 proves the channel |
| Advanced personalized recommendations | V2 | No behavioral data exists until post-MVP |
| iOS / Android native app | V4 | Validate responsive web; native is expensive and premature |
| Automated trust verification | V3 | Manual first; automation after process is proven |
| Multi-city editorial automation | V2 | Manual editorial must prove its value first |
| Recurring events | V2 | Single events first; scheduling logic adds complexity |
| On-platform job applications | V3 | Apply-link off-platform is sufficient through V2 |
| Community forums / message boards | Never (current vision) | Not a social network |
| B2B procurement directory | Future | Different product category, no confirmed demand |
| International listings | V4 | US-first; international requires separate localization strategy |
| Complex multi-tenancy / white-label | Future | No confirmed business case at this stage |
| Named save lists | Beta | Basic saved list is sufficient at MVP |
| Follow a business / notifications | V1 | Needs email infrastructure to be reliable first |
| "Near me" geo search | V2 | Requires maps API integration; city filter is sufficient at MVP |
| Search saved filters / alerts | V2 | Not in the primary MVP workflow |
| Spend milestone gamification | V3 | Needs spend data volume first |
| Dollar-flow embed for external sites | V3 | Depends on the flow map visualization existing |
| Community vouching / endorsements | V3 | Trust tiers are sufficient; vouching adds fraud surface |
| Portfolio video embeds | V1 | Images-only at MVP; video embed is a V1 enhancement |

---

## Manual First, Automated Later

These workflows should be executed manually by the team at launch. Build automation only after the manual process is stable and the volume justifies it.

| Workflow | Manual process | When to automate |
|---|---|---|
| **Trust verification** | Admin reviews submitted documents by email/dashboard, grants badge manually | V3: AI pre-screening + Secretary of State API |
| **BLACQList Page creation for seed data** | Team manually creates or imports seed listings via admin dashboard or CSV import script | V2: Self-service bulk import for organizations |
| **Sponsored placements** | Sales team sells sponsor packages; admin manually applies featured placement in dashboard | V1.5: Self-serve sponsored placement selector |
| **Editorial collections** | Admin manually selects listings and writes collection descriptions in dashboard | V2: AI-assisted collection suggestions |
| **City guides** | Team writes city guides manually in the editorial CMS | V2: Contributor system |
| **Receipt review and correction** | Admin spot-checks incoming receipt data for accuracy | V2: AI-assisted OCR confidence scoring |
| **AI page optimization suggestions** | Team reviews listing quality and sends manual suggestions via email at MVP | V2: In-dashboard AI agent |
| **Marketplace transactions** | Not live until V2; vendors link to external Shopify/Etsy via CTA | V2: Stripe Connect |
| **Sponsor reporting** | Team sends manual PDF or Google Data Studio report to sponsors | V3: Sponsor dashboard |
| **Claim fraud review** | Admin manually flags suspicious claims based on verification info | V3: Pattern-matching fraud detection |

---

## Mock First, Real Later

These features will exist in the product at MVP/V1 as design placeholders or stubs. Replace with real implementations when the phase arrives.

| Feature | What the mock looks like | Real implementation phase |
|---|---|---|
| **AI concierge / discovery** | A search bar with copy "AI Search — coming soon" (not a dead feature, a teaser) | V2 (beta) |
| **Full dollar-flow map visualization** | A static illustration on the homepage: "The flow map is coming. Your spend data is already counting." | V3 |
| **Marketplace checkout** | Vendor BLACQList Pages link to an external Shopify/Etsy URL via the primary CTA | V2 |
| **Advanced recommendations** | "More in [category] in [city]" — a simple same-category/city query, no ML | V2 |
| **Sponsor analytics dashboard** | Manual PDF report; no dashboard UI | V3 |
| **Automated trust verification** | Manual admin document review; no third-party API | V3 |
| **Verified + Certified badges** | Badges rendered in UI with "Earn this badge" info link; not yet earnable | V1 |
| **AI Page quality score** | A completion progress bar based on field fill-rate (not AI) | V2 (real AI) |
| **Community spend aggregate display** | Counter shows "0 receipts tracked so far — be first" with upload CTA | V2 (real data) |
| **Named save lists** | Single saved list only; list name is "Saved" | Beta (named lists) |
| **Review display** | Reviews submitted but not displayed; a counter says "X reviews pending" (trust signal in itself) | V1 (full display) |

---

## Release Sequence

| Phase | User-facing value | Major features | Required data | Required UI | Required backend | Key risks | Done means |
|---|---|---|---|---|---|---|---|
| **Prototype** | BLACQList Pages look premium | 10–20 seed listings, business Page template, basic search | Manually entered listings | Page template, search results, homepage shell | Static/mock — no real backend required | Design validation fails; Page template doesn't feel premium | 3 non-team users say the Page beats Google |
| **MVP** | Find, trust, and share Black-owned businesses nationally | Discovery, search, Pages, claim, create, owner dashboard, admin, saves, reviews intake, editorial collections, receipt beta | 150+ ATL, 50+ HOU, 50+ CHI listings; 40% with images | Homepage, search, city/category pages, BLACQList Page, create flow, claim flow, owner dashboard, admin dashboard, auth | Listings CRUD, search (PG FTS), auth (Supabase), media upload, claim queue, analytics events, spend_events schema | Search quality too low; seed data thin; claim volume overwhelms admin | 500 unique searches, 50 saves, 50 owner claims within 60 days |
| **Beta** | Trust signals and more entity types | Reviews display (moderated), Professional/Creative/Event/Job templates, basic verified badge intake, community corrections | Reviews from MVP queue; 20+ professionals/creatives willing to claim | New page templates, review display, correction flag UI | Review moderation queue, correction queue, verification document queue | Review quality low; moderation bottleneck | Each Beta feature used by 5+ real users without critical bugs |
| **V1** | A trusted, commercially growing platform | Full reviews, full trust tiers, editorial CMS, BLACQLight articles, enhanced analytics, listing tiers, sponsored placements | 500+ total listings; 50+ reviewed businesses; sponsor willing to pay | Review display (with responses), editorial CMS, tier upgrade UI, analytics charts, sponsored placement labels | Stripe subscriptions, review moderation, editorial page rendering, analytics aggregates, sponsor placement injection | Stripe webhook failures; moderation queue backlog; low tier conversion | 50+ paid tier upgrades; 3+ active sponsor placements |
| **V1.5** | Self-serve revenue flows | Stripe Customer Portal, self-serve sponsored placements, job/event fees, refund handling | N/A | Self-serve sponsor placement selector, job/event fee gates | Stripe Customer Portal integration, webhook handlers for upgrades/cancellations, job/event fee logic | Stripe webhook edge cases; refund policy disputes | 80%+ of paid subscriptions self-managed without team intervention |
| **V2** | Buy, not just discover | Marketplace checkout, vendor storefronts, full receipt upload + spend dashboard, AI Page optimization (beta), AI discovery (beta) | 50+ willing vendors; $10K+ GMV target; 200+ receipt uploads | Vendor storefront, product pages, cart, checkout, spend dashboard, AI suggestion UI | Stripe Connect, order management, OCR pipeline, spend aggregate queries, AI API calls | Stripe Connect KYC friction; marketplace cold start; AI result quality | $10K+ GMV; 50 vendor storefronts; 200 receipts uploaded |
| **V3** | Visible economic impact | Full dollar-flow map, full AI concierge, sponsor campaign dashboard, community impact analytics | 6+ months of spend data; 500+ contributing community members; business opt-in campaign | Interactive flow map visualization, AI chat UI, sponsor campaign UI, impact analytics page | Graph data pipeline, flow map rendering (D3/React Flow), campaign analytics | Sparse flow map with low opt-in; AI concierge quality; privacy legal review | Flow map shows 100+ business nodes; AI concierge used by 100+ users/month |
| **V4+** | Platform scale | Mobile app, 25+ cities, Spanish language, partner API | 25+ cities with meaningful listing density | iOS/Android apps, language toggle | Native app infrastructure, localization, partner API | Mobile dev cost; city supply in new markets | Native app launched; 25+ cities with 100+ listings each |

---

## First 25 Dev Tickets

These are ordered for sequential delivery. Each ticket builds on the one before it. This is the literal ticket backlog for the MVP sprint.

| # | Ticket | Depends on | Output |
|---|---|---|---|
| 1 | **Project setup** — Next.js 14, TypeScript, Tailwind, shadcn/ui, ESLint, Prettier, Vercel deploy pipeline, `.env.example` | — | Working local dev environment; preview deploys on PR |
| 2 | **Supabase initialization** — Create project, enable RLS globally, configure Storage buckets (listing-media, verification-docs, receipts), set env vars | Ticket 1 | Supabase project live; buckets created; env vars documented |
| 3 | **Base database schema** — `users`, `categories`, `cities`, `listings` (base), `listing_details_business`, `media_attachments`, `saves`, `claims`, `reviews`, `spend_events`, `collections` tables with RLS policies | Ticket 2 | All tables migrated; RLS enabled; indexes created |
| 4 | **Auth flows** — Supabase Auth: email signup, signin, signout, password reset, email verification, middleware for protected routes, session refresh | Ticket 3 | Users can sign up, sign in, sign out, and reset password |
| 5 | **User profile + roles** — `user_roles` table, role assignment on signup (supporter default), admin role seeding, role-based middleware | Ticket 4 | Roles assigned; admin route protection working |
| 6 | **Categories + cities seed data** — Top-level category taxonomy (20–30 categories), seed cities (Atlanta, Houston, Chicago + metro data), slug generation | Ticket 3 | Categories and cities populated; slugs generated |
| 7 | **Listing CRUD API** — Server actions or route handlers for: create listing, get listing by slug, update listing, delete listing, list listings with filters (category, city, status, entity type) | Ticket 3 | CRUD endpoints functional; RLS enforced |
| 8 | **Full-text search endpoint** — PostgreSQL `tsvector` column on listings, `GIN` index, `pg_trgm` extension, search API with keyword + category + city filters, result ranking | Tickets 3, 7 | Search returns relevant results in <1.5s |
| 9 | **BLACQList Page — business template** — Server-rendered route at `/listing/[slug]`, all business Page sections (hero, about, services, gallery, contact, social, CTA, trust badge), OG meta, LocalBusiness JSON-LD | Tickets 7, 6 | Individual listing Pages render correctly; server-rendered; indexed |
| 10 | **Homepage** — Hero, category grid, city spotlight section, featured listings carousel (admin-curated, seeded), editorial collection teaser, SEO metadata | Tickets 8, 9, 6 | Homepage renders; navigation works; featured listings display |
| 11 | **Search results page** — `/search` route, search form with keyword + category + city filters, listing cards grid, empty state, loading state | Ticket 8, 9 | Search results page functional end-to-end |
| 12 | **City + category landing pages** — Auto-generated `/[city]` and `/[city]/[category]` routes from database, top listings per page, SEO metadata, sitemap inclusion | Tickets 7, 11, 6 | City and category pages generated; SEO metadata correct |
| 13 | **Image upload** — Supabase Storage upload for logo, cover image, gallery images; file type + size validation (server-side); image served via CDN URL; Next.js Image component | Ticket 2 | Images upload and display on BLACQList Pages |
| 14 | **Listing create flow** — Multi-step form: entity type → basic info → contact → category/city → media upload → CTA config → preview → publish; duplicate detection warning | Tickets 4, 7, 13 | Business owner can create a new listing end-to-end |
| 15 | **Claim flow** — Search for existing listing → claim form (email, phone, optional document upload) → claim record created in pending state → claim submitted email | Tickets 4, 7, 13 | Business owner can submit a claim request |
| 16 | **Admin claim queue** — Admin dashboard section: list pending claims with verification info, approve (owner notified + dashboard access granted) or reject (owner notified with reason) | Tickets 5, 15 | Admin can review and action all pending claims |
| 17 | **Owner dashboard** — Protected `/dashboard` route for business owners: Page view/save/click stats (last 7/30 days), Page editor (all fields), CTA config, logo/cover/gallery management, publish controls, claim status | Tickets 4, 5, 7, 13, 16 | Business owner has full control of their Page |
| 18 | **Admin dashboard — listings management** — `/admin` protected route: listings table with filters (status, city, category), create/edit/delete any listing, flag controls, platform stats (totals, pending claims count) | Tickets 5, 7 | Admin can manage all listings from one view |
| 19 | **Saves** — Save/unsave button on listing cards and BLACQList Pages (logged-in users only); saves stored in `saves` table; save count visible to business owner in dashboard; saved list view in supporter account | Tickets 4, 7 | Logged-in users can save and unsave; saved list renders |
| 20 | **Analytics event tracking** — Fire page_view, cta_click, save, search_query events to a lightweight analytics table or PostHog; business owner dashboard reads from aggregated event data | Tickets 7, 17 | Events fire correctly; counts appear in owner dashboard |
| 21 | **Email notifications** — Claim submitted confirmation, claim approved, claim rejected (with reason); use Resend with React Email templates; branded from address | Ticket 16 | All 3 claim emails send and render correctly |
| 22 | **Reviews intake** — Review submission form (star + text, logged-in users, claimed listings only); review stored in `reviews` table with `status: pending`; not displayed publicly; admin can see review count | Tickets 4, 7 | Reviews submitted and stored; admin sees count; no public display yet |
| 23 | **Editorial collections** — Admin can create a collection (title, slug, description, list of listing IDs); public `/collection/[slug]` route renders collection with listing cards; featured collection shown on homepage | Tickets 7, 18 | Admin can create collections; public collection pages render |
| 24 | **Receipt upload — beta intake** — Receipt upload form (camera/file, optional OCR business name suggestion, manual amount + category + date entry); stored in `spend_events` table; no public visualization | Tickets 4, 3 | Users can submit receipts; data stored in spend_events |
| 25 | **SEO + sitemap** — Auto-generated `sitemap.xml` covering all listing slugs, city pages, category pages, collection pages; `robots.txt`; structured data (JSON-LD) on all listing Pages; OG image generation | Tickets 9, 12, 23 | Sitemap valid and submitted; all Pages have complete SEO |

---

## Next Recommended Prompt

With this roadmap document complete, the recommended next action is the data model — it unblocks tickets 3, 7, 8, and everything that follows.

Run this next:

```
Act as the Schema Data agent.

Read:
- docs/blacqlist/product/ruthless-mvp-and-roadmap.md
- docs/blacqlist/product/PRD.md

Create the data model for The BLACQList MVP at:
docs/blacqlist/data/data-model.md

Include every table required for the first 25 dev tickets:
- users
- user_roles
- listings (base)
- listing_details_business
- categories
- cities
- claims
- media_attachments
- saves
- reviews
- collections
- collection_listings (junction)
- spend_events
- analytics_events

For each table, define:
- all columns with types, nullability, defaults, and constraints
- primary key strategy (UUID)
- foreign keys with ON DELETE behavior
- indexes
- RLS policy summary
- audit fields (created_at, updated_at, created_by where relevant)

Include a relationship diagram in text (not Mermaid).
Include migration order (which tables must exist before others).
Do not write migration SQL yet — just the design document.
```
