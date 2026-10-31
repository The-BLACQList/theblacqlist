-- =============================================================================
-- Migration: business_invite_sends, the founder's "Email this business" log (ticket 168)
-- =============================================================================
-- Shoppers add receipts from businesses that are not on The BLACQList yet.
-- /admin/receipts/unlisted groups those by business name, and the founder can
-- email one business at a time, typing the address by hand (O2 B). This table
-- remembers, per business group, when it was last emailed and whether it said
-- STOP, so the page can show "Emailed on [date]" and turn the button off.
--
-- What changes:
--   1. New table business_invite_sends, one row per (normalized_name, city).
--      * normalized_name: lib/spend/business-name.ts normalizeBusinessName.
--      * city: NULL today. receipt_uploads has no city, so groups are by
--        name only. The column is here so a later city match needs no
--        migration. The unique index treats NULL as ''.
--      * business_name: the name as shown on the page (display only).
--      * emailed_at / email_count / sent_by: the last send and how many.
--      * opted_out / opted_out_at: set when the business replies STOP.
--   The typed email address is NOT stored. It lives only in the one send.
--   No shopper data is stored: no user id, no receipt id, no amount.
--
-- RLS:
--   admin   SELECT all rows (is_admin()).
--   INSERT / UPDATE / DELETE: no policy, so only service_role (the admin
--   actions in lib/actions/spend/unlistedInvite.ts, after getAdminSession)
--   can write.
--   anon has no grant at all.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS, DROP POLICY / TRIGGER IF
-- EXISTS before each CREATE.
--
-- Down plan (run by hand only on the founder's word):
--   DROP TABLE IF EXISTS public.business_invite_sends;
-- Dropping it loses the "Emailed on" dates and every STOP. Copy the opted_out
-- rows somewhere first, because a business that said STOP must not be emailed
-- again. The admin page shows its load error until the code is rolled back.
--
-- Order: apply on staging, then prod before the PR merges (migrate before merge).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_invite_sends (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized_name  text        NOT NULL CHECK (char_length(normalized_name) BETWEEN 1 AND 200),
  city             text        CHECK (city IS NULL OR char_length(city) BETWEEN 1 AND 120),
  business_name    text        NOT NULL CHECK (char_length(btrim(business_name)) BETWEEN 1 AND 200),
  emailed_at       timestamptz,
  email_count      integer     NOT NULL DEFAULT 0 CHECK (email_count >= 0),
  opted_out        boolean     NOT NULL DEFAULT false,
  opted_out_at     timestamptz,
  sent_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_invite_sends_group_key
  ON public.business_invite_sends (normalized_name, (coalesce(city, '')));

COMMENT ON TABLE public.business_invite_sends IS
  'Ticket 168: one row per unlisted business group the founder has emailed or marked STOP. No shopper data, no email address.';

ALTER TABLE public.business_invite_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_invite_sends_admin_select ON public.business_invite_sends;
CREATE POLICY business_invite_sends_admin_select ON public.business_invite_sends
  FOR SELECT TO authenticated
  USING (is_admin());

REVOKE ALL ON public.business_invite_sends FROM anon, authenticated;
GRANT SELECT ON public.business_invite_sends TO authenticated;
GRANT ALL ON public.business_invite_sends TO service_role;

DROP TRIGGER IF EXISTS set_updated_at ON public.business_invite_sends;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.business_invite_sends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
