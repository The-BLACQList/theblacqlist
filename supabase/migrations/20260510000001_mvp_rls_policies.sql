-- ============================================================
-- Migration: 20260510000001_mvp_rls_policies.sql
-- The BLACQList — Comprehensive MVP Row Level Security Policies
-- Created: 2026-05-10
-- ============================================================
-- This migration replaces the basic per-table policies created
-- inline in the initial schema migration with a complete,
-- audited set of RLS policies for all MVP tables.
--
-- What this migration does:
--   1. Creates helper functions for role and ownership checks
--   2. Drops the basic policies from 20260510000000
--   3. Creates per-operation policies for all 22 MVP tables
--
-- Enforcement model:
--   anon        → SELECT on published/public data only; no writes
--   authenticated → SELECT on public data + own records; write own records only
--   service_role  → bypasses all RLS; used for admin operations server-side
--
-- DO NOT apply to production without explicit approval.
-- Test locally first: supabase db push (local)
-- Apply to staging:   supabase db push --linked
-- ============================================================

-- ============================================================
-- SECTION 1: Helper functions
-- All functions are STABLE + SECURITY DEFINER so they can be
-- called from Server Actions and Route Handlers to verify the
-- calling user's role before using service_role operations.
-- These are NOT referenced within the RLS policies themselves
-- (inline conditions are used for clarity and caching).
-- ============================================================

-- is_admin(): true if the session user has admin or super_admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- is_super_admin(): true if the session user has super_admin role
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

-- has_role(p_role): true if the session user has the specified role
-- Usage: SELECT has_role('owner') or supabase.rpc('has_role', { p_role: 'owner' })
CREATE OR REPLACE FUNCTION has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = p_role
  );
$$;

