# Ticket 156: "Who can post a job" checklist on /add-job and the dashboard

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 159 (build after). 158 changes the copy for the "in review" step; either order works.
**Gates:** GATE-DEPLOY. No migration, no new dependency. Behind the existing `FEATURE_JOBS_OPEN` and `postingSubmissions` flags.
**Decision record (founder, 2026-10-31):** Screen 1 **A, checklist**. Screen 4 **B, dashboard card shown with the step**. Q1 review time **3 to 5 business days**.

---

## Why

`/add-job` with no live page says only "You need a published business page first" and offers "Add your business" (`components/jobs/post/StepRole.tsx:21-36`). It doesn't tell an owner their page is a draft or in review, and doesn't point them to claiming a page that is already listed. The dashboard "Post a job" card is hidden until a page is live (`components/dashboard/PostJobCard.tsx`), so owners can't see that jobs exist or what they need first.

The rule to show: **you can post a job once you own a live page.** Own it by claiming a listed page or adding your own.

## Scope

In:

- **One shared resolver** `lib/jobs/postingReadiness.ts`: from the signed-in user's owned business pages (not event/job, not deleted) and their pending claims, return one of four states:
  - `none`: no owned page and no pending claim.
  - `draft`: an owned page in `draft`.
  - `review`: an owned page in `pending`, or a pending claim.
  - `live`: at least one owned `published` page (the form shows as today).
  The canvas "already listed" case is covered by the secondary link in `none`; `/add-job` has no name to match on, so matching lives in the front door (157).
  Pure function plus a small loader; unit tested.
- **`app/add-job/page.tsx`:** widen the owned query to `status in (draft, pending, published)` and read the user's `pending` claims (`claims` where `claimant_user_id = user.id`). Pass `readiness` to the wizard. Businesses list for the picker stays published only.
- **`StepRole.tsx` empty state becomes the checklist** (picked layout A): three steps, "Own a business page", "Page is live", "Post your job". Done steps show a check and the word "Done", not colour alone. The current step holds the one action:
  - `none`: "Add your business" (`/add-business`) and a secondary "Already listed? Find and claim it" (`/add-business`, where step 1 shows matches, ticket 157).
  - `draft`: "Finish your page" to that page's dashboard editor; name the page.
  - `review`: "In review, usually 3 to 5 business days" with the page or claim name; no button, a "See your page" link to the dashboard.
  Copy has no em dashes. Each step is a list item with its state in text for screen readers ("done", "current step", "not yet").
- **`PostJobCard.tsx`:** when Jobs is open, show the card for every signed-in owner state. `live` stays as today. Other states show the same three-step checklist in compact form with the current step's action; the "Post a job" button is shown disabled with the reason next to it ("Your page needs to be live first"), not hidden. `app/dashboard/page.tsx` passes `readiness` instead of `hasPublishedBusiness`.

Out:

- Searching for a match from `/add-job` (front door is 157).
- Any change to who may post (still: own a published page).

## Acceptance criteria

- Given a user with no page and no claim, `/add-job` shows the checklist on step 1 with "Add your business" and "Already listed? Find and claim it".
- Given a user whose only page is a draft, step 1 is done and step 2 says "Finish your page" naming it.
- Given a user whose page is pending, or who has a pending claim, step 2 reads "In review, usually 3 to 5 business days".
- Given a user with a published page, the form shows as today.
- Given the same four users on `/dashboard`, the card shows the matching step; a live owner sees today's card.
- Given Jobs is off, neither the card nor `/add-job` changes from today.
- Keyboard: the action is reachable in order and the disabled button announces its reason (`aria-describedby`). 375px: no horizontal scroll, buttons at least 44px tall.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Claims read fails | Treat as no claim; the owned-page state still shows | Refresh |
| Owned-page read fails | Show today's empty state copy | Refresh |

## Tests

- Unit `tests/job-posting-readiness.test.ts`: each state, priority when several pages exist (`live` wins, then `review`, then `draft`).
- Lint, typecheck, unit; Preview pass at 375px and 1280px for the four users.
