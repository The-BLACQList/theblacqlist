// =============================================================================
// Migration test: 20260922000000_search_recall.sql
// =============================================================================
// Applies the real migration chain to a scratch Postgres and asserts recall
// behaviorally — by calling the real functions with real queries, not by parsing
// SQL text.
//
// THE DEFECT THIS PROTECTS, in the founder's words: "I don't get anything for
// 'dentist' but I get several for 'dental'."
//
// The cause is English Porter stemming, not a missing row. to_tsvector('english',
// 'Dentistry') produces the stem `dentistri`; 'dental' produces `dental`;
// 'dentist' produces `dentist`. Three different stems, so an index built from one
// can never be found by another. Every dental listing in production indexed
// `dental` and `dentistri` and none indexed `dentist`
// [Measured — production SQL, 2026-09-22].
//
// The migration answers it three ways, and there is a case for each:
//   * index the category name AND the parent category name (weight B), so a
//     listing filed under "Dentists" carries the stem `dentist` for real;
//   * widen the predicate with word_similarity() so a listing NOT filed under
//     that category still matches on its name;
//   * expand p_category_id to one level of descendants, so filing a listing
//     under a subcategory does not hide it from the parent's browse page.
//
// THE CHAIN MATTERS, for two separate reasons.
//   1. Both faceted-search functions were last written by 20260904000000, which
//      itself DROPped the 16-arg pair. Applying less than the whole chain would
//      exercise a function the application never calls.
//   2. search_vector is written by a TRIGGER, not by the RPC. A test that seeded
//      `search_vector` by hand (as search-location-types.test.ts does, correctly,
//      for its own purpose) would prove nothing here, because the trigger
//      function IS the thing under test. So the fixture creates the two real
//      triggers, with the shapes the repo actually ships:
//        listings_search_vector_update          BEFORE INSERT OR UPDATE
//                                               (20260510000000:434)
//        listing_details_search_vector_update   AFTER INSERT OR UPDATE OF
//                                               description (20260601000000:49)
//      and every listing's vector is computed the way production computes it.
//
// Full order applied, chronological:
//   fixture (initial-schema tables + trigger function + trigger)
//     -> 20260601000000  (category name and business description in the vector)
//     -> 20260622000001  (search_listings_faceted / facet_counts)
//     -> 20260701000000  (both trigger functions become SECURITY DEFINER)
//     -> 20260707000000  (ownership_label)
//     -> 20260809000000  (tier tiebreak)
//     -> 20260811010000  (radius)
//     -> 20260904000000  (location types; the current production state)
//     -> 20260922000000  (this migration)
//
// Cases 1, 5 and 8 assert the PRE-migration behavior first. That is deliberate:
// a recall test that only checks the "after" state passes just as happily
// against a function that always returned everything. Proving the defect is
// present before the migration is what makes the "after" assertion mean
// something.
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
const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260922000000_search_recall.sql",
)

// The two signatures 20260904000000 created. This migration must NOT change
// them — it CREATE OR REPLACEs both in place, with no DROP, so a running
// /discover never sees a window where the function is missing. These constants
// are bare type lists, the form pg_proc reports (Postgres says `integer` where
// the SQL files write `int`). Copied from search-location-types.test.ts:96-101
// rather than imported, so that if that file's constants are ever edited, the
// two tests disagree loudly instead of drifting together.
const SEARCH_17 =
  "text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text, " +
  "double precision, double precision, double precision, text, integer, integer"
const COUNTS_13 =
  "text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, " +
  "double precision, double precision, double precision"

// The minimum schema the chain touches, at the shapes production uses.
//
// This is search-location-types.test.ts's FIXTURE plus the four things the
// trigger functions read and that one has no reason to carry: a `categories`
// table (with `parent_id`, which the descendant filter needs), `listings.tagline`
// and `listings.service_area_description`, and `listing_details_business
// .description`. Without them 20260601000000 and 20260922000000 both fail at the
// first row the trigger touches.
//
// pg_trgm is created here because word_similarity() lives in it. In production
// it arrives with the initial schema (20260510000000:43), so the migration does
// not create it and must not: a migration that created an extension it did not
// own would be lying about its own down plan.
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
  search_vector            tsvector
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

