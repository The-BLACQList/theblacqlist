-- =============================================================================
-- US places list for onboarding "Where Are You Based?" (ticket 230)
--
-- [Decision — founder, 2026-11-15] People type any US city in onboarding and
-- pick from suggestions, instead of choosing from the few BLACQList cities.
-- Suggestions come from our own copy of the Census place list, served from our
-- server, so no outside company sees what people type. "Use my location" is
-- matched to the nearest place here too.
--
-- This migration is DDL only. The rows are loaded separately by
-- `pnpm seed:us-places` from data/geo/us-places.csv (Census 2024 Gazetteer
-- places + Vintage 2024 population estimates, both public domain).
--
--   1. public.us_places — about 32,000 places: geoid, name, state, centre
--      point, land area, population (incorporated places only; CDPs have none) and a
--      normalized `search` column. Public reference data, like states/cities.
--   2. profiles.home_place_geoid — the place a person picked. profiles.city_id
--      is still set too when the place is one of our active cities.
--   3. suggest_us_places() — what the typeahead calls.
--   4. nearest_us_place() — what "Use my location" calls. The coordinates are
--      used for the lookup only; nothing here stores them.
--
-- `search` is normalized in the app (lib/geo/usPlaces.ts normalizePlaceSearch):
-- lower case, no accents, no apostrophes, punctuation as single spaces. The
-- function compares as-is and never normalizes again, so callers must send
-- the query through the same helper.
--
-- GATE-DATA: staging first, after the founder's OK; production with the
-- ticket 230 merge. The app degrades to "no suggestions" (typing and Skip still
-- work) if the code ships before this migration, so order is not critical, but
-- migration-then-code is the intended order.
--
-- Rollback:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS home_place_geoid;
--   DROP FUNCTION IF EXISTS suggest_us_places(text, text, text, text, integer);
--   DROP FUNCTION IF EXISTS nearest_us_place(double precision, double precision);
--   DROP TABLE IF EXISTS us_places;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. us_places
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS us_places (
  geoid       text             PRIMARY KEY CHECK (geoid ~ '^\d{7}$'),
  name        text             NOT NULL,
  state_code  char(2)          NOT NULL,
  label       text             NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  land_sq_mi  double precision NOT NULL DEFAULT 0,
  population  integer,
  search      text             NOT NULL
);

-- Prefix and word-start matching (LIKE 'deca%' / LIKE '% honolulu%').
-- pg_trgm is created in 20260510000000.
CREATE INDEX IF NOT EXISTS us_places_search_trgm_idx
  ON us_places USING gin (search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS us_places_search_prefix_idx
  ON us_places (search text_pattern_ops);
-- Bounding-box prefilter for nearest_us_place().
CREATE INDEX IF NOT EXISTS us_places_lat_lng_idx
  ON us_places (lat, lng);

ALTER TABLE us_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "us_places: public read" ON us_places;
CREATE POLICY "us_places: public read"
  ON us_places FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON us_places TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. profiles.home_place_geoid
-- -----------------------------------------------------------------------------
-- Written by the person's own session under "profiles: authenticated update
-- own". ON DELETE SET NULL so reloading the list can never fail on a place
-- that the Census later retires.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_place_geoid text
  REFERENCES us_places(geoid) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_home_place_geoid_idx
  ON profiles (home_place_geoid);

-- -----------------------------------------------------------------------------
-- 3. suggest_us_places
-- -----------------------------------------------------------------------------
-- p_name / p_state: the main reading ("houston", "T" for "Houston, T").
-- p_alt_name / p_alt_state: a second reading for a state typed without a comma
-- ("austin tx" -> "austin", "TX"). Both readings are matched and merged.
--
-- Order: our active cities first, then names that start with the text, then
-- the larger population, then the label.
DROP FUNCTION IF EXISTS suggest_us_places(text, text, text, text, integer);
CREATE OR REPLACE FUNCTION suggest_us_places(
  p_name      text,
  p_state     text    DEFAULT '',
  p_alt_name  text    DEFAULT '',
  p_alt_state text    DEFAULT '',
  p_limit     integer DEFAULT 8
)
RETURNS TABLE (geoid text, label text, name text, state_code text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH readings AS (
    SELECT p_name AS n, coalesce(p_state, '') AS s
    WHERE length(coalesce(p_name, '')) >= 2
    UNION ALL
    SELECT p_alt_name, coalesce(p_alt_state, '')
    WHERE length(coalesce(p_alt_name, '')) >= 2
  ),
  hits AS (
    SELECT DISTINCT ON (p.geoid)
      p.geoid, p.label, p.name, p.state_code, p.population,
      (p.search LIKE r.n || '%') AS starts
    FROM readings r
    JOIN us_places p
      ON (p.search LIKE r.n || '%' OR p.search LIKE '% ' || r.n || '%')
     AND (r.s = '' OR p.state_code LIKE r.s || '%')
    ORDER BY p.geoid, (p.search LIKE r.n || '%') DESC
  )
  SELECT h.geoid, h.label, h.name, h.state_code::text
  FROM hits h
  ORDER BY
    EXISTS (
      SELECT 1
      FROM cities c
      JOIN states s ON s.id = c.state_id
      WHERE c.is_active
        AND lower(c.name) = lower(h.name)
        AND s.code = h.state_code
    ) DESC,
    h.starts DESC,
    h.population DESC NULLS LAST,
    h.label
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION suggest_us_places(text, text, text, text, integer)
  TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. nearest_us_place
-- -----------------------------------------------------------------------------
-- The place the point is most likely in, within 30 miles, or no row.
--
-- "Closest centre point" alone gets big cities wrong: midtown Manhattan is
-- closer to Hoboken's centre than to New York's. So each place is treated as a
-- circle with its land area, and the point's distance to that circle's edge is
-- what is compared (negative = inside). Not exact, but right for "which town
-- is this", which is all the field needs.
--
-- A ±1° latitude box (about 69 miles; the largest place is about 30 miles
-- across its circle) and a longitude box widened for latitude keep the
-- haversine to a few hundred rows. haversine_miles() is from 20260811010000.
DROP FUNCTION IF EXISTS nearest_us_place(double precision, double precision);
CREATE OR REPLACE FUNCTION nearest_us_place(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE (geoid text, label text, name text, state_code text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.geoid, p.label, p.name, p.state_code::text
  FROM us_places p
  WHERE p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND p.lat BETWEEN p_lat - 1 AND p_lat + 1
    AND p.lng BETWEEN p_lng - 1 / greatest(cos(radians(p_lat)), 0.1)
                  AND p_lng + 1 / greatest(cos(radians(p_lat)), 0.1)
    AND haversine_miles(p_lat, p_lng, p.lat, p.lng) - sqrt(p.land_sq_mi / pi()) <= 30
  ORDER BY haversine_miles(p_lat, p_lng, p.lat, p.lng) - sqrt(p.land_sq_mi / pi())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION nearest_us_place(double precision, double precision)
  TO anon, authenticated;
