/**
 * 20260924000000_type_shortcuts_relevance.sql, run against a scratch database.
 *
 * Three defects the founder reported on /discover [Observed — founder, 2026-09-24]:
 *
 *   1. The Restaurants, Services, Professionals and Creatives shortcuts return
 *      zero. Every imported listing is entity_type 'business', so a filter on
 *      entity_type alone can never match them. The fix passes the mapped
 *      category ids and location types in as arguments.
 *   2. "photographer" puts a featured restaurant first. is_featured sat above
 *      match strength, and a description-only mention of "Photographs" was
 *      enough to be retrieved. The fix: with a term, match band leads and
 *      featured only breaks ties inside a band. Browsing is unchanged.
 *   3. english stemming turns "photographer" into 'photograph' and
 *      "photography" into 'photographi', so a studio named "... Photography"
 *      was only a weak trigram hit. search_prefix_tsquery closes that gap on
 *      the name, tagline and category (weights A and B) only.
 *
 * Chain: search-recall.test.ts's production chain, then 20260923000000 (which
 * activity-score.test.ts covers), then the migration under test. The FIXTURE is
 * activity-score.test.ts's, verbatim, because 20260923000000 needs its extra
 * tables and columns.
 *
 * Like every test in tests/migrations/, this runs only against a LOCAL scratch
 * database. It creates and drops `migtest_*` databases.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, withScratchDb } from './helpers'
import {
  expandTypeCategoryIds,
  parseCellKey,
  rollupCells,
  type FacetCell,
} from '@/lib/listings/type-shortcuts'

const VECTOR_BASE = path.join(MIGRATIONS_DIR, '20260601000000_extend_search_vector.sql')
const RPC_BASE = path.join(MIGRATIONS_DIR, '20260622000001_search_listings_faceted_rpc.sql')
const SECDEF = path.join(MIGRATIONS_DIR, '20260701000000_fix_search_vector_security_definer.sql')
const OWNERSHIP = path.join(MIGRATIONS_DIR, '20260707000000_listings_ownership_label.sql')
const TIEBREAK = path.join(MIGRATIONS_DIR, '20260809000000_search_tier_tiebreak.sql')
const RADIUS = path.join(MIGRATIONS_DIR, '20260811010000_search_radius_filter.sql')
const LOCTYPES = path.join(MIGRATIONS_DIR, '20260904000000_search_location_types.sql')
const RECALL = path.join(MIGRATIONS_DIR, '20260922000000_search_recall.sql')
const ACTIVITY = path.join(MIGRATIONS_DIR, '20260923000000_activity_ranking.sql')
const MIGRATION = path.join(MIGRATIONS_DIR, '20260924000000_type_shortcuts_relevance.sql')

const SEARCH_17 =
  'text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text, double precision, double precision, double precision, text, integer, integer'
const SEARCH_19 = `${SEARCH_17}, uuid[], text[]`
const COUNTS_13 =
  'text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, double precision, double precision, double precision'
const COUNTS_15 = `${COUNTS_13}, uuid[], text[]`

// activity-score.test.ts's FIXTURE, verbatim.
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

// Deterministic ids so assertions read clearly.
const FOOD_DINING = 'aaaaaaaa-0000-0000-0000-000000000001'
const RESTAURANTS = 'aaaaaaaa-0000-0000-0000-000000000002'
const PHOTO_VIDEO = 'aaaaaaaa-0000-0000-0000-000000000003'
const HEALTHCARE = 'aaaaaaaa-0000-0000-0000-000000000004'
const DENTISTS = 'aaaaaaaa-0000-0000-0000-000000000005'
const HOME = 'aaaaaaaa-0000-0000-0000-000000000006'

const STUDIO = '11111111-1111-1111-1111-111111111111'
const FEATURED_STUDIO = '22222222-2222-2222-2222-222222222222'
const GRILL = '33333333-3333-3333-3333-333333333333'
const BAKERY = '44444444-4444-4444-4444-444444444444'
const MIDTOWN = '55555555-5555-5555-5555-555555555555'
const WOODLAWN = '66666666-6666-6666-6666-666666666666'
const EVENT = '77777777-7777-7777-7777-777777777777'
const SERVICE = '88888888-8888-8888-8888-888888888888'

// The production shape of the photographer defect [Observed — founder,
// 2026-09-24]: a FEATURED restaurant with a large save_count whose only link to
// photography is one word in its description, next to real studios.
//
// GRILL is filed under the Restaurants CHILD of food-dining, so the Restaurants
// shortcut only finds it if the mapped parent brings its children.
// save_count fights every ordering assertion: GRILL has the most saves, and the
// unfeatured STUDIO outsaves the featured one.
//
// MIDTOWN / WOODLAWN are search-recall.test.ts's dentist regression: one filed
// under Dentists, one left on the Healthcare parent.
//
// Every slug a type maps to is the real seed slug (lib/listings/type-shortcuts.ts),
// so expandTypeCategoryIds runs against these rows unchanged.
const SEED = `
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${FOOD_DINING}', 'Food & Dining',             'food-dining',             NULL),
  ('${RESTAURANTS}', 'Restaurants',               'restaurants',             '${FOOD_DINING}'),
  ('${PHOTO_VIDEO}', 'Photography & Videography', 'photography-videography', NULL),
  ('${HEALTHCARE}',  'Healthcare',                'healthcare',              NULL),
  ('${DENTISTS}',    'Dentists',                  'dentists',                '${HEALTHCARE}'),
  ('${HOME}',        'Home Services',             'home-services',           NULL);

INSERT INTO listings (id, name, tagline, category_id, save_count, is_featured, entity_type, location_type) VALUES
  ('${STUDIO}',          'Lens and Light Photography', 'Portraits and weddings', '${PHOTO_VIDEO}', 50,  false, 'business', NULL),
  ('${FEATURED_STUDIO}', 'Northside Photography',      'Headshots on location',  '${PHOTO_VIDEO}',  0,  true,  'business', NULL),
  ('${GRILL}',           'Avenue Grill',               'Soul food since 1944',   '${RESTAURANTS}', 500, true,  'business', NULL),
  ('${BAKERY}',          'Sweet Auburn Bakery',        'Cakes and coffee',       '${FOOD_DINING}', 90,  false, 'business', NULL),
  ('${MIDTOWN}',         'Midtown Dental Center',      'Gentle care downtown',   '${DENTISTS}',    10,  false, 'business', NULL),
  ('${WOODLAWN}',        'Woodlawn Dental Gallery',    'Smiles on the south',    '${HEALTHCARE}',  30,  false, 'business', NULL),
  ('${EVENT}',           'Juneteenth Block Party',     'Music and vendors',      '${HOME}',         5,  false, 'event',    NULL),
  ('${SERVICE}',         'Reliable Home Repair',       'Handyman visits',        '${HOME}',         2,  false, 'business', 'service_area');

INSERT INTO listing_details_business (listing_id, description, price_range) VALUES
  ('${STUDIO}',          'Family and event sessions.',                         '$$'),
  ('${FEATURED_STUDIO}', 'Corporate sessions.',                                '$$$'),
  ('${GRILL}',           'Photographs of the old neighborhood line the walls.','$$'),
  ('${BAKERY}',          'Layer cakes baked daily.',                           '$'),
  ('${MIDTOWN}',         'Cleanings, crowns and implants.',                    '$$'),
  ('${WOODLAWN}',        'Family practice since 1998.',                        '$$$'),
  ('${SERVICE}',         'Repairs at your door.',                              '$$');
`

const CATEGORY_NODES = [
  { id: FOOD_DINING, slug: 'food-dining', parent_id: null },
  { id: RESTAURANTS, slug: 'restaurants', parent_id: FOOD_DINING },
  { id: PHOTO_VIDEO, slug: 'photography-videography', parent_id: null },
  { id: HEALTHCARE, slug: 'healthcare', parent_id: null },
  { id: DENTISTS, slug: 'dentists', parent_id: HEALTHCARE },
  { id: HOME, slug: 'home-services', parent_id: null },
]

/** The state production is in before this migration: the full chain through 20260923. */
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
  exec(url, SEED)
}