-- owns_listing(p_listing_id): true if the session user owns the specified listing
-- Checks owner_user_id on listings + deleted_at IS NULL guard.
CREATE OR REPLACE FUNCTION owns_listing(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM listings
    WHERE id = p_listing_id
      AND owner_user_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- owns_entity(p_entity_id): alias for owns_listing
-- Entity == listing in the BLACQList MVP; alias provided for consistency
-- with future phases where other entity types may exist.
CREATE OR REPLACE FUNCTION owns_entity(p_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owns_listing(p_entity_id);
$$;

-- ============================================================
-- SECTION 2: Drop basic policies from initial migration
-- Drop order mirrors table definition order. All use IF EXISTS
-- so this migration is safe to re-run.
-- ============================================================

-- states
DROP POLICY IF EXISTS "states: public read" ON states;

-- cities
DROP POLICY IF EXISTS "cities: public read" ON cities;

-- categories
DROP POLICY IF EXISTS "categories: public read active" ON categories;

-- plans
DROP POLICY IF EXISTS "plans: public read active" ON plans;

-- profiles
DROP POLICY IF EXISTS "profiles: owner read and update" ON profiles;

-- listings
DROP POLICY IF EXISTS "listings: anon read published" ON listings;
DROP POLICY IF EXISTS "listings: authenticated read published or own" ON listings;
DROP POLICY IF EXISTS "listings: authenticated insert" ON listings;
DROP POLICY IF EXISTS "listings: owner update" ON listings;

-- listing_details_business
DROP POLICY IF EXISTS "listing_details_business: anon read published" ON listing_details_business;
DROP POLICY IF EXISTS "listing_details_business: authenticated read" ON listing_details_business;
DROP POLICY IF EXISTS "listing_details_business: owner write" ON listing_details_business;
DROP POLICY IF EXISTS "listing_details_business: owner update" ON listing_details_business;

-- user_roles
DROP POLICY IF EXISTS "user_roles: authenticated read own" ON user_roles;

-- services
DROP POLICY IF EXISTS "services: read for published listings" ON services;
DROP POLICY IF EXISTS "services: owner insert" ON services;
DROP POLICY IF EXISTS "services: owner update" ON services;
DROP POLICY IF EXISTS "services: owner delete" ON services;

-- media_attachments
DROP POLICY IF EXISTS "media_attachments: anon read approved listing media" ON media_attachments;
DROP POLICY IF EXISTS "media_attachments: authenticated read approved" ON media_attachments;
DROP POLICY IF EXISTS "media_attachments: authenticated insert" ON media_attachments;
DROP POLICY IF EXISTS "media_attachments: authenticated delete own" ON media_attachments;

-- listing_hours
DROP POLICY IF EXISTS "listing_hours: anon read published" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours: authenticated read" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours: owner write" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours: owner update" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours: owner delete" ON listing_hours;

-- listing_links
DROP POLICY IF EXISTS "listing_links: read for published listings" ON listing_links;
DROP POLICY IF EXISTS "listing_links: owner insert" ON listing_links;
DROP POLICY IF EXISTS "listing_links: owner update" ON listing_links;
DROP POLICY IF EXISTS "listing_links: owner delete" ON listing_links;

-- claims
DROP POLICY IF EXISTS "claims: authenticated insert" ON claims;
DROP POLICY IF EXISTS "claims: authenticated read own" ON claims;

-- saves
DROP POLICY IF EXISTS "saves: authenticated manage own" ON saves;

-- reviews
DROP POLICY IF EXISTS "reviews: anon read published" ON reviews;
DROP POLICY IF EXISTS "reviews: authenticated read published or own" ON reviews;
DROP POLICY IF EXISTS "reviews: authenticated insert" ON reviews;

-- collections
DROP POLICY IF EXISTS "collections: public read active" ON collections;

-- collection_items
DROP POLICY IF EXISTS "collection_items: public read" ON collection_items;

-- analytics_events
DROP POLICY IF EXISTS "analytics_events: owner read own listing events" ON analytics_events;

-- entity_analytics_daily
DROP POLICY IF EXISTS "entity_analytics_daily: owner read own" ON entity_analytics_daily;

-- ============================================================
-- SECTION 3: Comprehensive per-operation RLS policies
-- Tables are ordered by dependency (referenced tables first).
-- service_role bypasses all policies; no service_role policies
-- are needed here — service_role access is implicit in Supabase.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- states
-- Reference data: all rows publicly readable; writes via service_role only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "states: anon read all"
  ON states FOR SELECT TO anon
  USING (true);

CREATE POLICY "states: authenticated read all"
  ON states FOR SELECT TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- cities
-- Reference data: all rows publicly readable; writes via service_role only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "cities: anon read all"
  ON cities FOR SELECT TO anon
  USING (true);

CREATE POLICY "cities: authenticated read all"
  ON cities FOR SELECT TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- categories
-- Reference data: all rows publicly readable; writes via service_role only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "categories: anon read all"
  ON categories FOR SELECT TO anon
  USING (true);

CREATE POLICY "categories: authenticated read all"
  ON categories FOR SELECT TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- plans
-- Active plans are publicly readable (public pricing page).
-- Plan mutations (price changes, deactivation) via service_role only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "plans: anon read active"
  ON plans FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "plans: authenticated read active"
  ON plans FOR SELECT TO authenticated
  USING (is_active = true);


-- ─────────────────────────────────────────────────────────────
-- profiles
-- Users can read and update their own profile.
-- Profiles are created via trigger on auth.users; no INSERT policy needed.
-- Account deletion (hard delete) is handled via service_role.
-- anon access to profiles is deferred to V1 (public owner profile pages).
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "profiles: authenticated read own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: authenticated update own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- user_roles
-- Users can read their own role record to determine their access level.
-- Role assignment and revocation are admin-only operations via service_role.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "user_roles: authenticated read own"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- listings
-- Core entity table. Three access tiers:
--   anon       → published + not deleted only
--   authenticated → published + own listings at any status
--   service_role  → unrestricted (admin, claim approval, moderation)
--
-- Hard delete is not permitted via authenticated role.
-- Soft delete (deleted_at) is set via service_role only.
-- Status transitions beyond draft→submitted are admin-only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "listings: anon read published"
  ON listings FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "listings: authenticated read published or own"
  ON listings FOR SELECT TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR owner_user_id = auth.uid()
  );

-- Any authenticated user can create a listing (it starts as draft).
-- Both submitted_by and owner_user_id must equal the inserting user.
CREATE POLICY "listings: authenticated insert"
  ON listings FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND owner_user_id = auth.uid()
  );

