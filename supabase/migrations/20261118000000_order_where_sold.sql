-- =============================================================================
-- "Order on" platforms and "Find us at" stores (owner-experience round 2,
-- part D, 2026-11-13).
--
-- Order on: a page lists its store links on DoorDash, Grubhub, Instacart and
-- Uber Eats, one per platform (listing_order_platforms). The app checks each
-- link is https on that platform's own domain; the CHECK here keeps it https.
--
-- Find us at: a page lists the stores that carry its products
-- (listing_stockists). A store is a chain from retail_chains or a name the
-- owner types, never both. Each store has its own cities ("Atlanta, GA") and
-- zips (listing_stockist_areas), or is marked nationwide. At most 25 stores a
-- page, checked in the app.
--
-- No plan check: every page can list both. Jobs and events can't (the app).
--
-- RLS: anyone reads rows on published, non-deleted pages; the owner reads and
-- writes their own. retail_chains is a read-only list for everyone.
--
-- Discover: search_listings_faceted and facet_counts gain
-- `p_platforms text[] DEFAULT NULL` (any one of them) and
-- `p_stockist_zip text DEFAULT NULL` (a store in that zip, or a nationwide
-- one) as their last two arguments. A new argument is a new signature, so
-- each old function is dropped and the new one created inside the
-- migration's transaction, so /discover never sees no function. Every other
-- line of both bodies is copied unchanged from 20261117000000_listing_deals.sql.
-- The app sends the new arguments only when a filter is picked, so calls
-- without them work against either version.
--
-- Down (one transaction):
--   DROP FUNCTION IF EXISTS search_listings_faceted(<24 args, as GRANTed below>);
--   DROP FUNCTION IF EXISTS facet_counts(<20 args, as GRANTed below>);
--   re-run both CREATE FUNCTION blocks and both GRANTs of
--   20261117000000_listing_deals.sql;
--   DROP TABLE IF EXISTS public.listing_stockist_areas, public.listing_stockists,
--     public.retail_chains, public.listing_order_platforms;
--   NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Order on.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_order_platforms (
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  platform    text        NOT NULL,
  url         text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, platform),
  CONSTRAINT listing_order_platforms_platform_check
    CHECK (platform IN ('doordash', 'grubhub', 'instacart', 'ubereats')),
  CONSTRAINT listing_order_platforms_url_check
    CHECK (url ~ '^https://[^[:space:]]+$' AND char_length(url) <= 500)
);

ALTER TABLE public.listing_order_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_order_platforms: anon read" ON public.listing_order_platforms;
CREATE POLICY "listing_order_platforms: anon read"
  ON public.listing_order_platforms FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_order_platforms: authenticated read" ON public.listing_order_platforms;
CREATE POLICY "listing_order_platforms: authenticated read"
  ON public.listing_order_platforms FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
    OR listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_order_platforms: owner insert" ON public.listing_order_platforms;
CREATE POLICY "listing_order_platforms: owner insert"
  ON public.listing_order_platforms FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_order_platforms: owner update" ON public.listing_order_platforms;
CREATE POLICY "listing_order_platforms: owner update"
  ON public.listing_order_platforms FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_order_platforms: owner delete" ON public.listing_order_platforms;
