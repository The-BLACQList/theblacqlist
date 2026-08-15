// =============================================================================
// Migration test: 20260815000000_sponsored_delivery_reporting.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and asserts the RPC
// BEHAVIORALLY — by calling it as a real role with a real auth.uid(), not by
// reading pg_proc and trusting that a function marked SECURITY DEFINER with an
// IF NOT EXISTS block actually refuses anyone.
//
// These numbers get quoted to a sponsor who paid for the placement. Two things
// therefore have to be true and stay true:
//
//   1. The counts are right — impressions and clicks kept apart, scoped to the
//      placement asked for, and never bleeding in another placement's rows or
//      another entity_type's rows.
//   2. Only an admin can read them. The function is SECURITY DEFINER, so it
//      bypasses RLS by construction; the authorization check inside the function
//      body is the ONLY thing standing between a signed-in supporter and every
//      sponsor's delivery numbers. If that check regresses, no policy catches it.
//
// Case 6 is the one that would be easiest to break silently: a placement with no
// events must produce NO ROW, so the caller can tell "we counted, it was zero"
// apart from "we could not count". The admin page renders those differently on
// purpose (0 vs "—"), and that distinction is only honest if the function keeps
// this contract.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, withScratchDb } from "./helpers"

const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260815000000_sponsored_delivery_reporting.sql",
)

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SUPER_ADMIN = "55555555-5555-4555-8555-555555555555"
const SUPPORTER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PLACEMENT_1 = "11111111-1111-4111-8111-111111111111"
const PLACEMENT_2 = "22222222-2222-4222-8222-222222222222"
const PLACEMENT_3 = "33333333-3333-4333-8333-333333333333"
const LISTING = "44444444-4444-4444-8444-444444444444"

// The minimum of production this migration reads: auth.uid(), user_roles, and
// analytics_events. Column shapes copied from
// 20260510000000_initial_blacqlist_mvp_schema.sql (:544 and :1158) so a future
// change to either table breaks this test rather than sliding past it.
//
// auth.uid() reads a session GUC instead of a JWT claim — a stand-in for the
// shape of the call, which is all the function uses.
const FIXTURE = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
);

CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;

CREATE TABLE user_roles (
  id      uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('supporter','owner','editor','admin','super_admin'))
);

