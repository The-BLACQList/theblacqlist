# Ticket 075: Plans and subscriptions tables and Stripe integration setup

---

## Status

Draft

## Phase

Phase 14: Monetization and Sponsorship Foundation

## Priority

P3 — Low

## Estimate

M (2–4h)

## Feature Area

Monetization

---

## Context

This ticket establishes the infrastructure for listing tier monetization: the `plans` and `subscriptions` database tables, the Stripe SDK client singleton, and the initial plan seed data. It has no UI. Everything in this ticket is infrastructure that Tickets 076 and 078 build on top of.

**Scope boundary — Stripe Connect is explicitly out of scope.** ADR-007 documents that Stripe Connect (marketplace payouts for vendor transactions) requires a Stripe application review process that takes 2–4 weeks. Stripe Connect must NOT be implemented before V2. This ticket covers only subscription billing for listing tier upgrades (Free → Standard → Premium).

The `plans` table is a static reference table seeded at deployment. The `subscriptions` table tracks each listing's active Stripe subscription, including the Stripe Customer ID and Subscription ID for webhook reconciliation (Ticket 078).

Sources: `docs/blacqlist/architecture/architecture-decisions.md` ADR-007 (Payments); `docs/blacqlist/data/database-schema-plan.md` § Commerce.

---

## User Story

As a platform engineer, I want the plans and subscriptions schema and Stripe client in place, so that the tier upgrade flow and billing webhooks can be built on a stable foundation without ad-hoc configuration.

---

## Scope

**In scope:**