function current(url: string) {
  previous(url)
  applyFile(url, MIGRATION)
}

const sqlText = (v: string | null | undefined): string =>
  v === undefined || v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`

const uuidArray = (ids: readonly string[] | undefined): string =>
  ids === undefined ? 'NULL' : `ARRAY[${ids.map((i) => `'${i}'`).join(',')}]::uuid[]`

const textArray = (vals: readonly string[] | undefined): string =>
  vals === undefined ? 'NULL' : `ARRAY[${vals.map((v) => `'${v}'`).join(',')}]::text[]`

interface SearchOpts {
  q?: string | null
  sort?: string
  categoryId?: string
  entityType?: string
  typeCategoryIds?: readonly string[]
  typeLocationTypes?: readonly string[]
}

/** Named args only, and the two new keys only when given, exactly as rpcArgs() sends them. */
function namedArgs(opts: SearchOpts): string[] {
  const args = [`p_q => ${sqlText(opts.q)}`]
  if (opts.categoryId) args.push(`p_category_id => '${opts.categoryId}'`)
  if (opts.entityType) args.push(`p_entity_type => '${opts.entityType}'`)
  if (opts.typeCategoryIds) args.push(`p_type_category_ids => ${uuidArray(opts.typeCategoryIds)}`)
  if (opts.typeLocationTypes) {
    args.push(`p_type_location_types => ${textArray(opts.typeLocationTypes)}`)
  }
  return args
}

/** Call search_listings_faceted and return ids in the order produced. */
function search(url: string, opts: SearchOpts = {}): string[] {
  return searchRows(url, opts).map((r) => r.id)
}

function searchRows(url: string, opts: SearchOpts = {}): { id: string; total_count: string }[] {
  const args = [
    ...namedArgs(opts),
    `p_sort => '${opts.sort ?? 'relevance'}'`,
    'p_limit => 24',
    'p_offset => 0',
  ]
  return query<{ id: string; total_count: string }>(
    url,
    `SELECT id, total_count FROM search_listings_faceted(${args.join(', ')})`
  )
}

/** facet_counts rows of one kind, as { key -> count }. */
function facetRows(url: string, kind: string, opts: SearchOpts = {}): Record<string, number> {
  const rows = query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(${namedArgs(opts).join(', ')})
      WHERE facet_kind = '${kind}'`
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.facet_key] = Number(r.facet_count)
  return out
}

