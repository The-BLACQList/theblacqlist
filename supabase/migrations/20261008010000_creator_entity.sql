-- =============================================================================
-- Migration: creator listing type, Creators & Influencers category, creator
--            filters, and the "open to partnerships" switch
-- Product: The BLACQList
-- Ticket: docs/blacqlist/tickets/131-creator-entity-and-category.md
-- Spec:   docs/blacqlist/features/creators-and-influencers.md
--
-- [Decision — founder, 2026-10-08] Creators should be "easy to find as a
-- group", with "niche as a filter under creators". Directory plus partner
-- switches; contact stays on each page's own contact button.
--
-- What this does, all additive:
--
--   PART 1  'creator' added to the listings entity_type CHECK (list last set in
--           20260813000000_job_entity.sql) and to the featured_awards bucket
--           CHECK, so a creator can win the weekly Featured award without
--           breaking the award run.
--   PART 2  "Creators & Influencers" parent category and five subcategories.
--   PART 3  Three creator-only filter groups (applies_to '{creator}'): niche,
--           platforms, audience size (self-reported).
--   PART 4  listings.open_to_partnerships boolean NOT NULL DEFAULT false, with
--           a partial index. Owners can write it with no trigger change: the
--           entitlement guard (20260926000000) is a denylist.
--   PART 5  p_open_to_partnerships boolean DEFAULT NULL added as the LAST
--           parameter of search_listings_faceted (19 -> 20 args) and
--           facet_counts (15 -> 16 args). NULL means no filter, so code that
--           does not send it gets exactly today's results. Bodies are copied
--           from 20260924000000 PARTs 3 and 4; only the places marked ▲ NEW
--           differ.
--
-- This migration writes no listing rows. Ids match supabase/seed.sql so every
-- environment agrees; parents and groups are looked up by slug so a project
-- seeded with other ids still links correctly. Every insert is
-- ON CONFLICT DO NOTHING and every DDL statement is IF [NOT] EXISTS or
-- DROP + CREATE, so a re-run is safe.
--
-- ROLLBACK, only while nothing uses the new type. Check first:
--   SELECT count(*) FROM listings WHERE entity_type = 'creator';
--   SELECT count(*) FROM featured_awards WHERE bucket = 'creator';
--   1. Drop the 20-arg and 16-arg signatures below, then re-run PARTs 3, 4
--      and 5 of 20260924000000_type_shortcuts_relevance.sql.
--   2. DROP INDEX IF EXISTS listings_open_to_partnerships_idx;
--      ALTER TABLE listings DROP COLUMN IF EXISTS open_to_partnerships;
--   3. DELETE FROM attribute_groups
--       WHERE slug IN ('creator-niche','creator-platforms','audience-size');
--      (attribute_values and listing_attributes cascade.)
--   4. DELETE FROM categories WHERE slug IN ('influencers','video-creators',
--        'podcasters','streamers','writers-newsletters');
--      DELETE FROM categories WHERE slug = 'creators-influencers';
--      (listings.category_id is ON DELETE RESTRICT; move listings first.)
--   5. Restore both CHECKs to the lists in 20260813000000 and 20261005000000.
-- =============================================================================


-- =============================================================================
-- PART 1 — the 'creator' type
-- =============================================================================
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_entity_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN (
    'business','restaurant','service_provider','professional','creative','vendor','event','job',
    'creator'
  ));

-- The bucket CHECK was declared inline in 20261005000000, so Postgres named it
-- featured_awards_bucket_check.
ALTER TABLE featured_awards DROP CONSTRAINT IF EXISTS featured_awards_bucket_check;
ALTER TABLE featured_awards ADD CONSTRAINT featured_awards_bucket_check
  CHECK (bucket IN (
    'business','restaurant','service_provider','vendor',
    'professional','creative','event','job',
    'creator'
  ));


