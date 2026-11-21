# Ticket 239: Compare Plans Clearly, 3 Photos on Free, Full Layout on Starter and Up

**Status:** Merged #371, 2026-11-21 (founder OK). Rebased on main after #369 (240). No migration.

## Why

Founder, 2026-11-21, looking at the plans side by side:

> When I'm looking at the plans side by side, I want it to be extremely clear how much more you're getting per tier upgrade. We can allow up to 3 photos on free because the 4th photo unlocks the upgraded layout, which we do want reserved for starter and above tiers.

Decided the same day (all recommended options):

- Free goes from 1 photo to 3.
- The full (chapters) layout checks the plan: Starter and up only, including pages the platform added.

The other three points in that feedback are separate tickets:

- 240: logo map pin on Starter and up, redesigned.
- 241: advanced analytics on Growth and up.
- 242: Cue, your business assistant, by plan.

## What Changed

| Area | Files | What |
|---|---|---|
| Free photos | `lib/stripe/features.ts` | `TIER_LIMITS.free.photos` 1 → 3. Upload checks, the add-business picker and Cue's help text read it from `photoLimit()` |
| Full layout gate | `lib/stripe/features.ts`, `lib/entity-page/chapters-eligibility.ts` | New `GatedFeature 'chapters_layout'` at tier 1. `chaptersEligible()` checks it first, so a Free page with 4+ photos keeps the regular page |
| Editor note | `components/listings/PageFinishView.tsx`, `components/dashboard/MediaGrid.tsx` | A Free Storefront page's Photos card says the full layout comes with Starter, with a See Plans link, instead of asking for a 4th photo |
| Cards | `lib/stripe/plans.ts`, `app/(public)/pricing/PricingPlans.tsx`, `app/dashboard/upgrade/UpgradePlans.tsx` | Each paid card opens with "Everything in {lower plan}, plus:" and lists only what it adds. A line that raises a number says what the plan below has, e.g. "Up to 25 photos (Starter has 10)". Starter now names the full layout and "a simple analytics dashboard"; Growth names 12 months of analytics |
| Compare grid | `lib/stripe/planCompare.ts`, `components/billing/PlanCompareTable.tsx` | "Compare Every Plan" on /pricing and Upgrade. Every cell is computed from `features.ts`. Gold marks a step up from the plan to the left. A closed tier shows Coming Soon and no values; a row only a closed tier would fill is dropped. On phones the table scrolls inside its box with the labels pinned |
| /pricing copy | `app/(public)/pricing/page.tsx` | Subtitle and FAQ: full layout, more photos, simple analytics on Starter; 12 months of analytics on Growth |
| /for-business | `app/(public)/for-business/page.tsx` | In #369's trimmed voice: Free row "add up to 3 photos"; Starter row "Up to 10 photos, a video, common questions, and your social links."; new row The Full Page Layout (Starter and up) |
| Upgrade subtitle | `app/dashboard/upgrade/page.tsx` | "Unlock analytics, priority placement, and more" became "More photos, the full page layout, analytics, and more". The plans don't sell priority placement (cut in the 2026-10 plan audit); the narrow Growth+ search tie-break is explained on /how-ranking-works, which is unchanged |

The grid has no "pages your plan covers" row: a Free cell would have to say something about Free's pages, which the founder ruled is never stated (ticket 238).

## Behaviour Changes to Know

- **Free pages already in chapters go back to the regular page.** This includes platform-added Free Storefront pages with a cover, 4+ photos and a story. Paid pages are unchanged.
- **Downgraded pages show 3 photos on Free, not 1.** `shownLimits` reads the same limit.
- No database cap on photos exists, so nothing else changes server side.

## Copy Rules Kept

- A plan line ships only with the code that makes it true. "Advanced analytics" waits for 241, the logo pin for 240, Cue jobs for 242. Each adds its own row to `planCompare.ts` when it lands.
- A closed tier lists nothing, on the cards and in the grid.
- No em dashes; Title Case headings.

## For Marketing

The /for-business rows changed (WF-042 copy deck): "add up to 3 photos", "Up to 10 photos, a video, common questions, and your social links.", and the new row The Full Page Layout ("For businesses, restaurants, and vendors: your photos in a gallery and your story in chapters."). Update the deck to match.

## Tests

- New `tests/plan-compare.test.ts`: cells match `features.ts`, step-up marks, no pages row, closed tiers drop rows, `compareOpen`.
- Updated: `plan-copy` (new lines, lead-in split, Growth has 12 lines), `feature-gating`, `plan-checks`, `downgrade`, `upload-route`, `listing-chapters` (Free is never eligible, every paid plan is), `for-business-copy` (full layout row), and the "1 photo" fixtures.

## Verification

`npm run typecheck`, `npm run lint` (0 errors, 2 old warnings), `npx vitest run` (5,452 passed). Local dev against staging, screenshots at 390px and 1280px: /pricing cards and grid, /for-business. The page never scrolls sideways at 390px (the grid scrolls in its own box).

On the Preview, 2026-11-21:

- /dashboard/upgrade signed in as the e2e owner, 1280px and 390px: "Everything in …, plus:" cards, the compare grid, no em dashes, no sideways scroll.
- The demo storefront (12 photos) switched between plans on staging: Starter shows the chapters layout, Free the regular page. Previews need `?layout=chapters`, because the chapters flag is on in Production only.

## Not in This Ticket

- `types/index.ts` `Tier` still says `'free' | 'standard' | 'premium'` while the row holds plan slugs. Worth a small cleanup ticket.
