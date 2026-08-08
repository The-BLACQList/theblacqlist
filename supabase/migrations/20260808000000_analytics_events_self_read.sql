-- =============================================================================
-- Migration: analytics_events self-read policy (/account/activity)
-- Product: The BLACQList
--
-- Defect (Finding 6, founder click-walk 2026-08-06): /account/activity always
-- rendered its "No visits yet" empty state, even for accounts that had visited
-- listings. The page code is correct — the policy set was incomplete.
--
-- app/account/activity/page.tsx reads analytics_events through the user-scoped
-- createClient(), so RLS applies. The only SELECT policy on the table is
-- "analytics_events: owner read own listing events" (20260510000001:732), which
-- grants reads to BUSINESS OWNERS for listings they own. A visitor reading their
-- own browsing history matches no policy, and RLS default-deny returns zero rows
-- silently. Hence the permanent empty state.
--
-- Scope is deliberately narrow. analytics_events is a raw event stream carrying
-- session IDs, hashed IPs, user agents, referrers, and arbitrary `properties`
-- for every instrumented action. A blanket `user_id = auth.uid()` policy would
-- expose all of that to the client for the sake of one "recently viewed" list.
-- This policy grants exactly the predicate the page already filters on —
-- page_view events on listings — and nothing else (`data-privacy.md`: minimize
-- what you pull).
--
-- Additive and reversible:
--   * No existing policy is modified. Postgres OR-s SELECT policies, so the
--     owner-analytics policy keeps working exactly as before.
--   * No data is read, written, or migrated.
--   * Down plan is at the bottom of this file (GATE-DATA).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Let an authenticated user read their own listing page views.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "analytics_events: user reads own listing views" ON analytics_events;

CREATE POLICY "analytics_events: user reads own listing views"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND event_name = 'page_view'
    AND entity_type = 'listing'
  );

-- -----------------------------------------------------------------------------
-- 2) Index the query this unblocks.
--
-- The page orders by created_at DESC and limits 100. The four existing indexes
-- are single-column (event_name; entity_type,entity_id; user_id; created_at) —
-- none of them serve this shape, so /account/activity would sort a growing
-- event stream on every load.
--
-- Partial + composite: the WHERE clause matches the policy predicate exactly, so
-- the index stays small (page views on listings only) while covering the filter
-- and the sort. Written non-CONCURRENTLY because Supabase runs each migration in
-- a transaction; the table is small pre-launch (site is behind COMING_SOON_MODE),
-- so the brief write lock is not a production concern. Revisit if this table
-- grows large before the index ships.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS analytics_events_user_listing_views_idx
  ON analytics_events (user_id, created_at DESC)
  WHERE event_name = 'page_view' AND entity_type = 'listing';

-- =============================================================================
-- DOWN PLAN (GATE-DATA rollback — run manually, not automatically)
-- =============================================================================
-- DROP POLICY IF EXISTS "analytics_events: user reads own listing views" ON analytics_events;
-- DROP INDEX IF EXISTS analytics_events_user_listing_views_idx;
--
-- Effect of rolling back: /account/activity returns to rendering its empty state
-- for every user. No data is lost — the events themselves are untouched.
-- =============================================================================
