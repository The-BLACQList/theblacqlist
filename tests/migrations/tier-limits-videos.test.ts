// =============================================================================
// Migration test: 20261020000000_tier_limits_videos.sql
// =============================================================================
// Ticket 105, plan limits part two. What this pins:
//
//   * listing_videos holds a link or a file, never both, and a file path only
//     in its own listing's folder.
//   * Each page's one existing video is copied in once; re-running adds nothing.
//   * RLS: an owner can add a video only while the plan has room (Free 0,
//     Starter 1, Growth 3, Premium any number), never on someone else's page.
//     Reorder and remove stay open on every plan. Anon reads published pages
//     only.
//   * listings.peak_tier: backfilled from the paid tier and from real
//     subscriptions, raised by the trigger when tier rises, never lowered, and
//     never written by an end user.
//
// The fixture stands in for auth.uid(), update_updated_at(), listings,
// listing_details_business, plans and subscriptions with only the columns the
// migration names. The grants are generous on purpose, so every refusal below
// is RLS or the trigger doing its job.
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

const MIGRATION = path.join(MIGRATIONS_DIR, '20261020000000_tier_limits_videos.sql')

const OWNER = '11111111-1111-1111-1111-111111111111'
const STRANGER = '22222222-2222-2222-2222-222222222222'
const FREE = 'a0000000-0000-4000-8000-000000000000'
const STARTER = 'a1000000-0000-4000-8000-000000000000'
const GROWTH = 'a2000000-0000-4000-8000-000000000000'
const PREMIUM = 'a3000000-0000-4000-8000-000000000000'
const DRAFT = 'a4000000-0000-4000-8000-000000000000'
const LAPSED = 'a5000000-0000-4000-8000-000000000000'
const FILE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const PLAN_GROWTH = 'b2000000-0000-4000-8000-000000000000'

const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END;
  $$;

  CREATE TABLE listings (
    id            uuid PRIMARY KEY,
    name          text NOT NULL DEFAULT 'x',
    owner_user_id uuid,
    tier          text NOT NULL DEFAULT 'free',
    status        text NOT NULL DEFAULT 'published',
    deleted_at    timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE listing_details_business (
    listing_id      uuid PRIMARY KEY REFERENCES listings(id),
    video_embed_url text,
    video_path      text
  );

  CREATE TABLE plans (
    id       uuid PRIMARY KEY,
    plan_key text NOT NULL
  );

  CREATE TABLE subscriptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES listings(id),
    plan_id    uuid NOT NULL REFERENCES plans(id),
    status     text NOT NULL
  );

  INSERT INTO listings (id, owner_user_id, tier, status) VALUES
    ('${FREE}',    '${OWNER}', 'free',    'published'),
    ('${STARTER}', '${OWNER}', 'starter', 'published'),
    ('${GROWTH}',  '${OWNER}', 'growth',  'published'),
    ('${PREMIUM}', '${OWNER}', 'premium', 'published'),
    ('${DRAFT}',   '${OWNER}', 'free',    'draft'),
    ('${LAPSED}',  '${OWNER}', 'free',    'published');

  INSERT INTO plans (id, plan_key) VALUES ('${PLAN_GROWTH}', 'growth');
  -- A page that ran on Growth and has since lapsed to Free.
  INSERT INTO subscriptions (listing_id, plan_id, status)
    VALUES ('${LAPSED}', '${PLAN_GROWTH}', 'canceled');

  INSERT INTO listing_details_business (listing_id, video_embed_url, video_path) VALUES
    ('${STARTER}', 'https://youtu.be/abc', NULL),
    ('${GROWTH}',  NULL, 'listings/${GROWTH}/video/${FILE}.mp4'),
    ('${FREE}',    'not a link', NULL);

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  END $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT SELECT, UPDATE ON listings TO anon, authenticated;
`

const GRANTS = `
  GRANT SELECT, INSERT, UPDATE, DELETE ON listing_videos TO anon, authenticated;
`

function as(role: 'anon' | 'authenticated', uid: string | null, sql: string): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
          SET ROLE ${role};
          ${sql}`
}

const addLink = (listing: string, n: number) =>
  `INSERT INTO listing_videos (listing_id, kind, embed_url, position)
     VALUES ('${listing}', 'embed', 'https://youtu.be/v${n}', ${n});`

async function withMigrated(name: string, fn: (url: string) => void): Promise<void> {
  await withScratchDb(name, (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    exec(url, GRANTS)
    fn(url)
  })
}

