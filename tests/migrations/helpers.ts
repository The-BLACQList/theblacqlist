// =============================================================================
// Migration test harness — psql + JSON, scratch-DB per test.
// =============================================================================
// These tests apply the real Stripe migration files to a live throwaway Postgres
// and assert the resulting schema + data. They are guarded by DB_REACHABLE so the
// suite is a no-op (skipped) on any machine without the local Supabase Postgres.
//
// Design constraints:
//   * `pg` is NOT a dependency; we shell out to `psql` (which IS available).
//   * Every scenario runs in its own freshly-created database and drops it in a
//     `finally`, so tests never see each other's state and never touch a real DB.
//   * ADMIN_URL defaults to the local Supabase Postgres and is overridable via
//     MIGRATION_TEST_DB_URL. It must point at a LOCAL/scratch instance only —
//     these tests CREATE and DROP databases. Never point it at staging/prod.
// =============================================================================

import { execFileSync } from "node:child_process"
import path from "node:path"

const ADMIN_URL =
  process.env.MIGRATION_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
export const MIGRATION_1 = path.join(
  MIGRATIONS_DIR,
  "20260701000001_plans_pricing_reconcile.sql",
)
export const MIGRATION_2 = path.join(
  MIGRATIONS_DIR,
  "20260701000002_stripe_webhook_hardening.sql",
)

// Swap the database name in a Postgres connection URL, preserving any query string.
function withDb(url: string, db: string): string {
  return url.replace(/\/[^/?]*(\?.*)?$/, `/${db}$1`)
}

// Run a single SQL statement/script via `psql -c`, returning raw stdout.
export function exec(url: string, sql: string): string {
  return execFileSync(
    "psql",
    [url, "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
}

// Apply a .sql file via `psql -f`.
export function applyFile(url: string, file: string): string {
  return execFileSync(
    "psql",
    [url, "-v", "ON_ERROR_STOP=1", "-f", file],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
}

// Run a SELECT and parse the result as JSON. The passed SQL is the *body* of a
// SELECT (e.g. "SELECT name, price_monthly FROM plans"); we wrap it in json_agg so
// psql returns a single parseable JSON array (empty array when no rows).
export function query<T = Record<string, unknown>>(url: string, selectSql: string): T[] {
  const wrapped = `SELECT coalesce(json_agg(t), '[]'::json) FROM (${selectSql}) t;`
  const out = exec(url, wrapped).trim()
  return JSON.parse(out) as T[]
}

// True if the given SQL raises an error (used to assert constraints/uniqueness).
export function raises(url: string, sql: string): boolean {
  try {
    exec(url, sql)
    return false
  } catch {
    return true
  }
}

// Probe reachability once at import time. If psql or the DB is unavailable, the
// whole migration suite skips via describe.skipIf(!DB_REACHABLE).
export const DB_REACHABLE: boolean = (() => {
  try {
    exec(ADMIN_URL, "SELECT 1;")
    return true
  } catch {
    return false
  }
})()

// Create a throwaway database, run `fn` against it, and always drop it afterward.
// DROP and CREATE must be SEPARATE psql invocations: two statements in one `-c`
// run inside one implicit transaction, and DROP DATABASE cannot run in a
// transaction block.
export async function withScratchDb(
  baseName: string,
  fn: (url: string) => Promise<void> | void,
): Promise<void> {
  const db = `migtest_${baseName}`.toLowerCase().replace(/[^a-z0-9_]/g, "_")
  const scratchUrl = withDb(ADMIN_URL, db)

  exec(ADMIN_URL, `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`)
  exec(ADMIN_URL, `CREATE DATABASE ${db};`)
  try {
    await fn(scratchUrl)
  } finally {
    try {
      exec(ADMIN_URL, `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`)
    } catch {
      // Best-effort cleanup; a leaked scratch DB is harmless and named migtest_*.
    }
  }
}
