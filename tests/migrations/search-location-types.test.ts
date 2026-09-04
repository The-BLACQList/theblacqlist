// =============================================================================
// Migration test: 20260904000000_search_location_types.sql
// =============================================================================
// Applies the real migration chain to a scratch Postgres and asserts multi-select
// location filtering behaviorally — by calling the real functions, not by parsing
// SQL text.
//
// THE CHAIN MATTERS. This migration DROPs two signatures and re-creates both
// faceted-search functions, so a test that applied only part of the chain would
// be exercising a function the application never calls. Always apply, in order:
//   20260622000001 -> 20260707000000 -> 20260809000000 -> 20260811010000 -> this
//
// What each case protects:
//   1.  the plural filters             -> a four-value array returns exactly the
//                                         four kinds of listing asked for.
//   2.  Products & Services            -> the founder's actual finding: the bin
//                                         returns online / national / mobile /
//                                         service-area listings and excludes
//                                         brick-and-mortar.
//   3.  the singular still works       -> the deployed caller is untouched.
//   4.  NULL plural = no change        -> every existing caller is unaffected.
//   5.  EMPTY array is inert           -> clearing the filter restores the page
//                                         instead of emptying it. `array_length`
//                                         returns NULL for '{}', not 0 — the one
//                                         place this idiom bites.
//   6.  both params = intersection     -> defined behavior, not accidental.
//   7.  unknown values are inert       -> the RPC does not error on a value it
//                                         has never seen; rejecting it is the API
//                                         layer's job (a 400), not the DB's.
//   8.  editorial centering holds      -> a plural filter does not disturb the
//                                         ownership ordering. moderation-policy.md:48.
//   9.  facet_counts agrees            -> sidebar counts describe the SAME set the
//                                         result list holds. A count that
//                                         describes a different query is
//                                         checkpoint 1.16 again.
//   10. exactly one overload each      -> the ambiguous-overload failure recorded
//                                         in 20260809000000:30-36 can never recur.
//   11. the deployed 16-arg call       -> THE SEQUENCING PREMISE. This migration
//                                         ships BEFORE the code that uses it; if
//                                         the currently-deployed 16-argument call
//                                         stops resolving, applying it to
//                                         production takes /discover down.
//   12. the rollback trap              -> running 20260811010000 as a rollback
//                                         WITHOUT the explicit DROP first leaves
//                                         TWO overloads. The down plan's step 1
//                                         is load-bearing, and this case is the
//                                         proof that the ⚠ in the footer is real.
//   Plus idempotency and the documented down plan.
//
// Ordering cases are built so the STABLE TIEBREAKERS WOULD PRODUCE THE OPPOSITE
// ORDER (the Ally listing is given the HIGHEST save_count). A passing test
// therefore proves the ordering key did the work, not incidental row order.
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
const TIEBREAK = path.join(
  MIGRATIONS_DIR,
  "20260809000000_search_tier_tiebreak.sql",
)
const RADIUS = path.join(
  MIGRATIONS_DIR,
  "20260811010000_search_radius_filter.sql",
)
const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260904000000_search_location_types.sql",
)

// The two signatures this migration creates, and the two it replaces, as BARE
// TYPE LISTS — the form `DROP FUNCTION` takes. Postgres reports `integer` where
// the SQL files write `int`; both spellings are correct in their own context,
// and these constants are the pg_proc side.
//
// These same four constants are also what the overload assertions compare
// against, through `identityTypes()` below. That is deliberate: one definition
// serving both the DROP statements and the assertions means a typo in a DROP
// list fails a test instead of silently dropping nothing.
const SEARCH_17 =
  "text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text, " +
  "double precision, double precision, double precision, text, integer, integer"
const COUNTS_13 =
  "text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, " +
  "double precision, double precision, double precision"
const SEARCH_16 =
  "text, uuid, uuid, text, text, text, text[], uuid[], boolean, text, " +
  "double precision, double precision, double precision, text, integer, integer"
