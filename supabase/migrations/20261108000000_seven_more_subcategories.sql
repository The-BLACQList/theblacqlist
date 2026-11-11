-- =============================================================================
-- Seven more subcategories (ticket 170 follow-up)
-- =============================================================================
-- The ticket 170 backfill on staging (2026-11-08) left listings filed under a
-- group with no child that fits them. The founder picked these seven homes:
--
--   Food & Dining           > Ice Cream & Desserts   (creameries, custard)
--   Beauty & Grooming       > Beauty Supply          (beauty supply stores)
--   Travel & Transportation > Hotels & Stays         (hotels, bed and breakfasts)
--   Automotive              > Car Dealers
--   Retail & Gifts          > Bike Shops
--   Education & Tutoring    > Cooking Classes
--   Healthcare              > Pharmacies
--
-- Additive only. Ids match supabase/seed.sql so every environment agrees, and
-- the parent is looked up by slug so a project whose parents were seeded with
-- other ids still gets the right link. ON CONFLICT (slug) DO NOTHING makes a
-- re-run a no-op. Listings move into these through
-- scripts/ops/apply-subcategories.ts, not here.
--
-- Rollback. listings.category_id is ON DELETE RESTRICT, so the delete fails
-- while any listing uses one of these. Move those listings first:
--   SELECT count(*) FROM listings l JOIN categories c ON c.id = l.category_id
--    WHERE c.slug IN ('ice-cream-desserts','beauty-supply','hotels-stays',
--                     'car-dealers','bike-shops','cooking-classes','pharmacies');
--   DELETE FROM categories
--    WHERE slug IN ('ice-cream-desserts','beauty-supply','hotels-stays',
--                   'car-dealers','bike-shops','cooking-classes','pharmacies');
-- =============================================================================

INSERT INTO categories (id, name, slug, parent_id, display_order, is_active)
SELECT v.id::uuid, v.name, v.slug, p.id, v.display_order, true
FROM (VALUES
  ('c0000002-0001-0000-0000-000000000010', 'Ice Cream & Desserts', 'ice-cream-desserts', 'food-dining',           10),
  ('c0000002-0002-0000-0000-000000000009', 'Beauty Supply',        'beauty-supply',      'beauty-grooming',        9),
  ('c0000002-0015-0000-0000-000000000006', 'Hotels & Stays',       'hotels-stays',       'travel-transportation',  6),
  ('c0000002-0010-0000-0000-000000000008', 'Car Dealers',          'car-dealers',        'automotive',             8),
  ('c0000002-0022-0000-0000-000000000007', 'Bike Shops',           'bike-shops',         'retail-gifts',           7),
  ('c0000002-0009-0000-0000-000000000009', 'Cooking Classes',      'cooking-classes',    'education-tutoring',     9),
  ('c0000002-0014-0000-0000-000000000008', 'Pharmacies',           'pharmacies',         'healthcare',             8)
) AS v (id, name, slug, parent_slug, display_order)
JOIN categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO NOTHING;
