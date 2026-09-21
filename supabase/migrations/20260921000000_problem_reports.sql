-- Problem reports: the "Report a problem" button testers see on every page.
--
-- WHY THIS EXISTS. Tester week (invites 2026-09-21) gives every tester two ways
-- to tell us something is wrong: the Tester Tour reflections, which only an
-- enrolled owner has, and replying to the invite email, which lands in a mailbox
-- and not in the admin. The founder asked for a button (2026-09-21): one text
-- box, on every signed-in page, whose submissions land somewhere an admin can
-- triage the same day. This table is that somewhere.
--
-- WHY NOT moderation_queue. That table has `entity_id uuid NOT NULL` because
-- every queue item is about a listing, a claim, or a review. A problem report is
-- about a page ("the save button did nothing on /discover/atlanta-ga"), and most
-- of them have no entity at all. Relaxing the NOT NULL to fit one more kind of
-- row would weaken a constraint five existing queue types rely on.
--
-- WHAT IS STORED. `page_path` is the pathname the report was sent from (no
-- query string, so no search terms travel with it), `user_agent` is the browser
-- string for reproducing layout bugs, `role` is the account's role at the time
-- (owner / supporter / admin) so a triager knows which path the tester was on,
-- and `body` is the text. `user_id` is a reference, not an email: the admin
-- page joins it to an address at render time and nothing here is PII on its own.
-- SET NULL on user deletion, same as moderation_queue.submitted_by: the report
-- outlives the account and carries no personal data of its own.
--
-- WHY status + pr_ref. The founder's ask was "immediately actionable". A report
-- moves new -> triaged -> fixed (with the PR that fixed it) or -> dismissed, and
-- the sidebar counts only `new`, so the pill goes to zero as reports are worked.
--
-- RLS ON, NO POLICIES. Only the service role reads or writes this table. The
-- submit action is a server action that verifies the session and inserts with
-- the service client; the admin page reads with the service client behind
-- requireAdmin(). A browser holding an anon or user JWT sees nothing and can
-- insert nothing, which is the whole point of the body CHECK living in the
-- database as well as in zod: neither layer can be bypassed by skipping the other.
--
-- ADDITIVE ONLY. New table, no existing object touched, no data migrated.
-- Applying this on its own changes nothing observable until the code PR ships.
--
-- DOWN PLAN:
--   DROP INDEX IF EXISTS problem_reports_status_created_at_idx;
--   DROP TABLE IF EXISTS problem_reports;
--   -- Safe at any point. After the code PR ships, drop the code first (the
--   -- submit action returns its generic error on a missing table, the admin
--   -- page 500s), so revert the deploy before running this.

CREATE TABLE IF NOT EXISTS problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  page_path text NOT NULL,
  user_agent text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'fixed', 'dismissed')),
  pr_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The admin page lists one status at a time, newest first; the sidebar counts
-- `new`. Both are served by this one index.
CREATE INDEX IF NOT EXISTS problem_reports_status_created_at_idx
  ON problem_reports (status, created_at DESC);

ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE problem_reports IS
  'Free-text problem reports from signed-in users (the Report a problem button). Service role only; no client policies by design.';
COMMENT ON COLUMN problem_reports.page_path IS
  'Pathname the report was sent from, without query string.';
COMMENT ON COLUMN problem_reports.role IS
  'The reporting account''s role at submit time (owner / supporter / admin), for triage context.';
COMMENT ON COLUMN problem_reports.status IS
  'new -> triaged -> fixed | dismissed. The admin sidebar counts new.';
COMMENT ON COLUMN problem_reports.pr_ref IS
  'Optional reference to the PR that fixed it, e.g. #142.';
