-- 1.18: Add 'rejected' to the listings status CHECK.
--
-- WHY THIS IS NEEDED: lib/actions/admin/rejectEntity.ts:44 writes
-- `status: 'rejected'`, but the constraint has never permitted it. Every admin
-- rejection of a business submission has failed at the database since launch —
-- the action returns "Failed to reject listing. Please try again." and the admin
-- has no way to tell that the value itself is the problem.
--
-- The rest of the product already assumes this state exists:
--   • app/admin/entities/page.tsx:46  — a "Rejected" tab that always returns 0 rows
--   • lib/actions/admin/approveEntity.ts:33 — a guard on 'rejected' that is dead code
--   • lib/email/templates/entity-rejected.tsx — an email that has never been sent
--   • rejectEntity.ts:38 — an "already rejected" guard that can never be true
-- The schema is the thing that disagrees, so the schema is what changes here.
--
-- NOT 'flagged'. Flagging is a different concept in the moderation model
-- (.claude/rules/moderation-policy.md) — content pulled for review, not a
-- submission declined. Reusing it would merge two admin queues into one tab.
--
-- The value list below is copied from the LIVE production constraint, read
-- 2026-08-13 via `pg_get_constraintdef`, plus 'rejected'. Same discipline as
-- 20260813000000_job_entity.sql: do NOT reconcile against the initial schema.
--
-- SAFETY: purely additive — this widens the accepted set, so no existing row can
-- violate the new constraint and no data is rewritten. No listing currently holds
-- 'rejected' (the constraint made that impossible), so the change is inert until
-- an admin rejects something.
--
-- DOWN / ROLLBACK: recreate the narrower constraint. It only succeeds if no row
-- has been rejected in the meantime; if any has, move those rows to 'archived'
-- first — do not delete them.
--
--   UPDATE listings SET status = 'archived' WHERE status = 'rejected';
--   ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
--   ALTER TABLE listings ADD CONSTRAINT listings_status_check
--     CHECK (status IN ('draft','pending','published','unpublished','flagged','archived'));

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN (
    'draft','pending','published','unpublished','flagged','archived','rejected'
  ));
