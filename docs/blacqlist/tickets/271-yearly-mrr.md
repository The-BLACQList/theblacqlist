# Ticket 271: Yearly Plans in Monthly Revenue

**Status:** Merged #402 (`97aaf3a`), 2026-11-23. The failed-read follow-up below (`fix/271-weekly-read-errors`) is in its own PR.

## Why

Next-actions 2026-11-20, item 3 (by D30). Founder, 2026-11-23: "how yearly plans count in monthly revenue. Let's take care of this task first."

Both reports counted a yearly Starter at $19 a month. The owner pays $182 a year, which is $15.17 a month, so revenue read too high. `metrics-pull.ts` also counted tester and team accounts, and the two reports followed different rules.

Founder picks (2026-11-23):

- **Failed cards:** past-due plans count in both reports. The metrics pull also shows how much of the total is past due.
- **Plans counted:** monthly revenue covers all paid plans. Paying, new and retention columns stay Starter only.

## The Rule

| Question | Answer |
|---|---|
| Monthly or yearly? | Length of the saved Stripe billing period: up to 62 days is monthly, 300 days or more is yearly |
| Yearly plan | `price_yearly` / 12, added unrounded; the total is rounded once |
| Paying | Active or past due. Trials, unfinished checkouts and ended plans do not count |
| Counted per | Subscription, because each one is billed. `paying_starter` is still one per page |
| Cycle, price or plan not known | The whole total is UNKNOWN, never a guess and never 0 |
| Left out | Testers and the team (the [236](236-weekly-kpis.md) rule) |

`subscriptions` has no billing-cycle column. The webhook already saves the period dates, so no migration is needed.

## Changes

1. `lib/ops/revenue.ts` (new, pure): the rule above, shared by both reports.
2. `lib/ops/weeklyKpis.ts`, `scripts/ops/weekly-kpis.ts`: `mrr_usd` covers all paid plans; the gap line states the new rule.
3. `scripts/ops/metrics-pull.ts`:
   - subscriptions are read in pages and show the total, the past-due part, and monthly / yearly / unknown counts;
   - testers and the team are left out of sign-ups, subscriptions and named events. Signed-out events stay in;
   - if a tester or team read fails, those three go under `unknown` instead of being printed unfiltered;
   - a count that comes back empty is recorded as unknown, not 0.

No migration, no app change, nothing user-facing.

## Limits

- Page views, top listings and top searches are stored as totals, so testers cannot be taken out of them. The metrics JSON says so (`left_out.not_filtered`).
- Past weeks use today's billing cycle and price. An owner who moves from monthly to yearly shows as yearly in earlier weeks too.
- Discounts, proration, tax and Stripe invoices are not read.
- The weekly report printed numbers after a failed read. Fixed in the follow-up below.

## Tests

`tests/ops-revenue.test.ts` (new): 28 to 366-day periods and missing dates; yearly Starter 15.17, two yearly 30.33; mixed cycles; UNKNOWN cases; past due, trials, Free, testers; both scripts use the shared rule. `tests/weekly-kpis.test.ts`: Growth counts as money but not as paying Starter; yearly plans; UNKNOWN on a missing cycle or plan.

**Smoke run (2026-11-23):** both scripts ran against a local stub with made-up rows, including more than 1,000 subscriptions, a failed tester read and an empty count. Monthly, yearly and past-due rows gave $73.33 in both reports, as worked out by hand (19 + 182/12 + 470/12). No real data was read.

## Follow-Up: Failed Reads in the Weekly Report

Founder, 2026-11-23: "fix the gap". When a table failed to read, `weekly-kpis.ts` said so and exited 2, but still wrote the numbers and could list them as fully known. A failed tester read left tester money in the total.

Now every number that depends on a failed read is UNKNOWN (`withFailedSources` in `lib/ops/weeklyKpis.ts`):

| Failed read | Made UNKNOWN |
|---|---|
| Auth users, tester tables, team roles | Every number: testers could not be left out. The account count and the campaign sources are not printed |
| Plans, subscriptions | Paying, MRR, new, retention, claim to Starter |
| Claims | Claims submitted, approved, claim to Starter |
| Saves / save events | `saves_net` / `saves_gross` |

It still exits 2 and names the failed read. The three tester and team reads are now ordered, so paging is stable.
