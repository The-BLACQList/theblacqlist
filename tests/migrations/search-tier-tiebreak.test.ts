// =============================================================================
// Migration test: 20260809000000_search_tier_tiebreak.sql
// =============================================================================
// Applies the real migration chain to a scratch Postgres and asserts the
// ORDERING PROMISES behaviorally — by calling the real function against real
// rows, not by parsing SQL text.
//
// THE CHAIN MATTERS. An earlier version of this file applied only
// 20260622000001 (the 12-arg RPC) and went green against a function the
// application never calls: 20260707000000 later added `p_ownership_label` and
// DROPped the 12-arg overload, and lib/listings/facets.ts always sends that
// argument. Testing the 12-arg signature proved nothing about production and
// hid a defect that a staging rehearsal caught. Always apply:
//     20260622000001  ->  20260707000000  ->  20260809000000
//
// The seven cases, and what each one protects:
//   1. Search, same band       -> Growth sorts above Free on an equal match.
//   2. Search, different bands -> a materially better-matching non-boosted
//                                 listing still wins. THIS IS THE PROMISE. If
//                                 it fails, the build is wrong and must not ship.
//   3. Browse (p_q null)       -> ordering byte-identical to pre-migration.
//                                 Tier must have no effect off a real query.
//   4. Explicit sort           -> p_sort='name' is alphabetical, unperturbed.
//   5. is_featured still first -> the manual placement engine's paid slot is
//                                 not displaced by the tier tiebreak.
//   6. Ownership is not for sale -> a PAYING Ally listing still sorts below a
//                                 FREE Black-Owned one. HISTORICAL as of
//                                 20260923000000 — see the note on the case.
//   7. One overload only       -> the exact defect above can never recur.
// Plus the ownership filter still working, idempotency, and the rollback.
//
// Every ordering case is built so the STABLE TIEBREAKERS WOULD PRODUCE THE
// OPPOSITE ORDER (the loser is given the higher save_count). A passing test
// therefore proves the intended key did the work, not incidental row order.
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

const RPC_BASE = path.join(
  MIGRATIONS_DIR,
  "20260622000001_search_listings_faceted_rpc.sql",
)
const OWNERSHIP = path.join(
  MIGRATIONS_DIR,
  "20260707000000_listings_ownership_label.sql",
)
const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260809000000_search_tier_tiebreak.sql",
)

// The 13-arg signature the application actually calls, and the dead 12-arg one
// that must never come back. Used by the overload guard and the rollback test.
const SIG_13 =
  "text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, text, int, int"

// Minimum schema the RPC touches. Only the columns/relations referenced by
// search_listings_faceted and facet_counts — enough for both to plan and run.
// `ownership_label` is deliberately NOT declared here: 20260707000000 adds it,
// and letting that migration do so is part of what this file is testing.
// `is_open_now` is stubbed: p_open_now is never true in these tests, but the
// function must EXIST for the body to plan.
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
  price_range text
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
const FREE = "11111111-1111-1111-1111-111111111111"
const GROWTH = "22222222-2222-2222-2222-222222222222"
const PREMIUM = "33333333-3333-3333-3333-333333333333"
const STARTER = "44444444-4444-4444-4444-444444444444"
const ALLY = "55555555-5555-5555-5555-555555555555"

/**
 * Bring a scratch db to the state production is in, immediately before this
 * migration: fixture schema, base RPC, then the ownership pivot.
 */
function baseline(url: string) {
  exec(url, FIXTURE)
  applyFile(url, RPC_BASE)
  applyFile(url, OWNERSHIP)
}

// Seed for the ordering cases. Every row takes the column default
// ownership_label='black_owned', so cases 1-5 compare listings WITHIN one
// ownership group and the editorial key is a constant that cannot explain the
// result. Case 6 is the one that varies it.
//
// EQUAL MATCH pair (same search_vector text -> identical ts_rank, so certainly
// the same band): FREE vs GROWTH. FREE is given the HIGHER save_count, so the
// pre-migration stable tiebreaker puts FREE first. Post-migration, GROWTH must
// win — which can only happen via the tier key.
//
// BETTER MATCH: STARTER (a non-boosted tier) carries the term many times, so it
// lands in a strictly higher band than the Growth listing. It must win despite
// having the LOWEST save_count and no paid weight.
const SEED = `
INSERT INTO listings (id, name, tier, save_count, published_at, search_vector) VALUES
  ('${FREE}',   'Alpha Coffee',  'free',    900, '2026-01-01', to_tsvector('english', 'coffee')),
  ('${GROWTH}', 'Zulu Coffee',   'growth',  100, '2026-01-01', to_tsvector('english', 'coffee')),
  ('${STARTER}','Bravo Coffee',  'starter',   1, '2026-01-01',
     to_tsvector('english', repeat('coffee ', 40)));
`

