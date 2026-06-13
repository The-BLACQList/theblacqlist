# On-Call Schedule — The BLACQList

**Last updated:** 2026-05-22  
**Purpose:** Who to contact and who is responsible during the first 30 days post-launch.

---

## Primary Contacts

| Role | Name | Contact | Escalation |
|---|---|---|---|
| Tech Lead / On-Call Eng | _[name]_ | _[phone / Slack]_ | Primary for all P0/P1 incidents |
| Product Lead | _[name]_ | _[phone / Slack]_ | Escalate if user-facing or business-impacting |
| Ops / Infrastructure | _[name]_ | _[phone / Slack]_ | Supabase, Vercel, DNS issues |
| Backup On-Call | _[name]_ | _[phone / Slack]_ | When primary is unavailable |

---

## On-Call Rotation — First 30 Days

| Week | Primary | Backup |
|---|---|---|
| Week 1 (launch week) | _[name]_ | _[name]_ |
| Week 2 | _[name]_ | _[name]_ |
| Week 3 | _[name]_ | _[name]_ |
| Week 4 | _[name]_ | _[name]_ |

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

Fill in after production deploy:

| Service | Link | Purpose |
|---|---|---|
| Vercel | _[url]_ | Deployments, logs, rollback |
| Supabase | _[url]_ | Database, auth, storage, logs |
| Sentry | _[url]_ | Error tracking and alerts |
| Uptime Monitor | _[url]_ | Availability monitoring |

---

## First 30-Day SLAs (Commitment to Users)

- Claim review: ≤48 hours during business hours
- Critical incident response (site down): ≤15 minutes
- Bug report acknowledgment: ≤24 hours
- Non-critical feature requests: reviewed in next sprint