CREATE TABLE analytics_events (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  properties  jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO auth.users (id) VALUES ('${ADMIN}'), ('${SUPER_ADMIN}'), ('${SUPPORTER}');
INSERT INTO user_roles (user_id, role) VALUES
  ('${ADMIN}', 'admin'),
  ('${SUPER_ADMIN}', 'super_admin'),
  ('${SUPPORTER}', 'supporter');
`

// Mirrors Supabase's default grants. Applied AFTER the migration because it
// grants EXECUTE on the function the migration creates. Without this the
// authorization cases would pass for the wrong reason — a permission denial on
// the function itself rather than the check inside it.
const GRANTS = `
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
`

// Delivery fixture, chosen so a bug that swaps the two FILTER clauses, or drops
// the entity_type predicate, or ignores p_placement_ids, each fails a different
// assertion rather than all of them failing together:
//
//   placement 1 -> 3 impressions, 2 clicks   (asymmetric on purpose)
//   placement 2 -> 1 impression,  0 clicks
//   placement 3 -> nothing at all
//   plus 2 rows that must be excluded: a listing page_view carrying placement 1's
//   id as entity_id, and a sponsored_placement row with an unrelated event_name.
function seed(url: string): void {
  const rows: string[] = []
  const add = (name: string, type: string, id: string) =>
    rows.push(`('${name}', '${type}', '${id}')`)

  for (let i = 0; i < 3; i++) add("sponsored_impression", "sponsored_placement", PLACEMENT_1)
  for (let i = 0; i < 2; i++) add("sponsored_click", "sponsored_placement", PLACEMENT_1)
  add("sponsored_impression", "sponsored_placement", PLACEMENT_2)

  // Decoys. The first shares placement 1's entity_id but is a listing event —
  // the entity_type predicate is the only thing keeping it out of the count.
  add("page_view", "listing", PLACEMENT_1)
  add("cta_click", "sponsored_placement", PLACEMENT_1)

  exec(
    url,
    `INSERT INTO analytics_events (event_name, entity_type, entity_id) VALUES ${rows.join(", ")};`,
  )
}

function setup(url: string): void {
  exec(url, FIXTURE)
  applyFile(url, MIGRATION)
  exec(url, GRANTS)
  seed(url)
}

// Every call runs as `authenticated` with a real auth.uid(), because the scratch
// DB's owner is a superuser — the IF NOT EXISTS check would still fire for a
// superuser with no admin row, but SET ROLE keeps the test honest about which
// grant path production actually uses.
function as(userId: string, sql: string): string {
  return `SET test.user_id = '${userId}'; SET ROLE authenticated; ${sql}`
}

type DeliveryRow = { placement_id: string; impressions: number; clicks: number }

function deliveryAs(url: string, userId: string, ids: string[]): DeliveryRow[] {
  const arr = `ARRAY[${ids.map((i) => `'${i}'::uuid`).join(", ")}]`
  const out = exec(
    url,
    as(
      userId,
      `SELECT coalesce(json_agg(t), '[]'::json) FROM (
         SELECT placement_id, impressions::int AS impressions, clicks::int AS clicks
         FROM sponsored_placement_delivery(${arr})
       ) t;`,
    ),
  ).trim()
  return JSON.parse(out) as DeliveryRow[]
}

/**
 * Pulls the one row a query is expected to return. Throws rather than indexing,
 * so an unexpected result count fails with what actually came back instead of a
 * downstream "possibly undefined" — and so each caller keeps a non-optional type
 * under noUncheckedIndexedAccess.
 */
function only<T>(rows: T[], what: string): T {
  if (rows.length !== 1) {
    throw new Error(`expected exactly one ${what}, got ${rows.length}`)
  }
  return rows[0]!
}

function deniedFor(url: string, userId: string, ids: string[]): boolean {
  try {
    deliveryAs(url, userId, ids)
    return false
  } catch {
    return true
  }
}

describe.skipIf(!DB_REACHABLE)("20260815000000_sponsored_delivery_reporting", () => {
  it("counts impressions and clicks separately per placement", async () => {
    await withScratchDb("sponsored_delivery_counts", (url) => {
      setup(url)
      const rows = deliveryAs(url, ADMIN, [PLACEMENT_1, PLACEMENT_2])
      const byId = new Map(rows.map((r) => [r.placement_id, r]))

      expect(byId.get(PLACEMENT_1)).toEqual({
        placement_id: PLACEMENT_1,
        impressions: 3,
        clicks: 2,
      })
      expect(byId.get(PLACEMENT_2)).toEqual({
        placement_id: PLACEMENT_2,
        impressions: 1,
        clicks: 0,
      })
    })
  })

  it("excludes events of another entity_type that share the id", async () => {
    // The page_view decoy carries PLACEMENT_1 as its entity_id. Counting it would
    // inflate a sponsor's impressions with traffic they did not buy.
    await withScratchDb("sponsored_delivery_entity_type", (url) => {
      setup(url)
      const row = only(deliveryAs(url, ADMIN, [PLACEMENT_1]), "delivery row")
      expect(row.impressions).toBe(3)
      expect(row.clicks).toBe(2)
    })
  })

  it("excludes sponsored_placement events that are not delivery events", async () => {
    // The cta_click decoy is entity_type sponsored_placement but is neither an
    // impression nor a click. It must land in neither column — and, since it is
    // the only other row on this placement, the totals above already prove it.
    await withScratchDb("sponsored_delivery_event_name", (url) => {
      setup(url)
      const row = only(deliveryAs(url, ADMIN, [PLACEMENT_1]), "delivery row")
      expect(row.impressions + row.clicks).toBe(5)
    })
  })

  it("returns only the placements asked for", async () => {
    await withScratchDb("sponsored_delivery_scope", (url) => {
      setup(url)
      const rows = deliveryAs(url, ADMIN, [PLACEMENT_2])
      expect(rows).toHaveLength(1)
      expect(only(rows, "delivery row").placement_id).toBe(PLACEMENT_2)
    })
  })

  it("returns NO ROW for a placement with no delivery, rather than a zero row", async () => {
    // The distinction the admin page depends on. A missing row means "counted,
    // found nothing" and renders 0; an unreachable function renders "—". If this
    // function started emitting zero rows the two states would still render the
    // same today, but the caller would have lost the ability to tell them apart.
    await withScratchDb("sponsored_delivery_empty", (url) => {
      setup(url)
      const rows = deliveryAs(url, ADMIN, [PLACEMENT_3])
      expect(rows).toEqual([])
    })
  })

  it("returns nothing, without error, for an empty id array", async () => {
    await withScratchDb("sponsored_delivery_empty_array", (url) => {
      setup(url)
      const out = exec(
        url,
        as(
          ADMIN,
          `SELECT coalesce(json_agg(t), '[]'::json) FROM (
             SELECT placement_id FROM sponsored_placement_delivery(ARRAY[]::uuid[])
           ) t;`,
        ),
      ).trim()
      expect(JSON.parse(out)).toEqual([])
    })
  })

  it("allows super_admin as well as admin", async () => {
    await withScratchDb("sponsored_delivery_super_admin", (url) => {
      setup(url)
      const rows = deliveryAs(url, SUPER_ADMIN, [PLACEMENT_1])
      expect(only(rows, "delivery row").impressions).toBe(3)
    })
  })

  it("REFUSES a signed-in non-admin", async () => {
    // The whole point of the in-function check. SECURITY DEFINER bypasses RLS, so
    // nothing else in the database stops a supporter from reading every sponsor's
    // delivery numbers.
    await withScratchDb("sponsored_delivery_supporter", (url) => {
      setup(url)
      expect(deniedFor(url, SUPPORTER, [PLACEMENT_1])).toBe(true)
    })
  })

  it("REFUSES a caller with no auth.uid() at all", async () => {
    await withScratchDb("sponsored_delivery_anon", (url) => {
      setup(url)
      const denied = (() => {
        try {
          exec(
            url,
            `SET test.user_id = ''; SET ROLE authenticated;
             SELECT * FROM sponsored_placement_delivery(ARRAY['${PLACEMENT_1}'::uuid]);`,
          )
          return false
        } catch {
          return true
        }
      })()
      expect(denied).toBe(true)
    })
  })

  it("does not grant EXECUTE to anon", async () => {
    // REVOKE ALL ... FROM PUBLIC then GRANT to authenticated only. Without the
    // revoke, PUBLIC would carry the default EXECUTE and anon would reach the
    // function body — where it would still be refused, but defense in depth is
    // the point of doing both.
    await withScratchDb("sponsored_delivery_anon_grant", (url) => {
      setup(url)
      const row = only(
        JSON.parse(
          exec(
            url,
            `SELECT coalesce(json_agg(t), '[]'::json) FROM (
               SELECT has_function_privilege('anon', 'sponsored_placement_delivery(uuid[])', 'EXECUTE') AS granted
             ) t;`,
          ).trim(),
        ) as Array<{ granted: boolean }>,
        "privilege row",
      )
      expect(row.granted).toBe(false)
    })
  })

  it("creates the partial index the count query reads through", async () => {
    // Not cosmetic: analytics_events is the highest-volume table in the product,
    // and this function scans it on every admin page load. The existing
    // analytics_events_entity_idx is (entity_type, entity_id) — it does not carry
    // event_name, so the FILTER clauses would re-read every row for the placement.
    await withScratchDb("sponsored_delivery_index", (url) => {
      setup(url)
      const row = only(
        JSON.parse(
          exec(
            url,
            `SELECT coalesce(json_agg(t), '[]'::json) FROM (
               SELECT indexdef FROM pg_indexes
               WHERE tablename = 'analytics_events'
                 AND indexname = 'analytics_events_sponsored_idx'
             ) t;`,
          ).trim(),
        ) as Array<{ indexdef: string }>,
        "index row",
      )
      expect(row.indexdef).toContain("sponsored_placement")
    })
  })

  it("is idempotent — re-applying the migration changes nothing", async () => {
    // CREATE OR REPLACE FUNCTION + CREATE INDEX IF NOT EXISTS. A migration that
    // failed on second application would block any environment where it was
    // partially applied.
    await withScratchDb("sponsored_delivery_idempotent", (url) => {
      setup(url)
      applyFile(url, MIGRATION)
      const rows = deliveryAs(url, ADMIN, [PLACEMENT_1])
      expect(only(rows, "delivery row").impressions).toBe(3)
    })
  })

  it("has a working down plan", async () => {
    // The DOWN PLAN line in the migration header, executed rather than trusted.
    await withScratchDb("sponsored_delivery_down", (url) => {
      setup(url)
      exec(url, `DROP FUNCTION IF EXISTS sponsored_placement_delivery(uuid[]);`)
      const row = only(
        JSON.parse(
          exec(
            url,
            `SELECT coalesce(json_agg(t), '[]'::json) FROM (
               SELECT count(*)::int AS n FROM pg_proc
               WHERE proname = 'sponsored_placement_delivery'
             ) t;`,
          ).trim(),
        ) as Array<{ n: number }>,
        "pg_proc count row",
      )
      expect(row.n).toBe(0)
    })
  })
})
