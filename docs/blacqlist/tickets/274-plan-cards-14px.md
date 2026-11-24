# Ticket 274: 14px Minimum in the Plan Cards

**Status:** Merged #407, 2026-11-24.

## Why

DR-007 (approved 2026-11-24) keeps 14px as the smallest text on For Business. The plan cards are shared with Pricing, so they were left out of ticket 240 and still had 10px and 12px text. The founder OK'd opening this ticket on 2026-11-24.

## What Changed

| Text | Before | After |
|---|---|---|
| Most Popular badge, tagline, "2 months free", fine print, "Tell Us You Want …" link | 12px | 14px |
| Savings badge on the Monthly / Annual switch | 10px | 14px |

- Four cards across (1024 to 1279px) is narrow enough to wrap the longest tagline at 14px. Each tagline holds two lines there, so the prices stay level.
- The Monthly / Annual switch is shared, so its badge also grows on the dashboard Upgrade page.
- No wording, prices or plan rules change.

## Checks

- `e2e/for-business-brand.spec.ts`: the size check now includes the plan cards, plus a new test for the yearly view. All 17 pass locally; the size tests fail on the old sizes. CI's e2e job does not run this spec.
- Browser at 375, 768, 1024 and 1280, with made-up plan data (Starter and Growth buyable, Premium Coming Soon): no text under 14px in the cards on For Business, monthly and annual. No sideways scroll on either page. Prices level at 1024, 1100, 1180 and 1280.

## Not in This Ticket (Ticket 275)

- Pricing outside the cards: the compare table (11px notes, 12px group names) and the 12px labels.
- The dashboard Upgrade cards (`UpgradePlans.tsx`), which still have 11px and 12px text. Not opened in a browser here.
