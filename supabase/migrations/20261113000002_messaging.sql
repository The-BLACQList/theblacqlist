-- =============================================================================
-- Migration: customer -> business messaging (decision 2026-11-13)
-- =============================================================================
-- "Send Message" on a listing page was a mailto: link, which does nothing on a
-- device with no mail app. This adds in-app messaging: a signed-in customer can
-- start one conversation per business listing, the owner replies, and each
-- listing has an inbox switch (closed by default, owners opt in). Owners can
-- block a customer; either side can report; an admin can suspend a user's
-- messaging platform-wide.
--
-- What changes:
--   1. listings.messaging_enabled boolean NOT NULL DEFAULT false.
--      The inbox switch. Off blocks NEW conversations only; existing threads
--      stay open for replies. Owners write it through the existing
--      "listings: owner update" policy (listings_owner_guard does not list it).
--   2. conversations: one row per (listing, customer). Read markers per side,
--      and last_message_preview (first 160 chars) so the inbox list needs no
--      per-row message query.
--   3. messages: body 1..2000 chars. sender_user_id goes NULL if the sender's
--      account is deleted (a customer's deletion removes the whole thread).
--   4. message_blocks: (owner_user_id, blocked_user_id). A block covers every
--      listing that owner has.
--   5. messaging_suspensions: one row per suspended user, written only by the
--      admin action. It is NOT a column on profiles, because users can update
--      their own profiles row ("profiles: authenticated update own") and could
--      clear it.
--   6. moderation_queue.queue_type gains 'message_report'
--      (entity_type = 'conversation', entity_id = conversations.id,
--       details = { conversation_id, message_id, reported_user_id, reporter_role,
--                   reason, note }).
--   7. unread_message_count(): unread messages for auth.uid(), both sides.
--      SECURITY INVOKER, so RLS still decides what it can see.
--   8. messaging_restricted(p_listing_id): true when auth.uid() is suspended or
--      blocked by that listing's owner. SECURITY DEFINER so the listing page can
--      show "You can't message this business" without reading message_blocks
--      (which customers cannot see). It only ever answers about the caller.
--
-- RLS:
--   conversations  SELECT: the customer, or the listing owner (owns_listing()).
--   messages       SELECT: anyone who can read the parent conversation.
--   message_blocks SELECT: the owner who made the block.
--   messaging_suspensions: no policy (service_role only).
--   No INSERT / UPDATE / DELETE policy on any of them: every write goes through
--   the server actions in lib/actions/messaging/, which check the rules (inbox
--   open, not the owner, not blocked, not suspended, rate limits) and then write
--   with the service client.
--   anon has no grant at all.
--
-- Idempotent: ADD COLUMN / CREATE TABLE / INDEX IF NOT EXISTS, DROP POLICY IF
-- EXISTS before each CREATE, CREATE OR REPLACE FUNCTION, DROP CONSTRAINT IF
-- EXISTS before re-adding the queue_type CHECK.
--
-- Down plan (run by hand only on the founder's word):
--   DELETE FROM moderation_queue WHERE queue_type = 'message_report';
--   ALTER TABLE moderation_queue DROP CONSTRAINT moderation_queue_queue_type_check;
--   ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_queue_type_check
--     CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification','new_submission'));
--   DROP FUNCTION IF EXISTS public.messaging_restricted(uuid);
--   DROP FUNCTION IF EXISTS public.unread_message_count();
--   DROP TABLE IF EXISTS public.messaging_suspensions;
--   DROP TABLE IF EXISTS public.message_blocks;
--   DROP TABLE IF EXISTS public.messages;
--   DROP TABLE IF EXISTS public.conversations;
--   ALTER TABLE public.listings DROP COLUMN IF EXISTS messaging_enabled;
-- Dropping the tables loses every conversation, block and suspension. Turn
-- FEATURE_MESSAGING off first: the listing page reads messaging fail-soft and
-- falls back to the mailto: CTA, but the inbox pages show their load error
-- until the code is rolled back.
--
-- Order: apply on staging, then prod before the PR merges (migrate before merge).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1 — the inbox switch
-- -----------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS messaging_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.messaging_enabled IS
  'Inbox switch (2026-11-13). true: customers can start a conversation from the listing page. false blocks new conversations only; existing threads stay open.';

-- -----------------------------------------------------------------------------
-- PART 2 — conversations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id             uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  customer_user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_message_at        timestamptz NOT NULL DEFAULT now(),
  last_message_preview   text        CHECK (last_message_preview IS NULL OR char_length(last_message_preview) <= 160),
  customer_last_read_at  timestamptz,
  owner_last_read_at     timestamptz,
  CONSTRAINT conversations_listing_customer_key UNIQUE (listing_id, customer_user_id)
);

CREATE INDEX IF NOT EXISTS conversations_customer_recent_idx
  ON public.conversations (customer_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_listing_recent_idx
  ON public.conversations (listing_id, last_message_at DESC);

COMMENT ON TABLE public.conversations IS
  'Customer -> business messaging (2026-11-13). One thread per (listing, customer). Writes only through lib/actions/messaging/ with the service client.';

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations: participant select" ON public.conversations;
CREATE POLICY "conversations: participant select" ON public.conversations
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid() OR owns_listing(listing_id));

REVOKE ALL ON public.conversations FROM anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

-- -----------------------------------------------------------------------------
-- PART 3 — messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  body             text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at);

