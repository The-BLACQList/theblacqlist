# Product Principles — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product

These principles are decision filters. When a feature, design, or architectural choice is unclear, these are the tiebreakers. Every team member should be able to cite the relevant principle when making or defending a product decision.

---

## The Ten Principles

---

### 1. National from day one, Atlanta-rooted.

**What this means:**
The BLACQList launches as a national platform, not as a local app that eventually expands. The search, discovery, and listing infrastructure must work for any city from the first deployment. Atlanta is our anchor — the city with the deepest initial supply, the loudest launch moment, and the cultural credibility to establish the brand. But Atlanta is a starting point, not a ceiling.

**How this shapes decisions:**

- Infrastructure must be built for national scale, not Atlanta-specific queries
- City pages are templated and auto-generated from data, not manually curated for each city
- Seeding strategy must focus on Atlanta depth first, then activate secondary cities (Houston, Chicago, DC, New York, LA)
- Never build a feature that only works in one city

**Trade-off it implies:**
Atlanta content will be richer at launch. Other cities will feel thin. This is acceptable in the short term — the platform's value proposition is still valid in a thinner city if the quality of individual BLACQList Pages is high.

---

### 2. BLACQList Pages are micro-websites, not profiles.

**What this means:**
Every listed entity — business, professional, creative, event, vendor — gets a Page that feels like a purpose-built mini-website, not a form-filled database row. The Page surfaces the entity's story, offerings, media, trust signals, contact paths, and community standing in a way that feels designed, not generated.

**How this shapes decisions:**

- Page templates are built per entity type (a business Page ≠ a professional Page ≠ an event Page)
- Each template supports: hero section, about, offerings/services/products, gallery, reviews, trust badges, contact/booking CTA, social links
- Page owner can customize within the template — not a blank canvas, but meaningful personalization
- BLACQList Pages should be shareable, indexable, and linkable

**Trade-off it implies:**
More complex to build than a basic profile system. Worth it — the quality of the Page is the primary reason a business owner would choose BLACQList over a free Google listing.

---

### 3. Discovery must lead to action.

**What this means:**
Finding a listing is not the end of the flow. Every BLACQList Page must have a clear, prominent next action: book, buy, call, message, visit, save, share. Discovery without conversion is a vanity metric. The platform succeeds when search leads to real economic activity.

**How this shapes decisions:**

- Every Page template requires at least one primary CTA (book, order, contact, attend)
- CTAs must be visible without scrolling on mobile
- The search results page surfaces enough context to act from the results list itself (not just on the detail Page)
- Saving, sharing, and reviewing are lightweight enough that they happen without friction

**Trade-off it implies:**
Action CTAs require business owners to configure them (booking link, store URL, phone). Some owners won't. The platform needs graceful fallback CTAs (message us, visit website) for unconfigured Pages.

---

### 4. Trust and verification matter.

**What this means:**
Not every listing is equal. A business that has been verified, reviewed, and endorsed by the community should look and feel different from a newly-claimed, unreviewed listing. The platform must make trust visible — not just binary (verified/unverified) but graduated.

**How this shapes decisions:**

- Trust badges are tiered: community-added → claimed → verified → BLACQList Certified
- Verification requires documentation review (business license, EIN, etc.) — this is a manual step, not instant
- Review scores, endorsement counts, and community corrections all contribute to a trust signal
- Unverified listings are still visible but clearly marked

**Trade-off it implies:**
Manual verification creates a bottleneck. The platform must scale this with AI-assisted pre-screening and a queue management tool for admins.

---

### 5. Marketplace and directory should feel connected.

**What this means:**
The discovery layer and the commerce layer are the same surface, not two separate products. A user searching for a Black-owned candle brand should be able to browse their listings, read reviews, and buy — without leaving the platform or switching modes. The marketplace is built on top of the directory, not beside it.

**How this shapes decisions:**

- Product listings live on BLACQList Pages, not in a separate storefront section
- Vendors have a BLACQList Page just like businesses do
- Search results can surface both directory listings and products in the same result set
- Checkout is possible from a BLACQList Page without navigating to a separate marketplace section

**Trade-off it implies:**
Marketplace functionality (cart, checkout, payments, fulfillment) is significantly more complex than directory. Build the directory first, design the Page template to accommodate commerce from day one, add the transaction layer in Phase 2.

---

### 6. Receipt uploads and marketplace purchases should feed community spend tracking.

**What this means:**
Every dollar spent with a Black-owned business — whether bought on-platform or off — should be able to count. Marketplace purchases are tracked automatically. Off-platform purchases are tracked through receipt uploads. Together, these feed the community spend layer that powers the dollar-flow map.

**How this shapes decisions:**

- Receipt upload must be a lightweight, one-tap mobile flow (photo → category confirmation → logged)
- Spend data is personal and private but aggregates into anonymous community statistics
- The spend tracking feature is not just a vanity dashboard — it feeds the dollar-flow map
- Gamification of spend is possible (streaks, milestones, community rankings) but not in MVP

