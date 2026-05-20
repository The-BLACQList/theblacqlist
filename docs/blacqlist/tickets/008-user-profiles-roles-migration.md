# Ticket 008: User profiles and roles migration

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P0

## Feature Area

Database / Auth

## Context

The `profiles` table extends Supabase's `auth.users` with display-facing user data, and the `user_roles` table is the server-side role store that drives all permission checks on the platform. Roles are never trusted from the JWT — every permission check queries `user_roles` live. A trigger on `auth.users` must auto-create a `profiles` row when a user registers. One `super_admin` role seed record is required before any admin operations are possible. Source documents: `docs/blacqlist/data/database-schema-plan.md` (Section 1: `profiles`, `user_roles`), `docs/blacqlist/data/rls-policy-plan.md` (Section 2, Section 4: `profiles`, `user_roles`).

## User Story

As a newly registered user, I want my profile record to be created automatically when I sign up, so that the platform can associate my saved listings, roles, and settings with my account without requiring a separate setup step.

## Scope

- Write SQL migration file `supabase/migrations/20260507000003_user_profiles_roles.sql`
- Create `profiles` table with exact fields: `id` (uuid PK and FK → auth.users(id) ON DELETE CASCADE), `display_name` (text nullable), `avatar_url` (text nullable — storage path not URL), `bio` (text nullable), `city_id` (uuid nullable FK → cities(id) ON DELETE SET NULL), `website_url` (text nullable), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now())
- Note: schema plan does NOT include an `onboarding_completed` field — omit it; use only exact columns from the schema plan
- Create `user_roles` table with exact fields: `id` (uuid PK), `user_id` (uuid NOT NULL FK → auth.users(id) ON DELETE CASCADE), `role` (text NOT NULL CHECK IN ('supporter', 'owner', 'editor', 'admin', 'super_admin')), `listing_id` (uuid nullable FK → listings(id) ON DELETE CASCADE), `granted_by` (uuid nullable FK → auth.users(id) ON DELETE SET NULL), `created_at` (timestamptz NOT NULL DEFAULT now())
- Apply UNIQUE constraint `(user_id, role, listing_id)` on `user_roles`
- Apply `updated_at` trigger to `profiles`
- Create indexes: `profiles_city_id_idx` on `(city_id)`, `user_roles_user_id_idx` on `(user_id)`, partial `user_roles_listing_id_idx` on `(listing_id) WHERE listing_id IS NOT NULL`
- Enable RLS on both tables
- Write RLS policies per `rls-policy-plan.md`:
  - `profiles`: authenticated SELECT/UPDATE where `auth.uid() = id`; no anon SELECT; INSERT via trigger only; no DELETE
  - `user_roles`: authenticated SELECT where `auth.uid() = user_id`; no INSERT/UPDATE/DELETE via authenticated role
- Create `handle_new_user()` trigger function that auto-inserts a `profiles` row and a `user_roles` row (with `role = 'supporter'`) on `auth.users` INSERT
- Seed one `super_admin` role record for the founding team account (user ID to be populated from the actual Supabase auth user after first sign-up — the seed uses a placeholder that must be replaced)

## Out of Scope

- Auth sign-up or sign-in UI (a later ticket)
- Profile edit UI (a later ticket)
- The `listings` table (Ticket 009) — `user_roles.listing_id` FK to `listings` will fail if `listings` does not yet exist; the FK must be added in a later migration or `listings` must be created before this migration runs (see Dependencies)
- Admin user management UI

## Dependencies

- Depends on: Ticket 006 — geographic tables must exist for `profiles.city_id` FK
- Note on `user_roles.listing_id` FK: The `listings` table referenced by `user_roles.listing_id` does not exist until Ticket 009. Two valid approaches: (a) create `user_roles.listing_id` without the FK in this migration and add the FK constraint in Ticket 009's migration via `ALTER TABLE user_roles ADD CONSTRAINT ...`, or (b) run Ticket 009 before this ticket. Approach (a) is recommended — it avoids a migration ordering dependency. The FK is added in Ticket 009's migration file via `ALTER TABLE`.

## UX Notes

N/A — database migration ticket. No user-facing screens are built here. The trigger behavior is invisible to the user — their profile simply exists after sign-up.

## Design Notes

N/A — database migration ticket.

## Data Notes

**`profiles` table — exact field spec:**

| Column         | Type          | Nullable | Default | Constraint                                |
| -------------- | ------------- | -------- | ------- | ----------------------------------------- |
| `id`           | `uuid`        | NO       | —       | PK, FK → auth.users(id) ON DELETE CASCADE |
| `display_name` | `text`        | YES      | —       | —                                         |
| `avatar_url`   | `text`        | YES      | —       | Storage path only — never a URL           |
| `bio`          | `text`        | YES      | —       | —                                         |
| `city_id`      | `uuid`        | YES      | —       | FK → cities(id) ON DELETE SET NULL        |
| `website_url`  | `text`        | YES      | —       | —                                         |
| `created_at`   | `timestamptz` | NO       | `now()` | —                                         |
| `updated_at`   | `timestamptz` | NO       | `now()` | —                                         |

