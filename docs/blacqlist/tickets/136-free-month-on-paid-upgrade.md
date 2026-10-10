# Ticket 136: Use the free month on an upgrade when the listing already pays

**Phase:** V1.5 · **Priority:** P1 · **Status:** Blocked (until Growth or Premium is about to open)
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

**Stripe.** Put the existing subscription on a Subscription Schedule (`subscriptionSchedules.create({ from_subscription })`), then update it to two phases:

| Phase | Price | Length | Billing |
|---|---|---|---|
| 1 | The picked tier's monthly price | 30 days | `trial: true`, so nothing is charged |
| 2 | The subscription's current price | Until changed | As before, on the card already on file |

The schedule's `end_behavior` is `release`, so after phase 2 starts the subscription is an ordinary one again.

**Webhook.** None expected. `handleSubscriptionUpsert` already re-resolves the tier from the live price, so phase 1 lands the listing on the picked tier and phase 2 puts it back. Confirm this in the test-mode run; don't assume it.

**Route.** In `/api/tour/claim`, the live-subscription branch of `guardBeforeClaim` stops refusing when the listing has exactly one live subscription on a lower tier. It goes down a new path instead: compare-and-set, then the schedule calls with the idempotency key `tour-upgrade:${enrollmentId}`, then persist the schedule id. On failure, release the claim, and release the schedule if one was created.

**Data (GATE-DATA).** Add `stripe_subscription_schedule_id text NULL` to `tour_enrollments`. Add a CHECK that it requires `trial_granted_at`, mirroring the session-id CHECK. Add a CHECK so a row can't hold both a checkout session id and a schedule id. The founder runs the migration on staging first, then prod, before merge.

**Card.** The `saved` state becomes `ready`, offering only the tiers above the current one. The `used` state also reads from the schedule id.

## Decisions to make before build

1. **Prorations.** The tester already paid for the current Starter period. Pick one:
   - Set `proration_behavior: 'none'` on the phase change. This is simplest, but the tester loses the unused part of the Starter period.
   - Start phase 1 at the next renewal date, so the free month starts when the paid month ends. This is the fairest option, but the tester waits up to a month.
2. **Cancel during the month.** If the tester cancels while in phase 1, does the listing drop to Free at once, or at the end of the 30 days?
3. **The owner's email or receipt copy** saying what happens on day 31: "You go back to Starter at $19 a month."

## Acceptance criteria

- Given a tester paying for Starter whose Growth plan is open, when they pick Growth on the free-month card, then the listing is on Growth, no charge is made for 30 days, and on day 31 it is back on Starter at the Starter price.
- Given the same tester clicks twice or retries after a lost response, then exactly one schedule exists.
- Given the schedule call fails, then the month is not spent and the listing is unchanged.
- Given a listing with two live subscriptions, then the claim refuses and spends nothing.
- A Stripe **test-mode** run with test clocks covers day 0, day 30 and day 31, and the webhook-synced `listings.tier` is right at each step.

## QA notes

- Use Stripe test clocks; never real time.
- No live-mode Stripe writes until the founder approves.
- Re-run `tester-tour-claim.test.ts`. The `ALREADY_SUBSCRIBED` test changes from "refused" to "takes the upgrade path".
