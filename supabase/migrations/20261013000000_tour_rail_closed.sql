-- Tester Tour: a finished tester can close the tour panel for good.
--
-- WHY. Once the walk is done the panel has nothing left to ask, but it still
-- sat on every page. Founder, 2026-10-12: testers who finish need to close it
-- for good and just enjoy the site. "For good" means on their account, so it
-- stays closed on every device they sign in on, not just one browser.
--
-- WHAT CHANGES.
--   tour_enrollments.rail_closed_at: when the tester closed the panel. Null
--   means it still shows. Only a finished walk can be closed, so the CHECK
--   ties it to completed_at.
--
-- WHAT DOES NOT CHANGE. The enrollment stays live (ended_at untouched), so the
-- free month card on /dashboard/upgrade and the claim route work exactly as
-- before. No RLS change: tour_enrollments is still SELECT-only for testers.
-- The only writer is the closeTourRail server action, through the service
-- role, scoped to the signed-in tester's own finished enrollment.
--
-- DOWN PLAN:
--   ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_rail_closed_requires_completion;
--   ALTER TABLE tour_enrollments DROP COLUMN IF EXISTS rail_closed_at;
--   Revert the code FIRST: the app selects this column, and the select fails
--   once it is gone. Closed panels then show again for those testers.

ALTER TABLE tour_enrollments ADD COLUMN IF NOT EXISTS rail_closed_at timestamptz;

ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_rail_closed_requires_completion;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_rail_closed_requires_completion CHECK (
  rail_closed_at IS NULL OR completed_at IS NOT NULL
);

COMMENT ON COLUMN tour_enrollments.rail_closed_at IS
  'When a finished tester closed the Tester Tour panel for good. Null means it still shows.';
