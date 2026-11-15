-- =============================================================================
-- Title Case on labels saved in the database (ticket 205)
--
-- [Decision — founder, 2026-11-14] Title Case all through the site. Asked about
-- labels already saved in the database: "Update it" (saved button presets) and
-- "Update them" (category names).
--
--   1. Quick-start button presets saved before ticket 205. New pages get
--      "Email Me", "Follow Me" and "Work with Me" (lib/listings/quickStart.ts).
--      Only exact matches of the three old presets change. A label the owner
--      typed is owner text and stays as written.
--   2. Category names seeded in sentence case: "E-commerce Solutions".
--   3. The creator filter heading "Audience size (self-reported)".
--
-- Every UPDATE matches the old text exactly, so a re-run is a no-op and a row
-- someone has since edited is left alone. Categories an admin added from a
-- category request are not known here; scripts/ops/title-case-categories.ts
-- lists and fixes those (dry run by default).
--
-- GATE-DATA: staging first; production with the ticket 205 merge, after the
-- 16–17 Nov freeze.
--
-- Rollback (restores the old text; the presets only where they still match):
--   UPDATE listing_details_business SET cta_label_override = 'Email me'     WHERE cta_label_override = 'Email Me';
--   UPDATE listing_details_business SET cta_label_override = 'Follow me'    WHERE cta_label_override = 'Follow Me';
--   UPDATE listing_details_business SET cta_label_override = 'Work with me' WHERE cta_label_override = 'Work with Me';
--   UPDATE categories SET name = 'E-commerce Solutions' WHERE slug = 'ecommerce-solutions' AND name = 'E-Commerce Solutions';
--   UPDATE attribute_groups SET name = 'Audience size (self-reported)' WHERE slug = 'audience-size' AND name = 'Audience Size (Self-Reported)';
-- Note: the preset rollback also reverts owners who typed the new casing by
-- hand, which is harmless (same words).
-- =============================================================================

UPDATE public.listing_details_business
   SET cta_label_override = CASE cta_label_override
         WHEN 'Email me'     THEN 'Email Me'
         WHEN 'Follow me'    THEN 'Follow Me'
         WHEN 'Work with me' THEN 'Work with Me'
       END
 WHERE cta_label_override IN ('Email me', 'Follow me', 'Work with me');

UPDATE public.categories
   SET name = 'E-Commerce Solutions'
 WHERE slug = 'ecommerce-solutions'
   AND name = 'E-commerce Solutions';

UPDATE public.attribute_groups
   SET name = 'Audience Size (Self-Reported)'
 WHERE slug = 'audience-size'
   AND name = 'Audience size (self-reported)';
