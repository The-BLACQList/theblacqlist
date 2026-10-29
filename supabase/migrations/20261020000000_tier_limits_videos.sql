-- =============================================================================
-- Migration: plan limits, part two (ticket 105)
-- =============================================================================
-- Two pieces the plan limits need that the schema did not have yet.
--
-- 1. listing_videos. Growth lists "up to 3 videos" and Premium unlimited, but a
--    page could only hold one video (listing_details_business.video_embed_url
--    or video_path, 20260622000002 and 20261007000000). Each video is now its
--    own row: a YouTube/Vimeo link or an uploaded file, in the owner's order.
--    The existing video on each page is copied in as its first row. The old
--    columns stay as they are and the app stops reading them; dropping them is
--    a later migration, on the founder's approval.
--
-- 2. listings.peak_tier. `[Decision — founder, 2026-10-20]` when a page moves
--    to a lower plan, content over the new plan's limits is hidden on the
--    public page, never deleted, and comes back on upgrade. "Moved to a lower
--    plan" needs to know what the page had before: peak_tier is the highest
--    paid tier the page has ever been on. The app hides extras only when
--    `tier` ranks below `peak_tier`, so:
--      * a page that never paid (most seeded pages, peak_tier NULL) is never
--        trimmed, whatever the platform loaded onto it;
--      * a page that starts paying never loses anything it already showed.
--    Nothing is changed in storage; the public read applies the cap.
--
--    peak_tier is the platform's to keep. The a1 trigger raises it whenever
--    tier rises, for every writer, and refuses an end-user (authenticated /
--    anon) write to it, the same way a0_listings_owner_guard
--    (20260926000000) freezes tier itself. Triggers fire in name order, so a0
--    has already refused an owner changing tier by the time a1 runs.
--
--    Backfill: the current tier when it is paid, raised by any plan the page
--    has had a real subscription on (active, trialing, past_due, or canceled
--    after running). A tester whose free month already ended shows up through
--    its subscription row.
--
--    SIDE EFFECT, ACCEPTED: the backfill UPDATE bumps updated_at on paid pages
--    only (a handful today), the same trade 20260922000000 recorded.
--
-- Order of release: run this before the PR 105 code merges. Until then the old
-- code keeps writing the single-video columns; a video an owner changes in that
-- window is not copied. Re-running PART 1's backfill only fills pages that have
-- no rows yet.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS a1_listings_peak_tier ON listings;
--   DROP FUNCTION IF EXISTS listings_track_peak_tier();
--   ALTER TABLE listings DROP COLUMN IF EXISTS peak_tier;
--   DROP TABLE IF EXISTS listing_videos;   -- the old video columns are untouched
--   DROP FUNCTION IF EXISTS owned_listing_video_count(uuid);
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS throughout.
-- =============================================================================


-- =============================================================================
-- PART 1 — listing_videos
-- =============================================================================

CREATE TABLE IF NOT EXISTS listing_videos (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('embed', 'file')),
  -- A YouTube or Vimeo link. The server action checks the host.
  embed_url   text,
  -- Storage path in the listing-video bucket, never a URL. The public URL is
  -- built at read time.
  file_path   text,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT listing_videos_one_source CHECK (
    (kind = 'embed' AND embed_url IS NOT NULL AND file_path IS NULL)
    OR (kind = 'file' AND file_path IS NOT NULL AND embed_url IS NULL)
  ),
  CONSTRAINT listing_videos_embed_url_shape CHECK (
    embed_url IS NULL OR (embed_url ~ '^https?://' AND length(embed_url) <= 500)
  ),
  -- Same shape as listing_details_business_video_path_shape, pinned to this
  -- row's own listing so a direct write cannot point at another page's file.
  CONSTRAINT listing_videos_file_path_shape CHECK (
    file_path IS NULL
    OR file_path ~ ('^listings/' || listing_id::text || '/video/[0-9a-f-]{36}\.(mp4|mov|webm)$')
  )
);

