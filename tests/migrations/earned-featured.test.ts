// =============================================================================
// Migration test: 20261005000000_earned_featured.sql
// =============================================================================
// Featured is earned, never bought [Decision - founder, 2026-10-05]: each week
// it goes to the one listing per listing type with the most positive activity.
// These tests seed real saves, reviews and analytics events into a scratch
// Postgres, call the real award_weekly_featured(), and read the flags and award
// rows back.
//
// Like activity-score.test.ts, every ordering case gives the LOSER the higher
// activity_score. That is the first tiebreaker, so if scoring were broken the
// tiebreak alone would pick the other listing and the case would fail loudly.
//
// The weeks used are in the past relative to the real clock, because the
// function refuses a week that has not ended yet.
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

const MIGRATION = path.join(MIGRATIONS_DIR, '20261005000000_earned_featured.sql')

const FOOD = 'f0000000-0000-0000-0000-000000000001'
const RETAIL = 'f0000000-0000-0000-0000-000000000002'

// The rules buildBucketRules() would send for this fixture's categories.
const BUCKETS = JSON.stringify([
  { bucket: 'restaurant', category_ids: [FOOD], location_types: [] },
  { bucket: 'service_provider', category_ids: [], location_types: ['service_area', 'traveling'] },
])

const OWNER = '0e000000-0000-0000-0000-000000000001'
const user = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

