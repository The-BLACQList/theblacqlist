-- =============================================================================
-- Migration: Listing video embed (Pillar B / B1)
-- Adds an optional YouTube/Vimeo embed URL to business listings. The app reads
-- it via a separate fail-soft query, so code can ship before this is applied.
-- =============================================================================
ALTER TABLE listing_details_business
  ADD COLUMN IF NOT EXISTS video_embed_url text;
