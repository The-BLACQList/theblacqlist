# Ticket 243: Deleting an Account Cancels the Paid Plan

**Status:** PR open (`fix/243-account-delete-cancels-plan`). Merging needs the founder's OK (GATE-DEPLOY). No migration.

## Why

Terms 13.9 says: "If you delete your account, your paid plan is cancelled at the same time and no further charges are made." It wasn't true. `deleteAccountAction` never called Stripe, so a paying owner who deleted their account kept being charged. Found while building ticket 238 (next-actions 2026-11-21, item 4).

It was worse than the charge alone. Deleting the auth user:
- CASCADE-deletes `subscriptions` and `plan_covered_pages`, our only record of which Stripe subscriptions and customers were theirs;
- SET NULLs `listings.owner_user_id`. `sync_owner_plan_tiers` is keyed on the owner, so the now-unclaimed pages kept a paid tier forever, and the later `customer.subscription.deleted` webhook could not reach them.

## What Changed

- New `lib/services/billing/accountDeletion.ts`, `cancelPlansForDeletedAccount(service, user)`. It runs first in `deleteAccountAction`, before reviews, saves or the auth user are deleted:
  1. Finds the user's subscriptions: their `subscriptions` rows, every Stripe customer on those rows, and Stripe customers with the account email (checkout and the tester trial can create a customer by email, and a just-paid plan may not have a row yet). A subscription counts only if it's on one of their rows or stamped `metadata.user_id` = them.
  2. Cancels each one that can still charge (`active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `paused`) **now**: `prorate: false`, `invoice_now: false`, idempotency key `account-delete:<sub id>`. No refund (Terms 13.5). One Stripe no longer has, or one already over, counts as done.
  3. Marks the rows `canceled`, then runs `syncOwnerPlan(fill: false)`, so every page drops to Free while it still has an owner.
  4. Writes an audit row, `subscription_canceled_account_deleted`, before the user is gone.
- Any failure stops the deletion and keeps the account: "We couldn't cancel your paid plan, so your account wasn't deleted. Please try again, or email privacy@theblacqlist.com." Someone with no plan rows and no pages never calls Stripe.
- The delete dialog's "What we delete" list adds: "Your paid plan, if you have one: cancelled right away, with no further charges".
- The webhook is unchanged. The `customer.subscription.deleted` that follows finds no billing and returns 200 (a test pins this).
- Job postings are one-off payments, so nothing recurring is left.

## Tests

- `tests/account-deletion-cancel.test.ts` (11): nothing to cancel → no Stripe calls; cancel parameters and idempotency key; past_due / trialing / unpaid cancelled, ended ones skipped; found by email; someone else's subscription on an email-found customer skipped; recorded subscription without a stored customer; missing or already-ended counts as done; a Stripe error, a read error or a sync error throws before rows change.
- `tests/delete-account-action.test.ts` (3): cancel runs before any delete; a failed cancel keeps the account; no plan work without the DELETE confirmation.
- `tests/subscription-upsert.test.ts`: the later webhook is a quiet no-op.

## Test-Mode Run

Not run yet. Preview deployments can't receive Stripe webhooks (SSO protection), so the run has to be local `pnpm dev` on staging Supabase with the Stripe sandbox and `stripe listen`, which needs the staging env file. The checklist (ticket 238's plus this ticket's) is in the PR.
