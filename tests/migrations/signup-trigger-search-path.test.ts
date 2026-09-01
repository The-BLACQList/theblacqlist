// =============================================================================
// Migration test: 20260901000000_signup_trigger_search_path.sql  (debt ⑳)
// =============================================================================
// The migration pins `search_path` on the two SECURITY DEFINER triggers that
// fire AFTER INSERT ON auth.users. The thing that makes it worth its own PR is
// not the size of the diff — it is that these two functions sit on the signup
// path, so a mistake here does not degrade a feature, it stops every new
// account from being created. So the test that matters most is not "is the
// clause present", it is "does signup still work after the clause is present".
//
// A note on honesty about what this migration does and does not fix: both
// function bodies already fully schema-qualify their write targets
// (`public.profiles`, `public.user_roles`), and `now()` resolves from
// pg_catalog ahead of search_path. There is therefore no live exploit to
// reproduce here, and this file does not stage a theatrical one. What the pin
// closes is the latent path — the next edit to either body that introduces an
// unqualified name would otherwise be resolvable by the caller. The tests below
// prove the pin is present, that the triggers survived CREATE OR REPLACE, and
// that signup is now independent of the caller's search_path by construction
// rather than by accident.
//
// The fixture stands up minimal stand-ins for auth.users, profiles, and
// user_roles and then installs the ORIGINAL, unpinned function definitions —
// exactly as 20260510000000_initial_blacqlist_mvp_schema.sql does — so the
// pre-state assertion can prove the fixture actually reproduces the condition
// under test. Without that, every assertion below could pass vacuously.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases — the harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  withScratchDb,
} from './helpers'

const MIGRATION = path.join(
  MIGRATIONS_DIR,
  '20260901000000_signup_trigger_search_path.sql',
)

const USER_ID = '11111111-1111-1111-1111-111111111111'
const USER_2_ID = '22222222-2222-2222-2222-222222222222'

const FUNCTIONS = ['create_profile_on_signup', 'assign_supporter_role_on_signup']
const TRIGGERS = ['on_auth_user_created', 'on_auth_user_created_role']

// The pre-migration state, copied from the initial schema migration: the two
// tables the triggers write to, and the two functions WITHOUT `SET search_path`.
const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE TABLE auth.users (
    id         uuid        NOT NULL PRIMARY KEY,
    email      text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE public.profiles (
    id           uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE public.user_roles (
    id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       text        NOT NULL CHECK (role IN ('supporter','owner','editor','admin','super_admin')),
    listing_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role, listing_id)
  );

  -- Verbatim from 20260510000000, including the absence of SET search_path.
  CREATE OR REPLACE FUNCTION create_profile_on_signup()
  RETURNS TRIGGER AS $fn$
  BEGIN
    INSERT INTO public.profiles (id, created_at, updated_at)
    VALUES (NEW.id, now(), now())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();

  CREATE OR REPLACE FUNCTION assign_supporter_role_on_signup()
  RETURNS TRIGGER AS $fn$
  BEGIN
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'supporter', now())
    ON CONFLICT (user_id, role, listing_id) DO NOTHING;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION assign_supporter_role_on_signup();
`

type FnRow = { proname: string; prosecdef: boolean; proconfig: string[] | null }
type TrigRow = { tgname: string; proname: string }

function readFunctions(url: string): FnRow[] {
  return query<FnRow>(
    url,
    `SELECT p.proname, p.prosecdef, p.proconfig
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('create_profile_on_signup', 'assign_supporter_role_on_signup')
      ORDER BY p.proname`,
  )
}

function readSignupTriggers(url: string): TrigRow[] {
  return query<TrigRow>(
    url,
    `SELECT t.tgname, p.proname
       FROM pg_trigger t
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
      ORDER BY t.tgname`,
  )
}

describe.skipIf(!DB_REACHABLE)('20260901000000_signup_trigger_search_path', () => {
  it('the fixture reproduces the unpinned pre-state, and the migration pins it', async () => {
    await withScratchDb('signup_path_pin', async (url) => {
      exec(url, FIXTURE)

      // Without this, every assertion after the migration could pass vacuously.
      const before = readFunctions(url)
      expect(before.map((f) => f.proname)).toEqual([...FUNCTIONS].sort())
      for (const fn of before) {
        expect(fn.prosecdef).toBe(true)
        expect(fn.proconfig).toBeNull()
      }

      applyFile(url, MIGRATION)

      const after = readFunctions(url)
      expect(after.map((f) => f.proname)).toEqual([...FUNCTIONS].sort())
      for (const fn of after) {
        // SECURITY DEFINER must survive — dropping it is the other way to break
        // signup, because the trigger then runs as supabase_auth_admin, which
        // has no privileges on public tables.
        expect(fn.prosecdef).toBe(true)
        expect(fn.proconfig).toContain('search_path=public')
      }
    })
  })

  it('signup still works — a new auth user gets a profile and a supporter role', async () => {
    await withScratchDb('signup_path_still_works', async (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      exec(url, `INSERT INTO auth.users (id, email) VALUES ('${USER_ID}', 'a@example.test');`)

      expect(query(url, `SELECT id FROM public.profiles WHERE id = '${USER_ID}'`)).toHaveLength(1)
      expect(
        query(
          url,
          `SELECT role FROM public.user_roles WHERE user_id = '${USER_ID}' AND role = 'supporter'`,
        ),
      ).toHaveLength(1)
    })
  })

  it('signup no longer depends on the caller search_path', async () => {
    await withScratchDb('signup_path_hostile_caller', async (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      // A caller whose own path resolves nothing. After the pin, the functions
      // carry their own path and are unaffected; this is the property the
      // migration buys, stated as a test rather than left as a claim.
      exec(
        url,
        `SET search_path = '';
         INSERT INTO auth.users (id, email) VALUES ('${USER_2_ID}', 'b@example.test');`,
      )

      expect(query(url, `SELECT id FROM public.profiles WHERE id = '${USER_2_ID}'`)).toHaveLength(1)
      expect(
        query(url, `SELECT role FROM public.user_roles WHERE user_id = '${USER_2_ID}'`),
      ).toHaveLength(1)
    })
  })

  it('CREATE OR REPLACE left both triggers wired to the same functions', async () => {
    await withScratchDb('signup_path_triggers', async (url) => {
      exec(url, FIXTURE)

      const before = readSignupTriggers(url)
      applyFile(url, MIGRATION)
      const after = readSignupTriggers(url)

      // Same two triggers, same names, same target functions. A migration that
      // dropped and recreated them would open a window in which a signup lands
      // without a profile or a role.
      expect(after.map((t) => t.tgname)).toEqual([...TRIGGERS].sort())
      expect(after).toEqual(before)
    })
  })

  it('is idempotent', async () => {
    await withScratchDb('signup_path_idempotent', async (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)

      for (const fn of readFunctions(url)) {
        expect(fn.proconfig).toContain('search_path=public')
      }
      expect(readSignupTriggers(url)).toHaveLength(TRIGGERS.length)

      exec(url, `INSERT INTO auth.users (id, email) VALUES ('${USER_ID}', 'c@example.test');`)
      expect(query(url, `SELECT id FROM public.profiles WHERE id = '${USER_ID}'`)).toHaveLength(1)
    })
  })
})
