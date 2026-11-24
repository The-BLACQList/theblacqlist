# Ticket 276: For Business and Trust Page Copy

**Status:** In review, 2026-11-24.

## Why

Three lines didn't match how the site works or read badly. The founder approved the changes on 2026-11-24.

## What Changed

| Page | Before | After |
| --- | --- | --- |
| For Business, Your Story and Photos | Your story in your own words, and add up to 3 photos. | Your story in your own words, and up to 3 photos. |
| For Business, Your Logo on the Map | Where you sit on the map still comes from trust, not your plan. | Your plan doesn't change where you sit on the map. |
| How Trust Works, Claimed | They can now edit the page, respond to reviews, and keep the details current. | They can now edit the page and keep the details current. On Starter and up, they can also reply to reviews. |

- **Map:** `lib/map/rankListings.ts` puts sponsored and featured pages first, then trust tier, then name. The plan isn't used, so "comes from trust" was incomplete and the new line is true.
- **Review replies:** `lib/actions/owner/submitReviewResponse.ts` requires `review_response`, which is Starter and up.

## Not Changed

- The compare-table note "Where you sit on the map still comes from trust" (`lib/stripe/planCompare.ts`).
- The approval email (`lib/email/templates/entity-approved.tsx`) still tells every owner they can "respond to reviews any time". That needs its own founder decision.

## Checks

- `tests/for-business-copy.test.ts` pins all three lines against `lib/stripe/features.ts`.
