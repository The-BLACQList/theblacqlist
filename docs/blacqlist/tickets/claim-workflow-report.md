# Claim Workflow — Implementation Report

**Date:** 2026-05-11
**Status:** Complete — TypeScript zero errors, lint zero errors

---

## What Was Built

The full claim workflow for BLACQList Pages, allowing a business owner or authorized representative to submit a claim request for an unclaimed listing. Claims enter a pending state and require admin review before ownership is granted.

---

## Routes Created

| Route | Type | Description |
|---|---|---|
| `/claim` | Server Component (public) | Search for a business to claim; shows results linked to the form page |
| `/claim/[listingId]` | Server Component (auth-gated) | Claim form for a specific listing by UUID; redirects to sign-in if unauthenticated |
| `/account/claims` | Server Component (auth-gated) | List of all claims submitted by the signed-in user with status and withdraw action |

---

## Files Created

| File | Description |
|---|---|
| `lib/actions/claims/createClaim.ts` | Server action — validates input, checks DB guards, inserts claim, writes to moderation_queue and analytics_events |
| `lib/actions/claims/withdrawClaim.ts` | Server action — verifies ownership and status, updates claim to withdrawn |
| `components/claim/ClaimSearchForm.tsx` | Client component — search input, pushes to `/claim?q=...` |
| `components/claim/ClaimForm.tsx` | Client component — `useActionState`-based form with success and error states |
| `components/claim/ClaimWithdrawButton.tsx` | Client component — confirm dialog + `useActionState`-based withdraw form |
| `app/(public)/claim/page.tsx` | Public claim search/landing page |
| `app/(public)/claim/[listingId]/page.tsx` | Claim form page with auth guard, already-claimed, and existing-claim states |
| `app/account/claims/page.tsx` | Account claims list with status badges and withdraw action |

---

## Files Modified

| File | Change |
|---|---|
| `components/entity-page/EntityTrustSection.tsx` | Claim link now points to `/claim/${entity.id}` (was `/claim`) |
| `app/account/page.tsx` | Added "My claims" navigation link between Saved and Settings |
| `lib/supabase/types.ts` | Added `verification_email`, `verification_phone`, `role_at_business` to `claims` Row / Insert / Update types |

---

## Database Tables Written

| Table | Operation | Notes |
|---|---|---|
| `claims` | INSERT | `listing_id`, `claimant_user_id`, `status = 'pending'`, `verification_email`, `verification_phone`, `role_at_business`, `notes` |
| `claims` | UPDATE | `status = 'withdrawn'` only by `claimant_user_id` |
| `moderation_queue` | INSERT (service role) | `entity_type = 'claim'`, `queue_type = 'claim_review'` — triggers admin review |
| `analytics_events` | INSERT (service role, fire-and-forget) | `event_name = 'claim_submitted'` with `listing_id` and `has_verification_email` |

---

## Permission Model

| Action | Who | Guard |
|---|---|---|
| Submit a claim | Any authenticated user | `supabase.auth.getUser()` |
| View own claims | Claimant only | `WHERE claimant_user_id = user.id` (RLS + service-layer) |
| Withdraw a claim | Claimant only, pending/under_review only | `WHERE id = claim_id AND claimant_user_id = user.id` + status check |
| Approve/reject a claim | Admin only | Not built — admin queue dependency (see below) |
| See proof fields (`verification_email`, `verification_phone`, `verification_doc_paths`) | Never exposed publicly | Not returned in any public-facing query; only in claimant's own account view (not yet shown) |

---

## Security Notes

- **No self-approval**: `trust_tier` is never changed by this workflow. Only admin approval (ticket [041](041-admin-claim-review-approve-reject.md)) can change `trust_tier` from `unclaimed` to `claimed`.
- **No automatic ownership grant**: Claim status stays `pending` until explicitly reviewed.
- **Proof isolation**: `verification_email`, `verification_phone`, and `verification_doc_paths` are not returned in the public listing query or the entity page. Only accessible server-side by the claimant's own queries and admin service-role queries.
- **Rate limiting**: Blocked at 3 open claims per user per 24 hours to prevent spam.
- **Duplicate claim block**: A user cannot submit a second claim for the same listing while one is `pending` or `under_review`.
- **Ownership double-check**: The server action re-confirms `trust_tier = 'unclaimed'` and `status = 'active'` immediately before inserting — not just at page load.

---

## DB Migration Required

The three new columns (`verification_email`, `verification_phone`, `role_at_business`) have been added to the TypeScript types file but require a database migration before the claim form will write correctly:

```sql
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS verification_email text,
  ADD COLUMN IF NOT EXISTS verification_phone text,
  ADD COLUMN IF NOT EXISTS role_at_business text
    CHECK (role_at_business IN ('owner', 'manager', 'authorized_agent'));
```

This migration should be run as part of the next database change batch before the claim workflow goes live.

---

## Document Upload

Claim proof document upload is **stubbed** — the form has no file input at MVP. The `verification_doc_paths` column exists in the database schema but is not written by the current implementation. This is intentional per MVP scope. See ticket [035](035-claim-form-doc-upload.md) for the full upload implementation.

---

## Admin Dependency

The claim workflow is complete on the user-facing side. The admin side requires:

- **Ticket [040](040-admin-claims-queue.md)**: Admin claims queue — lists all `pending` and `under_review` claims
- **Ticket [041](041-admin-claim-review-approve-reject.md)**: Admin claim review — approve (sets `trust_tier = 'claimed'` on the listing and `status = 'approved'` on the claim) or reject (sets `status = 'rejected'`, stores `rejection_reason`)

Until those tickets are complete, all submitted claims will sit in `moderation_queue` with no admin action possible through the UI.

---

## Verification Steps

```bash
pnpm tsc --noEmit   # 0 errors
pnpm lint           # 0 errors
```

Manual test flow:
1. Visit an entity page with `trust_tier = 'unclaimed'` → "Claim this listing" link leads to `/claim/[listing.id]`
2. Sign out → clicking claim link redirects to `/sign-in?next=/claim/[id]` → after sign-in, lands on claim form
3. Sign in → fill form (email, role, optional phone and notes) → submit → success state shown → claim row in DB with `status = pending`, moderation_queue row created
4. Visit `/account/claims` → claim appears with "Pending review" badge and "Withdraw claim" button
5. Click "Withdraw claim" → confirm dialog → status updates to `withdrawn`, button replaced with "Withdrawn"
6. Try to claim the same listing again → blocked with "You already have a pending claim" message
7. Visit `/claim` → search by business name → results with "Claim" buttons for unclaimed, "Already claimed" badge for others

---

## Next Recommended Tickets

1. **[040] Admin claims queue** — surface `pending` and `under_review` claims to admin
2. **[041] Admin claim review** — approve/reject UI that changes `trust_tier` and notifies the claimant
3. **[035] Claim proof document upload** — allow claimant to upload a supporting document with their claim
4. **Auth-aware header** — signed-in users should see "My Account" and "Sign Out" instead of "Sign In" and "Sign Up" (see existing plan file)
