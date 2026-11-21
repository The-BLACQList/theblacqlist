// =============================================================================
// Migration test: 20261201000000_owner_plan_pages.sql
// =============================================================================
// Ticket 238, owner-level plans. What this pins:
//
//   * The backfill covers each subscriber's subscribed page first, then its
//     linked locations, up to the plan's cap (Starter 1, Growth 2, Premium 3),
//     and moves the owner's other pages to Free. Owners with no billing at all
//     are never touched. Re-running the file changes nothing.
//   * subscriptions.listing_id can be NULL, and deleting that page keeps the
//     subscription row.
//   * Plan changes: a downgrade keeps the pages covered longest; an upgrade
//     with fill adds pages (published first); a lapse moves every page to Free
//     but keeps the rows, so coming back restores the same pages.
//   * set_plan_page_coverage: moving a one-page plan is one step; the guard
//     refuses a full plan, someone else's page and a job; no live plan is
//     NO_PLAN.
//   * A live subscription with no resolved plan skips the sync.
//   * Only service_role can call the functions; owners read their own rows.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from './helpers'

const MIGRATION = path.join(MIGRATIONS_DIR, '20261201000000_owner_plan_pages.sql')

// Owners
const STARTER_OWNER = '11111111-1111-4111-8111-111111111111'
const PREMIUM_OWNER = '22222222-2222-4222-8222-222222222222'
const NO_BILLING = '33333333-3333-4333-8333-333333333333'
const LAPSED_OWNER = '44444444-4444-4444-8444-444444444444'
const STRANGER = '55555555-5555-4555-8555-555555555555'

// Pages (created_at increases with the last digit group)
const S1 = 'a1000000-0000-4000-8000-000000000001' // Starter subscription's page
const S2 = 'a1000000-0000-4000-8000-000000000002' // published, older than S3
const S3 = 'a1000000-0000-4000-8000-000000000003' // draft
const SJOB = 'a1000000-0000-4000-8000-000000000004' // a job post
const P1 = 'a2000000-0000-4000-8000-000000000001' // Premium subscription's page
const P2 = 'a2000000-0000-4000-8000-000000000002' // linked location of P1
const P3 = 'a2000000-0000-4000-8000-000000000003' // linked location of P1
const P0 = 'a2000000-0000-4000-8000-000000000000' // oldest, not linked
const N1 = 'a3000000-0000-4000-8000-000000000001' // hand-set Growth, no billing
const L1 = 'a4000000-0000-4000-8000-000000000001' // lapsed
const X1 = 'a5000000-0000-4000-8000-000000000001' // stranger's page

const PLAN_STARTER = 'b1000000-0000-4000-8000-000000000000'
const PLAN_GROWTH = 'b2000000-0000-4000-8000-000000000000'
const PLAN_PREMIUM = 'b3000000-0000-4000-8000-000000000000'

