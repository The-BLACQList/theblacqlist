// =============================================================================
// Migration test: 20260830000000_tester_tour.sql
// =============================================================================
// The Tester Tour mints a real Stripe subscription. The only thing standing
// between a tester and a free Starter they did not earn is that neither table
// has an INSERT or UPDATE policy — so the security property under test here is
// an ABSENCE, and an absence is exactly the kind of thing a future migration
// removes by accident while "tidying up the policies".
//
// Asserting that no write policy exists in pg_policies would be a weak test: it
// passes for the wrong reason on a table nobody granted anything on. So, as in
// sponsor-campaigns-rls.test.ts, the fixture is deliberately generous —
//
//     GRANT SELECT, INSERT, UPDATE, DELETE ON both tables TO anon, authenticated;
//
// — which means every denial below can only be RLS doing its job, and every one
// of them would start passing the moment someone added a write policy.
//
// The fixture stands up minimal stand-ins for auth.uid(), auth.users,
// user_roles, and listings rather than replaying the full migration history.
// The migration under test references exactly those four and nothing else.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases — the harness must never point at staging or production.
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

const MIGRATION = path.join(MIGRATIONS_DIR, '20260830000000_tester_tour.sql')

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const TESTER_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_ID = '33333333-3333-3333-3333-333333333333'
const LISTING_ID = '44444444-4444-4444-4444-444444444444'
const LISTING_2_ID = '55555555-5555-5555-5555-555555555555'
const ENROLLMENT_ID = '66666666-6666-6666-6666-666666666666'

// The exact list the migration's CHECK constraint carries. Kept as a literal
// here on purpose: this file's job is to pin the SQL, and lib/tour/steps.ts does
// not exist until the code phase. The TS-to-SQL match is asserted there.
const TOUR_STEP_KEYS = [
  'search_ran',
  'listing_opened',
  'listing_saved',
  'collection_browsed',
  'review_or_correction',
  'final_reflection',
]

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

// Applied after the migration, because the tables do not exist before it.
// Deliberately generous — see the header.
const GRANTS = `
  GRANT SELECT, INSERT, UPDATE, DELETE ON tour_enrollments TO anon, authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON tour_step_completions TO anon, authenticated;
`

const SEED_ENROLLMENT = `
  INSERT INTO tour_enrollments (id, tester_user_id, listing_id, invited_by)
    VALUES ('${ENROLLMENT_ID}', '${TESTER_ID}', '${LISTING_ID}', '${ADMIN_ID}');
`

