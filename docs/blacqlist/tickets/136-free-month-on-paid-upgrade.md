# Ticket 136: Use the free month on an upgrade when the listing already pays

**Phase:** V1.5 · **Priority:** P1 · **Status:** Done (PR open, merges after the flip)
**Depends on:** the free-month-any-tier change (tester-tour-spec.md §4.4)
**Gates:** PAYMENTS (plan approved by the founder before build), GATE-DATA (one nullable column on `tour_enrollments`), a passing Stripe **test-mode** run. **Must ship before Growth or Premium get a monthly price ID**, or a paying tester's saved month has nowhere to go.
**Decision record:** `docs/blacqlist/product/tester-tour-spec.md` §4.4

---

## Why

`[Decision — founder, 2026-10-10]` Testers can hold their free month as long as they want, and a tester already paying for Starter can still use it on Growth or Premium later.

Today the claim refuses that tester with 409 `ALREADY_SUBSCRIBED` without spending the month, and the upgrade page says it is saved. That is safe but incomplete. The normal claim path can't serve them: it opens a second, card-less subscription, so two subscriptions would write one `listings.tier`, and the trial's day-30 cancel would fire `customer.subscription.deleted` against a listing that is still paid for.

## Scope

In:

- A tester whose listing has one live subscription picks a higher tier on the free-month card and gets that tier free for 30 days. Then the listing goes back to the plan and price it had before.
- The claim protocol stays: guards before the compare-and-set, compare-and-set before Stripe, release on failure, a stable idempotency key.

Out:

