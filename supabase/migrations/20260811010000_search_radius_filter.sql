-- =============================================================================
-- Migration: radius ("Near You") filtering in faceted search
-- Product: The BLACQList
--
-- Adds p_lat / p_lng / p_radius_miles to BOTH faceted-search functions and a
-- `distance` sort key, so the C3 module's Tile 01 "Near You" has a real filter
-- behind it instead of a link with nothing on the other end
-- (docs/blacqlist/design/living-commerce-index.md:66).
--
-- This migration is DDL only. It reads no rows and writes no rows.
--
-- -----------------------------------------------------------------------------
-- WHY HAVERSINE AND NOT POSTGIS
-- -----------------------------------------------------------------------------
-- PostGIS would be the textbook answer, and it is the wrong one here. It is a
-- heavyweight extension to add for a single "within N miles of me" predicate
-- over a few hundred rows, it changes what a local `supabase db reset` needs to
-- have installed, and geography columns would mean migrating `lat`/`lng`
-- (numeric, 20260510000000:455-456) that four other call sites already read as
-- plain numbers — including app/api/map/listings/route.ts:42.
--
-- Haversine in SQL has no extension dependency, is exact enough at these
-- distances (sphere vs. ellipsoid is a sub-0.5% error, far below the precision
-- of a browser geolocation fix), and stays a pure expression.
--
-- The cost of not having a spatial index is paid back with a BOUNDING-BOX
-- PREFILTER: two cheap BETWEEN comparisons on lat/lng knock out everything
-- outside the enclosing square before any trigonometry runs, and the partial
-- index added at the bottom of this file serves them. The exact circular test
-- then only runs on what survives. Postgres evaluates the box first because it
-- is written first and is dramatically cheaper — the haversine call is the last
-- conjunct on purpose.
--
-- -----------------------------------------------------------------------------
-- SIGNATURE CHANGE — read this before editing either function
-- -----------------------------------------------------------------------------
-- search_listings_faceted goes 13 args -> 16. facet_counts goes 9 -> 12.
-- Both old signatures are DROPped explicitly first.
--
-- That DROP is not housekeeping. 20260809000000:30-36 records what happens
-- without it: CREATE OR REPLACE against a signature that no longer matches
-- silently becomes CREATE, leaving TWO overloads. PostgREST sends named
-- arguments, so a call supplying the old argument list then matches the old
-- overload exactly AND the new one by defaults — Postgres calls that ambiguous
-- and errors. One function per name, always.
--
-- Backward compatible for every existing caller: all three new parameters
-- default NULL, and a NULL radius short-circuits the whole predicate to TRUE.
-- The currently-deployed app sends 13 named arguments and will resolve to the
-- new function with the three defaults filled in. That is deliberate — this
-- migration is designed to be applied BEFORE the code that uses it, so the
-- ordering is: migration to staging -> migration to production (GATE-DATA) ->
-- code (GATE-DEPLOY). The reverse order breaks /discover, because code sending
-- p_lat to a function that has no p_lat gets a PostgREST error, and
-- searchFacetedIds treats an error as "RPC unavailable".
--
-- -----------------------------------------------------------------------------
-- WHAT THIS DOES NOT FIX — 65 listings have no coordinates
-- -----------------------------------------------------------------------------
-- 189 of 254 published listings are geocoded
-- [Measured — production /api/map/listings, 2026-08-11]. The other 65 have NULL
-- lat/lng and are invisible to ANY radius query — 26% of the directory. 41 of
-- those are the known unmatched addresses awaiting human cleanup through the
-- admin edit UI (N7 map release).
--
-- The predicate below requires `d.lat IS NOT NULL AND d.lng IS NOT NULL`, which
-- makes that exclusion explicit rather than accidental. It is a product fact,
-- not a bug: the UI copy and the empty state have to say that a radius search
-- only covers businesses with a mapped address.
-- =============================================================================


-- =============================================================================
-- FUNCTION: haversine_miles — great-circle distance between two points.
-- IMMUTABLE + PARALLEL SAFE so the planner can hoist and reuse it freely.
-- Arguments are double precision because Postgres trig functions are; the
-- callers cast the numeric lat/lng columns at the call site.
-- =============================================================================
CREATE OR REPLACE FUNCTION haversine_miles(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  -- 3958.7613 = mean Earth radius in statute miles.
  -- least(1, ...) clamps the argument to asin(): floating-point error can push
  -- the square root a hair above 1 for two identical points, and asin(1.0000001)
  -- raises "input is out of range" rather than returning 0.
  SELECT 2 * 3958.7613 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

GRANT EXECUTE ON FUNCTION haversine_miles(
  double precision, double precision, double precision, double precision
) TO anon, authenticated;


-- =============================================================================
-- FUNCTION: search_listings_faceted (13 args -> 16)
-- Body is 20260809000000 verbatim except the four places marked ▲ NEW.
-- =============================================================================
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int
);

