-- =============================================================================
-- 20260923000000_activity_ranking.sql
--
-- Search order becomes: sponsored placement first, then how active and
-- well-kept a listing is. The ownership label stops affecting order entirely.
--
-- [Decision — founder, 2026-09-21] "Sponsored first, then activity, paid tier
-- as tiebreak." Signals: "Community + owner signals, 90-day decay."
-- [Decision — founder, 2026-09-23] refinement, on the keyword case specifically:
-- "Match band, then activity." Group results into bands of comparable match
-- quality; activity orders WITHIN each band; paid tier breaks remaining ties.
-- Browse pages with no keyword are pure activity order.
--
-- Supersedes decision-log 020/021 (2026-08-15), which put
-- (ownership_label = 'black_owned') above every money signal. That key is
-- REMOVED here. The §1981 clearance [Observed — founder, 2026-08-26] covered
-- decoupling placement from the label, so this stays inside the cleared design:
-- moderation-policy.md L48-50 (no paid tier, placement, or badge contingent on
-- the label) is unchanged and still binds.
--
-- WHY THE 2026-09-23 REFINEMENT EXISTS. The 2026-09-21 wording, taken
-- literally, put activity_score directly under is_featured — above relevance
-- rank. activity_score is near-continuous, so it almost never ties, which makes
-- every relevance key below it dead code: a loose trigram match on a busy
-- listing would outrank an exact name match. That reintroduces the exact
-- "dentist" complaint 20260922000000_search_recall.sql exists to fix. Banding
-- keeps both properties: match quality decides the group, activity decides the
-- order inside it.
--
-- WHAT THIS CHANGES ON PRODUCTION TODAY: nothing visible.
-- [Measured — Supabase Management API, prod ytlrnczevdnsfdzjbeqg, 2026-09-23]
-- 372 published listings; 0 published reviews; 1 total save on 1 listing;
-- 14 page views across 13 daily rows; 0 owner edits in 90 days;
-- 372 of 372 on tier 'free'; 372 of 372 labeled 'black_owned';
-- trust tier 371 unclaimed / 1 claimed; 27 featured.
-- So the key being removed is already inert (true for every row, has never
-- changed an order), the key being added is ~0 for every row, and tier_weight
-- is 0 for every row. This ships to a directory with no activity yet; it starts
-- mattering during tester week, which is the point of shipping it now.
--
-- BUILT ON 20260922000000_search_recall.sql, NOT on 20260904000000.
-- PART 6 below is a CREATE OR REPLACE of search_listings_faceted. If it were
-- written against the 20260904000000 body it would silently revert the recall
-- predicate and the two-tier rank, undoing the "dentist" fix while every test
-- still passed. The body here is 20260922000000 verbatim except the two places
-- marked ▲ NEW.
--
-- -----------------------------------------------------------------------------
-- DOWN PLAN (in this order)
--
--   1. Restore the previous ORDER BY and drop activity_score from the function:
--        re-run PART 2 of supabase/migrations/20260922000000_search_recall.sql
--        verbatim (it is a CREATE OR REPLACE of the same 17-arg signature, so it
--        needs no DROP and preserves the grants).
--   2. Restore the previous nightly job:
--        re-run the aggregate_entity_analytics(date) block from
--        supabase/migrations/20260515000000_analytics_aggregation.sql, then
--        re-run the aggregate_entity_analytics section of
--        supabase/migrations/20260823000000_definer_function_hardening.sql to
--        restore the REVOKE/GRANT set.
--   3. Restore the unconditional updated_at trigger:
--        DROP TRIGGER IF EXISTS set_updated_at ON listings;
--        CREATE TRIGGER set_updated_at BEFORE UPDATE ON listings
--          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--   4. DROP FUNCTION IF EXISTS refresh_activity_scores();
--      DROP FUNCTION IF EXISTS activity_decay(timestamptz, numeric);
--   5. DROP INDEX IF EXISTS listings_activity_rank_idx;
--      ALTER TABLE listings DROP COLUMN IF EXISTS activity_score;
--      DROP TABLE IF EXISTS ranking_weights;
--
-- Steps 1-3 are the safe partial rollback: they restore the previous order and
-- the previous job while leaving the column and the table in place, so nothing
-- that reads them breaks. Steps 4-5 are destructive and only needed to remove
-- the feature outright.
-- =============================================================================


