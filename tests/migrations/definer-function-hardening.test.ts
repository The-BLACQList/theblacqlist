// =============================================================================
// Migration test: 20260823000000_definer_function_hardening.sql
// =============================================================================
// The migration is nothing but REVOKE/GRANT, so there is no behaviour to
// assert — only the resulting grants. Those are read from the catalog with
// has_function_privilege(), never by parsing the SQL text.
//
// What each case protects:
//   1. prune_launch_subscribe_attempts() is closed to anon/authenticated/PUBLIC
//      and open to service_role. Its real definition is applied first, so this
//      case exercises the true chain end to end.
//   2. aggregate_entity_analytics(date) gets the same treatment. Its real
//      definition cannot be applied in a scratch database — 20260515000000
//      references user_roles and analytics_events, which come from the initial
//      schema, which in turn references auth.users. A stub carrying the exact
//      signature is created instead. That is enough to prove what can actually
//      regress here: that the REVOKE/GRANT statements name the right function
//      and the right argument types. A signature typo would fail to resolve and
//      the apply would error.
//   3. Re-applying is a no-op. The file is written to be pasted into the
//      Supabase SQL editor, so it will be run more than once.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the rest of the migration suite. These tests CREATE and DROP databases — the
// harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, withScratchDb } from "./helpers"

const MIGRATION = path.join(
  MIGRATIONS_DIR,
  "20260823000000_definer_function_hardening.sql",
)
const LAUNCH_SUBSCRIBE = path.join(
  MIGRATIONS_DIR,
  "20260811000000_launch_subscribe_rate_limit.sql",
)

// The real definition lives behind the initial schema (see the header note), so
// the signature is reproduced here. If 20260515000000 ever changes the argument
// type, this stub stops matching and case 2 fails — which is the intent.
const ANALYTICS_STUB = `
  CREATE OR REPLACE FUNCTION aggregate_entity_analytics(
    target_date date DEFAULT (CURRENT_DATE - INTERVAL '1 day')::date
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $stub$ BEGIN RETURN '{}'::jsonb; END; $stub$;
`

type Grants = { anon: boolean; authed: boolean; pub: boolean; service: boolean }

function grantsFor(url: string, sig: string): Grants | undefined {
  const [row] = query<Grants>(
    url,
    `SELECT has_function_privilege('anon', '${sig}', 'EXECUTE')          AS anon,
            has_function_privilege('authenticated', '${sig}', 'EXECUTE') AS authed,
            has_function_privilege('public', '${sig}', 'EXECUTE')        AS pub,
            has_function_privilege('service_role', '${sig}', 'EXECUTE')  AS service`,
  )
  return row
}

function expectLockedDown(g: Grants | undefined) {
  // SECURITY DEFINER functions are executable by PUBLIC unless revoked. If this
  // regresses, an anonymous client can invoke a scheduled maintenance job.
  expect(g?.anon).toBe(false)
  expect(g?.authed).toBe(false)
  expect(g?.pub).toBe(false)
  expect(g?.service).toBe(true)
}

describe.skipIf(!DB_REACHABLE)("20260823000000_definer_function_hardening", () => {
  it("closes prune_launch_subscribe_attempts() to anon and authenticated", async () => {
    await withScratchDb("definer_hardening_prune", async (url) => {
      applyFile(url, LAUNCH_SUBSCRIBE)
      exec(url, ANALYTICS_STUB) // the migration touches both functions in one file

      const sig = "prune_launch_subscribe_attempts()"

      // Baseline: open to everyone, which is the whole reason this file exists.
      expect(grantsFor(url, sig)?.anon).toBe(true)

      applyFile(url, MIGRATION)
      expectLockedDown(grantsFor(url, sig))
    })
  })

  it("closes aggregate_entity_analytics(date) to anon and authenticated", async () => {
    await withScratchDb("definer_hardening_analytics", async (url) => {
      applyFile(url, LAUNCH_SUBSCRIBE)
      exec(url, ANALYTICS_STUB)

      const sig = "aggregate_entity_analytics(date)"
      expect(grantsFor(url, sig)?.anon).toBe(true)

      applyFile(url, MIGRATION)
      expectLockedDown(grantsFor(url, sig))
    })
  })

  it("is idempotent — re-applying leaves the grants unchanged", async () => {
    await withScratchDb("definer_hardening_idempotent", async (url) => {
      applyFile(url, LAUNCH_SUBSCRIBE)
      exec(url, ANALYTICS_STUB)

      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)

      expectLockedDown(grantsFor(url, "prune_launch_subscribe_attempts()"))
      expectLockedDown(grantsFor(url, "aggregate_entity_analytics(date)"))
    })
  })

  it("fails loudly when a target function is absent", async () => {
    await withScratchDb("definer_hardening_loud", async (url) => {
      // No prerequisite applied. A guard block would swallow this; bare
      // REVOKE/GRANT must not. This is the property 20260518000001 lacked.
      expect(() => applyFile(url, MIGRATION)).toThrow()
    })
  })
})