CREATE POLICY "listing_order_platforms: owner delete"
  ON public.listing_order_platforms FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- Find us at: the chain list.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retail_chains (
  slug  text NOT NULL PRIMARY KEY,
  name  text NOT NULL,
  CONSTRAINT retail_chains_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT retail_chains_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

INSERT INTO public.retail_chains (slug, name) VALUES
  ('kroger', 'Kroger'),
  ('whole-foods', 'Whole Foods Market'),
  ('publix', 'Publix'),
  ('heb', 'H-E-B'),
  ('target', 'Target'),
  ('walmart', 'Walmart'),
  ('costco', 'Costco'),
  ('sprouts', 'Sprouts Farmers Market'),
  ('trader-joes', 'Trader Joe''s'),
  ('safeway', 'Safeway'),
  ('albertsons', 'Albertsons'),
  ('wegmans', 'Wegmans'),
  ('meijer', 'Meijer'),
  ('aldi', 'Aldi'),
  ('food-lion', 'Food Lion'),
  ('giant', 'Giant'),
  ('harris-teeter', 'Harris Teeter'),
  ('shoprite', 'ShopRite'),
  ('stop-and-shop', 'Stop & Shop'),
  ('hy-vee', 'Hy-Vee')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.retail_chains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retail_chains: public read" ON public.retail_chains;
CREATE POLICY "retail_chains: public read"
  ON public.retail_chains FOR SELECT TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Find us at: a page's stores.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_stockists (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  chain_slug  text        NULL REFERENCES public.retail_chains(slug) ON UPDATE CASCADE,
  store_name  text        NULL,
  nationwide  boolean     NOT NULL DEFAULT false,
  position    int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- A chain from the list, or a store the owner names. Exactly one.
  CONSTRAINT listing_stockists_one_store_check
    CHECK ((chain_slug IS NULL) <> (store_name IS NULL)),
  CONSTRAINT listing_stockists_store_name_check
    CHECK (store_name IS NULL OR char_length(btrim(store_name)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS listing_stockists_listing_idx
  ON public.listing_stockists (listing_id, position);
-- One row per chain per page.
CREATE UNIQUE INDEX IF NOT EXISTS listing_stockists_listing_chain_key
  ON public.listing_stockists (listing_id, chain_slug)
  WHERE chain_slug IS NOT NULL;

ALTER TABLE public.listing_stockists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_stockists: anon read" ON public.listing_stockists;
CREATE POLICY "listing_stockists: anon read"
  ON public.listing_stockists FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockists: authenticated read" ON public.listing_stockists;
CREATE POLICY "listing_stockists: authenticated read"
  ON public.listing_stockists FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
    OR listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockists: owner insert" ON public.listing_stockists;
CREATE POLICY "listing_stockists: owner insert"
  ON public.listing_stockists FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockists: owner update" ON public.listing_stockists;
CREATE POLICY "listing_stockists: owner update"
  ON public.listing_stockists FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockists: owner delete" ON public.listing_stockists;
CREATE POLICY "listing_stockists: owner delete"
  ON public.listing_stockists FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- Find us at: where each store carries the products.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_stockist_areas (
  stockist_id  uuid NOT NULL REFERENCES public.listing_stockists(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  value        text NOT NULL,
  PRIMARY KEY (stockist_id, kind, value),
  CONSTRAINT listing_stockist_areas_kind_check CHECK (kind IN ('city', 'zip')),
  -- "30318", or "Atlanta, GA".
  CONSTRAINT listing_stockist_areas_value_check CHECK (
    (kind = 'zip' AND value ~ '^[0-9]{5}$')
    OR (kind = 'city' AND char_length(value) <= 80 AND value ~ '^[^,]+, [A-Z]{2}$')
  )
);

-- The "Sold near" filter looks a zip up here.
CREATE INDEX IF NOT EXISTS listing_stockist_areas_kind_value_idx
  ON public.listing_stockist_areas (kind, value);

ALTER TABLE public.listing_stockist_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_stockist_areas: anon read" ON public.listing_stockist_areas;
CREATE POLICY "listing_stockist_areas: anon read"
  ON public.listing_stockist_areas FOR SELECT TO anon
  USING (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.status = 'published' AND l.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockist_areas: authenticated read" ON public.listing_stockist_areas;
CREATE POLICY "listing_stockist_areas: authenticated read"
  ON public.listing_stockist_areas FOR SELECT TO authenticated
  USING (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.status = 'published' AND l.deleted_at IS NULL
    )
    OR stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.owner_user_id = auth.uid() AND l.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockist_areas: owner insert" ON public.listing_stockist_areas;
CREATE POLICY "listing_stockist_areas: owner insert"
  ON public.listing_stockist_areas FOR INSERT TO authenticated
  WITH CHECK (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.owner_user_id = auth.uid() AND l.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockist_areas: owner update" ON public.listing_stockist_areas;
CREATE POLICY "listing_stockist_areas: owner update"
  ON public.listing_stockist_areas FOR UPDATE TO authenticated
  USING (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.owner_user_id = auth.uid() AND l.deleted_at IS NULL
    )
  )
  WITH CHECK (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.owner_user_id = auth.uid() AND l.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_stockist_areas: owner delete" ON public.listing_stockist_areas;
CREATE POLICY "listing_stockist_areas: owner delete"
  ON public.listing_stockist_areas FOR DELETE TO authenticated
  USING (
    stockist_id IN (
      SELECT s.id FROM public.listing_stockists s
      JOIN public.listings l ON l.id = s.listing_id
      WHERE l.owner_user_id = auth.uid() AND l.deleted_at IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- Discover: the "Order on" and "Sold near" filters.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int,
  uuid[], text[], boolean, text[], boolean
);
DROP FUNCTION IF EXISTS facet_counts(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean,
  double precision, double precision, double precision, uuid[], text[], boolean,
  text[], boolean
);

-- search_listings_faceted (24 args)
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
  p_levels              text[]  DEFAULT NULL,
  p_has_deals           boolean DEFAULT NULL,
  p_platforms           text[]  DEFAULT NULL,
  p_stockist_zip        text    DEFAULT NULL
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
        -- ▲ CHANGED: a typo hit on the business name only.
        ELSE floor(strict_word_similarity(p_q, l.name) * 10)::int
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
        -- ▲ CHANGED: same expression as the band above.
        ELSE strict_word_similarity(p_q, l.name)
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      -- the prefix OR, and the name-only typo clause (▲ CHANGED).
      -- Kept textually identical in facet_counts.
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR l.search_vector @@ search_prefix_tsquery(p_q, 'AB')
        OR strict_word_similarity(p_q, l.name) > 0.5
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
      -- the deals filter (part G): a Premium page with a deal up now.
      -- Kept textually identical in facet_counts.
      AND (
        p_has_deals IS NOT TRUE
        OR (
          l.tier = 'premium'
          AND EXISTS (
            SELECT 1 FROM listing_deals ld
            WHERE ld.listing_id = l.id
              AND ld.status = 'active'
              AND ld.starts_at <= now()
              AND (ld.ends_at IS NULL OR ld.ends_at > now())
          )
        )
      )
      -- the order-on filter (part D): a page on any one of the picked platforms.
      -- Kept textually identical in facet_counts.
      AND (
        p_platforms IS NULL
        OR array_length(p_platforms, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM listing_order_platforms lop
          WHERE lop.listing_id = l.id
            AND lop.platform = ANY (p_platforms)
        )
      )
      -- the sold-near filter (part D): a store that carries the page's products
      -- in that zip, or a store marked nationwide. Kept textually identical in
      -- facet_counts.
      AND (
        p_stockist_zip IS NULL
        OR p_stockist_zip = ''
        OR EXISTS (
          SELECT 1 FROM listing_stockists ls
          WHERE ls.listing_id = l.id
            AND (
              ls.nationwide
              OR EXISTS (
                SELECT 1 FROM listing_stockist_areas lsa
                WHERE lsa.stockist_id = ls.id
                  AND lsa.kind = 'zip'
                  AND lsa.value = p_stockist_zip
              )
            )
        )
      )
      -- the levels filter. A main level or an extra matches.
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
  uuid[], text[], boolean, text[], boolean, text[], text
) TO anon, authenticated;


-- facet_counts (20 args)
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
  p_levels              text[]  DEFAULT NULL,
  p_has_deals           boolean DEFAULT NULL,
  p_platforms           text[]  DEFAULT NULL,
  p_stockist_zip        text    DEFAULT NULL
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
        OR strict_word_similarity(p_q, l.name) > 0.5
      )
      AND (p_city_id       IS NULL OR l.city_id       = p_city_id)
      -- the partners filter, same text as search_listings_faceted.
      AND (p_open_to_partnerships IS NOT TRUE OR l.open_to_partnerships)
      -- the deals filter (part G): a Premium page with a deal up now.
      -- Kept textually identical in facet_counts.
      AND (
        p_has_deals IS NOT TRUE
        OR (
          l.tier = 'premium'
          AND EXISTS (
            SELECT 1 FROM listing_deals ld
            WHERE ld.listing_id = l.id
              AND ld.status = 'active'
              AND ld.starts_at <= now()
              AND (ld.ends_at IS NULL OR ld.ends_at > now())
          )
        )
      )
      -- the order-on filter (part D): a page on any one of the picked platforms.
      -- Kept textually identical in facet_counts.
      AND (
        p_platforms IS NULL
        OR array_length(p_platforms, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM listing_order_platforms lop
          WHERE lop.listing_id = l.id
            AND lop.platform = ANY (p_platforms)
        )
      )
      -- the sold-near filter (part D): a store that carries the page's products
      -- in that zip, or a store marked nationwide. Kept textually identical in
      -- facet_counts.
      AND (
        p_stockist_zip IS NULL
        OR p_stockist_zip = ''
        OR EXISTS (
          SELECT 1 FROM listing_stockists ls
          WHERE ls.listing_id = l.id
            AND (
              ls.nationwide
              OR EXISTS (
                SELECT 1 FROM listing_stockist_areas lsa
                WHERE lsa.stockist_id = ls.id
                  AND lsa.kind = 'zip'
                  AND lsa.value = p_stockist_zip
              )
            )
        )
      )
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
  -- level_frame plus the levels predicate, same text as
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
  -- every predicate the result set uses except the levels one. The
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
  text[], boolean, text[], text
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
