# Ticket 158: A self-listed page becomes Claimed when it's approved

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 159. 160 backfills pages approved before this ships.
**Gates:** GATE-DEPLOY. GATE-MODERATION (trust ladder change, approved 2026-10-31 and written into `moderation-policy.md`). No migration, no new dependency.
**Decision record (founder, 2026-10-31):** Screen 3 **A, Claimed on approval**. Screen 5 **A, one "You manage this page" line plus Post a job everywhere**. Q3 **yes**, write an approved claim row so the 90-day Certified clock starts on the approval date.

---

## Why

Adding your own page sets `owner_user_id`, `source='owner'` and `ownership_attested=true`, but leaves `trust_tier='unclaimed'` (`lib/actions/listings/createListing.ts`). Approval only sets the status (`lib/actions/admin/approveEntity.ts`). So the owner's live page says "This listing has not yet been claimed by its owner" with a "Claim this listing" button, they can't ask for Verified (`submitVerificationRequest.ts:41`), and the 90-day Certified clock never starts because it reads `claims.reviewed_at`. Already logged in ticket 132 and `features/creators-and-influencers.md:150`.

## Scope

In:

- **`approveEntity.ts`:** select `source, ownership_attested, owner_user_id, trust_tier, entity_type` with the listing. When the page is not an event or job and `source = 'owner'`, `ownership_attested`, `owner_user_id` is set and `trust_tier = 'unclaimed'`, then on approval also:
  1. set `trust_tier = 'claimed'` in the same update as `status = 'published'`;
  2. insert an approved `claims` row: `listing_id`, `claimant_user_id = owner_user_id`, `status = 'approved'`, `reviewed_at = now`, `reviewed_by = admin`, and the evidence note "Owner-submitted page, ownership attested at submission". Read the claims table's required columns first; do not guess;
  3. upsert the `user_roles` owner row the way `approveClaim.ts` does (ignore duplicate);
  4. include `trust_tier` before/after and the claim id in the audit log row.
  If step 2 or 3 fails, the page still publishes as `claimed`; log the error and add it to the audit row so it can be fixed by hand. Do not roll back the publish.
- **Trust copy:** `TIER_DESCRIPTIONS.claimed` in `components/entity-page/EntityTrustSection.tsx` and `components/entity-page/templates/TemplateTrustPanel.tsx` becomes "The owner manages this page." (it was "has verified their identity", which isn't true for either path).
- **Shared line (5A):** one constant, `OWNER_MANAGES_LINE = "You manage this page."`, used by:
  - `lib/email/templates/entity-approved.tsx` for owner-path approvals (new optional prop `ownerManages`), followed by "You can now post a job for it." and a "Post a job" button to `/add-job`. Show the jobs line only when `jobsOpen` is on at send time;
  - `lib/email/templates/claim-approved.tsx`, same line and the same Post a job button;
  - the dashboard page header for a `claimed` page, with a "Post a job" link when Jobs is open.
- **Unit tests** for the approve path and the email props.

Out:

- Events and jobs (no trust tier change).
- Pages submitted by staff or imported (`source` other than `owner`).
- The backfill (160).

## Acceptance criteria

- Given a pending owner-submitted, attested page, when an admin approves it, then it is `published` and `claimed`, an approved claim row exists with `reviewed_at` = approval time, the owner has a `user_roles` owner row, and the audit row shows `unclaimed` to `claimed`.
- Its public page shows "The owner manages this page." and no "Claim this listing" button.
- The owner can request Verified from the dashboard.
- Given a staff-seeded page with no owner, when approved, then it stays `unclaimed` with no claim row.
- Given a job or event, approval is unchanged.
- The approved email says "You manage this page." and, with Jobs open, shows Post a job.
- The claim-approved email shows the same line and button.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Claim row insert fails | Page publishes as claimed; error logged in audit row | Founder adds the row by hand; 90-day clock starts then |
| Role insert fails | Page publishes as claimed; dashboard ownership still works by `owner_user_id` | Re-run the upsert by hand |
| Email fails | Existing behaviour (logged, approval stands) | None needed |

## Tests

- Unit `tests/approve-entity-owner-claimed.test.ts`: owner path sets claimed and writes claim + role; seeded path doesn't; job path doesn't.
- Update `tests/entity-approved-email.test.ts` and add a claim-approved email test for the shared line.
- Lint, typecheck, unit.
