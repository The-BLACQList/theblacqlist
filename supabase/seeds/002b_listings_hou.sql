INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES

  -- FOOD & DINING
  ('00b00002-0000-0000-0000-000000000021','Late August Houston','late-august-houston',
   'Houston fine dining where Southern roots bloom into global elegance.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,36,14,'admin',now()),

  ('00b00002-0000-0000-0000-000000000022','Reggae Hut Houston','reggae-hut-houston',
   'Authentic Jamaican flavors bringing island warmth to Houston''s Third Ward.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00b00002-0000-0000-0000-000000000023','Green Seed Vegan Houston','green-seed-vegan-houston',
   'Houston''s premier plant-based restaurant — bold flavor with zero compromise.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,28,11,'admin',now()),

  ('00b00002-0000-0000-0000-000000000024','Day 6 Coffee Houston','day-6-coffee-houston',
   'Houston''s Black-owned specialty coffee destination for the conscious cup.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00b00002-0000-0000-0000-000000000025','Mico''s Hot Chicken','micos-hot-chicken-houston',
   'Nashville-style heat meets Houston hustle in every fiery, crunchy bite.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00b00002-0000-0000-0000-000000000026','Wafflez N Creamz','wafflez-n-creamz-houston',
   'Indulgent waffles and handcrafted ice cream made for the Houston sweet tooth.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,18,6,'admin',now()),

  ('00b00002-0000-0000-0000-000000000027','Twisted Grilled Cheese Houston','twisted-grilled-cheese-houston',
   'Gourmet grilled cheese sandwiches that take comfort food to a whole new level.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,16,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000028','Frenchy''s Chicken Houston','frenchys-chicken-houston',
   'Houston''s legendary Creole-spiced chicken, beloved since 1969.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,42,18,'admin',now()),

  -- HAIR / BARBER
  ('00b00002-0000-0000-0000-000000000029','Pressed Roots HTX','pressed-roots-htx',
   'Houston''s destination natural hair salon — silk presses done with precision.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,29,11,'admin',now()),

  ('00b00002-0000-0000-0000-000000000030','The Hot Towel Tx','hot-towel-tx',
   'Premium barbershop grooming with a hot towel finish Houston men can trust.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000031','Moe Better Cuts Houston','moe-better-cuts-houston',
   'Neighborhood barbershop precision with community warmth in every cut.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  -- NAIL & SPA
  ('00b00002-0000-0000-0000-000000000032','Sojourn De Nails','sojourn-de-nails-houston',
   'Houston''s luxe nail studio where every detail tells a story.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000033','Lavender & Sage Suite Houston','lavender-and-sage-suite',
   'Spa services drenched in calm — Houston''s most serene nail and wellness suite.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  ('00b00002-0000-0000-0000-000000000034','Klassy Koats Nail Studio','klassy-koats-nail-studio',
   'Elevated nail art and coats of confidence in every single appointment.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()), -- VERIFY

  -- WELLNESS & FITNESS
  ('00b00002-0000-0000-0000-000000000035','Camellia Alise Wellness','camellia-alise-wellness',
   'Holistic wellness rooted in Black healing traditions for the whole person.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00b00002-0000-0000-0000-000000000036','Tru Essence Spa Houston','tru-essence-spa-houston',
   'Full-body spa sanctuary built for Houston women who refuse to skip self-care.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000037','R3FUEL Fitness Houston','r3fuel-fitness-houston',
   'Fitness that fuels your body, rebuilds your strength, and resets your mind.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  ('00b00002-0000-0000-0000-000000000038','Fenixx Fitness Houston','fenixx-fitness-houston',
   'Rise like the phoenix — Houston''s Black-owned fitness studio for total transformation.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00b00002-0000-0000-0000-000000000039','Kale Me Crazy Houston','kale-me-crazy-houston',
   'Fast-casual healthy bowls and juices that make eating well easy in Houston.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()), -- VERIFY Black-owned status

  -- MENTAL HEALTH
  ('00b00002-0000-0000-0000-000000000040','Vitality by Kym Houston','vitality-by-kym',
   'Therapy and mental wellness coaching designed with Black women in mind.',
   'business',(SELECT id FROM categories WHERE slug='mental-health-therapy'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  -- ACCOUNTING / LEGAL / INSURANCE
  ('00b00002-0000-0000-0000-000000000041','Jimerson Tax Services','jimerson-tax-services',
   'Expert tax preparation and planning for Houston individuals and small businesses.',
   'business',(SELECT id FROM categories WHERE slug='accounting-tax-preparation'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00b00002-0000-0000-0000-000000000042','The Real Insurance Lady','real-insurance-lady-houston',
   'Houston''s trusted Black woman insurance agent — protecting what matters most.',
   'business',(SELECT id FROM categories WHERE slug='insurance'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()),

  ('00b00002-0000-0000-0000-000000000043','Simmons Legal Group Houston','simmons-legal-group-houston',
   'Black-owned Houston law firm providing accessible legal services for all.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,6,2,'admin',now()),

  -- REAL ESTATE
  ('00b00002-0000-0000-0000-000000000044','Brooks & Davis Real Estate Group','brooks-davis-real-estate',
   'Black-owned Houston realty built on community trust and expert local knowledge.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00b00002-0000-0000-0000-000000000045','Legacy Homes Houston','legacy-homes-houston',
   'Building generational wealth one Houston home at a time.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  -- BOOKS
  ('00b00002-0000-0000-0000-000000000046','Kindred Stories Houston','kindred-stories-houston',
   'Houston''s beloved Black-owned bookstore for stories that speak to your soul.',
   'business',(SELECT id FROM categories WHERE slug='books-publishing'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  -- MUSIC
  ('00b00002-0000-0000-0000-000000000047','Third Coast Recording Houston','third-coast-recording-houston',
   'Houston''s premier Black-owned recording studio — where Third Coast legends are made.',
   'business',(SELECT id FROM categories WHERE slug='music-recording'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  -- EVENTS / RETAIL
  ('00b00002-0000-0000-0000-000000000048','LA Maison Houston','la-maison-houston',
   'Upscale Houston event venue and hospitality for celebrations that deserve more.',
   'business',(SELECT id FROM categories WHERE slug='events-entertainment'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()), -- VERIFY

  ('00b00002-0000-0000-0000-000000000049','Sunshine''s Health Food Houston','sunshines-health-food-houston',
   'Houston''s neighborhood health food store carrying vitamins, supplements, and wellness essentials.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()) -- VERIFY

ON CONFLICT (slug) DO NOTHING;
