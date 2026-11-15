# Ticket 224: Seller payments onboarding: Stripe Connect, seller agreement, INFORM

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 221. 220 provides the Seller Agreement text; a draft version is fine in test mode.
**Gates:**
- A migration (GATE-DATA), staging first.
- Test mode only until go-live (229). The Stripe Connect platform application is the founder's (GATE-SPEND); test-mode Connect works without it.
- No env var holds a secret beyond the existing Stripe keys. Connect webhooks need a second endpoint secret: name it, and the founder sets it.

**Decision record:** founder, 2026-11-13. Each shop gets its share minus 8%. The vendor is responsible for shipping. Payouts go through Stripe.

## Why

Sellers have to be paid without BLACQList holding bank details. Stripe Express-style accounts do KYC, 1099-Ks and payouts. The INFORM Act also requires us to collect and verify high-volume sellers.

## Scope

In:
- **Migration `seller_accounts`:**
  - `listing_id` (unique), `stripe_account_id`;
  - `charges_enabled`, `payouts_enabled`, `details_submitted`;
  - `requirements jsonb`, `disabled_reason`;
  - `agreement_version`, `agreement_accepted_at`, `agreement_accepted_by`;
  - `contact_email`, `contact_phone`;
  - `inform_status` (`not_required`, `required`, `verified`, `suspended`), `inform_verified_at`, `inform_certified_at`;
  - `sales_12m_count`, `revenue_12m_cents`, and timestamps.

  RLS lets the owner read their own row. Every write goes through the service role.
- **Onboarding on the dashboard** at `/dashboard/sell`, as drawn on round 3 board R3-5. The steps:
  1. Seller Agreement: show the text with a version, then "I agree". This records the version, time and user.
  2. Payouts with Stripe: create the connected account, with `controller` settings for Express-style dashboard access and Stripe-owned losses set to the application per our recovery model (counsel and Stripe settings confirm). Send the seller to an Account Link, with return and refresh routes. Set the payout schedule to weekly on creation (`settings.payouts.schedule.interval = 'weekly'`, `weekly_anchor = 'monday'`; founder 2026-11-15, see `fees-and-payouts.md` section 9).
  3. Shipping profile (221).
  4. Return policy default.
  5. First product (222).

  A status card shows: "In review: your first 3 products", or "Payouts paused: Stripe needs {requirement}".
- **Express dashboard link** ("See payouts"), using a login link.
- **Connect webhooks** go on a second endpoint, `app/api/stripe/connect-webhook/route.ts`, with the same idempotency as `app/api/stripe/webhook/route.ts` (`stripe_events_processed`, `failed_webhooks`). It handles:
  - `account.updated`, which syncs capabilities and requirements; losing `payouts_enabled` drops the seller's products from the view;
  - `account.application.deauthorized`;
  - `payout.failed`, which emails the seller.
- **INFORM:**
  - A nightly job (a `vercel.ts` cron, route under `app/api/cron/`) recomputes `sales_12m_count` and `revenue_12m_cents` from `seller_orders` (226).
  - A seller crossing 200 sales and $5,000 becomes `required`. We verify bank and tax ID from Stripe's verified account data, and the seller confirms contact details. Ten days without completion means `suspended`.
  - The seller certifies yearly.
  - Sellers over $20,000 a year get the disclosure block on product pages (217).
  - Thresholds and wording follow `inform-act-compliance.md` (220).
- **Seller email:** "Payouts are set up", and "Stripe needs more information".

Out:
- Transfers (227) and payment acceptance (226).
- Non-US sellers. v1 is US only.

## Checks

- With the Stripe CLI in test mode, an onboarding flow with a test account reaches `charges_enabled` and `payouts_enabled`, and the seller's approved product appears in the view. When `account.updated` disables payouts, it disappears.
- A new test connected account has a weekly payout schedule on Mondays, and the seller can't switch it to daily from the Express Dashboard.
- Connect webhook replays are idempotent: the same event twice is processed once.
- A seller can't onboard for a listing they don't own, and a listing below Growth sees an upgrade prompt.
- The INFORM job flags a seeded seller at 200 sales and $5,000, and doesn't flag one at 199 sales.
