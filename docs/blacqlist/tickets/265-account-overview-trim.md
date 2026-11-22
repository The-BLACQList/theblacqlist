# Ticket 265: Trim the Account Overview's Business Block

**Status:** Merged #396 (`613632d`), 2026-11-21. Follows 252 and 253.

## Why

Since 252 and 253, owners have a "Your Business" group in the menu and a Business Home. The account overview still had its own large dark "Your business" slab: the page name, the trust tier, View Page and Manage My Page. It repeated Business Home and was the heaviest thing on the page. The founder (2026-11-21): "then trim the account overview".

## What Changed

- **Owners:** the dark slab is now a short "Your Business" list in the same style as Your Activity and Your Contributions.
  - **Business Home** (→ /dashboard). It shows the page name, or "2 pages" when the owner has more than one.
  - **View My Page** (→ the public page). Only shown for one page, since a multi-page owner picks the page in the menu.
- The trust tier line is gone from this page. Business Home and the page itself show it.
- The owned-pages query now reads every page the owner has, newest first (the same order as Business Home), instead of one.
- **Non-owners:** the "Own a Business?" claim card is unchanged.

## Tests

- No new test. The change is layout and links on one server page; nothing else depends on the old block.

## Verification

Local, 2026-11-21, against staging data:
- Unit tests: 5906 passed. Typecheck clean. Lint clean on the page.
- Screenshots at 375px and 1280px as the e2e owner: the list sits under the two row lists and matches them.

## Not in This Ticket

- The rest of the account overview (greeting, stats, saved, The Collective).
