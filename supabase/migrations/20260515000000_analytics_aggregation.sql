-- ─── analytics_job_log ────────────────────────────────────────────────────────
-- Tracks each run of the daily aggregation job for audit and debugging.

CREATE TABLE IF NOT EXISTS analytics_job_log (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date            date        NOT NULL,
  listings_processed  integer     NOT NULL DEFAULT 0,
  errors              integer     NOT NULL DEFAULT 0,
  duration_ms         integer,
  status              text        NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_job_log_run_date_idx ON analytics_job_log (run_date DESC);

-- RLS: admins can read; service role can insert
ALTER TABLE analytics_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_job_log" ON analytics_job_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ─── aggregate_entity_analytics() ────────────────────────────────────────────
-- Aggregates one day's analytics_events into entity_analytics_daily.
-- Defaults to yesterday. Safe to re-run (upserts).
-- Returns JSONB summary: { date, rows_upserted, duration_ms, status }

CREATE OR REPLACE FUNCTION aggregate_entity_analytics(
  target_date date DEFAULT (CURRENT_DATE - INTERVAL '1 day')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start      timestamptz := clock_timestamp();
  v_upserted   integer     := 0;
  v_duration   integer;
BEGIN
  INSERT INTO entity_analytics_daily (
    listing_id,
    snapshot_date,
    page_views,
    cta_clicks,
    saves,
    shares,
    search_impressions
  )
  SELECT
    entity_id                                                               AS listing_id,
    target_date                                                             AS snapshot_date,
    COUNT(*) FILTER (WHERE event_name = 'page_view')                        AS page_views,
    COUNT(*) FILTER (WHERE event_name IN (
      'cta_click', 'hero_cta_click', 'action_bar_cta_click'
    ))                                                                      AS cta_clicks,
    COUNT(*) FILTER (
      WHERE event_name = 'save_toggled'
        AND (properties->>'action') = 'save'
    )                                                                       AS saves,
    COUNT(*) FILTER (WHERE event_name = 'share_initiated')                  AS shares,
    0                                                                       AS search_impressions
  FROM analytics_events
  WHERE created_at::date = target_date
    AND entity_type      = 'listing'
    AND entity_id        IS NOT NULL
  GROUP BY entity_id
  ON CONFLICT (listing_id, snapshot_date) DO UPDATE SET
    page_views         = EXCLUDED.page_views,
    cta_clicks         = EXCLUDED.cta_clicks,
    saves              = EXCLUDED.saves,
    shares             = EXCLUDED.shares,
    search_impressions = EXCLUDED.search_impressions,
    updated_at         = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;
  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;

  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status)
  VALUES (target_date, v_upserted, 0, v_duration, 'success');

  RETURN jsonb_build_object(
    'date',           target_date,
    'rows_upserted',  v_upserted,
    'duration_ms',    v_duration,
    'status',         'success'
  );

EXCEPTION WHEN OTHERS THEN
  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;

  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status, notes)
  VALUES (target_date, 0, 1, v_duration, 'failed', SQLERRM);

  RETURN jsonb_build_object(
    'date',        target_date,
    'duration_ms', v_duration,
    'status',      'failed',
    'error',       SQLERRM
  );
END;
$$;

-- pg_cron schedule lives in 20260515000001_analytics_cron_schedule.sql
-- Run that migration after enabling the pg_cron extension in the Supabase Dashboard.
