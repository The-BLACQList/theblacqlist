// =============================================================================
// Migration test: 20260812000000_saved_lists.sql
// =============================================================================
// Applies the real migration to a scratch Postgres and asserts its properties
// BEHAVIORALLY — by acting as the `authenticated` role with a real auth.uid(),
// not by reading pg_policies and trusting that a policy named "read own" reads
// own. A policy that exists and a policy that works are different claims, and
// only the second one protects a user's saved lists.
//
// This is private user data with no anon path anywhere, so the isolation cases
// are the point of the file, not a formality.
//
// What each case protects:
//   1.  Table shape                -> the columns the actions write, with the
//                                     nullability and defaults they rely on.
//   2.  Name normalization         -> "Brunch", "brunch " and "BRUNCH" are ONE
//                                     list. Without it a user accumulates
//                                     near-duplicate lists that read as a bug.
//   3.  Name CHECK                 -> a whitespace-only name is rejected at the
//                                     database, so an unnamed list cannot exist
//                                     however the action layer is called.
//   4.  updated_at trigger         -> rename actually bumps it; the rail sorts
//                                     and the UI reports on that column.
//   5.  UNSAVE CASCADES            -> deleting a `saves` row removes it from
//                                     every list it was in. THE `save_id` JOIN
//                                     COLUMN EXISTS FOR THIS. It is what makes
//                                     "All saved" a guaranteed superset of every
//                                     list, in the database, with no application
//                                     code to forget. A `listing_id` join would
//                                     permit a listing sitting in a list while
//                                     absent from All saved — a state with no
//                                     coherent screen.
//   6.  Delete-list cascade        -> deleting a list takes its items, and takes
//                                     NOTHING from `saves`. Organizing must
//                                     never destroy the save itself.
//   7.  Many lists per business    -> one save in two lists at once. The founder
//                                     decision this schema is shaped around
//                                     [Decision — founder, 2026-08-12].
//   8.  RLS: read isolation        -> user B cannot see A's lists OR A's items.
//                                     Both directions, because items carry no
//                                     user_id of their own and derive ownership
//                                     through the list.
//   9.  RLS: write isolation       -> B cannot insert into A's list, cannot
//                                     rename A's list, cannot delete A's list or
//                                     A's items, and cannot forge user_id on
//                                     insert.
//   10. RLS: cross-user filing     -> B cannot file A's SAVE into B's own list.
//                                     Without the save_id half of the INSERT
//                                     policy this is a read primitive: it would
//                                     let B probe which listings A has saved.
//   11. No anon path               -> `anon` cannot read either table by any
//                                     route. There is no public list feature and
//                                     no policy that would allow one.
//   12. Idempotency                -> re-applying changes nothing. Migrations in
//                                     this repo get pasted into the Supabase SQL
//                                     editor, so they get run more than once.
//   13. The documented down plan   -> the two DROP TABLEs in the file header
//                                     actually work, and leave `saves` intact.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the rest of this suite. These tests CREATE and DROP databases — the harness
// must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
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

const MIGRATION = path.join(MIGRATIONS_DIR, "20260812000000_saved_lists.sql")

// Fixed IDs so failures name a user rather than a fresh uuid nobody can match
// against the fixture. Two users; A owns everything, B is the attacker.
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const LISTING_1 = "11111111-1111-4111-8111-111111111111"
const LISTING_2 = "22222222-2222-4222-8222-222222222222"

// The minimum of production this migration touches: the `auth` schema, the
// `saves` table it joins to, and the shared trigger function it reuses.
//
// `auth.uid()` reads a session GUC instead of a JWT claim. It is a stand-in for
// the shape of the call, which is all the policies use — they never inspect the
// token. `saves` carries its REAL policies (20260510000001:636-651) rather than
// running unprotected, because the item INSERT policy subqueries `saves`, and
// that subquery is itself evaluated under the caller's RLS. Testing it against
// an unprotected `saves` would exercise a query production never runs.
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
  id    uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name  text NOT NULL
);

