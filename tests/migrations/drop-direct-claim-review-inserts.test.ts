// =============================================================================
// Migration test: 20261002000000_drop_direct_claim_review_inserts.sql
// =============================================================================
// The audit finding: any signed-in user could POST straight to /rest/v1/claims
// or /rest/v1/reviews and skip Turnstile, the quotas, the duplicate checks and
// "owners cannot review their own business". The fix is an ABSENCE: no INSERT
// policy on either table, so only service_role (the server actions, after their
// checks) can insert.
//
// As in listings-entitlement-guard.test.ts, these tests connect AS
// `authenticated` with a real JWT subject and send the write the attacker would
// send. The fixture grants generously on every table, so each denial below can
// only be RLS doing its job.
//
// Three groups:
//
//   * The direct inserts must fail, even with a row that satisfies the old
//     policy's shape.
//   * service_role (createClaim.ts / createReview.ts) must still insert both.
//   * review_ratings must still accept a rating from the review's own author on
//     the user client: its policy reads reviews through the SELECT policy,
//     which this migration does not touch.
//
// The first test runs the direct inserts WITHOUT the migration and expects them
// to SUCCEED, so the "fails" assertions stay honest if the fixture ever stops
// reproducing the hole.
//
// The fixture policies are copied from 20260510000001_mvp_rls_policies.sql,
// 20260926000000_listings_entitlement_guard.sql and
// 20260622000005_review_criteria.sql, so the migration's DROP ... IF EXISTS
// replaces real policy names.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
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

const MIGRATION = path.join(MIGRATIONS_DIR, '20261002000000_drop_direct_claim_review_inserts.sql')

const USER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const LISTING = '44444444-4444-4444-4444-444444444444'
const CRITERION = '55555555-5555-5555-5555-555555555555'

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

  CREATE TABLE listings (
    id   uuid PRIMARY KEY,
    name text NOT NULL
  );
  INSERT INTO listings (id, name) VALUES ('${LISTING}', 'Corner Shop');

  CREATE TABLE claims (
    id                     uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id             uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    claimant_user_id       uuid,
    status                 text        NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending','under_review','approved','rejected','withdrawn')),
    submitted_at           timestamptz NOT NULL DEFAULT now(),
    reviewed_at            timestamptz,
    reviewed_by            uuid,
    rejection_reason       text,
    verification_doc_paths text[],
    notes                  text
  );
  ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

  -- Verbatim from 20260510000001_mvp_rls_policies.sql.
  CREATE POLICY "claims: authenticated read own"
    ON claims FOR SELECT TO authenticated
    USING (claimant_user_id = auth.uid());

  -- Verbatim from 20260926000000_listings_entitlement_guard.sql.
  CREATE POLICY "claims: authenticated insert"
    ON claims FOR INSERT TO authenticated
    WITH CHECK (
      claimant_user_id = auth.uid()
      AND status = 'pending'
      AND reviewed_at IS NULL
      AND reviewed_by IS NULL
      AND rejection_reason IS NULL
    );

  CREATE TABLE reviews (
    id               uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id       uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reviewer_user_id uuid,
    rating           integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title            text,
    body             text,
    status           text    NOT NULL DEFAULT 'intake'
                             CHECK (status IN ('intake','pending_approval','published','rejected','removed')),
    visit_date       date,
    UNIQUE (reviewer_user_id, listing_id)
  );
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

  -- Verbatim from 20260510000001_mvp_rls_policies.sql.
  CREATE POLICY "reviews: anon read published"
    ON reviews FOR SELECT TO anon
    USING (status = 'published');

  CREATE POLICY "reviews: authenticated read published or own"
    ON reviews FOR SELECT TO authenticated
    USING (
      status = 'published'
      OR reviewer_user_id = auth.uid()
    );

  CREATE POLICY "reviews: authenticated insert"
    ON reviews FOR INSERT TO authenticated
    WITH CHECK (
      reviewer_user_id = auth.uid()
      AND status = 'intake'
    );

  -- review_criteria is left out; the FK to it is not what is under test.
  CREATE TABLE review_ratings (
    review_id    uuid    NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    criterion_id uuid    NOT NULL,
    rating       integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    PRIMARY KEY (review_id, criterion_id)
  );
  ALTER TABLE review_ratings ENABLE ROW LEVEL SECURITY;

  -- Verbatim from 20260622000005_review_criteria.sql.
  CREATE POLICY "review_ratings: insert own review"
    ON review_ratings FOR INSERT TO authenticated
    WITH CHECK (
      review_id IN (SELECT id FROM reviews WHERE reviewer_user_id = auth.uid())
    );

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  -- Deliberately generous. Table grants are never what stops a request in
  -- these tests, so every denial below is RLS doing its job.
  GRANT SELECT, INSERT, UPDATE, DELETE
    ON listings, claims, reviews, review_ratings
    TO authenticated, service_role;
`

type Role = 'anon' | 'authenticated' | 'service_role'

function preamble(role: Role, uid: string | null): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
          SET ROLE ${role};`
}

