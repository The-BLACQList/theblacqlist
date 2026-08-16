# The BLACQList — Product Requirements Document

**Version:** 1.0
**Last updated:** 2026-05-07
**Status:** Source of truth — supersedes all prior product notes and scoping docs
**Owner:** Product
**Audience:** Engineering, Design, QA, Investors, Team

---

## Product Summary

The BLACQList is a national Black discovery, marketplace, and community commerce platform. It gives Black-owned businesses, professionals, creatives, events, jobs, and vendors a polished, purpose-built digital presence — and gives the community a trusted, searchable, action-oriented platform to find them, support them, and track the economic impact of that support.

Unlike a basic business directory, The BLACQList presents every listed entity through a **BLACQList Page** — a templated, micro-website-quality profile with a story, trust signals, community validation, rich media, and a clear path to action. Unlike a generic marketplace, it is built around cultural identity, community accountability, and visible economic circulation.

The long-term differentiator is the **dollar-flow map** — a visual network that shows how community dollars circulate through Black-owned businesses, vendors, creatives, and events — making the Black economy visible in a way no platform has done before.

**Taglines:**

> Find & Be Found.
> Find what you need. Support who matters. Keep the dollar moving.

**Brand positioning:**

> Atlanta-born. National from day one. Community-powered everywhere.

---

## Positioning Statement

**For** Black consumers, allies, and community members who want to intentionally discover, support, and transact with Black-owned businesses, professionals, creatives, and events —

**The BLACQList** is a national discovery and community commerce platform

**that** makes it easy to find, trust, and act with Black-owned entities in every city, through polished BLACQList Pages that function like purpose-built micro-websites —

**unlike** generic business directories, social media, or fragmented local apps,

**The BLACQList** combines trust verification, community validation, a connected marketplace, and a dollar-flow map that makes the economic power of the Black community visible and self-reinforcing.

---

## Problem Statement

### The Discovery Gap

When someone wants to support a Black-owned business, they face a fragmented landscape. Word-of-mouth is the primary channel, but it doesn't scale beyond your immediate network. Google returns results with no community context. Social media surfaces content, not commercial intent. Existing Black business directories are sparse, outdated, or limited to a single city. There is no nationally trusted, community-maintained discovery layer that meets the moment of commercial intent.

**Result:** Dollars leave the community not by choice, but by default.

### The Representation Gap

When a Black-owned business wants to be found online, the tools they're given were built for everyone and optimized for no one. A Google Business profile looks the same for a Fortune 500 chain as it does for a third-generation family restaurant. A Yelp listing reduces a creative atelier to a star rating. Instagram demands constant content production just to maintain visibility. No platform is purpose-built to let a Black-owned business look the way it deserves to look — with its full story, trust signals, offerings, gallery, and community standing in one polished, searchable Page.

**Result:** Black businesses are underrepresented in digital discovery relative to their real presence, quality, and community importance.

### The Trust Gap

Even when a Black-owned business is found, trust verification is missing. Is this business still open? Is it actually Black-owned? Has the community vouched for it? Basic search results provide no answer. Reviews exist but are uncontextualized. There is no graduated trust signal — no equivalent of a Michelin star, a verified badge, or a community endorsement that means something specifically in this context.

**Result:** Discovery doesn't convert to action as reliably as it should.

### The Impact Gap

The Black dollar recirculates within the Black community at a historically low rate — estimated at 6 hours compared to weeks or months in other communities. Part of this is structural. Part of it is that the circulation is invisible — there is no aggregate, real-time view of community spend that makes the economic power of collective action visible, measurable, and motivating.

**Result:** Community economic power exists but is uncharted and unmeasured, limiting civic narrative, policy advocacy, and community pride.

### What The BLACQList Closes

| Gap                | What the platform does                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| Discovery gap      | National, city-aware, category-aware search with community context        |
| Representation gap | BLACQList Pages — micro-website quality for every listed entity           |
| Trust gap          | Graduated verification, community corrections, reviews, endorsements      |
| Impact gap         | Receipt uploads + marketplace transactions feed a visible dollar-flow map |

---

## Product Vision

The BLACQList is the place where the Black economy is visible, discoverable, and self-reinforcing.

In five years: any person anywhere in the country opens The BLACQList, searches for what they need, and finds a verified, polished, trusted Black-owned option in under 30 seconds. A business owner spends 20 minutes setting up their BLACQList Page and immediately has a digital presence that outperforms a $500 website. A community can see, in aggregate, how much money is circulating through Black-owned businesses in their city — and that number grows every quarter. The platform does not need to seed listings because the community maintains and expands them. The dollar-flow map becomes a civic data layer cited by journalists, policymakers, and community organizations.

---

## Product Mission

To make it radically easier to find, trust, and support Black-owned businesses, professionals, creatives, and events — and to make the economic impact of that support visible, measurable, and growing.

---

## Non-Negotiable Product Principles

These are decision filters. When a feature, design choice, or trade-off is unclear, these are the tiebreakers.

### 1. Not a basic directory

Every listed entity gets a **BLACQList Page** — not a database row, not a name-and-phone card. Pages have story, media, trust signals, community context, and a clear path to action. If a feature makes the platform feel like a directory, it is the wrong feature.

### 2. BLACQList Pages are micro-websites

Each Page template is purpose-built per entity type. A business Page has a hero, about section, services, gallery, hours, contact, social links, and trust badges. A professional Page has credentials, portfolio, and a consultation CTA. A creative Page has a portfolio gallery and booking link. Pages are shareable, indexable, and designed to outperform a generic Google Business listing on every dimension.

### 3. National search by default

The BLACQList is a national platform from day one. Search, infrastructure, and URL design must support any city without per-city engineering work. Atlanta is the depth anchor at launch. No feature should be built that only works in one city.

### 4. City-aware discovery

While the platform is national, discovery is city-contextual. City landing pages, city-filtered search, city-level editorial, and city-level spend aggregates are all first-class. Users searching in Atlanta get Atlanta depth. Users in Houston get Houston results — and that experience improves as the platform grows there.

### 5. Marketplace and directory are connected

The discovery layer and the commerce layer are the same surface. A user who finds a candle brand in search should be able to browse their Page, read reviews, and buy — without leaving the platform or switching modes. Vendor storefronts live on BLACQList Pages, not in a separate marketplace section.

### 6. Trust and verification are core

Not every listing is equal. A claimed, verified, community-reviewed listing looks and feels different from an unclaimed one. Trust is graduated: unclaimed → claimed → verified → BLACQList Certified. Trust signals are visible on every Page and in search results. Verification is not instant — it requires human review and documentation. This is a feature, not a limitation.

### 7. The flow map is the long-term differentiator

