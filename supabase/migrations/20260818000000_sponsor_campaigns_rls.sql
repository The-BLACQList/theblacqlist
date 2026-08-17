-- =============================================================================
-- sponsor_campaigns: give the table the RLS policies it has been missing.
-- =============================================================================
-- 20260511000003_monetization_foundation.sql:111-112 created the table, turned
-- RLS ON, and stopped:
--
--     ALTER TABLE sponsor_campaigns ENABLE ROW LEVEL SECURITY;
--     -- Admin UI required before reads are needed — no policies yet.
--
-- RLS enabled with zero policies is deny-all. Every read and write since has
-- only worked through the service-role key, which bypasses RLS entirely. That
-- was a deliberate placeholder, not an oversight — but it means the admin
-- surface cannot query this table through the regular authenticated client the
-- way every other admin list page does.
--
-- This migration adds the one policy the table actually needs today and nothing
-- more.
--
-- WHY ADMIN-ONLY, AND WHY NOTHING ELSE:
--
--   * The table has NO owner column. There is no `user_id`, no `listing_id`,
--     nothing tying a row to an account. A sponsor-scoped policy cannot be
--     written against this shape — there is no column to scope it by.
--   * `contact_email` is PII and `budget_cents` is commercially sensitive.
--     Neither belongs in an anon-readable table, so there is deliberately no
--     public read policy. Compare 20260815010000_spend_aggregate_rls_close_anon_read.sql,
--     which closed anon read on the aggregate tables for the same reason.
--   * F-2 (self-serve campaign builder) WILL need a sponsor-owned read/write
--     path. That requires a new owner column and a decision about whether a
--     sponsor is an `auth.users` row at all — neither of which exists yet.
--     Adding a speculative column here to support a policy nobody can use is
--     exactly the overbuild the database rules forbid. It is F-2's first work
--     item, not this migration's.
--
-- Written to be pasteable into the Supabase SQL editor and safe to run twice.
-- Apply to STAGING first, then production.
-- =============================================================================

-- Idempotent: harmless if already enabled, which it is.
ALTER TABLE sponsor_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin read/write.
--
-- The service-role key already bypasses RLS, so server-side admin actions in
-- lib/actions/admin/ work without this. The policy exists so the admin list
-- page can SELECT through the regular authenticated client, matching how
-- sponsored_placements is handled in 20260517000000_sponsored_placements_targeting.sql:16-32.
--
-- The role check is inlined rather than calling is_admin(). That is the repo
-- convention, stated at 20260510000001_mvp_rls_policies.sql:29-31: helpers exist
-- for application code, but policies inline the condition "for clarity and
-- caching".
DROP POLICY IF EXISTS "admin_sponsor_campaigns_all" ON sponsor_campaigns;
CREATE POLICY "admin_sponsor_campaigns_all"
  ON sponsor_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- No policy is granted to `anon`. An anonymous request therefore matches no
-- policy and reads nothing — which is the intended outcome, not a gap.
