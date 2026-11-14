# Shop Legal Set: Questions for Counsel and the CPA

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** the attorney and CPA BLACQList engages for Shop. Neither is engaged yet. The founder sends this with the folder.
**Depends on:** every file in `docs/blacqlist/legal/marketplace/`, the live Terms of Service and Privacy Policy, `legal-pages-and-discrimination-risk-review.md`, `ownership-label-pivot-decision-2026-07-07.md`.

---

## Cover memo

BLACQList is a US directory that centers Black-owned businesses and also lists Ally businesses. It is adding Shop: one cart and one payment across many sellers, through Stripe Connect separate charges and transfers. Sellers are businesses on the Growth plan or higher. They are the sellers of record and ship their own goods or supply digital files. BLACQList collects payment as the sellers' limited payment collection agent, keeps an 8% fee, collects sales tax as marketplace facilitator through Stripe Tax, and runs buyer protection.

The operator named in the live Terms (§16) is The BLACQList, LLC, with Georgia law and Georgia courts (§14). The drafts use `{Legal entity name}` and `{State of formation}` until you confirm them.

Nothing in this folder is live. The go-live rule in `README.md` holds: no part goes live until you both sign off.

Each draft marks unsure legal points `[Needs professional review]` and assumed facts `[Assumption]`. The questions below are the ones that decide the shape of the set.

Case and statute references in the drafts are from the drafter's general knowledge and have not been checked against current sources.

## Questions for the attorney

| # | Question | Lives in |
|---|---|---|
| A1 | **Payment collection agent and money transmission.** Does the agent-of-the-payee appointment keep BLACQList out of state money transmitter licensing, given that under separate charges and transfers the funds sit in BLACQList's Stripe balance for days to weeks before transfer? Which states need more, and does the Money Transmission Modernization Act, where adopted, help? | `seller-agreement.md` 4.3, 6; `buyer-terms.md` Part 1 §1; `fees-and-payouts.md` §1 |
| A2 | **Merchant of record on the card statement.** A multi-seller charge cannot name a seller's account, so BLACQList's name shows on the statement and BLACQList carries the chargebacks. How does that sit with the seller being seller of record, and with the Terms §10 change? | `seller-agreement.md` 4.4; `buyer-terms.md` Part 1 §3 |
| A3 | **Terms §10.** Approve the proposed replacement for "not a party to any transaction", and the related changes to §2, §8, §11, §12, §13 and §15 | `buyer-terms.md` Parts 2 and 3 |
| A4 | **§1981.** The 2026-08-26 clearance covered paid tiers "as designed". Does it extend to a commission marketplace where BLACQList earns a share of each sale? In particular, any Shop ranking, sort or "Black-owned brands" count line that orders sellers by ownership label now affects sales BLACQList profits from. Confirm Shop terms, fees, holds and review steps that do not depend on the label are enough | `seller-agreement.md` 3.3, 10.4; `prohibited-and-restricted-items.md` §3 |
| A5 | **Mail Order Rule.** Confirm the corrected delay timing meets 16 CFR 435.2: a reminder to the seller 1 business day before ship-by, a delay notice at once when the seller sets a revised date before ship-by, an automatic delay notice on the ship-by date if none was sent, and automatic cancel and refund at ship-by plus 7 days. Is BLACQList itself a "seller" under the Rule? `[Needs professional review]` | `shipping-and-delivery-policy.md` §5; `seller-agreement.md` 12.3; `buyer-terms.md` Part 1 §4 |
| A6 | **Product liability.** A marketplace that takes payment, decides refunds and reviews listings may be treated as being in the chain of distribution in some states. Cases to look at include *Bolger v. Amazon.com* (Cal. Ct. App. 2020) and the *Oberdorf* litigation. What exposure does BLACQList have, does founder pre-review of restricted items add to it, and what insurance should BLACQList and sellers carry? | `seller-agreement.md` 18, 19; `prohibited-and-restricted-items.md` §4 P5 |
| A7 | **INFORM Act process.** Can BLACQList rely on Stripe-held bank and tax data? Is a voicemail line enough for telephonic reporting? Do digital sales count? Where and how to show $20,000 seller details | `inform-act-compliance.md` |
| A8 | **Arbitration and class waiver.** The live Terms have none (risk review Finding 3). Should the Terms, the Purchase Terms and the Seller Agreement add one together, or stay with Georgia courts? | `seller-agreement.md` 23; `buyer-terms.md` Part 3 |
| A9 | **DMCA agent.** The Terms §9 registration number has not been confirmed active (risk review Finding 4). Confirm or register before Shop opens. Approve the counter-notice and repeat infringer policy | `ip-and-counterfeit-takedown.md` §2, §7 |
| A10 | **Age minimum for buyers.** Accounts need 18+ (Terms §1, §3). Guest checkout has no account. 18+ for Shop purchases, or minors with parental consent? | `buyer-terms.md` Part 1 §2 |
| A11 | **FTC fake reviews rule.** Shop has no reviews in v1. If they are added, 16 CFR Part 465 applies. Confirm the v1 ban on reviews in product descriptions is enough for now | `seller-agreement.md` 10.6; `buyer-terms.md` Part 1 §11 |
| A12 | **Auto-renewal and recurring charges.** Nothing in Shop recurs in v1. Confirm no state automatic renewal law, such as California's, is triggered, and that digital memberships or subscriptions stay out until reviewed | `digital-products-policy.md` §1 |
| A13 | **Digital refund consent.** Approve the exact checkbox wording and placement | `digital-products-policy.md` §5 |
| A14 | **AI content disclosure.** Approve the rule, its threshold and its legal basis. Advise on licence wording for AI-made files | `digital-products-policy.md` §6 |
| A15 | **Buyer protection wording.** Does a "buyer protection" promise create warranty or insurance-like duties? Is BLACQList's case decision binding on the seller? | `returns-refunds-buyer-protection.md` §9 |
| A16 | **Seller data under privacy law.** Are sellers separate businesses, third parties or service providers under CCPA and other state laws? Is sharing order data with them a "sale" or "sharing"? | `privacy-policy-marketplace-addendum.md`; `seller-agreement.md` 20 |
| A17 | **Restricted items.** Cottage food sold across state lines, MoCRA for small sellers, CPSIA certificates and eFiling, supplement claims | `prohibited-and-restricted-items.md` §2 |
| A18 | **Notice of changes.** Terms §15 and Privacy §10 promise 14 days' email notice to registered users. Is the Shop launch a material change needing that email, and how are guest shoppers covered? | `buyer-terms.md` Part 3; `privacy-policy-marketplace-addendum.md` §3 |
| A19 | **Liability caps.** Terms §11 caps liability at the greater of $100 or what the user paid BLACQList in 12 months. Shoppers now pay BLACQList the full order. Approve the seller cap in Seller Agreement 22.3 and the shopper change | `seller-agreement.md` 22.3; `buyer-terms.md` Part 3 |