The dollar-flow map — showing how money circulates through the Black community economy via marketplace purchases and receipt uploads — is unlike anything any competitor has or is building. It takes time and data to build. It should be designed into the data model from day one, even if the visualization ships in V3. No other platform can replicate this without the same years of community transaction data.

### 8. AI supports discovery, growth, curation, and community impact

The AI layer is not a search bar upgrade. It is a culturally-fluent concierge that understands commercial intent, community context, and business needs. On the shopper side: it surfaces the right entity with reasoning. On the business side: it optimizes Pages, suggests improvements, and identifies growth opportunities. On the admin/curator side: it surfaces trending content, flags stale listings, and recommends editorial. AI features ship only when listing data quality is high enough to produce consistently good results.

---

## Target Users

---

### 1. Explorer

**Who:** Someone with general curiosity about Black-owned options — not urgently buying, browsing by city, category, or curiosity. Likely first-time visitor.

**Goals:** Discover what exists. Learn about businesses they didn't know about. Share interesting finds.

**Pains:**

- Has no reliable starting point for Black-owned discovery
- Existing results are generic and lack community context
- Can't tell which businesses are still open or worth visiting

**Key workflows:**

- Browse homepage → click city or category → scan results → share a Page
- Click a shared link → view BLACQList Page → click CTA or save

**MVP needs:** Homepage with category/city entry points. Browsable results. Shareable Pages with good OG previews.

**Later needs:** Personalized recommendations. Curated editorial. "Trending near you."

---

### 2. Supporter

**Who:** Logged-in community member with intentional commitment to supporting Black-owned businesses. Regular platform user.

**Goals:** Build a reliable shortlist of trusted businesses. Track their support. Share with friends and family.

**Pains:**

- Bookmarks and mental lists don't scale
- No single place to track all Black-owned businesses they've used
- No way to share a curated list with someone asking for recommendations

**Key workflows:**

- Search → find listing → save to personal list
- Open saved list → visit or share
- Browse editorial collections → discover new saves
- Write a review after a visit

**MVP needs:** Account. Save any listing. View saved list. Share a listing.

**Later needs:** Named save lists (e.g., "Restaurants," "Gifting"). Follow a business. See updates from followed businesses.

---

### 3. Buyer

**Who:** User with active purchase intent — looking for a specific product, service, or booking right now.

**Goals:** Find, evaluate, and purchase from a Black-owned business with minimum friction. Confirm quality before buying.

**Pains:**

- High-intent search returns generic results with no trust context
- Hard to tell if a business offers what they need without calling
- Checkout from multiple platforms is fragmented

**Key workflows:**

- Search by product/service type + city → view BLACQList Page → click CTA (book/order/call)
- Browse marketplace → add to cart → check out (V2)
- View reviews → decide to buy → complete transaction

**MVP needs:** Search that returns relevant results. BLACQList Pages with clear CTAs. Reviews.

**Later needs:** Marketplace checkout. Order tracking. Receipt confirmation for spend tracking.

---

### 4. Business Owner

**Who:** Owner or authorized representative of a Black-owned business. May have an existing web presence or social media. Varies widely in technical sophistication.

**Goals:** Get found. Look better online than on any other platform. Drive bookings, calls, or walk-ins. Build trust with new customers.

**Pains:**

- Google Business profile looks identical to a national chain
- Yelp reduces them to a star rating
- Building and maintaining a website takes time and money they don't have
- No platform specifically built for their community context

**Key workflows:**

- Claim existing listing → complete Page → publish
- Create new listing → fill Page → publish
- Log in → update hours, add a service, change CTA
- View analytics → see how many people viewed/clicked/saved
- Respond to reviews

**MVP needs:** Claim flow. Create flow. Full Page editor. Logo and cover image upload. Primary CTA. Basic dashboard (views, saves, CTA clicks). Email notification on claim status.

**Later needs:** Analytics trends. AI description suggestions. Review management. Listing tier upgrades. Verification badge.

---

### 5. Professional

**Who:** Individual service provider — attorney, therapist, coach, financial advisor, consultant, personal trainer, etc.

**Goals:** Establish credibility. Be discoverable by people who need their specific expertise. Drive consultation requests or bookings.

**Pains:**

- LinkedIn is not a discovery platform for community-specific services
- Google results are dominated by large firms, not solo practitioners
- Credentials and community context are invisible in generic search

**Key workflows:**

- Create Professional Page → add credentials, services, portfolio → publish
- Update availability or service offerings
- Review consultation requests or analytics

**MVP needs:** Professional Page template with credentials, services, bio, and booking CTA. (Can use business template at MVP if professional template is not ready.)

**Later needs:** Portfolio gallery. Client testimonials as a distinct testimonial type (vs. general reviews). Verified credential badges (bar admission, certifications, etc.).

---

### 6. Creative

**Who:** Visual artist, photographer, musician, designer, filmmaker, author, performer, or other creative practitioner.

**Goals:** Showcase work. Be discoverable for commissions, bookings, collaborations. Drive traffic to their portfolio or booking link.

**Pains:**

- Instagram is great for visibility but not for discovery with commercial intent
- Portfolio sites require maintenance and don't surface in community-specific searches
- Booking and commission flows are scattered across DMs, email, and third-party tools

**Key workflows:**

- Create Creative Page → upload portfolio → add booking link → publish
- Add new work → share Page → monitor analytics
- Appear in event searches (as a performer or vendor)

**MVP needs:** Creative Page template (or business template at MVP) with portfolio, bio, medium/genre, and booking CTA.

**Later needs:** Rich portfolio gallery with video embeds. Event appearance linkage. Commission request intake (V2).

---

### 7. Vendor / Seller

**Who:** Business owner who sells physical or digital products and wants to transact through The BLACQList marketplace.

**Goals:** Sell products to an engaged community of buyers. Build a community-trusted storefront. Reach customers who are actively looking to support Black-owned sellers.

**Pains:**

- Etsy and Shopify are crowded and lack community context
- Maintaining a separate e-commerce site is expensive and time-consuming
- Marketplace platforms take large cuts without providing community value

**Key workflows:**

- Upgrade Business Page to vendor storefront → connect Stripe → add products → go live
- Receive order notification → fulfill → mark shipped
- View vendor analytics → see revenue, top products, pending orders

**MVP needs:** Vendor storefront designation on Business Page. Product listing cards visible on the Page. (Actual checkout is V2.)

**Later needs:** Full cart and checkout. Stripe Connect payout. Order management dashboard. Inventory tracking. Product reviews.

---

### 8. Event Organizer

**Who:** Individual, business, or community organization hosting a ticketed or free event.

**Goals:** Drive attendance. Reach the community beyond their existing network. Sell tickets or collect RSVPs.

**Pains:**

- Eventbrite is generic and expensive
- Social media events have low organic reach
- Community event discovery is fragmented across multiple platforms

