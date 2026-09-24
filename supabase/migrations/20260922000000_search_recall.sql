-- =============================================================================
-- Migration: search recall — "dentist" must find what "dental" finds
-- Product: The BLACQList
--
-- The founder's report: searching "dentist" on /discover returns nothing, while
-- "dental" returns several. Both should hit.
--
-- -----------------------------------------------------------------------------
-- THE ACTUAL CAUSE (measured, not assumed)
-- -----------------------------------------------------------------------------
-- It is not a missing word. It is the English snowball stemmer.
--
-- Every dental listing in production indexes the stems 'dental' and 'dentistri'.
-- None of them index 'dentist'. The stemmer maps:
--
--     'dental'    -> 'dental'
--     'dentistry' -> 'dentistri'
--     'dentist'   -> 'dentist'      <- a THIRD, unrelated stem
--
-- so websearch_to_tsquery('english','dentist') produces 'dentist' and matches
-- no row. Verified against production 2026-09-22:
--
--   name                     hits 'dentist'   hits 'dental'
--   Elite Dental Wellness        false            true
--   Midtown Dental Center        false            true
--   Woodlawn Dental Gallery      false            true
--
--   vector for Midtown Dental Center:
--     'dental':2A,18C 'dentistri':10B,27C 'healthcar':13B ...
--   [Measured — production SQL, 2026-09-22]
--
-- No amount of tuning ts_rank fixes this. Full-text search is exact-match on
-- stems; two words that mean the same thing to a person are simply different
-- tokens to it. The fix has to add a second, non-exact retrieval path.
--
-- -----------------------------------------------------------------------------
-- WHAT THIS MIGRATION CHANGES
-- -----------------------------------------------------------------------------
-- 1. Both search_vector trigger functions also index the listing's PARENT
--    category name at weight B (the direct category name is already indexed).
-- 2. search_listings_faceted's q predicate gains a pg_trgm fallback, so a query
--    that misses on stems can still match by trigram similarity against the
--    listing name, tagline, or category name.
-- 3. The category filter matches descendants, so filtering by Healthcare also
--    returns listings filed under Dentists.
-- 4. facet_counts.core receives the identical predicate, so sidebar counts keep
--    describing the same query the results list ran.
-- 5. Every existing row is backfilled through the trigger.
--
-- -----------------------------------------------------------------------------
-- WHY word_similarity() AND NOT similarity()
-- -----------------------------------------------------------------------------
-- similarity() compares WHOLE strings, so a short query against a long business
-- name scores near zero no matter how well it matches one word inside it:
--
--     similarity('dentist', 'dental')                  = 0.364
--     word_similarity('dentist', 'Midtown Dental Center') = 0.5
--     word_similarity('dentist', 'Dentists')              = 0.875
--     word_similarity('denist',  'Dentists')              = 0.429   (typo)
--     word_similarity('dentist', 'Atlanta Soul Food Kitchen') = below 0.3
--   [Measured — production SQL, 2026-09-22]
--
-- word_similarity(query, target) scores the query against the best matching
-- continuous extent of the target, which is exactly the question being asked.
-- The plan as written said similarity(); using it would have shipped a fix that
-- did not fix the founder's case. Threshold 0.3 separates the real matches above
-- from the unrelated listing, with headroom on both sides.
--
-- -----------------------------------------------------------------------------
-- WHY THE FUNCTION FORM AND NOT THE %> OPERATOR (and why no trigram index)
-- -----------------------------------------------------------------------------
-- The plan called for GIN gin_trgm_ops indexes on listings.name and
-- listings.tagline. Those indexes serve ONLY the operator forms (% / %>), which
-- read their cutoff from the pg_trgm.*_threshold GUCs rather than from the
-- query. They cannot serve `word_similarity(a,b) > 0.3`.
--
-- The operator form was tested on production and rejected: with
-- pg_trgm.word_similarity_threshold set to 0.3, `'dentist' %> 'Midtown Dental
-- Center'` still returned FALSE (the 0.6 default was what the operator actually
-- applied), while the same pair scores 0.5 through word_similarity().
-- [Measured — production SQL, 2026-09-22]
--
-- So the operator would have silently kept the founder's exact query broken,
-- with the breakage hidden behind a session GUC. The function form is explicit,
-- GUC-independent, and verified.
--
-- The indexes are therefore NOT created here — they would be write overhead that
-- no query in this migration can use, which `database.md` forbids ("Do not add
-- indexes speculatively"). They become correct the day we move to the operator
-- form or the catalog outgrows a seq scan; at 372 published listings the planner
-- scans regardless. This is a deliberate deviation from the approved plan and is
-- flagged to the founder rather than applied silently.
--
-- -----------------------------------------------------------------------------
-- WHY RANK IS TIERED, NOT greatest(ts_rank, word_similarity)
-- -----------------------------------------------------------------------------
-- The plan said rank = greatest(ts_rank(...), similarity(...)). Those two are on
-- different scales: ts_rank for a strong weight-A hit is ~0.6, while a fuzzy
-- trigram hit can score 0.875. Taking the raw greatest would sort a fuzzy match
-- ABOVE an exact one — the opposite of what relevance means.
--
-- Instead: an exact full-text hit scores 1.0 + ts_rank (always >= 1.0), and a
-- trigram-only hit scores its word_similarity (always <= 1.0). Exact always
-- wins; fuzzy matches order among themselves by how close they are. No magic
-- constants, and the two tiers cannot cross.
--
-- -----------------------------------------------------------------------------
-- WHY NO DROP FUNCTION HERE — this is not the rule being forgotten
-- -----------------------------------------------------------------------------
-- 20260904000000:21-32 (and 20260809000000, and 20260811010000) all require an
-- explicit DROP before redefining these functions. That rule governs SIGNATURE
-- CHANGES: CREATE OR REPLACE against a changed argument list silently becomes
-- CREATE, leaving two overloads, and PostgREST's named-argument calls then match
-- both and are rejected as ambiguous.
--
-- This migration changes NEITHER signature. search_listings_faceted keeps all 17
-- arguments in the same order and types; facet_counts keeps all 13. The argument
-- lists below are byte-identical to 20260904000000's. CREATE OR REPLACE
-- therefore replaces in place, atomically, preserving the existing GRANTs and
-- leaving no window in which the function does not exist.
--
-- Adding a DROP here would be strictly worse: it would drop the GRANTs and open
-- a real (if brief) window where every /discover request fails. The unit test
-- asserts the two signatures still match 20260904000000's, so a future edit that
-- does change them cannot slip past this reasoning.
--
-- -----------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT HERE
-- -----------------------------------------------------------------------------
-- TAGS. The plan called for indexing tags at weight C. Production has 0 rows in
-- `tags` and 0 rows in `listing_tags`, and no application code reads either
-- table [Measured — production SQL, 2026-09-22]. Adding a listing_tags lookup to
-- update_listings_search_vector() would put a guaranteed-empty query on the hot
-- path of every listing INSERT and UPDATE — including the SET NULL cascade
-- during account deletion, which is the precise path 20260701000000 was written
-- to fix. Zero recall gained, new failure surface added.
--
-- When tags go live, add to BOTH trigger functions, in lockstep:
--     SELECT string_agg(t.name, ' ') INTO tag_names
--     FROM listing_tags lt JOIN tags t ON t.id = lt.tag_id
--     WHERE lt.listing_id = NEW.id;
--   ... || setweight(to_tsvector('english', coalesce(tag_names, '')), 'C')
-- and note that on INSERT the junction rows do not exist yet, so tags land on
-- the first subsequent UPDATE unless a listing_tags trigger is added too.
--
-- -----------------------------------------------------------------------------
-- A DATA FINDING THIS MIGRATION DOES NOT FIX
-- -----------------------------------------------------------------------------
-- 166 subcategories exist; only 7 of 372 published listings are filed under any
-- of them [Measured — production SQL, 2026-09-22]. All three dental listings sit
-- on top-level Healthcare. The descendant-matching filter added here is
-- therefore correct but nearly inert until listings are actually categorized.
-- The dental recategorization is a separate, idempotent data file applied under
-- the same gate; the wider categorization gap is a founder decision, not a
-- heuristic sweep.
-- =============================================================================


-- =============================================================================
-- PART 1 — search_vector triggers: index the PARENT category name too
--
-- Both functions must change together. refresh_listing_search_vector_from_details
-- rebuilds the whole vector from scratch whenever a business description is
-- edited; if it does not also write the parent category term, editing a
-- description silently deletes that term from the row. They have to agree
-- expression for expression.
--
-- Bodies are 20260701000000 verbatim except the parent-category line. Both stay
-- SECURITY DEFINER SET search_path = public — see that migration's header for
-- why removing it breaks account deletion with 42P01.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name        text;
  parent_cat_name text;
  biz_desc        text;
BEGIN
  -- One LEFT JOIN instead of two statements: a top-level category has no parent,
  -- and parent_cat_name stays NULL, which coalesces to '' below.
  SELECT c.name, p.name
    INTO cat_name, parent_cat_name
  FROM categories c
  LEFT JOIN categories p ON p.id = c.parent_id
  WHERE c.id = NEW.category_id;

  SELECT description INTO biz_desc FROM listing_details_business WHERE listing_id = NEW.id;

  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(parent_cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(biz_desc, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'D');
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION refresh_listing_search_vector_from_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name        text;
  parent_cat_name text;
BEGIN
  SELECT c.name, p.name
    INTO cat_name, parent_cat_name
  FROM categories c
  JOIN listings l ON l.category_id = c.id
  LEFT JOIN categories p ON p.id = c.parent_id
  WHERE l.id = NEW.listing_id;

  UPDATE listings SET search_vector =
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(parent_cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(service_area_description, '')), 'D')
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- PART 2 — search_listings_faceted
--
-- Signature IDENTICAL to 20260904000000 (17 args, same order, same types).
-- Body is 20260904000000 verbatim except the three places marked ▲ NEW.
-- =============================================================================
CREATE OR REPLACE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
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
      -- ▲ NEW (1 of 3): two-tier rank. An exact full-text hit scores 1.0 +
      -- ts_rank and therefore always outranks any trigram-only hit, which scores
      -- its own word_similarity (<= 1.0). See the header for why this replaces
      -- greatest(ts_rank, similarity).
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0
        WHEN l.search_vector @@ websearch_to_tsquery('english', p_q)
          THEN 1.0 + ts_rank(l.search_vector, websearch_to_tsquery('english', p_q))
        ELSE greatest(
               word_similarity(p_q, l.name),
               word_similarity(p_q, coalesce(l.tagline, '')),
               word_similarity(p_q, coalesce(cat.name, ''))
             )
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    -- ▲ NEW (2 of 3): the category join. l.category_id is NOT NULL with an FK,
    -- so this is effectively an inner join, but LEFT keeps the predicate honest
    -- if that ever changes.
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      -- ▲ NEW (3 of 3a): full text OR trigram. pg_trgm is created in the initial
      -- schema (20260510000000:43). Threshold 0.3 is measured — see header.
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR word_similarity(p_q, l.name) > 0.3
        OR word_similarity(p_q, coalesce(l.tagline, '')) > 0.3
        OR word_similarity(p_q, coalesce(cat.name, '')) > 0.3
      )
      -- ▲ NEW (3 of 3b): category matches itself or its direct children. The
      -- taxonomy is two levels deep, so one level of descent is complete.
      -- cat.parent_id = p_category_id reads as "the listing's category is a
      -- child of the selected one" — no subquery needed, because cat is already
      -- joined on the listing's own category.
      AND (
        p_category_id IS NULL
        OR l.category_id = p_category_id
        OR cat.parent_id = p_category_id
      )
      AND (p_city_id        IS NULL OR l.city_id         = p_city_id)
      AND (p_entity_type    IS NULL OR l.entity_type     = p_entity_type)
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

