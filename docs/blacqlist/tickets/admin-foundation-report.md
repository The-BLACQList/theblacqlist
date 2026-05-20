# Admin Foundation Report

**Date:** 2026-05-11  
**Built by:** Claude Code (backend-build-loop + frontend-build-loop)  
**Status:** Complete — zero TypeScript errors, zero lint errors

---

## What Was Built

The admin dashboard foundation for The BLACQList. This covers all protected admin routes, role-checking infrastructure, entity/claim moderation actions, and the supporting UI.

---

## Routes Created

| Route | Type | Purpose |
|---|---|---|
| `/admin` | Server Component | Overview dashboard — stat cards, recent queue, quick links |
| `/admin/entities` | Server Component | Paginated entities table with status filter tabs |
| `/admin/entities/[id]` | Server Component | Entity detail with listing info, business details, approval actions |
| `/admin/claims` | Server Component | Paginated claims table with status filter tabs |
| `/admin/claims/[id]` | Server Component | Claim detail with claimant info, listing info, approval actions |
| `/admin/verification` | Server Component | Placeholder — verification queue (next ticket) |
| `/admin/reviews` | Server Component | Placeholder — review moderation (next ticket) |
| `/admin/reports` | Server Component | Placeholder — reports & corrections (next ticket) |
| `/admin/analytics` | Server Component | Placeholder — platform analytics (next ticket) |

All routes are wrapped by `app/admin/layout.tsx`, which calls `requireAdmin()` before rendering any children. Non-admin users are redirected to `/sign-in?next=/admin` or `/` before the page renders.

---

## Files Created

### Auth Guard
- `lib/admin/guard.ts` — `requireAdmin()` (redirects), `getAdminSession()` (returns null), `writeAuditLog()`

### Server Actions
- `lib/actions/admin/approveEntity.ts` — approve listing, set `status='published'`, resolve queue
- `lib/actions/admin/rejectEntity.ts` — reject listing, require reason, resolve queue
- `lib/actions/admin/approveClaim.ts` — approve claim (no self-approval), update listing trust_tier+owner, grant owner role, resolve queue
- `lib/actions/admin/rejectClaim.ts` — reject claim, require reason, resolve queue
- `lib/actions/admin/updateVerificationStatus.ts` — approve/reject verification, update trust_tier

### UI Components
- `components/admin/AdminSidebar.tsx` — dark sidebar with 7 nav items, role badge, active link detection
- `components/admin/AdminStatCard.tsx` — count cards with urgent styling (amber when count > 0)
- `components/admin/AdminStatusBadge.tsx` — color-coded badges for all status values
- `components/admin/EntityApprovalActions.tsx` — approve/reject form pair for listings
- `components/admin/ClaimApprovalActions.tsx` — approve/reject form pair for claims

### Pages
- `app/admin/layout.tsx` — shared layout with sidebar, robots noindex
- `app/admin/page.tsx` — overview with 5 parallel DB queries
- `app/admin/entities/page.tsx` — 25/page paginated table, status tabs
- `app/admin/entities/[id]/page.tsx` — entity detail with two-column layout
- `app/admin/claims/page.tsx` — 25/page paginated table, status tabs, claimant name resolution
- `app/admin/claims/[id]/page.tsx` — claim detail with two-column layout
- `app/admin/verification/page.tsx` — placeholder
- `app/admin/reviews/page.tsx` — placeholder
- `app/admin/reports/page.tsx` — placeholder
- `app/admin/analytics/page.tsx` — placeholder

---

## Admin Role Model

Admin access is enforced via the `user_roles` table — NOT via JWT custom claims.

```
user_roles.role IN ('admin', 'super_admin')
```

**Check flow:**
1. `middleware.ts` — validates session exists (Edge Runtime, no DB query)
2. `requireAdmin()` — queries `user_roles` via `serviceClient`, redirects non-admins
3. Server actions call `getAdminSession()` — returns null if not admin, returns error from action
4. Supabase RLS — last-line database enforcement

**No JWT role claims required.** The `serviceClient` (service role key) bypasses RLS to query `user_roles` server-side.

---

## Actions Implemented

### `approveEntityAction`
- Guard: `getAdminSession()` + listing must be in `pending` state
- Writes: `listings.status = 'published'`, `published_at`, `moderation_notes`, `last_admin_updated_at`
- Resolves: `moderation_queue` entry for `entity_id` + `queue_type='new_submission'`
- Audits: `void writeAuditLog(...)` — fire-and-forget

### `rejectEntityAction`
- Guard: reason required (5–500 chars)
- Writes: `listings.status = 'rejected'`, `moderation_notes`, `last_admin_updated_at`
- Resolves queue, writes audit log

