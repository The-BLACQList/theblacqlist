# Ticket 253: Business Home

**Status:** PR open, 2026-11-21. Builds on 252 (merged #382). Founder OK to merge: "merge both".

## Why

The founder (2026-11-21): "The home page feels useless since I'm switching between pages in the left panel. Make it more useful to a business owner at first glance."

The old /dashboard listed every page as a card with a completeness checklist. It showed no numbers and nothing waiting. Once 252 put the page switcher in the menu, Home repeated what the menu already said.

## What Changed

Home is now about the one page picked in the menu. It uses the same choice as the rail: the `blacq-page` cookie, else the newest page. Top to bottom:

1. **Page header** (black, gold node): "Your Business", the page name, Live or In Review, the plan, and **View Live Page** and **Edit Page** buttons.
2. **Needs You:** only real work, newest first in importance:
   - Your Page Is in Review (pending pages)
   - Answer Messages (unread, when messaging is on)
   - Reply to Reviews (published reviews with no reply; links to the reviews on the live page, where owners reply)
   - Verify Receipts (this page's, when receipt review is on)
   - Nothing waiting reads "You're All Caught Up", never a row of zeros.
3. **Last 30 Days:** Views, Taps and Saves, each with a small daily line, and **Open Insights**.
   - The totals use the same counts as Insights (`lib/analytics/pageCounts.ts`, pulled out of the Insights page), with storefront clicks added to Taps, so the two pages agree.
   - The daily lines come from the nightly rollup. Days with nothing count as 0.
   - **Free pages** see a locked preview with sample bars, no figures, and **See Plans**. Nothing is read for a Free page.
4. **What Your Numbers Say** (Explain My Numbers, ticket 138), when the plan has AI help.
5. **Finish Your Page:** progress (4 of 6 Done), the next step as the button, and See All Steps. Hidden once the page is complete.
6. **Quick Actions:** Add Photos, Post an Update (when Happening Now is on), Products and Services, Set Special Hours.
7. Write with AI, Post a Job and the plan strip, as before. Write with AI keeps 242's wording ("Up to N times a month"), never "drafts".
8. Owners with more than one page get a line pointing to the menu and All My Pages.

Owners with no pages see "My Business" and the Get Listed card, as before.

**Insights:** the page heading now reads "Insights", matching the menu. The full Insights restyle is a follow-up.

### Files

- `lib/dashboard/home.ts` (new, pure): Needs You items, the checklist, status words, daily series, sparkline points, number format.
- `lib/dashboard/homeData.ts` (new): the 30-day snapshot and reviews waiting for a reply.
- `lib/analytics/pageCounts.ts` (new): the period counts shared by Home and Insights.
- `components/dashboard/home/*` (new): BusinessHeader, NeedsYou, Snapshot (and LockedSnapshot), FinishYourPage, QuickActions, WriteWithAi.
- `app/dashboard/page.tsx`: rewritten around the chosen page.

## Tests

- `tests/business-home.test.ts` (new):
  - Needs You order, wording, counts and links; nothing waiting gives an empty list;
  - the checklist; status words; number format;
  - daily series fill and sparkline points;
  - Free reads no analytics, and the locked preview has no digits in its text;
  - Home picks the page the same way as the menu;
  - Home and Insights share the counts;
  - no em dashes, no "drafts", no bare "BLACQList".
- `e2e/cross-browser.spec.ts` E: the owner lands on Business Home (`business-home`), not a "Dashboard" heading.
- `e2e/owner-dashboard.spec.ts` TA-16: the Insights heading.

## Verification

Local, staging data, 2026-11-21:

- **Unit tests:** 5573 passed. Typecheck and lint are clean.
- **Playwright** (owner-dashboard, cross-browser, a11y, contrast, keyboard-a11y, chromium): 53 passed. These failures were already there before this change:
  - TA-11 and TA-12: the editor's save bar (logged on 252).
  - 098: the Team "Owner" label contrast (logged on 252).
  - Cross-browser C: Add Business does not show "Not Black-owned? List as an Ally" for the signed-in owner. It fails the same way with this change stashed. New follow-up.
  - Ticket 185 logo upload failed once under load and passed when run alone.
- **Screenshots** at 1280 and 375, owner on a Starter page: no sideways scroll; the three tiles sit side by side on phones.

## Not in This Ticket

- The Insights restyle (tiles and charts in the Home style).
- The account overview's "Your business" block (252 note).
