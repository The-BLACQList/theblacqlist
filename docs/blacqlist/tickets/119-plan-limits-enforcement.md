# Ticket 119: Enforce the Free and Starter plan limits

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR)
**Depends on:** none (no migration, no data change)
**Must merge:** before or together with PR #171 (For Business A), so the Starter card is true the day it ships.
**Decision:** founder, 2026-10-03, "Enforce the limits" (plan-features audit)

---

## Why

The Starter card sells a video, common questions, social links, a longer description and more filter details. Before this ticket, Free owners already had all of them, because only photos, products and events/jobs were enforced. A card that sells what Free already gets is not true. The founder chose to make the limits real instead of cutting the bullets.

The limits come from `TIER_LIMITS` and `FEATURE_MIN_TIER` in `lib/stripe/features.ts`. Nothing new was invented here.

| Thing                       | Free           | Starter  |
| --------------------------- | -------------- | -------- |
| Description                 | 300 characters | No limit |
| Details customers filter by | 3              | 10       |
| Common questions            | 0              | 5        |
| Video link                  | No             | 1        |
| Social links                | No             | Yes      |
| Gallery photos              | 1              | 10       |

## Policy: keep what exists, block new additions

- Nothing saved before this ticket is deleted, hidden or changed.
- A check runs only when the owner adds or changes the gated thing. Saving hours on a listing with an old long description still works.
- Removing gated content is always allowed.
- Because no data changes, there is no GATE-DATA step.

Staging count of Free listings already over a limit `[Measured — staging Management API, 2026-10-03]`: 550 listings, 547 on Free. Of the Free listings, 0 have common questions, 4 have a description over 300 characters, 0 have more than 3 filter details, 2 have a video, 100 have social links, and 2 have more than 1 gallery photo. All of them keep what they have. Prod counts are `[Unknown]` until the founder allows a prod read.

## What changed

**Checks.** `lib/stripe/planChecks.ts` holds one pure function per limit. Each returns a message the owner can act on, or null.

**Server enforcement**

| Where                                              | Check                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `lib/actions/dashboard/updateListingContent.ts`    | Description length and social links, against what is saved now                                                              |
| `lib/actions/dashboard/updateListingAttributes.ts` | Filter detail count, against the previous count                                                                             |
| `lib/actions/dashboard/addListingFaq.ts`           | Common question count                                                                                                       |
| `lib/actions/dashboard/updateListingVideo.ts`      | Video link, against the saved link                                                                                          |
| `app/api/upload/route.ts`                          | Gallery photo count. Logo and cover never count. During add-business there is no listing row yet, so the Free limit applies |
| `lib/actions/listings/createListing.ts`            | A new listing starts on Free: description length, and no social links                                                       |

**Add-business**

- `MediaStep.tsx` caps the gallery at the Free limit (1) and says so. The old copy said "up to 12 photos."
- Removing a photo during add-business used to leave its row behind. The photo still showed on the new page and counted against the limit, so an owner who swapped photos got blocked. The new `lib/actions/listings/discardDraftPhoto.ts` removes the row and the file. It only works for the uploader, and only while no listing exists for that id.
- `SubmitListingForm.tsx` shows the 300 character limit and replaces the social inputs with a note that social links come with Starter after the page is live.

**Dashboard**

- `components/dashboard/PlanLimitNote.tsx` is a small locked-state note with the reason and an "Upgrade to Starter" link. The link only shows on Free, since Starter is the only plan for sale.
- Story: "N of 300 characters" counter. A note shows when the saved text is already over the limit, or when the owner types past it.
- Social links: on Free with nothing saved, the section is just the note. With links saved, only those show, and they can be kept or cleared.
- Video: the same pattern as social links.
- Filter details: "N of 3 chosen." At the limit, unchecked boxes are disabled. A listing already over the limit can swap or remove but not add.
- Common questions: at the limit, the add form is replaced by the note. Saved questions stay and can be deleted.

## Acceptance criteria

- On a Free listing, adding a common question, a social link, a video, a 4th filter detail or a 301 character description is blocked with a plain message and an upgrade link. On Starter, each is allowed.
- On a Free listing with an old long description, saving hours (or any other field) still works.
- A Free listing that already has links, a video, questions or extra details keeps them on its public page and can remove them.
- Add-business accepts 1 gallery photo, and removing it frees the slot.
- `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and `pnpm build` are green. `tests/plan-checks.test.ts` covers allowed, blocked and grandfathered cases for every check.

## QA notes (Preview, staging data)

1. As a Free owner, try each blocked action above from the dashboard, then upgrade a staging listing to Starter (`listings.tier`) and try again.
2. Edit hours on one of the 4 Free listings with a description over 300 characters.
3. Run add-business: add a photo, remove it, add another. Then publish and check the page shows one photo.
4. Check the sections at 375px and with the keyboard (the disabled checkboxes and the upgrade link).

## Known gaps (logged, not fixed here)

1. **Downgrade gap.** An owner who leaves Starter keeps content above the Free limit. Same policy as the grandfathered listings. Needs a founder call if that should change.
2. **Jobs and events** use their own editors and are not covered by these checks. Their limits (events, job postings) were already enforced elsewhere.
3. **`lib/actions/listings/submitListing.ts`** has no importers. It is dead code and was left alone. Delete it in a cleanup PR.
4. The public listing page still shows whatever is saved, so the grandfathered content keeps rendering. That is on purpose.

## Out of scope

Pricing copy (PR #171), any data cleanup, and limits for Growth and Premium (not for sale).
