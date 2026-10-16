-- =============================================================================
-- Business levels: Growers, Makers, Suppliers, Local businesses
-- =============================================================================
-- Spec: docs/blacqlist/product/business-levels-2026-10.md (founder picks
-- 2026-10-16). Shoppers filter by where a business sits in the supply chain.
-- The keys match The Collective's floors so its map can read these columns.
--
--   grower   = Growers & raw goods
--   maker    = Makers
--   supplier = Suppliers (sells to other businesses)
--   local    = Local businesses (shops and services, online shops included).
--              The default, and it goes unsaid on cards.
--
-- Each category says which levels fit it and which one is the default. Each
-- listing has one main level plus optional extras. The filter matches either.
--
-- GATE-DATA: staging first, then prod BEFORE the app PR merges. The app sends
-- p_levels only when a level is picked, and retries without it, so a deploy
-- that lands first still answers.
--
-- Rollback (manual, in this order):
--   -- 1. Drop the new functions, then re-run PART 5 of
--   --    20261008010000_creator_entity.sql to restore the old ones.
--   DROP FUNCTION IF EXISTS search_listings_faceted(
--     text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
--     double precision, double precision, double precision, text, int, int,
--     uuid[], text[], boolean, text[]);
--   DROP FUNCTION IF EXISTS facet_counts(
--     text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
--     double precision, double precision, double precision, uuid[], text[],
--     boolean, text[]);
--   -- 2. Then the data:
--   DROP TRIGGER IF EXISTS listings_fill_primary_level ON listings;
--   DROP FUNCTION IF EXISTS listings_fill_primary_level();
--   ALTER TABLE listings DROP COLUMN IF EXISTS extra_levels,
--                        DROP COLUMN IF EXISTS primary_level;
--   ALTER TABLE categories DROP COLUMN IF EXISTS allowed_levels,
--                          DROP COLUMN IF EXISTS default_level;
--   NOTIFY pgrst, 'reload schema';
-- =============================================================================


-- =============================================================================
-- PART 1 — categories.default_level and categories.allowed_levels
--
-- Constant defaults make both ADD COLUMNs metadata-only. A category added later
-- starts as local-only, which is right for almost every new service category.
-- =============================================================================
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS default_level text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS allowed_levels text[] NOT NULL DEFAULT '{local}';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_default_level_check;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_allowed_levels_check;

-- Parents first, by slug, so a project seeded with other ids still lines up.
UPDATE categories c
SET allowed_levels = v.allowed::text[], default_level = v.default_level
FROM (VALUES
  ('agriculture-sustainability', '{grower,maker,supplier,local}', 'local'),
  ('food-dining',                '{grower,maker,supplier,local}', 'local'),
  ('fashion-apparel',            '{maker,supplier,local}',        'local'),
  ('home-living',                '{maker,supplier,local}',        'local'),
  ('retail-gifts',               '{maker,supplier,local}',        'local'),
  ('beauty-grooming',            '{maker,supplier,local}',        'local'),
  ('wellness-health',            '{maker,supplier,local}',        'local'),
  ('books-publishing',           '{maker,supplier,local}',        'local'),
  ('arts-culture',               '{maker,supplier,local}',        'local'),
  ('construction-trades',        '{maker,supplier,local}',        'local'),
  ('automotive',                 '{supplier,local}',              'local'),
  ('pet-services',               '{supplier,local}',              'local'),
  ('events-entertainment',       '{supplier,local}',              'local'),
  ('technology',                 '{supplier,local}',              'local'),
  ('healthcare',                 '{supplier,local}',              'local')
) AS v (slug, allowed, default_level)
WHERE c.slug = v.slug AND c.parent_id IS NULL;

-- Children inherit their parent's alignment...
UPDATE categories child
SET allowed_levels = p.allowed_levels, default_level = p.default_level
FROM categories p
WHERE child.parent_id = p.id;

-- ...then the few that default to something other than local.
UPDATE categories c
SET default_level = v.default_level
FROM (VALUES
  ('farms-farm-stands',               'grower'),
  ('urban-farming-community-gardens', 'grower'),
  ('organic-natural-products',        'maker'),
  ('handmade-artisan-goods',          'maker'),
  ('candles-home-fragrance',          'maker'),
  ('carpentry-woodworking',           'maker')
) AS v (slug, default_level)
WHERE c.slug = v.slug AND c.parent_id IS NOT NULL;

