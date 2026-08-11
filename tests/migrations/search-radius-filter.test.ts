// =============================================================================
// Migration test: 20260811010000_search_radius_filter.sql
// =============================================================================
// Applies the real migration chain to a scratch Postgres and asserts the radius
// filter behaviorally — by calling the real functions against real coordinates,
// not by parsing SQL text.
//
// THE CHAIN MATTERS, and it matters more here than anywhere else in this suite.
// This migration DROPs two signatures and re-creates both faceted-search
// functions, so a test that applied only part of the chain would be exercising a
// function the application never calls. Always apply, in order:
//     20260622000001  ->  20260707000000  ->  20260809000000  ->  this migration
//
// What each case protects:
//   1.  haversine is correct        -> a real distance, and identical points do
//                                      not raise "input is out of range".
//   2.  radius narrows              -> 10mi / 50mi / 200mi return progressively
//                                      more, and the boundary is the circle, not
//                                      the bounding box.
//   3.  ungeocoded are excluded     -> the 65 listings with no lat/lng never
//                                      appear under a radius. Explicit, not
//                                      accidental — the UI copy depends on it.
//   4.  no radius = no change       -> every existing caller is unaffected.
//   5.  partial params disable it   -> a radius with no point does NOT silently
//                                      filter or silently guess. (The API layer
//                                      turns that into a 400; the RPC's job is
//                                      to be inert, not clever.)
//   6.  distance sort orders        -> nearest first, AGAINST the save_count
//                                      tiebreaker, so the key did the work.
//   7.  is_featured still first     -> the paid placement slot survives the new
//                                      sort key. Same promise 20260809000000
//                                      made and this migration must not break.
//   8.  editorial centering holds   -> a nearer Ally does not outrank a farther
//                                      Black-Owned listing. moderation-policy.md:48.
//   9.  facet_counts agrees         -> sidebar counts describe the SAME set the
//                                      result list holds. A count that describes
//                                      a different query is checkpoint 1.16 again.
//   10. exactly one overload each   -> the ambiguous-overload failure recorded in
//                                      20260809000000:30-36 can never recur.
//   11. the deployed 13-arg call    -> THE SEQUENCING PREMISE. This migration is
//                                      designed to ship BEFORE the code that uses
//                                      it; if the currently-deployed 13-argument
//                                      call stops resolving, applying it to
//                                      production takes /discover down.
//   Plus idempotency and the documented down plan.
//
// Ordering cases are built so the STABLE TIEBREAKERS WOULD PRODUCE THE OPPOSITE
// ORDER (the nearer listing is given the LOWER save_count). A passing test
// therefore proves the distance key did the work, not incidental row order.
// =============================================================================

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  withScratchDb,
} from "./helpers"

const RPC_BASE = path.join(
  MIGRATIONS_DIR,
  "20260622000001_search_listings_faceted_rpc.sql",
)
const OWNERSHIP = path.join(
  MIGRATIONS_DIR,
  "20260707000000_listings_ownership_label.sql",
)
const TIEBREAK = path.join(
  MIGRATIONS_DIR,
  "20260809000000_search_tier_tiebreak.sql",
)
const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260811010000_search_radius_filter.sql",
)

// The two signatures this migration creates, and the two it replaces. Used by
// the overload guard and the rollback test.
const SEARCH_16 =
  "text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, " +
  "double precision, double precision, double precision, text, integer, integer"
const COUNTS_12 =
  "text, uuid, uuid, text, text, text, text[], uuid[], boolean, " +
  "double precision, double precision, double precision"

// Minimum schema both RPCs touch. `lat`/`lng` are declared `numeric` to match
// production (20260510000000:455-456) — the migration casts them, and declaring
// them as double precision here would hide a cast defect.
const FIXTURE = `
CREATE TABLE listings (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  tier          text NOT NULL DEFAULT 'free'
                  CHECK (tier IN ('free','starter','growth','premium')),
  status        text NOT NULL DEFAULT 'published',
  deleted_at    timestamptz,
  flag_status   text NOT NULL DEFAULT 'none',
  is_featured   boolean NOT NULL DEFAULT false,
  published_at  timestamptz NOT NULL DEFAULT now(),
  save_count    integer NOT NULL DEFAULT 0,
  avg_rating    numeric,
  review_count  integer NOT NULL DEFAULT 0,
  category_id   uuid,
  city_id       uuid,
  entity_type   text NOT NULL DEFAULT 'business',
  trust_tier    text NOT NULL DEFAULT 'unclaimed',
  location_type text,
  search_vector tsvector
);

CREATE TABLE listing_details_business (
  listing_id  uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
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
`

