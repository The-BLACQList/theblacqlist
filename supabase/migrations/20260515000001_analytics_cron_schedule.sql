-- ─── pg_cron schedule for analytics aggregation ──────────────────────────────
-- Runs aggregate_entity_analytics() daily at 02:00 UTC (aggregates previous day).
-- No-ops if pg_cron is not enabled (local dev); enable via Supabase Dashboard
-- → Database → Extensions → pg_cron for production.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'aggregate-entity-analytics',
      '0 2 * * *',
      'SELECT aggregate_entity_analytics()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping aggregate-entity-analytics schedule. Enable via Supabase Dashboard > Database > Extensions.';
  END IF;
END $$;
