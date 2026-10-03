# Ticket 115 — For Business A: "Documentary"

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready (spec Q1 + Q2 answered 2026-10-03)
**Depends on:** none (no migration)
**Spec:** [page-workshop-2026-10-spec.md §2](../design/page-workshop-2026-10-spec.md#2-for-business-a-documentary)

---

## Why

The current page (hero "You deserve a better page.") has outdated Certified copy, and it says paid tiers are "coming in V1". The founder picked the photo-led Business A direction on 2026-10-03.

## User story

As a business owner, when I land on For Business, I want to see what claiming gets me, how trust badges work, and what plans cost, so I can decide to claim in a minute.

## Acceptance criteria

- The page has six sections in order: hero, How it works (an `<ol>`), What you get, trust ladder, plans, and the closing band, using the spec copy.
- The hero h1 is server-rendered text, and the photo uses `next/image` with a real alt text. "Claim your page" → `/claim` and "List a new business" → `/add-business`.
- Plans render through the existing `<PricingPlans availability={…} />`, fed by `getPlanAvailability()`. No price, plan name or savings % is typed into this page.
- Unbuyable plans show "Coming Soon", exactly as on `/pricing`.
- The Certified line states all the criteria from `moderation-policy.md` (5 reviews, a 3.5 average, 90 days since the claim, complete details) and says it can't be bought.
- The trust-ladder subhead reads "Customers see your badge on every search. Badges are earned, never sold." The Verified line ends "Available on Starter and up." No "Most popular" badge (spec Q1, Q2).
- "See who finds you" is marked as Starter and up, because `analytics` is tier 1 in `lib/stripe/features.ts`.
- There are no testimonials and no invented numbers. Any screenshot is a real capture.
- At 375px nothing scrolls sideways and the buttons are at least 44px tall. Keyboard order follows the reading order.

## QA notes

- Compare the plan cards with `/pricing` side by side; they must match.
- Run the a11y e2e suite.
- Check LCP on the Preview: the hero text must not wait on the photo.

## Out of scope

New photography (spec Q4), testimonials, and changes to `/pricing`.
