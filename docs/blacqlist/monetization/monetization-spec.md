# Monetization Spec — The BLACQList

**Last updated:** 2026-07-01
**Status:** Billing built (V1 — checkout, portal, webhooks, gating). Cost/margin rationale in
[`pricing-unit-economics.md`](./pricing-unit-economics.md).

---

## Problem and Goals

The BLACQList generates value for Black-owned businesses by surfacing them to intentional buyers. The monetization foundation turns that value into revenue — without gatekeeping discovery behind a paywall.

**Goals:**

- Keep the core listing permanently free (discovery is the product)
- Create meaningful paid tiers that reward businesses investing in growth
- Build a sponsored placement layer that funds the platform from brands, not just businesses
- Establish the data model now so Stripe integration is a thin wiring layer, not a schema redesign

**Non-goals for this phase:**

- No Stripe wiring, checkout flows, or subscription lifecycle management
- No subscription enforcement (all features available to all users until billing is live)
- No marketplace transaction fees (deferred)

---

## Tier Matrix

| Feature                                    | Free | Starter ($19/mo) | Growth ($49/mo) | Premium ($99/mo) |
| ------------------------------------------ | ---- | ---------------- | --------------- | ---------------- |
| Full BLACQList Page                        | ✓    | ✓                | ✓               | ✓                |
| Hours, contact & social links              | ✓    | ✓                | ✓               | ✓                |
| Marketplace listings (products & services) | ✓    | ✓                | ✓               | ✓                |
| Community reviews                          | ✓    | ✓                | ✓               | ✓                |
| Basic analytics                            | ✓    | ✓                | ✓               | ✓                |
| Verified badge                             | —    | ✓                | ✓               | ✓                |
| Priority placement in search               | —    | ✓                | ✓               | ✓                |
| Advanced analytics dashboard               | —    | ✓                | ✓               | ✓                |
| Remove "Powered by BLACQList" badge        | —    | ✓                | ✓               | ✓                |
| Featured collection placement              | —    | —                | ✓               | ✓                |
| BLACQLight editorial eligibility           | —    | —                | ✓               | ✓                |
| Marketplace category spotlight             | —    | —                | ✓               | ✓                |
| Priority support                           | —    | —                | ✓               | ✓                |
| Sponsored Spotlight credit ($299 value)    | —    | —                | —               | ✓                |
| Homepage featured placement                | —    | —                | —               | ✓                |
| Dedicated account support                  | —    | —                | —               | ✓                |
| Early access to new features               | —    | —                | —               | ✓                |

**Annual pricing (billed yearly, ~20% off):** Starter **$182/yr** ($15.17/mo) · Growth **$470/yr**
($39.17/mo) · Premium **$950/yr** ($79.17/mo). Each rounds to 20% off 12× the monthly price.

---

## Add-On Products

### Sponsored Spotlight

- **Price:** $299–$999/mo (inventory-based, limited slots)
- **What it is:** A high-visibility placement on the BLACQList homepage, city-specific landing pages, and category index pages
- **Who it's for:** Businesses that want guaranteed above-the-fold presence beyond what their plan tier provides
- **Placement zones:** `homepage`, `city`, `category`, `search`
- **Inventory model:** Each zone has a defined number of slots (e.g., 3 homepage slots). Pricing reflects demand.
- **DB record:** `sponsored_placements` row with `placement_type = 'spotlight'`

### BLACQ Boost

- **Price:** $49–$99 / 30 days (one-time payment)
- **What it is:** A temporary algorithmic boost that surfaces an individual listing higher in search results and relevant category pages
- **Who it's for:** Businesses running a promotion, launching a new product, or trying to re-engage after a slow period
- **Duration:** Fixed 30-day window from activation
- **DB record:** `sponsored_placements` row with `placement_type = 'boost'`

---

## Later Revenue Streams

These are planned but not in scope for this build:

| Stream                      | Description                                                                       | Trigger                                 |
| --------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Marketplace transaction fee | 3–8% fee on purchases routed through BLACQList marketplace (products/services)    | When checkout flows are live            |
| Featured job postings       | Paid visibility for job listings on BLACQList Jobs module                         | When Jobs module launches               |
| Event promotion             | Paid amplification for event listings                                             | When Events module launches             |
| Editorial partnerships      | Paid BLACQLight features and sponsored content slots                              | When editorial pipeline is staffed      |
| Sponsor campaigns           | Packaged brand sponsorships (City Spotlight, Platform Partner, Community Partner) | When campaign management admin is built |