**Key workflows:**

- Create Event Page → set date, location, ticket link → publish
- Update event details before the date
- View click-through count on ticket link

**MVP needs:** Event Page template (date, location, description, cover, ticket/RSVP link). Auto-archive after event date.

**Later needs:** Recurring event support. Featured event placements (paid). Event reminder emails. Event organizer analytics.

---

### 9. Job Poster

**Who:** Business owner, HR manager, or hiring manager looking for talent from within the Black community.

**Goals:** Post an opportunity. Reach qualified candidates who are aligned with the community and culture of the hiring organization.

**Pains:**

- Indeed and LinkedIn are crowded and expensive
- No existing platform targets specifically the Black professional talent pool
- Job posts go unseen without community distribution

**Key workflows:**

- Create job listing → set description, apply link, deadline → publish
- Edit or remove listing before expiry
- View apply-link click count

**MVP needs:** Job listing template (role, description, company, apply link, deadline). Auto-expiry at deadline.

**Later needs:** Paid job posting fee. Featured placement (paid). On-platform application (V3). Employer branding Page.

---

### 10. Sponsor

**Who:** Brand, organization, or individual investor seeking to reach Black consumers and businesses in a credible, community-aligned way.

**Goals:** Run targeted campaigns that generate real community goodwill and measurable reach. Align brand with The BLACQList's community credibility.

**Pains:**

- Generic ad platforms lack community specificity and credibility
- Sponsorships on other platforms are not performance-measurable at the community level
- Cultural misalignment in advertising undermines brand trust in Black communities

**Key workflows:**

- Submit sponsorship inquiry → receive proposal → approve campaign → review performance
- (V3) Self-serve: create campaign → set budget → target by city/category → launch → view analytics

**MVP needs:** None (sponsor relationship is manual at MVP via direct outreach).

**Later needs:** Self-serve sponsor dashboard. Campaign analytics. City and category targeting. Community collection sponsorships.

---

### 11. Admin

**Who:** Internal team member with elevated platform access. Responsible for listing quality, claim review, trust verification, and community moderation.

**Goals:** Maintain platform integrity. Approve claims quickly. Keep listing data accurate and fresh. Surface quality problems before users encounter them.

**Pains:**

- Moderation at scale requires tooling, not just database access
- Claim fraud is a real risk — bad actors could claim competitors' listings
- Review moderation requires judgment, not just keyword filtering

**Key workflows:**

- Review claim queue → approve or reject with reason
- Review verification documents → grant or deny verified badge
- Edit any listing for accuracy
- Review flagged listings and corrections
- View platform analytics and health metrics

**MVP needs:** Claim queue. Full listing management. Basic platform stats. User management. Role assignment.

**Later needs:** Review moderation queue. Correction queue. Bulk editing. AI-assisted flagging. Advanced analytics. Editorial CMS.

---

### 12. Curator / Editor

**Who:** Internal team member or trusted contributor responsible for editorial content — BLACQLight articles, collections, city guides.

**Goals:** Create compelling editorial content that gives users a reason to engage beyond search. Surface the best of the platform through curation.

**Pains:**

- No CMS exists yet — editorial is manual
- Curated content needs to be linked to real BLACQList Pages (not just text)
- Quality editorial takes time; automation is a V3 concern

**Key workflows:**

- Create collection → select and describe featured listings → publish
- Write BLACQLight article → link to relevant Pages → publish
- Create city guide → organize by category and vibe → publish

**MVP needs:** Minimal admin-side collection creation (can be database-direct at MVP if editorial CMS is not ready).

**Later needs:** Full editorial CMS with scheduled publishing, draft states, and contributor roles.

---

## Core Product Modules

---

### Module 1 — Public Discovery

The entry surface for all users. The homepage and browsable landing pages are the first impression for new users arriving from search engines, social shares, and direct navigation.

**Components:**

- Homepage: hero, category grid, city spotlight, featured entities, editorial teaser
- City landing pages: auto-generated from listing data, SEO-optimized, showing top listings per city
- Category landing pages: auto-generated, SEO-optimized, filterable by city
- Trending sections: most saved, most viewed, newly added

**MVP scope:** Homepage with category/city navigation. City and category landing pages generated from seed data. Featured listing carousel (admin-curated).

**Later:** Personalized homepage based on user history. "Near me" geo detection. Trending algorithm.

---

### Module 2 — Search and Filters

The primary commercial intent surface. Users arrive with something specific in mind — the search experience determines whether they find it.

**Components:**

- Full-text keyword search (name, description, category, city, tags)
- Category filter (top-level + subcategory)
- City / metro filter
- Trust status filter (claimed, verified, certified)
- Entity type filter (business, professional, creative, event, job, vendor)
- Sort options (relevance, recency, rating)
- Results page with listing cards showing: name, category, city, primary image, trust badge, save button
- Empty state with alternate suggestions
- Search analytics (admin view)

**MVP scope:** Keyword search + category filter + city filter + results page. Sort by relevance. Empty state with suggestions.

**Later:** Autocomplete/type-ahead. Geo "near me." Faceted multi-filter. AI-assisted conversational search. Saved searches.

**Technology:** PostgreSQL full-text search with `tsvector` + `pg_trgm` at MVP. Algolia or Typesense at V2 when listing count or search quality demands it.

---

### Module 3 — City / State / Category Pages

SEO-critical discovery entry points that capture organic search traffic from people searching "[category] + [city] + Black-owned."

**Components:**

- `/atlanta` — city landing page with top listings, categories, editorial spotlight
- `/atlanta/restaurants` — city + category landing page
- `/professionals/chicago` — entity type + city
- State-level rollup pages (future)
- Auto-generation from listing data — no manual page creation required
- Page metadata: unique title, description, OG image per page

**MVP scope:** City pages and city+category pages generated automatically from the listing database. SEO metadata on every page. At least 3 launch cities with meaningful density.

**Later:** State-level pages. "Best of [city]" editorial integrations. Map view option.

---

### Module 4 — BLACQList Pages

The core product artifact. Every listed entity gets a Page that functions as a micro-website, not a database record.

**Business Page template (MVP):**

- Hero section: cover image, business name, tagline, primary CTA button, trust badge
- About: description, founding story
- Category + subcategory tags
- Location: address (or service area indicator)
- Hours of operation
- Contact: phone, email, website link
- Social links: Instagram, Facebook, LinkedIn, TikTok, YouTube
- Gallery: up to 12 images
- Services / offerings: list with descriptions
- Primary CTA (owner-configured: Book, Order, Call, Message, Visit)
- Save button (for logged-in users)
- Share button (copy link + social OG preview)
- Claimed / verified / certified badge
- Review summary (V1): star rating average + count
- Review list (V1)
- Related listings (V1): "More in [category] in [city]"

