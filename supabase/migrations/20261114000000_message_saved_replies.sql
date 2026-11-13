-- =============================================================================
-- Migration: saved replies for the owner inbox
-- (owner-experience round 2, part H: messages about job and event postings,
-- 2026-11-13)
-- =============================================================================
-- Additive only: one new table. Safe to apply before or after the code that
-- uses it deploys. Until it is applied, the inbox shows the built-in quick
-- replies only (the loader treats a read error as "no saved replies").
--
-- What changes:
--   message_saved_replies: an owner's own reply texts, offered as chips in the
--   reply box. kind narrows where a reply is offered: 'customer' (threads on a
--   business page), 'job' (Job applicants), 'event' (Event guests) or 'any'.
--   A chip only fills the reply box; nothing is sent from this table.
--
-- No posting-specific schema is needed. A message about a job or event is a
-- conversation whose listing_id is the posting, which conversations already
-- allow, and the posting owner already passes owns_listing().
--
-- RLS: the same model as the other messaging tables. Clients may only SELECT
-- their own rows; every write goes through a server action
-- (lib/actions/messaging/savedReplies.ts) on the service role, which checks
-- the signed-in user and the cap of 30 per owner.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS, DROP POLICY IF EXISTS.
--
-- Down:
--   DROP TABLE IF EXISTS public.message_saved_replies;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_saved_replies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text        NOT NULL DEFAULT 'any'
                             CHECK (kind IN ('any','customer','job','event')),
  title          text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  body           text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_saved_replies_owner_idx
  ON public.message_saved_replies (owner_user_id, created_at);

ALTER TABLE public.message_saved_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_saved_replies: owner select" ON public.message_saved_replies;
CREATE POLICY "message_saved_replies: owner select" ON public.message_saved_replies
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

REVOKE ALL ON public.message_saved_replies FROM anon, authenticated;
GRANT SELECT ON public.message_saved_replies TO authenticated;
GRANT ALL ON public.message_saved_replies TO service_role;
