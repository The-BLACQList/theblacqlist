# Ticket 082: Entity analytics daily aggregation — Supabase scheduled Edge Function

## Status

Draft

## Phase

Phase 16: Analytics and Reporting

## Priority

P2

## Feature Area

Analytics

---

## Context

The `analytics_events` table (Ticket 012, Ticket 049) accumulates raw event rows — one row per page view, CTA click, save, share, and search impression. Querying raw events for owner dashboards would be slow and expensive at scale. This ticket creates a Supabase Edge Function (`aggregate-analytics`) that runs nightly at 2:00 AM UTC via `pg_cron` and pre-aggregates yesterday's events by listing into `entity_analytics_daily`. The aggregation result is an UPSERT so the function is fully idempotent — re-running for the same date always produces the same result.

This is a pure backend / infrastructure ticket. No user-facing UI changes. The aggregated data produced here powers Ticket 083 (owner analytics dashboard).

Source documents: `docs/blacqlist/architecture/production-architecture.md` §§ 3 (Background Jobs), 11 (Analytics Architecture); Ticket 012 (analytics tables); Ticket 049 (analytics event ingestion API).

---

## User Story

As a business owner, I want my analytics dashboard to show accurate daily metrics without the page being slow to load, so that I can quickly understand how my listing is performing.

---

## Scope

**In scope:**

- Supabase Edge Function at `supabase/functions/aggregate-analytics/index.ts`; uses the Supabase service_role client (via `SUPABASE_SERVICE_ROLE_KEY` env var, available to Edge Functions as a built-in Supabase secret)
- Aggregation logic: for each `listing_id` with events on `yesterday` (`NOW() - INTERVAL '1 day'` truncated to the day in UTC), compute counts by event type: `page_views`, `cta_clicks`, `saves`, `shares`
- Search impressions aggregation: count `search_events` rows where `listing_id` is not null and `created_at::date = yesterday` — write to `entity_analytics_daily.search_impressions`
- UPSERT pattern: `INSERT INTO entity_analytics_daily (...) VALUES (...) ON CONFLICT (listing_id, date) DO UPDATE SET page_views = EXCLUDED.page_views, ...` — idempotent by design
- Error isolation: if processing one `listing_id` fails, log the error and continue with the next — one bad listing must not abort the entire nightly job
- Scheduled job registration: `pg_cron` job configured to call `net.http_post(...)` hitting the Edge Function's URL at `0 2 * * *` UTC (2:00 AM daily)
- `entity_analytics_daily` table: verify it has a `UNIQUE (listing_id, date)` constraint; add migration if missing
- Job run log: write a row to a new `analytics_job_log` table on each run with `run_date`, `listings_processed`, `errors`, `duration_ms`, `status` (`'success'` / `'partial'` / `'failed'`)

**Out of scope:**

- Real-time analytics aggregation (deferred)
- Hourly aggregation (deferred)
- Owner-facing analytics dashboard UI (Ticket 083)
- Search query aggregation for admin search analytics (Ticket 085)

---

## Dependencies

| Dependency                                              | Type                   | Status                                                                            |
| ------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| Ticket 012: Analytics and audit tables migration        | Blocking ticket        | In Progress                                                                       |
| Ticket 049: Analytics event ingestion API               | Blocking ticket        | In Progress                                                                       |
| `UNIQUE (listing_id, date)` on `entity_analytics_daily` | Database constraint    | Must exist before UPSERT works                                                    |
| `pg_cron` extension                                     | Supabase configuration | Must be enabled on production Supabase project (verify in Dashboard → Extensions) |
| Supabase Edge Functions deployment                      | Infrastructure         | Supabase CLI required                                                             |

---

## UX Notes

This ticket has no user-facing UI. The outputs are rows in `entity_analytics_daily` consumed by Ticket 083.

---

## Design Notes

No UI in this ticket.

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `analytics_events`, `search_events`, `entity_analytics_daily`
- **Entities involved:** `analytics_events`, `search_events`, `entity_analytics_daily`, `analytics_job_log` (new)
- **Operations:**
  - `SELECT` aggregate counts from `analytics_events` WHERE `created_at::date = [yesterday]` GROUP BY `listing_id`, `event_name`
  - `SELECT` count from `search_events` WHERE `listing_id IS NOT NULL` AND `created_at::date = [yesterday]` GROUP BY `listing_id`
  - `INSERT ... ON CONFLICT (listing_id, date) DO UPDATE` into `entity_analytics_daily`
  - `INSERT` into `analytics_job_log`
