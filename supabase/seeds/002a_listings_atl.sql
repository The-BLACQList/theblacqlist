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
