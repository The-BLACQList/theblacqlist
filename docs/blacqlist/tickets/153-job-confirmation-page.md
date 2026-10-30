# Ticket 153: The "Your role is in review" confirmation page

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 152 (sends the poster here). Can merge first and be linked later.
**Gates:** none. No migration, no new dependency. Reads Stripe only through the existing webhook-written ledger.
**Decision record (founder, 2026-10-30, screen 5):** Confirmation A, its own page: "Your role is in review", what it cost (included or $9.99 paid), a short timeline (Submitted, In review, Live, Closes), links to the dashboard and to post another.

---

## Why

After submitting, the poster lands on the dashboard editor with no confirmation. For paid roles the checkout `success_url` ends in `?posted=1`, but nothing in the repo reads `posted` (or `canceled`), so the poster never sees "payment received". (The workshop notes the param is lost on redirect. In code it is sent and never read; same fix either way.)

## Scope

In:

- **New route** `app/dashboard/pages/[entityId]/posted/page.tsx` (server component, `force-dynamic`). Owner only; others get `notFound()`.
- **Content:**
  - Heading "Your role is in review", role title and business.
  - Cost line from the ledger row for this listing: `source = 'entitlement'` reads "Included with your {tier} plan. No charge."; a paid row reads "You paid {amount} for 30 days." where the amount is taken from the Stripe session/ledger and falls back to `JOB_POSTING_PRICE_DISPLAY` from `lib/stripe/jobPostings.ts`. Never hardcode "$9.99".
  - Timeline (an ordered list with text states): Submitted (date), In review (current, "usually 3 to 5 business days"), Live (after approval), Closes ({closes_at} or "30 days after it goes live"). Current step has `aria-current="step"`.
  - Links: "Back to your dashboard" (`/dashboard`), "Post another role" (`/add-job`), "See your role" (`/dashboard/pages/{id}`).
- **Fix the lost message.** In `lib/stripe/jobPostingCheckout.ts` change `success_url` to `/dashboard/pages/{id}/posted?paid=1` and `cancel_url` to `/add-job?canceled=1` (the wizard shows "Checkout was canceled. Your draft is saved." from that param). The page never trusts `paid=1`: it reads the ledger. Checkout success can arrive before the webhook: if the listing is still `draft` and no paid row exists yet, show "We're confirming your payment" with a refresh link and re-check every 5 seconds for up to 30 seconds (small client component, `aria-live="polite"`), then "Payment is taking longer than usual. Your dashboard will update when it clears."
- **Status-aware.** If the listing is already `published`, the heading reads "Your role is live" with a link to the public page; `rejected` shows "This role needs changes" with the reason and a link to edit (the existing flow). Anything else not `pending` and not `draft` falls back to a redirect to the dashboard page.

Out:

- Emails (approval email is a separate GATE-COMMS decision).
- Receipts or invoices (Stripe sends its own).
- Changing the wizard (152), except the canceled banner copy there.

## Acceptance criteria

- Given I submit with an included posting, when the action succeeds, then I land on this page and see "Your role is in review", "Included with your Growth plan. No charge.", and the four-step timeline with In review current.
- Given I pay in Stripe, when I return, then I see the paid cost line and the timeline once the webhook has moved the role to `pending`.
- Given I return before the webhook finished, then I see "We're confirming your payment" and the page updates by itself within 30 seconds without me reloading.
- Given I cancel in Stripe, then I land on `/add-job?canceled=1` with my draft restored and the cancel notice.
- Given another user opens this URL, then they get a 404.
- Given the role is approved later, then the same URL shows "Your role is live".
- Given the closing date was left blank, then Closes reads "30 days after it goes live".
- Mobile 375px: single column, the two buttons stack full width, "Back to your dashboard" is the primary. 1280px: centered column of about 640px.
- A11y: one H1; timeline is an `ol` with visible text status (not color only); the confirmation heading gets focus on load; polling message in a polite live region; buttons at least 44px high.
- No em dashes in copy.

## Failure states

| Failure | User sees | Recovery |
|---|---|---|
| Ledger read fails | Page still renders, cost line replaced by "We couldn't load the cost just now." | Refresh |
| Not the owner / no such role | 404 | Go to dashboard |
| Webhook slow | "We're confirming your payment" then the longer message | Dashboard shows the true state |
| Signed out | Redirect to sign-in with return URL | Sign in |

## Edge cases

- User refreshes or bookmarks the page days later: it shows the current status, not stale "in review".
- Two paid rows (rare retry): show the newest.
- The grandfathered path (no ledger row): cost line "No charge." and no tier text.

## Data note

No migration. Reads `listings` and `job_posting_purchases` (`source`, `status`, `paid_at`, `expires_at`) for the owner under existing RLS or the service client after an explicit ownership check.

## Tests

- Unit (`tests/job-confirmation.test.ts`): view-model builder for included, paid, grandfathered, pending webhook, live, rejected.
- Unit: `success_url` and `cancel_url` shapes in `jobPostingCheckout`.
- Playwright: owner lands on the page after an included submit; non-owner gets 404. `e2e/opening-soon.spec.ts` green with the flag off (the page is under `/dashboard`, not covered by the flag, so it must not leak the Jobs UI if the role cannot exist).

## QA notes

Stripe test mode: pay with the 4242 card, cancel from the Stripe page, and repeat while the webhook is paused to see the polling copy.
