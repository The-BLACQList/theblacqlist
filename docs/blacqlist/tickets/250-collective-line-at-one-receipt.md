# Ticket 250: The Collective Draws a Line From 1 Receipt

**Status:** Merged #374, 2026-11-21.

Part of the Collective tighten-up (246–250). Founder pick, 2026-11-21: **"Line at 1, $ at 5."**

## Why

A business only got a line on The Collective once 5 approved receipts were behind it. A shopper who sent in a receipt usually saw nothing happen, and the founder wants that instant moment back. The 5-receipt rule exists for the dollar figure, not the line.

## What Changed

**The rule**
- `LINK_MIN_TRANSACTIONS = 1` sits next to `AGGREGATE_MIN_TRANSACTIONS = 5` in `lib/spend/aggregate-privacy.ts`. `meetsLinkThreshold` is new.
- `/flow-map` reads business nodes from 1 counted receipt. City nodes stay at 5.
- `SiloBusiness` has a new `figuresShown` field, set at 5 or more.
  - `buildSiloBusinesses` sets `amountCents` and `transactionCount` to 0 under 5, so no sub-threshold figure leaves the server.
  - Businesses under 5 are ordered by id, not by amount.
- In the scene, a linked business under 5 is drawn at one fixed size (`LINKED_UNCOUNTED_SIZE`). Dot size cannot hint at an amount.
- The list view only holds businesses with figures (`figuresShown`).
- The "Links" count in More counts every linked business.

**Your own line straight away**
- The reader's own receipts in `pending_review` that have a listing and are not opted out become `youPendingIds`.
- The scene draws those as a dashed gold line (`PendingLinks`) on that reader's page only.
- Once the receipt is approved, the dashed line turns into the normal solid line.
- The card adds: "Your receipt here is in review. Your line stays dashed until it's approved, and only you can see it."

**Copy**

The card line now depends on what is counted:

| Receipts counted | Card line |
| --- | --- |
| None | "No receipts counted here yet." |
| 1–4 | "Receipts are counted here. The total shows once 5 are in." |
| 5 or more | Unchanged. |

- Methodology §5 now explains the line from 1 receipt, the total from 5, and the dashed pending line.
- `docs/blacqlist/flow-map/data-sourcing-and-methodology.md` §3 has a new paragraph on lines.

**Untouched**
- The summary API, both exports, community-spend and the account page all stay at 5.
- A test now fails if any of them imports `LINK_MIN_TRANSACTIONS`.

## What a 1-Receipt Line Discloses (for the founder)

A line shows that someone had an approved receipt at that business. It does not show who or how much. The ticker can also show that business's name with the day.

That is the trade the founder picked. There is no dollar figure, no count and no size difference below 5.

## Tests

- `tests/silo-layout.test.ts`:
  - linked at 1 with no figures;
  - figures zeroed under 5, with no amount ordering;
  - no sub-threshold amount in the payload;
  - pending marked only for the reader, and never when the receipt is already counted;
  - the three card lines.
- `tests/flow-map-page.test.ts`: business nodes read at the line bar, cities at the total bar, and pending receipts from the reader's own rows.
- `tests/aggregate-privacy.test.ts`: the gate check allows the line bar only on `/flow-map`.

Full suite passes: 5,498 passed, 285 skipped. Typecheck is clean.
