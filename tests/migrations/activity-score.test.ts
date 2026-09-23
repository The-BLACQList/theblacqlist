// =============================================================================
// Migration test: 20260923000000_activity_ranking.sql
// =============================================================================
// Applies the real migration chain to a scratch Postgres and asserts the
// activity score behaviorally — by seeding real signals, running the real
// refresh function, and reading the real search order back. No SQL text is
// parsed here. (The source-contract half of PR 5 lives in
// tests/how-ranking-works.test.ts, which asserts that the ORDER BY keys and the
// disclosure page still say the same thing.)
//
// WHAT THIS PROTECTS, in the founder's words: "for ranking in searches, I want
// it to be based on platform interaction/activity. The more positively active
// you are on the blacqlist, the higher your ranking will be regardless of your
// labeling."
//
// Refined by [Decision — founder, 2026-09-23]: on a keyword search, results are
// grouped into bands of comparable match quality and activity orders WITHIN a
// band. Activity does not let a weak match jump ahead of a strong one. Browse
// pages with no keyword are pure activity order. Case 6 is the case that holds
// that line, and case 7 is the case that holds the browse half.
//
// THE CHAIN MATTERS. This migration CREATE OR REPLACEs search_listings_faceted
// on top of 20260922000000, which itself sits on 20260904000000. Applying less
// than the whole chain would exercise a function the application never calls.
// The full order, chronological:
//   fixture (initial-schema tables + trigger functions + triggers)
//     -> 20260601000000  (category name and business description in the vector)
//     -> 20260622000001  (search_listings_faceted / facet_counts)
//     -> 20260701000000  (both trigger functions become SECURITY DEFINER)
//     -> 20260707000000  (ownership_label)
//     -> 20260809000000  (tier tiebreak)
//     -> 20260811010000  (radius)
//     -> 20260904000000  (location types)
//     -> 20260922000000  (recall: parent category in the vector, trigram OR)
//     -> 20260923000000  (this migration)
//
// THREE DESIGN CHOICES WORTH KNOWING BEFORE EDITING THIS FILE:
//
//  1. Every ordering case gives the LOSER the higher save_count. save_count is
//     the first stable tiebreaker, so if the activity key were dropped the
//     tiebreakers alone would produce the exact opposite order and the case
//     would fail loudly rather than pass by luck. Same rule the three older
//     search migration tests follow.
//
//  2. Decayed scores are asserted as tight RANGES, not equalities. now()
//     advances between the INSERT that seeds an event and the refresh that
//     scores it; the drift is about 3.9e-7 points per second, so a 0.01-wide
//     band is safe by five orders of magnitude. Where a score is a pure bonus
//     and does not involve now() at all (case 3) it is asserted exactly.
//
//  3. The fixture declares an UNGUARDED `set_updated_at` trigger on listings.
//     That is deliberate. PART 3 of the migration does DROP TRIGGER IF EXISTS
//     followed by CREATE ... WHEN (OLD.activity_score IS NOT DISTINCT FROM
//     NEW.activity_score). With no pre-existing trigger the DROP is a no-op and
//     "updated_at did not move" would pass against a database that has no
//     updated_at machinery at all. Case 4 proves the fixture trigger really
//     bumps BEFORE applying the migration, so the post-migration assertion
//     means something.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  withScratchDb,
} from "./helpers"

const VECTOR_BASE = path.join(
  MIGRATIONS_DIR,
  "20260601000000_extend_search_vector.sql",
)
const RPC_BASE = path.join(
  MIGRATIONS_DIR,
  "20260622000001_search_listings_faceted_rpc.sql",
)
const SECDEF = path.join(
  MIGRATIONS_DIR,
  "20260701000000_fix_search_vector_security_definer.sql",
)
const OWNERSHIP = path.join(
  MIGRATIONS_DIR,
  "20260707000000_listings_ownership_label.sql",
)
const TIEBREAK = path.join(
  MIGRATIONS_DIR,
  "20260809000000_search_tier_tiebreak.sql",
)
const RADIUS = path.join(
  MIGRATIONS_DIR,
  "20260811010000_search_radius_filter.sql",
)
const LOCTYPES = path.join(
  MIGRATIONS_DIR,
  "20260904000000_search_location_types.sql",
)
const RECALL = path.join(MIGRATIONS_DIR, "20260922000000_search_recall.sql")
const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260923000000_activity_ranking.sql",
)