CREATE OR REPLACE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  p_ownership_label  text    DEFAULT NULL,
  -- ▲ NEW (1 of 4): radius filter. All three must be present together; any one
  -- NULL disables the filter entirely (see the predicate below).
  p_lat              double precision DEFAULT NULL,
  p_lng              double precision DEFAULT NULL,
  p_radius_miles     double precision DEFAULT NULL,
  p_sort             text    DEFAULT 'relevance',
  p_limit            int     DEFAULT 24,
  p_offset           int     DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      l.id,
      l.is_featured,
      l.ownership_label,
      l.published_at,
      l.save_count,
      l.avg_rating,
      l.review_count,
      l.name,
      CASE WHEN l.tier IN ('growth', 'premium') THEN 1 ELSE 0 END AS tier_weight,
      -- ▲ NEW (2 of 4): distance to the caller's point, in miles. NULL when no
      -- point was given or the listing has no coordinates — which is exactly the
      -- ordering behavior we want (NULLS LAST on the distance sort).
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             AND d.lat IS NOT NULL AND d.lng IS NOT NULL
        THEN haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
      END AS distance_miles,
      CASE
        WHEN p_q IS NOT NULL AND p_q <> ''
        THEN ts_rank(l.search_vector, websearch_to_tsquery('english', p_q))
        ELSE 0
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (p_q IS NULL OR p_q = '' OR l.search_vector @@ websearch_to_tsquery('english', p_q))
      AND (p_category_id    IS NULL OR l.category_id     = p_category_id)
      AND (p_city_id        IS NULL OR l.city_id         = p_city_id)
      AND (p_entity_type    IS NULL OR l.entity_type     = p_entity_type)
      AND (p_trust_tier     IS NULL OR l.trust_tier      = p_trust_tier)
      AND (p_location_type  IS NULL OR l.location_type   = p_location_type)
      AND (p_ownership_label IS NULL OR l.ownership_label = p_ownership_label)
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR d.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
      -- ▲ NEW (3 of 4): the radius predicate.
      --   • All three params required. A radius without a point, or a point
      --     without a radius, disables the filter here rather than guessing a
      --     default. The API layer rejects that combination with a 400 so a
      --     caller never silently gets the unfiltered index — the same rule
      --     checkpoint 1.17 established for unknown city/category slugs.
      --   • Listings with no coordinates are excluded, not included-by-default.
      --     65 of 254 published listings are in that state; see the header.
      --   • Order of conjuncts is load-bearing: bounding box (index-served)
      --     before the trigonometric test.
      AND (
        p_lat IS NULL OR p_lng IS NULL OR p_radius_miles IS NULL
        OR (
          d.lat IS NOT NULL
          AND d.lng IS NOT NULL
          -- ~69 statute miles per degree of latitude, everywhere.
          AND d.lat::double precision
              BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
          -- Degrees of longitude shrink with latitude, hence the cos() term.
          -- GREATEST(..., 0.01) keeps the box from exploding to infinity near
          -- the poles; at |lat| > ~89.4 the box simply becomes the whole globe
          -- and the exact test below still does the real work.
          AND d.lng::double precision
              BETWEEN p_lng - (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
                  AND p_lng + (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
          AND haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
              <= p_radius_miles
        )
      )
      -- Attributes: AND across groups, OR within a group.
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM attribute_values sel
          WHERE sel.id = ANY (p_attribute_values)
          GROUP BY sel.group_id
          HAVING NOT EXISTS (
            SELECT 1
            FROM listing_attributes la
            JOIN attribute_values av ON av.id = la.value_id
            WHERE la.listing_id = l.id
              AND av.group_id = sel.group_id
              AND la.value_id = ANY (p_attribute_values)
          )
        )
      )
  ),
  counted AS (
    SELECT f.*, count(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT c.id, c.total_count
  FROM counted c
  ORDER BY
    c.is_featured DESC,                              -- manual sponsored placement
    (c.ownership_label = 'black_owned') DESC,        -- editorial centering, above money
    -- ▲ NEW (4 of 4): the distance sort key. ASC — nearest first. NULLS LAST
    -- puts ungeocoded listings at the end IF they ever reach this point; under
    -- an active radius filter they have already been excluded by the predicate.
    --
    -- Note where it sits: BELOW the two keys above and ABOVE the relevance band,
    -- so "sort by distance" means distance decides, while is_featured and
    -- editorial centering still hold. It does not disturb any other sort — every
    -- key here is gated on its own p_sort value.
    CASE WHEN p_sort = 'distance' THEN c.distance_miles END ASC NULLS LAST,
    CASE WHEN p_sort = 'relevance' THEN round(c.rank::numeric, 2) END DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' AND p_q IS NOT NULL AND p_q <> ''
         THEN c.tier_weight END                             DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' THEN c.rank END          DESC NULLS LAST,
    CASE WHEN p_sort = 'rating'    THEN c.avg_rating END    DESC NULLS LAST,
    CASE WHEN p_sort = 'reviews'   THEN c.review_count END  DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'    THEN c.published_at END  DESC NULLS LAST,
    CASE WHEN p_sort = 'saves'     THEN c.save_count END    DESC NULLS LAST,
    CASE WHEN p_sort = 'name'      THEN c.name END          ASC,
    -- stable tiebreakers
    c.save_count DESC,
    c.published_at DESC NULLS LAST,
    c.id
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
) TO anon, authenticated;


-- =============================================================================
-- FUNCTION: facet_counts (9 args -> 12)
-- The sidebar counts MUST honor the radius too. Without this, "Near You" would
-- show "Delivery (84)" while the results list holds 11 — a count that describes
-- a different query than the one the visitor is looking at. Same class of defect
-- as checkpoint 1.16: a filter the caller asked for, silently not applied.
--
-- Radius is NOT disjunctive. The disjunctive treatment (ignore a facet's own
-- selection when counting that facet) exists so selecting one checkbox does not
-- zero out its siblings within the same group. Location is not a checkbox group
-- with siblings — it is the frame of the whole query, like the city filter,
-- which `core` already applies non-disjunctively. So the predicate goes in
-- `core` and every downstream count inherits it.
--
-- Body is 20260622000001:134-269 verbatim except the ▲ NEW block.
-- =============================================================================
DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean
);

