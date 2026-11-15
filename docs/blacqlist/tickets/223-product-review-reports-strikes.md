# Ticket 223: Product review queue, spot checks, listing reports and strikes

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 221, 222
**Gates:** no new migration (221 adds the queue types). Admin-only, plus the public report button behind `FEATURE_CART`.
**Decision record:** founder, 2026-11-13, pick 4. The founder approves each seller's first products, then spot checks, shopper reports and strikes.

## Why

The provenance check only catches tagged images. People catch the rest: the founder at first, then shoppers.

## Scope

In:
- **The admin queue** at `/admin/marketplace/review`, reusing `app/admin/reports` patterns and `lib/actions/admin/resolveQueueItem.ts`.
  - Each item shows the product, every photo at full size with its provenance verdict and attestation time, variants and prices, the restricted attestation, and the seller's trust level, strikes and history.
  - Actions:
    - **Approve**, which sets `review_status = approved`, increments `seller_status.approved_count`, and makes the seller `trusted` at 3;
    - **Reject** with a reason, chosen from a list plus a note, and emailed to the seller;
    - **Reject + strike**.
  - Spot checks use the same screen, with a "Spot check" tag. The product stays live while it waits.
- **Shopper reports.** "Report this listing" on the product page (217) and in the cart. It offers 5 reasons and an optional note, and works signed in or signed out, with a rate limit like the existing report endpoints.
  - It writes `moderation_queue` with `queue_type = 'listing_report'`.
  - Three open reports on one product hide it until reviewed.
- **Strikes:**
  - An upheld report or a reject with strike adds 1.
  - At 3 strikes, `suspended_at` is set and every product of that seller leaves the purchasable view.
  - Open orders still have to be fulfilled, and the seller is emailed.
  - The founder can clear strikes and unsuspend, with a note.
  - Every action writes to the existing admin audit log.
- **Emails** to the seller, through `lib/email/resend.ts` with new templates and previews on `/admin/email-preview`:
  - approved;
  - rejected (reason);
  - strike (count, reason);
  - suspended.
- **The admin marketplace page** shows queue counts.

Out:
- Automated image classifiers. They'd be a spend decision, revisited after launch.

## Checks

- A new seller's 1st, 2nd and 3rd products queue. The 4th is live at once, and about 10% of later saves queue. Test the sampling with a seeded random number.
- A rejected product never appears in the view.
- 3 strikes removes every product of that seller from the view, and unsuspending restores them.
- The report endpoint is rate-limited and needs no account.