// The minimum schema the chain touches, at the shapes production uses.
//
// This is search-recall.test.ts's FIXTURE plus the six things 20260923000000
// reads and that one has no reason to carry:
//   listings.updated_at              PART 3's trigger writes it
//   listings.last_edited_by_owner_at PART 4's owner-upkeep bonus reads it
//   update_updated_at()              PART 3's trigger binds to it
//   reviews                          PART 4's review and owner-reply branches
//   analytics_events                 PART 4's save branch, PART 5's rollup
//   entity_analytics_daily           PART 4's view branch, PART 5's target
//   analytics_job_log                PART 5 writes one row per run
//
// It deliberately does NOT declare ranking_weights or listings.activity_score.
// PARTs 1 and 2 add both, and a fixture that pre-created them would hide a
// migration that forgot to.
//
// The auth.users foreign keys on reviews are dropped rather than reproduced:
// there is no auth schema in a scratch database, and nothing under test reads
// the reviewer's identity.
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
const FOOD = "aaaaaaaa-0000-0000-0000-000000000001"
const COFFEE = "aaaaaaaa-0000-0000-0000-000000000002"

const FRESH = "11111111-1111-1111-1111-111111111111"
const STALE = "22222222-2222-2222-2222-222222222222"
const VIRAL = "33333333-3333-3333-3333-333333333333"
const QUIET = "44444444-4444-4444-4444-444444444444"
const HOUSE = "55555555-5555-5555-5555-555555555555"

// Five listings around one keyword, 'coffee'.
//
// FRESH / STALE / VIRAL / QUIET are exact full-text hits for 'coffee': the word
// is in the name at weight A, and their category 'Coffee Shops' is indexed at
// weight B by 20260922000000. They all land in match_band 10.
//
// HOUSE is the cross-band case and is measured, not assumed
// [Measured — local Postgres 17 / pg_trgm, 2026-09-23]:
//   to_tsvector('english','Coffeehouse Roasters')
//     @@ websearch_to_tsquery('english','coffee')   -> false
//   word_similarity('coffee','Coffeehouse Roasters') -> 0.857
//   floor(0.857 * 10)                                -> 8
// So it is retrieved only by the trigram half of the recall predicate and sits
// in band 8, two bands below the four exact hits.
//
// HOUSE is filed under 'Food and Drink', NOT 'Coffee Shops'. This is the whole
// reason the case works: 20260922000000 indexes the category name AND the
// parent category name into search_vector, so a listing filed under a coffee
// category would become an exact full-text hit for 'coffee' through its
// category alone, land in band 10, and the cross-band assertion would silently
// prove nothing. Its tagline and description avoid the word for the same reason.
//
// Every listing starts at the floor: not featured, trust_tier 'unclaimed', no
// owner edit, free tier. So the base activity score is 0 for all five and each
// case adds only the one signal it is testing.
//
// save_count is seeded so that the FIRST stable tiebreaker actively fights every
// ordering assertion below. See design note 1 in the header.
const SEED = `
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${FOOD}',   'Food and Drink', 'food',         NULL),
  ('${COFFEE}', 'Coffee Shops',   'coffee-shops', '${FOOD}');

INSERT INTO listings (id, name, tagline, category_id, save_count) VALUES
  ('${FRESH}', 'Fresh Cup Coffee',     'Pour over and pastries', '${COFFEE}', 10),
  ('${STALE}', 'Stale Cup Coffee',     'Yesterday roast',        '${COFFEE}', 90),
  ('${VIRAL}', 'Viral Cup Coffee',     'Everyone is here',       '${COFFEE}',  5),
  ('${QUIET}', 'Quiet Cup Coffee',     'Nobody is here',         '${COFFEE}', 80),
  ('${HOUSE}', 'Coffeehouse Roasters', 'Beans by the pound',     '${FOOD}',    1);

INSERT INTO listing_details_business (listing_id, description, price_range) VALUES
  ('${FRESH}', 'Single origin pour over.',   '$$'),
  ('${STALE}', 'Drip by the carafe.',        '$'),
  ('${VIRAL}', 'Lines out the door.',        '$$'),
  ('${QUIET}', 'Quiet corner seating.',      '$$'),
  ('${HOUSE}', 'Beans roasted daily onsite.','$$$');
`

