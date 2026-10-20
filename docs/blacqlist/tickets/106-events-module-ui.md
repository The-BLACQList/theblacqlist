# Ticket 106 — Owner events on business pages (Growth tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Done (PR open, merges after the flip)
**Depends on:** 105 (limit enforcement), 119 (Free and Starter limits)
**Gates:** `canAccess(tier, 'events')`, Growth and up · limit `eventLimit(tier)` (Growth 3 active, Premium unlimited)

---

## Why

The Growth plan lists "Events (up to 3 active)". The public side of events was already built:
`/events` lists published events through the shared discovery query, each event has its own page
(`/[city]/event/[slug]`) with date, place, host link, add to calendar and `Event` structured data,
and a host's page shows its upcoming events. What was missing was the owner side: no place in the
dashboard to see, start or take down the events a page hosts, and the events gate only ran at
review time, not when the draft was created.

## What this ticket builds

- **Events tab** at `/dashboard/pages/[entityId]/events`, linked from the page sidebar after
  Offerings. It lists the events this page hosts (`listing_details_event.organizer_listing_id`)
  that the signed-in owner owns. Upcoming are soonest first; past sit in a closed "Past events (N)"
  section. Each row shows a plain status (Live, In review, Draft, Not approved, Ended, Unpublished)
  and the date, with View and Unpublish for live events and Edit for all.
- **New event** at `/dashboard/pages/[entityId]/events/new` reuses the `/add-event` form
  (`SubmitEventForm`) with the page fixed as host. The form shows "Hosted by {page}" and sends the
  host id; after the draft is saved the owner lands in the event's own editor.
- **Edit** is the event's existing editor (`/dashboard/pages/[eventId]/edit`). **Unpublish** calls the
  same `updateListingStatus` action as that editor.
- **Gate at create.** `createListing` now refuses an event below Growth when paid postings are on,
  and fails closed when the plan cannot be read. It also checks that the host page belongs to the
  owner and is not an event or a job ("That page could not host this event. Start it again from
  your page."). The review step (`submitListingForReview`) still checks the active-event cap.
- **Allowance on the tab.** "1 of 3 active events used. 2 left." on Growth, "Your plan includes
  unlimited events." on Premium.
- **Below Growth** the tab explains the plan instead of hiding the button: "Events come with the
  Growth plan. Post up to 3 at a time, and each one shows on this page and on Events."
- **Past events leave the site on their own.** The nightly expiry cron
  (`app/api/cron/expiry/route.ts`) runs `unpublishPastEvents`, which moves a published event to
  `unpublished` once its end time has passed, or 24 hours after it starts when it has no end, and
  writes an `event_ended` audit row. Nothing is deleted. The tab uses the same rule
  (`lib/events/eventOver.ts`), so an event never shows as Upcoming after the site has taken it down.

## Decisions recorded here

- **No upgrade promise while Growth is not for sale (D-M).** The gate messages never say
  "Upgrade". The tab shows a "See the Growth plan" link only when `isPlanPurchasable` says Growth can
  be bought; otherwise it adds "Growth is not for sale yet."
- **The cap is per owner, not per page.** `eventQuotaFor` uses the owner's best tier across their
  pages and counts pending and published events created since `EVENT_LIMIT_ENFORCED_FROM`. This is
  how the limit already works in prod for `/add-event`, and an owner with two Growth pages posting
  "3 events" each would be a pricing change. Kept as is.
- **Unpublish returns an event to draft.** Owner-created events stay `unclaimed`, and the owner
  status guard (`20260926000000_listings_entitlement_guard.sql`) only lets a claimed listing go
  straight from draft to published. So putting an event live again goes through review, where the
  cap is checked. There is no way around the cap by unpublishing and republishing.
- **Other owners' events naming this page are not shown.** The event read policy lets anyone see
  published events, so the tab filters by `owner_user_id`.

## Acceptance criteria

- [x] Owner sees the events their page hosts, upcoming first, past collapsed
- [x] New starts an event with the page as host; Edit opens the event editor; Unpublish takes a live
      event down and the list refreshes
- [x] Free and Starter owners see the plan note, not a hidden button; no "Upgrade" copy while
      Growth is not for sale
- [x] Allowance line on Growth and Premium
- [x] Create refuses below Growth and fails closed on a plan read error (`tests/create-event-gate.test.ts`)
- [x] A host id the owner does not own, or an event or job as host, is refused
- [x] Past events are unpublished nightly, never deleted, with an audit row (`tests/expiry-sweeps.test.ts`)
- [x] One "is it over" rule for the sweep and the tab (`tests/owner-events.test.ts`)
- [x] Public `/events` list, event detail page, host events block, add to calendar and `Event`
      JSON-LD (already built before this ticket)
- [ ] On the Preview: a Growth owner creates, edits and unpublishes an event; a Starter owner sees
      the plan note (manual check before merge)

## Release note

Once merged, the first nightly run unpublishes any events in prod whose dates have passed. They stay
in the owner's dashboard under Past events.

## Out of scope

- Ticketing, RSVPs or payments (V2, and would go through Stripe Connect, not built)
- Paid event promotion (`monetization-spec.md` "Later Revenue Streams")
- Recurring events
