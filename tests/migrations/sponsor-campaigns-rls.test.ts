// =============================================================================
// Migration test: 20260818000000_sponsor_campaigns_rls.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and then actually connects as
// `anon` and as `authenticated` to see what each one can read and write.
//
// Asserting that a policy row exists in pg_policies proves almost nothing — a
// policy can exist and still be wrong. So the fixture deliberately does the one
// thing that makes the denial cases meaningful:
//
//     GRANT SELECT ON sponsor_campaigns TO anon;
//
// With that grant in place, an anonymous SELECT returning zero rows can only be
// RLS doing its job. Without it, the same assertion would pass for the wrong
// reason — a missing table grant — and would keep passing even if someone added
// a public read policy tomorrow. Same reasoning for the non-admin authenticated
// role, which is granted full table-level DML.
//
// The fixture stands up minimal stand-ins for `auth.uid()`, `user_roles`, and
// `sponsor_campaigns` rather than replaying 41 migrations. The migration under
// test only touches sponsor_campaigns and only reads user_roles + auth.uid(), so
// the stand-ins cover its whole surface. `auth.uid()` mirrors Supabase's own
// implementation: it reads the request JWT claim out of a GUC.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the existing migration suite. These tests CREATE and DROP databases — the
// harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20260818000000_sponsor_campaigns_rls.sql")

const ADMIN_ID = "11111111-1111-1111-1111-111111111111"
const SUPER_ID = "22222222-2222-2222-2222-222222222222"
const MEMBER_ID = "33333333-3333-3333-3333-333333333333"

// Minimal stand-ins for everything the migration references, plus table-level
// grants generous enough that RLS is the only thing left to deny a request.
const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role    text NOT NULL
  );

  CREATE TABLE sponsor_campaigns (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsor_name  text NOT NULL,
    contact_email text NOT NULL,
    campaign_type text NOT NULL DEFAULT 'editorial',
    budget_cents  integer,
    status        text NOT NULL DEFAULT 'inquiry'
  );

  INSERT INTO user_roles (user_id, role) VALUES
    ('${ADMIN_ID}',  'admin'),
    ('${SUPER_ID}',  'super_admin'),
    ('${MEMBER_ID}', 'supporter');

  INSERT INTO sponsor_campaigns (sponsor_name, contact_email, budget_cents)
    VALUES ('Fixture Sponsor', 'sponsor@example.test', 500000);

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON user_roles TO anon, authenticated;

  -- Deliberately generous. These grants are what make the denial cases below
  -- non-vacuous: if RLS were removed, every one of them would start passing.
  GRANT SELECT, INSERT, UPDATE, DELETE ON sponsor_campaigns TO authenticated;
  GRANT SELECT ON sponsor_campaigns TO anon;
`

// Run SQL as a given Postgres role with a given JWT subject, in ONE session —
// `exec` starts a fresh connection per call, so SET ROLE and the statement must
// travel together.
function asRole(url: string, role: "anon" | "authenticated", uid: string | null, sql: string): string {
  const claim = uid === null ? "" : uid
  return exec(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${claim}', false);
     SET ROLE ${role};
     ${sql}`,
  )
}

function countAs(url: string, role: "anon" | "authenticated", uid: string | null): number {
  return Number(asRole(url, role, uid, "SELECT count(*) FROM sponsor_campaigns;").trim().split("\n").pop())
}

