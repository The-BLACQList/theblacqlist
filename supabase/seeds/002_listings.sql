-- =============================================================================
-- Seed: 002_listings.sql
-- Real Black-owned businesses: Atlanta GA (+110), Houston TX (+29), Chicago IL (+30)
-- Researched May 2026 via EatOkra, The Infatuation, BLACKLANTA, BuyBlack, Yelp,
-- Atlanta Eats, Black Restaurant Weeks, iamblackbusiness.com, and business websites.
-- VERIFY flag = details should be spot-checked before staging launch.
-- Requires: seed.sql + 001_listings.sql already applied.
-- Idempotency: ON CONFLICT DO NOTHING on both tables.
-- UUIDs: ATL 00a00001-...-041–150, HOU 00b00002-...-021–049, CHI 00c00003-...-021–050
-- ATL target: 150 total (40 existing + 110 new = 150)
-- HOU target: 49 total (20 existing + 29 new; +1 planned for seed 003)
-- CHI target: 50 total (20 existing + 30 new = 50)
-- =============================================================================

BEGIN;

-- ===========================================================================
-- ATLANTA, GA — 110 NEW LISTINGS (041–150)
-- ===========================================================================

INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES

  -- FOOD & DINING (041–068)
  ('00a00001-0000-0000-0000-000000000041','Gocha''s Breakfast Bar','gochas-breakfast-bar',
   'Celebrity brunch that set the standard for Atlanta''s breakfast culture.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,44,18,'admin',now()), -- VERIFY current address

  ('00a00001-0000-0000-0000-000000000042','APT 4B','apt-4b-atl',
   'Caribbean flavors, vintage vinyl, and Buckhead vibes in one intimate spot.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,31,12,'admin',now()),

  ('00a00001-0000-0000-0000-000000000043','Rock Steady Atlanta','rock-steady-atlanta',
   'Afro-Caribbean soul poured into every bold, late-night plate.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,26,10,'admin',now()),

  ('00a00001-0000-0000-0000-000000000044','Zaddy''s Sammiches','zaddys-sammiches',
   'Pandemic-born colossal sandwiches that went viral for very good reason.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,29,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000045','Roc South Cuisine & Cocktails','roc-south-cuisine',
   'Elevated Southern cooking with cocktails to match on Buford Highway.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000046','Fin & Feathers Atlanta','fin-and-feathers-atl',
   'Nu American Soul food redefining what comfort on a plate can truly be.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,27,10,'admin',now()),

  ('00a00001-0000-0000-0000-000000000047','Flavor Rich Restaurant','flavor-rich-restaurant',
   'Midtown''s no-nonsense spot for brunch and dinner done with serious flavor.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000048','Southern Queenz','southern-queenz-atl',
   'Upscale Southern hospitality with a twist — brunch and dinner in East Atlanta.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,21,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000049','9 Mile Station','9-mile-station-atl',
   'Rooftop views, craft brews, and Atlanta''s skyline stretching to the horizon.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,35,13,'admin',now()),

  ('00a00001-0000-0000-0000-000000000050','The Breakfast Boys','breakfast-boys-college-park',
   'All-day breakfast brilliance minutes from Hartsfield-Jackson airport.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,18,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000051','The Corner Grille','corner-grille-college-park',
   'Creole and Cajun magic in the heart of historic downtown College Park.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,17,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000052','Q-Time Restaurant','q-time-restaurant-atl',
   'Atlanta''s historic West End soul food institution — open since 1993.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000053','Ms. Icey''s Kitchen & Bar','ms-iceys-kitchen-bar',
   'Contemporary Caribbean comfort food served with elegance in Decatur.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,23,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000054','Miss Conduck','miss-conduck-atl',
   'Trinidadian and Jamaican cuisine served with intentional group-first hospitality.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,20,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000055','Bankhead Seafood','bankhead-seafood-atl',
   'Over 50 years of legendary fried fish keeping the Westside fed and proud.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,28,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000056','Trap City Cafe','trap-city-cafe-atl',
   'T.I.''s community restaurant bringing Southern soul and trap culture back home.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,34,13,'admin',now()),

  ('00a00001-0000-0000-0000-000000000057','Local Green Atlanta','local-green-atlanta',
   'Plant-based fast food that is nutritious, affordable, and genuinely delicious.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,31,12,'admin',now()),

  ('00a00001-0000-0000-0000-000000000058','Portrait Coffee','portrait-coffee-atl',
   'Specialty coffee pouring a new narrative in Atlanta''s historic West End.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,38,15,'admin',now()),

  ('00a00001-0000-0000-0000-000000000059','Life Bistro Atlanta','life-bistro-atl',
   'Fine-dining vegan soul food proving plants belong at the very top of the table.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,27,10,'admin',now()),

  ('00a00001-0000-0000-0000-000000000060','Wadada Healthy Market','wadada-healthy-market',
   'Atlanta''s first Black woman-owned vegan market — 90% Black-sourced and full of love.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000061','Endulge Cupcake Boutique','endulge-cupcake-boutique',
   'All-natural, organic cupcakes baked to perfection in East Atlanta since 2012.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,18,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000062','Paschal''s Restaurant & Bar','paschals-restaurant-atl',
   'The legendary soul of Atlanta, feeding the movement since 1947.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,52,23,'admin',now()),

  ('00a00001-0000-0000-0000-000000000063','K&K Soul Food','kk-soul-food-atl',
   'Over 55 years of Bankhead soul food — a true Atlanta West Side institution.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,26,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000064','Red Rice Restaurant & Catering','red-rice-restaurant-atl',
   'Family soul food and catering from the heart of East Atlanta Village.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000065','The Real Milk & Honey','real-milk-and-honey-atl',
   'Over-the-top brunch in the heart of historic College Park.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,29,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000066','Johnny''s Chicken & Waffles','johnnys-chicken-waffles-atl',
   'Celebrity-backed Southern comfort food where waffles meet the moment.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000067','Dat Fire Jerk Chicken','dat-fire-jerk-chicken',
   'Castleberry Hill''s go-to for authentic Jamaican jerk done right.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()), -- VERIFY address and phone

  ('00a00001-0000-0000-0000-000000000068','Mangos on Auburn','mangos-on-auburn',
   'Caribbean flavors on historic Auburn Avenue — saltfish, oxtails, curry goat.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()), -- VERIFY ownership and status

  -- HAIR SALONS (069–072)
  ('00a00001-0000-0000-0000-000000000069','Huetiful Salon','huetiful-salon-atl',
   'Atlanta''s textured hair authority, where healthy hair science meets expert artistry.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,33,13,'admin',now()),

  ('00a00001-0000-0000-0000-000000000070','Like The River Salon','like-the-river-salon',
   'Voted Top 100 in America — where textured hair is understood and celebrated.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,28,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000071','Travis Dowdy Salon','travis-dowdy-salon',
   'Thirty years of beauty expertise delivered with care on Edgewood Avenue.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000072','Scales Studios Atlanta','scales-studios-atl',
   'Luxury natural hair care for the modern, style-conscious Atlanta woman.',
   'business',(SELECT id FROM categories WHERE slug='hair-salons'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  -- NAIL & SPA (073–076)
  ('00a00001-0000-0000-0000-000000000073','D''Lor Salon & Spa','dlor-salon-spa-atl',
   'Buckhead-level luxury in Southwest Atlanta — serving the community since 2005.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000074','Nail Favor Salon & Spa','nail-favor-salon-atl',
   'Buckhead''s premier nail destination — 25+ years of immaculate, trusted service.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,17,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000075','Tu La 2 Nail Salon','tu-la-2-nail-salon',
   'Woman-owned, Atlanta-grown nail care with wellness built into every service.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000076','iwi fresh Garden Day Spa','iwi-fresh-garden-spa',
   'Farm-to-skin spa treatments handcrafted from fresh herbs, botanicals, and love.',
   'business',(SELECT id FROM categories WHERE slug='nail-salons-spas'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()), -- VERIFY current primary location

  -- BEAUTY / SKINCARE (077)
  ('00a00001-0000-0000-0000-000000000077','Morgan Rackley Skincare','morgan-rackley-skincare',
   'Results-driven corrective skincare from Atlanta''s most trusted medical esthetician.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()), -- VERIFY Black-owned status

  -- BARBERSHOPS (078–081)
  ('00a00001-0000-0000-0000-000000000078','Off the Hook Barber Shop','off-the-hook-barbershop',
   'Downtown Atlanta''s trusted neighborhood cut since 1998 — walk-ins always welcome.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,13,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000079','Trophy Room Barber Shop','trophy-room-barbershop',
   'Kirkwood''s neighborhood barbershop — community first, precision always.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()), -- VERIFY Black-owned status

  ('00a00001-0000-0000-0000-000000000080','Taper''s Barber Shop','tapers-barbershop-marietta',
   'Family-friendly precision cuts in a welcoming Marietta atmosphere.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000081','Anytime Cutz','anytime-cutz-atl',
   'The South''s original 24-hour barbershop — a fresh cut any hour you need it.',
   'business',(SELECT id FROM categories WHERE slug='barber-shops'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()), -- VERIFY Black-owned status

  -- FASHION & RETAIL (082–086)
  ('00a00001-0000-0000-0000-000000000082','Afrocentric Network','afrocentric-network-atl',
   'Authentic African-inspired style and culture rooted in 30 years of West End history.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000083','TAGS Boutique Atlanta','tags-boutique-atl',
   'Kandi Burruss''s Luxury for Less — high fashion at prices that actually make sense.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000084','Pink Sky Boutique','pink-sky-boutique-atl',
   'Women''s fashion rooted in Atlanta style — chic, colorful, and unapologetically you.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000085','Bombchel Factory','bombchel-factory-atl',
   'West African prints handmade by women in Liberia, worn with global pride in Atlanta.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000086','God Is Dope Atlanta','god-is-dope-atl',
   'God''s favorite brand — faith-based streetwear with a message that moves.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,21,8,'admin',now()),

  -- RETAIL / BOOKS / GIFTS (087–090)
  ('00a00001-0000-0000-0000-000000000087','44th & 3rd Bookseller','44th-and-3rd-bookseller',
   'A family-run literary anchor in Atlanta''s West End celebrating Black voices.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,17,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000088','Moods Music Atlanta','moods-music-atl',
   'Little Five Points'' vinyl heaven — jazz, soul, house, and the world on wax.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,20,8,'admin',now()), -- VERIFY Black-owned status

  ('00a00001-0000-0000-0000-000000000089','Young Blood Boutique','young-blood-boutique-atl',
   'Independent design and gift shop full of jewelry, ceramics, and beautiful finds.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()), -- VERIFY Black-owned status

  ('00a00001-0000-0000-0000-000000000090','Shrine of the Black Madonna','shrine-black-madonna-atl',
   'Over 50 years of Black literature, culture, and community in Atlanta''s West End.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,18,7,'admin',now()), -- VERIFY operating status

  -- WELLNESS / YOGA / FITNESS (091–096)
  ('00a00001-0000-0000-0000-000000000091','Stretch ATL Pilates','stretch-atl-pilates',
   'Atlanta''s first Black-owned Pilates studio, building strength and flexibility since 2013.',
   'business',(SELECT id FROM categories WHERE slug='yoga-pilates'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,25,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000092','Sati Yoga & Wellness','sati-yoga-wellness-atl',
   'Trauma-informed yoga in Kirkwood that restores mind, body, and spirit.',
   'business',(SELECT id FROM categories WHERE slug='yoga-pilates'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000093','Vibe Ride Atlanta','vibe-ride-atl',
   'Immersive indoor cycling powered by hip-hop, lights, and serious community energy.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000094','The Loft Athletic Club','loft-athletic-club-atl',
   'Downtown Atlanta''s most creative fitness studio — from Trap Yoga to cryotherapy.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000095','Center for Black Women''s Wellness','center-black-womens-wellness',
   'Empowering Black women toward physical, mental, and economic wholeness since 1992.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000096','Deeply Rooted Wellness + Yoga','deeply-rooted-wellness-yoga',
   'Personalized in-home yoga, nutrition, and herbal wellness — Atlanta and beyond.',
   'business',(SELECT id FROM categories WHERE slug='yoga-pilates'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,10,3,'admin',now()),

  -- MENTAL HEALTH (097)
  ('00a00001-0000-0000-0000-000000000097','A Healing Paradigm','a-healing-paradigm-atl',
   'Culturally grounded psychological care for Black individuals and families.',
   'business',(SELECT id FROM categories WHERE slug='mental-health-therapy'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()),

  -- EVENTS / COMMUNITY (098)
  ('00a00001-0000-0000-0000-000000000098','The Gathering Spot Atlanta','gathering-spot-atl',
   'The largest Black-owned private membership community in the United States.',
   'business',(SELECT id FROM categories WHERE slug='events-entertainment'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,45,17,'admin',now()),

  -- ARTS & CULTURE (099–100)
  ('00a00001-0000-0000-0000-000000000099','ADAMA Museum Atlanta','adama-museum-atl',
   'Fusing art, technology, and culture to honor and elevate the global Black experience.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000100','Hammonds House Museum','hammonds-house-museum',
   'Atlanta''s finest African American fine art museum — 300+ works, one historic home.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,9,'admin',now()), -- VERIFY visiting hours given building repairs

  -- LEGAL & FINANCIAL (101–104)
  ('00a00001-0000-0000-0000-000000000101','The Cochran Firm Atlanta','cochran-firm-atl',
   'Atlanta''s premier personal injury and civil rights law firm.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000102','The Black Firm LLC','the-black-firm-llc',
   'Business, estate, and personal injury law for everyday people.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000103','Hamilton Wealth Advisors','hamilton-wealth-advisors',
   'Multigenerational wealth management rooted in faith and proven strategy.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000104','T. Dallas Smith & Company','t-dallas-smith-company',
   'The largest Black-owned commercial real estate tenant rep firm in America.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,10,3,'admin',now()),

  -- ACCOUNTING / TAX (105–106)
  ('00a00001-0000-0000-0000-000000000105','The Winston CPA Group','winston-cpa-group-atl',
   'Black-owned, women-led CPA firm serving entrepreneurs and athletes worldwide.',
   'business',(SELECT id FROM categories WHERE slug='accounting-tax-preparation'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000106','Banks Finley White & Company','banks-finley-white-cpa',
   'One of America''s largest and most trusted Black-owned CPA firms since 1947.',
   'business',(SELECT id FROM categories WHERE slug='accounting-tax-preparation'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  -- INSURANCE (107–108)
  ('00a00001-0000-0000-0000-000000000107','Atlanta Life Insurance Company','atlanta-life-insurance',
   'America''s only Black-founded insurance company, still standing since 1905.',
   'business',(SELECT id FROM categories WHERE slug='insurance'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,24,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000108','Black Maple Insurance','black-maple-insurance-atl',
   'Atlanta-rooted, Black-owned coverage for life, business, and beyond.',
   'business',(SELECT id FROM categories WHERE slug='insurance'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,6,1,'admin',now()),

  -- REAL ESTATE (109–112)
  ('00a00001-0000-0000-0000-000000000109','Strive Realty Group Atlanta','strive-realty-group-atl',
   'Faith-driven, female-led real estate transforming Atlanta''s West Side.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000110','Conley Realty Group','conley-realty-group-atl',
   'Full-spectrum real estate brokerage, management, and development.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000111','H.J. Russell & Company','hj-russell-company-atl',
   'Building Atlanta''s skyline and community for more than 70 years.',
   'business',(SELECT id FROM categories WHERE slug='construction-trades'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,18,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000112','Atlanta Premises Partner','atlanta-premises-partner',
   'Black-owned property management built for Atlanta landlords.',
   'business',(SELECT id FROM categories WHERE slug='real-estate'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,5,1,'admin',now()), -- VERIFY Black-owned status

  -- CONSTRUCTION (113–114)
  ('00a00001-0000-0000-0000-000000000113','C.D. Moody Construction','cd-moody-construction',
   'Award-winning minority general contractor behind Atlanta''s most iconic landmarks.',
   'business',(SELECT id FROM categories WHERE slug='construction-trades'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000114','The Construction Kings ATL','construction-kings-atl',
   'Atlanta''s go-to team for renovation, rehab, and real estate transformation.',
   'business',(SELECT id FROM categories WHERE slug='construction-trades'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()), -- VERIFY address

  -- TECHNOLOGY (115–116)
  ('00a00001-0000-0000-0000-000000000115','Kahnputers LLC','kahnputers-llc',
   'Custom software that builds businesses — from idea to launch, fast.',
   'business',(SELECT id FROM categories WHERE slug='technology'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000116','Collab Capital','collab-capital-atl',
   'The Black-led VC firm investing in the founders building tomorrow.',
   'business',(SELECT id FROM categories WHERE slug='technology'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,21,6,'admin',now()),

  -- EDUCATION & TUTORING (117–119)
  ('00a00001-0000-0000-0000-000000000117','Bright Futures Academy Atlanta','bright-futures-academy-atl',
   'Free, rigorous education for Atlanta''s West Side youth, grades 5–12.',
   'business',(SELECT id FROM categories WHERE slug='education-tutoring'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000118','Russell Innovation Center for Entrepreneurs','russell-innovation-center-atl',
   'America''s largest center empowering Black entrepreneurs to build and grow.',
   'business',(SELECT id FROM categories WHERE slug='education-tutoring'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000119','100 Black Men of Atlanta','100-black-men-atlanta',
   'Mentoring Atlanta''s Black youth toward academic excellence since 1986.',
   'business',(SELECT id FROM categories WHERE slug='education-tutoring'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  -- CHILDCARE & FAMILY (120–122)
  ('00a00001-0000-0000-0000-000000000120','Little Leaders Academy of the Arts','little-leaders-academy-atl',
   'Arts-infused early childhood learning for Atlanta''s little ones.',
   'business',(SELECT id FROM categories WHERE slug='childcare-family'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000121','BCDI-Atlanta','bcdi-atlanta',
   'Championing early childhood education and family wellness for Black children.',
   'business',(SELECT id FROM categories WHERE slug='childcare-family'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000122','Sheltering Arms Early Education','sheltering-arms-atl',
   'Quality early education and family support across metro Atlanta since 1888.',
   'business',(SELECT id FROM categories WHERE slug='childcare-family'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  -- PHOTOGRAPHY & VIDEOGRAPHY (123–126)
  ('00a00001-0000-0000-0000-000000000123','Belle Rouge Photography','belle-rouge-photography-atl',
   'Brand photography and videography for entrepreneurs who mean business.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000124','The Haus of Grey','haus-of-grey-atl',
   'Wedding and event photography for couples whose love deserves a legacy.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000125','Black Visionary Studio','black-visionary-studio-atl',
   'Portrait photography and film that celebrates Black life in full color.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000126','Visionaire Production Studios','visionaire-production-studios',
   'Full-service content production studio in Atlanta''s southwest corridor.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()), -- VERIFY Black-owned status

  -- MUSIC & RECORDING (127–129)
  ('00a00001-0000-0000-0000-000000000127','Patchwerk Recording Studios','patchwerk-recording-studios',
   '30 years at the center of Atlanta''s hip-hop sound — the spaceship of ATL.',
   'business',(SELECT id FROM categories WHERE slug='music-recording'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,39,16,'admin',now()),

  ('00a00001-0000-0000-0000-000000000128','WAMM Studios Atlanta','wamm-studios-atl',
   'Atlanta''s only glow-in-the-dark recording studio, built for serious artists.',
   'business',(SELECT id FROM categories WHERE slug='music-recording'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()), -- VERIFY Black-owned status

  ('00a00001-0000-0000-0000-000000000129','Atlanta Sound Studios','atlanta-sound-studios',
   'Professional music production for Atlanta''s independent artists.',
   'business',(SELECT id FROM categories WHERE slug='music-recording'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,6,2,'admin',now()), -- VERIFY Black-owned status

  -- CATERING & EVENTS FOOD (130–133)
  ('00a00001-0000-0000-0000-000000000130','Seared Pink Catering','seared-pink-catering',
   'Chef-curated, woman-owned catering for Atlanta''s finest corporate events.',
   'business',(SELECT id FROM categories WHERE slug='catering-events-food'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000131','SW Austin Caters','sw-austin-caters',
   'Custom menus, unforgettable events — Black-owned catering done right.',
   'business',(SELECT id FROM categories WHERE slug='catering-events-food'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000132','Amaala''s Delightful Kitchen','amaalas-delightful-kitchen',
   'Caribbean soul food catering that brings island flavor to Atlanta events.',
   'business',(SELECT id FROM categories WHERE slug='catering-events-food'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000133','Dr. Shell''s Soul Food','dr-shells-soul-food',
   '30+ years of soul food mastery, now available for your next event.',
   'business',(SELECT id FROM categories WHERE slug='catering-events-food'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  -- HEALTHCARE (134–137)
  ('00a00001-0000-0000-0000-000000000134','Art of Aesthetics Dental Studio','art-of-aesthetics-dental',
   'Celebrity smiles and inclusive oral care from Atlanta''s youngest Black dentist.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000135','Midtown Dental Center Atlanta','midtown-dental-center-atl',
   'Quality dental care in the heart of Atlanta''s Midtown.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,10,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000136','Sylvain Eye Care','sylvain-eye-care-atl',
   'Black-owned optometry built on expertise, warmth, and inclusive eye care.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000137','Metro Atlanta Injury & Wellness Center','metro-atl-injury-wellness',
   'Black-owned chiropractic and trauma care for South Atlanta families.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  -- PROFESSIONAL SERVICES (138–141)
  ('00a00001-0000-0000-0000-000000000138','TGND Consulting','tgnd-consulting-atl',
   'Black-owned PR and brand strategy for mompreneurs and lifestyle brands.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000139','Qtalent Solutions','qtalent-solutions-atl',
   'Black woman–owned staffing and HR consulting built for modern businesses.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,6,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000140','XEC Solutions Atlanta','xec-solutions-atl',
   'Atlanta''s Black-owned talent strategy and HR consultancy.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,5,1,'admin',now()), -- VERIFY website

  ('00a00001-0000-0000-0000-000000000141','Black Girl Group Atlanta','black-girl-group-atl',
   'Connecting Black women to freelance and full-time creative roles at top brands.',
   'business',(SELECT id FROM categories WHERE slug='professional-services'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'online','published','free','unclaimed',false,14,4,'admin',now()),

  -- NONPROFITS & COMMUNITY (142–144)
  ('00a00001-0000-0000-0000-000000000142','Urban League of Greater Atlanta','urban-league-greater-atl',
   'Empowering Black Atlanta through economic equity, education, and opportunity.',
   'business',(SELECT id FROM categories WHERE slug='nonprofits-community-orgs'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000143','Atlanta Black Chambers','atlanta-black-chambers',
   'Building brilliant Black businesses across Atlanta since 2005.',
   'business',(SELECT id FROM categories WHERE slug='nonprofits-community-orgs'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000144','Advancing Black Businesses Inc','advancing-black-businesses',
   'Policy advocacy and small business recovery for Black entrepreneurs in Georgia.',
   'business',(SELECT id FROM categories WHERE slug='nonprofits-community-orgs'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  -- AUTOMOTIVE (145–146)
  ('00a00001-0000-0000-0000-000000000145','Wade Ford Smyrna','wade-ford-smyrna',
   'Atlanta''s oldest Ford dealership, proudly Black-owned since 2002.',
   'business',(SELECT id FROM categories WHERE slug='automotive'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,16,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000146','Parker''s Auto Detailing ATL','parkers-auto-detailing-atl',
   'Premium mobile car detailing — we come to you, anywhere in Atlanta.',
   'business',(SELECT id FROM categories WHERE slug='automotive'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  -- ARTS & CULTURE (147–150)
  ('00a00001-0000-0000-0000-000000000147','Ballethnic Dance Company','ballethnic-dance-company',
   'Atlanta''s first African American–founded professional ballet company.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,31,12,'admin',now()),

  ('00a00001-0000-0000-0000-000000000148','National Black Arts Festival','national-black-arts-festival',
   'Year-round Black arts experiences rooted in Atlanta since 1988.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000149','T. Lang Dance Inc','t-lang-dance-atl',
   'Poetic movement that investigates identity, history, and community.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000150','Black Art In America Gallery','black-art-in-america-atl',
   'Documenting, preserving, and promoting African American art since 2010.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now())

ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- HOUSTON, TX — 29 NEW LISTINGS (021–049)
-- ===========================================================================

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

-- ===========================================================================
-- CHICAGO, IL — 30 NEW LISTINGS (021–050)
-- ===========================================================================

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


-- ===========================================================================
-- LISTING DETAILS — ATLANTA, GA (041–080)
-- ===========================================================================

INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES

  ('00a00001-0000-0000-0000-000000000041',
   'Celebrity brunch restaurant founded by stylist Gocha Hawkins, known for indulgent plate presentations, Bottomless Bloody Marys, and a loyal following from Atlanta''s entertainment and sports circles.',
   '230 Mitchell St SW','Atlanta','GA','30303',
   NULL,'https://gochasbreakfastbar.com',NULL,
   'book','https://gochasbreakfastbar.com','$$',2015),

  ('00a00001-0000-0000-0000-000000000042',
   'Caribbean-inspired small plates and craft cocktails in a Buckhead loft setting with curated playlists. An intimate evening spot where island flavors meet Atlanta sophistication.',
   '1198 Howell Mill Rd NW','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000043',
   'Afro-Caribbean comfort food with bold seasonings and late-night energy in East DeKalb. Oxtails, curry goat, and jerk chicken prepared with serious island technique.',
   '3890 Covington Hwy','Decatur','GA','30032',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000044',
   'Viral Black-owned sandwich shop that blew up on social media with towering, ingredient-packed creations. Now a staple for Atlanta sandwich lovers who appreciate generous, no-compromise portions.',
   '250 18th St NW','Atlanta','GA','30363',
   NULL,'https://zaddyssammiches.com',NULL,
   'visit','https://zaddyssammiches.com','$$',2020),

  ('00a00001-0000-0000-0000-000000000045',
   'Elevated New Southern restaurant on Buford Highway serving comfort food in an upscale setting with a full bar and handcrafted cocktails. Date night done with serious intention.',
   '5600 Buford Hwy NE','Doraville','GA','30340',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000046',
   'Black woman-owned New American Soul restaurant in Southwest Atlanta serving innovative takes on classic comfort food. Known for creative plate presentations and a menu that surprises every visit.',
   '786 Cascade Ave SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000047',
   'All-day brunch and dinner destination near Midtown serving soulful American classics in a lively, welcoming atmosphere. Known for weekend crowds and family-friendly Southern hospitality.',
   '860 Peachtree St NE','Atlanta','GA','30308',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000048',
   'Upscale East Atlanta dining experience offering refined Southern plates, inventive cocktails, and an atmosphere that elevates the soul food tradition to a full evening occasion.',
   '413 East Lake Dr','Decatur','GA','30030',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000049',
   'Rooftop beer hall atop Ponce City Market offering craft brews, Southern food, and some of Atlanta''s most celebrated skyline views. One of the city''s most beloved outdoor dining destinations.',
   '675 Ponce De Leon Ave NE','Atlanta','GA','30308',
   NULL,'https://9milestation.com',NULL,
   'visit','https://9milestation.com','$$',2016),

  ('00a00001-0000-0000-0000-000000000050',
   'All-day breakfast destination near Hartsfield-Jackson Airport serving generous Southern plates at honest prices. A neighborhood go-to for locals and airport-area visitors alike.',
   '3590 Camp Creek Pkwy','College Park','GA','30337',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00a00001-0000-0000-0000-000000000051',
   'Creole-Cajun restaurant in historic downtown College Park serving bold, authentic Louisiana-inspired dishes in an intimate neighborhood setting that keeps regulars coming back weekly.',
   '3606 Main Street','College Park','GA','30337',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000052',
   'A historic West End soul food institution serving hearty, home-style Southern plates to Atlanta families since 1993. Daily specials, consistent quality, and a warm welcome every time.',
   '1429 West End Ave SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$',1993),

  ('00a00001-0000-0000-0000-000000000053',
   'Contemporary Caribbean restaurant in Decatur known for jerk chicken, curried shrimp, and inventive cocktails. A reliable destination for island cuisine lovers in metro Atlanta.',
   '186 W Ponce de Leon Ave','Decatur','GA','30030',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000054',
   'Trinidadian and Jamaican restaurant serving doubles, roti, and jerk specialties with an emphasis on community gathering and group hospitality rooted in Caribbean tradition.',
   '720 Ralph David Abernathy Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000055',
   'Over five decades of fried fish, shrimp, and West Side soul food tradition at this legendary Bankhead corridor institution. A community anchor that has fed generations of Atlantans.',
   '1170 Donald Lee Hollowell Pkwy NW','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'visit',NULL,'$',1973),

  ('00a00001-0000-0000-0000-000000000056',
   'Community-focused restaurant and bar backed by Atlanta rap icon T.I., bringing Southern comfort food, cocktails, and trap culture together in a welcoming Westside gathering space.',
   '306 Joseph E. Lowery Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000057',
   'Fast-casual plant-based restaurant making nutritious vegan meals affordable and accessible across Atlanta locations. A pioneer in bringing healthy eating to communities that deserve it.',
   '735 Ponce De Leon Ave NE','Atlanta','GA','30306',
   NULL,'https://localgreen.com',NULL,
   'visit','https://localgreen.com','$',2016),

  ('00a00001-0000-0000-0000-000000000058',
   'Specialty coffee shop in Atlanta''s West End sourcing ethically traded beans and weaving intentional storytelling into every aspect of the brand. A cornerstone of West End''s cultural revival since 2019.',
   '1065 Ralph David Abernathy Blvd SW Ste A','Atlanta','GA','30310',
   '(833) 553-0420','https://portrait.coffee','https://instagram.com/portraitcoffee',
   'visit','https://portrait.coffee','$',2019),

  ('00a00001-0000-0000-0000-000000000059',
   'Upscale vegan soul food restaurant in Atlanta''s West End serving beautifully plated plant-based interpretations of Southern classics in an elegant dining room setting.',
   '1002 Ralph David Abernathy Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000060',
   'Atlanta''s first Black woman-owned vegan grocery market stocking 90% Black-sourced products alongside fresh produce, natural supplements, and prepared plant-based foods.',
   '540 Joseph E. Lowery Blvd NW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',2020),

  ('00a00001-0000-0000-0000-000000000061',
   'All-natural, organic cupcake boutique in East Atlanta Village offering scratch-made confections in rotating seasonal flavors. Custom event orders available from this beloved neighborhood gem.',
   '494 Flat Shoals Ave SE','Atlanta','GA','30316',
   NULL,NULL,NULL,
   'visit',NULL,'$',2012),

  ('00a00001-0000-0000-0000-000000000062',
   'One of the most historic restaurants in Black America, feeding Atlanta''s civil rights leaders, celebrities, and community since 1947. Revived in Castleberry Hill with classic soul food and a full bar.',
   '180 Northside Dr SW','Atlanta','GA','30313',
   '(404) 835-0833','https://paschalsatlanta.com',NULL,
   'visit','https://paschalsatlanta.com','$$',1947),

  ('00a00001-0000-0000-0000-000000000063',
   'A Bankhead West Side institution feeding Atlanta''s community with hearty soul food plates for over 55 years. Daily hot bar, fried fish Fridays, and a legacy the neighborhood holds dear.',
   '881 Donald Lee Hollowell Pkwy NW','Atlanta','GA','30318',
   '(404) 685-1073',NULL,NULL,
   'visit',NULL,'$',1968),

  ('00a00001-0000-0000-0000-000000000064',
   'Family-owned restaurant and catering operation in East Atlanta Village serving West African-inspired soul food including signature red rice, stews, and rotating daily specials.',
   '1181 Glenwood Ave SE','Atlanta','GA','30316',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000065',
   'Over-the-top brunch destination in College Park known for extreme stack pancakes, loaded omelets, and a Bloody Mary bar that draws weekend crowds from across metro Atlanta.',
   '4305 Butner Rd','College Park','GA','30349',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000066',
   'Celebrity-backed Southern comfort restaurant serving the classic chicken-and-waffles combination with an upscale twist. A lively atmosphere and crowd-pleasing menu that makes every meal an event.',
   '2670 E Ponce De Leon Ave','Decatur','GA','30030',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000067',
   'Authentic Jamaican jerk chicken restaurant in Castleberry Hill known for wood-fired preparation, handcrafted seasoning blends, and island sides done the traditional way.',
   '480 Mangum St SW','Atlanta','GA','30313',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000068',
   'Caribbean restaurant on historic Auburn Avenue serving saltfish, oxtails, curry goat, and island sides in a vibrant, culturally rich setting steps from Sweet Auburn.',
   '179 Auburn Ave NE','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000069',
   'Atlanta''s premier natural and textured hair salon known for innovative hair health treatments, silk presses, and curl care for every texture. A trusted destination for healthy hair science.',
   '7 Lenox Pointe NE','Atlanta','GA','30324',
   NULL,'https://huetiful.com',NULL,
   'book','https://huetiful.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000070',
   'Award-winning natural hair salon ranked among America''s Top 100, specializing in healthy hair education, textured styling, and personalized curl care for the modern Atlanta client.',
   '634 N Highland Ave NE','Atlanta','GA','30306',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000071',
   'Three decades of beauty excellence offering precision cuts, color, and styling services in a warm, professional environment on Edgewood Avenue. A trusted Atlanta name since the 1990s.',
   '620 Edgewood Ave SE','Atlanta','GA','30312',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000072',
   'Upscale natural hair care studio offering luxury extension work, protective styling, and hair wellness treatments tailored to the modern Atlanta woman''s lifestyle.',
   '1715 Howell Mill Rd NW','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000073',
   'Full-service salon and spa in Southwest Atlanta offering haircare, nail services, and spa treatments at premium quality with community-accessible pricing and genuine Southern hospitality.',
   '2970 Campbellton Rd SW','Atlanta','GA','30311',
   NULL,NULL,NULL,
   'book',NULL,'$$',2005),

  ('00a00001-0000-0000-0000-000000000074',
   'Buckhead''s premier Black-owned nail and spa destination offering meticulously applied nail artistry, pedicures, and spa services with 25 years of loyal clientele and consistent excellence.',
   '2956 Peachtree Rd NW','Atlanta','GA','30305',
   NULL,NULL,NULL,
   'book',NULL,'$$$',1999),

  ('00a00001-0000-0000-0000-000000000075',
   'Black woman-owned nail salon dedicated to nail health, precision artistry, and an elevated wellness-centered salon experience for Atlanta clients who treat their nails as a priority.',
   '2550 Piedmont Rd NE','Atlanta','GA','30324',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000076',
   'Farm-to-skin day spa crafting treatments from fresh-grown herbs and botanicals, offering a holistic beauty experience rooted in natural wellness and sustainable, community-connected sourcing.',
   '95 Lower Alabama St SW','Atlanta','GA','30303',
   NULL,'https://iwifresh.com',NULL,
   'book','https://iwifresh.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000077',
   'Medical esthetician-founded corrective skincare studio offering advanced facial treatments, chemical peels, and personalized skin health programs built for lasting, visible results.',
   '1400 Northside Dr NW Suite 100','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000078',
   'A downtown Atlanta barbershop tradition since 1998, known for walk-in availability, precise cuts, and a community atmosphere that keeps generations of clients returning.',
   '155 Trinity Ave SW','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'visit',NULL,'$',1998),

  ('00a00001-0000-0000-0000-000000000079',
   'Neighborhood barbershop in Atlanta''s Kirkwood community offering fade expertise, beard grooming, and a welcoming atmosphere that doubles as a genuine community gathering space.',
   '1999 Memorial Dr SE','Atlanta','GA','30317',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00a00001-0000-0000-0000-000000000080',
   'Family-friendly barbershop in Marietta delivering precision tapers, fades, and kids'' cuts in a relaxed and welcoming environment for the whole family.',
   '1540 Roswell Rd','Marietta','GA','30062',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

-- ===========================================================================
-- LISTING DETAILS — ATLANTA, GA (081–150)
-- ===========================================================================
INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES

  ('00a00001-0000-0000-0000-000000000081',
   'The South''s original 24-hour Black-owned barbershop offering precision cuts around the clock for Atlanta clients whose schedules refuse to conform to standard business hours.',
   '1770 Continental Colony Pkwy NW','Atlanta','GA','30331',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00a00001-0000-0000-0000-000000000082',
   'West End Atlanta boutique celebrating African heritage through authentic fabrics, handmade accessories, African art, and cultural products representing the African diaspora for over 30 years.',
   '1166 Ralph David Abernathy Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000083',
   'Celebrity-owned fashion boutique founded by Kandi Burruss offering designer looks and runway styles at accessible price points. Luxury for less at multiple Atlanta-area locations.',
   '2451 Cumberland Pkwy SE','Atlanta','GA','30339',
   NULL,'https://tagsboutique.com',NULL,
   'visit','https://tagsboutique.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000084',
   'Women''s fashion boutique celebrating Atlanta style with a curated selection of contemporary clothing, accessories, and shoes that blend color, confidence, and cultural flair.',
   '2389 Lawrenceville Hwy','Decatur','GA','30033',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000085',
   'Fashion brand producing West African-print garments handmade by women artisans in Liberia, combining cultural storytelling with modern silhouettes sold globally out of Atlanta.',
   '585 Dutch Valley Rd NE','Atlanta','GA','30324',
   NULL,'https://bombchelfactory.com',NULL,
   'visit','https://bombchelfactory.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000086',
   'Faith-based streetwear brand creating apparel and accessories with messages of purpose and spiritual grounding. Based in Atlanta with a loyal national following and a flagship retail presence.',
   '3280 Peachtree Rd NE Suite 100','Atlanta','GA','30305',
   NULL,'https://godisdope.com',NULL,
   'shop','https://godisdope.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000087',
   'Black-owned independent bookstore in Atlanta''s West End celebrating African American literature, local authors, and literary community through curated selections and regular events.',
   '1254 West End Ave SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00a00001-0000-0000-0000-000000000088',
   'Little Five Points music institution offering thousands of vinyl records spanning jazz, soul, R&B, hip-hop, house, and world music for collectors and casual listeners alike.',
   '1716 N Decatur Rd NE','Atlanta','GA','30307',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000089',
   'Independent gallery and boutique in Little Five Points featuring handmade jewelry, ceramics, art prints, and gifts from local designers and artisans celebrating Atlanta''s creative community.',
   '636 N Highland Ave NE','Atlanta','GA','30306',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000090',
   'West End Atlanta institution offering over 50 years of African American books, cultural artifacts, Afrocentric gifts, and community programming rooted in Pan-African heritage and history.',
   '946 Ralph David Abernathy Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'visit',NULL,'$$',1967),

  ('00a00001-0000-0000-0000-000000000091',
   'Atlanta''s first Black-owned Pilates studio, founded in 2013 and offering reformer classes, mat Pilates, and strength training in a supportive, community-centered environment on the Northside.',
   '4400 Roswell Rd NE Ste 100','Atlanta','GA','30342',
   NULL,'https://stretchatl.com',NULL,
   'book','https://stretchatl.com','$$',2013),

  ('00a00001-0000-0000-0000-000000000092',
   'Trauma-informed yoga studio in Kirkwood offering a safe and restorative practice space specifically designed to support Black wellness, emotional healing, and community restoration.',
   '2059 Memorial Dr SE','Atlanta','GA','30317',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000093',
   'Immersive indoor cycling studio in Atlanta''s Westside bringing together hip-hop music, dynamic lighting, and high-energy community classes for a truly unique fitness experience.',
   '1099 Hemphill Ave NW','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000094',
   'Downtown Atlanta''s most inventive fitness studio offering a rotating menu including Trap Yoga, cryotherapy, aerial arts, and boxing inside a beautifully converted urban loft space.',
   '236 Mitchell St SW','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000095',
   'Nonprofit wellness organization serving Atlanta''s Black women through health education, fitness programs, mental health resources, and economic empowerment initiatives since 1992.',
   '477 Windsor St SW','Atlanta','GA','30312',
   NULL,'https://cbww.org',NULL,
   'visit','https://cbww.org',NULL,1992),

  ('00a00001-0000-0000-0000-000000000096',
   'Personalized in-home yoga instruction, plant-based nutrition coaching, and herbal wellness consultations available across Metro Atlanta and virtually for clients nationwide.',
   '1001 Ralph David Abernathy Blvd SW','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000097',
   'Atlanta-based psychological practice offering culturally grounded therapy and counseling specifically tailored for Black individuals, couples, and families navigating identity, trauma, and modern life.',
   '1215 Hightower Trail NE','Atlanta','GA','30350',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000098',
   'The nation''s largest Black-owned private membership club, offering a vibrant coworking space, event venue, and community hub fostering connection, collaboration, and celebration among Black professionals.',
   '380 Marietta St NW','Atlanta','GA','30313',
   NULL,'https://thegatheringspot.club',NULL,
   'visit','https://thegatheringspot.club','$$$',2016),

  ('00a00001-0000-0000-0000-000000000099',
   'Immersive cultural institution using art, digital technology, and interactive experiences to honor, explore, and amplify the global African and African American cultural legacy.',
   '234 Ivan Allen Jr Blvd NW','Atlanta','GA','30313',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000100',
   'Atlanta''s premier African American fine art museum housed in the historic home of Dr. Otis Thrash Hammonds, featuring over 300 works by African American and African artists.',
   '503 Peeples St SW','Atlanta','GA','30310',
   '(404) 612-0450','https://hammondshouse.org',NULL,
   'visit','https://hammondshouse.org','$',1988),

  ('00a00001-0000-0000-0000-000000000101',
   'Atlanta affiliate of one of America''s most recognized personal injury and civil rights law firms, founded in the legacy of Johnnie Cochran and dedicated to fighting for client justice.',
   '100 Peachtree St NW Suite 2600','Atlanta','GA','30303',
   '(404) 222-9922','https://cochranfirm.com',NULL,
   'contact','https://cochranfirm.com',NULL,NULL),

  ('00a00001-0000-0000-0000-000000000102',
   'Black-owned full-service Atlanta law firm serving individuals and small businesses in personal injury, estate planning, business law, and civil litigation with accessible, community-focused counsel.',
   '191 Peachtree St NE Suite 3810','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000103',
   'Faith-driven financial advisory firm providing multigenerational wealth management, retirement planning, and investment strategy for Black families and entrepreneurs building long-term financial security.',
   '3379 Peachtree Rd NE Suite 555','Atlanta','GA','30326',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000104',
   'The largest Black-owned commercial real estate tenant representation firm in the United States, founded by T. Dallas Smith and operating out of Atlanta with national client reach.',
   '3715 Northside Pkwy NW Suite 100','Atlanta','GA','30327',
   NULL,'https://tdsco.com',NULL,
   'contact','https://tdsco.com',NULL,NULL),

  ('00a00001-0000-0000-0000-000000000105',
   'Black-owned, women-led certified public accounting firm specializing in tax strategy, business accounting, and financial coaching for professional athletes, entrepreneurs, and C-suite executives.',
   '3490 Piedmont Rd NE Suite 1200','Atlanta','GA','30305',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000106',
   'One of the largest Black-owned accounting and business advisory firms in the United States, providing audit, tax, and consulting services to public and private sector clients since 1947.',
   '50 Hurt Plaza SE Suite 900','Atlanta','GA','30303',
   NULL,'https://bfwcpa.com',NULL,
   'contact','https://bfwcpa.com',NULL,1947),

  ('00a00001-0000-0000-0000-000000000107',
   'The only Black-founded and continuously Black-led insurance company in American history, protecting families and building community wealth from Auburn Avenue since Alonzo Herndon founded it in 1905.',
   '100 Auburn Ave NE','Atlanta','GA','30303',
   NULL,'https://atlantalife.com',NULL,
   'contact','https://atlantalife.com',NULL,1905),

  ('00a00001-0000-0000-0000-000000000108',
   'Black-owned independent insurance agency serving Atlanta and Georgia clients with life, health, auto, and business coverage options tailored to individual needs and household budgets.',
   '1100 Peachtree St NE Suite 200','Atlanta','GA','30309',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000109',
   'Faith-driven, female-led boutique real estate brokerage focused on homeownership and investment in Atlanta''s West Side communities with a commitment to building Black generational wealth.',
   '1331 Northside Dr NW Suite 400','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000110',
   'Full-service Black-owned real estate brokerage providing residential buying, selling, property management, and development services across metro Atlanta with deep community roots.',
   '170 Mitchell St SW Suite 100','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000111',
   'Minority-owned construction and real estate development powerhouse responsible for Atlanta landmarks including the CNN Center, Georgia Dome, and Hartsfield-Jackson Airport concourses over seven decades.',
   '171 17th St NW Suite 1600','Atlanta','GA','30363',
   '(404) 330-1000','https://hjrussell.com',NULL,
   'contact','https://hjrussell.com',NULL,1952),

  ('00a00001-0000-0000-0000-000000000112',
   'Black-owned property management company offering comprehensive landlord services including tenant placement, maintenance coordination, and financial reporting for Atlanta investment properties.',
   '2970 Peachtree Rd NW Suite 200','Atlanta','GA','30305',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000113',
   'Award-winning minority-owned general contracting firm behind some of Atlanta''s most iconic projects including Mercedes-Benz Stadium, Hartsfield-Jackson, and Georgia State University''s development.',
   '6017 Redan Rd','Lithonia','GA','30058',
   '(770) 482-7778','https://cdmoodyconstruction.com',NULL,
   'contact','https://cdmoodyconstruction.com',NULL,1988),

  ('00a00001-0000-0000-0000-000000000114',
   'Black-owned Atlanta construction and renovation company specializing in residential remodels, real estate rehabs, and commercial build-outs across the metro Atlanta area.',
   '2000 Powers Ferry Rd SE Suite 350','Marietta','GA','30067',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000115',
   'Black-owned Atlanta technology firm offering custom software development, web application builds, and IT consulting for small businesses and entrepreneurs ready to scale.',
   '100 Auburn Ave NE Suite 200','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000116',
   'Atlanta-based Black-led early-stage venture capital fund investing in underestimated founders across technology, consumer, and enterprise sectors with a mission to close the racial wealth gap.',
   '100 Peachtree St NW Suite 2400','Atlanta','GA','30303',
   NULL,'https://collabcapital.vc',NULL,
   'visit','https://collabcapital.vc',NULL,2020),

  ('00a00001-0000-0000-0000-000000000117',
   'Free, rigorous college-preparatory school serving students in grades 5 through 12 on Atlanta''s West Side, with a mission to close the academic achievement gap and build generational opportunity.',
   '540 Kennesaw Ave NW','Atlanta','GA','30314',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000118',
   'America''s largest Black-founded innovation center for entrepreneurs, offering coworking space, accelerator programs, mentorship, and capital access in honor of H.J. Russell''s enduring legacy.',
   '504 Fair St SW','Atlanta','GA','30313',
   NULL,'https://russellcenter.org',NULL,
   'visit','https://russellcenter.org',NULL,2018),

  ('00a00001-0000-0000-0000-000000000119',
   'Atlanta chapter of the national organization mentoring thousands of Black youth through education, career development, health and wellness, and leadership programming since 1986.',
   '141 Auburn Ave NE','Atlanta','GA','30303',
   NULL,'https://100blackmenatlanta.org',NULL,
   'visit','https://100blackmenatlanta.org',NULL,1986),

  ('00a00001-0000-0000-0000-000000000120',
   'Arts-integrated early childhood education center in South Atlanta nurturing creativity and academic readiness for children from 6 weeks through 12 years in a loving, structured environment.',
   '2220 McDaniel St SW','Atlanta','GA','30315',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000121',
   'Black Child Development Institute-Atlanta chapter advancing early childhood education, family wellness, and policy advocacy to improve health and developmental outcomes for Black children across Georgia.',
   '730 Peachtree St NE Suite 395','Atlanta','GA','30308',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000122',
   'One of Atlanta''s largest and most historic early education and family services nonprofits, serving children and families across multiple metro locations with wrap-around support since 1888.',
   '1600 Marietta Blvd NW','Atlanta','GA','30318',
   NULL,'https://shelteringarms.com',NULL,
   'contact','https://shelteringarms.com',NULL,1888),

  ('00a00001-0000-0000-0000-000000000123',
   'Black woman-owned brand photography and videography studio specializing in personal branding sessions, product photography, and content creation for entrepreneurs and small businesses.',
   '1200 Foster St NW Suite 120','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000124',
   'Award-winning wedding and event photography studio celebrating diverse love stories with fine art imagery, editorial storytelling, and a commitment to honoring every couple''s unique narrative.',
   '680 Murphy Ave SW Suite 1142','Atlanta','GA','30310',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000125',
   'Black-owned portrait photography and film studio creating deeply intentional work that celebrates Black joy, culture, and identity with every frame and every client engagement.',
   '287 Peters St SW Suite 120','Atlanta','GA','30313',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000126',
   'Full-service video production studio offering commercial, music video, documentary, and branded content production services for Atlanta companies and independent creators.',
   '3495 Piedmont Rd NE Suite 120','Atlanta','GA','30305',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000127',
   'A legendary Atlanta recording studio that has served as the creative home for Outkast, Ludacris, T.I., Mariah Carey, and hundreds of other artists over three decades of Black music history.',
   '1094 Hemphill Ave NW','Atlanta','GA','30318',
   '(404) 874-9880','https://patchwerk.com',NULL,
   'book','https://patchwerk.com','$$$$',1993),

  ('00a00001-0000-0000-0000-000000000128',
   'Unique Atlanta recording studio known for its glow-in-the-dark recording environment, professional-grade equipment, and creative atmosphere built for independent artists who take their craft seriously.',
   '2345 Peachtree Rd NE Suite 150','Atlanta','GA','30305',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000129',
   'Professional recording and mixing studio in Metro Atlanta offering full-service music production, recording sessions, mixing, and mastering for independent artists at all career stages.',
   '1230 Peachtree St NE Suite 1900','Atlanta','GA','30309',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000130',
   'Black woman-owned chef-driven catering company specializing in elevated corporate event menus, private dinners, and special occasion catering with a personalized, culinary-first approach.',
   '3379 Peachtree Rd NE Suite 200','Atlanta','GA','30326',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000131',
   'Black-owned Atlanta catering company offering fully customized menus for corporate events, weddings, and private celebrations with bold flavors and impeccable presentation in every detail.',
   '2100 Defoor Hills Rd NW','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000132',
   'Black woman-owned Caribbean catering company bringing authentic island flavors — jerk chicken, rice and peas, plantains, and more — to Atlanta corporate and private events.',
   '1600 Howell Mill Rd NW Suite 200','Atlanta','GA','30318',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000133',
   'Three decades of Southern soul food mastery offered as a full-service catering operation for events, corporate functions, church gatherings, and special celebrations across Metro Atlanta.',
   '4570 Memorial Dr','Stone Mountain','GA','30083',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000134',
   'Black-owned cosmetic and general dentistry practice known for creating stunning smile transformations using the latest dental technology in a welcoming, inclusive, and judgment-free environment.',
   '565 Peachtree St NE Suite 1700','Atlanta','GA','30308',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000135',
   'Black-owned family dental practice in the heart of Midtown Atlanta offering comprehensive general and cosmetic dentistry services in a professional, patient-centered setting.',
   '1100 Peachtree St NE Suite 200','Atlanta','GA','30309',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000136',
   'Black-owned independent optometry practice providing comprehensive eye exams, contact lens fittings, and a curated selection of eyewear in a personalized clinical environment.',
   '1295 Hightower Trail NE Suite 100','Atlanta','GA','30350',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000137',
   'Black-owned chiropractic and wellness clinic in South Atlanta specializing in trauma care, auto accident rehabilitation, pain management, and whole-body recovery for families.',
   '3380 Panola Rd','Lithonia','GA','30038',
   NULL,NULL,NULL,
   'contact',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000138',
   'Black woman-owned public relations and brand strategy agency helping mompreneurs and lifestyle brands build authentic visibility, compelling media narratives, and sustainable audience growth.',
   '1100 Peachtree St NE Suite 600','Atlanta','GA','30309',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000139',
   'Black woman-owned HR consulting and staffing firm providing talent acquisition, organizational development, and people strategy services for modern businesses across industries.',
   '100 Galleria Pkwy SE Suite 1200','Atlanta','GA','30339',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000140',
   'Black-owned talent strategy and human resources consultancy offering executive search, organizational design, and leadership development for growing companies across Atlanta.',
   '3348 Peachtree Rd NE Suite 700','Atlanta','GA','30326',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000141',
   'Black woman-owned platform connecting Black women creatives and professionals to freelance projects, agency work, and full-time opportunities at top brands and agencies nationwide.',
   '675 Ponce De Leon Ave NE Suite 8500','Atlanta','GA','30308',
   NULL,'https://theblackgirlgroup.com',NULL,
   'visit','https://theblackgirlgroup.com',NULL,NULL),

  ('00a00001-0000-0000-0000-000000000142',
   'Atlanta affiliate of the National Urban League, empowering African American communities through economic advancement, job training, housing, education, and civic engagement programs.',
   '100 Edgewood Ave NE Suite 600','Atlanta','GA','30303',
   NULL,'https://urbanleagueatlanta.org',NULL,
   'visit','https://urbanleagueatlanta.org',NULL,NULL),

  ('00a00001-0000-0000-0000-000000000143',
   'Business membership organization supporting Black entrepreneurs across Atlanta through networking events, policy advocacy, educational programming, and small business resources since 2005.',
   '675 Ponce De Leon Ave NE Suite 8500','Atlanta','GA','30308',
   NULL,'https://atlantablackchambers.org',NULL,
   'visit','https://atlantablackchambers.org',NULL,2005),

  ('00a00001-0000-0000-0000-000000000144',
   'Georgia-based nonprofit focused on Black small business recovery, policy advocacy, and ecosystem building to create sustainable economic conditions for Black entrepreneurs across the state.',
   '191 Peachtree St NE Suite 3100','Atlanta','GA','30303',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000145',
   'The oldest Black-owned Ford dealership in metro Atlanta, serving the Smyrna and Cobb County community with new and pre-owned vehicles, service, and financing since 2002.',
   '3860 South Cobb Dr SE','Smyrna','GA','30080',
   '(770) 637-1707','https://wadeford.com',NULL,
   'visit','https://wadeford.com',NULL,2002),

  ('00a00001-0000-0000-0000-000000000146',
   'Black-owned mobile auto detailing service delivering premium interior and exterior detail work directly to clients'' homes and offices anywhere across metro Atlanta.',
   '3900 Crown Rd SW Suite 200','Atlanta','GA','30315',
   NULL,NULL,NULL,
   'contact',NULL,'$$',NULL),

  ('00a00001-0000-0000-0000-000000000147',
   'Atlanta''s only African American-founded professional ballet company, blending classical ballet technique with African American vernacular and spiritual traditions through world-class performances.',
   '2587 Ballethnic Way','East Point','GA','30344',
   '(404) 762-1416','https://ballethnic.org',NULL,
   'visit','https://ballethnic.org',NULL,1990),

  ('00a00001-0000-0000-0000-000000000148',
   'One of the nation''s most celebrated cultural events, the NBAF presents year-round theater, film, dance, music, and visual art celebrating African American creativity and culture since 1988.',
   '55 Ivan Allen Jr Blvd NW Suite 440','Atlanta','GA','30308',
   NULL,'https://nbaf.org',NULL,
   'visit','https://nbaf.org',NULL,1988),

  ('00a00001-0000-0000-0000-000000000149',
   'Atlanta contemporary dance company creating poetic movement works that investigate Black identity, historical memory, and the visceral experience of community belonging.',
   '687 Memorial Dr SE Suite 100','Atlanta','GA','30316',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00a00001-0000-0000-0000-000000000150',
   'Online and gallery platform documenting, preserving, and promoting African American visual art and artists, connecting collectors, galleries, and communities through exhibitions since 2010.',
   '100 Peachtree St NW Suite 1800','Atlanta','GA','30303',
   NULL,'https://blackartinamerica.com',NULL,
   'visit','https://blackartinamerica.com',NULL,2010)

ON CONFLICT (listing_id) DO NOTHING;

-- ===========================================================================
-- LISTING DETAILS — HOUSTON, TX (021–049) + CHICAGO, IL (021–050)
-- ===========================================================================
INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES

  ('00b00002-0000-0000-0000-000000000021',
   'Chef Dawn Burrell''s acclaimed fine dining restaurant celebrating Southern traditions elevated through globally-inspired technique and a seasonally driven menu. The culmination of a James Beard-nominated chef''s culinary vision.',
   '5559 Morningside Dr','Houston','TX','77005',
   NULL,'https://lateaugust.com',NULL,
   'book','https://lateaugust.com','$$$',2022),

  ('00b00002-0000-0000-0000-000000000022',
   'Authentic Jamaican restaurant in Houston''s Third Ward bringing traditional island dishes including oxtail, curry goat, jerk chicken, and roti to the heart of Houston''s historic Black community.',
   '4814 Almeda Rd','Houston','TX','77004',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000023',
   'Houston''s most celebrated plant-based restaurant offering creative vegan interpretations of comfort food favorites with fresh ingredients, bold seasonings, and a commitment to accessible healthy eating.',
   '1628 Westheimer Rd','Houston','TX','77006',
   NULL,'https://greenseedvegan.com',NULL,
   'visit','https://greenseedvegan.com','$$',NULL),

  ('00b00002-0000-0000-0000-000000000024',
   'Black-owned specialty coffee shop in Houston''s Almeda corridor serving carefully sourced single-origin coffees, espresso drinks, and light fare in a community-centered environment.',
   '5427 Almeda Rd','Houston','TX','77004',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000025',
   'Black-owned Nashville-style hot chicken restaurant bringing serious heat to Houston with hand-battered, slow-marinated tenders and sandwiches in heat levels from mild to face-melting.',
   '2601 Waugh Dr','Houston','TX','77006',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000026',
   'Black-owned dessert spot serving indulgent waffle creations topped with handcrafted ice cream, fresh fruit, and gourmet sauces in a vibrant, social-media-worthy setting.',
   '5720 Westheimer Rd Suite 100','Houston','TX','77057',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000027',
   'Gourmet grilled cheese sandwich restaurant redefining comfort food with inventive ingredient combinations, artisan breads, and premium cheeses in a fast-casual format Houston loves.',
   '5765 Westheimer Rd Suite A','Houston','TX','77057',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000028',
   'A Houston institution since 1969, Frenchy''s serves Creole-seasoned fried chicken in the Third Ward that has fed generations of Houstonians and remains a pillar of Black culinary culture in Texas.',
   '3919 Scott St','Houston','TX','77004',
   NULL,'https://frenchyschicken.com',NULL,
   'visit','https://frenchyschicken.com','$',1969),

  ('00b00002-0000-0000-0000-000000000029',
   'Black-owned natural hair salon in Houston''s Uptown area specializing in premium silk presses, blowouts, and healthy hair care services exclusively for natural and textured hair types.',
   '2400 Mid Ln Suite 200','Houston','TX','77027',
   NULL,'https://pressedroots.com',NULL,
   'book','https://pressedroots.com','$$$',NULL),

  ('00b00002-0000-0000-0000-000000000030',
   'Premium men''s grooming salon offering classic barbershop services elevated with hot towel shaves, skin treatments, and an atmosphere that blends old-school tradition with modern style.',
   '5520 Almeda Rd Suite 100','Houston','TX','77004',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000031',
   'Neighborhood barbershop in Houston''s Third Ward delivering precise fades, tapers, and grooming services in a community-centered environment that genuinely welcomes clients of all ages.',
   '3215 Wheeler Ave','Houston','TX','77004',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000032',
   'Black-owned luxury nail studio crafting detailed nail art, gel overlays, and spa manicures and pedicures in a beautifully designed, high-attention studio environment.',
   '3720 Kirby Dr Suite 100','Houston','TX','77098',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00b00002-0000-0000-0000-000000000033',
   'Serene boutique nail and wellness suite offering mindful nail care, pedicure spa treatments, and aromatherapy experiences in a calm, intentionally curated environment.',
   '2055 Westheimer Rd Suite 102','Houston','TX','77098',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000034',
   'Black woman-owned nail studio offering elevated nail art, custom designs, and confidence-building salon services for Houston clients who treat their nails as a form of self-expression.',
   '1415 S Voss Rd Suite 110','Houston','TX','77057',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000035',
   'Black woman-owned holistic wellness practice offering mindfulness coaching, somatic healing, plant medicine education, and wellness retreats grounded in African healing traditions.',
   '2626 S Loop W Suite 400','Houston','TX','77054',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000036',
   'Full-service day spa built for women who prioritize self-care, offering massages, facials, body treatments, nail care, and signature wellness packages in a luxurious Houston setting.',
   '4500 N Shepherd Dr Suite 200','Houston','TX','77018',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00b00002-0000-0000-0000-000000000037',
   'Black-owned fitness studio offering personalized training, group classes, and nutrition coaching designed to rebuild strength, endurance, and overall physical vitality for Houston clients.',
   '5100 Westheimer Rd Suite 200','Houston','TX','77056',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000038',
   'Black-owned fitness transformation studio offering high-intensity group training, personal coaching, and accountability programs for Houston clients ready for a complete health and life rebirth.',
   '8700 S Main St Suite 100','Houston','TX','77025',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000039',
   'Fast-casual health food concept serving acai bowls, grain bowls, fresh juices, and smoothies made from locally sourced ingredients across multiple Houston locations.',
   '2520 Robinhood St','Houston','TX','77005',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000040',
   'Black woman-owned therapy and mental wellness coaching practice offering individual counseling, group workshops, and mental wellness retreats specifically designed to support Black women''s emotional health.',
   '3033 Chimney Rock Rd Suite 100','Houston','TX','77056',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000041',
   'Black-owned tax preparation and planning firm serving Houston individuals, families, and small businesses with year-round tax strategy, IRS representation, and financial planning support.',
   '4635 Southwest Fwy Suite 100','Houston','TX','77027',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000042',
   'Black woman-owned independent insurance agency connecting Houston clients with life insurance, health coverage, Medicare plans, and business protection policies that truly fit their lives.',
   '7322 Southwest Fwy Suite 1780','Houston','TX','77074',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000043',
   'Black-owned Houston law firm providing accessible legal services in family law, business formation, contracts, and estate planning with a genuine commitment to justice for every client.',
   '1990 Post Oak Blvd Suite 2400','Houston','TX','77056',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000044',
   'Black-owned Houston real estate brokerage combining deep community roots with expert market knowledge to help buyers, sellers, and investors navigate one of America''s most dynamic housing markets.',
   '3040 Post Oak Blvd Suite 1800','Houston','TX','77056',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000045',
   'Black-owned Houston real estate company focused on first-time homebuyer education, investment property acquisition, and building Black generational wealth through strategic real estate guidance.',
   '9800 Northwest Fwy Suite 100','Houston','TX','77092',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000046',
   'Black-owned independent bookstore celebrating Black literature, hosting author events, and building community through a thoughtfully curated selection of fiction, nonfiction, children''s books, and cultural titles.',
   '5018 Almeda Rd Suite 100','Houston','TX','77004',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00b00002-0000-0000-0000-000000000047',
   'Black-owned professional recording studio in Houston''s Heights neighborhood providing world-class recording, mixing, and production services for Third Coast hip-hop, R&B, and independent artists.',
   '1718 Shepherd Dr Suite B','Houston','TX','77007',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00b00002-0000-0000-0000-000000000048',
   'Black-owned upscale event venue and hospitality concept offering beautifully designed spaces for weddings, corporate events, and private celebrations with full catering and coordination.',
   '9801 Westheimer Rd Suite 1000','Houston','TX','77042',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00b00002-0000-0000-0000-000000000049',
   'Black-owned neighborhood health food store carrying vitamins, herbal supplements, organic pantry items, natural beauty products, and wellness essentials at accessible community prices.',
   '4025 Almeda Rd','Houston','TX','77004',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES

  ('00c00003-0000-0000-0000-000000000021',
   'James Beard Award semifinalist restaurant known for its iconic Flight of French Toast — six varieties served alongside elevated brunch classics that have made it one of Chicago''s most beloved destinations.',
   '2748 N Lincoln Ave','Chicago','IL','60614',
   NULL,'https://batterandberries.com',NULL,
   'visit','https://batterandberries.com','$$',NULL),

  ('00c00003-0000-0000-0000-000000000022',
   'Bronzeville brunch and soul food destination serving elevated Southern plates including fried chicken, shrimp and grits, and signature waffles in a warm, welcoming South Side setting.',
   '4652 S Cottage Grove Ave','Chicago','IL','60653',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000023',
   'Lincoln Square Southern comfort food destination offering refined takes on Black American cuisine in a cozy, welcoming environment that has made the entire North Side feel a little more like home.',
   '4609 N Lincoln Ave','Chicago','IL','60625',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000024',
   'Legendary South Side soul food restaurant on Michigan Avenue serving massive, home-style Southern plates in a no-frills setting that has earned a devoted multi-generational following.',
   '3901 S Michigan Ave','Chicago','IL','60653',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00c00003-0000-0000-0000-000000000025',
   'West African and Afro-Caribbean restaurant in Bronzeville serving vibrant Senegalese and Caribbean dishes including thiéboudienne, griot, and mafé in a beautifully warm and welcoming dining room.',
   '1126 E 47th St','Chicago','IL','60653',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000026',
   'Bronzeville restaurant celebrating New Orleans-inspired cuisine with creative Creole dishes, classic Louisiana cocktails, and a music-forward atmosphere honoring the Great Migration''s cultural legacy.',
   '4337 S Cottage Grove Ave','Chicago','IL','60653',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000027',
   'Upscale Southern restaurant in River North offering elevated Black American cuisine in a sophisticated dining room setting with a full bar and a thoughtfully curated wine and cocktail program.',
   '710 N Clark St','Chicago','IL','60654',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00c00003-0000-0000-0000-000000000028',
   'Authentic Jamaican restaurant in Lincoln Park known for slow-cooked jerk chicken, curried goat, and island sides prepared with traditional techniques and genuine Caribbean seasoning.',
   '1509 N Wells St','Chicago','IL','60610',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000029',
   'Bronzeville soul food counter and bakery institution offering hearty Southern plates, fresh-baked goods, and daily specials that have served the South Side community for decades.',
   '1928 W 79th St','Chicago','IL','60620',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00c00003-0000-0000-0000-000000000030',
   'All-day breakfast and lunch spot serving creative omelets, French toast, and comfort classics in a warm neighborhood atmosphere where every morning feels like a proper occasion.',
   '1339 W Taylor St','Chicago','IL','60607',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000031',
   'Chicago''s pioneering Black-owned vegan soul food restaurant serving plant-based versions of Southern classics since 1979, proving that vegan food can be deeply satisfying and culturally resonant.',
   '203 E 75th St','Chicago','IL','60619',
   NULL,NULL,NULL,
   'visit',NULL,'$',1979),

  ('00c00003-0000-0000-0000-000000000032',
   'Black woman-owned barbecue restaurant and craft brewery on Chicago''s Northwest Side offering slow-smoked meats, housemade sauces, and a rotating selection of small-batch craft beers.',
   '4200 W Lawrence Ave','Chicago','IL','60630',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000033',
   'Chicago''s first and only Black-owned urban winery in the heart of Bronzeville, offering wine tastings, small plates, and a welcoming community gathering space celebrating the neighborhood''s rich history.',
   '4420 S Cottage Grove Ave','Chicago','IL','60653',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000034',
   'Black-owned specialty coffee house serving ethically sourced coffees, teas, and light menu items in a community-centered space that celebrates African coffee heritage on Chicago''s South Loop.',
   '2100 S Michigan Ave','Chicago','IL','60616',
   NULL,NULL,NULL,
   'visit',NULL,'$',NULL),

  ('00c00003-0000-0000-0000-000000000035',
   'A legendary South Side barbecue institution since 1954, Lem''s is credited by food historians as an originator of Chicago''s distinct aqueous rib sauce style, still slow-smoking ribs on 75th Street.',
   '311 E 75th St','Chicago','IL','60619',
   '(773) 994-2428',NULL,NULL,
   'visit',NULL,'$',1954),

  ('00c00003-0000-0000-0000-000000000036',
   'Black-owned natural hair salon offering protective styles, natural hair treatments, locs, braids, and a positive community atmosphere that celebrates every texture of the Black crown.',
   '1419 N Milwaukee Ave Suite 100','Chicago','IL','60622',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000037',
   'Sought-after Black hair stylist and salon in Chicago known for precision cuts, dimensional color, and styling services that blend technical excellence with a deep understanding of Black hair.',
   '4234 N Broadway Suite 100','Chicago','IL','60613',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00c00003-0000-0000-0000-000000000038',
   'Black-owned luxury nail boutique offering meticulous nail artistry, custom press-on sets, gel services, and a high-touch client experience in a beautifully curated Chicago studio.',
   '1601 N Clybourn Ave Suite 110','Chicago','IL','60614',
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00c00003-0000-0000-0000-000000000039',
   'Black-owned inclusive yoga studio welcoming every body size, ability, and background to a healing practice that connects community and builds genuine belonging in Chicago.',
   '1755 W North Ave Suite 200','Chicago','IL','60622',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000040',
   'Chicago-born Black-owned fashion brand offering elevated casual wear and statement pieces that celebrate individuality, self-expression, and the bold creative energy of Chicago''s Black community.',
   '2035 N Milwaukee Ave Suite 100','Chicago','IL','60647',
   NULL,NULL,NULL,
   'shop',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000041',
   'Black-owned independent real estate firm providing residential buying, selling, and investment services with deep community roots and an unwavering commitment to building Black wealth in Chicago.',
   '1 E Wacker Dr Suite 3500','Chicago','IL','60601',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000042',
   'Black woman-owned Chicago real estate brokerage focused on creating equitable pathways to homeownership and investment for clients historically underserved by the industry.',
   '333 N Michigan Ave Suite 2000','Chicago','IL','60601',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000043',
   'Black-owned contemporary dance company presenting original works that explore African American movement traditions, cultural identity, and the living archive of Black kinesthetic memory.',
   '2501 W Division St Suite 100','Chicago','IL','60622',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000044',
   'Community dance company rooted on Chicago''s South Side preserving and advancing African American dance heritage through performance, education, and neighborhood outreach.',
   '8326 S Cottage Grove Ave','Chicago','IL','60619',
   NULL,NULL,NULL,
   'visit',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000045',
   'Black-owned creative studio bridging art, graphic design, and community storytelling through branding, mural work, and visual projects that amplify Black cultural narratives in Chicago.',
   '2000 W Fulton St Suite 200','Chicago','IL','60612',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000046',
   'Bronzeville''s innovative marketplace built from repurposed shipping containers, providing affordable retail space for local Black entrepreneurs and small business owners to launch and grow.',
   '336 E 51st St','Chicago','IL','60615',
   NULL,'https://boxvillechicago.com',NULL,
   'visit','https://boxvillechicago.com',NULL,2018),

  ('00c00003-0000-0000-0000-000000000047',
   'Black-led urban agriculture nonprofit on Chicago''s South Side operating sustainable farms and programming that advance food justice, workforce development, and environmental stewardship.',
   '2124 S Wabash Ave','Chicago','IL','60616',
   NULL,'https://urbangrowerscollective.org',NULL,
   'visit','https://urbangrowerscollective.org',NULL,NULL),

  ('00c00003-0000-0000-0000-000000000048',
   'Black-owned photography studio and creative gathering space offering professional portrait sessions, studio rentals, and community programming that celebrates Black visual storytelling.',
   '845 W Washington Blvd Suite 100','Chicago','IL','60607',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000049',
   'Black-owned strategic consulting firm helping brands, nonprofits, and entrepreneurs refine their identity, sharpen their strategy, and scale their impact through clarity-focused consulting.',
   '70 W Madison St Suite 1400','Chicago','IL','60602',
   NULL,NULL,NULL,
   'contact',NULL,NULL,NULL),

  ('00c00003-0000-0000-0000-000000000050',
   'Black-owned walking tour company offering curated Chicago Black history tours celebrating the Great Migration, Bronzeville jazz culture, civil rights history, and the stories the textbooks left out.',
   '412 S Michigan Ave Suite 200','Chicago','IL','60605',
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

COMMIT;
