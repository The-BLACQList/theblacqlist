# Ticket 108 — Coupons & deals (Premium tier) (shipped on main as Deals)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Shipped — main merged **coupons and deals** (PR #328, owner-experience round 2 part G, 2026-11-13). 184 samples it on `/example/*`. The deltas below are recorded, not planned.
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'coupons')` — Premium only

---

## What shipped (#328)

- `listing_deals` (migration `20261117000000_listing_deals.sql`): title, description, code (optional), terms, `starts_at`, `ends_at` (optional), `status draft|active|ended`. RLS like `listing_posts`: the public reads live deals on published pages; owners read and write their own.
- `lib/listings/deals.ts` (`PublicDeal`, `shownDeals`, `parseDeal`, `dealEndsLabel`, caps `DEALS_ON_MAX` 10 on at once and `DEALS_SAVED_MAX` 30 saved); `lib/actions/dashboard/deals.ts` with `checkDealAdd` (Premium only to turn a deal on; drafts, end and delete always work).
- Deals card on the edit page's Services tab (`/edit#deals`); `components/entity-page/EntityDeals.tsx` after At a Glance on all three templates, with a `deals` anchor tab; "Copy code" (`DealCodeButton`) records `deal_code_copied`.
- A "Has deals" Discover filter (Premium pages with a live deal).
- Flag `FEATURE_COUPONS` (on in Preview, off in production); production also needs the migration (GATE-DATA).

## Deltas from the original criteria below (recorded; no decision needed now)

- No `discount_type`/`discount_value`, `redemption_count` or `deleted_at`; deals end or are deleted instead.
- The editor is a card on the edit page, not `/dashboard/pages/[entityId]/deals`.
- A Discover filter instead of a separate `/deals` index.
- The intent signal is the `deal_code_copied` analytics event, not a counter. Whether owner analytics shows deal performance: `[Unknown]` — nothing on main reads the event yet besides the button that sends it.
- Moderation: `parseDeal` refuses links in the text; whether deals go through the moderation queue: `[Unknown]`, not checked here.

## Why

Premium's job is to drive measurable customer action, not just visibility. A deal is the clearest
proof-of-value a directory can give an owner: it converts a listing view into a walk-in, and it is
the thing an owner can point at when deciding whether $99/mo is working. It also feeds the
community-spend and flow-map story — a redeemed coupon is an attributable dollar.

## Acceptance criteria (original, 2026-07)

- New `listing_coupons` table: `listing_id`, `title`, `description`, `code` (nullable — some deals
  are show-this-screen), `discount_type` (`percent` | `amount` | `custom`), `discount_value`,
  `starts_at`, `expires_at`, `terms`, `redemption_count`, `status`, `deleted_at`. RLS follows the
  existing listing-owned child pattern
- Owner CRUD at `/dashboard/pages/[entityId]/deals`
- Deal block on the listing page; expired deals auto-hide (query-level, not client-filtered)
- A `/deals` public index with city + category filters, reusing faceted discovery
- **Redemption tracking**: a "show this deal" / reveal-code interaction increments
  `redemption_count`. This is an *intent* signal, not a verified redemption — label it that way in
  the owner dashboard ("Deal views" / "Codes revealed"), never as confirmed revenue. Per the
  no-fabrication rule, do not present it as attributed spend
- Deal performance appears in owner analytics for Premium
- Moderation: deals route through the existing moderation queue — a deal is public-facing copy and
  `GATE-MODERATION` applies

## Out of scope

- Verified/POS-integrated redemption
- Platform-funded discounts or any BLACQList-side subsidy
- Automatic tie-in to receipt uploads (revisit once redemption data exists)
