-- =============================================================================
-- Migration: multi-select location_type filtering in faceted search
-- Product: The BLACQList
--
-- Adds p_location_types text[] to BOTH faceted-search functions so a visitor can
-- select more than one location type at once. That is what the "Products &
-- Services" bin on the home page actually needs: businesses that operate online,
-- ship nationwide, come to you, or are mobile — four location types, one link.
--
-- Today that tile points at /discover?type=service_provider
-- (components/home/TheAvenues.tsx:39), which filters by ENTITY type and returns
-- nothing, because 100% of the seeded catalog is entity_type='business'
-- [Measured — production, 2026-09-02]. The bin is empty for a structural reason,
-- not a data reason: it was asking the wrong column. `location_type` is the
-- right column and is already a live facet — it just cannot hold more than one
-- value at a time, so a four-value bin has nothing to send it.
--
-- This migration is DDL only. It reads no rows and writes no rows.
--
-- -----------------------------------------------------------------------------
-- SIGNATURE CHANGE — read this before editing either function
-- -----------------------------------------------------------------------------
-- search_listings_faceted goes 16 args -> 17. facet_counts goes 12 -> 13.
-- Both current signatures are DROPped explicitly first.
--
-- That DROP is not housekeeping. 20260809000000:30-36 records what happens
-- without it, and 20260811010000:40-45 repeats it: CREATE OR REPLACE against a
-- signature that no longer matches silently becomes CREATE, leaving TWO
-- overloads. PostgREST sends named arguments, so a call supplying the old
-- argument list then matches the old overload exactly AND the new one by
-- defaults — Postgres calls that ambiguous and errors. One function per name,
-- always.
--
-- -----------------------------------------------------------------------------
-- WHY THE SINGULAR p_location_type IS KEPT, NOT REPLACED
-- -----------------------------------------------------------------------------
-- The obvious edit is to swap `p_location_type text` for `p_location_types
-- text[]`. That would break production for the length of one deploy.
--
-- The ordering rule from 20260811010000:50-55 applies unchanged: migration to
-- staging -> migration to production (GATE-DATA) -> code (GATE-DEPLOY). So this
-- migration runs while the CURRENTLY-DEPLOYED code is still live, and that code
-- sends `p_location_type` by name from four call sites (lib/listings/facets.ts,
-- lib/services/search.ts). A function with no `p_location_type` parameter
-- rejects those calls at PostgREST, and searchFacetedIds treats an error as
-- "RPC unavailable" — /discover degrades for every visitor until the code half
-- ships.
--
-- So both parameters exist. The singular stays for the deployed caller; the
-- plural is what the new code will send. Each defaults NULL and each
-- short-circuits its own predicate to TRUE when NULL, so:
--
--   • deployed code (sends singular only)      -> behaves exactly as today
--   • new code (sends plural only)             -> multi-select works
--   • both sent (never happens, but is defined) -> intersection, AND'd
--
-- The singular is removed in a LATER migration, once no deployed code sends it.
-- Doing it here would trade a real outage for a tidier signature.
--
-- -----------------------------------------------------------------------------
-- WHY LOCATION IS NOT DISJUNCTIVE IN facet_counts
-- -----------------------------------------------------------------------------
-- 20260811010000:278-283 settled this for radius; the same reasoning covers the
-- plural form, and the code says so out loud:
--
--   • facet_counts returns exactly three facet kinds — 'attribute', 'price' and
--     'open_now' (see its final UNION, and lib/listings/facets.ts:355-361 which
--     handles only those three). There is no 'location' facet kind.
--   • components/discovery/facetConstants.ts:19 and FacetSidebar.tsx:164-165
--     both say it in the UI: "No per-option counts, matching Ownership and
--     Trust Level."
--
-- The disjunctive treatment (ignore a facet's own selection when counting that
-- facet) exists so ticking one checkbox does not zero out its siblings within
-- the same group. Location has no per-option counts, so it has no siblings to
-- protect. It is the frame of the query, like city — so the predicate goes in
-- `core` and every downstream count inherits it.
--
-- -----------------------------------------------------------------------------
-- WHAT THIS DOES NOT FIX — the underlying data is still wrong
-- -----------------------------------------------------------------------------
-- 65 of 254 published listings have no address yet are labelled
-- location_type='physical' [Measured — production, 2026-09-02]. This migration
-- makes the filter capable of expressing "online, national, service-area,
-- mobile"; it does not move a single listing into those buckets. That is PR 8,
-- a founder-reviewed per-listing correction pass, not a heuristic sweep.
--
-- Until PR 8 lands, a correct multi-select query over incorrect labels returns
-- an incomplete bin. That is a data defect, visible and fixable, rather than a
-- query that structurally cannot work.
-- =============================================================================


