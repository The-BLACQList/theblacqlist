// =============================================================================
// Migration test: 20261014000000_shared_tester_link.sql
// =============================================================================
// A shared tester link (kind 'shared') names nothing and is never bound to one
// account. Every enrollment gets a tester number, existing rows numbered oldest
// first, and a BEFORE INSERT trigger holds the test to 15 live testers in
// total. Ending an enrollment frees a spot; a number is never reused.
//
// Same fixture as owner-links-without-listing.test.ts, applying every
// migration this one builds on. Skipped when no local Postgres is reachable
// (DB_REACHABLE). These tests CREATE and DROP databases. Never point the
// harness at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from './helpers'

const CHAIN = [
  '20260830000000_tester_tour.sql',
  '20261001000000_tester_one_tap_links.sql',
  '20261011000000_supporter_links_without_email.sql',
  '20261012000000_owner_links_without_listing.sql',
  '20261013000000_tour_rail_closed.sql',
].map((f) => path.join(MIGRATIONS_DIR, f))
const MIGRATION = path.join(MIGRATIONS_DIR, '20261014000000_shared_tester_link.sql')

const LISTING_ID = '44444444-4444-4444-4444-444444444444'

/** u(1) .. u(20): fixture tester ids. */
const u = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

const FIXTURE = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;

  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;

  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE TABLE user_roles (user_id uuid NOT NULL, role text NOT NULL);
  CREATE TABLE listings (id uuid PRIMARY KEY, name text NOT NULL);

  INSERT INTO auth.users (id, email)
    SELECT ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 't' || i || '@example.com'
      FROM generate_series(1, 20) AS i;
  INSERT INTO listings (id, name) VALUES ('${LISTING_ID}', 'Fixture Listing');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON user_roles TO anon, authenticated;
