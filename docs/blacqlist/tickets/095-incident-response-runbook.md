# Ticket 095: Post-Launch Incident Response Runbook and Support Playbook

## Status
Draft

## Phase
Phase 18: Production Deployment and Post-Launch Hardening

## Priority
P1

## Feature Area
Ops

## Context
Documentation for post-launch operations. Two deliverables: an Incident Response Runbook for engineering (SEV definitions, escalation, rollback procedures) and a Support Playbook for the team handling user-reported issues. Both documents should be written before launch day. References `deployment-plan.md` for rollback notes. No code is written in this ticket — it is documentation only.

## User Story
As the engineering and support team, I want documented incident response and support procedures, so that we can respond to production issues and user reports quickly and consistently without needing to improvise under pressure.

## Scope

**Deliverable 1:** `docs/blacqlist/launch/incident-response-runbook.md`
- Severity definitions:
  - SEV1: Platform completely down or data loss occurring — all-hands, < 15 min response
  - SEV2: Major feature broken for all users (search, auth, listing pages) — < 1 hour response
  - SEV3: Minor feature degraded or single-user issue — < 24 hour response
- Escalation contacts and order
- Step-by-step incident response process: Detect → Triage → Communicate → Mitigate → Resolve → Post-mortem
- Communication templates: user-facing status message, internal Slack update, stakeholder email
- Rollback procedure:
  - Vercel: navigate to Deployments → select previous deployment → "Promote to Production"
  - Database: for destructive migrations, document the specific rollback SQL per migration ticket
  - If rollback is not possible: document the mitigation path
- Post-mortem template: timeline, root cause, impact, action items

**Deliverable 2:** `docs/blacqlist/launch/support-playbook.md`
- Top 10 anticipated support issues with diagnostic steps and resolutions:
  1. "Claim approved but I still can't access my dashboard" — check `user_roles` table for owner row; check middleware session refresh
  2. "My listing isn't showing in search" — check `status = 'published'`, check `search_vector` is not null, verify `pg_trgm` is enabled
  3. "I uploaded a document but my claim is still pending" — check `claims.verification_doc_path` is not null; check admin claims queue
  4. "Verification document upload keeps failing" — check file size (< 10MB), file type (JPEG/PNG/PDF only), check Supabase Storage `verification-docs` bucket policy
  5. "I can't sign in to my account" — check Supabase Auth logs; check if account is suspended (`profiles.suspended_at`)
  6. "My gallery images aren't showing on my page" — check `media_attachments` records exist; check `listing-media` bucket access; force ISR revalidation
  7. "I changed my hours but the page still shows old hours" — ISR cache (1h TTL); trigger manual revalidation via admin
  8. "Receipt upload isn't working" — check file size/type; check `receipt_uploads` table for record; check `client_idempotency_key` collision
  9. "My analytics data shows 0 views" — check `entity_analytics_daily` for rows; check if aggregation job has run; verify `analytics_events` are being inserted
  10. "The page editor won't save my changes" — check for TypeScript validation errors in the form; check SA response for `ActionResult` error; check Supabase connection

## Out of Scope
- Automated incident management tooling (PagerDuty, etc.) — V1
- Public status page — V1
- Automated rollback scripts

## Dependencies
- Depends on: Ticket 094 (monitoring setup — runbook references alert thresholds)

## UX Notes
Not applicable — documentation ticket.

## Design Notes
Not applicable.

## Data Notes
Not applicable.

## API Notes
Not applicable.

## Implementation Notes
- Both documents are Markdown files written to `docs/blacqlist/launch/`
- Write with a real incident in mind — be specific, not generic
- Include actual Vercel and Supabase dashboard URLs where helpful (e.g., where to find the deployment list)
- Support playbook should be usable by a non-engineer teammate

## Acceptance Criteria
- [ ] `docs/blacqlist/launch/incident-response-runbook.md` exists and covers all 6 process steps
- [ ] Incident runbook includes severity definitions (SEV1/SEV2/SEV3) with response SLAs
- [ ] Incident runbook includes Vercel rollback procedure (step-by-step)
- [ ] Incident runbook includes a post-mortem template
- [ ] `docs/blacqlist/launch/support-playbook.md` exists and covers at least 10 issues
- [ ] Each support issue has: symptom, diagnostic steps, resolution steps, escalation path
- [ ] Both documents reviewed by at least one other team member before launch

## Failure States
Not applicable — documentation ticket.

## Edge Cases
- If the rollback involves a database migration that cannot be reversed: document the mitigation path explicitly (feature flag, data backfill strategy) rather than leaving it blank

## Accessibility Notes
Not applicable.

## QA Test Cases
| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | Runbook exists | Check docs/blacqlist/launch/incident-response-runbook.md | File present with all 6 sections |
| 2 | Support playbook exists | Check docs/blacqlist/launch/support-playbook.md | File present with 10+ issues |
| 3 | Rollback steps are accurate | Follow the Vercel rollback steps in a staging environment | Previous deployment successfully promoted |

## Security Notes
- Do not include production credentials, database connection strings, or API keys in the runbooks
- If referencing specific Vercel/Supabase dashboard URLs, use generic paths (not URLs that embed project IDs or tokens)

## Completion Checklist
- [ ] `incident-response-runbook.md` written and reviewed
- [ ] `support-playbook.md` written and reviewed
- [ ] Rollback procedure tested in staging
- [ ] Both documents committed to repo before launch day
- [ ] PR opened and linked to this ticket