// Deterministic ids so assertions read clearly.
const NEAR = "11111111-1111-1111-1111-111111111111"
const MID = "22222222-2222-2222-2222-222222222222"
const FAR = "33333333-3333-3333-3333-333333333333"
const NOGEO = "44444444-4444-4444-4444-444444444444"
const ALLY = "55555555-5555-5555-5555-555555555555"

// Chicago city hall, near enough. Every distance below is measured from here.
const O_LAT = 41.8781
const O_LNG = -87.6298

// Four listings on one meridian so the expected distances are just Δlat × ~69mi,
// checkable by hand:
//   NEAR  Δ0.0419 ->  ~2.9 mi
//   MID   Δ0.4219 -> ~29.1 mi
//   FAR   (Milwaukee) -> ~80 mi
//   NOGEO no coordinates at all -> invisible to every radius query
//
// SAVE COUNTS RUN BACKWARDS ON PURPOSE. The stable tiebreaker is
// `save_count DESC`, so without a working distance key the order would be
// FAR, MID, NEAR — the exact reverse of what case 6 asserts.
const SEED = `
INSERT INTO listings (id, name, save_count, search_vector) VALUES
  ('${NEAR}',  'Near Coffee',  1,   to_tsvector('english','coffee')),
  ('${MID}',   'Mid Coffee',   50,  to_tsvector('english','coffee')),
  ('${FAR}',   'Far Coffee',   500, to_tsvector('english','coffee')),
  ('${NOGEO}', 'Nowhere Coffee', 900, to_tsvector('english','coffee'));

INSERT INTO listing_details_business (listing_id, price_range, lat, lng) VALUES
  ('${NEAR}',  '$$',   41.9200, -87.6298),
  ('${MID}',   '$$',   42.3000, -87.6298),
  ('${FAR}',   '$$$',  43.0389, -87.9065),
  ('${NOGEO}', '$$',   NULL,    NULL);
`

/** Bring a scratch db to exactly the state production is in before this migration. */
function baseline(url: string) {
  exec(url, FIXTURE)
  applyFile(url, RPC_BASE)
  applyFile(url, OWNERSHIP)
  applyFile(url, TIEBREAK)
}

/** Call the RPC with the new 16-arg shape and return ids in the order produced. */
function search(
  url: string,
  opts: {
    q?: string | null
    sort?: string
    lat?: number | null
    lng?: number | null
    radius?: number | null
    limit?: number
  } = {},
): string[] {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  const num = (v: number | null | undefined) =>
    v === undefined || v === null ? "NULL" : String(v)
  const rows = query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => ${q},
       p_lat => ${num(opts.lat)},
       p_lng => ${num(opts.lng)},
       p_radius_miles => ${num(opts.radius)},
       p_sort => '${opts.sort ?? "relevance"}',
       p_limit => ${opts.limit ?? 24}
     )`,
  )
  return rows.map((r) => r.id)
}

/**
 * The 13-arg call as it exists on `main` today — the only shape that resolves
 * before this migration is applied, and the shape a rollback must restore.
 * Kept separate from `search()` on purpose: a helper that silently worked in
 * both worlds would hide exactly the compatibility break these cases test for.
 */
function searchLegacy(url: string, q: string | null = null): string[] {
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => ${q === null ? "NULL" : `'${q}'`},
       p_sort => 'relevance', p_limit => 24, p_offset => 0
     )`,
  ).map((r) => r.id)
}

