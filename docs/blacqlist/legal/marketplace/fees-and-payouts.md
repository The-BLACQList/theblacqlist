# Fees and Payouts

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** the CPA first, then counsel and the founder. Sellers once approved. Whoever builds the checkout split and transfer jobs.
**Depends on:** `seller-agreement.md` (sections 4 to 9), `shipping-and-delivery-policy.md`, `digital-products-policy.md`, `returns-refunds-buyer-protection.md`.

---

## 1. How the money moves

Stripe Connect, separate charges and transfers:

1. The shopper pays one charge to BLACQList's Stripe account for the whole cart, many shops included. BLACQList accepts it as each seller's limited payment collection agent (Seller Agreement 4.3).
2. Stripe takes its processing fee from that charge.
3. For each seller's order, BLACQList sends a transfer to the seller's Stripe Express connected account when the order qualifies (section 4).
4. Stripe pays the seller's bank on the seller's payout schedule.
5. BLACQList keeps its 8% fee and holds the sales tax to pay to the states where it is registered.

Stripe does identity and business checks (KYC) and holds bank details. BLACQList never holds bank details. `[Needs professional review]` Whether Stripe or BLACQList is the 1099-K filer of record under this model.

## 2. Fees

| Fee | Amount | Base | Who pays |
|---|---|---|---|
| BLACQList fee | 8% | Items plus shipping charged to the shopper, before sales tax | Seller, deducted from the transfer |
| Stripe processing | About 2.9% plus 30 cents per charge `[Assumption: standard US card pricing]` | The whole charge | Sellers, shared pro rata, deducted from transfers |
| Stripe dispute fee | $15 per chargeback `[Assumption]` | Per dispute | Seller, unless the dispute is won or was our error |
| Stripe Connect account and payout fees | Per Stripe pricing for Express accounts `[Assumption]` | Per active account and per payout | BLACQList |
| Plan subscription | Per Terms §13 | Monthly or yearly | Seller, billed separately |

**`[Needs professional review]` Fee base, for the CPA.** The founder chose items plus shipping, excluding tax. The other option is items only. Questions:

- Is the fee on shipping fair to sellers whose shipping only covers carrier cost, and does it change any tax result?
- Does charging the fee on shipping affect whether shipping is taxable in some states?
- Does BLACQList report Shop revenue gross, as the full order, or net, as the fee only? Agent status suggests net.

## 3. Rules for the split

1. **Integer cents.** Every amount is worked in whole cents.
2. **8% fee per seller.** 8% of that seller's items plus shipping, rounded half up to the cent.
3. **Stripe fee.** Use the actual fee on the charge from Stripe's balance transaction, not the formula.
4. **Sharing the Stripe fee.** Each seller's share is the actual Stripe fee times that seller's part of the charge, divided by the whole charge. "That seller's part" is its items, shipping and the tax on them. Round half up per seller.
5. **Remainder to platform.** If the rounded shares add up to less than the actual Stripe fee, BLACQList pays the difference. If they add up to more, BLACQList keeps the extra cent.
6. **Transfer.** Items plus shipping, minus the 8% fee, minus the seller's Stripe fee share. Tax is never transferred.

`[Needs professional review]` Rule 4 means sellers pay processing on the tax part of the charge. The alternative is that BLACQList pays processing on the tax. CPA and founder to choose.

## 4. When transfers happen

| Order type | Transfer made |
|---|---|
| Physical | When the seller marks it shipped with a valid tracking number |
| Physical, new seller | 7 days after it is marked shipped. `[Assumption]` New seller means first 90 days or first 10 shipped orders, whichever ends later |
| Digital | 3 days after purchase |
| Any, with an open buyer case or chargeback for that seller | Frozen until resolved (Seller Agreement 6.4) |

## 5. Worked example: a 2-shop cart

`[Assumption]` Illustrative numbers. The tax rate is a made-up combined rate of 7.000% applied to items and shipping. In real checkouts Stripe Tax sets the rate and decides whether shipping and digital goods are taxable.

**The cart**

- Shop A, physical: 2 candles at 2,400 cents each, plus shipping of 795 cents.
- Shop B, digital: 1 e-book at 1,200 cents.

**Step 1. Order values**

