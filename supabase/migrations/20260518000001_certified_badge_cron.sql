-- ─── pg_cron schedule for certified badge auto-grant ─────────────────────────
-- Runs auto_grant_certified() nightly at 03:00 UTC.
-- Runs after 20260518000000_certified_badge.sql.
-- No-ops if pg_cron is not enabled (local dev); enable via Supabase Dashboard
-- → Database → Extensions → pg_cron for production.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-grant-certified',
      '0 3 * * *',
      'SELECT auto_grant_certified()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping auto-grant-certified schedule. Enable via Supabase Dashboard > Database > Extensions.';
  END IF;
END $$;
