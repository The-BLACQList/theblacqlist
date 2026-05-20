# Rollback Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Active — review before every production deployment
**Owner:** On-call Engineer + Tech Lead

This document covers every rollback scenario for The BLACQList. Read the Decision Tree first, then execute the matching scenario. Do not improvise under pressure — follow the documented steps.

---

## Decision Tree

```
Production incident or failed deployment
│
├── Did this deployment include a database migration?
│   │
│   ├── NO
│   │   └── → Scenario A: Application-Only Rollback (fastest path)
│   │
│   └── YES
│       │
│       └── Is the migration reversible (added table/column/index)?
│           │
│           ├── YES (additive migration)
│           │   └── → Scenario B: Additive Migration Rollback
│           │
│           └── NO (dropped table/column, data transform)
│               └── → Scenario C: PITR Restore (destructive migration)
│
├── Is this a security incident (exposed key, unauthorized access, data breach)?
│   └── → Scenario D: Security Incident Response
│
├── Is this a specific feature causing issues without full site impact?
│   └── → Scenario E: Feature Pause (targeted mitigation)
│
└── Is this an email delivery failure?
    └── → Scenario F: Email Delivery Failure
```

---

## Scenario A — Application-Only Rollback

**When to use:** Deployment introduced bugs, broken routes, visual regressions, or API errors. No database migrations were included in the deployment.

**Estimated time to restore:** < 5 minutes

### Step-by-step

**Via Vercel Dashboard (no CLI required):**

1. Open Vercel Dashboard → The BLACQList project → **Deployments**
2. Identify the last known-good deployment (the one immediately before the problematic deploy)
   - Look for the deployment timestamped just before the broken one
   - It should show status "Ready" (green)
3. Click the **three-dot menu (⋮)** on the last known-good deployment
4. Click **"Promote to Production"**
5. Confirm the promotion — Vercel will re-route production traffic in approximately 30 seconds
6. No rebuild occurs — Vercel serves the previously built output immediately

**Via Vercel CLI (if dashboard is unavailable):**

```bash
# List recent deployments to find the last good one
vercel ls theblacqlist

# Promote a specific deployment to production
vercel promote [deployment-url]
```

### Post-rollback verification

1. Navigate to `https://theblacqlist.com` — confirm homepage loads
2. Run smoke tests ST-01, ST-04, ST-07 from `prelaunch-smoke-test.md`
3. Post status update in `#incidents` Slack channel: "Production rolled back to [deployment-url]. Site restored."
4. File a ticket for root-cause investigation before re-deploying the bad code

---

## Scenario B — Additive Migration Rollback

**When to use:** A database migration was included in the deployment. The migration was additive (created new tables, columns, or indexes). The migration itself or the new application code depending on it is causing errors.

**Estimated time to restore:** 15–30 minutes

All 7 MVP migrations are additive. This is the most likely database rollback scenario.

### Step 1 — Roll back the application first

Follow Scenario A to promote the previous application deployment to production. This gets the application to a stable state while you handle the database.

### Step 2 — Identify the problematic migration

The migration files are in `supabase/migrations/`. The most recently applied migration is likely the problematic one. Confirm by checking Supabase Dashboard → Database → Migrations (shows applied migrations with timestamps).

### Step 3 — Write a reverse migration

For each statement in the problematic migration, write the reverse. **Do not execute this until it has been reviewed by a second engineer.**

Example reversal patterns:

| Original statement | Reverse statement |
|---|---|
| `CREATE TABLE ai_suggestions (...)` | `DROP TABLE IF EXISTS ai_suggestions;` |
| `CREATE INDEX ai_suggestions_listing_id_idx ON ai_suggestions(listing_id);` | `DROP INDEX IF EXISTS ai_suggestions_listing_id_idx;` |
| `ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;` | (no reversal needed — RLS enable is safe) |
| `CREATE POLICY "..." ON ai_suggestions ...` | `DROP POLICY IF EXISTS "..." ON ai_suggestions;` |
| `ADD COLUMN new_field text` | `ALTER TABLE [table] DROP COLUMN IF EXISTS new_field;` |

Write the full reverse migration in order — **reverse order of original statements**:

```sql
-- reverse-migration-[original-filename].sql
-- Review with second engineer before running

BEGIN;

-- Reverse statements in reverse order of original migration
DROP TABLE IF EXISTS ai_generation_requests;
DROP TABLE IF EXISTS ai_suggestions;

COMMIT;
```