/** Call the RPC and return listing ids in the order it produced. */
function search(
  url: string,
  opts: {
    q?: string | null
    sort?: string
    limit?: number
    ownership?: string | null
  } = {},
): string[] {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  const ownership = opts.ownership ? `'${opts.ownership}'` : "NULL"
  const sort = opts.sort ?? "relevance"
  const limit = opts.limit ?? 24
  const rows = query<{ id: string }>(
    url,
    // Always passes p_ownership_label, exactly as lib/listings/facets.ts does
    // (it is a required field of ResolvedFacetParams, always set at :169) —
    // so these tests exercise the same overload production resolves to.
    `SELECT id FROM search_listings_faceted(
       p_q => ${q},
       p_ownership_label => ${ownership},
       p_sort => '${sort}',
       p_limit => ${limit}
     )`,
  )
  return rows.map((r) => r.id)
}

/**
 * The 2dp relevance band a listing lands in for `q` — the same
 * `round(rank, 2)` bucket the migration's ORDER BY uses.
 *
 * Throws on an unknown id rather than returning undefined. A record lookup
 * would let `expect(b[A]).toBe(b[B])` pass vacuously on two typo'd ids,
 * because `undefined === undefined`; the band premises in tests 1 and 2 are
 * load-bearing enough that they must fail loudly instead.
 */
function band(url: string, q: string, id: string): number {
  const rows = query<{ band: string }>(
    url,
    `SELECT round(ts_rank(search_vector, websearch_to_tsquery('english', '${q}'))::numeric, 2)::text AS band
       FROM listings WHERE id = '${id}'`,
  )
  const row = rows[0]
  if (!row) throw new Error(`No listing ${id} — cannot read its relevance band.`)
  return Number(row.band)
}

