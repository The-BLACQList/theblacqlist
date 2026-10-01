// =============================================================================
// Migration test: 20261001000000_tester_one_tap_links.sql
// =============================================================================
// A one-tap link is a login, so the security property under test is again an
// ABSENCE: no write policy on tester_invites, and no EXECUTE on the two
// SECURITY DEFINER functions for anyone but service_role. As in
// tester-tour.test.ts the fixture grants generously on the table, so every
// denial below can only be RLS or the function grants doing their job.
//
// The fixture stands up minimal stand-ins for update_updated_at(), auth.uid(),
// auth.users (with email), user_roles and listings, then applies the tester
// tour migration this one alters.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from './helpers'

const TOUR_MIGRATION = path.join(MIGRATIONS_DIR, '20260830000000_tester_tour.sql')
const MIGRATION = path.join(MIGRATIONS_DIR, '20261001000000_tester_one_tap_links.sql')

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const TESTER_ID = '22222222-2222-2222-2222-222222222222'
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

  CREATE TABLE auth.users (
    id    uuid PRIMARY KEY,
    email text
  );

  CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role    text NOT NULL
  );

  CREATE TABLE listings (
    id   uuid PRIMARY KEY,
    name text NOT NULL
  );

  INSERT INTO auth.users (id, email) VALUES
    ('${ADMIN_ID}', 'admin@example.com'),
    ('${TESTER_ID}', 'Tester@Example.com');

  INSERT INTO user_roles (user_id, role) VALUES ('${ADMIN_ID}', 'admin');
  INSERT INTO listings (id, name) VALUES ('${LISTING_ID}', 'Fixture Listing');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON user_roles TO anon, authenticated;
`

// Deliberately generous. See the header.
const GRANTS = `
  GRANT SELECT, INSERT, UPDATE, DELETE ON tester_invites TO anon, authenticated;
`

function asRole(url: string, role: string, uid: string | null, sql: string): string {
  return exec(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
     SET ROLE ${role};
     ${sql}`
  )
}