**Professional Page template (V1):**

- Bio, credentials, certifications
- Services with pricing or "contact for pricing"
- Portfolio (images + case study links)
- LinkedIn, portfolio site link
- Consultation/booking CTA

**Creative Page template (V1):**

- Bio, medium/genre/discipline tags
- Portfolio gallery (images + video embed links)
- Booking/commission link
- Event appearances (linked to Event Pages)

**Event Page template (V1):**

- Name, date/time, end time
- Location (address or "Virtual")
- Description, cover image
- Ticket/RSVP link (external at V1)
- Organizer link (to Business or Professional Page)
- Auto-archive after event date

**Job Listing template (V1):**

- Title, company, location (or remote)
- Description, apply link, deadline
- Optional link to employer BLACQList Page
- Auto-expiry at deadline

**Vendor storefront extension (V2):** Product grid, product detail pages, shipping info, return policy.

**Page SEO:** Server-rendered HTML. Unique `<title>`, `<meta description>`, OG tags, canonical URL, sitemap inclusion on every Page.

---

### Module 5 — Entity Submission

How new entities enter the platform — either through a business owner creating their own listing, or through a community member submitting a business they know about.

**Create flow (business owner):**

- Multi-step form: entity type → basic info → contact → category/city → media → CTA → review → publish
- Duplicate detection warning before creation
- Listing enters as unclaimed until ownership is verified

**Community submission flow:**

- Lightweight form: entity name, category, city, website or phone
- Submitted listing is unverified, clearly marked, visible in search
- Admin reviews community submissions before they become full listings (optional queue)

**MVP scope:** Business owner create flow (full). Community submission (simple form, admin queue). Duplicate detection warning.

**Later:** AI-assisted form pre-fill from website URL. Bulk import for business associations and community organizations.

---

### Module 6 — Claim Workflow

How a business owner proves they own an existing unclaimed listing.

**Flow:**

1. Owner searches the platform for their business
2. Selects the listing → clicks "Claim this business"
3. Enters verification info: business name, contact email, business phone or website
4. Optionally uploads a document (business license, utility bill, social media profile link)
5. Claim enters admin review queue
6. Admin approves → listing marked "Claimed," owner gets dashboard access and email confirmation
7. Admin rejects → owner receives rejection email with reason and instructions to resubmit

**Anti-fraud considerations:**

- One claim per listing (subsequent claims trigger admin review of prior claim)
- Email domain matching (if owner email matches website domain, auto-pre-approve for admin confirmation)
- Document upload is optional at MVP, required for Verified badge in V1

**MVP scope:** Full claim flow including admin queue, approval, rejection, and email notifications.

**Later:** Email domain auto-matching. Social media profile verification. Automated pre-screening.

---

### Module 7 — Owner Dashboard

The business owner's control center for managing their BLACQList Page and understanding their performance.

**MVP dashboard:**

- Page preview link
- Claim status indicator (pending / approved / rejected)
- Page view count (last 7 days, last 30 days)
- CTA click count
- Save count
- Share count
- Edit Page button → full Page editor
- Upload logo / cover image
- Add/edit gallery images
- Set primary CTA type and URL
- Preview Page before publishing
- Unpublish Page option

**V1 additions:**

- Analytics: 30-day and 90-day trend charts for views, clicks, saves
- Review management: view reviews, respond to reviews
- Trust status + verification submission
- Listing tier indicator + upgrade CTA
- AI Page optimization suggestions

**V2 additions:**

- Vendor dashboard (orders, revenue, product management) if vendor feature enabled
- Receipt upload from dashboard for off-platform sales

---

### Module 8 — Admin Dashboard

The internal tool for managing platform quality, claim review, content moderation, and operations.

**MVP admin dashboard:**

- All listings view with filters: status (unclaimed, claimed, verified, flagged), city, category, entity type
- Claim queue: pending claims with verification info, approve/reject with reason
- Create / edit / delete any listing
- Flag listing as inactive, duplicate, or incorrect
- User management: view users, change roles, suspend accounts
- Basic platform stats: total listings, new listings this week, pending claims, total users

**V1 additions:**

- Review moderation queue
- Community correction queue
- Trust verification document review
- Editorial CMS for collections and BLACQLight articles
- Platform analytics dashboard (listings by city, by category, by trust status)
- Email log for claim notifications

**V2 additions:**

- Vendor / marketplace order management
- Refund processing
- AI-assisted flagging for stale or suspicious listings
- Bulk listing operations

---

### Module 9 — Verification Workflow

How listed entities move from unclaimed to verified to certified — the trust signal system.

**Trust tiers:**

| Tier                | Badge                 | How achieved                                                                |
| ------------------- | --------------------- | --------------------------------------------------------------------------- |
| Unclaimed           | No badge              | Community-submitted; no owner action taken                                  |
| Claimed             | Blue claimed badge    | Owner submitted claim; admin approved                                       |
| Verified            | Gold verified badge   | Owner submitted documents; admin reviewed                                   |
| BLACQList Certified | Amber certified badge | Highest tier; criteria include: verified + 6+ reviews + active for 90+ days |

**Verified tier requirements (V1):**

- Business must be claimed
- Owner uploads: business license, EIN letter, or equivalent government documentation
- Admin reviews documents within 48 hours (target SLA)
- Verification granted for 12 months; annual renewal required

**Certified tier requirements (V1):**

- Must be verified
- 6 or more approved reviews with 4.0+ average
- Account active (owner logged in) within last 90 days
- Admin can manually grant or revoke

**MVP scope:** Claimed badge only. Verified and Certified are V1.

**Later:** Automated document pre-screening (AI). Third-party verification integrations (Secretary of State database lookup). Community vouching as a tier-building signal.

---

### Module 10 — Reviews

Community trust through structured, moderated reviews.

**Components:**

- Star rating (1–5) + text review body
- Review submission (logged-in users only, on claimed listings)
- Review display on BLACQList Page: average rating, count, most recent reviews
- Review display on search results cards: star average
- Business owner can respond to reviews (V1)
- "Helpful" vote on reviews (V2)
- Flag review as inappropriate
- Admin moderation queue

**MVP scope:** Minimal — reviews held until V1 to allow moderation tooling to be ready. If shipped at MVP, reviews are logged but not displayed until admin-approved (conservative approach).

**V1 scope:** Full review flow, moderation queue, business owner response, review display in search results.

**Policy considerations:**

- Only logged-in users can review (reduces spam)
- One review per user per listing (prevents duplicate reviews)
- Business owners cannot review their own listing or competitors
- Flagged reviews are hidden pending moderation, not deleted

---

### Module 11 — Saves and Shares

The community engagement layer — how users build personal lists and spread the platform.

**Saves:**

