# Ticket 159: A claim can never take a page from its owner

**Phase:** V1.5 · **Priority:** P0 · **Status:** Ready
**Depends on:** none. Build first.
**Gates:** GATE-DEPLOY (merge on the founder's word). No migration, no new dependency.
**Decision record (founder, 2026-10-31):** owner path workshop. This fix ships whatever the picks; it was listed as "fixed whatever you pick" on the canvas.

---

## Why

`[Observed — repo at main 1d2f688]`

- `lib/actions/claims/createClaim.ts` accepts a claim on any published page whose `trust_tier` is `unclaimed`. A self-listed page is `unclaimed` and already has `owner_user_id` set, so a stranger can claim it.
- `lib/actions/admin/approveClaim.ts` then sets `owner_user_id = claimant` with no check. One approval click by a moderator takes the page from the person who listed it.
- Ticket 158 makes self-listed pages `claimed` on approval, which closes most of the door. This ticket closes it in code, for every page, including drafts and pages approved before 158 and the 160 backfill.

## Scope

In:

- **`createClaim.ts`:** select `owner_user_id` with the listing. If it is set and is not the claimant, refuse with `ALREADY_OWNED` and the message "This page already has an owner. If you think that's wrong, contact us." If it is the claimant, refuse with `ALREADY_YOURS` and "You already manage this page." plus the dashboard link the form already uses for success. No claim row, no queue item, no email.
- **`approveClaim.ts`:** before any write (claim update, listing update, role insert), if `listing.owner_user_id` is set and differs from `claim.claimant_user_id`, refuse with `OWNER_CONFLICT`. Nothing changes; the claim stays `pending`. The admin sees "This page already has a different owner. Reject the claim, or ask the founder before changing who owns it." If the owner is the claimant, approve as today.
- **Unit tests** in `tests/claim-ownership-guard.test.ts` with the Supabase client mocked the same way `tests/claim-review-service-insert.test.ts` does.

Out:

- An admin "transfer ownership" action. If a real dispute comes up, the founder decides and it is done by hand with an audit row.
- Changing the claim form UI beyond showing the returned message.

## Acceptance criteria

- Given a published, `unclaimed` page owned by user A, when user B submits a claim, then it is refused with `ALREADY_OWNED` and no claim row exists.
- Given the same page, when user A submits a claim, then it is refused with `ALREADY_YOURS`.
- Given a seeded page with no owner, when user B claims it, then it works as today.
- Given a pending claim by B on a page that has since gained owner A, when an admin approves it, then `OWNER_CONFLICT` is returned, the claim is still `pending`, `owner_user_id` is still A, and no `user_roles` row is added for B.
- Given a pending claim by A on a page owned by A, when approved, then it works as today.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Listing read fails | Existing "something went wrong" error, nothing written | Try again |
| Owner check refuses | Plain message, nothing written | Contact us (claimant) or reject the claim (admin) |

## Tests

- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`.
- New unit file covers the five criteria above.
