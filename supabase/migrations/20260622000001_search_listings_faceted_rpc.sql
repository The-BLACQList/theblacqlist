-- =============================================================================
-- Migration: Faceted search RPCs
-- Product: The BLACQList
-- The PostgREST query builder cannot express multi-group attribute facets,
-- per-option facet counts, price-from-detail-table joins, or open-now. These
-- two SECURITY DEFINER functions do. They read ONLY published, non-deleted,
-- non-flagged listings (enforced in WHERE), so DEFINER is safe.
--
--   search_listings_faceted(...) -> ordered listing ids + total_count.
--     The TS layer hydrates ids with the existing nested SELECT (reusing the
--     current row mapping) and re-orders by the returned order.
--   facet_counts(...) -> per-option counts for the sidebar. Disjunctive: each
--     facet group's counts apply every OTHER filter but ignore that group's
--     own selection, so selecting one option does not zero out its siblings.
--
-- Attribute logic: AND across groups, OR within a group.
-- =============================================================================


-- =============================================================================
-- FUNCTION: search_listings_faceted
-- Returns the filtered, sorted, paginated set of listing ids plus a windowed
-- total_count (identical on every row; 0 rows => caller treats total as 0).
-- =============================================================================
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
      l.published_at,
      l.save_count,
      l.avg_rating,
      l.review_count,
      l.name,
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
      AND (p_category_id   IS NULL OR l.category_id   = p_category_id)
      AND (p_city_id       IS NULL OR l.city_id       = p_city_id)
      AND (p_entity_type   IS NULL OR l.entity_type   = p_entity_type)
      AND (p_trust_tier    IS NULL OR l.trust_tier    = p_trust_tier)
      AND (p_location_type IS NULL OR l.location_type = p_location_type)
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR d.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
      -- Attributes: AND across groups, OR within a group.
      -- A listing fails if there exists a selected group for which it has NONE
      -- of that group's selected values.
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
    c.is_featured DESC,
    CASE WHEN p_sort = 'relevance' THEN c.rank END         DESC NULLS LAST,
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
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, int, int
) TO anon, authenticated;


-- =============================================================================
-- FUNCTION: facet_counts
-- Disjunctive per-option counts for the sidebar. Returns:
--   facet_kind = 'attribute' -> facet_key = attribute_values.id
--   facet_kind = 'price'     -> facet_key = '$' | '$$' | '$$$' | '$$$$'
--   facet_kind = 'open_now'  -> facet_key = 'open_now'
-- For each kind, all OTHER filters apply but that kind's own selection is
-- ignored (so siblings keep non-zero counts).
-- =============================================================================
CREATE OR REPLACE FUNCTION facet_counts(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL
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
  -- Core filters shared by every facet kind (q + scalar filters).
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
  ),
  -- Selected attribute values mapped to their groups.
  sel AS (
    SELECT av.id AS value_id, av.group_id
    FROM attribute_values av
    WHERE p_attribute_values IS NOT NULL AND av.id = ANY (p_attribute_values)
  ),
  sel_groups AS (SELECT DISTINCT group_id FROM sel),
  -- core + price + open_now (everything except attribute selections) — the base
  -- for attribute counts.
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
  -- For each base_pf listing, which selected groups it satisfies (>=1 selected
  -- value present in that group).
  listing_group_match AS (
    SELECT b.id AS listing_id, s.group_id
    FROM base_pf b
    JOIN listing_attributes la ON la.listing_id = b.id
    JOIN sel s ON s.value_id = la.value_id
    GROUP BY b.id, s.group_id
  ),
  -- Attribute counts (disjunctive): a listing counts toward value v in group G
  -- if it satisfies every selected group OTHER THAN G and has v.
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
  -- core + open_now + all attribute selections (everything except price) — base
  -- for price counts.
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
  -- core + price + all attribute selections (everything except open_now) — base
  -- for the open_now count.
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
  text, uuid, uuid, text, text, text, text[], uuid[], boolean
) TO anon, authenticated;


-- =============================================================================
-- Supporting indexes for the faceted hot path.
-- =============================================================================
CREATE INDEX IF NOT EXISTS listings_published_filter_idx
  ON listings (entity_type, category_id, city_id)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS listing_hours_dow_idx
  ON listing_hours (day_of_week, listing_id);
