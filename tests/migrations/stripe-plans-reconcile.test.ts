// =============================================================================
// Migration test: 20260701000001_plans_pricing_reconcile.sql
// =============================================================================
// Applies the 4-tier reconcile migration to a scratch Postgres seeded to look
// like the real pre-migration 3-tier state, and asserts:
//   1. Forward: 4 plans (free/starter/growth/premium) with the right prices,
//      plan_key, is_active, display_order, and PRESERVED stripe_price_id_* across
//      the standard->starter and premium->growth renames.
//   2. Constraints: plans_name_check + listings_tier_check now allow exactly the
//      4-tier vocabulary and reject legacy 'standard'.
//   3. Idempotent: a second (and third) apply is a no-op and never throws, and a
//      genuinely-premium listing is not downgraded on re-apply.
//   4. Rollback: the documented down-script reverses cleanly to the 3-tier state.
// =============================================================================

import { describe, it, expect } from "vitest"
import {
  DB_REACHABLE,
  MIGRATION_1,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from "./helpers"

// Faithful pre-migration fixture. Mirrors the initial schema + monetization
// foundation migration closely enough that the migration's DROP CONSTRAINT and
// ON CONFLICT (name) targets exist and are named as the migration expects:
//   * inline column CHECKs auto-name to plans_name_check / listings_tier_check
//   * plans uniqueness is a UNIQUE INDEX on (name) -> backs ON CONFLICT (name)
//   * plan_key + its partial unique index exist (added by the foundation migration)
// The stripe IDs below are MADE-UP test strings, not real Stripe price IDs.
const FIXTURE = `
CREATE TABLE plans (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text NOT NULL CHECK (name IN ('free','standard','premium')),
  plan_key       text,
  price_monthly  numeric NOT NULL DEFAULT 0,
  price_yearly   numeric NOT NULL DEFAULT 0,
  features       jsonb  NOT NULL DEFAULT '[]'::jsonb,
  is_active      boolean NOT NULL DEFAULT true,
  display_order  integer NOT NULL DEFAULT 0,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plans_name_idx ON plans (name);
CREATE UNIQUE INDEX plans_plan_key_idx ON plans (plan_key) WHERE plan_key IS NOT NULL;

INSERT INTO plans (name, plan_key, price_monthly, price_yearly, is_active, display_order, stripe_price_id_monthly) VALUES
  ('free',     'free',     0,  0,   true, 0, NULL),
  ('standard', 'standard', 19, 190, true, 1, 'price_std_m'),
  ('premium',  'premium',  49, 490, true, 2, 'price_prem_m');

CREATE TABLE listings (
  id   uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','standard','premium'))
);
INSERT INTO listings (tier) VALUES ('free'), ('standard'), ('premium');
`

// The documented down/rollback, transcribed verbatim from the migration header.
const DOWN = `
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_tier_check;
UPDATE listings SET tier='premium' WHERE tier='growth';
UPDATE listings SET tier='standard' WHERE tier='starter';
ALTER TABLE listings ADD CONSTRAINT listings_tier_check
  CHECK (tier IN ('free','standard','premium'));
DELETE FROM plans WHERE name='premium';
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_name_check;
UPDATE plans SET name='premium',  plan_key='premium',  price_monthly=49, price_yearly=490 WHERE name='growth';
UPDATE plans SET name='standard', plan_key='standard', price_monthly=19, price_yearly=190 WHERE name='starter';
ALTER TABLE plans ADD CONSTRAINT plans_name_check CHECK (name IN ('free','standard','premium'));
`

type PlanRow = {
  name: string
  plan_key: string
  price_monthly: number
  price_yearly: number
  is_active: boolean
  display_order: number
  stripe_price_id_monthly: string | null
}

const PLAN_SELECT = `
  SELECT name, plan_key, price_monthly::float AS price_monthly,
         price_yearly::float AS price_yearly, is_active, display_order,
         stripe_price_id_monthly
  FROM plans ORDER BY display_order
`

function planKey(r: PlanRow) {
  return {
    name: r.name,
    plan_key: r.plan_key,
    price_monthly: r.price_monthly,
    price_yearly: r.price_yearly,
    is_active: r.is_active,
    display_order: r.display_order,
    stripe_price_id_monthly: r.stripe_price_id_monthly,
  }
}

function listingCounts(url: string): Record<string, number> {
  const rows = query<{ tier: string; n: number }>(
    url,
    "SELECT tier, count(*)::int AS n FROM listings GROUP BY tier",
  )
  return Object.fromEntries(rows.map((r) => [r.tier, r.n]))
}

describe.skipIf(!DB_REACHABLE)("migration 20260701000001 (plans pricing reconcile)", () => {
  it("forward: reconciles 3-tier -> 4-tier and preserves stripe price IDs", async () => {
    await withScratchDb("reconcile_forward", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION_1)

      const plans = query<PlanRow>(url, PLAN_SELECT).map(planKey)
      expect(plans).toEqual([
        { name: "free",    plan_key: "free",    price_monthly: 0,  price_yearly: 0,   is_active: true, display_order: 0, stripe_price_id_monthly: null },
        // standard -> starter: monthly ID carried across the rename
        { name: "starter", plan_key: "starter", price_monthly: 19, price_yearly: 182, is_active: true, display_order: 1, stripe_price_id_monthly: "price_std_m" },
        // premium(49) -> growth: monthly ID carried across the rename
        { name: "growth",  plan_key: "growth",  price_monthly: 49, price_yearly: 470, is_active: true, display_order: 2, stripe_price_id_monthly: "price_prem_m" },
        // brand-new $99 premium tier: no stripe ID yet
        { name: "premium", plan_key: "premium", price_monthly: 99, price_yearly: 950, is_active: true, display_order: 3, stripe_price_id_monthly: null },
      ])

      // listings: standard->starter, premium->growth, free stays free
      expect(listingCounts(url)).toEqual({ free: 1, starter: 1, growth: 1 })
    })
  }, 60_000)

  it("constraints: name + tier CHECKs allow the 4-tier vocab and reject 'standard'", async () => {
    await withScratchDb("reconcile_constraints", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION_1)

      const [nameDef] = query<{ def: string }>(
        url,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'plans_name_check'",
      )
      if (!nameDef) throw new Error("plans_name_check constraint not found")
      expect(nameDef.def).toMatch(/free/)
      expect(nameDef.def).toMatch(/starter/)
      expect(nameDef.def).toMatch(/growth/)
      expect(nameDef.def).toMatch(/premium/)
      expect(nameDef.def).not.toMatch(/standard/)

      const [tierDef] = query<{ def: string }>(
        url,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'listings_tier_check'",
      )
      if (!tierDef) throw new Error("listings_tier_check constraint not found")
      expect(tierDef.def).toMatch(/starter/)
      expect(tierDef.def).toMatch(/growth/)
      expect(tierDef.def).not.toMatch(/standard/)

      // Functional check: a 4-tier value inserts, a legacy value is rejected.
      expect(raises(url, "INSERT INTO listings (tier) VALUES ('growth')")).toBe(false)
      expect(raises(url, "INSERT INTO listings (tier) VALUES ('standard')")).toBe(true)
    })
  }, 60_000)

  it("idempotent: re-apply is a no-op and never downgrades a real premium listing", async () => {
    await withScratchDb("reconcile_idempotent", (url) => {
      exec(url, FIXTURE)

      applyFile(url, MIGRATION_1)
      const after1 = query<PlanRow>(url, PLAN_SELECT).map(planKey)

      // Second apply must NOT throw (the bug this test locks in was a unique-index
      // collision renaming the new premium row to growth on re-run).
      expect(() => applyFile(url, MIGRATION_1)).not.toThrow()
      const after2 = query<PlanRow>(url, PLAN_SELECT).map(planKey)

      expect(after2).toEqual(after1)
      expect(after2).toHaveLength(4)

      // Now insert a genuinely-premium ($99-tier) listing and apply a THIRD time.
      // The listings guard must leave it as 'premium', not remap it to 'growth'.
      exec(url, "INSERT INTO listings (tier) VALUES ('premium')")
      expect(() => applyFile(url, MIGRATION_1)).not.toThrow()
      const premiumCount = query<{ n: number }>(
        url,
        "SELECT count(*)::int AS n FROM listings WHERE tier = 'premium'",
      )[0]!.n
      expect(premiumCount).toBe(1)
    })
  }, 60_000)

  it("rollback: the documented down-script restores the 3-tier state", async () => {
    await withScratchDb("reconcile_rollback", (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION_1)
      exec(url, DOWN)

      const plans = query<PlanRow>(url, PLAN_SELECT).map(planKey)
      expect(plans).toEqual([
        { name: "free",     plan_key: "free",     price_monthly: 0,  price_yearly: 0,   is_active: true, display_order: 0, stripe_price_id_monthly: null },
        { name: "standard", plan_key: "standard", price_monthly: 19, price_yearly: 190, is_active: true, display_order: 1, stripe_price_id_monthly: "price_std_m" },
        { name: "premium",  plan_key: "premium",  price_monthly: 49, price_yearly: 490, is_active: true, display_order: 2, stripe_price_id_monthly: "price_prem_m" },
      ])

      expect(listingCounts(url)).toEqual({ free: 1, standard: 1, premium: 1 })

      // Legacy constraint is back: 'standard' accepted, 'growth' rejected.
      expect(raises(url, "INSERT INTO listings (tier) VALUES ('standard')")).toBe(false)
      expect(raises(url, "INSERT INTO listings (tier) VALUES ('growth')")).toBe(true)
    })
  }, 60_000)
})
