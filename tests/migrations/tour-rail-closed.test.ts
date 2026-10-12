// =============================================================================
// Migration test: 20261013000000_tour_rail_closed.sql
// =============================================================================
// A finished tester can close the Tester Tour panel for good (founder,
// 2026-10-12). The mark is a column on their own enrollment, so this pins:
// it starts null, only a finished walk can carry it, a tester still cannot
// write their own row (no RLS change), and re-applying is safe.
//
// Same stand-in fixture as tester-tour.test.ts. Skipped when no local Postgres
// is reachable. These tests CREATE and DROP databases: never staging or prod.
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

const BASE = path.join(MIGRATIONS_DIR, '20260830000000_tester_tour.sql')
const MIGRATION = path.join(MIGRATIONS_DIR, '20261013000000_tour_rail_closed.sql')

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const TESTER_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_ID = '33333333-3333-3333-3333-333333333333'
const LISTING_ID = '44444444-4444-4444-4444-444444444444'
const LISTING_2_ID = '55555555-5555-5555-5555-555555555555'
const ENROLLMENT_ID = '66666666-6666-6666-6666-666666666666'

const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE auth.users (
    id uuid PRIMARY KEY
  );

  CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role    text NOT NULL
  );

  CREATE TABLE listings (
    id   uuid PRIMARY KEY,
    name text NOT NULL
  );

  INSERT INTO auth.users (id) VALUES
    ('${ADMIN_ID}'), ('${TESTER_ID}'), ('${OTHER_ID}');

  INSERT INTO user_roles (user_id, role) VALUES
    ('${ADMIN_ID}', 'admin');

  INSERT INTO listings (id, name) VALUES
    ('${LISTING_ID}', 'Fixture Listing'),
    ('${LISTING_2_ID}', 'Second Fixture Listing');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON user_roles TO anon, authenticated;
`

const SEED_ENROLLMENT = `
  INSERT INTO tour_enrollments (id, tester_user_id, listing_id, invited_by)
    VALUES ('${ENROLLMENT_ID}', '${TESTER_ID}', '${LISTING_ID}', '${ADMIN_ID}');
`

async function withMigrated(
  name: string,
  fn: (url: string) => void | Promise<void>
): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, BASE)
    applyFile(url, MIGRATION)
    // Deliberately generous, as in tester-tour.test.ts: a denied write below
    // can only be RLS.
    exec(url, 'GRANT SELECT, INSERT, UPDATE, DELETE ON tour_enrollments TO anon, authenticated;')
    exec(url, SEED_ENROLLMENT)
    await fn(url)
  })
}

const closedAt = (url: string) =>
  query<{ rail_closed_at: string | null }>(url, 'SELECT rail_closed_at FROM tour_enrollments')[0]
    ?.rail_closed_at

describe.skipIf(!DB_REACHABLE)('migration: 20261013000000_tour_rail_closed', () => {
  it('starts null on existing enrollments, so every panel still shows', async () => {
    await withMigrated('rail_closed_default', (url) => {
      expect(closedAt(url)).toBeNull()
    })
  })

  it('refuses closing an unfinished walk, and accepts it once finished', async () => {
    await withMigrated('rail_closed_requires_completion', (url) => {
      const close = `UPDATE tour_enrollments SET rail_closed_at = now() WHERE id = '${ENROLLMENT_ID}';`
      expect(raises(url, close)).toBe(true)

      exec(url, `UPDATE tour_enrollments SET completed_at = now() WHERE id = '${ENROLLMENT_ID}';`)
      exec(url, close)
      expect(closedAt(url)).not.toBeNull()
    })
  })

  it('does not let a tester write the mark themselves', async () => {
    await withMigrated('rail_closed_no_self_write', (url) => {
      exec(url, `UPDATE tour_enrollments SET completed_at = now() WHERE id = '${ENROLLMENT_ID}';`)
      exec(
        url,
        `SELECT set_config('request.jwt.claim.sub', '${TESTER_ID}', false);
         SET ROLE authenticated;
         UPDATE tour_enrollments SET rail_closed_at = now() WHERE id = '${ENROLLMENT_ID}';`
      )
      // RLS has no UPDATE policy, so the tester's update touches zero rows.
      expect(closedAt(url)).toBeNull()
    })
  })

  it('is safe to apply twice', async () => {
    await withMigrated('rail_closed_rerun', (url) => {
      applyFile(url, MIGRATION)
      expect(
        query(
          url,
          `SELECT conname FROM pg_constraint
            WHERE conname = 'tour_enrollments_rail_closed_requires_completion'`
        )
      ).toHaveLength(1)
    })
  })
})
