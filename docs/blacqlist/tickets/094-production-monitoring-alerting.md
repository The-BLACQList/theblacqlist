# Ticket 094: Production Monitoring, Alerting, and On-Call Setup

## Status

Draft

## Phase

Phase 18: Production Deployment and Post-Launch Hardening

## Priority

P0

## Feature Area

Deployment / Ops

## Context

Production observability setup across Sentry (error tracking), Vercel (deployment and performance monitoring), Supabase (database health), and an external uptime checker. Also creates a `GET /api/health` endpoint for uptime monitoring. Includes documenting the first 30-day on-call rotation. Without this ticket, the team has no visibility into production failures after launch. Must be complete before Ticket 095 (incident response runbook) is useful.

## User Story

As the engineering lead, I want production monitoring and alerting configured across all platform layers, so that the team is notified of failures before users report them.

## Scope

- `app/api/health/route.ts` — `GET /api/health` endpoint: checks Supabase connectivity (simple SELECT 1), returns `{ status: 'ok', timestamp, supabase: 'ok'|'error' }` with HTTP 200 (even if Supabase check fails — let the uptime monitor decide health from the response body)
- Sentry production configuration: `SENTRY_DSN` env var in Vercel production, `environment: 'production'`, release tracking via Vercel deploy hooks, alert rule: any new error with ≥ 5 occurrences in 5 minutes → email + Slack (if Slack configured)
- Vercel monitoring: enable deployment failure alerts, access logs retention (7 days)
- Supabase monitoring: enable database activity monitor in Supabase dashboard; set alert for p95 query time > 5s; set alert for connection count > 80% of plan limit
- External uptime monitoring: configure uptime check (Better Uptime, Checkly, or equivalent — choose one) on: `https://theblacqlist.com`, `https://theblacqlist.com/api/health`, `https://theblacqlist.com/search`. Alert if any URL returns non-200 for > 2 minutes.
- On-call documentation: a brief `docs/blacqlist/launch/on-call.md` file listing who is on-call for the first 30 days post-launch, escalation order, and contact methods

## Out of Scope

- PagerDuty or on-call rotation software (use email/Slack at MVP)
- Custom dashboards beyond what Vercel/Supabase/Sentry provide natively
- Log aggregation service (V1)

## Dependencies

- Depends on: Ticket 092 (production deployment — site must be live for uptime monitoring to work)

## UX Notes

Not applicable — infrastructure and ops ticket.

## Design Notes

Not applicable.

## Data Notes

- `GET /api/health`: no database writes; SELECT 1 query only
- Health check response should not include sensitive info (no DB version, no env vars, no internal paths)

## API Notes

- Endpoint: `GET /api/health`
- Auth: not required (must be publicly accessible for uptime monitors)
- Response: `{ status: 'ok', timestamp: '...', checks: { supabase: 'ok' } }` — HTTP 200
- If Supabase check fails: `{ status: 'degraded', timestamp: '...', checks: { supabase: 'error' } }` — still HTTP 200 (uptime monitor reads the body to determine health, not just HTTP status)

## Implementation Notes

```typescript
// app/api/health/route.ts
export async function GET() {
  let supabaseStatus = 'ok'
  try {
    const supabase = createRouteHandlerClient()
    await supabase.from('cities').select('id').limit(1).throwOnError()
  } catch {
    supabaseStatus = 'error'
  }
  return Response.json({
    status: supabaseStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: { supabase: supabaseStatus },
  })
}
```

- Sentry: already initialized in Ticket 004 — this ticket ensures production DSN and release tracking are configured
- Uptime monitor: configure 1-minute check interval; alert after 2 consecutive failures

## Acceptance Criteria

- [ ] `GET /api/health` returns `{ status: 'ok' }` with HTTP 200 when Supabase is reachable
- [ ] `GET /api/health` returns `{ status: 'degraded' }` when Supabase is unreachable (still HTTP 200)
- [ ] Sentry dashboard shows production environment events (confirm with a test error)
- [ ] Sentry alert rule active: ≥ 5 occurrences in 5 min → notification sent
- [ ] External uptime monitor checking all 3 URLs with < 2-min alert threshold
- [ ] Vercel deployment failure alerts configured
- [ ] Supabase query time and connection alerts configured
- [ ] `docs/blacqlist/launch/on-call.md` written with names, contacts, and 30-day schedule

## Failure States

| Failure                      | User-visible behavior                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Health endpoint itself fails | Uptime monitor alerts immediately                                                            |
| Sentry DSN wrong             | No error events in Sentry — caught during setup verification                                 |
| Uptime monitor misconfigured | Silent — verify by temporarily returning 500 from health endpoint and confirming alert fires |

## Edge Cases

- Health check must not slow down under Supabase connection pool pressure — use a minimal query (SELECT 1 or SELECT id FROM cities LIMIT 1)
- Sentry release tracking: if Vercel deploy hook is not configured, Sentry release names will be generic — acceptable for MVP

## Accessibility Notes

Not applicable.

## QA Test Cases

| #   | Test               | Steps                                       | Expected result                              |
| --- | ------------------ | ------------------------------------------- | -------------------------------------------- |
| 1   | Health endpoint up | GET /api/health                             | 200 with { status: 'ok' }                    |
| 2   | Sentry test error  | Trigger a known error in production         | Event appears in Sentry dashboard within 60s |
| 3   | Uptime alert test  | Temporarily return 503 from health endpoint | Alert fires within 2 minutes                 |
| 4   | On-call doc exists | Check docs/blacqlist/launch/on-call.md      | File present with names and contacts         |

## Security Notes

- `GET /api/health` must not expose internal system details (versions, paths, env vars)
- Sentry must be configured to scrub PII from error reports (Sentry's default PII scrubbing is enabled)
- Uptime monitor credentials (API keys) stored in password manager, not in the codebase

## Completion Checklist

- [ ] `GET /api/health` route implemented and tested
- [ ] Sentry production DSN configured and test event confirmed
- [ ] Sentry alert rule active
- [ ] Vercel deployment failure alerts configured
- [ ] Supabase monitoring alerts configured
- [ ] External uptime monitor active on 3 URLs
- [ ] Alert test completed (uptime alert fires on synthetic failure)
- [ ] `docs/blacqlist/launch/on-call.md` written
- [ ] PR opened and linked to this ticket
