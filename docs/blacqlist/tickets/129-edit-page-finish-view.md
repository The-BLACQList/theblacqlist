# Ticket 129: Owners edit their page in the finish view

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR, 2026-10-07)
**Depends on:** 126 (builds the finish view this ticket reuses)
**Gates:** none. No migration, no new dependency. Uses today's save actions.
**Decision record:** [add-business-workshop-2026-10.md](../design/add-business-workshop-2026-10.md)

---

## Why

`[Decision — founder, 2026-10-06]` Any edit to a business owner's page uses the same experience as the end of /add-business: the edit fields on one side and the live page filling in on the other.

Today `/dashboard/pages/[entityId]/edit` is a long stack of 13 separate forms. The owner can't see what a change does without opening "Preview" in a new tab. Photos and services live on two other pages (`/media`, `/offerings`). New owners will learn the finish view on day one, so editing later should feel the same.

## Scope

In:
- Business listings on `/dashboard/pages/[entityId]/edit`, plus the other business-shaped types (creative, service provider, vendor). `[Decision — founder, 2026-10-07]` they deserve the same experience.
- Photos (today `/dashboard/pages/[entityId]/media`) and services (today `/dashboard/pages/[entityId]/offerings`) become sections of the same view. The old URLs redirect to the matching section (`#photos`, `#services`).

Out (unchanged):
- Event and job listings keep their own branches of the edit page.
- Product and service catalog pages (`/dashboard/products`, `/dashboard/services`).
- Analytics, verification and the paid AI suggestions page. The finish view links to them. Ticket 128 decides whether its AI drafts replace the suggestions page.
- Admin edits (`/admin/entities/[id]/edit`).

## How it works

One component, two modes. Ticket 126 builds the finish view as a shared component. This ticket mounts it in **edit mode** on the dashboard.

| | New owner (126) | Edit mode (this ticket) |
|---|---|---|
| Opens from | Last step of /add-business | Dashboard, "Edit page" |
| Strength meter | Yes | Yes, same rules (`computePageChecklist`, scored against the owner's plan) |
| Sections | Drafts, then add-ons | All 13 of today's sections, plus photos and services, in the same order as the finish page |
| Live page | Fills in as the owner types | Same. It starts from the saved page |
| Google card | Yes | Yes |
| Main action | Submit for review | Save. A published page goes live on save, as it does today |
| Draft or pending page | n/a | Shows "Submit for review" from today's `PublishSection` |

**Layout.** Desktop: edit fields on the left, live page on the right, sticky as the left side scrolls. Phone: the same pattern the finish page uses there. The live page is the base, and each section opens as a sheet over it.

**Saving.** Each section keeps its own save, using today's actions. The live page shows unsaved typing right away and marks it "Not saved yet" until the save lands. A published page goes live on save, so the save button on a published page says "Save and publish". Leaving with unsaved changes asks first.

**Locked sections.** Sections the plan doesn't include (socials, video) show as add-ons with the upgrade path, the same way the finish page shows them. Socials already saved on a Free page stay saved, and show once the owner is on Starter.

**Moved pages.** "View live page" opens the real page in a new tab. Analytics and verification stay one tap away in the dashboard nav.

| Need | Reuse |
|---|---|
| The view | The finish view component from 126, in edit mode |
| Saves | `updateListingContent`, `updateListingAttributes`, `updateCta`, `updateListingVideo`, `addListingLink` / `deleteListingLink`, `addListingFaq` / `deleteListingFaq`, `addService` / `updateService` / `deleteService`, the media actions (`setCoverImage`, `deleteMedia`, `updateMediaAltText`) |
| Live page | The real listing page parts, fed by form state. Never a separate mock that can drift |
| Submit | `submitListingForReviewAction` through `PublishSection` |

## Acceptance criteria

- Given an owner opens Edit page on a business listing, then they see the edit fields and the live page side by side (desktop), or the live page with section sheets (phone).
- Given the owner types in any field, then the live page updates right away and marks the change "Not saved yet" until saved.
- Given the owner saves a section on a published page, then the change is live and the "Not saved yet" mark clears. No other section's unsaved typing is lost.
- Given the save fails (a plan limit, validation, network), then the typing is kept, the reason shows next to the field, and the live page goes back to the saved value for that field only.
- Given the owner leaves with unsaved changes, then they're asked before leaving.
- Given a Free listing, then the strength meter can reach 100 without 3+ photos or socials, and locked sections show as add-ons.
- Given the old `/media` or `/offerings` URL, then it lands on the matching section of the edit view.
- Given an event or job listing, then the edit page is unchanged.
- Given 390px and 1440px, dark mode, and reduced motion, then there is no sideways scroll, and the live page doesn't animate in reduced motion.
- Keyboard only: every section and save is reachable, and focus returns to the section after a sheet closes on a phone.

## QA notes

- Run `tsc`, `eslint` and vitest (start Docker first).
- Update any e2e test that opens `/dashboard/pages/[id]/edit`, `/media` or `/offerings`.
- Playwright: edit each section on a published business page at 390 and 1440. Confirm the public page matches after save.
- Walk it on a Free, a Starter and a top-plan page so the locked add-ons and meter scoring are checked on each.
- The Preview reads STAGING data. A staging owner account with a published business page is needed to walk it. Ask before creating one.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The live preview drifts from the real page | Medium | High | Build the preview from the real listing page parts, not a copy |
| Owners think typing alone published a change | Medium | Medium | "Not saved yet" mark, "Save and publish" label, and the leave warning |
| One big client component gets slow on phones | Low | Medium | One section's form mounts at a time on phones (sheets) |

## Implementation notes (2026-10-07)

- Every listing type except event and job opens the finish view in edit mode. `loadFinishData` now refuses only events and jobs. The old 13-form stack is gone, since no type uses it any more.
- `/media` and `/offerings` redirect to `#photos` and `#services` for those same types. Events and jobs keep both pages.
- Phone: the edit page uses the finish page's phone pattern (a compact live page on top, the sections stacked below), not section sheets. The finish page never built sheets, so this keeps the two the same, as the ticket asks. Sheets can come later for both at once.
- Side by side starts at `xl` (1280px) in edit mode instead of `lg`, because the dashboard sidebar takes width. Below that, the compact preview sits on top.
- On a published page every section button reads "Save and publish" (a small context, `SaveLabelProvider`), and a line at the top says each save goes live right away. Event and job editors keep "Save".
- Leave warning (`useLeaveGuard`): any section form touched and not saved, or a typed name, tagline or about not saved, asks before reload, close or an in-app link. The browser back button can't be stopped from a page.
- Saves already refresh `/edit` through `revalidateOwnerEditors` (built in 126), so the meter and preview move after each save.
- Creative, service provider and vendor pages with no detail row yet get one on their first content or main-button save (those actions upsert). The video save still updates only, same as before.
- The owner dashboard sidebar had no phone layout: it stayed a 224px column and left the editor about 120px wide at 393px. Below `md` it is now a full-width bar on top with nav rows that scroll sideways, and dashboard pages get a 16px gutter on phones. The admin sidebar has the same problem and is not changed here.
- The live preview hero grows with a long name instead of pushing it up under the Black-Owned badge (seen on a two-line creative name). The add-business finish page shares the fix.
- Checked in a browser on the local DB at 375, 1100 and 1440 with a business page and a creative page: no sideways scroll, no console errors, side by side only at 1440, the leave warning fires on a sidebar link and not on a jump link, `/media` and `/offerings` land on their sections. The local DB has no event or job pages, so their unchanged editors were checked by code and e2e only.