-- =============================================================================
-- PART 1 — ranking_weights
--
-- One row, so the constants can be tuned by a data change instead of a function
-- rewrite. RLS on with no policies: service role only. Nothing user-facing reads
-- this table; /how-ranking-works describes the shape of the rule in prose, not
-- the numbers, so a weight change is not a copy change.
-- =============================================================================
CREATE TABLE IF NOT EXISTS ranking_weights (
  id                     smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Decay window. w = greatest(0, 1 - age_days / window_days), so a signal from
  -- today counts fully and one from window_days ago counts nothing.
  window_days            numeric     NOT NULL DEFAULT 90   CHECK (window_days > 0),

  -- Community signals. All positive; nothing here subtracts.
  weight_save            numeric     NOT NULL DEFAULT 3,
  weight_review          numeric     NOT NULL DEFAULT 4,
  weight_view            numeric     NOT NULL DEFAULT 0.2,
  weight_owner_reply     numeric     NOT NULL DEFAULT 2,

  -- Page views are the only signal a bot can manufacture cheaply, so they are
  -- both the lowest-weighted and the only capped one.
  view_daily_cap         integer     NOT NULL DEFAULT 200  CHECK (view_daily_cap > 0),

  -- A review still counts when it is critical, it just counts less. This is the
  -- only multiplier below 1 in the whole score.
  good_rating_floor      numeric     NOT NULL DEFAULT 3.5,
  good_review_multiplier numeric     NOT NULL DEFAULT 1.5,
  poor_review_multiplier numeric     NOT NULL DEFAULT 0.5,

  -- Owner upkeep. Not decayed: these describe the listing's current state, not
  -- an event that happened.
  bonus_tier_claimed     numeric     NOT NULL DEFAULT 2,
  bonus_tier_verified    numeric     NOT NULL DEFAULT 5,
  bonus_tier_certified   numeric     NOT NULL DEFAULT 8,
  bonus_edit_30d         numeric     NOT NULL DEFAULT 4,
  bonus_edit_90d         numeric     NOT NULL DEFAULT 2,

  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ranking_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ranking_weights ENABLE ROW LEVEL SECURITY;
-- No policies on purpose. Reads and writes go through the service role or
-- through refresh_activity_scores(), which is SECURITY DEFINER.


-- =============================================================================
-- PART 2 — listings.activity_score
--
-- A stored column, not a view or a computed expression, so ORDER BY stays a
-- plain column read. It is written once a night by refresh_activity_scores()
-- and never by application code.
-- =============================================================================
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS activity_score numeric NOT NULL DEFAULT 0;

-- Partial index matching search_listings_faceted's own WHERE clause exactly, so
-- the planner can use it for the browse case (no keyword, pure activity order).
CREATE INDEX IF NOT EXISTS listings_activity_rank_idx
  ON listings (is_featured DESC, activity_score DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND flag_status = 'none';


-- =============================================================================
-- PART 3 — updated_at trigger guard
--
-- REQUIRED, not cosmetic. app/sitemap.ts:94 publishes listings.updated_at as
-- each listing URL's sitemap lastModified. Decay means most active listings'
-- scores change every single night, so an unguarded set_updated_at would report
-- "modified today" for the whole directory to Google every day, which is the
-- fastest way to get a sitemap's lastmod discounted as unreliable.
--
-- The guard says: bump updated_at on any update that does NOT change
-- activity_score. That is sound because activity_score has exactly one writer —
-- refresh_activity_scores() below, which sets that column and nothing else — and
-- application code never sets it. If a future statement ever updates
-- activity_score together with real content columns, that statement would skip
-- the updated_at bump and must set updated_at itself.
--
-- The search_vector trigger (listings_search_vector_update) is deliberately NOT
-- guarded. It would recompute the tsvector for every rescored row nightly, which
-- is wasted work but not wrong, and guarding it means splitting one
-- INSERT-OR-UPDATE trigger into two (a WHEN clause cannot reference OLD on a
-- trigger that also fires on INSERT). At 372 rows that trade is not worth
-- touching 20260922000000's object. Revisit if the directory reaches six figures.
-- =============================================================================
DROP TRIGGER IF EXISTS set_updated_at ON listings;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  WHEN (OLD.activity_score IS NOT DISTINCT FROM NEW.activity_score)
  EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- PART 4 — activity_decay + refresh_activity_scores
-- =============================================================================

-- Linear decay to zero at the window edge. STABLE, not IMMUTABLE: it reads
-- now(). Returns NULL for a NULL timestamp, so every caller coalesces first.
CREATE OR REPLACE FUNCTION activity_decay(p_at timestamptz, p_window_days numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT greatest(
           0::numeric,
           1::numeric
             - (extract(epoch FROM (now() - p_at)) / 86400.0)::numeric
               / greatest(p_window_days, 1::numeric)
         );
$$;

REVOKE ALL ON FUNCTION activity_decay(timestamptz, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activity_decay(timestamptz, numeric) TO service_role;


-- Recomputes activity_score for every live listing. Returns the number of rows
-- whose score actually changed.
--
-- Signals are positive only. Nothing subtracts; the single below-1 factor is the
-- multiplier on a review rated under good_rating_floor, so a critical review
-- still adds, just less. There is no penalty path, by design: the founder's
-- instruction was "the more positively active you are, the higher your ranking",
-- not "inactive listings get pushed down".
CREATE OR REPLACE FUNCTION refresh_activity_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wt      ranking_weights;
  v_rows  integer := 0;
  v_since timestamptz;
BEGIN
  SELECT * INTO wt FROM ranking_weights WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ranking_weights row id=1 is missing; cannot score activity';
  END IF;

  v_since := now() - make_interval(days => ceil(wt.window_days)::int);

  WITH parts AS (
    SELECT listing_id, sum(pts) AS pts
    FROM (
      -- Saves. The save signal lives in analytics_events.event_name +
      -- properties->>'action'; there is no `action` column on that table.
      -- Matches how aggregate_entity_analytics counts saves.
      SELECT
        e.entity_id AS listing_id,
        wt.weight_save * activity_decay(e.created_at, wt.window_days) AS pts
      FROM analytics_events e
      WHERE e.entity_type = 'listing'
        AND e.entity_id IS NOT NULL
        AND e.event_name = 'save_toggled'
        AND (e.properties->>'action') = 'save'
        AND e.created_at >= v_since

      UNION ALL

      -- Published reviews, weighted by rating band.
      SELECT
        r.listing_id,
        wt.weight_review
          * activity_decay(coalesce(r.published_at, r.created_at), wt.window_days)
          * CASE
              WHEN r.rating >= wt.good_rating_floor THEN wt.good_review_multiplier
              ELSE wt.poor_review_multiplier
            END AS pts
      FROM reviews r
      WHERE r.status = 'published'
        AND coalesce(r.published_at, r.created_at) >= v_since

      UNION ALL

      -- Owner responses to reviews. Counted separately from the review itself:
      -- answering the community is owner upkeep, not community demand.
      SELECT
        r.listing_id,
        wt.weight_owner_reply * activity_decay(r.owner_responded_at, wt.window_days) AS pts
      FROM reviews r
      WHERE r.owner_responded_at IS NOT NULL
        AND r.owner_responded_at >= v_since

      UNION ALL

      -- Page views from the nightly rollup, capped per day so a scraper or a
      -- single viral day cannot buy position.
      SELECT
        a.listing_id,
        wt.weight_view
          * least(a.page_views, wt.view_daily_cap)
          * activity_decay(a.snapshot_date::timestamptz, wt.window_days) AS pts
      FROM entity_analytics_daily a
      WHERE a.page_views > 0
        AND a.snapshot_date >= v_since::date
    ) s
    WHERE s.listing_id IS NOT NULL
    GROUP BY s.listing_id
  ),
  scored AS (
    SELECT
      l.id,
      round(
        coalesce(p.pts, 0)
        -- Owner upkeep: trust tier reached.
        + CASE l.trust_tier
            WHEN 'claimed'   THEN wt.bonus_tier_claimed
            WHEN 'verified'  THEN wt.bonus_tier_verified
            WHEN 'certified' THEN wt.bonus_tier_certified
            ELSE 0
          END
        -- Owner upkeep: recency of the owner's own last edit.
        + CASE
            WHEN l.last_edited_by_owner_at IS NULL THEN 0
            WHEN l.last_edited_by_owner_at >= now() - interval '30 days' THEN wt.bonus_edit_30d
            WHEN l.last_edited_by_owner_at >= now() - interval '90 days' THEN wt.bonus_edit_90d
            ELSE 0
          END
      , 4) AS score
    FROM listings l
    LEFT JOIN parts p ON p.listing_id = l.id
    WHERE l.deleted_at IS NULL
  )
  UPDATE listings l
  SET activity_score = s.score
  FROM scored s
  WHERE l.id = s.id
    -- Only touch rows that actually move. Keeps the nightly write small and
    -- keeps the (unguarded) search_vector trigger off unchanged rows.
    AND l.activity_score IS DISTINCT FROM s.score;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION refresh_activity_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION refresh_activity_scores() FROM anon;
REVOKE ALL ON FUNCTION refresh_activity_scores() FROM authenticated;
GRANT EXECUTE ON FUNCTION refresh_activity_scores() TO service_role;


-- =============================================================================
-- PART 5 — aggregate_entity_analytics: call the refresh
--
-- Body is 20260515000000_analytics_aggregation.sql verbatim except the two
-- places marked ▲ NEW. Scores are recomputed straight after the rollup that
-- feeds them, inside the same nightly pg_cron run (02:00 UTC,
-- 20260515000001_analytics_cron_schedule.sql), so there is no second schedule to
-- keep in sync and no window where the rollup and the scores disagree.
--
-- The refresh is inside the existing EXCEPTION block, so a failure there is
-- logged as a failed job like any other and does not roll back the rollup it
-- follows. It returns the previous night's scores unchanged, which is the right
-- failure mode: stale order, not zeroed order.
-- =============================================================================
CREATE OR REPLACE FUNCTION aggregate_entity_analytics(
  target_date date DEFAULT (CURRENT_DATE - INTERVAL '1 day')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start      timestamptz := clock_timestamp();
  v_upserted   integer     := 0;
  v_duration   integer;
  v_rescored   integer     := 0;   -- ▲ NEW (1 of 2)
BEGIN
  INSERT INTO entity_analytics_daily (
    listing_id,
    snapshot_date,
    page_views,
    cta_clicks,
    saves,
    shares,
    search_impressions
  )
  SELECT
    entity_id                                                               AS listing_id,
    target_date                                                             AS snapshot_date,
    COUNT(*) FILTER (WHERE event_name = 'page_view')                        AS page_views,
    COUNT(*) FILTER (WHERE event_name IN (
      'cta_click', 'hero_cta_click', 'action_bar_cta_click'
    ))                                                                      AS cta_clicks,
    COUNT(*) FILTER (
      WHERE event_name = 'save_toggled'
        AND (properties->>'action') = 'save'
    )                                                                       AS saves,
    COUNT(*) FILTER (WHERE event_name = 'share_initiated')                  AS shares,
    0                                                                       AS search_impressions
  FROM analytics_events
  WHERE created_at::date = target_date
    AND entity_type      = 'listing'
    AND entity_id        IS NOT NULL
  GROUP BY entity_id
  ON CONFLICT (listing_id, snapshot_date) DO UPDATE SET
    page_views         = EXCLUDED.page_views,
    cta_clicks         = EXCLUDED.cta_clicks,
    saves              = EXCLUDED.saves,
    shares             = EXCLUDED.shares,
    search_impressions = EXCLUDED.search_impressions,
    updated_at         = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  -- ▲ NEW (2 of 2): rescore search order from the rollup just written.
  v_rescored := refresh_activity_scores();

  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;

  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status, notes)
  VALUES (
    target_date, v_upserted, 0, v_duration, 'success',
    'rescored ' || v_rescored || ' listings'
  );

  RETURN jsonb_build_object(
    'date',           target_date,
    'rows_upserted',  v_upserted,
    'rescored',       v_rescored,
    'duration_ms',    v_duration,
    'status',         'success'
  );

EXCEPTION WHEN OTHERS THEN
  v_duration := extract(milliseconds from clock_timestamp() - v_start)::integer;

  INSERT INTO analytics_job_log (run_date, listings_processed, errors, duration_ms, status, notes)
  VALUES (target_date, 0, 1, v_duration, 'failed', SQLERRM);

  RETURN jsonb_build_object(
    'date',        target_date,
    'duration_ms', v_duration,
    'status',      'failed',
    'error',       SQLERRM
  );
END;
$$;

-- Re-stated for clarity. CREATE OR REPLACE preserved these, so this is a no-op
-- that documents the expected grant set (20260823000000_definer_function_hardening.sql)
-- rather than a change.
REVOKE ALL ON FUNCTION aggregate_entity_analytics(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION aggregate_entity_analytics(date) FROM anon;
REVOKE ALL ON FUNCTION aggregate_entity_analytics(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION aggregate_entity_analytics(date) TO service_role;


-- =============================================================================
-- PART 6 — search_listings_faceted
--
-- Signature IDENTICAL to 20260922000000 and 20260904000000 (17 args, same order,
-- same types). Body is 20260922000000 verbatim — including its recall predicate
-- and its two-tier rank, which MUST survive unchanged — except the two places
-- marked ▲ NEW.
--
-- facet_counts() is NOT touched. It has no ORDER BY, and 20260922000000's PART 3
-- header states the standing requirement that facet_counts.core stays LITERALLY
-- identical to the predicate below. This migration changes no predicate, so the
-- two remain identical and the sidebar counts keep describing the result set the
-- visitor is looking at.
-- =============================================================================
CREATE OR REPLACE FUNCTION search_listings_faceted(
  p_q                text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_city_id          uuid    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_trust_tier       text    DEFAULT NULL,
  p_location_type    text    DEFAULT NULL,
  p_location_types   text[]  DEFAULT NULL,
  p_price_ranges     text[]  DEFAULT NULL,
  p_attribute_values uuid[]  DEFAULT NULL,
  p_open_now         boolean DEFAULT NULL,
  p_ownership_label  text    DEFAULT NULL,
  p_lat              double precision DEFAULT NULL,
  p_lng              double precision DEFAULT NULL,
  p_radius_miles     double precision DEFAULT NULL,
  p_sort             text    DEFAULT 'relevance',
  p_limit            int     DEFAULT 24,
  p_offset           int     DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      l.id,
      l.is_featured,
      -- Still selected although the ORDER BY no longer reads it, so restoring
      -- the previous order is a one-block change to the ORDER BY alone.
      l.ownership_label,
      l.published_at,
      l.save_count,
      l.avg_rating,
      l.review_count,
      l.name,
      l.activity_score,                                       -- ▲ NEW (1 of 2)
      CASE WHEN l.tier IN ('growth', 'premium') THEN 1 ELSE 0 END AS tier_weight,
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             AND d.lat IS NOT NULL AND d.lng IS NOT NULL
        THEN haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
      END AS distance_miles,
      -- ▲ NEW (2 of 2): match_band. This is the founder's 2026-09-23 decision
      -- expressed as a sort key: "bands of comparable match quality, then
      -- activity orders within each band."
      --
      --   no keyword      → 0 for every row, so every row ties and the next key
      --                     (activity_score) fully decides the order. That is
      --                     "browse pages are pure activity order", with no
      --                     extra branch needed.
      --   exact FTS hit   → 10, ONE band. Activity fully orders exact matches
      --                     among themselves, which is what the founder asked
      --                     for, and no trigram-only hit can reach this band.
      --   trigram-only    → floor(word_similarity * 10), so bands 3..9 (the
      --                     predicate floor is 0.3). A 0.9 near-match still
      --                     outranks a 0.35 loose match no matter how active the
      --                     loose one is.
      --
      -- Bands have edges: two trigram hits at 0.499 and 0.501 land in different
      -- bands and activity will not reorder across them. That is inherent to
      -- banding and is the accepted cost of not letting activity swamp
      -- relevance. The similarity expression is deliberately a literal repeat of
      -- the one in `rank` below so the two can never drift apart.
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0
        WHEN l.search_vector @@ websearch_to_tsquery('english', p_q) THEN 10
        ELSE floor(
               greatest(
                 word_similarity(p_q, l.name),
                 word_similarity(p_q, coalesce(l.tagline, '')),
                 word_similarity(p_q, coalesce(cat.name, ''))
               ) * 10
             )::int
      END AS match_band,
      -- Two-tier rank, unchanged from 20260922000000. An exact full-text hit
      -- scores 1.0 + ts_rank and therefore always outranks any trigram-only hit,
      -- which scores its own word_similarity (<= 1.0).
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0
        WHEN l.search_vector @@ websearch_to_tsquery('english', p_q)
          THEN 1.0 + ts_rank(l.search_vector, websearch_to_tsquery('english', p_q))
        ELSE greatest(
               word_similarity(p_q, l.name),
               word_similarity(p_q, coalesce(l.tagline, '')),
               word_similarity(p_q, coalesce(cat.name, ''))
             )
      END AS rank
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    LEFT JOIN categories cat ON cat.id = l.category_id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (
        p_q IS NULL OR p_q = ''
        OR l.search_vector @@ websearch_to_tsquery('english', p_q)
        OR word_similarity(p_q, l.name) > 0.3
        OR word_similarity(p_q, coalesce(l.tagline, '')) > 0.3
        OR word_similarity(p_q, coalesce(cat.name, '')) > 0.3
      )
      AND (
        p_category_id IS NULL
        OR l.category_id = p_category_id
        OR cat.parent_id = p_category_id
      )
      AND (p_city_id        IS NULL OR l.city_id         = p_city_id)
      AND (p_entity_type    IS NULL OR l.entity_type     = p_entity_type)
      AND (p_trust_tier     IS NULL OR l.trust_tier      = p_trust_tier)
      AND (p_location_type  IS NULL OR l.location_type   = p_location_type)
      AND (
        p_location_types IS NULL
        OR array_length(p_location_types, 1) IS NULL
        OR l.location_type = ANY (p_location_types)
      )
      AND (p_ownership_label IS NULL OR l.ownership_label = p_ownership_label)
      AND (
        p_price_ranges IS NULL
        OR array_length(p_price_ranges, 1) IS NULL
        OR d.price_range = ANY (p_price_ranges)
      )
      AND (p_open_now IS NOT TRUE OR is_open_now(l.id))
      AND (
        p_lat IS NULL OR p_lng IS NULL OR p_radius_miles IS NULL
        OR (
          d.lat IS NOT NULL
          AND d.lng IS NOT NULL
          AND d.lat::double precision
              BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
          AND d.lng::double precision
              BETWEEN p_lng - (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
                  AND p_lng + (p_radius_miles / (69.0 * GREATEST(cos(radians(p_lat)), 0.01)))
          AND haversine_miles(p_lat, p_lng, d.lat::double precision, d.lng::double precision)
              <= p_radius_miles
        )
      )
      -- Attributes: AND across groups, OR within a group.
      AND (
        p_attribute_values IS NULL
        OR array_length(p_attribute_values, 1) IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM attribute_values sel
          WHERE sel.id = ANY (p_attribute_values)
          GROUP BY sel.group_id
          HAVING NOT EXISTS (
            SELECT 1
            FROM listing_attributes la
            JOIN attribute_values av ON av.id = la.value_id
            WHERE la.listing_id = l.id
              AND av.group_id = sel.group_id
              AND la.value_id = ANY (p_attribute_values)
          )
        )
      )
  ),
  counted AS (
    SELECT f.*, count(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT c.id, c.total_count
  FROM counted c
  ORDER BY
    -- Sponsored placement. Labeled in the UI, always first, never earned by
    -- activity. Unchanged.
    c.is_featured DESC,

    -- REMOVED HERE: (c.ownership_label = 'black_owned') DESC.
    -- [Decision — founder, 2026-09-21] The ownership label is shown on every
    -- listing and no longer affects order.

    -- An explicit distance sort keeps its own primary key.
    CASE WHEN p_sort = 'distance' THEN c.distance_miles END ASC NULLS LAST,

    -- Relevance sort (the default), in the founder's order:
    --   match band → activity within the band → paid tier → fine-grained rank.
    -- With no keyword every band is 0, so this collapses to pure activity order.
    CASE WHEN p_sort = 'relevance' THEN c.match_band END     DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' THEN c.activity_score END DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' AND p_q IS NOT NULL AND p_q <> ''
         THEN c.tier_weight END                              DESC NULLS LAST,
    CASE WHEN p_sort = 'relevance' THEN c.rank END           DESC NULLS LAST,

    CASE WHEN p_sort = 'rating'    THEN c.avg_rating END    DESC NULLS LAST,
    CASE WHEN p_sort = 'reviews'   THEN c.review_count END  DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'    THEN c.published_at END  DESC NULLS LAST,
    CASE WHEN p_sort = 'saves'     THEN c.save_count END    DESC NULLS LAST,
    CASE WHEN p_sort = 'name'      THEN c.name END          ASC,
    -- stable tiebreakers
    c.save_count DESC,
    c.published_at DESC NULLS LAST,
    c.id
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

-- Re-stated for clarity; CREATE OR REPLACE preserved these, so this is a no-op
-- that documents the expected grant rather than a change.
GRANT EXECUTE ON FUNCTION search_listings_faceted(
  text, uuid, uuid, text, text, text, text[], text[], uuid[], boolean, text,
  double precision, double precision, double precision, text, int, int
) TO anon, authenticated;


-- =============================================================================
-- PART 7 — initial backfill
--
-- Without this, every listing sits at the 0 default until the first nightly run,
-- and the browse order would be the stable tiebreakers alone for up to a day.
-- =============================================================================
SELECT refresh_activity_scores();
