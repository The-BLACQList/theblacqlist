# Production Deployment Runbook — The BLACQList

**Date:** 2026-05-11
**Status:** Pre-deployment — do not execute until all gates in `mvp-release-readiness-checklist.md` are checked
**Owner:** Tech Lead
**Do not deploy** without explicit go/no-go sign-off from Tech Lead, Product Lead, and Legal/Ops.

---

## Prerequisites

Before starting this runbook, confirm:

- [ ] All items in `mvp-release-readiness-checklist.md` Pre-Staging Gate are checked
- [ ] `pnpm tsc --noEmit` passes with zero errors on the deploy branch
- [ ] `pnpm exec eslint . --ext .ts,.tsx` passes with zero errors
- [ ] The deploy branch is `main` and HEAD reflects the intended release
- [ ] The Supabase production project exists and is on Pro plan (required for PITR)
- [ ] All required environment variables are staged in Vercel (see `environment-variable-checklist.md`)
- [ ] The production domain `theblacqlist.com` is registered and you have DNS access
- [ ] At least one other engineer is available and reachable during the deployment window

---

## Step 1 — Vercel Project Setup (one-time)

If the Vercel project does not yet exist, complete this section once. Skip to Step 2 if the project is already created and connected to the repo.

### 1.1 Connect the repository

1. Log in to Vercel at `vercel.com`
2. Click **Add New → Project**
3. Import the GitHub repository for The BLACQList
4. Vercel auto-detects the framework as **Next.js** — confirm this is correct
5. Do not change the default build and output settings (see Step 1.2 below)

### 1.2 Build and output settings

Vercel auto-detects all of these for Next.js. Confirm they match; do not override unless shown otherwise:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Build command | `pnpm build` |
| Output directory | `.next` (auto-detected) |
| Install command | `pnpm install` |
| Node.js version | 20.x |
| Root directory | `/` (repository root) |

If Vercel shows a different install command (e.g., `npm install`), override it to `pnpm install`.

### 1.3 Environment variable setup

Do NOT set environment variables during the initial import wizard — the wizard does not offer environment scope selection (Preview vs Production). Close the wizard and set variables via **Vercel Dashboard → Project → Settings → Environment Variables** where each variable can be scoped to Production, Preview (staging), or both.

See `environment-variable-checklist.md` for the complete variable list and scoping rules.

---

## Step 2 — Supabase Production Project Setup (one-time)

Complete all steps in `supabase-production-checklist.md` before proceeding. This section summarizes the order; the checklist has the detail.

**Order of operations:**

1. Enable PITR and verify it is active before running any migrations
2. Enable PgBouncer in transaction mode
3. Enable the `pg_trgm` extension
4. Create the three storage buckets: `listing-media` (public), `verification-docs` (private), `receipts` (private)
5. Apply migrations in order (Step 3 below)
6. Apply seed data (Step 4 below)
7. Configure Auth settings and redirect URLs
8. Create the initial admin user (Step 5 below)

---

## Step 3 — Apply Migrations to Production

Run migrations in this exact order. Do not skip or reorder. Each migration must complete successfully before the next begins.

**Command for each migration:**

```bash
supabase db push --db-url "[production-db-url]"
```

The production database URL (direct connection, not pooled) is stored in your team's secrets manager. Do not use the pooled connection string for migrations.

**Migration order:**

| # | File | Description | Risk |
|---|---|---|---|
| 1 | `20260510000000_initial_blacqlist_mvp_schema.sql` | Core tables: users, listings, cities, categories, saves, claims | Low — additive |
| 2 | `20260510000001_mvp_rls_policies.sql` | RLS policies for all MVP tables | Low — additive |
| 3 | `20260511000000_editorial_foundation.sql` | Collections, guides, BLACQLight editorial | Low — additive |
| 4 | `20260511000001_receipt_community_spend.sql` | Receipt uploads, spend events, community spend | Low — additive |
| 5 | `20260511000002_marketplace_foundation.sql` | Products, services, vendor storefronts, orders | Low — additive |
| 6 | `20260511000003_monetization_foundation.sql` | Plans, subscriptions, sponsored placements — defines `set_updated_at()` | Low — additive |
| 7 | `20260511000004_ai_foundation.sql` | AI suggestions, generation requests — depends on `set_updated_at()` from migration 6 | Low — additive |

**Before running migration 6:** Confirm that migration 5 has applied successfully. Migration 7 depends on the `set_updated_at()` function created in migration 6 — if migration 6 fails, migration 7 will error.

**After each migration:** Check Supabase Dashboard → Database → Tables to confirm the expected tables exist before proceeding to the next migration.

**If a migration fails:** Do not continue to the next migration. Diagnose the error in the Supabase Dashboard → SQL Editor. All MVP migrations are additive — reverse by dropping the newly created tables (in reverse dependency order) if rollback is needed.

---

## Step 4 — Apply Seed Data

The `supabase/seed.sql` file contains reference data only — all 50 US states + DC, 13 cities, 25 top-level categories with subcategories, and 3 plan tiers. This is safe to apply to production.

```bash
supabase db push --db-url "[production-db-url]" --include-seed
```

Or apply directly:

```bash
psql "[production-db-url]" -f supabase/seed.sql
```

**Verify after seeding:**

```sql
-- Run in Supabase SQL Editor (production project)
SELECT count(*) FROM states;     -- expected: 51
SELECT count(*) FROM cities;     -- expected: 13
SELECT count(*) FROM categories; -- expected: 25+ (top-level + subcategories)
SELECT count(*) FROM plans;      -- expected: 3
```

**Do not run any other seed files on production.** The `supabase/seed.sql` is the only file appropriate for production. Dev fixture files (test users, sample listings, test claims) are never applied to production.

---

