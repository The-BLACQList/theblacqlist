# Ticket 078: Stripe webhook handler — subscription lifecycle events

---

## Status

Draft

## Phase

Phase 14: Monetization and Sponsorship Foundation

## Priority

P3 — Low

## Estimate

M (2–4h)

## Feature Area

Monetization

---

## Context

The Stripe webhook handler is the mechanism that reconciles Stripe subscription events with the platform's database. After a business owner completes the Checkout flow (Ticket 076), Stripe fires a `checkout.session.completed` event to this handler, which then creates the subscription record and upgrades the listing tier. Subsequent subscription events (updates, cancellations, payment failures) also flow through this handler.

This is a Route Handler (not a Server Action) because it receives webhook POST requests from Stripe — an external service that cannot invoke Server Actions. Webhook signature verification using `STRIPE_WEBHOOK_SECRET` is mandatory on every request.

**Idempotency is required.** Stripe may deliver the same event more than once. The handler checks whether a given `stripe_event_id` has already been processed before taking any action. Processed event IDs are stored in a `stripe_events_processed` table (created in this ticket).

Sources: `docs/blacqlist/architecture/architecture-decisions.md` ADR-007; `docs/blacqlist/architecture/server-actions-plan.md` § decision table (Stripe webhook → Route Handler).

---

## User Story

As a platform engineer, I want Stripe subscription events handled reliably and idempotently, so that listing tiers are kept in sync with paid subscriptions without manual intervention and without duplicate processing.

---

## Scope

**In scope:**

- `app/api/webhooks/stripe/route.ts` — Route Handler; POST only; no auth (Stripe signature is the auth mechanism)
- Webhook signature verification: `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)` — return 400 if verification fails
- **Four events handled:**
  1. `checkout.session.completed` — create/update `subscriptions` row; update `listings.listing_tier` to the purchased plan
  2. `customer.subscription.updated` — sync `subscriptions.status` and `current_period_end`; update `listings.listing_tier` if plan changed
  3. `customer.subscription.deleted` — set `subscriptions.status = 'canceled'`, `subscriptions.canceled_at = now()`; downgrade `listings.listing_tier` to `'free'`
  4. `invoice.payment_failed` — log the event; send notification email via Resend to the owner (subject: "Payment failed for your BLACQList subscription")
- Idempotency: `stripe_events_processed` table (created in this ticket); handler checks `SELECT id FROM stripe_events_processed WHERE stripe_event_id = $id` before processing; returns 200 immediately if already processed; inserts the event ID after successful processing
- `insertAuditLog` called on subscription status changes (events 1, 2, 3)
- `revalidateTag(\`listing-${listingId}\`)` called after listing tier changes (events 1, 2, 3)
- All DB writes use `createServiceRoleClient()` — no RLS restrictions apply
- Return 200 for all events, including unrecognized ones (Stripe retries on non-2xx responses)

**Out of scope:**

- Stripe Connect webhook events — V2
- Refund processing — V2
- Invoice history display — deferred
- Stripe Radar fraud events — V2

---

## Dependencies

| Dependency                                                                                  | Type            | Status                                                                  |
| ------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Ticket 075 — `plans` and `subscriptions` tables + Stripe client                             | Blocking ticket | Not started                                                             |
| Ticket 076 — `createCheckoutSession` (generates checkout sessions this webhook responds to) | Related ticket  | Not started                                                             |
| Ticket 012 — `admin_audit_log` table                                                        | Blocking ticket | Not started                                                             |
| `STRIPE_WEBHOOK_SECRET` environment variable                                                | Infrastructure  | Must be set in production before this route is live                     |
| Resend integration (`lib/email/resend.ts`)                                                  | Infrastructure  | Must exist; from Ticket scope (check if established by earlier tickets) |

**Risk:** The `STRIPE_WEBHOOK_SECRET` must be configured in Vercel environment variables before this Route Handler is deployed to staging. Use Stripe CLI locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## UX Notes

No user-facing UI in this ticket. The effects of webhook processing are visible to owners via:

- Their listing tier changing on the dashboard (Ticket 050)
- The success state on `/dashboard?upgrade=success` (Ticket 076)
- A "Payment failed" notification email

---

## Design Notes

No UI in this ticket. Email notification design: use the existing Resend transactional email template pattern from `lib/email/`. The `invoice.payment_failed` email template is a new template: `lib/email/templates/paymentFailed.tsx`.

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `subscriptions`, `listings`, `admin_audit_log`
- **Entities involved:** `subscriptions`, `listings`, `admin_audit_log`, `stripe_events_processed` (new)
- **Operations:**
  - `checkout.session.completed`: UPSERT `subscriptions` (by `listing_id`); UPDATE `listings SET listing_tier = $plan_name`
  - `customer.subscription.updated`: UPDATE `subscriptions SET status, current_period_start, current_period_end`; UPDATE `listings.listing_tier` if plan changed
  - `customer.subscription.deleted`: UPDATE `subscriptions SET status = 'canceled', canceled_at = now()`; UPDATE `listings SET listing_tier = 'free'`
  - `invoice.payment_failed`: UPDATE `subscriptions SET status = 'past_due'`; send email via Resend
  - All events: INSERT `stripe_events_processed`; INSERT `admin_audit_log`

