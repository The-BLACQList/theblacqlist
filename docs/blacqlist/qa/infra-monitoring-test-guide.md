# Infrastructure & Monitoring Test Guide — K1–K8

How to run each K-series check. Some run locally; some can only be verified in production/staging against an external dashboard.

**Last updated:** 2026-06-07

| Test | What | How | Where |
|---|---|---|---|
| K1 | Health endpoint OK | `pnpm test:infra` | Local (automated) |
| K2 | Health endpoint degraded | `pnpm test:unit` | Local (automated, unit) |
| K3 | Middleware redirect | `pnpm test:infra` | Local (automated) |
| K4 | Vercel Analytics | manual — Vercel dashboard | Production |
| K5 | Sentry production error | manual — guarded trigger route | Production |
| K6 | Sentry no PII | `pnpm test:unit` (scrubber) + prod confirm | Local + Production |
| K7 | Uptime monitors | manual — monitoring dashboard | Ops/Production |
| K8 | Seed idempotent | `pnpm test:seed-idempotent` | Local (automated) |

Preconditions for local checks: local Supabase up (`npx supabase status`). The Playwright checks auto-start/reuse `pnpm dev`.

---

## Local — automated

### K1 — Health endpoint OK
```bash
pnpm test:infra
```
Asserts `GET /api/health` → HTTP 200, `{ status: 'ok', checks: { supabase: 'ok' } }`. Source: `app/api/health/route.ts`; test: `e2e/infra.spec.ts`.

### K2 — Health endpoint degraded
```bash
pnpm test:unit
```
`tests/health-route.test.ts` mocks the Supabase client to fail (query error and thrown/timeout) and asserts the route returns `{ status: 'degraded', checks: { supabase: 'error' } }` at **HTTP 200 (not 500)**. (A live simulation isn't used because two `next dev` servers can't run in one project; the unit test is deterministic.)

### K3 — Middleware redirect
```bash
pnpm test:infra
```
Signs in (provisioned admin), visits `/sign-in`, asserts redirect. **Note:** the app redirects authenticated users to **`/account`** (`proxy.ts`); the original spec said `/account/saved`. Decision: keep `/account` and assert that. If product wants `/account/saved` later, change `proxy.ts` line `url.pathname = '/account'` and update the test.

### K6 — Sentry scrubber (config-level)
```bash
pnpm test:unit
```
`tests/sentry-scrub.test.ts` verifies `lib/observability/sentry-scrub.ts` strips user email/username/ip (keeps `id`), drops request body/cookies/auth headers, and redacts email/phone strings from messages/exceptions. This hook (`beforeSend`) is wired into all three `sentry.*.config.ts` with `sendDefaultPii: false`. Full event-shape confirmation is the production step below.

### K8 — Seed idempotency
```bash
pnpm test:seed-idempotent
```
Runs `scripts/seed-launch-listings.ts` twice against local Supabase and asserts the **second** run logs `Inserted: 0` and `Errors: 0`. The first run may insert launch listings if absent (idempotent via `upsert onConflict:'slug'`). ⚠️ Mutates your local DB (adds launch listings on first run).

---

## Production / external — manual

### K4 — Vercel Analytics
`@vercel/analytics` + `@vercel/speed-insights` are rendered in `app/layout.tsx` but **send no events in dev** (debug mode). To verify:
1. Deploy to Vercel (preview or production).
2. Navigate to 3+ pages on the deployed URL.
3. Within ~30 min, confirm pageview events in the Vercel project → Analytics dashboard.

### K5 — Sentry production error
Sentry is `enabled` only when `NODE_ENV === 'production'`. A **guarded** trigger route exists: `app/api/debug/sentry/route.ts`.
1. Set `SENTRY_TEST_TOKEN=<random>` in the production environment (and a valid `SENTRY_DSN`).
2. Deploy.
3. Hit `https://<prod-host>/api/debug/sentry?token=<random>` → returns 500 and throws.
4. In Sentry, confirm the event appears with **`environment: production`**.
(Without the token, the route returns 404 — safe to leave deployed.)

### K6 — Sentry no PII (production confirmation)
After triggering an auth error (e.g., bad sign-in) in production:
1. Open the event in Sentry.
2. Confirm the event body contains **no email, phone, or name** — `user` has at most an `id`; request body/cookies absent; messages redacted.
The `beforeSend` scrubber + `sendDefaultPii: false` enforce this (unit-tested locally above).

### K7 — Uptime monitors
No in-repo configuration — set up in an external uptime service (e.g., the host/monitoring provider). Configure **3 checks** (suggested): homepage `/`, `/discover`, and `/api/health`. Confirm all three are green in the monitoring dashboard. Use `/api/health` as the canonical liveness probe (returns 200 even when degraded, with `status` indicating health).

---

## Summary for the tracker

- **Pass locally now:** K1, K2, K3, K6 (scrubber), K8.
- **Production/manual:** K4, K5, K7, and K6 full event confirmation.
- K3 asserts `/account` (spec drift from `/account/saved` recorded above).
