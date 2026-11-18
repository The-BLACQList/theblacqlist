# Ticket 231: Chapters Layout on Real Business Pages

**Phase:** V1.5 · **Priority:** P2 · **Status:** In review (draft PR)
**Depends on:** 204 (the chapters layout on the sample pages, merged a5c0b37), 206 (For Business samples).
**Gates:** GATE-DEPLOY (draft PR; merge on the founder's OK). Production stays on today's page until `FEATURE_LISTING_CHAPTERS=true` is set, which is its own GATE-DEPLOY ask.

**Decision record (founder, 2026-11-18, in Software's session):**

1. **Next up:** real pages first, then Shop round 3.
2. **Thin pages:** keep today's page until the listing has enough: a cover photo, at least four gallery photos and a story.
3. **Plans:** every plan gets it. Plan limits still apply inside the page.
4. **Preview 1:** the real look plus the key actions. Booking and the shop come in pass 2.
5. **Preset-only content** (glance line, interlude photos): built from the listing's own data. No new owner settings.
6. **Phone CTA:** keep the bottom bar (F01, Creative DR-003).

---

## Why

The chapters layout (ticket 204) only ran on the `/example` sample pages, from fixtures, with every action switched off. This ticket puts it on real listing pages for Storefront types (business, restaurant, vendor), with real data and working actions.

## Scope

**In**

- **Gate.** Flag `listingChapters` (`FEATURE_LISTING_CHAPTERS`), closed by default everywhere. Off production (a Preview or local dev), `?layout=chapters` opts one request in. `?layout=stack` always gives today's page. `lib/entity-page/chapters-eligibility.ts` holds both rules.
- **Eligibility.** Storefront type, a cover, 4+ gallery photos and a story. Anything else gets today's template.
- **Live data** (`buildChapterData(entity, preset, now, viewer)`). The cover goes through `resolveEntityCover`. The category line uses the listing's city. The badge and trust line come from `trust_tier` (Claimed, Verified, BLACQList Certified; the round TrustMark per DR-004). Links, buttons, documents and socials have real URLs. Videos link to the real video. The "Atlanta" and "Verified by The BLACQList" copy is gone from live pages.
- **Live preset** (`components/entity-page/chapters/live.ts`). Duo, interlude and menu photos come from the gallery, skipping the cover and never repeating one; a slot with no photo left is dropped. Glance = "Est. YYYY" plus the first attribute values, three at most. Visit and Menu ("Offerings" for non-restaurants) drop out of the page and the nav when empty. Shop is never listed on live pages yet.
- **Key actions** reuse the site's components:
  - Save: `SaveButton`, new `text` variant.
  - Share: `ShareButton`, new `label` prop; share analytics unchanged.
  - Message: the existing composer link; "Not Accepting Messages" when closed.
  - The primary CTA (hero, nav, quick bar, footer) and directions (Visit, footer): `ContactLink`, so contact-tap analytics fire (hero, action_bar, at_a_glance).
  - Write a Review: `ReviewFormDisclosure`, or a sign-in link. The owner gets `OwnerRespondForm` on unanswered reviews.
  - The live map (`EntityLocationMap`) and `DistanceFromYou` replace the drawn map.
  - Claim link (unclaimed only) and `ReportCorrectionForm` in the footer.
  - Copying a deal code sends `deal_code_copied`, as `DealCodeButton` does.
- **Route.** `app/[citySlug]/[entityType]/[listingSlug]/page.tsx` renders `ChaptersPage` + `StorefrontChapters` in place of the quick-action bar, the Happening Now banner and the template outlet. Metadata, JSON-LD, page and post views, the tour witness and the message composer are unchanged.

**Pass 2 (hidden on live pages for now, not switched off)**

- Booking requests, the shop, jobs, events, related listings, the Happening Now post button.
- "Read All Reviews": the page loads the latest ten and there is no all-reviews page yet.
- "I Shopped Here" (today's quick-action bar) has no place in the chapters yet.
- Professional and Creative templates.

**Out**

- Any change to the sample pages: `buildChapterData` without a viewer builds exactly what it did.

## Notes

- **Time zone.** Opening status and hours use America/New_York, as the sample pages do. `entity.city` carries no time zone field yet. A listing outside Eastern time shows Eastern "open now" until one is added.
- **Hero buttons on phones.** F01 drops the hero buttons under 768px and the quick bar carries Hours and Directions plus the CTA. Save, Share and Message sit in their own text row under the hero buttons, shown at every width, so they stay reachable on phones.
- **Photo alt text.** The hero photo is decorative on live pages (`alt=""`); gallery photos keep the owner's alt text.

## Tests

- `tests/listing-chapters.test.ts`: eligibility, the opt-in rules, live `buildChapterData` (full and thin listings, each trust tier, each viewer), the live preset (nav, photos, glance).
- `tests/feature-flags.test.ts`: `listingChapters` stays closed in every bare deployment.
- `e2e/listing-chapters.spec.ts`: a thin listing keeps today's page. With `E2E_CHAPTERS_LISTING` set to an eligible listing path: chapters render, `?layout=stack`, nav matches the sections, no held actions, Save, Share, review sign-in, Report an Error, directions, axe.
