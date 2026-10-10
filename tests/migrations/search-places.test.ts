/**
 * 20261010000000_search_places.sql, run against a scratch database.
 *
 * THE DEFECT, in the founder's words (2026-10-10): "the fact that I filter
 * Agriculture and Sus, then search Georgia and get 0 is wild and not
 * acceptable. this and similar cases should be covered."
 *
 * search_vector held no place words, so a search for a state, city, town,
 * nickname or ZIP could only hit a listing that said the place in its own name
 * or description. The migration adds a weight-D place layer.
 *
 * What each case protects:
 *   1. The reported case     -> Agriculture filter + "Georgia" is 0 BEFORE the
 *                               migration (proves the test can see the bug) and
 *                               returns the Georgia farms after it, in both
 *                               search_listings_faceted and facet_counts.
 *   2. Every kind of place   -> state name, state code, city, town in
 *                               city_text, nickname, ZIP, "metro".
 *   3. Topic + place         -> "farm georgia", "farms in georgia",
 *                               "barber houston", "soul food atlanta" find only
 *                               the right rows.
 *   4. Ranking               -> a place-only hit never outranks a name hit.
 *   5. Prefix stays on A/B   -> typing "geo" does not pull in every Georgia row.
 *   6. Triggers              -> a new listing, a moved town and a renamed city
 *                               are all searchable without a manual backfill.
 *   7. Idempotency           -> re-applying changes nothing.
 *
 * Chain: creator-entity.test.ts's chain through 20261008010000 (the current
 * production state of both search functions and both trigger functions), plus
 * the cities and states tables and the address columns this migration reads.
 * FIXTURE and EXTRA are that test's, verbatim.
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
const MIGRATION = path.join(MIGRATIONS_DIR, '20261010000000_search_places.sql')

// creator-entity.test.ts's FIXTURE (itself type-shortcuts-relevance.test.ts's), verbatim.
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

const AG = 'aaaaaaaa-0000-0000-0000-00000000000a'
const FARMS = 'aaaaaaaa-0000-0000-0000-00000000000f'
const BARBER = 'aaaaaaaa-0000-0000-0000-00000000000b'
const FOOD = 'aaaaaaaa-0000-0000-0000-000000000001'

const ATL = 'cccccccc-0000-0000-0000-000000000001'
const HOU = 'cccccccc-0000-0000-0000-000000000002'
const NOLA = 'cccccccc-0000-0000-0000-000000000003'
const DC = 'cccccccc-0000-0000-0000-000000000004'
const LAX = 'cccccccc-0000-0000-0000-000000000005'

const HAMPTON_FARM = '10000000-0000-0000-0000-000000000001' // Hampton, GA, under Atlanta
const MARLBORO_FARM = '10000000-0000-0000-0000-000000000002' // Upper Marlboro, MD, under DC
const MISSOURI_FARM = '10000000-0000-0000-0000-000000000003' // Missouri City, TX, under Houston
const NOLA_FARM = '10000000-0000-0000-0000-000000000004' // New Orleans, LA
const ATL_BARBER = '10000000-0000-0000-0000-000000000005'
const HOU_BARBER = '10000000-0000-0000-0000-000000000006'
const ATL_GRILL = '10000000-0000-0000-0000-000000000007'
const PEACH = '10000000-0000-0000-0000-000000000008' // "Georgia" in its NAME, located in Houston
const LA_SHOP = '10000000-0000-0000-0000-000000000009'

const SEED = `
INSERT INTO states (name, code) VALUES
  ('Georgia', 'GA'), ('Texas', 'TX'), ('Louisiana', 'LA'), ('Maryland', 'MD'),
  ('District of Columbia', 'DC'), ('California', 'CA'), ('Illinois', 'IL');

INSERT INTO cities (id, name, slug, state_id, metro_area, latitude, longitude) VALUES
  ('${ATL}',  'Atlanta',     'atlanta-ga',     (SELECT id FROM states WHERE code = 'GA'), 'Atlanta–Sandy Springs–Roswell, GA', 33.75, -84.39),
  ('${HOU}',  'Houston',     'houston-tx',     (SELECT id FROM states WHERE code = 'TX'), 'Houston–The Woodlands–Sugar Land, TX', 29.76, -95.37),
  ('${NOLA}', 'New Orleans', 'new-orleans-la', (SELECT id FROM states WHERE code = 'LA'), 'New Orleans–Metairie, LA', 29.95, -90.07),
  ('${DC}',   'Washington',  'washington-dc',  (SELECT id FROM states WHERE code = 'DC'), 'Washington–Arlington–Alexandria, DC-VA-MD', 38.91, -77.04),
  ('${LAX}',  'Los Angeles', 'los-angeles-ca', (SELECT id FROM states WHERE code = 'CA'), 'Los Angeles–Long Beach–Anaheim, CA', 34.05, -118.24);

INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${AG}',     'Agriculture & Sustainability', 'agriculture-sustainability', NULL),
  ('${FARMS}',  'Farms & Farm Stands',          'farms-farm-stands',          '${AG}'),
  ('${BARBER}', 'Barber Shops',                 'barber-shops',               NULL),
  ('${FOOD}',   'Food & Dining',                'food-dining',                NULL);

INSERT INTO listings (id, name, tagline, category_id, city_id) VALUES
  ('${HAMPTON_FARM}',  'Swanson Family Farm', 'Pasture-raised eggs',  '${FARMS}',  '${ATL}'),
  ('${MARLBORO_FARM}', 'Kimbleland Acres',    'Heirloom produce',     '${FARMS}',  '${DC}'),
  ('${MISSOURI_FARM}', 'Ad Astra Growers',    'Microgreens weekly',   '${FARMS}',  '${HOU}'),
  ('${NOLA_FARM}',     'Barcelo Gardens',     'Urban garden plots',   '${FARMS}',  '${NOLA}'),
  ('${ATL_BARBER}',    'Fresh Cutz',          'Fades and lineups',    '${BARBER}', '${ATL}'),
  ('${HOU_BARBER}',    'Third Ward Cuts',     'Classic cuts',         '${BARBER}', '${HOU}'),
  ('${ATL_GRILL}',     'Avenue Grill',        'Soul food since 1944', '${FOOD}',   '${ATL}'),
  ('${PEACH}',         'Georgia Peach Bakery','Cobbler and pies',     '${FOOD}',   '${HOU}'),
  ('${LA_SHOP}',       'Crenshaw Plates',     'Plate lunches',        '${FOOD}',   '${LAX}');

INSERT INTO listing_details_business (listing_id, description, city_text, state, zip) VALUES
  ('${HAMPTON_FARM}',  'Family farm.',     'Hampton',        'GA', '30228'),
  ('${MARLBORO_FARM}', 'Family farm.',     'Upper Marlboro', 'MD', '20772'),
  ('${MISSOURI_FARM}', 'Indoor farm.',     'Missouri City',  'TX', '77459-1234'),
  ('${NOLA_FARM}',     'Community farm.',  'New Orleans',    'LA', '70117');
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
  exec(url, SEED)
}

function current(url: string) {
  previous(url)
  applyFile(url, MIGRATION)
}

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Ids search_listings_faceted returns for q, in relevance order. */
function search(url: string, q: string, categoryId?: string): string[] {
  const args = [`p_q => ${sqlText(q)}`, "p_sort => 'relevance'", 'p_limit => 50', 'p_offset => 0']
  if (categoryId) args.push(`p_category_id => '${categoryId}'`)
  return query<{ id: string }>(url, `SELECT id FROM search_listings_faceted(${args.join(', ')})`).map(
    (r) => r.id
  )
}

