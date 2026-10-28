// =============================================================================
// Migration test: 20261028000000_marketplace_hide_below_growth.sql
// =============================================================================
// Ticket 105, products and services after a downgrade. What this pins:
//
//   * The public (anon, and any signed-in non-owner) sees active items only on
//     published pages on Growth or Premium. Free and Starter pages show none.
//   * The owner still sees every item on their own page, on any plan.
//   * Nothing is updated or deleted: moving the page back to Growth shows the
//     items again straight away.
//   * Re-applying the migration is safe, and the rollback in its header (the
//     original 20260511000002 policies) puts the old reads back.
//
// The fixture stands in for auth.uid(), listings and the two marketplace tables
// with only the columns the policies name, and starts from the ORIGINAL read
// policies so the test sees the migration replace them. The grants are generous
// on purpose, so every row missing below is RLS doing its job.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, withScratchDb } from './helpers'

const MIGRATION = path.join(MIGRATIONS_DIR, '20261028000000_marketplace_hide_below_growth.sql')

const OWNER = '11111111-1111-1111-1111-111111111111'
const STRANGER = '22222222-2222-2222-2222-222222222222'
const FREE = 'a0000000-0000-4000-8000-000000000000'
const STARTER = 'a1000000-0000-4000-8000-000000000000'
const GROWTH = 'a2000000-0000-4000-8000-000000000000'
const PREMIUM = 'a3000000-0000-4000-8000-000000000000'
const DRAFT_PAGE = 'a4000000-0000-4000-8000-000000000000'

const TABLES = ['marketplace_products', 'marketplace_services'] as const

// The read policies exactly as 20260511000002 wrote them. Also the rollback.
const originalPolicy = (table: string) => `
  DROP POLICY IF EXISTS "${table}_read" ON ${table};
  CREATE POLICY "${table}_read"
    ON ${table} FOR SELECT
    USING (
      (
        status = 'active'
        AND EXISTS (
          SELECT 1 FROM listings
          WHERE listings.id = ${table}.listing_id
            AND listings.status = 'published'
            AND listings.deleted_at IS NULL
        )
      )
      OR
      (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM listings
          WHERE listings.id = ${table}.listing_id
            AND listings.owner_user_id = auth.uid()
            AND listings.deleted_at IS NULL
        )
      )
    );
`
const ROLLBACK = TABLES.map(originalPolicy).join('\n')

const itemTable = (table: string) => `
  CREATE TABLE ${table} (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES listings(id),
    name       text NOT NULL,
    status     text NOT NULL DEFAULT 'active'
  );
  ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
  -- One active item per page, plus one draft on the Growth page.
  INSERT INTO ${table} (listing_id, name, status) VALUES
    ('${FREE}',       'free',       'active'),
    ('${STARTER}',    'starter',    'active'),
    ('${GROWTH}',     'growth',     'active'),
    ('${GROWTH}',     'growth-draft', 'draft'),
    ('${PREMIUM}',    'premium',    'active'),
    ('${DRAFT_PAGE}', 'draft-page', 'active');
  GRANT SELECT ON ${table} TO anon, authenticated;
`

const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE listings (
    id            uuid PRIMARY KEY,
    owner_user_id uuid,
    tier          text NOT NULL DEFAULT 'free',
    status        text NOT NULL DEFAULT 'published',
    deleted_at    timestamptz
  );

  INSERT INTO listings (id, owner_user_id, tier, status) VALUES
    ('${FREE}',       '${OWNER}', 'free',    'published'),
    ('${STARTER}',    '${OWNER}', 'starter', 'published'),
    ('${GROWTH}',     '${OWNER}', 'growth',  'published'),
    ('${PREMIUM}',    '${OWNER}', 'premium', 'published'),
    ('${DRAFT_PAGE}', '${OWNER}', 'growth',  'draft');

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  END $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT ON listings TO anon, authenticated;

  ${TABLES.map(itemTable).join('\n')}
  ${ROLLBACK}
`

function as(role: 'anon' | 'authenticated', uid: string | null, sql: string): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
          SET ROLE ${role};
          ${sql}`
}

/** Item names the caller can read from one table, sorted. */
function seen(url: string, table: string, role: 'anon' | 'authenticated', uid: string | null) {
  const out = exec(url, as(role, uid, `SELECT string_agg(name, ',' ORDER BY name) FROM ${table};`))
  return (out.trim().split('\n').pop() ?? '').split(',').filter(Boolean)
}

async function withMigrated(name: string, fn: (url: string) => void): Promise<void> {
  await withScratchDb(name, (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)('20261028000000_marketplace_hide_below_growth', () => {
  it('starts from the original policies, which show every published page', async () => {
    await withScratchDb('mhbg_before', (url) => {
      exec(url, FIXTURE)
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['free', 'growth', 'premium', 'starter'])
      }
    })
  })

  it('shows the public items on Growth and Premium pages only', async () => {
    await withMigrated('mhbg_public', (url) => {
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['growth', 'premium'])
        // A signed-in shopper is the public too.
        expect(seen(url, table, 'authenticated', STRANGER)).toEqual(['growth', 'premium'])
      }
    })
  })

  it('still shows the owner every item on their own pages', async () => {
    await withMigrated('mhbg_owner', (url) => {
      for (const table of TABLES) {
        expect(seen(url, table, 'authenticated', OWNER)).toEqual([
          'draft-page',
          'free',
          'growth',
          'growth-draft',
          'premium',
          'starter',
        ])
      }
    })
  })

  it('hides on a downgrade and shows again on upgrade, with no rows changed', async () => {
    await withMigrated('mhbg_downgrade', (url) => {
      exec(url, `UPDATE listings SET tier = 'starter' WHERE id = '${GROWTH}';`)
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['premium'])
        expect(exec(url, `SELECT count(*) FROM ${table};`).trim()).toBe('6')
      }

      exec(url, `UPDATE listings SET tier = 'growth' WHERE id = '${GROWTH}';`)
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['growth', 'premium'])
      }
    })
  })

  it('is safe to apply twice', async () => {
    await withMigrated('mhbg_idempotent', (url) => {
      applyFile(url, MIGRATION)
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['growth', 'premium'])
        const policies = exec(
          url,
          `SELECT count(*) FROM pg_policies WHERE tablename = '${table}' AND policyname = '${table}_read';`
        ).trim()
        expect(policies).toBe('1')
      }
    })
  })

  it('rolls back to the original reads', async () => {
    await withMigrated('mhbg_rollback', (url) => {
      exec(url, ROLLBACK)
      for (const table of TABLES) {
        expect(seen(url, table, 'anon', null)).toEqual(['free', 'growth', 'premium', 'starter'])
      }
    })
  })
})
