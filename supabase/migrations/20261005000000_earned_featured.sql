-- =============================================================================
-- 20261005000000_earned_featured.sql
--
-- Featured becomes earned. Each week it goes to the one listing per listing type
-- with the most positive activity that week (tickets 123, 124).
--
-- [Decision — founder, 2026-10-05] "The featured badge is something that can be
-- earned, not bought." Scope: "1 per listing type". Activity that counts: saves,
-- 4 and 5 star reviews, shares, and website, call and directions taps.
--
-- WHAT THIS FILE DOES
--   PART 1  featured_weights: one row of tunable numbers, like ranking_weights.
--   PART 2  featured_awards: one row per (week, bucket) winner. Public read.
--   PART 3  award_weekly_featured(): scores a finished week, clears
--           listings.is_featured everywhere, sets it on the winners and writes
--           the award rows, all in one transaction.
--   PART 4  plans.features: drop the two keys that described Featured as a
--           plan perk. Nothing reads them; they are copy, and untrue now.
--
-- WHAT THIS FILE DOES NOT DO: touch any listing. Applying it changes nothing a
-- visitor can see. The 27 seeded is_featured flags on production stay until the
-- first call to award_weekly_featured(), which the weekly cron makes once
-- FEATURE_EARNED_FEATURED is on. That first call is the GATE-DATA write.
--
-- BUCKETS. Every imported listing is entity_type 'business', so the function
-- does not bucket on entity_type alone. It takes the ordered rules built by
-- lib/featured/buckets.ts (from the same category mapping the discover Type
-- chips use) as p_buckets, the same pattern as the discover RPCs: SQL never
-- keeps its own copy of the type mapping. A listing lands in exactly one bucket:
--   1. its own entity_type, when that is not 'business';
--   2. else the first rule whose category_ids or location_types match;
--   3. else 'business'.
-- resolveBucket() in lib/featured/buckets.ts is the TypeScript twin.
--
-- SCORE, over the Monday-to-Sunday week in Eastern time:
--   save                           points_save per person, saves still standing
--   published review rated >= 4    points_good_review per reviewer
--   share                          points_share per person or browser session
--   website / call / directions    points_contact_tap per person or session
-- The listing owner's own activity never counts. Shares and taps come through
-- /api/analytics/event, which anyone can call; the server sets user_id from the
-- session, so signed-in activity is one person each, but a browser session id
-- is whatever the caller sends. Points from anonymous sessions are therefore
-- capped per listing per week (anon_event_points_cap), so they can help a
-- listing win but cannot win it alone (cap < min_winning_score).
--
-- A bucket's best score must reach min_winning_score or nobody wins it that
-- week. Ties go to the higher all-time activity_score, then the earlier
-- published listing, then the lower id so the result never depends on luck.
--
-- DOWN PLAN
--   1. The cron is the only caller. Turn FEATURE_EARNED_FEATURED off first.
--   2. DROP FUNCTION IF EXISTS award_weekly_featured(date, jsonb, text[]);
--      DROP TABLE IF EXISTS featured_awards;
--      DROP TABLE IF EXISTS featured_runs;
--      DROP TABLE IF EXISTS featured_weights;
--   3. The plan feature keys are copy nobody reads; restore them only if a
--      pricing page starts rendering plans.features (re-run the INSERT in
--      20260701000001_plans_pricing_reconcile.sql).
--   is_featured values written by the function are not restored. The seeded
--   ones were never a product decision; reseed by hand if ever wanted.
-- =============================================================================


