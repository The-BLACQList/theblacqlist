# Ticket 155: Close roles on their closing date, keep the page up

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 151 (page shows the closed banner), 150 and 149 (board and card already hide/dim past-date roles at read time). Merge last.
**Gates:** **GATE-DATA: this ticket has a migration.** Staging first, down plan below, founder approval before prod (CLI is linked to prod; apply by hand, migrate before merge). Stays inside the cron that already runs. No new dependency.
**Decision record (founder, 2026-10-30, Q1 and Q2):**

1. **Default `closes_at` to 30 days after the role goes live.** The poster can change it.
2. **A nightly sweep moves closed roles off the board and search.** The page stays up with "Applications closed on {date}" so shared links still work.

---

## Why

Two things in the code stop Q1 and Q2 from working as written.

1. **There is no "closed" state.** Board and search are filtered on `listings.status = 'published'` (the `search_listings_faceted` RPC and its fallback in `lib/listings/facets.ts`). The only job sweep, `unpublishExpiredJobPostings` in `lib/services/expiry/sweeps.ts`, sets `status = 'unpublished'`, which 404s the page and breaks shared links. It also ignores `closes_at` completely; it only looks at the 30-day paid window.
2. **The 30 days start at the wrong time.** `job_posting_purchases.expires_at` is stamped at submit or payment (`jobPostingExpiryFrom`), not when the role goes live. Moderation takes 3 to 5 business days, so a role could lose days of its window, or be unpublished by the ledger sweep before its own `closes_at`.

## Scope

In:

- **Migration `supabase/migrations/20261031000000_listings_closed_status.sql`** (name by merge date):
  - Drop and re-add the `listings.status` CHECK to include `'closed'` (list from `20260813020000_listings_rejected_status.sql` plus `closed`).
  - Add an index `listing_details_job_closes_at_idx ON listing_details_job (closes_at) WHERE closes_at IS NOT NULL`.
  - Extend the anon read policies so a `closed` **job** stays readable by direct URL: on `listings` add `OR (status = 'closed' AND entity_type = 'job')` to the anon and authenticated public-read policies, and the same on `listing_details_job` ("anon read published" and "authenticated read"). The builder must read the live policy names first; do not guess.
  - Board, search, `search_listings_faceted`, sitemap and counts need **no change**, because they already require `status = 'published'`. That is the reason for a new status rather than a new column.
  - **Down plan** (`..._down.sql` kept in the PR description, not run automatically): set every `closed` listing back to `published` only if its `closes_at` is in the future, otherwise to `unpublished`; drop the index; re-create the previous CHECK and policies. Run on staging first, verify, then prod after the founder says go.
- **Sweep.** New `closeExpiredJobs()` in `lib/services/expiry/sweeps.ts`, copied from the shape of `unpublishPastEvents`: select published jobs whose `listing_details_job.closes_at < now()`, update `status = 'closed'`, write a `writeSystemAuditLog` row per listing (`beforeState: published`, `afterState: closed`, reason `closes_at passed`). Idempotent, batch limit with a log of the count. Call it from `app/api/cron/expiry/route.ts` independent of `paidPostings` (closing is not a payment concern).
- **Change `unpublishExpiredJobPostings`.** When every paid window has lapsed it now sets `closed` (not `unpublished`) and ignores a role whose `closes_at` is still in the future. Net effect: the page never disappears at the end of a window.
- **Default `closes_at` at go-live.** In `lib/actions/admin/approveEntity.ts`, when a job moves to `published` and `closes_at` is null, set `closes_at = now() + JOB_POSTING_DURATION_DAYS` (`lib/stripe/jobPostings.ts`). If the poster set a date, keep it. Also re-stamp the ledger `expires_at` to `published_at + 30 days` for the paid or entitlement row so the two clocks agree. Assumption, flag for the founder: a poster-chosen `closes_at` longer than the paid 30 days is allowed but the role still closes at the earlier of the two. Say so in the dashboard editor help text only if the builder finds it already shows the window; do not add new UI here.
- **Reopen.** An owner extending `closes_at` into the future on a `closed` role (dashboard `JobDetailsSection`, `updateJobDetails`) moves it back to `published` only if a valid paid or entitlement window covers the new date; otherwise it stays closed and the editor tells them a new posting is needed. Keep this to a small guard plus one test; no new screen. If it grows, split it out as ticket 156.
- Page/JSON-LD: `entityPage.ts` must load `closed` jobs for the public page (status in `published`, `closed` for `entity_type = 'job'` only); `buildJobPostingJsonLd` keeps `validThrough`.
- Admin queue: `closed` roles do not show in the pending list; `rejected`/`closed` filters in `app/admin/entities` get a "Closed" option if status filters are listed there (check; skip if not).

