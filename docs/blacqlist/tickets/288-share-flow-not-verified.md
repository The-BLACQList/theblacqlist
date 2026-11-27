# Ticket 288: "Verified" on the Support Post and Share Flow

**Status:** Merged #424 `35848ea` 2026-11-27. Words first came on 2026-11-26 ("Ticket 288, words first"). The founder picked on 2026-11-27.

## Founder's Picks (2026-11-27)

- **The stamp:** "No stamp". The support post, its caption and its alt text never say "verified", whoever approved the receipt. The post looks the same before and after approval.
- **The owner word:** "Switch to Approve". Receipts to Verify becomes **Receipts to Review**, and the button becomes **Approve / Approving…**.
- **The confirm line:** "Owner confirm line". The line after Approve or Not Ours now shows (see Found While Testing below).

## What Changed

Words are Author's (2026-11-27), unless marked _Software_.

| Where                             | Now                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share page heading, approved      | Your Receipt Is Approved                                                                                                                                                                                 |
| Share page line, approved         | Share a post that you supported this business.                                                                                                                                                           |
| Share page line, waiting          | Share a post that you supported this business. Your receipt is waiting for review.                                                                                                                       |
| Counted page                      | Share Your Support Post                                                                                                                                                                                  |
| My Receipts row                   | Share post                                                                                                                                                                                               |
| "Your Receipt Is Counted" email   | Share your post                                                                                                                                                                                          |
| Caption                           | No "Verified by The BLACQList." at the end                                                                                                                                                               |
| Post image and alt text           | No stamp                                                                                                                                                                                                 |
| Owner page title, heading and nav | Receipts to Review                                                                                                                                                                                       |
| Owner intro                       | Shoppers upload receipts to show they supported you. Check each one against your own records. When you approve it, their purchase counts. If you haven't checked one in N days, The BLACQList team will. |
| Owner footnote                    | …only so you can check it.                                                                                                                                                                               |
| Owner button                      | Approve / Approving…                                                                                                                                                                                     |
| Owner confirm line                | Approved. {buyer}'s purchase now counts, and we've let them know.                                                                                                                                        |
| Own-receipt error                 | You can't approve your own receipt. We'll review it for you.                                                                                                                                             |
| Owner email eyebrow               | A Receipt to Review                                                                                                                                                                                      |
| Owner email body                  | They uploaded a receipt to show it. Check it against your own records. Once you approve it, their purchase counts.                                                                                       |
| Owner email preview, button       | _Software:_ "Take a look and approve it.", "Review the Receipt"                                                                                                                                          |

Author's waiting line was "We'll let you know when your receipt is approved." That isn't true for every shopper, because a shopper can turn off the counted email in Settings. So Author's fallback is used instead.

**Left as is:**

- The privacy policy line (counsel's list).
- The receipt privacy note "…only to verify your purchase." (`lib/spend/owner-receipts.ts`).
- The signed tour line "you can confirm it". Author suggests "you can approve it". That needs the founder's re-sign and Marketing's check first.
- The internal stage name `'verified'`. It is code, not copy.

`tests/spend-vocabulary.test.ts` guards both groups.

## Why

Tickets 286 and 287 took "verified" off Community Spend and My Spending, because the method page says "reported spend, not verified spend". After a receipt counts, the shopper's share flow still says "verified" in several places, and the support post carries a "Verified by The BLACQList" stamp.

## One Thing to Know First

A support post gets the verified stage whenever the receipt is **approved**, whoever approved it (`lib/share/supportCard.ts`, `supportStage`):

- **the owner**, from Receipts to Verify (ticket 183);
- **The BLACQList team**, for a business nobody has claimed, or one the owner hasn't checked in 7 days (`ADMIN_FALLBACK_DAYS`).

So the stamp says "Verified by The BLACQList" on receipts that only our team approved. The comment in `lib/share/captions.ts:45-46` says the stamp is "only ever called for a receipt the business has confirmed". That is not true for team-approved receipts.

Each approval saves who made it in `receipt_uploads.verified_by_role` (`owner` or `admin`), so the words could differ by who approved, if the founder wants that.

## Group A: What the Shopper Sees

| Where                                                | Today                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `app/account/receipts/[id]/share/page.tsx:100`       | Your support is verified                                                        |
| `app/account/receipts/[id]/share/page.tsx:105`       | Your receipt is verified, so your post gets the verified stamp.                 |
| `app/account/receipts/[id]/share/page.tsx:106`       | …Once your receipt is verified, you can share it again with the verified stamp. |
| `app/account/receipts/[id]/counted/page.tsx:190`     | Share a Verified Support Post                                                   |
| `components/spend/ReceiptListRow.tsx:166`            | Share verified post (My Receipts)                                               |
| `lib/email/templates/receipt-counted.tsx:65`         | Share your verified post (the "Your Receipt Is Counted" email)                  |
| `lib/share/captions.ts:57`                           | The share caption ends "Verified by The BLACQList."                             |
| `components/support-share/SupportPostStudio.tsx:217` | The stamp line on the post: Verified by The BLACQList                           |
| `lib/share/composeSupportCard.ts:294`                | The same stamp, drawn on the post image (✓ Verified by The BLACQList)           |

Code comments that follow whatever the words become: `share/page.tsx:20`, `ReceiptListRow.tsx:160`, `receipt-counted.tsx:62`, `captions.ts:45-46`, `composeSupportCard.ts:16`, `supportCard.ts:16`. The internal stage name `'verified'` in `lib/share/captions.ts:30` is code, not copy.

## Group B: What the Owner Sees (Owner-Confirmed Receipts)

Here an owner really does check the receipt against their own records. The founder decides whether "verify" stays for this step.

| Where                                                  | Today                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `app/dashboard/receipts/page.tsx:30` and the tab title | Receipts to Verify                                                  |
| `app/dashboard/receipts/page.tsx:33-34`                | When you verify it, … they can share a verified post.               |
| `app/dashboard/receipts/page.tsx:72`                   | …only so you can verify it.                                         |
| `components/dashboard/ReceiptReviewRow.tsx:83`         | Verify / Verifying…                                                 |
| `components/dashboard/ReceiptReviewRow.tsx:42`         | Verified. {buyer}'s purchase now counts, and we've let them know.   |
| `lib/actions/owner/receiptReviewShared.ts:77`          | You can't verify your own receipt. We'll review it for you.         |
| `lib/email/templates/receipt-to-verify.tsx:47`         | …they can share that you verified it…                               |
| `app/(public)/privacy/PrivacyPolicy.tsx:437`           | …waiting to be verified… (privacy text: counsel reviews any change) |

## Not in Scope

The business trust tier "Verified" is a real check of the business: the badge, Get Verified, the verification pages and emails, and the map filter "Verified+". It stays.

## Found While Testing (2026-11-26, Staging)

On Receipts to Verify, after an owner presses Verify the row goes straight to "You're all caught up". The line "Verified. {buyer}'s purchase now counts, and we've let them know." never shows: the page refreshes and the row is gone before it can. The approval, the totals and the shopper's email all work. **Fixed 2026-11-27:** the line now lives in the list (`components/dashboard/ReceiptReviewList.tsx`), which stays on screen through the refresh. The same goes for the Not Ours line.

## Next

1. Author and Marketing propose words for Group A, and for Group B if the founder wants it changed.
2. Creative looks at the stamp on the post image.
3. The founder picks. Then the build gets its own OK, with a test like `tests/spend-vocabulary.test.ts`.
