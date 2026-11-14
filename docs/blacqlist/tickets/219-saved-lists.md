# Ticket 219: Saved lists and "Shop this list again"

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready
**Depends on:** 218
**Amended 2026-11-13 (one cart):**
- **Add list to cart** sits beside Shop this list again, for lines whose chosen item is a seller item. It needs 225.
- A chosen seller item that's no longer purchasable shows "Not available right now" and is skipped, never added.
- The "Since" line also counts "{k} items not available right now".

**Gates:** a migration (GATE-DATA), staging first with a down plan. A Privacy agent pass, and a line in the privacy policy, before it ships: saved lists show what someone buys. Behind `FEATURE_MARKETPLACE_OPEN`.
**Decision record:**
- S7 A (founder, 2026-11-08), a list of lists.
- Q5 A, sign-in only to save a list.
- Founder, 2026-11-07: reordering a saved list is a v1 input.

## Why

Most grocery shopping repeats. Saving a list, and shopping it again, is how Shop becomes the first stop every week.

## Scope

In:
- **Migration** `shopping_lists`:
  - `id`, `profile_id` (FK, CASCADE), `name`;
  - `items jsonb`, an array of `{ text, chosen_kind, chosen_id }`, where `chosen_kind` is `seller` or `directory`. This is only the line text and the item the shopper picked;
  - `repeat_label`, null or `weekly`, and `repeat_day`, 0 to 6 or null;
  - `last_shopped_at`;
  - `last_snapshot jsonb`, holding the matched item ids and store ids at the last shop;
  - `source`, `status`, `created_at`, `updated_at`.
  RLS: owner only. CASCADE on account deletion, with no trigger.
- **Saving.** "Save this list" sits on the 218 results page.
  - Signed out, it shows the drawn state: "Sign in to save this list and shop it again next week. Your 5 items stay right here while you sign in.", with **Create free account**, **Sign in** and **Not now**. The working list survives the sign-in round trip.
- **The page** `/account/lists`, as drawn on S7-A. Every list gets the same weight. Each one shows:
  - its name, the item count, and "last shopped {date}";
  - "Weekly · {day}", when set;
  - a "Since {date}" line: "{n} new options, {m} stores no longer listed", or "No changes since you last shopped it.";
  - **Shop this list again**.
- **The "Since" line costs no Cue call.** It compares `last_snapshot` with current data: approved stockists and listed products added since then for the same lines, and snapshot stores now closed or delisted.
- **Shop this list again** loads the list into the working list and runs 218. It counts against the daily limit.
- **"Reorder a saved list"** in the 215 tray, shown when signed in with saved lists.
- **Rename and delete a list.** Delete needs a confirm.

Out:
- Reminders for weekly lists. Those are GATE-COMMS. "Weekly · Sun" is only a label in v1.
- Shared lists.

## Checks

- Signed out: save, then sign in, and the list is saved with every line.
- One shopper can't read another's list, through either RLS or the API. There's a test for this.
- The "Since" line is right on fixture data: one new stockist and one closed store.
- Deleting the account removes the shopper's lists, and the deletion E2E still passes.
- The delete confirm traps focus and returns it to the list.