function failsAs(url: string, role: string, uid: string | null, sql: string): boolean {
  return raises(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
     SET ROLE ${role};
     ${sql}`
  )
}

function seedInvite(
  url: string,
  hash: string,
  extra: { max_uses?: number; expires?: string; revoked?: boolean } = {}
): void {
  exec(
    url,
    `INSERT INTO tester_invites (token_hash, kind, email, label, max_uses, expires_at, revoked_at)
       VALUES ('${hash}', 'supporter', 'tester@example.com', 'T-07',
               ${extra.max_uses ?? 5},
               ${extra.expires ?? "now() + interval '14 days'"},
               ${extra.revoked ? 'now()' : 'NULL'});`
  )
}

function redeemCount(url: string, hash: string): number {
  return query(url, `SELECT * FROM redeem_tester_invite('${hash}')`).length
}

async function withMigrated(name: string, fn: (url: string) => void | Promise<void>): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, TOUR_MIGRATION)
    applyFile(url, MIGRATION)
    exec(url, GRANTS)
    await fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)('migration: tester one-tap links', () => {
  it('has RLS on and one admin SELECT policy, with no write policy', async () => {
    await withMigrated('otl_policy_shape', (url) => {
      const policies = query<{ cmd: string }>(url, `SELECT cmd FROM pg_policies WHERE tablename = 'tester_invites'`)
      // If this ever fails with an INSERT/UPDATE/ALL row, anyone could mint a
      // login. Do not "fix" it by widening the assertion.
      expect(policies).toEqual([{ cmd: 'SELECT' }])
      const [rls] = query<{ relrowsecurity: boolean }>(
        url,
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'tester_invites'`
      )
      expect(rls?.relrowsecurity).toBe(true)
    })
  })

  it('denies every write to anon and authenticated, admins included', async () => {
    await withMigrated('otl_writes_denied', (url) => {
      seedInvite(url, 'h-seed')
      const insert = `INSERT INTO tester_invites (token_hash, kind, email, label)
                        VALUES ('h-new', 'supporter', 'x@example.com', 'T-01');`
      for (const uid of [ADMIN_ID, TESTER_ID, null]) {
        expect(failsAs(url, 'authenticated', uid, insert)).toBe(true)
        // RLS hides rows from UPDATE and DELETE rather than raising, so check
        // afterwards that nothing moved.
        asRole(url, 'authenticated', uid, `UPDATE tester_invites SET label = 'HACKED', max_uses = 99;`)
        asRole(url, 'authenticated', uid, `DELETE FROM tester_invites;`)
      }
      asRole(url, 'anon', null, `UPDATE tester_invites SET label = 'HACKED';`)
      expect(query(url, `SELECT label, max_uses FROM tester_invites`)).toEqual([{ label: 'T-07', max_uses: 5 }])
      expect(failsAs(url, 'anon', null, insert)).toBe(true)
    })
  })

  it('lets admins read and hides rows from everyone else', async () => {
    await withMigrated('otl_reads', (url) => {
      seedInvite(url, 'h-seed')
      const count = (role: string, uid: string | null) =>
        Number(asRole(url, role, uid, 'SELECT count(*) FROM tester_invites;').trim().split('\n').pop())
      expect(count('authenticated', ADMIN_ID)).toBe(1)
      expect(count('authenticated', TESTER_ID)).toBe(0)
      expect(count('anon', null)).toBe(0)
    })
  })

  it('grants EXECUTE on both functions to service_role only', async () => {
    await withMigrated('otl_function_grants', (url) => {
      seedInvite(url, 'h-seed')
      for (const role of ['anon', 'authenticated']) {
        expect(failsAs(url, role, TESTER_ID, `SELECT * FROM redeem_tester_invite('h-seed');`)).toBe(true)
        expect(failsAs(url, role, TESTER_ID, `SELECT find_auth_user_id_by_email('tester@example.com');`)).toBe(true)
      }
      expect(failsAs(url, 'service_role', null, `SELECT * FROM redeem_tester_invite('h-seed');`)).toBe(false)
      expect(failsAs(url, 'service_role', null, `SELECT find_auth_user_id_by_email('tester@example.com');`)).toBe(false)
    })
  })

  it('redeems exactly max_uses times and stamps first and last use', async () => {
    await withMigrated('otl_redeem_cap', (url) => {
      seedInvite(url, 'h-cap', { max_uses: 2 })
      expect(redeemCount(url, 'h-cap')).toBe(1)
      expect(redeemCount(url, 'h-cap')).toBe(1)
      expect(redeemCount(url, 'h-cap')).toBe(0)
      const [row] = query<{ use_count: number; first: boolean; last: boolean }>(
        url,
        `SELECT use_count, first_used_at IS NOT NULL AS first, last_used_at IS NOT NULL AS last
           FROM tester_invites WHERE token_hash = 'h-cap'`
      )
      expect(row).toEqual({ use_count: 2, first: true, last: true })
    })
  })

  it('returns zero rows for expired, revoked and unknown hashes, spending nothing', async () => {
    await withMigrated('otl_redeem_dead', (url) => {
      seedInvite(url, 'h-expired', { expires: "now() - interval '1 second'" })
      seedInvite(url, 'h-revoked', { revoked: true })
      expect(redeemCount(url, 'h-expired')).toBe(0)
      expect(redeemCount(url, 'h-revoked')).toBe(0)
      expect(redeemCount(url, 'h-unknown')).toBe(0)
      const rows = query<{ use_count: number }>(url, `SELECT use_count FROM tester_invites`)
      expect(rows.every((r) => r.use_count === 0)).toBe(true)
    })
  })

  it('finds a user by email case-insensitively and returns null for none', async () => {
    await withMigrated('otl_find_email', (url) => {
      const [hit] = query<{ id: string | null }>(url, `SELECT find_auth_user_id_by_email('  tester@EXAMPLE.com ') AS id`)
      expect(hit?.id).toBe(TESTER_ID)
      const [miss] = query<{ id: string | null }>(url, `SELECT find_auth_user_id_by_email('nobody@example.com') AS id`)
      expect(miss?.id).toBeNull()
    })
  })

  it('enforces the kind and target CHECK and the use_count range', async () => {
    await withMigrated('otl_checks', (url) => {
      const bad = [
        `('h1', 'supporter', NULL, NULL)`,
        `('h2', 'supporter', 'a@example.com', '${LISTING_ID}')`,
        `('h3', 'owner', NULL, NULL)`,
        `('h4', 'owner', 'a@example.com', '${LISTING_ID}')`,
      ]
      for (const values of bad) {
        expect(raises(url, `INSERT INTO tester_invites (token_hash, kind, email, listing_id, label) VALUES ${values.replace(/\)$/, ", 'T-01')")};`)).toBe(true)
      }
      expect(raises(url, `INSERT INTO tester_invites (token_hash, kind, listing_id, label) VALUES ('h5', 'owner', '${LISTING_ID}', 'T-01');`)).toBe(false)
      expect(raises(url, `INSERT INTO tester_invites (token_hash, kind, email, label, use_count, max_uses) VALUES ('h6', 'supporter', 'a@example.com', 'T-01', 3, 2);`)).toBe(true)
      expect(raises(url, `INSERT INTO tester_invites (token_hash, kind, email, label) VALUES ('h7', 'supporter', 'a@example.com', '');`)).toBe(true)
      expect(raises(url, `INSERT INTO tester_invites (token_hash, kind, email, label) VALUES ('h5', 'supporter', 'a@example.com', 'T-02');`)).toBe(true)
    })
  })

  it('allows a supporter enrollment with no listing but never a trial on one', async () => {
    await withMigrated('otl_enrollment_trial', (url) => {
      expect(raises(url, `INSERT INTO tour_enrollments (tester_user_id, listing_id) VALUES ('${TESTER_ID}', NULL);`)).toBe(false)
      expect(raises(url, `UPDATE tour_enrollments SET trial_granted_at = now() WHERE tester_user_id = '${TESTER_ID}';`)).toBe(true)
    })
  })
})
