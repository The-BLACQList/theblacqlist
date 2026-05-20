-- =============================================================================
-- Migration: 20260510000000_initial_blacqlist_mvp_schema.sql
-- Product: The BLACQList
-- Description: Initial MVP schema — 23 tables covering Identity, Entities,
--              Discovery, Community Engagement, Editorial, Analytics, and Admin
-- Date: 2026-05-10
-- Author: Schema Data Agent
-- Dependencies: Supabase Auth (auth.users must exist before this migration runs)
-- =============================================================================
--
-- NAMING CONVENTION NOTE:
-- The product team uses "entity" terminology (entity_*, entity_claims, etc.)
-- All database tables use the official "listing_*" prefix convention.
-- Full mapping is documented in migration-001-report.md.
--
-- TABLE DEPENDENCY ORDER (FK-safe):
--  1. states
--  2. cities
--  3. categories
--  4. plans
--  5. profiles
--  6. listings
--  7. listing_details_business
--  8. user_roles
--  9. services
-- 10. media_attachments
-- 11. listing_hours
-- 12. listing_links
-- 13. claims
-- 14. ALTER TABLE listings ADD CONSTRAINT claim_id FK (deferred circular)
-- 15. saves
-- 16. reviews
-- 17. collections
-- 18. collection_items
-- 19. analytics_events
-- 20. search_events
-- 21. entity_analytics_daily
-- 22. admin_audit_log
-- 23. moderation_queue
-- =============================================================================

