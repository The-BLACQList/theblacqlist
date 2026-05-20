-- ─── get_top_listings_by_views ────────────────────────────────────────────────
-- Returns the top N listings by total page views over the last `days_back` days.
-- Uses pre-aggregated entity_analytics_daily — no full event scan needed.

CREATE OR REPLACE FUNCTION get_top_listings_by_views(
  limit_n   int DEFAULT 10,
  days_back int DEFAULT 30
)
RETURNS TABLE (
  listing_id   uuid,
  listing_name text,
  city_name    text,
  total_views  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.listing_id,
    l.name                  AS listing_name,
    c.name                  AS city_name,
    SUM(e.page_views)::bigint AS total_views
  FROM entity_analytics_daily e
  JOIN listings l ON l.id = e.listing_id
  LEFT JOIN cities c ON c.id = l.city_id
  WHERE e.snapshot_date >= CURRENT_DATE - days_back
  GROUP BY e.listing_id, l.name, c.name
  ORDER BY total_views DESC
  LIMIT limit_n;
$$;

-- ─── get_top_search_queries ───────────────────────────────────────────────────
-- Returns the top N search queries by frequency over the last `days_back` days.
-- Requires service role (search_events is service-role only via RLS).

CREATE OR REPLACE FUNCTION get_top_search_queries(
  limit_n   int DEFAULT 10,
  days_back int DEFAULT 30
)
RETURNS TABLE (
  query        text,
  search_count bigint,
  avg_results  numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    query,
    COUNT(*)::bigint           AS search_count,
    ROUND(AVG(result_count), 1) AS avg_results
  FROM search_events
  WHERE created_at >= NOW() - make_interval(days => days_back)
    AND query IS NOT NULL
    AND query <> ''
  GROUP BY query
  ORDER BY search_count DESC
  LIMIT limit_n;
$$;
