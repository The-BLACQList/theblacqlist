-- Supporter one-tap links without an email: the tester types their own email
-- on /t when they tap Start, instead of the founder collecting it first.
--
-- WHY. Supporter links had to name an email when they were made (D4 in
-- docs/blacqlist/ops/tester-week/one-tap-link-plan-2026-10-01.md), so the
-- founder had to ask every supporter for their email before texting them a
-- link. They give it at sign-up anyway, so that step only slowed the invites.
-- Founder decision 2026-10-11 ("yes, we'll do 1 and 2").
--
-- WHAT CHANGES. Only the kind/target CHECK. A supporter row may now have a
-- NULL email; it still never names a listing. Owner rows are unchanged.
-- Links that already name an email keep working exactly as before.
--
-- THE SAFETY RULE LIVES IN THE APP, NOT HERE. When the email is typed on /t,
-- lib/tester/redeem.ts only ever makes a NEW account with it. If the email
-- already has an account, the tester is sent to normal sign-in, so a
-- forwarded link can never be used to sign in to someone else's account.
-- Nothing about RLS or the function grants changes: tester_invites is still
-- admin SELECT only with no write policies.
--
-- DOWN PLAN:
--   The old CHECK can only come back once no supporter row lacks an email.
--   1. Revoke the email-less links (GATE-DATA):
--        UPDATE tester_invites SET revoked_at = now()
--         WHERE kind = 'supporter' AND email IS NULL AND revoked_at IS NULL;
--   2. Fill email from the bound account where there is one, and decide by
--      hand about unbound rows (deleting them loses only unused links):
--        UPDATE tester_invites ti SET email = lower(u.email)
--          FROM auth.users u
--         WHERE ti.kind = 'supporter' AND ti.email IS NULL AND u.id = ti.tester_user_id;
--   3. ALTER TABLE tester_invites DROP CONSTRAINT tester_invites_kind_target;
--      ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_target CHECK (
--        (kind = 'supporter' AND email IS NOT NULL AND listing_id IS NULL)
--        OR (kind = 'owner' AND listing_id IS NOT NULL AND email IS NULL));
--   Then revert the code.

ALTER TABLE tester_invites DROP CONSTRAINT IF EXISTS tester_invites_kind_target;

-- A supporter link names no listing and may name an email; an owner link names
-- a listing and no email.
ALTER TABLE tester_invites ADD CONSTRAINT tester_invites_kind_target CHECK (
  (kind = 'supporter' AND listing_id IS NULL)
  OR (kind = 'owner' AND listing_id IS NOT NULL AND email IS NULL)
);
