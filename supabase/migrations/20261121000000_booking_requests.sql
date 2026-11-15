-- =============================================================================
-- Booking requests (ticket 109, 2026-11-15).
--
-- Request-and-confirm, never instant booking. A visitor (signed in or not)
-- asks a Premium business for a time; the owner accepts, declines or suggests
-- another time, and the visitor hears back by email. No payment is taken.
--
-- Two tables:
--
--   listing_booking_settings: one row a page. The owner switches the form on,
--   writes the line above it and picks which fields to ask for. No row means
--   the form is off.
--
--   booking_requests: one row a request. The visitor's name, email and phone
--   are personal data: only the page's owner and the requester read them, they
--   are never sent to analytics, and Sentry's scrubber redacts them
--   (lib/observability/sentry-scrub.ts).
--
-- Who writes what:
--   * A request is inserted by the server action with the service client,
--     after the honeypot, Turnstile, the rate limit and the plan check. There
--     is deliberately no INSERT policy: a guest has no session, and an open
--     anon INSERT would skip every one of those checks.
--   * The owner updates status and reply through RLS on their own client.
--   * Nobody deletes. A page's requests go with the page (ON DELETE CASCADE).
--
-- The ticket's draft had requested_at / alternate_at timestamps. The form the
-- sample page already shows asks for a date and a time of day (morning,
-- afternoon, evening), which is what people know when they ask; an exact time
-- is the owner's to offer. So: requested_date + time_window, and the owner's
-- suggestion is free text in owner_reply with status 'proposed'.
--
-- Down:
--   DROP TABLE IF EXISTS public.booking_requests;
--   DROP TABLE IF EXISTS public.listing_booking_settings;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_booking_settings (
  listing_id      uuid        NOT NULL PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  enabled         boolean     NOT NULL DEFAULT false,
  prompt          text        NULL,
  ask_date        boolean     NOT NULL DEFAULT true,
  ask_party_size  boolean     NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_booking_settings_prompt_check
    CHECK (prompt IS NULL OR char_length(btrim(prompt)) BETWEEN 1 AND 200)
);

ALTER TABLE public.listing_booking_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read the settings of a published page (the form's line and fields).
DROP POLICY IF EXISTS "listing_booking_settings: public read" ON public.listing_booking_settings;
CREATE POLICY "listing_booking_settings: public read"
  ON public.listing_booking_settings FOR SELECT TO anon, authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_booking_settings: owner read" ON public.listing_booking_settings;
CREATE POLICY "listing_booking_settings: owner read"
  ON public.listing_booking_settings FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_booking_settings: owner insert" ON public.listing_booking_settings;
CREATE POLICY "listing_booking_settings: owner insert"
  ON public.listing_booking_settings FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_booking_settings: owner update" ON public.listing_booking_settings;
CREATE POLICY "listing_booking_settings: owner update"
  ON public.listing_booking_settings FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  requester_user_id  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name     text        NOT NULL,
  requester_email    text        NOT NULL,
  requester_phone    text        NULL,
  service_id         uuid        NULL REFERENCES public.services(id) ON DELETE SET NULL,
  requested_date     date        NULL,
  time_window        text        NOT NULL DEFAULT 'any',
  party_size         integer     NULL,
  note               text        NULL,
  status             text        NOT NULL DEFAULT 'pending',
  owner_reply        text        NULL,
  responded_at       timestamptz NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_requests_name_check
    CHECK (char_length(btrim(requester_name)) BETWEEN 1 AND 80),
  CONSTRAINT booking_requests_email_check
    CHECK (char_length(requester_email) BETWEEN 3 AND 254 AND requester_email LIKE '%_@_%'),
  CONSTRAINT booking_requests_phone_check
    CHECK (requester_phone IS NULL OR char_length(requester_phone) BETWEEN 7 AND 30),
  CONSTRAINT booking_requests_window_check
    CHECK (time_window IN ('any', 'morning', 'afternoon', 'evening')),
  CONSTRAINT booking_requests_party_check
    CHECK (party_size IS NULL OR party_size BETWEEN 1 AND 500),
  CONSTRAINT booking_requests_note_check
    CHECK (note IS NULL OR char_length(note) <= 1000),
  CONSTRAINT booking_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'proposed', 'cancelled')),
  CONSTRAINT booking_requests_reply_check
    CHECK (owner_reply IS NULL OR char_length(owner_reply) <= 500)
);

-- The owner's inbox, newest first.
CREATE INDEX IF NOT EXISTS booking_requests_listing_idx
  ON public.booking_requests (listing_id, created_at DESC);

-- A signed-in requester's own requests.
CREATE INDEX IF NOT EXISTS booking_requests_requester_idx
  ON public.booking_requests (requester_user_id)
  WHERE requester_user_id IS NOT NULL;

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- No anon access at all. No INSERT or DELETE policy (see the header).

DROP POLICY IF EXISTS "booking_requests: owner read" ON public.booking_requests;
CREATE POLICY "booking_requests: owner read"
  ON public.booking_requests FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "booking_requests: requester read" ON public.booking_requests;
CREATE POLICY "booking_requests: requester read"
  ON public.booking_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "booking_requests: owner update" ON public.booking_requests;
CREATE POLICY "booking_requests: owner update"
  ON public.booking_requests FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- The owner may change only the answer, never what the visitor asked for.
REVOKE UPDATE ON public.booking_requests FROM authenticated;
GRANT UPDATE (status, owner_reply, responded_at, updated_at)
  ON public.booking_requests TO authenticated;
