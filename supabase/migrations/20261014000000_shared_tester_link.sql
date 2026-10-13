-- Shared tester link: one link the founder can post or forward, a cap of 15
-- testers in total, and a tester number for everyone on the tour.
--
-- WHY. Every tester link so far was made for one person and locked to the
-- first account that used it. The founder wants one link they can share,
-- where each person picks "I own a business" or "I support Black-owned
-- businesses" and gets the matching tour (founder, 2026-10-13). A shared link
-- can be forwarded anywhere, so the founder capped the test at 15 testers in
-- total, across every kind of link and the admin invite, and asked for a
-- visible tester ID so feedback can be matched to a person.
--
-- WHAT CHANGES.
--   1. tester_invites.kind gains 'shared'. A shared row names no email, no
--      listing and is never bound to an account: each new person who taps it
--      makes or uses their own. use_count counts the people who joined
--      through it (a returning tester spends nothing).
--   2. tour_enrollments.tester_number: a number for every tester, shown as
--      "Tester 07". Existing rows are numbered in the order they were made.
--      Numbers are never reused, including after an enrollment ends.
--   3. A BEFORE INSERT trigger is the one place the cap lives. Under a
--      transaction advisory lock it counts live enrollments (ended_at IS NULL)
--      and refuses a new one at 15, then gives the row the next number. Every
--      path that enrolls a tester (one-person links, the shared link, the
--      admin invite) goes through it, and two taps at the same moment cannot
--      both take the last spot. Ending an enrollment frees its spot. A tester
--      who already has a live enrollment is let through to the unique index,
--      so they get the usual 23505 rather than "full".
--
-- WHAT DOES NOT CHANGE. tester_invites is still admin SELECT only with no
-- write policies, and tour_enrollments is still SELECT only. The trigger
-- function is SECURITY INVOKER: only the service role inserts enrollments.
-- The free month rules are untouched: an owner tester still needs a published
-- page they own, and new pages and claims still go through admin review.
--
-- ORDERING. This runs on staging and prod before the code merges. Code still
-- running before the merge never makes a shared row, and an enrollment it
-- inserts gets a number and is held to the cap like any other. If the cap
-- refuses one, that old code shows its generic "try again" message.
--
-- DOWN PLAN:
--   1. Revoke shared links (GATE-DATA):
--        UPDATE tester_invites SET revoked_at = now()
--         WHERE kind = 'shared' AND revoked_at IS NULL;
--   2. DROP TRIGGER IF EXISTS tour_enrollments_cap_and_number ON tour_enrollments;
--      DROP FUNCTION IF EXISTS tour_enrollments_cap_and_number();
--   3. ALTER TABLE tour_enrollments DROP COLUMN IF EXISTS tester_number;
--   4. The old kind CHECKs can only come back once no shared row exists.
--      Deleting the shared rows loses only the links, not the accounts or
--      enrollments they made (its own GATE-DATA approval):
--        DELETE FROM tester_invites WHERE kind = 'shared';
--      then restore tester_invites_kind_check (supporter, owner) and the
--      20261012000000 version of tester_invites_kind_target.
--   Then revert the code.

-- ============================================================================
-- tester_invites: the shared kind
-- ============================================================================
ALTER TABLE tester_invites DROP CONSTRAINT IF EXISTS tester_invites_kind_check;
ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_check CHECK (
  kind IN ('supporter', 'owner', 'shared')
);

-- A supporter link names no listing and may name an email. An owner link names
-- a listing, or an email, or neither, but never both. A shared link names
-- nothing and is never bound to one account.
ALTER TABLE tester_invites DROP CONSTRAINT IF EXISTS tester_invites_kind_target;
ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_target CHECK (
  (kind = 'supporter' AND listing_id IS NULL)
  OR (kind = 'owner' AND (listing_id IS NULL OR email IS NULL))
  OR (kind = 'shared' AND email IS NULL AND listing_id IS NULL AND tester_user_id IS NULL)
);

-- ============================================================================
-- tour_enrollments: tester numbers
-- ============================================================================
ALTER TABLE tour_enrollments ADD COLUMN IF NOT EXISTS tester_number integer;

-- Number the existing rows once, oldest first. A re-run finds nothing to fill.
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM tour_enrollments
)
UPDATE tour_enrollments AS te
   SET tester_number = numbered.n
  FROM numbered
 WHERE te.id = numbered.id
   AND NOT EXISTS (SELECT 1 FROM tour_enrollments WHERE tester_number IS NOT NULL);

ALTER TABLE tour_enrollments ALTER COLUMN tester_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tour_enrollments_tester_number_idx
  ON tour_enrollments (tester_number);

COMMENT ON COLUMN tour_enrollments.tester_number IS
  'Shown to the tester as "Tester 07". Set by tour_enrollments_cap_and_number on insert; never reused.';

-- ============================================================================
-- The cap: 15 live testers, counted under one lock
-- ============================================================================
-- The 15 is mirrored in lib/tester/cap.ts (TESTER_CAP). Changing it means a
-- new migration and that constant together.
CREATE OR REPLACE FUNCTION tour_enrollments_cap_and_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- One lock for every enrollment insert, held to the end of the transaction,
  -- so the count and the number below can't race.
  PERFORM pg_advisory_xact_lock(hashtext('tour_enrollments_cap'));

  IF NEW.ended_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM tour_enrollments
        WHERE tester_user_id = NEW.tester_user_id AND ended_at IS NULL
     )
     AND (SELECT count(*) FROM tour_enrollments WHERE ended_at IS NULL) >= 15
  THEN
    RAISE EXCEPTION 'tester_cap_full' USING ERRCODE = 'P0001';
  END IF;

  NEW.tester_number := coalesce((SELECT max(tester_number) FROM tour_enrollments), 0) + 1;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION tour_enrollments_cap_and_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tour_enrollments_cap_and_number ON tour_enrollments;
CREATE TRIGGER tour_enrollments_cap_and_number
  BEFORE INSERT ON tour_enrollments
  FOR EACH ROW EXECUTE FUNCTION tour_enrollments_cap_and_number();
