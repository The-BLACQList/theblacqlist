# Ticket 070: Vendor Listing Extension Table and API

## Status
Draft

## Phase
Phase 13: Marketplace Foundation

## Priority
P3

## Feature Area
Marketplace

## Context
Vendors are a distinct listing type that can operate a storefront with products. This ticket creates the `listing_details_vendor` extension table that stores vendor-specific configuration fields, parallel to `listing_details_business`. A vendor listing has both a `listing_details_business` row AND a `listing_details_vendor` row sharing the same `listings.id`. This is the foundational migration for the marketplace feature set. Without it, Tickets 071–073 cannot be implemented.

## User Story
As a platform admin or vendor owner, I want vendor listings to carry marketplace-specific configuration (fulfillment methods, shipping, order minimums), so that the storefront page can surface accurate vendor capabilities.

## Scope
- Migration: `CREATE TABLE listing_details_vendor (...)` with FK to `listings.id`
- Fields: `listing_id` (PK + FK), `vendor_type` (text, CHECK: `'physical'`|`'digital'`|`'both'`), `fulfillment_methods` (text array: `'pickup'`|`'local_delivery'`|`'shipping'`), `min_order_amount_cents` (integer nullable), `ships_nationally` (boolean default false), `ships_to_states` (text array nullable), `accepts_custom_orders` (boolean default false), `turnaround_days` (integer nullable), `created_at`, `updated_at`
- Index: `listing_id` (unique — one row per listing)
- RLS: public SELECT on published vendor listings; INSERT/UPDATE restricted to `listings.owner_user_id = auth.uid()` (enforced via SA, not RLS alone)
- Public API endpoint: `GET /api/listings/[id]/vendor-details` — returns vendor extension data; ISR-compatible; 404 if no vendor record or listing not published
- Seed: no vendor seed data at MVP — vendors are created via the add-business form

## Out of Scope
- Product table (Ticket 071)
- Vendor storefront page (Ticket 072)
- Vendor dashboard UI
- Stripe Connect / payouts (V2)

## Dependencies
- Depends on: Ticket 009 (listings base table)

## UX Notes
- No user-facing UI in this ticket — migration and API only
- Vendor storefront page consumes this endpoint in Ticket 072

## Design Notes
Not applicable — backend migration and API only.

## Data Notes
```sql
CREATE TABLE listing_details_vendor (
  listing_id            uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  vendor_type           text NOT NULL CHECK (vendor_type IN ('physical', 'digital', 'both')),
  fulfillment_methods   text[] NOT NULL DEFAULT '{}',
  min_order_amount_cents integer,
  ships_nationally      boolean NOT NULL DEFAULT false,
  ships_to_states       text[],
  accepts_custom_orders boolean NOT NULL DEFAULT false,
  turnaround_days       integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_details_vendor_listing_id_idx ON listing_details_vendor(listing_id);
```
- RLS policy: `SELECT` allowed when `listings.status = 'published'` (join-based policy); write restricted to owner via SA
- `updated_at` trigger: reuse standard `set_updated_at()` trigger function

## API Notes
- Endpoint: `GET /api/listings/[id]/vendor-details`
- Auth: not required (public)
- Response: `{ data: { listing_id, vendor_type, fulfillment_methods, min_order_amount_cents, ships_nationally, ships_to_states, accepts_custom_orders, turnaround_days } }`
- 404 if no `listing_details_vendor` row or listing is not published
- Cache: `revalidate: 3600`, tag `listing-${id}`

## Implementation Notes
- Route handler: `app/api/listings/[id]/vendor-details/route.ts`
- Migration file: `supabase/migrations/[timestamp]_listing_details_vendor.sql`
- `fulfillment_methods` is a text array — validate that all values are in the allowed set before insert/update

## Acceptance Criteria
- [ ] `listing_details_vendor` table created with correct schema and constraints
- [ ] `GET /api/listings/[id]/vendor-details` returns correct data for a published vendor listing
- [ ] `GET /api/listings/[id]/vendor-details` returns 404 for an unpublished listing
- [ ] `GET /api/listings/[id]/vendor-details` returns 404 if no vendor extension row exists
- [ ] Migration is idempotent (running twice does not error)
- [ ] `updated_at` trigger fires on row update

## Failure States
| Failure | User-visible behavior |
|---|---|
| Vendor record not found | 404 JSON response |
| Listing unpublished | 404 JSON response (same as not found — do not reveal status) |
| DB query error | 500 with generic error message |

## Edge Cases
- Listing with `listing_type = 'business'` that has no `listing_details_vendor` row — 404 correctly
- `ships_to_states` with empty array vs null: treat both as "no state restrictions defined"
- `fulfillment_methods` empty array: valid — vendor hasn't configured methods yet

## Accessibility Notes
Not applicable — backend migration and API only.

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Valid vendor details | Visitor | GET /api/listings/[vendor-id]/vendor-details | 200 with correct vendor fields |
| 2 | Non-vendor listing | Visitor | GET /api/listings/[non-vendor-id]/vendor-details | 404 |
| 3 | Unpublished vendor | Visitor | GET /api/listings/[draft-vendor-id]/vendor-details | 404 |
| 4 | Missing row | Visitor | GET for vendor listing with no listing_details_vendor row | 404 |

## Security Notes
- Public endpoint — no auth required; only published vendor data returned
- Write operations go through Server Actions with ownership enforcement — not exposed via this route

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Migration tested on staging Supabase project
- [ ] API endpoint tested with curl / REST client
- [ ] PR opened and linked to this ticket
