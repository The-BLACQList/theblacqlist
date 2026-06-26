INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES

  -- FOOD & DINING
  ('00c00003-0000-0000-0000-000000000021','Batter & Berries Chicago','batter-and-berries-chicago',
   'Lincoln Square''s legendary French toast flight that Chicago dreams are made of.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,46,19,'admin',now()),

  ('00c00003-0000-0000-0000-000000000022','Peach''s on 47th','peachs-on-47th-chicago',
   'Bronzeville''s go-to brunch spot serving elevated Southern comfort all day.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,29,11,'admin',now()),

  ('00c00003-0000-0000-0000-000000000023','Luella''s Southern Kitchen Chicago','luellas-southern-kitchen',
   'Lincoln Square soul food that makes the entire North Side feel like home.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,31,12,'admin',now()),

  ('00c00003-0000-0000-0000-000000000024','Pearl''s Place Chicago','pearls-place-chicago',
   'A South Side institution serving Southern cooking with unmistakable Chicago soul.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,27,10,'admin',now()),

  ('00c00003-0000-0000-0000-000000000025','Gorée Cuisine Chicago','goree-cuisine-chicago',
   'West African and Afro-Caribbean flavors in a warm, welcoming Bronzeville setting.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,33,13,'admin',now()),

  ('00c00003-0000-0000-0000-000000000026','14 Parish Chicago','14-parish-chicago',
   'Bronzeville New Orleans–inspired cuisine honoring its neighborhood heritage.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000027','Soulé Chicago','soule-chicago',
   'Upscale Southern cuisine in River North where every plate tells a story.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00c00003-0000-0000-0000-000000000028','Ja'' Grill Chicago','ja-grill-chicago',
   'Authentic Jamaican jerk chicken and island classics in Lincoln Park.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,20,7,'admin',now()),

  ('00c00003-0000-0000-0000-000000000029','BJ''s Market & Bakery Chicago','bjs-market-bakery-chicago',
   'South Side soul food counter and bakery that has fed Bronzeville for decades.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,23,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000030','Sweet Maple Cafe Chicago','sweet-maple-cafe-chicago',
   'All-day breakfast and lunch in Ukrainian Village — warm, welcoming, and wonderful.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,21,8,'admin',now()),

  ('00c00003-0000-0000-0000-000000000031','Soul Veg City Chicago','soul-veg-city-chicago',
   'Chicago''s pioneering Black-owned vegan soul food restaurant since 1979.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000032','Lexington Betty Smokehouse','lexington-betty-smokehouse',
   'Chicago''s award-winning Black woman–owned smokehouse and craft brewery.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,31,12,'admin',now()),

  ('00c00003-0000-0000-0000-000000000033','Bronzeville Winery Chicago','bronzeville-winery-chicago',
   'Chicago''s first and only Black-owned urban winery celebrating community in every glass.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,27,10,'admin',now()),

  ('00c00003-0000-0000-0000-000000000034','Afro Joe''s Coffee Chicago','afro-joes-coffee-chicago',
   'Chicago''s Black-owned coffee house where every cup fuels community connection.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,18,6,'admin',now()),

  ('00c00003-0000-0000-0000-000000000035','Lem''s Bar-B-Q Chicago','lems-barbq-chicago',
   'Chicago''s legendary South Side BBQ — smoking ribs with the original sauce since 1954.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,38,16,'admin',now()),

  -- HAIR SALONS
  ('00c00003-0000-0000-0000-000000000036','Polished Crown Chicago','polished-crown-chicago',
   'Chicago''s Black-owned natural hair salon for the crown that deserves a throne.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,17,6,'admin',now()),

  ('00c00003-0000-0000-0000-000000000037','Christian Fields Hair Studio','christian-fields-hair-studio',
   'Precision cuts and styles from one of Chicago''s most sought-after Black stylists.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()),

  -- NAIL / SPA
  ('00c00003-0000-0000-0000-000000000038','Lux Nail Boutique Chicago','lux-nail-boutique-chicago',
   'Chicago''s Black-owned luxury nail boutique where every detail matters.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  -- YOGA
  ('00c00003-0000-0000-0000-000000000039','Studio Yogi Chicago','studio-yogi-chicago',
   'Inclusive yoga community for every body in the heart of Chicago.',
   'business',(SELECT id FROM categories WHERE slug='yoga-pilates'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  -- FASHION
  ('00c00003-0000-0000-0000-000000000040','Jojayden Chicago','jojayden-chicago',
   'Chicago Black-owned fashion brand celebrating individuality with every piece.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  -- REAL ESTATE
  ('00c00003-0000-0000-0000-000000000041','Ware Realty Chicago','ware-realty-chicago',
   'Black-owned Chicago real estate built on integrity and community investment.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00c00003-0000-0000-0000-000000000042','Ani Real Estate Chicago','ani-real-estate-chicago',
   'Black woman–owned Chicago real estate focused on equity and access.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  -- ARTS & CULTURE
  ('00c00003-0000-0000-0000-000000000043','Red Clay Dance Chicago','red-clay-dance-chicago',
   'Chicago''s Black-owned contemporary dance company honoring African American movement.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  ('00c00003-0000-0000-0000-000000000044','South Chicago Dance Theatre','south-chicago-dance-theatre',
   'South Side dance company preserving and celebrating Black dance heritage.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  ('00c00003-0000-0000-0000-000000000045','ILA Creative Studio Chicago','ila-creative-studio-chicago',
   'Black-owned creative studio bridging art, design, and community in Chicago.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()), -- VERIFY

  -- RETAIL
  ('00c00003-0000-0000-0000-000000000046','Boxville Chicago','boxville-chicago',
   'Bronzeville''s Black-owned shipping container marketplace for local entrepreneurs.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()),

  -- COMMUNITY
  ('00c00003-0000-0000-0000-000000000047','Urban Growers Collective Chicago','urban-growers-collective-chi',
   'Black-led urban farm transforming Chicago''s South Side through food justice.',
   'business',(SELECT id FROM categories WHERE slug='nonprofits-community-orgs'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  -- PHOTOGRAPHY
  ('00c00003-0000-0000-0000-000000000048','The Darkroom Chicago','darkroom-chicago',
   'Black-owned photography studio and creative space celebrating visual storytelling.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  -- PROFESSIONAL SERVICES
  ('00c00003-0000-0000-0000-000000000049','Refine Collective Chicago','refine-collective-chicago',
   'Black-owned consulting firm refining brands and business strategies for impact.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()),

  -- TOURS & ENTERTAINMENT
  ('00c00003-0000-0000-0000-000000000050','Chicago Mahogany Tours','chicago-mahogany-tours',
   'Black history walking tours celebrating the stories Chicago''s textbooks left out.',
   'business',(SELECT id FROM categories WHERE slug='events-entertainment'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,17,6,'admin',now())

ON CONFLICT (slug) DO NOTHING;
