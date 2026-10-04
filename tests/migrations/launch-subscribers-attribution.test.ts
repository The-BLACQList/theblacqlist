// =============================================================================
// Migration test: 20261004000000_launch_subscribers_attribution.sql
// =============================================================================
// NOT APPLIED to any real database. Applying it is a GATE-DATA decision.
//
// The first block runs everywhere: it reads the migration as text and checks
// that its role CHECK lists exactly SIGNUP_ROLES, because the action and the
// constraint are two files with nothing linking them at compile time.
//
// The second block applies the migration to a throwaway scratch database on a
// LOCAL Postgres (tests/migrations/helpers.ts) and is skipped when none is
// reachable, like the rest of the migration suite.
// =============================================================================

import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { SIGNUP_ROLES, UTM_KEYS } from "@/lib/marketing/launch-attribution"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from "./helpers"

const BASE = path.join(MIGRATIONS_DIR, "20260626000000_launch_subscribers.sql")
const MIGRATION = path.join(MIGRATIONS_DIR, "20261004000000_launch_subscribers_attribution.sql")
const SQL = readFileSync(MIGRATION, "utf8")

describe("20261004000000_launch_subscribers_attribution (source text)", () => {
  it("allows exactly the roles the action accepts", () => {
    const check = SQL.match(/signup_role IN \(([^)]*)\)/)?.[1]
    expect(check).toBeDefined()
    const roles = [...check!.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(roles).toEqual([...SIGNUP_ROLES])
  })

  it("adds every column the action writes, nullable and idempotent", () => {
    for (const column of [...UTM_KEYS, "referrer", "signup_role"]) {
      expect(SQL, column).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\s+text`))
    }
    expect(SQL).not.toMatch(/NOT NULL/)
  })

  it("does not touch RLS or policies", () => {
    expect(SQL).not.toMatch(/POLICY|ROW LEVEL SECURITY|GRANT/i)
  })
})

describe.skipIf(!DB_REACHABLE)("20261004000000_launch_subscribers_attribution (scratch DB)", () => {
  it("adds the columns, keeps existing rows, and enforces the CHECKs", async () => {
    await withScratchDb("launch_sub_attr", async (url) => {
      applyFile(url, BASE)
      exec(url, `INSERT INTO launch_subscribers (email) VALUES ('before@example.test');`)
      applyFile(url, MIGRATION)

      const [before] = query<{ utm_source: string | null; signup_role: string | null }>(
        url,
        `SELECT utm_source, signup_role FROM launch_subscribers WHERE email = 'before@example.test'`,
      )
      expect(before).toEqual({ utm_source: null, signup_role: null })

      exec(
        url,
        `INSERT INTO launch_subscribers (email, utm_source, utm_campaign, referrer, signup_role)
         VALUES ('after@example.test', 'instagram', 'pre-launch', 'https://l.instagram.com', 'owner');`,
      )
      expect(raises(url, `INSERT INTO launch_subscribers (email, signup_role) VALUES ('bad@example.test', 'admin');`)).toBe(true)
      expect(raises(url, `INSERT INTO launch_subscribers (email, utm_source) VALUES ('long@example.test', repeat('a', 101));`)).toBe(true)
      expect(raises(url, `INSERT INTO launch_subscribers (email, referrer) VALUES ('ref@example.test', repeat('a', 256));`)).toBe(true)
    })
  })

  it("is a no-op when applied twice", async () => {
    await withScratchDb("launch_sub_attr_twice", async (url) => {
      applyFile(url, BASE)
      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)
      const cols = query<{ column_name: string }>(
        url,
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'launch_subscribers' ORDER BY column_name`,
      )
      expect(cols.map((c) => c.column_name)).toEqual([
        "created_at",
        "email",
        "id",
        "referrer",
        "signup_role",
        "source",
        "utm_campaign",
        "utm_content",
        "utm_medium",
        "utm_source",
      ])
    })
  })
})
