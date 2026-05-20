# Seed Data Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Approved for implementation
**Audience:** Engineers writing `supabase/seeds/` files; content team preparing launch listings
**Owner:** Engineering + Content
**Source documents:**
- `docs/blacqlist/product/ruthless-mvp-and-roadmap.md`
- `docs/blacqlist/data/entity-content-model.md`

This document defines the seed data strategy for every environment and phase. Engineers must read this document before writing a single seed SQL file. Seed data in the wrong environment — or in the wrong order — will fail on FK constraints or corrupt production.

---

## 1. Seed Data Goals

### What seed data is for

Seed data is not test data. Seed data is the baseline content and configuration the platform requires to function. There are three environments with distinct seed needs:

**Development seed**
Goal: fast iteration. Every entity type, every role, every edge case covered with the minimum number of rows. Synthetic data is acceptable — the goal is to exercise all code paths, not to look real. Engineers should be able to run `supabase db seed` against a fresh local database and have a working platform in under 2 minutes.

**Staging seed**
Goal: realistic volume and quality before production launch. Staging mirrors production closely enough that QA, design review, and pre-launch testing surface real issues. Listing descriptions must be real or near-real. Images must actually be present and formatted correctly. All cities and categories must be populated at production launch targets.

**Production launch seed**
Goal: the product looks alive from day one. Anonymous visitors who land on The BLACQList must immediately see a platform worth using — polished listings, real businesses, well-distributed city and category coverage. Thin or obviously fake seed data at launch kills trust permanently.

### What seed data must NOT do

- Include fake payment data, fake orders, or fake subscription records in any environment
- Include fake admin accounts in production
- Include placeholder review data in production (reviews must reflect real submitted reviews, even if there are zero at launch)
- Include `lorem ipsum` or obviously placeholder text in production listings
- Include synthetic analytics events in production (production analytics must reflect real user activity only)
- Include test user accounts in production
- Be applied in a different order than the dependency sequence defined in Section 8

---

## 2. Minimum Launch Requirements

These are the hard requirements from the MVP spec. The platform does not launch until all of these are met.

| Requirement | Target | Measured by |
|---|---|---|
| Atlanta listings | 150+ | `SELECT COUNT(*) FROM listings WHERE city_id = [atlanta_id] AND status = 'published'` |
| Houston listings | 50+ | Same filter for Houston |
| Chicago listings | 50+ | Same filter for Chicago |
| Image coverage | 40%+ of all listings have at least one image | `media_attachments` row where `entity_type = 'listing'` |
| Claimed listings | 20%+ of listings are claimed or verified | `trust_tier IN ('claimed','verified')` |
| Category coverage | Every active category has at least 3 listings in each launch city | COUNT per `category_id` + `city_id` combination |
| Description quality | Every published listing has a description of 100+ characters | Length check on `listing_details_business.description` |
| CTA completeness | Every published listing has a non-null `cta_type` | Null check on `listing_details_business.cta_type` |

These checks must be run against the staging seed before production seeding begins. A preflight SQL script should be provided with the seed files to validate all requirements before declaring production ready.

---

## 3. Reference Data (Required at Migration)

These tables must be seeded as part of the initial database migration, before any application code runs. They are not optional. Any migration that creates a table depending on these records will fail FK constraints if they are not present.

Reference data is environment-agnostic — the exact same rows run in dev, staging, and production.

### states

All 50 US states plus the District of Columbia. 51 rows. These are static — they never change. Source: standard US Postal Service state codes.

**Minimum rows:** 51
**Source:** Inline SQL in `001_states.sql`
**Required for:** All environments

### cities

Launch cities plus ten additional cities with meaningful Black business community presence. 13 rows at MVP. Additional cities are added via subsequent seed files as the platform expands.

**Minimum rows:** 13 (3 primary + 10 secondary)
**Source:** Manually curated with lat/lng, metro, and state_id foreign keys
**Required for:** All environments
**See Section 6** for the complete city list with full data

### categories

The complete category tree with top-level categories and subcategories. Every published listing must reference a valid `category_id` — if categories are missing, listing creation fails.

**Minimum rows:** 25 top-level categories + approximately 100 subcategories
**Source:** Manually curated in `003_categories.sql` with `parent_id` self-referencing
**Required for:** All environments
**See Section 5** for the complete category tree

### plans

Three tier records defining the Free, Standard, and Premium listing tiers. These must exist before any listing can be created with a tier assignment.

**Minimum rows:** 3
**Source:** Inline SQL in `004_plans.sql`
**Required for:** All environments