-- Re-stated for clarity; CREATE OR REPLACE preserved these, so this is a no-op
-- that documents the expected grant rather than a change.
GRANT EXECUTE ON FUNCTION search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
) TO anon, authenticated;


-- =============================================================================
-- PART 3 — facet_counts
--
-- Signature IDENTICAL to 20260904000000 (13 args). Only `core` changes, and it
-- takes the SAME q predicate and the SAME category predicate as
-- search_listings_faceted above.
--
-- 20260904000000:303-305 states the standing requirement: kept literally
-- identical, not "equivalent". If the two ever disagree, the sidebar counts stop
-- describing the result set the visitor is looking at.
-- =============================================================================
CREATE OR REPLACE FUNCTION facet_counts(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
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
    -- ▲ NEW: same join as search_listings_faceted.
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      -- ▲ NEW: identical q predicate to search_listings_faceted.
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR word_similarity(p_q, l.name) > 0.3
        OR word_similarity(p_q, coalesce(l.tagline, '')) > 0.3
        OR word_similarity(p_q, coalesce(cat.name, '')) > 0.3
      )
      -- ▲ NEW: identical category predicate to search_listings_faceted.
      AND (
        p_category_id IS NULL
        OR l.category_id = p_category_id
        OR cat.parent_id = p_category_id
      )
      AND (p_city_id       IS NULL OR l.city_id       = p_city_id)
      AND (p_entity_type   IS NULL OR l.entity_type   = p_entity_type)
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


