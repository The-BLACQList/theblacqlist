# 183: Share and celebrate: the profile share sheet, the support post, and owners verifying receipts

**Status:** Building on `feat/share-and-celebrate`. Not committed.
**Follows:** 166 (counted share), 162 (add a receipt), 165 (receipt emails)
**Area:** business pages, My receipts, the owner dashboard
**Gates:**
- GATE-DATA: two migrations, `listings.collective_name_opt_in` and the receipt owner-verification columns.
- GATE-PUBLISH: privacy page copy.
- GATE-DEPLOY.

## Why

The founder wants three things:
- Sharing a business should feel like a find: "Look what I found on The BLACQList!"
- Adding a receipt should be a moment people want to post.
- The business, not the admin, should say whether a purchase was real: "They would know, not me."

## Decision record

`[Decision — founder, 2026-11-13]`:
- **Profile share.** A branded image post sized for each platform: IG Stories and Feed, Facebook, X, Threads, TikTok and Snapchat. Also the phone's share options (Messages, WhatsApp, Mail, the OS sheet) and Copy link.
- **Support post.**
  - After a receipt is added, the shopper is asked to share a branded "I SUPPORTED [Business]" post.
  - It can be shared twice: "Supported" right after the upload, and "✓ Verified by The BLACQList" once the receipt is verified.
  - The tone is celebratory.
- **Photo.** Optional. The shopper takes it in an in-app live viewfinder or picks it from their camera roll (a photo from the visit).
- **The receipt and the amount are never on the post.** "The receipt capture image is different from the social sharing image." The receipt photo is only for reading the purchase. The post photo is a separate picture the shopper chooses.
- **Image cards are fine.** This replaces 166's "Out: image cards (O3 B)" for the support post only. The counted screen's text share (O3 A) stays as it is.
- **Sharing before approval is fine.** The shopper is sharing their own commemorative picture, not the receipt.
- **The support card always names the business.** `[Decision — founder, 2026-11-13]` "The support card should always name the business." This replaces the earlier "Support posts add the opt-in" rule for support posts. The card uses the listing's name and links to the business page. (A receipt with no listing gets no card at all; see "Only listed businesses count" below.)
  - The opt-in (`listings.collective_name_opt_in`, off by default) still governs the counted screen's text share from ticket 166, which can include the amount. The dashboard switch now describes only that share.
- **Card footer reads "Collective Member".** `[Decision — founder, 2026-11-13]` The card says "COLLECTIVE MEMBER · THEBLACQLIST.COM" (was "Part of The Collective"), shown only when the receipt joins the map (not opted out). Otherwise just "THEBLACQLIST.COM".
- **Owners verify receipts.**
  - The owner sees the receipt photo, the amount, the date, and the buyer's first name and last initial.
  - Owners hear about new receipts by email and by a badge in the dashboard.
  - Admins verify the rest: receipts for unclaimed listings, and any receipt pending for more than 7 days.
- **Only listed businesses count.** `[Decision — founder, 2026-11-13]` "We can't allow any and every business receipt to be posted on the collective." The founder chose:
  - **Totals = listed businesses only.** Every public reader of `spend_events` filters `.not('listing_id', 'is', null)`.
  - **Unmatched receipts wait for the business.** Nobody can approve a receipt with no listing (`applyReceiptReview.ts` returns `'unlisted'`). It waits 90 days from upload (`lib/spend/unlisted.ts`). If the business joins, the shopper edits the receipt, picks the listing, and the owner is emailed to verify it. After 90 days it stops waiting and can't be edited. This is computed when the receipt is read; there is no cron.
  - **No support post for unmatched receipts.** The form shows the invite-the-business prompt instead, and the share page redirects.
  - **Past unmatched spend is removed from the totals.** The rows stay in `spend_events`; the read filter excludes them. The public totals drop by an amount that hasn't been measured `[Unknown]`. The methodology doc and `/flow-map/methodology` say so.
  - Admins see these receipts under "Waiting for the business" and can reject them or add the business as a listing.

## Scope

- **A.** Profile share sheet and OG/story/feed share images.
- **B.** Support post studio at `/account/receipts/[id]/share`.
  - The photo is composed on the phone and never uploaded.
  - The business owner gets an opt-in switch for showing their name.
- **C.** Owner verification: a queue, emails, the badge, and admin fallback rules.

## Privacy notes

`[Needs professional review]`:
- Owners seeing a buyer's first name and last initial and the receipt photo is a change to the "aggregates only" rule in ticket 112. The privacy page needs updating before C goes live.
- The support photo stays on the shopper's device. We don't store it or publish it.

## Owner verification rollout (C)

- **Behind a flag.** `FEATURE_OWNER_RECEIPT_REVIEW` (`ownerReceiptReview` in `lib/env.ts`) is closed everywhere by default. The live privacy policy says receipt data "is visible only to you", which owner review would break.
  - While it's closed, admins review every receipt, as before. The shopper copy is unchanged, `/dashboard/receipts` is a 404, no owner emails go out, and the signed-URL route serves only the shopper and admins.
- **To open it:**
  1. Apply the migrations (GATE-DATA).
  2. Get counsel's review of the upcoming §4 wording at `/privacy/upcoming`.
  3. Publish that policy (GATE-PUBLISH).
  4. Set the flag to `true`, then deploy (GATE-DEPLOY).
- **Admin fallback.** The admin queue defaults to "Needs an admin": receipts for unclaimed businesses, and receipts an owner has left for 7 days or more (`ADMIN_FALLBACK_DAYS`). Unmatched receipts sit under "Waiting for the business" and can be rejected but not approved. Admins can still act on anything from "All pending".
- **Race.** Owner and admin reviews share `lib/spend/applyReceiptReview.ts`. The status update only applies while the receipt is still `pending_review`, so a receipt is counted once.
- **Owner rejections.** "Not ours" sends the shopper the existing needs-a-fix email with the owner's reason. Fixing and resending emails the owner again. There's no admin escalation. A shopper who disputes it can contact support.
