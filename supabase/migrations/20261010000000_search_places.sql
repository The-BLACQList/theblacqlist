-- =============================================================================
-- Migration: search understands places
-- Product: The BLACQList
--
-- The founder's report (2026-10-10): "the fact that I filter Agriculture and
-- Sus, then search Georgia and get 0 is wild and not acceptable. this and
-- similar cases should be covered."
--
-- -----------------------------------------------------------------------------
-- THE CAUSE
-- -----------------------------------------------------------------------------
-- search_vector holds name (A), tagline, category and parent category (B),
-- business description (C) and service-area text (D). It holds no place at all:
-- not the city, not the state, not the town in city_text, not the ZIP. So any
-- search that names a place can only hit a listing that happens to say the place
-- in its own words, and "farm georgia" or "barber houston" fails on every row
-- that does not.
--
-- -----------------------------------------------------------------------------
-- THE FIX
-- -----------------------------------------------------------------------------
-- 1. listing_place_text(city_id, listing_id) builds one line of place words for
--    a listing:
--      * the linked city's name, its state's name and its state code
--      * the town, state code and ZIP from listing_details_business, plus that
--        state's full name (city_text is the real town for metro listings, e.g.
--        a Hampton, GA farm filed under Atlanta)
--      * a short nickname list: ATL, HTX/HOU, NOLA, CHI, NYC, Philly, DFW,
--        Bmore, CLT, D.C., DMV. "LA" needs no alias row for Louisiana, because
--        LA is already its state code, and it is listed for Los Angeles, so
--        "LA" finds both, which is what the word means.
--      * the word "metro" for any listing with a city, so "Atlanta metro"
--        finds Atlanta listings. cities.metro_area is NOT indexed: it is a
--        census name ("Atlanta–Sandy Springs–Roswell, GA") and would make
--        "Roswell" or "Arlington" return a whole metro.
--
-- 2. Both search_vector trigger functions add that line at weight D. They must
--    agree expression for expression (see 20260922000000), so both call the same
--    helper.
--
--    The place layer uses the 'english' config, the same config as the query
--    side (websearch_to_tsquery('english', p_q)). A 'simple' vector would store
--    "texas" while the query looks for the stem "texa", and Texas would never
--    match. Measured locally: to_tsvector('english','Texas Illinois New Orleans')
--    = 'texa' 'illinoi' 'new' 'orlean'; the query side stems the same way.
--
-- 3. listing_details_search_vector_update now also fires on city_text, state
--    and zip, so moving a farm to a new town re-indexes it.
--
-- 4. Renaming a city or state re-indexes the listings in it (new triggers on
--    cities and states). Rare, admin-only, but otherwise a rename would leave
--    the old name searchable and the new one not.
--
-- 5. Backfill every listing.
--
-- -----------------------------------------------------------------------------
-- RANKING
-- -----------------------------------------------------------------------------
-- No change to search_listings_faceted or facet_counts. Their predicate already
-- accepts a full-text hit at any weight, so the new D words match with no RPC
-- change. A place-only hit lands in match_band 10, the same band as a
-- description hit, below every name/tagline/category hit (band 20), and is then
-- ordered the way that band always is. The prefix query stays on weights A/B
-- (search_prefix_tsquery(p_q, 'AB')), so typing "geo" does not drag in every
-- Georgia listing.
--
-- Multi-word searches AND their words, and "in" is an English stop word, so
-- "farms in georgia" means farm AND georgia: farms that are in Georgia.
--
-- -----------------------------------------------------------------------------
-- SAFETY
-- -----------------------------------------------------------------------------
-- * No signature changes. No DROP FUNCTION. The one DROP is a trigger, rebuilt
--   on the next line with a wider column list.
-- * Trigger functions stay SECURITY DEFINER SET search_path = public (see
--   20260701000000 for why removing it breaks account deletion with 42P01). The
--   new helper is called only from them; EXECUTE is revoked from client roles.
-- * Backfill side effect, accepted as in 20260601000000 and 20260922000000:
--   updated_at moves to now() on every listing. last_edited_by_owner_at, the
--   column that means "owner edited", is untouched.
-- * Re-runnable: everything is CREATE OR REPLACE / DROP IF EXISTS, and the
--   backfill recomputes the same value.
-- =============================================================================


