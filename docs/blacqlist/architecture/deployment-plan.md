# Deployment and Operations Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Operational playbook
**Owner:** Engineering + Ops

This document is the authoritative guide for deploying, operating, and recovering The BLACQList in all environments. It is written to be executable by an engineer on their first day. Read it end-to-end before executing any step in a production context.

---

## 1. Deployment Provider — Vercel

The BLACQList deploys on Vercel. This is decided (see ADR-011) and does not require re-evaluation.

**Why Vercel:**

| Capability | Why it matters for The BLACQList |
|---|---|
| Native Next.js support | Built by the same team; zero-config App Router, ISR, and Server Components |
| Automatic ISR cache management | BLACQList Pages regenerate on a `revalidate` schedule without manual cache busting |
| Preview deployments per PR | QA and design review happen before code reaches production — no staging guesswork |
| Instant rollback | Any previous deployment can be promoted back to production in ~30 seconds |
| Edge middleware | Auth session validation and geolocation-based city detection run at the edge, before the page renders |
| Vercel Analytics | Core Web Vitals and traffic patterns visible without adding a third-party analytics library at MVP |
| Serverless scale-to-zero | Cost-efficient at MVP traffic levels; no idle server charges |

---

## 2. Repository and Branch Strategy

### Branch Model

| Branch | Purpose | Who pushes | Deploy target |
|---|---|---|---|
| `main` | Production. Protected. Source of truth. | PR merge only | Vercel production |
| `develop` | Staging integration. All feature branches merge here first. | PR merge only | Vercel staging |
| `feat/[ticket-id]-[short-description]` | Feature development. | Engineer | Vercel preview |
| `hotfix/[short-description]` | Emergency production fixes. | Engineer | Vercel preview, then `main` |
| `chore/[description]` | Dependency updates, tooling, non-feature changes. | Engineer | Vercel preview |

**Naming examples:**
- `feat/BQ-014-claim-flow`
- `feat/BQ-031-search-city-filter`
- `hotfix/broken-search-filter`
- `chore/upgrade-next-14-4`

**MVP note:** If the team is 1–2 engineers, the `develop` branch is optional. Feature branches may merge directly to `main` via PR with at least one approval. Adopt the two-branch model when the team exceeds 2 engineers or when staging environment parity becomes critical.

### Branch Protection Rules for `main`

Configure in GitHub under Settings → Branches → Add branch ruleset. All rules apply to `main`:

- Require pull request before merging (no direct pushes)
- Require at least 1 approving review
- Dismiss stale reviews when new commits are pushed to the PR branch
- Require status checks to pass before merging:
  - TypeScript (`tsc --noEmit`) — must pass
  - ESLint (`eslint .`) — must pass
- Do not allow bypassing the above settings
- Restrict force pushes — off
- Restrict deletions — off

### Branch Protection Rules for `develop`

Same as `main` except 1 approval is recommended but not required at MVP. Status checks still required.

---

## 3. Preview Deployments

Every pull request opened against `main` or `develop` automatically receives a Vercel preview deployment.

**Preview URL pattern:** Vercel assigns a URL in the format:
```
theblacqlist-[branch-slug]-[vercel-team-name].vercel.app
```

The exact URL is posted as a comment on the PR by the Vercel GitHub bot after the build completes.