CREATE TABLE saves (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saves: authenticated read own"
  ON saves FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "saves: authenticated insert own"
  ON saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "saves: authenticated delete own"
  ON saves FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO auth.users (id) VALUES ('${USER_A}'), ('${USER_B}');
INSERT INTO listings (id, name) VALUES
  ('${LISTING_1}', 'Listing One'),
  ('${LISTING_2}', 'Listing Two');
`

// Applied AFTER the migration, since it grants on tables the migration creates.
// Mirrors Supabase's default grants: the roles hold table privileges and RLS —
// not the grant — is what actually confines them. Granting nothing would make
// every isolation case below pass for the wrong reason.
const GRANTS = `
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
`

function setup(url: string): void {
  exec(url, FIXTURE)
  applyFile(url, MIGRATION)
  exec(url, GRANTS)
}

// Every statement below runs as `authenticated` with a real auth.uid(), because
// the scratch DB's owner is a superuser and RLS does not apply to it. A test
// that forgot this prefix would assert nothing at all.
function as(userId: string, sql: string): string {
  return `SET test.user_id = '${userId}'; SET ROLE authenticated; ${sql}`
}

function queryAs<T = Record<string, unknown>>(
  url: string,
  userId: string,
  selectSql: string,
): T[] {
  const out = exec(
    url,
    as(userId, `SELECT coalesce(json_agg(t), '[]'::json) FROM (${selectSql}) t;`),
  ).trim()
  return JSON.parse(out) as T[]
}

function raisesAs(url: string, userId: string, sql: string): boolean {
  return raises(url, as(userId, sql))
}

// A save + a list + the item joining them, all owned by `userId`. Returns both
// ids so a test can act on either end of the join.
//
// IDs are minted here rather than by RETURNING because `query()` wraps its SQL
// in a subselect, and Postgres rejects a data-modifying CTE below the top level.
function seedList(
  url: string,
  userId: string,
  name: string,
  listingId: string,
): { listId: string; saveId: string } {
  const listId = randomUUID()
  const saveId = randomUUID()
  exec(
    url,
    `INSERT INTO saves (id, user_id, listing_id)
       VALUES ('${saveId}', '${userId}', '${listingId}');
     INSERT INTO saved_lists (id, user_id, name)
       VALUES ('${listId}', '${userId}', '${name}');
     INSERT INTO saved_list_items (list_id, save_id)
       VALUES ('${listId}', '${saveId}');`,
  )
  return { listId, saveId }
}

describe.skipIf(!DB_REACHABLE)("20260812000000_saved_lists", () => {
  it("creates both tables with the shape the actions write", async () => {
    await withScratchDb("saved_lists_shape", async (url) => {
      setup(url)

      const lists = query<{ column_name: string; is_nullable: string }>(
        url,
        `SELECT column_name, is_nullable FROM information_schema.columns
          WHERE table_name = 'saved_lists' ORDER BY column_name`,
      )
      expect(lists.map((c) => c.column_name)).toEqual([
        "created_at",
        "id",
        "name",
        "updated_at",
        "user_id",
      ])
      expect(lists.every((c) => c.is_nullable === "NO")).toBe(true)

      const items = query<{ column_name: string }>(
        url,
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'saved_list_items' ORDER BY column_name`,
      )
      // save_id, NOT listing_id. See case 5 — the whole cascade guarantee is
      // this column choice.
      expect(items.map((c) => c.column_name)).toEqual([
        "created_at",
        "list_id",
        "save_id",
      ])

      // The action inserts { user_id, name } and nothing else.
      exec(
        url,
        `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_A}', 'Brunch');`,
      )
      const [row] = query<{ id: string; created_at: string; updated_at: string }>(
        url,
        `SELECT id, created_at, updated_at FROM saved_lists`,
      )
      expect(row?.id).toBeTruthy()
      expect(row?.created_at).toBeTruthy()
      expect(row?.updated_at).toBeTruthy()
    })
  })

  it("treats list names as one per user, case- and whitespace-insensitively", async () => {
    await withScratchDb("saved_lists_name_unique", async (url) => {
      setup(url)
      exec(
        url,
        `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_A}', 'Brunch');`,
      )

      // All three are the same list to a human, so they must be the same list
      // to the database. The action layer catches 23505 and says so.
      for (const dupe of ["Brunch", "brunch", "  BRUNCH  "]) {
        expect(
          raises(
            url,
            `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_A}', '${dupe}');`,
          ),
        ).toBe(true)
      }

      // Scoped per user: B naming a list "Brunch" is not a collision.
      expect(
        raises(
          url,
          `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_B}', 'Brunch');`,
        ),
      ).toBe(false)
    })
  })

  it("rejects an empty or whitespace-only list name", async () => {
    await withScratchDb("saved_lists_name_check", async (url) => {
      setup(url)

      // Enforced here rather than only in zod, so an unnamed list cannot exist
      // however the table is reached.
      for (const bad of ["", "   ", "\t"]) {
        expect(
          raises(
            url,
            `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_A}', E'${bad}');`,
          ),
        ).toBe(true)
      }
      expect(
        raises(
          url,
          `INSERT INTO saved_lists (user_id, name)
           VALUES ('${USER_A}', repeat('x', 61));`,
        ),
      ).toBe(true)
    })
  })

  it("bumps updated_at on rename", async () => {
    await withScratchDb("saved_lists_touch", async (url) => {
      setup(url)
      exec(
        url,
        `INSERT INTO saved_lists (id, user_id, name, created_at, updated_at)
         VALUES ('${LISTING_1}', '${USER_A}', 'Old',
                 now() - interval '1 day', now() - interval '1 day');`,
      )
      exec(url, `UPDATE saved_lists SET name = 'New' WHERE id = '${LISTING_1}';`)

      const [row] = query<{ moved: boolean }>(
        url,
        `SELECT updated_at > created_at AS moved FROM saved_lists`,
      )
      expect(row?.moved).toBe(true)
    })
  })

  it("removes a listing from EVERY list when the save is deleted", async () => {
    await withScratchDb("saved_lists_unsave_cascade", async (url) => {
      setup(url)
      const { saveId, listId } = seedList(url, USER_A, "Brunch", LISTING_1)

      // Same save, second list — the many-lists-per-business decision.
      exec(
        url,
        `WITH l AS (
           INSERT INTO saved_lists (user_id, name)
           VALUES ('${USER_A}', 'Date night') RETURNING id
         )
         INSERT INTO saved_list_items (list_id, save_id)
         SELECT l.id, '${saveId}' FROM l;`,
      )
      expect(
        query(url, `SELECT save_id FROM saved_list_items WHERE save_id = '${saveId}'`),
      ).toHaveLength(2)

      exec(url, `DELETE FROM saves WHERE id = '${saveId}';`)

      // THE GUARANTEE. Unsaving on the listing page — which knows nothing about
      // lists — must not leave the listing sitting in two of them.
      expect(
        query(url, `SELECT save_id FROM saved_list_items WHERE save_id = '${saveId}'`),
      ).toHaveLength(0)
      // The lists themselves survive; only the membership went.
      expect(query(url, `SELECT id FROM saved_lists`)).toHaveLength(2)
      expect(query(url, `SELECT id FROM saved_lists WHERE id = '${listId}'`)).toHaveLength(1)
    })
  })

  it("deleting a list takes its items and nothing from saves", async () => {
    await withScratchDb("saved_lists_delete_list", async (url) => {
      setup(url)
      const { listId, saveId } = seedList(url, USER_A, "Brunch", LISTING_1)

      exec(url, `DELETE FROM saved_lists WHERE id = '${listId}';`)

      expect(query(url, `SELECT list_id FROM saved_list_items`)).toHaveLength(0)
      // Organizing must never destroy the save. Deleting a list is a filing
      // action; it is not an unsave.
      expect(query(url, `SELECT id FROM saves WHERE id = '${saveId}'`)).toHaveLength(1)
    })
  })

  it("lets one save sit in several lists at once", async () => {
    await withScratchDb("saved_lists_many", async (url) => {
      setup(url)
      const { saveId, listId } = seedList(url, USER_A, "Brunch", LISTING_1)

      exec(
        url,
        `WITH l AS (
           INSERT INTO saved_lists (user_id, name)
           VALUES ('${USER_A}', 'Weekend') RETURNING id
         )
         INSERT INTO saved_list_items (list_id, save_id)
         SELECT l.id, '${saveId}' FROM l;`,
      )
      expect(
        query(url, `SELECT list_id FROM saved_list_items WHERE save_id = '${saveId}'`),
      ).toHaveLength(2)

      // …but not twice in the SAME list. The PK is the guard; the UI relies on
      // it so a double-tap is harmless.
      expect(
        raises(
          url,
          `INSERT INTO saved_list_items (list_id, save_id)
           VALUES ('${listId}', '${saveId}');`,
        ),
      ).toBe(true)
    })
  })

  it("hides one user's lists and items from another", async () => {
    await withScratchDb("saved_lists_rls_read", async (url) => {
      setup(url)
      seedList(url, USER_A, "Brunch", LISTING_1)

      expect(queryAs(url, USER_A, `SELECT id FROM saved_lists`)).toHaveLength(1)
      expect(queryAs(url, USER_A, `SELECT save_id FROM saved_list_items`)).toHaveLength(1)

      // B sees nothing — including the items, which carry no user_id of their
      // own and must derive ownership through the list.
      expect(queryAs(url, USER_B, `SELECT id FROM saved_lists`)).toHaveLength(0)
      expect(queryAs(url, USER_B, `SELECT save_id FROM saved_list_items`)).toHaveLength(0)
    })
  })

  it("stops one user from writing to another's lists", async () => {
    await withScratchDb("saved_lists_rls_write", async (url) => {
      setup(url)
      const { listId, saveId } = seedList(url, USER_A, "Brunch", LISTING_1)

      // Forging user_id on insert.
      expect(
        raisesAs(
          url,
          USER_B,
          `INSERT INTO saved_lists (user_id, name) VALUES ('${USER_A}', 'Mine now');`,
        ),
      ).toBe(true)

      // Filing something into A's list.
      expect(
        raisesAs(
          url,
          USER_B,
          `INSERT INTO saved_list_items (list_id, save_id)
           VALUES ('${listId}', '${saveId}');`,
        ),
      ).toBe(true)

      // Rename and delete are filtered rather than raised — USING clauses match
      // no row — so the assertion has to be that A's data is untouched, not
      // that an error came back.
      exec(url, as(USER_B, `UPDATE saved_lists SET name = 'Hijacked';`))
      exec(url, as(USER_B, `DELETE FROM saved_lists;`))
      exec(url, as(USER_B, `DELETE FROM saved_list_items;`))

      const [list] = query<{ name: string }>(url, `SELECT name FROM saved_lists`)
      expect(list?.name).toBe("Brunch")
      expect(query(url, `SELECT save_id FROM saved_list_items`)).toHaveLength(1)
    })
  })

  it("stops a user from filing someone else's save into their own list", async () => {
    await withScratchDb("saved_lists_rls_cross_file", async (url) => {
      setup(url)
      const { saveId: aSaveId } = seedList(url, USER_A, "Brunch", LISTING_1)
      const bListId = randomUUID()
      exec(
        url,
        `INSERT INTO saved_lists (id, user_id, name)
         VALUES ('${bListId}', '${USER_B}', 'Recon');`,
      )

      // B owns the list, so the list half of the policy passes. Only the
      // save_id half stops this — and without it the table becomes a read
      // primitive: B could probe which listings A has saved by watching which
      // inserts succeed.
      expect(
        raisesAs(
          url,
          USER_B,
          `INSERT INTO saved_list_items (list_id, save_id)
           VALUES ('${bListId}', '${aSaveId}');`,
        ),
      ).toBe(true)
    })
  })

  it("gives anon no path to either table", async () => {
    await withScratchDb("saved_lists_anon", async (url) => {
      setup(url)
      seedList(url, USER_A, "Brunch", LISTING_1)

      // Private only [Decision — founder, 2026-08-12]. There is no public list
      // feature, so there is no anon policy — and RLS denies by default.
      for (const table of ["saved_lists", "saved_list_items"]) {
        const out = exec(
          url,
          `SET ROLE anon; SELECT count(*) FROM ${table};`,
        ).trim()
        expect(out).toBe("0")
      }
      expect(
        query(url, `SELECT policyname FROM pg_policies
                     WHERE tablename IN ('saved_lists','saved_list_items')
                       AND 'anon' = ANY(roles)`),
      ).toHaveLength(0)
    })
  })

  it("is idempotent — re-applying changes nothing", async () => {
    await withScratchDb("saved_lists_idempotent", async (url) => {
      setup(url)
      const { saveId } = seedList(url, USER_A, "Brunch", LISTING_1)

      applyFile(url, MIGRATION)

      const [list] = query<{ name: string }>(url, `SELECT name FROM saved_lists`)
      expect(list?.name).toBe("Brunch")
      expect(
        query(url, `SELECT save_id FROM saved_list_items WHERE save_id = '${saveId}'`),
      ).toHaveLength(1)
      // Policies are DROP-then-CREATE, so a second apply must not double them.
      expect(
        query(url, `SELECT policyname FROM pg_policies
                     WHERE tablename = 'saved_lists'`),
      ).toHaveLength(4)
    })
  })

  it("rolls back exactly as the file's down plan says, leaving saves intact", async () => {
    await withScratchDb("saved_lists_down", async (url) => {
      setup(url)
      const { saveId } = seedList(url, USER_A, "Brunch", LISTING_1)

      // Verbatim from the migration header. If this drifts, the gate was
      // approved against a rollback that does not run.
      exec(
        url,
        `DROP TABLE IF EXISTS saved_list_items;
         DROP TABLE IF EXISTS saved_lists;`,
      )

      expect(
        query(url, `SELECT tablename FROM pg_tables
                     WHERE tablename IN ('saved_lists','saved_list_items')`),
      ).toHaveLength(0)
      // The cost of a rollback is list data only. Every save survives.
      expect(query(url, `SELECT id FROM saves WHERE id = '${saveId}'`)).toHaveLength(1)
    })
  })
})
