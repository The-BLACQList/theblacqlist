# Product Vision — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth — update with each major planning decision
**Owner:** Product

---

## Vision Statement

The BLACQList is the place where the Black economy is visible, discoverable, and self-reinforcing.

Not a directory. Not a social feed. Not a review site. A commerce layer — one where Black-owned businesses, professionals, creatives, events, jobs, vendors, and products are presented with the gravity they deserve, and where every transaction, review, save, share, and hire has the potential to keep dollars moving through the community.

**Find & Be Found.**
**Find what you need. Support who matters. Keep the dollar moving.**

---

## The Problem

### For people who want to support Black-owned businesses and professionals:

Finding them is inconsistently difficult. Word-of-mouth works, but it doesn't scale. Social media surfaces content, but not trust signals. Google Maps returns results but with no community context. Existing directories are sparse, outdated, or fragmented by city. There is no nationally trusted, community-maintained layer that makes Black-owned commerce as easy to access as any other option.

> **Problem statement:** Black consumers, allies, and community members struggle to discover and trust Black-owned businesses and professionals at the moment of intent — when they are ready to buy, book, hire, or attend — which causes dollars to leave the community by default, not by choice.

### For Black-owned businesses, professionals, and creatives:

The tools they're given to represent themselves online are generic. A Google Business profile designed for any business. A Yelp page that reduces a boutique clothing brand to a star rating. An Instagram account that requires constant content just to stay visible. There is no platform purpose-built to make Black-owned entities look the way they deserve to look — with the full context of their story, their offerings, their trust signals, and their community standing.

> **Problem statement:** Black-owned businesses and professionals lack a digital presence tool that is purpose-built for how they operate, what they offer, and who they serve — which forces them to choose between mediocre generic profiles or expensive custom websites.

### The systemic problem:

The Black dollar recirculates within the Black community at a fraction of the rate it recirculates in other communities. Part of this is structural and historical. Part of it is discovery — people don't buy from businesses they can't find or don't trust. The BLACQList is a bet that improving discovery, trust, and transaction infrastructure meaningfully changes that circulation number over time.

---

## Why Now

- Mobile-first consumers expect discovery tools that work as well as Airbnb, OpenTable, and Etsy for their specific intent
- Black-owned business formation accelerated sharply post-2020 — supply exists but visibility tools did not keep pace
- The "buy Black" cultural moment has sustained momentum but lacks reliable infrastructure
- AI-assisted discovery is now cost-accessible, making concierge-quality recommendations viable at scale
- Supabase + Vercel + Next.js have made marketplace-quality platforms buildable by small teams

---

## What the World Looks Like When We Succeed

- Any person anywhere in the country can open The BLACQList, search for what they need, and find a verified, polished, trusted Black-owned option — in under 30 seconds
- A business owner in Atlanta spends 20 minutes setting up their BLACQList Page and immediately has a presence that outperforms a $500 website
- A community can see, in aggregate, how much money is circulating through Black-owned businesses in their city — and that number grows every quarter
- The platform does not need to seed listings because the community maintains and expands them
- Businesses grow their revenue meaningfully attributable to BLACQList traffic and bookings
- The dollar-flow map becomes a civic data layer — cited by journalists, policymakers, and community organizations

---

## What This Is Not

- Not a social media platform or content feed
- Not a generic business directory with a "Black filter"
- Not a one-city or one-market product
- Not a community forum or message board
- Not a charity or nonprofit listing platform
- Not a replacement for a business's own website — a complement to it

---

## Strategic Bets

| Bet                               | Rationale                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------- |
| BLACQList Pages > basic profiles  | Higher quality presence = higher business adoption and retention                  |
| Dollar-flow map as long-term moat | No other platform visualizes community commerce circulation                       |
| National from day one             | A city-only strategy creates a ceiling; go national, focus depth in anchor cities |
| AI as concierge, not just search  | Recommendation quality determines whether discovery leads to action               |
| Receipts + spend tracking         | Behavioral data from real transactions makes the platform self-improving          |

---

## Assumptions

- There is sufficient latent demand for a trusted, national Black discovery platform
- Black-owned business owners will adopt a new platform if the listing quality is meaningfully better than their current options
- Community members will submit corrections, reviews, and endorsements voluntarily if the contribution UX is low-friction
- A receipt upload flow will be used regularly enough to feed meaningful spend data
- The "find and support" intent is strong enough to drive organic growth without paid acquisition
- Atlanta is a strong anchor market and launch city with enough supply to create a meaningful MVP experience

---

## Open Questions

1. What is the single most-used action in the first 30 days post-launch? (search, save, review, share, or click-to-visit)
2. What is the ceiling for voluntary listing quality — how many business owners will fill out a full BLACQList Page without incentives?
3. How should the platform handle businesses that are Black-owned but not Black-serving? (e.g., a B2B firm)
4. Does the dollar-flow map need to be live on day one, or is it a V2 feature?
5. What is the minimum data density (listings per city) needed before a city-specific landing page has real value?
6. Should professionals and creatives have the same Page template as businesses, or distinct templates?
7. How does the platform handle businesses that close or move?
8. Is there a legal or privacy concern with the dollar-flow map even if buyers are anonymous?

---

## Do Not Overbuild Yet

- Do not design the dollar-flow map visualization before the receipt + spend tracking data model is validated
- Do not build AI concierge features before manual search and browse are working and used
- Do not build multi-city editorial until one city's editorial workflow is proven
- Do not build analytics dashboards before there is meaningful data to analyze
- Do not build sponsor campaign tooling before the business listing tier structure is validated
- Do not build the marketplace before the directory and BLACQList Pages are used by real businesses
