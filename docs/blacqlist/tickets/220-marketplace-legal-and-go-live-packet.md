# Ticket 220: Marketplace legal set, counsel and CPA packet

**Phase:** V1.5 · **Priority:** P0 for go-live, P1 for build · **Status:** In progress (drafts)
**Depends on:** none
**Gates:** docs only, no code. Nothing here goes live until an attorney and a CPA sign off (decision E5, and the 2026-11-13 decision). Publishing any of it is GATE-PUBLISH.
**Decision record:** founder, 2026-11-13 (decision-log, "Shop becomes a real marketplace"). Picks: build now with no real money until reviewed; one cart for many shops; checkout on BLACQList only; real photos with review then spot checks.

## Why

Vendors ship their own goods, but BLACQList takes the payment, the fee, the sales tax and the first refund. That makes us more than a directory. Today's Terms §10 says we are "not a party to any transaction", which stops being true the day the cart opens.

## Scope

In. Drafts in `docs/blacqlist/legal/marketplace/`, every one marked `[Needs professional review]`:
- `seller-agreement.md`
- `buyer-terms.md`, including the §10 rewrite
- `prohibited-and-restricted-items.md`
- `product-photo-policy.md`
- `shipping-and-delivery-policy.md`
- `returns-refunds-buyer-protection.md`
- `digital-products-policy.md`, with the exact download-consent wording
- `fees-and-payouts.md`, with a worked 2-shop example in cents
- `inform-act-compliance.md`
- `ip-and-counterfeit-takedown.md`, which covers the DMCA agent
- `privacy-policy-marketplace-addendum.md`
- `counsel-and-cpa-packet.md`
- `README.md`

Out:
- Turning the drafts into live pages. That happens in 229, after sign-off.
- Engaging counsel or a CPA. That's a founder action in next-actions.

**Founder decisions this surfaced** (the drafts mark them `[Assumption]`):
- The INFORM Act needs a phone number for reporting suspicious listings, and BLACQList has none published.
- What counts as a new seller.
- When a case or dispute is open, freeze all of a seller's pending transfers or only the disputed amount.
- Credit the 8% fee back on refunds.
- The strike window.
- A $1M insurance expectation for sellers.

**Live-page conflicts to fix at go-live** (229):
- Terms §2, the Verified/Certified wording;
- §10;
- §11, the liability cap;
- §12, the survival list;
- §13.5, "non-refundable";
- §15, guest notice;
- §9, there's no counter-notice (the DMCA agent is registered: ticket 102, 2026-06-30);
- Privacy §2, §6 and §7, including order and tax record retention.

The list is in `README.md` and `counsel-and-cpa-packet.md`.

## Checks

- Every file has the Draft header and the review marker.
- The fee example adds up to the cent, with the rounding rule stated.
- Each of these appears as a question in the packet:
  - the fee base;
  - marketplace-facilitator registration;
  - digital-goods taxability;
  - collection-agent wording;
  - the merchant of record on the card statement;
  - §1981;
  - the INFORM process;
  - Mail Order Rule auto-cancel;
  - product liability and insurance;
  - the DMCA counter-notice and repeat infringer policy.
- Copy rules hold. The drafts never say "verified Black-owned".
