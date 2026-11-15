# Ticket 109 — Booking & appointment requests (Premium tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** In PR — stacked on 107 (#339). Migration `20261121000000_booking_requests.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Behind the `bookingRequests` flag (`FEATURE_BOOKING_REQUESTS`), closed on every deployment by default because it emails real people (GATE-COMMS); the founder turns it on. Scope notes: two tables, `listing_booking_settings` (form on/off, the line above it, ask date / party size) and `booking_requests` (no INSERT or DELETE policy; the visitor's request is inserted by the server with the service client; the owner can update only status, reply and timestamps through a column GRANT). Abuse posture: honeypot (silent success), Turnstile, 5 requests an hour per IP and 3 a day per email address (so the form can't flood a stranger's inbox). The owner is emailed with Reply-To the visitor; the visitor's confirmation and the owner's answer go from noreply with no Reply-To (the owner's sign-in email may be personal). Answers: Accept, Decline, Suggest Another Time (needs a note); answering again is refused, and the status-guarded update stops two tabs both emailing. Turning the form on needs Premium; turning it off and answering requests already in work on every plan. No payment, no calendar.
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'booking_requests')` — Premium only

---

## Why

Service businesses are a large share of the directory (salons, barbers, trades, professional
services) and their conversion event is an appointment, not a click-to-call. This is Premium's
highest-intent surface. Scoped deliberately as **request-and-confirm**, not real-time calendar
availability — that scope is what makes it shippable in V1.5.

## Acceptance criteria

- New `booking_requests` table: `listing_id`, `requester_user_id` (nullable — guests allowed),
  `requester_name`, `requester_email`, `requester_phone`, `service_id` (nullable FK to the existing
  services table), `requested_at`, `alternate_at` (nullable), `note`, `status`
  (`pending` | `accepted` | `declined` | `cancelled`), timestamps. RLS: owner reads their listing's
  requests; requester reads their own
- Request form on the listing page (Premium only), pre-filling the service list from existing services
- Owner queue at `/dashboard/pages/[entityId]/bookings` — accept / decline / propose alternate
- Transactional email via the existing Resend pipeline on submit, accept, and decline. Reuse the
  existing email templates and sender config; do not add a second mail path
- Rate-limited and spam-protected — this is an **unauthenticated write endpoint** reachable by
  guests, so it needs the same abuse posture as the consumer-AI endpoints in Ticket 104
- Requester email/phone are PII: excluded from analytics events, and covered by the Sentry scrubbing
  rules already tested in `tests/sentry-scrub.test.ts`
- Accessible form — labels, error summary, and keyboard-complete per the existing a11y suite

## Out of scope

- Real-time availability, calendar sync, or third-party booking integrations (Timekit/Calendly)
- Payments, deposits, or cancellation fees (requires Stripe Connect — V2)
- SMS notifications