**Trade-off it implies:**
Receipt upload requires ongoing user behavior. Adoption will be lower than passive features. Design for delight and habit — not just utility.

---

### 7. Buyers are anonymous in public flow-map views.

**What this means:**
The dollar-flow map shows money moving through the community ecosystem. Business and vendor nodes are visible by name (with their consent). Individual buyers are never identified — all buyer-side data is aggregated and anonymized before it appears on the map.

**How this shapes decisions:**

- No public flow-map view ever shows a buyer's identity, name, or transaction details
- Buyer spend data is stored with privacy controls and used only in aggregate
- The privacy model must be documented and communicated to users before they opt into tracking
- Admin dashboards may have more granular data access — with audit logging

**Trade-off it implies:**
Full anonymization reduces the richness of the flow-map data. Acceptable trade-off — trust is more valuable than granularity.

---

### 8. Business and vendor nodes can appear publicly on the flow map.

**What this means:**
Businesses and vendors can opt in to appearing as named nodes on the dollar-flow map. A business that receives $12,000 in tracked spend from the community in a quarter can choose to display that publicly as a trust signal and social proof. Participation is opt-in, not automatic.

**How this shapes decisions:**

- Business owners choose whether their node is visible on the public map
- Spend totals on the map are rounded or banded (e.g., "$10K–$25K" not exact) to prevent competitive intelligence leakage
- The opt-in flow is part of the business dashboard, not a system-level setting

**Trade-off it implies:**
Low opt-in rates will make the map look sparse at first. Seed it with willing early adopters and show a compelling vision of what it will look like at scale.

---

### 9. AI should feel like a concierge with taste.

**What this means:**
The AI layer is not a search bar upgrade. It is a knowledgeable, culturally-fluent assistant that understands what you're really looking for and surfaces the right options with context. "I'm looking for a caterer for a Juneteenth dinner in Atlanta" should return something better than keyword-matched listings — it should return ranked, contextualized recommendations with a reason for each.

**How this shapes decisions:**

- AI discovery is a distinct interaction mode from keyword search — accessible from the homepage but not the default
- AI responses include reasoning ("I'm recommending this because...")
- AI agents are persona-trained to The BLACQList brand voice — not generic chatbot responses
- AI is used on the business side too: Page optimization suggestions, description improvements, category recommendations

**Trade-off it implies:**
AI quality requires prompt engineering, testing, and iteration. Do not ship AI features until they are consistently good. A bad AI recommendation is worse than no recommendation.

---

### 10. The platform must avoid becoming a static directory.

**What this means:**
The failure mode for a platform like this is becoming a stale list of businesses that no one updates and no one trusts. The platform must be designed for continuous freshness — through community corrections, business owner activity, editorial content, and behavioral signals.

**How this shapes decisions:**

- Community corrections are a first-class feature: anyone can flag stale or incorrect info
- Business owner activity (updating hours, adding products, responding to reviews) is surfaced as a trust signal
- Editorial system (BLACQLight, collections, guides) creates a reason to visit beyond search
- Inactive listings are flagged and surfaced to admins for review or removal
- Event listings expire automatically; dead links are surfaced for correction

**Trade-off it implies:**
Freshness requires moderation infrastructure. The platform cannot rely on automated content only. Plan for a human editorial and moderation layer from launch.

---

## Using These Principles in Practice

When a feature proposal, design decision, or trade-off is unclear, ask:

1. Does this serve discovery → action?
2. Does this improve trust or freshness?
3. Does this feel like a concierge, or does it feel like a database?
4. Does this work nationally, or is it a local hack?
5. Does this connect the directory and the marketplace?
6. Does this protect buyer privacy while making community impact visible?

If the answer to most of these is no, the feature should be deferred or redesigned.

---

## Assumptions

- Business owners will engage with the platform more if the Page quality is demonstrably higher than Google Business or Yelp
- Community members are motivated to maintain listing accuracy if the UX is low-friction
- Cultural alignment with the brand voice increases retention for both searchers and business owners
- The AI concierge persona is a sustainable differentiation that competitors will not easily replicate

---

## Open Questions

1. Should the principles be published publicly to build community trust, or kept internal?
2. How do we measure whether principle #3 (discovery leads to action) is being met — what is the click-to-action rate benchmark?
3. Should principle #9 (AI as concierge) be a launch-day feature or a V2 feature?
4. Does "community corrections" (principle #10) require a moderation queue from day one, or can it be community-voted first?

---

## Do Not Overbuild Yet

- Do not build a full trust certification system before a basic claimed/verified binary is validated
- Do not build community correction workflows before basic listing CRUD is working
- Do not build AI concierge before the listing data quality is high enough to return good results
- Do not build the dollar-flow map before the receipt upload flow is validated with real users
