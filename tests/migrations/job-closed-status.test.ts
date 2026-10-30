// =============================================================================
// Migration test: 20261031000000_listings_closed_status.sql (ticket 155)
// =============================================================================
// Two layers:
//
//   * Source checks that always run. They read the migration text and pin the
//     two things that must never drift: 'closed' joins the status CHECK next to
//     every existing value, and every one of the four re-created read policies
//     scopes 'closed' to entity_type = 'job'. A closed business must never
//     become readable.
//
//   * Behavioural checks against a scratch Postgres, skipped when none is
//     reachable (DB_REACHABLE), the same as the rest of this suite. The fixture
//     installs the PRE-migration CHECK and policies exactly as their source
//     migrations wrote them, so each case proves the migration changed
//     something. These tests CREATE and DROP databases; the harness must never
//     point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20261031000000_listings_closed_status.sql")
const SQL = readFileSync(MIGRATION, "utf8")

const POLICIES = [
  "listings: anon read published",
  "listings: authenticated read published or own",
  "listing_details_job: anon read published",
  "listing_details_job: authenticated read",
]

/** The CREATE POLICY statement for one policy name, up to its closing semicolon. */
function policyBody(name: string): string {
  const start = SQL.indexOf(`CREATE POLICY "${name}"`)
  expect(start, `CREATE POLICY "${name}" missing`).toBeGreaterThan(-1)
  return SQL.slice(start, SQL.indexOf(";", start))
}

describe("migration source: 20261031000000_listings_closed_status", () => {
  it("adds 'closed' to the status CHECK and keeps every existing value", () => {
    const check = SQL.match(/CHECK \(status IN \(([^)]*)\)\)/)
    expect(check).not.toBeNull()
    const values = (check?.[1] ?? "").split(",").map((v) => v.trim().replace(/'/g, ""))
    expect(values.sort()).toEqual(
      ["archived", "closed", "draft", "flagged", "pending", "published", "rejected", "unpublished"],
    )
  })

  it.each(POLICIES)("drops and re-creates %s", (name) => {
    expect(SQL).toContain(`DROP POLICY IF EXISTS "${name}"`)
    policyBody(name)
  })

  it.each(POLICIES)("%s lets 'closed' through for jobs only", (name) => {
    const body = policyBody(name)
    const closedClauses = body.match(/status = 'closed'[^)]*/g) ?? []
    expect(closedClauses).toHaveLength(1)
    expect(closedClauses[0]).toContain("entity_type = 'job'")
    expect(closedClauses[0]).toContain("deleted_at IS NULL")
    // The original published clause is still there.
    expect(body).toContain("status = 'published' AND deleted_at IS NULL")
  })

  it("keeps the owner clause on both authenticated policies", () => {
    expect(policyBody("listings: authenticated read published or own")).toContain(
      "owner_user_id = auth.uid()",
    )
    expect(policyBody("listing_details_job: authenticated read")).toContain(
      "owner_user_id = auth.uid() AND deleted_at IS NULL",
    )
  })

  it("updates no rows", () => {
    expect(SQL).not.toMatch(/^\s*UPDATE\s/im)
    expect(SQL).not.toMatch(/^\s*DELETE\s/im)
  })
})

// --- Behavioural ------------------------------------------------------------

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const CLOSED_JOB = "11111111-1111-4111-8111-111111111111"
const CLOSED_BIZ = "22222222-2222-4222-8222-222222222222"
const DELETED_JOB = "33333333-3333-4333-8333-333333333333"
const LIVE_JOB = "44444444-4444-4444-8444-444444444444"

// The pre-migration state: the seven-value CHECK from 20260813020000 and the
// four policies from 20260510000001 / 20260813000000, verbatim.
const FIXTURE = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;

CREATE TABLE listings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id),
  status        text NOT NULL DEFAULT 'draft',
  entity_type   text NOT NULL DEFAULT 'business',
  deleted_at    timestamptz
);
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('draft','pending','published','unpublished','flagged','archived','rejected'));

CREATE TABLE listing_details_job (
  listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  closes_at  timestamptz
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_details_job ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings: anon read published"
  ON listings FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "listings: authenticated read published or own"
  ON listings FOR SELECT TO authenticated
  USING ((status = 'published' AND deleted_at IS NULL) OR owner_user_id = auth.uid());
CREATE POLICY "listing_details_job: anon read published"
  ON listing_details_job FOR SELECT TO anon
  USING (listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL));
