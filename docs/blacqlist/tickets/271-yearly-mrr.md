# Ticket 271: Yearly Plans in Monthly Revenue

**Status:** In review (`fix/271-yearly-mrr`). Merging needs the founder's OK. Not yet run on production data: that needs the founder, or their explicit OK in the session.

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
- **Found, not fixed here:** when a table fails to read, `weekly-kpis.ts` names it, says the numbers are not trustworthy and exits 2, as 236 designed. It still writes the CSV, though, and can list those columns as fully known. With a failed tester read that includes tester money. Do not import a run that exits 2.

## Tests

`tests/ops-revenue.test.ts` (new): 28 to 366-day periods and missing dates; yearly Starter 15.17, two yearly 30.33; mixed cycles; UNKNOWN cases; past due, trials, Free, testers; both scripts use the shared rule. `tests/weekly-kpis.test.ts`: Growth counts as money but not as paying Starter; yearly plans; UNKNOWN on a missing cycle or plan.

**Smoke run (2026-11-23):** both scripts ran against a local stub with made-up rows, including more than 1,000 subscriptions, a failed tester read and an empty count. Monthly, yearly and past-due rows gave $73.33 in both reports, as worked out by hand (19 + 182/12 + 470/12). No real data was read.