-- =============================================================================
-- FUNCTION: search_listings_faceted (16 args -> 17)
-- Body is 20260811010000 verbatim except the two places marked ▲ NEW.
-- =============================================================================
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
);

CREATE OR REPLACE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  -- ▲ NEW (1 of 2): multi-select location. Sits next to the singular it will
  -- eventually replace. Argument POSITION is free here — every caller in the
  -- app uses named arguments — but the DROP and GRANT lists below must match
  -- this order exactly.
  p_location_types   text[]  DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  p_ownership_label  text    DEFAULT NULL,
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
      -- ▲ NEW (2 of 2): the plural predicate, AND'd with the singular above.
      -- Same array idiom as p_price_ranges below it: NULL disables, and an
      -- EMPTY array also disables (array_length returns NULL, not 0, for '{}').
      -- Without that second test an empty array would match nothing and a
      -- cleared filter would empty the page instead of restoring it.
      AND (
        p_location_types IS NULL
        OR array_length(p_location_types, 1) IS NULL
        OR l.location_type = ANY (p_location_types)
      )
      AND (p_ownership_label IS NULL OR l.ownership_label = p_ownership_label)
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR d.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
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
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
) TO anon, authenticated;


-- =============================================================================
-- FUNCTION: facet_counts (12 args -> 13)
-- The sidebar counts MUST honor the plural too. Without this, selecting
-- "Online only" + "Ships nationwide" would show "Delivery (84)" while the
-- results list holds 11 — a count that describes a different query than the one
-- the visitor is looking at. Same class of defect as checkpoint 1.16: a filter
-- the caller asked for, silently not applied.
--
-- Not disjunctive — see the header. Body is 20260811010000:291-435 verbatim
-- except the ▲ NEW block.
-- =============================================================================
DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean,
  double precision, double precision, double precision
);

CREATE OR REPLACE FUNCTION facet_counts(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  -- ▲ NEW: same parameter, same position relative to its neighbours, same
  -- semantics as search_listings_faceted.
  p_location_types   text[]  DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
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
        p_location_types IS NULL
        OR array_length(p_location_types, 1) IS NULL
        OR l.location_type = ANY (p_location_types)
      )
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
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision
) TO anon, authenticated;


-- No new index. `location_type` is a low-cardinality column on a few hundred
-- rows and the existing filters already narrow before it; adding an index here
-- would be speculative (database.md: "Do not add indexes speculatively").


-- Ask PostgREST to reload its schema cache; without this the new parameter is
-- rejected as unknown until the next restart (mirrors 20260811010000:453-455).
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- DOWN PLAN (GATE-DATA rollback — run manually, not automatically)
-- =============================================================================
-- No data is read or written in either direction. This is function DDL only;
-- rollback is safe at any time and takes seconds.
--
-- 1. Drop the 17-arg / 13-arg versions this migration created:
--      DROP FUNCTION IF EXISTS search_listings_faceted(
--        text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
--        double precision, double precision, double precision, text, int, int);
--      DROP FUNCTION IF EXISTS facet_counts(
--        text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
--        double precision, double precision, double precision);
--
-- 2. Re-create the previous definitions by running
--    20260811010000_search_radius_filter.sql IN FULL. It re-creates both the
--    16-arg and 12-arg versions, and its own leading DROPs (of the 13-arg and
--    9-arg signatures) are harmless no-ops here.
--
-- ⚠ STEP 1 IS NOT OPTIONAL. Running 20260811010000 without it does NOT replace
--   the 17-arg function — the signatures differ, so its CREATE OR REPLACE
--   becomes a CREATE and you end up with BOTH overloads live. A call sending the
--   16 older arguments by name then matches the 16-arg version exactly and the
--   17-arg version by default, which Postgres rejects as ambiguous. That is the
--   exact failure mode the header describes, reached from the rollback side.
--
-- ORDERING WARNING: rolling this back while location-types-aware application
-- code is deployed breaks /discover and /api/search, because the code sends
-- p_location_types to a function that no longer accepts it and PostgREST
-- rejects the call. Roll back the CODE FIRST, then this migration.
-- =============================================================================