**`user_roles` table — exact field spec:**

| Column       | Type          | Nullable | Default             | Constraint                                                    |
| ------------ | ------------- | -------- | ------------------- | ------------------------------------------------------------- |
| `id`         | `uuid`        | NO       | `gen_random_uuid()` | PK                                                            |
| `user_id`    | `uuid`        | NO       | —                   | FK → auth.users(id) ON DELETE CASCADE                         |
| `role`       | `text`        | NO       | —                   | CHECK IN ('supporter','owner','editor','admin','super_admin') |
| `listing_id` | `uuid`        | YES      | —                   | FK → listings(id) ON DELETE CASCADE (added in Ticket 009)     |
| `granted_by` | `uuid`        | YES      | —                   | FK → auth.users(id) ON DELETE SET NULL                        |
| `created_at` | `timestamptz` | NO       | `now()`             | —                                                             |

**Unique constraint:** `UNIQUE (user_id, role, listing_id)`

**`handle_new_user()` trigger function:**

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, now(), now());

  -- Assign default 'supporter' role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'supporter', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

Note: `SECURITY DEFINER` is required because the trigger runs in the context of `auth.users` (a different schema) and must write to `public.profiles` and `public.user_roles`.

**RLS policies — `profiles`:**

```sql
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- INSERT is handled by trigger only — no direct INSERT policy needed
-- (The SECURITY DEFINER trigger bypasses RLS)

-- No DELETE policy — deletion via service_role only (account deletion flow)
```

**RLS policies — `user_roles`:**

```sql
-- Users can read their own role records
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for authenticated role
-- All role management is service_role only
```

**Seed data:** One `super_admin` role record. Since the super admin's `auth.users` UUID is not known until the first sign-up, the seed INSERT uses a documented placeholder approach:

```sql
-- TODO: After the founding account signs up, replace <FOUNDING_USER_UUID>
-- with the actual auth.users UUID from the Supabase Auth dashboard
-- Run this INSERT via Supabase SQL editor as a one-time operation, not as a migration
-- DO NOT hardcode a real UUID in this migration file
```

The `super_admin` role seed is documented as a post-deployment manual step, not as a migration seed.

## API Notes

N/A — no API routes or Server Actions in this ticket.

The pattern for checking a user's role in a Server Action (used by later tickets):

```typescript
// In a server-side utility function
export async function getUserRole(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('user_roles')
    .select('role, listing_id')
    .eq('user_id', userId)
  return data ?? []
}
```

Note: role checks in Server Actions use the service_role client to bypass RLS and get all roles for a user — not the anon or authenticated client.

## Implementation Notes

**Files to create:**

- `supabase/migrations/20260507000003_user_profiles_roles.sql`

**Migration structure:**

```sql
-- 1. Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create user_roles table (listing_id FK added in Ticket 009 migration)
CREATE TABLE user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('supporter', 'owner', 'editor', 'admin', 'super_admin')),
  listing_id uuid, -- FK to listings.id added in Ticket 009 migration
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, listing_id)
);

-- 3. Indexes
CREATE INDEX profiles_city_id_idx ON profiles (city_id);
CREATE INDEX user_roles_user_id_idx ON user_roles (user_id);
CREATE INDEX user_roles_listing_id_idx ON user_roles (listing_id) WHERE listing_id IS NOT NULL;

-- 4. updated_at trigger on profiles
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies (profiles)
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 7. RLS policies (user_roles)
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 8. handle_new_user trigger
CREATE OR REPLACE FUNCTION handle_new_user() ... (as above)
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users ...
```

**Key patterns:**

- `profiles.id` is both the PK and the FK to `auth.users` — it shares the same UUID, not a separate auto-generated one
- The trigger function must be `SECURITY DEFINER` to write to `public.profiles` from the `auth` schema context
- `user_roles.listing_id` is created without a FK constraint in this migration; the FK `user_roles.listing_id → listings(id) ON DELETE CASCADE` is added via `ALTER TABLE` in Ticket 009's migration
- The `UNIQUE(user_id, role, listing_id)` constraint treats NULL `listing_id` as distinct — PostgreSQL NULLs are not equal in UNIQUE constraints, so two rows with the same `user_id` and `role` but both `listing_id = NULL` would technically be allowed. For global roles (admin, super_admin), this could create duplicate rows. Add a partial UNIQUE constraint for global roles if this becomes a concern in practice.

**Do not:**