## Step 5 — Create Initial Admin User

After the application is deployed and the first production account is registered:

1. Register an account at `https://theblacqlist.com/sign-up` with the admin email address
2. Verify the email address via the confirmation email
3. Find the user's `id` from Supabase Dashboard → Authentication → Users
4. Run the following in the Supabase SQL Editor (production project):

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<user-uuid-from-auth-users>', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

5. Sign in to `https://theblacqlist.com/admin` and confirm the admin dashboard loads
6. Document the admin account in your team's secrets manager (not in any file or chat history)

**Note:** Only create the minimum number of admin accounts needed for operations. Each admin account has full RLS bypass via the service role in admin server actions.

---

## Step 6 — Domain Setup and SSL

### 6.1 Add the domain in Vercel

1. Vercel Dashboard → The BLACQList project → Settings → Domains
2. Click **Add Domain** → enter `theblacqlist.com`
3. Vercel will also prompt to add `www.theblacqlist.com` — add it and configure it to redirect to the apex domain

### 6.2 Configure DNS

Vercel will show the required DNS records. Add them at your domain registrar:

| Record type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel's IP — confirm in Vercel dashboard) |
| CNAME | `www` | `cname.vercel-dns.com` |

DNS propagation: typically 5–30 minutes; up to 48 hours in rare cases. Vercel Dashboard will show "Valid Configuration" once DNS is confirmed.

### 6.3 Verify SSL

Vercel provisions SSL automatically via Let's Encrypt once DNS is confirmed. Confirm in Vercel Dashboard → Settings → Domains — the domain should show a green checkmark and SSL certificate status.

SSL certificate auto-renews — no manual action needed.

### 6.4 Update NEXT_PUBLIC_SITE_URL

Once DNS is confirmed and the domain is live, update `NEXT_PUBLIC_SITE_URL` in Vercel Production environment variables to `https://theblacqlist.com` if it is not already set.

---

## Step 7 — First Production Deployment

### 7.1 Trigger the deployment

Merge the release branch PR to `main`. Vercel automatically starts a production build. Monitor the build at Vercel Dashboard → Deployments.

Expected build time: 2–3 minutes.

### 7.2 Confirm successful deployment

The Vercel Deployments page will show a green "Ready" status. If the build fails, do not proceed — investigate the build log.

### 7.3 Run post-deploy checks

Within 5 minutes of successful deployment, run every item in `prelaunch-smoke-test.md`.

If any smoke test fails, assess severity:
- **P0 failure** (site down, auth broken, all data missing): initiate rollback immediately via `rollback-plan.md`
- **P1 failure** (specific critical flow broken): evaluate whether hotfix is faster than rollback; document the decision
- **P2/P3 failure**: log as a known issue, do not rollback, fix in next deploy

---

## Step 8 — Post-Deployment Verification

Confirm each item within 30 minutes of deployment:

### Application
- [ ] `https://theblacqlist.com` loads and the homepage renders correctly
- [ ] `https://www.theblacqlist.com` redirects to `https://theblacqlist.com`
- [ ] HTTPS is enforced — `http://theblacqlist.com` redirects to `https://`
- [ ] All smoke tests in `prelaunch-smoke-test.md` pass

### Supabase
- [ ] Supabase production dashboard shows all 7 migrations applied
- [ ] Seed data counts correct (51 states, 13 cities, 25+ categories, 3 plans)
- [ ] Admin user exists in `user_roles` with `role = 'admin'`
- [ ] RLS enabled on all tables (Supabase Dashboard → Database → Tables → each table shows RLS = enabled)

### Vercel
- [ ] Vercel Dashboard shows deployment status = Ready (green)
- [ ] Vercel Analytics is enabled and receiving data (Dashboard → Analytics)
- [ ] No environment variable warnings in Vercel project settings

### Monitoring
- [ ] Sentry is receiving events — trigger a test error and confirm it appears in Sentry within 60 seconds
- [ ] Vercel Analytics shows pageview data for the homepage after the smoke test

### Auth
- [ ] Sign-up creates an account and sends verification email to the inbox (not spam) within 2 minutes
- [ ] Auth callback URL `https://theblacqlist.com/auth/callback` is working — test by completing sign-up through email verification
- [ ] `/dashboard` redirects to sign-in when accessed without a session
- [ ] `/admin` is inaccessible to non-admin accounts

---

## Step 9 — Soft Launch Gate

Before making the site public, complete the soft launch phase from `production-readiness-plan.md`:

1. Share the production URL privately with 5–10 trusted testers
2. Collect and resolve all P0/P1 bugs reported within 3–5 business days
3. Confirm seed data is at minimum thresholds (150+ Atlanta, 50+ Houston, 50+ Chicago) — these require separate data entry, not the reference seed file
4. Complete Team Review phase: every team member walks the full user journey on mobile
5. Get go/no-go sign-off from Tech Lead, Product Lead, and Legal/Ops
6. Post public announcement only after all sign-offs are confirmed

---

## Ongoing Deployment Process (Post-Launch)

After the initial deployment, every subsequent change follows this process:

1. Branch from `main` using naming convention `feat/BQ-[id]-[description]` or `hotfix/[description]`
2. Open a PR against `main`
3. Vercel automatically builds a preview deployment — test it
4. TypeScript + ESLint status checks must be green
5. At least 1 engineer approves the PR (no self-merges to `main`)
6. Merge — Vercel automatically deploys to production
7. Run smoke tests within 5 minutes of deployment
8. Monitor Sentry for new errors during the first 15 minutes post-deploy

**For changes that include a database migration:** Apply the migration to the production Supabase project before merging to `main`, or immediately after merge and before traffic reaches the new code — depending on whether the migration is additive (safe before or after) or required before the new code runs (apply first).