const COUNTS_12 =
  "text, uuid, uuid, text, text, text, text[], uuid[], boolean, " +
  "double precision, double precision, double precision"

// Minimum schema both RPCs touch. Identical to search-radius-filter.test.ts:93 —
// `lat`/`lng` stay `numeric` to match production (20260510000000:455-456), since
// the radius migration in the chain casts them and declaring them as double
// precision here would hide a cast defect.
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
const PHYS = "11111111-1111-1111-1111-111111111111"
const VIRT = "22222222-2222-2222-2222-222222222222"
const NATL = "33333333-3333-3333-3333-333333333333"
const MOBILE = "44444444-4444-4444-4444-444444444444"
const HYBR = "55555555-5555-5555-5555-555555555555"
const ALLY = "66666666-6666-6666-6666-666666666666"

// The four location types the Products & Services bin asks for — the founder's
// description in their own words: "operate solely online, may not have an
// address, may be mobile and/or service based." Sourced from
// lib/constants/listing.ts:57-92 (VALID_LOCATION_TYPES), never retyped in the
// app; retyped once here so the test would catch a change to that constant
// rather than silently following it.
const PRODUCTS_AND_SERVICES = ["virtual", "service_area", "national", "traveling"]

// One listing per location type. SAVE COUNTS ARE DELIBERATE: the stable
// tiebreaker is `save_count DESC`, so ALLY (900, the highest) would lead every
// unfiltered list — which is exactly what case 8 asserts must NOT happen.
const SEED = `
INSERT INTO listings (id, name, location_type, save_count, search_vector) VALUES
  ('${PHYS}',   'Physical Cafe',  'physical',  5,   to_tsvector('english','shop')),
  ('${VIRT}',   'Virtual Studio', 'virtual',   1,   to_tsvector('english','shop')),
  ('${NATL}',   'National Shop',  'national',  50,  to_tsvector('english','shop')),
  ('${MOBILE}', 'Mobile Barber',  'traveling', 500, to_tsvector('english','shop')),
  ('${HYBR}',   'Hybrid Space',   'hybrid',    3,   to_tsvector('english','shop'));

INSERT INTO listing_details_business (listing_id, price_range) VALUES
  ('${PHYS}',   '$$'),
  ('${VIRT}',   '$'),
  ('${NATL}',   '$'),
  ('${MOBILE}', '$$'),
  ('${HYBR}',   '$$$');
`

/** Bring a scratch db to exactly the state production is in before this migration. */
function baseline(url: string) {
  exec(url, FIXTURE)
  applyFile(url, RPC_BASE)
  applyFile(url, OWNERSHIP)
  applyFile(url, TIEBREAK)
  applyFile(url, RADIUS)
}

/** Postgres array literal, or NULL. `[]` becomes `ARRAY[]::text[]`, on purpose. */
function arr(v: string[] | null | undefined): string {
  if (v === undefined || v === null) return "NULL"
  return `ARRAY[${v.map((s) => `'${s}'`).join(",")}]::text[]`
}