ALTER TABLE categories
  ADD CONSTRAINT categories_default_level_check
    CHECK (default_level IN ('grower', 'maker', 'supplier', 'local')),
  ADD CONSTRAINT categories_allowed_levels_check
    CHECK (
      allowed_levels <@ ARRAY['grower', 'maker', 'supplier', 'local']::text[]
      AND default_level = ANY (allowed_levels)
    );


-- =============================================================================
-- PART 2 — listings.primary_level and listings.extra_levels
-- =============================================================================
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS primary_level text,
  ADD COLUMN IF NOT EXISTS extra_levels text[] NOT NULL DEFAULT '{}';

-- Every existing listing takes its category's default.
UPDATE listings l
SET primary_level = c.default_level
FROM categories c
WHERE c.id = l.category_id AND l.primary_level IS NULL;

-- category_id is NOT NULL, so nothing should be left. Belt and braces.
UPDATE listings SET primary_level = 'local' WHERE primary_level IS NULL;

ALTER TABLE listings ALTER COLUMN primary_level SET NOT NULL;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_primary_level_check;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_extra_levels_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_primary_level_check
    CHECK (primary_level IN ('grower', 'maker', 'supplier', 'local')),
  ADD CONSTRAINT listings_extra_levels_check
    CHECK (
      extra_levels <@ ARRAY['grower', 'maker', 'supplier', 'local']::text[]
      AND NOT (primary_level = ANY (extra_levels))
    );

-- An insert that leaves primary_level empty (imports, seed scripts, older app
-- code) takes the category's default. The app's own choice is validated
-- against allowed_levels in lib/actions, not here: a CHECK cannot read
-- another table.
CREATE OR REPLACE FUNCTION listings_fill_primary_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_level IS NULL THEN
    SELECT c.default_level INTO NEW.primary_level
    FROM categories c WHERE c.id = NEW.category_id;
    NEW.primary_level := coalesce(NEW.primary_level, 'local');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_fill_primary_level ON listings;
CREATE TRIGGER listings_fill_primary_level
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_fill_primary_level();

CREATE INDEX IF NOT EXISTS listings_primary_level_idx
  ON listings (primary_level)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_extra_levels_idx
  ON listings USING gin (extra_levels)
  WHERE status = 'published' AND deleted_at IS NULL;


-- =============================================================================
-- PART 3 — p_levels on the search functions
--
-- Drop today's signatures (20 and 16 args) and the new ones (21 and 17), so a
-- second run replaces rather than fails. CREATE OR REPLACE cannot add a
-- parameter, which is why this is DROP + CREATE. Every other line is copied
-- from 20261008010000_creator_entity.sql unchanged.
-- =============================================================================

DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[], boolean
);

DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[], boolean, text[]
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean,
  text[]
);


