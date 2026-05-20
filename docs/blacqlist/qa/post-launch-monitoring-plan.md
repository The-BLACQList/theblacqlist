# Post-Launch Monitoring Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Active — set up before first production deployment
**Owner:** Tech Lead
**References:** `rollback-plan.md`, `prelaunch-smoke-test.md`, `production-deployment-runbook.md`

This document defines what to monitor, where to look, alert thresholds, and the monitoring cadence. Configure all alerts described here before deploying to production. If an alert fires and you are unsure what it means, check `rollback-plan.md` for the matching scenario.

---

## Section 1 — Error Tracking (Sentry)

### Setup Requirements

- Sentry project: "theblacqlist-production" (separate from any staging project)
- `NEXT_PUBLIC_SENTRY_DSN` set in Vercel Production environment — see `environment-variable-checklist.md`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set as Vercel build variables for source map upload
- Sentry environment tagged as `production` in `sentry.client.config.ts` and `sentry.server.config.ts`

### Alert Configuration (configure in Sentry → Alerts → Create Alert Rule)

| Rule name | Condition | Action |
|---|---|---|
| P1 error spike | >5 unique issues in 1 hour | Post to Slack `#incidents` |
| P0 error storm | >20 unique issues in 1 hour | Post to Slack `#incidents` + email on-call engineer |
| New high-volume error | Any single issue exceeds 10 occurrences | Post to Slack `#incidents` for P1 triage |
| Auth callback failure | Error matching `auth.callback` exceeds 3 occurrences | Post to Slack `#incidents` — check auth config |

### Weekly Sentry Review (every Monday)

1. Open Sentry → Issues → sort by "First Seen" → review all new issues from the past 7 days
2. Open Sentry → Issues → sort by "Count" → review the top 10 issues by occurrence volume
3. Resolve or assign every issue — do not let the queue accumulate silently
4. Check Performance → Transactions for P95 response time on:
   - `GET /[city-slug]/business/[listing-slug]` (listing pages)
   - `GET /search` (search results)
   - `POST /api/analytics/event` (analytics ingestion)

### Privacy Note

Before enabling Session Replay in Sentry:
- Confirm PII scrubbing is configured: mask all form inputs, redact email/phone fields
- Do not enable Session Replay without reviewing Sentry's data processing settings
- Default: Session Replay is disabled until explicitly reviewed

---

## Section 2 — Supabase Health

### Daily Checks

Access: Supabase Dashboard → The BLACQList production project → Reports/Metrics

| Metric | Where | Alert threshold |
|---|---|---|
| Database connection count | Settings → Database → Connection Pooling | >80% of pool limit |
| Query P95 response time | Reports → Database | >500ms P95 |
| Storage usage | Storage → each bucket | >80% of plan storage limit |
| Auth active users | Authentication → Users | Sudden drop vs. prior day |

**Connection pool note:** With PgBouncer in transaction mode, the default pool size is typically 15–25 connections. At >80% utilization, investigate slow queries and long-running transactions before connections are exhausted.

### Weekly Checks

| Check | How | Alert |
|---|---|---|
| PITR backup status | Settings → Backups → Point-in-Time Recovery | Must show last backup timestamp < 24 hours ago |
| Migration log | Dashboard → Database → Migrations | No unexpected migrations should appear |
| Storage bucket visibility | Storage → bucket settings | `listing-media` = public; `verification-docs` = private; `receipts` = private |

### Auth Failure Monitoring

Check Supabase Dashboard → Authentication → Logs → filter by "Failed":

- A sudden spike in failed sign-in attempts may indicate a brute-force attempt
- If >50 failed auth events in 1 hour from the same IP: refer to `rollback-plan.md` Scenario D (security incident)
- If the auth callback URL starts failing: check `AUTH_SECRET` and Supabase redirect URL configuration

### Database Health Queries

Run monthly in Supabase SQL Editor:

```sql
-- Tables with RLS disabled (expected: zero rows)
SELECT tablename FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE t.schemaname = 'public'
  AND NOT relrowsecurity
ORDER BY tablename;

-- Largest tables (watch for unexpected growth)
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Long-running queries (if connection issues occur)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
AND state != 'idle';
```

---

## Section 3 — Vercel

### Build Failures

- Vercel sends an email to the project owner on every failed build
- Tech Lead must be set as a project member with notification emails enabled
- If a build fails: investigate the build log before pushing another commit; failed builds do not deploy

### Function Errors

Check Vercel Dashboard → Functions → Logs daily for the first 2 weeks, then weekly:

| Route | What to watch for |
|---|---|
| `/api/upload/[bucket]` | 400/413/415 errors (file type/size rejections) vs. unexpected 500s |
| `/api/analytics/event` | 429 errors (rate limiter; confirm it's operating correctly, not blocking legitimate traffic) |
| `/auth/callback` | Any 500 errors — auth flow is broken |
| `/api/search` | 500 errors — search index or DB query issue |
| `/api/listings/[id]` | 404 patterns — check if slugs are resolving correctly |

### Core Web Vitals

Check Vercel Analytics → Web Analytics → Core Web Vitals weekly:

| Metric | Target | Alert threshold |
|---|---|---|
| LCP (Largest Contentful Paint) | <2.5s | >4s |
| CLS (Cumulative Layout Shift) | <0.1 | >0.25 |
| INP (Interaction to Next Paint) | <200ms | >500ms |

Primary targets set from ticket 088 (performance optimization). If any metric exceeds the alert threshold on listing pages or the search results page, file a P1 performance ticket.

### Deployment Protocol

Every production deployment triggers this check:

1. Merge to `main` → Vercel automatically builds and deploys
2. Confirm Vercel Dashboard shows "Ready" (green) within 5 minutes
3. Run P0 smoke tests within 5 minutes of "Ready" status:
   - ST-01: Homepage loads
   - ST-04: Business entity page loads with real data
   - ST-07: Sign-in flow works
   - ST-08: Auth gate blocks unauthenticated access
   - ST-12: Admin dashboard accessible to admin
   - ST-14: Admin inaccessible to non-admin
   - ST-15: Receipt data not cross-visible between users
4. If any P0 test fails: initiate rollback via `rollback-plan.md` Scenario A immediately

---

## Section 4 — Application Health Metrics

### Primary Health Dashboard

This table represents the "all clear" state. Check weekly; alert if any metric enters the alert zone.

| Metric | Source | Healthy | Warning | Alert |
|---|---|---|---|---|
| Homepage LCP | Vercel Analytics | <2.5s | 2.5–4s | >4s |
| Search P95 response time | Sentry Performance | <1.5s | 1.5–3s | >3s |
| Entity page LCP | Vercel Analytics | <2.5s | 2.5–4s | >4s |
| Auth success rate | Supabase Auth Logs | >98% | 95–98% | <95% |
| Upload success rate | Vercel Function Logs | >95% | 90–95% | <90% |
| Sentry error count (weekly) | Sentry | <50 | 50–200 | >200 |
| Claim resolution time (avg) | Manual SQL query | ≤24h | 24–48h | >48h |
| DB connection pool usage | Supabase Metrics | <60% | 60–80% | >80% |

### Claim Resolution Query

Run weekly in Supabase SQL Editor:

```sql
-- Average claim resolution time (last 30 days)
SELECT
  avg(
    extract(epoch from (updated_at - created_at)) / 3600
  ) AS avg_hours_to_resolution,
  count(*) AS total_decided,
  count(*) FILTER (WHERE status = 'approved') AS approved,
  count(*) FILTER (WHERE status = 'rejected') AS rejected
FROM claims
WHERE status IN ('approved', 'rejected')
  AND updated_at >= now() - interval '30 days';
```

---

## Section 5 — Monitoring Cadence

### First 72 Hours Post-Launch

See `post-launch-plan.md` for the hour-by-hour cadence.

Summary:
- Hours 0–4: every 30 minutes
- Hours 5–72: every 2 hours
- Dedicated on-call person designated for each 8-hour block

### Week 1–2

- Morning check every business day (Tech Lead, 9–9:30am)
- Checklist: Sentry new issues, Vercel function errors, Supabase connection count, claim queue age
- Any anomaly → triage in standup same day

### Week 3 and Beyond

- Sentry handles asynchronous alerts (Slack `#incidents` for spikes)
- Weekly manual review every Monday (30 minutes)
- Supabase: check only when an alert fires or during weekly review
- Vercel: review after every deployment

### Monthly

- Run full 19-test smoke test suite from `prelaunch-smoke-test.md`
- Run database health queries from Section 2
- Review Core Web Vitals trends
- Review Sentry top-10 issues and resolve or assign any that have been sitting >14 days

### After Every Production Deployment

1. Confirm Vercel deployment shows "Ready"
2. Run P0 smoke tests (ST-01, ST-04, ST-07, ST-08, ST-12, ST-14, ST-15)
3. Monitor Sentry for 15 minutes post-deployment for new error spikes
4. If any P0 smoke test fails: rollback immediately

---

## Section 6 — Incident Response Quick Reference

| Symptom | Likely cause | First action |
|---|---|---|
| Homepage blank or 500 | Next.js build failure or DB connection | Check Vercel deployment status; `rollback-plan.md` Scenario A |
| Listing pages show mock data | `NEXT_PUBLIC_SUPABASE_URL` env var wrong | Check Vercel env vars; confirm production Supabase URL |
| Sign-in redirects to error page | `AUTH_SECRET` missing or Supabase redirect URL misconfigured | Check Vercel env vars; check Supabase Auth → URL Configuration |
| Admin page accessible to non-admin | Auth middleware regression | Rollback immediately — security breach; `rollback-plan.md` Scenario D |
| Upload endpoint 500 | Supabase Storage bucket config | Check bucket exists, check RLS policies on storage |
| Auth callback failures spiking | Supabase service_role key rotated or expired | Check key in Vercel env vars; rotate if necessary; `rollback-plan.md` Scenario D |
| DB connection pool at 100% | Long-running queries or connection leak | Kill long-running queries; check for infinite loops in server actions |
| Email not delivered | Resend API key wrong or domain DNS issue | `rollback-plan.md` Scenario F |
