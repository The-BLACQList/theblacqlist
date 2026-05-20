-- =============================================================================
-- Seed File: supabase/seed.sql
-- Product: The BLACQList
-- Description: Reference data for all environments (dev, staging, production).
--              Covers states (51), cities (13), categories (25 top-level +
--              subcategories), and plans (3).
--              Does NOT include test users, listings, media, or collections —
--              those belong in supabase/seeds/005+ files (dev/staging only).
-- Date: 2026-05-10
-- Idempotency: All inserts use ON CONFLICT DO NOTHING — safe to re-run.
-- Dependency order: states → cities → categories → plans
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: STATES
-- All 50 US states + District of Columbia (51 rows).
-- UNIQUE constraint on code prevents duplicates on re-run.
-- =============================================================================

INSERT INTO states (id, name, code, country) VALUES
  (gen_random_uuid(), 'Alabama',              'AL', 'US'),
  (gen_random_uuid(), 'Alaska',               'AK', 'US'),
  (gen_random_uuid(), 'Arizona',              'AZ', 'US'),
  (gen_random_uuid(), 'Arkansas',             'AR', 'US'),
  (gen_random_uuid(), 'California',           'CA', 'US'),
  (gen_random_uuid(), 'Colorado',             'CO', 'US'),
  (gen_random_uuid(), 'Connecticut',          'CT', 'US'),
  (gen_random_uuid(), 'Delaware',             'DE', 'US'),
  (gen_random_uuid(), 'District of Columbia', 'DC', 'US'),
  (gen_random_uuid(), 'Florida',              'FL', 'US'),
  (gen_random_uuid(), 'Georgia',              'GA', 'US'),
  (gen_random_uuid(), 'Hawaii',               'HI', 'US'),
  (gen_random_uuid(), 'Idaho',                'ID', 'US'),
  (gen_random_uuid(), 'Illinois',             'IL', 'US'),
  (gen_random_uuid(), 'Indiana',              'IN', 'US'),
  (gen_random_uuid(), 'Iowa',                 'IA', 'US'),
  (gen_random_uuid(), 'Kansas',               'KS', 'US'),
  (gen_random_uuid(), 'Kentucky',             'KY', 'US'),
  (gen_random_uuid(), 'Louisiana',            'LA', 'US'),
  (gen_random_uuid(), 'Maine',                'ME', 'US'),
  (gen_random_uuid(), 'Maryland',             'MD', 'US'),
  (gen_random_uuid(), 'Massachusetts',        'MA', 'US'),
  (gen_random_uuid(), 'Michigan',             'MI', 'US'),
  (gen_random_uuid(), 'Minnesota',            'MN', 'US'),
  (gen_random_uuid(), 'Mississippi',          'MS', 'US'),
  (gen_random_uuid(), 'Missouri',             'MO', 'US'),
  (gen_random_uuid(), 'Montana',              'MT', 'US'),
  (gen_random_uuid(), 'Nebraska',             'NE', 'US'),
  (gen_random_uuid(), 'Nevada',               'NV', 'US'),
  (gen_random_uuid(), 'New Hampshire',        'NH', 'US'),
  (gen_random_uuid(), 'New Jersey',           'NJ', 'US'),
  (gen_random_uuid(), 'New Mexico',           'NM', 'US'),
  (gen_random_uuid(), 'New York',             'NY', 'US'),
  (gen_random_uuid(), 'North Carolina',       'NC', 'US'),
  (gen_random_uuid(), 'North Dakota',         'ND', 'US'),
  (gen_random_uuid(), 'Ohio',                 'OH', 'US'),
  (gen_random_uuid(), 'Oklahoma',             'OK', 'US'),
  (gen_random_uuid(), 'Oregon',               'OR', 'US'),
  (gen_random_uuid(), 'Pennsylvania',         'PA', 'US'),
  (gen_random_uuid(), 'Rhode Island',         'RI', 'US'),
  (gen_random_uuid(), 'South Carolina',       'SC', 'US'),
  (gen_random_uuid(), 'South Dakota',         'SD', 'US'),
  (gen_random_uuid(), 'Tennessee',            'TN', 'US'),
  (gen_random_uuid(), 'Texas',                'TX', 'US'),
  (gen_random_uuid(), 'Utah',                 'UT', 'US'),
  (gen_random_uuid(), 'Vermont',              'VT', 'US'),
  (gen_random_uuid(), 'Virginia',             'VA', 'US'),
  (gen_random_uuid(), 'Washington',           'WA', 'US'),
  (gen_random_uuid(), 'West Virginia',        'WV', 'US'),
  (gen_random_uuid(), 'Wisconsin',            'WI', 'US'),
  (gen_random_uuid(), 'Wyoming',              'WY', 'US')
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- SECTION 2: CITIES
-- 13 launch cities (3 primary + 10 secondary).
-- state_id resolved via inline subquery — no PL/pgSQL required.
-- Primary cities: is_active=true, launch_phase='launch'
-- Secondary cities: is_active=false, launch_phase='v1'
-- =============================================================================

-- Atlanta, GA — primary launch city
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Atlanta', 'atlanta-ga', (SELECT id FROM states WHERE code = 'GA'),
        'Atlanta–Sandy Springs–Roswell, GA', 33.748752, -84.387352, true, 'launch')
ON CONFLICT (slug) DO NOTHING;

-- Houston, TX — primary launch city
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Houston', 'houston-tx', (SELECT id FROM states WHERE code = 'TX'),
        'Houston–The Woodlands–Sugar Land, TX', 29.760427, -95.369803, true, 'launch')
