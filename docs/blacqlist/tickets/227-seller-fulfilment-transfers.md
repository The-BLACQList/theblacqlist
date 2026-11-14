# Ticket 227: Seller orders, shipping, the Mail Order Rule clock and transfers

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 224, 226
**Gates:**
- No new table beyond 226. A cron entry in `vercel.ts`.
- Test mode until 229.

**Decision record:**
- Founder, 2026-11-13: "vendors are responsible for shipping and delivering products to customers". Each shop ships its part.
- BLACQList handles refunds up front and recovers them from the shop.

## Why

Sellers need one place to see what to ship, mark it shipped and get paid. The shopper needs the FTC Mail Order Rule protections without us chasing every order by hand.

## Scope

In:
- **Seller pages** at `/dashboard/orders`, as drawn on round 3 board R3-7:
  - tabs for To ship, Shipped and Cases;
  - each order shows the ship-by countdown, items, the ship-to address, a packing slip to print, the 8% fee line and the payout amount, and the transfer status: "Pays out when shipped", "Paying out {date}" or "Paid out {date}".
- **Mark shipped:** carrier (USPS, UPS, FedEx, DHL, Other) and a tracking number, both required for physical orders. This:
  - sets `shipped`;
  - emails the buyer with the tracking link;
  - makes the transfer `eligible` now, or at `shipped_at + 7 days` for a `new` seller.
- **Transfers** happen in a cron run (`app/api/cron/marketplace-transfers`, every 15 minutes). It:
  - finds `eligible` rows past `release_after` that aren't `frozen`;
  - calls `stripe.transfers.create` with `amount: transfer_amount_cents`, `destination`, `transfer_group` and `source_transaction` set to the charge;
  - uses the idempotency key `transfer:{seller_order_id}`;
  - records `transfer_id` and sets `paid`.

  Failures retry with backoff and alert the admin after 3 tries.
- **The ship-by clock,** in the same cron or a daily one. The FTC Mail Order Rule wants the delay notice before the promised date passes.
  - At ship_by minus 1 business day, the seller gets a reminder: ship, or set a revised date.
  - If the seller sets a revised date before ship_by, the buyer gets the delay notice at once, with the new date and **Cancel for a full refund**.
  - If ship_by passes unshipped with no notice sent, the delay notice goes to the buyer automatically that day, and the seller is emailed.
  - At ship_by plus 7 days, still unshipped: the seller's part is auto-cancelled, the buyer refunded for that part (228's refund path), the reservation restocked, and the seller's late count incremented. This is stricter than the Rule's 30-day implied consent, on purpose. `[Needs professional review]`

  The days are constants in `lib/marketplace/fulfilment.ts`, and the wording follows `shipping-and-delivery-policy.md` (220).
- **Delivered:** carrier delivery isn't tracked in v1. An order is marked delivered by the buyer, or automatically at ship date plus 14 days. That's used only for the case windows in 228.
- **Admin view** at `/admin/marketplace/orders`: search by ref, see the split and the transfer state, and freeze or unfreeze a seller's transfers, with each action written to the audit log.

Out:
- Buying labels and carrier tracking APIs, which would be a spend decision later.
- Partial shipments within one shop: v1 ships a shop's part at once.

## Checks

- **Unit tests for the business-day maths:** ship_by over a weekend, the reminder, the delay notice going out no later than ship_by, and the auto-cancel date.
- **In Stripe test mode:**
  - marking shipped on a trusted seller creates one transfer for the exact amount;
  - a second cron run creates no duplicate, because of the idempotency key;
  - a `new` seller's transfer waits 7 days. Use a clock override in tests.
- **A frozen seller** gets no transfer.
- **An unshipped order** at ship_by plus 7 days is refunded for that shop's part only, and the other shops' parts are untouched.
