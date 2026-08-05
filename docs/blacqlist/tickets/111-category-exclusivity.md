# Ticket 111 — Category exclusivity (Premium tier)

**Phase:** V1.5 · **Priority:** P3 · **Status:** Draft
**Depends on:** 105 (limit enforcement), 077 (sponsored placements)
**Gates:** `canAccess(tier, 'category_exclusivity')` — Premium only

---

## Why

Scarcity is the only Premium benefit that a competitor cannot buy their way past, which makes it the
strongest anchor for the $99 tier. It is also **inventory-constrained revenue** — the same economics
as Sponsored Spotlight — so it scales with audience rather than with subscriber count.

## Fairness constraint — read before designing

Exclusivity means one business gets a benefit another is denied, so the rules must be mechanical and
published, never discretionary:

- **First-come, first-served** on availability, with a visible waitlist
- One category × one city per Premium subscription — an owner cannot corner multiple categories
- Slot released automatically on downgrade, lapse, or non-renewal, and the waitlist advances
- **Availability and holder are publicly visible** on the category page — no hidden pay-to-win
- Exclusivity affects **the exclusive slot only**. It must not suppress, downrank, or hide any other
  business's listing. Competitors remain fully listed and searchable
- Applies identically regardless of ownership label (Black-Owned / Certified Black-Owned / Ally),
  consistent with the rest of the ladder

## Acceptance criteria

- New `category_exclusives` table: `listing_id`, `category_id`, `city_id`, `subscription_id`,
  `starts_at`, `ends_at`, `status`. Unique constraint on (`category_id`, `city_id`) where active —
  enforce at the DB level, not in application code
- Self-serve claim flow in the dashboard showing availability, and a waitlist join when taken
- Exclusive listing gets a labeled slot at the top of the category × city page — **clearly marked**,
  matching the "no dark patterns" rule in `PRD.md`
- Auto-release on subscription lapse, wired into the webhook (078); waitlist notified via Resend
- Admin view of all active exclusives and the waitlist
- Copy explains plainly what exclusivity does and does not do — the fairness constraints above,
  stated to customers, not just documented internally

## Out of scope

- Auctioning or dynamic pricing for contested categories
- Exclusivity across multiple cities on one subscription
- Any suppression of competing listings