ON CONFLICT (slug) DO NOTHING;

-- Chicago, IL — primary launch city
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Chicago', 'chicago-il', (SELECT id FROM states WHERE code = 'IL'),
        'Chicago–Naperville–Elgin, IL-IN-WI', 41.878113, -87.629799, true, 'launch')
ON CONFLICT (slug) DO NOTHING;

-- Washington, DC
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Washington', 'washington-dc', (SELECT id FROM states WHERE code = 'DC'),
        'Washington–Arlington–Alexandria, DC-VA-MD', 38.907192, -77.036873, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Los Angeles, CA
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Los Angeles', 'los-angeles-ca', (SELECT id FROM states WHERE code = 'CA'),
        'Los Angeles–Long Beach–Anaheim, CA', 34.052235, -118.243683, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- New York, NY
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('New York', 'new-york-ny', (SELECT id FROM states WHERE code = 'NY'),
        'New York–Newark–Jersey City, NY-NJ-PA', 40.712776, -74.005974, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Philadelphia, PA
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Philadelphia', 'philadelphia-pa', (SELECT id FROM states WHERE code = 'PA'),
        'Philadelphia–Camden–Wilmington, PA-NJ-DE-MD', 39.952583, -75.165222, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Dallas, TX
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Dallas', 'dallas-tx', (SELECT id FROM states WHERE code = 'TX'),
        'Dallas–Fort Worth–Arlington, TX', 32.776664, -96.796988, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Detroit, MI
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Detroit', 'detroit-mi', (SELECT id FROM states WHERE code = 'MI'),
        'Detroit–Warren–Dearborn, MI', 42.331427, -83.045754, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Baltimore, MD
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Baltimore', 'baltimore-md', (SELECT id FROM states WHERE code = 'MD'),
        'Baltimore–Columbia–Towson, MD', 39.290385, -76.612189, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Memphis, TN
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Memphis', 'memphis-tn', (SELECT id FROM states WHERE code = 'TN'),
        'Memphis, TN-MS-AR', 35.149532, -90.048981, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- New Orleans, LA
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('New Orleans', 'new-orleans-la', (SELECT id FROM states WHERE code = 'LA'),
        'New Orleans–Metairie, LA', 29.951065, -90.071533, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- Charlotte, NC
INSERT INTO cities (name, slug, state_id, metro_area, latitude, longitude, is_active, launch_phase)
VALUES ('Charlotte', 'charlotte-nc', (SELECT id FROM states WHERE code = 'NC'),
        'Charlotte–Concord–Gastonia, NC-SC', 35.227085, -80.843124, false, 'v1')
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 3: CATEGORIES
-- Full category tree: 25 top-level categories + subcategories.
-- Insert order: all top-level rows first, then subcategory rows.
-- The parent_id self-reference requires parents to exist before children.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TOP-LEVEL CATEGORIES (parent_id = NULL)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Food & Dining',                'food-dining',                 NULL, 1,  true),
  ('c0000001-0000-0000-0000-000000000002', 'Beauty & Grooming',            'beauty-grooming',             NULL, 2,  true),
  ('c0000001-0000-0000-0000-000000000003', 'Wellness & Health',            'wellness-health',             NULL, 3,  true),
  ('c0000001-0000-0000-0000-000000000004', 'Fashion & Apparel',            'fashion-apparel',             NULL, 4,  true),
  ('c0000001-0000-0000-0000-000000000005', 'Professional Services',        'professional-services',       NULL, 5,  true),
  ('c0000001-0000-0000-0000-000000000006', 'Creative & Media',             'creative-media',              NULL, 6,  true),
  ('c0000001-0000-0000-0000-000000000007', 'Home & Living',                'home-living',                 NULL, 7,  true),
  ('c0000001-0000-0000-0000-000000000008', 'Events & Entertainment',       'events-entertainment',        NULL, 8,  true),
  ('c0000001-0000-0000-0000-000000000009', 'Education & Tutoring',         'education-tutoring',          NULL, 9,  true),
  ('c0000001-0000-0000-0000-000000000010', 'Automotive',                   'automotive',                  NULL, 10, true),
  ('c0000001-0000-0000-0000-000000000011', 'Childcare & Family',           'childcare-family',            NULL, 11, true),
  ('c0000001-0000-0000-0000-000000000012', 'Spiritual & Community',        'spiritual-community',         NULL, 12, true),
  ('c0000001-0000-0000-0000-000000000013', 'Technology',                   'technology',                  NULL, 13, true),
  ('c0000001-0000-0000-0000-000000000014', 'Healthcare',                   'healthcare',                  NULL, 14, true),
  ('c0000001-0000-0000-0000-000000000015', 'Travel & Transportation',      'travel-transportation',       NULL, 15, true),
  ('c0000001-0000-0000-0000-000000000016', 'Legal & Financial',            'legal-financial',             NULL, 16, true),
  ('c0000001-0000-0000-0000-000000000017', 'Pet Services',                 'pet-services',                NULL, 17, true),
  ('c0000001-0000-0000-0000-000000000018', 'Agriculture & Sustainability', 'agriculture-sustainability',  NULL, 18, true),
  ('c0000001-0000-0000-0000-000000000019', 'Arts & Culture',               'arts-culture',                NULL, 19, true),
  ('c0000001-0000-0000-0000-000000000020', 'Books & Publishing',           'books-publishing',            NULL, 20, true),
  ('c0000001-0000-0000-0000-000000000021', 'Construction & Trades',        'construction-trades',         NULL, 21, true),
  ('c0000001-0000-0000-0000-000000000022', 'Retail & Gifts',               'retail-gifts',                NULL, 22, true),
  ('c0000001-0000-0000-0000-000000000023', 'Photography & Videography',    'photography-videography',     NULL, 23, true),
  ('c0000001-0000-0000-0000-000000000024', 'Social Media & Marketing',     'social-media-marketing',      NULL, 24, true),
  ('c0000001-0000-0000-0000-000000000025', 'Staffing & Workforce',         'staffing-workforce',          NULL, 25, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Food & Dining (parent: c0000001-0000-0000-0000-000000000001)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0001-0000-0000-000000000001', 'Restaurants',              'restaurants',                'c0000001-0000-0000-0000-000000000001', 1, true),
  ('c0000002-0001-0000-0000-000000000002', 'Bakeries & Pastry Shops',  'bakeries-pastry-shops',      'c0000001-0000-0000-0000-000000000001', 2, true),
  ('c0000002-0001-0000-0000-000000000003', 'Cafes & Coffee',           'cafes-coffee',               'c0000001-0000-0000-0000-000000000001', 3, true),
  ('c0000002-0001-0000-0000-000000000004', 'Bars & Lounges',           'bars-lounges',               'c0000001-0000-0000-0000-000000000001', 4, true),
  ('c0000002-0001-0000-0000-000000000005', 'Catering & Events',        'catering-events-food',       'c0000001-0000-0000-0000-000000000001', 5, true),
  ('c0000002-0001-0000-0000-000000000006', 'Meal Prep & Delivery',     'meal-prep-delivery',         'c0000001-0000-0000-0000-000000000001', 6, true),
  ('c0000002-0001-0000-0000-000000000007', 'Food Trucks',              'food-trucks',                'c0000001-0000-0000-0000-000000000001', 7, true),
  ('c0000002-0001-0000-0000-000000000008', 'Juice Bars & Smoothies',   'juice-bars-smoothies',       'c0000001-0000-0000-0000-000000000001', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Beauty & Grooming (parent: c0000001-0000-0000-0000-000000000002)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0002-0000-0000-000000000001', 'Hair Salons',               'hair-salons',              'c0000001-0000-0000-0000-000000000002', 1, true),
  ('c0000002-0002-0000-0000-000000000002', 'Barber Shops',              'barber-shops',             'c0000001-0000-0000-0000-000000000002', 2, true),
  ('c0000002-0002-0000-0000-000000000003', 'Nail Salons & Spas',        'nail-salons-spas',         'c0000001-0000-0000-0000-000000000002', 3, true),
  ('c0000002-0002-0000-0000-000000000004', 'Locs & Natural Hair',       'locs-natural-hair',        'c0000001-0000-0000-0000-000000000002', 4, true),
  ('c0000002-0002-0000-0000-000000000005', 'Braiding & Extensions',     'braiding-extensions',      'c0000001-0000-0000-0000-000000000002', 5, true),
  ('c0000002-0002-0000-0000-000000000006', 'Estheticians & Skincare',   'estheticians-skincare',    'c0000001-0000-0000-0000-000000000002', 6, true),
  ('c0000002-0002-0000-0000-000000000007', 'Makeup Artists',            'makeup-artists',           'c0000001-0000-0000-0000-000000000002', 7, true),
  ('c0000002-0002-0000-0000-000000000008', 'Men''s Grooming',           'mens-grooming',            'c0000001-0000-0000-0000-000000000002', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Wellness & Health (parent: c0000001-0000-0000-0000-000000000003)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0003-0000-0000-000000000001', 'Fitness Studios',                  'fitness-studios',                  'c0000001-0000-0000-0000-000000000003', 1, true),
  ('c0000002-0003-0000-0000-000000000002', 'Personal Trainers',                'personal-trainers',                'c0000001-0000-0000-0000-000000000003', 2, true),
  ('c0000002-0003-0000-0000-000000000003', 'Yoga & Pilates',                   'yoga-pilates',                     'c0000001-0000-0000-0000-000000000003', 3, true),
  ('c0000002-0003-0000-0000-000000000004', 'Mental Health & Therapy',          'mental-health-therapy',            'c0000001-0000-0000-0000-000000000003', 4, true),
  ('c0000002-0003-0000-0000-000000000005', 'Massage Therapy',                  'massage-therapy',                  'c0000001-0000-0000-0000-000000000003', 5, true),
  ('c0000002-0003-0000-0000-000000000006', 'Nutritionists & Dietitians',       'nutritionists-dietitians',         'c0000001-0000-0000-0000-000000000003', 6, true),
  ('c0000002-0003-0000-0000-000000000007', 'Holistic & Integrative Health',    'holistic-integrative-health',      'c0000001-0000-0000-0000-000000000003', 7, true),
  ('c0000002-0003-0000-0000-000000000008', 'Chiropractic & Physical Therapy',  'chiropractic-physical-therapy',    'c0000001-0000-0000-0000-000000000003', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Fashion & Apparel (parent: c0000001-0000-0000-0000-000000000004)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0004-0000-0000-000000000001', 'Clothing Boutiques',         'clothing-boutiques',          'c0000001-0000-0000-0000-000000000004', 1, true),
  ('c0000002-0004-0000-0000-000000000002', 'Shoe Stores',                'shoe-stores',                 'c0000001-0000-0000-0000-000000000004', 2, true),
  ('c0000002-0004-0000-0000-000000000003', 'Accessories & Jewelry',      'accessories-jewelry',         'c0000001-0000-0000-0000-000000000004', 3, true),
  ('c0000002-0004-0000-0000-000000000004', 'Formal & Occasion Wear',     'formal-occasion-wear',        'c0000001-0000-0000-0000-000000000004', 4, true),
  ('c0000002-0004-0000-0000-000000000005', 'Streetwear & Urban Fashion', 'streetwear-urban-fashion',    'c0000001-0000-0000-0000-000000000004', 5, true),
  ('c0000002-0004-0000-0000-000000000006', 'Swimwear & Activewear',      'swimwear-activewear',         'c0000001-0000-0000-0000-000000000004', 6, true),
  ('c0000002-0004-0000-0000-000000000007', 'Tailoring & Alterations',    'tailoring-alterations',       'c0000001-0000-0000-0000-000000000004', 7, true),
  ('c0000002-0004-0000-0000-000000000008', 'Secondhand & Vintage',       'secondhand-vintage',          'c0000001-0000-0000-0000-000000000004', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Professional Services (parent: c0000001-0000-0000-0000-000000000005)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0005-0000-0000-000000000001', 'Law & Legal Services',            'law-legal-services',           'c0000001-0000-0000-0000-000000000005', 1, true),
  ('c0000002-0005-0000-0000-000000000002', 'Accounting & Tax Preparation',    'accounting-tax-preparation',   'c0000001-0000-0000-0000-000000000005', 2, true),
  ('c0000002-0005-0000-0000-000000000003', 'Financial Planning & Wealth',     'financial-planning-wealth',    'c0000001-0000-0000-0000-000000000005', 3, true),
  ('c0000002-0005-0000-0000-000000000004', 'Business Consulting',             'business-consulting',          'c0000001-0000-0000-0000-000000000005', 4, true),
  ('c0000002-0005-0000-0000-000000000005', 'HR & Staffing',                   'hr-staffing',                  'c0000001-0000-0000-0000-000000000005', 5, true),
  ('c0000002-0005-0000-0000-000000000006', 'Notary & Document Services',      'notary-document-services',     'c0000001-0000-0000-0000-000000000005', 6, true),
  ('c0000002-0005-0000-0000-000000000007', 'Insurance',                       'insurance',                    'c0000001-0000-0000-0000-000000000005', 7, true),
  ('c0000002-0005-0000-0000-000000000008', 'Real Estate',                     'real-estate',                  'c0000001-0000-0000-0000-000000000005', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Creative & Media (parent: c0000001-0000-0000-0000-000000000006)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0006-0000-0000-000000000001', 'Photography',              'photography',              'c0000001-0000-0000-0000-000000000006', 1, true),
  ('c0000002-0006-0000-0000-000000000002', 'Videography & Film',       'videography-film',         'c0000001-0000-0000-0000-000000000006', 2, true),
  ('c0000002-0006-0000-0000-000000000003', 'Graphic Design',           'graphic-design',           'c0000001-0000-0000-0000-000000000006', 3, true),
  ('c0000002-0006-0000-0000-000000000004', 'Music & Recording',        'music-recording',          'c0000001-0000-0000-0000-000000000006', 4, true),
  ('c0000002-0006-0000-0000-000000000005', 'Visual Art & Illustration','visual-art-illustration',  'c0000001-0000-0000-0000-000000000006', 5, true),
  ('c0000002-0006-0000-0000-000000000006', 'Content Creation',         'content-creation',         'c0000001-0000-0000-0000-000000000006', 6, true),
  ('c0000002-0006-0000-0000-000000000007', 'Branding & Marketing',     'branding-marketing',       'c0000001-0000-0000-0000-000000000006', 7, true),
  ('c0000002-0006-0000-0000-000000000008', 'Web & App Design',         'web-app-design',           'c0000001-0000-0000-0000-000000000006', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Home & Living (parent: c0000001-0000-0000-0000-000000000007)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0007-0000-0000-000000000001', 'Interior Design',              'interior-design',              'c0000001-0000-0000-0000-000000000007', 1, true),
  ('c0000002-0007-0000-0000-000000000002', 'Furniture & Decor',            'furniture-decor',              'c0000001-0000-0000-0000-000000000007', 2, true),
  ('c0000002-0007-0000-0000-000000000003', 'Cleaning Services',            'cleaning-services',            'c0000001-0000-0000-0000-000000000007', 3, true),
  ('c0000002-0007-0000-0000-000000000004', 'Moving & Storage',             'moving-storage',               'c0000001-0000-0000-0000-000000000007', 4, true),
  ('c0000002-0007-0000-0000-000000000005', 'Landscaping & Outdoor',        'landscaping-outdoor',          'c0000001-0000-0000-0000-000000000007', 5, true),
  ('c0000002-0007-0000-0000-000000000006', 'Home Repair & Renovation',     'home-repair-renovation',       'c0000001-0000-0000-0000-000000000007', 6, true),
  ('c0000002-0007-0000-0000-000000000007', 'Organizing & Staging',         'organizing-staging',           'c0000001-0000-0000-0000-000000000007', 7, true),
  ('c0000002-0007-0000-0000-000000000008', 'Smart Home Installation',      'smart-home-installation',      'c0000001-0000-0000-0000-000000000007', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Events & Entertainment (parent: c0000001-0000-0000-0000-000000000008)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0008-0000-0000-000000000001', 'Event Planning',            'event-planning',           'c0000001-0000-0000-0000-000000000008', 1, true),
  ('c0000002-0008-0000-0000-000000000002', 'DJs & Live Music',          'djs-live-music',           'c0000001-0000-0000-0000-000000000008', 2, true),
  ('c0000002-0008-0000-0000-000000000003', 'Photo & Video Booths',      'photo-video-booths',       'c0000001-0000-0000-0000-000000000008', 3, true),
  ('c0000002-0008-0000-0000-000000000004', 'Catering & Bar Service',    'catering-bar-service',     'c0000001-0000-0000-0000-000000000008', 4, true),
  ('c0000002-0008-0000-0000-000000000005', 'Venue Rental',              'venue-rental',             'c0000001-0000-0000-0000-000000000008', 5, true),
  ('c0000002-0008-0000-0000-000000000006', 'Party Supplies & Rentals',  'party-supplies-rentals',   'c0000001-0000-0000-0000-000000000008', 6, true),
  ('c0000002-0008-0000-0000-000000000007', 'Balloon & Floral Design',   'balloon-floral-design',    'c0000001-0000-0000-0000-000000000008', 7, true),
  ('c0000002-0008-0000-0000-000000000008', 'Entertainment Booking',     'entertainment-booking',    'c0000001-0000-0000-0000-000000000008', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Education & Tutoring (parent: c0000001-0000-0000-0000-000000000009)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0009-0000-0000-000000000001', 'Academic Tutoring',            'academic-tutoring',          'c0000001-0000-0000-0000-000000000009', 1, true),
  ('c0000002-0009-0000-0000-000000000002', 'Test Preparation',             'test-preparation',           'c0000001-0000-0000-0000-000000000009', 2, true),
  ('c0000002-0009-0000-0000-000000000003', 'Early Childhood Education',    'early-childhood-education',  'c0000001-0000-0000-0000-000000000009', 3, true),
  ('c0000002-0009-0000-0000-000000000004', 'After-School Programs',        'after-school-programs',      'c0000001-0000-0000-0000-000000000009', 4, true),
  ('c0000002-0009-0000-0000-000000000005', 'College Prep & Counseling',    'college-prep-counseling',    'c0000001-0000-0000-0000-000000000009', 5, true),
  ('c0000002-0009-0000-0000-000000000006', 'Music Lessons',                'music-lessons',              'c0000001-0000-0000-0000-000000000009', 6, true),
  ('c0000002-0009-0000-0000-000000000007', 'Art Classes',                  'art-classes',                'c0000001-0000-0000-0000-000000000009', 7, true),
  ('c0000002-0009-0000-0000-000000000008', 'STEM & Technology Education',  'stem-technology-education',  'c0000001-0000-0000-0000-000000000009', 8, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Automotive (parent: c0000001-0000-0000-0000-000000000010)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0010-0000-0000-000000000001', 'Auto Repair & Mechanics', 'auto-repair-mechanics',    'c0000001-0000-0000-0000-000000000010', 1, true),
  ('c0000002-0010-0000-0000-000000000002', 'Car Detailing',           'car-detailing',            'c0000001-0000-0000-0000-000000000010', 2, true),
  ('c0000002-0010-0000-0000-000000000003', 'Towing & Roadside',       'towing-roadside',          'c0000001-0000-0000-0000-000000000010', 3, true),
  ('c0000002-0010-0000-0000-000000000004', 'Car Rental',              'car-rental',               'c0000001-0000-0000-0000-000000000010', 4, true),
  ('c0000002-0010-0000-0000-000000000005', 'Tire & Wheel Services',   'tire-wheel-services',      'c0000001-0000-0000-0000-000000000010', 5, true),
  ('c0000002-0010-0000-0000-000000000006', 'Auto Body & Paint',       'auto-body-paint',          'c0000001-0000-0000-0000-000000000010', 6, true),
  ('c0000002-0010-0000-0000-000000000007', 'Mobile Mechanic',         'mobile-mechanic',          'c0000001-0000-0000-0000-000000000010', 7, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Childcare & Family (parent: c0000001-0000-0000-0000-000000000011)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0011-0000-0000-000000000001', 'Childcare Centers',               'childcare-centers',               'c0000001-0000-0000-0000-000000000011', 1, true),
  ('c0000002-0011-0000-0000-000000000002', 'Nannies & Au Pairs',              'nannies-au-pairs',                'c0000001-0000-0000-0000-000000000011', 2, true),
  ('c0000002-0011-0000-0000-000000000003', 'Family Counseling',               'family-counseling',               'c0000001-0000-0000-0000-000000000011', 3, true),
  ('c0000002-0011-0000-0000-000000000004', 'Pediatric Healthcare',            'pediatric-healthcare',            'c0000001-0000-0000-0000-000000000011', 4, true),
  ('c0000002-0011-0000-0000-000000000005', 'Tutoring & Educational Support',  'tutoring-educational-support',    'c0000001-0000-0000-0000-000000000011', 5, true),
  ('c0000002-0011-0000-0000-000000000006', 'Youth Sports & Activities',       'youth-sports-activities',         'c0000001-0000-0000-0000-000000000011', 6, true),
  ('c0000002-0011-0000-0000-000000000007', 'Family Photography',              'family-photography',              'c0000001-0000-0000-0000-000000000011', 7, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Spiritual & Community (parent: c0000001-0000-0000-0000-000000000012)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0012-0000-0000-000000000001', 'Churches & Places of Worship',          'churches-places-of-worship',     'c0000001-0000-0000-0000-000000000012', 1, true),
  ('c0000002-0012-0000-0000-000000000002', 'Non-Profits & Community Organizations', 'nonprofits-community-orgs',       'c0000001-0000-0000-0000-000000000012', 2, true),
  ('c0000002-0012-0000-0000-000000000003', 'Youth Programs',                        'youth-programs',                  'c0000001-0000-0000-0000-000000000012', 3, true),
  ('c0000002-0012-0000-0000-000000000004', 'Mentorship Programs',                   'mentorship-programs',             'c0000001-0000-0000-0000-000000000012', 4, true),
  ('c0000002-0012-0000-0000-000000000005', 'Cultural Organizations',                'cultural-organizations',          'c0000001-0000-0000-0000-000000000012', 5, true),
  ('c0000002-0012-0000-0000-000000000006', 'Support Groups & Recovery',             'support-groups-recovery',         'c0000001-0000-0000-0000-000000000012', 6, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Technology (parent: c0000001-0000-0000-0000-000000000013)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0013-0000-0000-000000000001', 'IT Support & Managed Services',  'it-support-managed-services',  'c0000001-0000-0000-0000-000000000013', 1, true),
  ('c0000002-0013-0000-0000-000000000002', 'Software Development',           'software-development',         'c0000001-0000-0000-0000-000000000013', 2, true),
  ('c0000002-0013-0000-0000-000000000003', 'Cybersecurity',                  'cybersecurity',                'c0000001-0000-0000-0000-000000000013', 3, true),
  ('c0000002-0013-0000-0000-000000000004', 'Data & Analytics',               'data-analytics',               'c0000001-0000-0000-0000-000000000013', 4, true),
  ('c0000002-0013-0000-0000-000000000005', 'Tech Consulting',                'tech-consulting',              'c0000001-0000-0000-0000-000000000013', 5, true),
  ('c0000002-0013-0000-0000-000000000006', 'E-commerce Solutions',           'ecommerce-solutions',          'c0000001-0000-0000-0000-000000000013', 6, true),
  ('c0000002-0013-0000-0000-000000000007', 'App & Mobile Development',       'app-mobile-development',       'c0000001-0000-0000-0000-000000000013', 7, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Healthcare (parent: c0000001-0000-0000-0000-000000000014)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0014-0000-0000-000000000001', 'Primary Care Physicians',    'primary-care-physicians',    'c0000001-0000-0000-0000-000000000014', 1, true),
  ('c0000002-0014-0000-0000-000000000002', 'Dentists',                   'dentists',                   'c0000001-0000-0000-0000-000000000014', 2, true),
  ('c0000002-0014-0000-0000-000000000003', 'Vision & Optometry',         'vision-optometry',           'c0000001-0000-0000-0000-000000000014', 3, true),
  ('c0000002-0014-0000-0000-000000000004', 'Urgent Care',                'urgent-care',                'c0000001-0000-0000-0000-000000000014', 4, true),
  ('c0000002-0014-0000-0000-000000000005', 'Mental & Behavioral Health', 'mental-behavioral-health',   'c0000001-0000-0000-0000-000000000014', 5, true),
  ('c0000002-0014-0000-0000-000000000006', 'Specialty Medicine',         'specialty-medicine',         'c0000001-0000-0000-0000-000000000014', 6, true),
  ('c0000002-0014-0000-0000-000000000007', 'Telehealth Services',        'telehealth-services',        'c0000001-0000-0000-0000-000000000014', 7, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Travel & Transportation (parent: c0000001-0000-0000-0000-000000000015)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0015-0000-0000-000000000001', 'Travel Agencies',              'travel-agencies',              'c0000001-0000-0000-0000-000000000015', 1, true),
  ('c0000002-0015-0000-0000-000000000002', 'Car Services & Black Cars',    'car-services-black-cars',      'c0000001-0000-0000-0000-000000000015', 2, true),
  ('c0000002-0015-0000-0000-000000000003', 'Shuttle & Airport Transport',  'shuttle-airport-transport',    'c0000001-0000-0000-0000-000000000015', 3, true),
  ('c0000002-0015-0000-0000-000000000004', 'Delivery Services',            'delivery-services',            'c0000001-0000-0000-0000-000000000015', 4, true),
  ('c0000002-0015-0000-0000-000000000005', 'Freight & Logistics',          'freight-logistics',            'c0000001-0000-0000-0000-000000000015', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Legal & Financial (parent: c0000001-0000-0000-0000-000000000016)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0016-0000-0000-000000000001', 'Estate Planning',                     'estate-planning',                    'c0000001-0000-0000-0000-000000000016', 1, true),
  ('c0000002-0016-0000-0000-000000000002', 'Business Formation & Incorporation',  'business-formation-incorporation',    'c0000001-0000-0000-0000-000000000016', 2, true),
  ('c0000002-0016-0000-0000-000000000003', 'Tax Services',                        'tax-services',                       'c0000001-0000-0000-0000-000000000016', 3, true),
  ('c0000002-0016-0000-0000-000000000004', 'Credit Repair & Financial Coaching',  'credit-repair-financial-coaching',    'c0000001-0000-0000-0000-000000000016', 4, true),
  ('c0000002-0016-0000-0000-000000000005', 'Mortgage & Lending',                  'mortgage-lending',                   'c0000001-0000-0000-0000-000000000016', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Pet Services (parent: c0000001-0000-0000-0000-000000000017)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0017-0000-0000-000000000001', 'Dog Walking & Pet Sitting',  'dog-walking-pet-sitting',  'c0000001-0000-0000-0000-000000000017', 1, true),
  ('c0000002-0017-0000-0000-000000000002', 'Pet Grooming',               'pet-grooming',             'c0000001-0000-0000-0000-000000000017', 2, true),
  ('c0000002-0017-0000-0000-000000000003', 'Veterinary Care',            'veterinary-care',          'c0000001-0000-0000-0000-000000000017', 3, true),
  ('c0000002-0017-0000-0000-000000000004', 'Pet Training',               'pet-training',             'c0000001-0000-0000-0000-000000000017', 4, true),
  ('c0000002-0017-0000-0000-000000000005', 'Pet Supplies & Accessories', 'pet-supplies-accessories', 'c0000001-0000-0000-0000-000000000017', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Agriculture & Sustainability (parent: c0000001-0000-0000-0000-000000000018)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0018-0000-0000-000000000001', 'Urban Farming & Community Gardens', 'urban-farming-community-gardens',  'c0000001-0000-0000-0000-000000000018', 1, true),
  ('c0000002-0018-0000-0000-000000000002', 'Organic & Natural Products',        'organic-natural-products',         'c0000001-0000-0000-0000-000000000018', 2, true),
  ('c0000002-0018-0000-0000-000000000003', 'Eco-Friendly Services',             'eco-friendly-services',            'c0000001-0000-0000-0000-000000000018', 3, true),
  ('c0000002-0018-0000-0000-000000000004', 'Composting & Recycling',            'composting-recycling',             'c0000001-0000-0000-0000-000000000018', 4, true),
  ('c0000002-0018-0000-0000-000000000005', 'Plant Shops & Nurseries',           'plant-shops-nurseries',            'c0000001-0000-0000-0000-000000000018', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Arts & Culture (parent: c0000001-0000-0000-0000-000000000019)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0019-0000-0000-000000000001', 'Museums & Galleries',            'museums-galleries',          'c0000001-0000-0000-0000-000000000019', 1, true),
  ('c0000002-0019-0000-0000-000000000002', 'Theater & Performing Arts',      'theater-performing-arts',    'c0000001-0000-0000-0000-000000000019', 2, true),
  ('c0000002-0019-0000-0000-000000000003', 'Poetry & Spoken Word',           'poetry-spoken-word',         'c0000001-0000-0000-0000-000000000019', 3, true),
  ('c0000002-0019-0000-0000-000000000004', 'Cultural Events & Festivals',    'cultural-events-festivals',  'c0000001-0000-0000-0000-000000000019', 4, true),
  ('c0000002-0019-0000-0000-000000000005', 'Art Instruction & Workshops',    'art-instruction-workshops',  'c0000001-0000-0000-0000-000000000019', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Books & Publishing (parent: c0000001-0000-0000-0000-000000000020)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0020-0000-0000-000000000001', 'Bookstores',                  'bookstores',                 'c0000001-0000-0000-0000-000000000020', 1, true),
  ('c0000002-0020-0000-0000-000000000002', 'Independent Publishers',      'independent-publishers',     'c0000001-0000-0000-0000-000000000020', 2, true),
  ('c0000002-0020-0000-0000-000000000003', 'Authors & Writers',           'authors-writers',            'c0000001-0000-0000-0000-000000000020', 3, true),
  ('c0000002-0020-0000-0000-000000000004', 'Book Clubs & Literary Events','book-clubs-literary-events', 'c0000001-0000-0000-0000-000000000020', 4, true),
  ('c0000002-0020-0000-0000-000000000005', 'Self-Publishing Services',    'self-publishing-services',   'c0000001-0000-0000-0000-000000000020', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Construction & Trades (parent: c0000001-0000-0000-0000-000000000021)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0021-0000-0000-000000000001', 'General Contractors',       'general-contractors',      'c0000001-0000-0000-0000-000000000021', 1, true),
  ('c0000002-0021-0000-0000-000000000002', 'Electricians',              'electricians',             'c0000001-0000-0000-0000-000000000021', 2, true),
  ('c0000002-0021-0000-0000-000000000003', 'Plumbing',                  'plumbing',                 'c0000001-0000-0000-0000-000000000021', 3, true),
  ('c0000002-0021-0000-0000-000000000004', 'HVAC',                      'hvac',                     'c0000001-0000-0000-0000-000000000021', 4, true),
  ('c0000002-0021-0000-0000-000000000005', 'Carpentry & Woodworking',   'carpentry-woodworking',    'c0000001-0000-0000-0000-000000000021', 5, true),
  ('c0000002-0021-0000-0000-000000000006', 'Flooring & Tile',           'flooring-tile',            'c0000001-0000-0000-0000-000000000021', 6, true),
  ('c0000002-0021-0000-0000-000000000007', 'Painting & Finishing',      'painting-finishing',       'c0000001-0000-0000-0000-000000000021', 7, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Retail & Gifts (parent: c0000001-0000-0000-0000-000000000022)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0022-0000-0000-000000000001', 'Gift Shops',                  'gift-shops',                 'c0000001-0000-0000-0000-000000000022', 1, true),
  ('c0000002-0022-0000-0000-000000000002', 'Candles & Home Fragrance',    'candles-home-fragrance',     'c0000001-0000-0000-0000-000000000022', 2, true),
  ('c0000002-0022-0000-0000-000000000003', 'Handmade & Artisan Goods',    'handmade-artisan-goods',     'c0000001-0000-0000-0000-000000000022', 3, true),
  ('c0000002-0022-0000-0000-000000000004', 'Cultural & Heritage Products','cultural-heritage-products', 'c0000001-0000-0000-0000-000000000022', 4, true),
  ('c0000002-0022-0000-0000-000000000005', 'Books & Media',               'books-media-retail',         'c0000001-0000-0000-0000-000000000022', 5, true),
  ('c0000002-0022-0000-0000-000000000006', 'Health & Wellness Products',  'health-wellness-products',   'c0000001-0000-0000-0000-000000000022', 6, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Photography & Videography (parent: c0000001-0000-0000-0000-000000000023)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0023-0000-0000-000000000001', 'Portrait Photography',         'portrait-photography',          'c0000001-0000-0000-0000-000000000023', 1, true),
  ('c0000002-0023-0000-0000-000000000002', 'Wedding Photography',          'wedding-photography',           'c0000001-0000-0000-0000-000000000023', 2, true),
  ('c0000002-0023-0000-0000-000000000003', 'Event Photography',            'event-photography',             'c0000001-0000-0000-0000-000000000023', 3, true),
  ('c0000002-0023-0000-0000-000000000004', 'Commercial Photography',       'commercial-photography',        'c0000001-0000-0000-0000-000000000023', 4, true),
  ('c0000002-0023-0000-0000-000000000005', 'Real Estate Photography',      'real-estate-photography',       'c0000001-0000-0000-0000-000000000023', 5, true),
  ('c0000002-0023-0000-0000-000000000006', 'Content Creation & Reels',     'content-creation-reels',        'c0000001-0000-0000-0000-000000000023', 6, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Social Media & Marketing (parent: c0000001-0000-0000-0000-000000000024)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0024-0000-0000-000000000001', 'Social Media Management',  'social-media-management',  'c0000001-0000-0000-0000-000000000024', 1, true),
  ('c0000002-0024-0000-0000-000000000002', 'Influencer Marketing',     'influencer-marketing',     'c0000001-0000-0000-0000-000000000024', 2, true),
  ('c0000002-0024-0000-0000-000000000003', 'Email Marketing',          'email-marketing',          'c0000001-0000-0000-0000-000000000024', 3, true),
  ('c0000002-0024-0000-0000-000000000004', 'SEO & Digital Advertising','seo-digital-advertising',  'c0000001-0000-0000-0000-000000000024', 4, true),
  ('c0000002-0024-0000-0000-000000000005', 'PR & Communications',      'pr-communications',        'c0000001-0000-0000-0000-000000000024', 5, true),
  ('c0000002-0024-0000-0000-000000000006', 'Brand Strategy',           'brand-strategy',           'c0000001-0000-0000-0000-000000000024', 6, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES — Staffing & Workforce (parent: c0000001-0000-0000-0000-000000000025)
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, parent_id, display_order, is_active) VALUES
  ('c0000002-0025-0000-0000-000000000001', 'Temp & Contract Staffing',       'temp-contract-staffing',       'c0000001-0000-0000-0000-000000000025', 1, true),
  ('c0000002-0025-0000-0000-000000000002', 'Executive Search',               'executive-search',             'c0000001-0000-0000-0000-000000000025', 2, true),
  ('c0000002-0025-0000-0000-000000000003', 'Career Coaching',                'career-coaching',              'c0000001-0000-0000-0000-000000000025', 3, true),
  ('c0000002-0025-0000-0000-000000000004', 'Resume & Interview Coaching',    'resume-interview-coaching',    'c0000001-0000-0000-0000-000000000025', 4, true),
  ('c0000002-0025-0000-0000-000000000005', 'Workforce Development',          'workforce-development',        'c0000001-0000-0000-0000-000000000025', 5, true)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 4: PLANS
-- Three tier records: free, standard, premium.
-- Stripe price ID fields use placeholder strings at MVP.
-- REPLACE stripe_price_id_monthly and stripe_price_id_yearly before V1 launch.
-- =============================================================================

INSERT INTO plans (name, price_monthly, price_yearly, features, stripe_price_id_monthly, stripe_price_id_yearly, is_active, display_order)
VALUES
  (
    'free',
    0.00,
    0.00,
    '["basic_listing","contact_info","1_photo","category_listing","city_listing"]'::jsonb,
    NULL,
    NULL,
    true,
    0
  ),
  (
    'standard',
    29.00,
    290.00,
    '["everything_in_free","10_photos","owner_analytics_dashboard","claim_badge","services_list","priority_search_placement"]'::jsonb,
    'price_STANDARD_MONTHLY_PLACEHOLDER',
    'price_STANDARD_YEARLY_PLACEHOLDER',
    true,
    1
  ),
  (
    'premium',
    79.00,
    790.00,
    '["everything_in_standard","unlimited_photos","featured_placement","homepage_spotlight_eligibility","priority_support","custom_cta_label","advanced_analytics"]'::jsonb,
    'price_PREMIUM_MONTHLY_PLACEHOLDER',
    'price_PREMIUM_YEARLY_PLACEHOLDER',
    true,
    2
  )
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- SEED COMPLETE
-- Summary:
--   states:     51 rows (50 US states + DC)
--   cities:     13 rows (3 primary launch + 10 secondary)
--   categories: 25 top-level + 163 subcategories = 188 total rows
--   plans:      3 rows (free, standard, premium)
--
-- NEXT STEPS:
--   1. Verify row counts: SELECT COUNT(*) FROM states; -- expect 51
--   2. Verify row counts: SELECT COUNT(*) FROM cities; -- expect 13
--   3. Verify row counts: SELECT COUNT(*) FROM categories; -- expect 188
--   4. Verify row counts: SELECT COUNT(*) FROM plans;  -- expect 3
--   5. For dev/staging: run supabase/seeds/005_test_users.sql and 006_test_user_roles.sql
--   6. For staging/production: run supabase/seeds/007_listings.sql and following files
--   7. BEFORE V1 LAUNCH: replace Stripe price ID placeholders in plans table
-- =============================================================================

COMMIT;
