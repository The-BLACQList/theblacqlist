# Ticket 144: Show the renewal terms before an owner pays

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR)
**Depends on:** none. Applies to Starter today and to Growth once it opens (ticket 143).
**Gates:** no migration and no new dependency. Turning on `STRIPE_CHECKOUT_TERMS_CONSENT` is an env change (GATE-DEPLOY) and needs the Terms URL set in the Stripe Dashboard first. The Terms section went up on the founder's word on 2026-10-29, with counsel to follow.
**Source:** findings L2, L3 and L5 in `docs/blacqlist/legal/subscription-terms-draft-2026-10.md` (in #261). Those are High because Starter is already on sale with no renewal disclosure.

---

## Why

Owners can buy Starter today without seeing anywhere that the plan renews automatically or how to cancel. US automatic renewal laws (ROSCA, plus state laws such as California's) expect a clear disclosure before payment, consent to it, and an acknowledgment after. Growth going on sale raises the stakes.

## Scope

In:

- **Renewal line above the checkout button** on `/dashboard/upgrade` (`UpgradePlans.tsx`): "Renews automatically at $49 a month until you cancel. Cancel anytime from your dashboard. See our Terms." The price and cycle follow the billing toggle. It's visible before the click, not in a tooltip.
- **The same line on Stripe Checkout**, next to the pay button, via `custom_text.submit.message` (`create-checkout-session/route.ts`). `renewalLine()` in `lib/stripe/renewal.ts` writes both, so they can't drift apart.
- **Terms consent at checkout, behind a switch.** When `STRIPE_CHECKOUT_TERMS_CONSENT` is on, the session sets `consent_collection.terms_of_service: 'required'`. It's off when unset, because Stripe refuses the session if the account has no Terms URL.
- **Acknowledgment after purchase.** The success page says the plan renews until cancelled and how to cancel. Only paid checkouts show it: they add `renews=1` to the success URL. The tester free month shares the page, but it ends by itself, so it doesn't show the note.
- **Terms section 13, "Paid Plans and Billing"** (anchor `paid-plans`). The founder approved posting the legal doc's text on 2026-10-29, effective on posting, with counsel review to follow. The bracketed choices use the draft's defaults: 30 days' notice of a price change, a reminder 15 days before a yearly renewal, no refunds, and downgrades at the end of the term. Governing Law, Changes and Contact move to 14, 15 and 16, and the survival list adds 13. The card's "See our Terms" link goes to `/terms#paid-plans`.
- **Pricing FAQ.** "Can I cancel a paid plan anytime?" now says plans renew automatically and names the exact path (Upgrade, then Manage subscription).

Out:

- **Yearly renewal reminder email.** That's ticket 145.
- **A help article.** There's no help center yet. The pricing FAQ and the success page carry the cancel path for now.
- **Storing the consent timestamp.** Stripe keeps `consent.terms_of_service` on the Checkout Session. Copying it onto `subscriptions` can wait for counsel to say it's needed.

## Acceptance criteria

- Given a Free owner on `/dashboard/upgrade` with Starter for sale, when the toggle is on Monthly, then the Starter card shows "Renews automatically at $19 a month until you cancel." above the button. When it's on Annual, the card shows "$182 a year".
- Given the same owner clicks the button, then Stripe Checkout shows the same sentence next to the pay button.
- Given `STRIPE_CHECKOUT_TERMS_CONSENT` is unset, then Checkout shows no Terms checkbox. Given it is `1` and the Stripe account has a Terms URL, then the owner must tick it before paying.
- Given a paid checkout succeeds, then the success page says the plan renews until cancelled and how to cancel. Given a tester claims the free month, then it doesn't.
- Given a card the owner can't buy (Coming Soon, the current plan, or a free-month hold), then no renewal line shows.

## QA notes

- Run `npx tsc --noEmit`, `npx eslint app lib components` and `npx vitest run`.
- Preview in Stripe test mode: card `4242…`, monthly and annual. Check the line on the card and in Checkout at 375px and 1280px.
- Before turning the consent switch on in production: set the Terms URL in the live Stripe account (Settings > Public details), then run one test-mode checkout with the switch on.
- Still to verify in the Stripe Dashboard (L4): the Customer Portal cancels at period end, not right away. The FAQ and success page don't promise either, but Terms 13.4 will.
