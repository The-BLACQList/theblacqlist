-- =============================================================================
-- Migration: business owners verify receipts (ticket 183)
-- =============================================================================
-- `[Decision — founder, 2026-11-13]` "The receipts should be verified by the
-- business, not by the admin. They would know, not me." The owner of a claimed
-- listing verifies receipts for it. Admins handle the rest: unclaimed
-- listings, and anything still waiting after 7 days. Unmatched receipts are
-- never approved; they wait for the business to join (ticket 183,
-- lib/spend/unlisted.ts).
--
-- What changes on receipt_uploads:
--   1. verified_by_role text, NULL or 'owner' or 'admin'. Who reviewed it, so
--      reports can tell owner reviews from admin ones. reviewed_by already
--      holds the user id.
--   2. owner_notified_at timestamptz. When the owner was emailed about this
--      receipt, so it is emailed once.
--   3. Index on (listing_id, status) for the owner's queue and the dashboard
--      badge count ("pending receipts for my listings").
--
-- Nothing else needs to change:
--   * receipt_uploads stays service-client only for reviews. Owner actions
--     check ownership in the server action (listing.owner_user_id = caller)
--     before any read or write, the same way the admin actions check admin.
--     No RLS policy is added or widened.
--   * reviewed_by references auth.users, which owners are.
--
-- Existing rows: both new columns are NULL. Past reviews were all by admins,
-- but the migration doesn't guess; reports treat NULL as "before owners".
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, and the
-- CHECK is added only if missing.
--
-- Down plan (run by hand only on the founder's word):
--   DROP INDEX IF EXISTS public.receipt_uploads_listing_status_idx;
--   ALTER TABLE public.receipt_uploads DROP CONSTRAINT IF EXISTS receipt_uploads_verified_by_role_check;
--   ALTER TABLE public.receipt_uploads DROP COLUMN IF EXISTS owner_notified_at;
--   ALTER TABLE public.receipt_uploads DROP COLUMN IF EXISTS verified_by_role;
-- Roll the code back first: the approve and reject actions write
-- verified_by_role, and the upload writes owner_notified_at.
--
-- Order: apply on staging, then prod before the PR merges (migrate before merge).
-- =============================================================================

ALTER TABLE public.receipt_uploads
  ADD COLUMN IF NOT EXISTS verified_by_role text,
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipt_uploads_verified_by_role_check'
      AND conrelid = 'public.receipt_uploads'::regclass
  ) THEN
    ALTER TABLE public.receipt_uploads
      ADD CONSTRAINT receipt_uploads_verified_by_role_check
      CHECK (verified_by_role IS NULL OR verified_by_role IN ('owner', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS receipt_uploads_listing_status_idx
  ON public.receipt_uploads (listing_id, status)
  WHERE listing_id IS NOT NULL;

COMMENT ON COLUMN public.receipt_uploads.verified_by_role IS
  'Ticket 183: who reviewed the receipt, owner or admin. NULL before owners could review.';
COMMENT ON COLUMN public.receipt_uploads.owner_notified_at IS
  'Ticket 183: when the business owner was emailed about this receipt.';