-- =============================================================================
-- PART 2 — Creators & Influencers
--
-- Subcategories are formats. Niche is a filter (PART 3), not a category.
-- "Influencer Marketing" under Social Media & Marketing stays for agencies.
-- =============================================================================
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active)
VALUES ('c0000001-0000-0000-0000-000000000026', 'Creators & Influencers',
        'creators-influencers', NULL, 26, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (id, name, slug, parent_id, display_order, is_active)
SELECT v.id::uuid, v.name, v.slug, p.id, v.display_order, true
FROM (VALUES
  ('c0000002-0026-0000-0000-000000000001', 'Influencers',           'influencers',         'creators-influencers', 1),
  ('c0000002-0026-0000-0000-000000000002', 'Video Creators',        'video-creators',      'creators-influencers', 2),
  ('c0000002-0026-0000-0000-000000000003', 'Podcasters',            'podcasters',          'creators-influencers', 3),
  ('c0000002-0026-0000-0000-000000000004', 'Streamers',             'streamers',           'creators-influencers', 4),
  ('c0000002-0026-0000-0000-000000000005', 'Writers & Newsletters', 'writers-newsletters', 'creators-influencers', 5)
) AS v (id, name, slug, parent_slug, display_order)
JOIN categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- PART 3 — creator filter groups
--
-- applies_to '{creator}' keeps them off every other type's sidebar.
-- =============================================================================
INSERT INTO attribute_groups (id, name, slug, description, input_type, applies_to, display_order, is_filterable, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000007', 'Niche',                         'creator-niche',     'What this creator makes content about.',                       'checkbox', '{creator}', 7, true, true),
  ('a1000000-0000-0000-0000-000000000008', 'Platforms',                     'creator-platforms', 'Where this creator posts.',                                    'checkbox', '{creator}', 8, true, true),
  ('a1000000-0000-0000-0000-000000000009', 'Audience size (self-reported)', 'audience-size',     'Total followers across platforms, as the creator reports it.', 'radio',    '{creator}', 9, true, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active)
SELECT v.id::uuid, g.id, v.name, v.slug, v.display_order, true
FROM (VALUES
  ('a2000000-0007-0000-0000-000000000001', 'creator-niche',     'Food & Drink',       'food-drink',       1),
  ('a2000000-0007-0000-0000-000000000002', 'creator-niche',     'Beauty',             'beauty',           2),
  ('a2000000-0007-0000-0000-000000000003', 'creator-niche',     'Fashion',            'fashion',          3),
  ('a2000000-0007-0000-0000-000000000004', 'creator-niche',     'Fitness & Wellness', 'fitness-wellness', 4),
  ('a2000000-0007-0000-0000-000000000005', 'creator-niche',     'Travel',             'travel',           5),
  ('a2000000-0007-0000-0000-000000000006', 'creator-niche',     'Parenting & Family', 'parenting-family', 6),
  ('a2000000-0007-0000-0000-000000000007', 'creator-niche',     'Money & Business',   'money-business',   7),
  ('a2000000-0007-0000-0000-000000000008', 'creator-niche',     'Tech',               'tech',             8),
  ('a2000000-0007-0000-0000-000000000009', 'creator-niche',     'Gaming',             'gaming',           9),
  ('a2000000-0007-0000-0000-000000000010', 'creator-niche',     'Music',              'music',            10),
  ('a2000000-0007-0000-0000-000000000011', 'creator-niche',     'Comedy',             'comedy',           11),
  ('a2000000-0007-0000-0000-000000000012', 'creator-niche',     'Lifestyle',          'lifestyle',        12),
  ('a2000000-0007-0000-0000-000000000013', 'creator-niche',     'Faith',              'faith',            13),
  ('a2000000-0007-0000-0000-000000000014', 'creator-niche',     'Education',          'education',        14),
  ('a2000000-0007-0000-0000-000000000015', 'creator-niche',     'Culture & History',  'culture-history',  15),
  ('a2000000-0007-0000-0000-000000000016', 'creator-niche',     'Home & DIY',         'home-diy',         16),
  ('a2000000-0008-0000-0000-000000000001', 'creator-platforms', 'Instagram',          'instagram',        1),
  ('a2000000-0008-0000-0000-000000000002', 'creator-platforms', 'TikTok',             'tiktok',           2),
  ('a2000000-0008-0000-0000-000000000003', 'creator-platforms', 'YouTube',            'youtube',          3),
  ('a2000000-0008-0000-0000-000000000004', 'creator-platforms', 'Podcast',            'podcast',          4),
  ('a2000000-0008-0000-0000-000000000005', 'creator-platforms', 'Twitch',             'twitch',           5),
  ('a2000000-0008-0000-0000-000000000006', 'creator-platforms', 'Facebook',           'facebook',         6),
  ('a2000000-0008-0000-0000-000000000007', 'creator-platforms', 'X',                  'x',                7),
  ('a2000000-0008-0000-0000-000000000008', 'creator-platforms', 'LinkedIn',           'linkedin',         8),
  ('a2000000-0008-0000-0000-000000000009', 'creator-platforms', 'Substack / Blog',    'substack-blog',    9),
  ('a2000000-0009-0000-0000-000000000001', 'audience-size',     'Under 10K',          'under-10k',        1),
  ('a2000000-0009-0000-0000-000000000002', 'audience-size',     '10K to 50K',         '10k-50k',          2),
  ('a2000000-0009-0000-0000-000000000003', 'audience-size',     '50K to 250K',        '50k-250k',         3),
  ('a2000000-0009-0000-0000-000000000004', 'audience-size',     '250K to 1M',         '250k-1m',          4),
  ('a2000000-0009-0000-0000-000000000005', 'audience-size',     '1M+',                '1m-plus',          5)
) AS v (id, group_slug, name, slug, display_order)
JOIN attribute_groups g ON g.slug = v.group_slug
ON CONFLICT (group_id, slug) DO NOTHING;


-- =============================================================================
-- PART 4 — open_to_partnerships
--
-- One switch, worded by type in the UI: "Open to brand deals" on creator pages,
-- "Open to creator partnerships & sponsorships" elsewhere. A constant default
-- makes ADD COLUMN metadata-only, so no listing row is rewritten.
-- =============================================================================
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS open_to_partnerships boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS listings_open_to_partnerships_idx
  ON listings (id) WHERE open_to_partnerships;


-- =============================================================================
-- PART 5 — p_open_to_partnerships on the search functions
--
-- Drop today's signatures (19 and 15 args) and the new ones (20 and 16), so a
-- second run replaces rather than fails. CREATE OR REPLACE cannot add a
-- parameter, which is why this is DROP + CREATE.
-- =============================================================================
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[]
);

DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[], boolean
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[]
);

DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean
);


-- -----------------------------------------------------------------------------
-- search_listings_faceted (20 args)
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
  p_open_to_partnerships boolean DEFAULT NULL  -- ▲ NEW
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
      -- ▲ NEW: the partners filter. Kept textually identical in facet_counts.
      AND (p_open_to_partnerships IS NOT TRUE OR l.open_to_partnerships)
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
  uuid[], text[], boolean
) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- facet_counts (16 args)
--
-- The partners predicate sits in `frame`, which every count reads from.
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
  p_open_to_partnerships boolean DEFAULT NULL  -- ▲ NEW
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
      -- ▲ NEW: the partners filter, same text as search_listings_faceted.
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
  )
  SELECT * FROM attr_counts
  UNION ALL SELECT * FROM price_counts
  UNION ALL SELECT * FROM open_count
  UNION ALL SELECT * FROM cell_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean
) TO anon, authenticated;


-- =============================================================================
-- PART 6 — tell PostgREST the signatures changed
-- =============================================================================
NOTIFY pgrst, 'reload schema';