**What preview deployments use:**
- Staging Supabase project (separate from production — different `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)
- Stripe test mode keys
- Resend test mode / sandbox
- All other environment variables from the Vercel staging environment configuration

**What preview deployments are used for:**
- QA sign-off before merging
- Design review — share the preview URL with stakeholders instead of screen recordings
- Manual testing of new features in isolation from `main`

**Shared staging data:** All open PRs share the same staging Supabase database. Avoid running destructive operations (deleting all seed data, truncating tables) from a preview deployment unless specifically testing that flow, as it affects all other open PRs.

**Build triggers:** Preview deployments build automatically on:
- PR opened
- New commits pushed to the PR branch
- PR reopened after closing

**Expiry:** Vercel preview deployments auto-expire after 30 days of inactivity by default. They do not consume production resources.

---

## 4. Production Deployment Process

Standard process for any deployment that does not include a database migration. If the deployment includes a migration, follow Section 5 first, then return here for the application deploy step.

**Step-by-step:**

1. All feature work lives in a branch named `feat/BQ-[ticket-id]-[description]`.
2. Open a pull request against `main` (or `develop` in the two-branch model).
3. Vercel automatically builds a preview deployment and posts the URL in the PR comments. Wait for the preview build to complete before requesting review.
4. The engineer who opened the PR runs the smoke tests from Section 9 against the preview URL. Document results in the PR description.
5. TypeScript check and ESLint must show green in GitHub status checks. Do not request review until both pass.
6. At least one other engineer reviews and approves the PR. Self-approval is not permitted on `main`.
7. Merge the PR. Vercel automatically starts a production build. Build time is typically 2–3 minutes.
8. Vercel sends a deploy notification (configure Slack or email in Vercel project settings). Confirm the notification shows "Deployed successfully."
9. On success: run the production smoke tests from Section 9 within 5 minutes of the deployment completing.
10. On failure: do not merge additional code. Investigate the Vercel build log (Vercel Dashboard → Deployments → failed deployment → Build Logs). Fix the issue in a new commit to the same branch and re-run from step 4.

**What triggers a production deploy:**
- A PR merge to `main` (automatic)
- A manual "Redeploy" triggered from the Vercel Dashboard (does not rebuild — re-runs the last successful build)

**What does NOT trigger a production deploy:**
- Pushing commits to any branch other than `main`
- Merging to `develop` (triggers staging deploy only)

---

## 5. Database Migration Process

Migrations are the highest-risk part of any deployment. A bad application deploy rolls back in 30 seconds. A bad migration may require restoring from backup. Follow this process without shortcuts.

### Creating a Migration

1. Start local Supabase: `supabase start`
2. Make schema changes in the local Supabase Studio or directly via SQL in the local DB.
3. Generate the migration file from the diff between local state and the last known migration:
   ```
   supabase db diff --use-migra -f [migration-name]
   ```
   Example: `supabase db diff --use-migra -f add-listing-trust-score`
4. The migration file is saved to:
   ```
   supabase/migrations/[timestamp]_[migration-name].sql
   ```
5. Open the generated migration file and read it line by line. Confirm it does exactly what you intended. Automated diff tools sometimes produce unexpected `DROP` or `ALTER` statements — always verify.
6. If the migration file looks correct, commit it to the feature branch alongside the application code that depends on it.
7. Never commit a migration that your application code is not yet ready to use — the schema and the code that uses it must deploy together.

### Testing a Migration on Staging

1. Merge the feature branch to `develop` or deploy to staging via PR preview.
2. Apply the migration to the staging database:
   ```
   supabase db push --db-url [staging-db-url]
   ```
   The staging DB URL is stored in 1Password (or your team's secrets manager) under "BLACQList — Supabase Staging Connection String."
3. Verify the staging application behaves correctly with the new schema:
   - Test the feature the migration enables
   - Test that existing features still work (regression)
   - Check Supabase Studio on staging for unexpected data changes
4. Confirm no RLS policy changes accidentally widened data access. Use a non-admin Supabase client to verify that data that should be private is still private.
5. Document the staging verification result in the PR description before requesting production approval.

### Applying a Migration to Production

1. The migration must have been successfully applied and verified on staging. Do not skip staging.
2. Confirm the production database backup is current:
   - PITR (Point-in-Time Recovery) is enabled on the production Supabase project — verify the PITR window is active in Supabase Dashboard → Settings → Backups.
   - For high-risk migrations (destructive operations), take a manual snapshot via Supabase Dashboard → Backups → Create backup before proceeding.
3. Apply the migration to production:
   ```
   supabase db push --db-url [production-db-url]
   ```
   The production DB URL is stored in 1Password under "BLACQList — Supabase Production Connection String."
4. Monitor the application for errors in the first 5 minutes post-migration:
   - Watch Sentry for new error events
   - Watch Vercel Functions logs for 500-level responses
   - Check the Supabase production dashboard for unexpected query errors
5. Document the migration in the release notes for the version it shipped with.

### Zero-Downtime Migration Rules

The following operations are safe to run against a live production database without a maintenance window:

| Operation | Safe | Notes |
|---|---|---|
| `ADD COLUMN` (nullable or with default) | Yes | Does not lock existing rows |
| `CREATE TABLE` | Yes | No impact on existing tables |
| `CREATE INDEX CONCURRENTLY` | Yes | Non-blocking index build |
| `ALTER TYPE ADD VALUE` (enum) | Yes | Additive only |
| `CREATE POLICY` | Yes | Additive |
| `DROP POLICY` | Yes | Additive (less restrictive = safe to audit first) |

The following operations require a maintenance window or a multi-step migration sequence. Never run these directly against a live table:

| Operation | Risk | Required approach |
|---|---|---|
| `DROP COLUMN` | Data loss, breakage | Deprecation period: stop writing to column → deploy code that no longer reads it → then drop |
| `NOT NULL` constraint on existing column without DEFAULT | Immediate table scan, potential lock | Add DEFAULT first → backfill nulls → then add NOT NULL |
| Column rename | Breaks application code mid-deploy | Multi-step: add new column → backfill → update application code → drop old column |
| Type change on existing column | May fail or corrupt data | Add new column of new type → backfill with CAST → swap application → drop old column |
| `DROP TABLE` | Irreversible data loss | See destructive migration requirements below |
| `TRUNCATE` | Irreversible data loss | See destructive migration requirements below |

### Destructive Migration Requirements

Any migration that drops a column, drops a table, truncates records, or transforms data in a non-reversible way requires all of the following before it may be applied to production:

- [ ] Written approval from tech lead in the PR description
- [ ] Confirmed PITR backup active OR manual snapshot taken immediately before migration
- [ ] Rollback SQL documented in the PR description (reverse of each statement, in reverse order)
- [ ] Migration applied during a low-traffic window (avoid peak hours; check Vercel Analytics for traffic patterns)
- [ ] Second engineer monitoring application health during migration execution

---

## 6. Rollback Process

There are two fundamentally different rollback scenarios. Identify which applies before taking any action.

### Scenario A — Bad Application Deploy (No DB Changes)

Use this when: the deployment introduced visual bugs, broken routes, API errors, or performance regressions — and the deployment contained no database migrations.

**Fastest path: Vercel instant rollback**

Via Vercel Dashboard:
1. Go to Vercel Dashboard → The BLACQList project → Deployments
2. Locate the last known-good deployment (immediately before the bad one)
3. Click the three-dot menu on that deployment → "Promote to Production"
4. Vercel re-routes production traffic to that deployment in approximately 30 seconds
5. No rebuild occurs — Vercel serves the previously built output

Via Vercel CLI:
```
vercel rollback [deployment-url]
```
Where `[deployment-url]` is the URL of the last known-good deployment (visible in the Deployments list).

After rollback: run the Section 9 smoke tests to confirm production is restored. File a ticket for the root cause investigation. Do not re-deploy the bad code until the issue is diagnosed and fixed.

### Scenario B — Bad Database Migration

Use this when: a migration caused data corruption, schema breakage, query failures, or application errors related to the schema — and a simple application rollback will not fix it because the running code depends on the schema state.

**This scenario requires careful sequencing. Do not rush.**

1. First question: is the application still partially functional? If yes, do not panic — take time to assess before acting. Rushed database operations cause more damage than the original problem.
2. Identify the exact migration file that caused the problem (check `supabase/migrations/` — it is the most recent one applied to production).
3. For reversible migrations (added a column, created a table, added an index):
   a. Write a reverse migration SQL script (drop the column / table / index that was added)
   b. Review the reverse migration with a second engineer
   c. Apply via `supabase db push` or direct psql connection
   d. Verify application health post-reversal
   e. Then roll back the application code via Vercel if needed
4. For irreversible migrations (dropped a column, dropped a table, truncated data, ran a destructive transform):
   a. This requires a PITR restore
   b. Go to Supabase Dashboard (Production project) → Settings → Backups → Point-in-time recovery
   c. Select the recovery timestamp: the last moment before the migration ran
   d. Execute the PITR restore — this will restore the database to the selected point in time
   e. After PITR restore completes, roll back the application code via Vercel instant rollback (Scenario A) to a version compatible with the restored schema
   f. Verify all critical paths work before re-opening traffic
   g. PITR window: 7 days on Supabase Pro plan — do not exceed this window before initiating recovery

**Rollback decision tree:**

```
Errors spike / deploy failed?
│
├── Was a DB migration included in this deploy?
│   │
│   ├── NO → Vercel instant rollback (30 seconds)
│   │         Test with Section 9 smoke tests
│   │         File root-cause ticket
│   │
│   └── YES → Is the migration reversible?
│             │
│             ├── YES → Write and apply reverse migration SQL
│             │          Then Vercel rollback if needed
│             │          File root-cause ticket
│             │
│             └── NO → PITR restore to pre-migration timestamp
│                       Then Vercel rollback to compatible version
│                       File root-cause ticket
│                       Post-mortem required
```

---

## 7. Launch Checklist

Run this checklist before the first public launch and before any major version release (V1, V2). Each item must be explicitly confirmed as pass or fail. Do not mark an item as passing without testing it.

### Code Quality

- [ ] `tsc --noEmit` passes with zero errors
- [ ] ESLint passes with zero errors — warnings reviewed and either resolved or explicitly accepted with a comment
- [ ] No `console.log` statements in production code paths — use a structured logger or remove entirely
- [ ] No hardcoded secrets, API keys, or credentials in any file — run `git grep -r "sk_live\|service_role\|secret"` to confirm
- [ ] No unresolved `TODO:` comments in critical paths (auth, payments, data access, RLS)
- [ ] All `// TODO:` comments in non-critical paths logged as follow-up tickets in the backlog
- [ ] `npm audit` shows no packages with known critical CVEs — address any critical findings before launch

### Database

- [ ] All migrations applied to staging and verified
- [ ] All migrations applied to production
- [ ] RLS enabled on all tables — test by querying each table with a non-admin Supabase JS client and confirming appropriate access restrictions
- [ ] Seed data applied: minimum 150+ Atlanta listings, 50+ Houston, 50+ Chicago — confirm counts in Supabase Studio
- [ ] At least 40% of seed listings have images — spot-check in the UI
- [ ] No duplicate listings in seed data — run a SQL check for duplicate slugs and duplicate `(name, city_id)` pairs
- [ ] Point-in-time recovery confirmed active on production Supabase project (Supabase Dashboard → Settings → Backups → PITR status = enabled)
- [ ] `pg_trgm` extension enabled in production — confirm in Supabase Dashboard → Database → Extensions

### Environment Variables

- [ ] All required environment variables set in Vercel production environment — no placeholder values, no empty strings
- [ ] No `localhost`, `127.0.0.1`, or `*.supabase.co` staging URLs referenced in production env vars (except the production Supabase project URL)
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production domain (e.g., `https://theblacqlist.com`)
- [ ] Supabase Auth redirect URLs include the production domain — update in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
- [ ] `.env.example` file committed to the repository with all required variable names (no real values — only names and descriptions)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not in any `NEXT_PUBLIC_*` variable — verify in Vercel environment variable list

### Security

- [ ] HTTPS enforced on the production domain — Vercel provides SSL automatically; confirm the certificate is active in Vercel Dashboard → Domains
- [ ] All authenticated routes protected in `middleware.ts` — manually test accessing `/dashboard`, `/claim`, `/admin` while signed out; each must redirect to sign-in
- [ ] Admin routes inaccessible to non-admin roles — sign in as a standard supporter account and attempt to access `/admin`; confirm 403 or redirect
- [ ] RLS tested: a logged-in supporter cannot read another user's saves — use Supabase Studio to test a direct query as a non-owner user
- [ ] RLS tested: a business owner cannot edit a listing they do not own — test via the API with a valid auth token for user A attempting to edit user B's listing
- [ ] File upload MIME type validation working — attempt to upload a `.txt` file or a `.php` file as a listing image; confirm rejection with an error message
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not exposed in any client-side bundle — check the browser network tab on page load for any response containing the key string
- [ ] Sentry error payloads do not include PII — trigger a test error and inspect the Sentry event payload for names, emails, or phone numbers

### Performance

- [ ] Lighthouse performance score ≥ 80 on a representative BLACQList Page — run from Chrome DevTools or PageSpeed Insights using a production URL
- [ ] First Contentful Paint < 2 seconds on a BLACQList Page, tested from US East — use WebPageTest or PageSpeed Insights
- [ ] Search results load in < 1.5 seconds for a common query ("restaurant" in "Atlanta") — test from the browser network tab
- [ ] All listing images use `next/image` — `grep -r "<img " src/` should return zero results in component files
- [ ] ISR revalidation confirmed: load a BLACQList Page, update the listing in Supabase Studio, wait for `revalidate` interval, refresh the page — confirm updated content appears without a new deploy
- [ ] No N+1 queries on the search results page — open Supabase Dashboard → Logs → API logs and check query count for a single search request

### SEO

- [ ] Every BLACQList Page has a unique `<title>` tag — view page source for 3 different listings and confirm `<title>` differs
- [ ] Every BLACQList Page has a unique `<meta name="description">` tag — same spot-check as above
- [ ] Every BLACQList Page has OG image meta tags (`og:image`, `og:title`, `og:description`) — validate with a social preview tool (e.g., opengraph.xyz)
- [ ] `canonical` URL meta tag present on all entity pages — view source and confirm `<link rel="canonical" href="...">`
- [ ] `sitemap.xml` accessible and valid — navigate to `[production-url]/sitemap.xml` and confirm valid XML with listing URLs included
- [ ] `robots.txt` accessible — navigate to `[production-url]/robots.txt` and confirm it exists and does not block all crawlers
- [ ] JSON-LD structured data present on BLACQList Pages — validate with Google's Rich Results Test (search.google.com/test/rich-results)
- [ ] Homepage has correct `<title>` (e.g., "The BLACQList — Discover Black-Owned Businesses") and meta description

### Monitoring

- [ ] Sentry configured with production DSN — trigger a test error and confirm it appears in the Sentry dashboard within 60 seconds
- [ ] Sentry alert configured: error rate spike (> X events/hour) triggers a notification to the engineering Slack channel or on-call email
- [ ] Vercel Analytics enabled on the production project — confirm data appears in Vercel Dashboard → Analytics after a page load
- [ ] On-call engineer identified and reachable for launch week — name and contact method documented in the team Slack channel
- [ ] Incident response contacts documented (see Section 11)

### Legal

- [ ] Privacy Policy page live and accessible at `/privacy` — confirm it loads with the correct content and is linked from the footer
- [ ] Terms of Service page live and accessible at `/terms` — confirm it loads and is linked from the footer
- [ ] DMCA contact email present in the Privacy Policy or in the footer
- [ ] Cookie notice present if cookies beyond session cookies are set — confirm with browser developer tools → Application → Cookies

### Email

- [ ] Transactional email delivery tested end-to-end — submit a test claim, confirm the confirmation email arrives in an inbox (not spam) within 2 minutes
- [ ] From domain SPF, DKIM, and DMARC DNS records configured — verify at mxtoolbox.com or mail-tester.com
- [ ] Email unsubscribe link working for any marketing emails — confirm the link routes to a valid unsubscribe handler
- [ ] Resend sending domain verified — confirm green verification status in Resend Dashboard → Domains

### Admin Operations

- [ ] At least one Admin account configured in production — confirm the account exists in Supabase `user_roles` table with `role = 'admin'`
- [ ] Admin can log in and access `/admin/claims` — test with the admin account credentials
- [ ] Admin can approve a test claim end-to-end — submit a test claim as a non-admin, then approve it as admin, and confirm the listing's ownership status updates
- [ ] Seed data visible and correct in the admin listings view — log in as admin and confirm listings appear at `/admin/listings`

---

## 8. Pre-Launch Go / No-Go Decision

The launch checklist in Section 7 feeds into a formal go/no-go gate. This gate requires explicit sign-off from each role before the site is made public.

**Required sign-off:**

| Role | Scope of confirmation | Sign-off method |
|---|---|---|
| Tech Lead | Code quality, security, performance, and monitoring checks complete | PR comment or Slack message with "Tech: GO" |
| Product Lead | Seed data quality acceptable, admin flows operational, user-facing flows tested | Slack message with "Product: GO" |
| Legal / Ops | Privacy Policy and Terms of Service reviewed and approved | Email confirmation to team |

**Severity tiers for blocking issues:**

| Tier | Description | Launch impact |
|---|---|---|
| P0 — Critical | Single P0 issue open | Hard block — launch does not proceed |
| P1 — High | Open P1 without documented resolution timeline | Conditional block — document resolution plan and get tech lead approval to proceed with conditions |
| P2 — Medium | Open P2 | Does not block — log as known issue, ship |
| P3 — Low / Cosmetic | Open P3 | Does not block — log as known issue, ship |

A launch that proceeds with open P1 issues must have: a documented description of each open issue, an owner, and a resolution target date — written in the release notes before launch.

---

## 9. Production Smoke Tests

Run immediately after every production deployment. These are manual, time-bounded tests covering the most critical user paths. Total time to complete all 10 tests: approximately 15 minutes.

**Prerequisite:** Have a test account (non-admin) and an admin account available with known credentials. Have at least one published listing in the database.

---

**Test 1 — Homepage Load**

Steps: Navigate to the production URL root (`/`).

Expected result: Page loads within 2 seconds. Hero section is visible. Search bar is present and functional (typing into it does not throw a JavaScript error). Footer is visible.

---

**Test 2 — National Search**

Steps: From the homepage, type "restaurant" in the search bar without selecting a city filter. Submit.

Expected result: Search results page loads. At least one result is present. Listing cards render with business name, city, category badge, and either an image or a placeholder. No JavaScript console errors.

---

**Test 3 — City-Filtered Search**

Steps: From the homepage or search results, search "restaurant" with city filter set to "Atlanta." Submit.

Expected result: Results are filtered to Atlanta only — no listings from other cities appear. The URL updates to `/search?q=restaurant&city=atlanta` (or equivalent query string format). At least one Atlanta result is visible.

---

**Test 4 — BLACQList Page Load**

Steps: From search results, click through to any listing's BLACQList Page.

Expected result: Page loads server-rendered (right-click → View Page Source and confirm the business name appears in the `<title>` tag — it must not be empty or a loading placeholder). Hero section visible with business name and at least one CTA. No hydration errors in console.

---

**Test 5 — Auth Gate on Save**

Steps: On a BLACQList Page, click the Save (bookmark) button while not signed in.

Expected result: A sign-in modal or drawer appears. The user is not redirected away from the listing page. After closing the modal without signing in, the listing page is still visible and intact.

---

**Test 6 — Sign Up Flow**

Steps: Navigate to `/sign-up`. Complete the registration form with a test email address (use a `+` alias to your real email, e.g., `you+smoketest@gmail.com`).

Expected result: Account is created. A verification email arrives in the inbox within 2 minutes (check spam if not in inbox). After email verification, the user is redirected to `/onboarding` or the dashboard. No error messages during the flow.

---

**Test 7 — Sign In Flow**

Steps: Navigate to `/sign-in` (or use the sign-in modal). Sign in with an existing test account (not the one just created — use a pre-existing stable test account).

Expected result: User is redirected to `/dashboard` or the appropriate role-based landing page. The user's display name or avatar is visible in the navigation. No error toasts or redirect loops.

---

**Test 8 — Claim Flow**

Steps: Navigate to `/claim`. Search for an unclaimed listing. Complete the claim submission form.

Expected result: Claim submitted successfully. A success confirmation is shown. Navigate to `/admin/claims` as an admin account — the submitted claim appears in the pending queue.

---

**Test 9 — Admin Login and Claims Queue**

Steps: Sign in as the admin account. Navigate to `/admin/claims`.

Expected result: Admin dashboard loads. Claims queue is visible and shows at least the claim submitted in Test 8. The Approve and Reject buttons are present on the pending claim row. Clicking Approve initiates the approval flow without a JavaScript error.

---

**Test 10 — 404 Page**

Steps: Navigate to a URL that does not exist, e.g., `/this-page-does-not-exist-xyz`.

Expected result: A branded 404 page renders — with The BLACQList header and footer, a human-readable "Page not found" message, and a search bar or navigation link back to the homepage. The Vercel default error page must not appear.

---

## 10. Rollout Strategy

### Phase 1 — Soft Launch

**Objective:** Validate that production infrastructure is stable before public exposure.

- Site is accessible via the production URL but not publicly announced.
- Invite 5–10 non-team testers: trusted community members, advisors, or collaborators.
- Share the URL privately — do not post on social media or any public channel.
- Ask testers to complete the primary flows: search, view a listing, create an account, save a listing, submit a claim.
- Collect all P0 and P1 bugs reported by testers. Resolve all P0 bugs before proceeding to the next phase.
- Duration: 3–5 business days minimum.

### Phase 2 — Seed Data Sprint

**Objective:** Reach minimum data thresholds before the platform is meaningful to new visitors.

- Add listings to reach: 150+ Atlanta, 50+ Houston, 50+ Chicago.
- At least 40% of listings in each city must have an uploaded image.
- All listings must have a correct primary category assigned.
- Verify no duplicate listings exist after bulk import (run the duplicate detection SQL check).
- QA: walk through search results for each city and verify quality of presentation.
- Any listings with missing required fields should be flagged for owner outreach post-launch, not deleted.

### Phase 3 — Team Review

**Objective:** Final validation by the full team before public announcement.

- Every team member completes the full user journey: search → view listing → create account → save listing → submit claim.
- Every team member tests on a mobile device at 375px width.
- Admin team member completes the full admin flow: log in → review claims queue → approve a claim → verify listing updated.
- Any blocking issues found at this stage are resolved before the public announcement.

### Phase 4 — Public Launch

**Objective:** Open the platform to the public and drive initial traffic.

- Post the announcement on all planned social media channels simultaneously.
- Publish any prepared press outreach or community newsletter.
- Engineer on call monitors Sentry and Vercel Analytics in real time for the first 2 hours post-announcement.
- Second engineer on standby, reachable via Slack, during the first 2 hours.
- If a P0 incident occurs within the first 2 hours: immediately execute the rollback process (Section 6) and post a brief holding message on social channels if the outage exceeds 10 minutes.
- After the first 2 hours: continue monitoring at 30-minute intervals for the remainder of launch day.

---

## 11. Incident Severity and Response

### Severity Definitions

| Severity | Description | Response SLA | Rollback trigger |
|---|---|---|---|
| P0 — Critical | Site completely down, data loss confirmed, auth broken for all users, payment processing down | Immediate — acknowledge within 30 minutes, resolve or rollback within 2 hours | Yes — initiate rollback immediately on P0 confirmation |
| P1 — High | Core user flow broken (search returns 0 results, claim submission fails, admin queue inaccessible, sign-up broken) | Acknowledge within 1 hour, resolve within 24 hours | Evaluate — rollback if hotfix is not faster |
| P2 — Medium | Secondary feature broken (gallery upload failing, email not delivering, save count incorrect) | Acknowledge within 4 hours, resolve within 72 hours | No |
| P3 — Low / Cosmetic | Visual bug, copy typo, footer link broken, minor UX inconsistency | Log and schedule for next sprint | No |

### Incident Response Contacts

Document the following before launch and post in the team Slack channel:

| Role | Responsibility | Contact |
|---|---|---|
| On-call Engineer | First responder for all P0/P1 incidents | [Name + Slack handle + phone] |
| Tech Lead | Escalation for P0 incidents, approves rollbacks | [Name + Slack handle + phone] |
| Supabase Support | Database outages, PITR restore assistance | support.supabase.com (Pro plan includes priority support) |
| Vercel Support | Build failures, edge network issues | vercel.com/support |
| Domain Registrar | DNS issues (if domain does not route to Vercel) | [Registrar support link] |

### Incident Communication

- For P0 incidents: post an immediate status update in the team Slack `#incidents` channel. If the outage is user-visible and exceeds 10 minutes, post a brief holding message on the social channel used for the launch announcement.
- For P1 incidents: post an update in `#incidents` within 1 hour.
- After any P0 incident is resolved: write a brief post-mortem within 48 hours documenting what happened, the root cause, and what change prevents recurrence.

---

## 12. Post-Launch Operations Checklist (First 30 Days)

Run on the cadence specified. Owner is assigned per item.

### Daily

- [ ] Review Sentry dashboard for new error patterns — investigate any new error type that did not exist before launch
- [ ] Check Vercel Deployments for any failed builds in the last 24 hours
- [ ] Process any new claim submissions — target response time: within 48 hours of submission
- [ ] Respond to any listings flagged for review — target response time: within 48 hours of flagging

### Weekly

- [ ] Review Vercel Analytics: Core Web Vitals trends, traffic by page, top search terms — log any regressions versus prior week
- [ ] Review Supabase Database dashboard: query performance, connection pool utilization, storage usage — flag any metrics approaching plan limits
- [ ] Review Sentry: are previously identified errors resolved? Are error counts trending down?
- [ ] Confirm seed data completeness: check listing counts per city against minimum thresholds — add listings to any city below threshold
- [ ] Triage new P2/P3 bugs in the backlog — assign to the next sprint as appropriate

### One-Time (Post-Launch)

- [ ] Rotate any API keys or credentials that were shared with temporary contractors during the pre-launch build — do this within the first week
- [ ] Confirm Resend domain reputation is healthy — check Resend Dashboard → Domains for bounce rate and spam complaint rate after the first batch of transactional emails
- [ ] Confirm Stripe test mode keys are not active in any production environment variable — run `vercel env ls` and verify no `sk_test_` values are present in the production environment
- [ ] Review and close or convert any open `TODO:` tickets created during the launch checklist process
- [ ] Schedule a 30-day post-launch retrospective to review Sentry error trends, search query data, and user flow completion rates before planning V1 scope