function failsAs(url: string, role: "anon" | "authenticated", uid: string | null, sql: string): boolean {
  return raises(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
     SET ROLE ${role};
     ${sql}`,
  )
}

async function withMigrated(name: string, fn: (url: string) => void | Promise<void>): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    await fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)("migration: sponsor_campaigns RLS", () => {
  it("leaves RLS enabled and adds exactly one policy, scoped to authenticated", async () => {
    await withMigrated("sponsor_campaigns_shape", (url) => {
      const [rls] = query<{ relrowsecurity: boolean }>(
        url,
        "SELECT relrowsecurity FROM pg_class WHERE relname = 'sponsor_campaigns'",
      )
      expect(rls?.relrowsecurity).toBe(true)

      const policies = query<{ policyname: string; cmd: string; roles: string; qual: string | null; with_check: string | null }>(
        url,
        `SELECT policyname, cmd, roles::text AS roles, qual, with_check
           FROM pg_policies WHERE tablename = 'sponsor_campaigns' ORDER BY policyname`,
      )

      expect(policies).toHaveLength(1)
      expect(policies[0]?.policyname).toBe("admin_sponsor_campaigns_all")
      expect(policies[0]?.cmd).toBe("ALL")
      expect(policies[0]?.roles).toBe("{authenticated}")

      // FOR ALL without WITH CHECK would let a non-admin insert rows it could
      // not then read. Both halves have to be present.
      expect(policies[0]?.qual).toBeTruthy()
      expect(policies[0]?.with_check).toBeTruthy()
    })
  })

  it("grants no policy to anon, and anon reads nothing despite holding SELECT", async () => {
    await withMigrated("sponsor_campaigns_anon", (url) => {
      const anonPolicies = query(
        url,
        `SELECT policyname FROM pg_policies
          WHERE tablename = 'sponsor_campaigns' AND roles::text LIKE '%anon%'`,
      )
      expect(anonPolicies).toHaveLength(0)

      // The row is really there — 1 as the table owner, 0 as anon.
      expect(query(url, "SELECT id FROM sponsor_campaigns")).toHaveLength(1)
      expect(countAs(url, "anon", null)).toBe(0)
    })
  })

  it("lets an admin and a super_admin read, and blocks a non-admin authenticated user", async () => {
    await withMigrated("sponsor_campaigns_read", (url) => {
      expect(countAs(url, "authenticated", ADMIN_ID)).toBe(1)
      expect(countAs(url, "authenticated", SUPER_ID)).toBe(1)

      // Holds full table-level DML and still sees nothing. Only RLS can be
      // doing that.
      expect(countAs(url, "authenticated", MEMBER_ID)).toBe(0)

      // An authenticated session with no JWT subject at all.
      expect(countAs(url, "authenticated", null)).toBe(0)
    })
  })

  it("blocks a non-admin from inserting, and lets an admin insert", async () => {
    await withMigrated("sponsor_campaigns_write", (url) => {
      const insert = `INSERT INTO sponsor_campaigns (sponsor_name, contact_email)
                        VALUES ('Injected', 'nope@example.test');`

      expect(failsAs(url, "authenticated", MEMBER_ID, insert)).toBe(true)
      expect(failsAs(url, "authenticated", ADMIN_ID, insert)).toBe(false)

      // Two rows now: the fixture row plus the admin's.
      expect(query(url, "SELECT id FROM sponsor_campaigns")).toHaveLength(2)
    })
  })

  it("does not let a non-admin update or delete a row it cannot see", async () => {
    await withMigrated("sponsor_campaigns_mutate", (url) => {
      // UPDATE and DELETE against invisible rows do not raise — they silently
      // affect zero rows. Asserting the row survives unchanged is the only
      // check that actually catches a broken USING clause.
      asRole(url, "authenticated", MEMBER_ID, "UPDATE sponsor_campaigns SET sponsor_name = 'Hijacked';")
      asRole(url, "authenticated", MEMBER_ID, "DELETE FROM sponsor_campaigns;")

      const rows = query<{ sponsor_name: string }>(url, "SELECT sponsor_name FROM sponsor_campaigns")
      expect(rows).toHaveLength(1)
      expect(rows[0]?.sponsor_name).toBe("Fixture Sponsor")
    })
  })

  it("is safe to apply twice", async () => {
    await withMigrated("sponsor_campaigns_rerun", (url) => {
      // It is written to be pasteable into the Supabase SQL editor, so it will
      // be run more than once — and staging-then-production means at least two
      // applications of the same file.
      expect(() => applyFile(url, MIGRATION)).not.toThrow()

      const policies = query(url, "SELECT policyname FROM pg_policies WHERE tablename = 'sponsor_campaigns'")
      expect(policies).toHaveLength(1)

      expect(countAs(url, "authenticated", ADMIN_ID)).toBe(1)
      expect(countAs(url, "anon", null)).toBe(0)
    })
  })
})
