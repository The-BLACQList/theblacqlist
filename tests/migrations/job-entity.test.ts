// =============================================================================
// Migration test: 20260813000000_job_entity.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and asserts its properties
// BEHAVIOURALLY — by inserting rows as the `anon` and `authenticated` roles with
// a real auth.uid(), not by reading pg_policies and trusting that a policy named
// "owner insert" only lets owners insert. A policy that exists and a policy that
// works are different claims.
//
// The fixture deliberately installs the OLD seven-value entity_type CHECK first
// (the one 20260524000001 left behind), so case 2 proves the migration actually
// changes something. Without that, "a job listing inserts" would pass on a table
// that never had a constraint at all.
//
// What each case protects:
//   1.  Table shape           -> the columns the actions write, with the
//                               nullability and defaults they rely on.
//   2.  entity_type CHECK     -> 'job' was REJECTED before this migration and is
//                               accepted after. This is the whole reason the
//                               checkpoint exists — the DB has refused job
//                               listings since 20260524000001:3-4. An unknown
//                               type must still be rejected; widening the CHECK
//                               must not disable it.
//   3.  Salary sanity CHECKs  -> an inverted range, and a pay figure with no
//                               period, both have no coherent render and cannot
//                               be emitted as JobPosting.baseSalary.
//   4.  Enum CHECKs           -> employment_type / workplace_type / cta_type are
//                               constrained at the database, so a bad value
//                               cannot arrive via any caller.
//   5.  updated_at trigger    -> the shared update_updated_at() is actually
//                               attached; the dashboard reports on that column.
//   6.  Listing cascade       -> deleting the listing takes its detail row. A
//                               detail row outliving its listing is orphaned
//                               data no screen can reach.
//   7.  Hiring SET NULL       -> deleting the HIRING company must NOT delete the
//                               job. ON DELETE SET NULL vs CASCADE is the
//                               difference between "company left" and "every
//                               role they posted vanished".
//   8.  anon read             -> published only. A draft job must not leak to
//                               the public web.
//   9.  RLS: read isolation   -> user B cannot read A's unpublished job.
//   10. RLS: write isolation  -> B cannot insert, update, or delete a detail row
//                               against A's listing.
//   11. Idempotency           -> re-applying changes nothing. Migrations in this
//                               repo get pasted into the Supabase SQL editor, so
//                               they get run more than once.
//   12. The documented down plan -> DROP TABLE + restoring the seven-value CHECK
//                               actually works.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the rest of this suite. These tests CREATE and DROP databases — the harness
// must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20260813000000_job_entity.sql")

// Fixed IDs so a failure names a fixture row rather than a fresh uuid nobody can
// match. A owns everything; B is the attacker.
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PUBLISHED = "11111111-1111-4111-8111-111111111111" // A, published job
const DRAFT = "22222222-2222-4222-8222-222222222222" // A, draft job
const COMPANY = "33333333-3333-4333-8333-333333333333" // A, the hiring business
const B_LISTING = "44444444-4444-4444-8444-444444444444" // B's own listing

// The minimum of production this migration touches: the `auth` schema, the
// `listings` table it constrains and joins to, and the shared trigger function
// it reuses.
//
// `auth.uid()` reads a session GUC instead of a JWT claim — a stand-in for the
// shape of the call, which is all the policies use; they never inspect the token.
//
// The entity_type CHECK below is the LIVE pre-migration constraint from
// 20260524000001:3-4 plus 'event' from 20260622000007. Case 2 depends on it.
//
// Roles are cluster-wide, not per-database, so these outlive any one scratch DB
// — and on a real local Supabase instance they exist before this file runs at
// all. Create-if-absent, never unconditionally.
const FIXTURE = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
);

CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;

CREATE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE listings (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text        NOT NULL,
  owner_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status         text        NOT NULL DEFAULT 'draft',
  entity_type    text        NOT NULL DEFAULT 'business',
  deleted_at     timestamptz
);

ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN (
    'business','restaurant','service_provider','professional','creative','vendor','event'
  ));

INSERT INTO auth.users (id) VALUES ('${USER_A}'), ('${USER_B}');
INSERT INTO listings (id, name, owner_user_id, status, entity_type) VALUES
  ('${COMPANY}', 'Hiring Company', '${USER_A}', 'published', 'business'),
  ('${B_LISTING}', 'B Business',    '${USER_B}', 'published', 'business');
