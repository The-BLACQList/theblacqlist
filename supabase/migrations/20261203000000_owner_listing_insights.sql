-- Ticket 241: advanced analytics on Growth and Premium.
--
-- One read-only function that returns, for one page the caller owns, views and
-- clicks per storefront item and per event or job that page posted. It also
-- gives every paid plan a working "from marketplace" click count.
--
-- WHY A SECURITY DEFINER FUNCTION. analytics_events has one owner read policy,
-- "owner read own listing events", which only matches entity_type = 'listing'
-- rows whose entity_id is a listing the caller owns. Storefront rows are
-- entity_type 'product' or 'service', so an owner's own product clicks were
-- unreadable: the analytics page's "from marketplace" count ran under that
-- policy and always read 0. Widening the policy to match properties->>listing_id
-- would let a visitor-supplied JSON field grant read access; this function
-- attributes rows by joining the real tables instead
-- (marketplace_products.listing_id, marketplace_services.listing_id,
-- listing_details_event.organizer_listing_id,
-- listing_details_job.hiring_listing_id).
--
-- WHY GROUPED HERE. Counting rows in JS hits PostgREST's silent 1000-row cap
-- (see 20260815000000_sponsored_delivery_reporting.sql).
--
-- EVENTS AND JOBS: only ones the same owner posted. Another owner's published
-- event can name this page as its host, and those numbers are not this
-- owner's to read (app/dashboard/pages/[entityId]/events/page.tsx keeps the
-- same rule).
--
-- Additive and read-only: one function, no table, no column, no data touched.
--
-- DOWN PLAN:  DROP FUNCTION IF EXISTS owner_listing_insights(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION owner_listing_insights(
  p_listing_id uuid,
  p_since      timestamptz,
  p_until      timestamptz
)
RETURNS TABLE (
  item_kind text,
  item_id   uuid,
  item_name text,
  views     bigint,
  clicks    bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the ownership check lives here.
  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE listings.id = p_listing_id
      AND listings.owner_user_id = auth.uid()
      AND listings.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH items AS (
    SELECT 'product'::text AS kind, mp.id, mp.name::text AS name, 'product'::text AS etype
    FROM marketplace_products mp
    WHERE mp.listing_id = p_listing_id
    UNION ALL
    SELECT 'service', ms.id, ms.name::text, 'service'
    FROM marketplace_services ms
    WHERE ms.listing_id = p_listing_id
    UNION ALL
    SELECT 'event', l.id, l.name::text, 'listing'
    FROM listing_details_event de
    JOIN listings l ON l.id = de.listing_id
    WHERE de.organizer_listing_id = p_listing_id
      AND l.owner_user_id = auth.uid()
      AND l.deleted_at IS NULL
    UNION ALL
    SELECT 'job', l.id, l.name::text, 'listing'
    FROM listing_details_job dj
    JOIN listings l ON l.id = dj.listing_id
    WHERE dj.hiring_listing_id = p_listing_id
      AND l.owner_user_id = auth.uid()
      AND l.deleted_at IS NULL
  )
  SELECT
    i.kind,
    i.id,
    i.name,
    COUNT(ae.id) FILTER (
      WHERE ae.event_name IN ('marketplace_product_viewed', 'page_view')
    ) AS views,
    COUNT(ae.id) FILTER (
      WHERE ae.event_name IN ('cta_click', 'hero_cta_click', 'action_bar_cta_click')
    ) AS clicks
  FROM items i
  LEFT JOIN analytics_events ae
    ON ae.entity_type = i.etype
   AND ae.entity_id = i.id
   AND ae.created_at >= p_since
   AND ae.created_at < p_until
   -- Storefront items count their own view and click names; events and jobs
   -- are listings, so they count page views and the listing tap names.
   AND (
     (i.etype IN ('product', 'service')
       AND ae.event_name IN ('marketplace_product_viewed', 'cta_click'))
     OR (i.etype = 'listing'
       AND ae.event_name IN ('page_view', 'cta_click', 'hero_cta_click', 'action_bar_cta_click'))
   )
  GROUP BY i.kind, i.id, i.name;
END;
$$;

-- Items with no events come back with zeros, so the page can tell "nothing
-- yet" from "the function failed" (an error renders the section as
-- unavailable, never as zeros).

-- Supabase's default privileges grant new functions to anon directly, so
-- revoking from PUBLIC alone leaves anon able to call it (seen on staging,
-- 2026-11-21). The ownership check would refuse anon anyway; this makes the
-- grant say so too.
REVOKE ALL ON FUNCTION owner_listing_insights(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION owner_listing_insights(uuid, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION owner_listing_insights(uuid, timestamptz, timestamptz) TO authenticated;