-- =============================================================================
-- PART 4 — backfill every existing row through the new trigger
--
-- Setting search_vector to NULL fires the BEFORE INSERT OR UPDATE trigger
-- listings_search_vector_update, which recomputes the column from scratch. The
-- assignment is discarded; only the trigger's value is stored.
--
-- Do NOT use `ALTER TABLE listings DISABLE TRIGGER` around this — disabling the
-- trigger is precisely what would leave the column stale.
--
-- Two triggers exist on listings and both are cheap BEFORE hooks
-- [Measured — production SQL, 2026-09-22]:
--   listings_search_vector_update  BEFORE INSERT OR UPDATE  (the one we want)
--   set_updated_at                 BEFORE UPDATE            (bumps updated_at)
-- There are no AFTER triggers, so this touches no other table and fires no
-- webhook.
--
-- SIDE EFFECT, ACCEPTED: updated_at moves to now() on every listing. It is not
-- rendered on any public page, and this matches the precedent set by the
-- 20260601000000 backfill. Nothing in the product reads it as "last edited by
-- the owner" (that is last_edited_by_owner_at, a separate column, untouched).
-- =============================================================================
UPDATE listings SET search_vector = NULL;


-- Ask PostgREST to reload its schema cache. Required even though neither
-- signature changed, because the function bodies did.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- DOWN PLAN (GATE-DATA rollback — run manually, not automatically)
-- =============================================================================
-- Function DDL plus one backfill. Rollback takes seconds and loses no data.
--
-- 1. Restore both trigger functions to the pre-parent-category version:
--      run 20260701000000_fix_search_vector_security_definer.sql IN FULL.
--      Both are CREATE OR REPLACE with unchanged signatures, so this is a
--      straight in-place swap.
--
-- 2. Restore both search functions:
--      run 20260904000000_search_location_types.sql IN FULL.
--      Its two leading DROPs target the 16-arg and 12-arg signatures, which do
--      not exist here, so they are harmless no-ops. Its CREATE OR REPLACE then
--      replaces the 17-arg and 13-arg functions this migration wrote.
--
--      ⚠ NO DROP IS NEEDED OR WANTED in this rollback, for the same reason no
--      DROP was needed going forward: the signatures never changed. Adding one
--      would drop the GRANTs.
--
-- 3. Rebuild the vectors without the parent-category term:
--      UPDATE listings SET search_vector = NULL;
--      (Run AFTER step 1, or the old trigger will not be the one that fires.)
--
-- ORDERING: roll back in the order 1 -> 2 -> 3. Steps 1 and 2 are independent of
-- each other but step 3 depends on step 1.
--
-- CODE COUPLING: no deployed code sends a new argument to either function, since
-- neither signature changed. This migration can therefore be rolled back while
-- the new application code is live — search recall simply returns to today's
-- behaviour. That is the opposite of 20260904000000, which had to be rolled back
-- code-first, and it is a deliberate property of keeping the signatures fixed.
-- =============================================================================