const sorted = (ids: string[]) => [...ids].sort()

/**
 * facet_counts' cell rows for q. Cells ignore the category filter on purpose
 * (they feed the type shortcuts), so pass `categories` to count only the cells
 * the shopper's filter would show.
 */
function cellTotal(url: string, q: string, categories?: string[]): number {
  return query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(p_q => ${sqlText(q)}) WHERE facet_kind = 'cell'`
  )
    .filter((r) => !categories || categories.includes(r.facet_key.split('|')[1] ?? ''))
    .reduce((n, r) => n + Number(r.facet_count), 0)
}

const union = (a: string[], b: string[]) => sorted([...new Set([...a, ...b])])

// Every place search the founder's report stands for, with the rows that are
// IN that place. Short queries ("GA", "LA") also pick up trigram look-alikes
// ("Gardens", "Growers") that matched before this migration too; tightening
// those is PR D's job, so case 2 asserts after = before + these rows.
const PLACE_CASES: Array<[string, string[]]> = [
  // state names
  ['Georgia', [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]],
  ['Texas', [MISSOURI_FARM, HOU_BARBER, PEACH]],
  ['Louisiana', [NOLA_FARM]],
  ['Maryland', [MARLBORO_FARM]],
  ['District of Columbia', [MARLBORO_FARM]],
  ['California', [LA_SHOP]],
  // state codes
  ['GA', [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]],
  ['TX', [MISSOURI_FARM, HOU_BARBER, PEACH]],
  ['MD', [MARLBORO_FARM]],
  // cities, with and without the state
  ['Atlanta', [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]],
  ['Houston', [MISSOURI_FARM, HOU_BARBER, PEACH]],
  ['New Orleans', [NOLA_FARM]],
  ['Washington', [MARLBORO_FARM]],
  ['Washington, DC', [MARLBORO_FARM]],
  ['Houston, TX', [MISSOURI_FARM, HOU_BARBER, PEACH]],
  // towns in city_text
  ['Hampton', [HAMPTON_FARM]],
  ['Upper Marlboro', [MARLBORO_FARM]],
  ['Missouri City', [MISSOURI_FARM]],
  // nicknames
  ['ATL', [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]],
  ['NOLA', [NOLA_FARM]],
  ['HTX', [MISSOURI_FARM, HOU_BARBER, PEACH]],
  ['DC', [MARLBORO_FARM]],
  ['D.C.', [MARLBORO_FARM]],
  ['DMV', [MARLBORO_FARM]],
  ['LA', [NOLA_FARM, LA_SHOP]], // Los Angeles AND Louisiana
  // ZIP, including a ZIP+4 stored as typed
  ['30228', [HAMPTON_FARM]],
  ['77459', [MISSOURI_FARM]],
  // metro
  ['Atlanta metro', [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]],
]

describe.skipIf(!DB_REACHABLE)('migration: 20261010000000_search_places', () => {
  it('1. Agriculture filter + "Georgia" is 0 before and the Georgia farm after', async () => {
    await withScratchDb('places_reported', (url) => {
      previous(url)
      expect(search(url, 'Georgia', AG), 'the bug: no place words in the index').toEqual([])
      expect(cellTotal(url, 'Georgia', [AG, FARMS])).toBe(0)

      applyFile(url, MIGRATION)
      expect(search(url, 'Georgia', AG)).toEqual([HAMPTON_FARM])
      expect(search(url, 'Georgia', FARMS), 'the child category too').toEqual([HAMPTON_FARM])
      expect(cellTotal(url, 'Georgia', [AG, FARMS]), 'the type shortcut agrees').toBe(1)
      // The founder's "similar cases": the other states under the same filter.
      expect(search(url, 'Texas', AG)).toEqual([MISSOURI_FARM])
      expect(search(url, 'Maryland', AG)).toEqual([MARLBORO_FARM])
      expect(search(url, 'Louisiana', AG)).toEqual([NOLA_FARM])
      expect(search(url, 'California', AG), 'no LA farm, and that is right').toEqual([])
    })
  })

  it('2. every kind of place finds its listings, and only adds those', async () => {
    await withScratchDb('places_kinds', (url) => {
      previous(url)
      const before = new Map(PLACE_CASES.map(([q]) => [q, search(url, q)]))
      applyFile(url, MIGRATION)

      for (const [q, want] of PLACE_CASES) {
        const was = before.get(q) ?? []
        const now = search(url, q)
        expect(sorted(now), `"${q}" = what it found before + the rows in that place`).toEqual(
          union(was, want)
        )
        expect(cellTotal(url, q), `facet_counts "${q}"`).toBe(now.length)
      }

      // The bakery NAMED Georgia sits in Houston. "Georgia" must still find it
      // (name), and "Texas" finds it through its city.
      expect(search(url, 'Georgia')).toContain(PEACH)
    })
  }, 60_000)

  it('3. topic + place: the right row, ranked above look-alikes', async () => {
    await withScratchDb('places_topic', (url) => {
      previous(url)
      const cases: Array<[string, string, string?]> = [
        ['farm georgia', HAMPTON_FARM],
        ['farms in georgia', HAMPTON_FARM],
        ['farm texas', MISSOURI_FARM, AG],
        ['barber houston', HOU_BARBER],
        ['soul food atlanta', ATL_GRILL],
      ]
      // Some of these already matched a look-alike before ("farm" is close to
      // "Farms & Farm Stands"), ranked by trigram score at best. Case 1 proves
      // the miss; here the place match must land on top.
      const before = cases.map(([q, , cat]) => search(url, q, cat))

      applyFile(url, MIGRATION)
      for (const [i, [q, want, cat]] of cases.entries()) {
        const now = search(url, q, cat)
        expect(now[0], `"${q}" puts the place match first`).toBe(want)
        expect(sorted(now), `"${q}" adds only that row`).toEqual(union(before[i] ?? [], [want]))
      }

      // A topic in one place does not pull in another place's rows.
      // (The Atlanta barber can still trail as a trigram look-alike of
      // "Barber Shops", as it did before; the union above holds it to that.)
      expect(search(url, 'soul food atlanta')).not.toContain(PEACH)
      expect(search(url, 'barber houston', AG), 'the filter still applies').not.toContain(HOU_BARBER)
    })
  })

  it('4. a place-only hit never outranks a name hit', async () => {
    await withScratchDb('places_rank', (url) => {
      current(url)
      expect(search(url, 'Georgia')[0], 'the bakery NAMED Georgia comes first').toBe(PEACH)
    })
  })

  it('5. the prefix query stays on name, tagline and category', async () => {
    await withScratchDb('places_prefix', (url) => {
      current(url)
      // "geo" would prefix-match the D-weight word "georgia" on every Atlanta
      // row if the prefix query looked at D. It must not.
      const ids = search(url, 'geo')
      for (const id of [HAMPTON_FARM, ATL_BARBER, ATL_GRILL]) {
        expect(ids, 'a place word is not a prefix target').not.toContain(id)
      }
    })
  })

  it('6. new, moved and renamed places re-index on their own', async () => {
    await withScratchDb('places_triggers', (url) => {
      current(url)

      // A new listing, then its details row, the way createListing writes them.
      const NEW = '10000000-0000-0000-0000-0000000000aa'
      exec(
        url,
        `INSERT INTO listings (id, name, category_id, city_id)
           VALUES ('${NEW}', 'Bloom Ranch', '${FARMS}', '${HOU}');
         INSERT INTO listing_details_business (listing_id, city_text, state, zip)
           VALUES ('${NEW}', 'Acres Homes', 'TX', '77088');`
      )
      // "Kimbleland Acres" is a trigram look-alike; the town match ranks first.
      expect(search(url, 'Acres Homes')[0]).toBe(NEW)
      expect(search(url, '77088')).toEqual([NEW])

      // The farm moves town: the old town stops matching, the new one starts.
      exec(
        url,
        `UPDATE listing_details_business SET city_text = 'Stockbridge', zip = '30281'
          WHERE listing_id = '${HAMPTON_FARM}';`
      )
      expect(search(url, 'Hampton')).not.toContain(HAMPTON_FARM)
      expect(search(url, '30228')).toEqual([])
      expect(search(url, 'Stockbridge')).toEqual([HAMPTON_FARM])
      expect(search(url, '30281')).toEqual([HAMPTON_FARM])

      // A city is renamed: every listing in it follows.
      exec(url, `UPDATE cities SET name = 'Hotlanta' WHERE id = '${ATL}';`)
      expect(sorted(search(url, 'Hotlanta'))).toEqual(sorted([HAMPTON_FARM, ATL_BARBER, ATL_GRILL]))

      // A state is renamed: listings linked through a city AND through
      // listing_details_business.state both follow.
      exec(url, `UPDATE states SET name = 'Tejas' WHERE code = 'TX';`)
      expect(sorted(search(url, 'Tejas'))).toEqual(
        sorted([MISSOURI_FARM, HOU_BARBER, PEACH, NEW])
      )
    })
  }, 60_000)

  it('7. re-applying changes nothing', async () => {
    await withScratchDb('places_idempotent', (url) => {
      current(url)
      const vectors = () =>
        query<{ id: string; v: string }>(url, 'SELECT id, search_vector::text AS v FROM listings ORDER BY id')
      const before = vectors()
      applyFile(url, MIGRATION)
      expect(vectors()).toEqual(before)
      expect(
        query<{ n: number }>(url, 'SELECT count(*)::int AS n FROM listings WHERE search_vector IS NULL')
      ).toEqual([{ n: 0 }])
    })
  })
})
