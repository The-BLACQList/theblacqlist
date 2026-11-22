-- =============================================================================
-- Bath & Body subcategory (ticket 257)
-- =============================================================================
-- "How do I switch to Black Owned bathroom products" found nothing on
-- production (founder, 2026-11-21). Soap, lotion, body butter and deodorant
-- makers had no home of their own: they sat in Health & Wellness Products
-- next to supplements and sea moss, or in a group with no subcategory at all.
-- The founder picked a Bath & Body subcategory under Retail & Gifts.
--
--   Retail & Gifts > Bath & Body
--
-- Additive only, the same pattern as 20261108000000_seven_more_subcategories.
-- The id matches supabase/seed.sql so every environment agrees, and the parent
-- is looked up by slug so a project whose parents were seeded with other ids
-- still gets the right link. ON CONFLICT (slug) DO NOTHING makes a re-run a
-- no-op. Listings move in through scripts/ops/suggest-subcategories.ts
-- --into=bath-body and apply-subcategories.ts once the founder approves the
-- CSV, not here.
--
-- Rollback. listings.category_id is ON DELETE RESTRICT, so the delete fails
-- while any listing uses it. Move those listings back first (the rollback CSV
-- apply-subcategories.ts writes), then:
--   SELECT count(*) FROM listings l JOIN categories c ON c.id = l.category_id
--    WHERE c.slug = 'bath-body';
--   DELETE FROM categories WHERE slug = 'bath-body';
-- =============================================================================

INSERT INTO categories (id, name, slug, parent_id, display_order, is_active)
SELECT v.id::uuid, v.name, v.slug, p.id, v.display_order, true
FROM (VALUES
  ('c0000002-0022-0000-0000-000000000008', 'Bath & Body', 'bath-body', 'retail-gifts', 8)
) AS v (id, name, slug, parent_slug, display_order)
JOIN categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO NOTHING;
