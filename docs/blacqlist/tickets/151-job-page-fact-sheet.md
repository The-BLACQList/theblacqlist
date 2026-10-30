# Ticket 151: The job page as a fact sheet

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 149 (pay helper, place builder). The closed banner works on its own from `closes_at`; 155 adds the `closed` status.
**Gates:** none. No migration, no new dependency. Still covered while the flag is off.
**Decision record (founder, 2026-10-30, screen 3 and Q2):**

1. **Job page B, fact sheet.** Breadcrumb `Jobs / {place}`, title, "at {business}", fact sheet (Type, Where, Pay, Closes), About the role, How to apply, About the business with a link to its page.
2. **How to apply:** an email is shown as text with a Copy button; otherwise the apply link.
3. **On a phone** the apply action sits in a bar fixed to the bottom of the screen.
4. **A closed role** keeps its page with "Applications closed on {date}" so shared links work.

---

## Why

`components/entity-page/EntityJobDetails.tsx` is a single-column list ending in an "Apply now" button. An email apply is a hidden `mailto:` the visitor cannot copy, there is no way to reach the hiring business except a small text link, there is no breadcrumb, and a role past its date still invites an application.

## Scope

In:

- **`components/entity-page/EntityJobDetails.tsx`** rewritten into small parts under `components/entity-page/job/`: `JobFactSheet.tsx` (a `dl` with Type, Where, Pay, Closes), `JobHowToApply.tsx`, `JobAboutBusiness.tsx`, `JobApplyBar.tsx`, `JobClosedBanner.tsx`. Keep each file under about 200 lines.
- **Breadcrumb** `Jobs / {place}` in `JobTemplate.tsx` (link "Jobs" to `/jobs`; place is plain text, or links to `/jobs?where={city-slug}` once 150 is live). Use the existing breadcrumb pattern if the other templates have one.
- **Title block.** Eyebrow "Job" in teal ink `#176679`, H1 title, line "at {business}" linking to the business page. If there is no hiring business, omit the "at" line.
- **Fact sheet.** Type (full-time etc., plus Remote/Hybrid/On-site), Where (city, state or Remote), Pay (`formatJobPay` from 149, "Unpaid" for volunteer), Closes (date, or "Open until filled" when `closes_at` is null).
- **How to apply.** `apply_email` is rendered as selectable text with a **Copy email** button (clipboard API, with a fallback that selects the text; confirmation "Copied" announced via `aria-live`; label returns after 2 seconds). `apply_url` renders as a button link opening in a new tab with `rel="noopener noreferrer"`. If both exist, show both, link first.
- **About the business.** Name, logo, one-line tagline, city, "View their page" link. Uses `hiring` from `lib/listings/entityPage.ts`; extend it to return logo, tagline, city, slug URL. Shown only when the hiring business is published (existing rule).
- **Sticky apply bar** on phones (below `md`): fixed to the bottom with safe-area padding, shows the primary apply action (Copy email, or Apply). Page gets bottom padding so content is not hidden. Not shown on 768px and up, and not shown when closed.
- **Closed state.** If `closes_at` is past (or status is `closed` after 155): banner at the top "Applications closed on {date}", apply actions replaced by that text, no sticky bar. The page keeps its content and returns 200. JSON-LD omits the role as open: keep `validThrough`, which already marks it expired to Google. Do not 404.
- **Description** under "About the role", whitespace-preserved, rendered as text (no HTML).

Out:

- Reviews (jobs have none, founder 2026-09-02), save/share buttons, "similar roles", an on-page application form.
- The status change itself (155).
- Editing job fields (`components/dashboard/JobDetailsSection.tsx` is unchanged).

## Acceptance criteria

- Given a published job with an email, when I open it, then the email shows as text and tapping **Copy email** puts it on the clipboard and shows "Copied".
- Given a job with only an apply link, then I see an **Apply** button that opens the link in a new tab, and no Copy button.
- Given a hiring business, then "at {business}" and the About the business block link to that business's page.
- Given no hiring business, then neither appears and the page still renders.
- Given a closed role, then the banner reads "Applications closed on {date}", there is no apply action, and the HTTP status is 200.
- Given a volunteer role, then Pay reads "Unpaid".
- Given `closes_at` is null, then Closes reads "Open until filled".
- Mobile 375px: single column, fact sheet rows stack label over value, the apply bar is fixed at the bottom, no content hidden behind it, bar target 48px high. 1280px: content column with the fact sheet beside or above About the role; no sticky bar.
- A11y: breadcrumb is `nav aria-label="Breadcrumb"` with `aria-current="page"`; fact sheet is a real `dl`; Copy button has a text label; the "Copied" and closed messages are announced; sticky bar is reachable in tab order and does not trap focus.
- No em dashes and no "Black-owned" label on the page.

## States

Loading: route `loading.tsx` already exists for entity pages; confirm the fact sheet is covered by it. Error: `error.tsx` unchanged. Missing optional fields: each row hides if empty (except Closes, see above).

## Data note

No migration. Reads `listing_details_job` and the hiring listing already loaded in `entityPage.ts`.

## Tests

- Unit: fact-sheet row builder (every combination of null pay, null closes_at, remote); `isRoleClosed(closesAt, now)` helper in `lib/listings/jobPosting.ts`.
- Component tests: Copy button success and clipboard-denied fallback; closed banner hides apply actions.
- Playwright (`e2e/job-page.spec.ts`, flag on for that spec): open a seeded job at 375px, bar is visible and fixed; open a closed seeded job, banner shows. `e2e/opening-soon.spec.ts` stays green with the flag off.

## QA notes

Test with email only, link only, both, neither (should be blocked by the form but old rows may exist: show "Contact details missing" and tell the poster in the dashboard, do not crash). Check iPhone SE height with the keyboard-less bar, and the Safari home-indicator padding.