-- -----------------------------------------------------------------------------
-- search_listings_faceted (21 args)
-- -----------------------------------------------------------------------------
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
  p_type_category_ids   uuid[]  DEFAULT NULL,
  p_type_location_types text[]  DEFAULT NULL,
  p_open_to_partnerships boolean DEFAULT NULL,
  p_levels              text[]  DEFAULT NULL  -- ▲ NEW
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
      -- band 20 for a name/tagline/category hit, above band 10 for a
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
      -- a prefix hit is a full-text hit too, and scores the better of
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
      -- the prefix OR. Kept textually identical in facet_counts.
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
      -- the type predicate. Kept textually identical in facet_counts.
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
      -- the partners filter. Kept textually identical in facet_counts.
      AND (p_open_to_partnerships IS NOT TRUE OR l.open_to_partnerships)
      -- ▲ NEW: the levels filter. A main level or an extra matches.
      -- Kept textually identical in facet_counts.
      AND (
        p_levels IS NULL
        OR array_length(p_levels, 1) IS NULL
        OR l.primary_level = ANY (p_levels)
        OR l.extra_levels && p_levels
      )
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
    -- sponsored placement leads when browsing, and under any explicit
    -- non-relevance sort. With a keyword and the relevance sort this key is
    -- NULL for every row and the match band decides instead.
    -- [Decision — founder, 2026-09-24] relevance first on a keyword search.
    CASE WHEN p_q IS NULL OR p_q = '' OR p_sort IS DISTINCT FROM 'relevance'
         THEN c.is_featured END                              DESC NULLS LAST,

    -- An explicit distance sort keeps its own primary key.
    CASE WHEN p_sort = 'distance' THEN c.distance_miles END ASC NULLS LAST,

    -- Relevance sort (the default): match band first.
    CASE WHEN p_sort = 'relevance' THEN c.match_band END     DESC NULLS LAST,

    -- featured breaks ties inside a band. When browsing it already led
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
  uuid[], text[], boolean, text[]
) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- facet_counts (17 args)
--
-- The levels predicate sits in `frame`, which every count reads from, except
-- the level counts themselves, which read `level_base` so one level pick does
-- not zero out its siblings (the same rule as category and type).
-- -----------------------------------------------------------------------------
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
  p_type_category_ids   uuid[]  DEFAULT NULL,
  p_type_location_types text[]  DEFAULT NULL,
  p_open_to_partnerships boolean DEFAULT NULL,
  p_levels              text[]  DEFAULT NULL  -- ▲ NEW
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
  -- every predicate except category and type. The cells count over
  -- this, so neither of those two picks zeroes out its own siblings.
  level_frame AS (
    SELECT l.id, d.price_range, l.entity_type, l.category_id, l.location_type,
           l.primary_level, l.extra_levels
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
      -- the partners filter, same text as search_listings_faceted.
      AND (p_open_to_partnerships IS NOT TRUE OR l.open_to_partnerships)
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
  -- ▲ NEW: level_frame plus the levels predicate, same text as
  -- search_listings_faceted (the `l` alias is the level_frame row here).
  frame AS (
    SELECT l.id, l.price_range, l.entity_type, l.category_id, l.location_type
    FROM level_frame l
    WHERE (
        p_levels IS NULL
        OR array_length(p_levels, 1) IS NULL
        OR l.primary_level = ANY (p_levels)
        OR l.extra_levels && p_levels
      )
  ),
  -- frame plus the category and type predicates. The listings/categories
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
  -- frame with the price, open-now and attribute selections applied,
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
  -- key is `entity_type|category_id|location_type`, empty for NULL.
  -- lib/listings/type-shortcuts.ts parseCellKey reads exactly this shape.
  cell_counts AS (
    SELECT
      'cell'::text AS facet_kind,
      (cb.entity_type || '|' || coalesce(cb.category_id::text, '') || '|'
        || coalesce(cb.location_type, ''))::text AS facet_key,
      count(*) AS facet_count
    FROM cell_base cb
    GROUP BY cb.entity_type, cb.category_id, cb.location_type
  ),
  -- ▲ NEW: every predicate the result set uses except the levels one. The
  -- category and type re-join is the same text as `core`.
  level_base AS (
    SELECT lf.id, lf.primary_level, lf.extra_levels
    FROM level_frame lf
    JOIN listings l ON l.id = lf.id
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
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR lf.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(lf.id))
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM sel_groups sg
          WHERE NOT EXISTS (
            SELECT 1 FROM listing_attributes la
            JOIN sel s ON s.value_id = la.value_id
            WHERE la.listing_id = lf.id AND s.group_id = sg.group_id
          )
        )
      )
  ),
  -- once per level a listing has: its main level plus each extra. The CHECK
  -- keeps the main level out of the extras, so nothing counts twice.
  -- All four levels always come back, zeros included, so the app can tell
  -- "no suppliers here" (a 0 row) from "older function, no level counts" (no
  -- rows at all).
  level_counts AS (
    SELECT 'level'::text AS facet_kind, k.level AS facet_key, coalesce(c.n, 0)::bigint AS facet_count
    FROM (VALUES ('grower'), ('maker'), ('supplier'), ('local')) AS k(level)
    LEFT JOIN (
      SELECT lv.level, count(*) AS n
      FROM level_base lb
      CROSS JOIN LATERAL unnest(array_prepend(lb.primary_level, lb.extra_levels)) AS lv(level)
      GROUP BY lv.level
    ) c ON c.level = k.level
  )
  SELECT * FROM attr_counts
  UNION ALL SELECT * FROM price_counts
  UNION ALL SELECT * FROM open_count
  UNION ALL SELECT * FROM cell_counts
  UNION ALL SELECT * FROM level_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean,
  text[]
) TO anon, authenticated;


-- =============================================================================
-- PART 4 — tell PostgREST the signatures changed
-- =============================================================================
NOTIFY pgrst, 'reload schema';
