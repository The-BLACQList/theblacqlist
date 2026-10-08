/**
 * 20261008010000_creator_entity.sql, run against a scratch database.
 *
 * Ticket 131 [Decision — founder, 2026-10-08]: creators are their own listing
 * type, "easy to find as a group", with niche as a filter under them, and an
 * "open to partnerships" switch both businesses and creators can turn on.
 *
 * What each case protects:
 *   1. entity_type CHECK     -> 'creator' was refused before and is accepted
 *                               after; an unknown type is still refused.
 *   2. Featured bucket CHECK -> a creator can win the weekly award. Without it
 *                               award_weekly_featured would fail on the insert.
 *   3. Categories            -> one Creators parent with five format children,
 *                               linked by slug, ids matching seed.sql.
 *   4. Filter groups         -> three groups that show for creators only, with
 *                               the value counts seed.sql mirrors.
 *   5. open_to_partnerships  -> NOT NULL DEFAULT false, so every existing page
 *                               starts off; no listing row is rewritten.
 *   6. Partners filter       -> p_open_to_partnerships = true keeps only pages
 *                               with the switch on, in both search functions.
 *   7. Old callers           -> code that never sends the new key gets exactly
 *                               the results it got before, and only the new
 *                               signatures remain.
 *   8. Idempotency           -> re-applying changes nothing. Migrations here
 *                               get pasted into the SQL editor more than once.
 *
 * Chain: type-shortcuts-relevance.test.ts's production chain through
 * 20260924000000 (the last migration to touch the search functions), plus the
 * columns, indexes and featured_awards table this migration writes to. The
 * FIXTURE is that test's, verbatim.
 *
 * Like every test in tests/migrations/, this runs only against a LOCAL scratch
 * database. It creates and drops `migtest_*` databases.
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from './helpers'

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
const MIGRATION = path.join(MIGRATIONS_DIR, '20261008010000_creator_entity.sql')

const SEARCH_19 =
  'text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text, double precision, double precision, double precision, text, integer, integer, uuid[], text[]'
const SEARCH_20 = `${SEARCH_19}, boolean`
const COUNTS_15 =
  'text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, double precision, double precision, double precision, uuid[], text[]'
const COUNTS_16 = `${COUNTS_15}, boolean`

// type-shortcuts-relevance.test.ts's FIXTURE, verbatim.
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

const FOOD = 'aaaaaaaa-0000-0000-0000-000000000001'
const BAKERY = '11111111-1111-1111-1111-111111111111'
const GRILL = '22222222-2222-2222-2222-222222222222'
const SPONSOR = '33333333-3333-3333-3333-333333333333'

// Three published food pages. The migration runs with them in place, so case 5
// sees what an existing page looks like after it.
const SEED = `
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${FOOD}', 'Food & Dining', 'food-dining', NULL);

INSERT INTO listings (id, name, tagline, category_id, entity_type) VALUES
  ('${BAKERY}',  'Sweet Auburn Bakery', 'Cakes and coffee',      '${FOOD}', 'business'),
  ('${GRILL}',   'Avenue Grill',        'Soul food since 1944',  '${FOOD}', 'business'),
  ('${SPONSOR}', 'Peach State Coffee',  'Roasted on Auburn Ave', '${FOOD}', 'business');
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
  exec(url, SEED)
}

function current(url: string) {
  previous(url)
  applyFile(url, MIGRATION)
}

/** Ids search_listings_faceted returns, sorted, with the partners key only when given. */
function search(url: string, partners?: boolean): string[] {
  const args = ['p_q => NULL', "p_sort => 'newest'", 'p_limit => 24', 'p_offset => 0']
  if (partners !== undefined) args.push(`p_open_to_partnerships => ${partners}`)
  return query<{ id: string }>(url, `SELECT id FROM search_listings_faceted(${args.join(', ')})`)
    .map((r) => r.id)
    .sort()
}

/** facet_counts' cell rows add up to every matching page, each in one cell. */
function cellTotal(url: string, partners?: boolean): number {
  const args = ['p_q => NULL']
  if (partners !== undefined) args.push(`p_open_to_partnerships => ${partners}`)
  return query<{ facet_count: string }>(
    url,
    `SELECT facet_count FROM facet_counts(${args.join(', ')}) WHERE facet_kind = 'cell'`
  ).reduce((n, r) => n + Number(r.facet_count), 0)
}

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

const ALL = [BAKERY, GRILL, SPONSOR].sort()

