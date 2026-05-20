# Incident Response Runbook — The BLACQList

**Last updated:** 2026-05-18  
**Owner:** Engineering lead  
**Use this when:** Something is broken in production and you need to know what to do next.

---

## Severity Definitions

| Level    | Condition                                                                                                                       | Response SLA | Who responds                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------ |
| **SEV1** | Platform completely down OR data loss actively occurring OR auth broken for all users                                           | < 15 minutes | Engineering lead + all available engineers |
| **SEV2** | Major feature broken for all users — search returns nothing, listing pages 500, claims submission fails, Stripe checkout broken | < 1 hour     | Engineering lead                           |
| **SEV3** | Single feature degraded or broken for a subset of users — images not loading, analytics not recording, one page errors          | < 24 hours   | On-call engineer                           |

When in doubt, treat it as the higher severity. It is always better to escalate a SEV3 to SEV2 than to under-respond to a real SEV1.

---

## Escalation Order

1. **On-call engineer** — first responder for all alerts
2. **Engineering lead** — escalate immediately for SEV1 or any SEV2 that isn't resolved within 30 minutes
3. **Product lead** — notify for SEV1 and any SEV2 that may require user communication
4. **All-hands** — SEV1 only, if engineering lead cannot resolve within 30 minutes

Contact information: stored in the team's primary communication channel (not in this document — keep credentials out of version control).

---

## Incident Response Process

### Step 1: Detect

**Sources that generate alerts:**

- Sentry: error rate spike → Slack/email notification (configured in Ticket 094)
- Vercel: deployment failure notification
- Uptime monitor: HTTP 5xx or non-response → Slack/email
- User report: message to support email or social media

**First action on detection:**

1. Open Vercel Dashboard → The BLACQList → Functions / Logs — check for error spikes
2. Open Sentry — check for new error groups in the last 15 minutes
3. Open the affected page or route yourself and reproduce the issue

---

### Step 2: Triage

Answer these questions before taking any action:

| Question                             | Where to check                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Is the entire platform down?         | Visit `theblacqlist.com` from a fresh browser or incognito window                     |
| Is it one route or all routes?       | Test homepage, `/discover`, one entity page, `/sign-in`                               |
| Was there a recent deployment?       | Vercel Dashboard → Deployments — check timestamp of the current production deployment |
| Was there a recent migration?        | Check `supabase/migrations/` — what was last applied to production?                   |
| Is the database reachable?           | Supabase Dashboard → Database — check connection count and query latency              |
| Is it a Supabase edge / quota issue? | Supabase Dashboard → Project Settings → Usage                                         |

**SEV determination after triage:** Update the severity if the triage reveals it is different from initial assessment.

---

### Step 3: Communicate

**Within 5 minutes of confirming a SEV1 or SEV2:**

Internal Slack update (post in engineering channel):

```
🚨 [SEV1/SEV2] Incident in progress
What: [One sentence describing what is broken]
Impact: [Who is affected — all users / owners / specific flow]
Status: Investigating
Next update: [Time — typically 15–30 min]
```

User-facing status message (post on social / send to known affected users for SEV1):

```
We're aware of an issue affecting [feature name] and our team is working to resolve it.
We'll have an update within [time window]. Thank you for your patience.
```

**For SEV3:** No external communication unless the issue affects a significant percentage of users or has been ongoing for more than a few hours.

---

### Step 4: Mitigate

Choose the right mitigation path:

#### Path A — Bad deployment (no DB changes)

Use when: a recent code deployment introduced the problem and there were no migration files in the deploy.

1. Vercel Dashboard → Deployments
2. Find the last good deployment (the one before the broken deploy)
3. Click ··· → "Promote to Production"
4. Wait ~30 seconds for traffic to switch
5. Test: visit the previously broken page → confirm it works

CLI alternative:

```bash
vercel rollback [deployment-url-of-last-good-deploy]
```

#### Path B — Bad database migration (reversible)

Use when: a migration file was included in the deploy and that migration is reversible (added column, added table, added index).

1. Identify the exact migration file (most recent in `supabase/migrations/`)
2. Write the reverse SQL (DROP COLUMN / DROP TABLE / DROP INDEX for what was added)
3. Have a second engineer review the reverse SQL before running it
4. Apply via Supabase Dashboard → SQL Editor
5. Verify application health
6. Roll back application code (Path A) if needed

#### Path C — Irreversible migration (data loss / PITR required)