### `approveClaimAction`
- Guard: `claim.claimant_user_id !== admin.user.id` — **self-approval is blocked**
- Sequential writes (no true transaction available via Supabase client):
  1. `claims.status = 'approved'`, `reviewed_by`, `reviewed_at`
  2. `listings.trust_tier = 'claimed'`, `owner_user_id = claimant_user_id`
  3. If listing update fails: rollback claim to `pending` (best-effort)
  4. `user_roles` INSERT with `role='owner'` (ignores duplicate errors)
  5. Resolve `moderation_queue` entry
- Audits before/after state snapshot

### `rejectClaimAction`
- Reason required (5–500 chars)
- Writes `claims.rejection_reason`, resolves queue, audits

### `updateVerificationStatusAction`
- Decision: `'verified'` | `'rejected'`
- Listing must not be `unclaimed`
- On approval: `trust_tier = 'verified'`, `verified_at`, `verified_by`

---

## RLS Assumptions

The admin pages use `createServiceClient()` (service role key) for all data fetches. This **bypasses RLS** by design — admins need to see all records regardless of ownership rules.

RLS policies protect user-facing routes. Admin routes are protected by the server-side role check in `requireAdmin()`. The two layers are:
- **Admin routes**: `requireAdmin()` guard → `serviceClient` reads
- **User routes**: `createClient()` (session-aware) → RLS-gated reads

**RLS is NOT relied on as the admin access boundary.** `requireAdmin()` is the boundary.

---

## Security Notes

1. **No self-approval.** `approveClaimAction` explicitly checks `claim.claimant_user_id !== admin.user.id`.
2. **No automatic ownership.** `trust_tier` only changes via explicit admin action. The claim workflow sets status to `pending` — nothing happens until an admin approves.
3. **Audit log on every mutation.** `writeAuditLog` is called after every successful approve/reject action with before/after state snapshots. The `admin_audit_log` table has a DB trigger preventing UPDATE/DELETE (immutable log).
4. **Admin routes are not indexed.** Layout sets `robots: { index: false, follow: false }`.
5. **Service role key is server-only.** `createServiceClient()` is only called in Server Components and server actions — never exposed to the client.
6. **Atomicity limitation.** `approveClaim` performs sequential DB writes. If the listing update fails after the claim update succeeds, a best-effort rollback is attempted. This is a known limitation of using the Supabase JS client without a DB transaction. A Postgres function (RPC) would make this atomic — deferred to a future hardening ticket.

---

## Tests Needed

| Scenario | What to verify |
|---|---|
| Non-admin visits `/admin` | Redirected to `/` or `/sign-in` |
| Unauthenticated visit to `/admin` | Redirected to `/sign-in?next=/admin` |
| Admin approves pending entity | `listings.status = 'published'`, queue entry resolved, audit log row created |
| Admin rejects entity without reason | Action returns error, no DB write |
| Admin approves own claim | Action returns error "You cannot approve a claim you submitted." |
| Approved claim | `claims.status = 'approved'`, `listings.trust_tier = 'claimed'`, `listings.owner_user_id` set, `user_roles` row inserted |
| Rejected claim | `claims.status = 'rejected'`, `rejection_reason` stored |
| Entity already published — approve again | Action returns "This listing is not pending review." |
| TypeScript | `pnpm tsc --noEmit` — zero errors ✅ |
| Lint | `pnpm lint` — zero errors ✅ |

---

## DB Migration Needed

The `lib/supabase/types.ts` was manually updated in the claim workflow to add three missing `claims` columns. These must be added via migration before the claim workflow can be tested in production:

```sql
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS verification_email text,
  ADD COLUMN IF NOT EXISTS verification_phone text,
  ADD COLUMN IF NOT EXISTS role_at_business text
    CHECK (role_at_business IN ('owner', 'manager', 'authorized_agent'));
```

---

## Next Ticket Recommendations

| Priority | Ticket | Reason |
|---|---|---|
| P1 | Run the DB migration for `claims` columns | Required for claim workflow to function |
| P1 | Admin verification queue (`/admin/verification`) | Currently a placeholder; `moderation_queue` rows with `queue_type='verification'` have no review UI |
| P2 | Admin reports queue (`/admin/reports`) | Corrections and flagged listings have no review UI |
| P2 | Admin reviews moderation (`/admin/reviews`) | User reviews have no moderation UI |
| P2 | Atomicity hardening for `approveClaim` | Replace sequential writes with a Postgres RPC for true atomicity |
| P3 | Admin analytics dashboard (`/admin/analytics`) | Placeholder — requires `analytics_events` aggregation queries |
| P3 | Admin collections and category management | Tickets 043–044 exist but not yet built |
