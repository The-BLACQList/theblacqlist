# Ticket 241: Advanced Analytics on Growth and Up

**Status:** In review on `feat/241-advanced-analytics`. Migration `20261203000000_owner_listing_insights.sql` applied on staging 2026-11-21 (founder OK); prod at merge, with the founder's OK.

## Why

Founder, 2026-11-21, looking at the plans side by side: Growth and Premium's "advanced analytics" was not stated anywhere, and it was only longer history. Decision the same day: **build what we can track now**. Shop sales, orders and payouts come when Shop opens.

## What Growth and Premium Get

| Section | What | When It Shows |
|---|---|---|
| Compare | ▲ or ▼ and a percent on Page Views, CTA Clicks, Saves and Shares, against the period just before | 7, 30 and 90 days. Not on 12 months: that would need 24 months, more history than the plan holds. No arrow when the period before had nothing |
| Storefront | Item views, item clicks, click rate, and the top 5 items with views, clicks and rate | Only while the marketplace is open (`FEATURE_MARKETPLACE_OPEN`, off in prod) and the page has products or services |
| Events and Jobs | Views and taps for each event or job this owner posted from the page | Only when there are some. Other owners' events that name the page as host are left out |
| Longer history | 90 days and 12 months | Unchanged since ticket 105 |

Starter keeps its dashboard and gets one card, **Advanced Analytics Comes with Growth**. It lists only what Growth shows today (storefront line only while the marketplace is open, jobs only while job posting is open), links to Upgrade, and shows only while Growth or Premium is for sale. A closed tier lists nothing.

## Tracking Fixes Found on the Way

1. **Storefront clicks were never recorded.** `/api/marketplace/cta-click` used `void serviceClient.from('analytics_events').insert(...)`. A PostgREST builder only sends when awaited, so it built the request and dropped it, and still answered 200. Same bug `/api/analytics/event` had until 2026-08-11. Now `trackServerEvent`.
2. **"From marketplace" was always 0.** The analytics page counted storefront clicks under RLS, and the owner read policy only covers entity_type `'listing'` rows. Now the count comes from the new function, for every paid plan, and reads "from your storefront".
3. **Product and service views were never sent.** `marketplace_product_viewed` was declared but nothing emitted it. The product and service pages now send it from the server, one per open. Their dead `revalidate = 1800` came off: the root layout reads cookies, so they render per request anyway (same note as the listing page).

## How the Numbers Are Read

New `owner_listing_insights(p_listing_id, p_since, p_until)`, SECURITY DEFINER:

- Checks that the caller owns the listing, else `not authorized`.
- Attributes rows by joining the real tables: `marketplace_products.listing_id`, `marketplace_services.listing_id`, `listing_details_event.organizer_listing_id`, `listing_details_job.hiring_listing_id`. Never the visitor-sent `properties.listing_id`.
- Events and jobs only when the same owner owns them.
- Groups in the database, so PostgREST's 1000-row cap can't cut a count short.
- REVOKE from PUBLIC and from anon (Supabase grants new functions to anon directly), EXECUTE for authenticated. Read only, additive. Down plan: `DROP FUNCTION IF EXISTS owner_listing_insights(uuid, timestamptz, timestamptz);`

Widening the RLS policy to match `properties->>listing_id` was rejected: it would let a visitor-supplied JSON field grant read access.

## Plan Copy

| Where | Before | After |
|---|---|---|
| Growth card (`lib/stripe/plans.ts`) | Analytics going back 12 months (Starter has 30 days) | Advanced analytics: 12 months (Starter has 30 days), each number compared with the period before, and numbers for your events and jobs |
| Compare grid (`lib/stripe/planCompare.ts`) | | New rows "Compared with the period before" and "Numbers for your events and jobs", both from `gate('analytics_advanced')` |
| /pricing FAQ and subtitle | 12 months of analytics | advanced analytics over 12 months, compared with the period before, plus events and jobs |
| Cue help (`lib/ai/cue/owner/help.ts`) | | One line on what Growth and Premium add |

Storefront item numbers are not in any plan line: they only show while the marketplace is open, and a plan line has to be true today. Add them to the copy when the marketplace opens.

## Tests

- New `tests/advanced-analytics.test.ts`: the gate, `canCompare` (no 12-month compare, Starter never past 30 days), `periodChange` rounding and the no-arrow-from-0 rule, text that never relies on colour, the Storefront and Events and Jobs summaries, the locked card lines, the migration's ownership check and joins, the click route really recording (and recording nothing on a bad request), and the view events on both item pages.
- Updated: `plan-compare` (two new rows match the gate; dropped while Growth and Premium are closed), `plan-copy` (Growth line).

## Verification

`npm run typecheck` clean, lint clean on the changed files, `npx vitest run` 5,518 passed.

Staging, 2026-11-21, inside a rolled-back transaction: the demo page's owner gets its 8 items (5 products, 1 service, 2 jobs); another signed-in user gets `not authorized`; anon gets `permission denied`.

Still to do:

1. A Preview: the demo storefront on Starter (locked card) and on Growth (arrows, Events and Jobs), at 1280px and 390px. Open a product page twice and check two `marketplace_product_viewed` rows (needs the marketplace flag on for that Preview).
2. Prod migration at merge (founder OK).

## Not in This Ticket

- Shop sales, orders and payouts (when Shop opens).
- The nightly rollup still counts listing rows only, so the trend charts don't include storefront clicks. That is by design (see the comment above the CTA chart).
