// =============================================================================
// Migration test: 20261207000000_admin_page_unpublish.sql (ticket 284)
// =============================================================================
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from './helpers'

const MIGRATION = path.join(MIGRATIONS_DIR, '20261207000000_admin_page_unpublish.sql')

const ADMIN = '99999999-9999-4999-8999-999999999999'
const OWNER = '11111111-1111-4111-8111-111111111111'
const AUTHOR = '22222222-2222-4222-8222-222222222222'
const STRANGER = '33333333-3333-4333-8333-333333333333'
const CITY = 'c0000000-0000-4000-8000-000000000001'
const PAGE = 'a1000000-0000-4000-8000-000000000001'
const JOB = 'a1000000-0000-4000-8000-000000000002'
const EVENT = 'a1000000-0000-4000-8000-000000000003'
const DRAFT = 'a1000000-0000-4000-8000-000000000004'
const CLOSED_JOB = 'a1000000-0000-4000-8000-000000000005'
const MISSING = 'a1000000-0000-4000-8000-0000000000ff'

const PUBLISHED_AT = '2026-03-01T12:00:00+00:00'

const FIXTURE = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
  END $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE cities (id uuid PRIMARY KEY, slug text, name text);
  CREATE TABLE listings (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    slug          text NOT NULL UNIQUE,
    entity_type   text NOT NULL DEFAULT 'business',
    status        text NOT NULL DEFAULT 'draft',
    owner_user_id uuid,
    city_id       uuid REFERENCES cities(id),
    published_at  timestamptz,
    deleted_at    timestamptz,
    last_admin_updated_at timestamptz
  );
  ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "listings: anon read published" ON listings FOR SELECT TO anon
    USING ((status = 'published' AND deleted_at IS NULL)
      OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL));
  CREATE POLICY "listings: authenticated read published or own" ON listings FOR SELECT TO authenticated
    USING ((status = 'published' AND deleted_at IS NULL)
      OR (status = 'closed' AND entity_type = 'job' AND deleted_at IS NULL)
      OR owner_user_id = auth.uid());

  CREATE TABLE reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
    reviewer_user_id uuid,
    status text NOT NULL
  );
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "reviews: anon read published" ON reviews FOR SELECT TO anon
    USING (status = 'published');
  CREATE POLICY "reviews: authenticated read published or own" ON reviews FOR SELECT TO authenticated
    USING (status = 'published' OR reviewer_user_id = auth.uid());

  CREATE TABLE profiles (id uuid PRIMARY KEY, display_name text);
  CREATE FUNCTION short_display_name(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p $$;
  CREATE FUNCTION review_author_names(p_listing_id uuid)
  RETURNS TABLE (reviewer_user_id uuid, short_name text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT r.reviewer_user_id, p.display_name FROM reviews r
    JOIN profiles p ON p.id = r.reviewer_user_id WHERE r.listing_id = p_listing_id
  $$;
  REVOKE ALL ON FUNCTION review_author_names(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION review_author_names(uuid) TO anon, authenticated;

  CREATE TABLE admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid, action text NOT NULL, target_table text, target_id uuid,
    before_state jsonb, after_state jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  INSERT INTO cities VALUES ('${CITY}', 'atlanta-ga', 'Atlanta');
  INSERT INTO listings (id, name, slug, entity_type, status, owner_user_id, city_id, published_at) VALUES
    ('${PAGE}',  'Made Up Bakery', 'made-up-bakery', 'business', 'published', '${OWNER}', '${CITY}', '${PUBLISHED_AT}'),
    ('${JOB}',   'Made Up Job',    'made-up-job',    'job',      'published', '${OWNER}', '${CITY}', '${PUBLISHED_AT}'),
    ('${CLOSED_JOB}', 'Old Job',   'old-job',        'job',      'closed',    '${OWNER}', '${CITY}', '${PUBLISHED_AT}'),
    ('${EVENT}', 'Made Up Event',  'made-up-event',  'event',    'published', '${OWNER}', '${CITY}', '${PUBLISHED_AT}'),
    ('${DRAFT}', 'Made Up Draft',  'made-up-draft',  'business', 'draft',     '${OWNER}', '${CITY}', NULL);
  INSERT INTO profiles VALUES ('${AUTHOR}', 'Jasmine R.');
  INSERT INTO reviews (listing_id, reviewer_user_id, status) VALUES
    ('${PAGE}', '${AUTHOR}', 'published'), ('${CLOSED_JOB}', '${AUTHOR}', 'published');
`

// Generous table grants, so every refusal below is RLS or the migration's own.
const GRANTS = `
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON listings, reviews TO anon, authenticated;
  GRANT SELECT ON listings, reviews, cities, admin_audit_log, page_do_not_re_add TO service_role;
`

async function withMigrated(name: string, fn: (url: string) => void): Promise<void> {
  await withScratchDb(name, (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    exec(url, GRANTS)
    fn(url)
  })
}

const hide = (id: string, reason = 'owner_asked', mark = true, note = '') =>
  `SELECT admin_hide_page('${id}', '${ADMIN}', '${reason}', '${note}', ${mark})`
const putBack = (id: string, reason = 'Owner came back') =>
  `SELECT admin_put_back_page('${id}', '${ADMIN}', '${reason}')`
const call = (url: string, sql: string) => exec(url, sql).trim()
const page = (url: string, id = PAGE) =>
  query<{ status: string; published_at: string }>(
    url,
    `SELECT status, published_at FROM listings WHERE id = '${id}'`
  )[0]!
const marks = (url: string) =>
  query<Record<string, unknown>>(url, 'SELECT * FROM page_do_not_re_add')
const audits = (url: string) =>
  query<{ action: string; after_state: Record<string, unknown> }>(
    url,
    'SELECT action, after_state FROM admin_audit_log ORDER BY created_at'
  )
/** Last line only: SET and set_config print first. */
function as(url: string, role: string, sql: string, uid = ''): string {
  return exec(
    url,
    `SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${uid}', false); ${sql}`
  )
    .trim()
    .split('\n')
    .pop()!
}
const REVIEWS = `SELECT count(*) FROM reviews WHERE listing_id = '${PAGE}'`
const NAMES = `SELECT count(*) FROM review_author_names('${PAGE}')`

describe.skipIf(!DB_REACHABLE)('20261207000000_admin_page_unpublish', () => {
  it('hides a live Page, writes the audit row and the mark, and puts it back', async () => {
    await withMigrated('284_roundtrip', (url) => {
      expect(call(url, hide(PAGE, 'owner_asked', true, 'By phone'))).toBe('ok')
      expect(page(url).status).toBe('unpublished')
      expect(marks(url)).toMatchObject([
        {
          page_id: PAGE,
          slug: 'made-up-bakery',
          name: 'Made Up Bakery',
          city_slug: 'atlanta-ga',
          city_name: 'Atlanta',
          reason: 'owner_asked',
        },
      ])
      expect(audits(url)).toMatchObject([
        {
          action: 'unpublish_page',
          after_state: { status: 'unpublished', reason: 'owner_asked', note: 'By phone', do_not_re_add: true },
        },
      ])
      expect(
        query(url, `SELECT reason, note, marked FROM admin_page_hide('${PAGE}')`)
      ).toEqual([{ reason: 'owner_asked', note: 'By phone', marked: true }])

      expect(call(url, hide(PAGE))).toBe('not_published')

      expect(call(url, putBack(PAGE))).toBe('ok')
      expect(page(url).status).toBe('published')
      expect(new Date(page(url).published_at)).toEqual(new Date(PUBLISHED_AT))
      expect(marks(url)).toEqual([])
      expect(audits(url)[1]).toMatchObject({
        action: 'put_back_page',
        after_state: { status: 'published', reason: 'Owner came back', mark_cleared: true },
      })
      expect(query(url, `SELECT * FROM admin_page_hide('${PAGE}')`)).toEqual([])
      expect(call(url, putBack(PAGE))).toBe('not_hidden')

      // Hide, put back, hide and put back again, in one transaction.
      const twice = `BEGIN; ${hide(PAGE)}; ${putBack(PAGE)}; ${hide(PAGE)}; ${putBack(PAGE)}; COMMIT;`
      exec(url, twice)
      expect(audits(url).map((a) => a.action)).toEqual(
        Array(3).fill(['unpublish_page', 'put_back_page']).flat()
      )
      expect(page(url).status).toBe('published')
    })
  })

  it('leaves no mark when the box is off', async () => {
    await withMigrated('284_nomark', (url) => {
      expect(call(url, hide(PAGE, 'closed', false))).toBe('ok')
      expect(marks(url)).toEqual([])
      expect(call(url, putBack(PAGE))).toBe('ok')
      expect(audits(url)[1]!.after_state).toMatchObject({ mark_cleared: false })
    })
  })

  it('refuses jobs, drafts, deleted and unknown Pages, and a missing reason', async () => {
    await withMigrated('284_refusals', (url) => {
      expect(call(url, hide(JOB))).toBe('is_job')
      expect(call(url, hide(DRAFT))).toBe('not_published')
      expect(call(url, hide(MISSING))).toBe('not_found')
      expect(raises(url, hide(PAGE, 'because'))).toBe(true)
      expect(raises(url, hide(PAGE, 'other', false, '   '))).toBe(true)
      expect(
        raises(url, `SELECT admin_hide_page('${PAGE}', NULL, 'closed', '', false)`)
      ).toBe(true)
      expect(raises(url, putBack(PAGE, '  '))).toBe(true)
      exec(url, `UPDATE listings SET deleted_at = now() WHERE id = '${EVENT}'`)
      expect(call(url, hide(EVENT))).toBe('not_found')

      exec(url, `UPDATE listings SET status = 'unpublished' WHERE id = '${JOB}'`)
      expect(call(url, putBack(JOB))).toBe('is_job')

      expect(page(url).status).toBe('published')
      expect(audits(url)).toEqual([])
      expect(marks(url)).toEqual([])
    })
  })

  it('changes nothing when the audit row cannot be written', async () => {
    await withMigrated('284_atomic', (url) => {
      const block = `ALTER TABLE admin_audit_log ADD CONSTRAINT block CHECK (false) NOT VALID`
      exec(url, block)
      expect(raises(url, hide(PAGE))).toBe(true)
      expect(page(url).status).toBe('published')
      expect(marks(url)).toEqual([])

      exec(url, 'ALTER TABLE admin_audit_log DROP CONSTRAINT block')
      exec(url, hide(PAGE))
      exec(url, block)
      expect(raises(url, putBack(PAGE))).toBe(true)
      expect(page(url).status).toBe('unpublished')
      expect(marks(url)).toHaveLength(1)
    })
  })

  it('Put Back leaves alone a Page something else hid, even after an earlier admin hide', async () => {
    await withMigrated('284_sweep', (url) => {
      const sweep = `UPDATE listings SET status = 'unpublished' WHERE id = '${EVENT}'`
      const sweepAudit = `INSERT INTO admin_audit_log (action, target_table, target_id, after_state, created_at)
        VALUES ('event_ended', 'listings', '${EVENT}', '{"status":"unpublished"}', clock_timestamp())`
      exec(url, sweep)
      exec(url, sweepAudit)
      expect(call(url, putBack(EVENT))).toBe('not_ours')

      exec(url, `UPDATE listings SET status = 'published' WHERE id = '${EVENT}'`)
      exec(url, hide(EVENT))
      exec(url, putBack(EVENT))
      exec(url, sweep)
      exec(url, sweepAudit)
      expect(call(url, putBack(EVENT))).toBe('not_ours')

      // Hidden with no audit row at all.
      exec(url, `UPDATE listings SET status = 'unpublished' WHERE id = '${PAGE}'`)
      expect(call(url, putBack(PAGE))).toBe('not_ours')
      expect(page(url).status).toBe('unpublished')
    })
  })

  it('keeps the mark after a full delete and refuses to insert the Page published again', async () => {
    await withMigrated('284_mark', (url) => {
      const insert = (status: string, slug = 'made-up-bakery', tail = '') =>
        `INSERT INTO listings (name, slug, status) VALUES ('Made Up Bakery', '${slug}', '${status}') ${tail}`
      exec(url, hide(PAGE))

      // While the hidden Page exists, a seed skips it as before.
      exec(url, insert('published', 'made-up-bakery', 'ON CONFLICT (slug) DO NOTHING'))
      expect(page(url).status).toBe('unpublished')

      exec(url, `DELETE FROM listings WHERE id = '${PAGE}'`)
      expect(marks(url)).toHaveLength(1)
      expect(raises(url, insert('published'))).toBe(true)
      expect(raises(url, insert('published', 'made-up-bakery', 'ON CONFLICT (slug) DO NOTHING'))).toBe(true)
      expect(raises(url, insert('published', 'another-bakery'))).toBe(false)
      expect(raises(url, insert('pending'))).toBe(false)
    })
  })

  it('lets only service_role read the marks or call the functions', async () => {
    await withMigrated('284_access', (url) => {
      for (const role of ['anon', 'authenticated']) {
        for (const sql of [
          'SELECT * FROM page_do_not_re_add',
          `SELECT * FROM admin_page_hide('${PAGE}')`,
          hide(PAGE),
          putBack(PAGE),
        ]) {
          expect(raises(url, `SET ROLE ${role}; ${sql}`), `${role}: ${sql}`).toBe(true)
        }
        // Even with a table grant, RLS shows nothing.
        exec(url, `GRANT SELECT ON page_do_not_re_add TO ${role}`)
      }
      expect(as(url, 'service_role', hide(PAGE))).toBe('ok')
      expect(as(url, 'service_role', 'SELECT count(*) FROM page_do_not_re_add')).toBe('1')
      expect(as(url, 'anon', 'SELECT count(*) FROM page_do_not_re_add')).toBe('0')
      expect(as(url, 'authenticated', 'SELECT count(*) FROM page_do_not_re_add', OWNER)).toBe('0')
    })
  })

  it("hides a hidden Page's reviews and reviewer names from the public, not from author or owner", async () => {
    await withMigrated('284_reviews', (url) => {
      const counts = (sql: string) => ({
        anon: as(url, 'anon', sql),
        stranger: as(url, 'authenticated', sql, STRANGER),
        author: as(url, 'authenticated', sql, AUTHOR),
        owner: as(url, 'authenticated', sql, OWNER),
      })
      const all = { anon: '1', stranger: '1', author: '1', owner: '1' }
      expect(counts(REVIEWS)).toEqual(all)
      expect(counts(NAMES)).toEqual(all)

      exec(url, hide(PAGE))
      expect(counts(REVIEWS)).toEqual({ anon: '0', stranger: '0', author: '1', owner: '1' })
      expect(counts(NAMES)).toEqual({ anon: '0', stranger: '0', author: '0', owner: '1' })

      exec(url, putBack(PAGE))
      expect(counts(REVIEWS)).toEqual(all)

      // A closed job's page is public, so its reviews stay readable.
      expect(
        as(url, 'anon', `SELECT count(*) FROM reviews WHERE listing_id = '${CLOSED_JOB}'`)
      ).toBe('1')
    })
  })

  it('can be applied twice without losing marks', async () => {
    await withMigrated('284_rerun', (url) => {
      exec(url, hide(PAGE))
      applyFile(url, MIGRATION)
      expect(marks(url)).toHaveLength(1)
      expect(call(url, putBack(PAGE))).toBe('ok')
    })
  })
})