| Plan slug | Name | Stripe price ID (dev placeholder) | Notes |
|---|---|---|---|
| `free` | Free | `price_FREE_PLACEHOLDER` | Default for all new listings at MVP |
| `standard` | Standard | `price_STANDARD_PLACEHOLDER` | V1 paid tier — replace placeholder with real Stripe price ID before V1 launch |
| `premium` | Premium | `price_PREMIUM_PLACEHOLDER` | V1 paid tier — replace placeholder with real Stripe price ID before V1 launch |

Stripe price ID placeholders must be replaced with real Stripe price IDs before V1 monetization is activated. The placeholder strings must not appear in production after V1 launch.

---

## 4. Per-Table Seed Needs

### states

**Required for:** Dev, Staging, Production (all environments)
**Minimum rows:** 51
**Source:** Inline SQL
**Quality requirements:**
- All 50 US states + DC
- Two-letter abbreviation (`code`), full name (`name`), and slug (`slug`) — e.g., `'GA'`, `'Georgia'`, `'georgia'`
**Notes:**
- Static reference data — insert once, never update
- If a future migration adds territories (PR, GU, VI), add them in a separate migration with a comment explaining the expansion

---

### cities

**Required for:** Dev, Staging, Production (all environments)
**Minimum rows:** 13 at MVP launch
**Source:** Manually curated CSV or inline SQL
**Quality requirements:**
- Name, slug, state_id (FK), metro_area_name, latitude, longitude, listing target count
- Slugs must be URL-safe kebab-case with state abbreviation suffix: `atlanta-ga`, `houston-tx`
- Lat/lng must be accurate to the city center (use official city hall coordinates)
**Notes:**
- `state_id` FK must be present — `001_states.sql` must run before `002_cities.sql`
- See Section 6 for the complete city list

---

### categories

**Required for:** Dev, Staging, Production (all environments)
**Minimum rows:** 25 top-level + ~100 subcategories
**Source:** Manually curated in seed file
**Quality requirements:**
- Top-level categories: slug, name, display_order, parent_id = NULL
- Subcategories: slug, name, display_order, parent_id = [top-level category ID]
- Insert top-level rows first, then subcategory rows — the `parent_id` self-reference requires parents to exist before children
- Slugs: lowercase kebab-case, unique across all categories including subcategories
**Notes:**
- See Section 5 for the complete category tree
- The total category count is a product decision — do not add categories that do not reflect real business types in the Black community

---

### plans

**Required for:** Dev, Staging, Production (all environments)
**Minimum rows:** 3
**Source:** Inline SQL
**Quality requirements:**
- Stripe price ID fields must contain placeholder values in dev/staging that are clearly not real Stripe IDs
- `is_active` = true for all three at launch
**Notes:**
- Standard and Premium plans exist at MVP as data records even though the payment flow is V1 — this prevents a migration change later
- Replace Stripe price ID placeholders before V1 launch

---

### listings

**Required for:** Staging, Production
**Minimum rows:** 250+ at launch (150 ATL + 50 HOU + 50 CHI = 250 minimum)
**Source:** Manual entry via admin dashboard + CSV import script for bulk seeding
**Quality requirements:**
- Every row must have: `name`, `status = 'published'`, `entity_type = 'business'`, `category_id`, `city_id`, `slug`, `source = 'import'`
- Slug naming convention: `[business-name-kebab]-[city-abbreviation]` — e.g., `sweet-auburn-bbq-atl`, `jts-custom-tailoring-hou`
- City abbreviations: `atl` (Atlanta), `hou` (Houston), `chi` (Chicago)
- No two listings may have the same slug — UNIQUE constraint will reject duplicates
- `trust_tier` distribution: 70% `unclaimed`, 20% `claimed`, 10% `verified` (see Section 7 for rationale)
- `published_at` should be set to the import timestamp — do not leave null for published listings
**Notes:**
- Admin dashboard provides the easiest path for small batches (under 20 listings)
- CSV import script via service_role is the practical path for bulk seeding (50+ listings)
- All listings created by the seed script should have `submitted_by = [admin_user_id]` and `source = 'import'`

---

### listing_details_business

**Required for:** Staging, Production
**Minimum rows:** Matches `listings` count (one row per business listing)
**Source:** Matches listings seed — same import script
**Quality requirements:**
- `description`: minimum 100 characters; ideally 200+ in plain language describing what the business does
- `cta_type`: must be non-null; `'visit'` is the safe default for businesses that have a website; `'call'` for businesses with only a phone number
- `cta_url`: non-null when `cta_type` is not `'call'`; must be a valid `https://` URL
- `phone`, `email`, `website_url`: populate when known; acceptable to leave null for seeded listings with incomplete data — owners will fill in during claim
- `hours`: null is acceptable for seed data unless hours are confirmed; do not fabricate hours
- Address fields: `address_line_1`, `city_text`, `state`, `zip` — populate when the business has a physical location
**Notes:**
- The description quality bar is non-negotiable for production. A listing with a 15-word description looks worse than no description.
- For claimed seed listings: the real owner's description should be used if available; otherwise write a factual 100+ character description from publicly available information

