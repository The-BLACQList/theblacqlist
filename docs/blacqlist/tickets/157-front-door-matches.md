# Ticket 157: One front door, matches inside add-business step 1

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready
**Depends on:** 159 (so a match that already has an owner can't be claimed), 158.
**Gates:** GATE-DEPLOY. No migration, no new dependency.
**Decision record (founder, 2026-10-31):** Screen 2 **C, matches inside step 1** with "This is mine, claim it".

---

## Why

`[Observed — repo at main 1d2f688]` Step 1 of `/add-business` already checks the name against live pages in any city (`app/add-business/_components/quick-start/NameStep.tsx`, `/api/listings/duplicate-check`) and offers "Claim this page" for every match. That is most of 2C. What's missing:

- Every match offers a claim, even pages that already have an owner (claimed, verified, or self-listed). After 159 those claims are refused at submit, which is a dead end.
- A user who already manages the matching page is told to claim it.
- Nothing on `/add-job` or the claim page points back to this door.

## Scope

In:

- **`duplicate-check` route:** also return, per match, `ownership: 'open' | 'yours' | 'managed'` (computed server-side: no owner and `unclaimed` is open; owner is the caller is yours; otherwise managed). Never return `owner_user_id` itself.
- **`NameStep.tsx` match list:**
  - heading "Already on BLACQList?";
  - `open`: button "This is mine, claim it" to `/claim/{id}`;
  - `yours`: "You manage this page" with a "Go to your page" link to its dashboard;
  - `managed`: "Managed by its owner" with no action, and a small "Not right? Contact us" link to `/contact`;
  - keep "Not yours? Keep going."
- **`/add-job` checklist (156):** the "Already listed? Find and claim it" link lands here.

Out:

- A separate search page ahead of `/add-business` (option A, not picked).
- Fuzzy matching (pg_trgm). Today's ilike stays.

## Acceptance criteria

- Given a typed name matching a seeded, ownerless page, the match shows "This is mine, claim it" and the link opens its claim form.
- Given a name matching a page the user owns, it shows "You manage this page" and links to the dashboard.
- Given a name matching another owner's page, it shows "Managed by its owner" and no claim button.
- The route response never includes an owner id.
- Keyboard and 375px: each action at least 44px, the screen-reader name includes the page name.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Duplicate check fails | No match list, the form continues as today | None needed |

## Tests

- Unit for the ownership mapping in the route.
- Lint, typecheck, unit; Preview pass on step 1 for the three cases.
