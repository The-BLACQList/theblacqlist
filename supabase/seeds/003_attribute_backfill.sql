-- =============================================================================
-- Seed: 003_attribute_backfill.sql
-- Attaches the one attribute the data can vouch for: "Black-Owned", on every
-- published listing whose researched listings.ownership_label is 'black_owned'.
-- Runs AFTER seed.sql (attribute vocabulary) and 001_listings.sql (listings).
-- Idempotency: ON CONFLICT DO NOTHING, safe to re-run.
--
-- Nothing else is attached here, on purpose. Identity tags (Black-Woman-Owned,
-- Black-Man-Owned, Veteran-Owned, Minority-Certified, ...) and amenity tags
-- (wheelchair accessible, parking, payment, dietary, ...) are facts only an
-- owner can state. Until 2026-10-03 this file handed them out by row number
-- (n % 2 = 0 got Black-Woman-Owned, n % 2 = 1 got Black-Man-Owned), and cards on
-- staging told visitors a business described as Black woman-owned was
-- Black-Man-Owned. Owners set these in the dashboard editor
-- (lib/actions/dashboard/updateListingAttributes.ts). Pinned by
-- tests/seeded-listing-tags.test.ts.
-- =============================================================================

BEGIN;

-- Flagship: attach "Black-Owned" only to listings labeled black_owned.
INSERT INTO listing_attributes (listing_id, value_id)
SELECT l.id, 'a2000000-0001-0000-0000-000000000001'  -- black-owned
FROM listings l
WHERE l.status = 'published' AND l.deleted_at IS NULL
  AND l.ownership_label = 'black_owned'
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- BACKFILL COMPLETE
-- Verify: SELECT av.name, av.usage_count FROM attribute_values av
--         WHERE av.usage_count > 0 ORDER BY av.usage_count DESC;
-- =============================================================================