-- =============================================================================
-- PART 1 — featured_weights
--
-- One row, so the rule can be tuned by a data change. RLS on with no policies:
-- only the service role and award_weekly_featured() (SECURITY DEFINER) read it.
-- /how-ranking-works describes the rule in prose, not these numbers.
-- =============================================================================
CREATE TABLE IF NOT EXISTS featured_weights (
  id                     smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  points_save            numeric     NOT NULL DEFAULT 3 CHECK (points_save >= 0),
  points_good_review     numeric     NOT NULL DEFAULT 5 CHECK (points_good_review >= 0),
  points_share           numeric     NOT NULL DEFAULT 2 CHECK (points_share >= 0),
  points_contact_tap     numeric     NOT NULL DEFAULT 1 CHECK (points_contact_tap >= 0),

  -- "4 and 5 star reviews" [Decision — founder, 2026-10-05].
  good_review_min_rating integer     NOT NULL DEFAULT 4
                                     CHECK (good_review_min_rating BETWEEN 1 AND 5),

  -- Nobody gets the badge for doing nothing. One good review, or two saves,
  -- clears it. A week where nobody in a bucket clears it has no winner there.
  min_winning_score      numeric     NOT NULL DEFAULT 5 CHECK (min_winning_score > 0),

  -- Most share and tap points anonymous browser sessions can add to one listing
  -- in one week. Kept below min_winning_score on purpose.
  anon_event_points_cap  numeric     NOT NULL DEFAULT 4 CHECK (anon_event_points_cap >= 0),

  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO featured_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE featured_weights ENABLE ROW LEVEL SECURITY;
-- No policies on purpose.


-- =============================================================================
-- PART 2 — featured_awards
--
-- The record of who won what. The listing page reads the latest row for a
-- featured listing to say which group it led ("among Restaurants this week").
-- Written only by award_weekly_featured(); no client writes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS featured_awards (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start  date        NOT NULL CHECK (EXTRACT(isodow FROM week_start) = 1),
  bucket      text        NOT NULL CHECK (bucket IN (
                'business','restaurant','service_provider','vendor',
                'professional','creative','event','job')),
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score       numeric     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_awards_week_bucket_key  UNIQUE (week_start, bucket),
  CONSTRAINT featured_awards_week_listing_key UNIQUE (week_start, listing_id)
);

CREATE INDEX IF NOT EXISTS featured_awards_listing_idx
  ON featured_awards (listing_id, week_start DESC);

ALTER TABLE featured_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "featured_awards_public_read" ON featured_awards;
CREATE POLICY "featured_awards_public_read"
  ON featured_awards FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = featured_awards.listing_id
        AND l.status = 'published'
        AND l.deleted_at IS NULL
    )
  );

GRANT SELECT ON featured_awards TO anon, authenticated;

