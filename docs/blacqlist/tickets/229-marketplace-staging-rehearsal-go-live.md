# Ticket 229: Staging rehearsal and the marketplace go-live gate

**Phase:** V1.5 · **Priority:** P1 · **Status:** Blocked (needs counsel, a CPA, and Connect approval)
**Depends on:** 210 to 228
**Gates:**
- GATE-PUBLISH for the legal pages.
- GATE-DEPLOY for the live Stripe keys and Connect webhook secret, set by the founder.
- GATE-PUBLISH for setting `FEATURE_CART=true` and `FEATURE_MARKETPLACE_OPEN=true` in Production.

**Decision record:** founder, 2026-11-13, pick 1. "No real money until a CPA and attorney sign off on tax, payouts, and seller/buyer terms."

## Why

Everything before this runs in test mode. This ticket proves the whole path once on staging, then lists exactly what must be true before a real card is charged.

## Scope

In:
- **The rehearsal on staging,** in test mode with test Connect accounts for 3 sample shops. Each shop has a physical product with variants, one has a digital product, and one is new so its products need review. The run:
  1. A guest buys from 2 shops, physical plus digital.
  2. A signed-in shopper buys from 3 shops.
  3. The seller ships with tracking, and the transfer goes out.
  4. A new seller's transfer is held for 7 days.
  5. An order is auto-cancelled at ship_by plus 7 days, with the clock overridden.
  6. A not-as-described case is refunded after the transfer, with a reversal.
  7. A dispute is opened with the test card, then lost.
  8. The last unit sells, and the item leaves the Shop, search, Cue and the profile. A restock brings it back.
  9. An AI-tagged photo upload is rejected.
  10. 3 strikes suspend a seller.
- **A report** at `docs/blacqlist/ops/reports/marketplace-rehearsal-{date}.md`, with screenshots, Stripe test dashboard ids, and every amount reconciled to the cent.
- **The go-live checklist,** all of which must be ✅ with a date and source:
  - [ ] An attorney has reviewed and signed off the Seller Agreement, the Buyer Terms, the §10 rewrite and the policies (220).
  - [ ] A CPA has signed off on the fee base, facilitator registrations and digital taxability, and the registrations they require are filed and entered in Stripe Tax.
  - [ ] The Stripe Connect platform application is approved, live Connect settings match test, and the statement descriptor is set.
  - [ ] A DMCA agent is registered with the Copyright Office.
  - [ ] Insurance is bound: general and product liability, and cyber.
  - [ ] 5 vendor conversations are held, and the first sellers are onboarded in live mode with approved products.
  - [ ] The legal pages are published (GATE-PUBLISH), and the privacy addendum is live.
  - [ ] The live webhook endpoints are registered, and the secrets are set by the founder.
  - [ ] The rehearsal report is clean.
  - [ ] A rollback is written: setting `FEATURE_CART=false` hides every purchasable item and the cart. Orders already paid still ship, and refunds still work from admin.
- **Go-live** comes on the founder's word: the flags are set in Production, followed by a 30-minute watch. The first real order is watched end to end.

Out:
- Marketing the launch, which is GATE-COMMS for the marketing team.

## Checks

- The rehearsal report reconciles every charge, fee, transfer, refund and reversal.
- With `FEATURE_CART=false` in Production, no cart route, buy box or purchasable item is reachable. This is checked before and after go-live.
