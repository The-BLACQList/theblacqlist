# Ticket 228: Buyer orders, digital downloads, refunds, cases and disputes

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 226, 227
**Gates:**
- A migration (GATE-DATA) for `download_grants`, `order_cases` and `refunds`, staging first.
- Test mode until 229.
- Malware scanning for seller files is a spend decision. Until it's decided, files are `not_scanned`, and the product page says nothing about scanning.

**Decision record:** founder, 2026-11-13. BLACQList handles refunds and disputes up front and recovers them from the shop. Physical and digital items are sold.

## Why

Buyer trust is the product. A shopper must always know where their order is, get files they paid for, and get their money back when a shop doesn't deliver.

## Scope

In:
- **Migration:**
  - `download_grants`: `order_item_id`, `max_downloads` (5), `download_count`, `last_download_at`.
  - `order_cases`: `id`, `seller_order_id`, `kind` (`not_received`, `not_as_described`, `cancel_request`), `status` (`open`, `seller_responded`, `resolved_refund`, `resolved_no_refund`), `buyer_note`, `seller_note`, `respond_by`, and timestamps.
  - `refunds`: `id`, `seller_order_id`, `amount_cents`, `reason`, `stripe_refund_id`, `transfer_reversal_id`, `recovered_from_seller` (bool), `created_by`.
  - RLS: buyers and sellers see their own; writes go through the service role.
- **Buyer pages:**
  - `/account/orders`, a list;
  - `/account/orders/{ref}`, as drawn on R3-4: each shop's part and its status, tracking, Download for digital items, and the case buttons with their windows;
  - guests use `/orders/{public_ref}` with a signed token from the email.
- **Downloads:** `GET /api/orders/{ref}/download/{item}`:
  - checks ownership, or the guest token;
  - increments the count, and blocks past 5 with "Reached the download limit. Contact us and we'll reset it.";
  - redirects to a Supabase signed URL that expires in 15 minutes;
  - records the first download time, which ends refund eligibility except for defects, per the digital policy.
- **Cases:**
  - "Not received" opens 7 days after the expected delivery date. "Not as described" opens within 30 days of delivery.
  - The seller has 3 business days to respond. Then it goes to the admin queue as `queue_type = 'listing_report'` with an `order_case` tag. Or add an `order_case` queue type in this migration.
  - An open case freezes that seller order's pending transfer.
- **Refunds,** one path in `lib/marketplace/refunds.ts`, used by sellers (full or partial), the admin, the auto-cancel (227) and case outcomes:
  - **Before the transfer:** `stripe.refunds.create` on the PaymentIntent for the amount, and the seller order is adjusted.
  - **After the transfer:** the refund, plus `stripe.transfers.createReversal` for the seller's share of the refunded amount.
  - **The fee on refunds:** BLACQList returns its 8% share on a full refund. Stripe's own fee isn't returned by Stripe, and is borne per `fees-and-payouts.md`, for counsel and the CPA to confirm.
  - If a reversal fails because the seller's balance is short, record it as owed and offset it against the next transfer.
- **Disputes:** `charge.dispute.created`, `updated` and `closed` on the platform webhook.
  - `created` freezes every pending transfer of the shops in that order, emails those sellers for evidence (tracking, photos), and alerts the admin.
  - A lost dispute triggers transfer reversals for the shops responsible.
  - Evidence is submitted from the admin page using the seller's uploads and tracking.
- **Emails:** refunded, case opened, seller response, case decided, digital ready, and download limit reached.

Out:
- Return shipping labels. Sellers handle returns per their policy.
- Store credit.

## Checks

- **Download tests:**
  - the 6th download is blocked;
  - another buyer's ref returns 404;
  - the signed URL expires.
- **In Stripe test mode:**
  - a refund before the transfer;
  - a refund after the transfer, with a reversal created and the amounts exact;
  - a partial refund of 1 of 2 items.
- **A test dispute** (Stripe's dispute test card) freezes transfers. Losing it reverses them.
- **A case** opened before its window is rejected with the date it opens.
