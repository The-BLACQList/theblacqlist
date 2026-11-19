# Ticket 233: Full Pages for Paying Businesses

**Status:** draft PR (`fix/233-full-paid-pages`). Merging needs the founder's OK (GATE-DEPLOY).

## Why

Ticket 231 put the chapters layout live on 2026-11-19. A Storefront listing gets it once it has a banner photo, at least 4 gallery photos and a story (`lib/entity-page/chapters-eligibility.ts`). Ops reviewed what a paying (Starter and up) page looks like on it and found five gaps. The founder asked for all of them, in the Ops session on 2026-11-19, and said "Start it" in Software's session the same day.

Founder rulings (2026-11-19):

- Send all four page fixes.
- Starter keeps priced menus. Change the plan rules and copy to match rather than adding a check.
- The Shop part of the page stays Growth and Premium.
- Paid job postings stay on at launch: no change to `FEATURE_PAID_POSTINGS`.

## Changes

1. **Owners are told the 4-photo rule.**
   - The strength meter's gallery item passed at 3 photos. It now passes at `CHAPTERS_MIN_PHOTOS` (4), so a full meter no longer leaves a page on the old layout.
   - For Storefront types, its hint says a banner photo, 4 photos and a description turn on the full page layout.
   - The editor's Photos card gets a line naming what turns the full page on and what is still missing (`chaptersMissing`). It shows for Storefront types on plans that allow 4 or more photos.
   - Free allows 1 photo, so the gallery item stays out of a Free page's score as before.
2. **No empty hours.** With no weekly hours, the Visit chapter shows no "Opening Hours" table and no "No changes in the next 30 days." line. Dated special hours still show if there are any.
3. **"1 Video".** The video heading and count are singular for one video (`videoCountLabel`).
4. **No photo repeats (Creative F11).**
   - The gallery leaves out the photos the page already shows: the cover, the duo, the interludes, and the menu photo when a menu shows (`storefrontPlacedSrcs`).
   - The menu photo is only taken when a menu shows, so that photo goes to the gallery instead.
   - With no photos left, the Gallery chapter drops out of the page and the nav, or becomes "Videos" when the listing has videos.
   - Photos are compared by their `listing-media/` path (`photoKey`). A cover stored as a bare path then matches its gallery URL; before this, the cover could also appear in a slot.
5. **Priced menus on Starter.**
   - `service_menu_pricing` moves from Growth (2) to Starter (1).
   - Starter's plan card adds "Your menu or service list, with prices", and the pricing FAQ adds the same.
   - `storefront` (the Shop) stays Growth.

## Tests

- `tests/full-paid-pages.test.ts`: the meter's 4-photo rule, `chaptersMissing` agreeing with `chaptersEligible`, `photoKey`, "1 Video", and no repeats at 4 to 10 photos, including a bare-path cover.
- `tests/feature-gating.test.ts`, `tests/plan-copy.test.ts`: priced menus on Starter, the Shop still Growth.
- `e2e/listing-chapters.spec.ts`: no photo src appears twice on the sample storefront, or on `E2E_CHAPTERS_LISTING` when set.

## Not in this ticket

- Pass 2 of 231 (booking, Shop, events, jobs and related chapters; Reviews bars; Professional and Creative types).
- O-01 to O-03 from the 232 QA.
- A plan check on priced menus. `addServiceAction` still has none; the founder chose a rule and copy change only.
