-- Owner one-tap links without a listing: a business owner can get a tester
-- link before they have a BLACQList page.
--
-- WHY. An owner link had to name a published listing that already had an
-- owner, because the link signed in as that owner. Most test owners don't have
-- a page yet, so the founder couldn't send them a link. The tour steps never
-- use the tester's listing; only the free month does. Founder decision
-- 2026-10-11: the free month finds the page later, automatically, and the
-- first stop after Start is the create-your-page choices on /dashboard.
--
-- WHAT CHANGES.
--   1. tester_invites_kind_target: an owner row may now have no listing. Such
--      a row works like a supporter link (an optional email, or the tester
--      types one on /t). An owner row that names a listing still has no email.
--      Supporter rows are unchanged.
--   2. tour_enrollments.is_owner: marks an owner tester, with or without a
--      listing. Existing rows with a listing are owners, so they are backfilled
--      true. Code still running before the merge inserts the default false,
--      which is harmless: those rows always have a listing.
--
-- WHAT DOES NOT CHANGE. tour_enrollments_trial_requires_listing still says a
-- trial needs a listing, and the one-trial-per-listing and per-tester unique
-- indexes still hold. The claim route writes the listing and trial_granted_at
-- in one compare-and-set, so those indexes guard the new path too. No RLS or
-- function grant changes: tester_invites is still admin SELECT only with no
-- write policies.
--
-- DOWN PLAN:
--   The old CHECK can only come back once no owner row lacks a listing.
--   1. Revoke the listing-less owner links (GATE-DATA):
--        UPDATE tester_invites SET revoked_at = now()
--         WHERE kind = 'owner' AND listing_id IS NULL AND revoked_at IS NULL;
--   2. Decide by hand about those rows (deleting them loses only the links,
--      not the accounts or enrollments they made).
--   3. ALTER TABLE tester_invites DROP CONSTRAINT tester_invites_kind_target;
--      ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_target CHECK (
--        (kind = 'supporter' AND listing_id IS NULL)
--        OR (kind = 'owner' AND listing_id IS NOT NULL AND email IS NULL));
--   4. ALTER TABLE tour_enrollments DROP COLUMN is_owner;
--      Owner testers with no listing then read as supporters (no free month
--      card) until they are given a new invite on their page.
--   Then revert the code.

ALTER TABLE tester_invites DROP CONSTRAINT IF EXISTS tester_invites_kind_target;

-- A supporter link names no listing and may name an email. An owner link names
-- a listing, or an email, or neither, but never both.
ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_target CHECK (
  (kind = 'supporter' AND listing_id IS NULL)
  OR (kind = 'owner' AND (listing_id IS NULL OR email IS NULL))
);

ALTER TABLE tour_enrollments ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tour_enrollments.is_owner IS
  'True for an owner tester. An owner with no listing yet gets the free month on a page they own later.';

UPDATE tour_enrollments SET is_owner = true WHERE listing_id IS NOT NULL AND is_owner = false;
