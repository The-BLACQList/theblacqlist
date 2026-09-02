-- =============================================================================
-- Debt ⑳ — pin `search_path` on the two SECURITY DEFINER signup triggers.
-- =============================================================================
-- `create_profile_on_signup()` and `assign_supporter_role_on_signup()` both fire
-- AFTER INSERT ON auth.users and both run SECURITY DEFINER — they execute as the
-- function owner (postgres), which is why they can write to public tables while
-- the insert itself is running as `supabase_auth_admin`.
--
-- Neither one pins `search_path`. A SECURITY DEFINER function with a mutable
-- search_path resolves unqualified names using the *caller's* path, so anything
-- the caller can place earlier on that path — an operator, a cast, a function in
-- a temp schema — is resolved with the owner's privileges. That is the standard
-- SECURITY DEFINER escalation shape, and Supabase's own linter flags it
-- (`function_search_path_mutable`).
--
-- Why this is a separate migration from the rest of the definer-function
-- hardening: the blast radius is different in kind. Break any other definer
-- function and one feature misbehaves. Break these two and **no account can be
-- created at all** — the trigger raises, the INSERT into auth.users aborts, and
-- signup returns "Database error saving new user" for every visitor. That is
-- worth its own gate, its own staging verification, and its own rollback.
--
-- Why the change is behaviour-preserving:
--   * Both bodies already fully schema-qualify their write targets
--     (`public.profiles`, `public.user_roles`), so pinning the path cannot
--     change which table they resolve to. It only removes the caller's ability
--     to shadow the *unqualified* names they still rely on.
--   * `now()` and `gen_random_uuid()` resolve from `pg_catalog`, which Postgres
--     searches implicitly and ahead of `search_path` — unaffected.
--   * `SET search_path = public` matches the convention already established by
--     20260630000000_fix_count_triggers_security_definer.sql. Both files should
--     stay in the same style.
--   * CREATE OR REPLACE keeps the existing triggers wired — `on_auth_user_created`
--     and `on_auth_user_created_role` reference these functions by name, so no
--     trigger is dropped or recreated and there is no window in which a signup
--     could land without a profile or a role.
--
-- Bodies below are byte-for-byte the ones in
-- 20260510000000_initial_blacqlist_mvp_schema.sql (lines 232-240 and 573-581).
-- The only difference in this file is the `SET search_path = public` clause.
--
-- Idempotent: safe to run multiple times.
--
-- ── DOWN PLAN ────────────────────────────────────────────────────────────────
-- Re-run the two CREATE OR REPLACE statements below with the
-- `SET search_path = public` line removed. That restores the exact prior
-- definitions. Nothing else is touched: no table, column, policy, grant, index,
-- or trigger is created, altered, or dropped by this migration.
-- =============================================================================

-- Fires AFTER INSERT ON auth.users. Creates the corresponding profiles row.
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (id) DO NOTHING;  -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

-- Fires AFTER INSERT ON auth.users. Assigns the default 'supporter' role.
CREATE OR REPLACE FUNCTION assign_supporter_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'supporter', now())
  ON CONFLICT (user_id, role, listing_id) DO NOTHING;  -- idempotent guard
  RETURN NEW;
END;
$$;