- Set `NEXT_PUBLIC_` prefix on any variable that reads from `user_roles` — role checks are server-only
- Trust `user.user_metadata` or JWT claims for role data — always read from `user_roles` via a server-side query
- Create INSERT or UPDATE RLS policies on `user_roles` for the `authenticated` role — role assignment is admin-only via service_role

## Acceptance Criteria

- [ ] `supabase db push` applies the migration without errors
- [ ] Creating a new user via Supabase Auth (email/password) automatically creates a matching row in `profiles` with the same `id`
- [ ] Creating a new user automatically inserts a `user_roles` row with `role = 'supporter'` and `listing_id = NULL`
- [ ] An authenticated user can `SELECT * FROM profiles WHERE id = auth.uid()` and receive their own row
- [ ] An authenticated user cannot `SELECT * FROM profiles WHERE id != auth.uid()` (returns 0 rows)
- [ ] An authenticated user attempting to INSERT into `user_roles` directly receives a permission denied error
- [ ] `SELECT count(*) FROM user_roles WHERE role = 'supporter'` matches the total number of registered test users
- [ ] The `UNIQUE(user_id, role, listing_id)` constraint prevents a duplicate `supporter` role for the same user
- [ ] `profiles.city_id` FK correctly references the `cities` table created in Ticket 006
- [ ] The `profiles_city_id_idx` and `user_roles_user_id_idx` indexes exist

## Failure States

| Failure                                        | User-visible behavior                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `handle_new_user` trigger fails                | User signs up successfully in Supabase Auth but `profiles` row is missing; subsequent profile queries return null; engineer checks trigger logs in Supabase and fixes the trigger function |
| `update_updated_at()` function missing         | Trigger creation fails; engineer verifies Ticket 006 migration ran first                                                                                                                   |
| `SECURITY DEFINER` not set on trigger function | Trigger fails with permission error when writing to `public.profiles` from `auth` schema context; engineer adds `SECURITY DEFINER` to the function definition                              |
| Duplicate `supporter` role insert on retry     | If the trigger fires twice (edge case in some Supabase auth events), the UNIQUE constraint blocks the second insert; the trigger function should use `INSERT ... ON CONFLICT DO NOTHING`   |

## Edge Cases

- The `UNIQUE(user_id, role, listing_id)` constraint uses NULL semantics — two `NULL` listing_ids are not considered equal in PostgreSQL UNIQUE constraints, meaning two `(user_id, 'admin', NULL)` rows could technically be inserted. Add `INSERT ... ON CONFLICT DO NOTHING` in the trigger and a service-layer guard for admin role grants
- Users deleted from `auth.users` cascade to `profiles` (ON DELETE CASCADE) and `user_roles` (ON DELETE CASCADE) — this is correct; the team should verify this works as expected before the account deletion flow is built
- The `granted_by` field references `auth.users(id)` ON DELETE SET NULL — if an admin who granted a role is later deleted, the granted_by field becomes NULL but the role record remains

## Accessibility Notes

- [ ] N/A — database migration ticket.

## QA Test Cases

| #   | Scenario              | Role               | Steps                                                                               | Expected result                                                                         |
| --- | --------------------- | ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | New user trigger      | Engineer           | Sign up via Supabase Auth email/password via the Supabase dashboard or API          | `profiles` and `user_roles` rows created automatically; `user_roles.role = 'supporter'` |
| 2   | Own profile read      | Authenticated user | Use authenticated Supabase client to `SELECT * FROM profiles WHERE id = auth.uid()` | Returns own profile row                                                                 |
| 3   | Other profile blocked | Authenticated user | Use authenticated Supabase client to SELECT another user's profile by a known UUID  | Returns 0 rows (RLS blocks it)                                                          |
| 4   | Role INSERT blocked   | Authenticated user | Attempt to INSERT into `user_roles` via authenticated client                        | `42501 permission denied`                                                               |
| 5   | Profile UPDATE works  | Authenticated user | UPDATE `display_name` on own profile via authenticated client                       | Update succeeds; `updated_at` is refreshed                                              |

## Security Notes

- `user_roles` is the authoritative role source — never encode roles in JWTs or session metadata; always check `user_roles` server-side on every request requiring a permission check
- The `handle_new_user()` trigger function is `SECURITY DEFINER` — review it carefully; any SQL injection or logic error in it runs with elevated privileges
- `profiles.avatar_url` stores a storage path, not a CDN URL — generate signed or public URLs at read time; never store the full CDN URL
- No direct user INSERT on `user_roles` is permitted — admin role grants happen via `service_role` in Server Actions only; this prevents privilege escalation

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) — N/A for pure SQL migration
- [ ] Lint: zero errors (`npm run lint`) — N/A for SQL files
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for database migration
- [ ] Mobile tested at 375px — N/A for database migration
- [ ] Keyboard navigation tested — N/A for database migration
- [ ] Accessibility requirements met — N/A for database migration
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
