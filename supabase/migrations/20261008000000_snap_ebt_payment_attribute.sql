-- =============================================================================
-- "SNAP / EBT" joins the Payment attribute group
-- =============================================================================
-- The 2026-10-07 sourcing pass added Black-owned grocery stores and farms, and
-- for a shopper on SNAP the first question is whether the store takes EBT. The
-- founder approved the tag on 2026-10-08.
--
-- Vocabulary only. This adds the value an owner or admin can tick; it tags no
-- listing. A listing gets the tag only from a source (the USDA SNAP retailer
-- locator, the store's own page, or the owner), never by assumption.
--
-- Id and display_order follow the Payment rows in supabase/seed.sql (HSA / FSA
-- is ...0007, order 7). The group is looked up by slug, so a project whose
-- groups were seeded with other ids still links right. ON CONFLICT makes a
-- re-run a no-op.
--
-- Rollback. listing_attributes cascades from attribute_values, so check first:
--   SELECT count(*) FROM listing_attributes la
--     JOIN attribute_values v ON v.id = la.value_id
--    WHERE v.slug = 'snap-ebt';
--   DELETE FROM attribute_values WHERE slug = 'snap-ebt';
-- =============================================================================

INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active)
SELECT 'a2000000-0004-0000-0000-000000000008'::uuid, g.id, 'SNAP / EBT', 'snap-ebt', 8, true
FROM attribute_groups g
WHERE g.slug = 'payment'
ON CONFLICT (group_id, slug) DO NOTHING;
