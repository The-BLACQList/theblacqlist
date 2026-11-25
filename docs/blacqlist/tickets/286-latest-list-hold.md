# Ticket 286: Hold the Collective's Latest List and Totals Until 5 Receipts Are Counted

**Status:** Built 2026-11-25 on `feat/286-five-receipt-hold`, not merged. Founder 2026-11-25: "Hold until 5" (Latest list), then "yes" to holding Spent and Receipts until 5 too, then "yes" to building it before launch. Open: the founder's approval of the words, then the merge, each its own OK. [Needs professional review] for the Privacy Policy question.

## Why

`/flow-map` shows "A receipt at {business}, {day}" for the three newest counted receipts, beside the Spent total. With one counted receipt, Spent is that receipt and the list names its business and day. A business also gets its line at 1 counted receipt (ticket 250), so hiding the list alone would leave the business and the amount. Privacy Policy section 4 says individual receipt data (amounts, dates, businesses visited) is not shown publicly, and that totals can't be traced to a person (`app/(public)/privacy/PrivacyPolicy.tsx:433-439`). Found in ticket 279. The last production count on record, 2026-11-14, was 0 receipts; not read again for this ticket.

## The Decision

Until 5 receipts are counted across the site, none of these is published:

1. The Live Latest list.
2. Spent, the total in dollars.
3. Receipts, the total count.

The number is `AGGREGATE_MIN_TRANSACTIONS` (`lib/spend/aggregate-privacy.ts:32`), never a second copy. "Counted" is everything `readCountedSpend` returns. The line at 1 receipt stays (ticket 250). The Demo view is made up and doesn't change.

## Where the Totals Are Published

Read from the code on main `def4a2c`; nothing was run.

| Place | File |
|---|---|
| The Collective: Spent, Receipts, floor heights, the Shoppers floor sentence | `app/(public)/flow-map/page.tsx`, `components/flow-map/silo/SiloExperience.tsx`, `SiloPanels.tsx:469` |
| Home | `app/page.tsx:210-213`, `:276` |
| Community Spend (signed in) | `app/account/community-spend/page.tsx:55-58` |
| `GET /api/community-spend` (no sign-in) | `total_amount_cents`, `total_transactions` |
| `GET /api/flow-map/summary` (no sign-in) | `total_amount_cents`, `total_transactions` |

## Steps

1. One helper in `lib/spend/aggregate-privacy.ts` turns the counted rows into totals, or `null` under the bar. Every place above uses it. Its comment says community-wide totals are not gated, deliberately; that changes with this ticket.
2. `null` is "not published yet", never 0: $0 would be untrue. The two APIs return `null` for both fields. Check who reads them before changing the shape.
3. The held state on the Collective, Home and Community Spend needs a look from Creative and words from Author, Marketing and the founder.
4. The Latest rows and the totals must not reach the browser while held. `SiloTicker` already renders nothing for an empty list.
5. Method page section 5 (the community-wide paragraph and the Latest list sentences) and section 10 change together, with the same words steps as ticket 279. Same change in `docs/blacqlist/flow-map/data-sourcing-and-methodology.md`.
6. Tests: 0, 1, 4 and 5 counted receipts on each place; the number comes from the constant; Demo unaffected. Update `tests/aggregate-privacy.test.ts` and `tests/flow-map-methodology.test.ts`.

## As Built

- `communityTotals()` in `lib/spend/aggregate-privacy.ts` returns `null` under 5 counted receipts. All five places use it.
- The Collective keeps Links, and one line where Spent and Receipts were (Creative's held look, 2026-11-25). The Shoppers floor and its card say when spending shows. The headline falls back to "Where Does Our Money Go?".
- Home and Community Spend have one state that is true at 0 to 4 receipts. "Waiting on its first dollar", "be the first in" and "Be the first to contribute" are gone: receipts may be counted.
- Home's drawing stays unlit while held. Creative would light it from 1; not decided.
- Community Spend's Top Categories had no bar at all. They are held with the totals. A bar of 5 per category after that is a separate founder decision.
- The APIs return `null` for `total_amount_cents`, `total_transactions` and `unique_businesses`. No code in this repo fetches them.
- Method page sections 5 and 10 use Author's and Marketing's wording.
- "Verified receipts" on Community Spend contradicts the method page ("reported spend, not verified spend"). Not changed here.
- The site tour's owner step 4 picture needs a redraw: the held desktop column is 64px shorter. The tour is off in production.

## Not Fixed by This

For counsel. [Needs professional review]

1. **Watching the total.** From receipt 6 on, someone who notes Spent before and after a new receipt gets its amount, and the list or a new line names the business.
2. **Subtracting.** A business's own total shows at 5 receipts. If every other business with receipts is over the bar, Spent minus those totals is what the rest add up to. With 5 receipts at one business and 1 at another, that is one receipt, and the other business has a line. The CSV files give the same totals (method page section 10).
3. **One person.** Five receipts from one shopper clear the bar (`aggregate-privacy.ts` notes this).

Possible later answers: name only businesses with 5 or more receipts in the list, publish totals on a delay, or count distinct people.

## Done When

- At 4 counted receipts no place above publishes Spent, Receipts or a Latest row, in its HTML, data or API; at 5 they all do.
- No sentence on the method page disagrees.
- Counsel's question (Privacy Policy section 4 against the list, the line and the totals) is on the counsel list.

## Not Included

Privacy Policy wording and the 1-receipt line.