CREATE FUNCTION is_open_now(p_listing_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $fn$ SELECT true; $fn$;

-- The initial schema's version of the trigger function, verbatim
-- (20260510000000:423-432). Name, tagline, service area only — no category. It
-- is here so the trigger below has something to bind to; 20260601000000
-- immediately replaces it.
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
const HEALTHCARE = "aaaaaaaa-0000-0000-0000-000000000001"
const DENTISTS = "aaaaaaaa-0000-0000-0000-000000000002"
const FOOD = "aaaaaaaa-0000-0000-0000-000000000003"

const MIDTOWN = "11111111-1111-1111-1111-111111111111"
const ELITE = "22222222-2222-2222-2222-222222222222"
const WOODLAWN = "33333333-3333-3333-3333-333333333333"
const BAKERY = "44444444-4444-4444-4444-444444444444"
const CLINIC = "55555555-5555-5555-5555-555555555555"

// Mirrors the production shape exactly [Measured — production SQL, 2026-09-22]:
// three dental businesses, all filed under top-level Healthcare, none of them
// carrying the word "dentist" anywhere. MIDTOWN and ELITE are moved to the
// Dentists subcategory below (the same move the GATE-DATA file
// docs/blacqlist/ops/data/recategorize-dental-2026-09-22.sql makes on prod);
// WOODLAWN is deliberately LEFT on Healthcare, because the trigram half of the
// fix is the half that has to carry a listing nobody has recategorized — and
// 365 of 372 production listings are in exactly that state.
//
// Nothing sets search_vector. The trigger computes it, which is the point.
const SEED = `
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('${HEALTHCARE}', 'Healthcare',     'healthcare', NULL),
  ('${DENTISTS}',   'Dentists',       'dentists',   '${HEALTHCARE}'),
  ('${FOOD}',       'Food and Drink', 'food',       NULL);

INSERT INTO listings (id, name, tagline, category_id, save_count) VALUES
  ('${MIDTOWN}',  'Midtown Dental Center',  'Gentle care downtown', '${HEALTHCARE}', 10),
  ('${ELITE}',    'Elite Dental Wellness',  'Whole mouth health',   '${HEALTHCARE}', 20),
  ('${WOODLAWN}', 'Woodlawn Dental Gallery','Smiles on the south',  '${HEALTHCARE}', 30),
  ('${BAKERY}',   'Sweet Auburn Bakery',    'Cakes and coffee',     '${FOOD}',       90),
  ('${CLINIC}',   'Westside Family Clinic', 'Primary care',         '${HEALTHCARE}',  1);

INSERT INTO listing_details_business (listing_id, description, price_range) VALUES
  ('${MIDTOWN}',  'Cleanings, crowns and implants.', '$$'),
  ('${ELITE}',    'Cosmetic and restorative work.',  '$$'),
  ('${WOODLAWN}', 'Family practice since 1998.',     '$$$'),
  ('${BAKERY}',   'Layer cakes baked daily.',        '$'),
  ('${CLINIC}',   'Walk-in primary care.',           '$$$$');
`

// The recategorization, as its own statement so a case can choose to run without
// it. MIDTOWN and ELITE move to the Dentists child; WOODLAWN stays put.
const RECATEGORIZE = `
UPDATE listings SET category_id = '${DENTISTS}'
WHERE id IN ('${MIDTOWN}', '${ELITE}');
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
}

/** Call search_listings_faceted and return ids in the order produced. */
function search(
  url: string,
  opts: { q?: string | null; categoryId?: string | null; sort?: string } = {},
): string[] {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  const cat =
    opts.categoryId === undefined || opts.categoryId === null
      ? "NULL"
      : `'${opts.categoryId}'`
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => ${q},
       p_category_id => ${cat},
       p_sort => '${opts.sort ?? "relevance"}',
       p_limit => 24, p_offset => 0
     )`,
  ).map((r) => r.id)
}

/** facet_counts, reduced to { key -> count } for one facet kind. */
function counts(
  url: string,
  kind: string,
  opts: { q?: string | null; categoryId?: string | null } = {},
): Record<string, number> {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  const cat =
    opts.categoryId === undefined || opts.categoryId === null
      ? "NULL"
      : `'${opts.categoryId}'`
  const rows = query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(
       p_q => ${q}, p_category_id => ${cat}
     ) WHERE facet_kind = '${kind}'`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.facet_key] = Number(r.facet_count)
  return out
}

/** Does one listing's stored vector match this query under the english config? */
function vectorHits(url: string, id: string, term: string): boolean {
  const rows = query<{ hit: boolean }>(
    url,
    `SELECT search_vector @@ websearch_to_tsquery('english', '${term}') AS hit
       FROM listings WHERE id = '${id}'`,
  )
  return rows[0]?.hit === true
}

/** Every live signature of a function, as Postgres reports it, with param names. */
function overloads(url: string, fn: string): string[] {
  return query<{ args: string }>(
    url,
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = '${fn}' AND n.nspname = 'public'
      ORDER BY 1`,
  ).map((r) => r.args)
}

/** The same signatures reduced to bare types, comparable to the constants above. */
function identityTypes(url: string, fn: string): string[] {
  return overloads(url, fn).map((sig) =>
    sig
      .split(", ")
      .map((param) => param.replace(/^\w+\s+/, ""))
      .join(", "),
  )
}

