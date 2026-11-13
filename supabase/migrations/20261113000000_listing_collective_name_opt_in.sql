-- =============================================================================
-- Migration: a business opts in to being named in The Collective (tickets 166, 183)
-- =============================================================================
-- A shopper's counted share (ticket 166, which can include the amount spent)
-- names the business only when the business has said yes. Until then it reads
-- "a local business" and links to /flow-map.
-- `[Decision — founder, 2026-11-13]` Support posts (ticket 183) always name the
-- business and don't read this column.
--
-- What changes:
--   1. listings gains collective_name_opt_in boolean NOT NULL DEFAULT false.
--      Every existing row reads false, so no business is named by the migration.
--
-- Nothing else needs to change:
--   * "listings: owner update" (20260510000001) already lets the owner update
--     their own row, which is how the dashboard switch saves.
--   * The entitlement guard (20260926000000) blocks owners only from the system
--     columns it lists. This column isn't one of them, so owners can change it.
--   * Shopper pages read the column through the service client, scoped to the
--     shopper's own receipt. A failed read is treated as false (not named).
--
-- No row is updated beyond the default fill. No policy changes. The column is a
-- business preference, not personal data.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
--
-- Down plan (run by hand only on the founder's word):
--   ALTER TABLE public.listings DROP COLUMN IF EXISTS collective_name_opt_in;
-- Dropping it is safe for the app: reads fall back to "not named", and the
-- dashboard switch shows its error state until the code is rolled back.
--
-- Order: apply on staging, then prod before the PR merges (migrate before merge).
-- =============================================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS collective_name_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.collective_name_opt_in IS
  'Ticket 166: the owner agrees to the business name appearing on a shopper''s counted share (which may include the amount). Off by default. Support posts always name the business.';
