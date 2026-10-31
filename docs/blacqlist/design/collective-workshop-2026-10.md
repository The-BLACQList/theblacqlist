# The Collective workshop, round 1

**Audience:** the founder, and whoever builds The Collective next.
**Last updated:** 2026-10-31
**Canvas:** https://claude.ai/artifact/SwrD2QiwaKxzN2tFWcyCJU (private to the founder until shared)

The founder turned The Collective off in prod on 2026-10-30 (`FEATURE_COLLECTIVE_OPEN=false`) until a new design is live. This round covers the whole path from receipt to Silo: the first look, adding a receipt, My receipts, hearing back, the moment a receipt is counted, and the Silo map from flow-map round 17.

## What the code does today

`[Observed — repo at main 9634a23]`

- **The form.** `components/spend/ReceiptSubmissionForm.tsx` already matches the business to the list as you type and saves `listing_id`, or `raw_business_name` when there's no match. The photo is optional and comes last. Nothing stops a future date or a very large amount. The page title reads "Submit a receipt".
- **Storage.** Receipts land in `receipt_uploads` (`pending_review` / `approved` / `rejected`). Photos go to the private `receipt-uploads` bucket (10 MB; jpeg, png, webp, heic, heif, pdf).
- **Approval.** Approving a receipt (`lib/actions/spend/approveReceipt.ts`) writes a `spend_events` row with no user id. Only receipts matched to a listing and not opted out reach the map.
- **Rejection.** `rejectReceipt.ts` saves a free-text reason. Neither approval nor rejection sends an email. A shopper only finds out by going back to `/account/receipts`.
- **The receipt list.** `/account/receipts` is a plain list with a status pill. It shows no category.
  - `components/account/CollectivePanel.tsx` already knows the category for each business.
  - It also shows the $4.99 waitlist, as does `/flow-map`.
- **The map.** `/flow-map` (title "The Collective") is the old network map plus summary cards and a table, in one 655-line page.
  - The Silo design (round 17, layout B recommended) lives only in the docs branch `docs/ai-layer-vision`, commit `e70089d`, which is not merged.
  - The repo has no Three.js today.
- **Privacy.** The privacy policy promises:
  - we don't attach your receipts to what we send to our AI provider;
  - receipt uploads are never shared with third parties beyond what is required.

  Reading a photo with Claude therefore needs a policy change before it can switch on (see Open questions).

## References

| Reference | Borrow | Avoid |
|---|---|---|
| Fetch Rewards, snap a receipt | The photo is the first thing you do, and the store and total fill themselves from it | Points and games. The Collective has no points |
| Expensify SmartScan | It reads the merchant, date and total, shows you what it read, and lets you fix any field | Hiding what was read. We always show the filled fields before sending |
| Strava, "your activity is on the map" | The moment your effort joins a shared map, with you marked on it | A public feed of each person. Shoppers only ever show as a group |

**Current standards note:** in 2026, receipt apps lead with the camera, fill the fields from the photo, and let you correct anything before you send. They say up front how long review takes. They tell you by email or push when something needs your attention, with one button that takes you straight to it.

**Trend read:**
- **Will age well:** filling fields from the photo. It saves typing and you can always check what it read.
- **Will age well:** a running total as the reward. It's plain and honest.
- **Skipped:** confetti and streak counters. They date fast and turn spending into a game, which The Collective is not.

## Screens and options

Each screen had A, B and C options, with the lean marked in the canvas.

1. **First look.** A, map first. B, three steps then the map. C, your spend first. **Lean B.**
2. **Add a receipt.** A, short form with the photo on top. B, photo only, and the team types the rest. C, two steps. **Lean A.**
3. **My receipts.** A, plain list. B, grouped by status. C, the total, then the list. **Lean C.**
4. **Hearing back.** A, an email each time. B, on the site only. C, one email a week. **Lean A.**
5. **After a receipt is counted.** A, "Your spend joined the map". B, a quiet update. C, a share card. **Lean A.**
6. **The map (Silo).** A, Corners. B, Instrument. C, Console. **Lean B.**

## Picks

`[Decision — founder, 2026-10-31]`

| Screen | Pick |
|---|---|
| 1. First look | **B, three steps, then the map** |
| 2. Add a receipt | **A, short form, photo on top** |
| 3. My receipts | **C, total, then the list** |
| 4. Hearing back | **A, an email each time** |
| 5. After a receipt is counted | **A + C, "Your spend joined the map" and a share card** |
| 6. The map | **B, Instrument** |

