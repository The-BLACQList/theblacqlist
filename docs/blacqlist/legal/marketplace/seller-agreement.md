# Shop Seller Agreement

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** BLACQList's attorney and CPA, then the founder. Once approved, sellers on Shop.
**Depends on:** the live Terms of Service (`app/(public)/terms/TermsOfService.tsx`, sections 1 to 16), the Privacy Policy, and every other file in this folder: `fees-and-payouts.md`, `shipping-and-delivery-policy.md`, `returns-refunds-buyer-protection.md`, `digital-products-policy.md`, `prohibited-and-restricted-items.md`, `product-photo-policy.md`, `inform-act-compliance.md`, `ip-and-counterfeit-takedown.md`, `privacy-policy-marketplace-addendum.md`.

---

## How to read this draft

- The text under "Agreement" is the proposed seller-facing contract. It is written in plain English, in the second person. "You" means the business selling on Shop. "We" and "BLACQList" mean {Legal entity name}.
- The live Terms name the operator as "The BLACQList, LLC" (Terms §16, and `founder-legal-details-howto.md`). This draft uses `{Legal entity name}` until counsel confirms that is the right contracting party. State of formation is `{State of formation}`. `[Assumption]` It is Georgia, based on `legal-pages-and-discrimination-risk-review.md`. Confirm before use.
- `[Needs professional review]` marks a legal judgement the drafter is not sure of. `[Assumption]` marks a fact or number the drafter chose that the founder has not decided.
- Review notes for counsel are at the end, in "Review notes".

---

## Agreement

### 1. Who this agreement is between

1.1 This Seller Agreement is between you and {Legal entity name}, a {State of formation} limited liability company ("BLACQList", "we", "us").

1.2 It applies when you list products for sale in Shop, the BLACQList marketplace. It adds to our Terms of Service and Privacy Policy. If this agreement and the Terms of Service disagree about selling in Shop, this agreement controls.

1.3 The policies listed under "Depends on" above form part of this agreement. We call them the Shop policies.

1.4 You accept this agreement by ticking the box at Shop setup. Suggested checkbox text: "I agree to the Seller Agreement and the Shop policies." We record the version you accepted and when. `[Needs professional review]` Confirm a clickwrap checkbox is enough for a commercial agreement of this kind.

### 2. Words we use

- **Shop:** the part of BLACQList where shoppers buy products from sellers in one cart.
- **Shopper:** anyone who buys in Shop, signed in or as a guest.
- **Order:** the part of a shopper's checkout that is for your products. One checkout can contain orders from several sellers.
- **Product:** a physical good or a digital file you list for sale in Shop. Services are not products. They stay as listings and are not sold through the cart.
- **Order value:** the price of the items in your order plus the shipping you charge, before sales tax.
- **Connected account:** your Stripe account, created through Stripe Connect onboarding from your dashboard.
- **Transfer:** money we send from our Stripe balance to your connected account for an order.
- **Buyer case:** a request a shopper opens with us under the Returns, Refunds and Buyer Protection policy.

### 3. Who can sell

3.1 To sell in Shop you must:

- have a business page on BLACQList on the Growth plan or a higher plan, kept active and paid under Terms §13;
- be a business, or a person acting for a business, based in the United States, and at least 18 years old (Terms §1 and §3);
- finish Stripe Connect onboarding and keep your connected account in good standing;
- give us the information the INFORM Consumers Act requires, when it applies to you (section 16);
- accept this agreement and the Shop policies.

3.2 **Stripe onboarding.** Stripe collects and checks your identity, business details, tax ID and bank account. We never see or store your full bank account number. Stripe's own terms, including the Stripe Connected Account Agreement, apply between you and Stripe. `[Needs professional review]` Confirm the exact Stripe agreement that applies to Express connected accounts and link it here.

3.3 **Ownership labels have nothing to do with selling.** Selling in Shop is open to any business listed on BLACQList that meets section 3.1, whatever its ownership label. Your ownership label or description is self-described. We do not check it. No fee, payout, hold, review step or other selling term depends on it. You must not describe a product as "verified Black-owned", or say that BLACQList has checked or certified who owns your business. See section 10.4.