| | Shop A | Shop B |
|---|---|---|
| Items | 2 × 2,400 = 4,800 | 1,200 |
| Shipping | 795 | 0 |
| Order value, the fee base | 4,800 + 795 = 5,595 | 1,200 |

**Step 2. Sales tax at 7.000%, rounded half up**

- Shop A: 5,595 × 0.07 = 391.65, rounds to **392**
- Shop B: 1,200 × 0.07 = 84.00, so **84**
- Tax total: 392 + 84 = **476**

**Step 3. The charge**

- Shop A part: 5,595 + 392 = 5,987
- Shop B part: 1,200 + 84 = 1,284
- Charge to the shopper: 5,987 + 1,284 = **7,271** ($72.71)

**Step 4. Stripe fee**

- 7,271 × 0.029 = 210.859, plus 30 = 240.859
- Stripe's actual fee, as on the balance transaction: **241** `[Assumption]`

**Step 5. BLACQList's 8% fee, rounded half up per seller**

- Shop A: 5,595 × 0.08 = 447.60, rounds to **448**
- Shop B: 1,200 × 0.08 = 96.00, so **96**
- Fee total: **544**

**Step 6. Sharing the Stripe fee pro rata**

- Shop A: 241 × 5,987 ÷ 7,271 = 1,442,867 ÷ 7,271 = 198.44, rounds to **198**
- Shop B: 241 × 1,284 ÷ 7,271 = 309,444 ÷ 7,271 = 42.56, rounds to **43**
- Check: 198 + 43 = 241. Remainder 0.

**Step 7. Transfers**

- Shop A: 5,595 − 448 − 198 = **4,949** ($49.49), sent when Shop A marks it shipped with tracking
- Shop B: 1,200 − 96 − 43 = **1,061** ($10.61), sent 3 days after purchase

**Step 8. Reconciliation**

| Line | Cents |
|---|---|
| Charge | 7,271 |
| Less Stripe fee | −241 |
| Net to BLACQList's balance | 7,030 |
| Less transfer to Shop A | −4,949 |
| Less transfer to Shop B | −1,061 |
| Left with BLACQList | 1,020 |
| Of which: sales tax to remit | 476 |
| Of which: BLACQList fees | 544 |
| Check: 476 + 544 | 1,020 |

BLACQList's fee revenue for this cart is 544 cents. The Connect account and payout fees in section 2 come out of that.

## 6. The remainder rule with three shops

With two shops the rounded shares almost always add up exactly. With three or more they may not. Example: an actual Stripe fee of 100 cents shared by three shops with equal parts.

- Each share: 100 ÷ 3 = 33.33, rounds to 33
- Rounded total: 33 × 3 = 99
- Remainder: 100 − 99 = 1 cent, paid by BLACQList

The other way: an actual fee of 101 cents with exact shares of 33.50, 33.50 and 34.00. Each rounds to 34, the rounded total is 102, and BLACQList keeps the extra 1 cent.

## 7. Refunds and recovery

- **Full refund of Shop A's order after transfer:** the shopper gets 5,987 back: 5,595 for items and shipping, and 392 tax.
  - The 392 tax comes from the tax BLACQList is holding, or is claimed back from the state if already paid.
  - Shop A owes the 5,595 less our fee credit of 448, so 5,147.
  - We reverse the 4,949 transfer and take the other 198 from Shop A's next transfers.
  - Shop A's net result: received 4,949, paid back 5,147, so −198. That is its share of the Stripe fee, which Stripe does not return on refunds.
  - `[Assumption]` Founder to confirm we credit our fee back on refunds.
- **Recovery order:** transfer reversal, then offset against future transfers, then connected account debit if Stripe allows, then invoice (Seller Agreement 8.3).
- **Negative balances** on Express accounts are BLACQList's liability to Stripe if not recovered (Seller Agreement 8.4).

## 8. Questions for the CPA

| # | Question |
|---|---|
| F1 | Fee base: items plus shipping, or items only |
| F2 | Who pays processing on the tax part of the charge |
| F3 | Gross or net revenue reporting for Shop |
| F4 | 1099-K filer of record and 2026 thresholds, federal and state |
| F5 | How to account for held funds owed to sellers, and the rounding remainder |
| F6 | Whether BLACQList's own fee is taxable in any state |
