# Ticket 293: Receipt Lifecycle Before Launch

**Status:** Built, PR open. Code only, no migration. Merge waits for the founder's OK.

## Why

On 2026-11-28 the founder asked for the full receipt lifecycle to be "clear, clean and working before launch", with everything testable tested before anything is handed to them.

The last full run was 2026-11-26 (ticket 183). Since then 286, 287 and 288 changed receipt behaviour and wording. That run also skipped these paths:

- reject, fix and resend;
- admin approve;
- opt-out;
- the 5-receipt hold;
- account delete;
- the form's edge cases.

## What Changed

| #   | Where                                     | Change                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `lib/spend/applyReceiptReview.ts`         | The `spend_events` insert error is now checked. On failure the receipt goes back to pending (guarded to rows still `approved`) and the result is `failed`. No "counted" email goes out, and the receipt can be approved again. Before, it stayed approved but never counted, for good.                    |
| A2  | `app/admin/receipts/page.tsx`             | Admins now see a one-line result after Approve or Not Ours: approved, sent back, already reviewed, unlisted, or failed. The forms redirect back to the same tab with `?result=<code>`. Only fixed codes travel in the URL (`lib/admin/receiptReviewResult.ts`, `lib/actions/spend/adminReceiptForms.ts`). |
| A3  | `app/account/spending/page.tsx`           | "once our team approves it" becomes "once it's approved", because the business can approve too.                                                                                                                                                                                                           |
| A4  | `app/account/receipts/[id]/edit/page.tsx` | An unlisted receipt past its 90-day wait now redirects to My Receipts. Before, the page showed a form that could only fail on Save.                                                                                                                                                                       |

**Tests:**

- `tests/receipt-lifecycle-293.test.ts` (A1–A4);
- `tests/receipt-review-actions.test.ts` (owner approve and reject, the owner list and count);
- receipts in `tests/delete-account-action.test.ts`: uploads removed, spend kept with no link.

## Staging Run (2026-11-28)

Local `next dev` from this branch, pointed at staging. Emails were logged, not sent, and all accounts were made up (`@example.test`). There are 42 captures (1280 wide, plus 390 for the shopper form, My Receipts, owner review and the counted page) in `software-agent-bundle/projects/theblacqlist/qa/293-receipt-lifecycle-2026-11-28/`.

| #   | Scenario                                                                                                                               | Result |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Listed business, owner approves: emails, badge, name shown as "Jordan S.", one spend event, no double on reload                        | Pass   |
| 2   | Not Ours, then fix and resend, then admin approves: result line (A2), audit row                                                        | Pass   |
| 3   | Owner and admin approve at the same moment: one spend event, the other sees "already reviewed"                                         | Pass   |
| 4   | Unclaimed listing: no owner email, shows in Needs an Admin                                                                             | Pass   |
| 5   | Unlisted business: 90-day line, no Approve button, later linked and owner emailed; A4 redirect                                         | Pass   |
| 6   | Opt-out: spend marked opted out, flow graph unchanged                                                                                  | Pass   |
| 7   | Owner's own receipt: no email, not in their list, admin after 7 days                                                                   | Pass   |
| 8   | Form edges: no photo, $0, over $10,000, future date, over 90 days, 11 MB, double submit; PDF and HEIC accepted; Read My Receipt (mock) | Pass   |
| 9   | Photo privacy: owner sees it only while pending; another shopper is refused                                                            | Pass   |
| 10  | "Counted" emails turned off: none sent                                                                                                 | Pass   |
| 11  | Totals held under 5 (map Live view, home, The Collective page) and shown at 5+                                                         | Pass   |
| 12  | Account delete: receipts and photos gone, counted spend kept with no link                                                              | Pass   |
| 13  | The Collective switched off: receipts pages covered, owner review still loads                                                          | Pass   |

No app bugs turned up in the run. Five checks first failed on test wording or path (for example, the cover is a rewrite, so the URL doesn't change). They were fixed in the test script and pass.

**Cleanup:** every count, the spend sum and the full flow graph match the before-snapshot.

## Left As Is

- **Flow totals race:** two approvals for the same business at the same instant can lose one increment (the code reads, then writes). This is rare at launch volume. The fix later is a database function.
- **Owner approvals aren't in the admin audit log:** `reviewed_by` and `verified_by_role` on the row already record who approved.
- **No withdraw or delete for a pending receipt, and no submit rate limit:** abuse is held back by sign-in, the required photo and the duplicate check.
- **Ticket 183 follow-ups (a)–(c), post-launch:**
  - admin linking for unlisted receipts;
  - the "business joined" notice;
  - unlisted spend in the shopper's own total.
- **Counsel wording:** stays in the counsel packet.
- **Stale flag comment:** `lib/env.ts` still describes the receipt switches as waiting on the privacy policy update.
- **Unreachable branch on the counted page:** left in place, it does no harm.
- **Unused component:** `components/flow-map/FlowSummaryCards.tsx` says "Receipts approved by an admin" but nothing renders it.
- **Staging audit rows:** 3 `admin_audit_log` rows from the run stay on staging. That table can't be deleted from, by design, and the actor shows as removed.
- **Not tested here (the founder's):**
  - a real phone photo (HEIC from iPhone Safari);
  - the emails in a real inbox;
  - the three receipt switches in Production.