CREATE POLICY "listing_details_job: authenticated read"
  ON listing_details_job FOR SELECT TO authenticated
  USING (listing_id IN (
    SELECT id FROM listings
    WHERE (status = 'published' AND deleted_at IS NULL)
       OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
  ));

INSERT INTO auth.users (id) VALUES ('${OWNER}'), ('${STRANGER}');

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
`

// Rows can only be 'closed' after the migration widens the CHECK.
const SEED = `
INSERT INTO listings (id, name, owner_user_id, status, entity_type, deleted_at) VALUES
  ('${CLOSED_JOB}',  'Closed Role',     '${OWNER}', 'closed',    'job',      NULL),
  ('${CLOSED_BIZ}',  'Closed Business', '${OWNER}', 'closed',    'business', NULL),
  ('${DELETED_JOB}', 'Deleted Role',    '${OWNER}', 'closed',    'job',      now()),
  ('${LIVE_JOB}',    'Live Role',       '${OWNER}', 'published', 'job',      NULL);
INSERT INTO listing_details_job (listing_id, closes_at) VALUES
  ('${CLOSED_JOB}',  now() - interval '1 day'),
  ('${CLOSED_BIZ}',  NULL),
  ('${DELETED_JOB}', now() - interval '1 day'),
  ('${LIVE_JOB}',    now() + interval '1 day');
`

function idsAs(url: string, role: string, userId: string | null, table: string, col: string): string[] {
  const uid = userId ? `SET test.user_id = '${userId}';` : `SET test.user_id = '';`
  const out = exec(
    url,
    `${uid} SET ROLE ${role}; SELECT coalesce(json_agg(${col} ORDER BY ${col}), '[]'::json) FROM ${table};`,
  ).trim()
  return JSON.parse(out) as string[]
}

describe.skipIf(!DB_REACHABLE)("migration: 20261031000000_listings_closed_status", () => {
  it("1. the CHECK refused 'closed' before and accepts it after; junk is still refused", async () => {
    await withScratchDb("closed_check", (url) => {
      exec(url, FIXTURE)
      expect(raises(url, `INSERT INTO listings (name, status) VALUES ('x', 'closed');`)).toBe(true)

      applyFile(url, MIGRATION)
      exec(url, `INSERT INTO listings (name, status) VALUES ('x', 'closed');`)
      expect(raises(url, `INSERT INTO listings (name, status) VALUES ('y', 'gone');`)).toBe(true)
    })
  })

  it("2. anon reads a closed job and its details, never a closed non-job or a deleted job", async () => {
    await withScratchDb("closed_anon", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      exec(url, SEED)

      expect(idsAs(url, "anon", null, "listings", "id")).toEqual([CLOSED_JOB, LIVE_JOB])
      expect(idsAs(url, "anon", null, "listing_details_job", "listing_id")).toEqual([
        CLOSED_JOB,
        LIVE_JOB,
      ])
    })
  })

  it("3. a signed-in stranger sees the same as anon; the owner still sees all their own", async () => {
    await withScratchDb("closed_auth", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      exec(url, SEED)

      expect(idsAs(url, "authenticated", STRANGER, "listings", "id")).toEqual([CLOSED_JOB, LIVE_JOB])
      expect(idsAs(url, "authenticated", STRANGER, "listing_details_job", "listing_id")).toEqual([
        CLOSED_JOB,
        LIVE_JOB,
      ])

      expect(idsAs(url, "authenticated", OWNER, "listings", "id")).toHaveLength(4)
      // Detail rows keep the deleted_at guard for owners, as before.
      expect(idsAs(url, "authenticated", OWNER, "listing_details_job", "listing_id")).toEqual([
        CLOSED_JOB,
        CLOSED_BIZ,
        LIVE_JOB,
      ])
    })
  })

  it("4. re-applying changes nothing", async () => {
    await withScratchDb("closed_idem", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)
      exec(url, SEED)
      expect(idsAs(url, "anon", null, "listings", "id")).toEqual([CLOSED_JOB, LIVE_JOB])
      expect(
        query(url, `SELECT indexname FROM pg_indexes WHERE indexname = 'listing_details_job_closes_at_idx'`),
      ).toHaveLength(1)
    })
  })
})
