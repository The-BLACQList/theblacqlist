# Ticket 275: 14px Minimum on Pricing and Upgrade

**Status:** In review, 2026-11-24.

## Why

Ticket 274 set 14px as the smallest text in the plan cards. Asked whether to apply it to the compare table, the other small labels on Pricing and the Upgrade page, the founder said yes (2026-11-24).

## What Changed

- **Compare table** (Pricing and Upgrade): notes, "Coming Soon" and "Your Plan" 11px → 14px; group names and the corner label 12px → 14px.
- **Pricing:** the two Coming Soon labels and "For Brands & Organizations" 12px → 14px.
- **Upgrade:** plan cards, Your Free Month, Pages on Your Plan and error messages, 11px and 12px → 14px.
- **Upgrade cards are two across from 1024 to 1279px** (was four). Beside the menu, four left about 130px for text. From 1280px they are four across as before.

The footer, the site header and the signed-in menu are not plan text and are unchanged. No wording, prices or plan rules change.

## Checks

- `tests/plan-text-size.test.ts` (runs in CI) fails on any size class under 14px in these files. 10 of its 15 tests fail on the old sizes.
- Browser at 375, 768, 1024 and 1280, monthly and annual: Pricing itself, and the Upgrade pieces on a temporary page with made-up data (Free, Starter and Growth owners; free month waiting or pick a page). No visible text under 14px, no sideways page scroll, prices level in each row.
- The real signed-in Upgrade page was not opened.
- On a phone the compare table still scrolls inside its own box (600px wide).
