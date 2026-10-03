-- =============================================================================
-- staging-attributes-seed.sql
-- ONE-PASTE attribute data for the Supabase SQL editor (manual staging apply).
--
-- Run AFTER the migrations 20260622000000 + 20260622000001 are applied.
-- Loads the faceted-filter vocabulary (6 groups, 41 values) and backfills
-- the Black-Owned tag from each listing's ownership_label. Identity and amenity
-- tags are left for owners to set in the dashboard.
--
-- CANONICAL SOURCES (do not edit this copy by hand — regenerate instead):
--   * Vocabulary: supabase/seed.sql  SECTION 5 + SECTION 6
--   * Backfill:   supabase/seeds/003_attribute_backfill.sql
-- Idempotent: ON CONFLICT DO NOTHING throughout — safe to re-run.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 5: ATTRIBUTE GROUPS (faceted filter sections)
-- Fixed UUIDs so the backfill (seeds/003) and any future migration can
-- reference values by id. input_type 'checkbox' = multi-select facet.
-- applies_to '{}' = applies to all entity types.
-- =============================================================================
INSERT INTO attribute_groups (id, name, slug, description, input_type, applies_to, display_order, is_filterable, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Identity & Ownership', 'identity-ownership', 'How this business identifies its ownership.', 'checkbox', '{}',                1, true, true),
  ('a1000000-0000-0000-0000-000000000002', 'Service Options',      'service-options',    'How customers can buy or be served.',         'checkbox', '{}',                2, true, true),
  ('a1000000-0000-0000-0000-000000000003', 'Accessibility',        'accessibility',      'Accessibility features at this business.',    'checkbox', '{}',                3, true, true),
  ('a1000000-0000-0000-0000-000000000004', 'Payment',              'payment',            'Accepted payment methods.',                   'checkbox', '{}',                4, true, true),
  ('a1000000-0000-0000-0000-000000000005', 'Amenities',            'amenities',          'On-site amenities.',                          'checkbox', '{}',                5, true, true),
  ('a1000000-0000-0000-0000-000000000006', 'Dietary',              'dietary',            'Dietary options offered.',                    'checkbox', '{business,vendor}', 6, true, true)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 6: ATTRIBUTE VALUES (selectable options within each group)
-- "Black-Owned" (a2000000-0001-...-001) is the flagship default backfilled in
-- seeds/003_attribute_backfill.sql.
-- =============================================================================

-- Identity & Ownership (full set — BLACQList's flagship differentiator)
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0001-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Black-Owned',                  'black-owned',        1, true),
  ('a2000000-0001-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Black-Woman-Owned',            'black-woman-owned',  2, true),
  ('a2000000-0001-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Black-Man-Owned',              'black-man-owned',    3, true),
  ('a2000000-0001-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'LGBTQ+-Owned',                 'lgbtq-owned',        4, true),
  ('a2000000-0001-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Veteran-Owned',                'veteran-owned',      5, true),
  ('a2000000-0001-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'Immigrant-Owned',              'immigrant-owned',    6, true),
  ('a2000000-0001-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'Family-Owned',                 'family-owned',       7, true),
  ('a2000000-0001-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'Faith-Based',                  'faith-based',        8, true),
  ('a2000000-0001-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'Minority-Certified (MBE/DBE)', 'minority-certified', 9, true)
ON CONFLICT (group_id, slug) DO NOTHING;

-- Service Options
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0002-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'In-Store Shopping',     'in-store-shopping',     1, true),
  ('a2000000-0002-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Online Orders',         'online-orders',         2, true),
  ('a2000000-0002-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Delivery',              'delivery',              3, true),
  ('a2000000-0002-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'Curbside Pickup',       'curbside-pickup',       4, true),
  ('a2000000-0002-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'Appointment Only',      'appointment-only',      5, true),
  ('a2000000-0002-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'Walk-Ins Welcome',      'walk-ins-welcome',      6, true),
  ('a2000000-0002-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'Virtual Consultations', 'virtual-consultations', 7, true),
  ('a2000000-0002-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'Mobile / On-Site',      'mobile-service',        8, true)
ON CONFLICT (group_id, slug) DO NOTHING;

-- Accessibility
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0003-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'Wheelchair Accessible',   'wheelchair-accessible',   1, true),
  ('a2000000-0003-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'ADA Compliant',           'ada-compliant',           2, true),
  ('a2000000-0003-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'Accessible Restroom',     'accessible-restroom',     3, true),
  ('a2000000-0003-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'Gender-Neutral Restroom', 'gender-neutral-restroom', 4, true),
  ('a2000000-0003-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 'Service-Animal Friendly', 'service-animal-friendly', 5, true)
ON CONFLICT (group_id, slug) DO NOTHING;

-- Payment
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0004-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'Cash',               'cash',         1, true),
  ('a2000000-0004-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'Credit / Debit',     'credit-debit', 2, true),
  ('a2000000-0004-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'Apple / Google Pay', 'mobile-pay',   3, true),
  ('a2000000-0004-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'Cash App',           'cash-app',     4, true),
  ('a2000000-0004-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', 'Zelle',              'zelle',        5, true),
  ('a2000000-0004-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000004', 'Afterpay / Klarna',  'bnpl',         6, true),
  ('a2000000-0004-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004', 'HSA / FSA',          'hsa-fsa',      7, true)
ON CONFLICT (group_id, slug) DO NOTHING;

-- Amenities
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0005-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'Free Wi-Fi',        'free-wifi',       1, true),
  ('a2000000-0005-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'Parking Available', 'parking',         2, true),
  ('a2000000-0005-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000005', 'Outdoor Seating',   'outdoor-seating', 3, true),
  ('a2000000-0005-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'Kid-Friendly',      'kid-friendly',    4, true),
  ('a2000000-0005-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'Pet-Friendly',      'pet-friendly',    5, true),
  ('a2000000-0005-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000005', 'Reservations',      'reservations',    6, true)
ON CONFLICT (group_id, slug) DO NOTHING;

-- Dietary (food-leaning; applies to business + vendor)
INSERT INTO attribute_values (id, group_id, name, slug, display_order, is_active) VALUES
  ('a2000000-0006-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 'Vegan Options', 'vegan-options', 1, true),
  ('a2000000-0006-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 'Vegetarian',    'vegetarian',    2, true),
  ('a2000000-0006-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', 'Halal',         'halal',         3, true),
  ('a2000000-0006-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 'Kosher',        'kosher',        4, true),
  ('a2000000-0006-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'Gluten-Free',   'gluten-free',   5, true),
  ('a2000000-0006-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'Organic',       'organic',       6, true)
ON CONFLICT (group_id, slug) DO NOTHING;


-- =============================================================================
-- BACKFILL — attach attribute values to published listings (from seeds/003)
-- =============================================================================
-- Flagship: "Black-Owned" only where the researched ownership_label says so.
-- Identity and amenity tags are left for owners to set. See the header of
-- supabase/seeds/003_attribute_backfill.sql for why.
INSERT INTO listing_attributes (listing_id, value_id)
SELECT l.id, 'a2000000-0001-0000-0000-000000000001'  -- black-owned
FROM listings l
WHERE l.status = 'published' AND l.deleted_at IS NULL
  AND l.ownership_label = 'black_owned'
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- VERIFY (run separately after COMMIT):
--   select count(*) from attribute_groups;    -- expect 6
--   select count(*) from attribute_values;    -- expect 41
--   select count(*) from listing_attributes;  -- > 0
--   select name, usage_count from attribute_values
--     where usage_count > 0 order by usage_count desc limit 10;
-- =============================================================================