| # | Question | Answer |
|---|---|---|
| Q1 | The one action word | **Add a receipt** |
| Q2 | The name of the list | **My receipts** |
| Q3 | Is the photo required? | **Yes, required** |
| Q4 | An "I shopped here" button on business pages? | **Yes** |
| Q5 | The wait we promise | **Within 3 business days** |
| Q6 | Where the $4.99 waitlist shows | **The Collective page only** |
| Q7 | Silo layout A (Corners) | **Retire it** |
| Q8 | Silo on phones | **Shared phone layout** |
| Q9 | Floor bars | **Keep the words** |
| Q10 | Dot color when the map opens | **Category** (gold stays for you) |
| Q11 | The gold pulse | **Every 1 to 2 minutes**, off for reduced motion, plus a Pause motion button |
| Q12 | Crowded neighborhoods | **Spread them a little** |
| Q13 | Finding yourself | **Gold ring and You tag** |
| Q14 | Floors we can't track yet | **Dimmed, "Not tracked yet"** |

Every pick matches the lean except screen 5, where the founder added C.

### Founder notes (verbatim, 2026-10-31)

- "the photo should extract information when available. We should be able to. match and autofill much of the receipt and even match the business by the receipt information. If the business isn't listed, we can use this as an opportunity to contact a new business to add or maybe have the customer prompt the business in some way."
- "It'd be great if we can add a category to the my receipts lines as well. We should know it if the business is listed."
- "After approval, A + C. We do want people to be able to share it."

## Open questions (asked in one round, 2026-10-31)

| # | Question | Options | Lean |
|---|---|---|---|
| O1 | How do we read the receipt photo? (ticket 163) | **A.** Claude reads it on our server, with the shopper's OK on the form. This needs a privacy policy update, notice and counsel, and the flag stays off until the update is posted. **B.** The shopper's phone reads it, so the photo never leaves for reading. No policy change, but weaker on crumpled or dim receipts. **C.** B now, then A later. | **A.** It reads business names well enough to match the list. The form works without it, so nothing else waits |
| O2 | When the business isn't listed (ticket 168) | **A.** The shopper gets a ready message and link to send the business themselves, and we keep a private list of unlisted names for your outreach. **B.** We email the business ourselves (GATE-COMMS each time). **C.** The private list only | **A** |
| O3 | Shape of the share card (ticket 166) | **A.** Text and a link to the business page through the phone's share sheet or Copy, with the amount off unless they switch it on. No public page is stored. **B.** An image card with the business name and an optional amount | **A.** Nothing about the shopper is stored or public, and it needs the smallest privacy review |
| O4 | Silo needs Three.js and React Three Fiber (ticket 167) | **A.** Add them, loaded only on `/flow-map` after the page shows, with the table as the fallback. **B.** Build Silo flat (Canvas 2D) and keep the 3D look as far as it goes | **A.** Silo was picked as a 3D shaft |

**Answers `[Decision — founder, 2026-10-31]`:** O1 **A**, O2 **A + B**, O3 **A**, O4 **A (yes)**.

- **O1 A:** Claude reads the photo on our server, only when the shopper ticks the box. `FEATURE_RECEIPT_READ` stays off in prod until the privacy policy update is posted, notice is sent and counsel has looked at it. The policy text goes in its own draft PR so it never goes live ahead of the switch.
- **O2 A + B:** the shopper invite and the private admin list, plus an "Email this business" action on the admin list. The founder types the business address and presses send, one business at a time. Nothing sends in bulk or on its own, and every send is the founder's own GATE-COMMS act. `[Needs professional review]` CAN-SPAM for one-to-one business outreach: the email carries our physical address and an opt-out line.
- **O3 A:** text and the business link through the share sheet or Copy. Amount off by default, nothing stored.
- **O4 A:** add `three`, `@react-three/fiber` and `@react-three/drei` (only what is used), loaded only on `/flow-map` after the page shows, with the table as the fallback.

## Tickets

| Ticket | What |
|---|---|
| 161 | First look: three steps then the map, and the waitlist on The Collective page only |
| 162 | Add a receipt: photo required and on top, "I shopped here" on business pages, wording everywhere |
| 163 | Read the receipt photo: autofill the fields and match the business (waits on O1) |
| 164 | My receipts: total then the list, with a category on each line and Fix and resend on the row |
| 165 | Hearing back: counted and needs-a-fix emails, a switch to turn counted emails off, preset reasons |
| 166 | After a receipt is counted: "Your spend joined the map" and a share card (share waits on O3) |
| 167 | Silo B Instrument on `/flow-map` (waits on O4) |
| 168 | Unlisted businesses: shopper invite and a private admin list (waits on O2) |

**Build order:** 162, 164, 161, 165, 167, 166, 163, 168.

**Reopening:** The Collective reopens in prod (GATE-DEPLOY) once 161, 162, 164, 165 and 167 are live.