- Save button on any listing (search results card + BLACQList Page)
- Requires logged-in account
- Saved listings accessible from user account dashboard
- Save count visible to business owner in dashboard

**Shares:**

- Share button on every BLACQList Page
- Actions: copy link, share to Instagram, share to Facebook, share to X/Twitter
- OG metadata on every Page ensures rich preview on all social platforms
- Share count tracked as an engagement metric

**MVP scope:** Full save flow (save/unsave + saved list view). Full share flow (copy link + social OG).

**Later:** Named save lists (e.g., "Restaurants," "Gifting"). Share to WhatsApp. Share tracking with UTM attribution. Follow a business (lightweight).

---

### Module 12 — Marketplace

The commerce layer that turns discovery into transactions on-platform.

**Components:**

- Vendor storefront extension on Business Page
- Product listing pages (title, images, price, description, variants)
- Cart
- Checkout (Stripe)
- Order confirmation email
- Buyer order history
- Vendor order management dashboard
- Stripe Connect for vendor payouts
- Platform application fee
- Refund and dispute management
- Vendor analytics

**MVP scope:** None. The marketplace is a V2 feature. At MVP, vendor BLACQList Pages can link to an external Shopify/Etsy store via the primary CTA.

**V2 scope:** Full vendor storefront on BLACQList Page. Product listing. Cart. Checkout with Stripe Connect. Order management for vendors. Buyer order history.

**Dependencies:** Successful directory + BLACQList Pages must be in active use. Stripe Connect legal and compliance review must be complete. Minimum 50 willing vendors onboarded before marketplace launch.

---

### Module 13 — Receipt Uploads

How off-platform spend enters the community data layer.

**Flow:**

1. User opens receipt upload flow (supporter dashboard or homepage CTA)
2. Captures photo of receipt from device camera
3. OCR processing suggests the business name and category
4. User confirms or corrects the suggestion
5. Amount, business, and category are logged to user's spend history
6. Anonymized aggregate contribution to community spend data

**Privacy model:**

- Individual receipt data is private to the user — never publicly identifiable
- Only aggregate, anonymized data (total spend in category, total spend in city) is visible externally
- User can delete all receipt data from their account

**MVP scope:** Receipt upload intake as a **beta feature** — users can submit receipts, data is stored, but no dashboard or visualization yet. This seeds the spend data pipeline.

**V2 scope:** Personal spend dashboard. Category breakdowns. Community spend aggregate display.

---

### Module 14 — Community Spend Tracking

The aggregate view of where and how much the community has spent with Black-owned businesses.

**Components:**

- Personal spend log (from marketplace purchases + receipt uploads)
- Personal spend dashboard: total spend, by category, by month
- Community spend aggregate: total $ spent with Black-owned businesses, by city, by category (anonymized)
- Community spend summary ("The BLACQList community has tracked $X.XM in Black-owned spend this year")
- Spend milestone gamification (V3): streaks, community rankings, milestones

**Privacy rules:**

- Individual spend data is private
- Business/vendor nodes are shown on community aggregate with their consent
- Buyer identity is never exposed in any aggregate or public view

**MVP scope:** Data model only. Beta receipt intake. No dashboard visible to users.

**V2 scope:** Personal spend dashboard. Community aggregate summary number (not full graph).

**V3 scope:** Full dollar-flow map visualization.

---

### Module 15 — Flow Map

The long-term differentiator. A visual graph showing how dollars circulate through the Black community economy.

**Components:**

- Visual graph of community commerce circulation
- Business/vendor nodes (opt-in, shown with consent)
- Buyer nodes: anonymized, shown as volume/weight on edges
- City-level filter
- Category-level filter
- Time filter (this quarter, this year, all time)
- Embed option for community organizations, media, advocacy groups

**Data requirements before visualization can launch:**

- At minimum 6 months of marketplace transaction data + receipt uploads
- Minimum 500 participating community members contributing spend data
- Business/vendor opt-in campaign (businesses must choose to appear)

**MVP scope:** Data model designed and seeded. No visualization.

**V2 scope:** Aggregate summary number displayed ("$X spent with Black-owned businesses in Atlanta this quarter").

**V3 scope:** Interactive flow map. City/category filters. Business node opt-in. Embed option.

---

### Module 16 — Editorial System

Content that gives users a reason to engage beyond a single search session.

**Components:**

- **BLACQLight articles:** Long-form editorial features — business spotlights, community stories, industry deep-dives
- **Curated collections:** Admin-assembled lists of BLACQList Pages around a theme ("Best Black-owned Bookstores in Atlanta," "Top Black Chefs to Follow")
- **City guides:** Comprehensive curated guides to Black-owned experiences in a specific city
- **Featured placements:** Editorial content can feature specific BLACQList Pages with editorial context
- **Homepage editorial carousel:** Latest articles and collections on the homepage

**MVP scope:** Collections foundation (admin can create a collection of BLACQList Pages with a title and description). No full CMS at MVP — collections can be created via admin dashboard or direct database entry.

**V1 scope:** BLACQLight article pages. Full collections with editorial intro. Homepage editorial carousel. Editorial CMS for admin/curator.

**V2 scope:** City guides. Contributor system (trusted community writers). Scheduled publishing.

---

### Module 17 — AI Agent Layer

AI-assisted features that make the platform smarter for shoppers, business owners, and admins.

**Shopper-side (V2):**

- Conversational discovery: "I'm looking for a Black-owned caterer for a Juneteenth dinner in Atlanta for 50 people"
- Returns: ranked, contextualized recommendations with reasoning
- Culturally fluent — trained on community context, not generic retail
- Accessible from homepage as a distinct interaction mode (not the default search)

**Business-side (V2):**

- Page optimization suggestions: reviews the listing and suggests improvements to description, category selection, service list, and CTA configuration
- Quality score: rates the completeness and quality of the Page
- Prompted, not automated — owner chooses when to run it

**Admin/curator (V3):**

- Surfaces trending entities for editorial consideration
- Flags stale listings (no owner activity in 90+ days, broken links)
- Recommends collection themes based on listing data and search trends
- AI-assisted duplicate detection on new listing submissions

**Policy:**

- All AI calls are server-side only — no client-side API key exposure
- AI responses always include a brief reasoning trace visible to the user
- AI features are behind feature flags — any feature that produces poor results is disabled, not shipped
- Prompts are versioned and tested before production

---

### Module 18 — Monetization

How The BLACQList generates revenue sustainably without compromising platform integrity.

**Listing tiers (V1):**

| Tier     | Price  | Included                                                                                   |
| -------- | ------ | ------------------------------------------------------------------------------------------ |
| Free     | $0     | Basic BLACQList Page, claim, limited gallery (4 images), basic analytics                   |
| Standard | TBD/mo | Full gallery (12 images), all Page sections, enhanced analytics, response to reviews       |
| Premium  | TBD/mo | Everything in Standard + Featured search placement, analytics trends, AI page optimization |