`

// The two job listings can only be created AFTER the migration widens the CHECK.
const SEED_JOBS = `
INSERT INTO listings (id, name, owner_user_id, status, entity_type) VALUES
  ('${PUBLISHED}', 'Published Role', '${USER_A}', 'published', 'job'),
  ('${DRAFT}',     'Draft Role',     '${USER_A}', 'draft',     'job');
`

// Applied AFTER the migration, since it grants on the table the migration
// creates. Mirrors Supabase's default grants: the roles hold table privileges
// and RLS — not the grant — is what actually confines them. Granting nothing
// would make every isolation case below pass for the wrong reason.
const GRANTS = `
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
`

function setup(url: string, { seedJobs = true } = {}): void {
  exec(url, FIXTURE)
  applyFile(url, MIGRATION)
  if (seedJobs) exec(url, SEED_JOBS)
  exec(url, GRANTS)
}

// Every statement below runs as a real role with a real auth.uid(), because the
// scratch DB's owner is a superuser and RLS does not apply to it. A test that
// forgot this prefix would assert nothing at all.
function as(role: string, userId: string | null, sql: string): string {
  const uid = userId ? `SET test.user_id = '${userId}';` : `SET test.user_id = '';`
  return `${uid} SET ROLE ${role}; ${sql}`
}

function queryAs<T = Record<string, unknown>>(
  url: string,
  role: string,
  userId: string | null,
  selectSql: string,
): T[] {
  const out = exec(
    url,
    as(role, userId, `SELECT coalesce(json_agg(t), '[]'::json) FROM (${selectSql}) t;`),
  ).trim()
  return JSON.parse(out) as T[]
}

function raisesAs(url: string, role: string, userId: string | null, sql: string): boolean {
  return raises(url, as(role, userId, sql))
}

// A minimally-valid detail row — nothing but the two NOT NULL columns without a
// default. Cases that care about a specific column write their own INSERT; this
// exists so a schema change breaks one constant rather than a dozen inserts.
function insertJob(listingId: string): string {
  return `INSERT INTO listing_details_job (listing_id, employment_type)
            VALUES ('${listingId}', 'full-time');`
}

describe.skipIf(!DB_REACHABLE)("migration: 20260813000000_job_entity", () => {
  it("1. creates listing_details_job with the columns the actions write", async () => {
    await withScratchDb("job_shape", (url) => {
      setup(url)

      const cols = query<{ column_name: string; is_nullable: string; column_default: string | null }>(
        url,
        `SELECT column_name, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_name = 'listing_details_job'`,
      )
      const byName = new Map(cols.map((c) => [c.column_name, c]))

      for (const c of [
        "listing_id",
        "description",
        "employment_type",
        "workplace_type",
        "salary_min",
        "salary_max",
        "salary_period",
        "salary_currency",
        "apply_url",
        "apply_email",
        "posted_at",
        "closes_at",
        "hiring_listing_id",
        "cta_type",
        "cta_url",
        "created_at",
        "updated_at",
      ]) {
        expect(byName.has(c), `missing column ${c}`).toBe(true)
      }

      // Required by the render path: a job with no employment type has no
      // headline fact, and JobPosting.datePosted has no source without posted_at.
      expect(byName.get("listing_id")!.is_nullable).toBe("NO")
      expect(byName.get("employment_type")!.is_nullable).toBe("NO")
      expect(byName.get("workplace_type")!.is_nullable).toBe("NO")
      expect(byName.get("posted_at")!.is_nullable).toBe("NO")

      // Defaults the submit form relies on rather than sending.
      expect(byName.get("workplace_type")!.column_default).toContain("on-site")
      expect(byName.get("cta_type")!.column_default).toContain("apply")
      expect(byName.get("salary_currency")!.column_default).toContain("USD")

      // Salary is optional end to end — "DOE" postings are legitimate.
      expect(byName.get("salary_min")!.is_nullable).toBe("YES")
      expect(byName.get("salary_period")!.is_nullable).toBe("YES")
    })
  })

  it("2. accepts entity_type = 'job', which the pre-migration CHECK rejected", async () => {
    await withScratchDb("job_entity_check", (url) => {
      exec(url, FIXTURE)

      // The state this checkpoint exists to fix.
      expect(
        raises(
          url,
          `INSERT INTO listings (name, owner_user_id, entity_type)
             VALUES ('Before', '${USER_A}', 'job');`,
        ),
        "the fixture's pre-migration CHECK should reject 'job'",
      ).toBe(true)

      applyFile(url, MIGRATION)

      exec(
        url,
        `INSERT INTO listings (name, owner_user_id, entity_type)
           VALUES ('After', '${USER_A}', 'job');`,
      )
      expect(
        query(url, `SELECT id FROM listings WHERE entity_type = 'job'`),
      ).toHaveLength(1)

      // Every previously-valid type survives the rewrite.
      for (const t of [
        "business",
        "restaurant",
        "service_provider",
        "professional",
        "creative",
        "vendor",
        "event",
      ]) {
        exec(
          url,
          `INSERT INTO listings (name, owner_user_id, entity_type)
             VALUES ('${t}', '${USER_A}', '${t}');`,
        )
      }

      // Widening must not disable.
      expect(
        raises(
          url,
          `INSERT INTO listings (name, owner_user_id, entity_type)
             VALUES ('Bogus', '${USER_A}', 'spaceship');`,
        ),
      ).toBe(true)
    })
  })

  it("3. rejects an inverted salary range and a salary with no period", async () => {
    await withScratchDb("job_salary", (url) => {
      setup(url)

      const base = `INSERT INTO listing_details_job (listing_id, employment_type`

      // max < min
      expect(
        raises(
          url,
          `${base}, salary_min, salary_max, salary_period)
             VALUES ('${PUBLISHED}', 'full-time', 90000, 50000, 'year');`,
        ),
      ).toBe(true)

      // a figure with no period
      expect(
        raises(
          url,
          `${base}, salary_min)
             VALUES ('${PUBLISHED}', 'full-time', 65000);`,
        ),
      ).toBe(true)

      // no salary at all is fine — "DOE" is a real posting
      exec(url, `${base}) VALUES ('${PUBLISHED}', 'full-time');`)

      // a single open-ended bound with a period is fine ("from $65k/yr")
      exec(
        url,
        `${base}, salary_min, salary_period)
           VALUES ('${DRAFT}', 'contract', 65000, 'hour');`,
      )

      expect(query(url, `SELECT listing_id FROM listing_details_job`)).toHaveLength(2)
    })
  })

  it("4. constrains employment_type, workplace_type and cta_type", async () => {
    await withScratchDb("job_enums", (url) => {
      setup(url)

      const bad = [
        `employment_type) VALUES ('${PUBLISHED}', 'freelance-ish'`,
        `employment_type, workplace_type) VALUES ('${PUBLISHED}', 'full-time', 'moon'`,
        `employment_type, cta_type) VALUES ('${PUBLISHED}', 'full-time', 'buy-now'`,
      ]
      for (const tail of bad) {
        expect(
          raises(url, `INSERT INTO listing_details_job (listing_id, ${tail});`),
          `should reject: ${tail}`,
        ).toBe(true)
      }

      for (const t of [
        "full-time",
        "part-time",
        "contract",
        "temporary",
        "internship",
        "volunteer",
      ]) {
        exec(
          url,
          `INSERT INTO listing_details_job (listing_id, employment_type)
             VALUES ('${PUBLISHED}', '${t}')
             ON CONFLICT (listing_id) DO UPDATE SET employment_type = EXCLUDED.employment_type;`,
        )
      }
    })
  })

  it("5. bumps updated_at on update via the shared trigger", async () => {
    await withScratchDb("job_touch", (url) => {
      setup(url)
      exec(url, insertJob(PUBLISHED))

      const [before] = query<{ updated_at: string }>(
        url,
        `SELECT updated_at FROM listing_details_job WHERE listing_id = '${PUBLISHED}'`,
      )
      // Separate psql invocations are separate transactions, so now() advances.
      exec(
        url,
        `UPDATE listing_details_job SET description = 'edited'
          WHERE listing_id = '${PUBLISHED}';`,
      )
      const [after] = query<{ updated_at: string }>(
        url,
        `SELECT updated_at FROM listing_details_job WHERE listing_id = '${PUBLISHED}'`,
      )

      expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
        new Date(before!.updated_at).getTime(),
      )
    })
  })

  it("6. cascades the detail row when its listing is deleted", async () => {
    await withScratchDb("job_cascade", (url) => {
      setup(url)
      exec(url, insertJob(PUBLISHED))

      exec(url, `DELETE FROM listings WHERE id = '${PUBLISHED}';`)
      expect(query(url, `SELECT listing_id FROM listing_details_job`)).toHaveLength(0)
    })
  })

  it("7. SET NULLs hiring_listing_id rather than deleting the job", async () => {
    await withScratchDb("job_hiring", (url) => {
      setup(url)
      exec(
        url,
        `INSERT INTO listing_details_job (listing_id, employment_type, hiring_listing_id)
           VALUES ('${PUBLISHED}', 'full-time', '${COMPANY}');`,
      )

      exec(url, `DELETE FROM listings WHERE id = '${COMPANY}';`)

      const rows = query<{ hiring_listing_id: string | null }>(
        url,
        `SELECT hiring_listing_id FROM listing_details_job WHERE listing_id = '${PUBLISHED}'`,
      )
      // The role survives its company being removed — CASCADE here would delete
      // every posting a company ever made.
      expect(rows).toHaveLength(1)
      expect(rows[0]!.hiring_listing_id).toBeNull()
    })
  })

  it("8. lets anon read published jobs only", async () => {
    await withScratchDb("job_anon", (url) => {
      setup(url)
      exec(url, insertJob(PUBLISHED))
      exec(url, insertJob(DRAFT))

      const rows = queryAs<{ listing_id: string }>(
        url,
        "anon",
        null,
        `SELECT listing_id FROM listing_details_job`,
      )
      expect(rows.map((r) => r.listing_id)).toEqual([PUBLISHED])
    })
  })

  it("9. hides an unpublished job from another authenticated user", async () => {
    await withScratchDb("job_read_rls", (url) => {
      setup(url)
      exec(url, insertJob(DRAFT))

      // The owner sees their own draft.
      expect(
        queryAs(url, "authenticated", USER_A, `SELECT listing_id FROM listing_details_job`),
      ).toHaveLength(1)

      // Nobody else does.
      expect(
        queryAs(url, "authenticated", USER_B, `SELECT listing_id FROM listing_details_job`),
      ).toHaveLength(0)
    })
  })

  it("10. blocks writes against a listing the caller does not own", async () => {
    await withScratchDb("job_write_rls", (url) => {
      setup(url)

      // B cannot create a job detail row on A's listing.
      expect(
        raisesAs(
          url,
          "authenticated",
          USER_B,
          `INSERT INTO listing_details_job (listing_id, employment_type)
             VALUES ('${PUBLISHED}', 'full-time');`,
        ),
      ).toBe(true)

      // A can.
      exec(
        url,
        as(
          "authenticated",
          USER_A,
          `INSERT INTO listing_details_job (listing_id, employment_type)
             VALUES ('${PUBLISHED}', 'full-time');`,
        ),
      )

      // B's UPDATE and DELETE match zero rows rather than erroring — RLS filters
      // the row out. Assert the row is UNCHANGED, which is the claim that matters.
      exec(
        url,
        as(
          "authenticated",
          USER_B,
          `UPDATE listing_details_job SET description = 'hijacked'
             WHERE listing_id = '${PUBLISHED}';
           DELETE FROM listing_details_job WHERE listing_id = '${PUBLISHED}';`,
        ),
      )

      const rows = query<{ description: string | null }>(
        url,
        `SELECT description FROM listing_details_job WHERE listing_id = '${PUBLISHED}'`,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]!.description).toBeNull()
    })
  })

  it("11. is idempotent — re-applying changes nothing", async () => {
    await withScratchDb("job_idempotent", (url) => {
      setup(url)
      exec(url, insertJob(PUBLISHED))

      applyFile(url, MIGRATION)

      expect(query(url, `SELECT listing_id FROM listing_details_job`)).toHaveLength(1)
      expect(
        query(url, `SELECT policyname FROM pg_policies WHERE tablename = 'listing_details_job'`),
      ).toHaveLength(5)
    })
  })

  it("12. can be rolled back by the documented down plan", async () => {
    await withScratchDb("job_down", (url) => {
      setup(url)
      exec(url, insertJob(PUBLISHED))

      // The down plan: drop the table, then restore the seven-value CHECK. Only
      // valid while no job listings remain, which is why the migration ships
      // ahead of any code that can create one.
      exec(
        url,
        `DELETE FROM listings WHERE entity_type = 'job';
         DROP TABLE listing_details_job;
         ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_entity_type_check;
         ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
           CHECK (entity_type IN (
             'business','restaurant','service_provider','professional','creative','vendor','event'
           ));`,
      )

      expect(
        query(
          url,
          `SELECT table_name FROM information_schema.tables
            WHERE table_name = 'listing_details_job'`,
        ),
      ).toHaveLength(0)

      // Back to rejecting jobs, and the surviving listings are untouched.
      expect(
        raises(
          url,
          `INSERT INTO listings (name, owner_user_id, entity_type)
             VALUES ('After down', '${USER_A}', 'job');`,
        ),
      ).toBe(true)
      expect(query(url, `SELECT id FROM listings WHERE id = '${COMPANY}'`)).toHaveLength(1)
    })
  })
})