---

## Data Model

### `plans` (existing table, `plan_key` column added)

| Column                  | Type    | Notes                                                                              |
| ----------------------- | ------- | ---------------------------------------------------------------------------------- |
| id                      | uuid    | PK                                                                                 |
| plan_key                | text    | `'free'` / `'starter'` / `'growth'` / `'premium'` — nullable, unique partial index |
| name                    | text    | Display name                                                                       |
| price_monthly           | integer | Price in cents                                                                     |
| price_yearly            | integer | Annual price in cents (full year)                                                  |
| features                | jsonb   | Feature list for display                                                           |
| stripe_price_id_monthly | text    | Deferred — set when Stripe is wired                                                |
| stripe_price_id_yearly  | text    | Deferred                                                                           |
| is_active               | boolean |                                                                                    |
| display_order           | integer |                                                                                    |

### `subscriptions` (new placeholder table)

| Column                 | Type        | Notes                                                        |
| ---------------------- | ----------- | ------------------------------------------------------------ |
| id                     | uuid        | PK                                                           |
| listing_id             | uuid        | FK → listings                                                |
| user_id                | uuid        | FK → auth.users                                              |
| plan_id                | uuid        | FK → plans (nullable)                                        |
| status                 | text        | `inactive` / `active` / `canceled` / `past_due` / `trialing` |
| current_period_start   | timestamptz | Set when Stripe wires up                                     |
| current_period_end     | timestamptz |                                                              |
| stripe_subscription_id | text        | Deferred                                                     |
| stripe_customer_id     | text        | Deferred                                                     |
| created_at             | timestamptz |                                                              |
| updated_at             | timestamptz | auto-updated                                                 |

**RLS:** Owner (`user_id = auth.uid()`) can SELECT their own subscription.

### `sponsored_placements` (new placeholder table)

| Column                   | Type        | Notes                                                        |
| ------------------------ | ----------- | ------------------------------------------------------------ |
| id                       | uuid        | PK                                                           |
| listing_id               | uuid        | FK → listings                                                |
| placement_type           | text        | `spotlight` / `boost`                                        |
| placement_zone           | text        | `homepage` / `city` / `category` / `search`                  |
| starts_at                | timestamptz |                                                              |
| ends_at                  | timestamptz |                                                              |
| status                   | text        | `inactive` / `active` / `scheduled` / `expired` / `canceled` |
| price_cents              | integer     |                                                              |
| stripe_payment_intent_id | text        | Deferred                                                     |

**RLS:** Service role only for now. Public read of active placements added when rendering is implemented.

### `sponsor_campaigns` (new placeholder table)

| Column              | Type        | Notes                                                                     |
| ------------------- | ----------- | ------------------------------------------------------------------------- |
| id                  | uuid        | PK                                                                        |
| sponsor_name        | text        |                                                                           |
| contact_email       | text        |                                                                           |
| campaign_type       | text        | `city_spotlight` / `platform_partner` / `community_partner` / `editorial` |
| target_cities       | text[]      |                                                                           |
| budget_cents        | integer     |                                                                           |
| starts_at / ends_at | timestamptz |                                                                           |
| status              | text        | `inquiry` / `proposal` / `active` / `completed` / `canceled`              |
| notes               | text        |                                                                           |

**RLS:** Service role only. Admin UI required before this table has any reads.

---

## Stripe Integration Approach (Deferred)

When a payment provider is chosen and configured, the integration will consist of:

1. **Seed `plans` with Stripe price IDs** — run a one-time script to populate `stripe_price_id_monthly` and `stripe_price_id_yearly`
2. **Checkout session creation** — server action: create a Stripe Checkout session with the plan's price ID, attach `listing_id` and `user_id` as metadata
3. **Webhook handler** — `POST /api/webhooks/stripe` — process `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted` events; update `subscriptions` table
4. **Subscription guard** — middleware or server action wrapper that checks `subscriptions.status = 'active'` before granting access to paid features

---

## Upgrade Path for Existing Free Users

When paid plans launch:

- All existing listings remain on Free plan — no action required
- `subscriptions` table will have no row for these listings (absence = Free tier)
- Dashboard will show `/dashboard/upgrade` with plan comparison and a CTA to subscribe
- No data will be lost or access removed — only additive features are gated
