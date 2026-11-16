-- =============================================================================
-- Photo albums (ticket 193, 2026-11-15).
--
-- One nullable column: the album a page photo is filed under ("Interior",
-- "Menu", "Events"). NULL means unfiled. The gallery shows a chip row only
-- when a page's photos sit under two or more albums, so a page with no albums,
-- or one, looks exactly as it does today.
--
-- Plan: Growth and up (FEATURE_MIN_TIER.photo_albums). Filing a photo under an
-- album is checked by the server action; the page loader reads the column only
-- for a page whose plan shows albums. Nothing is cleared when a page moves
-- down a plan: an upgrade shows the albums again (ticket 105).
--
-- No policy change. The owner's album writes go through a server action that
-- checks the page is theirs and then writes with the service client, scoped to
-- that page's photos (the existing update policy only covers photos the owner
-- uploaded themselves, which would leave imported photos unfileable).
--
-- Down:
--   ALTER TABLE public.media_attachments DROP COLUMN IF EXISTS album;
-- =============================================================================

ALTER TABLE public.media_attachments
  ADD COLUMN IF NOT EXISTS album text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_attachments_album_check'
  ) THEN
    ALTER TABLE public.media_attachments
      ADD CONSTRAINT media_attachments_album_check
      CHECK (album IS NULL OR char_length(btrim(album)) BETWEEN 1 AND 40);
  END IF;
END $$;

-- The page's albums: a rename touches every photo in one album.
CREATE INDEX IF NOT EXISTS media_attachments_album_idx
  ON public.media_attachments (entity_id, album)
  WHERE album IS NOT NULL;