Use when: the migration dropped a column, dropped a table, or corrupted data — and Path B cannot undo it.

**This scenario is serious. Do not rush.**

1. Supabase Dashboard (production project) → Settings → Backups → Point-in-time Recovery
2. Select the recovery timestamp: the last point in time before the migration ran
3. Execute PITR restore — this rewrites the database to that timestamp
4. After restore completes: roll back application code (Path A) to a version compatible with the restored schema
5. Test all critical paths before re-opening traffic
6. File a post-mortem immediately

**PITR window:** 7 days on Supabase Pro. If more than 7 days have elapsed, PITR is not available — contact Supabase support.

#### Path D — Third-party service degradation (Supabase, Stripe, Vercel)

Use when: the platform is behaving correctly but a dependency is down.

1. Check the dependency's status page:
   - Supabase: status.supabase.com
   - Stripe: status.stripe.com
   - Vercel: vercel-status.com
2. If confirmed degradation: do not attempt code changes — wait for the service to recover
3. Communicate SEV status to users as appropriate (Path A status message)
4. Reduce the incident to SEV3 if the third-party issue is partial and does not affect critical paths

---

### Step 5: Resolve

The incident is resolved when:

- The broken feature is functional again
- All Section 9 smoke tests from `deployment-plan.md` pass
- No new errors appearing in Sentry for the affected route/operation
- The root cause is identified (even if not yet fixed permanently)

Post-resolution Slack update:

```
✅ Incident resolved
Duration: [start time] → [end time]
Root cause: [One sentence]
What was done: [Rollback / fix deployed / waiting on Supabase]
Follow-up: [Ticket filed for permanent fix if applicable]
```

---

### Step 6: Post-Mortem

**Required for:** All SEV1 incidents. Recommended for SEV2 incidents that took more than 1 hour to resolve.

Write the post-mortem within 48 hours of resolution. Store it in `docs/blacqlist/launch/post-mortems/[YYYY-MM-DD]-[short-description].md`.

**Post-mortem template:**

```markdown
# Post-Mortem: [Short title]

**Date:** [YYYY-MM-DD]
**Severity:** SEV1 / SEV2
**Duration:** [Start] → [End] ([N] minutes total)
**Author:** [Name]

## Impact

[Who was affected, what could they not do, estimated number of users impacted]

## Timeline

| Time  | Event                   |
| ----- | ----------------------- |
| HH:MM | Incident first detected |
| HH:MM | Triage completed        |
| HH:MM | Mitigation started      |
| HH:MM | Incident resolved       |

## Root Cause

[One paragraph explaining what caused the incident. Technical specifics.]

## What Went Well

- [Item 1]
- [Item 2]

## What Could Be Better

- [Item 1]
- [Item 2]

## Action Items

| Item                                  | Owner  | Due    |
| ------------------------------------- | ------ | ------ |
| [Specific task to prevent recurrence] | [Name] | [Date] |
```

---

## Quick Reference — Dashboard URLs

| Resource               | Where to find it                                   |
| ---------------------- | -------------------------------------------------- |
| Production deployments | Vercel Dashboard → [Project] → Deployments         |
| Production logs        | Vercel Dashboard → [Project] → Functions → Logs    |
| Sentry errors          | Sentry dashboard → The BLACQList project           |
| Supabase DB health     | Supabase Dashboard (prod project) → Database       |
| Supabase logs          | Supabase Dashboard → Logs Explorer                 |
| PITR restore           | Supabase Dashboard → Settings → Backups            |
| Stripe webhook status  | Stripe Dashboard → Developers → Webhooks           |
| Uptime monitor         | Configured in Ticket 094 — see monitoring plan doc |

---

## Rollback Decision Tree

```
Errors spike / platform broken?
│
├── Recent deployment?
│   │
│   ├── NO → Check third-party status pages (Path D)
│   │         If all external → wait + communicate
│   │
│   └── YES → Did deploy include a DB migration?
│             │
│             ├── NO → Vercel instant rollback (Path A, ~30s)
│             │         Run smoke tests
│             │         File root-cause ticket
│             │
│             └── YES → Is migration reversible?
│                       │
│                       ├── YES → Reverse migration SQL (Path B)
│                       │          Vercel rollback if needed
│                       │          File root-cause ticket
│                       │
│                       └── NO → PITR restore (Path C)
│                                 Vercel rollback to compatible version
│                                 File root-cause ticket
│                                 Post-mortem required
```
