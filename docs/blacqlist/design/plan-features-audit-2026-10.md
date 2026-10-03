# Plan features audit (October 2026)

**Audience:** the founder and anyone who edits plan copy or `lib/stripe/features.ts`.
**Last updated:** 2026-10-03
**Related:** PR #171 (For Business page + plan copy), PR #173 (ticket 119, limit enforcement)

## Why this exists

The founder asked for every plan bullet to be clear: what it is, what it means, and whether we can really deliver it. We traced every bullet in `lib/stripe/plans.ts` through its gate or limit in `lib/stripe/features.ts`, then to where the code enforces it, the owner dashboard, and the public page.

What we found `[Observed — code read, 2026-10-03]`:

- Only 4 gates are read anywhere in the app: `analytics`, `review_response`, `ai_suggestions`, `storefront`.
- Only photos, products, and events/jobs had their limits enforced.
- Free already got most of what Starter sold.
- Growth and Premium have been Coming Soon since 2026-09-02, but their cards still listed every bullet, including lines with FTC and §1981 risk (category exclusivity, a "$299 value" Spotlight, homepage placement).
- Starter **is** for sale, so its card has to be true today.

## Founder decisions

| # | Decision | Label |
|---|---|---|
| 1 | Verified is free for every claimed owner. It moves off the Starter card. Badges are earned, never sold. | `[Decision — founder, 2026-10-03]` |
| 2 | Enforce the Free and Starter limits that already exist in `TIER_LIMITS` (ticket 119, PR #173). | `[Decision — founder, 2026-10-03]` |
| 3 | Drop every AI line until a real model is switched on. | `[Decision — founder, 2026-10-03]` |
| 4 | Hide Growth and Premium bullets while they can't be bought. The card shows name, tagline, price, and Coming Soon. | `[Decision — founder, 2026-10-03]` |

## Starter, line by line

| Old bullet | What was true | Now |
|---|---|---|
| Verified badge | Free for any claimed owner (checked by hand). The `verified_badge` gate is never read. | Moved to Free: "Claim it and get Verified, free" |
| Up to 10 photos and 1 video | Photos enforced. The video link was open to everyone. | "Up to 10 photos" and "A video from YouTube or Vimeo", video gated to Starter (PR #173) |
| Full-length description and 10 tags | Not enforced | Free: 300 characters, 3 filter details. Starter: no length limit, 10 filter details (PR #173) |
| FAQ section (up to 5) | Not enforced | Free 0, Starter 5 (PR #173) |
| Social links | Not gated | Starter only (PR #173) |
| Reply to reviews | Enforced | Same: "Reply to reviews in public" |
| Owner analytics (30-day) | Enforced | Same: "See your views, saves, and taps over the last 30 days" |
| 10 AI assists a month | Mock output, and the real limit was 10 per day | **Cut** |
| Remove the "Powered by" badge | The badge doesn't exist | **Cut** |

## Free, as it reads now

- Your page with hours, contact info, and website
- A short description (up to 300 characters)
- 1 photo
- Up to 3 details customers filter by, like outdoor seating
- Category, city, and search placement
- A map pin once your address is confirmed
- Community reviews, checked before they post
- Claim it and get Verified, free

The "1 photo" limit wasn't applied during add-business, where anyone could upload up to 12. PR #173 fixes that. The logo and cover no longer count, so the limit means gallery photos.

## Growth and Premium

The bullets don't render while the tier can't be bought. The lists in `plans.ts` were still rewritten down to what we can realistically build, so nothing risky is waiting to show up the day a tier opens.

**Cut from both:** the $299 Spotlight value, category exclusivity, homepage, editorial, and priority placement, unlimited or 3 videos, AI, and anything Free already has.

| Growth | Premium |
|---|---|
| Up to 25 photos | Up to 50 photos |
| A storefront for up to 25 products and services | Unlimited products, services, and events |
| Up to 3 events at a time | 3 job postings every 30 days |
| 1 job posting every 30 days | Coupons and deals |
| The search terms that found you, with 12 months of history | Booking requests |
| Up to 5 team members | Up to 3 locations on one account |
| Support replies within 1 business day | Your community spend view, once 5 or more receipts are logged |
| | A named support contact |

Before either tier goes on sale, every one of these lines needs the same trace Starter got. Coupons, booking requests, multi-location, and the support promises have no code behind them yet `[Observed — code read, 2026-10-03]`.

## Existing listings over the new limits

Policy: keep what exists and block new additions. A check runs only when the owner adds or changes that thing. Nothing is deleted or hidden, so no data operation is needed.

| Free listings already over a limit | Count |
|---|---|
| Listings total / on Free | 550 / 547 |
| Have FAQs | 0 |
| Description over 300 characters | 4 |
| More than 3 filter details | 0 |
| Have a video link | 2 |
| Have social links | 100 |
| More than 1 gallery photo | 2 |

Source: `[Measured — staging Supabase via Management API, 2026-10-03]`. Production counts are `[Unknown]` (a production read needs the founder's OK).

## Where the copy is pinned

- `tests/plan-copy.test.ts`: every Free and Starter number matches `features.ts`, every Starter extra is gated off Free, no cut lines, no em dashes.
- `tests/for-business-copy.test.ts`: the For Business page says Verified is free and only names Starter extras that are gated.
- `lib/stripe/features.ts`: the `verified_badge` comment says the gate is deliberately unread.

## Open items (not in these PRs)

1. **Downgrade gap.** Content over the limit stays after a downgrade.
2. **`tier_weight` in search ranking** still ranks paid tiers higher. Needs a founder call against the Black-Owned centering rule.
3. **/for-sponsors** still prints $299 to $999.
4. **Marketplace flags.** Confirm `paidPostings` and `postingSubmissions` before Growth or Premium go on sale.
5. **Stripe Customer Portal catalog.** A Starter subscriber might be able to switch into Premium there.
6. **Existing Starter subscribers**, if any, lose nothing they actually had (AI was a mock, the badge never existed). A heads-up would go through GATE-COMMS.
7. **Map pins.** 26% of listings have no map pin, which is why the Free line says "once your address is confirmed."
8. **Premium tagline.** "Own the category." reads like exclusivity now that exclusivity is cut. It still shows on the Coming Soon card. Worth a reword before Premium opens.
