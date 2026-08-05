-- =============================================================================
-- Migration: Listings ownership label (Black-Owned / Ally)
-- Product: The BLACQList
--
-- Pivot: the platform no longer restricts listings to Black-owned businesses.
-- Every listing carries an authoritative, single-select ownership label:
--   'black_owned' — majority (>=51%) Black ownership + operational control
--   'ally'        — supports Black-owned businesses, not itself Black-owned
--
-- Both labels have identical commercial access (listing + paid tiers). The only
-- difference is EDITORIAL: Black-Owned listings are centered by default ranking
-- in search_listings_faceted (see the new ORDER BY term). This treats
-- "Black-owned" as self-identified editorial content, NOT a race-based commerce
-- gate — the legally-defensible structure per
-- docs/blacqlist/legal/legal-pages-and-discrimination-risk-review.md (Lever #2).
--
-- Additive, reversible, backward-compatible:
--   * The new column DEFAULTs to 'black_owned', so all existing/seeded rows stay
--     Black-Owned with zero data touch.
--   * The RPC's new p_ownership_label arg is DEFAULT NULL, so code deployed
--     BEFORE this migration keeps working unchanged (arg omitted => no filter).
-- Manual rollback SQL is at the bottom of this file (GATE-DATA down plan).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Authoritative ownership label column.
-- -----------------------------------------------------------------------------
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ownership_label text NOT NULL DEFAULT 'black_owned'
    CHECK (ownership_label IN ('black_owned', 'ally'));

-- Explicit backfill: no-op given the default, but documents intent and is safe
-- to re-run. Every pre-pivot listing was, by definition, Black-owned.
UPDATE listings SET ownership_label = 'black_owned' WHERE ownership_label IS NULL;

CREATE INDEX IF NOT EXISTS listings_ownership_label_idx
  ON listings (ownership_label)
  WHERE status = 'published' AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2) Replace search_listings_faceted: add the p_ownership_label filter and the
--    editorial-centering ORDER BY term. Adding a parameter changes the
--    signature, so DROP the prior 12-arg overload before CREATE (avoids an
--    ambiguous duplicate). facet_counts is unchanged (the Ownership control
--    renders without counts, like the Trust-Level control).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, int, int
);

CREATE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  p_ownership_label  text    DEFAULT NULL,   -- NEW: filter Black-Owned / Ally
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
      AND (p_ownership_label IS NULL OR l.ownership_label = p_ownership_label)  -- NEW
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
    c.is_featured DESC,                              -- paid featured placement (unchanged, stays top)
    (c.ownership_label = 'black_owned') DESC,        -- NEW: editorial centering of Black-Owned
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
  text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int
) TO anon, authenticated;

-- Ask PostgREST to reload its schema cache so the new signature is picked up.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- MANUAL ROLLBACK (down plan — run by hand at GATE-DATA if this must be reverted)
-- =============================================================================
-- DROP FUNCTION IF EXISTS search_listings_faceted(
--   text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int
-- );
--
-- -- Recreate the prior 12-arg function verbatim (from
-- -- 20260622000001_search_listings_faceted_rpc.sql):
-- CREATE OR REPLACE FUNCTION search_listings_faceted(
--   p_q text DEFAULT NULL, p_category_id uuid DEFAULT NULL, p_city_id uuid DEFAULT NULL,
--   p_entity_type text DEFAULT NULL, p_trust_tier text DEFAULT NULL, p_location_type text DEFAULT NULL,
--   p_price_ranges text[] DEFAULT NULL, p_attribute_values uuid[] DEFAULT NULL, p_open_now boolean DEFAULT NULL,
--   p_sort text DEFAULT 'relevance', p_limit int DEFAULT 24, p_offset int DEFAULT 0)
-- RETURNS TABLE (id uuid, total_count bigint)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   WITH filtered AS (
--     SELECT l.id, l.is_featured, l.published_at, l.save_count, l.avg_rating, l.review_count, l.name,
--       CASE WHEN p_q IS NOT NULL AND p_q <> '' THEN ts_rank(l.search_vector, websearch_to_tsquery('english', p_q)) ELSE 0 END AS rank
--     FROM listings l
--     LEFT JOIN listing_details_business d ON d.listing_id = l.id
--     WHERE l.status = 'published' AND l.deleted_at IS NULL AND l.flag_status = 'none'
--       AND (p_q IS NULL OR p_q = '' OR l.search_vector @@ websearch_to_tsquery('english', p_q))
--       AND (p_category_id IS NULL OR l.category_id = p_category_id)
--       AND (p_city_id IS NULL OR l.city_id = p_city_id)
--       AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
--       AND (p_trust_tier IS NULL OR l.trust_tier = p_trust_tier)
--       AND (p_location_type IS NULL OR l.location_type = p_location_type)
--       AND (p_price_ranges IS NULL OR array_length(p_price_ranges, 1) IS NULL OR d.price_range = ANY (p_price_ranges))
--       AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
--       AND (p_attribute_values IS NULL OR array_length(p_attribute_values, 1) IS NULL OR NOT EXISTS (
--         SELECT 1 FROM attribute_values sel WHERE sel.id = ANY (p_attribute_values) GROUP BY sel.group_id
--         HAVING NOT EXISTS (SELECT 1 FROM listing_attributes la JOIN attribute_values av ON av.id = la.value_id
--           WHERE la.listing_id = l.id AND av.group_id = sel.group_id AND la.value_id = ANY (p_attribute_values))))
--   ), counted AS (SELECT f.*, count(*) OVER () AS total_count FROM filtered f)
--   SELECT c.id, c.total_count FROM counted c
--   ORDER BY c.is_featured DESC,
--     CASE WHEN p_sort='relevance' THEN c.rank END DESC NULLS LAST,
--     CASE WHEN p_sort='rating' THEN c.avg_rating END DESC NULLS LAST,
--     CASE WHEN p_sort='reviews' THEN c.review_count END DESC NULLS LAST,
--     CASE WHEN p_sort='newest' THEN c.published_at END DESC NULLS LAST,
--     CASE WHEN p_sort='saves' THEN c.save_count END DESC NULLS LAST,
--     CASE WHEN p_sort='name' THEN c.name END ASC,
--     c.save_count DESC, c.published_at DESC NULLS LAST, c.id
--   LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
-- $$;
-- GRANT EXECUTE ON FUNCTION search_listings_faceted(
--   text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, int, int) TO anon, authenticated;
--
-- DROP INDEX IF EXISTS listings_ownership_label_idx;
-- ALTER TABLE listings DROP COLUMN IF EXISTS ownership_label;
-- NOTIFY pgrst, 'reload schema';
-- =============================================================================
