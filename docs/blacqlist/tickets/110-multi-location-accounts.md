# Ticket 110 — Multi-location accounts (Premium tier)

**Phase:** V1.5 · **Priority:** P3 · **Status:** In PR — stacked on 109 (#340). Migration `20261122000000_listing_location_links.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied every read treats the missing table as "no links", so nothing changes. How it works: the page the Premium subscription is on is the primary; the owner links up to 2 more of their own business pages from Dashboard → Locations. A linked page gets the primary's tier, written by the server with the service client (the entitlement guard blocks owner tier writes), and the Stripe webhook re-syncs linked pages whenever the primary's tier changes. Dropping below Premium returns linked pages to Free and keeps the links, so they get Premium back on re-upgrade; nothing is deleted. Unlinking works on every plan and returns the page to Free, or to its own plan if it has one. Guards: one group per page (primary key), no self-links, no chains (DB trigger plus action checks), a page that pays for its own plan can't be linked, and checkout refuses a page another plan covers (409 `COVERED_BY_LOCATION`). The link table has read policies only (public when the primary is published, owner for their own) and writes revoked from anon and authenticated. Public pages show the others under Also At; the Locations dashboard shows views, saves and reviews per location and in total, each linking to that page's analytics. **Departure from the spec:** the primary is always the subscribed page, so there is no separate "owner picks primary" step; the dashboard says plainly which page covers which. Still one subscription and one price, no new Stripe products. Known gap: a sibling's Also At list refreshes on its next regeneration, not on link or unlink (the primary and the location are refreshed straight away).
**Depends on:** 105 (limit enforcement), 078 (webhook)
**Gates:** `canAccess(tier, 'multi_location')` — Premium only · limit `locationLimit(tier)` (Premium 3)

---

## Why

This is MyListing's "listings limit" concept: one subscription covering multiple listings. It is the
natural Premium upsell for a business with more than one storefront, and today a two-location owner
would have to buy two Premium subscriptions to get two listings — which reads as a penalty for being
successful, in a directory whose mission is growth.

## Acceptance criteria

- An owner on Premium can attach up to **3** listings to one subscription
- `locationLimit(tier)` enforced server-side at listing-claim and listing-create time
- All attached listings inherit the subscription's tier entitlements — the entitlement lookup
  resolves through the subscription, not per-listing
- Location switcher in the owner dashboard; analytics viewable per location **and** aggregated
- Sibling locations cross-link on the public listing page ("Also in Houston")
- Downgrade path is explicit and non-destructive: dropping below Premium keeps the primary listing
  at the new tier and returns the others to **Free** — never deletes them. Owner picks which is
  primary; if they do not, default to oldest-claimed and tell them clearly which was chosen
- Stripe: still one subscription, one price. **No new Stripe products or per-seat pricing** — this
  is an entitlement change, not a billing-model change

## Out of scope

- More than 3 locations, or a franchise/enterprise tier (revisit if demand appears — do not build
  speculatively)
- Per-location billing or separate payment methods
- Team/role permissions across locations (single owner account only)
