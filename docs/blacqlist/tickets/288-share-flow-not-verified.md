# Ticket 288: "Verified" on the Support Post and Share Flow

**Status:** Words first, nothing built. Founder 2026-11-26: "Ticket 288, words first". Software lists every place. Author and Marketing propose words, Creative looks at the stamp, and the founder picks before anything is built.

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

On Receipts to Verify, after an owner presses Verify the row goes straight to "You're all caught up". The line "Verified. {buyer}'s purchase now counts, and we've let them know." never shows: the page refreshes and the row is gone before it can. The approval, the totals and the shopper's email all work. Whether to fix this, and how, is a separate pick.

## Next

1. Author and Marketing propose words for Group A, and for Group B if the founder wants it changed.
2. Creative looks at the stamp on the post image.
3. The founder picks. Then the build gets its own OK, with a test like `tests/spend-vocabulary.test.ts`.