-- Listing owners can update their own listings.
-- Service layer enforces valid status transitions; RLS enforces ownership only.
CREATE POLICY "listings: owner update"
  ON listings FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- listing_details_business
-- Child table of listings. Access mirrors parent listing visibility.
-- Ownership gate: must own the parent listing.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "listing_details_business: anon read published"
  ON listing_details_business FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_details_business: authenticated read"
  ON listing_details_business FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "listing_details_business: owner insert"
  ON listing_details_business FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_details_business: owner update"
  ON listing_details_business FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_details_business: owner delete"
  ON listing_details_business FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- services
-- Child table of listings. Same ownership-gate pattern.
-- Owners can add, update, and delete services on their own listings.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "services: anon read published listing"
  ON services FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

CREATE POLICY "services: authenticated read"
  ON services FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "services: owner insert"
  ON services FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "services: owner update"
  ON services FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "services: owner delete"
  ON services FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- media_attachments
-- Polymorphic media table. In MVP, only entity_type = 'listing' is used.
-- Public read: only media attached to published listings.
-- Verification docs and receipts buckets are blocked at Storage bucket level.
-- Authenticated insert: only for own listings and only entity_type = 'listing'.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "media_attachments: anon read published listing media"
  ON media_attachments FOR SELECT TO anon
  USING (
    entity_type = 'listing'
    AND entity_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

CREATE POLICY "media_attachments: authenticated read"
  ON media_attachments FOR SELECT TO authenticated
  USING (
    (
      entity_type = 'listing'
      AND entity_id IN (
        SELECT id FROM listings
        WHERE (status = 'published' AND deleted_at IS NULL)
           OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
      )
    )
    OR uploaded_by = auth.uid()
  );

-- Owners may only attach media to their own listings (entity_type = 'listing' enforced).
CREATE POLICY "media_attachments: owner insert listing media"
  ON media_attachments FOR INSERT TO authenticated
  WITH CHECK (
    entity_type = 'listing'
    AND entity_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Uploaders can update their own media records (e.g., update alt_text, display_order).
CREATE POLICY "media_attachments: uploader update own"
  ON media_attachments FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "media_attachments: uploader delete own"
  ON media_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- listing_hours
-- Child table. Ownership-gate pattern identical to listing_details_business.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "listing_hours: anon read published"
  ON listing_hours FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_hours: authenticated read"
  ON listing_hours FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "listing_hours: owner insert"
  ON listing_hours FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_hours: owner update"
  ON listing_hours FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_hours: owner delete"
  ON listing_hours FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- listing_links
-- Child table. Ownership-gate pattern identical to listing_hours.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "listing_links: anon read published"
  ON listing_links FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_links: authenticated read"
  ON listing_links FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "listing_links: owner insert"
  ON listing_links FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_links: owner update"
  ON listing_links FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "listing_links: owner delete"
  ON listing_links FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- claims
-- Claim records are private audit documents.
-- Users can submit claims and read their own claim status.
-- Status transitions (pending → approved/rejected) are admin-only via service_role.
-- Claims are never deleted — they are the ownership history audit record.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "claims: authenticated read own"
  ON claims FOR SELECT TO authenticated
  USING (claimant_user_id = auth.uid());

-- claimant_user_id must equal the inserting user's ID.
-- Service layer also validates: the listing being claimed exists and is unclaimed.
CREATE POLICY "claims: authenticated insert"
  ON claims FOR INSERT TO authenticated
  WITH CHECK (claimant_user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- saves
-- Private user data. Users manage only their own saves.
-- FOR ALL in the initial migration allowed UPDATE (not intended); replaced with
-- explicit SELECT, INSERT, DELETE policies to remove the UPDATE path.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "saves: authenticated read own"
  ON saves FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "saves: authenticated insert own"
  ON saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saves: authenticated delete own"
  ON saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- reviews
-- Published reviews are publicly visible.
-- Authenticated users can see their own reviews at any status.
-- Reviews are immutable after submission: no UPDATE or DELETE via authenticated.
-- INSERT: status must be 'intake' (forced by WITH CHECK + service layer validation).
-- Admin approves (published), rejects (rejected), or removes (removed) via service_role.
-- One review per (reviewer_user_id, listing_id) enforced by UNIQUE constraint.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "reviews: anon read published"
  ON reviews FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "reviews: authenticated read published or own"
  ON reviews FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR reviewer_user_id = auth.uid()
  );

-- WITH CHECK forces status = 'intake' at the RLS layer (service layer validates too).
-- reviewer_user_id must equal the inserting user.
CREATE POLICY "reviews: authenticated insert"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND status = 'intake'
  );


-- ─────────────────────────────────────────────────────────────
-- collections
-- Admin-curated editorial collections.
-- Active collections are publicly readable. All writes via service_role only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "collections: anon read active"
  ON collections FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "collections: authenticated read active"
  ON collections FOR SELECT TO authenticated
  USING (is_active = true);


-- ─────────────────────────────────────────────────────────────
-- collection_items
-- Items in active collections are publicly readable.
-- The initial migration used USING (true) — corrected here to restrict
-- to items in active collections only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "collection_items: anon read active collection items"
  ON collection_items FOR SELECT TO anon
  USING (
    collection_id IN (
      SELECT id FROM collections WHERE is_active = true
    )
  );

CREATE POLICY "collection_items: authenticated read active collection items"
  ON collection_items FOR SELECT TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM collections WHERE is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────
-- analytics_events
-- Raw event stream. Written server-side via service_role only.
-- Owners can read analytics events for their own listings.
-- No INSERT, UPDATE, or DELETE via anon or authenticated.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "analytics_events: owner read own listing events"
  ON analytics_events FOR SELECT TO authenticated
  USING (
    entity_type = 'listing'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = entity_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
-- search_events
-- Search telemetry. Written server-side via service_role only.
-- No SELECT, INSERT, UPDATE, or DELETE via anon or authenticated.
-- Default deny applies (no policies created = deny all).
-- ─────────────────────────────────────────────────────────────

-- No policies needed; RLS is enabled (see initial migration).
-- Default deny protects this table. service_role writes via Server Actions.


-- ─────────────────────────────────────────────────────────────
-- entity_analytics_daily
-- Pre-aggregated daily listing analytics.
-- Populated by scheduled job via service_role.
-- Owners can read aggregates for their own listings only.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "entity_analytics_daily: owner read own"
  ON entity_analytics_daily FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
-- admin_audit_log
-- Immutable audit trail. No access via RLS for anon or authenticated.
-- All SELECT and INSERT via service_role only.
-- UPDATE and DELETE blocked by trigger (see initial migration).
-- No policies needed; RLS is enabled and default deny applies.
-- ─────────────────────────────────────────────────────────────

-- No policies needed.


-- ─────────────────────────────────────────────────────────────
-- moderation_queue
-- Admin-only queue. No access via RLS for anon or authenticated.
-- All access via service_role only.
-- No policies needed; RLS is enabled and default deny applies.
-- ─────────────────────────────────────────────────────────────

-- No policies needed.


-- ============================================================
-- END OF MIGRATION
-- ============================================================
-- Manual steps required after applying this migration:
--   1. Run supabase gen types typescript --local > lib/supabase/types.ts
--      (regenerate types to include the new helper functions)
--   2. Verify health check: GET /api/health/supabase
--   3. Run backend tests for each role tier (see rls-implementation-report.md)
-- ============================================================
