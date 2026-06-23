# Ticket 101: Verification-document 90-day purge job

## Status

Deferred — not implemented; security plan documents the intent.

## Phase

Post-MVP / V1

## Priority

P2

## Feature Area

Compliance / Privacy / Backend

---

## Context

`docs/blacqlist/architecture/security-and-privacy-plan.md` states verification documents are "auto-purged 90 days after decision." No purge job exists — uploaded verification docs persist indefinitely in the private `verification-docs` bucket (and as paths on `listings.verification_docs` / `claims.verification_doc_paths`). The **live Privacy Policy does not promise this purge**, so there is no policy contradiction today — but data-minimization (and the security plan) call for closing the gap. **Do not add a 90-day purge promise to the Privacy Policy until this job ships.**

Risk rating: **Medium**. Source: `docs/blacqlist/legal/privacy-terms-compliance-review.md`, Finding 8.

---

## User Story

As a business owner who submitted ID/verification documents, I want them deleted once they're no longer needed, so my sensitive documents aren't retained indefinitely.

## Acceptance Criteria

- [ ] Scheduled job (Supabase scheduled function / cron) finds verification docs whose claim/verification decision is ≥ 90 days old.
- [ ] Removes the storage objects from `verification-docs` and nulls the corresponding path fields.
- [ ] Idempotent and logged (counts only, no PII).
- [ ] Retention window configurable; documented in the security plan.
- [ ] Once shipped, update the Privacy Policy retention section to state the verification-doc retention window.

→ **Backend**: implement the scheduled purge.
→ **Privacy**: confirm the retention window and update the policy after launch of the job.