const FIXTURE = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
  END $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE listings (
    id            uuid PRIMARY KEY,
    owner_user_id uuid,
    entity_type   text NOT NULL DEFAULT 'business',
    tier          text NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free','starter','growth','premium')),
    status        text NOT NULL DEFAULT 'published',
    deleted_at    timestamptz,
    created_at    timestamptz NOT NULL
  );

  CREATE TABLE plans (id uuid PRIMARY KEY, plan_key text);

  CREATE TABLE subscriptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL,
    user_id    uuid NOT NULL,
    plan_id    uuid REFERENCES plans(id),
    status     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  );

  CREATE TABLE listing_location_links (
    location_listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    primary_listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    owner_user_id       uuid NOT NULL
  );

  INSERT INTO auth.users (id) VALUES
    ('${STARTER_OWNER}'), ('${PREMIUM_OWNER}'), ('${NO_BILLING}'),
    ('${LAPSED_OWNER}'), ('${STRANGER}');

  INSERT INTO plans (id, plan_key) VALUES
    ('${PLAN_STARTER}', 'starter'), ('${PLAN_GROWTH}', 'growth'), ('${PLAN_PREMIUM}', 'premium');

  INSERT INTO listings (id, owner_user_id, entity_type, tier, status, created_at) VALUES
    ('${S1}',   '${STARTER_OWNER}', 'business', 'starter', 'published', '2026-01-02'),
    ('${S2}',   '${STARTER_OWNER}', 'business', 'free',    'published', '2026-01-03'),
    ('${S3}',   '${STARTER_OWNER}', 'business', 'free',    'draft',     '2026-01-01'),
    ('${SJOB}', '${STARTER_OWNER}', 'job',      'free',    'published', '2025-12-01'),
    ('${P0}',   '${PREMIUM_OWNER}', 'creative', 'free',    'published', '2025-06-01'),
    ('${P1}',   '${PREMIUM_OWNER}', 'business', 'premium', 'published', '2026-02-01'),
    ('${P2}',   '${PREMIUM_OWNER}', 'business', 'premium', 'published', '2026-02-02'),
    ('${P3}',   '${PREMIUM_OWNER}', 'business', 'premium', 'published', '2026-02-03'),
    ('${N1}',   '${NO_BILLING}',    'business', 'growth',  'published', '2026-03-01'),
    ('${L1}',   '${LAPSED_OWNER}',  'business', 'free',    'published', '2026-04-01'),
    ('${X1}',   '${STRANGER}',      'business', 'free',    'published', '2026-05-01');

  INSERT INTO subscriptions (listing_id, user_id, plan_id, status) VALUES
    ('${S1}', '${STARTER_OWNER}', '${PLAN_STARTER}', 'active'),
    ('${P1}', '${PREMIUM_OWNER}', '${PLAN_PREMIUM}', 'active'),
    ('${L1}', '${LAPSED_OWNER}',  '${PLAN_GROWTH}',  'canceled');

  INSERT INTO listing_location_links (location_listing_id, primary_listing_id, owner_user_id) VALUES
    ('${P2}', '${P1}', '${PREMIUM_OWNER}'),
    ('${P3}', '${P1}', '${PREMIUM_OWNER}');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
`

// Generous grants after the migration so every refusal below is the
// migration's own REVOKE, RLS or the guard.
const GRANTS = `
  GRANT SELECT, INSERT, UPDATE, DELETE ON plan_covered_pages TO anon, authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON plan_covered_pages TO service_role;
`

async function withMigrated(name: string, fn: (url: string) => void): Promise<void> {
  await withScratchDb(name, (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    exec(url, GRANTS)
    fn(url)
  })
}

function tiers(url: string, ids: string[]): Record<string, string> {
  const rows = query<{ id: string; tier: string }>(
    url,
    `SELECT id, tier FROM listings WHERE id IN (${ids.map((i) => `'${i}'`).join(',')})`
  )
  return Object.fromEntries(rows.map((r) => [r.id, r.tier]))
}

function covered(url: string, owner: string): string[] {
  return query<{ listing_id: string }>(
    url,
    `SELECT listing_id FROM plan_covered_pages WHERE owner_user_id = '${owner}' ORDER BY added_at, listing_id`
  ).map((r) => r.listing_id)
}

function sync(url: string, owner: string, fill = false, anchor: string | null = null) {
  const out = exec(
    url,
    `SELECT sync_owner_plan_tiers('${owner}', ${fill}, ${anchor ? `'${anchor}'` : 'NULL'});`
  ).trim()
  return JSON.parse(out) as Record<string, unknown>
}

function setPlan(url: string, owner: string, planId: string, status = 'active') {
  exec(
    url,
    `UPDATE subscriptions SET plan_id = '${planId}', status = '${status}' WHERE user_id = '${owner}';`
  )
}

function asUser(uid: string, sql: string): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid}', false);
          SET ROLE authenticated;
          ${sql}`
}

