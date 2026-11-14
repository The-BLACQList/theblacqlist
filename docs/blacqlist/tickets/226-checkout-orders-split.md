# Ticket 226: Checkout, stock reservation, sales tax and the order split

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 221, 224, 225
**Gates:**
- A migration (GATE-DATA), staging first.
- Stripe test mode only. Live mode is 229.
- Stripe Tax must be enabled on the account, with a head-office address and registrations set. Enabling it in test mode is fine. Live registrations are the CPA's call (220).

**Decision record:**
- Founder, 2026-11-13, picks 1 to 3. One payment. Each shop gets its share minus 8%. Checkout happens on BLACQList only.
- Fee D1, 8%.

## Why

This is the money path. It has to be exact, idempotent and fail closed.

## Scope

In:
- **Migration:**
  - `orders`: `id`, `public_ref` (short, unguessable), `profile_id` (nullable for guests), `email`;
  - `stripe_checkout_session_id` (unique), `stripe_payment_intent_id`, `transfer_group`;
  - `currency`, `items_cents`, `shipping_cents`, `tax_cents`, `total_cents`;
  - `shipping_name`, `shipping_address jsonb`;
  - `digital_consent_at`, `terms_version`;
  - `status` (`pending`, `paid`, `partially_refunded`, `refunded`, `canceled`), and timestamps.
  - `seller_orders`: `id`, `order_id`, `listing_id`;
  - `items_cents`, `shipping_cents`, `tax_cents`, `fee_bps`, `fee_cents`, `stripe_fee_share_cents`, `transfer_amount_cents`;
  - `transfer_status` (`held`, `eligible`, `paid`, `reversed`, `frozen`), `transfer_id`, `release_after`;
  - `fulfillment_status` (`to_ship`, `shipped`, `delivered`, `canceled`, `digital_ready`), `ship_by`;
  - `carrier`, `tracking_number`, `shipped_at`.
  - `order_items`: a snapshot of the product title, variant label, unit price, quantity, `product_kind`, and the image path at purchase.
  - `order_events`: an append-only log.
  - `processed_checkout_sessions` is optional. Idempotency can ride on the unique session id instead.
  - **RLS:**
    - A buyer reads their own orders and items.
    - A seller reads their own `seller_orders` and the items, plus only the shipping name and address of orders containing their items.
    - Writes go through the service role.
- **`reserve_stock(p_session text, p_lines jsonb, p_expires timestamptz)`,** a SECURITY DEFINER function with a fixed `search_path`, following the definer-hardening tests.
  - In one transaction it locks the variant rows (`FOR UPDATE`), checks `quantity - active reservations >= n` for tracked variants, and inserts the reservations.
  - If any line fails, it raises, and nothing is reserved.
  - Its partners are `commit_reservation(p_session)`, which decrements `quantity`, and `release_reservation(p_session)`.
- **`POST /api/checkout`.** It takes the cart and runs these steps:
  1. Re-reads the cart through 225 and the purchasable view. If anything changed, it returns 409 with the removed list, and the cart page shows it.
  2. Creates a pending `orders` row and its `seller_orders` rows, with the split pre-computed.
  3. Opens a Stripe Checkout Session with `mode: 'payment'`, following `lib/stripe/jobPostingCheckout.ts`, and sets:
     - line items per variant, with `product_data`, the tax code from the department (physical goods default, digital `txcd_10000000` family; the CPA confirms);
     - one shipping line item per shop with tax code `txcd_92010001`;
     - `automatic_tax: { enabled: true }`;
     - `shipping_address_collection` set to US only, but only when the cart has a physical item;
     - `consent_collection.terms_of_service: 'required'`, with `custom_text` that includes the digital download consent from `digital-products-policy.md` when a digital item is present;
     - `payment_intent_data.transfer_group` set to the order id;
     - `metadata.purpose = 'order'` and `metadata.order_id`;
     - `expires_at` 30 minutes out;
     - `customer_email` when signed in.
  4. Calls `reserve_stock` with the session id. If it fails, it expires the session and returns 409.
  5. Returns the session URL.
- **The webhook.** In `lib/services/billing/webhookHandlers.ts`, `handleCheckoutSessionCompleted` gets a `purpose === 'order'` branch, next to the job-posting branch. It:
  1. Re-fetches the session with expanded line items and `total_details`.
  2. Reads amounts from Stripe (`amount_total`, `amount_subtotal`, `total_details.amount_tax`, `amount_shipping`).
  3. Writes the address and email, commits the reservations, and marks the order `paid`.
  4. Finalizes the split with the Stripe fee from the balance transaction, allocated to shops by their share of `total_cents` minus tax.
  5. Sets `ship_by` from processing days in business days, or `digital_ready` plus a 3-day `release_after` for digital.
  6. Emails the buyer and each seller.

  `checkout.session.expired` releases the reservations and cancels the pending order. The same event twice does nothing extra.
- **Fee maths** live in `lib/marketplace/fees.ts`: `MARKETPLACE_FEE_BPS = 800` and `splitOrder()`.
  - Everything is in integer cents.
  - The fee is computed per shop on items plus shipping, with tax excluded, rounded half up.
  - The Stripe fee is allocated pro rata, with the last shop taking the remainder so the sum is exact.
  - The fee base follows `fees-and-payouts.md` (220) and the CPA's answer. It's a single constant to change.
- **Pages:**
  - the order confirmation at `/orders/{public_ref}`, which also serves as the signed guest link, as drawn on R3-3;
  - the checkout cancel return goes back to `/cart`.
- **Emails:**
  - to the buyer: an order confirmation with each shop's part, and links to digital downloads;
  - to the seller: a new order with the items, ship-to and ship-by.

Out:
- Transfers, shipping updates and refunds (227, 228).
- Saved cards and Link. Stripe Checkout handles payment methods.

## Checks

- **`splitOrder` unit tests:**
  - 1 shop;
  - 3 shops;
  - a $0.01 rounding edge;
  - a digital-only order;
  - free shipping;
  - fee plus Stripe fee plus transfers plus tax equalling `amount_total` exactly.
- **`reserve_stock` concurrency test** in `withScratchDb`: 2 sessions race for the last unit; one wins, and the other gets an error with no partial reservation.
- **Webhook tests:**
  - the same `checkout.session.completed` twice gives one order, one commit and one set of emails;
  - `expired` releases stock.
- **A Stripe CLI run** on staging with a 3-shop cart:
  - one charge;
  - three `seller_orders` with the right amounts;
  - tax present for a registered test state;
  - stock decremented once.
- **Fail closed:** if the session amount doesn't match the pre-computed order, the order is flagged, no transfer becomes eligible, and an admin alert is sent.
