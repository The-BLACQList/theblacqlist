// =============================================================================
// Migration test: 20260816000000_rate_limit_counters.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and exercises the limiter as
// a black box — calling check_rate_limit() the way the routes will and asserting
// what comes back, rather than parsing SQL text.
//
// What each case protects:
//   1. The table shape and primary key the function upserts on. The PK IS the
//      access path; losing it turns every call into a sequential scan.
//   2. RLS is ON with NO policies — the ledger is service-role-only.
//   3. EXECUTE is revoked from PUBLIC/anon/authenticated. A SECURITY DEFINER
//      function is world-executable by default, so without the revoke any
//      anonymous caller could charge hits against another client's key.
//   4. Exactly `limit` requests are allowed per window, then denial. This is the
//      one behaviour every caller depends on.
//   5. A throttled request still charges. Otherwise a client that keeps hammering
//      is let back in the moment it stops being counted.
//   6. Buckets and keys have independent budgets — search traffic must not
//      exhaust the analytics allowance, and one IP must not throttle another.
//   7. Rows are bucketed into aligned fixed windows, and a new window is a fresh
//      row rather than an increment of the old one.
//   8. Invalid arguments raise instead of silently dividing by zero or letting
//      everything through.
//   9. prune deletes stale rows and ONLY stale rows.
//  10. Both functions are SECURITY DEFINER with a pinned search_path — unpinned,
//      a definer function is a privilege-escalation vector.
//  11. Re-applying the migration is a no-op. It is written to be pasteable into
//      the Supabase SQL editor, so it will be run more than once.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the existing migration suite. These tests CREATE and DROP databases — the
// harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20260816000000_rate_limit_counters.sql")

// Mirrors how lib/security/rate-limit.ts calls it: a bucket name, an opaque
// digest, a ceiling, and a window length.
function call(
  url: string,
  bucket: string,
  keyHash: string,
  limit: number,
  windowSeconds = 60,
): boolean {
  const out = exec(
    url,
    `SELECT check_rate_limit('${bucket}', '${keyHash}', ${limit}, ${windowSeconds});`,
  ).trim()
  return out === "t"
}