`

async function withMigrated(
  name: string,
  fn: (url: string) => void | Promise<void>,
  before?: (url: string) => void
): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    for (const file of CHAIN) applyFile(url, file)
    before?.(url)
    applyFile(url, MIGRATION)
    await fn(url)
  })
}

/** The error text of a failing statement, or null when it succeeds. */
function errorOf(url: string, sql: string): string | null {
  try {
    exec(url, sql)
    return null
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return typeof stderr === 'string' ? stderr : String(err)
  }
}

const enroll = (n: number) =>
  `INSERT INTO tour_enrollments (tester_user_id, listing_id) VALUES ('${u(n)}', NULL);`

function enrollMany(url: string, from: number, to: number): void {
  for (let n = from; n <= to; n++) exec(url, enroll(n))
}

function insertInvite(
  url: string,
  hash: string,
  kind: string,
  email: string | null,
  listing: string | null,
  testerUserId: string | null = null
): boolean {
  const lit = (v: string | null) => (v === null ? 'NULL' : `'${v}'`)
  return !raises(
    url,
    `INSERT INTO tester_invites (token_hash, kind, email, listing_id, tester_user_id, label)
       VALUES ('${hash}', '${kind}', ${lit(email)}, ${lit(listing)}, ${lit(testerUserId)}, 'Wave 1');`
  )
}

describe.skipIf(!DB_REACHABLE)('migration: shared tester link', () => {
  it('allows a shared link that names nothing, and nothing else', async () => {
    await withMigrated('stl_kind', (url) => {
      expect(insertInvite(url, 'h1', 'shared', null, null)).toBe(true)
      expect(insertInvite(url, 'h2', 'shared', 's@example.com', null)).toBe(false)
      expect(insertInvite(url, 'h3', 'shared', null, LISTING_ID)).toBe(false)
      // Never bound to one account: each person uses their own.
      expect(insertInvite(url, 'h4', 'shared', null, null, u(1))).toBe(false)
      expect(
        raises(url, `UPDATE tester_invites SET tester_user_id = '${u(1)}' WHERE token_hash = 'h1';`)
      ).toBe(true)
      // Unknown kinds are still refused, and the old kinds still work.
      expect(insertInvite(url, 'h5', 'open', null, null)).toBe(false)
      expect(insertInvite(url, 'h6', 'supporter', null, null)).toBe(true)
      expect(insertInvite(url, 'h7', 'owner', null, LISTING_ID)).toBe(true)
      expect(insertInvite(url, 'h8', 'owner', 'o@example.com', LISTING_ID)).toBe(false)
    })
  })

  it('numbers existing enrollments oldest first, then keeps counting', async () => {
    await withMigrated(
      'stl_backfill',
      (url) => {
        const rows = query<{ tester_user_id: string; tester_number: number }>(
          url,
          `SELECT tester_user_id, tester_number FROM tour_enrollments ORDER BY tester_number`
        )
        expect(rows).toEqual([
          { tester_user_id: u(3), tester_number: 1 },
          { tester_user_id: u(1), tester_number: 2 },
          { tester_user_id: u(2), tester_number: 3 },
        ])
        exec(url, enroll(4))
        const [next] = query<{ tester_number: number }>(
          url,
          `SELECT tester_number FROM tour_enrollments WHERE tester_user_id = '${u(4)}'`
        )
        expect(next?.tester_number).toBe(4)
      },
      (url) => {
        exec(
          url,
          `INSERT INTO tour_enrollments (tester_user_id, listing_id, created_at) VALUES
             ('${u(1)}', NULL, now() - interval '2 days'),
             ('${u(2)}', '${LISTING_ID}', now() - interval '1 day'),
             ('${u(3)}', NULL, now() - interval '3 days');`
        )
      }
    )
  })

  it('ignores a number the caller tries to pick', async () => {
    await withMigrated('stl_no_pick', (url) => {
      exec(url, enroll(1))
      exec(
        url,
        `INSERT INTO tour_enrollments (tester_user_id, listing_id, tester_number) VALUES ('${u(2)}', NULL, 1);`
      )
      const rows = query<{ tester_number: number }>(
        url,
        `SELECT tester_number FROM tour_enrollments ORDER BY tester_number`
      )
      expect(rows.map((r) => r.tester_number)).toEqual([1, 2])
    })
  })

  it('refuses the 16th live tester with tester_cap_full', async () => {
    await withMigrated('stl_cap', (url) => {
      enrollMany(url, 1, 15)
      const err = errorOf(url, enroll(16))
      expect(err).toContain('tester_cap_full')
      const [count] = query<{ n: number }>(url, `SELECT count(*)::int AS n FROM tour_enrollments`)
      expect(count?.n).toBe(15)
    })
  })

  it('frees a spot when an enrollment ends, without reusing its number', async () => {
    await withMigrated('stl_end_frees', (url) => {
      enrollMany(url, 1, 15)
      exec(url, `UPDATE tour_enrollments SET ended_at = now() WHERE tester_user_id = '${u(5)}';`)
      expect(errorOf(url, enroll(16))).toBeNull()
      const [row] = query<{ tester_number: number }>(
        url,
        `SELECT tester_number FROM tour_enrollments WHERE tester_user_id = '${u(16)}'`
      )
      expect(row?.tester_number).toBe(16)
      expect(errorOf(url, enroll(17))).toContain('tester_cap_full')
    })
  })

  it('gives a tester who is already live the duplicate error, not "full"', async () => {
    await withMigrated('stl_dup_not_full', (url) => {
      enrollMany(url, 1, 15)
      const err = errorOf(url, enroll(3))
      expect(err).not.toBeNull()
      expect(err).not.toContain('tester_cap_full')
      expect(err).toContain('tour_enrollments_one_live_per_tester_idx')
    })
  })

  it('is safe to apply twice and keeps the numbers', async () => {
    await withMigrated('stl_reapply', (url) => {
      enrollMany(url, 1, 3)
      applyFile(url, MIGRATION)
      const rows = query<{ tester_number: number }>(
        url,
        `SELECT tester_number FROM tour_enrollments ORDER BY tester_number`
      )
      expect(rows.map((r) => r.tester_number)).toEqual([1, 2, 3])
      exec(url, enroll(4))
      const [count] = query<{ n: number }>(
        url,
        `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'tour_enrollments_cap_and_number'`
      )
      expect(count?.n).toBe(1)
    })
  })
})
