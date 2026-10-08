# Ticket 126: Add-business redesign, rules-first

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 125 (closes into this PR)
**Gates:** GATE-DATA (one migration: `category_requests` table and the `moderation_queue` check fix). Staging, then prod, then merge.
**Decision record:** [add-business-workshop-2026-10.md](../design/add-business-workshop-2026-10.md)

---

## Why

Owners stall on `/add-business`: step 2 shows too much, the main button is asked twice, the founder story is dropped, no listing gets a city, and a reload restarts the form and orphans photos. The founder approved the round 2 flow on 2026-10-05. This ticket builds it with today's matching rules and no AI, so it can ship first.

## How it works

One flow. On a phone, one short question per sheet over the live page. On desktop, the question on the left and the live page on the right. Submit is available at any time.

1. **Bring in what you already have** (step 0). In this ticket it is a visible step with "Skip, I'll type it" only. Ticket 127 fills it in behind `FEATURE_SITE_IMPORT`. With the flag off, the step is hidden.
2. **Business name**, with "Is this you? Claim it" matches. The duplicate-check route is widened to match by name in any city.
3. **What do you do?** One box, 1 to 3 sentences, in the owner's words. The founder story folds into this prompt.
4. **Here's how we'd list you.** One suggestion from `searchGuide` / `suggestCategories` / `buildGuidePick` in `lib/categories/sorting-guide.ts`. "Not quite" shows two more, then the 13 groups, then "Suggest a new category" under the closest group.
5. **Main button**, asked once.
6. **One line** about the business.
7. **Finish page:** page-strength meter, drafts, add-on sections, and a "How you'll show up on Google" card.

Drafts are written when the owner taps "Save my draft" (no separate tap). The description seeds the about text. The first sentence seeds the tagline. Both stay editable.

New category promise: the listing sits under the closest group until the team adds the category, and we email the owner either way.

| Need | Reuse |
|---|---|
| Saving the draft | `createListingAction` (`lib/actions/listings/createListing.ts`) |
| Finish sections | `updateListingContent`, `updateListingAttributes`, `updateCta`, `addService`, the media actions |
| Finish view | Build it as one shared component with a new-owner mode and an edit mode. Ticket 129 mounts the edit mode on the dashboard edit page (founder, 2026-10-06), so don't tie it to /add-business state |
| Strength meter | `computePageChecklist` (`lib/ai/checklist.ts`), moved out of the paid-only page. It scores against the owner's plan, so a Free page can reach 100 |
| Submitting | `submitListingForReviewAction`, reachable from the finish page and from the dashboard `PublishSection` |

Fixes that ride along:

- Ask for the main button once.
- Resolve the city pick to `city_id`.
- Keep the founder story.
- Reload restores the draft and does not orphan photos.
- The listing page (`app/[citySlug]/[entityType]/[listingSlug]/page.tsx` `generateMetadata`) uses `meta_title` and `meta_description` when set, and keeps today's built text as the fallback.
- `app/sitemap.ts` honors `noindex`.
- `submitForReview.ts` inserts `queue_type='new_submission'`, which the `moderation_queue` check rejects, and the error is ignored. Read the error, and fix the check (see Gates).
- A saved draft can be submitted from the dashboard `PublishSection`, not only by linking back to /add-business.

## Acceptance criteria

Flow and pacing
- Given an owner opens /add-business, when the page loads, then they see one question at a time with the live page updating after each answer.
- Given a sign-in email already known server side, when the flow runs, then it never asks for the email again.
- Given the owner has not finished, when they tap submit at any point, then the draft is saved and sent for review, and missing items are listed.
- Given the owner types words that match nothing, when they tap "Not quite" through the layers, then they always reach the 13 groups and then "Suggest a new category".
- Given the owner picks "Suggest a new category", when they save, then the listing is saved under the closest group and a `category_requests` row exists with their words, the proposed name, the parent group and the listing id.
- Given the owner's reload mid-flow, when the page reopens, then their answers return and no photo is orphaned.

Data
- Given the owner picks a city, when the draft saves, then `listings.city_id` is set and the URL is not `/online/...`.
- Given the owner answers the main button question, then it is asked once and saved once.
- Given a founder story was entered, then it appears in the about text seed.
- Given `submitListingForReviewAction` runs, then a `moderation_queue` row with `queue_type='new_submission'` exists, and a failed insert surfaces an error instead of being ignored.

SEO
- Given `meta_title` and `meta_description` are set, then the listing page metadata uses them. Given they are empty, then today's built text is used.
- Given a listing is `noindex`, then it is not in the sitemap.
- Given rules build a search description, then it is always at least 40 characters, and "Use this" is never blocked by length.

Layout bugs from the round 2 checks
- Given a phone viewport (390px), when a list with `overflow:hidden` sits inside the flex-column scroll sheet, then it keeps its height (`flex-shrink:0`) and is never 0px tall.
- Given a required field is missing, then the primary button stays enabled and focus moves to the missing field with a visible reason. It is never a disabled button with its reason off screen.
- Given the page at 390px and 1440px, in dark mode and with reduced motion, then there is no sideways scroll.

Finish page
- Given a Free listing, then the strength meter can reach 100 without 3+ photos or socials.
- Given the owner is signed in on Free, then the Google card shows the title, link and description built from the page fields.

## Gates

- **GATE-DATA** (one migration, staging, then prod, then merge):
  - `category_requests` table: the owner's words, proposed name, parent group, listing id, status, reviewed by. RLS: the owner can insert and read their own rows. Reviewers and admins read all. Approval is service role only.
  - Add `'new_submission'` to the `moderation_queue.queue_type` check. Before writing it, confirm the failure with a read-only staging query, and only with the founder's OK.
  - A simple admin list to approve (creates the category and moves the listing) or decline a request.
- No other gates. No AI, no new dependency.

## QA notes

- Run `tsc`, `eslint` and vitest with Docker running (migration tests skip silently without it).
- Unit tests: no-match always reaches the groups and then "Suggest"; `city_id` is set; metadata prefers `meta_*`; the sitemap honors `noindex`; the rules description is at least 40 characters.
- Update test C in `e2e/cross-browser.spec.ts`.
- Playwright at 390 and 1440, including the "Not quite" layers and the suggest-a-category path.
- Walk it as a barber, a food truck, a lawyer, a candle maker and henna (the no-match case). Do one walk with the keyboard only.
- The Preview reads STAGING data. Say up front what it cannot show. A local walk-through needs a categories seed write, so ask first.

## Open polish items

Not yet decided by the founder (see the decision record): label the 11 strength-meter segments, finish-page order, brand-styled primary button, small text sizes, empty hero preview on steps 0 and 1. Build the recommendations unless told otherwise.
