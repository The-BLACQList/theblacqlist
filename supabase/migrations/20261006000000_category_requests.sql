-- =============================================================================
-- 20261006000000_category_requests.sql
--
-- The rules-first /add-business flow (ticket 126).
--
-- [Decision — founder, 2026-10-05] When nothing fits, the owner can suggest a
-- new category. The listing sits under the closest group until the team adds
-- the category or moves it to a close one, and we email the owner either way.
--
-- WHAT THIS FILE DOES
--   PART 1  moderation_queue: allow queue_type 'new_submission'.
--           submitForReview.ts and submitListing.ts have always inserted it,
--           the CHECK has always rejected it, and the error was ignored, so a
--           listing sent for review never reached the queue. Confirmed on
--           staging 2026-10-06 (read-only): 3 pending listings, 0 queue rows.
--   PART 2  moderation_queue backfill: one 'new_submission' row for each
--           pending listing that has none. This is the only data write here.
--   PART 3  category_requests: the owner's words, the name they proposed, the
--           group they are listed under for now, and the review outcome.
--
-- RLS on category_requests
--   owner   INSERT their own row for a listing they own; SELECT their own rows
--   admin   SELECT all rows
--   UPDATE and DELETE: no policy, so only service_role (the admin review
--   action, after requireAdmin) can approve or decline.
--
-- DOWN PLAN
--   1. DROP TABLE IF EXISTS category_requests;
--   2. Backfilled queue rows are harmless; to remove them:
--        DELETE FROM moderation_queue WHERE queue_type = 'new_submission'
--          AND created_at >= '<apply time>';
--   3. Put the old CHECK back only after step 2 removes every new_submission
--      row (ADD CONSTRAINT fails otherwise):
--        ALTER TABLE moderation_queue DROP CONSTRAINT moderation_queue_queue_type_check;
--        ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_queue_type_check
--          CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification'));
--      Doing so brings the original bug back.
-- =============================================================================


-- =============================================================================
-- PART 1 — moderation_queue.queue_type
-- =============================================================================
ALTER TABLE moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_queue_type_check;
ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_queue_type_check
  CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification','new_submission'));


-- =============================================================================
-- PART 2 — backfill the listings that were sent for review and never queued
-- =============================================================================
INSERT INTO moderation_queue (queue_type, entity_id, entity_type, status, priority)
SELECT 'new_submission', l.id, 'listing', 'pending', 0
FROM listings l
WHERE l.status = 'pending'
  AND l.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM moderation_queue q
    WHERE q.queue_type = 'new_submission'
      AND q.entity_id = l.id
      AND q.status IN ('pending', 'assigned')
  );


-- =============================================================================
-- PART 3 — category_requests
-- =============================================================================
CREATE TABLE category_requests (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id          uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requested_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- What the owner typed into "What do you do?", kept for the team.
  owner_words         text        NOT NULL CHECK (char_length(btrim(owner_words)) BETWEEN 1 AND 500),
  proposed_name       text        NOT NULL CHECK (char_length(btrim(proposed_name)) BETWEEN 2 AND 60),
  -- The group the listing sits under until review. Also its category_id today.
  parent_category_id  uuid        REFERENCES categories(id) ON DELETE SET NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'declined')),
  reviewed_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  -- Set on approve: the category the team created (or picked) for the listing.
  created_category_id uuid        REFERENCES categories(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pending') = (reviewed_at IS NULL))
);

-- One open request per listing. A declined or approved one can be followed by a new one.
CREATE UNIQUE INDEX category_requests_one_pending_idx
  ON category_requests (listing_id) WHERE status = 'pending';
CREATE INDEX category_requests_status_created_idx ON category_requests (status, created_at);
CREATE INDEX category_requests_requested_by_idx   ON category_requests (requested_by);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON category_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE category_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_requests_owner_insert ON category_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND created_category_id IS NULL
    AND owns_listing(listing_id)
  );

CREATE POLICY category_requests_owner_select ON category_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY category_requests_admin_select ON category_requests
  FOR SELECT TO authenticated
  USING (is_admin());

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke both first, so the grants below are the whole list.
REVOKE ALL ON category_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON category_requests TO authenticated;
GRANT ALL ON category_requests TO service_role;