/** Call the RPC with the new 17-arg shape and return ids in the order produced. */
function search(
  url: string,
  opts: {
    q?: string | null
    locationType?: string | null
    locationTypes?: string[] | null
    sort?: string
  } = {},
): string[] {
  const q = opts.q === undefined || opts.q === null ? "NULL" : `'${opts.q}'`
  const single =
    opts.locationType === undefined || opts.locationType === null
      ? "NULL"
      : `'${opts.locationType}'`
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => ${q},
       p_location_type => ${single},
       p_location_types => ${arr(opts.locationTypes)},
       p_sort => '${opts.sort ?? "relevance"}',
       p_limit => 24, p_offset => 0
     )`,
  ).map((r) => r.id)
}

/**
 * The 16-arg call as it exists on `main` today — the only shape that resolves
 * before this migration is applied, and the shape a rollback must restore.
 * Kept separate from `search()` on purpose: a helper that silently worked in
 * both worlds would hide exactly the compatibility break these cases test for.
 */
function searchLegacy(url: string, locationType: string | null = null): string[] {
  return query<{ id: string }>(
    url,
    `SELECT id FROM search_listings_faceted(
       p_q => NULL,
       p_location_type => ${locationType === null ? "NULL" : `'${locationType}'`},
       p_sort => 'relevance', p_limit => 24, p_offset => 0
     )`,
  ).map((r) => r.id)
}

/** facet_counts in its pre-migration 12-arg shape. */
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

/** facet_counts, reduced to { key -> count } for one facet kind. */
function counts(
  url: string,
  kind: string,
  opts: { locationType?: string | null; locationTypes?: string[] | null } = {},
): Record<string, number> {
  const single =
    opts.locationType === undefined || opts.locationType === null
      ? "NULL"
      : `'${opts.locationType}'`
  const rows = query<{ facet_key: string; facet_count: string }>(
    url,
    `SELECT facet_key, facet_count FROM facet_counts(
       p_location_type => ${single},
       p_location_types => ${arr(opts.locationTypes)}
     ) WHERE facet_kind = '${kind}'`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.facet_key] = Number(r.facet_count)
  return out
}

/**
 * Every live signature of a function, as Postgres reports it — WITH parameter
 * names: "p_q text, p_category_id uuid, ...". Use this when the assertion is
 * about the names (`toContain("p_location_types")`).
 */
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

/**
 * The same signatures reduced to bare types, so they can be compared against the
 * DROP-list constants above. Every parameter reads "p_name type", and parameter
 * names are single identifiers, so stripping to the first space is exact — types
 * that themselves contain a space ("double precision") survive intact.
 */
function identityTypes(url: string, fn: string): string[] {
  return overloads(url, fn).map((sig) =>
    sig
      .split(", ")
      .map((param) => param.replace(/^\w+\s+/, ""))
      .join(", "),
  )
}

describe.skipIf(!DB_REACHABLE)("20260904000000_search_location_types", () => {
  it("1. the plural parameter filters to exactly the values given", async () => {
    await withScratchDb("loctypes_filters", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      expect(search(url, { locationTypes: ["virtual"] })).toEqual([VIRT])
      expect(search(url, { locationTypes: ["virtual", "national"] }).sort()).toEqual(
        [NATL, VIRT].sort(),
      )
      expect(
        search(url, { locationTypes: ["physical", "hybrid"] }).sort(),
      ).toEqual([HYBR, PHYS].sort())
    })
  })

  it("2. the Products & Services bin returns online/national/mobile and excludes brick-and-mortar", async () => {
    await withScratchDb("loctypes_products_services", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // The whole reason this migration exists. The bin previously pointed at
      // /discover?type=service_provider — an ENTITY-type filter — and returned
      // nothing, because 100% of the seeded catalog is entity_type='business'
      // [Measured — production, 2026-09-02].
      const bin = search(url, { locationTypes: PRODUCTS_AND_SERVICES }).sort()
      expect(bin).toEqual([MOBILE, NATL, VIRT].sort())

      // And the two that must NOT be in it. A bin that quietly included the
      // storefronts would look full and be wrong — worse than empty.
      expect(bin).not.toContain(PHYS)
      expect(bin).not.toContain(HYBR)
    })
  })

  it("3. the singular parameter still filters exactly as before", async () => {
    await withScratchDb("loctypes_singular", async (url) => {
      baseline(url)
      exec(url, SEED)

      const beforePhysical = searchLegacy(url, "physical")
      const beforeVirtual = searchLegacy(url, "virtual")

      applyFile(url, MIGRATION)

      // Same call, same shape, same rows. The singular is retained precisely so
      // this keeps working while the code half is still on its way.
      expect(searchLegacy(url, "physical")).toEqual(beforePhysical)
      expect(searchLegacy(url, "virtual")).toEqual(beforeVirtual)
      expect(search(url, { locationType: "physical" })).toEqual(beforePhysical)
    })
  })

  it("4. no location params: ordering and membership are byte-identical to pre-migration", async () => {
    await withScratchDb("loctypes_backcompat", async (url) => {
      baseline(url)
      exec(url, SEED)

      const before = searchLegacy(url)
      const priceBefore = countsLegacy(url, "price")

      applyFile(url, MIGRATION)

      expect(searchLegacy(url)).toEqual(before)
      expect(search(url)).toEqual(before)
      expect(countsLegacy(url, "price")).toEqual(priceBefore)
      expect(counts(url, "price")).toEqual(priceBefore)
    })
  })

  it("5. an EMPTY array leaves the filter inert — clearing it restores the page", async () => {
    await withScratchDb("loctypes_empty_array", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const all = search(url).sort()

      // `array_length('{}', 1)` is NULL, not 0. Without the explicit
      // array_length test in the predicate, `location_type = ANY('{}')` matches
      // nothing and unticking the last checkbox would empty the results page
      // instead of restoring it. This is the case that catches that.
      expect(search(url, { locationTypes: [] }).sort()).toEqual(all)
      expect(counts(url, "price", { locationTypes: [] })).toEqual(
        counts(url, "price"),
      )
    })
  })

  it("6. singular and plural together intersect, they do not union", async () => {
    await withScratchDb("loctypes_intersection", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Defined behavior, not accidental. The two predicates are AND'd, so the
      // narrower one wins. No deployed caller sends both — this case exists so
      // that stays true by test rather than by hope.
      expect(
        search(url, {
          locationType: "virtual",
          locationTypes: ["virtual", "national"],
        }),
      ).toEqual([VIRT])

      // Disjoint values return nothing rather than everything.
      expect(
        search(url, { locationType: "physical", locationTypes: ["virtual"] }),
      ).toEqual([])
    })
  })

  it("7. an unknown value in the array is inert, not an error", async () => {
    await withScratchDb("loctypes_unknown_value", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // The RPC's contract is to match what it is given. Rejecting a value that
      // is not in VALID_LOCATION_TYPES is the API layer's job — a 400 from the
      // zod schema in lib/validations/search.ts, which validates elementwise so
      // a bad value cannot be silently dropped and WIDEN the result set.
      // A 500 from the database here would turn a malformed URL into an outage.
      expect(
        search(url, { locationTypes: ["virtual", "not_a_real_type"] }),
      ).toEqual([VIRT])
      expect(search(url, { locationTypes: ["not_a_real_type"] })).toEqual([])
    })
  })

  it("8. editorial centering survives the plural filter", async () => {
    await withScratchDb("loctypes_ownership", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // ALLY is virtual, so it lands inside the Products & Services bin, and it
      // carries the highest save_count in the fixture — the stable tiebreaker
      // would put it first.
      exec(
        url,
        `INSERT INTO listings (id, name, location_type, save_count, ownership_label, search_vector)
           VALUES ('${ALLY}', 'Ally Studio', 'virtual', 900, 'ally', to_tsvector('english','shop'));
         INSERT INTO listing_details_business (listing_id, price_range)
           VALUES ('${ALLY}', '$');`,
      )

      const ordered = search(url, { locationTypes: PRODUCTS_AND_SERVICES })

      // It sorts last anyway. Filtering is not ranking: narrowing the set must
      // not reshuffle it. moderation-policy.md:48.
      expect(ordered[ordered.length - 1]).toBe(ALLY)
      expect(ordered.slice(0, 3)).toEqual([MOBILE, NATL, VIRT])
    })
  })

  it("9. facet_counts honors the same plural: the sidebar describes the result set", async () => {
    await withScratchDb("loctypes_facet_counts", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // Unfiltered: two $ (VIRT, NATL), two $$ (PHYS, MOBILE), one $$$ (HYBR).
      expect(counts(url, "price")).toEqual({ $: 2, $$: 2, $$$: 1 })
      expect(counts(url, "open_now")).toEqual({ open_now: 5 })

      // Inside the bin only VIRT, NATL and MOBILE survive — so the sidebar must
      // read $ (2) and $$ (1), and nothing else. If these two functions ever
      // disagree, the visitor sees "Delivery (84)" over a list of 11:
      // checkpoint 1.16 wearing a new hat.
      const bin = { locationTypes: PRODUCTS_AND_SERVICES }
      expect(counts(url, "price", bin)).toEqual({ $: 2, $$: 1 })
      expect(counts(url, "open_now", bin)).toEqual({ open_now: 3 })

      // And the counts match the actual result set, which is the whole promise.
      expect(search(url, bin)).toHaveLength(3)
    })
  })

  it("10. exactly one overload of each function survives", async () => {
    await withScratchDb("loctypes_overloads", async (url) => {
      baseline(url)

      // Premise: the chain leaves exactly one of each before this migration.
      expect(identityTypes(url, "search_listings_faceted")).toEqual([SEARCH_16])
      expect(identityTypes(url, "facet_counts")).toEqual([COUNTS_12])

      applyFile(url, MIGRATION)

      // A second entry here means a CREATE OR REPLACE silently became a CREATE.
      // PostgREST sends named arguments, so the old argument list would then
      // match BOTH overloads and Postgres would reject every faceted search as
      // not unique — the failure recorded at 20260809000000:30-36.
      expect(identityTypes(url, "search_listings_faceted")).toEqual([SEARCH_17])
      expect(identityTypes(url, "facet_counts")).toEqual([COUNTS_13])

      // And the new parameter is named what the application will call it. The
      // type lists above would pass just as happily on a typo'd name, which
      // PostgREST — which binds by name, not position — would not survive.
      expect(overloads(url, "search_listings_faceted")[0]).toContain(
        "p_location_types text[]",
      )
      expect(overloads(url, "facet_counts")[0]).toContain(
        "p_location_types text[]",
      )
    })
  })

  it("11. the currently-deployed 16-arg call still resolves — the sequencing premise", async () => {
    await withScratchDb("loctypes_deployed_call", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      // This is the exact named-argument list lib/listings/facets.ts sends today,
      // before any location_types code exists. This migration is designed to be
      // applied to production FIRST; if this call stops resolving, applying it
      // takes /discover and /api/search down until the code catches up.
      const rows = query<{ id: string }>(
        url,
        `SELECT id FROM search_listings_faceted(
           p_q => 'shop',
           p_category_id => NULL, p_city_id => NULL, p_entity_type => NULL,
           p_trust_tier => NULL, p_location_type => NULL,
           p_price_ranges => NULL, p_attribute_values => NULL,
           p_open_now => NULL, p_ownership_label => NULL,
           p_lat => NULL, p_lng => NULL, p_radius_miles => NULL,
           p_sort => 'relevance', p_limit => 24, p_offset => 0
         )`,
      )
      expect(rows.map((r) => r.id)).toEqual([MOBILE, NATL, PHYS, HYBR, VIRT])

      // Same for the 12-arg facet_counts call getFacetCounts sends today.
      const priced = query<{ facet_key: string; facet_count: string }>(
        url,
        `SELECT facet_key, facet_count FROM facet_counts(
           p_q => NULL, p_category_id => NULL, p_city_id => NULL,
           p_entity_type => NULL, p_trust_tier => NULL, p_location_type => NULL,
           p_price_ranges => NULL, p_attribute_values => NULL, p_open_now => NULL,
           p_lat => NULL, p_lng => NULL, p_radius_miles => NULL
         ) WHERE facet_kind = 'price'`,
      )
      expect(priced).toHaveLength(3)
    })
  })

  it("12. the rollback trap: re-running 20260811010000 without the DROP leaves two overloads", async () => {
    await withScratchDb("loctypes_rollback_trap", async (url) => {
      baseline(url)
      applyFile(url, MIGRATION)

      // 20260811010000's own leading DROPs target the 13-arg / 9-arg signatures.
      // After this migration the functions live at 17 / 13, so those DROPs are
      // no-ops and its CREATE OR REPLACE becomes a CREATE.
      applyFile(url, RADIUS)

      // Two live overloads — the exact failure the DROP discipline exists to
      // prevent, reached from the ROLLBACK side rather than the forward side.
      // This is why step 1 of the down plan is not optional, and why it carries
      // a ⚠ in the migration footer.
      expect(overloads(url, "search_listings_faceted")).toHaveLength(2)
      expect(overloads(url, "facet_counts")).toHaveLength(2)

      // And it is not theoretical: a named-argument call matching the older list
      // now matches the 16-arg version exactly AND the 17-arg version by
      // default, and Postgres refuses to choose — verbatim, "function
      // search_listings_faceted(...) is not unique". This is what /discover
      // would return on every request in that state.
      expect(() =>
        query(
          url,
          `SELECT id FROM search_listings_faceted(
             p_q => NULL, p_location_type => NULL,
             p_sort => 'relevance', p_limit => 24, p_offset => 0
           )`,
        ),
      ).toThrow(/is not unique/i)
    })
  })

  it("is idempotent: a second and third apply change nothing", async () => {
    await withScratchDb("loctypes_idempotent", async (url) => {
      baseline(url)
      exec(url, SEED)
      applyFile(url, MIGRATION)

      const once = search(url, { locationTypes: PRODUCTS_AND_SERVICES })
      expect(() => applyFile(url, MIGRATION)).not.toThrow()
      expect(() => applyFile(url, MIGRATION)).not.toThrow()

      expect(search(url, { locationTypes: PRODUCTS_AND_SERVICES })).toEqual(once)
      expect(identityTypes(url, "search_listings_faceted")).toEqual([SEARCH_17])
      expect(identityTypes(url, "facet_counts")).toEqual([COUNTS_13])
    })
  })

  it("rolls back: the documented down plan restores the previous definitions", async () => {
    await withScratchDb("loctypes_rollback", async (url) => {
      baseline(url)
      exec(url, SEED)

      const before = searchLegacy(url)
      const priceBefore = countsLegacy(url, "price")

      applyFile(url, MIGRATION)
      expect(search(url, { locationTypes: PRODUCTS_AND_SERVICES })).toHaveLength(3)

      // Step 1 of the down plan, verbatim — and, per case 12, load-bearing.
      exec(url, `DROP FUNCTION IF EXISTS search_listings_faceted(${SEARCH_17});`)
      exec(url, `DROP FUNCTION IF EXISTS facet_counts(${COUNTS_13});`)
      expect(overloads(url, "search_listings_faceted")).toHaveLength(0)
      expect(overloads(url, "facet_counts")).toHaveLength(0)

      // Step 2: re-run 20260811010000 in full. Unlike the radius migration's own
      // rollback, no line-slicing is needed here — that file re-creates BOTH
      // functions, and its leading DROPs are harmless no-ops once step 1 has run.
      applyFile(url, RADIUS)

      expect(searchLegacy(url)).toEqual(before)
      expect(countsLegacy(url, "price")).toEqual(priceBefore)
      expect(identityTypes(url, "search_listings_faceted")).toEqual([SEARCH_16])
      expect(identityTypes(url, "facet_counts")).toEqual([COUNTS_12])

      // And the plural argument is gone, which is the point of the ordering
      // warning in the migration footer: roll back the CODE first, then this.
      expect(overloads(url, "search_listings_faceted")[0]).not.toContain(
        "p_location_types",
      )
    })
  })
})