describe.skipIf(!DB_REACHABLE)('migration: 20261008010000_creator_entity', () => {
  it("1. accepts entity_type = 'creator', which the old CHECK refused", async () => {
    await withScratchDb('creator_check', (url) => {
      previous(url)
      const insert = (t: string) =>
        `INSERT INTO listings (name, entity_type) VALUES ('${t} page', '${t}');`

      expect(raises(url, insert('creator')), "the old CHECK should refuse 'creator'").toBe(true)

      applyFile(url, MIGRATION)

      exec(url, insert('creator'))
      for (const t of [
        'business',
        'restaurant',
        'service_provider',
        'professional',
        'creative',
        'vendor',
        'event',
        'job',
      ]) {
        exec(url, insert(t))
      }
      expect(raises(url, insert('spaceship'))).toBe(true)
    })
  })

  it('2. lets a creator win the weekly Featured award', async () => {
    await withScratchDb('creator_bucket', (url) => {
      previous(url)
      const award = `INSERT INTO featured_awards (week_start, bucket, listing_id, score)
                       VALUES ('2026-10-05', 'creator', '${BAKERY}', 7);`

      expect(raises(url, award)).toBe(true)
      applyFile(url, MIGRATION)
      exec(url, award)

      expect(
        raises(
          url,
          `INSERT INTO featured_awards (week_start, bucket, listing_id, score)
             VALUES ('2026-10-05', 'spaceship', '${GRILL}', 1);`
        )
      ).toBe(true)
    })
  })

  it('3. adds Creators & Influencers with five format subcategories', async () => {
    await withScratchDb('creator_categories', (url) => {
      current(url)
      const rows = query<{ id: string; slug: string; parent: string | null }>(
        url,
        `SELECT c.id, c.slug, p.slug AS parent
           FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
          WHERE c.slug = 'creators-influencers' OR p.slug = 'creators-influencers'
          ORDER BY c.parent_id NULLS FIRST, c.display_order`
      )

      expect(rows[0]).toMatchObject({
        id: 'c0000001-0000-0000-0000-000000000026',
        slug: 'creators-influencers',
        parent: null,
      })
      expect(rows.slice(1).map((r) => r.slug)).toEqual([
        'influencers',
        'video-creators',
        'podcasters',
        'streamers',
        'writers-newsletters',
      ])
      expect(rows.slice(1).every((r) => r.parent === 'creators-influencers')).toBe(true)
    })
  })

  it('4. adds three filter groups that show for creators only', async () => {
    await withScratchDb('creator_groups', (url) => {
      current(url)
      const groups = query<{
        slug: string
        input_type: string
        applies_to: string[]
        values: string
      }>(
        url,
        `SELECT g.slug, g.input_type, g.applies_to, count(v.id) AS values
           FROM attribute_groups g LEFT JOIN attribute_values v ON v.group_id = g.id
          WHERE g.slug IN ('creator-niche','creator-platforms','audience-size')
          GROUP BY g.slug, g.input_type, g.applies_to, g.display_order
          ORDER BY g.display_order`
      )

      expect(groups.map((g) => [g.slug, g.input_type, Number(g.values)])).toEqual([
        ['creator-niche', 'checkbox', 16],
        ['creator-platforms', 'checkbox', 9],
        // One answer only: an audience is one size.
        ['audience-size', 'radio', 5],
      ])
      for (const g of groups) expect(g.applies_to).toEqual(['creator'])
    })
  })

  it('5. adds open_to_partnerships, off for every existing page', async () => {
    await withScratchDb('creator_partners_col', (url) => {
      current(url)
      const [col] = query<{ is_nullable: string; column_default: string }>(
        url,
        `SELECT is_nullable, column_default FROM information_schema.columns
          WHERE table_name = 'listings' AND column_name = 'open_to_partnerships'`
      )
      expect(col).toMatchObject({ is_nullable: 'NO', column_default: 'false' })

      expect(
        query(url, `SELECT id FROM listings WHERE open_to_partnerships`),
        'no existing page should start switched on'
      ).toHaveLength(0)
      expect(
        query(
          url,
          `SELECT indexname FROM pg_indexes WHERE indexname = 'listings_open_to_partnerships_idx'`
        )
      ).toHaveLength(1)
    })
  })

  it('6. filters both search functions to pages with the switch on', async () => {
    await withScratchDb('creator_partners_filter', (url) => {
      current(url)
      exec(url, `UPDATE listings SET open_to_partnerships = true WHERE id = '${SPONSOR}';`)

      expect(search(url, true)).toEqual([SPONSOR])
      expect(cellTotal(url, true)).toBe(1)

      // false is "no filter", not "only pages with it off".
      expect(search(url, false)).toEqual(ALL)
      expect(cellTotal(url, false)).toBe(3)
    })
  })

  it('7. gives old callers the same results and leaves only the new signatures', async () => {
    await withScratchDb('creator_old_callers', (url) => {
      previous(url)
      const before = { rows: search(url), count: cellTotal(url) }

      applyFile(url, MIGRATION)
      exec(url, `UPDATE listings SET open_to_partnerships = true WHERE id = '${SPONSOR}';`)

      expect(search(url)).toEqual(before.rows)
      expect(cellTotal(url)).toBe(before.count)
      expect(before.rows).toEqual(ALL)

      expect(identityTypes(url, 'search_listings_faceted')).toEqual([SEARCH_20])
      expect(identityTypes(url, 'facet_counts')).toEqual([COUNTS_16])
    })
  })

  it('8. is idempotent: re-applying changes nothing', async () => {
    await withScratchDb('creator_idempotent', (url) => {
      current(url)
      exec(url, `UPDATE listings SET open_to_partnerships = true WHERE id = '${SPONSOR}';`)

      const counts = () =>
        query<{ cats: string; groups: string; vals: string }>(
          url,
          `SELECT (SELECT count(*) FROM categories)       AS cats,
                  (SELECT count(*) FROM attribute_groups) AS groups,
                  (SELECT count(*) FROM attribute_values) AS vals`
        )[0]
      const before = counts()

      applyFile(url, MIGRATION)

      expect(counts()).toEqual(before)
      expect(search(url, true)).toEqual([SPONSOR])
      expect(identityTypes(url, 'search_listings_faceted')).toEqual([SEARCH_20])
      expect(identityTypes(url, 'facet_counts')).toEqual([COUNTS_16])
    })
  })
})
