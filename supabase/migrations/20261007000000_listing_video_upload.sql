-- =============================================================================
-- Migration: owners upload their own video (ticket 130)
-- =============================================================================
-- Until now a page video could only be a YouTube or Vimeo link
-- (video_embed_url, 20260622000002). `[Decision — founder, 2026-10-07]` owners
-- can upload a video file of their own, and links stay as the other option.
--
-- * listing_details_business.video_path holds the storage path of an uploaded
--   video, never a URL (the public URL is built at read time). A page has one
--   video, so a row holds a path or a link, not both.
-- * The path shape is pinned so an owner writing the row directly can only
--   point at a video under their own listing's folder shape. The server action
--   checks the listing id inside the path matches the row.
-- * listing-video is its own public bucket. The browser uploads straight to
--   storage with a signed upload URL (a Vercel function body tops out near
--   4.5 MB), so the bucket's size cap and type list are the only limits the
--   bytes pass through on the way in. Keeping them off listing-media means the
--   photo bucket's 5 MB image-only rules stay as tight as they are.
-- * No storage.objects policies, same as the other buckets: only the service
--   role writes, through signed upload URLs it issues per listing.
--
-- The app reads video_path with the same fail-soft query as video_embed_url, so
-- the code may ship before this runs, and a page without the column just shows
-- its link video as before.
-- =============================================================================

ALTER TABLE listing_details_business
  ADD COLUMN IF NOT EXISTS video_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_details_business_video_path_shape'
  ) THEN
    ALTER TABLE listing_details_business
      ADD CONSTRAINT listing_details_business_video_path_shape CHECK (
        video_path IS NULL
        OR video_path ~ '^listings/[0-9a-f-]{36}/video/[0-9a-f-]{36}\.(mp4|mov|webm)$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_details_business_one_video'
  ) THEN
    ALTER TABLE listing_details_business
      ADD CONSTRAINT listing_details_business_one_video CHECK (
        video_path IS NULL OR video_embed_url IS NULL
      );
  END IF;
END $$;

-- 50 MB matches the hosted project's default per-file upload limit. Raising it
-- means raising the project's storage upload limit first (Storage settings),
-- then this bucket and LISTING_VIDEO_MAX_BYTES in lib/video/listingVideo.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-video',
  'listing-video',
  true,
  52428800,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;
