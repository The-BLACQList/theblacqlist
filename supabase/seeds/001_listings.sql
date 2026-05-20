-- =============================================================================
-- Seed: 001_listings.sql
-- Real Black-owned businesses across Atlanta GA (40), Houston TX (20), Chicago IL (20)
-- Researched from verified public sources: The Infatuation, Atlanta Eats, Timeout Chicago,
-- Black Restaurant Weeks, Shoppe Black, direct business websites, and news coverage.
-- Data as of May 2026. Hours, addresses, and contact info change —
-- owners should claim and update their listings via the owner dashboard.
-- Businesses noted with VERIFY should be confirmed active before staging launch.
-- Requires: seed.sql (states, cities, categories) already applied.
-- Idempotency: ON CONFLICT DO NOTHING on both tables.
-- UUIDs: ATL 00a00001-...-001–040, HOU 00b00002-...-001–020, CHI 00c00003-...-001–020
-- =============================================================================

BEGIN;

-- ===========================================================================
-- ATLANTA, GA — 40 LISTINGS
-- ===========================================================================

INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES
  ('00a00001-0000-0000-0000-000000000001','Busy Bee Cafe','busy-bee-cafe',
   'Soul food institution that fed the civil rights movement since 1947.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,47,22,'admin',now()),

  ('00a00001-0000-0000-0000-000000000002','Twisted Soul Cookhouse & Pours','twisted-soul-cookhouse',
   'Southern soul food elevated with global flavors and craft cocktails.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,38,14,'admin',now()),

  ('00a00001-0000-0000-0000-000000000003','Atlanta Breakfast Club','atlanta-breakfast-club',
   'Iconic downtown breakfast spot for big plates and bold Atlanta flavor.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,41,19,'admin',now()),

  ('00a00001-0000-0000-0000-000000000004','Tassili''s Raw Reality Cafe','tassilis-raw-reality-cafe',
   'Plant-based raw vegan cafe rooted in holistic living and African wellness traditions.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,29,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000005','Slutty Vegan ATL','slutty-vegan-atl',
   'Boldly named vegan burgers that converted Atlanta into true believers.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,52,24,'admin',now()),

  ('00a00001-0000-0000-0000-000000000006','Desta Ethiopian Kitchen','desta-ethiopian-kitchen',
   'Authentic Ethiopian cuisine bringing injera and bold spice to Atlanta.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,27,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000007','Virgil''s Gullah Kitchen & Bar','virgils-gullah-kitchen',
   'Gullah Geechee coastal cuisine honoring a distinct African American culinary tradition.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,31,13,'admin',now()),

  ('00a00001-0000-0000-0000-000000000008','Che Butter Jonez','che-butter-jonez',
   'Creative American comfort food with bold personality in Brookhaven.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,24,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000009','Hippin'' Hops Brewery','hippinhops-brewery',
   'Georgia''s first Black-owned brewery crafting beers with deep community spirit.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,33,10,'admin',now()),

  ('00a00001-0000-0000-0000-000000000010','Big Dave''s Cheesesteaks','big-daves-cheesesteaks',
   'Atlanta''s beloved cheesesteak spot built from passion and pure hustle.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,36,16,'admin',now()),

  ('00a00001-0000-0000-0000-000000000011','Shorthair Xpress','shorthair-xpress',
   'Atlanta''s go-to destination for precision short haircuts and expert styling.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,18,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000012','Textur''d Silk Bar','texturd-silk-bar',
   'Silk press and textured hair specialists for every crown and curl.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,15,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000013','Dawn''s of Essence Salon','dawns-of-essence-salon',
   'Upscale ethnic hair salon committed to healthy hair care for Black women.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,12,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000014','Gymnetics Fitness','gymnetics-fitness',
   'Atlanta''s first Black women-owned fitness center powering community wellness.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,28,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000015','The Kindred Healing Center','kindred-healing-center',
   'Holistic healing collective offering culturally competent Black wellness services.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00a00001-0000-0000-0000-000000000016','E.F.F.E.C.T. Fitness','effect-fitness-atl',
   'High-energy boot camp and spin classes built for the Southwest Atlanta community.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000017','The Wellness Spot ATL','the-wellness-spot-atl',
   'Full-service spa and wellness studio rooted in restorative community self-care.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000018','Pressed ATL','pressed-atl',
   'Midtown boutique empowering women to feel bold and beautifully confident.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,21,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000019','The Village Retail Market','village-retail-market',
   'Cause-driven collective boutique celebrating Black-owned fashion and culture.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,17,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000020','Atlanta Influences Everything','atlanta-influences-everything',
   'Atlanta-born apparel brand celebrating the city''s global cultural influence.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'online','published','free','unclaimed',false,19,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000021','TKST Law','tkst-law',
   'Atlanta''s oldest Black-owned law firm with decades of elite corporate litigation excellence.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000022','SR Law Group','sr-law-group',
   'Georgia''s premier Black-owned boutique firm for estate planning and elder law.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,6,1,'admin',now()),

  ('00a00001-0000-0000-0000-000000000023','The Embry Law Firm','embry-law-firm',
   'Black-owned personal injury firm fighting for justice with compassion and results.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000024','Myavana','myavana',
   'AI-powered hair technology helping textured hair find the right products.',
   'business',(SELECT id FROM categories WHERE slug='technology'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'online','published','free','unclaimed',false,23,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000025','Zyrobotics','zyrobotics',
   'Inclusive assistive technology making STEM learning joyful for children with disabilities.',
   'business',(SELECT id FROM categories WHERE slug='technology'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'online','published','free','unclaimed',false,11,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000026','Brave + Kind Bookshop','brave-and-kind-bookshop',
   'Decatur''s children''s bookshop championing diverse stories and representation.',
   'business',(SELECT id FROM categories WHERE slug='books-publishing'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,20,7,'admin',now()),

  ('00a00001-0000-0000-0000-000000000027','For Keeps Books','for-keeps-books',
   'Auburn Avenue shop specializing in rare and classic Black literature and history.',
   'business',(SELECT id FROM categories WHERE slug='books-publishing'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,18,6,'admin',now()),

  ('00a00001-0000-0000-0000-000000000028','WEBMyers Construction','webmyers-construction',
   'Georgia''s largest Black woman-owned general contracting firm with 25+ years of expertise.',
   'business',(SELECT id FROM categories WHERE slug='construction-trades'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000029','Design OCD','design-ocd-atlanta',
   'Premier Black-owned interior design firm transforming Atlanta homes and commercial spaces.',
   'business',(SELECT id FROM categories WHERE slug='home-living'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,13,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000030','ZuCot Gallery','zucot-gallery',
   'The Southeast''s largest African American-owned fine art gallery showcasing diverse artists.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,34,12,'admin',now()),

  ('00a00001-0000-0000-0000-000000000031','CreativeSoul Photography','creativesoul-photography',
   'Atlanta photographers creating powerful images celebrating Black children and culture.',
   'business',(SELECT id FROM categories WHERE slug='photography-videography'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,26,9,'admin',now()),

  ('00a00001-0000-0000-0000-000000000032','Urban Grind Atlanta','urban-grind-atlanta',
   'Hip Westside coffee house and co-working space fueling Atlanta''s creative class.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,30,11,'admin',now()),

  ('00a00001-0000-0000-0000-000000000033','Nourish + Bloom Market','nourish-bloom-market',
   'The world''s first AI-powered frictionless Black-owned grocery store.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',true,43,15,'admin',now()),

  ('00a00001-0000-0000-0000-000000000034','The Beehive ATL','beehive-atl',
   'Boutique collective of local makers selling apparel, jewelry, and home goods.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,16,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000035','Images USA','images-usa-atlanta',
   'Atlanta''s pioneering Black-owned multicultural marketing agency serving brands for 35+ years.',
   'business',(SELECT id FROM categories WHERE slug='social-media-marketing'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000036','Tony''s Barber Studio','tonys-barber-studio-atl',
   'Upscale barbershop bringing luxury cuts and straight-razor shaves to Midtown Atlanta.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00a00001-0000-0000-0000-000000000037','Chapter Ave Productions','chapter-ave-productions',
   'Full-service video production and digital marketing agency for visionary brands.',
   'business',(SELECT id FROM categories WHERE slug='creative-media'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00a00001-0000-0000-0000-000000000038','Centered Life Therapy','centered-life-therapy',
   'Mental health counseling that honors your full humanity and cultural identity.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,10,3,'admin',now()),

  ('00a00001-0000-0000-0000-000000000039','Just 4 Girls Salon','just-4-girls-salon',
   'Specialized hair salon dedicated to girls and women of all hair types and ages.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,11,4,'admin',now()),

  ('00a00001-0000-0000-0000-000000000040','Gymnetics Fitness East','gymnetics-fitness-east',
   'Community fitness center empowering Atlanta''s east side through accessible wellness.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='atlanta-ga'),
   'physical','published','free','unclaimed',false,9,3,'admin',now())

ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- HOUSTON, TX — 20 LISTINGS
-- ===========================================================================

INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES
  ('00b00002-0000-0000-0000-000000000001','The Breakfast Klub','breakfast-klub',
   'Houston''s legendary breakfast institution famous for catfish and grits since 2001.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,49,21,'admin',now()),

  ('00b00002-0000-0000-0000-000000000002','Lucille''s Houston','lucilles-houston',
   'Nationally acclaimed Southern restaurant honoring great-grandmother Lucille B. Smith''s culinary legacy.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,41,17,'admin',now()),

  ('00b00002-0000-0000-0000-000000000003','Burns Original BBQ','burns-original-bbq',
   'Houston BBQ institution serving slow-smoked Texas tradition since 1973.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,35,14,'admin',now()),

  ('00b00002-0000-0000-0000-000000000004','Gatlin''s BBQ','gatlins-bbq',
   'Houston craft BBQ pioneer bringing award-winning brisket and community love to Garden Oaks.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,32,12,'admin',now()),

  ('00b00002-0000-0000-0000-000000000005','ChòpnBlọk','chopnblok',
   'James Beard-nominated West African street food bringing jollof and jerk to Downtown Houston.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,38,16,'admin',now()),

  ('00b00002-0000-0000-0000-000000000006','Kulture Houston','kulture-houston',
   'Southern meets African-Caribbean fusion in Downtown Houston''s vibrant arts district.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,27,11,'admin',now()),

  ('00b00002-0000-0000-0000-000000000007','Triple J''s Smokehouse','triple-js-smokehouse',
   'Trinity Gardens BBQ gem famous for boudin, loaded potatoes, and pure Texas soul.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,22,8,'admin',now()),

  ('00b00002-0000-0000-0000-000000000008','Phil & Derek''s','phil-and-dereks',
   'Cajun-Creole kitchen and jazz lounge serving soulful seafood and live music nightly.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00b00002-0000-0000-0000-000000000009','Salon Meyerland','salon-meyerland',
   'Houston''s premier Black hair salon suite with 74 expert stylists under one roof.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00b00002-0000-0000-0000-000000000010','TRENDZ by Tammy','trendz-by-tammy',
   'Natural and relaxed Black hair salon specializing in silk press, locs, and pixie cuts.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,13,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000011','MELODRAMA Boutique','melodrama-boutique',
   'Third Ward women''s fashion boutique mixing classic and contemporary threads since 2002.',
   'business',(SELECT id FROM categories WHERE slug='fashion-apparel'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,16,6,'admin',now()),

  ('00b00002-0000-0000-0000-000000000012','Yoga House Houston','yoga-house-houston',
   'Houston''s first Black-owned yoga studio offering Kemetic and traditional yoga practices.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,21,8,'admin',now()),

  ('00b00002-0000-0000-0000-000000000013','TWT Fitness','twt-fitness-houston',
   'Women-only fitness studio built on community, accountability, and real transformation.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00b00002-0000-0000-0000-000000000014','McConnell & Jones LLP','mcconnell-jones-llp',
   'America''s largest African American-owned CPA firm delivering audit, tax, and advisory services.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,10,3,'admin',now()),

  ('00b00002-0000-0000-0000-000000000015','Jimerson Advisory Group','jimerson-advisory-group',
   'Black woman-owned CPA firm providing expert tax and financial guidance to Houston businesses.',
   'business',(SELECT id FROM categories WHERE slug='legal-financial'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,7,2,'admin',now()),

  ('00b00002-0000-0000-0000-000000000016','Five Star Social Media Agency','five-star-social-media',
   'Black-owned digital marketing agency growing Houston brands through bold social strategies.',
   'business',(SELECT id FROM categories WHERE slug='social-media-marketing'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,8,2,'admin',now()),

  ('00b00002-0000-0000-0000-000000000017','Houston Small Business Marketing','houston-small-biz-marketing',
   'Black-owned agency helping Houston small businesses grow their digital presence and reach.',
   'business',(SELECT id FROM categories WHERE slug='social-media-marketing'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,9,3,'admin',now()),

  ('00b00002-0000-0000-0000-000000000018','The Ensemble Theatre','ensemble-theatre-houston',
   'Houston''s professional Black theatre company producing powerful African American stories since 1976.',
   'business',(SELECT id FROM categories WHERE slug='events-entertainment'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',true,26,10,'admin',now()),

  ('00b00002-0000-0000-0000-000000000019','Blackacre Builders','blackacre-builders',
   'Black-owned Houston homebuilder crafting quality custom homes in Independence Heights.',
   'business',(SELECT id FROM categories WHERE slug='construction-trades'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,6,1,'admin',now()),

  ('00b00002-0000-0000-0000-000000000020','The Beauty Vault HTX','beauty-vault-htx',
   'Houston''s Black-owned beauty supply store stocking curated products for textured hair.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='houston-tx'),
   'physical','published','free','unclaimed',false,11,4,'admin',now())

ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- CHICAGO, IL — 20 LISTINGS
-- ===========================================================================

INSERT INTO listings (
  id, name, slug, tagline, entity_type, category_id, city_id,
  location_type, status, tier, trust_tier, is_featured,
  save_count, review_count, source, published_at
) VALUES
  ('00c00003-0000-0000-0000-000000000001','Virtue Restaurant','virtue-restaurant-chicago',
   'James Beard Award-winning Southern American kitchen anchoring Hyde Park''s dining scene.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,48,20,'admin',now()),

  ('00c00003-0000-0000-0000-000000000002','Norman''s Bistro','normans-bistro-chicago',
   'American Creole cuisine with a Brazilian flair in Chicago''s vibrant Kenwood neighborhood.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,29,11,'admin',now()),

  ('00c00003-0000-0000-0000-000000000003','Justice of the Pies','justice-of-the-pies',
   'Beloved Black-owned bakery serving sweet and savory pies baked with love and social purpose.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,35,14,'admin',now()),

  ('00c00003-0000-0000-0000-000000000004','Daisy''s Po'' Boy and Tavern','daisys-po-boy-tavern',
   'Hyde Park tavern serving Chicago''s best po''boys with craft cocktails and a warm neighborhood vibe.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,20,8,'admin',now()),

  ('00c00003-0000-0000-0000-000000000005','Soul & Smoke Chicago','soul-and-smoke-chicago',
   'Chicago''s fastest-growing BBQ born during the pandemic from community love and shared purpose.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,31,12,'admin',now()),

  ('00c00003-0000-0000-0000-000000000006','Mikkey''s Retro Grill','mikkeys-retro-grill',
   'Hyde Park burger joint and late-night community anchor open until 4am daily.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,22,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000007','Uncle Remus Saucy Chicken','uncle-remus-saucy-chicken',
   'Chicago''s legendary saucy chicken spot feeding the West Side community for 50+ years.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,27,11,'admin',now()),

  ('00c00003-0000-0000-0000-000000000008','Hyde Park Hair Salon','hyde-park-hair-salon',
   'Historic barbershop since 1927 — where President Obama got his legendary haircut.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,39,17,'admin',now()),

  ('00c00003-0000-0000-0000-000000000009','Esthetic Haus','esthetic-haus',
   'Black woman-owned luxury brow bar and beauty spa redefining Chicago''s skincare standards.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,24,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000010','Innate Allure','innate-allure-chicago',
   'West Loop Black-owned skincare studio specializing in customized facials and brow lifts.',
   'business',(SELECT id FROM categories WHERE slug='beauty-grooming'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,18,7,'admin',now()),

  ('00c00003-0000-0000-0000-000000000011','Burrell Communications Group','burrell-communications-chicago',
   'One of America''s largest multicultural marketing agencies pioneering Black advertising since 1971.',
   'business',(SELECT id FROM categories WHERE slug='social-media-marketing'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,12,3,'admin',now()),

  ('00c00003-0000-0000-0000-000000000012','myWHY Agency','mywhy-agency',
   'All-women Black-owned agency serving purpose-driven brands with powerful strategic storytelling.',
   'business',(SELECT id FROM categories WHERE slug='social-media-marketing'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,14,5,'admin',now()),

  ('00c00003-0000-0000-0000-000000000013','Premier Health Urgent Care','premier-health-urgent-care',
   'Chicago''s first Black-owned urgent care facility serving the South Side''s Hyde Park community.',
   'business',(SELECT id FROM categories WHERE slug='healthcare'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,16,5,'admin',now()),

  ('00c00003-0000-0000-0000-000000000014','The Silver Room','silver-room-chicago',
   'Hyde Park''s eclectic jewel for handmade jewelry, fashion, art, and music since 1997.',
   'business',(SELECT id FROM categories WHERE slug='retail-gifts'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,37,15,'admin',now()),

  ('00c00003-0000-0000-0000-000000000015','Black Ensemble Theater','black-ensemble-theater',
   'Chicago theater company combating racism through transformative African American theatrical arts.',
   'business',(SELECT id FROM categories WHERE slug='events-entertainment'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',true,28,11,'admin',now()),

  ('00c00003-0000-0000-0000-000000000016','Semicolon Bookstore','semicolon-bookstore',
   'Chicago''s pioneering Black woman-owned bookstore celebrating diverse literature and art.',
   'business',(SELECT id FROM categories WHERE slug='books-publishing'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','draft','free','unclaimed',false,42,18,'admin',now()), -- CLOSED until 2027 per Instagram; draft so it doesn't appear publicly

  ('00c00003-0000-0000-0000-000000000017','Da Book Joint','da-book-joint',
   'South Side Chicago''s cherished Black bookstore championing African American fiction since 2007.',
   'business',(SELECT id FROM categories WHERE slug='books-publishing'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,23,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000018','Coffee Hip Hop & Mental Health','coffee-hiphop-mental-health',
   'Black-owned mental health coffee space using hip hop culture to heal Chicago communities.',
   'business',(SELECT id FROM categories WHERE slug='wellness-health'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,19,7,'admin',now()),

  ('00c00003-0000-0000-0000-000000000019','Forty Acres Fresh Market','forty-acres-fresh-market',
   'Black-owned grocery market fighting food insecurity on Chicago''s underserved West Side.',
   'business',(SELECT id FROM categories WHERE slug='food-dining'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,25,9,'admin',now()),

  ('00c00003-0000-0000-0000-000000000020','MADD Rhythms','madd-rhythms',
   'Family-owned Black tap dance company preserving Chicago''s vibrant rhythmic arts tradition.',
   'business',(SELECT id FROM categories WHERE slug='arts-culture'),(SELECT id FROM cities WHERE slug='chicago-il'),
   'physical','published','free','unclaimed',false,17,6,'admin',now())

ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- ATLANTA — LISTING DETAILS
-- ===========================================================================

INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES
  ('00a00001-0000-0000-0000-000000000001',
   'A legendary soul food institution on MLK Jr. Drive, Busy Bee Cafe has been a cornerstone of Atlanta''s civil rights history since 1947. Known for classic Southern plates, sweet tea, and warm hospitality that has welcomed civil rights icons, celebrities, and everyday neighbors for generations.',
   '810 MLK Jr Dr SW','Atlanta','GA','30314',
   NULL,'https://thebusybeecafe.com',NULL,
   'visit','https://thebusybeecafe.com','$$',1947),

  ('00a00001-0000-0000-0000-000000000002',
   'Chef Deborah VanTrece''s award-winning restaurant where Southern soul food meets global culinary traditions. Expect creative plates, inventive cocktails, and a dining experience that honors Atlanta''s rich cultural identity.',
   '1133 Huff Rd NW','Atlanta','GA','30318',
   NULL,'https://twistedsoulcookhouseandpours.com',NULL,
   'book','https://twistedsoulcookhouseandpours.com','$$$',2019),

  ('00a00001-0000-0000-0000-000000000003',
   'A downtown Atlanta institution famous for massive, flavor-packed breakfast plates served all day. With bold décor and an energetic vibe, Atlanta Breakfast Club has become a must-visit spot for locals and visitors alike.',
   '249 Ivan Allen Jr Blvd NW','Atlanta','GA','30313',
   NULL,'https://atlantabreakfastclub.com',NULL,
   'visit','https://atlantabreakfastclub.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000004',
   'A pioneer in Atlanta''s plant-based movement, Tassili''s serves raw vegan cuisine rooted in holistic wellness and African traditions. The West End café is known for nourishing bowls, smoothies, and a community-centered ethos.',
   '1059 Ralph David Abernathy Blvd','Atlanta','GA','30310',
   NULL,'https://tassilisrawreality.com',NULL,
   'visit','https://tassilisrawreality.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000005',
   'Founded by Pinky Cole, Slutty Vegan disrupted Atlanta''s food scene with bold, unapologetically named vegan burgers that converted even the most dedicated meat-eaters. The brand has grown into a national movement proving that plant-based food can be craveable and culturally resonant.',
   '476 Edgewood Ave SE','Atlanta','GA','30312',
   NULL,'https://sluttyveganatl.com','https://instagram.com/sluttyveganatl',
   'order','https://sluttyveganatl.com','$$',2018),

  ('00a00001-0000-0000-0000-000000000006',
   'Atlanta''s premier destination for authentic Ethiopian cuisine, serving tender injera, rich stews, and fragrant spiced dishes in a warm, communal setting. A beloved fixture on Briarcliff Road bringing the depth of East African culinary tradition to Atlanta.',
   '3086 Briarcliff Rd NE','Atlanta','GA','30329',
   NULL,'https://destaethiopiankitchen.com',NULL,
   'visit','https://destaethiopiankitchen.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000007',
   'Celebrating the distinct Gullah Geechee culinary tradition of the Sea Islands, Virgil''s brings coastal South Carolina and Georgia flavors to Atlanta''s Westside. Seafood-forward dishes, okra gumbo, and Southern cocktails in an elevated setting.',
   '822 Marietta St NW','Atlanta','GA','30318',
   NULL,'https://virgilsgullahkitchen.com',NULL,
   'book','https://virgilsgullahkitchen.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000008',
   'A Brookhaven restaurant known for inventive comfort food with big personality. Chef Jamal Kent''s creative American menu changes seasonally and consistently delivers memorable, satisfying plates worth returning for.',
   '1602 Lavista Rd NE','Atlanta','GA','30329',
   NULL,'https://chebutterjonez.com',NULL,
   'book','https://chebutterjonez.com','$$$',2021),

  ('00a00001-0000-0000-0000-000000000009',
   'Georgia''s first Black-owned craft brewery, bringing community spirit and great beer to Glenwood Park. Known for neighborhood events, live music, and a welcoming taproom that feels like home.',
   '1308 Glenwood Ave SE','Atlanta','GA','30316',
   NULL,'https://hippinhopsbrewery.com',NULL,
   'visit','https://hippinhopsbrewery.com','$$',2021),

  ('00a00001-0000-0000-0000-000000000010',
   'Built from pure hustle and a love of cheesesteaks, this Atlanta institution serves loaded, saucy sandwiches that have earned a devoted following. Chef David McIntosh''s shop is a go-to for big flavor at accessible prices.',
   '300 Marietta St NW','Atlanta','GA','30313',
   NULL,'https://bigdavesway.com',NULL,
   'order','https://bigdavesway.com','$',NULL),

  ('00a00001-0000-0000-0000-000000000011',
   'Edgewood Avenue''s premier destination for precision short haircuts, featuring expert stylists who specialize in tapered cuts, pixie styles, and short naturals. A welcoming environment for women who celebrate the confidence of short hair.',
   '572 Edgewood Ave SE Ste 117','Atlanta','GA','30312',
   '(404) 254-3544','https://shorthairxpress.com','https://instagram.com/shorthairxpressatlanta',
   'book','https://shorthairxpress.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000012',
   'Atlanta''s specialist for silk press, Dominican blowouts, and textured natural hair styling. Known for healthy hair practices that prioritize moisture retention and long-term hair health in every appointment.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://texturdsb.com',NULL,
   'book','https://texturdsb.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000013',
   'An upscale ethnic hair salon in Atlanta committed to healthy hair care for Black women. Offering everything from relaxers and color to natural styling in a warm, professional setting where clients feel seen and celebrated.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://dawnsofessencesalon.com',NULL,
   'book','https://dawnsofessencesalon.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000014',
   'Atlanta''s first Black women-owned fitness center, empowering community members with group fitness classes, personal training, and a welcoming space where wellness feels accessible to everyone. Founded in 2010 with a mission to make health a priority in Southwest Atlanta.',
   '3220 Butner Rd Suite 260','Atlanta','GA','30331',
   NULL,'https://gymneticsfitness.com',NULL,
   'book','https://gymneticsfitness.com','$$',2010),

  ('00a00001-0000-0000-0000-000000000015',
   'A holistic healing collective on Jonesboro Road offering culturally competent wellness services including therapy, reiki, and wellness coaching. Built for and by the Black community, Kindred prioritizes safety, healing, and whole-person care.',
   '1800 Jonesboro Rd SE 4th Fl','Atlanta','GA','30315',
   '(470) 859-6301','https://kindredhealingcenter.com','https://instagram.com/kindredhealingcenter',
   'book','https://kindredhealingcenter.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000016',
   'High-energy boot camp classes, indoor cycling, and functional fitness training designed to transform lives on Atlanta''s southwest side. A tight-knit community focused on accountability, results, and the joy of moving together.',
   '1995b Metropolitan Pkwy SW','Atlanta','GA','30315',
   '(404) 254-0684','https://effect.fitness',NULL,
   'book','https://effect.fitness','$',NULL),

  ('00a00001-0000-0000-0000-000000000017',
   'A full-service spa and wellness studio in East Point offering massage therapy, facials, and restorative bodywork. Built on the belief that Black women deserve dedicated spaces for rest, recovery, and deep self-care.',
   NULL,'East Point','GA',NULL,
   NULL,'https://thewellnessspotatl.com',NULL,
   'book','https://thewellnessspotatl.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000018',
   'Midtown Atlanta''s destination boutique for women who lead with confidence. Pressed ATL curates contemporary fashion that celebrates individuality and empowers women to show up boldly in every room they enter.',
   '296 14th St NW','Atlanta','GA','30318',
   NULL,'https://pressedatl.com','https://instagram.com/pressedatl',
   'shop','https://pressedatl.com','$$$',2011),

  ('00a00001-0000-0000-0000-000000000019',
   'A cause-driven boutique collective at Ponce City Market celebrating Black-owned fashion, accessories, and culture. Part of a broader mission to support Black entrepreneurs and connect community through meaningful commerce.',
   '675 Ponce De Leon Ave NE Suite 225','Atlanta','GA','30308',
   '(404) 907-1918','https://thevillageretail.com',NULL,
   'shop','https://thevillageretail.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000020',
   'The apparel brand born from Atlanta''s undeniable influence on global culture. AIE drops streetwear and lifestyle pieces that honor the city''s music, art, and creative energy for those who represent the ATL everywhere they go.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://aie.life',NULL,
   'shop','https://aie.life','$$',NULL),

  ('00a00001-0000-0000-0000-000000000021',
   'Founded in 1971, Thomas Kennedy Sampson & Tompkins is one of the oldest and most respected Black-owned law firms in Atlanta. The firm handles complex commercial litigation, business transactions, and has represented some of the most consequential cases in Georgia''s legal history.',
   '3355 E Main St','College Park','GA','30337',
   '(404) 688-4503','https://tkstlaw.com',NULL,
   'get-quote','https://tkstlaw.com','$$$$',1971),

  ('00a00001-0000-0000-0000-000000000022',
   'A premier Black-owned boutique law firm in Atlanta specializing in estate planning, elder law, and business formation. Founded with a commitment to protecting the wealth and legacy of Black families and entrepreneurs across Georgia.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://srlawgrp.com',NULL,
   'get-quote','https://srlawgrp.com','$$$',2010),

  ('00a00001-0000-0000-0000-000000000023',
   'Atlanta''s trusted Black-owned personal injury firm fighting for justice on behalf of injury victims throughout Georgia. The team combines aggressive advocacy with genuine compassion for every client they serve.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://embrylawfirm.com',NULL,
   'call','https://embrylawfirm.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000024',
   'An Atlanta-based AI platform helping women with textured hair identify the best products for their specific hair type through advanced machine learning. Founded by Candace Mitchell Harris, Myavana makes personalized hair care science accessible for Black women everywhere.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://myavana.com',NULL,
   'visit','https://myavana.com','$$',2011),

  ('00a00001-0000-0000-0000-000000000025',
   'A Georgia Tech spinoff developing inclusive assistive technology and STEM educational tools for children with disabilities. Co-founded by Dr. Ayanna Howard, Zyrobotics has earned global recognition for making learning joyful and accessible for every child.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://zyrobotics.com',NULL,
   'visit','https://zyrobotics.com','$$',2013),

  ('00a00001-0000-0000-0000-000000000026',
   'Decatur''s beloved children''s bookshop dedicated to diverse stories and representation in literature. Brave + Kind champions books that help every child see themselves as the hero of their own story, serving families across metro Atlanta.',
   '722 W College Ave','Decatur','GA','30030',
   '(470) 440-5714','https://braveandkindbooks.com',NULL,
   'shop','https://braveandkindbooks.com','$',NULL),

  ('00a00001-0000-0000-0000-000000000027',
   'Nestled on Auburn Avenue in the heart of Atlanta''s historic Black neighborhood, For Keeps Books specializes in rare, classic, and contemporary African American literature. An essential stop for collectors and readers who know the power of Black storytelling.',
   '171 Auburn Ave NE Unit H1','Atlanta','GA','30303',
   NULL,NULL,'https://instagram.com/forkeepsbooks',
   'visit',NULL,'$',2018),

  ('00a00001-0000-0000-0000-000000000028',
   'One of Georgia''s largest Black woman-owned general contracting firms, delivering commercial construction and project management with 25+ years of proven excellence. WEBMyers has completed projects across healthcare, education, government, and mixed-use development.',
   '180 Interstate North Pkwy SE Suite 125','Atlanta','GA','30339',
   '(404) 994-4900','https://webmyersconstruction.com',NULL,
   'get-quote','https://webmyersconstruction.com','$$$$',2015),

  ('00a00001-0000-0000-0000-000000000029',
   'Metro Atlanta''s premier Black-owned interior design firm transforming residential and commercial spaces with sophisticated, tailored aesthetics. Known for meticulous attention to detail and an ability to translate client visions into extraordinary environments.',
   NULL,'Atlanta','GA',NULL,
   '(678) 653-3365','https://designocd.com',NULL,
   'get-quote','https://designocd.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000030',
   'The Southeast''s largest African American-owned fine art gallery, showcasing original paintings, sculpture, and mixed media from emerging and established Black artists. ZuCot has been a cornerstone of Atlanta''s visual arts community since 2009, amplifying Black creativity and collecting.',
   '330 Chapel St S','Atlanta','GA','30313',
   NULL,'https://zucotgallery.com','https://instagram.com/zucotgallery',
   'visit','https://zucotgallery.com','$$',2009),

  ('00a00001-0000-0000-0000-000000000031',
   'Atlanta''s nationally celebrated photography studio known for powerful, joyful images of Black children that challenge outdated stereotypes and celebrate Black childhood in all its beauty. Their iconic portraiture has been featured in major publications worldwide.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://creativesoulphoto.com',NULL,
   'book','https://creativesoulphoto.com','$$$',NULL),

  ('00a00001-0000-0000-0000-000000000032',
   'A community coffee house and co-working space on Atlanta''s Westside where creatives, entrepreneurs, and neighbors gather to work, connect, and create. Known for its warm vibe, strong coffee, and genuine commitment to the local creative economy.',
   '962 Marietta St NW','Atlanta','GA','30318',
   NULL,'https://urbangrindatlanta.com',NULL,
   'visit','https://urbangrindatlanta.com','$',NULL),

  ('00a00001-0000-0000-0000-000000000033',
   'The world''s first AI-powered frictionless Black-owned grocery store, serving Southwest Atlanta with fresh produce, healthy staples, and the convenience of checkout-free shopping. A landmark in food access innovation and community investment on Cascade Road.',
   '2287 Cascade Rd SW','Atlanta','GA','30311',
   NULL,'https://nourishandbloommarket.com','https://instagram.com/nourishandbloommarket',
   'shop','https://nourishandbloommarket.com','$$',2022),

  ('00a00001-0000-0000-0000-000000000034',
   'A vibrant collective boutique in Inman Park carrying local makers'' apparel, jewelry, home goods, and art. The Beehive is a living marketplace for Atlanta''s creative community, offering something new with every visit.',
   '1250 Caroline St NE Suite C120','Atlanta','GA','30307',
   '(404) 581-9261','https://thebeehiveatl.com',NULL,
   'shop','https://thebeehiveatl.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000035',
   'Atlanta''s pioneering Black-owned multicultural marketing agency, founded in 1988 and serving Fortune 500 brands with authentic, research-driven campaigns. Images USA has spent over three decades crafting communications that resonate deeply with diverse audiences.',
   '40 Marietta St NW','Atlanta','GA','30303',
   NULL,'https://imagesusa.com',NULL,
   'get-quote','https://imagesusa.com','$$$$',1988),

  ('00a00001-0000-0000-0000-000000000036',
   'An upscale barbershop at Atlantic Station bringing precision cuts, hot towel shaves, and a premium grooming experience to Midtown Atlanta. Tony''s is where Atlanta''s style-conscious men invest in their look and their confidence.',
   NULL,'Atlanta','GA',NULL,
   NULL,'https://tbarberstudio.com',NULL,
   'book','https://tbarberstudio.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000037',
   'A full-service video production and digital content company serving brands across metro Atlanta. Chapter Ave specializes in brand storytelling, documentary content, and commercial production that moves audiences and builds lasting brand equity.',
   NULL,'Atlanta','GA',NULL,
   NULL,NULL,NULL,
   'get-quote',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000038',
   'An Atlanta-based mental health practice offering individual and group therapy rooted in culturally informed care. Serving Black clients who deserve therapeutic support that truly honors their full lived experience, history, and humanity.',
   NULL,'Atlanta','GA',NULL,
   NULL,NULL,NULL,
   'book',NULL,'$$$',NULL),

  ('00a00001-0000-0000-0000-000000000039',
   'A specialized hair salon in the Kennesaw area dedicated to providing excellent hair care for girls and women of all ages and textures. Known for a nurturing atmosphere and stylists who truly understand and celebrate Black hair.',
   NULL,'Kennesaw','GA',NULL,
   NULL,'https://just4girlssalon.com',NULL,
   'book','https://just4girlssalon.com','$$',NULL),

  ('00a00001-0000-0000-0000-000000000040',
   'A community fitness center on Atlanta''s east side offering group classes, personal training, and wellness programming for all fitness levels. Built on the principle that access to quality fitness should not depend on geography or income.',
   NULL,'Atlanta','GA',NULL,
   NULL,NULL,NULL,
   'book',NULL,'$$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

-- ===========================================================================
-- HOUSTON — LISTING DETAILS
-- ===========================================================================

INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES
  ('00b00002-0000-0000-0000-000000000001',
   'Houston''s most beloved breakfast institution, The Breakfast Klub has been welcoming long lines of loyal regulars since 2001. Famous for catfish and grits, chicken and waffles, and an unwavering commitment to Southern breakfast perfection that has made it a Houston landmark.',
   '3711 Travis St','Houston','TX','77002',
   NULL,'https://thebreakfastklub.com',NULL,
   'visit','https://thebreakfastklub.com','$$',2001),

  ('00b00002-0000-0000-0000-000000000002',
   'Named for chef Chris Williams'' great-great-grandmother Lucille B. Smith, this nationally acclaimed restaurant serves elevated Southern cuisine with deep historical roots. A Midtown Houston dining landmark celebrated for innovative takes on African American food traditions.',
   '5512 La Branch St','Houston','TX','77004',
   '(713) 568-2505','https://lucilleshouston.com','https://instagram.com/lucilleshouston',
   'book','https://lucilleshouston.com','$$$',2012),

  ('00b00002-0000-0000-0000-000000000003',
   'A Houston BBQ institution since 1973, Burns Original has been smoking brisket, ribs, and sausage low and slow for generations of loyal customers. One of the city''s most authentic and enduring pitmaster traditions, still going strong after 50 years.',
   '8307 De Priest St','Houston','TX','77088',
   NULL,'https://burnsoriginalbbq.com','https://instagram.com/burnsoriginalbbq',
   'visit','https://burnsoriginalbbq.com','$',1973),

  ('00b00002-0000-0000-0000-000000000004',
   'Greg Gatlin''s Garden Oaks craft BBQ restaurant has earned a devoted following and national recognition for its carefully smoked brisket, ribs, and Southern sides. A hometown Houston success story built one perfect plate at a time.',
   '3510 Ella Blvd Bldg C Ste A','Houston','TX','77018',
   NULL,'https://gatlinsbbq.com',NULL,
   'visit','https://gatlinsbbq.com','$$',2010),

  ('00b00002-0000-0000-0000-000000000005',
   'James Beard-nominated Nigerian-American chef Ope Amosu''s Downtown Houston restaurant bringing West African street food — jollof rice, suya, and jerk chicken — to the heart of Texas. One of Houston''s most celebrated and boldly original dining destinations.',
   '401 Franklin St Suite A','Houston','TX','77201',
   '(281) 631-5009','https://chopnblok.co','https://instagram.com/chopnblok_',
   'order','https://chopnblok.co','$$',2018),

  ('00b00002-0000-0000-0000-000000000006',
   'An upscale restaurant in Houston''s arts district celebrating African-Caribbean and Southern culinary traditions with artfully prepared dishes and craft cocktails. Kulture has become a premier destination for Houston''s culture-forward dining scene.',
   '701 Avenida De Las Americas Suite A','Houston','TX','77010',
   '(713) 357-9697',NULL,'https://instagram.com/kulture_houston',
   'book',NULL,'$$$',2017),

  ('00b00002-0000-0000-0000-000000000007',
   'A neighborhood gem in Trinity Gardens serving some of Houston''s most beloved BBQ alongside loaded baked potatoes, boudin, and homestyle sides. Triple J''s is the kind of place that becomes a family tradition passed from generation to generation.',
   '6715 Homestead Rd','Houston','TX','77028',
   '(713) 635-6384','https://triplejsmokehouse.com','https://instagram.com/triplejs.smokehouse',
   'order','https://triplejsmokehouse.com','$',NULL),

  ('00b00002-0000-0000-0000-000000000008',
   'A lively Cajun-Creole kitchen and jazz lounge in EaDo serving soulful seafood plates and live music nightly. Phil & Derek''s captures the spirit of New Orleans right in Houston''s vibrant Third Ward area.',
   '1701 Webster St Suite E','Houston','TX','77003',
   '(281) 501-3261','https://philanddereksreloaded.com','https://instagram.com/philanddereks',
   'visit','https://philanddereksreloaded.com','$$',NULL),

  ('00b00002-0000-0000-0000-000000000009',
   'One of Houston''s largest and most established Black hair salon suites, with over 70 independent stylists under one roof serving all hair types and textures. A destination for anyone seeking expert natural hair care, extensions, color, or protective styles in Southwest Houston.',
   '10350 S Post Oak Rd','Houston','TX','77035',
   '(713) 283-9300','https://salonmeyerland.com','https://instagram.com/salonmeyerland',
   'book','https://salonmeyerland.com','$$',NULL),

  ('00b00002-0000-0000-0000-000000000010',
   'Houston''s trusted natural and relaxed hair salon specializing in silk presses, locs, braids, and pixie cuts. Known for healthy hair practices and a welcoming atmosphere that keeps clients coming back for every appointment.',
   NULL,'Houston','TX',NULL,
   NULL,'https://trendzbytammy.com',NULL,
   'book','https://trendzbytammy.com','$$',NULL),

  ('00b00002-0000-0000-0000-000000000011',
   'A Third Ward Houston fashion institution since 2002, MELODRAMA offers curated women''s clothing that blends classic elegance with contemporary edge. A beloved destination for style-forward shoppers who appreciate quality, individuality, and a boutique that knows the culture.',
   '5306 Almeda Rd','Houston','TX','77004',
   '(713) 523-1608','https://melodramaboutique.com',NULL,
   'shop','https://melodramaboutique.com','$$$',2002),

  ('00b00002-0000-0000-0000-000000000012',
   'Houston''s first Black-owned yoga studio, offering Kemetic yoga, traditional Hatha, and wellness workshops rooted in African traditions. A sanctuary on Cleburne Street where community, healing, and intentional movement come together.',
   '1815 Cleburne Ste C','Houston','TX','77004',
   '(713) 240-3073','https://yogahousehouston.com',NULL,
   'book','https://yogahousehouston.com','$$',2010),

  ('00b00002-0000-0000-0000-000000000013',
   'A women-only fitness studio in the Houston area built entirely on community, accountability, and real transformation. TWT creates an encouraging environment where women of all fitness levels feel safe, supported, and motivated to reach their goals.',
   NULL,'Pearland','TX',NULL,
   NULL,'https://twtfitness.net',NULL,
   'book','https://twtfitness.net','$$',NULL),

  ('00b00002-0000-0000-0000-000000000014',
   'America''s largest African American-owned CPA firm, providing audit, tax, and advisory services to corporations, nonprofits, and government entities since 1987. McConnell & Jones has earned national recognition for excellence in public accounting and a commitment to diverse leadership.',
   '4828 Loop Central Dr Suite 1000','Houston','TX','77081',
   '(832) 582-8712','https://mcconnelljones.com',NULL,
   'get-quote','https://mcconnelljones.com','$$$$',1987),

  ('00b00002-0000-0000-0000-000000000015',
   'A Black woman-owned CPA and financial advisory firm providing expert tax planning, business consulting, and financial guidance to Houston''s entrepreneurs and small businesses. Trusted by clients who want a financial partner who truly understands their goals and their community.',
   NULL,'Houston','TX',NULL,
   NULL,'https://jimersoncpa.com',NULL,
   'get-quote','https://jimersoncpa.com','$$$',NULL),

  ('00b00002-0000-0000-0000-000000000016',
   'A Houston-based Black-owned digital marketing agency helping businesses grow their brands through bold social media strategy, content creation, and community management. Known for delivering real, measurable growth for clients across multiple industries.',
   NULL,'Houston','TX',NULL,
   NULL,'https://fivestarsocialmediaagency.com',NULL,
   'get-quote','https://fivestarsocialmediaagency.com','$$$',2019),

  ('00b00002-0000-0000-0000-000000000017',
   'A full-service Black-owned marketing agency helping Houston small businesses build their digital presence through SEO, social media, and targeted advertising. Dedicated to making sophisticated marketing strategies accessible for businesses of every size.',
   '1415 N Loop West #950','Houston','TX','77008',
   '(713) 492-0025','https://houstonsmallbusinessmarketing.com',NULL,
   'get-quote','https://houstonsmallbusinessmarketing.com','$$$',NULL),

  ('00b00002-0000-0000-0000-000000000018',
   'Houston''s only professional theater company dedicated to producing works by and about the African American experience, operating since 1976. The Ensemble has brought hundreds of productions to Houston stages, earning national recognition for artistic excellence and community service.',
   '3535 Main St','Houston','TX','77004',
   '(713) 520-0055','https://ensemblehouston.com',NULL,
   'book','https://ensemblehouston.com','$$',1976),

  ('00b00002-0000-0000-0000-000000000019',
   'A Black-owned Houston homebuilder crafting quality custom homes with close attention to detail and deep community investment. Specializing in new construction in Independence Heights and surrounding Houston neighborhoods.',
   NULL,'Houston','TX',NULL,
   NULL,NULL,'https://instagram.com/blackacrebuilders',
   'get-quote',NULL,'$$$$',NULL),

  ('00b00002-0000-0000-0000-000000000020',
   'Houston''s go-to Black-owned beauty supply store carrying a carefully curated selection of products for textured, natural, and protective styles. A one-stop shop stocking the products Black women in Houston actually need, without wading through products that weren''t made for them.',
   NULL,'Houston','TX',NULL,
   NULL,NULL,'https://instagram.com/thebeautyvaulthtx',
   'shop',NULL,'$$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

-- ===========================================================================
-- CHICAGO — LISTING DETAILS
-- ===========================================================================

INSERT INTO listing_details_business (
  listing_id, description,
  address_line_1, city_text, state, zip,
  phone, website_url, social_instagram,
  cta_type, cta_url,
  price_range, founded_year
) VALUES
  ('00c00003-0000-0000-0000-000000000001',
   'Chef Erick Williams'' James Beard Award-winning restaurant in Hyde Park celebrating the culinary heritage of the American South. Virtue serves beautifully executed Southern dishes in an elegant setting that honors both the food and its deep cultural origins.',
   '1462 E 53rd St','Chicago','IL','60615',
   NULL,'https://virtuerestaurant.com','https://instagram.com/virtuerestaurantchi',
   'book','https://virtuerestaurant.com','$$$',2018),

  ('00c00003-0000-0000-0000-000000000002',
   'A Kenwood neighborhood gem offering American Creole cuisine with Brazilian influences, set in a beautifully restored historic space. Norman''s Bistro has been a Hyde Park dining anchor since 2010, known for inventive flavors, warm hospitality, and outstanding cocktails.',
   '1001 E 43rd St','Chicago','IL','60653',
   NULL,'https://normansbistro.com','https://instagram.com/normanbistro',
   'book','https://normansbistro.com','$$$',2010),

  ('00c00003-0000-0000-0000-000000000003',
   'Maya-Camille Broussard''s celebrated bakery bringing sweet and savory pies baked with love and social purpose to Chicago''s South Side. Each pie tells a story, and every purchase supports criminal justice reform and community programs across Chicago.',
   '8655 S Blackstone Ave','Chicago','IL','60619',
   NULL,'https://justiceofthepies.com','https://instagram.com/justiceofthepies',
   'order','https://justiceofthepies.com','$$',NULL),

  ('00c00003-0000-0000-0000-000000000004',
   'A Hyde Park neighborhood bar and kitchen serving Chicago''s most satisfying po''boy sandwiches alongside craft cocktails and a warm, reliably welcoming atmosphere. Daisy''s is the kind of neighborhood tavern every block in the city deserves.',
   '5215 S Harper Ave','Chicago','IL','60615',
   NULL,NULL,NULL,
   'visit',NULL,'$$',NULL),

  ('00c00003-0000-0000-0000-000000000005',
   'Born during the pandemic from a community''s demand for quality BBQ, Soul & Smoke has grown into one of Chicago''s most celebrated barbecue restaurants. Operating in Evanston and Avondale, they deliver smoked meats with Southern soul and authentic Chicago heart.',
   NULL,'Chicago','IL',NULL,
   NULL,'https://soulandsmoke.com',NULL,
   'order','https://soulandsmoke.com','$$',2020),

  ('00c00003-0000-0000-0000-000000000006',
   'A Hyde Park institution open until 4am, Mikkey''s serves classic American burgers, shakes, and late-night comfort food to Chicago''s South Side community. Reliable, delicious, and always open when you need it most — a true neighborhood anchor.',
   '8126 S Stony Island','Chicago','IL','60619',
   '(773) 902-2800','https://mikkeys.com',NULL,
   'order','https://mikkeys.com','$',2015),

  ('00c00003-0000-0000-0000-000000000007',
   'A Chicago West Side institution for over 50 years, Uncle Remus serves their legendary saucy fried chicken and hot links to generations of loyal fans. Multiple locations anchor the community with affordable, satisfying, iconic Chicago flavor that has never gone out of style.',
   NULL,'Chicago','IL',NULL,
   NULL,'https://uncleremususa.com',NULL,
   'order','https://uncleremususa.com','$',NULL),

  ('00c00003-0000-0000-0000-000000000008',
   'Chicago''s historic barbershop since 1927, Hyde Park Hair Salon is where President Barack Obama got his haircut. Nearly a century of precision cuts and community service has made it one of the most storied and beloved barbershops in American history.',
   '5234 S Blackstone Ave Ste A','Chicago','IL','60615',
   '(773) 493-6028','https://hydeparkhairsalon.biz','https://instagram.com/hydepark.hairsalon',
   'book','https://hydeparkhairsalon.biz','$$',1927),

  ('00c00003-0000-0000-0000-000000000009',
   'A luxury Black woman-owned brow bar and beauty spa in Wicker Park redefining Chicago''s skincare standards. Esthetic Haus specializes in artful brow design, facials, and waxing services in a chic, welcoming environment designed for all skin tones.',
   '829 N Damen Ave Ste 1','Chicago','IL','60622',
   '(773) 799-8834','https://esthetichaus.com','https://instagram.com/esthetichaus',
   'book','https://esthetichaus.com','$$$',2016),

  ('00c00003-0000-0000-0000-000000000010',
   'A West Loop Black-owned skincare studio offering customized facials, brow lifts, and targeted skin treatments for all complexions. Known for exceptional personalized service and results-driven skincare protocols that keep clients glowing.',
   '118 N Clinton St Fl 2','Chicago','IL','60661',
   '(773) 240-5244','https://innate-allure.com','https://instagram.com/innate.allure',
   'book','https://innate-allure.com','$$$',NULL),

  ('00c00003-0000-0000-0000-000000000011',
   'Founded in 1971, Burrell Communications Group is one of America''s largest and most influential multicultural marketing agencies, headquartered in Chicago. For over 50 years, Burrell has pioneered authentic African American marketing for Fortune 500 brands including McDonald''s, Toyota, and Procter & Gamble.',
   '233 N Michigan Ave Suite 2900','Chicago','IL','60601',
   '(312) 297-9600','https://burrell.com','https://instagram.com/burrell_comm',
   'get-quote','https://burrell.com','$$$$',1971),

  ('00c00003-0000-0000-0000-000000000012',
   'A Chicago-based all-women Black-owned agency at the intersection of strategy and storytelling, serving purpose-driven brands and nonprofits. myWHY is known for bold creative work that connects organizations to their audiences with authentic cultural resonance.',
   '5113 S Harper Ave #2C','Chicago','IL','60615',
   '(312) 874-7204','https://mywhyagency.com',NULL,
   'get-quote','https://mywhyagency.com','$$$',2016),

  ('00c00003-0000-0000-0000-000000000013',
   'Chicago''s first Black-owned urgent care facility, serving the Hyde Park and Kenwood communities with accessible, high-quality medical care since 2019. Premier Health is committed to reducing health disparities on Chicago''s South Side through compassionate, expert service.',
   '1301 E 47th St Bldg 2','Chicago','IL','60653',
   NULL,'https://premierucchicago.com',NULL,
   'visit','https://premierucchicago.com','$$',2019),

  ('00c00003-0000-0000-0000-000000000014',
   'A Hyde Park treasure since 1997, The Silver Room is Chicago''s eclectic destination for handmade jewelry, fashion, art, music, and community. Beyond retail, The Silver Room hosts the beloved annual Silver Room Block Party celebrating Black art, culture, and local commerce.',
   '1506 E 53rd St','Chicago','IL','60615',
   '(773) 947-0024','https://thesilverroom.com','https://instagram.com/thesilverroom',
   'shop','https://thesilverroom.com','$$',1997),

  ('00c00003-0000-0000-0000-000000000015',
   'Founded in 1976 by Jackie Taylor, Black Ensemble Theater is Chicago''s powerhouse Black theater company committed to eradicating racism through transformative African American theatrical productions. A cultural institution that has launched careers, changed minds, and enriched Chicago''s arts community.',
   '4450 N Clark St','Chicago','IL','60640',
   NULL,'https://blackensembletheater.org','https://instagram.com/blackensemble',
   'book','https://blackensembletheater.org','$$',1976),

  ('00c00003-0000-0000-0000-000000000016',
   'Chicago''s pioneering Black woman-owned bookstore celebrating diverse literature, art, and community in Garfield Park. Founded by Danielle Mullen, Semicolon has become a national symbol of Black intellectual life, literary entrepreneurship, and the enduring power of the independent bookstore.',
   '3155 W Fifth Ave','Chicago','IL','60624',
   NULL,'https://semicolonchi.com','https://instagram.com/semicolonchi',
   'shop','https://semicolonchi.com','$',2019),

  ('00c00003-0000-0000-0000-000000000017',
   'A South Side Chicago Black bookstore championing African American fiction, history, and culture since 2007. Da Book Joint is a community anchor where readers find books that speak directly to their lives, histories, and imaginations — often titles you won''t find elsewhere.',
   '6900 S Stony Island Ave','Chicago','IL','60637',
   '(877) 726-6556','https://dabookjoint.com','https://instagram.com/dabookjoint',
   'shop','https://dabookjoint.com','$',2007),

  ('00c00003-0000-0000-0000-000000000018',
   'A West Side Chicago space using hip hop culture as a vehicle for healing, community-building, and mental health destigmatization. Coffee Hip Hop & Mental Health hosts workshops, open mics, and counseling sessions rooted in the belief that Black mental health matters and healing can happen in community.',
   NULL,'Chicago','IL',NULL,
   NULL,'https://chhamh.org','https://instagram.com/coffeehiphopandmentalhealth',
   'visit','https://chhamh.org','$',NULL),

  ('00c00003-0000-0000-0000-000000000019',
   'A Black-owned grocery market fighting food insecurity on Chicago''s West Side by providing fresh produce, healthy staples, and affordable groceries to underserved communities. Forty Acres represents the powerful intersection of entrepreneurship, community investment, and food justice.',
   NULL,'Chicago','IL',NULL,
   NULL,'https://fortyacresfreshmarket.com','https://instagram.com/fortyacresfreshmarket',
   'shop','https://fortyacresfreshmarket.com','$',2018),

  ('00c00003-0000-0000-0000-000000000020',
   'A family-owned Black tap dance company preserving Chicago''s vibrant tap dance tradition through world-class performance, education, and community programming. MADD Rhythms celebrates African American rhythmic arts and trains the next generation of Chicago performers.',
   NULL,'Chicago','IL',NULL,
   NULL,'https://maddrhythms.com',NULL,
   'book','https://maddrhythms.com','$$',NULL)

ON CONFLICT (listing_id) DO NOTHING;

COMMIT;