const FIXTURE = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;

  CREATE TABLE listings (
    id             uuid        NOT NULL PRIMARY KEY,
    name           text        NOT NULL,
    entity_type    text        NOT NULL DEFAULT 'business',
    category_id    uuid,
    location_type  text        NOT NULL DEFAULT 'physical',
    status         text        NOT NULL DEFAULT 'published',
    deleted_at     timestamptz,
    flag_status    text        NOT NULL DEFAULT 'none',
    owner_user_id  uuid,
    is_featured    boolean     NOT NULL DEFAULT false,
    activity_score numeric     NOT NULL DEFAULT 0,
    published_at   timestamptz DEFAULT '2026-06-01T00:00:00Z',
    updated_at     timestamptz NOT NULL DEFAULT '2026-01-01T00:00:00Z'
  );

  CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN NEW.updated_at = now(); RETURN NEW; END $f$;
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  CREATE TABLE saves (
    id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid        NOT NULL,
    listing_id uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, listing_id)
  );

  CREATE TABLE reviews (
    id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id       uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reviewer_user_id uuid,
    rating           integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    status           text        NOT NULL DEFAULT 'intake',
    published_at     timestamptz
  );

  CREATE TABLE analytics_events (
    id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_name  text        NOT NULL,
    entity_type text,
    entity_id   uuid,
    user_id     uuid,
    session_id  text,
    properties  jsonb       NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE plans (
    name     text  NOT NULL PRIMARY KEY,
    features jsonb NOT NULL DEFAULT '[]'
  );
  INSERT INTO plans (name, features) VALUES
    ('growth',  '["everything_in_starter","20_photos","featured_collection_placement","editorial_eligibility"]'),
    ('premium', '["everything_in_growth","sponsored_spotlight_credit","homepage_featured_placement","early_access"]'),
    ('free',    '["basic_listing"]');

  GRANT SELECT ON listings TO anon, authenticated;
`

// A day inside the week of Monday 2026-09-21, Eastern.
const IN_WEEK = `'2026-09-23T12:00:00-04:00'`
const WEEK = '2026-09-21'

function listing(
  url: string,
  id: string,
  opts: Partial<{
    entity_type: string
    category_id: string | null
    location_type: string
    status: string
    owner: string | null
    is_featured: boolean
    activity_score: number
    published_at: string
  }> = {}
): void {
  const v = (x: string | null | undefined) => (x == null ? 'NULL' : `'${x}'`)
  exec(
    url,
    `INSERT INTO listings (id, name, entity_type, category_id, location_type, status,
       owner_user_id, is_featured, activity_score, published_at)
     VALUES ('${id}', '${id}', '${opts.entity_type ?? 'business'}', ${v(opts.category_id)},
       '${opts.location_type ?? 'physical'}', '${opts.status ?? 'published'}', ${v(opts.owner)},
       ${opts.is_featured ?? false}, ${opts.activity_score ?? 0},
       '${opts.published_at ?? '2026-06-01T00:00:00Z'}');`
  )
}

const save = (url: string, listingId: string, userId: string, at = IN_WEEK) =>
  exec(url, `INSERT INTO saves (user_id, listing_id, created_at) VALUES ('${userId}', '${listingId}', ${at});`)

const review = (
  url: string,
  listingId: string,
  userId: string,
  rating: number,
  status = 'published',
  at = IN_WEEK
) =>
  exec(
    url,
    `INSERT INTO reviews (listing_id, reviewer_user_id, rating, status, published_at)
     VALUES ('${listingId}', '${userId}', ${rating}, '${status}', ${at});`
  )

// Contact taps carry the kind lib/analytics/contactTap.ts sends; default to a
// website tap so a tap event counts unless a test says otherwise.
const event = (
  url: string,
  name: string,
  listingId: string,
  who: { user?: string; session?: string },
  at = IN_WEEK,
  kind: string | null = 'website'
) =>
  exec(
    url,
    `INSERT INTO analytics_events (event_name, entity_type, entity_id, user_id, session_id, properties, created_at)
     VALUES ('${name}', 'listing', '${listingId}', ${who.user ? `'${who.user}'` : 'NULL'},
       ${who.session ? `'${who.session}'` : 'NULL'},
       ${kind ? `'{"kind":"${kind}"}'::jsonb` : `'{}'::jsonb`}, ${at});`
  )

function award(url: string, week = WEEK, excluded = `ARRAY['job']`) {
  return query<{ listing_id: string; bucket: string | null; score: number | null; featured: boolean }>(
    url,
    `SELECT * FROM award_weekly_featured('${week}'::date, '${BUCKETS}'::jsonb, ${excluded}::text[])
     ORDER BY featured DESC, bucket, listing_id`
  )
}

const awards = (url: string) =>
  query<{ bucket: string; listing_id: string; score: number; week_start: string }>(
    url,
    `SELECT bucket, listing_id, score::float AS score, week_start::text FROM featured_awards ORDER BY week_start, bucket`
  )

const featured = (url: string) =>
  query<{ id: string }>(url, `SELECT id FROM listings WHERE is_featured ORDER BY id`).map((r) => r.id)

async function withMigrated(name: string, fn: (url: string) => void): Promise<void> {
  await withScratchDb(name, (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    fn(url)
  })
}

describe.skipIf(!DB_REACHABLE)('20261005000000_earned_featured', () => {
  it('awards one listing per bucket, by the right points', async () => {
    await withMigrated('featured_buckets', (url) => {
      // Restaurants: R1 has two saves (6). R2 has one (3) and the higher
      // activity_score, so only real scoring picks R1.
      listing(url, 'a0000000-0000-0000-0000-00000000a001', { category_id: FOOD })
      listing(url, 'a0000000-0000-0000-0000-00000000a002', { category_id: FOOD, activity_score: 99 })
      save(url, 'a0000000-0000-0000-0000-00000000a001', user(1))
      save(url, 'a0000000-0000-0000-0000-00000000a001', user(2))
      save(url, 'a0000000-0000-0000-0000-00000000a002', user(3))

      // A vendor row competes as a vendor, whatever its category. One 5 star
      // review is exactly the minimum.
      listing(url, 'a0000000-0000-0000-0000-00000000b001', { entity_type: 'vendor', category_id: FOOD })
      review(url, 'a0000000-0000-0000-0000-00000000b001', user(4), 5)

      // Services by location type: a signed-in share (2) and three signed-in
      // tappers (3). user(5) tapping all three buttons still counts once.
      listing(url, 'a0000000-0000-0000-0000-00000000c001', {
        category_id: RETAIL,
        location_type: 'service_area',
      })
      event(url, 'share_initiated', 'a0000000-0000-0000-0000-00000000c001', { user: user(1) })
      for (const name of ['hero_cta_click', 'action_bar_cta_click', 'hero_cta_click']) {
        event(url, name, 'a0000000-0000-0000-0000-00000000c001', { user: user(5) })
      }
      event(url, 'action_bar_cta_click', 'a0000000-0000-0000-0000-00000000c001', { user: user(6) }, IN_WEEK, 'call')
      event(url, 'cta_click', 'a0000000-0000-0000-0000-00000000c001', { user: user(7) }, IN_WEEK, 'directions')

      // A plain business with one save (3) is under the minimum: no winner.
      listing(url, 'a0000000-0000-0000-0000-00000000d001', { category_id: RETAIL })
      save(url, 'a0000000-0000-0000-0000-00000000d001', user(1))

      // Jobs sit out, however busy.
      listing(url, 'a0000000-0000-0000-0000-00000000e001', { entity_type: 'job' })
      for (const n of [1, 2, 3]) save(url, 'a0000000-0000-0000-0000-00000000e001', user(n))

      award(url)

      expect(awards(url)).toEqual([
        { bucket: 'restaurant', listing_id: 'a0000000-0000-0000-0000-00000000a001', score: 6, week_start: WEEK },
        { bucket: 'service_provider', listing_id: 'a0000000-0000-0000-0000-00000000c001', score: 5, week_start: WEEK },
        { bucket: 'vendor', listing_id: 'a0000000-0000-0000-0000-00000000b001', score: 5, week_start: WEEK },
      ])
      expect(featured(url)).toEqual([
        'a0000000-0000-0000-0000-00000000a001',
        'a0000000-0000-0000-0000-00000000b001',
        'a0000000-0000-0000-0000-00000000c001',
      ])
    })
  })

  it('only counts what the founder named, inside the week', async () => {
    await withMigrated('featured_signals', (url) => {
      const L = 'a0000000-0000-0000-0000-00000000000a'
      listing(url, L, { category_id: RETAIL })
      review(url, L, user(1), 3) // critical review
      review(url, L, user(2), 5, 'pending_approval') // not published
      review(url, L, user(3), 5, 'published', `'2026-09-20T12:00:00-04:00'`) // week before
      save(url, L, user(4), `'2026-09-28T00:30:00-04:00'`) // Monday after
      event(url, 'page_view', L, { user: user(5) }) // not an activity that counts
      // A save (3) plus two taps would make 5 and win, but an email tap and a
      // tap with no kind are not website, call or directions.
      const M = 'a0000000-0000-0000-0000-00000000000b'
      listing(url, M, { category_id: RETAIL })
      save(url, M, user(8))
      event(url, 'cta_click', M, { user: user(6) }, IN_WEEK, 'email')
      event(url, 'hero_cta_click', M, { session: 's-nokind' }, IN_WEEK, null)
      event(url, 'action_bar_cta_click', M, { user: user(7) }, IN_WEEK, 'email')
      award(url)
      expect(awards(url)).toEqual([])
    })
  })

  it("ignores the owner's own activity", async () => {
    await withMigrated('featured_owner', (url) => {
      const L = 'a0000000-0000-0000-0000-00000000000b'
      listing(url, L, { category_id: RETAIL, owner: OWNER })
      save(url, L, OWNER)
      event(url, 'share_initiated', L, { user: OWNER })
      event(url, 'hero_cta_click', L, { user: OWNER })
      review(url, L, OWNER, 5)
      award(url)
      expect(awards(url)).toEqual([])
    })
  })

  it('still counts strangers on a claimed listing, signed in or not', async () => {
    await withMigrated('featured_owner_others', (url) => {
      const L = 'a0000000-0000-0000-0000-00000000000d'
      listing(url, L, { category_id: RETAIL, owner: OWNER })
      // A NULL user_id must not be mistaken for the owner, or for a NULL owner.
      event(url, 'share_initiated', L, { session: 's-1' })
      event(url, 'hero_cta_click', L, { session: 's-2' })
      // A review with no linked account counts once.
      exec(
        url,
        `INSERT INTO reviews (listing_id, reviewer_user_id, rating, status, published_at)
         VALUES ('${L}', NULL, 5, 'published', ${IN_WEEK});`
      )
      award(url, WEEK, `'{}'`)
      expect(awards(url)).toEqual([
        { bucket: 'business', listing_id: L, score: 8, week_start: WEEK },
      ])
    })
  })

  it('caps anonymous sessions so they cannot win alone', async () => {
    await withMigrated('featured_anon', (url) => {
      const L = 'a0000000-0000-0000-0000-00000000000c'
      listing(url, L, { category_id: RETAIL })
      for (let n = 0; n < 20; n++) {
        event(url, 'share_initiated', L, { session: `s-${n}` })
        event(url, 'hero_cta_click', L, { session: `s-${n}` })
      }
      // Events with neither a user nor a session are not a person at all.
      event(url, 'share_initiated', L, {})
      event(url, 'share_initiated', L, { session: '' })
      award(url)
      expect(awards(url)).toEqual([])

      // One real save on top of the capped 4 is 7, which wins.
      save(url, L, user(1))
      award(url)
      expect(awards(url)).toEqual([
        { bucket: 'business', listing_id: L, score: 7, week_start: WEEK },
      ])
    })
  })

  it('breaks ties by all-time activity, then by who published first', async () => {
    await withMigrated('featured_ties', (url) => {
      const busy = 'a0000000-0000-0000-0000-00000000f001'
      const quiet = 'a0000000-0000-0000-0000-00000000f002'
      listing(url, quiet, { category_id: FOOD, activity_score: 1, published_at: '2026-01-01T00:00:00Z' })
      listing(url, busy, { category_id: FOOD, activity_score: 10, published_at: '2026-09-01T00:00:00Z' })
      for (const id of [busy, quiet]) review(url, id, user(1), 4)
      award(url)
      expect(awards(url).map((a) => a.listing_id)).toEqual([busy])

      exec(url, `UPDATE listings SET activity_score = 10 WHERE id = '${quiet}';`)
      award(url)
      expect(awards(url).map((a) => a.listing_id)).toEqual([quiet])
    })
  })

  it('clears every other flag, and a rerun lands on the same result', async () => {
    await withMigrated('featured_rerun', (url) => {
      const seeded = 'a0000000-0000-0000-0000-0000000000d1'
      const winner = 'a0000000-0000-0000-0000-0000000000d2'
      const untouched = 'a0000000-0000-0000-0000-0000000000d3'
      listing(url, seeded, { category_id: RETAIL, is_featured: true })
      listing(url, winner, { category_id: RETAIL })
      listing(url, untouched, { category_id: RETAIL })
      review(url, winner, user(1), 5)

      expect(award(url)).toEqual([
        { listing_id: winner, bucket: 'business', score: 5, featured: true },
        { listing_id: seeded, bucket: null, score: null, featured: false },
      ])
      expect(featured(url)).toEqual([winner])

      // Only the two rows whose page changed were written.
      const moved = query<{ id: string }>(
        url,
        `SELECT id FROM listings WHERE updated_at > '2026-01-01T00:00:00Z' ORDER BY id`
      ).map((r) => r.id)
      expect(moved).toEqual([seeded, winner])

      const first = awards(url)
      expect(award(url)).toEqual([{ listing_id: winner, bucket: 'business', score: 5, featured: true }])
      expect(awards(url)).toEqual(first)
      expect(featured(url)).toEqual([winner])
    })
  })

  it('leaves out listings that are not live', async () => {
    await withMigrated('featured_live', (url) => {
      const draft = 'a0000000-0000-0000-0000-0000000000e1'
      const deleted = 'a0000000-0000-0000-0000-0000000000e2'
      const flagged = 'a0000000-0000-0000-0000-0000000000e3'
      listing(url, draft, { status: 'draft', is_featured: true })
      listing(url, deleted)
      listing(url, flagged)
      exec(url, `UPDATE listings SET deleted_at = now() WHERE id = '${deleted}';`)
      exec(url, `UPDATE listings SET flag_status = 'spam' WHERE id = '${flagged}';`)
      for (const id of [draft, deleted, flagged]) review(url, id, user(1), 5)
      award(url)
      expect(awards(url)).toEqual([])
      expect(featured(url)).toEqual([])
    })
  })

  it('scores Monday to Sunday in Eastern time across a clock change', async () => {
    await withMigrated('featured_dst', (url) => {
      // US clocks sprang forward on Sunday 8 March 2026.
      const L = 'a0000000-0000-0000-0000-0000000000f1'
      listing(url, L)
      save(url, L, user(1), `'2026-03-02T04:30:00Z'`) // Sun 1 Mar 23:30 EST: before
      save(url, L, user(2), `'2026-03-02T05:30:00Z'`) // Mon 2 Mar 00:30 EST: in
      save(url, L, user(3), `'2026-03-09T03:30:00Z'`) // Sun 8 Mar 23:30 EDT: in
      save(url, L, user(4), `'2026-03-09T04:30:00Z'`) // Mon 9 Mar 00:30 EDT: after
      award(url, '2026-03-02')
      expect(awards(url)).toEqual([
        { bucket: 'business', listing_id: L, score: 6, week_start: '2026-03-02' },
      ])
    })
  })

  it('refuses a bad week', async () => {
    await withMigrated('featured_refuse', (url) => {
      const call = (week: string) =>
        `SELECT * FROM award_weekly_featured('${week}'::date, '${BUCKETS}'::jsonb, '{}'::text[]);`
      expect(raises(url, call('2026-09-22'))).toBe(true) // a Tuesday
      expect(raises(url, call('2099-01-05'))).toBe(true) // has not ended
      expect(raises(url, call(WEEK))).toBe(false)
      // WEEK had no winners, and still blocks an older week from coming back.
      expect(raises(url, call('2026-09-14'))).toBe(true)
      expect(raises(url, `SELECT * FROM award_weekly_featured('${WEEK}'::date, '{}'::jsonb, '{}'::text[]);`)).toBe(true)
    })
  })

  it('lets only the service role run it, and shows awards for live listings', async () => {
    await withMigrated('featured_grants', (url) => {
      const live = 'a0000000-0000-0000-0000-000000000001'
      listing(url, live)
      review(url, live, user(1), 5)
      award(url)
      const call = `SELECT * FROM award_weekly_featured('${WEEK}'::date, '${BUCKETS}'::jsonb, '{}'::text[]);`

      // Supabase grants table and function access to these roles by default.
      // The migration's revoke and RLS must hold even so.
      exec(url, `GRANT SELECT ON featured_weights TO anon, authenticated;
                 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;`)
      applyFile(url, MIGRATION)

      for (const role of ['anon', 'authenticated']) {
        expect(raises(url, `SET ROLE ${role}; ${call}`)).toBe(true)
        expect(exec(url, `SET ROLE ${role}; SELECT count(*) FROM featured_awards;`).trim()).toBe('1')
        expect(exec(url, `SET ROLE ${role}; SELECT count(*) FROM featured_weights;`).trim()).toBe('0')
      }
      exec(url, `GRANT USAGE ON SCHEMA public TO service_role;`)
      expect(raises(url, `SET ROLE service_role; ${call}`)).toBe(false)

      // Unpublish it and the public stops seeing the award.
      exec(url, `UPDATE listings SET status = 'draft' WHERE id = '${live}';`)
      expect(exec(url, `SET ROLE anon; SELECT count(*) FROM featured_awards;`).trim()).toBe('0')
    })
  })

  it('stops describing Featured as a plan perk', async () => {
    await withMigrated('featured_plans', (url) => {
      const plans = query<{ name: string; features: string[] }>(
        url,
        `SELECT name, features FROM plans ORDER BY name`
      )
      expect(plans).toEqual([
        { name: 'free', features: ['basic_listing'] },
        { name: 'growth', features: ['everything_in_starter', '20_photos', 'editorial_eligibility'] },
        { name: 'premium', features: ['everything_in_growth', 'sponsored_spotlight_credit', 'early_access'] },
      ])
      // Applying it twice is harmless.
      applyFile(url, MIGRATION)
      expect(query(url, `SELECT 1 FROM featured_weights`)).toHaveLength(1)
    })
  })
})
