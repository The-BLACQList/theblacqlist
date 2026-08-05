# Ticket 110 — Multi-location accounts (Premium tier)

**Phase:** V1.5 · **Priority:** P3 · **Status:** Draft
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
