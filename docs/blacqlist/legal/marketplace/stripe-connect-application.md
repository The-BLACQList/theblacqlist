# Stripe Connect Application: Prep Sheet

> **Disclaimer:** This output is informational and does not constitute legal advice. Consult a licensed attorney and CPA before relying on it.

**Status:** Connect set up by the founder on 2026-11-15 (live account; industry "E-commerce products"; Stripe-hosted onboarding; Connect branding set). Stripe's sign-up asked only those questions, with no volume, timeline or restricted-category screens and no application review. Sections 2 to 7 stay as the reference answers for when Stripe asks: platform profile, a risk review once live accounts exist, or Support. Per-account settings (Express dashboard, `fees_collector`/`losses_collector` = application, Stripe-collected requirements) are set in code by ticket 224 when each seller account is created, not in this form.
**Last updated:** 2026-11-15
**Who submits:** the founder, in the Stripe Dashboard, on the live platform account (GATE-SPEND: it starts Connect pricing once accounts are active).
**Source of the answers:** the 2026-11-13 Shop decisions, `fees-and-payouts.md`, `seller-agreement.md`, `prohibited-and-restricted-items.md`, `inform-act-compliance.md`, `returns-refunds-buyer-protection.md`.
**Checked against Stripe docs on 2026-11-14:** Build a marketplace, Marketplace essential tasks, Separate charges and transfers (Checkout), Pay out to connected accounts. Stripe's own form may word questions differently. Answer in the form's words, using the substance below.

---

## Fill these in first: `[Founder]` blanks (B1 and B3 done 2026-11-14)

| # | Blank | Where it goes |
|---|---|---|
| B1 | ✅ The BLACQList, LLC (single-member LLC). The Stripe account was switched from sole proprietor on 2026-11-14; the EIN is on file in Stripe, not here | Business details |
| B2 | Expected Shop volume in the first 12 months: number of sellers, orders a month, average order value | Platform profile, volume questions |
| B3 | ✅ Support phone on file in Stripe Public details (2026-11-14). Also needed for INFORM and the Seller Agreement | Public details and platform profile |
| B4 | When you expect the first real-money order. Suggested answer: "after our CPA and attorney sign off, target Q1 2027" | Platform profile, timeline |
| B5 | Whether you want supplements open at launch. Suggested answer: no, not at launch (see section 6) | Restricted business questions |

---

## 1. Before you start (Stripe's "Before you begin" list)

1. **Register the platform:** Dashboard → Connect → Get started.
2. **Verify business details:** already done on the account for Plans; check nothing changed.
3. **Complete the platform profile:** Connect → Settings → Platform profile. Use sections 2 to 7 below.
4. **Branding:** Connect → Settings → Branding.
   - Business name "BLACQList".
   - Icon: the gold mark.
   - Brand colour: the site's amber.
   - This is what sellers see in Stripe onboarding and the Express Dashboard.

## 2. What the business is

**One-line description:**
> BLACQList is a US online directory that centers Black-owned businesses and also lists Ally businesses. We are adding Shop, a marketplace where shoppers buy physical and digital products from many independent sellers in one cart, with one payment.

**Platform type:** Marketplace.

**Who the connected accounts are:**
> US small businesses that already list on BLACQList and are on our Growth plan or higher. Each one is approved by us before they can sell. Individuals without a business listing cannot sell.

**What they sell:**
> New physical consumer goods (for example candles, apparel, art prints, beauty and home goods, packaged food under state cottage-food rules) and digital products (e-books, templates, music, art files). No services are sold through checkout. Services stay as listings that link out to the business.

**Countries and currency:** US platform, US sellers only, US shoppers, USD only. No cross-border transfers.

**Website:** `https://theblacqlist.com`. Terms: `https://theblacqlist.com/terms`. Privacy: `https://theblacqlist.com/privacy`.
`[Assumption]` Stripe may want to see Shop live before approval. Shop is behind a closed feature switch until counsel signs off. If they ask, offer a test-mode walkthrough or screenshots.

**Support contact:** `hello@theblacqlist.com` (founder, 2026-11-14), `https://theblacqlist.com/contact`, the phone in B3, and the mailing address published in Terms §14.

## 3. How money moves

**Charge type:** separate charges and transfers.
> One cart can hold products from several sellers, so the shopper pays one charge to the BLACQList platform account. We then transfer each seller's share to their connected account.

