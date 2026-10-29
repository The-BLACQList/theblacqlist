# Ticket 145: Remind owners before a yearly plan renews

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready (Stripe setting first, code only if needed)
**Depends on:** 144
**Gates:** the Stripe Dashboard change is a live billing setting, so it needs the founder's word. A code fallback would add email sends (GATE-COMMS).
**Source:** finding L6 in `docs/blacqlist/legal/subscription-terms-draft-2026-10.md` (in #261). Draft Terms 13.3 promises an email "at least [15] days before each renewal" of a yearly plan.

---

## Why

Several US states require a reminder before a yearly consumer subscription renews. Most BLACQList buyers are businesses, but counsel hasn't ruled on whether that exempts them (L10). The reminder is cheap, and it cuts down on chargebacks from owners who forgot they paid a year ahead.

## Plan

1. **Use Stripe's own reminder first.** In the Stripe Dashboard, under Billing > Subscriptions and emails > Manage invoices sent to customers, turn on reminders for upcoming renewals. Set the lead time to match the Terms (at least 15 days, ideally 30) and confirm it covers yearly prices. Do this in test mode first, then live. There's no code.
2. **Check the email Stripe sends.** It should name the plan, the amount, the renewal date and how to cancel. If it can't carry our cancel path, use Stripe's customer portal link, which is the same place.
3. **Code fallback, only if Stripe's email doesn't fit.** Handle `invoice.upcoming` in `lib/services/billing/webhookHandlers.ts` for yearly subscriptions only. Send a Resend email with the plan, amount, date and the Upgrade > Manage subscription path. It must be idempotent per invoice, so send once even if Stripe retries the event. Add `invoice.upcoming` to the webhook endpoint's events, and set the "Upcoming renewal events" lead time in Stripe to match.

## Acceptance criteria

- Given a yearly Starter or Growth subscription, when it is [30] days from renewal, then the owner gets one email naming the plan, the amount, the date and how to cancel.
- Given a monthly subscription, then no reminder is sent.
- Given Stripe retries the event, then the owner still gets one email.

## QA notes

- Stripe test clock: create a yearly test subscription, advance the clock to 31 then 29 days before renewal, and confirm exactly one reminder.
