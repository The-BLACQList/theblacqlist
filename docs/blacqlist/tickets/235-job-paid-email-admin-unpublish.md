# Ticket 235: Payment Email for Paid Jobs, and Admin Unpublish

**Status:** PR (`feat/job-paid-email-unpublish`). Merging needs the founder's OK (GATE-DEPLOY).

## Why

Next-actions item 6, from the $9.99 job test runbook (GATE-07 F3, 2026-11-20). Founder go: "go for both", 2026-11-20, Software session.

- A poster who paid $9.99 heard nothing from the site until a moderator approved the role. Stripe's own receipt was the only email.
- An admin had no way to take a live job down. Only the owner could, from their edit page.

Refunds stay manual in Stripe. That is unchanged.

## Changes

1. **Payment Received email** (`lib/email/templates/job-posting-paid.tsx`).
   - Subject: "Payment Received for {job title}". Heading: "Your Role Is in Review".
   - Says what was charged (from Stripe's `amount_total`, left out when 0), that review usually takes 3 to 5 business days, and that the 30 days start when the role goes live.
   - Button "See Your Role" goes to `/dashboard/pages/{id}/posted`. Support line uses `SUPPORT_EMAIL`.
   - The eyebrow green (#15803D) and footer grey (#6B6B6B) are darker than the older templates' so both pass 4.5:1.
2. **Sent from the webhook** (`handleCheckoutSessionCompleted`).
   - Sent only on the draft to pending step, after the audit row. A Stripe redelivery finds the job past draft, so it never sends twice.
   - To: the email from checkout, else the account email. No address: skipped.
   - Wrapped so nothing about the email can fail the webhook (a failure would make Stripe retry a payment that was already fulfilled).
3. **Admin Unpublish** (`lib/actions/admin/unpublishJob.ts`, `components/admin/JobUnpublishAction.tsx`).
   - Shows in Admin Actions on `/admin/entities/{id}` when the listing is a published job.
   - Two steps: "Unpublish Job", then an optional note (saved to `moderation_notes`, admins only) and "Confirm Unpublish".
   - Sets status `unpublished`, not `draft`. The listings guard lets an owner move a job only draft to pending, so the owner can't put back up what an admin took down. The update matches only a still-published row; if the job changed meanwhile, the admin is told to reload.
   - Audit row `unpublish_job`. Refreshes `/jobs`, the job's page, the owner's edit page and the admin counts.
4. **Owner sees "Taken Down"** (`components/dashboard/PublishSection.tsx`). Before this, an `unpublished` job showed no status and no actions. It now says the team took it off the job board, with the support address.

## Not in this ticket

- No email to the owner when an admin unpublishes. Say if you want one.
- No refund and no pause of the 30-day window on unpublish. Refunds stay manual in Stripe.
- No admin "Republish" button. An admin can use the edit or approval flow as today.

## Checks

- `tests/job-posting-paid.test.ts` (16 tests): the email's copy and amount, send once, no send on redelivery, account-email fallback, the webhook never throws for the email, and the Unpublish guards.
- Full vitest, tsc and eslint clean.