- **Migration required:** Yes — two migrations:
  1. `add-unique-constraint-entity-analytics-daily.sql` — `ALTER TABLE entity_analytics_daily ADD CONSTRAINT entity_analytics_daily_listing_date_uniq UNIQUE (listing_id, date)` if not already present
  2. `create-analytics-job-log.sql` — new table `analytics_job_log` with columns `id uuid PK`, `run_date date`, `listings_processed int`, `errors int`, `duration_ms int`, `status text`, `created_at timestamptz`
- **RLS policies:** Edge Function uses service_role — bypasses RLS; no RLS policy required for `analytics_job_log` (admin-only via service_role)

---

## API Notes

- **No public API endpoints in this ticket.** The Edge Function is invoked by the `pg_cron` scheduler, not by client requests.
- **Edge Function invocation URL:** `https://[supabase-project-ref].supabase.co/functions/v1/aggregate-analytics`
- **Auth:** Edge Function validates the `Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]` header passed by the `pg_cron` job invocation; reject any unauthenticated call with a 401
- **pg_cron configuration:**
  ```sql
  SELECT cron.schedule(
    'aggregate-analytics-daily',
    '0 2 * * *',
    $$SELECT net.http_post(
      url := 'https://[project-ref].supabase.co/functions/v1/aggregate-analytics',
      headers := '{"Authorization": "Bearer [service_role_key]", "Content-Type": "application/json"}',
      body := '{}'
    )$$
  );
  ```
  The service role key in the cron expression is stored in Supabase Vault, not hardcoded inline.

---

## Implementation Notes

**Files to create:**

- `supabase/functions/aggregate-analytics/index.ts` — Deno Edge Function; exports `serve()` handler
- `supabase/migrations/[timestamp]_add-unique-constraint-entity-analytics-daily.sql`
- `supabase/migrations/[timestamp]_create-analytics-job-log.sql`

**Files to modify:**

- `supabase/config.toml` — add `[functions.aggregate-analytics]` entry if needed for local testing

**Key patterns:**

- Use the Supabase Deno client from `@supabase/supabase-js` in the Edge Function, initialized with the service role key from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- Aggregate in a single SQL query using `GROUP BY listing_id, event_name` and `FILTER (WHERE event_name = 'page_view')` — do not run N queries for N event types
- Idempotency: the UPSERT `ON CONFLICT (listing_id, date) DO UPDATE` ensures safe re-runs; the job can be manually triggered to backfill a missed day by passing `?date=YYYY-MM-DD` in the request body
- Error isolation: wrap each listing's UPSERT in a try/catch; increment error counter; continue loop
- Backfill support: accept optional `date` parameter in the request body; if present, aggregate for that specific date instead of yesterday

**Do not:**

- Use `await` on each individual listing in a sequential loop — batch the aggregation with a single SQL INSERT ... SELECT query
- Write to `analytics_events` from the Edge Function — it is read-only from the aggregation function's perspective
- Run the aggregation function during peak traffic hours — the 2:00 AM UTC schedule avoids US daytime load

**SQL aggregation query pattern:**

```sql
INSERT INTO entity_analytics_daily (listing_id, date, page_views, cta_clicks, saves, shares, search_impressions)
SELECT
  listing_id,
  $target_date,
  COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
  COUNT(*) FILTER (WHERE event_name = 'cta_click') AS cta_clicks,
  COUNT(*) FILTER (WHERE event_name = 'save') AS saves,
  COUNT(*) FILTER (WHERE event_name = 'share') AS shares,
  0 AS search_impressions  -- populated separately from search_events
FROM analytics_events
WHERE created_at::date = $target_date
  AND listing_id IS NOT NULL
GROUP BY listing_id
ON CONFLICT (listing_id, date) DO UPDATE SET
  page_views = EXCLUDED.page_views,
  cta_clicks = EXCLUDED.cta_clicks,
  saves = EXCLUDED.saves,
  shares = EXCLUDED.shares;
-- Then UPDATE search_impressions from search_events in a second query
```