/** facet_counts in its pre-migration 9-arg shape. */
function countsLegacy(url: string, kind: string): Record<string, number> {
  const rows = query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(p_q => NULL)
      WHERE facet_kind = '${kind}'`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.facet_key] = Number(r.facet_count)
  return out
}

/** Every live signature of a function, as Postgres reports it. */
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

/** facet_counts, reduced to { key -> count } for one facet kind. */
function counts(
  url: string,
  kind: string,
  opts: { lat?: number | null; lng?: number | null; radius?: number | null } = {},
): Record<string, number> {
  const num = (v: number | null | undefined) =>
    v === undefined || v === null ? "NULL" : String(v)
  const rows = query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(
       p_lat => ${num(opts.lat)},
       p_lng => ${num(opts.lng)},
       p_radius_miles => ${num(opts.radius)}
     ) WHERE facet_kind = '${kind}'`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.facet_key] = Number(r.facet_count)
  return out
}

describe.skipIf(!DB_REACHABLE)("20260811010000_search_radius_filter", () => {
  it("1. haversine_miles is correct, and identical points return 0 rather than erroring", async () => {
    await withScratchDb("radius_haversine", async (url) => {
      baseline(url)
      applyFile(url, MIGRATION)

      // Chicago -> Milwaukee is ~80 statute miles. A tolerance this wide still
      // fails on any unit error (km would read ~129) or a transposed argument.
      const [row] = query<{ d: string }>(
        url,
        `SELECT haversine_miles(${O_LAT}, ${O_LNG}, 43.0389, -87.9065)::text AS d`,
      )
      expect(Number(row!.d)).toBeGreaterThan(78)
      expect(Number(row!.d)).toBeLessThan(84)

      // The clamp. Without least(1, ...) floating-point error can push the
      // square root a hair past 1 and asin() raises "input is out of range" —
      // which, for a visitor standing at a listing's own address, would be a
      // 500 on the most obvious possible query.
      const [same] = query<{ d: string }>(
        url,
        `SELECT haversine_miles(${O_LAT}, ${O_LNG}, ${O_LAT}, ${O_LNG})::text AS d`,
      )
      expect(Number(same!.d)).toBe(0)
    })
  })

  it("2. a radius narrows the result set, and the boundary is the circle", async () => {
    await withScratchDb("radius_narrows", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const at = (radius: number) =>
        search(url, { lat: O_LAT, lng: O_LNG, radius }).sort()

      expect(at(10)).toEqual([NEAR])
      expect(at(50)).toEqual([MID, NEAR].sort())
      expect(at(200)).toEqual([FAR, MID, NEAR].sort())

      // MID sits ~29.1 mi out. A 25-mile radius must exclude it — this is the
      // assertion that fails if the bounding box is ever left to do the work on
      // its own, since the box at 25mi still reaches Δlat 0.362 and would let a
      // listing at the corner through.
      expect(at(25)).toEqual([NEAR])
    })
  })

  it("3. listings with no coordinates are excluded from every radius query", async () => {
    await withScratchDb("radius_ungeocoded", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // NOGEO has the highest save_count in the fixture, so it leads the
      // unfiltered list — and must vanish the moment a radius is applied. 65 of
      // 254 published listings are in this state
      // [Measured — production /api/map/listings, 2026-08-11]; the tile copy and
      // the empty state have to say so.
      expect(search(url)).toContain(NOGEO)
      expect(search(url, { lat: O_LAT, lng: O_LNG, radius: 5000 })).not.toContain(
        NOGEO,
      )
    })
  })

  it("4. no radius: ordering and membership are byte-identical to pre-migration", async () => {
    await withScratchDb("radius_backcompat", async (url) => {
      baseline(url)
      exec(url, SEED)

      // Captured through the 13-arg call, because that is the only shape that
      // exists yet — and the shape production is running right now.
      const before = searchLegacy(url)
      const beforeQ = searchLegacy(url, "coffee")

      applyFile(url, MIGRATION)

      // Same rows, same order, whether the caller uses the old shape or the new
      // one with all three radius params left NULL.
      expect(searchLegacy(url)).toEqual(before)
      expect(searchLegacy(url, "coffee")).toEqual(beforeQ)
      expect(search(url)).toEqual(before)
      expect(search(url, { q: "coffee" })).toEqual(beforeQ)
    })
  })

  it("5. a partial radius (no point, or no radius) leaves the filter inert", async () => {
    await withScratchDb("radius_partial", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const all = search(url).sort()

      // A radius with no coordinates, and coordinates with no radius. Neither
      // may guess a default or silently filter. The API layer answers 400 for
      // the first; the RPC's contract is simply to be inert.
      expect(search(url, { radius: 5 }).sort()).toEqual(all)
      expect(search(url, { lat: O_LAT, lng: O_LNG }).sort()).toEqual(all)
      expect(search(url, { lat: O_LAT, radius: 5 }).sort()).toEqual(all)
    })
  })

  it("6. p_sort='distance' orders nearest first, against the save_count tiebreaker", async () => {
    await withScratchDb("radius_sort", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Premise: without the distance key, save_count DESC gives FAR, MID, NEAR.
      expect(search(url, { lat: O_LAT, lng: O_LNG, radius: 200 })).toEqual([
        FAR,
        MID,
        NEAR,
      ])

      // With it, exactly reversed.
      expect(
        search(url, { lat: O_LAT, lng: O_LNG, radius: 200, sort: "distance" }),
      ).toEqual([NEAR, MID, FAR])
    })
  })

  it("7. is_featured still sorts first, even under a distance sort", async () => {
    await withScratchDb("radius_featured", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      exec(url, `UPDATE listings SET is_featured = true WHERE id = '${FAR}';`)

      // The farthest listing leads because it holds the manual placement slot.
      // 20260809000000 made this promise about the tier tiebreak; a new sort key
      // above is_featured would break it silently.
      expect(
        search(url, { lat: O_LAT, lng: O_LNG, radius: 200, sort: "distance" })[0],
      ).toBe(FAR)
    })
  })

  it("8. a nearer Ally does not outrank a farther Black-Owned listing", async () => {
    await withScratchDb("radius_ownership", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // ALLY is placed closer to the origin than any seeded listing.
      exec(
        url,
        `INSERT INTO listings (id, name, save_count, ownership_label, search_vector)
           VALUES ('${ALLY}', 'Ally Coffee', 900, 'ally', to_tsvector('english','coffee'));
         INSERT INTO listing_details_business (listing_id, price_range, lat, lng)
           VALUES ('${ALLY}', '$$', ${O_LAT}, ${O_LNG});`,
      )

      const ordered = search(url, {
        lat: O_LAT,
        lng: O_LNG,
        radius: 200,
        sort: "distance",
      })

      // Proximity is a strong signal but not an editorial one. The Ally listing
      // is the closest possible result — zero miles — and still sorts behind
      // every Black-Owned listing in range. moderation-policy.md:48.
      expect(ordered[ordered.length - 1]).toBe(ALLY)
      expect(ordered.slice(0, 3)).toEqual([NEAR, MID, FAR])
    })
  })

  it("9. facet_counts honors the same radius: the sidebar describes the result set", async () => {
    await withScratchDb("radius_facet_counts", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Unfiltered: three $$ (NEAR, MID, NOGEO) and one $$$ (FAR).
      expect(counts(url, "price")).toEqual({ $$: 3, $$$: 1 })
      expect(counts(url, "open_now")).toEqual({ open_now: 4 })

      // Within 10 miles only NEAR survives — so the sidebar must read $$ (1) and
      // nothing else. If these two functions ever disagree, the visitor sees
      // "Delivery (84)" over a list of 11: checkpoint 1.16 wearing a new hat.
      const near = { lat: O_LAT, lng: O_LNG, radius: 10 }
      expect(counts(url, "price", near)).toEqual({ $$: 1 })
      expect(counts(url, "open_now", near)).toEqual({ open_now: 1 })

      // And the counts match the actual result set, which is the whole promise.
      expect(search(url, near)).toHaveLength(1)
    })
  })

  it("10. exactly one overload of each function survives", async () => {
    await withScratchDb("radius_overloads", async (url) => {
      baseline(url)

      // Premise: the chain leaves exactly one of each before this migration.
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
      expect(overloads(url, "facet_counts")).toHaveLength(1)

      applyFile(url, MIGRATION)

      // A second entry here means a CREATE OR REPLACE silently became a CREATE.
      // PostgREST sends named arguments, so the old argument list would then
      // match BOTH overloads and Postgres would call every faceted search
      // ambiguous — the failure recorded at 20260809000000:30-36.
      const search16 = overloads(url, "search_listings_faceted")
      expect(search16).toHaveLength(1)
      expect(search16[0]).toContain("p_radius_miles")

      const counts12 = overloads(url, "facet_counts")
      expect(counts12).toHaveLength(1)
      expect(counts12[0]).toContain("p_radius_miles")
    })
  })

  it("11. the currently-deployed 13-arg call still resolves — the sequencing premise", async () => {
    await withScratchDb("radius_deployed_call", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // This is the exact named-argument list lib/listings/facets.ts sends today,
      // before any radius code exists. This migration is designed to be applied
      // to production FIRST; if this call stops resolving, applying it takes
      // /discover and /api/search down until the code catches up.
      const rows = query<{ id: string }>(
        url,
        `SELECT id FROM search_listings_faceted(
           p_q => 'coffee',
           p_category_id => NULL, p_city_id => NULL, p_entity_type => NULL,
           p_trust_tier => NULL, p_location_type => NULL,
           p_price_ranges => NULL, p_attribute_values => NULL,
           p_open_now => NULL, p_ownership_label => NULL,
           p_sort => 'relevance', p_limit => 24, p_offset => 0
         )`,
      )
      expect(rows.map((r) => r.id)).toEqual([NOGEO, FAR, MID, NEAR])

      // Same for the 9-arg facet_counts call getFacetCounts sends today.
      const priced = query<{ facet_key: string; facet_count: string }>(
        url,
        `SELECT facet_key, facet_count FROM facet_counts(
           p_q => NULL, p_category_id => NULL, p_city_id => NULL,
           p_entity_type => NULL, p_trust_tier => NULL, p_location_type => NULL,
           p_price_ranges => NULL, p_attribute_values => NULL, p_open_now => NULL
         ) WHERE facet_kind = 'price'`,
      )
      expect(priced).toHaveLength(2)
    })
  })

  it("is idempotent: a second and third apply change nothing", async () => {
    await withScratchDb("radius_idempotent", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const once = search(url, { lat: O_LAT, lng: O_LNG, radius: 200, sort: "distance" })
      expect(() => applyFile(url, MIGRATION)).not.toThrow()
      expect(() => applyFile(url, MIGRATION)).not.toThrow()

      expect(
        search(url, { lat: O_LAT, lng: O_LNG, radius: 200, sort: "distance" }),
      ).toEqual(once)
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
      expect(overloads(url, "facet_counts")).toHaveLength(1)
    })
  })

  it("rolls back: the documented down plan restores the previous definitions", async () => {
    await withScratchDb("radius_rollback", async (url) => {
      baseline(url)
      exec(url, SEED)

      const before = searchLegacy(url, "coffee")
      const priceBefore = countsLegacy(url, "price")

      applyFile(url, MIGRATION)
      expect(search(url, { lat: O_LAT, lng: O_LNG, radius: 10 })).toEqual([NEAR])

      // Step 1 of the down plan, verbatim.
      exec(url, `DROP FUNCTION IF EXISTS search_listings_faceted(${SEARCH_16});`)
      exec(url, `DROP FUNCTION IF EXISTS facet_counts(${COUNTS_12});`)
      expect(overloads(url, "search_listings_faceted")).toHaveLength(0)
      expect(overloads(url, "facet_counts")).toHaveLength(0)

      // Step 2: re-run 20260809000000 in full for search_listings_faceted, and
      // lines 134-273 of 20260622000001 for facet_counts. Slicing that block is
      // what the down plan instructs a human to do; re-running the whole file
      // would also re-create the dead 12-arg search overload.
      applyFile(url, TIEBREAK)
      const baseSql = fs.readFileSync(RPC_BASE, "utf8").split("\n")
      exec(url, baseSql.slice(133, 273).join("\n"))

      expect(searchLegacy(url, "coffee")).toEqual(before)
      expect(countsLegacy(url, "price")).toEqual(priceBefore)
      expect(overloads(url, "search_listings_faceted")).toHaveLength(1)
      expect(overloads(url, "facet_counts")).toHaveLength(1)

      // And the radius arguments are gone, which is the point of the ordering
      // warning in the migration footer: roll back the CODE first, then this.
      expect(overloads(url, "search_listings_faceted")[0]).not.toContain(
        "p_radius_miles",
      )
    })
  })
})
