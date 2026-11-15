# INFORM Consumers Act Compliance

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** counsel, the founder, and whoever builds seller onboarding, the yearly certification prompt, product page seller details and the report flow. Sellers see the summary in Seller Agreement section 16.
**Depends on:** `seller-agreement.md` (sections 3, 16, 21), `buyer-terms.md` (Part 1 §8), `privacy-policy-marketplace-addendum.md`, Stripe Connect onboarding data.

---

## 1. What the law is

The INFORM Consumers Act, 15 U.S.C. 45f, in force since June 27, 2023, applies to "online marketplaces" that let third-party sellers sell consumer products to US consumers. Shop is one. `[Needs professional review]` The FTC and state attorneys general enforce it, with civil penalties.

The statute uses the word "verify". Internally we follow it. In Shop UI, the copy rule still applies: never call a seller "verified".

## 2. Who is a high-volume third-party seller

A seller is a high-volume third-party seller (HVTPS) if, in any continuous 12-month period in the last 24 months, it made in Shop:

- **200 or more** discrete sales or transactions of new or unused consumer products, **and**
- **$5,000 or more** in gross revenue from them.

Only sales paid through Shop count. `[Needs professional review]` "Consumer products" likely means physical goods. Whether digital products count toward the thresholds. This draft counts physical orders only, and recommends counting both if counsel is unsure, since over-collecting is the safer error.

**How we track it:** a daily job counts each seller's physical sales and gross revenue over every rolling 12-month window in the last 24 months. When a seller crosses both thresholds, the steps in section 3 start. `[Assumption]` We also prompt at 150 sales or $4,000, so sellers can prepare.

## 3. What we collect, and when

Within 10 days of a seller becoming an HVTPS, we must collect:

| Item | What it is | Where it comes from |
|---|---|---|
| Bank account | Account and routing details, or the account holder name | Stripe holds it from Connect onboarding. `[Needs professional review]` The Act lets a marketplace rely on a payment processor that holds this, if the marketplace can get it promptly on request. Confirm Stripe's Express data and BLACQList's access meet this |
| Contact information | If an individual: their name. If a business: a copy of a government ID for a person acting for the business, or a government record or tax document showing the business name and physical address | Seller upload in the dashboard, or Stripe KYC data if counsel confirms it can be used |
| Tax ID | The business tax ID, or if none, a taxpayer ID | Stripe holds it. Same question as bank account |
| Working email and phone | A current email address and phone number | Seller dashboard |

**Checking the information.** We must verify it within 10 days of collecting it. A government-issued tax document counts as verified. For other items, we check names match across Stripe, the documents and the account. `[Needs professional review]` What checking is enough.

## 4. Yearly certification

At least once a year we ask each HVTPS to confirm, in the dashboard, that its information is current, or to update it. Suggested prompt copy:

> "Once a year we need you to check your seller details. Please confirm they're current, or update them."

The seller must also tell us of any change within 10 days.

## 5. Suspension

If a seller does not give, or certify, the information within 10 days of our notice, we suspend its future sales in Shop until it does. Suspension hides its products. Open orders must still be shipped and supported. Payouts for those orders continue, subject to the usual holds.

This is an automatic suspension, not a strike.

## 6. Seller details shown to shoppers: $20,000 and over

If an HVTPS has **$20,000 or more** in annual gross revenue in Shop, we must show, clearly, on its product pages, or in the order confirmation and the shopper's order history:

- the seller's full name, which may differ from its shop name;
- the seller's physical address;
- contact details: a phone number and email, or another way to contact the seller directly;
- whether a different seller supplied the product, and if so, that seller's details on request.

`[Assumption]` We show these on the product page, in a "Seller details" section, since that is the clearest place.

**Allowed exceptions, if the seller certifies them:**

- No business address, only a home address, or a combined home and business address: we show the country and state, not the full address.
- No business phone, only a personal phone: we show email or messaging contact, not the phone.

If we learn that a certification is false, or the seller is not responding to shoppers within a reasonable time, we must require full disclosure within a short deadline, and suspend the seller if it does not comply. `[Needs professional review]` Confirm the exact deadline and process.

## 7. Reporting suspicious activity

The Act requires a clear way for shoppers to report suspicious activity, electronically and by phone, on HVTPS product pages. We will put it on each product page:

- A "Report this item" link on each product page, opening a form: counterfeit, stolen, unsafe or recalled, fraud, photo not real, prohibited item, or something else.
- A phone number for reports: `{Phone number for INFORM reporting}`.

`[Needs professional review]` BLACQList has no published phone number today. The Act requires telephonic reporting. A voicemail line that is checked each business day may be enough. Counsel to confirm.

Reports go to the founder's review queue. Upheld reports can lead to strikes or suspension under the Seller Agreement.

## 8. Data security and limits on use

- INFORM data is stored securely, with access limited to the founder and named staff.
- Data collected only to comply with the Act is not used for anything else, unless the law requires.
- `[Assumption]` We keep it while the seller sells in Shop and for 3 years after, then delete it.
- ID documents uploaded to us go in private storage and are deleted once checked, keeping only a record that they were checked. `[Assumption]`

## 9. Records we keep

For each HVTPS: when it crossed the thresholds, when we asked, when it provided, how we checked it, each yearly certification, and any suspension.

## 10. Review notes

| # | Point | Rating |
|---|---|---|
| I1 | Whether relying on Stripe-held bank and tax data meets the collection duty | High. Consult attorney |
| I2 | Phone reporting line. None exists today | High. Founder to set up |
| I3 | Whether digital sales count toward the thresholds | Medium. Consult attorney |
| I4 | Display location and wording of seller details for $20,000 sellers | Medium. Consult attorney |
| I5 | Retention period and ID document handling | Medium. Consult attorney |
| I6 | Privacy policy must say we collect this data and publish seller details. See `privacy-policy-marketplace-addendum.md` | Medium |
