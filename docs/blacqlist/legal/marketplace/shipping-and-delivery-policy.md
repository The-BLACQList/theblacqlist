# Shipping and Delivery Policy

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** shoppers and sellers once approved. Counsel for the Mail Order Rule timing. Whoever builds shipping profiles, order status and the delay emails.
**Depends on:** `seller-agreement.md` (section 12), `buyer-terms.md` (Part 1 §4), `returns-refunds-buyer-protection.md`, `fees-and-payouts.md` (transfer on ship).

---

## Why this exists

Shop orders are "mail, internet, or telephone orders" under the FTC Mail, Internet, or Telephone Order Merchandise Rule, 16 CFR Part 435. The Rule says a seller must have a reasonable basis to ship in the time it states, and must offer the buyer a delay notice with the right to cancel before that time passes. The seller here is the Shop seller. BLACQList runs the checkout, sends the emails and moves the money, so it takes on the notice and refund mechanics. `[Needs professional review]` Whether BLACQList is also a "seller" under the Rule.

The Rule applies to physical products. Digital products follow `digital-products-policy.md`.

## 1. Where Shop ships

The 50 US states and the District of Columbia. No PO box restrictions unless the seller's carrier needs a street address. `[Assumption]` No US territories, military APO and FPO addresses, or international shipping in v1.

## 2. Shipping profiles

Each seller sets one shipping profile `[Assumption: one per seller in v1]`:

- a flat rate for the first item;
- a rate for each extra item;
- an optional free-shipping threshold, such as free shipping over $50;
- a processing time of 1 to 10 business days.

The shopper sees the shipping cost and processing time on the product page and at checkout, for each seller in the cart.

Shipping charged to the shopper counts toward the 8% fee base. See `fees-and-payouts.md`.

## 3. The ship-by date

The ship-by date for an order is the order date plus the seller's processing time, counted in business days. Business days are Monday to Friday, not counting US federal holidays. `[Assumption]`

The shopper sees an estimate as "Ships by {date}". Copy rule: ranges use "to", for example "Ships in 2 to 4 business days".

## 4. Shipping the order

- The seller must ship by the ship-by date.
- To mark an order shipped, the seller must add a carrier and a valid tracking number. We may check the number is in a valid format and that the carrier shows activity. `[Assumption]`
- The shopper gets a shipped email with tracking.
- Marking shipped starts the seller's transfer, held a further 7 days for new sellers. See `fees-and-payouts.md`.
- Marking an order shipped without really shipping it is a serious breach and can lead to immediate suspension.

## 5. Delays, notices and automatic cancellation

`[Needs professional review]` This timing is built to send the delay notice before the promised date passes, as the Rule requires. Counsel to confirm.

| When | What happens |
|---|---|
| 1 business day before the ship-by date, order not shipped | We remind the seller to ship, or to set a revised date |
| The seller sets a revised date, before the ship-by date | The shopper gets the delay notice at once, with the new date and a "Cancel for a full refund" button |
| The ship-by date passes, the order is unshipped, and no notice was sent | The delay notice goes to the shopper automatically that day, saying the order is late and the seller has not given a new date, with "Cancel for a full refund" |
| 7 days after the ship-by date, that seller's part is still unshipped | That seller's part of the order is cancelled and refunded automatically. Other sellers' parts of the checkout are not affected |

Notes:

- **Stricter than the Rule, on purpose.** The Rule lets a seller treat a buyer's silence as consent to a first delay of up to 30 days. Shop does not. Any order still unshipped 7 days after the ship-by date is cancelled, to protect shoppers.
- **Revised dates.** A revised date can be no later than 7 days after the original ship-by date, because the order cancels then. `[Assumption]` Founder to decide whether a shopper who actively agrees to a longer wait can keep the order. If yes, that consent must be recorded.
- **Cancel button.** A shopper who taps "Cancel for a full refund" gets the refund for that seller's part, including its shipping and tax.
- **Refund timing.** We start the refund to the original card at once. The Rule requires refunds to a card within one billing cycle. Card refunds usually show in 5 to 10 business days.
- **Strikes.** An order cancelled for not shipping counts toward a seller's strikes. `[Assumption]` One strike for every 3 auto-cancels in 90 days, unless caused by something outside the seller's control.

Suggested delay notice copy, following the Shop copy rules:

> Subject: Your order from {Shop name} is running late
>
> {Shop name} hasn't shipped your order yet. They now expect to ship it by {revised date}. You can wait, or cancel this part of your order for a full refund. If it hasn't shipped by {auto-cancel date}, we'll cancel it and refund you.
>
> [Cancel for a full refund]

When no revised date is set, the second sentence becomes: "They haven't given us a new ship date."

## 6. Delivery

- **Expected delivery date.** We estimate it from the ship date and the carrier. `[Assumption]` Where the carrier gives no estimate, we use ship date plus 7 calendar days.
- **Not received.** A shopper can open a "not received" case 7 days after the expected delivery date. See `returns-refunds-buyer-protection.md`.
- **Lost or damaged in transit.** This is the seller's responsibility. The seller refunds or replaces, and deals with the carrier and any shipping insurance.
- **Delivered but not received.** If tracking shows delivery to the address the shopper gave, the case is looked at on the evidence. `[Assumption]` For orders over $250, the seller is protected only if it used signature confirmation.
- **Wrong address.** If the shopper gave a wrong address, the seller is not responsible for loss, but should help if the parcel comes back.

## 7. Items that need special handling

- Perishable food must be declared as cold-ship and sent by a speed that keeps it safe. See `prohibited-and-restricted-items.md`.
- A seller must not ship a product into a state where it is illegal to sell or ship it.
- Carrier rules on hazardous materials apply. Most are prohibited in Shop.

## 8. Review notes

| # | Point | Rating |
|---|---|---|
| SH1 | Delay notice timing and the 7-day auto-cancel against 16 CFR 435.2. Corrected 2026-11-13 so the notice goes out no later than the ship-by date | High. Consult attorney |
| SH2 | Whether BLACQList is itself a "seller" under the Rule because it takes payment and sends notices | Medium. Consult attorney |
| SH3 | Whether ship-by in business days and auto-cancel in calendar days is clear enough for shoppers | Low. Founder |
| SH4 | Assumed numbers: expected delivery fallback, $250 signature threshold, auto-cancel strike rule | Founder decision |
| SH5 | Stripe limits on how long the platform can hold funds before transfer. The longest path is 10 business days processing, plus 7 days, plus the 7-day new-seller hold | Check with Stripe |
