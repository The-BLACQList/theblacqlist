// =============================================================================
// Migration test: 20261006000000_category_requests.sql
// =============================================================================
// Three things to prove:
//
//   * moderation_queue accepts 'new_submission' after the migration (and the
//     fixture rejects it before, so the test stays honest), and the backfill
//     queues each pending listing exactly once, skipping drafts, deleted rows
//     and listings already queued.
//   * An owner can insert a pending category request for a listing they own,
//     and only that. They cannot file one for someone else's listing, mark it
//     approved, or open a second pending request for the same listing.
//   * Owners read their own requests, admins read all, and nobody but
//     service_role can approve or decline.
//
// The fixture copies owns_listing() and is_admin() from
// 20260510000001_mvp_rls_policies.sql and the moderation_queue CHECK from the
// initial schema, so the migration's DROP CONSTRAINT replaces the real name.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from './helpers'

const MIGRATION = path.join(MIGRATIONS_DIR, '20261006000000_category_requests.sql')

const OWNER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const MINE = '44444444-4444-4444-4444-444444444444'
const THEIRS = '55555555-5555-5555-5555-555555555555'
const PENDING_A = '66666666-6666-6666-6666-666666666661'
const PENDING_B = '66666666-6666-6666-6666-666666666662'
const PENDING_DELETED = '66666666-6666-6666-6666-666666666663'
const GROUP = '77777777-7777-7777-7777-777777777777'

const FIXTURE = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  INSERT INTO auth.users (id) VALUES ('${OWNER}'), ('${OTHER}'), ('${ADMIN}');

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;

  CREATE TABLE user_roles (user_id uuid NOT NULL, role text NOT NULL);
  INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');

  CREATE TABLE categories (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    slug       text NOT NULL UNIQUE,
    parent_id  uuid REFERENCES categories(id) ON DELETE SET NULL
  );
  INSERT INTO categories (id, name, slug) VALUES ('${GROUP}', 'Beauty', 'beauty');

  CREATE TABLE listings (
    id            uuid PRIMARY KEY,
    name          text NOT NULL,
    status        text NOT NULL DEFAULT 'draft',
    owner_user_id uuid,
    deleted_at    timestamptz
  );
  INSERT INTO listings (id, name, status, owner_user_id, deleted_at) VALUES
    ('${MINE}',            'Henna by Asha',  'draft',     '${OWNER}', NULL),
    ('${THEIRS}',          'Corner Shop',    'draft',     '${OTHER}', NULL),
    ('${PENDING_A}',       'Pending A',      'pending',   '${OTHER}', NULL),
    ('${PENDING_B}',       'Pending B',      'pending',   '${OTHER}', NULL),
    ('${PENDING_DELETED}', 'Pending gone',   'pending',   '${OTHER}', now());

  CREATE TABLE moderation_queue (
    id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_type   text        NOT NULL CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification')),
    entity_id    uuid        NOT NULL,
    entity_type  text        NOT NULL,
    status       text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','assigned','resolved','dismissed')),
    priority     integer     NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
  );

  -- Verbatim from 20260510000001_mvp_rls_policies.sql.
  CREATE OR REPLACE FUNCTION is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    );
  $$;

  CREATE OR REPLACE FUNCTION owns_listing(p_listing_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM listings
      WHERE id = p_listing_id
        AND owner_user_id = auth.uid()
        AND deleted_at IS NULL
    );
  $$;

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  -- What Supabase does for every new table in public.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`

type Role = 'anon' | 'authenticated' | 'service_role'

function as(role: Role, uid: string | null, sql: string): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false); SET ROLE ${role}; ${sql}`
}

const request = (listing: string, uid: string, extra = ''): string =>
  `INSERT INTO category_requests (listing_id, requested_by, owner_words, proposed_name, parent_category_id${extra ? ', status, reviewed_at' : ''})
     VALUES ('${listing}', '${uid}', 'Bridal henna and mehndi parties', 'Henna & Mehndi', '${GROUP}'${extra});`

function visibleTo(url: string, uid: string): number {
  const out = exec(url, as('authenticated', uid, 'SELECT count(*) FROM category_requests;')).trim()
  return Number(out.split('\n').pop())
}

