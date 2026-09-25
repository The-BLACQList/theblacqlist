-- =============================================================================
-- Migration: type shortcuts that reach categories, and relevance first on a
--            keyword search
-- Product: The BLACQList
--
-- Three founder-reported defects on /discover, one migration:
--
--   1. The Restaurants, Services, Professionals and Creatives shortcuts return
--      ZERO. They filter on `entity_type`, and every listing is
--      entity_type='business' [Measured — production SQL, 2026-09-24]. Food is
--      only identifiable by category (Food & Dining and its children).
--
--   2. Searching "photographer" puts a featured restaurant first. Two causes
--      in this function:
--        a. `is_featured DESC` was the FIRST ORDER BY key, above match quality,
--           so a featured listing whose DESCRIPTION says "Photographs" beat
--           every photography studio.
--        b. Porter stems "photographer" to `photograph` and "photography" to
--           `photographi`. Those are different lexemes, so a studio NAMED
--           "... Photography" was not a full-text hit for "photographer" and
--           only reached the weaker trigram band.
--
--   3. The sidebar has no counts for Category or Type, so a visitor cannot see
--      which choices are empty before clicking them.
--
-- This migration is DDL only. It reads no rows and writes no rows.
--
-- [Decision — founder, 2026-09-24] "Relevance first" when there is a search
-- term. This REVERSES the featured-always-first rule that 20260923000000 kept
-- (and that every migration since 20260809000000 carried). Featured still
-- leads when browsing with no keyword, and still leads under any explicit
-- non-relevance sort (rating, newest, ...). With a keyword and the default
-- relevance sort, featured only breaks ties inside a match band.
--
-- [Decision — founder, 2026-09-24] "Type shortcuts map to categories." The
-- mapping itself lives in ONE place, lib/listings/type-shortcuts.ts. These
-- functions take the resolved category ids and location types as arguments
-- rather than carrying a second copy of the mapping in SQL.
--
-- -----------------------------------------------------------------------------
-- SIGNATURE CHANGE — read this before editing either function
-- -----------------------------------------------------------------------------
-- search_listings_faceted goes 17 args -> 19. facet_counts goes 13 -> 15. The
-- two new parameters are APPENDED, both DEFAULT NULL:
--
--   p_type_category_ids   uuid[]  mapped parent categories plus their children
--   p_type_location_types text[]  mapped location types
--
-- Both current signatures are DROPped explicitly first, for the reason
-- 20260904000000's header gives: CREATE OR REPLACE against a signature that no
-- longer matches silently becomes CREATE, leaving TWO overloads, and PostgREST's
-- named-argument calls then match both and error as ambiguous. One function per
-- name, always.
--
-- -----------------------------------------------------------------------------
-- WHY EVERY OLD PARAMETER IS KEPT
-- -----------------------------------------------------------------------------
-- The ordering rule is unchanged: migration to staging -> migration to
-- production (GATE-DATA) -> code (GATE-DEPLOY). This migration runs while the
-- CURRENTLY-DEPLOYED code is live, and that code sends the 17 (and 13) named
-- arguments it always has. Because the new parameters are appended with
-- defaults, those calls resolve to the new functions unchanged, and a NULL
-- p_type_category_ids / p_type_location_types makes the type predicate exactly
-- the old `p_entity_type IS NULL OR l.entity_type = p_entity_type`.
--
-- The new code sends the two new keys only when they are non-null, and retries
-- once without them if the RPC errors. So the code is safe to deploy before OR
-- after this migration.
--
-- -----------------------------------------------------------------------------
-- WHAT CHANGES INSIDE THE FUNCTIONS
-- -----------------------------------------------------------------------------
-- search_prefix_tsquery (new): the english-stemmed lexemes of the query as an
--   AND'd PREFIX query restricted to the given weights. A trailing Porter `i`
--   (the y -> i rule) is trimmed first, so "photography" and "photographer"
--   both become 'photograph':*AB and match each other. Lexemes shorter than 4
--   characters get no prefix, so short words do not fan out. Returns NULL for
--   an empty query or for websearch operator syntax (quotes, -term, OR), where
--   the visitor asked for exact behaviour.
--
-- Recall: the existing predicate plus `OR search_vector @@ prefix(A,B)`. The
--   prefix query only reads weights A and B (name, tagline, category), so it
--   cannot widen recall through descriptions.
--
-- Type: `p_entity_type IS NULL OR entity_type = p_entity_type OR category_id =
--   ANY(p_type_category_ids) OR location_type = ANY(p_type_location_types)`.
--   A NULL array makes `= ANY` NULL, which OR treats as false.
--
-- match_band:
--   20  the term is in the name, tagline or category (an A/B-weight full-text
--       hit, or a prefix hit)
--   10  a full-text hit elsewhere only (the description, service area)
--   3-9 trigram-only, as before
--   0   no keyword
--
-- ORDER BY:
--   featured, only when browsing or under an explicit non-relevance sort
--   distance (explicit sort), unchanged
--   match_band (relevance)
--   featured, as the tiebreak inside a band
--   activity, paid tier (keyword only, guard unchanged), rank, then the
--   existing tail, unchanged
--
-- facet_counts:
--   `frame` = every predicate EXCEPT category and type.
--   `core`  = frame plus the category and type predicates, textually identical
--             to search_listings_faceted's. The attribute, price and open-now
--             counts run on core exactly as before.
--   New facet_kind 'cell': frame (plus the price, open-now and attribute
--   selections), grouped by `entity_type|category_id|location_type`. The app
--   rolls cells up into Category counts (which ignore the category pick) and
--   Type counts (which ignore the type pick) using the one mapping in
--   lib/listings/type-shortcuts.ts.
--
-- -----------------------------------------------------------------------------
-- DOWN PLAN (tests/migrations/type-shortcuts-relevance.test.ts runs this)
-- -----------------------------------------------------------------------------
--   1. DROP FUNCTION IF EXISTS search_listings_faceted(
--        text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
--        text, double precision, double precision, double precision, text, int,
--        int, uuid[], text[]);
--      DROP FUNCTION IF EXISTS facet_counts(
--        text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
--        double precision, double precision, double precision, uuid[], text[]);
--   2. Re-run PART 6 of 20260923000000_activity_ranking.sql (the 17-arg search
--      function and its GRANT).
--   3. Re-run PART 3 of 20260922000000_search_recall.sql (the 13-arg
--      facet_counts and its GRANT).
--   4. DROP FUNCTION IF EXISTS search_prefix_tsquery(text, text);
--      NOTIFY pgrst, 'reload schema';
--
-- Rollback needs no code change: the deployed code retries without the two new
-- keys when the RPC rejects them, which restores the old exact-type behaviour.
-- =============================================================================