3.4 **If your plan lapses.** If your page drops below Growth, or your plan ends, your products are hidden from Shop, as Terms §13.6 already says for products. New orders stop. You must still ship, refund and support every order already placed, and sections 6 to 8 keep applying to those orders.

3.5 We may decline a seller application, or ask for more information, at our discretion, for reasons that do not depend on race, ownership label or any other protected trait. `[Needs professional review]`

### 4. Your role and ours

4.1 **You are the seller.** You are the seller of record for every product you sell in Shop. The contract of sale is between you and the shopper. You set your prices, shipping, return policy and stock. You pack and ship physical products, or supply the digital file.

4.2 **We run the marketplace.** We provide the Shop pages, the cart, checkout, payment collection through Stripe, buyer support and buyer protection, and we collect and pay sales tax where section 9 says so. We are not the seller of your products, and we do not take ownership of them.

4.3 **We collect payment for you, as your limited agent.** You appoint BLACQList as your limited agent to accept payment from shoppers for your products. When a shopper pays us for your order, that payment counts as payment to you, and the shopper's debt to you for that order is settled, even if we have not yet transferred the money to you. We then owe you the transfer amount set out in section 5 and `fees-and-payouts.md`, when section 6 says it is due. `[Needs professional review]` This agent-of-the-payee wording is meant to keep BLACQList out of state money transmitter licensing. Counsel must confirm it works under separate charges and transfers in the states we sell into, and whether any state needs more. See `counsel-and-cpa-packet.md`.

4.4 **What shows on the shopper's card statement.** Because one checkout can include several sellers, the card charge is made by BLACQList. Our name appears on the shopper's statement, not yours. `[Needs professional review]` This makes us the merchant of record for card network purposes, even though you are the seller of record. Counsel to confirm how that fits with 4.1 and 4.3.

4.5 **Checkout stays on BLACQList.** Shoppers buy your Shop products on BLACQList only. Do not link shoppers from a product to your own site or another checkout, and do not ask a shopper you met through Shop to pay you outside Shop for that product. Your business page can still link to your website, as it does today.

### 5. Fees

5.1 **Our fee.** We charge a fee of 8% of the order value: the items plus the shipping you charge, before sales tax. We do not charge the fee on sales tax. `[Needs professional review]` The fee base is for the CPA to confirm. See `fees-and-payouts.md`.

5.2 **Card processing.** Stripe charges us a processing fee on each checkout, currently about 2.9% plus 30 cents for US cards `[Assumption]`. We pass that fee on to sellers. Each seller in a checkout pays a share of the actual Stripe fee in proportion to its part of the total charge. The method and rounding rule are in `fees-and-payouts.md`.

5.3 **Your plan is separate.** Your Growth or higher plan is billed under Terms §13. The Shop fee is in addition to your plan.

5.4 **Fees on refunds.** If an order is fully or partly refunded, we credit back our 8% fee on the refunded amount. Stripe does not return its processing fee when a payment is refunded, so your share of that fee is not credited back. `[Assumption]` Founder to confirm.

5.5 **Dispute fees.** If a shopper's bank opens a chargeback on your order, Stripe charges a dispute fee, currently $15 `[Assumption]`. You pay it unless the chargeback is decided in your favour or was caused by our error.

5.6 **Changing fees.** We may change our fees by giving you at least 30 days' email notice `[Assumption]`. A change does not apply to orders placed before it takes effect.

### 6. Transfers and payouts

6.1 **What you receive.** For each order, we transfer to your connected account the order value, less our fee and your share of the Stripe fee. We keep the sales tax to pay it to the states where section 9 applies.

6.2 **When transfers are made.**

- **Physical orders:** when you mark the order shipped with a valid tracking number. If you are a new seller, we hold the transfer a further 7 days. `[Assumption]` "New seller" means your first 90 days of selling or your first 10 shipped orders, whichever ends later.
- **Digital orders:** 3 days after the purchase.

