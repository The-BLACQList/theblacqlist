// =============================================================================
// Migration test: 20260701000002_stripe_webhook_hardening.sql
// =============================================================================
// Applies the webhook-hardening migration to a scratch Postgres and asserts:
//   1. Forward: stripe_events_processed (UNIQUE stripe_event_id, RLS on) and
//      failed_webhooks (partial index on unresolved rows, RLS on) are created,
//      and subscriptions gains a nullable canceled_at timestamptz column.
//   2. Idempotent: a second apply is a no-op (all IF NOT EXISTS) and never throws.
//   3. Rollback: the documented down-script drops both tables + the column cleanly.
// =============================================================================

import { describe, it, expect } from "vitest"
import {
  DB_REACHABLE,
  MIGRATION_2,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from "./helpers"

// Minimal pre-migration fixture: the migration only touches subscriptions by
// adding a column, so a bare table with the right name is sufficient.
const FIXTURE = `
CREATE TABLE subscriptions (
  id     uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled'))
);
`

const DOWN = `
DROP TABLE IF EXISTS stripe_events_processed;
DROP TABLE IF EXISTS failed_webhooks;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS canceled_at;
`

function tableExists(url: string, name: string): boolean {
  const rows = query<{ n: number }>(
    url,
    `SELECT count(*)::int AS n FROM pg_class WHERE relname = '${name}' AND relkind = 'r'`,
  )
  return rows[0]?.n === 1
}

describe.skipIf(!DB_REACHABLE)("migration 20260701000002 (stripe webhook hardening)", () => {
  it("forward: creates hardening tables with RLS, unique + partial indexes, and canceled_at", async () => {
    await withScratchDb("webhook_forward", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION_2)

      // Both tables exist with RLS enabled.
      const rls = query<{ relname: string; relrowsecurity: boolean }>(
        url,
        `SELECT relname, relrowsecurity FROM pg_class
         WHERE relname IN ('stripe_events_processed','failed_webhooks') ORDER BY relname`,
      )
      expect(rls).toEqual([
        { relname: "failed_webhooks", relrowsecurity: true },
        { relname: "stripe_events_processed", relrowsecurity: true },
      ])

      // UNIQUE on stripe_event_id: a duplicate insert must fail.
      exec(
        url,
        "INSERT INTO stripe_events_processed (stripe_event_id, event_type) VALUES ('evt_1','x')",
      )
      expect(
        raises(
          url,
          "INSERT INTO stripe_events_processed (stripe_event_id, event_type) VALUES ('evt_1','y')",
        ),
      ).toBe(true)

      // Partial index on failed_webhooks restricted to unresolved rows.
      const [idx] = query<{ indexdef: string }>(
        url,
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'failed_webhooks_unresolved_idx'`,
      )
      if (!idx) throw new Error("failed_webhooks_unresolved_idx not found")
      expect(idx.indexdef.toLowerCase()).toContain("created_at")
      expect(idx.indexdef.toLowerCase()).toContain("where (resolved_at is null)")

      // subscriptions.canceled_at: nullable timestamptz.
      const [col] = query<{ data_type: string; is_nullable: string }>(
        url,
        `SELECT data_type, is_nullable FROM information_schema.columns
         WHERE table_name = 'subscriptions' AND column_name = 'canceled_at'`,
      )
      if (!col) throw new Error("subscriptions.canceled_at column not found")
      expect(col.data_type).toBe("timestamp with time zone")
      expect(col.is_nullable).toBe("YES")
    })
  }, 60_000)

  it("idempotent: re-apply is a no-op and never throws", async () => {
    await withScratchDb("webhook_idempotent", (url) => {
      exec(url, FIXTURE)

      applyFile(url, MIGRATION_2)
      expect(() => applyFile(url, MIGRATION_2)).not.toThrow()

      expect(tableExists(url, "stripe_events_processed")).toBe(true)
      expect(tableExists(url, "failed_webhooks")).toBe(true)
    })
  }, 60_000)

  it("rollback: the documented down-script drops both tables and the column", async () => {
    await withScratchDb("webhook_rollback", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION_2)
      exec(url, DOWN)

      expect(tableExists(url, "stripe_events_processed")).toBe(false)
      expect(tableExists(url, "failed_webhooks")).toBe(false)

      const cols = query<{ n: number }>(
        url,
        `SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'subscriptions' AND column_name = 'canceled_at'`,
      )
      expect(cols[0]?.n).toBe(0)
    })
  }, 60_000)
})