function cells(url: string, opts: SearchOpts = {}): FacetCell[] {
  return Object.entries(facetRows(url, 'cell', opts))
    .map(([key, n]) => parseCellKey(key, n))
    .filter((c): c is FacetCell => c !== null)
}

/** Every live signature of a function, reduced to bare types. */
function identityTypes(url: string, fn: string): string[] {
  return query<{ args: string }>(
    url,
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = '${fn}' AND n.nspname = 'public'
      ORDER BY 1`
  ).map((r) =>
    r.args
      .split(', ')
      .map((param) => param.replace(/^\w+\s+/, ''))
      .join(', ')
  )
}

function prefixQuery(url: string, q: string): string | null {
  const rows = query<{ tsq: string | null }>(
    url,
    `SELECT search_prefix_tsquery(${sqlText(q)}, 'AB')::text AS tsq`
  )
  return rows[0]?.tsq ?? null
}

/** One PART of an earlier migration, cut at its `-- PART n —` banner. */
function partOf(file: string, from: number, to: number): string {
  const sql = fs.readFileSync(file, 'utf8')
  const start = sql.search(new RegExp(`^-- PART ${from} —`, 'm'))
  const end = sql.search(new RegExp(`^-- PART ${to} —`, 'm'))
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`PART ${from}..${to} not found in ${path.basename(file)}`)
  }
  return sql.slice(start, end)
}

function applySql(url: string, name: string, sql: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migtest-'))
  const file = path.join(dir, name)
  fs.writeFileSync(file, sql)
  try {
    applyFile(url, file)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const RESTAURANT_IDS = expandTypeCategoryIds('restaurant', CATEGORY_NODES)
const SERVICE_LOCATIONS = ['virtual', 'service_area', 'national', 'traveling']

describe.skipIf(!DB_REACHABLE)('20260924000000_type_shortcuts_relevance', () => {
  it('0. search_prefix_tsquery builds the weighted prefix query, and stands down on operators', async () => {
    await withScratchDb('tsr_prefix', async (url) => {
      current(url)
      // Both spellings reach the same stem. This is defect 3.
      expect(prefixQuery(url, 'photographer')).toBe("'photograph':*AB")
      expect(prefixQuery(url, 'photography')).toBe("'photograph':*AB")
      // Under four characters, no prefix: 'art' must not match 'artichoke'.
      expect(prefixQuery(url, 'art')).toBe("'art':AB")
      // websearch syntax is left to websearch_to_tsquery alone.
      expect(prefixQuery(url, '"soul food"')).toBeNull()
      expect(prefixQuery(url, 'food -soul')).toBeNull()
      expect(prefixQuery(url, 'cakes OR pies')).toBeNull()
      expect(prefixQuery(url, '')).toBeNull()
      // Stopwords only: nothing to search for.
      expect(prefixQuery(url, 'the')).toBeNull()
    })
  })

  it("1. 'photographer' and 'photography' put a photography listing first, not the restaurant", async () => {
    await withScratchDb('tsr_photographer', async (url) => {
      previous(url)
      // The defect, reproduced on the chain production runs today.
      const before = search(url, { q: 'photographer' })
      expect(before[0]).toBe(GRILL)

      applyFile(url, MIGRATION)
      for (const q of ['photographer', 'photography']) {
        const after = search(url, { q })
        expect([STUDIO, FEATURED_STUDIO]).toContain(after[0])
        expect(after.slice(0, 2).sort()).toEqual([STUDIO, FEATURED_STUDIO].sort())
      }
    })
  })

  it('2. with a term, match band leads and featured only breaks ties inside a band', async () => {
    await withScratchDb('tsr_band', async (url) => {
      current(url)
      // Band 20: both studios (name + category). Band 10: GRILL (description only).
      // Inside band 20 the featured studio leads despite 50 fewer saves; the
      // featured, most-saved GRILL still lands below the unfeatured STUDIO.
      expect(search(url, { q: 'photographer' })).toEqual([FEATURED_STUDIO, STUDIO, GRILL])
    })
  })

  it('3. browsing with no term, or with a non-relevance sort, still puts featured first', async () => {
    await withScratchDb('tsr_browse', async (url) => {
      current(url)
      const browse = search(url, {})
      expect(browse.slice(0, 2).sort()).toEqual([FEATURED_STUDIO, GRILL].sort())
      const newest = search(url, { q: 'photographer', sort: 'newest' })
      expect(newest.slice(0, 2).sort()).toEqual([FEATURED_STUDIO, GRILL].sort())
    })
  })

  it('4. mapped ids reach business listings in a child category; unmapped types stay exact', async () => {
    await withScratchDb('tsr_types', async (url) => {
      current(url)
      expect(RESTAURANT_IDS.sort()).toEqual([FOOD_DINING, RESTAURANTS].sort())

      // The defect: entity_type alone finds nothing.
      expect(search(url, { entityType: 'restaurant' })).toEqual([])
      // The fix: GRILL sits in the Restaurants CHILD and is still found.
      expect(
        search(url, { entityType: 'restaurant', typeCategoryIds: RESTAURANT_IDS }).sort()
      ).toEqual([BAKERY, GRILL].sort())
      // Services is the location-type axis.
      expect(
        search(url, { entityType: 'service_provider', typeLocationTypes: SERVICE_LOCATIONS })
      ).toEqual([SERVICE])
      // Unmapped types still mean exactly their entity_type.
      expect(search(url, { entityType: 'event' })).toEqual([EVENT])
      // A parent category includes its children.
      expect(search(url, { categoryId: FOOD_DINING }).sort()).toEqual([BAKERY, GRILL].sort())
      // Type and term compose.
      expect(
        search(url, { q: 'cakes', entityType: 'restaurant', typeCategoryIds: RESTAURANT_IDS })
      ).toEqual([BAKERY])
    })
  })

  it('5. old-keys-only calls resolve, with exactly one overload of each function', async () => {
    await withScratchDb('tsr_signatures', async (url) => {
      current(url)
      expect(identityTypes(url, 'search_listings_faceted')).toEqual([SEARCH_19])
      expect(identityTypes(url, 'facet_counts')).toEqual([COUNTS_15])
      // What the deployed code sends today: no type keys at all.
      expect(search(url, { q: 'dental' }).sort()).toEqual([MIDTOWN, WOODLAWN].sort())
      expect(facetRows(url, 'price', { q: 'dental' })).toEqual({ $$: 1, $$$: 1 })
    })
  })

  it('6. the cells add up to total_count, and the TypeScript rollup agrees with the SQL', async () => {
    await withScratchDb('tsr_cells', async (url) => {
      current(url)
      for (const q of [null, 'photographer', 'dental']) {
        const rows = searchRows(url, { q })
        const total = Number(rows[0]?.total_count ?? 0)
        const sum = cells(url, { q }).reduce((n, c) => n + c.count, 0)
        expect(sum).toBe(total)
      }

      // The sidebar number for a type is the number the result list shows when
      // that type is picked. One mapping, two implementations, same answer.
      const all = cells(url)
      const rolled = rollupCells(all, CATEGORY_NODES, {
        types: ['restaurant', 'service_provider', 'event', 'business'],
      })
      const restaurantTotal = Number(
        searchRows(url, { entityType: 'restaurant', typeCategoryIds: RESTAURANT_IDS })[0]
          ?.total_count ?? 0
      )
      expect(rolled.type.restaurant).toBe(restaurantTotal)
      expect(rolled.type.service_provider).toBe(1)
      expect(rolled.type.event).toBe(1)
      expect(rolled.type.business).toBe(7)
      // A parent counts itself plus its children.
      expect(rolled.category['food-dining']).toBe(2)
      expect(rolled.category.healthcare).toBe(2)
      expect(rolled.category.dentists).toBe(1)
    })
  })

  it('7. the q, category and type predicates are textually identical in both functions', () => {
    const code = fs
      .readFileSync(MIGRATION, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    const patterns = [
      /\(\s*p_q IS NULL OR p_q = ''[\s\S]*?coalesce\(cat\.name, ''\)\) > 0\.3\s*\)/g,
      /\(\s*p_category_id IS NULL[\s\S]*?cat\.parent_id = p_category_id\s*\)/g,
      /\(\s*p_entity_type IS NULL[\s\S]*?ANY \(p_type_location_types\)\s*\)/g,
    ]
    for (const re of patterns) {
      const hits = code.match(re) ?? []
      expect(hits).toHaveLength(2)
      expect(hits[0]).toBe(hits[1])
    }
  })

  it('8. regressions: dentist recall holds, and precision does not flood', async () => {
    await withScratchDb('tsr_regressions', async (url) => {
      current(url)
      expect(search(url, { q: 'dentist' }).sort()).toEqual([MIDTOWN, WOODLAWN].sort())
      expect(search(url, { q: 'dentist' })).not.toContain(BAKERY)
      expect(search(url, { q: 'bakery' })).toEqual([BAKERY])
      expect(search(url, { q: 'plumbing' })).toEqual([])
      // A weight-C mention is still recall, just ranked last.
      expect(search(url, { q: 'neighborhood' })).toEqual([GRILL])
    })
  })

  it('9. re-applying is idempotent, and the documented down plan restores the previous state', async () => {
    await withScratchDb('tsr_down_plan', async (url) => {
      current(url)
      const once = search(url, { q: 'photographer' })
      applyFile(url, MIGRATION)
      expect(identityTypes(url, 'search_listings_faceted')).toEqual([SEARCH_19])
      expect(identityTypes(url, 'facet_counts')).toEqual([COUNTS_15])
      expect(search(url, { q: 'photographer' })).toEqual(once)

      // The header's DOWN PLAN, in order.
      exec(
        url,
        `DROP FUNCTION IF EXISTS search_listings_faceted(${SEARCH_19});
         DROP FUNCTION IF EXISTS facet_counts(${COUNTS_15});`
      )
      applySql(url, 'activity_part6.sql', partOf(ACTIVITY, 6, 7))
      applySql(url, 'recall_part3.sql', partOf(RECALL, 3, 4))
      exec(
        url,
        `DROP FUNCTION IF EXISTS search_prefix_tsquery(text, text);
         NOTIFY pgrst, 'reload schema';`
      )

      expect(identityTypes(url, 'search_listings_faceted')).toEqual([SEARCH_17])
      expect(identityTypes(url, 'facet_counts')).toEqual([COUNTS_13])
      expect(identityTypes(url, 'search_prefix_tsquery')).toEqual([])
      // Back to featured-first, which is what a rollback is supposed to mean.
      expect(search(url, { q: 'photographer' })[0]).toBe(GRILL)
      expect(search(url, { q: 'dentist' }).sort()).toEqual([MIDTOWN, WOODLAWN].sort())
      expect(facetRows(url, 'price', { q: 'dental' })).toEqual({ $$: 1, $$$: 1 })
    })
  })
})