CREATE INDEX IF NOT EXISTS listing_videos_listing_id_idx ON listing_videos (listing_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS listing_videos_file_path_key
  ON listing_videos (file_path) WHERE file_path IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON listing_videos;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_videos ENABLE ROW LEVEL SECURITY;

-- Reads mirror listing_faqs (20260622000004).
DROP POLICY IF EXISTS "listing_videos: anon read published" ON listing_videos;
CREATE POLICY "listing_videos: anon read published"
  ON listing_videos FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_videos: authenticated read" ON listing_videos;
CREATE POLICY "listing_videos: authenticated read"
  ON listing_videos FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- How many videos the caller's own page has. A policy on listing_videos cannot
-- read listing_videos itself (Postgres refuses: infinite recursion), so the
-- insert policy counts through this definer function instead. It answers only
-- for a page the caller owns, and 0 for anything else.
CREATE OR REPLACE FUNCTION owned_listing_video_count(p_listing_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM listing_videos v
  JOIN listings l ON l.id = v.listing_id
  WHERE v.listing_id = p_listing_id
    AND l.owner_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION owned_listing_video_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION owned_listing_video_count(uuid) TO authenticated;

-- Adding a video takes a plan with room for one. Mirrors TIER_LIMITS.videos in
-- lib/stripe/features.ts (free 0, starter 1, growth 3, premium unlimited), as
-- checked by lib/actions/dashboard/updateListingVideo.ts. If that limit ever
-- moves, this policy moves with it. The count is per page.
DROP POLICY IF EXISTS "listing_videos: owner insert" ON listing_videos;
CREATE POLICY "listing_videos: owner insert"
  ON listing_videos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_videos.listing_id
        AND l.owner_user_id = auth.uid()
        AND l.deleted_at IS NULL
        AND (
          l.tier = 'premium'
          OR (
            l.tier IN ('starter', 'growth')
            AND owned_listing_video_count(l.id)
                < CASE l.tier WHEN 'growth' THEN 3 ELSE 1 END
          )
        )
    )
  );

-- Reordering is the only update the app makes. It stays open on a lower plan,
-- so an owner can choose which videos show.
DROP POLICY IF EXISTS "listing_videos: owner update" ON listing_videos;
CREATE POLICY "listing_videos: owner update"
  ON listing_videos FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Removing a video is allowed on every plan.
DROP POLICY IF EXISTS "listing_videos: owner delete" ON listing_videos;
CREATE POLICY "listing_videos: owner delete"
  ON listing_videos FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Copy each page's one existing video in as its first row.
INSERT INTO listing_videos (listing_id, kind, embed_url, file_path, position)
SELECT
  d.listing_id,
  CASE WHEN d.video_path IS NOT NULL THEN 'file' ELSE 'embed' END,
  CASE WHEN d.video_path IS NOT NULL THEN NULL ELSE d.video_embed_url END,
  d.video_path,
  0
FROM listing_details_business d
WHERE (d.video_path IS NOT NULL OR d.video_embed_url IS NOT NULL)
  AND (d.video_path IS NOT NULL OR (d.video_embed_url ~ '^https?://' AND length(d.video_embed_url) <= 500))
  AND NOT EXISTS (SELECT 1 FROM listing_videos v WHERE v.listing_id = d.listing_id);


-- =============================================================================
-- PART 2 — listings.peak_tier
-- =============================================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS peak_tier text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_peak_tier_check'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_peak_tier_check
      CHECK (peak_tier IS NULL OR peak_tier IN ('starter', 'growth', 'premium'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION listings_track_peak_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  rank_new  int;
  rank_peak int;
BEGIN
  -- End users never set peak_tier. System writers (service_role, definer
  -- functions, this migration) may.
  IF current_user IN ('authenticated', 'anon') THEN
    IF (TG_OP = 'INSERT' AND NEW.peak_tier IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.peak_tier IS DISTINCT FROM OLD.peak_tier) THEN
      RAISE EXCEPTION 'This field can only be changed by The BLACQList.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  rank_new  := CASE NEW.tier      WHEN 'premium' THEN 3 WHEN 'growth' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END;
  rank_peak := CASE NEW.peak_tier WHEN 'premium' THEN 3 WHEN 'growth' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END;
  IF rank_new > rank_peak THEN
    NEW.peak_tier := NEW.tier;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a1_listings_peak_tier ON listings;
CREATE TRIGGER a1_listings_peak_tier
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_track_peak_tier();

-- Backfill. Only raises; never lowers a peak already set.
WITH candidates AS (
  SELECT id AS listing_id, tier
  FROM listings
  WHERE tier IN ('starter', 'growth', 'premium')
  UNION ALL
  SELECT s.listing_id, p.plan_key
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.status IN ('active', 'trialing', 'past_due', 'canceled')
    AND p.plan_key IN ('starter', 'growth', 'premium')
),
ranked AS (
  SELECT
    listing_id,
    tier,
    CASE tier WHEN 'premium' THEN 3 WHEN 'growth' THEN 2 ELSE 1 END AS r
  FROM candidates
),
best AS (
  SELECT DISTINCT ON (listing_id) listing_id, tier, r
  FROM ranked
  ORDER BY listing_id, r DESC
)
UPDATE listings l
SET peak_tier = best.tier
FROM best
WHERE l.id = best.listing_id
  AND best.r > CASE l.peak_tier WHEN 'premium' THEN 3 WHEN 'growth' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END;