- Keeping the higher tier after the month (that's an ordinary upgrade through the normal checkout).
- A listing with more than one live subscription (refuse, log, and handle by hand).
- A listing already on Premium (there's no higher tier, so the card shows nothing to pick).

## How it works

**Stripe.** Put the existing subscription on a Subscription Schedule (`subscriptionSchedules.create({ from_subscription })`), then update it to three phases. A test-clock probe on 2026-10-20 showed two phases can't do it: a schedule that releases after the trial leaves the subscription on Growth, and day 31 bills $49.

| Phase | Price | Length | Billing |
|---|---|---|---|
| 1 | The current Starter price | From the period start until now | Already paid; cut short at the claim |
| 2 | The picked tier's monthly price | 30 days | `trial: true`, so nothing is charged |
| 3 | The Starter price again | One month | `billing_cycle_anchor: 'phase_start'`, so $19 is charged on day 31 |

`proration_behavior: 'none'` throughout, and `end_behavior: 'release'`, so after phase 3 the subscription is an ordinary Starter one again. `assertUpgradeSafe` (`lib/tour/upgrade.ts`) throws before any Stripe call unless the last phase is the price the tester had, so a tester can never be billed for the higher tier.

**Webhook.** No change. `handleSubscriptionUpsert` resolves the tier from the live price, and `trialing` keeps access, so the listing reads Growth for the 30 days and Starter after. `handleSubscriptionDeleted` drops the page to Free when a tester who chose to end the plan reaches day 30. Covered in `tests/subscription-upsert.test.ts` (the ticket 136 block).

**Route.** In `/api/tour/claim`, a listing with exactly one live, monthly, lower-tier subscription takes the upgrade path instead of 409 `ALREADY_SUBSCRIBED`: guards, compare-and-set, then the schedule calls. The create key is `tour-upgrade:${enrollmentId}:${grantedAt}` and the update key is `tour-upgrade:${scheduleId}:${tier}`. The schedule id is saved as soon as the create returns, so a retry finishes the same schedule instead of making a second. After the phases are asked for, nothing is ever released: if the answer was lost, the next click reads the schedule and finishes. These cases are refused in plain words and spend nothing:

| Code | When |
|---|---|
| `MULTIPLE_PLANS` | More than one live subscription on the page |
| `TOP_PLAN` / `NOT_AN_UPGRADE` | Already on Premium, or the picked tier isn't higher |
| `PAYMENT_PAST_DUE` | The last payment failed |
| `PLAN_TRIALING` / `PLAN_ENDING` | The plan is in its own trial, or set to cancel |
| `NOT_MONTHLY` | An annual plan (handled by hand through support) |
| `PLAN_CHANGE_PENDING` | The subscription already has someone else's schedule |

**Ending the plan.** `POST /api/tour/upgrade/end` with `{ cancel: boolean }` sets the schedule's `end_behavior` to `cancel` (the plan ends on day 30, no charge) or puts the Starter phase back. The schedule id comes from the caller's own enrollment, never the body.

**Reminder.** The daily `/api/cron/expiry` sweep (`lib/tour/upgradeReminder.ts`) finds months ending within 5 days, stamps `upgrade_reminder_sent_at` first (so it goes once), then sends. It skips a tester who chose to end the plan. It also backfills `upgrade_trial_ends_at` if the claim didn't manage to write it. Stripe's own `trial_will_end` fires on day 27, so we don't use it.

**Data (GATE-DATA).** Migration `20261021000000_tour_upgrade_schedule.sql`: three nullable columns on `tour_enrollments` (`stripe_subscription_schedule_id` UNIQUE, `upgrade_trial_ends_at`, `upgrade_reminder_sent_at`) and four CHECKs (schedule requires `trial_granted_at`; never both a checkout session and a schedule; end date requires a schedule; reminder requires an end date). No RLS change. Applied to staging; prod runs after the flip, before merge.

**Card.** For a paying page, `saved` becomes `ready` and offers only the tiers above the current one. While the month runs, the card shows the end date, what comes after, and an "End my plan when the free month ends" button (with undo).

## Decisions (founder, 2026-10-20)

1. **Prorations.** None. 30 days of the higher tier free; Starter billing pauses and comes back on day 31. The unused part of the Starter period the tester already paid for is not refunded. (The other option, starting the free month at the next renewal, was not picked.)
2. **Cancel during the month.** The plan ends after day 30, with no charge.
3. **Reminder.** One email five days before the month ends (day 25). Copy, shown to the founder before merge:
   - Subject: "Your free Growth month ends soon"
   - "Your free Growth month ends on [date]."
   - "You'll go back to Starter at $19/month. Nothing to do if that's what you want."
   - "If you'd rather end your plan when the free month ends, you can do that from your dashboard before [date]. You won't be charged."
   - Button: "See your plan"

## Acceptance criteria

- [x] Given a tester paying for Starter whose Growth plan is open, when they pick Growth on the free-month card, then the listing is on Growth, no charge is made for 30 days, and on day 31 it is back on Starter at the Starter price. (Clock script: A and B, days 0, 29, 31, 62; `tests/subscription-upsert.test.ts`)
- [x] Given the same tester clicks twice or retries after a lost response, then exactly one schedule exists. (Clock script: A third click, B lost answer; `tests/tour-upgrade.test.ts`)
- [x] Given the schedule call fails, then the month is not spent and the listing is unchanged. (Clock script: A failed try; `tests/tester-tour-claim.test.ts`)
- [x] Given a listing with two live subscriptions, then the claim refuses and spends nothing. (`tests/tester-tour-claim.test.ts`, `MULTIPLE_PLANS`)
- [x] A Stripe **test-mode** run with test clocks covers day 0, day 30 and day 31. (`scripts/stripe/free-month-upgrade-clock.ts`, all checks passed 2026-10-20.) The script checks the live price at each step. The webhook's mapping from that price to `listings.tier` is covered by unit tests, and on the Preview against staging.
- [x] Given a tester who ends the plan mid-month, then nothing is charged and the plan ends on day 30. (Clock script: C; `tests/tour-upgrade-end.test.ts`)
- [x] Given a month ending in 5 days, then one reminder goes out, never to a tester who ended the plan. (`tests/tour-upgrade-reminder.test.ts`)

## QA notes

- Use Stripe test clocks; never real time.
- No live-mode Stripe writes until the founder approves.
- Re-run `tester-tour-claim.test.ts`. The `ALREADY_SUBSCRIBED` test now takes the upgrade path.
- Re-run the clock script: `STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/free-month-upgrade-clock.ts`. It refuses any key that isn't a test key and cleans up after itself.
