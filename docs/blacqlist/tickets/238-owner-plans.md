# Ticket 238: Owner-Level Plans

**Status:** PR open (`feat/238-owner-plans`). Merging needs the founder's OK (GATE-DEPLOY). The migration runs on staging, then production, only with the founder's OK; staging gets a dry run first (`BEGIN; <migration>; ROLLBACK;`) to read the backfill's NOTICE lines.

## Why

Founder, 2026-11-21: a plan belongs to the **owner**, not to one page. It covers Free 1 page, Starter 1, Growth 2, Premium up to 3, and the covered pages can be any of the owner's pages (locations of one business or separate businesses). Only pages linked as locations show each other under "Also At". Ticket 237 (#366) put the plan strip on the dashboard; this ticket moves billing underneath it.

A Free owner can keep extra pages. We don't state that anywhere: no UI copy and no Terms line (founder 2026-11-21).

## What Changed

| Phase | Commit | What |
|---|---|---|
| 1 | c31c823 | Migration `20261201000000_owner_plan_pages.sql`: `plan_covered_pages`, `sync_owner_plan_tiers`, `set_plan_page_coverage`, backfill. `subscriptions.listing_id` nullable, ON DELETE SET NULL |
| 2–3 | dcc509c | Stripe webhook syncs the owner's plan (`syncOwnerPlan`) instead of one page's tier |
| 4 | 7b05d8a | Checkout, portal, free month and upgrade tour are per owner. Checkout refuses a second live plan (`SUBSCRIPTION_EXISTS`) |
| 5 | b3a5002 | Location links are display only; they no longer write tiers |
| 6 | 4d4557f | Pages on Your Plan on `/dashboard/upgrade` (`setPlanPagesAction`), "N of M Pages Covered" on the strip |
| 7 | this | Plan copy ("Covers up to N of your pages"), Terms 13.1, 13.4, 13.7, docs |

`listings.tier` stays a per-page copy. Only `sync_owner_plan_tiers` writes it, so search ranking, RLS and the code that reads it don't change.

## Defaults to Confirm (Flagged in the PR)

1. **Terms change takes effect on posting, no email.** Same as ticket 144 (section 13 was posted that way on 2026-10-29). Counsel question L11 in `legal/subscription-terms-draft-2026-10.md` covers it.
2. **No cooldown on moving the plan between pages.** Every add and remove is audit-logged (`plan_page_covered`, `plan_page_uncovered`) and rate-limited (20 a minute).

## Known Risk

An owner who has billing **and** a page the platform set to a paid tier by hand, beyond their plan's cap, will see that page go to Free when the migration runs. The staging dry run's NOTICE lines list every owner the backfill touches; check them before production.

## Not in This Ticket

- Deleting an account doesn't cancel its Stripe subscription (`lib/actions/account/deleteAccount.ts`), though Terms 13.9 says it does. Separate ticket.
