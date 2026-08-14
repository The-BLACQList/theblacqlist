// =============================================================================
// Migration test: 20260813020000_listings_rejected_status.sql
//
// Applies the real migration to a scratch Postgres and asserts its properties
// BEHAVIOURALLY — by inserting and updating rows, not by reading the constraint
// definition back out. Reading `pg_get_constraintdef` would only prove the text
// changed; these cases prove the database actually accepts and refuses what the
// product needs it to.
//
// The fixture deliberately installs the OLD six-value status CHECK first — the
// one read off LIVE production on 2026-08-13 via `pg_get_constraintdef`:
//
//   CHECK (status IN ('draft','pending','published','unpublished','flagged','archived'))
//
// Case 1 depends on that. Without it, "a rejected listing inserts" would pass on
// a table that never had a constraint at all, and the test would prove nothing.
//
// Cases:
//   1. Reproduces the bug -> 'rejected' is REFUSED before the migration runs.
//   2. Fixes the bug      -> 'rejected' is ACCEPTED after it runs.
//   3. The real code path -> the UPDATE that rejectEntity.ts:44 issues succeeds.
//   4. No regression      -> all six original values still insert.
//   5. Still a constraint -> an unknown status is STILL refused. Widening the
//                            CHECK must not quietly disable it.
//   6. Idempotency        -> re-applying changes nothing. Migrations in this
//                            repo get pasted into the Supabase SQL editor, so
//                            they get run more than once.
//   7. The documented down plan -> archiving rejected rows and restoring the
//                            narrower constraint actually works.
//
// Skipped entirely when no local Postgres is reachable (DB_REACHABLE), matching
// the rest of this suite. These tests CREATE and DROP databases — the harness
// must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20260813020000_listings_rejected_status.sql")

// The six values the LIVE constraint permits today. 'rejected' is the absentee.
const LIVE_STATUSES = ["draft", "pending", "published", "unpublished", "flagged", "archived"]

const PENDING = "11111111-1111-4111-8111-111111111111"

// The minimum of production this migration touches: the `listings` table and the
// status CHECK it replaces. Nothing else in the schema is relevant — the change
// is one constraint.
const FIXTURE = `
CREATE TABLE listings (
  id      uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name    text NOT NULL,
  status  text NOT NULL DEFAULT 'draft'
);

ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN (${LIVE_STATUSES.map((s) => `'${s}'`).join(",")}));

INSERT INTO listings (id, name, status) VALUES ('${PENDING}', 'Pending Business', 'pending');
`

function insertWithStatus(status: string): string {
  return `INSERT INTO listings (name, status) VALUES ('Fixture', '${status}');`
}

describe.skipIf(!DB_REACHABLE)("migration: 20260813020000_listings_rejected_status", () => {
  it("1. reproduces the bug: 'rejected' is refused BEFORE the migration", async () => {
    await withScratchDb("rejected_before", (url) => {
      exec(url, FIXTURE)

      // This is the defect. rejectEntity.ts has been issuing exactly this write
      // since launch and getting an error back every time.
      expect(raises(url, insertWithStatus("rejected"))).toBe(true)
    })
  })

  it("2. fixes the bug: 'rejected' is accepted AFTER the migration", async () => {
    await withScratchDb("rejected_after", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      exec(url, insertWithStatus("rejected"))

      const rows = query<{ status: string }>(url, `SELECT status FROM listings WHERE status = 'rejected'`)
      expect(rows).toHaveLength(1)
    })
  })

  it("3. the real code path: the UPDATE rejectEntity.ts issues succeeds", async () => {
    await withScratchDb("rejected_update", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      // lib/actions/admin/rejectEntity.ts:44 — pending listing -> rejected.
      exec(url, `UPDATE listings SET status = 'rejected' WHERE id = '${PENDING}';`)

      const rows = query<{ status: string }>(url, `SELECT status FROM listings WHERE id = '${PENDING}'`)
      expect(rows[0]?.status).toBe("rejected")
    })
  })

  it("4. no regression: all six original statuses still insert", async () => {
    await withScratchDb("rejected_originals", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      for (const status of LIVE_STATUSES) {
        exec(url, insertWithStatus(status))
      }

      // Distinct, not a row count — the fixture already seeds a 'pending' row,
      // so counting rows would silently double one value and prove less.
      const rows = query<{ status: string }>(
        url,
        `SELECT DISTINCT status FROM listings ORDER BY status`,
      )
      expect(rows.map((r) => r.status)).toEqual([...LIVE_STATUSES].sort())
    })
  })

  it("5. still a constraint: an unknown status is refused after the migration", async () => {
    await withScratchDb("rejected_unknown", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      // Widening the CHECK must not turn it into a free-text column.
      expect(raises(url, insertWithStatus("declined"))).toBe(true)
      expect(raises(url, insertWithStatus(""))).toBe(true)
      expect(raises(url, insertWithStatus("REJECTED"))).toBe(true)
    })
  })

  it("6. is idempotent: re-applying it changes nothing", async () => {
    await withScratchDb("rejected_idempotent", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)

      exec(url, insertWithStatus("rejected"))
      expect(raises(url, insertWithStatus("declined"))).toBe(true)

      // Exactly one status constraint — the DROP IF EXISTS must not leave a
      // duplicate behind on the second run.
      const cons = query<{ conname: string }>(
        url,
        `SELECT conname FROM pg_constraint
          WHERE conrelid = 'listings'::regclass AND conname = 'listings_status_check'`,
      )
      expect(cons).toHaveLength(1)
    })
  })

  it("7. the documented down plan works", async () => {
    await withScratchDb("rejected_down", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      exec(url, insertWithStatus("rejected"))

      // Verbatim from the migration header's DOWN / ROLLBACK block.
      exec(
        url,
        `UPDATE listings SET status = 'archived' WHERE status = 'rejected';
         ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
         ALTER TABLE listings ADD CONSTRAINT listings_status_check
           CHECK (status IN ('draft','pending','published','unpublished','flagged','archived'));`,
      )

      // Rolled back: 'rejected' is refused again, and no row was destroyed.
      expect(raises(url, insertWithStatus("rejected"))).toBe(true)

      const rows = query<{ status: string }>(url, `SELECT status FROM listings WHERE status = 'archived'`)
      expect(rows).toHaveLength(1)
    })
  })
})