**`stripe_events_processed` table:**

```sql
CREATE TABLE stripe_events_processed (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stripe_events_processed_event_id_idx
  ON stripe_events_processed (stripe_event_id);
```

**Reconciliation from `checkout.session.completed`:** The `metadata.listing_id` attached to the Checkout Session (set in Ticket 076) is the primary reconciliation key. Use `session.metadata.listing_id` to find the listing. Use `session.metadata.plan_id` to look up the plan and its `plan_name`.

**Listing tier update:** `listings.listing_tier` field must accept `'free'` | `'standard'` | `'premium'`. If this field does not exist or uses different values, confirm with the data model before implementing.

**RLS:** All writes use `createServiceRoleClient()` — bypasses RLS. The webhook Route Handler has no user session.

**Migration required:** Yes — `stripe_events_processed` table.

---

## API Notes

**Route Handler:** `POST /api/webhooks/stripe`

**Request:** Raw body (do not parse as JSON before signature verification); `stripe-signature` header

**Stripe signature verification:**

```typescript
const rawBody = await request.text()
const sig = request.headers.get('stripe-signature')

let event: Stripe.Event
try {
  event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
} catch (err) {
  return Response.json({ error: 'Invalid signature' }, { status: 400 })
}
```

**Response codes:**

- 200: Event processed successfully (or already processed — idempotent)
- 400: Invalid webhook signature
- 500: Processing error (logged server-side; Stripe will retry)

**Do not return 4xx for unrecognized event types** — return 200 so Stripe does not retry. Log a warning for unrecognized types.

**Event handlers (per event type):**

| Stripe event                    | Handler behavior                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | Extract `metadata.listing_id`, `metadata.plan_id`, `subscription` ID, `customer` ID. UPSERT `subscriptions`. UPDATE `listings.listing_tier`. INSERT `admin_audit_log`.                                                                                   |
| `customer.subscription.updated` | Extract `listing_id` from `subscription.metadata`. UPDATE `subscriptions.status`, `current_period_start`, `current_period_end`. If `subscription.items.data[0].price.id` changed, look up new plan and UPDATE `listings.listing_tier`. INSERT audit log. |
| `customer.subscription.deleted` | Extract `listing_id` from `subscription.metadata`. UPDATE `subscriptions.status = 'canceled'`, `canceled_at`. UPDATE `listings.listing_tier = 'free'`. INSERT audit log.                                                                                 |
| `invoice.payment_failed`        | Extract customer ID from `invoice.customer`. Look up `subscriptions` by `stripe_customer_id`. UPDATE `subscriptions.status = 'past_due'`. Send payment failure email via Resend.                                                                         |

---

## Implementation Notes

**Files to create:**

- `supabase/migrations/[timestamp]_create_stripe_events_processed_table.sql`
- `app/api/webhooks/stripe/route.ts` — webhook Route Handler
- `lib/services/billing/webhookHandlers.ts` — individual handler functions per event type (keeps route.ts clean)
- `lib/email/templates/paymentFailed.tsx` — Resend email template

**Files to modify:**

- `lib/errors/codes.ts` — no new codes needed (webhook returns raw Response, not ActionResult)
- `docs/blacqlist/architecture/environment-plan.md` — confirm `STRIPE_WEBHOOK_SECRET` is documented

**Key patterns:**

- Read the raw body with `await request.text()` BEFORE any JSON parsing — `stripe.webhooks.constructEvent()` requires the raw body string
- The route must disable Next.js body parsing: `export const config = { api: { bodyParser: false } }` — in App Router this is not needed; `request.text()` works natively
- Idempotency check must run BEFORE any DB writes: `SELECT COUNT(*) FROM stripe_events_processed WHERE stripe_event_id = $id` — if count > 0, return 200 immediately
- All DB writes in a given event handler should be wrapped in a try/catch; if any write fails, return 500 (Stripe will retry); do not partially process events
- Use `createServiceRoleClient()` for all DB writes — no user session exists in this Route Handler
- `revalidateTag` calls should happen after all DB writes succeed

**Do not:**

- Parse the request body as JSON before calling `constructEvent` — this breaks signature verification
- Use Server Actions for webhook handling — external services cannot call Server Actions
- Expose webhook processing errors in the response body — return a generic 500 with no details
- Skip idempotency — Stripe will retry failed webhooks and duplicate processing causes data corruption

---

## Acceptance Criteria

