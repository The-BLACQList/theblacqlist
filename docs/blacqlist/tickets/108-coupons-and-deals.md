# Ticket 108 — Coupons & deals (Premium tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Draft
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'coupons')` — Premium only

---

## Why

Premium's job is to drive measurable customer action, not just visibility. A deal is the clearest
proof-of-value a directory can give an owner: it converts a listing view into a walk-in, and it is
the thing an owner can point at when deciding whether $99/mo is working. It also feeds the
community-spend and flow-map story — a redeemed coupon is an attributable dollar.

## Acceptance criteria

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
