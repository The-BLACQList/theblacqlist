-- Sponsored delivery reporting.
--
-- The admin sponsored page needs impressions + clicks per placement. Three ways
-- to get them were considered and two were rejected for reasons worth writing
-- down, because both look fine until the numbers get large:
--
--   1. Fetch the rows and count in JS — PostgREST caps a select at 1000 rows by
--      default and truncates silently. That hands a sponsor who paid for a
--      placement a number that is confidently wrong.
--   2. One `head: true` count query per placement per event type — 100
--      placements is 200 round trips on a page load.
--   3. One RPC that groups server-side. This file.
--
-- Additive and read-only: one function, no table, no column, no data touched.
--
-- DOWN PLAN:  DROP FUNCTION IF EXISTS sponsored_placement_delivery(uuid[]);

CREATE OR REPLACE FUNCTION sponsored_placement_delivery(p_placement_ids uuid[])
RETURNS TABLE (
  placement_id uuid,
  impressions  bigint,
  clicks       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the authorization check has to live here.
  -- It cannot be delegated to a policy on analytics_events: that table has only
  -- an owner-scoped read policy (entity_type = 'listing'), and these rows are
  -- entity_type = 'sponsored_placement'. Without this check any authenticated
  -- user could read delivery numbers for placements they do not own.
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    ae.entity_id AS placement_id,
    COUNT(*) FILTER (WHERE ae.event_name = 'sponsored_impression') AS impressions,
    COUNT(*) FILTER (WHERE ae.event_name = 'sponsored_click')      AS clicks
  FROM analytics_events ae
  WHERE ae.entity_type = 'sponsored_placement'
    AND ae.entity_id = ANY (p_placement_ids)
    AND ae.event_name IN ('sponsored_impression', 'sponsored_click')
  GROUP BY ae.entity_id;
END;
$$;

-- Placements with no delivery yet simply do not come back as rows. The caller
-- treats a missing row as zero — that is honest here, because the query really
-- did run and really did find nothing. It is NOT the same as the page failing
-- to reach this function, which renders as "—" instead. See
-- app/admin/sponsored/page.tsx.

REVOKE ALL ON FUNCTION sponsored_placement_delivery(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sponsored_placement_delivery(uuid[]) TO authenticated;

-- Supports the entity_id = ANY(...) scan above. analytics_events already has
-- (entity_type, entity_id) from the initial schema; this narrows it further to
-- the two event names this function reads, which keeps the index small as the
-- events table grows.
CREATE INDEX IF NOT EXISTS analytics_events_sponsored_idx
  ON analytics_events (entity_id, event_name)
  WHERE entity_type = 'sponsored_placement';
