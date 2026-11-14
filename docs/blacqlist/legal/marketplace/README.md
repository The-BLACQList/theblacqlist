# Shop Legal Set

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** the founder, the attorney and the CPA, and anyone building Shop checkout.
**Depends on:** the founder's Shop decisions of 2026-11-13, the live Terms of Service and Privacy Policy, `../legal-pages-and-discrimination-risk-review.md`, `../ownership-label-pivot-decision-2026-07-07.md`, `../../design/marketplace-workshop-2026-11.md`.

---

## Go-live rule

**None of these documents become live until counsel and the CPA sign off.** That means: no Shop checkout opens, no seller accepts the Seller Agreement, and no change goes into `TermsOfService.tsx` or `PrivacyPolicy.tsx` until both have reviewed this set and their changes are made. Sign-off is recorded in this README with the date and who gave it. A relayed verbal answer is recorded as `[Observed]`, as the risk review did on 2026-08-27, and says what it does and does not cover.

No attorney or CPA is engaged yet.

## The set

| File | What it is | Main reader |
|---|---|---|
| [seller-agreement.md](seller-agreement.md) | The full Seller Agreement | Counsel, sellers |
| [buyer-terms.md](buyer-terms.md) | Shop Purchase Terms, and the proposed change to Terms §10 | Counsel, shoppers |
| [prohibited-and-restricted-items.md](prohibited-and-restricted-items.md) | What can't be sold, and the conditions for food, cosmetics, children's products and supplements | Counsel, sellers |
| [product-photo-policy.md](product-photo-policy.md) | Real photos for physical products, allowed edits, checks and strikes | Sellers, founder |
| [shipping-and-delivery-policy.md](shipping-and-delivery-policy.md) | Shipping profiles, Mail Order Rule timing, delivery | Counsel, sellers, shoppers |
| [returns-refunds-buyer-protection.md](returns-refunds-buyer-protection.md) | Seller return policies and the platform minimum | Counsel, sellers, shoppers |
| [digital-products-policy.md](digital-products-policy.md) | Delivery, licence, refund consent checkbox, AI content disclosure | Counsel, sellers, shoppers |
| [fees-and-payouts.md](fees-and-payouts.md) | Fees, transfer timing, worked example in cents | CPA, sellers |
| [inform-act-compliance.md](inform-act-compliance.md) | High-volume seller collection, checks, disclosure and reporting | Counsel, build |
| [ip-and-counterfeit-takedown.md](ip-and-counterfeit-takedown.md) | DMCA notice and counter-notice, trademark and counterfeit claims, repeat infringers | Counsel, founder |
| [privacy-policy-marketplace-addendum.md](privacy-policy-marketplace-addendum.md) | New privacy section and changes to existing sections | Counsel |
| [counsel-and-cpa-packet.md](counsel-and-cpa-packet.md) | Cover memo and every question for the attorney and the CPA | Counsel, CPA |

## Decided by the founder, 2026-11-13

- Sellers are businesses on Growth or higher. The seller is the seller of record and ships or supplies the file.
- One cart, one payment. Stripe Connect separate charges and transfers. BLACQList is the sellers' limited payment collection agent. Stripe does KYC and 1099-Ks. BLACQList never holds bank details.
- Fee: 8% of items plus shipping, before tax. Stripe fees deducted from sellers' shares pro rata.
- Transfers: physical on ship with tracking, plus 7 days for new sellers; digital 3 days after purchase; open cases and chargebacks freeze pending transfers.
- BLACQList handles refunds and disputes up front and recovers from the seller.
- BLACQList is marketplace facilitator. Stripe Tax calculates. Registrations are the CPA's call.
- Checkout on BLACQList only. No link-out for products.
- Real photos only for physical products, with per-photo confirmation, metadata checks, first 3 products reviewed, 3 strikes suspend.
- Sold-out items hide on their own.
- Shipping to the 50 states and DC. Mail Order Rule timing, corrected on 2026-11-13: seller reminder 1 business day before ship-by, delay notice no later than ship-by, auto-cancel at ship-by plus 7 days.
- Buyer protection minimum: defective, damaged, wrong, not received, not as described.
- Digital: private storage, 15-minute links, 5 downloads, refund consent at checkout, personal licence by default.
- INFORM Act duties as set out in the statute.
- The prohibited and restricted lists.
- Shopper data to sellers for fulfilment and service only.
- Selling is open to every listed business, whatever its ownership label. No product claims to be "verified Black-owned".
- Services are not sold through the cart. No reviews in v1.

## Still open

**For counsel**, in priority order. Full list in the packet.

1. Payment collection agent wording and state money transmitter exposure.
2. BLACQList as merchant of record on the card statement.
3. The Terms §10 replacement, and related changes to §2, §11, §12, §13 and §15.
4. Whether the §1981 clearance covers a commission marketplace and any ranking by ownership label.
5. Mail Order Rule timing and product liability exposure.

**For the CPA:** fee base; marketplace facilitator registration timing and thresholds; digital goods taxability; who bears processing on tax; 1099-K filer.

**For the founder:** every `[Assumption]` in the set. The main ones: new-seller definition; freeze scope; fee credit on refunds; strike window and expiry; appeal window; insurance limit; 3-day pre-download refund; one 30-day window for physical problems; $250 signature threshold; retention periods.

**Before launch, outside these docs:**

- Confirm the DMCA agent registration is active.
- Set up a phone line for INFORM reporting.
- Update `marketplace-workshop-2026-11.md` and tickets 210 to 219, which still show the link-out "Buy" button.
- Check the prohibited list against Stripe's current Restricted Businesses list.

## Style

- Plain English, short sentences, "you" and "we".
- `[Needs professional review]` marks a legal judgement the drafter is unsure of. `[Assumption]` marks a fact or number the founder has not decided.
- Text that shows in the product follows the Shop copy rules: no em dashes, no parentheses, ranges use "to", and never "verified", "confirmed", "all", "every", "only" or "100%". Legal text tries to follow them too. Where a contract needs "only" or "every" for precision, counsel's wording wins, and the founder reviews any of it that shows in the UI.
- The legal entity is shown as `{Legal entity name}` and `{State of formation}` until counsel confirms them. The live Terms name The BLACQList, LLC.
