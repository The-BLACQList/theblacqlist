# Ticket 109 — Booking & appointment requests (Premium tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Draft
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
