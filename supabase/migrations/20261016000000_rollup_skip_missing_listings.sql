-- Nightly rollup: skip events whose listing no longer exists.
--
-- WHY. On 2026-10-15 the analytics e2e test on main failed on staging. Two
-- save_toggled events that day pointed at listings that had since been
-- deleted. entity_analytics_daily.listing_id has a foreign key to listings,
-- so the INSERT raised, the EXCEPTION block logged the whole day as 'failed',
-- and no listing got its rollup or its rescore. One stale event was enough to
-- lose a day for everyone. analytics_events.entity_id has no foreign key (it
-- is a write-only log), so this can happen on prod too, the first time a
-- listing with events that day is deleted.
--
-- WHAT CHANGES. aggregate_entity_analytics only rolls up events whose
-- entity_id is still a row in listings. It counts the events it skipped and,
-- only when there were some, adds "; skipped N events for missing listings"
-- to the job log notes. Notes still start with "rescored N listings".
--
-- WHAT DOES NOT CHANGE. The body is 20260923000000_activity_ranking.sql PART 5
-- verbatim apart from the lines marked ▲ NEW. Same signature, same return
-- shape, same SECURITY DEFINER and search_path. CREATE OR REPLACE keeps the
-- REVOKE/GRANT set from 20260823000000_definer_function_hardening.sql
-- (EXECUTE for postgres and service_role only). No events are deleted, no
-- table or RLS change.
--
-- DOWN PLAN:
--   Re-run the PART 5 CREATE OR REPLACE FUNCTION aggregate_entity_analytics
--   block from supabase/migrations/20260923000000_activity_ranking.sql.
--   Grants survive CREATE OR REPLACE, so nothing else is needed.

CREATE OR REPLACE FUNCTION aggregate_entity_analytics(
  target_date date DEFAULT (CURRENT_DATE - INTERVAL '1 day')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start    timestamptz := clock_timestamp();
  v_upserted integer := 0;
  v_duration integer;
  v_rescored integer := 0;
  v_skipped  integer := 0;  -- ▲ NEW
BEGIN
  INSERT INTO entity_analytics_daily
    (listing_id, snapshot_date, page_views, cta_clicks, saves, shares, search_impressions)
  SELECT
    entity_id AS listing_id,
    target_date AS snapshot_date,
    COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
    COUNT(*) FILTER (WHERE event_name IN ('cta_click','hero_cta_click','action_bar_cta_click')) AS cta_clicks,
    COUNT(*) FILTER (WHERE event_name = 'save_toggled' AND (properties->>'action') = 'save') AS saves,
    COUNT(*) FILTER (WHERE event_name = 'share_initiated') AS shares,
    0 AS search_impressions
  FROM analytics_events
  WHERE created_at::date = target_date
    AND entity_type = 'listing'
    AND entity_id IS NOT NULL
    -- ▲ NEW: a deleted listing's events would break the foreign key and fail
    -- the whole day, so leave them out.
    AND EXISTS (SELECT 1 FROM listings l WHERE l.id = analytics_events.entity_id)
  GROUP BY entity_id
  ON CONFLICT (listing_id, snapshot_date) DO UPDATE SET
    page_views         = EXCLUDED.page_views,
    cta_clicks         = EXCLUDED.cta_clicks,
    saves              = EXCLUDED.saves,
    shares             = EXCLUDED.shares,
    search_impressions = EXCLUDED.search_impressions,
    updated_at         = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  -- ▲ NEW: how many events were left out, for the job log.
  SELECT COUNT(*) INTO v_skipped
  FROM analytics_events e
  WHERE e.created_at::date = target_date
    AND e.entity_type = 'listing'
    AND e.entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.id = e.entity_id);

  v_rescored := refresh_activity_scores();

  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;

  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status, notes)
  VALUES (
    target_date, v_upserted, 0, v_duration, 'success',
    'rescored ' || v_rescored || ' listings'
      || CASE WHEN v_skipped > 0  -- ▲ NEW
           THEN '; skipped ' || v_skipped || ' events for missing listings'
           ELSE '' END
  );

  RETURN jsonb_build_object(
    'date', target_date,
    'rows_upserted', v_upserted,
    'rescored', v_rescored,
    'duration_ms', v_duration,
    'status', 'success'
  );
EXCEPTION WHEN OTHERS THEN
  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;
  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status, notes)
  VALUES (target_date, 0, 1, v_duration, 'failed', SQLERRM);
  RETURN jsonb_build_object(
    'date', target_date,
    'duration_ms', v_duration,
    'status', 'failed',
    'error', SQLERRM
  );
END;
$$;
