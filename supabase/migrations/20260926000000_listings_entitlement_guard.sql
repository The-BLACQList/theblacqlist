-- ─── Listings entitlement guard ─────────────────────────────────────────────
--
-- Closes a direct-API bypass of every paid feature. [Observed — audit,
-- 2026-09-26]
--
-- Stripe was never the weak point. Checkout reads the price from `plans` on the
-- server and the webhook derives the tier from the live Stripe price. The hole
-- was one step past Stripe: every paid feature reads `listings.tier`, and the
-- RLS policy "listings: owner update" (20260510000001) checks only
-- `owner_user_id = auth.uid()`. RLS is row-level, not column-level, so any owner
-- holding their own session token could send
--
--   PATCH /rest/v1/listings?id=eq.<their listing>
--   { "tier": "premium", "is_featured": true, "trust_tier": "certified",
--     "status": "published" }
--
-- and get a free Premium plan, a featured slot, a trust badge nobody granted,
-- and a listing that skipped moderation. "listings: authenticated insert" had
-- the same gap for a brand-new row.
--
-- This migration does four things:
--
--   1. listings_owner_guard(): a BEFORE INSERT OR UPDATE trigger that, for
--      end-user roles only, freezes every column a user has no business writing
--      and allows only the status moves the owner dashboard actually makes.
--   2. "claims: authenticated insert": a claim can only be born `pending` and
--      unreviewed. Before this a user could insert an `approved` claim with a
--      backdated `reviewed_at`, which is the date the 90-day certification rule
--      counts from.
--   3. marketplace_products / marketplace_services insert policies: the
--      Growth+ storefront gate (`lib/stripe/features.ts` → storefront: 2) now
--      holds in the database too, not only in app code. This is only worth
--      anything because (1) makes `listings.tier` trustworthy, which is why the
--      two ship together.
--
-- ── Why a trigger and not column GRANTs ─────────────────────────────────────
-- Revoking UPDATE on individual columns from `authenticated` would also work for
-- UPDATE, but it cannot express "status may move draft → pending but not
-- pending → published", cannot constrain INSERT values, and silently breaks the
-- first time someone adds a column and forgets the grant list. A trigger states
-- the rule in one place and fails loudly.
--
-- ── Who the guard applies to ────────────────────────────────────────────────
-- Only when `current_user IN ('authenticated', 'anon')`. Every legitimate system
-- writer runs as some other role and passes straight through:
--
--   * Admin actions, the Stripe webhook, the certification fast path and the
--     expiry sweeps use the service client → `service_role`.
--   * update_listing_save_count(), update_listing_review_stats(),
--     refresh_activity_scores(), auto_grant_certified() and the search_vector
--     refresh are SECURITY DEFINER → they run as their owner (`postgres`).
--   * FK referential actions (ON DELETE SET NULL from auth.users) run as the
--     table owner.
--
-- ⚠ `current_user`, NOT `auth.role()`. Inside a SECURITY DEFINER function the
-- JWT claim still says `authenticated`, so an `auth.role()` check would reject
-- the save/review counter triggers the moment a signed-in user saved a listing.
-- `current_user` is the role actually executing the statement, which is the one
-- that matters.
--
-- ── Trigger name ────────────────────────────────────────────────────────────
-- `a0_listings_owner_guard`. Postgres fires same-timing row triggers in name
-- order, so this sorts ahead of `listings_search_vector_update` and
-- `set_updated_at` and sees exactly what the client sent, before either of them
-- rewrites NEW.
--
-- ── Errors ──────────────────────────────────────────────────────────────────
-- ERRCODE 42501 (insufficient_privilege). PostgREST maps it to HTTP 403, and
-- the server actions already treat any write error as "please try again".
--
-- ── Owner write paths checked against this list [Observed — repo, 2026-09-26] ─
--   createListing.ts (insert: draft, source owner, tier free, trust unclaimed),
--   updateListingContent.ts, applySuggestion.ts, setCoverImage.ts,
--   deleteMedia.ts, updateEventDetails.ts, updateJobDetails.ts,
--   updateListingStatus.ts (draft ↔ published), submitForReview.ts
--   (draft → pending), submitVerificationRequest.ts (verification → pending).
--   None of them writes a protected column.
--
--   ⚠ Job listings: submitListingForReview.ts currently moves a job
--   draft → pending with the USER client after its paid-posting check. This
--   guard refuses that (a job's status is not the owner's to move — that is the
--   paid-posting bypass). The companion app PR moves that call to the service
--   client and MUST be live before this migration reaches production.
--
-- ── Down / rollback plan ────────────────────────────────────────────────────
-- Nothing here changes data, so rollback is purely structural:
--
--   DROP TRIGGER IF EXISTS a0_listings_owner_guard ON listings;
--   DROP FUNCTION IF EXISTS listings_owner_guard();
--
--   DROP POLICY IF EXISTS "claims: authenticated insert" ON claims;
--   CREATE POLICY "claims: authenticated insert"
--     ON claims FOR INSERT TO authenticated
--     WITH CHECK (claimant_user_id = auth.uid());
--
--   DROP POLICY IF EXISTS "marketplace_products_insert" ON marketplace_products;
--   CREATE POLICY "marketplace_products_insert"
--     ON marketplace_products FOR INSERT
--     TO authenticated
--     WITH CHECK (
--       EXISTS (
--         SELECT 1 FROM listings
--         WHERE listings.id = listing_id
--           AND listings.owner_user_id = auth.uid()
--           AND listings.deleted_at IS NULL
--       )
--     );
--
--   DROP POLICY IF EXISTS "marketplace_services_insert" ON marketplace_services;
--   CREATE POLICY "marketplace_services_insert"
--     ON marketplace_services FOR INSERT
--     TO authenticated
--     WITH CHECK (
--       EXISTS (
--         SELECT 1 FROM listings
--         WHERE listings.id = listing_id
--           AND listings.owner_user_id = auth.uid()
--           AND listings.deleted_at IS NULL
--       )
--     );
--
-- (Policy text restored verbatim from 20260510000001_mvp_rls_policies.sql and
-- 20260511000002_marketplace_foundation.sql.)
--
-- Idempotent: every statement is CREATE OR REPLACE or DROP ... IF EXISTS first.
-- ─────────────────────────────────────────────────────────────────────────────