**Sponsored placements (V1):**

- Featured placements in city/category search results (top of results page, clearly labeled "Sponsored")
- Featured collection sponsorship (a sponsor powers an editorial collection)
- Homepage featured slot (limited, premium pricing)
- All sponsored placements are clearly labeled — no dark patterns

**Marketplace fees (V2):**

- Platform takes **8%** of each marketplace transaction — reconciled 2026-07-27 from the conflicting
  8–12% here and 3–8% in `monetization/monetization-spec.md`; 8% is the overlap of both ranges.
  Canonical definition and rationale live in `monetization/monetization-spec.md`.
- Applied via Stripe Connect application fee
- Stripe processing (2.9% + $0.30) is separate and additional — disclose the all-in cost, not just
  the platform fee
- Disclosed to vendors before onboarding

**Job posting fees (V2):**

- Job listings are free for 30 days at MVP
- Paid boosted placement: featured at top of jobs page
- Extended duration (60/90 days): paid

**Event promotion fees (V2):**

- Basic event listing: free
- Featured event placement on city/category pages: paid
- Event collection sponsorship: paid

**Sponsor campaign packages (V3):**

- City-targeted brand campaigns
- Category-targeted placements
- Community impact report sponsorship
- Custom partnership packages

---

### Module 19 — Analytics

Data that makes the platform better for every stakeholder.

**Listing-level analytics (business owner dashboard):**

- Page views (7-day, 30-day, all-time)
- CTA click-through rate
- Save count, share count
- Search impression count (how many times the listing appeared in search)
- Review average and count

**Platform analytics (admin dashboard):**

- Total listings by city, by category, by entity type, by trust status
- New listings per week
- Claim queue volume and resolution time
- Active business owners (logged in within 30 days)
- Supporter signups and saves
- Search query analytics (what are users searching for)
- Top-performing Pages (most viewed, most saved)

**Community impact analytics (public-facing, V3):**

- Total community spend tracked (aggregate, anonymized)
- Total $ by city (top 10 cities)
- Total $ by category
- Year-over-year growth
- Number of participating businesses
- Downloadable reports for community organizations, journalists, and advocates

---

## MVP Scope

The MVP is the smallest version of The BLACQList that delivers real value to a real user on launch day — specifically, someone who is not the founder and has no obligation to use the platform.

### MVP Definition

A real user can:

1. Search for a Black-owned business and find a polished result
2. View a BLACQList Page that looks meaningfully better than a Google Business listing
3. Save and share that listing
4. A business owner can claim or create their Page in under 15 minutes
5. An admin can approve claims and manage listings from a dashboard

### MVP Feature Set

**Public Discovery**

- [ ] Homepage: hero, category grid, city spotlight, featured listings carousel
- [ ] City landing pages (auto-generated from listing data)
- [ ] Category landing pages (auto-generated)
- [ ] City + category combination pages

**Search**

- [ ] Keyword full-text search
- [ ] Category filter
- [ ] City filter
- [ ] Search results page with listing cards (name, category, city, image, save button, trust badge)
- [ ] Empty state with suggestions

**BLACQList Pages — Business Template**

- [ ] Hero (cover image, name, tagline, primary CTA)
- [ ] About section
- [ ] Category tags, location, hours, contact info
- [ ] Social links
- [ ] Gallery (up to 12 images)
- [ ] Services/offerings section
- [ ] Configurable primary CTA
- [ ] Save + share buttons
- [ ] Claimed badge
- [ ] Page SEO (title, description, OG tags, canonical URL, sitemap)
- [ ] Server-rendered HTML (indexable by Google)

**Entity Submission**

- [ ] Business owner create listing flow (multi-step)
- [ ] Community submission form (lightweight)
- [ ] Duplicate detection warning

**Claim Workflow**

- [ ] Search for existing listing → claim → submit verification info
- [ ] Admin claim queue: review, approve, reject with reason
- [ ] Email: claim submitted, claim approved, claim rejected

**Owner Dashboard**

- [ ] Page view count, CTA click count, save count
- [ ] Edit all Page fields
- [ ] Upload logo and cover image
- [ ] Gallery management
- [ ] Set primary CTA type + URL
- [ ] Preview + publish controls
- [ ] Claim status indicator

**User Accounts**

- [ ] Sign up (email + password)
- [ ] Sign in / sign out
- [ ] Password reset
- [ ] Basic user profile (display name, email)
- [ ] Role assignment (supporter vs. business owner)

**Supporter Saves**

- [ ] Save any listing (logged-in users)
- [ ] Saved list view in account

**Admin Dashboard**

- [ ] All listings view with status filters
- [ ] Claim queue management
- [ ] Create / edit / delete any listing
- [ ] Flag listings (inactive, duplicate, incorrect)
- [ ] User management (view, role change, suspend)
- [ ] Basic platform stats (total listings, new this week, pending claims)

**Reviews (conservative MVP)**

- [ ] Review submission form (logged-in, on claimed listings)
- [ ] Reviews logged but held in admin queue — not displayed until moderated
- [ ] Star rating input + text body

**Verification Statuses**

- [ ] Unclaimed / Claimed badges visible on Pages and search cards
- [ ] Verified and Certified badges: data model ready, UI present but not yet earnable at MVP

**Starter Analytics Events**

- [ ] Page view tracked
- [ ] CTA click tracked
- [ ] Save tracked
- [ ] Search query logged

**Receipt Upload — Beta Intake**

- [ ] Receipt photo upload form accessible from supporter account
- [ ] Data stored: business name (user-entered or OCR-suggested), category, amount, date
- [ ] No visualization yet — data pipeline seeding only

**Flow Map — Data Model Only**

- [ ] `spend_events` table with: user_id, business_id, amount, source (marketplace/receipt), category, date
- [ ] No visualization. No public display.

**Editorial Foundation**

- [ ] Admin can create a collection (title, description, list of BLACQList Page IDs)
- [ ] Collections are publicly viewable at `/collection/[slug]`
- [ ] No full CMS — admin creates via dashboard form

**SEO Foundation**

- [ ] All pages server-rendered
- [ ] Sitemap generated and submitted
- [ ] robots.txt configured
- [ ] Structured data markup (LocalBusiness schema) on BLACQList Pages

### Launch Data Requirements

| City    | Minimum listings | Target |
| ------- | ---------------- | ------ |
| Atlanta | 150+             | 300+   |
| Houston | 50+              | 100+   |
| Chicago | 50+              | 100+   |

40% of seed listings must have at least one image (logo or cover photo). All seed listings must have: name, category, city, description, contact method.

---

## Not in MVP

The following are explicitly deferred. Do not build any of these until the MVP gate criteria are met.