-- Enable trigram extension for fuzzy/full-text search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- SHARED TRIGGER FUNCTION: update_updated_at
-- Applied to every table that has an updated_at column.
-- Write once; reference in every trigger below.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE 1: states
-- Reference data for US states and DC.
-- No application writes — populated entirely via seed data.
-- =============================================================================
CREATE TABLE states (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  code       text        NOT NULL,  -- 2-char USPS code e.g. 'GA', 'TX', 'DC'
  country    text        NOT NULL DEFAULT 'US',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX states_code_idx ON states (code);

ALTER TABLE states ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read all state records (public reference data)
CREATE POLICY "states: public read"
  ON states FOR SELECT
  TO anon, authenticated
  USING (true);


-- =============================================================================
-- TABLE 2: cities
-- Launch cities and secondary market cities. Controls which markets are active
-- and visible on the platform. Populated via seed data.
-- =============================================================================
CREATE TABLE cities (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  slug         text        NOT NULL,  -- URL-safe, e.g. 'atlanta-ga'
  state_id     uuid        NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
  metro_area   text,                  -- e.g. 'Atlanta Metro'
  latitude     numeric(10,6) NOT NULL,
  longitude    numeric(10,6) NOT NULL,
  population   integer,
  is_active    boolean     NOT NULL DEFAULT false,
  launch_phase text        NOT NULL DEFAULT 'later'
                           CHECK (launch_phase IN ('launch','v1','v2','later')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cities_slug_idx     ON cities (slug);
CREATE INDEX cities_state_id_idx        ON cities (state_id);
CREATE INDEX cities_is_active_idx       ON cities (is_active) WHERE is_active = true;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read all city records (public reference data)
CREATE POLICY "cities: public read"
  ON cities FOR SELECT
  TO anon, authenticated
  USING (true);


-- =============================================================================
-- TABLE 3: categories
-- Self-referencing category tree. Top-level categories have parent_id = NULL.
-- Subcategories point to a top-level parent. No deeper nesting at MVP.
-- =============================================================================
CREATE TABLE categories (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  parent_id     uuid        REFERENCES categories(id) ON DELETE SET NULL,
  description   text,
  icon          text,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX categories_slug_idx          ON categories (slug);
CREATE INDEX categories_parent_id_idx            ON categories (parent_id);
CREATE INDEX categories_display_order_idx        ON categories (parent_id, display_order);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read active categories
CREATE POLICY "categories: public read active"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true);


-- =============================================================================
-- TABLE 4: plans
-- Listing tier plans. Free, Standard, Premium.
-- Stripe price IDs are placeholder values at MVP — replace before V1 launch.
-- =============================================================================
CREATE TABLE plans (
  id                       uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                     text           NOT NULL
                                          CHECK (name IN ('free','standard','premium')),
  price_monthly            numeric(10,2)  NOT NULL DEFAULT 0,
  price_yearly             numeric(10,2)  NOT NULL DEFAULT 0,
  features                 jsonb          NOT NULL DEFAULT '[]',
  stripe_price_id_monthly  text,          -- NULL for free plan; replace placeholder before V1
  stripe_price_id_yearly   text,          -- NULL for free plan; replace placeholder before V1
  is_active                boolean        NOT NULL DEFAULT true,
  display_order            integer        NOT NULL DEFAULT 0,
  created_at               timestamptz    NOT NULL DEFAULT now(),
  updated_at               timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plans_name_idx ON plans (name);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read active plans (pricing page)
CREATE POLICY "plans: public read active"
  ON plans FOR SELECT
  TO anon, authenticated
  USING (is_active = true);


-- =============================================================================
-- TABLE 5: profiles
-- Public-facing user profile. One row per auth.users record.
-- Created automatically via trigger on auth.users INSERT.
-- PII fields: display_name, avatar_url, bio
-- =============================================================================
CREATE TABLE profiles (
  id           uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,                  -- PII: public display name shown on reviews and saves
  avatar_url   text,                  -- Storage path in 'avatars' bucket — not a URL
  bio          text,                  -- PII: optional short bio
  city_id      uuid        REFERENCES cities(id) ON DELETE SET NULL,
  website_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_city_id_idx ON profiles (city_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and update their own profile
CREATE POLICY "profiles: owner read and update"
  ON profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- NOTE: anon access to profiles (for public profile pages) is deferred to V1
-- when owner public profile pages are built. No anon SELECT policy at MVP.


-- =============================================================================
-- TRIGGER: Auto-create profile row on auth user registration
-- Fires AFTER INSERT on auth.users. Creates the corresponding profiles row.
-- SECURITY DEFINER is required because auth.users is in the auth schema.
-- =============================================================================
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (id) DO NOTHING;  -- idempotent: safe to re-run
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();


-- =============================================================================
-- TRIGGER: Assign default 'supporter' role on auth user registration
-- Fires AFTER INSERT on auth.users. Creates user_roles row with role='supporter'.
-- user_roles table is created later but this trigger function fires after that
-- table exists at runtime. The trigger is defined after user_roles is created.
-- =============================================================================
-- (Defined after user_roles table — see below)


-- =============================================================================
-- TABLE 6: listings
-- The central entity table. Every business, professional, creative, event, job,
-- or vendor on the platform has exactly one row here. Entity-type-specific fields
-- live in listing_details_* extension tables.
--
-- CIRCULAR FK NOTE: claim_id references claims(id). The claims table also
-- references listings(id). This circular dependency is resolved by:
--   1. Creating listings WITHOUT the claim_id FK constraint
--   2. Creating the claims table later
--   3. Adding the claim_id FK via ALTER TABLE after claims exists
--
-- PII: owner_user_id, submitted_by, updated_by are FK references to auth users.
-- =============================================================================
CREATE TABLE listings (
  id                            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                          text        NOT NULL,
  slug                          text        NOT NULL,
  entity_type                   text        NOT NULL
                                            CHECK (entity_type IN ('business','professional','creative','event','job','vendor')),
  tagline                       text,
  category_id                   uuid        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_ids               uuid[],     -- array of additional category UUIDs (not FK-enforced at DB layer)
  city_id                       uuid        REFERENCES cities(id) ON DELETE SET NULL,
  location_type                 text        NOT NULL DEFAULT 'physical'
                                            CHECK (location_type IN ('physical','online','hybrid','virtual-services','ships-nationwide')),
  service_area_description      text,
  ships_nationwide              boolean     NOT NULL DEFAULT false,

  -- Status and lifecycle
  status                        text        NOT NULL DEFAULT 'draft'
                                            CHECK (status IN ('draft','pending','published','unpublished','flagged','archived')),
  tier                          text        NOT NULL DEFAULT 'free'
                                            CHECK (tier IN ('free','standard','premium')),
  source                        text        NOT NULL DEFAULT 'owner'
                                            CHECK (source IN ('owner','community','admin','import')),
  published_at                  timestamptz,

  -- Trust and verification
  trust_tier                    text        NOT NULL DEFAULT 'unclaimed'
                                            CHECK (trust_tier IN ('unclaimed','claimed','verified','certified')),
  claim_id                      uuid,       -- FK added via ALTER TABLE after claims table exists
  verified_at                   timestamptz,
  verified_by                   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  certification_auto_granted_at timestamptz,

  -- Moderation and flags
  flag_status                   text        NOT NULL DEFAULT 'none'
                                            CHECK (flag_status IN ('none','inactive','duplicate','incorrect','spam')),
  admin_notes                   text,
  moderation_notes              text,

  -- Sponsored and featured placement
  is_featured                   boolean     NOT NULL DEFAULT false,
  is_sponsored                  boolean     NOT NULL DEFAULT false,
  sponsored_expires_at          timestamptz,
  sponsored_placement_type      text        CHECK (sponsored_placement_type IN ('homepage','search','category','city')),

  -- Verification workflow
  verification_status           text        NOT NULL DEFAULT 'none'
                                            CHECK (verification_status IN ('none','pending','under_review','verified','rejected')),
  verification_docs             text[],     -- array of Supabase Storage paths
  verification_notes            text,

  -- SEO and metadata
  meta_title                    text,
  meta_description              text,
  og_image_path                 text,       -- Supabase Storage path — not a URL
  canonical_url                 text,
  json_ld_type                  text,
  sitemap_include               boolean     NOT NULL DEFAULT true,
  noindex                       boolean     NOT NULL DEFAULT false,

  -- Media
  logo_path                     text,       -- Supabase Storage path — not a URL
  cover_image_path              text,       -- Supabase Storage path — not a URL

  -- Lifecycle timestamps
  last_edited_by_owner_at       timestamptz,
  last_admin_updated_at         timestamptz,
  auto_archive_at               timestamptz,
  auto_expire_at                timestamptz,
  stale_flagged_at              timestamptz,

  -- Vendor flag
  is_vendor                     boolean     NOT NULL DEFAULT false,

  -- Denormalized stats (maintained by triggers on saves and reviews tables)
  review_count                  integer     NOT NULL DEFAULT 0,
  avg_rating                    numeric(3,2),
  save_count                    integer     NOT NULL DEFAULT 0,
  view_count                    integer     NOT NULL DEFAULT 0,

  -- Authorship audit
  owner_user_id                 uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Standard audit fields
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz,  -- soft delete; NULL = active

  -- Full-text search vector (updated by trigger)
  search_vector                 tsvector
);

-- Unique and standard indexes
CREATE UNIQUE INDEX listings_slug_idx         ON listings (slug);
CREATE INDEX listings_search_vector_idx       ON listings USING GIN (search_vector);
CREATE INDEX listings_status_idx              ON listings (status);
CREATE INDEX listings_entity_type_idx         ON listings (entity_type);
CREATE INDEX listings_city_id_idx             ON listings (city_id);
CREATE INDEX listings_category_id_idx         ON listings (category_id);
CREATE INDEX listings_owner_user_id_idx       ON listings (owner_user_id);
CREATE INDEX listings_trust_tier_idx          ON listings (trust_tier);

-- Partial indexes for efficient filtered queries
CREATE INDEX listings_is_featured_idx         ON listings (id) WHERE is_featured = true;
CREATE INDEX listings_is_sponsored_idx        ON listings (id) WHERE is_sponsored = true;
CREATE INDEX listings_deleted_at_idx          ON listings (id) WHERE deleted_at IS NULL;
CREATE INDEX listings_auto_archive_at_idx     ON listings (auto_archive_at) WHERE auto_archive_at IS NOT NULL;
CREATE INDEX listings_auto_expire_at_idx      ON listings (auto_expire_at) WHERE auto_expire_at IS NOT NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- anon can read published, non-deleted listings
CREATE POLICY "listings: anon read published"
  ON listings FOR SELECT
  TO anon
  USING (status = 'published' AND deleted_at IS NULL);

-- authenticated can read published/non-deleted listings plus their own listings at any status
CREATE POLICY "listings: authenticated read published or own"
  ON listings FOR SELECT
  TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR owner_user_id = auth.uid()
  );

-- authenticated users can insert new listings (start as draft)
CREATE POLICY "listings: authenticated insert"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- owners can update their own listings
CREATE POLICY "listings: owner update"
  ON listings FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- No DELETE policy for authenticated — soft delete only via service role


-- =============================================================================
-- TRIGGER: Update search_vector on listings INSERT or UPDATE
-- Weights: A = name, B = tagline, D = service_area_description
-- NOTE: description lives in listing_details_business — cannot be included here.
-- Add a separate trigger on listing_details_business if full-text over
-- description is required (deferred to V1).
-- =============================================================================
CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_search_vector_update
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_listings_search_vector();


-- =============================================================================
-- TABLE 7: listing_details_business
-- One-to-one extension table for business entity type.
-- listing_id is both PK and FK — this enforces exactly one detail row per listing.
-- =============================================================================
CREATE TABLE listing_details_business (
  listing_id              uuid        NOT NULL PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  description             text,
  hours                   jsonb,
  -- hours expected shape: {"monday": {"open": "09:00", "close": "17:00", "closed": false}, ...}
  hours_notes             text,
  address_line_1          text,
  address_line_2          text,
  city_text               text,
  state                   text,       -- 2-char state abbreviation
  zip                     text,
  lat                     numeric,
  lng                     numeric,
  phone                   text,       -- PII: stored as provided; format not enforced at DB layer
  email                   text,       -- PII
  website_url             text,
  social_instagram        text,
  social_facebook         text,
  social_linkedin         text,
  social_tiktok           text,
  social_youtube          text,
  social_twitter          text,
  cta_type                text        NOT NULL DEFAULT 'visit'
                                      CHECK (cta_type IN ('book','order','call','message','visit','get-quote','shop','subscribe','contact')),
  cta_url                 text,
  cta_label_override      text,
  ships_nationwide        boolean     NOT NULL DEFAULT false,
  accepts_reservations    boolean,
  price_range             text        CHECK (price_range IN ('$','$$','$$$','$$$$')),
  founded_year            integer     CHECK (founded_year >= 1800 AND founded_year <= 2100),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- No additional indexes needed; PK on listing_id covers all FK join lookups.

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_details_business
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_details_business ENABLE ROW LEVEL SECURITY;

-- anon can read details for published listings
CREATE POLICY "listing_details_business: anon read published"
  ON listing_details_business FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

-- authenticated can read published or own listing details
CREATE POLICY "listing_details_business: authenticated read"
  ON listing_details_business FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND (
          (listings.status = 'published' AND listings.deleted_at IS NULL)
          OR listings.owner_user_id = auth.uid()
        )
    )
  );

-- owners can insert and update their own listing details
CREATE POLICY "listing_details_business: owner write"
  ON listing_details_business FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_details_business: owner update"
  ON listing_details_business FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TABLE 8: user_roles
-- Role assignments per user. One row per (user_id, role, listing_id) combination.
-- listing_id is NULL for platform-wide roles (supporter, admin, super_admin).
-- listing_id is set for listing-scoped roles (owner, editor).
-- =============================================================================
CREATE TABLE user_roles (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('supporter','owner','editor','admin','super_admin')),
  listing_id  uuid        REFERENCES listings(id) ON DELETE CASCADE,
  granted_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, role, listing_id)
);

CREATE INDEX user_roles_user_id_idx    ON user_roles (user_id);
CREATE INDEX user_roles_listing_id_idx ON user_roles (listing_id) WHERE listing_id IS NOT NULL;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- authenticated users can read their own role assignments
CREATE POLICY "user_roles: authenticated read own"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated — role management via service role only


-- =============================================================================
-- TRIGGER: Assign default 'supporter' role on auth user registration
-- Defined here because user_roles table now exists.
-- =============================================================================
CREATE OR REPLACE FUNCTION assign_supporter_role_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'supporter', now())
  ON CONFLICT (user_id, role, listing_id) DO NOTHING;  -- idempotent guard
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_supporter_role_on_signup();


-- =============================================================================
-- TABLE 9: services
-- Individual services or offerings listed under a business entity.
-- Child records of listings; cascade-deleted with the parent.
-- =============================================================================
CREATE TABLE services (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  price_display text,       -- human-readable: '$50', '$50–$100', 'Starting at $50', 'Free'
  is_featured   boolean     NOT NULL DEFAULT false,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_listing_id_idx ON services (listing_id, display_order);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- anon and authenticated can read services for published listings
CREATE POLICY "services: read for published listings"
  ON services FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

-- owners can write services for their listings
CREATE POLICY "services: owner insert"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "services: owner update"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "services: owner delete"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TABLE 10: media_attachments
-- Polymorphic media table for listings, reviews, and user uploads.
-- entity_id has no formal FK (polymorphic pattern); referential integrity is
-- enforced at the service layer.
-- Store storage path only; generate signed/public URLs at read time.
-- =============================================================================
CREATE TABLE media_attachments (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type           text        NOT NULL CHECK (entity_type IN ('listing','product','review','user')),
  entity_id             uuid        NOT NULL,  -- polymorphic; no formal FK
  file_path             text        NOT NULL,  -- Supabase Storage path — NOT the URL
  file_type             text        NOT NULL,  -- MIME type: 'image/jpeg', 'image/webp', etc.
  file_size_bytes       integer     NOT NULL,
  width                 integer,
  height                integer,
  alt_text              text,
  display_order         integer     NOT NULL DEFAULT 0,
  is_portfolio_primary  boolean     NOT NULL DEFAULT false,
  is_approved           boolean     NOT NULL DEFAULT true,
  uploaded_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_entity_idx                ON media_attachments (entity_type, entity_id);
CREATE INDEX media_attachments_uploaded_by_idx ON media_attachments (uploaded_by);

ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;

-- anon can read approved media for listings (service layer enforces published listing check)
CREATE POLICY "media_attachments: anon read approved listing media"
  ON media_attachments FOR SELECT
  TO anon
  USING (entity_type = 'listing' AND is_approved = true);

-- authenticated can read approved listing media
CREATE POLICY "media_attachments: authenticated read approved"
  ON media_attachments FOR SELECT
  TO authenticated
  USING (is_approved = true);

-- authenticated can upload media (service layer validates ownership of entity)
CREATE POLICY "media_attachments: authenticated insert"
  ON media_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- authenticated can delete their own uploads
CREATE POLICY "media_attachments: authenticated delete own"
  ON media_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());


-- =============================================================================
-- TABLE 11: listing_hours
-- Structured business hours rows, one row per day of week per listing.
-- Separate from listing_details_business.hours (JSONB) — this is the normalized
-- version for programmatic queries ("is this business open now?").
-- =============================================================================
CREATE TABLE listing_hours (
  id           uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id   uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday, 6=Saturday
  opens_at     time    NOT NULL,
  closes_at    time    NOT NULL,
  is_closed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (listing_id, day_of_week)
);

CREATE INDEX listing_hours_listing_id_idx ON listing_hours (listing_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_hours ENABLE ROW LEVEL SECURITY;

-- Same access pattern as listing_details_business
CREATE POLICY "listing_hours: anon read published"
  ON listing_hours FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

CREATE POLICY "listing_hours: authenticated read"
  ON listing_hours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND (
          (listings.status = 'published' AND listings.deleted_at IS NULL)
          OR listings.owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "listing_hours: owner write"
  ON listing_hours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_hours: owner update"
  ON listing_hours FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_hours: owner delete"
  ON listing_hours FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TABLE 12: listing_links
-- External links associated with a listing: website, social profiles,
-- booking pages, menus, etc. Multiple links of the same type are allowed.
-- =============================================================================
CREATE TABLE listing_links (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  link_type     text        NOT NULL CHECK (link_type IN (
                              'website','instagram','facebook','tiktok','youtube',
                              'linkedin','twitter','booking','menu','order','other'
                            )),
  url           text        NOT NULL,
  label         text,       -- optional custom label overriding the default display label
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_links_listing_id_idx ON listing_links (listing_id, display_order);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_links ENABLE ROW LEVEL SECURITY;

-- anon and authenticated can read links for published listings
CREATE POLICY "listing_links: read for published listings"
  ON listing_links FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.status = 'published'
        AND listings.deleted_at IS NULL
    )
  );

-- owners can manage links for their listings
CREATE POLICY "listing_links: owner insert"
  ON listing_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_links: owner update"
  ON listing_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "listing_links: owner delete"
  ON listing_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- =============================================================================
-- TABLE 13: claims
-- Ownership claim submissions. A user submits a claim on an unclaimed listing.
-- After admin approval, the listing's trust_tier advances to 'claimed' and
-- owner_user_id is set to the claimant.
-- =============================================================================
CREATE TABLE claims (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id             uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  claimant_user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status                 text        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','under_review','approved','rejected','withdrawn')),
  submitted_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at            timestamptz,
  reviewed_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason       text,
  verification_doc_paths text[],     -- array of Supabase Storage paths for verification documents
  notes                  text,       -- internal admin notes; not visible to claimant
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claims_listing_id_idx        ON claims (listing_id);
CREATE INDEX claims_claimant_user_id_idx  ON claims (claimant_user_id);
CREATE INDEX claims_status_idx            ON claims (status) WHERE status IN ('pending','under_review');

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- authenticated users can submit claims
CREATE POLICY "claims: authenticated insert"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (claimant_user_id = auth.uid());

-- authenticated users can read their own claims (track status of submitted claim)
CREATE POLICY "claims: authenticated read own"
  ON claims FOR SELECT
  TO authenticated
  USING (claimant_user_id = auth.uid());

-- No UPDATE/DELETE for authenticated — claim mutations via service role only


-- =============================================================================
-- STEP 14: Resolve circular FK — add claim_id constraint to listings
-- listings.claim_id → claims(id)
-- This is the current approved claim for a listing. Set to NULL when no active
-- claim exists. ON DELETE SET NULL: approved claim deleted does not remove listing.
-- =============================================================================
ALTER TABLE listings
  ADD CONSTRAINT listings_claim_id_fkey
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;

CREATE INDEX listings_claim_id_idx ON listings (claim_id) WHERE claim_id IS NOT NULL;


-- =============================================================================
-- TABLE 15: saves
-- User saves/bookmarks of listings. One row per (user_id, listing_id) pair.
-- save_count on listings is maintained by trigger.
-- =============================================================================
CREATE TABLE saves (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, listing_id)
);

CREATE INDEX saves_user_id_idx    ON saves (user_id);
CREATE INDEX saves_listing_id_idx ON saves (listing_id);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

-- authenticated users can manage their own saves
CREATE POLICY "saves: authenticated manage own"
  ON saves FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No anon access to saves


-- =============================================================================
-- TRIGGER: Maintain denormalized save_count on listings
-- Fires AFTER INSERT and AFTER DELETE on saves.
-- GREATEST guard prevents save_count going below 0 on decrement.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_listing_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET save_count = save_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saves_update_listing_save_count
  AFTER INSERT OR DELETE ON saves
  FOR EACH ROW EXECUTE FUNCTION update_listing_save_count();


-- =============================================================================
-- TABLE 16: reviews
-- User reviews of listings. One review per (reviewer_user_id, listing_id).
-- review_count and avg_rating on listings are maintained by trigger.
-- =============================================================================
CREATE TABLE reviews (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id           uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  rating               integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                text,
  body                 text,
  status               text        NOT NULL DEFAULT 'intake'
                                   CHECK (status IN ('intake','pending_approval','published','rejected','removed')),
  visit_date           date,
  is_verified_purchase boolean     NOT NULL DEFAULT false,
  reviewed_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- admin reviewer
  reviewed_at          timestamptz,
  published_at         timestamptz,
  rejection_reason     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reviewer_user_id, listing_id)
);

CREATE INDEX reviews_listing_id_idx       ON reviews (listing_id, status);
CREATE INDEX reviews_status_pending_idx   ON reviews (status) WHERE status = 'pending_approval';
CREATE INDEX reviews_reviewer_user_id_idx ON reviews (reviewer_user_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- anon can read published reviews
CREATE POLICY "reviews: anon read published"
  ON reviews FOR SELECT
  TO anon
  USING (status = 'published');

-- authenticated can read published reviews or their own reviews at any status
CREATE POLICY "reviews: authenticated read published or own"
  ON reviews FOR SELECT
  TO authenticated
  USING (status = 'published' OR reviewer_user_id = auth.uid());

-- authenticated can submit reviews (status forced to 'intake' by CHECK constraint and WITH CHECK)
CREATE POLICY "reviews: authenticated insert"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid() AND status = 'intake');

-- No UPDATE/DELETE for authenticated — review lifecycle managed via service role


-- =============================================================================
-- TRIGGER: Maintain denormalized review_count and avg_rating on listings
-- Fires AFTER INSERT, UPDATE, or DELETE on reviews.
-- Only published reviews count toward the listing stats.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_listing_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_listing_id uuid;
BEGIN
  -- Determine the listing_id being affected
  IF TG_OP = 'DELETE' THEN
    target_listing_id := OLD.listing_id;
  ELSE
    target_listing_id := NEW.listing_id;
  END IF;

  UPDATE listings
  SET
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE listing_id = target_listing_id AND status = 'published'
    ),
    avg_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE listing_id = target_listing_id AND status = 'published'
    )
  WHERE id = target_listing_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_update_listing_stats
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_listing_review_stats();


