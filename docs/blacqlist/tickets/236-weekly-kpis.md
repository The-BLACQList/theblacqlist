# Ticket 236: Weekly Key Numbers Report

**Status:** PR open (`feat/weekly-kpis`). Merging needs the founder's OK (GATE-DEPLOY). Running it against production needs the founder, or their explicit OK in the session.

## Why

Next-actions 2026-11-20, item 4, from Studio's metrics plan (O6, "Weekly KPI query script, incl. retention", by D7). The founder said "yes" to starting it in Software's session on 2026-11-20. Until now the five launch numbers had no export: `/admin/analytics` shows totals and last-7-day counts only.

## What It Produces

`pnpm ops:kpis` (or `npx tsx scripts/ops/weekly-kpis.ts [--weeks=8] [--from=YYYY-MM-DD]`) reads production, read-only, and writes to the git-ignored ops folder:

- `docs/blacqlist/ops/reports/weekly-kpis-YYYYMMDD.csv`: one row per complete ISO week (Monday start, UTC). `week` is the Monday.
- `docs/blacqlist/ops/reports/weekly-kpis-YYYYMMDD.txt`: the summary lines, also printed.

The CSV imports with `metrics.py import <slug> <csv> --period-column week --map "metric=column,..."`. The summary names which columns are fully known (import as recorded facts) and which have UNKNOWN cells (use `--fact-class unknown` or leave out).

| Column | Number |
|---|---|
| `paying_starter` | Listings with a Starter plan paying at week end (active or past due) |
| `mrr_usd` | Sum of those plans' monthly price |
| `starter_new` | Starter plans that started that week (the retention cohort) |
| `starter_retained_d30_pct`, `starter_retained_d60_pct` | Share of that cohort still paying 30 / 60 days after starting |
| `claims_submitted`, `claims_approved` | Claims sent in, and listings whose claim was approved, that week |
| `claim_to_starter_pct` | Of the listings approved that week, the share that has paid for Starter to date |
| `visitors` | Always UNKNOWN (see Gaps) |
| `signups` and `signups_<channel>` | New accounts, split into flyer, invite, social, search, referral, partner, direct, other |
| `saves_net`, `saves_gross` | Saves still kept today, and save clicks from events |

**Channel order:** campaign tags first, then the referring site (social and search lists, anything else is referral), then the stored `signup_source` (flyer, invite), else direct. Tags that match no rule count as `other`.

## Who Is Left Out

From the first run, every number leaves out:
- testers: anyone in `tour_enrollments` or `tester_invites`, or with `signup_source = 'tester_link'`;
- the team: `user_roles` admin or super_admin.

Item 3 (yearly MRR fix and tester filter) will reuse the same rule.

## Gaps (Printed as UNKNOWN, Never 0)

- **visitors:** Vercel Web Analytics has no export. Read it in the Vercel dashboard.
- **signups_social, _search, _referral, _partner, _direct, _other:** UNKNOWN for weeks starting before 2026-11-20, when source capture shipped (#363, bcfb31a). Before then only flyer and invite were recorded. The week of 2026-11-16 is therefore UNKNOWN for those columns; 2026-11-23 is the first full week.
- **saves_net** is a net count (unsaving deletes the row). `saves_gross` comes from `save_toggled` events.
- **mrr_usd:** yearly plans count at the monthly rate until item 3 ships.
- **Paying, MRR and retention** are rebuilt from today's subscription state. There is no status history, so a plan that was past due and recovered counts as paying throughout. Trials (testers only) and unfinished checkouts never count.
- **Retention** is UNKNOWN until every member of that week's cohort has reached the day, and when the cohort is empty.
- **claim_to_starter_pct** is UNKNOWN when no claims were approved that week. It can rise in later runs as businesses pay.

If a table fails to read, the summary names it and the script exits 2.

## Changes

1. `lib/ops/weeklyKpis.ts` (new, pure): weeks, `channelOf`, `buildWeeklyKpis`, `toCsv`, `knownColumns` / `unknownColumns`, `summaryLines`.
2. `scripts/ops/weekly-kpis.ts` (new): paginated read-only selects of subscriptions, plans, claims, saves, `save_toggled` events, tester and role tables, and auth users (`listUsers`). Modelled on `metrics-pull.ts`; exits 1 without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. `package.json`: `ops:kpis`.

No migration, no app change, nothing user-facing.

## Tests

`tests/weekly-kpis.test.ts` (20): ISO weeks and `--from`; channel rules and the pre-capture null; paying at week end, one per listing, canceled plans dropping off; UNKNOWN MRR on a missing price; testers and team left out of every number; day-30/60 cohorts and the not-yet-reachable case; claims and conversion; UNKNOWN channels before capture and visitors always; net vs gross saves; CSV shape; known vs UNKNOWN columns; the summary naming every gap with no em dashes.
