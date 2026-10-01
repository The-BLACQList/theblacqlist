-- One-tap tester links: a texted link that signs a tester in and starts the
-- Tester Tour, with no sign-up form and no email round trip.
--
-- WHY THIS EXISTS. The tour asks a tester to create an account, confirm an email
-- and find their way back before step one. Most of the people we are inviting
-- are reached by text, on a phone, and that detour is where they drop. The plan
-- is docs/blacqlist/ops/tester-week/one-tap-link-plan-2026-10-01.md, approved by
-- the founder 2026-10-01 with D1 to D4 at the recommended options.
--
-- ══ A LINK IS A LOGIN. THE SECURITY BOUNDARY IS THE ABSENCE OF WRITE POLICIES ══
-- Holding a live link signs you in as the account it is bound to. So:
--   * only the SHA-256 of the token is stored. The raw token is shown to the
--     admin once and never written to the database, a log, or the audit log;
--   * `tester_invites` gets admin-only SELECT and **no INSERT, UPDATE or DELETE
--     policy at all**. Anyone who could write here could mint themselves a login
--     to any email. Every write comes from the service role through
--     lib/actions/admin/testerLinks.ts and lib/actions/tester/redeemTesterLink.ts;
--   * the two functions below are SECURITY DEFINER with EXECUTE revoked from
--     PUBLIC, anon and authenticated and granted to service_role only.
--
-- WHY A FUNCTION FOR REDEMPTION AND NOT A SELECT THEN UPDATE:
-- A use is claimed with one conditional UPDATE whose RETURNING makes a zero-row
-- result observable. Two taps at the same instant cannot both slip past
-- `max_uses`, and the CHECK on `use_count` is the database backstop if the
-- application path is ever bypassed.
--
-- WHY `tour_enrollments.listing_id` BECOMES NULLABLE:
-- Supporter testers (D2) have no listing, and their reward is a thank-you, not a
-- trial. A NULL listing is the supporter case. The new CHECK makes a trial on a
-- supporter row unrepresentable, so a claim-route bug cannot grant one. The
-- existing one-trial-per-listing index ignores NULLs and is unchanged.
--
-- DOWN PLAN:
--   Soft rollback, preferred: revoke every link
--     (UPDATE tester_invites SET revoked_at = now() WHERE revoked_at IS NULL)
--     under GATE-DATA, then revert the code. Leave the column nullable.
--   Full rollback:
--     DROP FUNCTION IF EXISTS redeem_tester_invite(text);
--     DROP FUNCTION IF EXISTS find_auth_user_id_by_email(text);
--     DROP TABLE IF EXISTS tester_invites;   -- cascades its policies + indexes
--     ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_trial_requires_listing;
--     -- Putting NOT NULL back needs the supporter rows gone first:
--     --   DELETE FROM tour_enrollments WHERE listing_id IS NULL;  -- cascades step rows
--     --   ALTER TABLE tour_enrollments ALTER COLUMN listing_id SET NOT NULL;
--     -- That DELETE loses supporter tour evidence. It is a destructive rollback:
--     -- its own GATE-DATA approval and a backup first.
--   Accounts created through links are ordinary supporter accounts and stay.

-- ============================================================================
-- tester_invites — one row per one-tap link
-- ============================================================================
CREATE TABLE IF NOT EXISTS tester_invites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SHA-256 hex of the token. The raw token is never stored.
  token_hash     text NOT NULL UNIQUE,

  kind           text NOT NULL CHECK (kind IN ('supporter', 'owner')),

  -- Supporters only. PII, so this table is admin-read only.
  email          text,

  -- Owners only. The account used is the listing's owner at redemption time.
  listing_id     uuid REFERENCES listings(id) ON DELETE CASCADE,

  -- A short admin tag such as T-07. An ID, never a name (data-privacy.md).
  label          text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),

  -- Bound on first use, so every later use lands on the same account.
  tester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  max_uses       integer NOT NULL DEFAULT 5,
  use_count      integer NOT NULL DEFAULT 0,
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '14 days',

  first_used_at  timestamptz,
  last_used_at   timestamptz,
  revoked_at     timestamptz,

  -- SET NULL: who made the link is audit colour, not a dependency.
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- A supporter link names an email and no listing; an owner link names a
  -- listing and no email. Never both, never neither.
  CONSTRAINT tester_invites_kind_target CHECK (
    (kind = 'supporter' AND email IS NOT NULL AND listing_id IS NULL)
    OR (kind = 'owner' AND listing_id IS NOT NULL AND email IS NULL)
  ),

  CONSTRAINT tester_invites_use_count_range CHECK (
    max_uses >= 1 AND use_count >= 0 AND use_count <= max_uses
  )
);

DROP TRIGGER IF EXISTS set_updated_at ON tester_invites;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tester_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tester_invites ENABLE ROW LEVEL SECURITY;

-- SELECT only, admins only. See the header: the absence of write policies is
-- the control that stops anyone minting themselves a login.
CREATE POLICY "Admins read tester invites"
  ON tester_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE tester_invites IS
  'One-tap tester links. Stores only the SHA-256 of each token. A live link signs '
  'its holder in as the bound account, so RLS is admin SELECT only with no write '
  'policies; every write goes through the service role.';

-- ============================================================================
-- redeem_tester_invite — claim one use, atomically
-- ============================================================================
-- Zero rows back means expired, revoked, used up, or unknown. The caller shows
-- one generic message for all four and never says which.
CREATE OR REPLACE FUNCTION redeem_tester_invite(p_token_hash text)
RETURNS TABLE (
  id             uuid,
  kind           text,
  email          text,
  listing_id     uuid,
  tester_user_id uuid,
  created_by     uuid
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tester_invites AS ti
     SET use_count     = ti.use_count + 1,
         first_used_at = coalesce(ti.first_used_at, now()),
         last_used_at  = now()
   WHERE ti.token_hash = p_token_hash
     AND ti.revoked_at IS NULL
     AND ti.expires_at > now()
     AND ti.use_count < ti.max_uses
  RETURNING ti.id, ti.kind, ti.email, ti.listing_id, ti.tester_user_id, ti.created_by;
$$;

REVOKE EXECUTE ON FUNCTION redeem_tester_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_tester_invite(text) TO service_role;

-- ============================================================================
-- find_auth_user_id_by_email — one indexed lookup instead of paging listUsers
-- ============================================================================
-- The admin API has no get-by-email, and paging every user to find one is slow
-- and pulls far more PII than the question needs. Returns the id only.
CREATE OR REPLACE FUNCTION find_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
    FROM auth.users AS u
   WHERE lower(u.email) = lower(trim(p_email))
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION find_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_auth_user_id_by_email(text) TO service_role;

-- ============================================================================
-- tour_enrollments — a NULL listing is a supporter tester
-- ============================================================================
ALTER TABLE tour_enrollments ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_trial_requires_listing;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_trial_requires_listing CHECK (
  trial_granted_at IS NULL OR listing_id IS NOT NULL
);