---

### listing_hours

**Required for:** Staging, Production (for businesses with known hours)
**Minimum rows:** As many as have confirmed hours — do not fabricate
**Source:** Publicly available hours from business websites, Google Maps, social media
**Quality requirements:**
- Only create rows where hours are confirmed
- `day_of_week`: integer 0–6 (0 = Sunday, 6 = Saturday) per PostgreSQL `date_part('dow')` convention
- Hours in 24-hour time: `09:00`, `17:00`, `00:00` for midnight
**Notes:**
- Missing hours is acceptable for seed data; fabricated hours that are wrong create immediate bad impressions on launch day
- If the business lists "hours vary" or "by appointment," set a note in `listing_details_business.hours_notes` instead

---

### listing_links

**Required for:** Staging, Production (encouraged; not required)
**Minimum rows:** 0 minimum; aim for 60%+ of listings having at least one link
**Source:** Publicly available links from business websites and social profiles
**Quality requirements:**
- `link_type`: one of the defined enum values (`website`, `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `twitter`, `booking`, `menu`, `order`)
- All URLs must start with `https://` and be validated before insertion
- No placeholder or example URLs — if a URL is not confirmed to be active, do not include it
**Notes:**
- Instagram links are the highest-value social seed links — many Black-owned businesses are Instagram-primary
- Website and Instagram are the two to prioritize in seed data; other socials as available

---

### media_attachments

**Required for:** Staging, Production
**Minimum rows:** Enough to cover 40%+ of listings (100+ at minimum)
**Source:** Real business images sourced with permission; uploaded to `listing-media` bucket during seeding
**Quality requirements:**
- `file_path`: valid Supabase Storage path in the `listing-media` bucket; file must actually exist at that path
- `file_type`: `image/jpeg` or `image/webp` — no PNGs over 2MB in seed data
- `file_size_bytes`: accurate — populated from the actual uploaded file
- `display_order`: 0 for the primary image
- `alt_text`: required for all seed images — describe the actual image content ("Exterior of Sweet Auburn BBQ restaurant in Atlanta")
- `uploaded_by`: set to the admin user's ID who ran the seed script
**Notes:**
- Images must be real, high-quality photos of the actual business. Do not use stock photos of random restaurants or shops — they will look wrong when a user already knows the business.
- For the 40% image coverage requirement: prioritize the most prominent businesses in each city and the most visually compelling categories (food, beauty, fashion)
- All images must be uploaded to Supabase Storage before the seed SQL is run — the `file_path` values in the seed file are storage paths, not URLs

---

### collections

**Required for:** Production (3–5 curated collections at launch)
**Minimum rows:** 3
**Source:** Admin-created; content team curates the lists
**Quality requirements:**
- `title`: descriptive and community-forward ("Atlanta's Best Black-Owned Restaurants", "Black Wellness Businesses in Chicago", "Houston's Black Fashion Designers")
- `slug`: unique, URL-safe (`atlantas-best-black-owned-restaurants`)
- `description`: 2–3 sentence editorial intro explaining why this collection matters
- `is_published`: true for launch collections
**Notes:**
- Collections are the most important editorial seed data. One well-curated collection makes the platform feel editorial and intentional — not just a list.
- The homepage featured collection slot should be one of the Atlanta collections since Atlanta is the primary launch city
- Do not create more than 5 collections at launch — quality over quantity

**Recommended launch collections:**

| Title | City focus | Category focus |
|---|---|---|
| Atlanta's Best Black-Owned Restaurants | Atlanta | Food & Dining |
| Black Wellness & Beauty in Atlanta | Atlanta | Beauty, Wellness |
| Chicago's Black-Owned Businesses to Know | Chicago | Mixed |
| Houston Black Business Spotlight | Houston | Mixed |
| Black Creatives Building in Atlanta | Atlanta | Creative, Professional |

---

### collection_items

**Required for:** Production (for every collection created)
**Minimum rows:** 10–20 per collection (50–100 total for 5 collections)
**Source:** Admin-curated from the published listings seed
**Quality requirements:**
- Every `listing_id` must reference a published listing — no draft or unpublished listings in editorial collections
- `display_order`: set explicitly for each collection; the first item is the "hero" listing of the collection
- A listing can appear in multiple collections — no uniqueness constraint across collections; UNIQUE only within a single collection (`collection_id`, `listing_id`)
**Notes:**
- Collection items cannot be seeded until `012_collections.sql` and `007_listings.sql` have both run

---

### user_roles

**Required for:** Dev, Staging only (not production)
**Minimum rows:** 4 (one per test user)
**Source:** Inline SQL in `006_test_user_roles.sql`
**Quality requirements:**
- One row per test account
- `role` values: `supporter`, `owner`, `admin`, `super_admin`
**Notes:**
- Test user IDs must exist in Supabase Auth before this seed runs
- This file is conditional — the seed run command must skip this file in production environments
- See Section 9 for the test user account definitions

---

### profiles

**Required for:** Dev, Staging only (not production)
**Minimum rows:** 4 (one per test user)
**Source:** Inline SQL in `005_test_users.sql`
**Quality requirements:**
- `display_name`: readable test account names ("Test Supporter", "Test Owner", etc.)
- `id` must match the Supabase Auth `auth.users.id` for each test account
**Notes:**
- Profiles are normally created automatically via a trigger on auth user creation
- For local dev seeding, the trigger may need to be bypassed — insert directly with service_role in the seed script

---

## 5. Category Tree

The category tree defines the seed rows for the `categories` table. Every top-level category receives an `id` (UUID) and `parent_id = NULL`. Every subcategory receives a `parent_id` pointing to its top-level category.

Insert order: all top-level categories first, then subcategories. The `parent_id` self-reference will fail if subcategories are inserted before their parent rows exist.

---

### Food & Dining
- Restaurants
- Bakeries & Pastry Shops
- Cafes & Coffee
- Bars & Lounges
- Catering & Events
- Meal Prep & Delivery
- Food Trucks
- Juice Bars & Smoothies

### Beauty & Grooming
- Hair Salons
- Barber Shops
- Nail Salons & Spas
- Locs & Natural Hair
- Braiding & Extensions
- Estheticians & Skincare
- Makeup Artists
- Men's Grooming

### Wellness & Health
- Fitness Studios
- Personal Trainers
- Yoga & Pilates
- Mental Health & Therapy
- Massage Therapy
- Nutritionists & Dietitians
- Holistic & Integrative Health
- Chiropractic & Physical Therapy

### Fashion & Apparel
- Clothing Boutiques
- Shoe Stores
- Accessories & Jewelry
- Formal & Occasion Wear
- Streetwear & Urban Fashion
- Swimwear & Activewear
- Tailoring & Alterations
- Secondhand & Vintage

### Professional Services
- Law & Legal Services
- Accounting & Tax Preparation
- Financial Planning & Wealth
- Business Consulting
- HR & Staffing
- Notary & Document Services
- Insurance
- Real Estate

### Creative & Media
- Photography
- Videography & Film
- Graphic Design
- Music & Recording
- Visual Art & Illustration
- Content Creation
- Branding & Marketing
- Web & App Design

### Home & Living
- Interior Design
- Furniture & Decor
- Cleaning Services
- Moving & Storage
- Landscaping & Outdoor
- Home Repair & Renovation
- Organizing & Staging
- Smart Home Installation

### Events & Entertainment
- Event Planning
- DJs & Live Music
- Photo & Video Booths
- Catering & Bar Service
- Venue Rental
- Party Supplies & Rentals
- Balloon & Floral Design
- Entertainment Booking

### Education & Tutoring
- Academic Tutoring
- Test Preparation
- Early Childhood Education
- After-School Programs
- College Prep & Counseling
- Music Lessons
- Art Classes
- STEM & Technology Education

### Automotive
- Auto Repair & Mechanics
- Car Detailing
- Towing & Roadside
- Car Rental
- Tire & Wheel Services
- Auto Body & Paint
- Mobile Mechanic

### Childcare & Family
- Childcare Centers
- Nannies & Au Pairs
- Family Counseling
- Pediatric Healthcare
- Tutoring & Educational Support
- Youth Sports & Activities
- Family Photography

### Spiritual & Community
- Churches & Places of Worship
- Non-Profits & Community Organizations
- Youth Programs
- Mentorship Programs
- Cultural Organizations
- Support Groups & Recovery

### Technology
- IT Support & Managed Services
- Software Development
- Cybersecurity
- Data & Analytics
- Tech Consulting
- E-commerce Solutions
- App & Mobile Development

### Healthcare
- Primary Care Physicians
- Dentists
- Vision & Optometry
- Urgent Care
- Mental & Behavioral Health
- Specialty Medicine
- Telehealth Services

### Travel & Transportation
- Travel Agencies
- Car Services & Black Cars
- Shuttle & Airport Transport
- Delivery Services
- Freight & Logistics

### Legal & Financial
- Estate Planning
- Business Formation & Incorporation
- Tax Services
- Credit Repair & Financial Coaching
- Mortgage & Lending

### Pet Services
- Dog Walking & Pet Sitting
- Pet Grooming
- Veterinary Care
- Pet Training
- Pet Supplies & Accessories

### Agriculture & Sustainability
- Urban Farming & Community Gardens
- Organic & Natural Products
- Eco-Friendly Services
- Composting & Recycling
- Plant Shops & Nurseries

### Arts & Culture
- Museums & Galleries
- Theater & Performing Arts
- Poetry & Spoken Word
- Cultural Events & Festivals
- Art Instruction & Workshops

### Books & Publishing
- Bookstores
- Independent Publishers
- Authors & Writers
- Book Clubs & Literary Events
- Self-Publishing Services

### Construction & Trades
- General Contractors
- Electricians
- Plumbing
- HVAC
- Carpentry & Woodworking
- Flooring & Tile
- Painting & Finishing

### Retail & Gifts
- Gift Shops
- Candles & Home Fragrance
- Handmade & Artisan Goods
- Cultural & Heritage Products
- Books & Media
- Health & Wellness Products

### Photography & Videography
- Portrait Photography
- Wedding Photography
- Event Photography
- Commercial Photography
- Real Estate Photography
- Content Creation & Reels

### Social Media & Marketing
- Social Media Management
- Influencer Marketing
- Email Marketing
- SEO & Digital Advertising
- PR & Communications
- Brand Strategy

### Staffing & Workforce
- Temp & Contract Staffing
- Executive Search
- Career Coaching
- Resume & Interview Coaching
- Workforce Development

---

## 6. Launch City List

### Primary Launch Cities

These three cities must be seeded to the minimum listing targets before production launch. Atlanta is the primary focus at 150+ listings.

---

#### Atlanta, GA
- **Slug:** `atlanta-ga`
- **Metro area:** Atlanta–Sandy Springs–Roswell, GA
- **State:** Georgia (GA)
- **City center lat/lng:** 33.7490° N, 84.3880° W
- **Target seed count:** 150+ listings
- **Why Atlanta:** The founding city. Largest Black business district in the US (Sweet Auburn Corridor). Highest concentration of HBCUs in one metro. The BLACQList brand is rooted here — this is the proof of concept city.

#### Houston, TX
- **Slug:** `houston-tx`
- **Metro area:** Houston–The Woodlands–Sugar Land, TX
- **State:** Texas (TX)
- **City center lat/lng:** 29.7604° N, 95.3698° W
- **Target seed count:** 50+ listings
- **Why Houston:** Fourth-largest city in the US; one of the largest Black populations in the South. Strong Black entrepreneurship culture. Major cultural anchor for Texas and the Gulf Coast region.

#### Chicago, IL
- **Slug:** `chicago-il`
- **Metro area:** Chicago–Naperville–Elgin, IL-IN-WI
- **State:** Illinois (IL)
- **City center lat/lng:** 41.8781° N, 87.6298° W
- **Target seed count:** 50+ listings
- **Why Chicago:** Third-largest US metro; historic Black business corridor on the South Side (Bronzeville). Marquette Park, Chatham, Englewood business communities. Strong Midwestern anchor for the platform.

---

### Secondary Launch Cities

These ten cities do not have listing targets at MVP launch but must have valid records in the `cities` table with complete data to support future content and search functionality.

#### Washington, D.C.
- **Slug:** `washington-dc`
- **Metro area:** Washington–Arlington–Alexandria, DC-VA-MD
- **State:** District of Columbia (DC)
- **City center lat/lng:** 38.9072° N, 77.0369° W
- **Target seed count:** 25 listings (post-MVP)
- **Why DC:** Highest percentage of Black residents among major US cities (~46%). Strong federal contractor, legal, and non-profit sector with significant Black professional community. Shaw, U Street, and Anacostia business corridors.

#### Detroit, MI
- **Slug:** `detroit-mi`
- **Metro area:** Detroit–Warren–Dearborn, MI
- **State:** Michigan (MI)
- **City center lat/lng:** 42.3314° N, 83.0458° W
- **Target seed count:** 25 listings (post-MVP)
- **Why Detroit:** 78% Black population — highest of any major US city. Historically significant Black business community; birthplace of Motown. Resurgent entrepreneurship in Midtown and New Center corridors.

#### Baltimore, MD
- **Slug:** `baltimore-md`
- **Metro area:** Baltimore–Columbia–Towson, MD
- **State:** Maryland (MD)
- **City center lat/lng:** 39.2904° N, 76.6122° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Baltimore:** ~64% Black population; significant Black business presence in Cherry Hill, Park Heights, and Upton neighborhoods. Proximity to DC creates a natural two-city cluster.

#### New Orleans, LA
- **Slug:** `new-orleans-la`
- **Metro area:** New Orleans–Metairie, LA
- **State:** Louisiana (LA)
- **City center lat/lng:** 29.9511° N, 90.0715° W
- **Target seed count:** 20 listings (post-MVP)
- **Why New Orleans:** Treme is the oldest Black neighborhood in the US; iconic Black-owned food, music, and cultural businesses. Strong community identity and strong buy-Black culture. Unique Creole and Louisiana culture creates distinctive listing content.

#### Memphis, TN
- **Slug:** `memphis-tn`
- **Metro area:** Memphis, TN-MS-AR
- **State:** Tennessee (TN)
- **City center lat/lng:** 35.1495° N, 90.0490° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Memphis:** ~64% Black population; historically significant for civil rights and Black culture (Beale Street, Soulsville). Growing entrepreneurship on South Main and in Midtown.

#### Philadelphia, PA
- **Slug:** `philadelphia-pa`
- **Metro area:** Philadelphia–Camden–Wilmington, PA-NJ-DE-MD
- **State:** Pennsylvania (PA)
- **City center lat/lng:** 39.9526° N, 75.1652° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Philadelphia:** Large Black population (~44%); North Philly and West Philly Black business corridors. Strong arts, music, and food entrepreneurship community.

#### Charlotte, NC
- **Slug:** `charlotte-nc`
- **Metro area:** Charlotte–Concord–Gastonia, NC-SC
- **State:** North Carolina (NC)
- **City center lat/lng:** 35.2271° N, 80.8431° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Charlotte:** Rapidly growing; ~36% Black population and one of the fastest-growing Black professional communities in the Southeast. Strong banking, finance, and healthcare sectors with significant Black ownership. Proximity to the broader Carolinas market.

#### Dallas, TX
- **Slug:** `dallas-tx`
- **Metro area:** Dallas–Fort Worth–Arlington, TX
- **State:** Texas (TX)
- **City center lat/lng:** 32.7767° N, 96.7970° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Dallas:** Second-largest Texas city; strong Black business community in South Dallas, Oak Cliff, and Desoto. With Houston already in the primary set, Dallas anchors North Texas and creates statewide Texas coverage.

#### Miami, FL
- **Slug:** `miami-fl`
- **Metro area:** Miami–Fort Lauderdale–Pompano Beach, FL
- **State:** Florida (FL)
- **City center lat/lng:** 25.7617° N, 80.1918° W
- **Target seed count:** 20 listings (post-MVP)
- **Why Miami:** Diverse Black community including Caribbean-American, Haitian-American, and African-American communities. Opa-locka, Liberty City, Overtown neighborhoods. Strong tourism and entertainment Black business presence.

#### Los Angeles, CA
- **Slug:** `los-angeles-ca`
- **Metro area:** Los Angeles–Long Beach–Anaheim, CA
- **State:** California (CA)
- **City center lat/lng:** 34.0522° N, 118.2437° W
- **Target seed count:** 25 listings (post-MVP)
- **Why Los Angeles:** Largest Black population by absolute count in the West. Crenshaw, Leimert Park, and Inglewood Black business communities. Strong creative industry Black entrepreneurship — aligns with the platform's creative professional entity type.

---

## 7. Listing Quality Standards

A seed listing is "complete enough to be searchable and useful" when it meets all of the following criteria.

### Required for search indexing

- `name` — not null, not empty
- `listing_details_business.description` — 100+ characters; plain language; describes what the business does, not who they are
- `category_id` — valid FK to an active category
- `city_id` — valid FK to a seeded city
- `entity_type = 'business'` at MVP
- `status = 'published'`

### Required for public display

- `trust_tier` — minimum `'unclaimed'`; the field must be explicitly set (not left as whatever the default is)
- `listing_details_business.cta_type` — explicitly set; `'visit'` is the safe default for businesses with a website; `'call'` for businesses with only a phone number
- `listing_details_business.cta_url` — non-null when `cta_type` is not `'call'`

### Required for image coverage target

- At least one `media_attachments` row with `entity_type = 'listing'` and `entity_id = [listing.id]`
- The corresponding image file must exist in the `listing-media` Supabase Storage bucket

### Trust tier distribution for seed data

The 70/20/10 split models the realistic real-world state of a business directory at launch:

| Trust tier | Target percentage | Reasoning |
|---|---|---|
| `unclaimed` | 70% | Most businesses discovered during research have not yet interacted with the platform — this is normal and honest |
| `claimed` | 20% | Businesses the team has contacted and onboarded before launch; these have real owner accounts |
| `verified` | 10% | Businesses that went through document review during the seeding process; demonstrates the verification system works |

`certified` is not achievable at launch — it requires 6+ published reviews and 90+ days active. No seed listings will be `certified` at launch.

### Description quality standard

At minimum:
- 100 characters
- Plain language — written for a community member, not a search engine
- Describes what the business does: cuisine type, specialties, who it serves, what makes it distinctive
- Does not start with the business name
- Does not contain "lorem ipsum" or template placeholder text

Preferred (200+ characters):
- Includes the neighborhood or area of the city
- Mentions 2–3 specific things the business is known for
- Has a voice that matches the business's community standing

Example of an acceptable seed description (107 characters):
> "Family-owned soul food restaurant on Atlanta's Westside. Known for smothered chicken, mac & cheese, and homemade cornbread."

Example of an unacceptable seed description:
> "Black-owned restaurant in Atlanta serving great food."

### Slug naming convention

`[business-name-kebab]-[city-abbreviation]`

| City | Abbreviation |
|---|---|
| Atlanta | `atl` |
| Houston | `hou` |
| Chicago | `chi` |
| Washington DC | `dc` |
| Detroit | `det` |
| Baltimore | `balt` |
| New Orleans | `nola` |
| Memphis | `mem` |
| Philadelphia | `phi` |
| Charlotte | `clt` |
| Dallas | `dal` |
| Miami | `mia` |
| Los Angeles | `la` |

Examples:
- `sweet-auburn-bbq-atl`
- `jade-nails-spa-hou`
- `bronzeville-coffee-chi`
- `capital-cuts-dc`

When two businesses would generate the same slug (e.g., two listings named "The Spot"), append a numeric suffix: `the-spot-atl-2`.

---

## 8. Seed Script Strategy

### File location

```
[project-root]/supabase/seeds/
```

### Naming convention

Zero-padded numeric prefix for dependency ordering, followed by a descriptive name:

```
001_states.sql
002_cities.sql
003_categories.sql
004_plans.sql
005_test_users.sql           ← Dev + Staging only
006_test_user_roles.sql      ← Dev + Staging only
007_listings.sql
008_listing_details_business.sql
009_listing_hours.sql
010_listing_links.sql
011_media_attachments.sql
012_collections.sql
013_collection_items.sql
```

### Run command

```bash
supabase db seed
```

This command runs all SQL files in `supabase/seeds/` in lexicographic (numeric) order.

For production runs that must skip test user files:

```bash
# Run only reference data for production — skip test files 005 and 006
psql $DATABASE_URL < supabase/seeds/001_states.sql
psql $DATABASE_URL < supabase/seeds/002_cities.sql
psql $DATABASE_URL < supabase/seeds/003_categories.sql
psql $DATABASE_URL < supabase/seeds/004_plans.sql
# 005 and 006 intentionally skipped
psql $DATABASE_URL < supabase/seeds/007_listings.sql
# ... and so on
```

A production seed runbook should document this exact command sequence.

### Dependency order (must be followed)

FK constraints will fail if seed files run out of order.

| Order | File | Dependencies |
|---|---|---|
| 1 | `001_states.sql` | None |
| 2 | `002_cities.sql` | `states` table must exist and have rows |
| 3 | `003_categories.sql` | None for top-level; parent rows must be inserted before subcategory rows within the file |
| 4 | `004_plans.sql` | None |
| 5 | `005_test_users.sql` | Supabase Auth `auth.users` must be set up; test accounts must be created in Supabase Auth first |
| 6 | `006_test_user_roles.sql` | `user_roles` table must exist; test user UUIDs from `005` must be known |
| 7 | `007_listings.sql` | `cities`, `categories` tables must have rows |
| 8 | `008_listing_details_business.sql` | `listings` table must have rows |
| 9 | `009_listing_hours.sql` | `listings` table must have rows |
| 10 | `010_listing_links.sql` | `listings` table must have rows |
| 11 | `011_media_attachments.sql` | `listings` table must have rows; Storage files must be uploaded before this seed runs |
| 12 | `012_collections.sql` | None (no FK dependencies except `created_by` FK to `users` — use admin user ID) |
| 13 | `013_collection_items.sql` | `collections` and `listings` tables must have rows |

### Idempotency

All seed files must be idempotent — running the same file twice must not create duplicate records or raise errors.

Use `INSERT ... ON CONFLICT DO NOTHING` for reference data:

```sql
INSERT INTO states (id, code, name, slug)
VALUES
  (gen_random_uuid(), 'GA', 'Georgia', 'georgia'),
  (gen_random_uuid(), 'TX', 'Texas', 'texas')
ON CONFLICT (code) DO NOTHING;
```

For entities with natural unique keys (states by `code`, cities by `slug`, categories by `slug`), the `ON CONFLICT` target is the UNIQUE constraint column.

For listings seeded with a known slug, use `ON CONFLICT (slug) DO NOTHING` so re-running the seed does not duplicate rows.

### Preflight validation script

Before declaring the production seed complete, run this preflight check:

```sql
-- Minimum listing counts by city
SELECT c.name AS city, COUNT(l.id) AS listing_count
FROM listings l
JOIN cities c ON l.city_id = c.id
WHERE l.status = 'published' AND l.deleted_at IS NULL
GROUP BY c.name
ORDER BY listing_count DESC;

-- Image coverage percentage
SELECT
  ROUND(
    (COUNT(DISTINCT ma.entity_id)::decimal / COUNT(DISTINCT l.id)) * 100, 1
  ) AS image_coverage_pct
FROM listings l
LEFT JOIN media_attachments ma ON ma.entity_id = l.id AND ma.entity_type = 'listing'
WHERE l.status = 'published' AND l.deleted_at IS NULL;

-- Trust tier distribution
SELECT trust_tier, COUNT(*) AS count, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM listings
WHERE status = 'published' AND deleted_at IS NULL
GROUP BY trust_tier;

-- Category coverage (every category has 3+ listings per launch city)
SELECT cat.name AS category, c.name AS city, COUNT(l.id) AS listing_count
FROM listings l
JOIN categories cat ON l.category_id = cat.id
JOIN cities c ON l.city_id = c.id
WHERE l.status = 'published' AND l.deleted_at IS NULL
  AND c.slug IN ('atlanta-ga', 'houston-tx', 'chicago-il')
GROUP BY cat.name, c.name
HAVING COUNT(l.id) < 3
ORDER BY listing_count ASC;
-- This query should return zero rows when launch criteria are met.

-- Listings missing CTA
SELECT COUNT(*) AS listings_missing_cta
FROM listing_details_business ldb
JOIN listings l ON ldb.listing_id = l.id
WHERE l.status = 'published' AND l.deleted_at IS NULL
  AND ldb.cta_type IS NULL;
-- Should return 0.
```

---

## 9. Test User Accounts (Dev and Staging Only)

These accounts support development and QA workflows. They must never be seeded in production.

| User | Email | Role | Purpose |
|---|---|---|---|
| Test Supporter | `supporter@test.blacqlist.dev` | `supporter` | Test browsing, saving listings, submitting receipts |
| Test Owner | `owner@test.blacqlist.dev` | `owner` | Test listing management, analytics dashboard, CTA configuration |
| Test Admin | `admin@test.blacqlist.dev` | `admin` | Test moderation queue, claim approvals, listing management |
| Test Super Admin | `superadmin@test.blacqlist.dev` | `super_admin` | Test full platform access, audit log, role assignment |

### Passwords

All test accounts use password `TestPassword123!` in dev and staging. This password must be changed immediately if the staging environment URL is shared with any external reviewer, QA contractor, or investor.

### Test Owner setup requirement

The test owner account must have at least one claimed and published listing in staging. Without this, the owner dashboard tests are not meaningful. The seed script (`008_listing_details_business.sql`) must include at least one listing with `owner_user_id` set to the test owner's UUID.

### Creation procedure

Test users must be created in Supabase Auth before the seed script runs (because `profiles` and `user_roles` rows reference `auth.users.id` via FK). The creation procedure is:

1. Create the four test user accounts in Supabase Auth via the Supabase Studio Auth tab or via the admin API
2. Note the auto-generated UUID for each account
3. Update `005_test_users.sql` with the correct UUIDs
4. Run `supabase db seed`

This means `005_test_users.sql` is not fully self-contained — it requires the UUIDs to be known before running. The seed file should include commented placeholder UUIDs with clear instructions to replace them.

---

## 10. What NOT to Seed in Production

This list is explicit and non-negotiable. A production seed review must check every item on this list before the seed is applied.

- Test user accounts (`supporter@test.blacqlist.dev`, `owner@test.blacqlist.dev`, `admin@test.blacqlist.dev`, `superadmin@test.blacqlist.dev`) — must not appear in production `profiles` or `user_roles`
- Any user account with email `@test.*` or `@example.*`
- Fake admin or super_admin `user_roles` rows that are not real founding team members
- Placeholder Stripe price IDs in active (paid tier) plan records — acceptable in the `plans` table as placeholder strings since monetization is V1, but must be replaced before V1 launch
- Listings with `lorem ipsum` or template placeholder descriptions
- Fabricated business hours that do not reflect actual business hours
- Placeholder URLs (e.g., `https://example.com`, `https://yourwebsite.com`) in `listing_links` or `listing_details_business.website_url`
- Dummy or stock photography that does not actually depict the listed business
- Synthetic `analytics_events` rows — production analytics must reflect real user activity
- Synthetic `search_events` rows
- Fake review records in the `reviews` table, even with `status = 'pending'`
- Fake `saves` records
- Test `orders` or `subscriptions` records
- Fake `spend_events` records
- Any record with a clearly test-environment value in a field that is displayed publicly (e.g., "Test Business Name" as a listing `name`)

---

*Document complete. Next: implement seed files in `supabase/seeds/` following the dependency order in Section 8, then validate with the preflight script in Section 8 before production deployment.*
