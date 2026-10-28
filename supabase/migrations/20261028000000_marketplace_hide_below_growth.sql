-- =============================================================================
-- Migration: hide products and services on pages below Growth (ticket 105)
-- =============================================================================
-- `[Decision — founder, 2026-10-28]` a page that moves below Growth keeps its
-- products and services. They are hidden from the public, never deleted, and
-- come back the moment the page is on Growth or Premium again.
--
-- A storefront is a Growth feature (canAccess(tier, 'storefront') in
-- lib/stripe/features.ts), so this is not a count cap after a downgrade like
-- photos or videos: below Growth, the public sees none. No page can add an item
-- below Growth (assertCanAddMarketplaceItem), so nothing that was never sold is
-- hidden by this.
--
-- What changes: the public branch of marketplace_products_read and
-- marketplace_services_read (20260511000002) also requires the parent page to
-- be on growth or premium. The owner branch is unchanged, so an owner still
-- sees every item on their own page, on any plan. No row is updated or deleted.
--
-- This NARROWS public access. It does not broaden it.
--
-- The public marketplace pages read through the service client, which skips
-- RLS, so they apply the same rule in code (lib/marketplace/visibility.ts).
-- This policy covers every other reader, including direct anon API reads.
--
-- Idempotent: each policy is dropped if present and recreated.
--
-- Release: GATE-DATA. Applied to staging and production only on the founder's
-- word, and before the PR 105 code merges.
--
-- Rollback: recreate both policies exactly as 20260511000002 wrote them, that
-- is, this file with the two `AND listings.tier IN ('growth', 'premium')` lines
-- removed.
-- =============================================================================

DROP POLICY IF EXISTS "marketplace_products_read" ON marketplace_products;

CREATE POLICY "marketplace_products_read"
  ON marketplace_products FOR SELECT
  USING (
    (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_products.listing_id
          AND listings.status = 'published'
          AND listings.deleted_at IS NULL
          AND listings.tier IN ('growth', 'premium')
      )
    )
    OR
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_products.listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "marketplace_services_read" ON marketplace_services;

CREATE POLICY "marketplace_services_read"
  ON marketplace_services FOR SELECT
  USING (
    (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_services.listing_id
          AND listings.status = 'published'
          AND listings.deleted_at IS NULL
          AND listings.tier IN ('growth', 'premium')
      )
    )
    OR
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = marketplace_services.listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    )
  );