- Migration: `plans` table (plan definitions + Stripe Price IDs)
- Migration: `subscriptions` table (per-listing subscription tracking)
- `lib/stripe.ts` — Stripe SDK singleton; initialized with `STRIPE_SECRET_KEY` env var
- Seed data: three rows in `plans` — Free, Standard, Premium — including `stripe_price_id` values
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` added to `docs/blacqlist/architecture/environment-plan.md` (documentation only — do not modify `.env` files)
- TypeScript types: `Plan`, `Subscription`, `SubscriptionStatus` in `types/billing.ts`

**Out of scope:**

- Stripe Connect — V2 only; do NOT implement
- Stripe Checkout flow (Ticket 076)
- Stripe webhook handler (Ticket 078)
- Billing UI (Ticket 076)
- Payment intent creation
- Invoice handling beyond what webhook receives (Ticket 078)

---

## Dependencies

| Dependency                                                   | Type            | Status                                             |
| ------------------------------------------------------------ | --------------- | -------------------------------------------------- |
| Ticket 002 — Supabase project setup                          | Infrastructure  | Not started                                        |
| Ticket 009 — `listings` base table (subscriptions FK target) | Blocking ticket | Not started                                        |
| Stripe account creation and product/price configuration      | External        | Must be done before Stripe Price IDs can be seeded |

**Risk:** The Stripe Price IDs used in seed data must be created in the Stripe Dashboard (or via Stripe CLI) before the seed runs. Use a placeholder value (`price_PLACEHOLDER_STANDARD`, etc.) in the migration file with a comment: `-- TODO: Replace with real Stripe Price IDs before running in staging/production`. The migration will run locally without real IDs; the real IDs must be set before Ticket 076 is tested.

---

## UX Notes

No UI in this ticket. This is infrastructure only.

---

## Design Notes

No UI in this ticket.

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § Commerce
- **Entities involved:** `plans` (new), `subscriptions` (new), `listings`
- **Operations:** INSERT (seed), SELECT (downstream tickets read these tables)
- **Migration required:** Yes — `plans` and `subscriptions` tables

### plans table

```sql
CREATE TABLE plans (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name           text NOT NULL UNIQUE
                      CHECK (plan_name IN ('free', 'standard', 'premium')),
  display_name        text NOT NULL,     -- e.g., "Free", "Standard", "Premium"
  stripe_price_id     text,              -- NULL for 'free' plan; set for paid plans
  monthly_price_cents integer NOT NULL DEFAULT 0,
  features            jsonb NOT NULL DEFAULT '[]',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### subscriptions table

```sql
CREATE TABLE subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id              uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id                 uuid NOT NULL REFERENCES plans(id),
  stripe_subscription_id  text UNIQUE,   -- NULL for free-tier listings
  stripe_customer_id      text,          -- NULL for free-tier listings
  status                  text NOT NULL DEFAULT 'active'
                          CHECK (status IN (
                            'active', 'past_due', 'canceled',
                            'incomplete', 'trialing', 'paused'
                          )),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_listing_id_active_idx
  ON subscriptions (listing_id)
  WHERE status NOT IN ('canceled');      -- one active subscription per listing

CREATE INDEX subscriptions_stripe_customer_idx ON subscriptions (stripe_customer_id);
CREATE INDEX subscriptions_stripe_sub_idx      ON subscriptions (stripe_subscription_id);

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Seed data

```sql
INSERT INTO plans (plan_name, display_name, stripe_price_id, monthly_price_cents, features) VALUES
  ('free',     'Free',     NULL,                        0,    '["Basic listing", "Limited gallery (3 images)", "Community saves"]'),
  ('standard', 'Standard', 'price_PLACEHOLDER_STANDARD', 1900, '["Full gallery (12 images)", "Priority search placement", "Analytics dashboard"]'),
  ('premium',  'Premium',  'price_PLACEHOLDER_PREMIUM',  4900, '["All Standard features", "Featured badge", "AI page optimization", "Custom CTA"]');
-- TODO: Replace price_PLACEHOLDER_* values with real Stripe Price IDs before deploying to staging/production.
```

**RLS:**

- `plans` — `anon` and `authenticated` SELECT all active plans (used for public pricing page); no INSERT/UPDATE/DELETE except service role
- `subscriptions` — `authenticated` SELECT own records only (`user_id = auth.uid()`); no client INSERT/UPDATE/DELETE — all changes via webhook (Ticket 078) or Server Action (Ticket 076) using service role

---

## API Notes

No endpoints in this ticket. This is DB schema and SDK setup only.

**`lib/stripe.ts` pattern:**

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // pin to a specific API version
  typescript: true,
})
```

The `stripe` export is used by Ticket 076 (checkout) and Ticket 078 (webhook handler). Import it with `import { stripe } from '@/lib/stripe'`.

---

## Implementation Notes

**Files to create:**

- `supabase/migrations/[timestamp]_create_plans_table.sql` — plans table + seed data
- `supabase/migrations/[timestamp]_create_subscriptions_table.sql` — subscriptions table (separate migration, run after plans)
- `lib/stripe.ts` — Stripe SDK singleton
- `types/billing.ts` — TypeScript interfaces

**Files to modify:**

- `docs/blacqlist/architecture/environment-plan.md` — document `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as required variables for V1 staging and production

**TypeScript interfaces (`types/billing.ts`):**

```typescript
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'paused'

export interface Plan {
  id: string
  plan_name: 'free' | 'standard' | 'premium'
  display_name: string
  stripe_price_id: string | null
  monthly_price_cents: number
  features: string[]
  is_active: boolean
}

export interface Subscription {
  id: string
  listing_id: string
  user_id: string
  plan_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  status: SubscriptionStatus
  current_period_start: string | null // ISO 8601
  current_period_end: string | null // ISO 8601
  canceled_at: string | null
  created_at: string
  updated_at: string
}
```

**Do not:**

- Implement Stripe Connect — this is explicitly V2 (ADR-007)
- Store Stripe Price IDs in code outside the `plans` table seed data — they are managed in the DB
- Expose `STRIPE_SECRET_KEY` to the client — this key is server-only
- Commit actual Stripe keys — use `STRIPE_SECRET_KEY=sk_test_PLACEHOLDER` in `.env.local.example`

---

## Acceptance Criteria

- [ ] `plans` table exists in Supabase with three rows: Free (price 0), Standard, Premium
- [ ] `subscriptions` table exists with the correct columns, constraints, and indexes
- [ ] The unique partial index on `subscriptions (listing_id) WHERE status NOT IN ('canceled')` prevents two active subscriptions for the same listing
- [ ] `lib/stripe.ts` exports a `stripe` Stripe client instance; fails fast at startup if `STRIPE_SECRET_KEY` is not set
- [ ] `types/billing.ts` exports `Plan`, `Subscription`, and `SubscriptionStatus` types
- [ ] `tsc --noEmit` passes with zero TypeScript errors including the new types
- [ ] Seed data: `SELECT * FROM plans` returns 3 rows with `plan_name IN ('free', 'standard', 'premium')`
- [ ] Seed data placeholder comment is present in the migration: `-- TODO: Replace price_PLACEHOLDER_* values with real Stripe Price IDs`
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are documented in the environment plan

---

## Failure States

| Failure                                 | Condition                                                 | Behavior                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY` missing             | App starts without the env var                            | `lib/stripe.ts` throws at module load time with a clear error message                                                          |
| Stripe API unreachable                  | Network issue at startup                                  | The singleton is created successfully (connection is not tested at init time); failures surface at call time in Ticket 076/078 |
| Duplicate active subscription attempted | INSERT into `subscriptions` violates unique partial index | Postgres constraint error; caught in the service layer (Ticket 078)                                                            |

---

## Edge Cases

- Free plan has `stripe_price_id = NULL` — this is expected and valid; free listings do not go through Stripe Checkout
- `monthly_price_cents = 0` for the Free plan — valid; no division by zero in the UI (formatted as "Free" not "$0.00")
- Stripe Price IDs are test mode IDs (`price_test_*`) in local and staging; production uses live IDs — the `plans` table seed must be re-run or updated per environment. Document this in the migration comment.

---

## Accessibility Notes

No UI in this ticket.

---

## QA Test Cases

| #    | Scenario                      | Role     | Steps                                                                                 | Expected result                                                                 |
| ---- | ----------------------------- | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| QA-1 | Plans seed                    | Admin    | `SELECT * FROM plans ORDER BY monthly_price_cents`                                    | 3 rows: Free ($0), Standard ($19), Premium ($49)                                |
| QA-2 | Subscriptions table structure | Admin    | `\d subscriptions` in psql                                                            | All columns, constraints, and indexes present                                   |
| QA-3 | Unique active subscription    | Admin    | Attempt to INSERT a second non-canceled subscription for the same `listing_id`        | Postgres unique index violation; INSERT rejected                                |
| QA-4 | Stripe client init            | Engineer | Import `stripe` from `lib/stripe.ts`; call `stripe.customers.list()` in a test script | Returns a valid Stripe response (or test-mode mock); no TypeScript errors       |
| QA-5 | Missing env var               | Engineer | Start the app without `STRIPE_SECRET_KEY`                                             | App fails at startup with: "STRIPE_SECRET_KEY environment variable is not set." |

---

## Security Notes

- `STRIPE_SECRET_KEY` is server-side only — never expose in client bundles or logs
- `STRIPE_WEBHOOK_SECRET` is used in Ticket 078 to verify webhook signatures — must be set in production before Ticket 078 is deployed
- `plans.stripe_price_id` contains Stripe Price IDs — these are not sensitive (they appear in Stripe Checkout links) but should not be exposed in unauthenticated API responses (only the `plan_name` and `monthly_price_cents` need to be public)

---

## Completion Checklist

- [ ] `plans` table migration created and tested locally
- [ ] `subscriptions` table migration created and tested locally
- [ ] Seed data inserted: 3 plans with correct fields and placeholder Price IDs
- [ ] Placeholder comment added to seed data
- [ ] `lib/stripe.ts` created with fail-fast env var check
- [ ] `types/billing.ts` created with all interfaces
- [ ] Environment plan updated to document Stripe env vars
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