/** Bring a scratch db to exactly the state production is in before this migration. */
function baseline(url: string) {
  exec(url, FIXTURE)
  applyFile(url, VECTOR_BASE)
  applyFile(url, RPC_BASE)
  applyFile(url, SECDEF)
  applyFile(url, OWNERSHIP)
  applyFile(url, TIEBREAK)
  applyFile(url, RADIUS)
  applyFile(url, LOCTYPES)
  applyFile(url, RECALL)
}

/** Call search_listings_faceted and return ids in the order produced. */
function search(
  url: string,
  opts: { q?: string | null; sort?: string } = {},
): string[] {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => ${q},
       p_sort => '${opts.sort ?? "relevance"}',
       p_limit => 24, p_offset => 0
     )`,
  ).map((r) => r.id)
}

/** Every listing's activity_score, as a number, keyed by id. */
function scores(url: string): Record<string, number> {
  const rows = query<{ id: string; score: string }>(
    url,
    `SELECT id, activity_score::text AS score FROM listings`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.id] = Number(r.score)
  return out
}

/** Run the nightly scorer by hand and return the number of rows it rewrote. */
function refresh(url: string): number {
  const rows = query<{ n: number }>(url, `SELECT refresh_activity_scores() AS n`)
  return Number(rows[0]?.n ?? -1)
}

/** One listing's updated_at, as the exact text Postgres renders. */
function updatedAt(url: string, id: string): string {
  const rows = query<{ u: string }>(
    url,
    `SELECT updated_at::text AS u FROM listings WHERE id = '${id}'`,
  )
  return rows[0]?.u ?? ""
}

/** True when the listing's updated_at is strictly later than the given stamp. */
function updatedAtMovedPast(url: string, id: string, stamp: string): boolean {
  const rows = query<{ moved: boolean }>(
    url,
    `SELECT updated_at > '${stamp}'::timestamptz AS moved
       FROM listings WHERE id = '${id}'`,
  )
  return rows[0]?.moved === true
}

type AggregateResult = {
  status: string
  rows_upserted: number
  rescored: number
  error?: string
}

/** Run the nightly rollup, which PART 5 extends to also rescore. */
function aggregate(url: string): AggregateResult {
  const rows = query<{ out: AggregateResult }>(
    url,
    `SELECT aggregate_entity_analytics(current_date) AS out`,
  )
  return rows[0]!.out
}

describe.skipIf(!DB_REACHABLE)("20260923000000_activity_ranking", () => {
  it("1. a one-day-old save outranks an eighty-day-old one, and the decay is linear over the 90 day window", async () => {
    await withScratchDb("activity_decay", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO analytics_events (event_name, entity_type, entity_id, properties, created_at) VALUES
           ('save_toggled', 'listing', '${FRESH}', '{"action":"save"}', now() - interval '1 day'),
           ('save_toggled', 'listing', '${STALE}', '{"action":"save"}', now() - interval '80 days');`,
      )
      refresh(url)

      // weight_save 3, window 90 days, decay = 1 - age_days/90.
      //   1 day  -> 3 * (1 - 1/90)  = 2.9667
      //   80 days -> 3 * (1 - 80/90) = 0.3333
      const s = scores(url)
      expect(s[FRESH]).toBeGreaterThan(2.96)
      expect(s[FRESH]).toBeLessThan(2.97)
      expect(s[STALE]).toBeGreaterThan(0.33)
      expect(s[STALE]).toBeLessThan(0.34)
      expect(s[VIRAL]).toBe(0)

      // STALE carries save_count 90 against FRESH's 10, so the stable
      // tiebreakers alone would put STALE first. Activity is what flips it.
      const order = search(url)
      expect(order.indexOf(FRESH)).toBeLessThan(order.indexOf(STALE))
    })
  })

  it("2. page views are capped at 200 a day, proven by 5000 views and 200 views scoring identically", async () => {
    await withScratchDb("activity_view_cap", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO entity_analytics_daily (listing_id, snapshot_date, page_views) VALUES
           ('${VIRAL}', current_date, 5000),
           ('${FRESH}', current_date, 200),
           ('${QUIET}', current_date, 199);`,
      )
      refresh(url)

      const s = scores(url)

      // The assertion that matters. A function that dropped least(...) would
      // give VIRAL 25x FRESH's score and still land inside any plausible
      // magnitude check, so equality is the only form that catches it. Both
      // rows are scored by the same statement, so this is exact, not fuzzy.
      expect(s[VIRAL]).toBe(s[FRESH])

      // 0.2 * 200 * decay(midnight today) = 40 * (1 - hours_since_midnight/2160),
      // so somewhere in (39.5556, 40].
      expect(s[FRESH]).toBeGreaterThan(39.55)
      expect(s[FRESH]).toBeLessThanOrEqual(40)

      // And the cap is a cap, not a floor: one view short of it scores less.
      expect(s[QUIET]).toBeLessThan(s[FRESH]!)
      expect(s[STALE]).toBe(0)
    })
  })

  it("3. trust tier and owner upkeep are additive bonuses, and a second refresh rewrites nothing", async () => {
    await withScratchDb("activity_bonuses", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // No events at all. These scores are pure bonuses with no now() term in
      // them, so unlike every other case they are asserted exactly.
      exec(
        url,
        `UPDATE listings SET trust_tier = 'claimed'   WHERE id = '${FRESH}';
         UPDATE listings SET trust_tier = 'verified'  WHERE id = '${STALE}';
         UPDATE listings SET trust_tier = 'certified',
                             last_edited_by_owner_at = now() - interval '10 days'
           WHERE id = '${VIRAL}';
         UPDATE listings SET last_edited_by_owner_at = now() - interval '60 days'
           WHERE id = '${QUIET}';
         UPDATE listings SET last_edited_by_owner_at = now() - interval '200 days'
           WHERE id = '${HOUSE}';`,
      )

      // Four rows change; HOUSE's 200-day-old edit earns nothing and it stays
      // at the 0 default, so the guarded UPDATE skips it.
      expect(refresh(url)).toBe(4)

      const s = scores(url)
      expect(s[FRESH]).toBe(2) // claimed
      expect(s[STALE]).toBe(5) // verified
      expect(s[VIRAL]).toBe(12) // certified 8 + edit within 30 days 4
      expect(s[QUIET]).toBe(2) // edit within 90 days
      expect(s[HOUSE]).toBe(0) // edit older than the window

      // `activity_score IS DISTINCT FROM s.score` means an unchanged night is a
      // no-write night. Without it the nightly job would touch all 372 rows.
      expect(refresh(url)).toBe(0)
    })
  })

  it("4. a rescore does not bump updated_at, but a real edit still does", async () => {
    await withScratchDb("activity_updated_at", async (url) => {
      baseline(url)
      exec(url, SEED)

      // Control, PRE-migration: the fixture trigger is real and does bump.
      // Without this the post-migration assertion would pass against a database
      // that had no updated_at trigger at all.
      const before = updatedAt(url, FRESH)
      exec(url, `UPDATE listings SET tagline = 'Control' WHERE id = '${FRESH}';`)
      expect(updatedAtMovedPast(url, FRESH, before)).toBe(true)

      applyFile(url, MIGRATION)

      const u0 = updatedAt(url, FRESH)
      exec(
        url,
        `INSERT INTO analytics_events (event_name, entity_type, entity_id, properties, created_at)
         VALUES ('save_toggled', 'listing', '${FRESH}', '{"action":"save"}', now());`,
      )
      expect(refresh(url)).toBe(1)

      // The score moved, so the UPDATE really ran...
      expect(scores(url)[FRESH]).toBeGreaterThan(2.9)
      // ...and updated_at did not, because PART 3's WHEN clause suppressed the
      // trigger. This is what closes the sitemap regression: app/sitemap.ts:94
      // publishes lastModified from updated_at, so a nightly rescore would
      // otherwise tell Google every listing changed every night.
      expect(updatedAt(url, FRESH)).toBe(u0)

      // The guard is narrow, not a blanket off switch: an edit that leaves
      // activity_score alone still bumps.
      exec(url, `UPDATE listings SET tagline = 'Changed' WHERE id = '${FRESH}';`)
      expect(updatedAtMovedPast(url, FRESH, u0)).toBe(true)
    })
  })

  it("5. the nightly rollup rescores search order and says so in the job log", async () => {
    await withScratchDb("activity_nightly", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // The event names are the ones PART 5 actually filters on. A rollup that
      // produced zero rows would make the rescore assertion below fail for the
      // wrong reason.
      exec(
        url,
        `INSERT INTO analytics_events (event_name, entity_type, entity_id, properties, created_at) VALUES
           ('page_view',      'listing', '${FRESH}', '{}',               now()),
           ('page_view',      'listing', '${FRESH}', '{}',               now()),
           ('page_view',      'listing', '${FRESH}', '{}',               now()),
           ('cta_click',      'listing', '${FRESH}', '{}',               now()),
           ('save_toggled',   'listing', '${STALE}', '{"action":"save"}', now()),
           ('share_initiated','listing', '${STALE}', '{}',               now());`,
      )

      const result = aggregate(url)

      // PART 5 wraps the whole body in EXCEPTION WHEN OTHERS, so a broken
      // refresh call would be logged as a failed job and returned as JSON
      // rather than raised. Asserting the status is the only way to see it.
      expect(result.status).toBe("success")
      expect(Number(result.rows_upserted)).toBeGreaterThan(0)
      expect(Number(result.rescored)).toBeGreaterThan(0)

      const rollup = query<{ listing_id: string; page_views: number }>(
        url,
        `SELECT listing_id, page_views FROM entity_analytics_daily
          WHERE snapshot_date = current_date AND listing_id = '${FRESH}'`,
      )
      expect(Number(rollup[0]?.page_views)).toBe(3)

      // Both halves of the score are live after one nightly run: FRESH from the
      // rollup it just wrote, STALE from the raw save event.
      const s = scores(url)
      expect(s[FRESH]).toBeGreaterThan(0)
      expect(s[STALE]).toBeGreaterThan(0)

      const log = query<{ status: string; notes: string }>(
        url,
        `SELECT status, notes FROM analytics_job_log ORDER BY created_at DESC LIMIT 1`,
      )
      expect(log[0]?.status).toBe("success")
      expect(log[0]?.notes ?? "").toContain("rescored")
    })
  })

  it("6. activity orders within a match band and never across one", async () => {
    await withScratchDb("activity_match_band", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Written straight to the column so the case tests the ORDER BY, not the
      // scorer. VIRAL is a modest mover inside band 10; HOUSE is an absurd
      // outlier in band 8.
      exec(
        url,
        `UPDATE listings SET activity_score = 5    WHERE id = '${VIRAL}';
         UPDATE listings SET activity_score = 9999 WHERE id = '${HOUSE}';`,
      )

      const order = search(url, { q: "coffee" })

      // All five are retrieved: the four exact hits plus HOUSE through the
      // trigram half of 20260922000000's predicate.
      expect(order).toHaveLength(5)
      expect(order).toContain(HOUSE)

      // Inside the band, activity decides.
      expect(order[0]).toBe(VIRAL)

      // Across bands, it does not. 9999 points of activity cannot lift a
      // trigram-only match above an exact one.
      // [Decision — founder, 2026-09-23] Match band, then activity.
      expect(order[4]).toBe(HOUSE)
      expect([...order.slice(0, 4)].sort()).toEqual(
        [FRESH, STALE, VIRAL, QUIET].sort(),
      )
    })
  })

  it("7. browse with no keyword is pure activity order, under sponsored placement", async () => {
    await withScratchDb("activity_browse", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Scores are the exact inverse of save_count, so the stable tiebreakers
      // would produce the exact reverse of the expected order.
      //   save_count desc: STALE 90, QUIET 80, FRESH 10, VIRAL 5, HOUSE 1
      //   activity  desc:  HOUSE 5, VIRAL 4, FRESH 3, QUIET 2, STALE 1
      exec(
        url,
        `UPDATE listings SET activity_score = 1 WHERE id = '${STALE}';
         UPDATE listings SET activity_score = 2 WHERE id = '${QUIET}';
         UPDATE listings SET activity_score = 3 WHERE id = '${FRESH}';
         UPDATE listings SET activity_score = 4 WHERE id = '${VIRAL}';
         UPDATE listings SET activity_score = 5 WHERE id = '${HOUSE}';`,
      )

      expect(search(url)).toEqual([HOUSE, VIRAL, FRESH, QUIET, STALE])

      // Sponsored placement is still the primary key and is not earned by
      // activity: the lowest-scoring listing goes first once it is featured.
      exec(url, `UPDATE listings SET is_featured = true WHERE id = '${STALE}';`)
      expect(search(url)).toEqual([STALE, HOUSE, VIRAL, FRESH, QUIET])
    })
  })

  it("8. the weights are read from ranking_weights, not compiled into the function", async () => {
    await withScratchDb("activity_weights", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO analytics_events (event_name, entity_type, entity_id, properties, created_at)
         VALUES ('save_toggled', 'listing', '${FRESH}', '{"action":"save"}', now());`,
      )
      refresh(url)
      const atDefault = scores(url)[FRESH]!
      expect(atDefault).toBeGreaterThan(2.99)
      expect(atDefault).toBeLessThanOrEqual(3)

      // The stated reason the table exists: "Constants live in one CREATE TABLE
      // ranking_weights row so they can be tuned by a data change later without
      // a function rewrite." This is the assertion that keeps that true.
      exec(url, `UPDATE ranking_weights SET weight_save = 30 WHERE id = 1;`)
      refresh(url)
      const atTenX = scores(url)[FRESH]!
      expect(atTenX).toBeGreaterThan(29.9)
      expect(atTenX).toBeLessThanOrEqual(30)
      expect(atTenX / atDefault).toBeCloseTo(10, 3)
    })
  })

  it("9. an active Ally outranks a quiet Black-Owned listing — the label is not a sort key", async () => {
    await withScratchDb("activity_label_not_a_key", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // WHY THIS CASE EXISTS. Cases 6 and 7 assert the new order but cannot
      // detect the OLD key coming back: every seeded listing takes the column
      // default 'black_owned', so (ownership_label = 'black_owned') DESC is
      // constant across all five rows and changes nothing. Re-adding it to the
      // ORDER BY passed all eight cases. This case gives the premise two label
      // values so the removed key has something to sort on, and it is the
      // positive statement of the founder's rule: "The more positively active
      // you are on the blacqlist, the higher your ranking will be REGARDLESS OF
      // YOUR LABELING." [Decision — founder, 2026-09-21]
      exec(
        url,
        `UPDATE listings SET ownership_label = 'ally'
           WHERE id IN ('${FRESH}', '${VIRAL}');`,
      )

      // The premise, read back rather than assumed. If this ever drifts to one
      // label the case goes vacuous again and silently guards nothing.
      const labels = query<{ id: string; ownership_label: string }>(
        url,
        `SELECT id, ownership_label FROM listings ORDER BY ownership_label`,
      )
      expect(labels.filter((r) => r.ownership_label === "ally")).toHaveLength(2)
      expect(
        labels.filter((r) => r.ownership_label === "black_owned"),
      ).toHaveLength(3)

      // The two Ally listings are the two most active. save_count fights it as
      // always: descending save_count is STALE 90, QUIET 80, FRESH 10, VIRAL 5,
      // HOUSE 1 — close to the reverse of what activity should produce.
      exec(
        url,
        `UPDATE listings SET activity_score = 5 WHERE id = '${VIRAL}';
         UPDATE listings SET activity_score = 4 WHERE id = '${FRESH}';
         UPDATE listings SET activity_score = 3 WHERE id = '${HOUSE}';
         UPDATE listings SET activity_score = 2 WHERE id = '${QUIET}';
         UPDATE listings SET activity_score = 1 WHERE id = '${STALE}';`,
      )

      // Browse, no keyword: pure activity order. Two Ally listings sit above
      // three Black-Owned ones because they earned it, not because of the label.
      expect(search(url)).toEqual([VIRAL, FRESH, HOUSE, QUIET, STALE])

      // Keyword search: match band first, activity inside it. The Ally pair
      // still leads band 10, and HOUSE stays last on band, not on label.
      expect(search(url, { q: "coffee" })).toEqual([
        VIRAL,
        FRESH,
        QUIET,
        STALE,
        HOUSE,
      ])

      // The label going the other way changes nothing. Ordering reads
      // activity_score; it never reads ownership_label.
      exec(
        url,
        `UPDATE listings SET ownership_label = 'ally' WHERE ownership_label = 'black_owned';
         UPDATE listings SET ownership_label = 'black_owned'
           WHERE id IN ('${FRESH}', '${VIRAL}');`,
      )
      expect(search(url)).toEqual([VIRAL, FRESH, HOUSE, QUIET, STALE])
    })
  })
})