- [ ] `POST /api/webhooks/stripe` returns 400 for requests with an invalid or missing `stripe-signature` header
- [ ] `stripe_events_processed` table exists with a unique index on `stripe_event_id`
- [ ] Given the same event is received twice, the second delivery returns 200 without processing (idempotent)
- [ ] `checkout.session.completed`: subscription row is created/updated; `listings.listing_tier` is updated to the purchased plan; `admin_audit_log` entry written
- [ ] `customer.subscription.updated`: `subscriptions.status`, `current_period_end` updated; `listings.listing_tier` updated if plan changed
- [ ] `customer.subscription.deleted`: `subscriptions.status = 'canceled'`; `listings.listing_tier = 'free'`; audit log written
- [ ] `invoice.payment_failed`: `subscriptions.status = 'past_due'`; payment failure email sent via Resend to the listing owner's email
- [ ] Unrecognized event types return 200 without errors
- [ ] All DB writes use `createServiceRoleClient()` — not the anon client
- [ ] `revalidateTag` is called after listing tier changes
- [ ] Local testing with Stripe CLI (`stripe listen --forward-to ...`) passes all four event types end-to-end

---

## Failure States

| Failure                                     | Condition                                         | Behavior                                     | Recovery                                              |
| ------------------------------------------- | ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| Invalid signature                           | Stripe sends a bad signature (or non-Stripe POST) | Return 400; no DB writes                     | Stripe does not retry 400 responses                   |
| DB write fails                              | Supabase unreachable during handler               | Return 500; log error server-side            | Stripe retries with exponential backoff               |
| `metadata.listing_id` missing               | Checkout Session was created without metadata     | Log warning; return 200 (no retry)           | Manual reconciliation via admin                       |
| Email send fails (`invoice.payment_failed`) | Resend API error                                  | Log error; still return 200 (DB was updated) | Email send is non-blocking; owner can check dashboard |
| Plan not found                              | `metadata.plan_id` does not match any `plans` row | Log error; return 500; Stripe retries        | Investigate plan seed data                            |

---

## Edge Cases

- `checkout.session.completed` fires before the `subscriptions` row exists (first upgrade) — UPSERT handles this correctly; creates the row
- `customer.subscription.updated` fires with the same plan — `listings.listing_tier` is re-set to the same value (idempotent); no harm done
- `customer.subscription.deleted` fires but the listing is already on `listing_tier = 'free'` — UPDATE is idempotent; no error
- Stripe retries a previously-processed event — idempotency check catches it; returns 200 immediately
- `invoice.payment_failed` fires for a listing whose owner has deleted their account — `users` row may not exist; handle gracefully: skip email send, still update subscription status
- `checkout.session.completed` metadata has `listing_id` for a listing that has since been deleted — log warning; skip DB writes; return 200

---

## Accessibility Notes

No UI in this ticket.

---

## QA Test Cases

| #    | Scenario                        | Role | Steps                                                                      | Expected result                                                                            |
| ---- | ------------------------------- | ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| QA-1 | Invalid signature               | —    | POST to `/api/webhooks/stripe` without a valid `stripe-signature` header   | 400 response; no DB writes                                                                 |
| QA-2 | `checkout.session.completed`    | —    | Use Stripe CLI to trigger `checkout.session.completed` for a test checkout | `subscriptions` row created; `listings.listing_tier` updated to purchased plan             |
| QA-3 | Idempotency                     | —    | Use Stripe CLI to replay the same event twice                              | First delivery: processed; second delivery: 200 returned immediately; DB not written twice |
| QA-4 | `customer.subscription.deleted` | —    | Trigger subscription deletion in Stripe test mode                          | `subscriptions.status = 'canceled'`; `listings.listing_tier = 'free'`                      |
| QA-5 | `invoice.payment_failed`        | —    | Trigger `invoice.payment_failed` in Stripe test mode                       | `subscriptions.status = 'past_due'`; payment failure email sent to owner                   |
| QA-6 | Unrecognized event              | —    | POST a valid Stripe-signed payload with an unrecognized event type         | 200 response; no DB writes; warning logged                                                 |

---

## Security Notes

- Webhook signature verification is the only authentication mechanism for this Route Handler — it MUST be the first operation before any processing
- `STRIPE_WEBHOOK_SECRET` is different for local (Stripe CLI) vs. staging vs. production — each environment must have its own secret configured
- Never log the raw webhook payload to application logs — it may contain PII (customer email in invoice objects)
- The Route Handler must not be cached (`cache: 'no-store'` if applicable; Route Handlers are not cached by default in Next.js App Router)

---

## Completion Checklist

- [ ] `stripe_events_processed` table migration created
- [ ] `app/api/webhooks/stripe/route.ts` created with signature verification
- [ ] Idempotency check implemented (insert + check `stripe_events_processed`)
- [ ] `checkout.session.completed` handler: UPSERT subscriptions + UPDATE listing tier + audit log
- [ ] `customer.subscription.updated` handler: UPDATE subscriptions + UPDATE listing tier if changed + audit log
- [ ] `customer.subscription.deleted` handler: UPDATE subscriptions canceled + downgrade listing + audit log
- [ ] `invoice.payment_failed` handler: UPDATE subscriptions status + send email via Resend
- [ ] All handlers return 200 for unrecognized event types
- [ ] `createServiceRoleClient()` used for all DB writes
- [ ] `revalidateTag` called after listing tier changes
- [ ] Local end-to-end test with Stripe CLI passed
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