CREATE OR REPLACE FUNCTION facet_counts(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  -- ▲ NEW: same three, same semantics as search_listings_faceted.
  p_lat              double precision DEFAULT NULL,
  p_lng              double precision DEFAULT NULL,
  p_radius_miles     double precision DEFAULT NULL
)
RETURNS TABLE (facet_kind text, facet_key text, facet_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  core AS (
    SELECT l.id, d.price_range
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (p_q IS NULL OR p_q = '' OR l.search_vector @@ websearch_to_tsquery('english', p_q))
      AND (p_category_id   IS NULL OR l.category_id   = p_category_id)
      AND (p_city_id       IS NULL OR l.city_id       = p_city_id)
      AND (p_entity_type   IS NULL OR l.entity_type   = p_entity_type)
      AND (p_trust_tier    IS NULL OR l.trust_tier    = p_trust_tier)
      AND (p_location_type IS NULL OR l.location_type = p_location_type)
      -- ▲ NEW: identical predicate to search_listings_faceted. Kept literally
      -- identical, not "equivalent" — if the two ever disagree, the sidebar
      -- counts stop describing the result set.
      AND (
        p_lat IS NULL OR p_lng IS NULL OR p_radius_miles IS NULL
        OR (
          d.lat IS NOT NULL
          AND d.lng IS NOT NULL
          AND d.lat::double precision
              BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
          AND d.lng::double precision
              BETWEEN p_lng - (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
                  AND p_lng + (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
          AND haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
              <= p_radius_miles
        )
      )
  ),
  sel AS (
    SELECT av.id AS value_id, av.group_id
    FROM attribute_values av
    WHERE p_attribute_values IS NOT NULL AND av.id = ANY (p_attribute_values)
  ),
  sel_groups AS (SELECT DISTINCT group_id FROM sel),
  base_pf AS (
    SELECT c.id
    FROM core c
    WHERE (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR c.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(c.id))
  ),
  listing_group_match AS (
    SELECT b.id AS listing_id, s.group_id
    FROM base_pf b
    JOIN listing_attributes la ON la.listing_id = b.id
    JOIN sel s ON s.value_id = la.value_id
    GROUP BY b.id, s.group_id
  ),
  attr_counts AS (
    SELECT 'attribute'::text AS facet_kind, av.id::text AS facet_key, count(DISTINCT b.id) AS facet_count
    FROM base_pf b
    JOIN listing_attributes la ON la.listing_id = b.id
    JOIN attribute_values av ON av.id = la.value_id AND av.is_active
    WHERE (
      SELECT count(*) FROM listing_group_match lgm
      WHERE lgm.listing_id = b.id AND lgm.group_id <> av.group_id
    ) = (
      SELECT count(*) FROM sel_groups sg WHERE sg.group_id <> av.group_id
    )
    GROUP BY av.id
  ),
  base_for_price AS (
    SELECT c.id, c.price_range
    FROM core c
    WHERE (p_open_now IS NOT TRUE OR is_open_now(c.id))
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM sel_groups sg
          WHERE NOT EXISTS (
            SELECT 1 FROM listing_attributes la
            JOIN sel s ON s.value_id = la.value_id
            WHERE la.listing_id = c.id AND s.group_id = sg.group_id
          )
        )
      )
  ),
  price_counts AS (
    SELECT 'price'::text AS facet_kind, bp.price_range AS facet_key, count(*) AS facet_count
    FROM base_for_price bp
    WHERE bp.price_range IS NOT NULL
    GROUP BY bp.price_range
  ),
  base_for_open AS (
    SELECT c.id
    FROM core c
    WHERE (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR c.price_range = ANY (p_price_ranges)
      )
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM sel_groups sg
          WHERE NOT EXISTS (
            SELECT 1 FROM listing_attributes la
            JOIN sel s ON s.value_id = la.value_id
            WHERE la.listing_id = c.id AND s.group_id = sg.group_id
          )
        )
      )
  ),
  open_count AS (
    SELECT 'open_now'::text AS facet_kind, 'open_now'::text AS facet_key, count(*) AS facet_count
    FROM base_for_open o
    WHERE is_open_now(o.id)
  )
  SELECT * FROM attr_counts
  UNION ALL SELECT * FROM price_counts
  UNION ALL SELECT * FROM open_count;
