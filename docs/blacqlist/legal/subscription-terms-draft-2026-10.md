# Subscriptions, renewal, cancellation and refunds: draft for counsel

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Part 1 POSTED as Terms section 13 (#262), effective on posting, on the founder's word on 2026-10-29. Counsel review to follow. Parts 2 and 3 are tracked in tickets 144 and 145.

**Founder decision, 2026-10-29:** post section 13 effective on posting for everyone, with no advance email to owners already on a paid plan. The Terms (Changes to Terms) promise registered users 14 days' email notice of material changes, so this is an open question for counsel (L11 below).
**Audience:** the founder and BLACQList's attorney.
**Written by:** Legal agent, 2026-10-28, as part of ticket 143 (Growth on sale).
**Last updated:** 2026-10-29

---

## Why this exists

Starter ($19/mo, $182/yr) can already be bought, and Growth ($49/mo, $470/yr) is next. The live Terms (`app/(public)/terms/TermsOfService.tsx`, sections 1 to 15) say nothing about paid plans: no price, renewal, cancellation, refund or failed-payment language. Checkout (`app/api/stripe/create-checkout-session/route.ts`) goes straight to Stripe with no renewal statement next to the button.

This file has three parts:

1. A new Terms section, ready for counsel to edit.
2. A one-line renewal disclosure for checkout and `/dashboard/upgrade`.
3. Findings with risk ratings, and who builds what.

## Scope and jurisdiction

- **Company:** United States. The Terms choose Georgia law and Georgia courts (section 13).
- **Buyers:** business owners and creators in US cities. Many are sole proprietors, who may be treated as consumers under state auto-renewal laws. This draft treats every buyer as a consumer to be safe.
- **Frameworks considered:** the federal Restore Online Shoppers' Confidence Act (ROSCA) and FTC Act section 5; state automatic renewal laws, with California's (Bus. & Prof. Code 17600 and following, amended effective July 1, 2025) as the strictest common one; Georgia law.
- **The FTC "Click-to-Cancel" rule** (amended Negative Option Rule) was vacated by the Eighth Circuit in July 2025. ROSCA still applies. Note: verify the current state of the federal rule and of each state's automatic renewal law before this goes live. Regulations change and this information may be outdated.
- **Out of scope:** marketplace buyer refunds (V2, Stripe Connect), job posting fees, sales tax.

## Facts this draft relies on

Taken from the code on 2026-10-28. Counsel should confirm each one still holds.

| Fact | Source |
|---|---|
| Plans bill monthly or yearly, in advance, through Stripe Checkout | `create-checkout-session/route.ts` (`mode: 'subscription'`) |
| One plan per page; a second page needs its own plan | the same route returns `SUBSCRIPTION_EXISTS` |
| Owners change or cancel through the Stripe Customer Portal ("Manage subscription") | `ManageSubscriptionButton.tsx`, `createPortalSession` |
| A failed payment keeps the paid plan while Stripe retries (`past_due`) | `lib/services/billing/webhookHandlers.ts` (`KEEPS_ACCESS`) |
| When a plan ends, extra content is hidden, never deleted, and returns on upgrade | ticket 105 / #256 |
| The tester free month is 30 days with no card, and ends by itself on day 30 | `lib/tour/trial.ts` (`missing_payment_method: 'cancel'`) |
| **Unverified:** whether the Portal cancels at period end or right away | Stripe Dashboard setting, not in code |
| **Unverified:** whether any refund has ever been given, and how | founder |

---

## Part 1. Proposed Terms section

Proposed as a new **section 13, "Paid Plans and Billing"**, with current sections 13 to 15 moving down to 14 to 16. Section 12's survival list should then add the new section's payment terms.

Plain-language draft. Bracketed items are choices for the founder and counsel.

> ### 13. Paid Plans and Billing
>
> **13.1 Plans.** Some features need a paid plan for your page. Current plans, prices and what each one includes are shown on our Pricing page. Each plan covers one page.
>
> **13.2 Billing.** You pay in advance, monthly or yearly, depending on what you choose at checkout. Payments are processed by Stripe. Prices are in US dollars and do not include any taxes that apply.
>
> **13.3 Automatic renewal.** Your plan renews automatically at the end of each monthly or yearly term, and we charge the payment method on file at the then-current price, until you cancel. We will tell you at least [30] days before any price change takes effect for you. For yearly plans, we will email you at least [15] days before each renewal.
>
> **13.4 Cancelling.** You can cancel at any time from your dashboard under Upgrade, then Manage subscription. You do not need to contact us. When you cancel, your plan stays active until the end of the term you already paid for, then your page moves to the free plan. [Confirm the Portal is set to cancel at period end.]
>
> **13.5 Refunds.** Payments are non-refundable, including for partial months or years, except where the law requires otherwise or where we decide to give a refund. [Alternative for counsel: a full refund on a first yearly payment if requested within [14] days.]
>
> **13.6 Changing plans.** If you move to a higher plan, the change takes effect right away and Stripe charges the prorated difference. If you move to a lower plan, the change takes effect [at the end of your current term]. Content over the lower plan's limits, such as extra photos, videos, products and services, is hidden from your public page, not deleted, and shows again if you move back up.
>
> **13.7 Failed payments.** If a payment fails, we and Stripe will try again over a short period and let you know. Your plan stays active while we retry. If payment still fails, your page moves to the free plan, with content handled as in 13.6.
>
> **13.8 Free trials and promotions.** We may offer a free period on a plan, for example to early testers. We will say at the start whether a card is needed and what happens when it ends. A free period that did not ask for a card ends on its own, with no charge.
>
> **13.9 Ending your account.** If you delete your account, your paid plan is cancelled at the same time and no further charges are made. Section 13.5 applies to anything already paid. If we terminate your account under section 12 for a breach of these Terms, no refund is due. If we end the service or a plan for any other reason, we will refund the unused part of any prepaid term.

## Part 2. Renewal disclosure at checkout

Put this one line directly above the Subscribe/Checkout button on `/dashboard/upgrade` (`UpgradePlans.tsx`, near `CheckoutButton`), with the price and cycle filled in from the card:

> **Renews automatically at $[49] a [month] until you cancel. Cancel anytime from your dashboard. See [Terms](/terms#paid-plans).**

Notes for whoever builds it:

- The price and cycle must match the card the owner picked (monthly $49, or yearly $470).
- It must be visible before the click, not in a tooltip or behind a link.
- Stripe Checkout can repeat it: set `custom_text.submit.message` on the session to the same sentence, and consider `consent_collection.terms_of_service: 'required'`, which needs the Terms URL set in the Stripe Dashboard.
- The success page and Stripe's receipt email should confirm the renewal terms and how to cancel.

---

## Part 3. Findings

| # | Finding | Rating | Status |
|---|---|---|---|
| L1 | The Terms have no paid-plan section: no renewal, cancellation, refund or failed-payment terms | **High** | Required, not yet implemented |
| L2 | No clear renewal disclosure next to the checkout button (ROSCA; state automatic renewal laws) | **High** | Required, not yet implemented |
| L3 | No express consent to renewal captured before charging | **High** | Required, not yet implemented |
| L4 | Cancellation path: the Portal is online and self-serve, which is good. Confirm it is easy to find and cancels at period end | Medium | Unverified, requires confirmation |
| L5 | No acknowledgment after purchase that states renewal terms and how to cancel (California requires one for consumers) | Medium | Unverified, requires confirmation (check Stripe receipt settings) |
| L6 | No reminder email before a yearly plan renews (several states require one for consumers) | Medium | Required, not yet implemented |
| L7 | No refund policy written anywhere. Without one, refund decisions are ad hoc and dispute risk rises | Medium | Decision needed (founder and counsel) |
| L8 | Price-change notice for existing subscribers is not promised anywhere | Medium | Covered by draft 13.3, needs counsel |
| L9 | Tester free month: no card, ends by itself. Low negative-option risk, but the Terms should mention free periods | Low | Covered by draft 13.8 |
| L11 | Section 13 went up effective on posting with no email to owners already on a paid plan, though Changes to Terms promises 14 days' email notice of material changes | Medium | Consult attorney. Founder chose to post as is (2026-10-29) |
| L10 | Whether B2B buyers fall outside state automatic renewal laws, and which states BLACQList buyers are in | Consult attorney | Jurisdiction unclear |

## Who builds what

Policy text (Part 1) needs counsel, then goes into the Terms page with the usual 14-day notice (section 14). The code items:

→ **Frontend**: renewal line above the checkout button on `/dashboard/upgrade`, with price and cycle from the selected card, and a link to `/terms#paid-plans` (L2)
→ Ticket: `docs/blacqlist/tickets/144-checkout-renewal-disclosure.md`

→ **Backend**: on the Checkout session, add `custom_text.submit.message` with the same line and `consent_collection.terms_of_service: 'required'` (L3); store the consent timestamp from the session on the subscription row
→ Ticket: `docs/blacqlist/tickets/144-checkout-renewal-disclosure.md`

→ **Backend**: email at least 15 days before a yearly renewal (Stripe `invoice.upcoming`, or Stripe's own renewal reminder setting if it covers this) (L6)
→ Ticket: `docs/blacqlist/tickets/145-annual-renewal-reminder.md`

→ **QA**: confirm the Portal cancels at period end, the plan stays live until then, the page moves to free afterwards, and Stripe's receipt names the renewal terms and the way to cancel (L4, L5)
→ Ticket: `docs/blacqlist/tickets/144-checkout-renewal-disclosure.md`

→ **Docs**: a short help article, "How to cancel or change your plan", linked from the Terms and the upgrade page (L4)
→ Ticket: `docs/blacqlist/tickets/144-checkout-renewal-disclosure.md`

Tickets 144 and 145 are not written yet. Check `ticket-index.md` for the next free numbers before creating them.

## Questions for the founder and counsel

1. Refunds: none, or a short window on a first yearly payment? (13.5)
2. Downgrades: at the end of the term, or right away? This is a Stripe Portal setting. (13.6)
3. Notice periods: 30 days before a price change, and 15 days before a yearly renewal? (13.3)
4. Does the attorney want consent captured as a checkbox on our page, in Stripe Checkout, or both? (L3)
5. Should this ship before Growth opens, with Starter already on sale? This draft recommends yes, since L1 to L3 already apply to Starter.