-- =============================================================================
-- PART 1 — listings_owner_guard()
-- =============================================================================

CREATE OR REPLACE FUNCTION listings_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  msg constant text := 'This field can only be changed by The BLACQList.';
BEGIN
  -- System writers (service_role, definer functions, FK actions) pass through.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new row carries the column defaults for everything the platform owns.
    -- `source` must be 'owner': 'community' / 'admin' / 'import' are rows the
    -- platform creates, never a user.
    IF NEW.tier                          IS DISTINCT FROM 'free'
    OR NEW.trust_tier                    IS DISTINCT FROM 'unclaimed'
    OR NEW.verification_status           IS DISTINCT FROM 'none'
    OR NEW.flag_status                   IS DISTINCT FROM 'none'
    OR NEW.source                        IS DISTINCT FROM 'owner'
    OR NEW.is_featured                   IS DISTINCT FROM false
    OR NEW.is_sponsored                  IS DISTINCT FROM false
    OR NEW.sponsored_expires_at          IS NOT NULL
    OR NEW.sponsored_placement_type      IS NOT NULL
    OR NEW.claim_id                      IS NOT NULL
    OR NEW.verified_at                   IS NOT NULL
    OR NEW.verified_by                   IS NOT NULL
    OR NEW.verification_notes            IS NOT NULL
    OR NEW.certification_auto_granted_at IS NOT NULL
    OR NEW.activity_score                IS DISTINCT FROM 0
    OR NEW.review_count                  IS DISTINCT FROM 0
    OR NEW.avg_rating                    IS NOT NULL
    OR NEW.save_count                    IS DISTINCT FROM 0
    OR NEW.view_count                    IS DISTINCT FROM 0
    OR NEW.published_at                  IS NOT NULL
    OR NEW.deleted_at                    IS NOT NULL
    OR NEW.stale_flagged_at              IS NOT NULL
    OR NEW.auto_expire_at                IS NOT NULL
    OR NEW.auto_archive_at               IS NOT NULL
    OR NEW.admin_notes                   IS NOT NULL
    OR NEW.moderation_notes              IS NOT NULL
    OR NEW.last_admin_updated_at         IS NOT NULL
    THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = msg;
    END IF;

    -- A new listing starts as a draft. `pending` is allowed for non-jobs
    -- because it only puts the row in the admin review queue, which is where a
    -- draft → pending move lands anyway. A job must pass the paid-posting
    -- check, which only the server can run.
    IF NOT (
      NEW.status = 'draft'
      OR (NEW.status = 'pending' AND NEW.entity_type <> 'job')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'A new listing must start as a draft.';
    END IF;

    RETURN NEW;
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  IF NEW.tier                          IS DISTINCT FROM OLD.tier
  OR NEW.trust_tier                    IS DISTINCT FROM OLD.trust_tier
  OR NEW.flag_status                   IS DISTINCT FROM OLD.flag_status
  OR NEW.source                        IS DISTINCT FROM OLD.source
  OR NEW.entity_type                   IS DISTINCT FROM OLD.entity_type
  OR NEW.owner_user_id                 IS DISTINCT FROM OLD.owner_user_id
  OR NEW.submitted_by                  IS DISTINCT FROM OLD.submitted_by
  OR NEW.is_featured                   IS DISTINCT FROM OLD.is_featured
  OR NEW.is_sponsored                  IS DISTINCT FROM OLD.is_sponsored
  OR NEW.sponsored_expires_at          IS DISTINCT FROM OLD.sponsored_expires_at
  OR NEW.sponsored_placement_type      IS DISTINCT FROM OLD.sponsored_placement_type
  OR NEW.claim_id                      IS DISTINCT FROM OLD.claim_id
  OR NEW.verified_at                   IS DISTINCT FROM OLD.verified_at
  OR NEW.verified_by                   IS DISTINCT FROM OLD.verified_by
  OR NEW.verification_notes            IS DISTINCT FROM OLD.verification_notes
  OR NEW.certification_auto_granted_at IS DISTINCT FROM OLD.certification_auto_granted_at
  OR NEW.activity_score                IS DISTINCT FROM OLD.activity_score
  OR NEW.review_count                  IS DISTINCT FROM OLD.review_count
  OR NEW.avg_rating                    IS DISTINCT FROM OLD.avg_rating
  OR NEW.save_count                    IS DISTINCT FROM OLD.save_count
  OR NEW.view_count                    IS DISTINCT FROM OLD.view_count
  OR NEW.published_at                  IS DISTINCT FROM OLD.published_at
  OR NEW.deleted_at                    IS DISTINCT FROM OLD.deleted_at
  OR NEW.stale_flagged_at              IS DISTINCT FROM OLD.stale_flagged_at
  OR NEW.auto_expire_at                IS DISTINCT FROM OLD.auto_expire_at
  OR NEW.auto_archive_at               IS DISTINCT FROM OLD.auto_archive_at
  OR NEW.admin_notes                   IS DISTINCT FROM OLD.admin_notes
  OR NEW.moderation_notes              IS DISTINCT FROM OLD.moderation_notes
  OR NEW.last_admin_updated_at         IS DISTINCT FROM OLD.last_admin_updated_at
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = msg;
  END IF;

  -- Status: only the moves the owner dashboard makes.
  --   draft     → pending    submit for review (not jobs: paid-posting check)
  --   published → draft      unpublish
  --   draft     → published  self-publish once the listing has been claimed
  --                          (mirrors updateListingStatus.ts; not jobs)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
         (OLD.status = 'draft'     AND NEW.status = 'pending'
            AND OLD.entity_type <> 'job')
      OR (OLD.status = 'published' AND NEW.status = 'draft')
      OR (OLD.status = 'draft'     AND NEW.status = 'published'
            AND OLD.trust_tier <> 'unclaimed'
            AND OLD.entity_type <> 'job')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'That status change needs The BLACQList to review it.';
    END IF;
  END IF;

  -- Verification: an owner may ask (none/rejected → pending). Every other move
  -- is an admin decision. Mirrors submitVerificationRequest.ts.
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT (
      OLD.verification_status IN ('none', 'rejected')
      AND NEW.verification_status = 'pending'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = msg;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a0_listings_owner_guard ON listings;

CREATE TRIGGER a0_listings_owner_guard
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_owner_guard();


-- =============================================================================
-- PART 2 — claims: a claim is born pending and unreviewed
--
-- lib/actions/claims/createClaim.ts inserts status 'pending' and never sets
-- reviewed_at / reviewed_by / rejection_reason. `notes` is the claimant's own
-- note and stays writable.
-- =============================================================================

DROP POLICY IF EXISTS "claims: authenticated insert" ON claims;

CREATE POLICY "claims: authenticated insert"
  ON claims FOR INSERT TO authenticated
  WITH CHECK (
    claimant_user_id = auth.uid()
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND rejection_reason IS NULL
  );


-- =============================================================================
-- PART 3 — marketplace inserts require a Growth+ listing
--
-- Mirrors lib/stripe/features.ts (storefront: 2 → growth, premium) as read by
-- lib/marketplace/entitlements.ts. If that entitlement ever moves, this list
-- moves with it.
-- =============================================================================

DROP POLICY IF EXISTS "marketplace_products_insert" ON marketplace_products;

CREATE POLICY "marketplace_products_insert"
  ON marketplace_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
        AND listings.tier IN ('growth', 'premium')
    )
  );

DROP POLICY IF EXISTS "marketplace_services_insert" ON marketplace_services;

CREATE POLICY "marketplace_services_insert"
  ON marketplace_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
        AND listings.tier IN ('growth', 'premium')
    )
  );