/** Every live signature of the RPC, as Postgres reports it. */
function overloads(url: string): string[] {
  return query<{ args: string }>(
    url,
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'search_listings_faceted' AND n.nspname = 'public'
      ORDER BY 1`,
  ).map((r) => r.args)
}

describe.skipIf(!DB_REACHABLE)("20260809000000_search_tier_tiebreak", () => {
  it("1. search, same band: Growth sorts above Free on an equal match", async () => {
    await withScratchDb("tier_tiebreak_same_band", async (url) => {
      baseline(url)
      exec(url, SEED)

      // Isolate the equal-match pair; STARTER matches better and leads both.
      const pair = (u: string) =>
        search(u, { q: "coffee" }).filter((id) => id === FREE || id === GROWTH)

      // Premise: pre-migration, the stable save_count tiebreaker puts FREE first.
      expect(pair(url)).toEqual([FREE, GROWTH])

      applyFile(url, MIGRATION)

      // Premise check — these two really are in the same band.
      expect(band(url, "coffee", GROWTH)).toBe(band(url, "coffee", FREE))

      // The tiebreak flips them, against the save_count ordering.
      expect(pair(url)).toEqual([GROWTH, FREE])
    })
  })

  it("2. search, different bands: a better-matching unboosted listing still wins — THE PROMISE", async () => {
    await withScratchDb("tier_tiebreak_cross_band", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Premise: STARTER is in a strictly higher band than GROWTH.
      expect(band(url, "coffee", STARTER)).toBeGreaterThan(band(url, "coffee", GROWTH))

      // The better match leads, despite being unboosted AND having the lowest
      // save_count. A subscription never outranks a better match.
      expect(search(url, { q: "coffee" })[0]).toBe(STARTER)
    })
  })

  it("3. browse (p_q null): ordering is byte-identical to pre-migration", async () => {
    await withScratchDb("tier_tiebreak_browse", async (url) => {
      baseline(url)
      exec(url, SEED)

      const before = search(url, { q: null })
      applyFile(url, MIGRATION)
      const after = search(url, { q: null })

      expect(after).toEqual(before)
      // And concretely: save_count order, so GROWTH (100) stays behind FREE (900).
      expect(after).toEqual([FREE, GROWTH, STARTER])
    })
  })

  it("4. explicit sort: p_sort='name' stays alphabetical, unperturbed by tier", async () => {
    await withScratchDb("tier_tiebreak_name_sort", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Alpha / Bravo / Zulu — the Growth listing is last and stays last.
      expect(search(url, { q: "coffee", sort: "name" })).toEqual([
        FREE,
        STARTER,
        GROWTH,
      ])
    })
  })

  it("5. is_featured still sorts first: the manual placement slot is not displaced", async () => {
    await withScratchDb("tier_tiebreak_featured", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // A featured FREE listing outranks a Growth listing in the same band,
      // and even outranks the strictly better-matching Starter listing.
      exec(url, `UPDATE listings SET is_featured = true WHERE id = '${FREE}';`)
      expect(search(url, { q: "coffee" })[0]).toBe(FREE)
    })
  })

  it("6. a PAYING Ally still sorts below a FREE Black-Owned listing — ownership is not for sale", async () => {
    await withScratchDb("tier_tiebreak_ownership", async (url) => {
      baseline(url)
      applyFile(url, MIGRATION)

      // Same band (identical vectors). The Ally listing is stacked to win on
      // every other key: it is on Growth (tier weight 1 vs 0) AND holds the
      // higher save_count. Only the editorial centering key can put the free
      // Black-Owned listing first.
      //
      // READ THIS BEFORE CITING THIS CASE. The ordering it asserts is TRUE OF
      // THE 2026-08-09 SCHEMA AND NO LONGER TRUE OF PRODUCTION. This file
      // applies the chain only through 20260809000000, so it still correctly
      // tests that historical state and still passes. But
      // 20260923000000_activity_ranking.sql removed
      // `(ownership_label = 'black_owned') DESC` from the ORDER BY entirely
      // [Decision — founder, 2026-09-21, refined 2026-09-23]: a paying Ally
      // that is more active now DOES sort above a quiet free Black-Owned
      // listing, and that is the intended behavior. The live guard for the new
      // rule is case 9 of tests/migrations/activity-score.test.ts.
      //
      // The compliance claim this comment used to make is therefore also stale.
      // moderation-policy.md:48 ("do not make a paid tier, placement, or badge
      // contingent on the Black-Owned label") still binds and is still met —
      // but it is met because price and placement are decoupled from the label,
      // NOT because of the ordering below. Do not change the assertion; it
      // documents what 20260809000000 did.
      exec(
        url,
        `INSERT INTO listings (id, name, tier, save_count, ownership_label, search_vector) VALUES
           ('${FREE}', 'Free Black-Owned Coffee', 'free',     1, 'black_owned', to_tsvector('english','coffee')),
           ('${ALLY}', 'Paid Ally Coffee',        'growth', 900, 'ally',        to_tsvector('english','coffee'));`,
      )

      expect(search(url, { q: "coffee" })).toEqual([FREE, ALLY])
    })
  })

  it("7. exactly one overload survives: the dead 12-arg signature is gone", async () => {
    await withScratchDb("tier_tiebreak_overloads", async (url) => {
      baseline(url)

      // The ownership pivot left exactly one function. Guard that premise, so
      // this test fails loudly if the chain itself ever regresses.
      expect(overloads(url)).toHaveLength(1)

      applyFile(url, MIGRATION)

      // Still exactly one — and it is the 13-arg one the app calls. A second
      // entry here means a CREATE OR REPLACE silently became a CREATE, which is
      // how the tiebreak shipped as a no-op to staging on 2026-08-09.
      const after = overloads(url)
      expect(after).toHaveLength(1)
      expect(after[0]).toContain("p_ownership_label")
    })
  })

  it("the ownership filter still works: p_ownership_label narrows the result set", async () => {
    await withScratchDb("tier_tiebreak_ownership_filter", async (url) => {
      baseline(url)
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO listings (id, name, tier, ownership_label, search_vector) VALUES
           ('${FREE}', 'Black-Owned Coffee', 'free', 'black_owned', to_tsvector('english','coffee')),
           ('${ALLY}', 'Ally Coffee',        'free', 'ally',        to_tsvector('english','coffee'));`,
      )

      // The body was rewritten wholesale; a dropped WHERE clause would silently
      // break the Ownership facet control rather than fail a type check.
      expect(search(url, { q: "coffee", ownership: "ally" })).toEqual([ALLY])
      expect(search(url, { q: "coffee", ownership: "black_owned" })).toEqual([
        FREE,
      ])
      expect(search(url, { q: "coffee" })).toHaveLength(2)
    })
  })

  it("is idempotent: a second and third apply change nothing", async () => {
    await withScratchDb("tier_tiebreak_idempotent", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const once = search(url, { q: "coffee" })
      expect(() => applyFile(url, MIGRATION)).not.toThrow()
      expect(() => applyFile(url, MIGRATION)).not.toThrow()
      expect(search(url, { q: "coffee" })).toEqual(once)
      expect(overloads(url)).toHaveLength(1)
    })
  })

  it("rolls back: the documented down plan restores pre-migration ordering", async () => {
    await withScratchDb("tier_tiebreak_rollback", async (url) => {
      baseline(url)
      exec(url, SEED)

      const before = search(url, { q: "coffee" })
      applyFile(url, MIGRATION)
      expect(search(url, { q: "coffee" })).not.toEqual(before)

      // The down plan as written in the migration footer: drop this version,
      // then re-run 20260707000000 (its section 1 is idempotent, so the whole
      // file is safe to re-apply).
      exec(url, `DROP FUNCTION IF EXISTS search_listings_faceted(${SIG_13});`)
      applyFile(url, OWNERSHIP)

      expect(search(url, { q: "coffee" })).toEqual(before)
      expect(overloads(url)).toHaveLength(1)
    })
  })

  it("Premium gets no more ranking weight than Growth — the weight is binary", async () => {
    await withScratchDb("tier_tiebreak_binary", async (url) => {
      baseline(url)
      applyFile(url, MIGRATION)

      // Same band, same tier weight. Premium has the LOWER save_count, so if
      // the weight laddered by tier it would still lead. It must not.
      exec(
        url,
        `INSERT INTO listings (id, name, tier, save_count, search_vector) VALUES
           ('${GROWTH}',  'Growth Co',  'growth',  500, to_tsvector('english','coffee')),
           ('${PREMIUM}', 'Premium Co', 'premium', 100, to_tsvector('english','coffee'));`,
      )

      expect(search(url, { q: "coffee" })).toEqual([GROWTH, PREMIUM])
    })
  })
})
