# On-Call Schedule — The BLACQList

**Last updated:** 2026-06-30  
**Purpose:** Who to contact and who is responsible during the first 30 days post-launch.

> **Single-operator note (2026-06-30):** BLACQList currently runs **solo** — the founder is every role and there is **no human backup on-call yet**. This is a known, accepted risk for the gated soft launch (low volume, trusted testers). Standing up a real backup on-call (and the planned dedicated BLACQList ops/agent bundle) is a **pre-scale follow-up** before broad public growth. Until then, the founder is the single point of contact for all severities.

---

## Primary Contacts

| Role | Name | Contact | Escalation |
|---|---|---|---|
| Tech Lead / On-Call Eng | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Primary for all P0/P1 incidents |
| Product Lead | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Escalate if user-facing or business-impacting |
| Ops / Infrastructure | Chalece Delacoudray (founder) | cdelacoudray@gmail.com | Supabase, Vercel, DNS issues |
| Backup On-Call | — (none yet — solo operation) | — | _Add a backup before scaling past soft launch_ |

_Phone intentionally omitted — email is the chosen channel. Add a phone/Slack here if desired._

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
| **SEV1** — Site down, auth broken, data loss | Immediate (within 15 min) | Tech Lead + Product Lead via phone |
| **SEV2** — Major feature broken, performance degraded | Within 1 hour | Tech Lead via Slack |
| **SEV3** — Minor bug, UI issue, slow page | Next business day | Create ticket |

---

## Escalation Path

1. On-call engineer assesses and begins mitigation
2. If unresolved in 30 min → escalate to backup on-call
3. If still unresolved in 60 min → escalate to Product Lead
4. If data loss or security incident → notify all contacts immediately regardless of time

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