END;
$$;

GRANT EXECUTE ON FUNCTION facet_counts(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean,
  double precision, double precision, double precision
) TO anon, authenticated;


-- =============================================================================
-- Index for the bounding-box prefilter.
-- Partial: rows without coordinates can never satisfy the predicate, so keeping
-- them out holds the index to the ~189 geocoded rows instead of all 254.
-- =============================================================================
CREATE INDEX IF NOT EXISTS listing_details_business_latlng_idx
  ON listing_details_business (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;


-- Ask PostgREST to reload its schema cache; without this the new parameters are
-- rejected as unknown until the next restart (mirrors 20260809000000:222).
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- DOWN PLAN (GATE-DATA rollback — run manually, not automatically)
-- =============================================================================
-- No data is read or written in either direction. This is function DDL plus one
-- index; rollback is safe at any time and takes seconds.
--
-- 1. Drop the 16-arg / 12-arg versions this migration created:
--      DROP FUNCTION IF EXISTS search_listings_faceted(
--        text, uuid, uuid, text, text, text, text[], uuid[], boolean, text,
--        double precision, double precision, double precision, text, int, int);
--      DROP FUNCTION IF EXISTS facet_counts(
--        text, uuid, uuid, text, text, text, text[], uuid[], boolean,
--        double precision, double precision, double precision);
--
-- 2. Re-create the previous definitions:
--      • search_listings_faceted — run 20260809000000_search_tier_tiebreak.sql
--        in full (it is idempotent: its own leading DROP is a no-op here).
--      • facet_counts — run lines 134-273 of
--        20260622000001_search_listings_faceted_rpc.sql.
--
-- 3. Optional (the index is inert without the predicate, and costs one small
--    partial index of write overhead):
--      DROP INDEX IF EXISTS listing_details_business_latlng_idx;
--      DROP FUNCTION IF EXISTS haversine_miles(
--        double precision, double precision, double precision, double precision);
--
-- ORDERING WARNING: rolling this back while radius-aware application code is
-- deployed breaks /discover and /api/search, because the code sends p_lat to a
-- function that no longer accepts it and PostgREST rejects the call. Roll back
-- the code FIRST, then this migration.
-- =============================================================================
