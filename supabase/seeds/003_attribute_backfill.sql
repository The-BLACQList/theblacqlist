-- =============================================================================
-- Seed: 003_attribute_backfill.sql
-- Attaches attribute values to seeded listings so the faceted filter sidebar
-- has real, non-empty data to filter and count against.
-- Runs AFTER seed.sql (attribute vocabulary) and 001_listings.sql (listings).
-- Requires: attribute_values seeded; listings seeded.
-- Idempotency: ON CONFLICT DO NOTHING — safe to re-run (usage_count trigger
-- only fires on actual inserts, so counts stay stable on re-run).
--
-- "Black-Owned" is attached to every listing whose authoritative
-- listings.ownership_label = 'black_owned'. Post-pivot the platform also admits
-- 'ally' listings (non-Black-owned supporters), so this is no longer universal;
-- the identity chip is derived from the authoritative column. The remaining
-- identity/amenity facets are distributed deterministically (by row order) so
-- each facet has a realistic, testable subset and the disjunctive counts are
-- meaningful. (All current seed rows are Black-Owned, so counts are unchanged.)
-- =============================================================================

BEGIN;

-- Flagship: attach "Black-Owned" only to listings labeled black_owned.
INSERT INTO listing_attributes (listing_id, value_id)
SELECT l.id, 'a2000000-0001-0000-0000-000000000001'  -- black-owned
FROM listings l
WHERE l.status = 'published' AND l.deleted_at IS NULL
  AND l.ownership_label = 'black_owned'
ON CONFLICT DO NOTHING;

-- Distribute the remaining facets deterministically over published listings.
WITH ordered AS (
  SELECT
    l.id,
    l.category_id,
    row_number() OVER (ORDER BY l.id) AS n
  FROM listings l
  WHERE l.status = 'published' AND l.deleted_at IS NULL
)
INSERT INTO listing_attributes (listing_id, value_id)
SELECT id, value_id::uuid
FROM ordered
CROSS JOIN LATERAL (
  VALUES
    ('a2000000-0001-0000-0000-000000000002', (n % 2 = 0)),  -- black-woman-owned
    ('a2000000-0001-0000-0000-000000000003', (n % 2 = 1)),  -- black-man-owned
    ('a2000000-0001-0000-0000-000000000005', (n % 4 = 0)),  -- veteran-owned
    ('a2000000-0001-0000-0000-000000000007', (n % 3 = 0)),  -- family-owned
    ('a2000000-0001-0000-0000-000000000009', (n % 5 = 0)),  -- minority-certified
    ('a2000000-0002-0000-0000-000000000002', (n % 2 = 0)),  -- online-orders
    ('a2000000-0002-0000-0000-000000000003', (n % 3 = 1)),  -- delivery
    ('a2000000-0002-0000-0000-000000000006', (n % 2 = 1)),  -- walk-ins-welcome
    ('a2000000-0003-0000-0000-000000000001', (n % 4 <> 0)), -- wheelchair-accessible (most)
    ('a2000000-0004-0000-0000-000000000002', (true)),       -- credit-debit (all)
    ('a2000000-0004-0000-0000-000000000004', (n % 3 = 0)),  -- cash-app
    ('a2000000-0005-0000-0000-000000000001', (n % 2 = 0)),  -- free-wifi
    ('a2000000-0005-0000-0000-000000000002', (n % 3 <> 0))  -- parking
) AS picks(value_id, include)
WHERE picks.include
ON CONFLICT DO NOTHING;

-- Dietary facets only for Food & Dining listings (and their subcategories).
WITH food_listings AS (
  SELECT l.id, row_number() OVER (ORDER BY l.id) AS n
  FROM listings l
  JOIN categories c ON c.id = l.category_id
  WHERE l.status = 'published'
    AND l.deleted_at IS NULL
    AND (c.slug = 'food-dining' OR c.parent_id = 'c0000001-0000-0000-0000-000000000001')
)
INSERT INTO listing_attributes (listing_id, value_id)
SELECT id, value_id::uuid
FROM food_listings
CROSS JOIN LATERAL (
  VALUES
    ('a2000000-0006-0000-0000-000000000001', (n % 2 = 0)),  -- vegan-options
    ('a2000000-0006-0000-0000-000000000005', (n % 3 = 0)),  -- gluten-free
    ('a2000000-0006-0000-0000-000000000006', (n % 4 = 0))   -- organic
) AS picks(value_id, include)
WHERE picks.include
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- BACKFILL COMPLETE
-- Verify: SELECT av.name, av.usage_count FROM attribute_values av
--         WHERE av.usage_count > 0 ORDER BY av.usage_count DESC;
-- =============================================================================