Out:

- Emailing posters before or after close ("your role closes in 3 days").
- Bulk reopen, archive, or delete of old roles.
- Changing the free-month or event sweeps.
- A new `closed_at` column (the audit log carries the time).

## Acceptance criteria

- Given a published job with `closes_at` yesterday, when the cron runs, then its status becomes `closed`, it is gone from `/jobs`, from search and from the home count, and one audit row exists.
- Given that job's URL, then it returns 200 and shows "Applications closed on {date}" with no apply action.
- Given a published job with `closes_at` tomorrow, then the cron does not touch it.
- Given the cron runs twice, then the second run changes nothing and logs 0.
- Given a job approved by an admin with no `closes_at`, then `closes_at` is 30 days after approval and the ledger `expires_at` matches.
- Given a job approved with a poster-set `closes_at`, then it is left as is.
- Given a paid window that has lapsed and `closes_at` still in the future, then the role stays published.
- Given a lapsed paid window, then the role becomes `closed` not `unpublished`, and its page still loads.
- Given an anonymous visitor and a `closed` event or business listing, then they still get 404 (policy change is job-only).
- Given the cron has `paidPostings` off, then `closeExpiredJobs` still runs.
- Between runs (up to 24 hours) a past-date role may still be `published`; the card and page already treat a past `closes_at` as closed (149, 151), so visitors never see an open-looking expired role.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Sweep query errors | Cron logs the error, other sweeps still run, route returns its normal summary with the failure listed | Next night retries |
| Partial update | Each listing updated and logged on its own; an error on one does not stop the rest | Next night picks up the rest |
| Migration fails on staging | Nothing else deploys | Fix and re-run; down plan as above |
| Policy mistake exposes non-job closed rows | Caught by the anon-404 test; migration is not applied to prod until that test passes | Down plan |

## Edge cases

- `closes_at` set in a non-UTC date input: the existing `new Date(closesAtRaw).toISOString()` stores UTC midnight of the chosen day, so a role closes at the start of that day in UTC. Keep it and show the date part in UTC. Flag for review: a poster in a far time zone may see the role close up to a day earlier than they expect; moving it to end of day is a one-line change if the founder wants it.
- A job re-approved after being rejected: `closes_at` default applies only if still null.
- Hiring business unpublished: role is unaffected by the sweep.

## Data note

**Migration: yes** (status CHECK, one partial index, four policy changes). GATE-DATA. Backfill: none required; any already-expired `published` job is closed by the first cron run. Staging first, run the anon-404 test, then prod by the Management API route used for other prod migrations.

## Tests

- Unit (`tests/job-close-sweep.test.ts`): closes past, ignores future, ignores null `closes_at`, idempotent, audit row written, ledger sweep sets `closed` and respects a future `closes_at`.
- Unit: approval sets the default only when null and re-stamps the ledger.
- Migration test (`tests/migrations/job-closed-status.test.ts`, same style as `tests/migrations/job-entity.test.ts`): CHECK accepts `closed`; policy text allows jobs only.
- Existing `tests/job-posting-purchase.test.ts` and `tests/job-status-guard.test.ts` updated where they assert `unpublished`.
- Playwright: closed job page returns 200 with the banner, is absent from the board. `e2e/opening-soon.spec.ts` green with the flag off.

## QA notes

On staging set one job's `closes_at` to yesterday, call the cron route with the secret, and check board, search, home count, direct URL and the audit log. Then run the down script on a copy and confirm it restores state.