### Step 4 — Apply the reverse migration

```bash
psql "[production-direct-db-url]" -f reverse-migration-[name].sql
```

Or paste and execute in Supabase Dashboard → SQL Editor.

### Step 5 — Verify

```sql
-- Confirm the tables no longer exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('ai_suggestions', 'ai_generation_requests');
-- Expected: 0 rows
```

### Step 6 — Confirm application stability

Run the full smoke test suite from `prelaunch-smoke-test.md`.

### Step 7 — Post-mortem

File a P1 incident ticket within 24 hours documenting:
- What the migration was supposed to do
- What went wrong
- What the fix is
- What process change prevents recurrence

---

## Scenario C — PITR Restore (Destructive Migration)

**When to use:** A migration dropped a table, dropped a column, truncated data, or performed an irreversible data transformation. A simple reverse migration cannot restore the lost data.

**Estimated time to restore:** 30–90 minutes (PITR restore time depends on database size and Supabase infrastructure)

**This is a high-stakes operation. Do not rush. Confirm with the Tech Lead before proceeding.**

### Step 1 — Identify the recovery timestamp

The recovery timestamp is the last moment before the problematic migration ran. To find it:

1. Check the migration command history (your terminal history, CI/CD logs, or the Supabase Dashboard migration log)
2. Note the timestamp of when `supabase db push` was run for the migration
3. Set the recovery point to **5 minutes before** that timestamp to provide a safety margin

### Step 2 — Roll back the application

Follow Scenario A first — get the application running on the pre-migration version before restoring the database.

### Step 3 — Initiate PITR restore

1. Supabase Dashboard → The BLACQList **production** project → Settings → Backups → Point-in-Time Recovery
2. Click **"Restore"**
3. Select the recovery timestamp (5 minutes before the migration ran)
4. Confirm the restore — this will restore the database to the selected point in time
5. **The database will be unavailable during the restore.** Duration varies — expect 15–60 minutes for a typical database size.

### Step 4 — Verify post-restore

After PITR restore completes:

```sql
-- Confirm the problematic changes are gone
-- Example: if migration 7 (ai_foundation) was the problem:
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('ai_suggestions', 'ai_generation_requests');
-- Expected after restore: 0 rows

-- Confirm earlier migrations' tables still exist
SELECT count(*) FROM listings;   -- should return seed data count
SELECT count(*) FROM categories; -- should return 25+
```

### Step 5 — Verify application health

Run the full smoke test suite. Confirm all P0 tests pass before notifying users the site is restored.

### Step 6 — Post-mortem (required)

A PITR restore means data loss occurred. A full post-mortem is required within 48 hours:
- What migration caused the issue
- What data was lost (if any)
- What process change prevents recurrence
- How to add the failing migration back safely

---

## Scenario D — Security Incident Response

**When to use:** A secret key was exposed (committed to git, logged in plaintext, exposed in a network response), unauthorized access is suspected, or a data breach may have occurred.

**Estimated time for initial containment:** < 30 minutes

### Immediate actions (within 30 minutes)

**If a Supabase service role key was exposed:**

1. Supabase Dashboard → The BLACQList production project → Settings → API → Project API Keys → **Rotate service_role key**
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production environment variables with the new key
3. Redeploy the application immediately (trigger from Vercel Dashboard → Deployments → Redeploy) to pick up the new key
4. Revoke the old key if the Supabase dashboard allows it

**If a Stripe secret key was exposed:**

1. Stripe Dashboard → Developers → API keys → Roll the secret key
2. Update `STRIPE_SECRET_KEY` in Vercel Production environment variables
3. Update `STRIPE_WEBHOOK_SECRET` if webhooks are registered (delete and re-register the endpoint)
4. Redeploy

**If a Resend API key was exposed:**

1. Resend Dashboard → API Keys → Delete the compromised key → Create a new key
2. Update `RESEND_API_KEY` in Vercel Production environment variables
3. Redeploy

**If `AUTH_SECRET` was exposed:**

1. Generate a new secret: `openssl rand -base64 32`
2. Update `AUTH_SECRET` in Vercel Production environment variables
3. **Warning:** Rotating `AUTH_SECRET` invalidates all existing sessions. All users will be signed out.
4. Redeploy

### Investigation actions (after containment)