**Account configuration** (the marketplace defaults in Stripe's quickstart):

| Setting | Value | Meaning |
|---|---|---|
| Dashboard | Express | Sellers see their balance and payouts in Stripe's Express Dashboard; they manage their own bank details |
| `fees_collector` | `application` | BLACQList pays Stripe's fees and recovers them from sellers through the split |
| `losses_collector` | `application` | BLACQList is liable to Stripe for refunds, disputes and negative balances it cannot recover from sellers |
| Requirement collection | Stripe | Stripe-hosted onboarding does identity, business and bank checks (KYC). BLACQList never holds bank details |
| `on_behalf_of` | Not used | A multi-seller charge cannot name one seller, so BLACQList is the business of record on the charge |

**Statement descriptor:** `BLACQLIST` with suffix `SHOP`, so shoppers see **BLACQLIST* SHOP**. Plan subscriptions use the suffix `PLAN`.

**Our fee:**
> 8% of each seller's items plus shipping, before sales tax, kept from the transfer. Stripe's processing fee on the charge is shared among the sellers in the cart, pro rata, and also deducted from transfers. BLACQList pays Connect account and payout fees.

**When sellers get paid:**

| Order type | Transfer made |
|---|---|
| Physical | When the seller marks it shipped with a valid tracking number |
| Physical, new seller (first 90 days or first 10 shipped orders) | 7 days after it is marked shipped |
| Digital | 3 days after purchase |
| Open buyer case or chargeback | Frozen until resolved |

Payouts then go from the seller's Stripe balance to their bank once a week on Mondays (founder, 2026-11-15), set per account by ticket 224.

`[Needs professional review]` If Stripe asks how long funds can stay in the platform balance before transfer, say "normally under 30 days, from purchase to ship plus any hold". Confirm the number with Stripe if the form gives a limit.

## 4. Refunds, disputes and losses

> BLACQList runs buyer protection. If an item never arrives, or arrives damaged, defective, wrong or not as described, the shopper opens a case with us. We refund the shopper first from the platform balance, then recover the money from the seller. We recover it in this order:
> 1. Reversing the transfer.
> 2. Offsetting against the seller's future transfers.
> 3. Invoicing the seller.
>
> We respond to chargebacks ourselves using the seller's tracking and delivery evidence. Sellers whose case or chargeback rates are high get reserves on pending transfers, suspension, and strikes, and three strikes means removal.

**Risk controls to mention:**
- Every seller is a known directory business we have approved.
- The founder personally reviews each seller's first 3 products, then spot checks.
- Physical products may only use real photos, with a provenance check.
- Holds for new sellers.
- Radar on all charges.
- Transfers are tied to the charge (`source_transaction`), so funds go to a seller only after the charge settles.

`[Needs professional review]` Stripe only lets a transfer be reversed while the seller's available balance covers it, unless connected reserves are on. Weekly payouts leave a few days in which a transfer can still be reversed, but after the weekly payout recovery falls to offset or invoice. Ask Stripe at review whether **connected reserves** can be enabled for the platform.

## 5. Compliance

- **Sales tax:** BLACQList collects and remits as marketplace facilitator using Stripe Tax.
- **1099-K:** Stripe files for Express accounts. `[Needs professional review]` The CPA confirms (fees F4).
- **INFORM Consumers Act:**
  - We track high-volume sellers: 200 or more sales and $5,000 or more in any 12 months.
  - We collect and verify their information within 10 days, recertify it every year, and show seller details to shoppers at $20,000 and over.
  - We rely on Stripe-held bank and tax ID details where the Act allows.
- **IP:** we have a registered DMCA agent (DMCA-1074879) and counterfeit takedown and repeat-infringer policies.
- **Digital goods:** we scan uploads for malware before sale (go-live gate, ticket 229).

## 6. Restricted and prohibited products

> Sellers may not list:
> - weapons and parts;
> - drugs, CBD, hemp and kratom;
> - alcohol;
> - tobacco and vape;
> - adult content and products;
> - live animals;
> - recalled goods;
> - counterfeit or stolen goods;
> - gift cards, stored value and crypto;
> - hazardous materials;
> - anything illegal in the shopper's state;
> - anything on Stripe's prohibited list.
>
> Food, cosmetics, children's products and supplements are restricted: the seller must meet listed legal conditions, and the first listing in each restricted category is reviewed by us.

**If the form asks about restricted categories:**
- Tick **food** (cottage-food rules, in-state shipping where the law requires it) and **cosmetics**.
- For supplements, use B5. Suggested answer: not at launch. Stripe treats some supplements as restricted, and turning them on later is easier than unwinding them.

## 7. Before you press Submit

- [ ] All five `[Founder]` blanks filled. B2, B4 and B5 are still open.
- [ ] Stripe Account status shows no open Tasks after the LLC switch.
- [ ] Your attorney has glanced at the role wording: "sellers are the sellers of record; BLACQList collects payment as their limited payment collection agent and is the business of record on the card charge". This is counsel item A1/A2 and seller agreement S2.
  - Submitting does not need to wait for the full legal review. Real money waits; the application does not.
- [ ] Test mode stays as it is. Connect test mode needs no approval, so build tickets 224 to 226 do not wait on this.
- [ ] After you submit: note the date in the ops-log, so the 2 to 4 week clock is visible.