## Questions for the CPA

| # | Question | Lives in |
|---|---|---|
| C1 | **Fee base.** 8% of items plus shipping, excluding tax, as the founder chose, or items only? Any tax effect of charging the fee on shipping? | `fees-and-payouts.md` §2 |
| C2 | **Marketplace facilitator registration.** In which states and when must BLACQList register? How do thresholds count marketplace sales? What must sellers do in states where BLACQList is not yet registered? | `seller-agreement.md` 9; `fees-and-payouts.md` |
| C3 | **Digital goods taxability by state,** and the product tax codes sellers should pick in Stripe Tax | `digital-products-policy.md` §7 |
| C4 | **Processing fee on the tax part.** Should sellers share Stripe's fee on the tax portion of the charge, or should BLACQList bear it? | `fees-and-payouts.md` §3 |
| C5 | **1099-K.** Who is the filer of record under separate charges and transfers, BLACQList or Stripe? What are the federal and state thresholds for 2026? | `seller-agreement.md` 9.3; `fees-and-payouts.md` §1 |
| C6 | **Revenue and held funds.** Gross or net reporting? How to account for money held before transfer, the rounding remainder, and negative balances BLACQList absorbs | `fees-and-payouts.md` §5 to §7 |
| C7 | **Refunds.** Tax treatment of refunded shipping and partial refunds, and reclaiming tax already remitted | `returns-refunds-buyer-protection.md` §5; `fees-and-payouts.md` §7 |
| C8 | **Retention.** How long to keep order, payment and tax records. The draft assumes 7 years | `privacy-policy-marketplace-addendum.md` §2 |
| C9 | **Fee taxability.** Is BLACQList's own 8% fee taxable in any state? | `fees-and-payouts.md` §8 |

## Conflicts found with live pages and earlier docs

| Where | Conflict |
|---|---|
| Terms §10 | "The BLACQList is not a party to any transaction between users and listed businesses." Untrue once Shop takes payment. Replacement in `buyer-terms.md` |
| Terms §2 | "Verified" and "BLACQList Certified" badge text, and "Users should verify business information independently before transacting", clash with the Shop copy rule and on-platform checkout |
| Terms §11 | Cap tied to "the total amount you paid to The BLACQList" now grows with Shop spend |
| Terms §12 | Survival list "Sections 5, 8, 9, 10, 12, and 13" looks stale since §5 Creator Pages was added |
| Terms §13.5 | "Payments are non-refundable" must be scoped to plan payments |
| Terms §15, Privacy §10 | 14-day notice is promised to registered users only. Guest shoppers are not covered |
| Terms §9 | DMCA registration number unconfirmed. No counter-notice or repeat infringer policy |
| Privacy §3 | "We do not ... share your information with third parties for their own marketing purposes" would break if sellers get opt-in marketing |
| Privacy §6 | Stripe row "used when paid features become available" is already out of date |
| Privacy §7 | 30-day deletion on account deletion needs a carve-out for order and tax records |
| `marketplace-workshop-2026-11.md` | Pick S3 E has a seller "Buy" button that opens the seller's site, and says "The shopper buys on the shop's own site" and the cart is a "Future" flag until release item 38. The 2026-11-13 founder decision is checkout on BLACQList only, with no link-out for products. The workshop and tickets 210 to 219 need updating to match |
| Marketplace hero | "Products and services from verified Black-owned businesses." Already flagged for ticket 210. Must change before Shop sells anything |