describe.skipIf(!DB_REACHABLE)('20261201000000_owner_plan_pages', () => {
  it('backfills the subscribed page and its locations, and leaves owners without billing alone', async () => {
    await withMigrated('owner_plan_backfill', (url) => {
      expect(covered(url, STARTER_OWNER)).toEqual([S1])
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P2, P3])
      expect(covered(url, NO_BILLING)).toEqual([])
      expect(covered(url, LAPSED_OWNER)).toEqual([])

      expect(tiers(url, [S1, S2, S3, SJOB, P0, P1, P2, P3, N1, L1])).toEqual({
        [S1]: 'starter',
        [S2]: 'free',
        [S3]: 'free',
        [SJOB]: 'free',
        [P0]: 'free',
        [P1]: 'premium',
        [P2]: 'premium',
        [P3]: 'premium',
        [N1]: 'growth', // hand-set, no billing: untouched
        [L1]: 'free',
      })
    })
  })

  it('changes nothing when the file runs again', async () => {
    await withMigrated('owner_plan_rerun', (url) => {
      const before = query(url, `SELECT id, tier FROM listings ORDER BY id`)
      const rowsBefore = query(url, `SELECT * FROM plan_covered_pages ORDER BY listing_id`)
      applyFile(url, MIGRATION)
      expect(query(url, `SELECT id, tier FROM listings ORDER BY id`)).toEqual(before)
      expect(query(url, `SELECT * FROM plan_covered_pages ORDER BY listing_id`)).toEqual(rowsBefore)
      expect(sync(url, PREMIUM_OWNER, true).changes).toEqual([])
    })
  })

  it('keeps the subscription when its page is deleted, and allows no page at all', async () => {
    await withMigrated('owner_plan_anchor', (url) => {
      exec(url, `DELETE FROM listings WHERE id = '${S1}';`)
      const subs = query<{ listing_id: string | null; status: string }>(
        url,
        `SELECT listing_id, status FROM subscriptions WHERE user_id = '${STARTER_OWNER}'`
      )
      expect(subs).toEqual([{ listing_id: null, status: 'active' }])

      // The plan moves to the next page on the next sync (no page covered).
      sync(url, STARTER_OWNER)
      expect(covered(url, STARTER_OWNER)).toEqual([S2])
      expect(tiers(url, [S2])[S2]).toBe('starter')
    })
  })

  it('keeps the pages covered longest on a downgrade', async () => {
    await withMigrated('owner_plan_downgrade', (url) => {
      setPlan(url, PREMIUM_OWNER, PLAN_STARTER)
      const out = sync(url, PREMIUM_OWNER, true)
      expect(out.tier).toBe('starter')
      expect(out.cap).toBe(1)
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1])
      expect(tiers(url, [P0, P1, P2, P3])).toEqual({
        [P0]: 'free',
        [P1]: 'starter',
        [P2]: 'free',
        [P3]: 'free',
      })
    })
  })

  it('fills new slots on an upgrade, published pages first, never a job', async () => {
    await withMigrated('owner_plan_upgrade', (url) => {
      setPlan(url, STARTER_OWNER, PLAN_PREMIUM)
      sync(url, STARTER_OWNER, true)
      // S2 (published) before S3 (draft, though older); the job is never covered.
      expect(covered(url, STARTER_OWNER)).toEqual([S1, S2, S3])
      expect(tiers(url, [S1, S2, S3, SJOB])).toEqual({
        [S1]: 'premium',
        [S2]: 'premium',
        [S3]: 'premium',
        [SJOB]: 'free',
      })
    })
  })

  it('moves every page to Free on a lapse and restores the same pages on return', async () => {
    await withMigrated('owner_plan_lapse', (url) => {
      // The owner had moved coverage off the first location on purpose.
      exec(url, `SELECT set_plan_page_coverage('${PREMIUM_OWNER}', '{${P0}}', '{${P2}}');`)
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P3, P0])

      setPlan(url, PREMIUM_OWNER, PLAN_PREMIUM, 'canceled')
      const lapsed = sync(url, PREMIUM_OWNER)
      expect(lapsed.tier).toBe('free')
      expect(Object.values(tiers(url, [P0, P1, P2, P3]))).toEqual(['free', 'free', 'free', 'free'])
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P3, P0])

      setPlan(url, PREMIUM_OWNER, PLAN_PREMIUM, 'active')
      sync(url, PREMIUM_OWNER, true)
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P3, P0])
      expect(tiers(url, [P0, P1, P2, P3])).toEqual({
        [P0]: 'premium',
        [P1]: 'premium',
        [P2]: 'free',
        [P3]: 'premium',
      })
    })
  })

  it('moves a one-page plan in one step and refuses what the plan can’t cover', async () => {
    await withMigrated('owner_plan_move', (url) => {
      const out = JSON.parse(
        exec(url, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{${S2}}', '{${S1}}');`).trim()
      )
      expect(out.covered).toEqual([S2])
      expect(tiers(url, [S1, S2])).toEqual({ [S1]: 'free', [S2]: 'starter' })

      // Full plan, someone else's page, a job.
      expect(raises(url, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{${S3}}', '{}');`)).toBe(true)
      expect(raises(url, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{${X1}}', '{${S2}}');`)).toBe(true)
      expect(raises(url, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{${SJOB}}', '{${S2}}');`)).toBe(true)
      expect(covered(url, STARTER_OWNER)).toEqual([S2])

      // No live plan.
      let message = ''
      try {
        exec(url, `SELECT set_plan_page_coverage('${LAPSED_OWNER}', '{${L1}}', '{}');`)
      } catch (e) {
        message = String((e as { stderr?: string }).stderr ?? e)
      }
      expect(message).toContain('NO_PLAN')
    })
  })

  it('leaves a slot the owner emptied on purpose, until a plan change fills it', async () => {
    await withMigrated('owner_plan_keep_removed', (url) => {
      setPlan(url, STARTER_OWNER, PLAN_GROWTH)
      sync(url, STARTER_OWNER, true)
      expect(covered(url, STARTER_OWNER)).toEqual([S1, S2])

      exec(url, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{}', '{${S2}}');`)
      sync(url, STARTER_OWNER)
      expect(covered(url, STARTER_OWNER)).toEqual([S1])
      expect(tiers(url, [S2])[S2]).toBe('free')
    })
  })

  it('drops a deleted page and refills only when asked', async () => {
    await withMigrated('owner_plan_soft_delete', (url) => {
      exec(url, `UPDATE listings SET deleted_at = now() WHERE id = '${P2}';`)
      sync(url, PREMIUM_OWNER)
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P3])
      sync(url, PREMIUM_OWNER, true)
      expect(covered(url, PREMIUM_OWNER)).toEqual([P1, P3, P0])
    })
  })

  it('skips the sync while a live subscription has no resolved plan', async () => {
    await withMigrated('owner_plan_unresolved', (url) => {
      exec(url, `UPDATE subscriptions SET plan_id = NULL WHERE user_id = '${PREMIUM_OWNER}';`)
      expect(sync(url, PREMIUM_OWNER, true)).toEqual({ skipped: 'plan_unresolved' })
      expect(tiers(url, [P1])[P1]).toBe('premium')
      expect(sync(url, NO_BILLING)).toEqual({ skipped: 'no_billing' })
    })
  })

  it('lets only service_role call the functions; owners read only their own rows', async () => {
    await withMigrated('owner_plan_grants', (url) => {
      expect(raises(url, asUser(STARTER_OWNER, `SELECT sync_owner_plan_tiers('${STARTER_OWNER}');`))).toBe(true)
      expect(
        raises(url, asUser(STARTER_OWNER, `SELECT set_plan_page_coverage('${STARTER_OWNER}', '{${S2}}', '{${S1}}');`))
      ).toBe(true)
      expect(
        raises(url, asUser(STARTER_OWNER, `INSERT INTO plan_covered_pages (listing_id, owner_user_id) VALUES ('${S2}', '${STARTER_OWNER}');`))
      ).toBe(true)

      const seen = exec(
        url,
        asUser(STARTER_OWNER, `SELECT count(*) FROM plan_covered_pages;`)
      ).trim().split('\n').pop()
      expect(seen).toBe('1')

      expect(
        raises(url, `SET ROLE service_role; SELECT sync_owner_plan_tiers('${STARTER_OWNER}');`)
      ).toBe(false)
    })
  })
})