function asRole(
  url: string,
  role: 'anon' | 'authenticated',
  uid: string | null,
  sql: string
): string {
  return exec(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
     SET ROLE ${role};
     ${sql}`
  )
}

function failsAs(
  url: string,
  role: 'anon' | 'authenticated',
  uid: string | null,
  sql: string
): boolean {
  return raises(
    url,
    `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
     SET ROLE ${role};
     ${sql}`
  )
}

function countAs(
  url: string,
  role: 'anon' | 'authenticated',
  uid: string | null,
  table: string
): number {
  return Number(
    asRole(url, role, uid, `SELECT count(*) FROM ${table};`).trim().split('\n').pop()
  )
}

async function withMigrated(name: string, fn: (url: string) => void | Promise<void>): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    exec(url, GRANTS)
    await fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)('migration: tester tour', () => {
  // ==========================================================================
  // The absence that is the security boundary
  // ==========================================================================

  it('creates SELECT-only policies and no write policy on either table', async () => {
    await withMigrated('tour_policy_shape', (url) => {
      const policies = query<{ tablename: string; cmd: string }>(
        url,
        `SELECT tablename, cmd FROM pg_policies
          WHERE tablename IN ('tour_enrollments', 'tour_step_completions')`
      )

      // Two per table: the tester's own, and admin read-all.
      expect(policies).toHaveLength(4)
      // If this ever fails with an INSERT/UPDATE/ALL row, a free-subscription
      // vulnerability has just been reintroduced. Do not "fix" it by widening
      // the assertion.
      expect(policies.every((p) => p.cmd === 'SELECT')).toBe(true)

      for (const table of ['tour_enrollments', 'tour_step_completions']) {
        const [rls] = query<{ relrowsecurity: boolean }>(
          url,
          `SELECT relrowsecurity FROM pg_class WHERE relname = '${table}'`
        )
        expect(rls?.relrowsecurity).toBe(true)
      }
    })
  })

  it('denies every write to anon and authenticated on both tables', async () => {
    await withMigrated('tour_writes_denied', (url) => {
      exec(url, SEED_ENROLLMENT)

      const insertEnrollment = `INSERT INTO tour_enrollments (tester_user_id, listing_id)
                                  VALUES ('${TESTER_ID}', '${LISTING_2_ID}');`
      const insertStep = `INSERT INTO tour_step_completions (enrollment_id, step_key)
                            VALUES ('${ENROLLMENT_ID}', 'search_ran');`

      for (const uid of [TESTER_ID, ADMIN_ID, OTHER_ID, null]) {
        expect(failsAs(url, 'authenticated', uid, insertEnrollment)).toBe(true)
        expect(failsAs(url, 'authenticated', uid, insertStep)).toBe(true)
      }
      expect(failsAs(url, 'anon', null, insertEnrollment)).toBe(true)
      expect(failsAs(url, 'anon', null, insertStep)).toBe(true)

      // Only the seeded row survives — nothing was written by anyone.
      expect(query(url, 'SELECT id FROM tour_enrollments')).toHaveLength(1)
      expect(query(url, 'SELECT id FROM tour_step_completions')).toHaveLength(0)
    })
  })

  it('does not let a tester grant themselves the trial by UPDATE', async () => {
    await withMigrated('tour_self_grant', (url) => {
      exec(url, SEED_ENROLLMENT)

      // This is the attack the missing UPDATE policy exists to stop. An UPDATE
      // with no matching policy affects zero rows rather than raising, so
      // reading the row back is the only assertion that catches a regression.
      asRole(
        url,
        'authenticated',
        TESTER_ID,
        `UPDATE tour_enrollments
            SET completed_at = now(), trial_granted_at = now()
          WHERE id = '${ENROLLMENT_ID}';`
      )

      const [row] = query<{ completed_at: string | null; trial_granted_at: string | null }>(
        url,
        'SELECT completed_at, trial_granted_at FROM tour_enrollments'
      )
      expect(row?.completed_at).toBeNull()
      expect(row?.trial_granted_at).toBeNull()

      // ...and they cannot delete the evidence of not having earned it either.
      asRole(url, 'authenticated', TESTER_ID, 'DELETE FROM tour_enrollments;')
      expect(query(url, 'SELECT id FROM tour_enrollments')).toHaveLength(1)
    })
  })

  it('lets a tester read their own rows and nobody else read them', async () => {
    await withMigrated('tour_reads', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `INSERT INTO tour_step_completions (enrollment_id, step_key)
           VALUES ('${ENROLLMENT_ID}', 'search_ran');`
      )

      expect(countAs(url, 'authenticated', TESTER_ID, 'tour_enrollments')).toBe(1)
      expect(countAs(url, 'authenticated', TESTER_ID, 'tour_step_completions')).toBe(1)

      // An admin sees everything — the /admin/testers surface depends on it.
      expect(countAs(url, 'authenticated', ADMIN_ID, 'tour_enrollments')).toBe(1)
      expect(countAs(url, 'authenticated', ADMIN_ID, 'tour_step_completions')).toBe(1)

      // Another signed-in user holds full table DML and still sees nothing.
      expect(countAs(url, 'authenticated', OTHER_ID, 'tour_enrollments')).toBe(0)
      expect(countAs(url, 'authenticated', OTHER_ID, 'tour_step_completions')).toBe(0)

      expect(countAs(url, 'anon', null, 'tour_enrollments')).toBe(0)
      expect(countAs(url, 'anon', null, 'tour_step_completions')).toBe(0)
    })
  })

  // ==========================================================================
  // The database backstop for the claim
  // ==========================================================================

  it('refuses a trial grant on an enrollment that was never completed', async () => {
    await withMigrated('tour_trial_requires_completion', (url) => {
      exec(url, SEED_ENROLLMENT)

      expect(
        raises(url, `UPDATE tour_enrollments SET trial_granted_at = now() WHERE id = '${ENROLLMENT_ID}';`)
      ).toBe(true)

      // With completion first, the same grant is accepted.
      exec(
        url,
        `UPDATE tour_enrollments SET completed_at = now(), trial_granted_at = now()
          WHERE id = '${ENROLLMENT_ID}';`
      )
      const [row] = query<{ trial_granted_at: string | null }>(
        url,
        'SELECT trial_granted_at FROM tour_enrollments'
      )
      expect(row?.trial_granted_at).not.toBeNull()
    })
  })

  it('refuses a Stripe session id on an unclaimed enrollment', async () => {
    await withMigrated('tour_session_requires_claim', (url) => {
      exec(url, SEED_ENROLLMENT)

      // Recording a session without a claim would mean Stripe was called before
      // the claim was taken — the ordering bug claim-before-Stripe prevents.
      expect(
        raises(
          url,
          `UPDATE tour_enrollments SET stripe_checkout_session_id = 'cs_test_1'
            WHERE id = '${ENROLLMENT_ID}';`
        )
      ).toBe(true)
    })
  })

  it('allows one live enrollment per tester, and frees the slot when ended', async () => {
    await withMigrated('tour_one_live', (url) => {
      exec(url, SEED_ENROLLMENT)

      const second = `INSERT INTO tour_enrollments (tester_user_id, listing_id)
                        VALUES ('${TESTER_ID}', '${LISTING_2_ID}');`
      expect(raises(url, second)).toBe(true)

      exec(url, `UPDATE tour_enrollments SET ended_at = now() WHERE id = '${ENROLLMENT_ID}';`)
      exec(url, second)

      expect(query(url, 'SELECT id FROM tour_enrollments')).toHaveLength(2)
    })
  })

  it('allows one trial per tester across enrollments, even ended ones', async () => {
    await withMigrated('tour_one_trial_per_tester', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `UPDATE tour_enrollments SET completed_at = now(), trial_granted_at = now(), ended_at = now()
          WHERE id = '${ENROLLMENT_ID}';`
      )

      // Re-inviting the tester for a second walk is fine...
      exec(
        url,
        `INSERT INTO tour_enrollments (id, tester_user_id, listing_id, completed_at)
           VALUES ('77777777-7777-7777-7777-777777777777', '${TESTER_ID}', '${LISTING_2_ID}', now());`
      )

      // ...minting them a second free Starter is not.
      expect(
        raises(
          url,
          `UPDATE tour_enrollments SET trial_granted_at = now()
            WHERE id = '77777777-7777-7777-7777-777777777777';`
        )
      ).toBe(true)
    })
  })

  it('allows one trial per listing, so co-owners cannot double-subscribe it', async () => {
    await withMigrated('tour_one_trial_per_listing', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `UPDATE tour_enrollments SET completed_at = now(), trial_granted_at = now()
          WHERE id = '${ENROLLMENT_ID}';`
      )

      // A different tester, enrolled on the same listing.
      exec(
        url,
        `INSERT INTO tour_enrollments (id, tester_user_id, listing_id, completed_at)
           VALUES ('88888888-8888-8888-8888-888888888888', '${OTHER_ID}', '${LISTING_ID}', now());`
      )
      expect(
        raises(
          url,
          `UPDATE tour_enrollments SET trial_granted_at = now()
            WHERE id = '88888888-8888-8888-8888-888888888888';`
        )
      ).toBe(true)
    })
  })

  it('keeps stripe_checkout_session_id unique across enrollments', async () => {
    await withMigrated('tour_session_unique', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `UPDATE tour_enrollments
            SET completed_at = now(), trial_granted_at = now(), stripe_checkout_session_id = 'cs_test_1'
          WHERE id = '${ENROLLMENT_ID}';`
      )

      exec(
        url,
        `INSERT INTO tour_enrollments (id, tester_user_id, listing_id, completed_at, trial_granted_at)
           VALUES ('99999999-9999-9999-9999-999999999999', '${OTHER_ID}', '${LISTING_2_ID}', now(), now());`
      )
      expect(
        raises(
          url,
          `UPDATE tour_enrollments SET stripe_checkout_session_id = 'cs_test_1'
            WHERE id = '99999999-9999-9999-9999-999999999999';`
        )
      ).toBe(true)
    })
  })

  // ==========================================================================
  // Evidence rows
  // ==========================================================================

  it('accepts every tour step key and rejects anything else', async () => {
    await withMigrated('tour_step_keys', (url) => {
      exec(url, SEED_ENROLLMENT)

      for (const key of TOUR_STEP_KEYS) {
        exec(
          url,
          `INSERT INTO tour_step_completions (enrollment_id, step_key)
             VALUES ('${ENROLLMENT_ID}', '${key}');`
        )
      }
      expect(query(url, 'SELECT id FROM tour_step_completions')).toHaveLength(TOUR_STEP_KEYS.length)

      expect(
        raises(
          url,
          `INSERT INTO tour_step_completions (enrollment_id, step_key)
             VALUES ('${ENROLLMENT_ID}', 'invented_step');`
        )
      ).toBe(true)
    })
  })

  it('records each step at most once per enrollment', async () => {
    await withMigrated('tour_step_unique', (url) => {
      exec(url, SEED_ENROLLMENT)
      const insert = `INSERT INTO tour_step_completions (enrollment_id, step_key)
                        VALUES ('${ENROLLMENT_ID}', 'search_ran');`

      exec(url, insert)
      expect(raises(url, insert)).toBe(true)

      // The witness re-fires on every page view, so it relies on this being an
      // ON CONFLICT DO NOTHING rather than an error path.
      exec(url, `${insert.replace(';', '')} ON CONFLICT DO NOTHING;`)
      expect(query(url, 'SELECT id FROM tour_step_completions')).toHaveLength(1)
    })
  })

  it('holds the reflection floor and keeps the reflection columns paired', async () => {
    await withMigrated('tour_reflection_rules', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `INSERT INTO tour_step_completions (enrollment_id, step_key)
           VALUES ('${ENROLLMENT_ID}', 'final_reflection');`
      )

      // Too short.
      expect(
        raises(url, `UPDATE tour_step_completions SET reflection = 'too short', reflected_at = now();`)
      ).toBe(true)

      // Twenty spaces is not a reflection.
      expect(
        raises(
          url,
          `UPDATE tour_step_completions SET reflection = '                        ', reflected_at = now();`
        )
      ).toBe(true)

      // Reflection without a timestamp leaves "when did they write this"
      // unanswerable.
      expect(
        raises(
          url,
          `UPDATE tour_step_completions SET reflection = 'The search felt fast enough to trust.';`
        )
      ).toBe(true)

      exec(
        url,
        `UPDATE tour_step_completions
            SET reflection = 'The search felt fast enough to trust.', reflected_at = now();`
      )
      const [row] = query<{ reflection: string | null }>(
        url,
        'SELECT reflection FROM tour_step_completions'
      )
      expect(row?.reflection).toContain('fast enough')
    })
  })

  it('cascades step rows when the enrollment goes away', async () => {
    await withMigrated('tour_cascade', (url) => {
      exec(url, SEED_ENROLLMENT)
      exec(
        url,
        `INSERT INTO tour_step_completions (enrollment_id, step_key)
           VALUES ('${ENROLLMENT_ID}', 'search_ran');`
      )

      exec(url, `DELETE FROM auth.users WHERE id = '${TESTER_ID}';`)

      expect(query(url, 'SELECT id FROM tour_enrollments')).toHaveLength(0)
      expect(query(url, 'SELECT id FROM tour_step_completions')).toHaveLength(0)
    })
  })

  it('is safe to apply twice', async () => {
    await withMigrated('tour_rerun', (url) => {
      // Every CREATE in the migration is IF NOT EXISTS except the policies,
      // which do raise on a re-run. That is the same shape as the rest of the
      // suite: re-running is a no-op for the tables, and the policy error is
      // loud rather than silent.
      expect(query(url, "SELECT id FROM tour_enrollments")).toHaveLength(0)
      expect(
        query(
          url,
          `SELECT tablename FROM pg_tables
            WHERE tablename IN ('tour_enrollments', 'tour_step_completions')`
        )
      ).toHaveLength(2)
    })
  })
})
