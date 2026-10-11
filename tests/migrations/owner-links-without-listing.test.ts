// =============================================================================
// Migration test: 20261012000000_owner_links_without_listing.sql
// =============================================================================
// An owner link may now leave out the listing (the owner has no page yet), and
// tour_enrollments gains is_owner, backfilled true for rows with a listing.
// What must NOT change: a trial still needs a listing, and the one-trial
// indexes still hold when the claim writes the listing and the trial together.
//
// Same fixture as tester-one-tap-links.test.ts, applying every migration this
// one builds on. Skipped when no local Postgres is reachable (DB_REACHABLE).
// These tests CREATE and DROP databases. Never point the harness at staging or
// production.
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
].map((f) => path.join(MIGRATIONS_DIR, f))
const MIGRATION = path.join(MIGRATIONS_DIR, '20261012000000_owner_links_without_listing.sql')

const OWNER_A = '22222222-2222-2222-2222-222222222222'
const OWNER_B = '33333333-3333-3333-3333-333333333333'
const SUPPORTER = '55555555-5555-5555-5555-555555555555'
const LISTING_ID = '44444444-4444-4444-4444-444444444444'

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

  INSERT INTO auth.users (id, email) VALUES
    ('${OWNER_A}', 'a@example.com'),
    ('${OWNER_B}', 'b@example.com'),
    ('${SUPPORTER}', 's@example.com');
  INSERT INTO listings (id, name) VALUES ('${LISTING_ID}', 'Fixture Listing');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON user_roles TO anon, authenticated;
`

/** Applies the chain, runs `before` on the old schema, then this migration. */
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

function insertInvite(
  url: string,
  hash: string,
  kind: string,
  email: string | null,
  listing: string | null
): boolean {
  const e = email === null ? 'NULL' : `'${email}'`
  const l = listing === null ? 'NULL' : `'${listing}'`
  return !raises(
    url,
    `INSERT INTO tester_invites (token_hash, kind, email, listing_id, label) VALUES ('${hash}', '${kind}', ${e}, ${l}, 'T-01');`
  )
}

describe.skipIf(!DB_REACHABLE)('migration: owner links without a listing', () => {
  it('lets an owner link leave out the listing, with or without an email', async () => {
    await withMigrated('olw_check', (url) => {
      expect(insertInvite(url, 'h1', 'owner', null, null)).toBe(true)
      expect(insertInvite(url, 'h2', 'owner', 'o@example.com', null)).toBe(true)
      expect(insertInvite(url, 'h3', 'owner', null, LISTING_ID)).toBe(true)
      // A link for a page signs in as the page's owner, so never both.
      expect(insertInvite(url, 'h4', 'owner', 'o@example.com', LISTING_ID)).toBe(false)
      // Supporter rows are unchanged.
      expect(insertInvite(url, 'h5', 'supporter', null, null)).toBe(true)
      expect(insertInvite(url, 'h6', 'supporter', 's@example.com', null)).toBe(true)
      expect(insertInvite(url, 'h7', 'supporter', null, LISTING_ID)).toBe(false)
    })
  })

  it('backfills is_owner true for enrollments with a listing and false otherwise', async () => {
    await withMigrated(
      'olw_backfill',
      (url) => {
        const rows = query<{ tester_user_id: string; is_owner: boolean }>(
          url,
          `SELECT tester_user_id, is_owner FROM tour_enrollments ORDER BY tester_user_id`
        )
        expect(rows).toEqual([
          { tester_user_id: OWNER_A, is_owner: true },
          { tester_user_id: SUPPORTER, is_owner: false },
        ])
        // New rows default to false, as old code still running inserts them.
        exec(
          url,
          `INSERT INTO tour_enrollments (tester_user_id, listing_id) VALUES ('${OWNER_B}', NULL);`
        )
        const [b] = query<{ is_owner: boolean }>(
          url,
          `SELECT is_owner FROM tour_enrollments WHERE tester_user_id = '${OWNER_B}'`
        )
        expect(b?.is_owner).toBe(false)
      },
      (url) => {
        exec(
          url,
          `INSERT INTO tour_enrollments (tester_user_id, listing_id) VALUES
             ('${OWNER_A}', '${LISTING_ID}'),
             ('${SUPPORTER}', NULL);`
        )
      }
    )
  })

  it('still refuses a trial with no listing on an owner enrollment', async () => {
    await withMigrated('olw_trial_needs_listing', (url) => {
      exec(
        url,
        `INSERT INTO tour_enrollments (tester_user_id, listing_id, is_owner, completed_at) VALUES ('${OWNER_A}', NULL, true, now());`
      )
      expect(
        raises(
          url,
          `UPDATE tour_enrollments SET trial_granted_at = now() WHERE tester_user_id = '${OWNER_A}';`
        )
      ).toBe(true)
    })
  })

  it('takes the listing and the trial in one update, and refuses a second tester month on the same page', async () => {
    await withMigrated('olw_attach', (url) => {
      exec(
        url,
        `INSERT INTO tour_enrollments (tester_user_id, listing_id, is_owner, completed_at) VALUES
           ('${OWNER_A}', NULL, true, now()),
           ('${OWNER_B}', NULL, true, now());`
      )
      const attach = (uid: string) =>
        `UPDATE tour_enrollments SET listing_id = '${LISTING_ID}', trial_granted_at = now()
           WHERE tester_user_id = '${uid}' AND trial_granted_at IS NULL AND listing_id IS NULL;`
      expect(raises(url, attach(OWNER_A))).toBe(false)
      expect(raises(url, attach(OWNER_B))).toBe(true)
      const rows = query<{ tester_user_id: string; has_listing: boolean; has_trial: boolean }>(
        url,
        `SELECT tester_user_id, listing_id IS NOT NULL AS has_listing, trial_granted_at IS NOT NULL AS has_trial
           FROM tour_enrollments ORDER BY tester_user_id`
      )
      expect(rows).toEqual([
        { tester_user_id: OWNER_A, has_listing: true, has_trial: true },
        { tester_user_id: OWNER_B, has_listing: false, has_trial: false },
      ])
    })
  })
})