6.3 **Payout to your bank.** Once a transfer reaches your connected account, Stripe pays your available balance out to your bank once a week, on a weekday we set and show on your dashboard. Bank processing times and Stripe's own payout rules apply. `[Needs professional review]` Weekly schedule chosen by the founder on 2026-11-15, mainly as a buffer for refunds and disputes. `[Assumption]` Sellers cannot change the schedule in the Express Dashboard; confirm in test mode (ticket 224).

6.4 **Freezes.** While a shopper has an open buyer case, or a chargeback is open, on any of your orders, we freeze your pending transfers until it is resolved. `[Assumption]` The founder's rule freezes every pending transfer of that seller. A narrower rule, freezing only the amount in dispute plus a margin, would be fairer and easier to defend. Founder and counsel to choose.

6.5 **Reserves.** We may hold back part of your pending transfers for a set time if we see a high rate of buyer cases, chargebacks, late shipments or strikes, or if we suspend you. We will tell you why, how much, and for how long. `[Needs professional review]`

6.6 **Unclaimed money.** If we cannot transfer money to you because your connected account is closed or restricted, we will hold it and try to reach you. Money we still cannot pay will be handled as state unclaimed property law requires. `[Needs professional review]`

### 7. Refunds and buyer protection

7.1 You must offer at least the platform minimum in `returns-refunds-buyer-protection.md`. In short: a shopper can always get a refund for a product that is defective, damaged, the wrong item, not received, or not as described.

7.2 You may offer more through your own return policy, which shows on your product pages and at checkout. You must honour it.

7.3 You have 3 business days to respond to a buyer case. If you do not respond, or you and the shopper do not settle it, we decide. Our decision on a buyer case is final as between you and us for that case. `[Needs professional review]`

7.4 We may refund a shopper before we have heard from you where the policy allows it, such as an order not shipped by the auto-cancel date.

### 8. Chargebacks, recovery and negative balances

8.1 We handle refunds and chargebacks with shoppers and their banks. You must give us the evidence we ask for, such as tracking, delivery proof, photos and messages, within 3 business days.

8.2 If we refund a shopper, or lose a chargeback, on your order, you owe us the refunded amount, less any part we decide was our fault, plus any dispute fee under 5.5.

8.3 **How we recover what you owe,** in this order where possible:

1. reversing all or part of the transfer for that order;
2. taking it from your pending or future transfers;
3. if Stripe allows, debiting your connected account balance;
4. sending you an invoice, payable within 14 days `[Assumption]`.

8.4 **Negative balances.** If your connected account balance goes below zero, you must bring it back to zero. We may pause your selling until you do. Under Stripe Express, BLACQList is liable to Stripe for negative balances it cannot recover, so we may use any lawful means to collect, including a collections agency. `[Needs professional review]`

8.5 You authorise us to make the reversals and offsets in 8.3 without asking you each time. `[Needs professional review]` Confirm this authorisation, and any debit of a connected account, meets Stripe's rules and NACHA rules if a bank debit is used.

### 9. Taxes

9.1 **We collect sales tax as marketplace facilitator.** In each state where BLACQList is registered as a marketplace facilitator, we work out sales tax at checkout using Stripe Tax, charge it to the shopper, and pay it to the state. Do not charge shoppers sales tax yourself on Shop orders.

9.2 **States where we are not registered.** We decide, with our CPA, when to register in each state. Until we are registered in a state, we do not collect tax on Shop sales to that state. If you owe tax on those sales under that state's law, you are responsible for it. `[Needs professional review]` CPA to confirm how facilitator thresholds count sales and what sellers must do in the meantime.

9.3 **Income tax and 1099-K.** You are responsible for your own income taxes. Stripe collects your tax details and sends you a Form 1099-K when the law requires it. `[Needs professional review]` CPA to confirm who is the filer of record for 1099-K under separate charges and transfers, and the thresholds for 2026.

9.4 **Product tax codes.** You must choose the right product type for each product so Stripe Tax can apply the right rules. We may correct it.

### 10. Listing standards

