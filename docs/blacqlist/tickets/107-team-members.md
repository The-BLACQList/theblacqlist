# Ticket 107 — Team members block (Growth tier)

**Phase:** V1.5 · **Priority:** P3 · **Status:** Draft
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'team_members')` — Growth+ · limit `teamMemberLimit(tier)` (Growth 5, Premium unlimited)

---

## Why

Directory competitors (MyListing and equivalents) ship a team/staff block as standard package
content, and it is a meaningful trust signal for service businesses — salons, law firms, clinics,
agencies — where customers choose a *person*, not just a business. Sold in Growth; no schema today.

## Acceptance criteria

- New `listing_team_members` table: `listing_id`, `name`, `role`, `bio` (short), `photo_path`,
  `sort_order`, `created_at`, `deleted_at`. RLS mirrors the existing listing-owned child tables
  (owner writes, public reads published) — copy the pattern from `listing_faqs`, do not invent one
- Owner CRUD at `/dashboard/pages/[entityId]/team` with drag-to-reorder
- Count enforced against `teamMemberLimit(tier)` server-side
- Team block renders on the listing page, consistent with the FAQ/services block styling
- Member photos use the existing media/storage pipeline and count against **storage**, not against
  the listing's gallery `photoLimit` (they are a separate field — matching how MyListing scopes
  per-field file limits)
- Accessible: each member is a list item with a proper heading; photos have meaningful alt text or
  are marked decorative when the name is adjacent

## Out of scope

- Per-member contact details, booking, or individual profile pages
- Linking team members to platform user accounts