-- =============================================================================
-- PART 1 — drop the current signatures
--
-- Both the old signatures (the 17-arg search and the 13-arg counts that
-- production runs today) and the new ones, so a second run of this file
-- replaces rather than fails on "already exists". CREATE OR REPLACE cannot add
-- parameters, which is why this is DROP + CREATE at all.
-- =============================================================================
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
);

DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[]
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[]
);


-- =============================================================================
-- PART 2 — search_prefix_tsquery
-- =============================================================================
CREATE OR REPLACE FUNCTION search_prefix_tsquery(p_q text, p_weights text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_q IS NULL OR btrim(p_q) = '' THEN NULL
    -- Websearch operators mean the visitor wants exact behaviour. Leave those
    -- queries to websearch_to_tsquery alone.
    WHEN p_q ~ '"|(^|\s)-\S|\sOR\s' THEN NULL
    ELSE (
      SELECT CASE
        WHEN count(*) = 0 THEN NULL
        ELSE string_agg(
               '''' || replace(replace(t.lex, '\', '\\'), '''', '''''') || ''''
                 || CASE WHEN length(t.lex) >= 4 THEN ':*' ELSE ':' END
                 || p_weights,
               ' & ' ORDER BY t.lex
             )::tsquery
      END
      FROM (
        SELECT CASE
                 WHEN length(a.lex) >= 5 AND right(a.lex, 1) = 'i'
                   THEN left(a.lex, -1)
                 ELSE a.lex
               END AS lex
        FROM unnest(tsvector_to_array(to_tsvector('english', p_q))) AS a(lex)
      ) t
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION search_prefix_tsquery(text, text) TO anon, authenticated;


-- =============================================================================
-- PART 3 — search_listings_faceted (19 args)
--
-- Body is PART 6 of 20260923000000 except the places marked ▲ NEW.
-- =============================================================================
CREATE FUNCTION search_listings_faceted(
  p_q                   text    DEFAULT NULL,
  p_category_id         uuid    DEFAULT NULL,
  p_city_id             uuid    DEFAULT NULL,
  p_entity_type         text    DEFAULT NULL,
  p_trust_tier          text    DEFAULT NULL,
  p_location_type       text    DEFAULT NULL,
  p_location_types      text[]  DEFAULT NULL,
  p_price_ranges        text[]  DEFAULT NULL,
  p_attribute_values    uuid[]  DEFAULT NULL,
  p_open_now            boolean DEFAULT NULL,
  p_ownership_label     text    DEFAULT NULL,
  p_lat                 double precision DEFAULT NULL,
  p_lng                 double precision DEFAULT NULL,
  p_radius_miles        double precision DEFAULT NULL,
  p_sort                text    DEFAULT 'relevance',
  p_limit               int     DEFAULT 24,
  p_offset              int     DEFAULT 0,
  p_type_category_ids   uuid[]  DEFAULT NULL,             -- ▲ NEW
  p_type_location_types text[]  DEFAULT NULL              -- ▲ NEW
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
      l.activity_score,
      CASE WHEN l.tier IN ('growth', 'premium') THEN 1 ELSE 0 END AS tier_weight,
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             AND d.lat IS NOT NULL AND d.lng IS NOT NULL
        THEN haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
      END AS distance_miles,
      -- ▲ NEW: band 20 for a name/tagline/category hit, above band 10 for a
      -- description-only hit. The trigram expression is still a literal repeat
      -- of the one in `rank` so the two cannot drift apart.
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0
        WHEN ts_filter(l.search_vector, '{a,b}') @@ websearch_to_tsquery('english', p_q)
          OR l.search_vector @@ search_prefix_tsquery(p_q, 'AB') THEN 20
        WHEN l.search_vector @@ websearch_to_tsquery('english', p_q) THEN 10
        ELSE floor(
               greatest(
                 word_similarity(p_q, l.name),
                 word_similarity(p_q, coalesce(l.tagline, '')),
                 word_similarity(p_q, coalesce(cat.name, ''))
               ) * 10
             )::int
      END AS match_band,
      -- ▲ NEW: a prefix hit is a full-text hit too, and scores the better of
      -- the two queries. greatest() ignores the NULL a missing prefix gives.
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0
        WHEN l.search_vector @@ websearch_to_tsquery('english', p_q)
          OR l.search_vector @@ search_prefix_tsquery(p_q, 'AB')
          THEN 1.0 + greatest(
                 ts_rank(l.search_vector, websearch_to_tsquery('english', p_q)),
                 ts_rank(l.search_vector, search_prefix_tsquery(p_q, 'AB'))
               )
        ELSE greatest(
               word_similarity(p_q, l.name),
               word_similarity(p_q, coalesce(l.tagline, '')),
               word_similarity(p_q, coalesce(cat.name, ''))
             )
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      -- ▲ NEW: the prefix OR. Kept textually identical in facet_counts.
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR l.search_vector @@ search_prefix_tsquery(p_q, 'AB')
        OR word_similarity(p_q, l.name) > 0.3
        OR word_similarity(p_q, coalesce(l.tagline, '')) > 0.3
        OR word_similarity(p_q, coalesce(cat.name, '')) > 0.3
      )
      AND (
        p_category_id IS NULL
        OR l.category_id = p_category_id
        OR cat.parent_id = p_category_id
      )
      AND (p_city_id        IS NULL OR l.city_id         = p_city_id)
      -- ▲ NEW: the type predicate. Kept textually identical in facet_counts.
      AND (
        p_entity_type IS NULL
        OR l.entity_type = p_entity_type
        OR l.category_id = ANY (p_type_category_ids)
        OR l.location_type = ANY (p_type_location_types)
      )
      AND (p_trust_tier     IS NULL OR l.trust_tier      = p_trust_tier)
      AND (p_location_type  IS NULL OR l.location_type   = p_location_type)
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
    -- ▲ NEW: sponsored placement leads when browsing, and under any explicit
    -- non-relevance sort. With a keyword and the relevance sort this key is
    -- NULL for every row and the match band decides instead.
    -- [Decision — founder, 2026-09-24] relevance first on a keyword search.
    CASE WHEN p_q IS NULL OR p_q = '' OR p_sort IS DISTINCT FROM 'relevance'
         THEN c.is_featured END                              DESC NULLS LAST,

    -- An explicit distance sort keeps its own primary key.
    CASE WHEN p_sort = 'distance' THEN c.distance_miles END ASC NULLS LAST,

    -- Relevance sort (the default): match band first.
    CASE WHEN p_sort = 'relevance' THEN c.match_band END     DESC NULLS LAST,

    -- ▲ NEW: featured breaks ties inside a band. When browsing it already led
    -- above, so this is a no-op there.
    c.is_featured DESC,

    CASE WHEN p_sort = 'relevance' THEN c.activity_score END DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' AND p_q IS NOT NULL AND p_q <> ''
         THEN c.tier_weight END                              DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' THEN c.rank END           DESC NULLS LAST,

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
  double precision, double precision, double precision, text, int, int,
  uuid[], text[]
) TO anon, authenticated;


-- =============================================================================
-- PART 4 — facet_counts (15 args)
--
-- Body is PART 3 of 20260922000000 except `frame`, `core` and `cell_counts`.
-- =============================================================================
CREATE FUNCTION facet_counts(
  p_q                   text    DEFAULT NULL,
  p_category_id         uuid    DEFAULT NULL,
  p_city_id             uuid    DEFAULT NULL,
  p_entity_type         text    DEFAULT NULL,
  p_trust_tier          text    DEFAULT NULL,
  p_location_type       text    DEFAULT NULL,
  p_location_types      text[]  DEFAULT NULL,
  p_price_ranges        text[]  DEFAULT NULL,
  p_attribute_values    uuid[]  DEFAULT NULL,
  p_open_now            boolean DEFAULT NULL,
  p_lat                 double precision DEFAULT NULL,
  p_lng                 double precision DEFAULT NULL,
  p_radius_miles        double precision DEFAULT NULL,
  p_type_category_ids   uuid[]  DEFAULT NULL,             -- ▲ NEW
  p_type_location_types text[]  DEFAULT NULL              -- ▲ NEW
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
  -- ▲ NEW: every predicate except category and type. The cells count over
  -- this, so neither of those two picks zeroes out its own siblings.
  frame AS (
    SELECT l.id, d.price_range, l.entity_type, l.category_id, l.location_type
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR l.search_vector @@ search_prefix_tsquery(p_q, 'AB')
        OR word_similarity(p_q, l.name) > 0.3
        OR word_similarity(p_q, coalesce(l.tagline, '')) > 0.3
        OR word_similarity(p_q, coalesce(cat.name, '')) > 0.3
      )
      AND (p_city_id       IS NULL OR l.city_id       = p_city_id)
      AND (p_trust_tier    IS NULL OR l.trust_tier    = p_trust_tier)
      AND (p_location_type IS NULL OR l.location_type = p_location_type)
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
  -- ▲ NEW: frame plus the category and type predicates. The listings/categories
  -- re-join exists so the two predicates can be written with the SAME aliases,
  -- and therefore the same text, as search_listings_faceted.
  core AS (
    SELECT f.id, f.price_range
    FROM frame f
    JOIN listings l ON l.id = f.id
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE (
        p_category_id IS NULL
        OR l.category_id = p_category_id
        OR cat.parent_id = p_category_id
      )
      AND (
        p_entity_type IS NULL
        OR l.entity_type = p_entity_type
        OR l.category_id = ANY (p_type_category_ids)
        OR l.location_type = ANY (p_type_location_types)
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
  ),
  -- ▲ NEW: frame with the price, open-now and attribute selections applied,
  -- but NOT category or type.
  cell_base AS (
    SELECT f.id, f.entity_type, f.category_id, f.location_type
    FROM frame f
    WHERE (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR f.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(f.id))
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM sel_groups sg
          WHERE NOT EXISTS (
            SELECT 1 FROM listing_attributes la
            JOIN sel s ON s.value_id = la.value_id
            WHERE la.listing_id = f.id AND s.group_id = sg.group_id
          )
        )
      )
  ),
  -- ▲ NEW: key is `entity_type|category_id|location_type`, empty for NULL.
  -- lib/listings/type-shortcuts.ts parseCellKey reads exactly this shape.
  cell_counts AS (
    SELECT
      'cell'::text AS facet_kind,
      (cb.entity_type || '|' || coalesce(cb.category_id::text, '') || '|'
        || coalesce(cb.location_type, ''))::text AS facet_key,
      count(*) AS facet_count
    FROM cell_base cb
    GROUP BY cb.entity_type, cb.category_id, cb.location_type
  )
  SELECT * FROM attr_counts
  UNION ALL SELECT * FROM price_counts
  UNION ALL SELECT * FROM open_count
  UNION ALL SELECT * FROM cell_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[]
) TO anon, authenticated;


-- =============================================================================
-- PART 5 — tell PostgREST the signatures changed
-- =============================================================================
NOTIFY pgrst, 'reload schema';