| Feature                                   | Deferred to            | Reason                                                               |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| Full marketplace checkout                 | V2                     | Commerce layer complexity; requires Stripe Connect legal review      |
| Full Stripe Connect marketplace           | V2                     | Vendor onboarding, KYC, payout rails — significant compliance work   |
| Vendor storefronts                        | V2                     | Depends on healthy directory; validate directory first               |
| Full AI concierge / conversational search | V2                     | Requires high listing data quality; premature without validated data |
| AI Page optimization suggestions          | V2                     | Same dependency as concierge                                         |
| Full flow-map visualization               | V3                     | Requires months of real transaction + receipt data                   |
| Sponsor reporting dashboard               | V3                     | Sponsors are manual at MVP; self-serve comes later                   |
| Advanced personalized recommendations     | V2                     | Requires behavioral data not yet generated                           |
| Mobile app (iOS / Android)                | V4                     | Validate responsive web first                                        |
| Complex vendor-to-vendor supply chain     | Future                 | Out of scope for current platform vision                             |
| Automated verification                    | V3                     | Requires third-party API integrations and legal review               |
| Advanced paid subscription management     | V1                     | Listing tiers come after directory is validated                      |
| Multi-city editorial automation           | V2                     | Manual editorial first; automation after patterns emerge             |
| Community forums or message boards        | Never (current vision) | Not a social network                                                 |
| Complex multi-tenancy / white-label       | Future                 | No confirmed demand at this stage                                    |
| B2B procurement or supplier directory     | Future                 | Different product category                                           |
| International listings                    | Future                 | US-only; international is a V4+ decision                             |
| Recurring events                          | V2                     | Single events first; recurring adds scheduling complexity            |
| On-platform job applications              | V3                     | Apply link off-platform is sufficient at V1                          |

---

## MVP Success Criteria

The MVP is successful when all of the following are true, measured within 60 days of public launch:

### User-facing

- [ ] 500+ unique users have performed a search
- [ ] 50+ users have saved at least one listing
- [ ] 25+ users have shared a listing via the share button
- [ ] Average search-to-BLACQList-Page click rate ≥ 30%
- [ ] Zero reports of the platform being inaccessible or non-functional for more than 30 minutes

### Business owner-facing

- [ ] 50+ business owners have claimed or created a listing
- [ ] 80%+ of claimed listings have at least one uploaded image (logo or cover)
- [ ] Median time from signup to published BLACQList Page ≤ 20 minutes
- [ ] Admin claim queue is resolved within 48 hours for 90%+ of submissions

### Platform quality

- [ ] At least 150 Atlanta listings, 50+ Houston, 50+ Chicago at launch
- [ ] BLACQList Pages for all seed listings are server-rendered and indexable
- [ ] At least 10 seed BLACQList Pages rank on page 1 of Google for "[business name] Atlanta" within 30 days
- [ ] Zero P0 (Critical) bugs open at launch
- [ ] No PII is logged, no secrets are committed

### Qualitative

- [ ] At least 3 non-team users describe a BLACQList Page as looking "better than Google" or "better than Yelp" without prompting
- [ ] At least 1 business owner says the Page represents their business better than any other platform

---

## Later Product Stages

### MVP (launch)

Public discovery, BLACQList Pages (business template), claim/create/manage, basic auth, saves/shares, admin dashboard, basic analytics, receipt beta, editorial foundation.

### Beta (post-MVP validation)

Invite-only access to early features. Used to validate V1 features with willing users before full rollout. Timing: 4–8 weeks post-MVP launch.

### V1 — Trust & Grow (8–12 weeks post-MVP)

- Reviews + moderation
- Professional, Creative, Event, and Job Page templates
- Trust verification (Verified badge + document review)
- Community corrections (flag + admin queue)
- Listing tiers (Free / Standard / Premium) via Stripe subscriptions
- Sponsored placements (city/category search featured)
- Supporter dashboard (saved lists, recently viewed, suggested listings)
- Business owner analytics (trends, 30/90-day)
- Editorial CMS + BLACQLight articles + full collections
- Platform analytics dashboard (admin)

### V1.5 — Monetization Hardening (4–6 weeks post-V1)

- Subscription management (Stripe Customer Portal)
- Sponsored placement self-serve tooling
- Job posting fees (paid listings with boost)
- Event promotion fees
- Refund and cancellation handling for paid tiers

### V2 — Commerce Layer (10–14 weeks post-V1.5)

- Marketplace: vendor storefronts, product listings, cart, checkout, Stripe Connect
- Receipt upload flow (full: OCR, category confirm, personal spend log)
- Personal spend dashboard (supporter)
- Community spend aggregate summary (public, anonymized)
- City guides (editorial)
- AI Page optimization agent (business owner side)
- AI discovery agent (beta, shopper side)
- Job posting on-platform apply (V2 option)

### V3 — Intelligence & Impact Layer (12–16 weeks post-V2)

- Full interactive dollar-flow map
- AI concierge (public, full conversational discovery)
- AI admin/curator agent
- Sponsor campaign dashboard (self-serve)
- Community impact analytics (public-facing)
- Downloadable data reports
- Dollar-flow embed for external sites

### Future Ecosystem (V4+)

- iOS and Android native app
- 25+ city depth
- Spanish-language support
- International expansion assessment
- Enterprise/partner API for community organizations and media
- White-label or co-branded city guides

---

## Risks

### 1. Scope Creep

**Risk:** The platform has 19 modules and 44+ features. Without disciplined phasing, the team builds too much before validating anything.
**Mitigation:** All non-MVP features are explicitly locked. Any scope addition requires documented justification and product lead approval. MVP gate criteria must be met before V1 work begins.

### 2. Marketplace Complexity

**Risk:** Marketplace features (Stripe Connect, fulfillment, disputes, refunds) are significantly more complex than directory features. Underestimating this extends the timeline and risks quality issues.
**Mitigation:** Marketplace is V2, not MVP. Legal and compliance review begins in V1. Stripe Connect architecture is designed but not implemented until vendor supply is confirmed.

### 3. Verification Sensitivity

**Risk:** Verifying that a business is Black-owned involves sensitive identity, legal, and cultural considerations. Getting this wrong — either accepting fraudulent claims or rejecting legitimate ones — damages platform credibility.
**Mitigation:** Graduated trust system (claimed → verified → certified) means no listing is all-or-nothing. Verification is manual and human-reviewed. Criteria are documented and consistently applied.

### 4. Data Quality

**Risk:** Search, AI features, and the flow map all depend on listing data being complete, accurate, and up-to-date. A platform with poor data quality fails even with good infrastructure.
**Mitigation:** Seed data QA before launch. Admin tools for data correction. Community correction flow. AI-assisted quality scoring on listings (V2).

### 5. Search Quality

