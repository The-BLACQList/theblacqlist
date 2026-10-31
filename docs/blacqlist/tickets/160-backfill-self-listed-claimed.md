# Ticket 160: Move existing self-listed live pages to Claimed, and say 3 to 5 days everywhere

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 158 merged (so new approvals don't need the backfill).
**Gates:** **GATE-DATA.** Read-only count on staging first, then prod only on the founder's word (plan approval is not permission to read prod). Apply staging, verify, then prod by the Management API helper. GATE-DEPLOY for the copy change.
**Decision record (founder, 2026-10-31):** Q1 **3 to 5 business days** everywhere. Q2 **yes**, move existing self-listed, approved pages to Claimed. Q3 **yes**, with an approved claim row.

---

## Why

158 only changes new approvals. Pages approved before it stay `unclaimed` with the wrong trust panel and no Verified path. Separately, the add-business finish page promises "1–3 business days" while the dashboard, claim pages and job flow say 3 to 5.

## Scope

In:

- **Count first (read-only), staging then prod:** listings where `source = 'owner'`, `ownership_attested`, `owner_user_id is not null`, `trust_tier = 'unclaimed'`, `status = 'published'`, `deleted_at is null`, `entity_type not in ('event','job')`. Also count how many of those already have a pending claim by someone else (report the number, don't resolve them here; 159 blocks approving them).
- **Backfill script** `supabase/backfills/20261101_self_listed_claimed.sql` (one transaction, not a migration):
  - set `trust_tier = 'claimed'` on those rows;
  - insert an approved `claims` row per page with `claimant_user_id = owner_user_id`, `reviewed_at = published_at` (so the 90-day clock counts from when it went live, per Q3), `reviewed_by` null and the note "Backfill 2026-11: owner-submitted page";
  - upsert the `user_roles` owner row;
  - one `audit_log` row per page with before/after.
  Runs as the service role (passes the owner guard trigger).
- **Down plan** (in the PR body, not run automatically): for rows tagged by the backfill note, set `trust_tier` back to `unclaimed` where it is still `claimed`, and delete the backfill claim rows. Leave `user_roles` rows (harmless; ownership is already `owner_user_id`).
- **Copy (Q1):** `app/add-business/submitted/page.tsx:88` "1–3 business days" becomes "3 to 5 business days". Leave Verified (2 to 3 days), receipts and contact page; those are other queues.

Out:

- Pages that are drafts or pending (158 handles them on approval).
- Pending claims by other people on these pages (report the count; the founder decides).

## Acceptance criteria

- Staging count reported by ID count only, no names or emails.
- After staging apply: count of matching `unclaimed` rows is 0, each has one approved claim row, spot-check one page's trust panel reads "The owner manages this page."
- Prod: the same, only after the founder says go; before and after counts in the decision log.
- `/add-business/submitted` says 3 to 5 business days.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Script errors mid-way | Transaction rolls back, nothing changes | Fix and re-run |
| Wrong rows touched | Caught by the before/after count | Down plan |

## Tests

- Run the count before and after on staging; record numbers in the PR.
- Lint, typecheck, unit for the copy change.