---

## Acceptance Criteria

- [ ] Given analytics events exist for yesterday, running the Edge Function produces correct aggregate rows in `entity_analytics_daily` for each listing
- [ ] Given the Edge Function is run twice for the same date, `entity_analytics_daily` contains exactly one row per `(listing_id, date)` — no duplicates
- [ ] Given a listing had zero events on a given day, no row is created for that listing on that date (sparse storage — do not write zero rows)
- [ ] Given one listing's aggregation fails (e.g., FK constraint violation), the function continues processing remaining listings and logs the error
- [ ] A row is written to `analytics_job_log` after each run with correct `listings_processed`, `errors`, `duration_ms`, and `status`
- [ ] The `pg_cron` job is configured and verifiable via `SELECT * FROM cron.job` in production Supabase
- [ ] The Edge Function rejects unauthenticated requests with a 401 response
- [ ] The function supports a `?date=YYYY-MM-DD` override parameter for manual backfill runs
- [ ] Local deployment and invocation of the Edge Function works via `supabase functions serve aggregate-analytics`

---

## Failure States

| Failure                                              | User-visible behavior                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge Function times out (> 150s Supabase Edge limit) | Job log row written with `status = 'partial'`; Sentry error captured; next night's run processes new events correctly                                      |
| `pg_cron` fails to trigger the function              | No aggregation for that day; admin can manually trigger via Supabase Dashboard → Edge Functions → Invoke; analytics_job_log has no row for the missed date |
| `analytics_events` table has no rows for yesterday   | Function runs, writes zero rows to `entity_analytics_daily`, logs `listings_processed = 0, status = 'success'`                                             |
| UPSERT fails due to missing `UNIQUE` constraint      | Migration must run first; document this prerequisite in the function's README                                                                              |

---

## Edge Cases

- DST transitions: function runs at 2:00 AM UTC; `created_at::date` is UTC-based — consistent and correct regardless of DST
- Listing deleted between event creation and aggregation: `listing_id` FK to `listings` with `ON DELETE SET NULL`; events with null `listing_id` are excluded from aggregation (`WHERE listing_id IS NOT NULL`)
- Date parameter in backfill mode accepts only `YYYY-MM-DD` format; validate with regex before using in SQL
- First run: if `entity_analytics_daily` is empty and the function runs for the first time with 6 months of accumulated events, the developer should run the backfill manually day-by-day rather than loading all history at once

---

## Accessibility Notes

This is a backend/infrastructure ticket. No accessibility requirements.

---

## QA Test Cases

| #    | Scenario                   | Role                  | Steps                                                                                                                                                 | Expected result                                                                                  |
| ---- | -------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| QA-1 | Normal nightly aggregation | System (cron)         | 1. Seed `analytics_events` with 50 rows for yesterday across 5 listing IDs. 2. Invoke Edge Function. 3. Query `entity_analytics_daily` for yesterday. | 5 rows exist; counts match seeded events by type                                                 |
| QA-2 | Idempotency                | System                | 1. Run the function twice for the same date. 2. Query `entity_analytics_daily`.                                                                       | Exactly one row per listing per date; no duplicates                                              |
| QA-3 | Backfill via date param    | Admin (manual invoke) | 1. POST to Edge Function with `{"date": "2026-01-15"}`. 2. Query `entity_analytics_daily` for `2026-01-15`.                                           | Correct aggregate rows written for that past date                                                |
| QA-4 | Authentication gate        | System                | 1. POST to Edge Function without `Authorization` header.                                                                                              | 401 response; no DB writes                                                                       |
| QA-5 | Job log written            | System                | 1. Run the function. 2. Query `analytics_job_log`.                                                                                                    | One new row with correct `run_date`, non-zero `duration_ms`, `status = 'success'` or `'partial'` |

---

## Security Notes

- The Edge Function endpoint must reject unauthenticated requests. Do not expose it as a public webhook.
- The service role key used in the `pg_cron` expression must be stored in Supabase Vault, not written in plaintext in the cron job definition.
- Do not log raw event data in the Edge Function — only log counts and listing IDs.

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