describe.skipIf(!DB_REACHABLE)('20261006000000_category_requests', () => {
  it('rejects new_submission before the migration (fixture is honest)', async () => {
    await withScratchDb('catreq_before', (url) => {
      exec(url, FIXTURE)
      expect(
        raises(url, `INSERT INTO moderation_queue (queue_type, entity_id, entity_type) VALUES ('new_submission', '${MINE}', 'listing');`),
      ).toBe(true)
    })
  })

  it('accepts new_submission and backfills each pending listing once', async () => {
    await withScratchDb('catreq_queue', (url) => {
      exec(url, FIXTURE)
      // PENDING_B is already queued; the backfill must not add a second row.
      exec(url, `ALTER TABLE moderation_queue DROP CONSTRAINT moderation_queue_queue_type_check;`)
      exec(url, `INSERT INTO moderation_queue (queue_type, entity_id, entity_type) VALUES ('new_submission', '${PENDING_B}', 'listing');`)
      exec(url, `ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_queue_type_check
                   CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification','new_submission'));`)

      applyFile(url, MIGRATION)

      const rows = query<{ entity_id: string; n: number }>(
        url,
        `SELECT entity_id, count(*)::int AS n FROM moderation_queue
          WHERE queue_type = 'new_submission' GROUP BY entity_id ORDER BY entity_id`,
      )
      expect(rows).toEqual([
        { entity_id: PENDING_A, n: 1 },
        { entity_id: PENDING_B, n: 1 },
      ])
      expect(
        raises(url, `INSERT INTO moderation_queue (queue_type, entity_id, entity_type) VALUES ('new_submission', '${MINE}', 'listing');`),
      ).toBe(false)
      expect(
        raises(url, `INSERT INTO moderation_queue (queue_type, entity_id, entity_type) VALUES ('made_up', '${MINE}', 'listing');`),
      ).toBe(true)
    })
  })

  it('lets an owner request a category for their own listing only', async () => {
    await withScratchDb('catreq_owner', (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      expect(raises(url, as('authenticated', OWNER, request(MINE, OWNER)))).toBe(false)
      // Second pending request for the same listing.
      expect(raises(url, as('authenticated', OWNER, request(MINE, OWNER)))).toBe(true)
      // Someone else's listing.
      expect(raises(url, as('authenticated', OWNER, request(THEIRS, OWNER)))).toBe(true)
      // Filing it in someone else's name.
      expect(raises(url, as('authenticated', OTHER, request(MINE, OWNER)))).toBe(true)
      // Approving their own request on the way in.
      expect(raises(url, as('authenticated', OTHER, request(THEIRS, OTHER, ", 'approved', now()")))).toBe(true)
      // Anonymous.
      expect(raises(url, as('anon', null, request(MINE, OWNER)))).toBe(true)
    })
  })

  it('shows owners their own rows, admins all rows, and leaves review to service_role', async () => {
    await withScratchDb('catreq_read', (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      exec(url, as('authenticated', OWNER, request(MINE, OWNER)))
      exec(url, as('authenticated', OTHER, request(THEIRS, OTHER)))

      expect(visibleTo(url, OWNER)).toBe(1)
      expect(visibleTo(url, OTHER)).toBe(1)
      expect(visibleTo(url, ADMIN)).toBe(2)

      const approve = `UPDATE category_requests SET status = 'approved', reviewed_at = now() WHERE listing_id = '${MINE}' RETURNING id;`
      // No UPDATE grant or policy: the owner and even an admin's user client are refused.
      expect(raises(url, as('authenticated', OWNER, approve))).toBe(true)
      expect(raises(url, as('authenticated', ADMIN, approve))).toBe(true)
      expect(raises(url, as('service_role', null, approve))).toBe(false)

      // Supabase's default ALL grant is revoked: signed-in users keep read and insert only, anon nothing.
      const grants = query<{ grantee: string; privilege_type: string }>(
        url,
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_name = 'category_requests' AND grantee IN ('anon', 'authenticated')
          ORDER BY grantee, privilege_type`,
      )
      expect(grants).toEqual([
        { grantee: 'authenticated', privilege_type: 'INSERT' },
        { grantee: 'authenticated', privilege_type: 'SELECT' },
      ])
      expect(raises(url, as('authenticated', OWNER, 'TRUNCATE category_requests;'))).toBe(true)

      // Reviewed rows must carry reviewed_at, and a new pending request is allowed after review.
      expect(raises(url, `UPDATE category_requests SET status = 'declined', reviewed_at = NULL WHERE listing_id = '${THEIRS}';`)).toBe(true)
      expect(raises(url, as('authenticated', OWNER, request(MINE, OWNER)))).toBe(false)
    })
  })
})
