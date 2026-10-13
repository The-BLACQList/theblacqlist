# Ticket 137: Admin testers page as a fifteen-spot board

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review
**Depends on:** #207 (shared tester link, 15-tester cap, tester numbers)
**Gates:** none. No migration, no Stripe, no new data. It only reads what the page already reads.
**Decision record:** founder picked concept B ("Fifteen spots") in the 2026-10-13 design workshop.

---

## Why

`/admin/testers` grew one feature at a time: forms on top, then a table, then answers under each row. With the 15-tester cap live, the founder needs three answers at a glance:

1. How many spots are taken, and by whom?
2. Who needs a nudge or a follow-up today?
3. What did each tester say?

Today the forms push all of that below the fold. "End enrollment" has no confirm, and it doesn't warn that ending an owner can take away their free month.

## Defaults (founder did not answer, so the mockup's choices stand)

- **Quiet** means a live tester who hasn't finished and has had no tour activity for **3 days or more**.
- **Finished testers keep their spot** until the admin ends them. Nothing frees a spot automatically.

## Scope

In:

- **Header:** "Testers", then "**N of 15 spots taken.** Tap a spot to see that tester." Two buttons: **Invite by listing** and **Make a link**. Each opens the existing form in a panel under the header with a Close button. Nothing changes inside the forms.
- **Needs you bar:** shown only when something needs action. It holds one chip per quiet tester ("Tester 07 · quiet 5 days") and per finished owner whose free month is unclaimed ("Tester 06 · free month waiting"). A chip selects that tester.
- **The fifteen spots:** a grid of 15 tiles. Each live tester's tile shows:
  - the tester number
  - Owner or Supporter
  - their page name
  - a six-part step bar
  - a status pill: Just joined, Walking, Quiet N days, Done, Free month waiting or Free month used

  Quiet and free-month-waiting tiles get a gold left stripe. Empty spots read "Open spot". A tile is a button with `aria-pressed`.
- **Detail panel** (sticky beside the grid on desktop, under it on phones, which scroll to it on select):
  - the tester number, email and status
  - Type, Page (linked to the admin entity), Joined, Last active and Free month
  - **The walk:** six steps marked Done, Stuck here (quiet testers only) or Next. Each answer sits under its step with the prompt.
  - **Copy email** and **End and free this spot**. End asks first: "End Tester NN? Their spot opens up and their answers stay." The buttons are **Keep them** and **Yes, end Tester NN**. For an owner whose free month is unclaimed, a warning line says ending takes it away.
- **Left the test:** one chip per ended tester. A chip opens their panel read-only (no End button). The row says their numbers are never reused.
- **Links that still work:** a short strip listing the live links with their use counts, plus a "See all links" disclosure holding the existing links table with Revoke.
- **All answers:** `?view=answers` lists every answer grouped by question, newest first within each question. This replaces the old flat Reflections tab, which `?view=reflections` still reaches.
- The URL remembers the selected tester (`?tester=07`), so a refresh keeps the panel open.

Out:

- Which link a tester joined through. Enrollments don't store it, and adding it needs a migration.
- Messaging or nudging a tester from the page.
- Any change to the cap, the free month or the forms.

## Data

All of it is already on the page:

| Item | Source |
|---|---|
| Spots and status | `tour_enrollments` (`tester_number`, `is_owner`, `listing_id`, `started_at`, `completed_at`, `trial_granted_at`, `ended_at`) |
| Steps and answers | `tour_step_completions` (now also selecting `completed_at`) |
| Last active | the newest of `started_at`, every step's `completed_at` and every `reflected_at` |
| Email | `auth.admin.getUserById`, as today |

The board's rules (status, quiet days, needs-you, stuck step) live in `lib/tester/board.ts` as pure functions with unit tests.

## Acceptance criteria

- Given 9 live testers, when the page loads, then the header reads "9 of 15 spots taken" and the grid shows 9 filled tiles and 6 open spots.
- Given a live, unfinished tester whose last activity was 3 or more days ago, then their tile reads "Quiet N days" with a gold stripe, and a chip for them is in Needs you.
- Given a finished owner with an unclaimed free month, then their tile reads "Free month waiting" and they appear in Needs you.
- Given nothing needs action, then the Needs you bar is not shown.
- When the admin taps a tile, then the panel shows that tester's walk and answers, and the URL carries `?tester=NN`.
- When the admin taps End, then nothing is ended until they confirm. Keep them closes the confirm box.
- Given an owner with an unclaimed free month, when End is opened, then the free-month warning shows.
- Given an ended tester, then they appear under Left the test and their panel has no End button.
- Tiles, chips and buttons are at least 44px tall, reachable by keyboard, with visible focus. Status is never shown by color alone.
- At 375px the page has no sideways scroll, the grid fits the width left beside the admin sidebar, and selecting a tile scrolls to the panel. (The admin sidebar itself never collapses on phones. That is true on every admin page and is out of scope here.)

## QA notes

- Previews read **staging** data, so the board shows staging testers. Quiet days depend on real dates and can't be faked on a preview.
- Ending a tester on staging is a real write. Use a throwaway staging tester.
