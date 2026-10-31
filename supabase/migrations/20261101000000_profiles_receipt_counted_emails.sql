-- =============================================================================
-- Migration: a switch for the "your receipt is counted" email (ticket 165)
-- =============================================================================
-- When the founder approves a receipt, the shopper gets an email saying it is
-- counted. Shoppers can turn that email off on /account/settings. The
-- needs-a-fix email has no switch: it is about something the shopper started,
-- so it always sends.
--
-- What changes:
--   1. profiles gains receipt_counted_emails boolean NOT NULL DEFAULT true.
--      Every existing row reads true, so nobody is opted out by the migration.
--
-- Nothing else needs to change:
--   * "profiles: authenticated update own" (20260510000001) already lets a
--     member update their own row, which is how the settings switch saves.
--   * The send reads the column through the service client. A failed read is
--     treated as true, so a missing column never blocks an email.
--
-- No row is updated beyond the default fill. No policy changes. No data is
-- exposed: the column is read only by its owner and by the service role.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
--
-- Down plan (run by hand only on the founder's word):
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS receipt_counted_emails;
-- Dropping it is safe for the app: the send treats a failed read as "on" and the
-- settings switch would show its error state until the code is rolled back.
--
-- Order: apply on staging, then prod before the PR merges (migrate before merge).
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receipt_counted_emails boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.receipt_counted_emails IS
  'Ticket 165: send the "your receipt is counted" email. Needs-a-fix emails always send.';
