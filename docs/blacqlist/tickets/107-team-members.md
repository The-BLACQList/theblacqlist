# Ticket 107 — Team members block (Growth tier)

**Phase:** V1.5 · **Priority:** P3 · **Status:** In PR — stacked on 186 (#338). Migration `20261120000000_listing_team_members.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page read is fail-soft (no team block) and the dashboard Team page says it couldn't load. Scope notes: members are hard-deleted (no other owner-edited child table soft-deletes; a removed person shouldn't linger), so there is no `deleted_at`. One founder a page, enforced by a unique partial index; marking a new founder clears the old one. Reorder is native drag plus Move Up/Down buttons (no drag library in the codebase). The plan limit is checked on add only; edit, reorder and remove work on every plan, and the page shows the first ones the plan allows. A Free or Starter owner is offered Growth (not Starter) when Growth is open. Photos upload with `media_role=team` and never count toward the plan's photos.
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