1. Check git history for the exposed secret: `git log --all -p | grep "[partial-key-string]"`
2. If the key appears in git history: remove it using `git filter-branch` or BFG Repo Cleaner, then force-push. This is the one acceptable force-push to `main` — document it.
3. Review Supabase Dashboard → Logs → API logs for any unusual access patterns in the timeframe the key was exposed
4. Review Vercel Functions logs for unusual request patterns
5. File a security incident report regardless of whether malicious access is confirmed

---

## Scenario E — Feature Pause (Targeted Mitigation)

**When to use:** A specific feature is causing errors or privacy concerns, but the rest of the site is healthy. Rolling back the entire deployment is disproportionate.

### Pause receipt uploads

If receipt uploads are causing errors or a privacy concern is identified:

1. Add `RECEIPTS_UPLOAD_ENABLED=false` as an environment variable in Vercel Production
2. In `app/api/upload/[bucket]/route.ts`, add a check at the top of the POST handler:
   ```typescript
   if (bucket === "receipt-uploads" && process.env.RECEIPTS_UPLOAD_ENABLED === "false") {
     return NextResponse.json(
       { error: "Receipt uploads are temporarily unavailable.", code: "FEATURE_PAUSED" },
       { status: 503 }
     )
   }
   ```
3. Deploy the change
4. Users attempting to upload receipts will see a graceful error message

### Pause new business submissions

If the add-business form is causing data integrity issues:

1. The `/add-business` page can be set to redirect to a "coming soon" or maintenance page
2. Add a temporary redirect in `middleware.ts` or as a `redirect()` call in `app/add-business/page.tsx`

### Pause claim submissions

If the claim flow is causing problems:

1. The claim submission server action can return an early error response
2. Or add an environment variable flag `CLAIMS_ENABLED=false` and check it in the server action before processing

### Communication for feature pauses

Post a brief update to the platform's social account or status channel if the paused feature is publicly known:

> "We're temporarily pausing [feature] for maintenance. We'll update you when it's back."

---

## Scenario F — Email Delivery Failure

**When to use:** Transactional emails (sign-up confirmation, claim approval) are not being delivered.

**Estimated time to diagnose:** 10–15 minutes

### Diagnosis steps

1. Check Resend Dashboard → Logs — are sends showing as "Delivered" or "Bounced" or "Failed"?
2. Confirm `RESEND_API_KEY` in Vercel is a live key (not a test key `re_test_...`)
3. Check Resend Dashboard → Domains → confirm the `theblacqlist.com` sending domain shows all three DNS records (SPF, DKIM, DMARC) as verified (green)
4. Check if emails are landing in spam — ask a test user to check their spam folder

### Mitigation if delivery is completely broken

If emails cannot be delivered and the issue cannot be resolved quickly:

1. Disable email confirmation requirement temporarily:
   - Supabase Dashboard → Authentication → Settings → "Email Confirmations" → disable
   - This allows users to sign up without email verification — only do this as a last resort for a short period
2. Communicate to affected users via social channels that email may be delayed
3. Restore email confirmation as soon as delivery is working

---

## Incident Communication Templates

### P0 — Immediate status update (post within 30 minutes of incident confirmation)

Post in team `#incidents` Slack channel:

> **INCIDENT — [date] [time]**
> **Status:** Investigating
> **Symptom:** [What users are experiencing]
> **Affected:** [Which flows / all users / specific cohort]
> **Action taken:** [Rollback initiated / Investigating / Fix deployed]
> **Next update in:** 30 minutes

### P0 — Resolution update

> **RESOLVED — [date] [time]**
> **Duration:** [start time] to [end time] ([X] minutes)
> **Root cause:** [Brief description]
> **Fix applied:** [What was done]
> **Post-mortem:** Scheduled for [date]

### P1 — Status update

> **INCIDENT (P1) — [date]**
> **Status:** Acknowledged
> **Symptom:** [What is broken]
> **Impact:** [Who is affected — not all users]
> **Workaround:** [If any]
> **ETA for fix:** [Time estimate]

---

## Rollback Decision Authority

| Severity | Who can authorize rollback |
|---|---|
| P0 — Site down / security breach / data breach | On-call Engineer (immediate, no approval needed) |
| P0 — Partial but critical flow broken | On-call Engineer + notify Tech Lead within 15 minutes |
| P1 — Specific feature broken | Tech Lead decision: hotfix vs rollback |
| P2+ | No rollback — log and fix in next deployment |

**When in doubt about severity:** Roll back. An unneeded rollback costs 5 minutes. A delayed rollback during a real incident costs user trust.