function videoCount(url: string, listing: string): number {
  return query<{ n: number }>(
    url,
    `SELECT count(*)::int AS n FROM listing_videos WHERE listing_id = '${listing}'`
  )[0]!.n
}

describe.skipIf(!DB_REACHABLE)('20261020000000_tier_limits_videos', () => {
  it('copies each page video in once and skips links that would break the shape', async () => {
    await withMigrated('tlv_backfill', (url) => {
      applyFile(url, MIGRATION)
      const rows = query(
        url,
        `SELECT listing_id, kind, embed_url, file_path, position
           FROM listing_videos ORDER BY listing_id`
      )
      expect(rows).toEqual([
        {
          listing_id: STARTER,
          kind: 'embed',
          embed_url: 'https://youtu.be/abc',
          file_path: null,
          position: 0,
        },
        {
          listing_id: GROWTH,
          kind: 'file',
          embed_url: null,
          file_path: `listings/${GROWTH}/video/${FILE}.mp4`,
          position: 0,
        },
      ])
    })
  })

  it('holds a link or a file, never both, and a file only in its own folder', async () => {
    await withMigrated('tlv_shape', (url) => {
      const own = `listings/${PREMIUM}/video/${FILE}.webm`
      const other = `listings/${GROWTH}/video/${FILE}.mov`
      const insert = (cols: string, vals: string) =>
        raises(
          url,
          `INSERT INTO listing_videos (listing_id, kind, ${cols}) VALUES ('${PREMIUM}', ${vals});`
        )

      expect(insert('file_path', `'file', '${own}'`)).toBe(false)
      expect(insert('file_path', `'file', '${other}'`)).toBe(true)
      expect(insert('file_path', `'file', 'listings/${PREMIUM}/video/../${FILE}.mp4'`)).toBe(true)
      expect(insert('embed_url, file_path', `'embed', 'https://youtu.be/x', '${own}'`)).toBe(true)
      expect(insert('embed_url', `'file', 'https://youtu.be/x'`)).toBe(true)
      expect(insert('embed_url', `'embed', 'javascript:alert(1)'`)).toBe(true)
      expect(insert('embed_url', `'embed', 'https://youtu.be/ok'`)).toBe(false)
    })
  })

  it('lets an owner add videos only while the plan has room', async () => {
    await withMigrated('tlv_insert_limit', (url) => {
      const owner = (sql: string) => raises(url, as('authenticated', OWNER, sql))

      // Free: none. Starter already has its one (backfilled).
      expect(owner(addLink(FREE, 1))).toBe(true)
      expect(owner(addLink(STARTER, 1))).toBe(true)

      // Growth has one (backfilled): two more fit, a fourth does not.
      expect(owner(addLink(GROWTH, 1))).toBe(false)
      expect(owner(addLink(GROWTH, 2))).toBe(false)
      expect(owner(addLink(GROWTH, 3))).toBe(true)
      expect(videoCount(url, GROWTH)).toBe(3)

      // Premium: no limit.
      for (let i = 0; i < 6; i++) expect(owner(addLink(PREMIUM, i))).toBe(false)
      expect(videoCount(url, PREMIUM)).toBe(6)

      // Someone else's page, or no session at all.
      expect(raises(url, as('authenticated', STRANGER, addLink(PREMIUM, 9)))).toBe(true)
      expect(raises(url, as('anon', null, addLink(PREMIUM, 9)))).toBe(true)
    })
  })

  it('counts videos only for the caller own page, and not for anon', async () => {
    await withMigrated('tlv_count_fn', (url) => {
      const count = (uid: string) =>
        exec(url, as('authenticated', uid, `SELECT owned_listing_video_count('${GROWTH}');`))
          .trim()
          .split('\n')
          .pop()
      expect(count(OWNER)).toBe('1')
      expect(count(STRANGER)).toBe('0')
      expect(raises(url, as('anon', null, `SELECT owned_listing_video_count('${GROWTH}');`))).toBe(
        true
      )
    })
  })

  it('keeps reorder and remove open on a lower plan, for the owner only', async () => {
    await withMigrated('tlv_update_delete', (url) => {
      exec(url, addLink(STARTER, 1))
      exec(url, `UPDATE listings SET tier = 'free' WHERE id = '${STARTER}';`)

      exec(
        url,
        as(
          'authenticated',
          STRANGER,
          `UPDATE listing_videos SET position = 7 WHERE listing_id = '${STARTER}';`
        )
      )
      exec(
        url,
        as('authenticated', STRANGER, `DELETE FROM listing_videos WHERE listing_id = '${STARTER}';`)
      )
      expect(videoCount(url, STARTER)).toBe(2)
      expect(
        query<{ position: number }>(url, `SELECT position FROM listing_videos WHERE position = 7`)
      ).toEqual([])

      exec(
        url,
        as(
          'authenticated',
          OWNER,
          `UPDATE listing_videos SET position = 5 WHERE listing_id = '${STARTER}' AND position = 1;`
        )
      )
      expect(
        query(
          url,
          `SELECT position FROM listing_videos WHERE listing_id = '${STARTER}' ORDER BY position`
        )
      ).toEqual([{ position: 0 }, { position: 5 }])

      exec(
        url,
        as('authenticated', OWNER, `DELETE FROM listing_videos WHERE listing_id = '${STARTER}';`)
      )
      expect(videoCount(url, STARTER)).toBe(0)
    })
  })

  it('shows anon the videos of published pages only', async () => {
    await withMigrated('tlv_anon_read', (url) => {
      exec(
        url,
        `INSERT INTO listing_videos (listing_id, kind, embed_url) VALUES ('${DRAFT}', 'embed', 'https://youtu.be/d');`
      )
      const seen = exec(
        url,
        as(
          'anon',
          null,
          `SELECT string_agg(listing_id::text, ',' ORDER BY listing_id) FROM listing_videos;`
        )
      )
        .trim()
        .split('\n')
        .pop()
      expect(seen).toBe(`${STARTER},${GROWTH}`)

      const ownerSees = exec(
        url,
        as(
          'authenticated',
          OWNER,
          `SELECT count(*) FROM listing_videos WHERE listing_id = '${DRAFT}';`
        )
      )
        .trim()
        .split('\n')
        .pop()
      expect(ownerSees).toBe('1')
    })
  })

  it('backfills peak_tier from the paid tier and from past subscriptions', async () => {
    await withMigrated('tlv_peak_backfill', (url) => {
      const peaks = query<{ id: string; peak_tier: string | null }>(
        url,
        `SELECT id, peak_tier FROM listings ORDER BY id`
      )
      expect(Object.fromEntries(peaks.map((p) => [p.id, p.peak_tier]))).toEqual({
        [FREE]: null,
        [STARTER]: 'starter',
        [GROWTH]: 'growth',
        [PREMIUM]: 'premium',
        [DRAFT]: null,
        [LAPSED]: 'growth',
      })
    })
  })

  it('raises peak_tier when tier rises and never lowers it', async () => {
    await withMigrated('tlv_peak_trigger', (url) => {
      const peak = (id: string) =>
        query<{ peak_tier: string | null }>(
          url,
          `SELECT peak_tier FROM listings WHERE id = '${id}'`
        )[0]!.peak_tier

      exec(url, `UPDATE listings SET tier = 'growth' WHERE id = '${STARTER}';`)
      expect(peak(STARTER)).toBe('growth')
      exec(url, `UPDATE listings SET tier = 'starter' WHERE id = '${STARTER}';`)
      expect(peak(STARTER)).toBe('growth')
      exec(url, `UPDATE listings SET tier = 'free' WHERE id = '${STARTER}';`)
      expect(peak(STARTER)).toBe('growth')

      exec(url, `INSERT INTO listings (id, tier) VALUES ('${FILE}', 'premium');`)
      expect(peak(FILE)).toBe('premium')
    })
  })

  it('refuses an end-user write to peak_tier but allows other edits', async () => {
    await withMigrated('tlv_peak_guard', (url) => {
      expect(
        raises(
          url,
          as(
            'authenticated',
            OWNER,
            `UPDATE listings SET peak_tier = 'premium' WHERE id = '${FREE}';`
          )
        )
      ).toBe(true)
      expect(
        raises(
          url,
          as('authenticated', OWNER, `UPDATE listings SET peak_tier = NULL WHERE id = '${GROWTH}';`)
        )
      ).toBe(true)
      expect(
        raises(
          url,
          as(
            'authenticated',
            OWNER,
            `UPDATE listings SET name = 'New name' WHERE id = '${GROWTH}';`
          )
        )
      ).toBe(false)
      expect(query(url, `SELECT name, peak_tier FROM listings WHERE id = '${GROWTH}'`)).toEqual([
        { name: 'New name', peak_tier: 'growth' },
      ])
    })
  })
})