-- =============================================================================
-- PART 1 — the place line
-- =============================================================================
CREATE OR REPLACE FUNCTION listing_place_text(p_city_id uuid, p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT concat_ws(' ',
    -- The linked city and its state.
    c.name,
    s.name,
    s.code,
    CASE c.slug
      WHEN 'atlanta-ga'      THEN 'ATL'
      WHEN 'houston-tx'      THEN 'HTX HOU'
      WHEN 'new-orleans-la'  THEN 'NOLA'
      WHEN 'chicago-il'      THEN 'CHI'
      WHEN 'los-angeles-ca'  THEN 'LA'
      WHEN 'new-york-ny'     THEN 'NYC'
      WHEN 'philadelphia-pa' THEN 'Philly'
      WHEN 'dallas-tx'       THEN 'DFW'
      WHEN 'baltimore-md'    THEN 'Bmore'
      WHEN 'charlotte-nc'    THEN 'CLT'
    END,
    CASE s.code
      WHEN 'DC' THEN 'D.C. DMV'
      WHEN 'MD' THEN 'DMV'
      WHEN 'VA' THEN 'DMV'
    END,
    CASE WHEN c.id IS NOT NULL THEN 'metro' END,
    -- The listing's own town, state and ZIP.
    d.city_text,
    ds.name,
    ds.code,
    CASE ds.code
      WHEN 'DC' THEN 'D.C. DMV'
      WHEN 'MD' THEN 'DMV'
      WHEN 'VA' THEN 'DMV'
    END,
    substring(d.zip FROM '^\s*(\d{5})')
  )
  FROM (SELECT 1) AS one
  LEFT JOIN cities c                    ON c.id = p_city_id
  LEFT JOIN states s                    ON s.id = c.state_id
  LEFT JOIN listing_details_business d  ON d.listing_id = p_listing_id
  LEFT JOIN states ds                   ON ds.code = upper(btrim(d.state));
$$;

REVOKE EXECUTE ON FUNCTION listing_place_text(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION listing_place_text(uuid, uuid) FROM anon, authenticated;


-- =============================================================================
-- PART 2 — both search_vector trigger functions
--
-- Bodies are 20260922000000 verbatim plus the last line (the place layer).
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
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(listing_place_text(NEW.city_id, NEW.id), '')), 'D');
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
    setweight(to_tsvector('english', coalesce(service_area_description, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(listing_place_text(city_id, NEW.listing_id), '')), 'D')
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- PART 3 — re-index when the town, state or ZIP changes
-- =============================================================================
DROP TRIGGER IF EXISTS listing_details_search_vector_update ON listing_details_business;
CREATE TRIGGER listing_details_search_vector_update
  AFTER INSERT OR UPDATE OF description, city_text, state, zip ON listing_details_business
  FOR EACH ROW EXECUTE FUNCTION refresh_listing_search_vector_from_details();


-- =============================================================================
-- PART 4 — re-index when a city or state is renamed
--
-- Setting search_vector to NULL fires listings_search_vector_update, which
-- recomputes the column from scratch (same move as the PART 5 backfill).
-- =============================================================================
CREATE OR REPLACE FUNCTION refresh_search_vectors_for_place()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'cities' THEN
    UPDATE listings SET search_vector = NULL
    WHERE city_id = NEW.id;
  ELSE
    UPDATE listings SET search_vector = NULL
    WHERE city_id IN (SELECT id FROM cities WHERE state_id = NEW.id)
       OR id IN (
         SELECT listing_id FROM listing_details_business
         WHERE upper(btrim(state)) IN (OLD.code, NEW.code)
       );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_search_vectors_for_place() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_search_vectors_for_place() FROM anon, authenticated;

DROP TRIGGER IF EXISTS cities_search_vector_refresh ON cities;
CREATE TRIGGER cities_search_vector_refresh
  AFTER UPDATE OF name, slug, state_id ON cities
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
     OR OLD.slug IS DISTINCT FROM NEW.slug
     OR OLD.state_id IS DISTINCT FROM NEW.state_id)
  EXECUTE FUNCTION refresh_search_vectors_for_place();

DROP TRIGGER IF EXISTS states_search_vector_refresh ON states;
CREATE TRIGGER states_search_vector_refresh
  AFTER UPDATE OF name, code ON states
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.code IS DISTINCT FROM NEW.code)
  EXECUTE FUNCTION refresh_search_vectors_for_place();


-- =============================================================================
-- PART 5 — backfill every listing, then check none is left empty
-- =============================================================================
UPDATE listings SET search_vector = NULL;

DO $$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing FROM listings WHERE search_vector IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'search_places backfill left % listings with no search_vector', missing;
  END IF;
END;
$$;


-- =============================================================================
-- DOWN PLAN (run manually, not automatically)
-- =============================================================================
-- 1. Restore both trigger functions: run PART 1 of
--    20260922000000_search_recall.sql (the two CREATE OR REPLACE FUNCTION
--    statements only; the rest of that file rewrites the search RPCs, which
--    this migration did not touch).
-- 2. Put the details trigger back on description only:
--      DROP TRIGGER IF EXISTS listing_details_search_vector_update ON listing_details_business;
--      CREATE TRIGGER listing_details_search_vector_update
--        AFTER INSERT OR UPDATE OF description ON listing_details_business
--        FOR EACH ROW EXECUTE FUNCTION refresh_listing_search_vector_from_details();
-- 3. Drop the rename triggers and the two new functions:
--      DROP TRIGGER IF EXISTS cities_search_vector_refresh ON cities;
--      DROP TRIGGER IF EXISTS states_search_vector_refresh ON states;
--      DROP FUNCTION IF EXISTS refresh_search_vectors_for_place();
--      DROP FUNCTION IF EXISTS listing_place_text(uuid, uuid);
-- 4. Rebuild the vectors: UPDATE listings SET search_vector = NULL;
-- Order matters: 1 before 3 (the old trigger functions must stop calling the
-- helper before it is dropped), and 4 last. No application code depends on
-- this migration, so it can be rolled back while any build is live.
-- =============================================================================
