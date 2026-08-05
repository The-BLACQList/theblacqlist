# Ticket 106 — Events module UI (Growth tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Draft
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'events')` — Growth+ · limit `eventLimit(tier)` (Growth 3 active, Premium unlimited)

---

## Why

`/events` is a **SHELL** (`current-state-audit.md`) — static UI, no data — but the backing entity
already exists (`20260622000007_event_entity.sql`). The Growth tier now sells "Events (up to 3
active)", so this is a promised entitlement with no surface. Closest-to-done item in the Growth tier.

## Acceptance criteria

- `/events` lists published, upcoming events with city + category filters, reusing the existing
  faceted discovery patterns rather than a new filter implementation
- `/events/[slug]` detail page: title, date/time, location, description, host listing link, add-to-calendar
- Owner CRUD under `/dashboard/pages/[entityId]/events` — create, edit, unpublish
- Active-event count enforced against `eventLimit(tier)` in the server action; Free and Starter get
  the upgrade prompt, not a hidden button
- Events appear on the host's listing page as a block, consistent with the FAQ/services blocks
- Past events auto-hide from public listings without being deleted
- Empty state matches the `/guides` pattern ("coming soon" only when genuinely empty)
- SEO: `Event` structured data on the detail page

## Out of scope

- Ticketing, RSVPs, or payments (V2 — and would route through Stripe Connect, not built)
- Paid event promotion (`monetization-spec.md` "Later Revenue Streams")
- Recurring events