describe.skipIf(!DB_REACHABLE)("20260922000000_search_recall", () => {
  it("1. 'dentist' finds nothing before, and finds all three dental listings after", async () => {
    await withScratchDb("recall_dentist", async (url) => {
      baseline(url)
      exec(url, SEED)

      // The defect, reproduced. 'dental' works; 'dentist' does not. This is the
      // founder's sentence, in SQL.
      expect(search(url, { q: "dental" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
      expect(search(url, { q: "dentist" })).toEqual([])

      applyFile(url, MIGRATION)
      exec(url, RECATEGORIZE)

      // Both words now reach the same three businesses. 'dental' must not
      // regress: the fix adds recall, it does not trade one word for another.
      expect(search(url, { q: "dentist" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
      expect(search(url, { q: "dental" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
    })
  })

  it("2. the category name and the parent category name are both in the vector", async () => {
    await withScratchDb("recall_vector_contents", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)
      exec(url, RECATEGORIZE)

      // MIDTOWN is filed under Dentists, whose parent is Healthcare. Both names
      // are indexed at weight B, so both words find it. Indexing the parent is
      // what keeps a recategorized listing reachable by the broad word people
      // actually type.
      expect(vectorHits(url, MIDTOWN, "dentist")).toBe(true)
      expect(vectorHits(url, MIDTOWN, "healthcare")).toBe(true)

      // WOODLAWN is still on Healthcare, so it has no `dentist` stem at all.
      // Case 3 is how it is still found.
      expect(vectorHits(url, WOODLAWN, "healthcare")).toBe(true)
      expect(vectorHits(url, WOODLAWN, "dentist")).toBe(false)

      // The business description keeps its weight-C slot. This is the half of
      // PART 1 that travels through the OTHER trigger
      // (listing_details_search_vector_update), so a change that broke the two
      // functions out of lockstep fails here.
      expect(vectorHits(url, MIDTOWN, "implants")).toBe(true)
    })
  })

  it("3. an un-recategorized listing is still found, by trigram on its name", async () => {
    await withScratchDb("recall_trigram", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)
      // NOTE: no RECATEGORIZE. Every listing is still on top-level Healthcare,
      // which is the state 365 of 372 production listings are in.

      expect(vectorHits(url, WOODLAWN, "dentist")).toBe(false)
      expect(search(url, { q: "dentist" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
    })
  })

  it("4. a typo still reaches the listings", async () => {
    await withScratchDb("recall_typo", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // 'denist' has no stem in common with anything indexed. Only the trigram
      // clause can answer it.
      expect(search(url, { q: "denist" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
    })
  })

  it("5. filtering by the parent category returns the subcategory's listings", async () => {
    await withScratchDb("recall_descendants", async (url) => {
      baseline(url)
      exec(url, SEED)
      exec(url, RECATEGORIZE)

      // Before: recategorizing two listings HIDES them from the Healthcare
      // browse page. Getting the category right would have made the directory
      // worse, which is why this half of the migration is not optional.
      expect(search(url, { categoryId: HEALTHCARE }).sort()).toEqual(
        [CLINIC, WOODLAWN].sort(),
      )

      applyFile(url, MIGRATION)

      // After: the parent returns its own rows and its children's.
      expect(search(url, { categoryId: HEALTHCARE }).sort()).toEqual(
        [CLINIC, ELITE, MIDTOWN, WOODLAWN].sort(),
      )
      // The leaf is unchanged — one level down, not a whole subtree flattened.
      expect(search(url, { categoryId: DENTISTS }).sort()).toEqual(
        [ELITE, MIDTOWN].sort(),
      )
      // And an unrelated category is untouched.
      expect(search(url, { categoryId: FOOD })).toEqual([BAKERY])
    })
  })

  it("6. a full-text hit outranks a trigram-only hit", async () => {
    await withScratchDb("recall_rank_tiers", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)
      exec(url, RECATEGORIZE)

      // SAVE COUNTS ARE DELIBERATE: WOODLAWN has the highest (30), so the stable
      // tiebreakers would place it FIRST. A passing assertion therefore proves
      // the rank tier did the work, not incidental row order.
      const ranked = search(url, { q: "dentist" })
      expect(ranked).toHaveLength(3)
      expect(ranked.slice(0, 2).sort()).toEqual([ELITE, MIDTOWN].sort())
      expect(ranked[2]).toBe(WOODLAWN)
    })
  })

  it("7. the widened predicate does not flood results", async () => {
    await withScratchDb("recall_precision", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)
      exec(url, RECATEGORIZE)

      // The risk of a fuzzy clause is that it makes every query return the whole
      // directory, which is a worse failure than returning nothing: it looks
      // like it works. The bakery is not a dentist.
      expect(search(url, { q: "dentist" })).not.toContain(BAKERY)
      expect(search(url, { q: "dentist" })).not.toContain(CLINIC)
      expect(search(url, { q: "bakery" })).toEqual([BAKERY])
      // A word in nobody's name, tagline or category returns nothing at all.
      expect(search(url, { q: "plumbing" })).toEqual([])
    })
  })

  it("8. facet_counts describes the same set the result list holds", async () => {
    await withScratchDb("recall_facets_agree", async (url) => {
      baseline(url)
      exec(url, SEED)
      exec(url, RECATEGORIZE)

      // Before: the sidebar and the list agree with each other, and both are
      // missing the same row.
      //
      // Note what this case measures that case 1 does not. Case 1 recategorizes
      // AFTER the migration, so its pre-state is the untouched production shape
      // and 'dentist' returns nothing at all. Here the recategorization lands
      // FIRST, and that alone is enough to make MIDTOWN and ELITE match:
      // 20260601000000 already indexes the category name, and "Dentists" stems
      // to `dentist` where "dentistry" stems to `dentistri`
      // [Measured - local PG 17.6, 2026-09-23]. So the data change carries two
      // of the three rows on its own.
      //
      // What it cannot carry is WOODLAWN, which is still filed under Healthcare
      // and has no `dentist` stem anywhere. That row is the trigram half of the
      // migration, and it is the difference between the two expectations below
      // and the two after the apply.
      expect(search(url, { q: "dentist" }).sort()).toEqual([ELITE, MIDTOWN].sort())
      expect(counts(url, "price", { q: "dentist" })).toEqual({ $$: 2 })

      applyFile(url, MIGRATION)

      // After: both widened, together. A count that described a different query
      // than the list is checkpoint 1.16 all over again, and the two predicates
      // are byte-identical in the migration precisely so this cannot drift.
      expect(search(url, { q: "dentist" })).toHaveLength(3)
      expect(counts(url, "price", { q: "dentist" })).toEqual({ $$: 2, $$$: 1 })

      // The descendant filter has to travel to the sidebar too.
      expect(counts(url, "price", { categoryId: HEALTHCARE })).toEqual({
        $$: 2,
        $$$: 1,
        $$$$: 1,
      })
    })
  })

  it("9. both signatures are unchanged, with exactly one overload each", async () => {
    await withScratchDb("recall_signatures", async (url) => {
      baseline(url)

      const searchBefore = identityTypes(url, "search_listings_faceted")
      const countsBefore = identityTypes(url, "facet_counts")
      expect(searchBefore).toEqual([SEARCH_17])
      expect(countsBefore).toEqual([COUNTS_13])

      applyFile(url, MIGRATION)

      // THE POINT OF THIS CASE. Both functions are CREATE OR REPLACE with no
      // DROP, which is only safe while the signature is byte-identical. If a
      // parameter is ever added or reordered without an explicit DROP of the old
      // arg list, Postgres quietly CREATEs a second overload, and PostgREST —
      // which calls with named arguments — starts rejecting every /discover
      // request as ambiguous. That is the failure recorded in 20260809000000:30.
      expect(identityTypes(url, "search_listings_faceted")).toEqual([SEARCH_17])
      expect(identityTypes(url, "facet_counts")).toEqual([COUNTS_13])
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
      expect(overloads(url, "facet_counts")).toHaveLength(1)
    })
  })

  it("10. the migration is idempotent and a null query still returns everything", async () => {
    await withScratchDb("recall_idempotent", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)
      exec(url, RECATEGORIZE)

      const once = search(url, { q: "dentist" })
      const browseOnce = search(url).sort()

      applyFile(url, MIGRATION)

      expect(search(url, { q: "dentist" })).toEqual(once)
      expect(search(url).sort()).toEqual(browseOnce)
      // No query means no relevance to compute and nothing to widen: the browse
      // page still holds the whole directory.
      expect(browseOnce).toEqual([BAKERY, CLINIC, ELITE, MIDTOWN, WOODLAWN].sort())
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
    })
  })

  it("11. the documented down plan restores the previous behavior", async () => {
    await withScratchDb("recall_down_plan", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // The header's DOWN PLAN, run exactly as written: re-run 20260701000000 in
      // full, then 20260904000000 in full, then null the vectors so the restored
      // trigger rewrites every row. No DROP anywhere, because no signature moved.
      applyFile(url, SECDEF)
      applyFile(url, LOCTYPES)
      exec(url, "UPDATE listings SET search_vector = NULL;")

      // Back to the defect, which is what a rollback is supposed to mean.
      expect(search(url, { q: "dental" }).sort()).toEqual(
        [ELITE, MIDTOWN, WOODLAWN].sort(),
      )
      expect(search(url, { q: "dentist" })).toEqual([])
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
      expect(overloads(url, "facet_counts")).toHaveLength(1)
    })
  })
})