-- =============================================================================
-- TABLE 17: collections
-- Admin-curated editorial collections of listings.
-- Examples: "Atlanta's Best Black-Owned Restaurants", "Black Wellness in Chicago"
-- =============================================================================
CREATE TABLE collections (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  slug             text        NOT NULL,
  description      text,
  cover_image_path text,       -- Supabase Storage path — not a URL
  is_active        boolean     NOT NULL DEFAULT true,
  display_order    integer     NOT NULL DEFAULT 0,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX collections_slug_idx ON collections (slug);
CREATE INDEX collections_is_active_display_order_idx ON collections (is_active, display_order);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- anon and authenticated can read active collections
CREATE POLICY "collections: public read active"
  ON collections FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE for anon or authenticated — collections managed via service role only


-- =============================================================================
-- TABLE 18: collection_items
-- Junction table linking listings to editorial collections.
-- One row per (collection_id, listing_id) pair.
-- =============================================================================
CREATE TABLE collection_items (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (collection_id, listing_id)
);

CREATE INDEX collection_items_collection_id_idx ON collection_items (collection_id);
CREATE INDEX collection_items_listing_id_idx    ON collection_items (listing_id);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- anon and authenticated can read collection items (for active collections)
CREATE POLICY "collection_items: public read"
  ON collection_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE for anon or authenticated — managed via service role only


-- =============================================================================
-- TABLE 19: analytics_events
-- Raw event stream for product analytics. INSERT via service role only.
-- ip_address stored as SHA-256 hash — never raw IP. user_id is nullable
-- (anonymous sessions tracked by session_id).
-- Privacy: ip_address hashed; user_agent retained for fraud/bot detection only.
-- =============================================================================
CREATE TABLE analytics_events (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  text,
  properties  jsonb       NOT NULL DEFAULT '{}',
  ip_address  text,       -- SHA-256 hash, never raw IP
  user_agent  text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — analytics events are immutable

CREATE INDEX analytics_events_event_name_idx  ON analytics_events (event_name);
CREATE INDEX analytics_events_entity_idx      ON analytics_events (entity_type, entity_id);
CREATE INDEX analytics_events_user_id_idx     ON analytics_events (user_id);
CREATE INDEX analytics_events_created_at_idx  ON analytics_events (created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- No anon access
-- authenticated owners can view analytics for their own listings (via entity_id join)
CREATE POLICY "analytics_events: owner read own listing events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    entity_type = 'listing'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = entity_id
        AND listings.owner_user_id = auth.uid()
    )
  );

-- INSERT via service role only — no authenticated INSERT policy


-- =============================================================================
-- TABLE 20: search_events
-- Search query log for analytics and relevance tuning.
-- No anon or authenticated read/write — service role only.
-- =============================================================================
CREATE TABLE search_events (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query                    text        NOT NULL,
  filters                  jsonb       NOT NULL DEFAULT '{}',
  result_count             integer     NOT NULL,
  clicked_result_position  integer,
  clicked_listing_id       uuid        REFERENCES listings(id) ON DELETE SET NULL,
  user_id                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  city_id                  uuid        REFERENCES cities(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — search events are immutable

CREATE INDEX search_events_query_idx      ON search_events (query);
CREATE INDEX search_events_created_at_idx ON search_events (created_at DESC);
CREATE INDEX search_events_city_id_idx    ON search_events (city_id);

ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated — service role only access
-- RLS is enabled and default-deny protects this table


-- =============================================================================
-- TABLE 21: entity_analytics_daily
-- Pre-aggregated daily stats per listing for the owner analytics dashboard.
-- Populated nightly by a background aggregation job (Ticket #082).
-- One row per (listing_id, snapshot_date) — UNIQUE constraint enforces this.
-- =============================================================================
CREATE TABLE entity_analytics_daily (
  id                  uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id          uuid    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  snapshot_date       date    NOT NULL,
  page_views          integer NOT NULL DEFAULT 0,
  cta_clicks          integer NOT NULL DEFAULT 0,
  saves               integer NOT NULL DEFAULT 0,
  shares              integer NOT NULL DEFAULT 0,
  search_impressions  integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (listing_id, snapshot_date)
);

CREATE INDEX entity_analytics_daily_listing_date_idx  ON entity_analytics_daily (listing_id, snapshot_date);
CREATE INDEX entity_analytics_daily_snapshot_date_idx ON entity_analytics_daily (snapshot_date DESC);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON entity_analytics_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE entity_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Listing owners can read their own analytics
CREATE POLICY "entity_analytics_daily: owner read own"
  ON entity_analytics_daily FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE via service role only (background aggregation job)


-- =============================================================================
-- TABLE 22: admin_audit_log
-- Immutable audit log of all admin actions. Records are inserted by service role
-- on every admin mutation. UPDATE and DELETE are blocked by trigger.
-- No updated_at column — records must never be modified.
-- =============================================================================
CREATE TABLE admin_audit_log (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  target_table   text        NOT NULL,
  target_id      uuid,
  before_state   jsonb,
  after_state    jsonb,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
  -- No updated_at intentionally — this table is immutable
);

CREATE INDEX admin_audit_log_admin_user_id_idx           ON admin_audit_log (admin_user_id);
CREATE INDEX admin_audit_log_target_table_target_id_idx  ON admin_audit_log (target_table, target_id);
CREATE INDEX admin_audit_log_action_idx                  ON admin_audit_log (action);
CREATE INDEX admin_audit_log_created_at_idx              ON admin_audit_log (created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies — service role only access. RLS default-deny protects this table.


-- =============================================================================
-- TRIGGER: Prevent modification or deletion of admin_audit_log records
-- This enforces immutability at the database layer, not just the app layer.
-- =============================================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log records are immutable. Modification denied.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();


-- =============================================================================
-- TABLE 23: moderation_queue
-- Centralized queue for items requiring admin review: claims, corrections,
-- flagged listings, verification requests, and review moderation.
-- No anon or authenticated access — service role only.
-- =============================================================================
CREATE TABLE moderation_queue (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_type   text        NOT NULL CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification')),
  entity_id    uuid        NOT NULL,   -- polymorphic reference: claim id, listing id, review id, etc.
  entity_type  text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','assigned','resolved','dismissed')),
  assigned_to  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  priority     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX moderation_queue_status_type_priority_idx ON moderation_queue (status, queue_type, priority DESC);
CREATE INDEX moderation_queue_assigned_to_idx          ON moderation_queue (assigned_to);
CREATE INDEX moderation_queue_entity_idx               ON moderation_queue (entity_type, entity_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- No policies — service role only access. RLS default-deny protects this table.


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
--
-- MANUAL STEPS REQUIRED AFTER APPLYING THIS MIGRATION:
-- 1. Confirm pg_trgm extension is enabled (check Supabase Dashboard > Extensions)
-- 2. Run supabase/seed.sql to populate reference data (states, cities, categories, plans)
-- 3. Replace Stripe price ID placeholders in plans table before V1 launch
-- 4. Set cities.is_active = true for each market as it launches
-- 5. Regenerate TypeScript types: supabase gen types typescript --local > lib/supabase/types.ts
-- 6. VERIFY: No anon RLS policy exists on search_events, admin_audit_log, or moderation_queue
-- 7. VERIFY: listing_details_business RLS policies correctly inherit from listings.owner_user_id
--
-- DEFERRED FK / CIRCULAR DEPENDENCY SUMMARY:
-- listings.claim_id → claims(id): Added via ALTER TABLE in step 14 after claims table created.
-- The UNIQUE constraint on claims (listing_id) is intentionally omitted to allow multiple
-- historical claim records per listing (pending, approved, rejected).
-- =============================================================================
