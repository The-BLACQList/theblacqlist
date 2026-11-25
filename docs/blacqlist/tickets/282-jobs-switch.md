# Ticket 282: The Jobs Switch Stops New Jobs on the Server

**Status:** In review, 2026-11-24.

## Why

`FEATURE_JOBS_OPEN` off covers `/add-job` and hides the post-a-job links. The dashboard's Submit button for a job draft still ran `submitJobForReview`, which checked only the payment flag. Reproduced on staging with Jobs off: the button opened Stripe Checkout. The founder approved the fix on 2026-11-24.

## What Changed

- `lib/services/listings/submitJobForReview.ts`: with Jobs off, refuses before an included posting is spent, Checkout is opened or the status moves. A job with a live paid or included ledger row still goes through. Being grandfathered doesn't count as paid, and a failed read refuses.
- `lib/actions/listings/postJob.ts` and `lib/actions/listings/createListing.ts`: with Jobs off, refuse a job before a draft is made. Events and businesses are unchanged.

The owner sees "Job submissions are not open yet. Your draft is saved."

No migration. Production has Jobs on, so nothing changes there today. `jobsOpen` is off by default on every deployment, so a Preview without the variable refuses jobs too.

## Unchanged

- The Stripe webhook: a Checkout page already open when Jobs is switched off can still be paid, and that job goes to review.
- Admin approval, and reopening a closed job.
- The dashboard button still shows while Jobs is off. Pressing it shows the message.

## Checks

- `tests/jobs-switch.test.ts` (new), plus a case in `tests/post-job-action.test.ts`. `tests/job-status-guard.test.ts` now sets the switch on.
- Local app on staging with Jobs off, same draft: before, Stripe Checkout opened; after, the message shows and no row changes.