10.1 **Accurate listings.** Your product title, description, price, variants, materials, size, ingredients, warnings, shipping and return terms must be true and complete. Do not leave out facts a shopper would need, such as that a product is used, refurbished or made to order.

10.2 **Prices.** Show the price you will actually charge. Do not inflate a "was" price to suggest a discount that did not happen.

10.3 **Photos of physical products.** You may only show physical products with real photos of the actual item, uploaded by you. AI-generated or AI-altered product images are not allowed. You confirm this for each photo when you upload it. The full rule, what edits are allowed, how we check, and the strike ladder are in `product-photo-policy.md`.

10.4 **Ownership claims.** You may describe your business in your own words, within Terms §4. You must not say, on a product or anywhere in Shop, that a product or business is "verified", "confirmed" or "certified" Black-owned, or that BLACQList has checked ownership.

10.5 **Health, safety and legal claims.** No disease, cure or treatment claims. No claims you cannot back up. Follow the rules for restricted items.

10.6 **No reviews in v1.** Shop has no product reviews yet. Do not put shopper reviews, ratings or testimonials in product descriptions. If we add reviews later, the FTC rule on fake reviews and testimonials, 16 CFR Part 465, will apply, and we will add terms for it.

### 11. Stock

11.1 Keep your stock count accurate. When stock reaches zero, the product is hidden from Shop on its own and returns when you add stock.

11.2 If you sell something you cannot supply, you must cancel and refund the order promptly. Repeated overselling is a ground for a strike.

### 12. Shipping

12.1 You set a shipping profile: a flat rate, a rate for each extra item, an optional free-shipping threshold, and a processing time of 1 to 10 business days. In v1 you ship to the 50 US states and the District of Columbia only.

12.2 **You must ship within your stated processing time.** This is a promise to the shopper under the FTC Mail, Internet, or Telephone Order Merchandise Rule (16 CFR Part 435). You must have a reasonable basis for the time you state.

12.3 **Delays and cancellation.** The ship-by date is the order date plus your processing time. `[Needs professional review]` This timing is set to meet the Rule's requirement that the delay notice goes out before the promised date passes:

- **1 business day before the ship-by date,** we remind you to ship, or to set a revised date.
- **If you set a revised date before the ship-by date,** the shopper gets a delay notice at once, with the option "Cancel for a full refund".
- **If the ship-by date passes, the order is unshipped and no notice was sent,** the delay notice goes to the shopper automatically that day.
- **7 days after the ship-by date, if your part of the order is still unshipped,** it is cancelled and refunded automatically, and you lose the sale. This is stricter than the Rule's 30-day implied consent, on purpose, to protect shoppers.

Full details are in `shipping-and-delivery-policy.md`. Late shipping counts toward strikes (section 21).

12.4 **Tracking.** You must add a valid tracking number to mark an order shipped.

12.5 **Loss and damage in transit.** Products are your responsibility until delivered. If a product is lost or damaged in transit, you refund or replace it, and you deal with the carrier.

12.6 You must not ship a product into a state where it is illegal to sell or ship it.

### 13. Returns

13.1 Your return policy must meet the platform minimum in section 7.1. You choose anything above it, such as change-of-mind returns and who pays return shipping for them.

13.2 You pay return shipping for products that are defective, damaged, wrong or not as described.

### 14. Digital products

14.1 You upload the file to us. We store it privately and deliver it through time-limited download links: each link lasts 15 minutes, and a purchase allows 5 downloads.

14.2 The shopper gets a personal, non-transferable licence, unless your product page states a wider one. You must not sell a file you do not have the right to sell.

14.3 If the product itself is AI-generated content, you must say so using the disclosure in `digital-products-policy.md`. `[Needs professional review]`

14.4 Refunds for digital products follow `digital-products-policy.md`.

### 15. Prohibited and restricted items

15.1 You must not list anything in the prohibited list in `prohibited-and-restricted-items.md`.