**Risk:** If search returns irrelevant or low-quality results, users abandon. PostgreSQL FTS may not be sufficient for diverse query patterns.
**Mitigation:** PostgreSQL FTS + `pg_trgm` covers most MVP patterns. Monitoring search quality with query analytics from day one. Migration path to Algolia/Typesense is planned and documented.

### 6. Moderation

**Risk:** Reviews, community corrections, and user-submitted content require active moderation. Unmoderated content can damage trust and expose legal liability.
**Mitigation:** Reviews are held in a queue before display at MVP (conservative). Moderation tooling in V1. Community-flagging as a force multiplier.

### 7. Legal / Privacy

**Risk:** Receipt upload (storing spend data), the flow map (even anonymized), and marketplace (Stripe, vendor agreements, sales tax) all carry legal and privacy considerations.
**Mitigation:** Privacy policy reviewed before launch. Receipt data is private and deletable. Flow map is anonymized with published methodology. Marketplace vendor agreement reviewed by counsel before V2.

### 8. Payment Complexity

**Risk:** Stripe Connect for marketplace payouts involves KYC, tax forms, delayed payouts, and disputes. Underbuilding this creates vendor complaints and platform liability.
**Mitigation:** Stripe Connect is V2. All payment features are tested in Stripe test mode before production. A documented vendor agreement precedes marketplace launch.

### 9. Community Trust

**Risk:** The platform's credibility depends on the community trusting that it is genuinely community-powered, not extractive. Any feature or business decision that feels exploitative (intrusive ads, selling data, unfair monetization) risks this trust permanently.
**Mitigation:** Monetization is transparent and value-aligned (better presence, not pay-to-find). Data policies are published clearly. Community correction and feedback mechanisms are built in.

### 10. User Adoption

**Risk:** Cold-start problem: the platform has no value without listings, and no listings without business owners, and no business owners without a community to reach.
**Mitigation:** Seed data strategy (150+ Atlanta listings at launch via outreach + scraping + partnerships with community organizations). Launch event/campaign tied to Atlanta community networks.

### 11. Business Owner Onboarding

**Risk:** Business owners who are not technically sophisticated may abandon the claim or create flow before completing their Page, leading to incomplete, low-quality listings.
**Mitigation:** Claim and create flows are designed for non-technical users (step-by-step, minimal required fields, in-context guidance). Email drip for business owners who start but don't complete. Page quality score and completion prompts in the owner dashboard.

---

## Production Readiness Standards

Before any phase goes live to real users, the following minimum standards must be met.

### Code

- `tsc --noEmit` passes with zero errors
- ESLint passes with zero errors
- No secrets or credentials committed to version control
- No `console.log` in production code

### Security

- All protected routes blocked for unauthenticated users (tested via direct URL, not just UI)
- Business owners cannot access or modify other owners' listings (tested via direct API call)
- Admin routes blocked for non-admin users
- RLS policies verified on all Supabase tables
- No PII in application logs
- HTTPS enforced in production

### Performance

- BLACQList Pages load in under 2 seconds on simulated 4G mobile
- Search returns results in under 1.5 seconds
- Lighthouse score ≥ 80 on BLACQList Page (mobile)

### SEO

- All BLACQList Pages are server-rendered (verified in page source)
- Unique title, meta description, and OG tags on every Page
- Sitemap submitted and valid

### Accessibility

- All form inputs have visible labels
- Tab order is logical on all primary flows
- Color contrast meets WCAG AA on all UI
- Error messages are descriptive and inline

### Mobile

- Homepage, search, and BLACQList Page all render correctly at 375px
- Primary CTAs are thumb-reachable on mobile
- All forms are usable with mobile keyboard open

### Operations

- Sentry (or equivalent) installed and alerting
- Database backups confirmed (Supabase point-in-time recovery enabled)
- Rollback plan documented for each deployment
- On-call coverage confirmed for launch week

### Legal

- Privacy Policy published and linked
- Terms of Service published and linked
- DMCA contact published

---

## Open Questions

1. **Reviews at MVP:** Should reviews be enabled but held in a moderation queue (conservative), or fully disabled until V1 moderation tooling is ready?

2. **Auth providers at MVP:** Email + password only, or include Google OAuth to reduce signup friction?

3. **Professional Page template at MVP:** Can professionals use the business template at MVP, or is a distinct professional template required to attract early professional listings?

4. **Community submission flow:** Should community-submitted listings be visible in search immediately (low trust, clearly labeled) or held in an admin queue (higher quality, slower to publish)?

5. **Seed data sourcing:** What is the plan for sourcing and QA-ing the 150+ Atlanta listings needed at launch? Scrape + community outreach + partner organizations?

6. **Receipt upload privacy consent:** At what point does a user explicitly consent to community spend aggregation — at account creation or at first receipt upload?

7. **Flow map opt-in campaign:** When does the business owner opt-in campaign for flow map node visibility launch, and is it a launch day feature or a post-V2 campaign?

8. **Editorial staffing:** Is there a dedicated editor at launch, or is editorial content created by the product team? This affects the V1 editorial scope directly.

9. **Claim fraud rate:** What is the expected claim fraud rate, and does the team have capacity to handle manual verification at launch volume?

10. **Listing tier pricing:** What are the Standard and Premium tier monthly prices? This affects the V1 monetization launch plan.

---

## Recommended Next Workflow

With the PRD approved, the recommended sequence is:

**Immediate next artifacts (in order):**

1. **UX flows** — `docs/blacqlist/ux/user-flows.md`
   Run: _Act as the UX Flow agent — create user flows for the 5 core MVP workflows: (1) search → discover → save, (2) claim a listing, (3) create a new listing, (4) admin claim review, (5) supporter account + saved list._

2. **Screen map** — `docs/blacqlist/ux/screen-map.md`
   Run: _Act as the UX Flow agent — create the full screen map for the BLACQList MVP, covering all public, authenticated, owner, and admin screens._

3. **Data model** — `docs/blacqlist/data/data-model.md`
   Run: _Act as the Schema Data agent — create the data model for The BLACQList MVP entities: listings, categories, cities, users, roles, claims, saves, media_attachments, spend_events._

4. **API contract** — `docs/blacqlist/architecture/api-contract.md`
   Run: _Act as the API Integration agent — create the API contract for the BLACQList MVP, covering search, listing CRUD, claim workflow, owner dashboard, and admin dashboard endpoints._

5. **Dev tickets** — `docs/blacqlist/tickets/`
   Run: _Act as the Dev Ticket Writer — create the first 10 dev tickets for the BLACQList MVP, starting with: project setup, base schema, auth, search, BLACQList Page, claim flow, owner dashboard, admin dashboard, saves, and seed data import._

Once UX flows, screen map, and data model are approved — implementation can begin.
