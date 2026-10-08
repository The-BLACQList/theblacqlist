-- =============================================================================
-- Farms, grocery stores and banks get their own subcategories
-- =============================================================================
-- The 2026-10-07 sourcing pass (docs/blacqlist/data/sourcing/
-- black-farmers-banks-grocers-2026-10-07.md) found Black-owned farms, grocery
-- stores, banks and credit unions to list. The tree had no place for two of the
-- three: grocers were filed under Food & Dining with no subcategory, banks had
-- no home at all, and a rural farm only fit "Urban Farming & Community Gardens".
--
-- Three children, one per parent that already reads right to a shopper:
--
--   Food & Dining                > Grocery & Markets
--   Legal & Financial            > Banks & Credit Unions
--   Agriculture & Sustainability > Farms & Farm Stands
--
-- Additive only. Ids match supabase/seed.sql so every environment agrees, and
-- the parent is looked up by slug so a project whose parents were seeded with
-- other ids still gets the right link. ON CONFLICT (slug) DO NOTHING makes a
-- re-run a no-op.
--
-- The discover "Restaurants" chip maps all of Food & Dining. Grocery & Markets
-- is excluded from that chip in lib/listings/type-shortcuts.ts, not here: the
-- SQL search functions take the resolved category ids as arguments.
--
-- Rollback. listings.category_id is ON DELETE RESTRICT, so the delete fails
-- while any listing uses one of these. Move those listings first:
--   SELECT count(*) FROM listings l JOIN categories c ON c.id = l.category_id
--    WHERE c.slug IN ('grocery-markets','banks-credit-unions','farms-farm-stands');
--   DELETE FROM categories
--    WHERE slug IN ('grocery-markets','banks-credit-unions','farms-farm-stands');
-- =============================================================================

INSERT INTO categories (id, name, slug, parent_id, display_order, is_active)
SELECT v.id::uuid, v.name, v.slug, p.id, v.display_order, true
FROM (VALUES
  ('c0000002-0001-0000-0000-000000000009', 'Grocery & Markets',     'grocery-markets',     'food-dining',                9),
  ('c0000002-0016-0000-0000-000000000006', 'Banks & Credit Unions', 'banks-credit-unions', 'legal-financial',            6),
  ('c0000002-0018-0000-0000-000000000006', 'Farms & Farm Stands',   'farms-farm-stands',   'agriculture-sustainability', 6)
) AS v (id, name, slug, parent_slug, display_order)
JOIN categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO NOTHING;
