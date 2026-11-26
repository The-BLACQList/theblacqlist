# Ticket 287: My Spending Stops Calling Receipts "Verified"

**Status:** Merged #422 `1ee929d` 2026-11-25. Founder 2026-11-25: "Drop it, ticket 287", the same call as Community Spend in ticket 286. Follow-up below (2026-11-26).

## Why

Someone on our team reviews and approves a receipt. Nothing checks it against a card or bank payment, so calling it "verified" claims a check that never happened. The method page already says "reported spend, not verified spend". Ticket 286 took the word off Community Spend, and `tests/spend-vocabulary.test.ts` already keeps it off the Collective's figures. `/account/spending` was the last screen a shopper sees that still used it (noted in 286, "not changed").

## The Change

Wording only, in `app/account/spending/page.tsx`. The words already used elsewhere on the site: "counted" for a receipt that counts (My Receipts says "Counted so Far"), and "approved" for the review step.

| Where                                                     | Before                                     | After                                     |
| --------------------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| Line under the page title                                 | Where your verified support has gone       | Where your support has gone               |
| Empty state, receipts waiting for review                  | Nothing verified yet                       | Nothing approved yet                      |
| Empty state, no receipts                                  | …once it's verified.                       | …once it's approved.                      |
| Total card label                                          | Verified spend                             | Counted Spend                             |
| By-month note when every receipt is older than the window | Your verified receipts are all older than… | Your counted receipts are all older than… |
| Screen-reader caption on the by-month table               | Verified spend by month…                   | Counted spend by month…                   |
| Code comment at the top                                   | verified spend                             | counted spend                             |

No numbers, queries or layout change.

## Guard

`tests/spend-vocabulary.test.ts`: My Spending never contains "verified" (any case, comments included) and does contain "Counted Spend". It failed on the old page and passes on the new one.

## Not Changed

- `lib/email/templates/receipt-counted.tsx:62` has the words "verified support" in a code comment only. No one receiving the email sees it.
- Older ticket docs keep their own wording as a record.

## Words

Author checked the words 2026-11-25: OK on all, with the line under the title changed to "Where your support has gone".

## Checks

Typecheck, lint and Prettier pass on the two changed files. Unit tests: 6,241 passed.

## Follow-Up (2026-11-26)

Author's two notes on the merged page, answered by the founder:

| Where                                    | Before                                                         | After                                          | Founder            |
| ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | ------------------ |
| Empty state, receipts waiting for review | …once our team approves it — usually within 1–3 business days. | …once our team approves it.                    | "Drop the promise" |
| Empty-state headings                     | Nothing approved yet / No spending tracked yet                 | Nothing Approved Yet / No Spending Tracked Yet | "Yes, Title Case"  |

The guard in `tests/spend-vocabulary.test.ts` now also checks for no "business days" on the page and for both headings in Title Case.

The rest of the shopper's "verified" words, on the support post and share flow, are ticket 288.
