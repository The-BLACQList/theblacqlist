# On-Call Schedule — The BLACQList

**Last updated:** 2026-09-03 _(escalation table and severity notify column rewritten to solo reality — see the accepted-risk note below)_  
**Purpose:** Who to contact and who is responsible during the first 30 days post-launch.

> **Rotation note:** the 30-day rotation below is keyed to **relative** weeks ("Week 1 (launch week)"), not calendar dates. It does not go stale as the flip date moves.

> **Single-operator note (2026-06-30):** BLACQList currently runs **solo** — the founder is every role and there is **no human backup on-call yet**. This is a known, accepted risk for the gated soft launch (low volume, trusted testers). Standing up a real backup on-call (and the planned dedicated BLACQList ops/agent bundle) is a **pre-scale follow-up** before broad public growth. Until then, the founder is the single point of contact for all severities.

---

## Primary Contacts

| Role | Name | Contact | Escalation |
|---|---|---|---|
| Tech Lead / On-Call Eng | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Primary for all P0/P1 incidents |
| Product Lead | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Escalate if user-facing or business-impacting |
| Ops / Infrastructure | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Supabase, Vercel, DNS issues |
| Backup On-Call | — (none yet — solo operation) | — | _Add a backup before scaling past soft launch_ |

_Phone intentionally omitted — **email is the only channel**, for every severity including SEV1. No Slack workspace and no phone tree exist for this project; nothing below should be read as implying one. Add a phone/Slack row here if that ever changes, and update the severity table in the same edit._

---

## On-Call Rotation — First 30 Days

_Solo operation — the founder is primary every week; no secondary rotation yet._

| Week | Primary | Backup |
|---|---|---|
| Week 1 (launch week) | Chalece (founder) | — (solo) |
| Week 2 | Chalece (founder) | — (solo) |
| Week 3 | Chalece (founder) | — (solo) |
| Week 4 | Chalece (founder) | — (solo) |

---

## Incident Response Quick Reference

**Full runbook:** [incident-response-runbook.md](./incident-response-runbook.md)

| Severity | Response SLA | Who to notify |
|---|---|---|
| **SEV1** — Site down, auth broken, data loss | Immediate (within 15 min) | Founder — email (`cdelacoudray@gmail.com`) + Sentry alert |
| **SEV2** — Major feature broken, performance degraded | Within 1 hour | Founder — email (`cdelacoudray@gmail.com`) |
| **SEV3** — Minor bug, UI issue, slow page | Next business day | Create ticket |

---

## Escalation Path

1. Founder assesses and begins mitigation
2. If unresolved in 30 min → **there is no backup on-call to escalate to.** Instead: execute the rollback (`incident-response-runbook.md`) rather than continuing to debug forward. Rolling back to the last known-good Vercel deployment is the escalation.
3. If still unresolved in 60 min → re-gate the site (`COMING_SOON_MODE=true` + redeploy) and work the incident with the public surface closed. A gated site is a recoverable state; a broken public site is not.
4. If data loss or security incident → stop, do not continue mitigating, and preserve state for recovery (PITR window, Supabase logs, Sentry trace) before any further change

> ### ⚠ Single point of failure — accepted risk
>
> `[Decision — founder, 2026-09-03]` This table previously routed SEV1 to "Tech Lead + Product Lead **via phone**", SEV2 to "Tech Lead **via Slack**", and escalation steps 2 and 3 to a "backup on-call" and a "Product Lead." **All four paths were inexecutable** — every role is the same person (see Primary Contacts), there is no backup, and no phone or Slack channel exists for this project. An escalation path that routes to yourself is not a path; it is a blank space that reads as coverage.
>
> The rewrite above replaces each with something that can actually be done at 2am by one person: **email + Sentry alert** as the notify channel, and **rollback, then re-gate** as the escalation ladder. The escalation is no longer *to a person* — it is *to a safer state of the system.*
>
> **The underlying risk is unchanged and is accepted, not solved:** if the founder is unreachable, nothing responds. That is acknowledged in the Single-operator note above and stands as an accepted risk for the gated soft launch and the early public window. Standing up a real backup on-call is a **pre-scale follow-up**, not a flip gate.

---

## Key Dashboard Links

| Service | Link | Purpose |
|---|---|---|
| Vercel | https://vercel.com/the-blacql-ist/theblacqlist | Deployments, logs, rollback |
| Supabase (prod) | https://supabase.com/dashboard/project/ytlrnczevdnsfdzjbeqg | Database, auth, storage, logs |
| Sentry | https://the-blacqlist.sentry.io | Error tracking and alerts |
| Uptime Monitor | Sentry Uptime (same org — 3 monitors on `/`, `/api/health`, `/api/health/supabase`) | Availability monitoring |

---

## First 30-Day SLAs (Commitment to Users)

- Claim review: ≤48 hours during business hours
- Critical incident response (site down): ≤15 minutes
- Bug report acknowledgment: ≤24 hours
- Non-critical feature requests: reviewed in next sprint
