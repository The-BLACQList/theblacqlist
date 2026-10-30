-- =============================================================================
-- Migration: a 'closed' status for jobs past their closing date (ticket 155)
-- =============================================================================
-- A job whose closes_at has passed moves from 'published' to 'closed'. The page
-- stays up with the "this role has closed" banner and no apply button, so links
-- people saved or shared keep working. A closed role is off the board, out of
-- search and out of every count, because all of those read status = 'published'.
--
-- What changes:
--   1. listings_status_check gains 'closed'. The list starts from the live
--      definition in 20260813020000_listings_rejected_status.sql (nothing later
--      changed it).
--   2. A partial index on listing_details_job (closes_at) for the daily sweep,
--      which looks for closes_at < now().
--   3. Four read policies gain ONE extra clause, for jobs only:
--        status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL
--      Each is re-created with its full existing condition. The latest
--      definitions are:
--        "listings: anon read published"                    20260510000001
--        "listings: authenticated read published or own"    20260510000001
--        "listing_details_job: anon read published"         20260813000000
--        "listing_details_job: authenticated read"          20260813000000
--
-- This BROADENS public read access, on purpose and narrowly: a closed job
-- listing and its job detail row become readable. No other entity type can be
-- read while closed, and no other table's policy changes. Closed-job extras
-- that live in other tables (photos, links, services, videos) keep their
-- published-only policies, so a closed job page shows the job details only.
--
-- Nothing else needs to learn about 'closed':
--   * search_listings_faceted, the counts, the activity ranking, the business
--     levels and the count triggers all require status = 'published'.
--   * a0_listings_owner_guard (20260926000000) refuses every job status change
--     from a user session, so an owner cannot move a job into or out of
--     'closed'. Closing runs in the cron sweep and reopening runs in the
--     dashboard action, both on the service role.
--
-- No row is updated. Rows only become 'closed' when the sweep runs.
--
-- Idempotent: the constraint, the index and each policy are dropped if present
-- and recreated, so re-running this in the SQL editor changes nothing.
--
-- Release: GATE-DATA. Apply to staging, verify, then production, before the
-- ticket 155 code merges. The sweep writes 'closed', which the old CHECK refuses.
--
-- Rollback: see the down script in the ticket 155 PR body. In short, move every
-- closed row to 'published' if its closes_at is still ahead (else
-- 'unpublished'), drop the index, and restore the seven-value CHECK and the
-- four policies exactly as their source migrations wrote them.
-- =============================================================================

-- 1. Status CHECK ------------------------------------------------------------

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('draft','pending','published','unpublished','flagged','archived','rejected','closed'));

-- 2. Sweep index -------------------------------------------------------------

CREATE INDEX IF NOT EXISTS listing_details_job_closes_at_idx
  ON listing_details_job (closes_at)
  WHERE closes_at IS NOT NULL;

-- 3. Read policies -----------------------------------------------------------

DROP POLICY IF EXISTS "listings: anon read published" ON listings;
CREATE POLICY "listings: anon read published"
  ON listings FOR SELECT TO anon
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listings: authenticated read published or own" ON listings;
CREATE POLICY "listings: authenticated read published or own"
  ON listings FOR SELECT TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL)
    OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "listing_details_job: anon read published" ON listing_details_job;
CREATE POLICY "listing_details_job: anon read published"
  ON listing_details_job FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL)
    )
  );

DROP POLICY IF EXISTS "listing_details_job: authenticated read" ON listing_details_job;
CREATE POLICY "listing_details_job: authenticated read"
  ON listing_details_job FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );
