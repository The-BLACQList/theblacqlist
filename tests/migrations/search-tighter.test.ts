/**
 * 20261018000000_search_tighter.sql, run against a scratch database.
 *
 * THE DEFECT, in the founder's words (2026-10-16): "search is still a bit too
 * loose." On prod, "lawyer" found farms in Slaughter, LA and a Lawndale
 * pharmacy, "barber" found Bar-B-Q places, "dentist" found Denise's
 * Delicacies, and "soul food" found everything filed under "Food & Dining".
 * All of it came from the word_similarity() typo clause on name, tagline and
 * category name.
 *
 * What each case protects:
 *   1. The junk           -> each reported query finds the junk row BEFORE the
 *                            migration (proves the test can see the bug) and
 *                            only the real rows after it.
 *   2. Typo help survives -> "resturant" and "florida ave grill" still find
 *                            the right business by its name.
 *   3. Real matches stay  -> a tagline or category WORD match still counts;
 *                            only the fuzzy part is gone.
 *   4. Counts agree       -> facet_counts' cells add up to the search total,
 *                            so the sidebar never promises rows search hides.
 *   5. Idempotency        -> re-applying changes nothing.
 *
 * Chain: search-places.test.ts's chain through 20261010000000, then
 * 20261017000000_business_levels.sql (the current production state of both
 * functions), then this migration. FIXTURE, EXTRA and PLACES are that test's,
 * verbatim.
 *
 * Like every test in tests/migrations/, this runs only against a LOCAL scratch
 * database. It creates and drops `migtest_*` databases.
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, withScratchDb } from './helpers'

const VECTOR_BASE = path.join(MIGRATIONS_DIR, '20260601000000_extend_search_vector.sql')
const RPC_BASE = path.join(MIGRATIONS_DIR, '20260622000001_search_listings_faceted_rpc.sql')
const SECDEF = path.join(MIGRATIONS_DIR, '20260701000000_fix_search_vector_security_definer.sql')
const OWNERSHIP = path.join(MIGRATIONS_DIR, '20260707000000_listings_ownership_label.sql')
const TIEBREAK = path.join(MIGRATIONS_DIR, '20260809000000_search_tier_tiebreak.sql')
const RADIUS = path.join(MIGRATIONS_DIR, '20260811010000_search_radius_filter.sql')
const LOCTYPES = path.join(MIGRATIONS_DIR, '20260904000000_search_location_types.sql')
const RECALL = path.join(MIGRATIONS_DIR, '20260922000000_search_recall.sql')
const ACTIVITY = path.join(MIGRATIONS_DIR, '20260923000000_activity_ranking.sql')
const SHORTCUTS = path.join(MIGRATIONS_DIR, '20260924000000_type_shortcuts_relevance.sql')
const CREATOR = path.join(MIGRATIONS_DIR, '20261008010000_creator_entity.sql')
const PLACES_MIGRATION = path.join(MIGRATIONS_DIR, '20261010000000_search_places.sql')
const LEVELS = path.join(MIGRATIONS_DIR, '20261017000000_business_levels.sql')
const MIGRATION = path.join(MIGRATIONS_DIR, '20261018000000_search_tighter.sql')

// search-places.test.ts's FIXTURE, verbatim.
const FIXTURE = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE categories (
  id        uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name      text NOT NULL,
  slug      text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE listings (
  id                       uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                     text NOT NULL,
  tagline                  text,
  service_area_description text,
  tier                     text NOT NULL DEFAULT 'free'
                             CHECK (tier IN ('free','starter','growth','premium')),
  status                   text NOT NULL DEFAULT 'published',
  deleted_at               timestamptz,
  flag_status              text NOT NULL DEFAULT 'none',
  is_featured              boolean NOT NULL DEFAULT false,
  published_at             timestamptz NOT NULL DEFAULT now(),
  save_count               integer NOT NULL DEFAULT 0,
  avg_rating               numeric,
  review_count             integer NOT NULL DEFAULT 0,
  category_id              uuid REFERENCES categories(id),
  city_id                  uuid,
  entity_type              text NOT NULL DEFAULT 'business',
  trust_tier               text NOT NULL DEFAULT 'unclaimed',
  location_type            text,
  search_vector            tsvector,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  last_edited_by_owner_at  timestamptz
);

CREATE TABLE listing_details_business (
  listing_id  uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  description text,
  price_range text,
  lat         numeric,
  lng         numeric
);

CREATE TABLE attribute_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
);

CREATE TABLE attribute_values (
  id        uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id  uuid NOT NULL REFERENCES attribute_groups(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE listing_attributes (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  value_id   uuid NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, value_id)
);

CREATE TABLE listing_hours (
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL
);

-- reviews, at the production shape. owner_responded_at is NOT in the initial
-- schema; it arrives in 20260517000001_reviews_owner_response.sql:4, so it is
-- declared explicitly here or PART 4's owner-reply branch would not compile.
CREATE TABLE reviews (
  id                 uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id   uuid,
  rating             integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title              text,
  body               text,
  status             text NOT NULL DEFAULT 'intake'
                       CHECK (status IN ('intake','pending_approval','published','rejected','removed')),
  published_at       timestamptz,
  owner_responded_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- analytics_events. Immutable by design, so there is no updated_at.
CREATE TABLE analytics_events (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid,
  session_id  text,
  properties  jsonb NOT NULL DEFAULT '{}',
  ip_address  text,
  user_agent  text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The UNIQUE constraint is load-bearing: PART 5's INSERT ends in
-- ON CONFLICT (listing_id, snapshot_date) DO UPDATE.
CREATE TABLE entity_analytics_daily (
  id                 uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  snapshot_date      date NOT NULL,
  page_views         integer NOT NULL DEFAULT 0,
  cta_clicks         integer NOT NULL DEFAULT 0,
  saves              integer NOT NULL DEFAULT 0,
  shares             integer NOT NULL DEFAULT 0,
  search_impressions integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, snapshot_date)
);

CREATE TABLE analytics_job_log (
  id                 uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date           date NOT NULL,
  listings_processed integer NOT NULL DEFAULT 0,
  errors             integer NOT NULL DEFAULT 0,
  duration_ms        integer,
  status             text NOT NULL CHECK (status IN ('success','partial','failed')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION is_open_now(p_listing_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $fn$ SELECT true; $fn$;

-- The initial schema's generic updated_at trigger function, verbatim
-- (20260510000000:50-56). PART 3 of the migration rebinds a trigger to it.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- UNGUARDED on purpose. See design note 3 in the header.
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- The initial schema's version of the search_vector trigger function, verbatim
-- (20260510000000:423-432). Name, tagline, service area only — no category. It
-- is here so the trigger below has something to bind to; 20260601000000
-- immediately replaces it and 20260922000000 replaces it again.
CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'D');
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER listings_search_vector_update
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_listings_search_vector();
`

// What the shared FIXTURE leaves out and this migration writes to: the
// production columns and unique indexes its ON CONFLICT clauses name
// (20260510000000:139, 20260622000000:40), the live entity_type CHECK
// (20260813000000) and featured_awards with its inline bucket CHECK
// (20261005000000:108-119).
const EXTRA = `
ALTER TABLE categories ADD COLUMN display_order integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX categories_slug_idx ON categories (slug);

ALTER TABLE attribute_groups
  ADD COLUMN name          text    NOT NULL DEFAULT '',
  ADD COLUMN slug          text    NOT NULL DEFAULT '',
  ADD COLUMN description   text,
  ADD COLUMN input_type    text    NOT NULL DEFAULT 'checkbox'
                                   CHECK (input_type IN ('checkbox','radio')),
  ADD COLUMN applies_to    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN is_filterable boolean NOT NULL DEFAULT true,
  ADD COLUMN is_active     boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX attribute_groups_slug_idx ON attribute_groups (slug);

ALTER TABLE attribute_values
  ADD COLUMN name          text    NOT NULL DEFAULT '',
  ADD COLUMN slug          text    NOT NULL DEFAULT '',
  ADD COLUMN display_order integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT attribute_values_group_id_slug_key UNIQUE (group_id, slug);

ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN (
    'business','restaurant','service_provider','professional','creative','vendor','event','job'
  ));

CREATE TABLE featured_awards (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start  date        NOT NULL CHECK (EXTRACT(isodow FROM week_start) = 1),
  bucket      text        NOT NULL CHECK (bucket IN (
                'business','restaurant','service_provider','vendor',
                'professional','creative','event','job')),
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score       numeric     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_awards_week_bucket_key  UNIQUE (week_start, bucket),
  CONSTRAINT featured_awards_week_listing_key UNIQUE (week_start, listing_id)
);
`

// Category names are production's (supabase/seed.sql), so stemming behaves
// the way it does live: "barber" matches "Barber Shops".
//
// What this migration reads that the shared fixture leaves out: the states and
// cities tables at their production shape (20260510000000:64-102) and the
// address columns on listing_details_business (20260510000000:450-454).
const PLACES = `
CREATE TABLE states (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  code       text NOT NULL,
  country    text NOT NULL DEFAULT 'US',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX states_code_idx ON states (code);

CREATE TABLE cities (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  slug       text NOT NULL,
  state_id   uuid NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
  metro_area text,
  latitude   numeric(10,6) NOT NULL,
  longitude  numeric(10,6) NOT NULL
);
CREATE UNIQUE INDEX cities_slug_idx ON cities (slug);

ALTER TABLE listing_details_business
  ADD COLUMN city_text text,
  ADD COLUMN state     text,
  ADD COLUMN zip       text;
`


const LAW = 'aaaaaaaa-0000-0000-0000-000000000011'
const DENTISTS = 'aaaaaaaa-0000-0000-0000-000000000012'
const BARBER = 'aaaaaaaa-0000-0000-0000-000000000013'
const FOOD = 'aaaaaaaa-0000-0000-0000-000000000014'
const FARMS = 'aaaaaaaa-0000-0000-0000-000000000015'
const PHARMACY = 'aaaaaaaa-0000-0000-0000-000000000016'

const CITY = 'cccccccc-0000-0000-0000-000000000001'

// Real rows: what each query should find.
const LAW_FIRM = '20000000-0000-0000-0000-000000000001' // filed under Law & Legal Services
const SMILE = '20000000-0000-0000-0000-000000000002' // filed under Dentists
const CUTZ = '20000000-0000-0000-0000-000000000003' // filed under Barber Shops
const GRILL = '20000000-0000-0000-0000-000000000004' // "Soul food" in its tagline
const MAMAS = '20000000-0000-0000-0000-000000000005' // "Restaurant" in its name

// Junk rows, each one a prod report (2026-10-16).
const LAWNDALE = '30000000-0000-0000-0000-000000000001' // "lawyer"
const SLAUGHTER = '30000000-0000-0000-0000-000000000002' // "lawyer"
const BBQ = '30000000-0000-0000-0000-000000000003' // "barber"
const DENISE = '30000000-0000-0000-0000-000000000004' // "dentist"
const PLATES = '30000000-0000-0000-0000-000000000005' // "soul food", via "Food & Dining"

const SEED = `
INSERT INTO states (name, code) VALUES ('Louisiana', 'LA');
INSERT INTO cities (id, name, slug, state_id, latitude, longitude) VALUES
  ('${CITY}', 'Baton Rouge', 'baton-rouge-la', (SELECT id FROM states WHERE code = 'LA'), 30.45, -91.19);

INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${LAW}',      'Law & Legal Services', 'law-legal-services', NULL),
  ('${DENTISTS}', 'Dentists',             'dentists',           NULL),
  ('${BARBER}',   'Barber Shops',         'barber-shops',       NULL),
  ('${FOOD}',     'Food & Dining',        'food-dining',        NULL),
  ('${FARMS}',    'Farms & Farm Stands',  'farms-farm-stands',  NULL),
  ('${PHARMACY}', 'Pharmacies',           'pharmacies',         NULL);

INSERT INTO listings (id, name, tagline, category_id, city_id) VALUES
  ('${LAW_FIRM}',  'Johnson Law Group',      'Lawyers for families',  '${LAW}',      '${CITY}'),
  ('${SMILE}',     'Bright Smile Dental',    'Family dentistry',      '${DENTISTS}', '${CITY}'),
  ('${CUTZ}',      'Fresh Cutz',             'Fades and lineups',     '${BARBER}',   '${CITY}'),
  ('${GRILL}',     'Florida Avenue Grill',   'Soul food since 1944',  '${FOOD}',     '${CITY}'),
  ('${MAMAS}',     'Mama Dee''s Restaurant', 'Plates daily',          '${FOOD}',     '${CITY}'),
  ('${LAWNDALE}',  'Lawndale Pharmacy',      'Prescriptions filled',  '${PHARMACY}', '${CITY}'),
  ('${SLAUGHTER}', 'Slaughter Road Farm',    'Lawn-raised hens',      '${FARMS}',    '${CITY}'),
  ('${BBQ}',       'Big Mike''s Bar-B-Q',    'Ribs and brisket',      '${FOOD}',     '${CITY}'),
  ('${DENISE}',    'Denise''s Delicacies',   'Cakes and pies',        '${FOOD}',     '${CITY}'),
  ('${PLATES}',    'Crenshaw Plates',        'Plate lunches',         '${FOOD}',     '${CITY}');
`

function previous(url: string) {
  exec(url, FIXTURE)
  applyFile(url, VECTOR_BASE)
  applyFile(url, RPC_BASE)
  applyFile(url, SECDEF)
  applyFile(url, OWNERSHIP)
  applyFile(url, TIEBREAK)
  applyFile(url, RADIUS)
  applyFile(url, LOCTYPES)
  applyFile(url, RECALL)
  applyFile(url, ACTIVITY)
  applyFile(url, SHORTCUTS)
  exec(url, EXTRA)
  applyFile(url, CREATOR)
  exec(url, PLACES)
  applyFile(url, PLACES_MIGRATION)
  applyFile(url, LEVELS)
  exec(url, SEED)
}

function current(url: string) {
  previous(url)
  applyFile(url, MIGRATION)
}

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Ids search_listings_faceted returns for q, sorted (order is not under test). */
function search(url: string, q: string): string[] {
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(p_q => ${sqlText(q)}, p_sort => 'relevance', p_limit => 50, p_offset => 0)`
  )
    .map((r) => r.id)
    .sort()
}

/** The sum of facet_counts' cell rows, which is the sidebar's idea of the total. */
function cellTotal(url: string, q: string): number {
  return query<{ facet_count: string }>(
    url,
    `SELECT facet_count FROM facet_counts(p_q => ${sqlText(q)}) WHERE facet_kind = 'cell'`
  ).reduce((n, r) => n + Number(r.facet_count), 0)
}

const REPORTED: Array<{ q: string; junk: string; real: string[] }> = [
  { q: 'lawyer', junk: LAWNDALE, real: [LAW_FIRM] },
  { q: 'barber', junk: BBQ, real: [CUTZ] },
  { q: 'dentist', junk: DENISE, real: [SMILE] },
  { q: 'soul food', junk: PLATES, real: [GRILL] },
]

describe.skipIf(!DB_REACHABLE)('20261018000000_search_tighter', () => {
  it('1. finds the reported junk before, and only the real rows after', () => {
    withScratchDb('tighter_junk_before', (url) => {
      previous(url)
      for (const { q, junk } of REPORTED) {
        expect(search(url, q), q).toContain(junk)
      }
    })
    withScratchDb('tighter_junk_after', (url) => {
      current(url)
      for (const { q, real } of REPORTED) {
        expect(search(url, q), q).toEqual([...real].sort())
      }
      expect(search(url, 'lawyer')).not.toContain(SLAUGHTER)
    })
  })

  it('2. keeps typo help on the business name', () => {
    withScratchDb('tighter_typos', (url) => {
      current(url)
      expect(search(url, 'resturant')).toEqual([MAMAS])
      expect(search(url, 'florida ave grill')).toEqual([GRILL])
    })
  })

  it('3. still counts a real word in the tagline or category', () => {
    withScratchDb('tighter_words', (url) => {
      current(url)
      // tagline word
      expect(search(url, 'brisket')).toEqual([BBQ])
      // category word, with no fuzzy help: "Pharmacies" stems to "pharmaci"
      expect(search(url, 'pharmacy')).toEqual([LAWNDALE])
      // prefix on name/tagline/category
      expect(search(url, 'restaur')).toEqual([MAMAS])
    })
  })

  it('4. facet_counts agrees with search for every query', () => {
    withScratchDb('tighter_counts', (url) => {
      current(url)
      for (const q of ['lawyer', 'barber', 'dentist', 'soul food', 'resturant', 'florida ave grill', 'xyzzy']) {
        expect(cellTotal(url, q), q).toBe(search(url, q).length)
      }
    })
  })

  it('5. is idempotent', () => {
    withScratchDb('tighter_idempotent', (url) => {
      current(url)
      const before = REPORTED.map(({ q }) => search(url, q))
      applyFile(url, MIGRATION)
      expect(REPORTED.map(({ q }) => search(url, q))).toEqual(before)
    })
  })
})
