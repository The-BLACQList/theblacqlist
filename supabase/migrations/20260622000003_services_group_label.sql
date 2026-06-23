-- =============================================================================
-- Migration: Service group label (Pillar B / B5)
-- Optional grouping for services/offerings so a listing can present a sectioned
-- "menu" (e.g. Appetizers / Entrées). Read + written fail-soft, so code can ship
-- before this is applied (offerings render flat until then).
-- =============================================================================
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS group_label text;