COMMENT ON TABLE public.messages IS
  'Customer -> business messaging (2026-11-13). Plain text, 1..2000 chars. Writes only through lib/actions/messaging/.';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages: participant select" ON public.messages;
CREATE POLICY "messages: participant select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.customer_user_id = auth.uid() OR owns_listing(c.listing_id))
    )
  );

REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- -----------------------------------------------------------------------------
-- PART 4 — message_blocks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_blocks (
  owner_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, blocked_user_id),
  CONSTRAINT message_blocks_not_self CHECK (owner_user_id <> blocked_user_id)
);

COMMENT ON TABLE public.message_blocks IS
  'An owner blocked a customer from messaging any of their listings (2026-11-13). The customer is never told it is a block.';

ALTER TABLE public.message_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_blocks: owner select" ON public.message_blocks;
CREATE POLICY "message_blocks: owner select" ON public.message_blocks
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

REVOKE ALL ON public.message_blocks FROM anon, authenticated;
GRANT SELECT ON public.message_blocks TO authenticated;
GRANT ALL ON public.message_blocks TO service_role;

-- -----------------------------------------------------------------------------
-- PART 5 — messaging_suspensions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messaging_suspensions (
  user_id        uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended_at   timestamptz NOT NULL DEFAULT now(),
  suspended_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  queue_item_id  uuid        REFERENCES public.moderation_queue(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.messaging_suspensions IS
  'Admin suspended this user''s messaging platform-wide (2026-11-13). service_role only; written by lib/actions/admin/suspendMessaging.ts.';

ALTER TABLE public.messaging_suspensions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.messaging_suspensions FROM anon, authenticated;
GRANT ALL ON public.messaging_suspensions TO service_role;

-- -----------------------------------------------------------------------------
-- PART 6 — moderation_queue.queue_type
-- -----------------------------------------------------------------------------
ALTER TABLE moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_queue_type_check;
ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_queue_type_check
  CHECK (queue_type IN ('claim','correction','review','flagged_listing','verification','new_submission','message_report'));

-- -----------------------------------------------------------------------------
-- PART 7 — unread_message_count()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unread_message_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT c.id, coalesce(c.customer_last_read_at, '-infinity'::timestamptz) AS read_at
    FROM conversations c
    WHERE c.customer_user_id = auth.uid()
    UNION ALL
    SELECT c.id, coalesce(c.owner_last_read_at, '-infinity'::timestamptz) AS read_at
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    WHERE l.owner_user_id = auth.uid()
      AND l.deleted_at IS NULL
  )
  SELECT count(*)::integer
  FROM messages m
  JOIN mine ON mine.id = m.conversation_id
  WHERE m.created_at > mine.read_at
    AND m.sender_user_id IS DISTINCT FROM auth.uid();
$$;

REVOKE ALL ON FUNCTION public.unread_message_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_message_count() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- PART 8 — messaging_restricted(p_listing_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messaging_restricted(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM messaging_suspensions s WHERE s.user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM listings l
      JOIN message_blocks b ON b.owner_user_id = l.owner_user_id
      WHERE l.id = p_listing_id
        AND b.blocked_user_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.messaging_restricted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_restricted(uuid) TO authenticated, service_role;
