# Ticket 286: Hold the Collective's Latest List Until 5 Receipts Are Counted

**Status:** Proposed, not started. Founder 2026-11-25: "Hold until 5". That covers writing this ticket; building it needs its own OK. [Needs professional review] for the Privacy Policy question.

## Why

`/flow-map` shows "A receipt at {business}, {day}" for the three newest counted receipts, beside the Spent total. With one counted receipt, Spent is that receipt and the list names its business and day. Privacy Policy section 4 says individual receipt data (amounts, dates, businesses visited) is not shown publicly, and that totals can't be traced to a person (`app/(public)/privacy/PrivacyPolicy.tsx:433-439`). Found in ticket 279. The last production count on record, 2026-11-14, was 0 receipts; not read again for this ticket.

## The Decision

The Live Latest list stays hidden until 5 receipts are counted. The number is `AGGREGATE_MIN_TRANSACTIONS` (`lib/spend/aggregate-privacy.ts:32`), never a second copy. "Counted" is everything `readCountedSpend` returns, the same rows behind the Receipts figure. The Demo view's list is made up and doesn't change.

## What Holding the List Does Not Fix

Found while writing this ticket, from the code on main `def4a2c`. Nothing was run.

1. **The line gives the same answer.** A business gets its line at 1 counted receipt (ticket 250). With one counted receipt, exactly one business has a line and Spent is that receipt. Hiding the list removes the day, not the business or the amount.
2. **Watching the total.** Spent is computed each time the page opens. Someone who notes it before and after a new receipt gets that receipt's amount, and the list (or a new line) names the business. Holding at 5 doesn't stop this at receipt 6 or 600.
3. **Other places Spent is read:** the home page, `/api/flow-map/summary`, `/api/community-spend` and `/account/community-spend`.

## For the Founder, at Build Time

| Option | What changes | What is left |
|---|---|---|
| A. Hold the list only (as decided) | List hidden under 5 counted receipts | 1 and 2 |
| B. A, plus hold Spent and Receipts under 5 (recommended) | No dollar total anywhere while it could be one person's receipt | 2 |
| C. B, plus name only businesses with 5 or more counted receipts in the list | The list stops pointing at small businesses' single receipts | 2, for a new line, and for a business at the bar |
| D. Publish the totals on a delay, for example daily | Several receipts change the total at once on busy days | Quiet days with one receipt |

Recommended before launch: **B**. It changes the Spent headline while there is little to show, and the page already opens on Demo then. C and D are for counsel's answer.

## Steps (for A)

1. In `app/(public)/flow-map/page.tsx` (the `ticker` read), return an empty list while `totalTransactions < AGGREGATE_MIN_TRANSACTIONS`. `SiloTicker` already renders nothing for an empty list. The rows must not reach the browser.
2. Method page section 5: say when the Latest list appears. The words need Author, Marketing and the founder first, as in ticket 279. Same change in `docs/blacqlist/flow-map/data-sourcing-and-methodology.md`.
3. Tests: 0, 1, 4 and 5 counted receipts; the number comes from the constant; the Demo list is unaffected.

## Done When

- At 4 counted receipts the page's HTML and data carry no Latest rows; at 5 they do.
- No sentence on the method page disagrees.
- Counsel's question (Privacy Policy section 4 against the list, the line and the totals) is on the counsel list.

## Not Included

Privacy Policy wording, the 1-receipt line, distinct people instead of receipts (`aggregate-privacy.ts` notes five receipts from one person clear the bar).
