# Production Setup Checklist — The BLACQList

**Tickets:** 091 (Supabase) + 092 (Vercel)  
**Last updated:** 2026-05-22  
**Execute after:** All code gates pass (`pnpm tsc --noEmit && pnpm lint`, 086–090 sign-off)  
**Detailed docs:** [supabase-production-checklist.md](./supabase-production-checklist.md) · [production-deployment-runbook.md](./production-deployment-runbook.md)

---

## Step 1 — Supabase Production Project (Ticket 091)

Execute the full checklist in [supabase-production-checklist.md](./supabase-production-checklist.md).

Summary of required steps:

- [ ] Create new Supabase project: `theblacqlist-production` — region `us-east-1`
- [ ] Save project URL, anon key, service role key in 1Password / secrets manager
- [ ] Enable PITR (Point in Time Recovery) — **do this before any data is written**
- [ ] Run all 17 migrations: `supabase link --project-ref [REF] && supabase db push`
- [ ] Enable `pg_trgm` extension in Supabase Studio → Database → Extensions
- [ ] Enable `pg_cron` extension (requires Pro plan) for analytics aggregation job
- [ ] Create storage buckets:
  - `listing-media` — public, 5MB max
  - `verification-docs` — private, 10MB max
  - `receipts` — private, 10MB max
- [ ] Verify RLS is active: spot-check 3 tables with anon and authenticated queries
- [ ] Create test admin account in Supabase Auth console

---

## Step 2 — Vercel Production Deployment (Ticket 092)

Execute the full checklist in [production-deployment-runbook.md](./production-deployment-runbook.md).

Summary of required steps:

- [ ] Connect GitHub repo to Vercel — production branch: `main`
- [ ] Add all production env vars (reference [environment-variable-checklist.md](./environment-variable-checklist.md)):
  - `NEXT_PUBLIC_SUPABASE_URL` — production project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — production anon key
  - `SUPABASE_SERVICE_ROLE_KEY` — production service role key
  - `NEXT_PUBLIC_SITE_URL=https://theblacqlist.com`
  - `NEXT_PUBLIC_APP_URL=https://theblacqlist.com`
  - `NEXT_PUBLIC_APP_ENV=production`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`
  - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
  - `AUTH_SECRET` — generate with `openssl rand -hex 32`
- [ ] Add domain `theblacqlist.com` in Vercel dashboard
- [ ] DNS: CNAME `www` → `cname.vercel-dns.com`; apex A record via Vercel
- [ ] Verify SSL auto-provisioned (Let's Encrypt via Vercel)
- [ ] Enable Vercel Web Analytics in project settings
- [ ] Trigger first production deploy (`git push main`)

---

## Step 3 — Post-Deploy Smoke Tests

Run all 10 smoke tests from the production deployment runbook immediately after first deploy.

| # | Test | Pass? |
|---|---|---|
| 1 | `https://theblacqlist.com` loads homepage | |
| 2 | `https://www.theblacqlist.com` redirects to apex | |
| 3 | SSL green lock present | |
| 4 | `/sitemap.xml` returns valid XML | |
| 5 | `/robots.txt` contains `Disallow: /admin` | |
| 6 | OG image URL is absolute on a listing page | |
| 7 | `/admin` redirects unauthenticated to `/sign-in` | |
| 8 | Search returns results | |
| 9 | No `localhost` or staging Supabase URL in HTML source | |
| 10 | Sentry receives a test error with `environment: production` | |

---

## Step 4 — Seed Data (Ticket 093)

```bash
# From projects/theblacqlist/
SUPABASE_URL=https://[prod-ref].supabase.co \
SUPABASE_SERVICE_ROLE_KEY=[key] \
npx tsx scripts/seed-launch-listings.ts
```

**Count check before running:**
- Atlanta JSON: currently 40 businesses (launch requires 150+)
- Houston JSON: currently 20 businesses (launch requires 50+)
- Chicago JSON: currently 20 businesses (launch requires 50+)

Add the remaining listings to the JSON files before the production seed run. See [scripts/data/](../../../scripts/data/) for the JSON structure.

---

## Step 5 — Monitoring Setup (Ticket 094)

- [ ] Sentry: create alert rule — ≥5 occurrences in 5 min → email + Slack webhook
- [ ] Sentry: add Vercel deploy hook for release tracking
- [ ] Vercel: enable deployment failure email notifications
- [ ] Supabase: set `p95 query time > 5s` and connection count alerts in Dashboard → Advisors
- [ ] External uptime — set up 3 monitors on Better Uptime or Checkly:
  - `https://theblacqlist.com` — 1-min check, alert after 2 failures
  - `https://theblacqlist.com/api/health` — check body for `"status":"ok"`
  - `https://theblacqlist.com/search` — 1-min check, alert after 2 failures
- [ ] Fill in on-call contacts and links in [on-call.md](./on-call.md)

---

## Step 6 — Google Search Console (Ticket 090, post-launch)

- [ ] Add property for `theblacqlist.com` (verify via DNS TXT or HTML meta tag in root layout)
- [ ] Submit `https://theblacqlist.com/sitemap.xml`
- [ ] Request indexing for homepage
- [ ] Request indexing for 5 priority listing pages
- [ ] Document verification method and submission date in [seo-checklist.md](./seo-checklist.md)
