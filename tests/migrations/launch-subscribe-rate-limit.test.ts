// =============================================================================
// Migration test: 20260811000000_launch_subscribe_rate_limit.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and asserts the properties
// the rate limiter depends on — behaviorally where possible, by querying the
// catalog rather than by parsing SQL text.
//
// What each case protects:
//   1. The table and its columns exist with the shape the action writes.
//   2. RLS is ON with NO policies. This is the whole access-control story for
//      the table: the action reaches it with the service role, which bypasses
//      RLS, and nothing else may reach it at all. A stray permissive policy
//      would silently open an unauthenticated ledger to the world.
//   3. The (ip_hash, attempted_at) index exists — the limiter runs a count on
//      exactly that pair on every single submission, including throttled ones.
//   4. prune_launch_subscribe_attempts() actually deletes only stale rows.
//      A prune that deletes everything would reset every budget on each run;
//      one that deletes nothing lets the table grow forever.
//   5. The function is SECURITY DEFINER with a pinned search_path. Without the
//      pin, a definer function is a privilege-escalation vector.
//   6. Re-applying the migration is a no-op. It is written to be pasteable into
//      the Supabase SQL editor, so it will be run more than once.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the existing migration suite. These tests CREATE and DROP databases — the
// harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, withScratchDb } from "./helpers"

const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260811000000_launch_subscribe_rate_limit.sql",
)

describe.skipIf(!DB_REACHABLE)("20260811000000_launch_subscribe_rate_limit", () => {
  it("creates the table with the shape the action writes", async () => {
    await withScratchDb("subscribe_rl_shape", async (url) => {
      applyFile(url, MIGRATION)

      const cols = query<{ column_name: string; data_type: string; is_nullable: string }>(
        url,
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_name = 'launch_subscribe_attempts'
          ORDER BY column_name`,
      )

      expect(cols.map((c) => c.column_name)).toEqual([
        "attempted_at",
        "id",
        "ip_hash",
      ])
      // ip_hash is the lookup key on every request; a null would silently pool
      // unrelated clients into one shared budget.
      expect(cols.find((c) => c.column_name === "ip_hash")?.is_nullable).toBe("NO")
      expect(cols.find((c) => c.column_name === "attempted_at")?.is_nullable).toBe("NO")

      // Defaults must exist: the action inserts { ip_hash } and nothing else.
      exec(url, `INSERT INTO launch_subscribe_attempts (ip_hash) VALUES ('deadbeef');`)
      const [row] = query<{ id: string; attempted_at: string }>(
        url,
        `SELECT id, attempted_at FROM launch_subscribe_attempts`,
      )
      expect(row?.id).toBeTruthy()
      expect(row?.attempted_at).toBeTruthy()
    })
  })

  it("enables RLS with no policies at all", async () => {
    await withScratchDb("subscribe_rl_rls", async (url) => {
      applyFile(url, MIGRATION)

      const [t] = query<{ relrowsecurity: boolean }>(
        url,
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'launch_subscribe_attempts'`,
      )
      expect(t?.relrowsecurity).toBe(true)

      // Deliberate: the service-role client bypasses RLS, and no other client
      // should reach this table by any path.
      const policies = query(
        url,
        `SELECT policyname FROM pg_policies WHERE tablename = 'launch_subscribe_attempts'`,
      )
      expect(policies).toHaveLength(0)
    })
  })

  it("indexes the exact (ip_hash, attempted_at) pair the limiter counts on", async () => {
    await withScratchDb("subscribe_rl_index", async (url) => {
      applyFile(url, MIGRATION)

      const [idx] = query<{ indexdef: string }>(
        url,
        `SELECT indexdef FROM pg_indexes
          WHERE tablename = 'launch_subscribe_attempts'
            AND indexname = 'launch_subscribe_attempts_hash_time_idx'`,
      )
      expect(idx?.indexdef).toContain("ip_hash")
      expect(idx?.indexdef).toContain("attempted_at")
    })
  })

  it("prunes stale rows and only stale rows", async () => {
    await withScratchDb("subscribe_rl_prune", async (url) => {
      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO launch_subscribe_attempts (ip_hash, attempted_at) VALUES
           ('stale',  now() - interval '2 hours'),
           ('edge',   now() - interval '59 minutes'),
           ('fresh',  now());`,
      )
      exec(url, `SELECT prune_launch_subscribe_attempts();`)

      const remaining = query<{ ip_hash: string }>(
        url,
        `SELECT ip_hash FROM launch_subscribe_attempts ORDER BY ip_hash`,
      )
      // Deleting everything would reset every budget on each hourly run;
      // deleting nothing lets the table grow without bound.
      expect(remaining.map((r) => r.ip_hash)).toEqual(["edge", "fresh"])
    })
  })

  it("pins search_path on the SECURITY DEFINER prune function", async () => {
    await withScratchDb("subscribe_rl_definer", async (url) => {
      applyFile(url, MIGRATION)

      const [fn] = query<{ prosecdef: boolean; proconfig: string | null }>(
        url,
        `SELECT prosecdef, array_to_string(proconfig, ',') AS proconfig
           FROM pg_proc WHERE proname = 'prune_launch_subscribe_attempts'`,
      )
      expect(fn?.prosecdef).toBe(true)
      // An unpinned definer function is a privilege-escalation vector: a caller
      // controlling search_path can shadow the objects it references.
      expect(fn?.proconfig ?? "").toContain("search_path=public")
    })
  })

  it("is idempotent — re-applying changes nothing", async () => {
    await withScratchDb("subscribe_rl_idempotent", async (url) => {
      applyFile(url, MIGRATION)
      exec(url, `INSERT INTO launch_subscribe_attempts (ip_hash) VALUES ('keepme');`)

      // It is written to be pasteable into the Supabase SQL editor, so it will
      // be run more than once.
      applyFile(url, MIGRATION)

      const rows = query<{ ip_hash: string }>(
        url,
        `SELECT ip_hash FROM launch_subscribe_attempts`,
      )
      expect(rows.map((r) => r.ip_hash)).toEqual(["keepme"])
    })
  })
})