15.2 You may list restricted items (food, cosmetics, children's products, supplements) only if you meet the extra conditions in that policy and confirm it when you list.

15.3 We may remove any product we think breaks the policy, and hold related transfers while we look into it.

### 16. INFORM Consumers Act

16.1 If you become a high-volume third-party seller under the INFORM Consumers Act (15 U.S.C. 45f), you must give us, within 10 days of our request, your bank account details, your tax ID, and your contact details, as set out in `inform-act-compliance.md`. Some of this can come from Stripe.

16.2 You must certify once a year that your information is current, and tell us within 10 days if it changes.

16.3 If you reach $20,000 or more in annual gross revenue in Shop, we must show your name, address and contact details on your product pages or order confirmations, with the limited exceptions in the Act.

16.4 If you do not give or certify the information on time, we will suspend your selling until you do.

### 17. Your content and intellectual property

17.1 **What you promise.** You own, or have permission to use, everything in your listings, including photos, text, logos, designs and digital files. Your products and listings do not infringe anyone's copyright, trademark, patent, design, publicity or other rights. Your products are not counterfeit.

17.2 **Licence to us.** You give us the licence in Terms §6 for your Shop content, and also the right to show your products, photos and prices in Shop, in Cue answers, in search results, in emails to shoppers, and in BLACQList marketing for Shop. You keep ownership (Terms §9). `[Needs professional review]` Confirm whether the marketing use needs a separate opt-out.

17.3 **Takedowns.** We follow `ip-and-counterfeit-takedown.md`. We may remove listings, and end the selling of repeat infringers.

### 18. Indemnity

You will defend and indemnify BLACQList, and its officers, employees and agents, against claims, losses, fines and costs, including reasonable legal fees, that come from:

- your products, including injury, illness, property damage, recalls and labelling;
- your listings, photos and digital files, including IP claims;
- your breach of this agreement or the law, including tax, consumer protection, product safety and privacy law;
- your use of shopper data.

We will tell you promptly about a claim, let you control the defence with counsel we reasonably accept, and help at your cost. You may not settle a claim that admits fault for us or binds us without our written consent. `[Needs professional review]`

### 19. Product safety, recalls and insurance

19.1 Your products must be safe and must meet every law that applies to them, including federal and state product safety, labelling and food and cosmetic rules.

19.2 If a product is recalled, or you learn it may be unsafe, you must stop selling it at once, tell us within 2 business days, and handle the recall. Recalled goods are prohibited.

19.3 **Insurance.** We expect you to carry general liability insurance that covers products, of at least $1,000,000 per occurrence `[Assumption]`. For restricted items, it is required, and we may ask for a certificate. We may later require BLACQList to be named as an additional insured once you pass a sales level we set. `[Needs professional review]` Limits and triggers for counsel and a broker.

### 20. Shopper data

20.1 For each order we give you the shopper's name, shipping address, email and what they ordered. You may use it only to fulfil the order, give customer service, handle returns and buyer cases, and meet your legal and tax duties.

20.2 You must not use it to market to the shopper, add them to a mailing list, or share it, unless the shopper has separately opted in to hear from you. `[Assumption]` v1 has no opt-in, so in v1 no marketing is allowed.

20.3 You must keep it secure, limit who sees it, and delete it when you no longer need it for 20.1. You may keep order records as long as tax and accounting law requires.

20.4 If you have a data breach involving shopper data, tell us within 72 hours `[Assumption]` and help us respond.

20.5 You must help us answer a shopper's privacy request about their order data, within 10 days of our asking. `[Needs professional review]` Whether sellers are separate businesses, service providers or third parties under CCPA and other state laws decides what this clause must say.

### 21. Strikes, suspension and termination

21.1 **Strikes.** We give a strike when we uphold a report or finding that you broke a Shop policy, such as the photo rule, a prohibited item, repeated overselling or late shipping, or misuse of shopper data. Three strikes in any 12 months `[Assumption]` suspend your selling.

21.2 **Immediate suspension.** We may suspend your selling at once, without strikes, for fraud, counterfeit or stolen goods, unsafe or recalled products, a serious legal risk, an INFORM failure, or a request from Stripe or a regulator.

21.3 **Appeals.** You can appeal a strike or suspension within 14 days `[Assumption]` by replying to our notice. We will review it and reply.

21.4 **What happens when you are suspended.** Your products are hidden. You must still ship, refund and support orders already placed. We may hold your pending transfers for up to 90 days `[Assumption]` after your last order to cover refunds and chargebacks.

21.5 **Ending this agreement.** You may stop selling at any time by removing your products and finishing your open orders. We may end this agreement with 30 days' notice, or at once for a serious breach. Terms §12 also applies.

21.6 **What survives.** Sections 5 to 9, 12 to 14 for orders already placed, 17 to 20, 22 and 23 survive.

### 22. Disclaimers and limitation of liability

22.1 Terms §10 and §11 apply to Shop, as amended by the proposed change in `buyer-terms.md`.

22.2 We do not promise any level of sales, traffic or ranking. We may change how Shop works, ranks or looks.

22.3 To the extent the law allows, our total liability to you under this agreement is limited to the fees you paid us under section 5 in the 12 months before the claim, plus any transfer amounts we owe you and have not paid. `[Needs professional review]` This differs from Terms §11, which caps liability at the greater of $100 or what you paid us in 12 months. For a seller, "what you paid us" is unclear once we collect money on your behalf.

### 23. Disputes between you and us

23.1 This agreement is governed by the laws of the United States and the state of Georgia, without regard to conflict of law rules, matching Terms §14.

23.2 Disputes go to the state and federal courts located in Georgia, matching Terms §14.

23.3 `{Placeholder: arbitration and class action waiver}`. The live Terms have no arbitration clause or class action waiver. If counsel adds one to the Terms, the same clause should go here, with any changes needed for business-to-business disputes. `[Needs professional review]`

### 24. Changes to this agreement

We may change this agreement or the Shop policies. We will email you at least 14 days before a material change takes effect, matching Terms §15, or 30 days for a fee change (5.6). If you keep selling after a change takes effect, you accept it. If you do not agree, stop selling before it takes effect. Changes do not apply to orders already placed.

### 25. Notices

25.1 We send notices to the email on your account and show them in your dashboard. Keep your email current.

25.2 You send notices to legal@theblacqlist.com, or by mail to `{Notice address, currently the mailing address in Terms §16}`.

### 26. General

26.1 You and we are independent businesses. This agreement does not create a partnership, joint venture or employment. You are not our agent, except that we are your limited agent for payment collection under 4.3.

26.2 You may not transfer this agreement without our written consent. We may transfer it to a successor of our business.

26.3 If part of this agreement is unenforceable, the rest stays in force.

26.4 This agreement, the Terms of Service, the Privacy Policy and the Shop policies are the whole agreement about selling in Shop.

---

## Review notes

| # | Point | Where | Rating |
|---|---|---|---|
| S1 | Agent-of-payee appointment and state money transmitter exposure under separate charges and transfers, where funds sit in BLACQList's Stripe balance for days or weeks | 4.3, 6 | High. Consult attorney |
| S2 | BLACQList is merchant of record on the card statement while the vendor is seller of record. Separate charges and transfers cannot use `on_behalf_of` for a multi-seller charge | 4.4 | High. Consult attorney |
| S3 | Freeze scope: every pending transfer or only the disputed amount | 6.4 | Medium. Founder decision |
| S4 | Express negative balance liability falls on BLACQList. Recovery terms must be enforceable | 8.4, 8.5 | High. Consult attorney |
| S5 | Who must collect tax in states where BLACQList is not yet registered | 9.2 | High. CPA |
| S6 | Seller liability cap differs from Terms §11 | 22.3 | Medium. Consult attorney |
| S7 | Dispute clause mirrors Terms §14. No arbitration exists today | 23 | Medium. Consult attorney |
| S8 | Assumed numbers: new-seller definition, invoice terms, insurance limit, strike window, appeal window, hold period, breach notice, fee-change notice | throughout | Founder decision |
| S9 | CCPA role of sellers receiving shopper data | 20.5 | Medium. Consult attorney |
