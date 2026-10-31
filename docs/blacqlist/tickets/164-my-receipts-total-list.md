# Ticket 164: My receipts, total then the list, with a category on each line

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 162 (wording).
**Gates:** GATE-DEPLOY. No migration, no new dependency.
**Decision record (founder, 2026-10-31):** Screen 3 **C, total, then the list**. Q2 **My receipts**. Q5 **within 3 business days**. Founder note: "add a category to the my receipts lines as well. We should know it if the business is listed."

---

## Why

The running total is the reward for adding receipts. A receipt that needs a fix gets forgotten when the reason is a tap away.

## Scope

In:

- **`/account/receipts` top card:**
  - your counted total, as the sum of approved receipts;
  - a short tally: "4 counted · 1 waiting · 1 needs a fix";
  - an "Add a receipt" button.
- **The list, newest first. Each row has:**
  - the business name;
  - a **category chip** when the receipt is matched to a listing, reusing the category source in `CollectivePanel.tsx`;
  - the amount;
  - the date;
  - a status pill (Counted, Waiting, Needs a fix), with the word on the pill and not color alone.
- **Needs a fix rows** show the reason under the row and a "Fix and resend" button, which opens the edit page.
- **Waiting rows** show "We'll check it within 3 business days."
- **Unmatched receipts** show "Not on the list yet" in place of a category.
- **Four states:**
  - **Empty:** the three steps from 161 in short form, plus "Add your first receipt".
  - **Only waiting:** the total card shows $0 counted and "1 waiting".
  - **Needs a fix:** those rows sort first.
  - **Mixed.**

Out:

- Filters and export.
- The counted screen (166).

## Acceptance criteria

- Given a member with counted, waiting and needs-a-fix receipts, the card shows the counted total and the tally. Needs-a-fix rows come first, then the rest by date.
- Given a receipt matched to a listing, its row shows that listing's category. Given an unmatched one, the row shows "Not on the list yet".
- Given a needs-a-fix row, the reason and "Fix and resend" show on the row. The button opens the edit form with the fields kept.
- Given no receipts, the empty state shows with one button.
- Given 375px, rows stack cleanly, buttons are at least 44px, and nothing scrolls sideways.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| List read fails | "We couldn't load your receipts." | Try again button |
| Category read fails | Rows show without the chip | None needed |

## Tests

- Unit tests for the tally, the total (approved only) and the sort (needs a fix first).
- Preview at 375px and 1280px for the four states.