describe.skipIf(!DB_REACHABLE)("20260816000000_rate_limit_counters", () => {
  it("creates the table with the shape and primary key the function upserts on", async () => {
    await withScratchDb("rate_limit_shape", async (url) => {
      applyFile(url, MIGRATION)

      const cols = query<{ column_name: string; is_nullable: string }>(
        url,
        `SELECT column_name, is_nullable
           FROM information_schema.columns
          WHERE table_name = 'rate_limit_counters'
          ORDER BY column_name`,
      )
      expect(cols.map((c) => c.column_name)).toEqual([
        "bucket",
        "hits",
        "key_hash",
        "window_start",
      ])
      // A null in any key column would silently pool unrelated callers into one
      // shared budget.
      expect(cols.every((c) => c.is_nullable === "NO")).toBe(true)

      // The ON CONFLICT target. Without this exact PK the upsert cannot compile,
      // and the lookup on every request degrades to a scan.
      const [pk] = query<{ def: string }>(
        url,
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conrelid = 'rate_limit_counters'::regclass AND contype = 'p'`,
      )
      expect(pk?.def).toContain("bucket")
      expect(pk?.def).toContain("key_hash")
      expect(pk?.def).toContain("window_start")
    })
  })

  it("enables RLS with no policies at all", async () => {
    await withScratchDb("rate_limit_rls", async (url) => {
      applyFile(url, MIGRATION)

      const [t] = query<{ relrowsecurity: boolean }>(
        url,
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'rate_limit_counters'`,
      )
      expect(t?.relrowsecurity).toBe(true)

      const policies = query(
        url,
        `SELECT policyname FROM pg_policies WHERE tablename = 'rate_limit_counters'`,
      )
      expect(policies).toHaveLength(0)
    })
  })

  it("revokes EXECUTE from public callers and grants only service_role", async () => {
    await withScratchDb("rate_limit_grants", async (url) => {
      applyFile(url, MIGRATION)

      const sig = "check_rate_limit(text,text,integer,integer)"
      const [p] = query<{
        anon: boolean
        authed: boolean
        pub: boolean
        service: boolean
      }>(
        url,
        `SELECT has_function_privilege('anon', '${sig}', 'EXECUTE')          AS anon,
                has_function_privilege('authenticated', '${sig}', 'EXECUTE') AS authed,
                has_function_privilege('public', '${sig}', 'EXECUTE')        AS pub,
                has_function_privilege('service_role', '${sig}', 'EXECUTE')  AS service`,
      )

      // SECURITY DEFINER functions are executable by PUBLIC unless revoked. If
      // this regresses, an anonymous client can charge hits against any key.
      expect(p?.anon).toBe(false)
      expect(p?.authed).toBe(false)
      expect(p?.pub).toBe(false)
      expect(p?.service).toBe(true)
    })
  })

  it("allows exactly `limit` requests per window, then denies", async () => {
    await withScratchDb("rate_limit_ceiling", async (url) => {
      applyFile(url, MIGRATION)

      const results = Array.from({ length: 5 }, () => call(url, "search", "abc123", 3))

      // Matches the `if (entry.count >= limit) return false` semantics of the
      // in-memory Maps this replaces: the Nth request still succeeds.
      expect(results).toEqual([true, true, true, false, false])
    })
  })

  it("keeps charging a client that is already throttled", async () => {
    await withScratchDb("rate_limit_charges_denied", async (url) => {
      applyFile(url, MIGRATION)

      for (let i = 0; i < 6; i++) call(url, "search", "flooder", 2)

      const [row] = query<{ hits: number }>(
        url,
        `SELECT hits FROM rate_limit_counters WHERE key_hash = 'flooder'`,
      )
      // If denial were free, a client could hammer forever and be readmitted the
      // moment its counter stopped moving.
      expect(Number(row?.hits)).toBe(6)
    })
  })

  it("gives separate buckets and separate keys independent budgets", async () => {
    await withScratchDb("rate_limit_isolation", async (url) => {
      applyFile(url, MIGRATION)

      expect(call(url, "search", "ip-a", 1)).toBe(true)
      expect(call(url, "search", "ip-a", 1)).toBe(false)

      // A different caller in the same bucket is unaffected...
      expect(call(url, "search", "ip-b", 1)).toBe(true)
      // ...and the same caller in a different bucket has its own allowance.
      expect(call(url, "analytics_event", "ip-a", 1)).toBe(true)
    })
  })

  it("buckets hits into aligned fixed windows and starts fresh in a new one", async () => {
    await withScratchDb("rate_limit_windows", async (url) => {
      applyFile(url, MIGRATION)

      call(url, "search", "windowed", 10, 60)

      const [w] = query<{ aligned: boolean }>(
        url,
        `SELECT (extract(epoch FROM window_start)::bigint % 60) = 0 AS aligned
           FROM rate_limit_counters WHERE key_hash = 'windowed'`,
      )
      // Unaligned window starts would mean every request opened its own window
      // and nothing was ever counted together.
      expect(w?.aligned).toBe(true)

      // A previous window's row must not be incremented by a current request.
      exec(
        url,
        `INSERT INTO rate_limit_counters (bucket, key_hash, window_start, hits)
         VALUES ('search', 'rollover', now() - interval '10 minutes', 99);`,
      )
      expect(call(url, "search", "rollover", 5, 60)).toBe(true)

      const rows = query<{ hits: number }>(
        url,
        `SELECT hits FROM rate_limit_counters WHERE key_hash = 'rollover' ORDER BY window_start`,
      )
      expect(rows.map((r) => Number(r.hits))).toEqual([99, 1])
    })
  })

  it("rejects a non-positive window and a negative limit", async () => {
    await withScratchDb("rate_limit_args", async (url) => {
      applyFile(url, MIGRATION)

      // Zero would divide by zero; a negative window would produce nonsense
      // buckets. Raising is safer than silently letting everything through.
      expect(raises(url, `SELECT check_rate_limit('search', 'k', 10, 0);`)).toBe(true)
      expect(raises(url, `SELECT check_rate_limit('search', 'k', 10, -60);`)).toBe(true)
      expect(raises(url, `SELECT check_rate_limit('search', 'k', -1, 60);`)).toBe(true)

      // A limit of zero is valid and means "deny everything".
      expect(call(url, "search", "zero", 0)).toBe(false)
    })
  })

  it("prunes stale windows and only stale windows", async () => {
    await withScratchDb("rate_limit_prune", async (url) => {
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO rate_limit_counters (bucket, key_hash, window_start, hits) VALUES
           ('search', 'stale', now() - interval '2 hours',   1),
           ('search', 'edge',  now() - interval '59 minutes', 1),
           ('search', 'fresh', now(),                         1);`,
      )
      exec(url, `SELECT prune_rate_limit_counters();`)

      const remaining = query<{ key_hash: string }>(
        url,
        `SELECT key_hash FROM rate_limit_counters ORDER BY key_hash`,
      )
      // Deleting everything would reset every budget on each run; deleting
      // nothing lets the table grow without bound.
      expect(remaining.map((r) => r.key_hash)).toEqual(["edge", "fresh"])
    })
  })

  it("pins search_path on both SECURITY DEFINER functions", async () => {
    await withScratchDb("rate_limit_definer", async (url) => {
      applyFile(url, MIGRATION)

      const fns = query<{ proname: string; prosecdef: boolean; proconfig: string | null }>(
        url,
        `SELECT proname, prosecdef, array_to_string(proconfig, ',') AS proconfig
           FROM pg_proc
          WHERE proname IN ('check_rate_limit', 'prune_rate_limit_counters')
          ORDER BY proname`,
      )

      expect(fns).toHaveLength(2)
      for (const fn of fns) {
        expect(fn.prosecdef).toBe(true)
        // A caller controlling search_path can shadow the objects an unpinned
        // definer function references.
        expect(fn.proconfig ?? "").toContain("search_path=public")
      }
    })
  })

  it("is idempotent — re-applying changes nothing", async () => {
    await withScratchDb("rate_limit_idempotent", async (url) => {
      applyFile(url, MIGRATION)
      call(url, "search", "keepme", 10)

      applyFile(url, MIGRATION)

      const rows = query<{ key_hash: string; hits: number }>(
        url,
        `SELECT key_hash, hits FROM rate_limit_counters`,
      )
      expect(rows.map((r) => r.key_hash)).toEqual(["keepme"])
      expect(Number(rows[0]?.hits)).toBe(1)

      // And the grants survive a re-apply.
      const [p] = query<{ anon: boolean }>(
        url,
        `SELECT has_function_privilege('anon', 'check_rate_limit(text,text,integer,integer)', 'EXECUTE') AS anon`,
      )
      expect(p?.anon).toBe(false)
    })
  })
})
