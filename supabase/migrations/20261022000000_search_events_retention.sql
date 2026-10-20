-- ─── search_events: 90-day retention (ticket 142) ──────────────────────────────
-- [Decision — founder, 2026-10-20] The zero-result search log is anonymous and
-- kept 90 days. lib/search/zeroResultLog.ts writes only searches that found
-- nothing, with no user id, IP or coordinates. This job deletes every row older
-- than 90 days, nightly at 03:30 UTC (after auto-grant-certified at 03:00).
--
-- Privacy review: docs/blacqlist/compliance/search-zero-result-log-review.md
--
-- No table change. search_events already exists (initial schema) with RLS on
-- and no policies, so only the service role can read or write it.
--
-- Same idempotent pattern as 20260816000000_rate_limit_counters.sql:
-- cron.schedule with an existing job name replaces that job, so re-running this
-- file is safe. No-ops cleanly if pg_cron is not enabled (local dev).

CREATE OR REPLACE FUNCTION purge_search_events()
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM search_events
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

-- Not callable from the API. Only the cron job (running as the owner) and the
-- service role may run it.
REVOKE ALL ON FUNCTION purge_search_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_search_events() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_search_events() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-search-events',
      '30 3 * * *',
      'SELECT purge_search_events()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled, skipping purge-search-events schedule. Enable via Supabase Dashboard > Database > Extensions.';
  END IF;
END $$;

-- ============================================================================
-- DOWN / ROLLBACK
-- ----------------------------------------------------------------------------
-- Removing the job means rows are kept past 90 days, which breaks the promise in
-- the privacy review. Only roll back alongside turning the log off.
--
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--       PERFORM cron.unschedule('purge-search-events');
--     END IF;
--   END $$;
--
--   DROP FUNCTION IF EXISTS purge_search_events();
-- ============================================================================
