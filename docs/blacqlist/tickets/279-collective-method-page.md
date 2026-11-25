# Ticket 279: The Collective's Method Page Matches How Receipts Work

**Status:** Not started. The founder approved writing this ticket on 2026-11-24; the wording, the merge and the deploy each need their own OK.

## Why

Founder 2026-11-24: "Yes to tickets for the map limit and the method page." The page's own rule is that when the pipeline changes, the page changes with it. Ticket 162 made the photo required and ticket 183 (2026-11-13) let owners approve. The site tour's owner step says owners can confirm a purchase, and this page says otherwise.

## What the Page Says, Against the Code

`app/(public)/flow-map/methodology/page.tsx` on main `84ab44c`.

| Section | Page says | Code does |
|---|---|---|
| 2, step 1 | "A photo of the receipt is optional." | Required (ticket 162): a new receipt is refused without one, and an older receipt with none needs one when it is corrected |
| 1 | "approved by a person on our team" | With owner review on, the business's owner can approve it; the team handles unclaimed businesses and anything waiting 7 days. An owner can't approve their own receipt (`lib/spend/owner-receipts.ts`) |
| 2 step 2, 3, 7, 8 | "a reviewer", never saying it may be the business | Same as above. Section 7 should say a business may be confirming its own sales |
| 4, Businesses supported | "A receipt for a business we do not list yet still counts toward the total above" | It can't be approved, and totals leave those rows out. Contradicts section 2 of the same page |

The internal note, `docs/blacqlist/flow-map/data-sourcing-and-methodology.md`, has the same faults (photo optional; "approved by an admin") and changes in the same PR.

Found while writing this ticket: the section 4 line and the section 7 point.

## Production, 2026-11-24

`FEATURE_OWNER_RECEIPT_REVIEW` is present in Vercel Production, last set 11 days ago. That matches the 2026-11-13 entry that set it to `true`. The value is stored as Sensitive, so it could not be read back. If the flag is ever off, admins review everything, so the wording must be true in both states or follow the flag.

## Steps

1. Author drafts the replacement lines; Marketing checks them; the founder approves. No wording is approved yet.
2. Check the remaining sentences against the code, including "there is no business-to-business data" (section 3) and "up to an hour old" (section 7).
3. Change the page and the internal note together.
4. Extend `tests/flow-map-methodology.test.ts` so the photo rule and the reviewer wording are tied to the code that enforces them.

## Done When

- No sentence on the page disagrees with the code; each row above is fixed and tested.
- Title Case headings, "The BLACQList", and the existing rule against internal names on the page all hold.
- The change is live before the site tour's owner step.

[Needs professional review] if the new wording changes what the Privacy Policy says about who sees a receipt.