-- One row per week scored, winners or not. award_weekly_featured() refuses any
-- week older than the latest row here. Server-only: RLS on, no policies.
CREATE TABLE IF NOT EXISTS featured_runs (
  week_start  date        NOT NULL PRIMARY KEY CHECK (EXTRACT(isodow FROM week_start) = 1),
  winners     integer     NOT NULL,
  ran_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE featured_runs ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PART 3 — award_weekly_featured()
--
-- p_week_start      the Monday that starts the week to score (Eastern dates).
-- p_buckets         ordered jsonb array of {bucket, category_ids, location_types}
--                   from buildBucketRules().
-- p_excluded_types  entity types that sit out (Jobs, while Jobs is covered).
--
-- Returns one row per listing whose badge was decided this run: every winner
-- (featured = true) and every listing that lost the flag (featured = false), so
-- the caller can report what changed.
--
-- Running it twice for the same week gives the same result. It refuses a week
-- that has not ended yet, and a week older than the latest one already awarded,
-- so a stray rerun can never put last month's winners back on the site.
-- =============================================================================
CREATE OR REPLACE FUNCTION award_weekly_featured(
  p_week_start     date,
  p_buckets        jsonb,
  p_excluded_types text[] DEFAULT '{}'
)
RETURNS TABLE (listing_id uuid, bucket text, score numeric, featured boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wt      featured_weights%ROWTYPE;
  v_from  timestamptz;
  v_to    timestamptz;
  v_last  date;
BEGIN
  IF p_week_start IS NULL OR EXTRACT(isodow FROM p_week_start) <> 1 THEN
    RAISE EXCEPTION 'p_week_start must be a Monday, got %', p_week_start;
  END IF;
  IF p_buckets IS NULL OR jsonb_typeof(p_buckets) <> 'array' THEN
    RAISE EXCEPTION 'p_buckets must be a json array';
  END IF;

  SELECT * INTO wt FROM featured_weights WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'featured_weights row id=1 is missing; cannot award Featured';
  END IF;

  -- Midnight Monday to midnight the next Monday, Eastern. AT TIME ZONE on a
  -- timestamp without zone reads it as Eastern wall time, so a week that
  -- crosses a clock change is still exactly Monday to Sunday.
  v_from := p_week_start::timestamp AT TIME ZONE 'America/New_York';
  v_to   := (p_week_start + 7)::timestamp AT TIME ZONE 'America/New_York';

  IF v_to > now() THEN
    RAISE EXCEPTION 'The week starting % has not ended yet', p_week_start;
  END IF;

  -- Checked against runs, not awards: a week with no winners leaves no award
  -- row, and must still block an older week from coming back.
  SELECT max(fr.week_start) INTO v_last FROM featured_runs fr;
  IF v_last IS NOT NULL AND p_week_start < v_last THEN
    RAISE EXCEPTION 'The week starting % is older than the latest run (%)',
      p_week_start, v_last;
  END IF;

  -- One winner per bucket, computed once into a temp table so the three writes
  -- below agree on it.
  DROP TABLE IF EXISTS pg_temp.featured_winners;
  CREATE TEMP TABLE featured_winners ON COMMIT DROP AS
  WITH rules AS (
    SELECT
      r.ord,
      r.elem->>'bucket' AS bucket,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(r.elem->'category_ids', '[]')))::uuid[]
        AS category_ids,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(r.elem->'location_types', '[]')))
        AS location_types
    FROM jsonb_array_elements(p_buckets) WITH ORDINALITY AS r(elem, ord)
  ),
  bucketed AS (
    SELECT
      l.id,
      l.owner_user_id,
      l.activity_score,
      l.published_at,
      CASE
        WHEN l.entity_type <> 'business' THEN l.entity_type
        ELSE coalesce(
          (SELECT ru.bucket FROM rules ru
           WHERE l.category_id = ANY (ru.category_ids)
              OR l.location_type = ANY (ru.location_types)
           ORDER BY ru.ord
           LIMIT 1),
          'business')
      END AS bucket
    FROM listings l
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND NOT (l.entity_type = ANY (coalesce(p_excluded_types, '{}')))
  ),
  save_pts AS (
    SELECT s.listing_id AS id, count(DISTINCT s.user_id) * wt.points_save AS pts
    FROM saves s
    JOIN bucketed b ON b.id = s.listing_id
    WHERE s.created_at >= v_from AND s.created_at < v_to
      AND (b.owner_user_id IS NULL OR s.user_id <> b.owner_user_id)
    GROUP BY s.listing_id
  ),
  review_pts AS (
    SELECT rv.listing_id AS id,
           -- A review with no linked account still counts once, by its own id.
           count(DISTINCT coalesce(rv.reviewer_user_id::text, rv.id::text))
             * wt.points_good_review AS pts
    FROM reviews rv
    JOIN bucketed b ON b.id = rv.listing_id
    WHERE rv.status = 'published'
      AND rv.rating >= wt.good_review_min_rating
      AND rv.published_at >= v_from AND rv.published_at < v_to
      AND (b.owner_user_id IS NULL OR rv.reviewer_user_id IS DISTINCT FROM b.owner_user_id)
    GROUP BY rv.listing_id
  ),
  -- One row per (listing, kind, person or session). Website, call and
  -- directions are one kind: a person who taps all three counts once.
  event_actors AS (
    SELECT DISTINCT
      e.entity_id AS id,
      CASE WHEN e.event_name = 'share_initiated' THEN 'share' ELSE 'tap' END AS kind,
      coalesce(e.user_id::text, 'session:' || e.session_id) AS actor,
      e.user_id IS NULL AS anonymous
    FROM analytics_events e
    JOIN bucketed b ON b.id = e.entity_id
    WHERE (
        e.event_name = 'share_initiated'
        -- Contact taps from the hero, the quick-action bar and At a Glance
        -- (lib/analytics/contactTap.ts). Email taps are tracked nowhere and
        -- would not count: the founder's list is website, call, directions.
        OR (e.event_name IN ('hero_cta_click', 'action_bar_cta_click', 'cta_click')
            AND e.properties->>'kind' IN ('website', 'call', 'directions'))
      )
      AND e.entity_type = 'listing'
      AND e.created_at >= v_from AND e.created_at < v_to
      AND (e.user_id IS NOT NULL OR nullif(e.session_id, '') IS NOT NULL)
      -- Not `IS DISTINCT FROM` alone: on an unclaimed listing both sides are
      -- NULL for every anonymous event, and they would all be dropped.
      AND (b.owner_user_id IS NULL OR e.user_id IS DISTINCT FROM b.owner_user_id)
  ),
  event_pts AS (
    SELECT
      id,
      coalesce(sum(CASE WHEN kind = 'share' THEN wt.points_share ELSE wt.points_contact_tap END)
                 FILTER (WHERE NOT anonymous), 0)
      + least(
          coalesce(sum(CASE WHEN kind = 'share' THEN wt.points_share ELSE wt.points_contact_tap END)
                     FILTER (WHERE anonymous), 0),
          wt.anon_event_points_cap)
      AS pts
    FROM event_actors
    GROUP BY id
  ),
  scored AS (
    SELECT
      b.id, b.bucket, b.activity_score, b.published_at,
      coalesce(sp.pts, 0) + coalesce(rp.pts, 0) + coalesce(ep.pts, 0) AS score
    FROM bucketed b
    LEFT JOIN save_pts   sp ON sp.id = b.id
    LEFT JOIN review_pts rp ON rp.id = b.id
    LEFT JOIN event_pts  ep ON ep.id = b.id
  ),
  ranked AS (
    SELECT
      s.*,
      row_number() OVER (
        PARTITION BY s.bucket
        ORDER BY s.score DESC, s.activity_score DESC, s.published_at ASC NULLS LAST, s.id
      ) AS rn
    FROM scored s
    WHERE s.score >= wt.min_winning_score
  )
  SELECT ranked.id, ranked.bucket, ranked.score FROM ranked WHERE ranked.rn = 1;

  -- The awards for this week are replaced wholesale, which is what makes a
  -- rerun land on the same rows.
  DELETE FROM featured_awards fa WHERE fa.week_start = p_week_start;
  INSERT INTO featured_awards (week_start, bucket, listing_id, score)
  SELECT p_week_start, w.bucket, w.id, w.score FROM featured_winners w;

  INSERT INTO featured_runs (week_start, winners)
  SELECT p_week_start, count(*) FROM featured_winners
  ON CONFLICT (week_start) DO UPDATE
    SET ran_at = now(), winners = EXCLUDED.winners;

  -- Only rows whose flag actually changes are written, so updated_at moves on
  -- the listings whose page changed and no others.
  RETURN QUERY
  WITH cleared AS (
    UPDATE listings l
    SET is_featured = false
    WHERE l.is_featured
      AND NOT EXISTS (SELECT 1 FROM featured_winners w WHERE w.id = l.id)
    RETURNING l.id
  ),
  set_on AS (
    UPDATE listings l
    SET is_featured = true
    WHERE NOT l.is_featured
      AND EXISTS (SELECT 1 FROM featured_winners w WHERE w.id = l.id)
    RETURNING l.id
  )
  SELECT w.id, w.bucket, w.score, true FROM featured_winners w
  UNION ALL
  SELECT c.id, NULL::text, NULL::numeric, false FROM cleared c;
END;
$$;

REVOKE ALL ON FUNCTION award_weekly_featured(date, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION award_weekly_featured(date, jsonb, text[]) FROM anon;
REVOKE ALL ON FUNCTION award_weekly_featured(date, jsonb, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION award_weekly_featured(date, jsonb, text[]) TO service_role;


-- =============================================================================
-- PART 4 — plans.features
--
-- 'featured_collection_placement' (growth) and 'homepage_featured_placement'
-- (premium) described Featured as something a plan buys. `jsonb - text` removes
-- matching string elements from an array and leaves everything else in order.
-- =============================================================================
UPDATE plans
SET features = features - 'featured_collection_placement' - 'homepage_featured_placement'
WHERE features ?| ARRAY['featured_collection_placement', 'homepage_featured_placement'];