// `exec` opens a fresh connection per call, so SET ROLE and the statement
// travel together in one `-c`.
function runsAs(url: string, role: Role, uid: string | null, sql: string): boolean {
  return !raises(url, `${preamble(role, uid)} ${sql}`)
}

function failsAs(url: string, role: Role, uid: string | null, sql: string): boolean {
  return raises(url, `${preamble(role, uid)} ${sql}`)
}

// The exact shapes the server actions insert.
const claimInsert = (uid: string): string =>
  `INSERT INTO claims (listing_id, claimant_user_id, status, notes)
     VALUES ('${LISTING}', '${uid}', 'pending', 'I own this shop');`

const reviewInsert = (uid: string): string =>
  `INSERT INTO reviews (listing_id, reviewer_user_id, rating, title, body, status)
     VALUES ('${LISTING}', '${uid}', 5, 'Great', 'Lovely place', 'intake');`

function insertPolicies(url: string): { tablename: string; policyname: string }[] {
  return query(
    url,
    `SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('claims', 'reviews')
        AND cmd IN ('INSERT', 'ALL')
      ORDER BY tablename, policyname`
  )
}

async function withMigrated(
  name: string,
  fn: (url: string) => void | Promise<void>
): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    await fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)('migration: drop direct claim and review inserts', () => {
  it('reproduces the hole without the migration (keeps the denial cases honest)', async () => {
    await withScratchDb('drop_inserts_baseline', (url) => {
      exec(url, FIXTURE)
      expect(runsAs(url, 'authenticated', USER, claimInsert(USER))).toBe(true)
      expect(runsAs(url, 'authenticated', USER, reviewInsert(USER))).toBe(true)
      expect(insertPolicies(url)).toHaveLength(2)
    })
  })

  it('refuses a signed-in user inserting their own claim directly', async () => {
    await withMigrated('drop_inserts_claim', (url) => {
      expect(failsAs(url, 'authenticated', USER, claimInsert(USER))).toBe(true)
      expect(query(url, 'SELECT id FROM claims')).toHaveLength(0)
    })
  })

  it('refuses a signed-in user inserting their own review directly', async () => {
    await withMigrated('drop_inserts_review', (url) => {
      expect(failsAs(url, 'authenticated', USER, reviewInsert(USER))).toBe(true)
      expect(query(url, 'SELECT id FROM reviews')).toHaveLength(0)
    })
  })

  it('still lets service_role insert both, and the user can read their own rows', async () => {
    await withMigrated('drop_inserts_service', (url) => {
      expect(runsAs(url, 'service_role', null, claimInsert(USER))).toBe(true)
      expect(runsAs(url, 'service_role', null, reviewInsert(USER))).toBe(true)
      expect(query(url, 'SELECT id FROM claims')).toHaveLength(1)
      expect(query(url, 'SELECT id FROM reviews')).toHaveLength(1)

      // The actions' duplicate and quota checks read through the user client.
      const ownClaims = exec(
        url,
        `${preamble('authenticated', USER)} SELECT count(*) FROM claims;`
      ).trim()
      const ownReviews = exec(
        url,
        `${preamble('authenticated', USER)} SELECT count(*) FROM reviews;`
      ).trim()
      expect(ownClaims.split('\n').pop()).toBe('1')
      expect(ownReviews.split('\n').pop()).toBe('1')
    })
  })

  it('still lets the review author add criterion ratings on the user client', async () => {
    await withMigrated('drop_inserts_ratings', (url) => {
      expect(runsAs(url, 'service_role', null, reviewInsert(USER))).toBe(true)
      const [review] = query<{ id: string }>(url, 'SELECT id FROM reviews')
      if (!review) throw new Error('review missing')

      const rating = `INSERT INTO review_ratings (review_id, criterion_id, rating)
                        VALUES ('${review.id}', '${CRITERION}', 4);`
      // Someone else cannot attach ratings to it.
      expect(failsAs(url, 'authenticated', OTHER, rating)).toBe(true)
      expect(runsAs(url, 'authenticated', USER, rating)).toBe(true)
      expect(query(url, 'SELECT review_id FROM review_ratings')).toHaveLength(1)
    })
  })

  it('leaves no INSERT policy on claims or reviews and keeps the SELECT policies', async () => {
    await withMigrated('drop_inserts_policies', (url) => {
      expect(insertPolicies(url)).toEqual([])
      const selects = query<{ policyname: string }>(
        url,
        `SELECT policyname FROM pg_policies
          WHERE tablename IN ('claims', 'reviews') AND cmd = 'SELECT'
          ORDER BY policyname`
      ).map((p) => p.policyname)
      expect(selects).toEqual([
        'claims: authenticated read own',
        'reviews: anon read published',
        'reviews: authenticated read published or own',
      ])
    })
  })

  it('is safe to apply twice', async () => {
    await withMigrated('drop_inserts_twice', (url) => {
      expect(() => applyFile(url, MIGRATION)).not.toThrow()
      expect(insertPolicies(url)).toEqual([])
      expect(failsAs(url, 'authenticated', USER, claimInsert(USER))).toBe(true)
      expect(runsAs(url, 'service_role', null, claimInsert(USER))).toBe(true)
    })
  })
})
